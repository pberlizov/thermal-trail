import { NextResponse } from "next/server";
import { getLandCoverCollection } from "@/lib/mongodb";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bounds = searchParams.get("bounds");
    const timestamp = searchParams.get("timestamp");

    const collection = await getLandCoverCollection();
    
    // Parse bounds if provided
    let query: any = {};
    if (bounds) {
      const [sw, ne] = bounds.split(',').map(coord => coord.split(':').map(Number));
      query = {
        'geometry.coordinates': {
          $geoIntersects: {
            $geometry: {
              type: 'Polygon',
              coordinates: [[
                [sw[1], sw[0]],
                [ne[1], sw[0]],
                [ne[1], ne[0]],
                [sw[1], ne[0]],
                [sw[1], sw[0]]
              ]]
            }
          }
        }
      };
    }

    // Add timestamp filter if provided
    if (timestamp) {
      const date = new Date(timestamp);
      query.timestamp = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      };
    }

    const landCoverData = await collection.find(query).toArray();

    return NextResponse.json({
      type: 'FeatureCollection',
      features: landCoverData,
      timestamp: new Date().toISOString(),
      bounds: bounds || "default",
    });
  } catch (error) {
    console.error('Error fetching land cover data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch land cover data' },
      { status: 500 }
    );
  }
} 