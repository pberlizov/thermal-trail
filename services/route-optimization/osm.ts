import axios from 'axios';
import { Graph } from './types';

export async function getOSMRoadGraph(
  start: [number, number],
  end: [number, number]
): Promise<Graph> {
  // Calculate bounding box with some padding
  const padding = 0.01; // ~1km
  const bbox = [
    Math.min(start[0], end[0]) - padding,
    Math.min(start[1], end[1]) - padding,
    Math.max(start[0], end[0]) + padding,
    Math.max(start[1], end[1]) + padding
  ].join(',');

  // Fetch OSM data
  const response = await axios.get(
    `https://overpass-api.de/api/interpreter`,
    {
      params: {
        data: `
          [out:json][timeout:25];
          (
            way["highway"~"primary|secondary|tertiary|residential|unclassified"](${bbox});
            >;
          );
          out body;
        `
      }
    }
  );

  // Process OSM data into graph
  const graph: Graph = {
    nodes: new Map(),
    edges: new Map()
  };

  const elements = response.data.elements;
  const nodes = elements.filter((e: any) => e.type === 'node');
  const ways = elements.filter((e: any) => e.type === 'way');

  // Add nodes
  nodes.forEach((node: any) => {
    graph.nodes.set(node.id, {
      id: node.id,
      lat: node.lat,
      lon: node.lon
    });
  });

  // Add edges
  ways.forEach((way: any) => {
    const nodes = way.nodes;
    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i];
      const to = nodes[i + 1];
      
      if (!graph.edges.has(from)) {
        graph.edges.set(from, new Set());
      }
      if (!graph.edges.has(to)) {
        graph.edges.set(to, new Set());
      }
      
      graph.edges.get(from)!.add(to);
      graph.edges.get(to)!.add(from);
    }
  });

  return graph;
} 