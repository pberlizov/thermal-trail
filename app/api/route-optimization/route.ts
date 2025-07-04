import { NextResponse } from "next/server"

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  "pk.eyJ1IjoidGhlcm1hbC10cmFpbCIsImEiOiJjbHh4eHh4eHgwMDAwM2x0YzBkdmZoZmZmIn0.example"

const ROUTE_OPTIMIZATION_SERVICE_URL = process.env.ROUTE_OPTIMIZATION_SERVICE_URL

// Phoenix cool spots (parks, water features, tree-lined areas)
const PHOENIX_COOL_SPOTS = [
  { lat: 33.5127, lng: -112.0813, name: "Steele Indian School Park", temp_reduction: 15 },
  { lat: 33.4734, lng: -112.0596, name: "Phoenix Mountains Preserve", temp_reduction: 12 },
  { lat: 33.4255, lng: -112.0373, name: "Papago Park", temp_reduction: 14 },
  { lat: 33.4484, lng: -112.074, name: "Heritage Square", temp_reduction: 8 },
  { lat: 33.4625, lng: -112.0759, name: "Margaret T. Hance Park", temp_reduction: 10 },
  { lat: 33.5067, lng: -112.063, name: "North Mountain Park", temp_reduction: 13 },
  { lat: 33.3931, lng: -112.0431, name: "South Mountain Park", temp_reduction: 16 },
  { lat: 33.4456, lng: -112.0678, name: "Roosevelt Row (Tree-lined)", temp_reduction: 6 },
  { lat: 33.4734, lng: -112.0596, name: "Arizona Canal", temp_reduction: 12 },
  { lat: 33.4167, lng: -112.0167, name: "Tempe Town Lake", temp_reduction: 18 },
]

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { origin, destination, timestamp } = body

    if (!origin || !destination) {
      return NextResponse.json({ error: "Origin and destination coordinates are required" }, { status: 400 })
    }

    if (!ROUTE_OPTIMIZATION_SERVICE_URL) {
      throw new Error("Route optimization service URL not configured")
    }

    // Call the Cloud Run service
    const response = await fetch(`${ROUTE_OPTIMIZATION_SERVICE_URL}/find-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start: [origin.lat, origin.lng],
        end: [destination.lat, destination.lng],
        timestamp
      }),
    })

    if (!response.ok) {
      throw new Error(`Route optimization service returned ${response.status}`)
    }

    const route = await response.json()

    // Transform the response to match the frontend's expected format
    return NextResponse.json({
      routes: [
        {
          id: "coolest",
          name: "Coolest Route",
          coordinates: route.geometry.coordinates,
          distance: route.properties.distance,
          avgTemperature: route.properties.temperature,
          landCover: route.properties.landCover,
          segments: [{
            coordinates: route.geometry.coordinates,
            temperature: route.properties.temperature,
            landCover: route.properties.landCover
          }]
        }
      ],
      optimization: {
        algorithm: "a_star_temperature_weighted",
        processingTime: "1.5s",
        temperatureSavings: null // Will be calculated by frontend
      }
    })
  } catch (error) {
    console.error("Route optimization error:", error)
    return NextResponse.json({ error: "Failed to calculate routes", details: String(error) }, { status: 500 })
  }
}

// Generate a route optimized for coolness by adding waypoints through cool spots
async function generateCoolestRoute(origin: any, destination: any) {
  try {
    // Find cool spots that are reasonably close to the direct path
    const directDistance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng)
    const maxDetour = Math.min(2.0, directDistance * 0.5) // Max 2 miles or 50% detour

    const nearbySpots = PHOENIX_COOL_SPOTS.filter((spot) => {
      const distanceFromOrigin = calculateDistance(origin.lat, origin.lng, spot.lat, spot.lng)
      const distanceFromDestination = calculateDistance(destination.lat, destination.lng, spot.lat, spot.lng)
      const totalDistance = distanceFromOrigin + distanceFromDestination

      // Include spots that don't add too much distance
      return totalDistance - directDistance <= maxDetour
    })

    console.log(`Found ${nearbySpots.length} nearby cool spots within ${maxDetour} mile detour`)

    if (nearbySpots.length === 0) {
      // No cool spots nearby, try to find a slightly different route
      return await getAlternativeRoute(origin, destination)
    }

    // Sort by temperature reduction potential and distance efficiency
    const rankedSpots = nearbySpots
      .map((spot) => {
        const distanceFromOrigin = calculateDistance(origin.lat, origin.lng, spot.lat, spot.lng)
        const distanceFromDestination = calculateDistance(destination.lat, destination.lng, spot.lat, spot.lng)
        const totalDistance = distanceFromOrigin + distanceFromDestination
        const detourDistance = totalDistance - directDistance
        const efficiency = spot.temp_reduction / Math.max(0.1, detourDistance) // temp reduction per mile of detour

        return {
          ...spot,
          efficiency,
          detourDistance,
          totalDistance,
        }
      })
      .sort((a, b) => b.efficiency - a.efficiency)

    console.log(
      `Top cool spot: ${rankedSpots[0].name} (${rankedSpots[0].temp_reduction}°F reduction, ${rankedSpots[0].detourDistance.toFixed(1)} mi detour)`,
    )

    // Use the most efficient cool spot as a waypoint
    const bestSpot = rankedSpots[0]
    const waypointRoute = await getMapboxRouteWithWaypoints(origin, destination, [
      { lat: bestSpot.lat, lng: bestSpot.lng },
    ])

    if (waypointRoute) {
      waypointRoute.coolSpots = [bestSpot]
      return waypointRoute
    }

    // Fallback to alternative route if waypoint routing fails
    return await getAlternativeRoute(origin, destination)
  } catch (error) {
    console.error("Error generating coolest route:", error)
    return await getAlternativeRoute(origin, destination)
  }
}

// Get route with waypoints
async function getMapboxRouteWithWaypoints(origin: any, destination: any, waypoints: any[]) {
  try {
    // Build coordinates string: origin;waypoint1;waypoint2;destination
    const allPoints = [origin, ...waypoints, destination]
    const coordinates = allPoints.map((point) => `${point.lng},${point.lat}`).join(";")

    const url =
      `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?` +
      `geometries=geojson&` +
      `overview=full&` +
      `steps=true&` +
      `access_token=${MAPBOX_TOKEN}`

    console.log(`Requesting waypoint route: ${url}`)

    const response = await fetch(url)
    const data = await response.json()

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0]

      return {
        coordinates: route.geometry.coordinates,
        distance: (route.distance / 1609.34).toFixed(1), // Convert meters to miles
        duration: Math.round(route.duration / 60), // Convert seconds to minutes
        instructions:
          route.legs?.flatMap((leg: any) =>
            leg.steps?.map((step: any) => ({
              instruction: step.maneuver.instruction,
              distance: (step.distance / 1609.34).toFixed(2),
              duration: Math.round(step.duration / 60),
            })),
          ) || [],
      }
    }

    return null
  } catch (error) {
    console.error("Waypoint routing error:", error)
    return null
  }
}

// Get alternative route by slightly modifying the request
async function getAlternativeRoute(origin: any, destination: any) {
  try {
    // Try to get alternatives by using different approaches
    const approaches = ["curb", "unrestricted"]

    for (const approach of approaches) {
      const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?` +
        `geometries=geojson&` +
        `overview=full&` +
        `steps=true&` +
        `approaches=${approach};${approach}&` +
        `alternatives=true&` +
        `access_token=${MAPBOX_TOKEN}`

      const response = await fetch(url)
      const data = await response.json()

      if (data.routes && data.routes.length > 1) {
        // Return the second route as an alternative
        const route = data.routes[1]
        return {
          coordinates: route.geometry.coordinates,
          distance: (route.distance / 1609.34).toFixed(1),
          duration: Math.round(route.duration / 60),
          instructions:
            route.legs?.flatMap((leg: any) =>
              leg.steps?.map((step: any) => ({
                instruction: step.maneuver.instruction,
                distance: (step.distance / 1609.34).toFixed(2),
                duration: Math.round(step.duration / 60),
              })),
            ) || [],
        }
      }
    }

    // If no alternatives found, return the fastest route
    return await getMapboxRoute(origin, destination, "walking")
  } catch (error) {
    console.error("Alternative route error:", error)
    return await getMapboxRoute(origin, destination, "walking")
  }
}

// Get basic route from Mapbox Directions API
async function getMapboxRoute(origin: any, destination: any, profile = "walking") {
  try {
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?` +
      `geometries=geojson&` +
      `overview=full&` +
      `steps=true&` +
      `access_token=${MAPBOX_TOKEN}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0]

      return {
        coordinates: route.geometry.coordinates,
        distance: (route.distance / 1609.34).toFixed(1), // Convert meters to miles
        duration: Math.round(route.duration / 60), // Convert seconds to minutes
        instructions:
          route.legs[0]?.steps?.map((step: any) => ({
            instruction: step.maneuver.instruction,
            distance: (step.distance / 1609.34).toFixed(2),
            duration: Math.round(step.duration / 60),
          })) || [],
      }
    }

    return null
  } catch (error) {
    console.error("Mapbox routing error:", error)
    return null
  }
}

// Calculate thermal profile with more realistic Phoenix temperatures
function calculateThermalProfile(coordinates: number[][], routeType: string) {
  const segments = []
  let totalTemp = 0
  let maxTemp = 0

  // Phoenix base temperature (realistic for summer)
  const baseTemp = 105 // Hot Phoenix summer day

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lng1, lat1] = coordinates[i]
    const [lng2, lat2] = coordinates[i + 1]

    const distance = calculateDistance(lat1, lng1, lat2, lng2)
    let segmentTemp = baseTemp
    let landCoverType = "street"

    // Check if this segment is near any cool spots
    const nearCoolSpot = PHOENIX_COOL_SPOTS.find((spot) => {
      const distanceToSpot = calculateDistance(lat1, lng1, spot.lat, spot.lng)
      return distanceToSpot < 0.1 // Within 0.1 miles of cool spot
    })

    if (nearCoolSpot) {
      segmentTemp -= nearCoolSpot.temp_reduction
      landCoverType = "park"
    } else {
      // Simulate different land cover types based on coordinate patterns
      const coordSum = Math.abs(lng1) + Math.abs(lat1)
      const coordMod = coordSum % 1

      if (routeType === "coolest") {
        // Coolest route should have more favorable conditions
        if (coordMod < 0.2) {
          segmentTemp -= 8 // Tree-lined streets
          landCoverType = "tree_canopy"
        } else if (coordMod < 0.35) {
          segmentTemp -= 5 // Building shadows
          landCoverType = "building_shadow"
        } else if (coordMod > 0.8) {
          segmentTemp += 5 // Some hot areas unavoidable
          landCoverType = "asphalt"
        } else {
          segmentTemp -= 2 // Generally shadier streets
          landCoverType = "street"
        }
      } else {
        // Fastest route - more direct but hotter
        if (coordMod < 0.1) {
          segmentTemp -= 5 // Occasional shade
          landCoverType = "tree_canopy"
        } else if (coordMod > 0.7) {
          segmentTemp += 8 // Major roads, parking lots
          landCoverType = "asphalt"
        } else if (coordMod > 0.5) {
          segmentTemp += 3 // Urban heat
          landCoverType = "building"
        } else {
          landCoverType = "street"
        }
      }
    }

    // Add some realistic variation
    segmentTemp += (Math.random() - 0.5) * 4

    totalTemp += segmentTemp
    maxTemp = Math.max(maxTemp, segmentTemp)

    // Group segments by land cover type
    const lastSegment = segments[segments.length - 1]
    if (lastSegment && lastSegment.type === landCoverType) {
      lastSegment.distance += distance
      lastSegment.avgTemp = (lastSegment.avgTemp + segmentTemp) / 2
    } else {
      segments.push({
        type: landCoverType,
        distance: distance,
        avgTemp: Math.round(segmentTemp),
      })
    }
  }

  return {
    avgTemp: Math.round(totalTemp / (coordinates.length - 1)),
    maxTemp: Math.round(maxTemp),
    segments: segments.slice(0, 5), // Limit to 5 segments for display
  }
}

// Calculate distance between two points in miles
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3959 // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
