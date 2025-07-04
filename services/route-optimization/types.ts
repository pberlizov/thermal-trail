export interface Node {
  id: number;
  lat: number;
  lon: number;
}

export interface Graph {
  nodes: Map<number, Node>;
  edges: Map<number, Set<number>>;
}

export interface ThermalPoint {
  lat: number;
  lng: number;
  temperature: number;
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
  };
}

export interface Path {
  coordinates: number[][];
  temperature: number;
  distance: number;
  landCover: string;
} 