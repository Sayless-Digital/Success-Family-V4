"use client"

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopUpAmountProps {
  id?: string
  name?: string // name of hidden amount field (amount_ttd)
  minAmount?: number // minimum top-up in TTD
  presets?: number[] // point presets
  buyPricePerPoint: number
  showBonus?: boolean // whether to show bonus preview
  bonusPoints?: number // number of bonus points
  bonusEndTime?: string | null // expiration time for bonus
}

export function TopUpAmount({
  id = 'points',
  name = 'amount_ttd',
  minAmount = 150,
  presets,
  buyPricePerPoint,
  showBonus = false,
  bonusPoints = 0,
  bonusEndTime = null,
}: TopUpAmountProps) {
  const toCents = (n: number) => Math.round(n * 100)
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const centsPerPoint = toCents(buyPricePerPoint)
  const multipleForWholeDollars = centsPerPoint > 0 ? 100 / gcd(centsPerPoint, 100) : 1

  const minPoints = buyPricePerPoint > 0 ? Math.ceil(minAmount / buyPricePerPoint) : 0
  const minPointsRounded = Math.ceil(minPoints / multipleForWholeDollars) * multipleForWholeDollars
  
  // Default to minimum (150 TTD equivalent)
  const defaultPoints = minPointsRounded
  
  const computedPresets = React.useMemo(() => {
    if (presets && presets.length > 0) {
      // Add 1000 points if not already in presets
      const presetsWith1000 = [...presets]
      const has1000 = presetsWith1000.includes(1000)
      if (!has1000) {
        presetsWith1000.push(1000)
      }
      return presetsWith1000.sort((a, b) => a - b)
    }
    if (buyPricePerPoint <= 0) return [minPoints, 1000]
    // Start at 125 points ($50 TTD) and increment accordingly
    const basePointPresets = [125, 250, 375, 500, 1000]
      .map((pts) => Math.ceil(pts / multipleForWholeDollars) * multipleForWholeDollars)
      .filter((pts) => pts >= minPointsRounded) // Only include presets >= minimum
    return basePointPresets.sort((a, b) => a - b)
  }, [presets, buyPricePerPoint, multipleForWholeDollars, minPoints, minPointsRounded])

  const [pointsValue, setPointsValue] = React.useState<string>(String(defaultPoints || ''))

  const rawPoints = Math.max(minPointsRounded, Math.floor(Number(pointsValue) || 0))
  const points = Math.max(rawPoints, 0)
  const amount = buyPricePerPoint > 0 ? points * buyPricePerPoint : 0

  const handlePreset = (pts: number) => {
    setPointsValue(String(Math.max(pts, 0)))
  }

  const handleDecrement = () => {
    const current = Math.max(minPointsRounded, Math.floor(Number(pointsValue) || minPointsRounded))
    const newValue = Math.max(minPointsRounded, current - 1)
    setPointsValue(String(newValue))
  }

  const handleIncrement = () => {
    const current = Math.max(minPointsRounded, Math.floor(Number(pointsValue) || minPointsRounded))
    setPointsValue(String(current + 1))
  }

  return (
    <div className="space-y-2">
      {/* Visible points input with custom buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={handleDecrement}
          disabled={points <= minPointsRounded}
          className="h-10 w-10 p-0 bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Minus className="h-4 w-4" />
        </Button>
      <Input
        id={id}
        type="number"
        step={1}
        min={minPoints}
        required
        value={pointsValue}
        onChange={(e) => setPointsValue(e.target.value)}
          className="flex-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
        />
        <Button
          type="button"
          onClick={handleIncrement}
          className="h-10 w-10 p-0 bg-white/10 text-white/80 hover:bg-white/20 flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {/* Hidden amount field posted to the server */}
      <input type="hidden" name={name} value={amount.toFixed(2)} />
      <div className="flex flex-wrap gap-2">
        {computedPresets.map((p) => {
          // Check if this preset matches the currently selected points value
          const isSelected = points === p
          
          return (
            <Button 
              key={p} 
              type="button" 
              className={cn(
                "h-8 px-2",
                isSelected
                  ? "bg-gradient-to-r from-yellow-500/90 to-purple-500/90 text-white border-2 border-yellow-400/50 shadow-lg font-bold hover:from-yellow-500 hover:to-purple-500"
                  : "bg-white/10 text-white/80 hover:bg-white/20"
              )}
              style={isSelected ? {
                boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
              } : undefined}
              onClick={() => handlePreset(p)}
            >
            {p} pts
          </Button>
          )
        })}
      </div>
      <div className="space-y-3 pt-1">
        <div className="text-xs text-white/60">
          Minimum top up: <span className="font-medium text-white/70">{minPointsRounded} pts</span> (≈ <span className="font-medium text-white/70">${minAmount.toFixed(2)} TTD</span>, rounded to whole dollars)
        </div>
        
        {/* Amount to Pay - Prominent */}
        <div className="rounded-lg bg-white/10 border border-white/20 p-4 space-y-3">
          <div className="text-center space-y-1">
            <div className="text-xs font-medium text-white/60 uppercase tracking-wide">Amount to Pay</div>
            <div className="text-2xl sm:text-3xl font-bold text-white">
              ${amount.toFixed(2)} <span className="text-lg text-white/70">TTD</span>
            </div>
          </div>
          
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">Base Points:</span>
              <span className="font-semibold text-white">{points.toLocaleString()} pts</span>
            </div>
            {showBonus && bonusPoints > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Bonus Points:</span>
                  <span className="font-semibold text-white/90">{bonusPoints.toLocaleString()} pts</span>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-white/80 font-medium">Total Points:</span>
                  <span className="font-bold text-white text-base">{(points + bonusPoints).toLocaleString()} pts</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


