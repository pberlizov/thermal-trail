"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Satellite, Wifi, Brain, MapPin } from "lucide-react"

interface DataSource {
  source: string
  icon: any
  status: "active" | "processing" | "error"
  lastUpdate: string
  coverage: number
  points: string
}

interface LandCoverType {
  type: string
  percentage: number
  color: string
}

interface CurrentConditions {
  avgTemperature: number
  heatIndex: string
  windSpeed: number
  humidity: number
}

export function DataPanel() {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [landCoverTypes, setLandCoverTypes] = useState<LandCoverType[]>([])
  const [currentConditions, setCurrentConditions] = useState<CurrentConditions | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch data sources status
        const sourcesResponse = await fetch("/api/thermal-data/status")
        if (!sourcesResponse.ok) {
          throw new Error("Failed to fetch data sources status")
        }
        const sourcesData = await sourcesResponse.json()

        // Fetch land cover analysis
        const landCoverResponse = await fetch("/api/segmentation-mask/analysis")
        if (!landCoverResponse.ok) {
          throw new Error("Failed to fetch land cover analysis")
        }
        const landCoverData = await landCoverResponse.json()

        // Fetch current conditions
        const conditionsResponse = await fetch("/api/thermal-data/conditions")
        if (!conditionsResponse.ok) {
          throw new Error("Failed to fetch current conditions")
        }
        const conditionsData = await conditionsResponse.json()

        // Update state with fetched data
        setDataSources(sourcesData.sources)
        setLandCoverTypes(landCoverData.landCover)
        setCurrentConditions(conditionsData.conditions)
      } catch (error) {
        console.error("Error fetching data panel data:", error)
        setError("Failed to load data. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    // Refresh data every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 h-full overflow-y-auto">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-gray-500">Loading data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 space-y-4 h-full overflow-y-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="space-y-3">
        <h3 className="font-medium text-sm">Data Sources</h3>
        {dataSources.map((source, index) => (
          <Card key={index}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <source.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{source.source}</span>
                </div>
                <Badge variant={source.status === "active" ? "default" : "secondary"} className="text-xs">
                  {source.status}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Coverage</span>
                  <span>{source.coverage}%</span>
                </div>
                <Progress value={source.coverage} className="h-1" />

                <div className="flex justify-between text-xs text-gray-600">
                  <span>Data Points</span>
                  <span>{source.points}</span>
                </div>

                <div className="text-xs text-gray-500">Updated {source.lastUpdate}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Land Cover Analysis
        </h3>
        <Card>
          <CardContent className="p-3 space-y-3">
            {landCoverTypes.map((type, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{type.type}</span>
                  <span>{type.percentage}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${type.color}`}></div>
                  <Progress value={type.percentage} className="h-1 flex-1" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {currentConditions && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Current Conditions</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-gray-600">Avg Temperature</div>
                <div className="font-bold text-lg">{currentConditions.avgTemperature}°F</div>
              </div>
              <div>
                <div className="text-gray-600">Heat Index</div>
                <div className="font-bold text-lg text-orange-600">{currentConditions.heatIndex}</div>
              </div>
              <div>
                <div className="text-gray-600">Wind Speed</div>
                <div className="font-medium">{currentConditions.windSpeed} mph</div>
              </div>
              <div>
                <div className="text-gray-600">Humidity</div>
                <div className="font-medium">{currentConditions.humidity}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
