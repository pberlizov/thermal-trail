import { NextResponse } from "next/server"
import { getThermalDataCollection } from "@/lib/mongodb"

export async function GET() {
  try {
    const collection = await getThermalDataCollection()

    // Get the latest data points within the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentData = await collection
      .find({
        timestamp: { $gte: oneHourAgo }
      })
      .toArray()

    // Calculate average temperature
    const avgTemperature = recentData.length > 0
      ? Math.round(recentData.reduce((sum, point) => sum + point.temperature, 0) / recentData.length)
      : 85 // Default to 85°F if no data

    // Calculate heat index based on temperature and humidity
    const humidity = 65 // This should come from a weather API in production
    const heatIndex = calculateHeatIndex(avgTemperature, humidity)

    // Get wind speed from weather API (mock for now)
    const windSpeed = 8

    return NextResponse.json({
      conditions: {
        avgTemperature,
        heatIndex: getHeatIndexCategory(heatIndex),
        windSpeed,
        humidity,
      }
    })
  } catch (error) {
    console.error("Error fetching current conditions:", error)
    return NextResponse.json(
      { error: "Failed to fetch current conditions" },
      { status: 500 }
    )
  }
}

function calculateHeatIndex(temperature: number, humidity: number): number {
  // Simplified heat index calculation
  // In production, use a more accurate formula or weather API
  const t = temperature
  const h = humidity
  return t + 0.5 * h
}

function getHeatIndexCategory(heatIndex: number): string {
  if (heatIndex < 80) return "Low"
  if (heatIndex < 90) return "Moderate"
  if (heatIndex < 103) return "High"
  if (heatIndex < 125) return "Very High"
  return "Extreme"
} 