import express from 'express';
import { Storage } from '@google-cloud/storage';
import { PredictionServiceClient } from '@google-cloud/automl';
import { MongoClient } from 'mongodb';
import * as geotiff from 'geotiff';
import { polygon } from '@turf/turf';

const app = express();
app.use(express.json());

const storage = new Storage();
const predictionClient = new PredictionServiceClient();
const mongoClient = new MongoClient(process.env.MONGODB_URI!);

interface LandCoverPolygon {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    landCover: string;
    confidence: number;
    timestamp: Date;
  };
}

async function processSegmentation(bucket: string, name: string): Promise<void> {
  try {
    // Download the TIFF file
    const file = storage.bucket(bucket).file(name);
    const [fileContent] = await file.download();
    
    // Parse the GeoTIFF
    const tiff = await geotiff.fromArrayBuffer(fileContent);
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox();
    const data = await image.readRasters();
    
    // Prepare image for Vertex AI
    const imageBuffer = Buffer.from(fileContent);
    const base64Image = imageBuffer.toString('base64');
    
    // Call Vertex AI endpoint
    const [prediction] = await predictionClient.predict({
      name: process.env.VERTEX_ENDPOINT!,
      payload: {
        image: {
          imageBytes: base64Image
        }
      }
    });
    
    // Process segmentation mask
    const mask = prediction.imageObjectDetection?.boundingBoxes || [];
    const polygons: LandCoverPolygon[] = mask.map((box, index) => {
      const [minX, minY, maxX, maxY] = bbox;
      const width = maxX - minX;
      const height = maxY - minY;
      
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [minX + box.xMin * width, minY + box.yMin * height],
            [minX + box.xMax * width, minY + box.yMin * height],
            [minX + box.xMax * width, minY + box.yMax * height],
            [minX + box.xMin * width, minY + box.yMax * height],
            [minX + box.xMin * width, minY + box.yMin * height]
          ]]
        },
        properties: {
          landCover: box.displayName || 'unknown',
          confidence: box.score || 0,
          timestamp: new Date()
        }
      };
    });
    
    // Store in MongoDB
    await mongoClient.connect();
    const db = mongoClient.db('thermal-trail');
    const collection = db.collection<LandCoverPolygon>('land-cover');
    
    if (polygons.length > 0) {
      await collection.insertMany(polygons);
    }
    
    console.log(`Processed ${polygons.length} land cover polygons`);
    
  } catch (error) {
    console.error('Error processing segmentation:', error);
    throw error;
  } finally {
    await mongoClient.close();
  }
}

app.post('/process', async (req, res) => {
  try {
    const { bucket, name } = req.body;
    
    if (!bucket || !name) {
      return res.status(400).json({ error: 'Missing bucket or file name' });
    }
    
    await processSegmentation(bucket, name);
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error in /process endpoint:', error);
    res.status(500).json({ error: 'Failed to process segmentation' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Segmentation service listening on port ${port}`);
}); 