import { Graph, Node, ThermalPoint, LandCoverPolygon, Path } from './types';
import { point, polygon } from '@turf/turf';
import { booleanPointInPolygon } from '@turf/turf';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function getTemperatureAtPoint(
  lat: number,
  lon: number,
  thermalPoints: ThermalPoint[],
  landCoverPolygons: LandCoverPolygon[]
): number {
  // Find nearest thermal point
  let minDist = Infinity;
  let nearestTemp = 25; // Default temperature

  thermalPoints.forEach(point => {
    const dist = haversineDistance(lat, lon, point.lat, point.lng);
    if (dist < minDist) {
      minDist = dist;
      nearestTemp = point.temperature;
    }
  });

  // Adjust temperature based on land cover
  const pt = point([lon, lat]);
  landCoverPolygons.forEach(poly => {
    if (booleanPointInPolygon(pt, poly)) {
      const landCover = poly.properties.landCover;
      // Temperature adjustments based on land cover type
      switch (landCover) {
        case 'tree':
          nearestTemp -= 2;
          break;
        case 'water':
          nearestTemp -= 1;
          break;
        case 'asphalt':
          nearestTemp += 3;
          break;
        case 'building':
          nearestTemp += 2;
          break;
      }
    }
  });

  return nearestTemp;
}

export async function findCoolestPath(
  graph: Graph,
  thermalPoints: ThermalPoint[],
  landCoverPolygons: LandCoverPolygon[],
  start: [number, number],
  end: [number, number]
): Promise<Path> {
  // Find nearest nodes to start and end points
  let startNode: Node | null = null;
  let endNode: Node | null = null;
  let minStartDist = Infinity;
  let minEndDist = Infinity;

  graph.nodes.forEach(node => {
    const startDist = haversineDistance(start[0], start[1], node.lat, node.lon);
    const endDist = haversineDistance(end[0], end[1], node.lat, node.lon);

    if (startDist < minStartDist) {
      minStartDist = startDist;
      startNode = node;
    }
    if (endDist < minEndDist) {
      minEndDist = endDist;
      endNode = node;
    }
  });

  if (!startNode || !endNode) {
    throw new Error('Could not find nearest nodes to start/end points');
  }

  // A* implementation
  const openSet = new Set([startNode.id]);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();

  gScore.set(startNode.id, 0);
  fScore.set(startNode.id, haversineDistance(startNode.lat, startNode.lon, endNode.lat, endNode.lon));

  while (openSet.size > 0) {
    // Find node with lowest fScore
    let currentId = -1;
    let lowestFScore = Infinity;
    openSet.forEach(id => {
      const score = fScore.get(id) || Infinity;
      if (score < lowestFScore) {
        lowestFScore = score;
        currentId = id;
      }
    });

    if (currentId === endNode.id) {
      // Reconstruct path
      const path: number[][] = [];
      let current = currentId;
      let totalTemp = 0;
      let totalDist = 0;
      let landCover = '';

      while (current !== startNode.id) {
        const node = graph.nodes.get(current)!;
        path.unshift([node.lon, node.lat]);
        
        const prev = cameFrom.get(current)!;
        const prevNode = graph.nodes.get(prev)!;
        totalDist += haversineDistance(node.lat, node.lon, prevNode.lat, prevNode.lon);
        totalTemp += getTemperatureAtPoint(node.lat, node.lon, thermalPoints, landCoverPolygons);
        
        current = prev;
      }

      // Add start point
      path.unshift([startNode.lon, startNode.lat]);

      return {
        coordinates: path,
        temperature: totalTemp / path.length,
        distance: totalDist,
        landCover: landCover || 'mixed'
      };
    }

    openSet.delete(currentId);
    const current = graph.nodes.get(currentId)!;

    // Check neighbors
    const neighbors = graph.edges.get(currentId) || new Set();
    neighbors.forEach(neighborId => {
      const neighbor = graph.nodes.get(neighborId)!;
      const tentativeGScore = (gScore.get(currentId) || 0) +
        haversineDistance(current.lat, current.lon, neighbor.lat, neighbor.lon);

      if (tentativeGScore < (gScore.get(neighborId) || Infinity)) {
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeGScore);
        fScore.set(neighborId, tentativeGScore +
          haversineDistance(neighbor.lat, neighbor.lon, endNode.lat, endNode.lon));
        
        if (!openSet.has(neighborId)) {
          openSet.add(neighborId);
        }
      }
    });
  }

  throw new Error('No path found');
} 