"use client"

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BonusCountdown } from '@/components/bonus-countdown'

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
  minAmount = 50,
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
      <div className="text-white/80 text-sm">
        Cost: <span className="font-medium">$ {amount.toFixed(2)}</span> for <span className="font-medium">{points.toLocaleString()} pts</span>
        {showBonus && bonusPoints > 0 && (
          <span className="ml-2 text-white/60">
            + <span className="font-medium text-white/80">{bonusPoints.toLocaleString()} bonus pts</span>
          </span>
        )}
      </div>
      {showBonus && bonusPoints > 0 && (
        <>
          <div className="text-xs text-white/60">
            You'll receive {points.toLocaleString()} + {bonusPoints.toLocaleString()} = <span className="font-medium text-white/80">{(points + bonusPoints).toLocaleString()} total points</span>
          </div>
          {bonusEndTime && (() => {
            const expirationTime = new Date(bonusEndTime)
            const isTodayOnly = expirationTime.toDateString() === new Date().toDateString()
            return (
              <>
                <BonusCountdown endTime={bonusEndTime} />
                <div className="text-xs text-white/60">
                  {isTodayOnly && <span className="font-medium text-white/80">Today Only</span>} 
                  {isTodayOnly && ' - '}
                  Expires: {expirationTime.toLocaleString(undefined, { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </div>
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}


