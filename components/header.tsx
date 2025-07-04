import { Thermometer, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Header() {
  return (
    <header className="bg-white/90 backdrop-blur border-b border-gray-200 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <Thermometer className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Thermal Trail</h1>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
            <Zap className="h-3 w-3" />
            <span>Live Data</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="hidden sm:flex">
            Share Route
          </Button>
          <Button size="sm">Get Directions</Button>
        </div>
      </div>
    </header>
  )
}
