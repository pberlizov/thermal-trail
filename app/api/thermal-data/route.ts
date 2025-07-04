import { NextResponse } from "next/server"
import { getThermalDataCollection } from "@/lib/mongodb"

// Simulated thermal data API
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bounds = searchParams.get("bounds")
    const timestamp = searchParams.get("timestamp")

    const collection = await getThermalDataCollection()
    
    // Parse bounds if provided
    let query: any = {}
    if (bounds) {
      const [sw, ne] = bounds.split(',').map(coord => coord.split(':').map(Number))
      query = {
        lat: { $gte: sw[0], $lte: ne[0] },
        lng: { $gte: sw[1], $lte: ne[1] }
      }
    }

    // Add timestamp filter if provided
    if (timestamp) {
      const date = new Date(timestamp)
      query.timestamp = {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    }

    const thermalData = await collection.find(query).toArray()

    return NextResponse.json({
      data: thermalData,
      timestamp: new Date().toISOString(),
      bounds: bounds || "default",
    })
  } catch (error) {
    console.error('Error fetching thermal data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch thermal data' },
      { status: 500 }
    )
  }
}
