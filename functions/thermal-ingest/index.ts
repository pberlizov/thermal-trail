import { Storage } from '@google-cloud/storage';
import { MongoClient } from 'mongodb';
import * as functions from '@google-cloud/functions-framework';
import * as geotiff from 'geotiff';

const storage = new Storage();
const mongoClient = new MongoClient(process.env.MONGODB_URI!);

interface ThermalDataPoint {
  lat: number;
  lng: number;
  temperature: number;
  timestamp: Date;
  source: 'satellite';
}

interface CloudEvent {
  data: {
    bucket: string;
    name: string;
    contentType?: string;
    size?: number;
  };
}

async function ensureTimeSeriesIndex(collection: any) {
  await collection.createIndex({ timestamp: 1 });
  await collection.createIndex({ lat: 1, lng: 1 });
  await collection.createIndex({ timestamp: 1, lat: 1, lng: 1 });
}

functions.cloudEvent('processThermalData', async (cloudEvent: CloudEvent) => {
  const { bucket, name, contentType, size } = cloudEvent.data;
  
  if (!bucket || !name) {
    throw new Error('Missing bucket or file name');
  }

  if (contentType !== 'image/tiff' && contentType !== 'application/x-tiff') {
    throw new Error('Invalid file type. Expected GeoTIFF.');
  }

  try {
    // Download the TIFF file
    const file = storage.bucket(bucket).file(name);
    const [fileContent] = await file.download();
    
    // Parse the GeoTIFF
    const tiff = await geotiff.fromArrayBuffer(fileContent);
    const image = await tiff.getImage();
    const [width, height] = image.getDimensions();
    
    // Validate image dimensions
    if (width !== 256 || height !== 256) {
      throw new Error(`Invalid image dimensions. Expected 256x256, got ${width}x${height}`);
    }
    
    const bbox = image.getBoundingBox();
    const data = await image.readRasters();
    
    // Connect to MongoDB
    await mongoClient.connect();
    const db = mongoClient.db('thermal-trail');
    const collection = db.collection<ThermalDataPoint>('thermal-data');
    
    // Ensure time-series indexes
    await ensureTimeSeriesIndex(collection);
    
    // Process the data
    const points: ThermalDataPoint[] = [];
    const [minX, minY, maxX, maxY] = bbox;
    const timestamp = new Date();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const temperature = data[0][y * width + x];
        if (temperature !== null && !isNaN(temperature)) {
          const lat = minY + (y / height) * (maxY - minY);
          const lng = minX + (x / width) * (maxX - minX);
          
          points.push({
            lat,
            lng,
            temperature,
            timestamp,
            source: 'satellite'
          });
        }
      }
    }
    
    // Batch insert into MongoDB
    if (points.length > 0) {
      await collection.insertMany(points);
    }
    
    console.log(`Processed ${points.length} thermal data points from ${name}`);
    
  } catch (error) {
    console.error('Error processing thermal data:', error);
    throw error;
  } finally {
    await mongoClient.close();
  }
}); 