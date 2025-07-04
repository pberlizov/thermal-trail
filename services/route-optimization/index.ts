import express from 'express';
import { MongoClient } from 'mongodb';
import { getOSMRoadGraph } from './osm';
import { findCoolestPath } from './pathfinding';

const app = express();
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGODB_URI!);

interface RouteRequest {
  start: [number, number];  // [lat, lng]
  end: [number, number];    // [lat, lng]
  timestamp?: string;       // ISO date string
}

interface RouteResponse {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: number[][];
  };
  properties: {
    temperature: number;
    distance: number;
    landCover: string;
  };
}

async function findRoute(start: [number, number], end: [number, number], timestamp?: string): Promise<RouteResponse> {
  try {
    await mongoClient.connect();
    const db = mongoClient.db('thermal-trail');
    
    // Get thermal data points
    const thermalCollection = db.collection('thermal-data');
    const thermalQuery = timestamp ? {
      timestamp: {
        $gte: new Date(timestamp),
        $lt: new Date(new Date(timestamp).setHours(23, 59, 59, 999))
      }
    } : {};
    const thermalPoints = await thermalCollection.find(thermalQuery).toArray();
    
    // Get land cover polygons
    const landCoverCollection = db.collection('land-cover');
    const landCoverPolygons = await landCoverCollection.find(thermalQuery).toArray();
    
    // Get OSM road graph
    const roadGraph = await getOSMRoadGraph(start, end);
    
    // Find coolest path
    const path = await findCoolestPath(roadGraph, thermalPoints, landCoverPolygons, start, end);
    
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: path.coordinates
      },
      properties: {
        temperature: path.temperature,
        distance: path.distance,
        landCover: path.landCover
      }
    };
    
  } catch (error) {
    console.error('Error finding route:', error);
    throw error;
  } finally {
    await mongoClient.close();
  }
}

app.post('/find-route', async (req, res) => {
  try {
    const { start, end, timestamp } = req.body as RouteRequest;
    
    if (!start || !end) {
      return res.status(400).json({ error: 'Missing start or end coordinates' });
    }
    
    const route = await findRoute(start, end, timestamp);
    res.json(route);
    
  } catch (error) {
    console.error('Error in /find-route endpoint:', error);
    res.status(500).json({ error: 'Failed to find route' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Route optimization service listening on port ${port}`);
}); 