import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Thermometer, Layers } from "lucide-react"

interface HeatmapControlsProps {
  visible: boolean
  onToggle: (visible: boolean) => void
}

export function HeatmapControls({ visible, onToggle }: HeatmapControlsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Thermometer className="h-4 w-4" />
          Thermal Overlay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="heatmap-toggle" className="text-sm">
            Show Heatmap
          </Label>
          <Switch id="heatmap-toggle" checked={visible} onCheckedChange={onToggle} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm">Opacity</Label>
          <Slider defaultValue={[70]} max={100} step={10} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-2">
            <Layers className="h-3 w-3" />
            Data Layers
          </Label>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span>Satellite Thermal</span>
              <Switch defaultChecked size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span>IoT Sensors</span>
              <Switch defaultChecked size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span>Land Cover AI</span>
              <Switch defaultChecked size="sm" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
