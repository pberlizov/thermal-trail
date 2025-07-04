"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MapPin, Navigation, Clock, Thermometer, Target, X, ChevronDown, RouteIcon, TreePine } from "lucide-react"

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  "pk.eyJ1IjoidGhlcm1hbC10cmFpbCIsImEiOiJjbHh4eHh4eHgwMDAwM2x0YzBkdmZoZmZmIn0.example"

interface RoutePanelProps {
  onRouteSelect: (route: any) => void
  origin: [number, number] | null
  destination: [number, number] | null
  originAddress: string
  destinationAddress: string
  onLocationUpdate: (type: "origin" | "destination", coordinates: [number, number] | null, address: string) => void
  onSelectionModeChange: (mode: "origin" | "destination" | null) => void
  selectionMode: "origin" | "destination" | null
}

interface GeocodingResult {
  place_name: string
  center: [number, number]
}

export function RoutePanel({
  onRouteSelect,
  origin,
  destination,
  originAddress,
  destinationAddress,
  onLocationUpdate,
  onSelectionModeChange,
  selectionMode,
}: RoutePanelProps) {
  const [originInput, setOriginInput] = useState(originAddress)
  const [destinationInput, setDestinationInput] = useState(destinationAddress)
  const [originSuggestions, setOriginSuggestions] = useState<GeocodingResult[]>([])
  const [destinationSuggestions, setDestinationSuggestions] = useState<GeocodingResult[]>([])
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false)
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false)
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [calculatedRoutes, setCalculatedRoutes] = useState<any[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null)
  const [optimizationInfo, setOptimizationInfo] = useState<any>(null)

  const originInputRef = useRef<HTMLInputElement>(null)
  const destinationInputRef = useRef<HTMLInputElement>(null)

  // Update input values when addresses change
  useEffect(() => {
    setOriginInput(originAddress)
  }, [originAddress])

  useEffect(() => {
    setDestinationInput(destinationAddress)
  }, [destinationAddress])

  // Geocoding function for Phoenix area
  const geocodeLocation = async (query: string): Promise<GeocodingResult[]> => {
    if (query.length < 3) return []

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
          `access_token=${MAPBOX_TOKEN}&` +
          `proximity=-112.0740,33.4484&` + // Phoenix center
          `bbox=-112.8,33.0,-111.5,33.8&` + // Phoenix metro area bounds
          `limit=5&` +
          `types=address,poi,place`,
      )
      const data = await response.json()

      return (
        data.features?.map((feature: any) => ({
          place_name: feature.place_name,
          center: feature.center,
        })) || []
      )
    } catch (error) {
      console.error("Geocoding error:", error)
      return []
    }
  }

  // Handle origin input change
  const handleOriginChange = async (value: string) => {
    setOriginInput(value)
    if (value.length >= 3) {
      const suggestions = await geocodeLocation(value)
      setOriginSuggestions(suggestions)
      setShowOriginSuggestions(true)
    } else {
      setShowOriginSuggestions(false)
    }
  }

  // Handle destination input change
  const handleDestinationChange = async (value: string) => {
    setDestinationInput(value)
    if (value.length >= 3) {
      const suggestions = await geocodeLocation(value)
      setDestinationSuggestions(suggestions)
      setShowDestinationSuggestions(true)
    } else {
      setShowDestinationSuggestions(false)
    }
  }

  // Select suggestion
  const selectSuggestion = (type: "origin" | "destination", suggestion: GeocodingResult) => {
    if (type === "origin") {
      setOriginInput(suggestion.place_name)
      setShowOriginSuggestions(false)
      onLocationUpdate("origin", suggestion.center, suggestion.place_name)
    } else {
      setDestinationInput(suggestion.place_name)
      setShowDestinationSuggestions(false)
      onLocationUpdate("destination", suggestion.center, suggestion.place_name)
    }
  }

  // Calculate routes
  const calculateRoutes = async () => {
    if (!origin || !destination) return

    setIsCalculatingRoute(true)
    setCalculatedRoutes([])
    setOptimizationInfo(null)

    try {
      const response = await fetch("/api/route-optimization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: { lng: origin[0], lat: origin[1] },
          destination: { lng: destination[0], lat: destination[1] },
          preferences: { optimize: "temperature" },
        }),
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${await response.text()}`)
      }

      const data = await response.json()

      if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
        setCalculatedRoutes(data.routes)
        setOptimizationInfo(data.optimization)

        // Auto-select the coolest route
        const coolestRoute = data.routes.find((r: any) => r.id === "coolest") || data.routes[0]
        setSelectedRouteId(coolestRoute.id)
        onRouteSelect(coolestRoute)
      } else {
        throw new Error("No routes returned from the server")
      }
    } catch (error) {
      console.error("Route calculation error:", error)

      // Fallback to sample routes
      const fallbackRoutes = [
        {
          id: "coolest",
          name: "Coolest Route (Fallback)",
          coordinates: [origin, destination],
          distance: "2.1",
          duration: 15,
          avgTemperature: 89,
          maxTemperature: 95,
          temperatureSavings: 12,
          segments: [{ type: "street", distance: 2.1, avgTemp: 89 }],
          coolSpots: [],
        },
        {
          id: "fastest",
          name: "Fastest Route (Fallback)",
          coordinates: [origin, destination],
          distance: "1.8",
          duration: 11,
          avgTemperature: 101,
          maxTemperature: 108,
          temperatureSavings: null,
          segments: [{ type: "asphalt", distance: 1.8, avgTemp: 101 }],
          coolSpots: [],
        },
      ]

      setCalculatedRoutes(fallbackRoutes)
      setSelectedRouteId("coolest")
      onRouteSelect(fallbackRoutes[0])
    } finally {
      setIsCalculatingRoute(false)
    }
  }

  // Handle route selection
  const handleRouteSelect = (route: any) => {
    setSelectedRouteId(route.id)
    onRouteSelect(route)
  }

  // Clear location
  const clearLocation = (type: "origin" | "destination") => {
    if (type === "origin") {
      setOriginInput("")
      onLocationUpdate("origin", null, "")
    } else {
      setDestinationInput("")
      onLocationUpdate("destination", null, "")
    }
  }

  // Get land cover icon
  const getLandCoverIcon = (type: string) => {
    switch (type) {
      case "park":
        return "🌳"
      case "water":
        return "💧"
      case "tree_canopy":
        return "🌲"
      case "building_shadow":
        return "🏢"
      case "asphalt":
        return "🛣️"
      default:
        return "🚶"
    }
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      <div className="space-y-3">
        {/* Origin Input */}
        <div className="relative">
          <Label htmlFor="origin" className="text-sm">
            From
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-green-500" />
            <Input
              ref={originInputRef}
              id="origin"
              placeholder="Enter starting point in Phoenix"
              value={originInput}
              onChange={(e) => handleOriginChange(e.target.value)}
              className="pl-10 pr-20"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
              {origin && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => clearLocation("origin")}>
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 ${selectionMode === "origin" ? "bg-blue-100" : ""}`}
                onClick={() => onSelectionModeChange(selectionMode === "origin" ? null : "origin")}
              >
                <Target className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Origin Suggestions */}
          {showOriginSuggestions && originSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
              {originSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
                  onClick={() => selectSuggestion("origin", suggestion)}
                >
                  {suggestion.place_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Destination Input */}
        <div className="relative">
          <Label htmlFor="destination" className="text-sm">
            To
          </Label>
          <div className="relative">
            <Navigation className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-500" />
            <Input
              ref={destinationInputRef}
              id="destination"
              placeholder="Enter destination in Phoenix"
              value={destinationInput}
              onChange={(e) => handleDestinationChange(e.target.value)}
              className="pl-10 pr-20"
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
              {destination && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => clearLocation("destination")}>
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 ${selectionMode === "destination" ? "bg-blue-100" : ""}`}
                onClick={() => onSelectionModeChange(selectionMode === "destination" ? null : "destination")}
              >
                <Target className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Destination Suggestions */}
          {showDestinationSuggestions && destinationSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
              {destinationSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
                  onClick={() => selectSuggestion("destination", suggestion)}
                >
                  {suggestion.place_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button className="w-full" onClick={calculateRoutes} disabled={!origin || !destination || isCalculatingRoute}>
          {isCalculatingRoute ? "Finding coolest route..." : "Find Coolest Route"}
        </Button>
      </div>

      {/* Optimization Info */}
      {optimizationInfo && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="text-xs text-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <TreePine className="h-3 w-3" />
                <span className="font-medium">Thermal Optimization</span>
              </div>
              {optimizationInfo.coolSpotsConsidered > 0 && (
                <div>Found {optimizationInfo.coolSpotsConsidered} cool spots along route</div>
              )}
              {optimizationInfo.temperatureSavings > 0 && (
                <div>Potential savings: {optimizationInfo.temperatureSavings.toFixed(1)}°F</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Route Results */}
      {calculatedRoutes.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium text-sm">Route Options</h3>
          {calculatedRoutes.map((route, index) => (
            <Card
              key={route.id}
              className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                selectedRouteId === route.id ? "ring-2 ring-blue-500" : ""
              }`}
              onClick={() => handleRouteSelect(route)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{route.name}</h4>
                    {route.id === "coolest" && (
                      <Badge variant="default" className="text-xs">
                        Recommended
                      </Badge>
                    )}
                    {route.coolSpots && route.coolSpots.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Via {route.coolSpots.length} cool spot{route.coolSpots.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Thermometer className="h-3 w-3" />
                    {route.avgTemperature}°F
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {route.duration} min
                  </div>
                  <div>{route.distance} mi</div>
                  {route.temperatureSavings && route.temperatureSavings > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {route.temperatureSavings.toFixed(1)}°F cooler
                    </Badge>
                  )}
                </div>

                {/* Cool Spots */}
                {route.coolSpots && route.coolSpots.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs text-green-700 font-medium mb-1">Cool spots on route:</div>
                    {route.coolSpots.map((spot: any, spotIndex: number) => (
                      <div key={spotIndex} className="text-xs text-green-600 flex items-center gap-1">
                        <TreePine className="h-3 w-3" />
                        <span>{spot.name}</span>
                        <span className="text-gray-500">(-{spot.temp_reduction}°F)</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Route Segments */}
                {route.segments && route.segments.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800">
                      <RouteIcon className="h-3 w-3" />
                      <span>Route Details</span>
                      <ChevronDown className="h-3 w-3" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-1">
                      {route.segments.map((segment: any, segIndex: number) => (
                        <div key={segIndex} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span>{getLandCoverIcon(segment.type)}</span>
                            <span className="capitalize">{segment.type.replace("_", " ")}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <span>{segment.distance.toFixed(1)} mi</span>
                            <span>{segment.avgTemp}°F</span>
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectionMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            Click on the map to select your {selectionMode === "origin" ? "starting point" : "destination"}, or search
            for an address above.
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => onSelectionModeChange(null)}>
            Cancel Selection
          </Button>
        </div>
      )}
    </div>
  )
}
