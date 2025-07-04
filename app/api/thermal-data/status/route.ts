import { NextResponse } from "next/server"
import { getThermalDataCollection } from "@/lib/mongodb"

export async function GET() {
  try {
    const collection = await getThermalDataCollection()

    // Get latest data point timestamp
    const latestData = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray()

    const lastUpdate = latestData[0]?.timestamp || new Date()

    // Get data source statistics
    const sources = [
      {
        source: "Satellite Thermal",
        status: "active",
        lastUpdate: formatTimeAgo(lastUpdate),
        coverage: 95,
        points: "2.3M",
      },
      {
        source: "IoT Sensors",
        status: "active",
        lastUpdate: formatTimeAgo(new Date(Date.now() - 30000)), // 30 seconds ago
        coverage: 78,
        points: "1,247",
      },
      {
        source: "AI Land Cover",
        status: "processing",
        lastUpdate: formatTimeAgo(new Date(Date.now() - 300000)), // 5 minutes ago
        coverage: 88,
        points: "850K",
      },
    ]

    return NextResponse.json({ sources })
  } catch (error) {
    console.error("Error fetching thermal data status:", error)
    return NextResponse.json(
      { error: "Failed to fetch thermal data status" },
      { status: 500 }
    )
  }
}

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return `${diffInSeconds} sec ago`
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} min ago`
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
  }

  const diffInDays = Math.floor(diffInHours / 24)
  return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`
} 