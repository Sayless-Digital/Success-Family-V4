"use client"

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TopUpAmountProps {
  id?: string
  name?: string // name of hidden amount field (amount_ttd)
  minAmount?: number // minimum top-up in TTD
  presets?: number[] // point presets
  buyPricePerPoint: number
}

export function TopUpAmount({
  id = 'points',
  name = 'amount_ttd',
  minAmount = 50,
  presets,
  buyPricePerPoint,
}: TopUpAmountProps) {
  const toCents = (n: number) => Math.round(n * 100)
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const centsPerPoint = toCents(buyPricePerPoint)
  const multipleForWholeDollars = centsPerPoint > 0 ? 100 / gcd(centsPerPoint, 100) : 1

  const minPoints = buyPricePerPoint > 0 ? Math.ceil(minAmount / buyPricePerPoint) : 0
  const minPointsRounded = Math.ceil(minPoints / multipleForWholeDollars) * multipleForWholeDollars
  const computedPresets = React.useMemo(() => {
    if (presets && presets.length > 0) return presets
    if (buyPricePerPoint <= 0) return [minPoints]
    return [50, 100, 200]
      .map((amt) => Math.ceil(amt / buyPricePerPoint))
      .map((pts) => Math.ceil(pts / multipleForWholeDollars) * multipleForWholeDollars)
  }, [presets, buyPricePerPoint, multipleForWholeDollars, minPoints])

  const [pointsValue, setPointsValue] = React.useState<string>(String(minPointsRounded || ''))

  const rawPoints = Math.max(minPointsRounded, Math.floor(Number(pointsValue) || 0))
  const points = Math.max(rawPoints, 0)
  const amount = buyPricePerPoint > 0 ? points * buyPricePerPoint : 0

  const handlePreset = (pts: number) => {
    setPointsValue(String(Math.max(pts, 0)))
  }

  return (
    <div className="space-y-2">
      {/* Visible points input */}
      <Input
        id={id}
        type="number"
        step={1}
        min={minPoints}
        required
        value={pointsValue}
        onChange={(e) => setPointsValue(e.target.value)}
      />
      {/* Hidden amount field posted to the server */}
      <input type="hidden" name={name} value={amount.toFixed(2)} />
      <div className="flex flex-wrap gap-2">
        {computedPresets.map((p) => (
          <Button key={p} type="button" className="bg-white/10 text-white/80 hover:bg-white/20 h-8 px-2" onClick={() => handlePreset(p)}>
            {p} pts
          </Button>
        ))}
      </div>
      <div className="text-xs text-white/60">Minimum top up is {minPointsRounded} pts (≈ $ {minAmount.toFixed(2)} TTD, rounded to whole dollars).</div>
      <div className="text-white/80 text-sm">Cost: <span className="font-medium">$ {amount.toFixed(2)}</span> for <span className="font-medium">{points.toLocaleString()} pts</span></div>
    </div>
  )
}


