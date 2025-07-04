import { NextResponse } from "next/server"
import { getSegmentationCollection } from "@/lib/mongodb"

export async function GET() {
  try {
    const collection = await getSegmentationCollection()

    // Get the latest land cover analysis
    const latestAnalysis = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray()

    if (latestAnalysis.length === 0) {
      // Return default values if no analysis is available
      return NextResponse.json({
        landCover: [
          { type: "Asphalt", percentage: 35, color: "bg-gray-600" },
          { type: "Buildings", percentage: 28, color: "bg-gray-400" },
          { type: "Tree Canopy", percentage: 22, color: "bg-green-500" },
          { type: "Grass/Parks", percentage: 10, color: "bg-green-300" },
          { type: "Water", percentage: 5, color: "bg-blue-500" },
        ]
      })
    }

    const analysis = latestAnalysis[0]

    // Convert the analysis data to the required format
    const landCover = [
      {
        type: "Asphalt",
        percentage: Math.round(analysis.landCover.asphalt * 100),
        color: "bg-gray-600"
      },
      {
        type: "Buildings",
        percentage: Math.round(analysis.landCover.buildings * 100),
        color: "bg-gray-400"
      },
      {
        type: "Tree Canopy",
        percentage: Math.round(analysis.landCover.treeCanopy * 100),
        color: "bg-green-500"
      },
      {
        type: "Grass/Parks",
        percentage: Math.round(analysis.landCover.grassParks * 100),
        color: "bg-green-300"
      },
      {
        type: "Water",
        percentage: Math.round(analysis.landCover.water * 100),
        color: "bg-blue-500"
      }
    ]

    return NextResponse.json({ landCover })
  } catch (error) {
    console.error("Error fetching land cover analysis:", error)
    return NextResponse.json(
      { error: "Failed to fetch land cover analysis" },
      { status: 500 }
    )
  }
} 