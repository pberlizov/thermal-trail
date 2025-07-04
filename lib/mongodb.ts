import { MongoClient, Collection } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export interface ThermalDataPoint {
  lat: number;
  lng: number;
  temperature: number;
  timestamp: Date;
  source: 'satellite' | 'iot';
  landCover?: string;
}

export interface LandCoverPolygon {
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

export interface RouteSegment {
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

export interface LandCoverAnalysis {
  timestamp: Date;
  landCover: {
    asphalt: number;
    buildings: number;
    treeCanopy: number;
    grassParks: number;
    water: number;
  };
}

export async function getThermalDataCollection(): Promise<Collection<ThermalDataPoint>> {
  const client = await clientPromise;
  return client.db('thermal-trail').collection<ThermalDataPoint>('thermal-data');
}

export async function getLandCoverCollection(): Promise<Collection<LandCoverPolygon>> {
  const client = await clientPromise;
  return client.db('thermal-trail').collection<LandCoverPolygon>('land-cover');
}

export async function getRoutesCollection(): Promise<Collection<RouteSegment>> {
  const client = await clientPromise;
  return client.db('thermal-trail').collection<RouteSegment>('routes');
}

export async function getSegmentationCollection(): Promise<Collection<LandCoverAnalysis>> {
  const client = await clientPromise;
  return client.db('thermal-trail').collection<LandCoverAnalysis>('segmentation-analysis');
}

export default clientPromise; 