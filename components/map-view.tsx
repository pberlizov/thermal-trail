"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

// You'll need to set this in your environment variables
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  "pk.eyJ1IjoidGhlcm1hbC10cmFpbCIsImEiOiJjbHh4eHh4eHgwMDAwM2x0YzBkdmZoZmZmIn0.example"

interface MapViewProps {
  heatmapVisible: boolean
  selectedRoute: any
  onRouteSelect: (route: any) => void
  origin: [number, number] | null
  destination: [number, number] | null
  onLocationSelect: (type: "origin" | "destination", coordinates: [number, number], address: string) => void
  selectionMode: "origin" | "destination" | null
}

interface ThermalDataPoint {
  lat: number
  lng: number
  temperature: number
  landCover?: string
  timestamp: string
}

export function MapView({
  heatmapVisible,
  selectedRoute,
  onRouteSelect,
  origin,
  destination,
  onLocationSelect,
  selectionMode,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isLoadingThermalData, setIsLoadingThermalData] = useState(false)
  const [thermalDataError, setThermalDataError] = useState<string | null>(null)
  const originMarker = useRef<mapboxgl.Marker | null>(null)
  const destinationMarker = useRef<mapboxgl.Marker | null>(null)

  // Phoenix, Arizona coordinates
  const PHOENIX_CENTER: [number, number] = [-112.074, 33.4484]

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: PHOENIX_CENTER,
      zoom: 11,
      pitch: 0,
      bearing: 0,
    })

    map.current.on("load", () => {
      setMapLoaded(true)
      addThermalDataLayer()
      setupMapClickHandler()
    })

    // Add moveend event listener to fetch new thermal data when map moves
    map.current.on("moveend", () => {
      if (map.current && mapLoaded) {
        fetchThermalData()
      }
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Fetch thermal data from API
  const fetchThermalData = useCallback(async () => {
    if (!map.current) return

    setIsLoadingThermalData(true)
    setThermalDataError(null)

    try {
      const bounds = map.current.getBounds()
      if (!bounds) {
        throw new Error("Failed to get map bounds")
      }

      const sw = bounds.getSouthWest()
      const ne = bounds.getNorthEast()
      const boundsParam = `${sw.lat}:${sw.lng},${ne.lat}:${ne.lng}`

      const response = await fetch(`/api/thermal-data?bounds=${boundsParam}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch thermal data: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (map.current.getSource("thermal-data")) {
        (map.current.getSource("thermal-data") as mapboxgl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: data.data.map((point: ThermalDataPoint) => ({
            type: "Feature",
            properties: {
              temperature: point.temperature,
              landCover: point.landCover,
              timestamp: point.timestamp,
            },
            geometry: {
              type: "Point",
              coordinates: [point.lng, point.lat],
            },
          })),
        })
      }
    } catch (error) {
      console.error("Error fetching thermal data:", error)
      setThermalDataError("Failed to load thermal data. Please try again.")
    } finally {
      setIsLoadingThermalData(false)
    }
  }, [])

  // Add thermal data layer
  const addThermalDataLayer = useCallback(() => {
    if (!map.current) return

    // Add thermal data source
    map.current.addSource("thermal-data", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [],
      },
    })

    // Add heatmap layer
    map.current.addLayer({
      id: "thermal-heatmap",
      type: "heatmap",
      source: "thermal-data",
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "temperature"], 60, 0, 120, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(33,102,172,0)",
          0.2,
          "rgb(103,169,207)",
          0.4,
          "rgb(209,229,240)",
          0.6,
          "rgb(253,219,199)",
          0.8,
          "rgb(239,138,98)",
          1,
          "rgb(178,24,43)",
        ],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 15, 20],
        "heatmap-opacity": heatmapVisible ? 0.7 : 0,
      },
    })

    // Add thermal points layer for higher zoom levels
    map.current.addLayer({
      id: "thermal-points",
      type: "circle",
      source: "thermal-data",
      minzoom: 12,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 4, 16, 8],
        "circle-color": [
          "interpolate",
          ["linear"],
          ["get", "temperature"],
          60,
          "#3b82f6",
          75,
          "#10b981",
          85,
          "#f59e0b",
          95,
          "#ef4444",
          110,
          "#dc2626",
        ],
        "circle-opacity": heatmapVisible ? 0.8 : 0,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    })

    // Initial data fetch
    fetchThermalData()
  }, [heatmapVisible, fetchThermalData])

  // Setup map click handler for location selection
  const setupMapClickHandler = useCallback(() => {
    if (!map.current) return

    map.current.on("click", async (e) => {
      if (!selectionMode) return

      const { lng, lat } = e.lngLat
      const coordinates: [number, number] = [lng, lat]

      // Reverse geocode to get address
      try {
        const address = await reverseGeocode(coordinates)
        onLocationSelect(selectionMode, coordinates, address)
      } catch (error) {
        console.error("Geocoding error:", error)
        onLocationSelect(selectionMode, coordinates, `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
      }
    })

    // Change cursor when in selection mode
    map.current.on("mouseenter", () => {
      if (selectionMode && map.current) {
        map.current.getCanvas().style.cursor = "crosshair"
      }
    })

    map.current.on("mouseleave", () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = ""
      }
    })
  }, [selectionMode, onLocationSelect])

  // Reverse geocoding function
  const reverseGeocode = async (coordinates: [number, number]): Promise<string> => {
    const [lng, lat] = coordinates
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi`,
    )
    const data = await response.json()

    if (data.features && data.features.length > 0) {
      return data.features[0].place_name
    }

    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }

  // Update heatmap visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    map.current.setPaintProperty("thermal-heatmap", "heatmap-opacity", heatmapVisible ? 0.7 : 0)
    map.current.setPaintProperty("thermal-points", "circle-opacity", heatmapVisible ? 0.8 : 0)
  }, [heatmapVisible, mapLoaded])

  // Update origin marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (originMarker.current) {
      originMarker.current.remove()
    }

    if (origin) {
      const el = document.createElement("div")
      el.className = "origin-marker"
      el.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #10b981;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `

      originMarker.current = new mapboxgl.Marker(el).setLngLat(origin).addTo(map.current)
    }
  }, [origin, mapLoaded])

  // Update destination marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (destinationMarker.current) {
      destinationMarker.current.remove()
    }

    if (destination) {
      const el = document.createElement("div")
      el.className = "destination-marker"
      el.style.cssText = `
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: #ef4444;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `

      destinationMarker.current = new mapboxgl.Marker(el).setLngLat(destination).addTo(map.current)
    }
  }, [destination, mapLoaded])

  // Draw route if selected
  useEffect(() => {
    if (!map.current || !mapLoaded || !origin || !destination) return

    // Remove existing route
    if (map.current.getLayer("route")) {
      map.current.removeLayer("route")
    }

    if (map.current.getSource("route")) {
      map.current.removeSource("route")
    }

    // Prepare coordinates for the route
    let routeCoordinates = [origin, destination]

    if (selectedRoute) {
      if (selectedRoute.coordinates && Array.isArray(selectedRoute.coordinates)) {
        routeCoordinates = selectedRoute.coordinates
      }
    }

    // Add route source and layer
    map.current.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: routeCoordinates,
        },
      },
    })

    map.current.addLayer({
      id: "route",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": selectedRoute?.id === "coolest" ? "#3b82f6" : "#ef4444",
        "line-width": 6,
        "line-opacity": 0.8,
      },
    })

    // Fit map to route
    try {
      const bounds = routeCoordinates.reduce((bounds: mapboxgl.LngLatBounds, coord: [number, number]) => {
        return bounds.extend(coord)
      }, new mapboxgl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]))

      map.current.fitBounds(bounds, { padding: 50 })
    } catch (error) {
      console.error("Error fitting bounds:", error)
      // Fallback to just showing the map centered between origin and destination
      map.current.fitBounds(new mapboxgl.LngLatBounds(origin, destination), { padding: 50 })
    }
  }, [selectedRoute, origin, destination, mapLoaded])

  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%", margin: 0, padding: 0 }} />

      {!mapLoaded && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f3f4f6",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                border: "2px solid #e5e7eb",
                borderTop: "2px solid #2563eb",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 8px",
              }}
            ></div>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>Loading Phoenix thermal map...</p>
          </div>
        </div>
      )}

      {isLoadingThermalData && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            padding: "8px 16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            zIndex: 10,
          }}
        >
          <p style={{ fontSize: "14px", color: "#6b7280" }}>Updating thermal data...</p>
        </div>
      )}

      {thermalDataError && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            padding: "8px 16px",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            zIndex: 10,
          }}
        >
          <p style={{ fontSize: "14px", color: "#ef4444" }}>{thermalDataError}</p>
        </div>
      )}

      {selectionMode && (
        <div style={{ position: "absolute", top: "16px", left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
          <div
            style={{
              backgroundColor: "#2563eb",
              color: "white",
              padding: "8px 16px",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              fontSize: "14px",
            }}
          >
            Click on the map to select your {selectionMode === "origin" ? "starting point" : "destination"}
          </div>
        </div>
      )}
    </div>
  )
}
