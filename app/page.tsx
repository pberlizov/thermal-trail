"use client"

import { useState } from "react"
import { MapView } from "@/components/map-view"
import { HeatmapControls } from "@/components/heatmap-controls"
import { RoutePanel } from "@/components/route-panel"
import { DataPanel } from "@/components/data-panel"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Thermometer, Route, Layers } from "lucide-react"

export default function ThermalTrailApp() {
  const [activePanel, setActivePanel] = useState<"route" | "data" | null>("route")
  const [heatmapVisible, setHeatmapVisible] = useState(true)
  const [selectedRoute, setSelectedRoute] = useState(null)

  // Location state
  const [origin, setOrigin] = useState<[number, number] | null>(null)
  const [destination, setDestination] = useState<[number, number] | null>(null)
  const [originAddress, setOriginAddress] = useState("")
  const [destinationAddress, setDestinationAddress] = useState("")
  const [selectionMode, setSelectionMode] = useState<"origin" | "destination" | null>(null)

  const handleLocationUpdate = (
    type: "origin" | "destination",
    coordinates: [number, number] | null,
    address: string,
  ) => {
    if (type === "origin") {
      setOrigin(coordinates)
      setOriginAddress(address)
    } else {
      setDestination(coordinates)
      setDestinationAddress(address)
    }
  }

  const handleLocationSelect = (type: "origin" | "destination", coordinates: [number, number], address: string) => {
    handleLocationUpdate(type, coordinates, address)
    setSelectionMode(null) // Exit selection mode after selecting
  }

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}>
      {/* Full Screen Map Background */}
      <MapView
        heatmapVisible={heatmapVisible}
        selectedRoute={selectedRoute}
        onRouteSelect={setSelectedRoute}
        origin={origin}
        destination={destination}
        onLocationSelect={handleLocationSelect}
        selectionMode={selectionMode}
      />

      {/* Header - Floating on top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 20 }}>
        <Header />
      </div>

      {/* Mobile Controls */}
      <div style={{ position: "absolute", top: "80px", left: "16px", zIndex: 30 }} className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-white/90 backdrop-blur">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <div className="space-y-4">
              <HeatmapControls visible={heatmapVisible} onToggle={setHeatmapVisible} />
              <RoutePanel
                onRouteSelect={setSelectedRoute}
                origin={origin}
                destination={destination}
                originAddress={originAddress}
                destinationAddress={destinationAddress}
                onLocationUpdate={handleLocationUpdate}
                onSelectionModeChange={setSelectionMode}
                selectionMode={selectionMode}
              />
              <DataPanel />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div
        style={{ position: "absolute", left: "16px", top: "80px", bottom: "16px", width: "320px", zIndex: 30 }}
        className="hidden md:block"
      >
        <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg h-full flex flex-col">
          {/* Panel Tabs */}
          <div className="flex border-b">
            <Button
              variant={activePanel === "route" ? "default" : "ghost"}
              className="flex-1 rounded-none"
              onClick={() => setActivePanel(activePanel === "route" ? null : "route")}
            >
              <Route className="h-4 w-4 mr-2" />
              Route
            </Button>
            <Button
              variant={activePanel === "data" ? "default" : "ghost"}
              className="flex-1 rounded-none"
              onClick={() => setActivePanel(activePanel === "data" ? null : "data")}
            >
              <Layers className="h-4 w-4 mr-2" />
              Data
            </Button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {activePanel === "route" && (
              <RoutePanel
                onRouteSelect={setSelectedRoute}
                origin={origin}
                destination={destination}
                originAddress={originAddress}
                destinationAddress={destinationAddress}
                onLocationUpdate={handleLocationUpdate}
                onSelectionModeChange={setSelectionMode}
                selectionMode={selectionMode}
              />
            )}
            {activePanel === "data" && <DataPanel />}
            {!activePanel && (
              <div className="p-4">
                <HeatmapControls visible={heatmapVisible} onToggle={setHeatmapVisible} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Temperature Legend */}
      <div style={{ position: "absolute", bottom: "16px", right: "16px", zIndex: 30 }}>
        <div className="bg-white/95 backdrop-blur rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="h-4 w-4" />
            <span className="text-sm font-medium">Temperature (°F)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-20 bg-gradient-to-t from-blue-500 via-green-500 via-yellow-500 to-red-500 rounded"></div>
            <div className="text-xs space-y-3 ml-1">
              <div>110°</div>
              <div>95°</div>
              <div>85°</div>
              <div>75°</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
