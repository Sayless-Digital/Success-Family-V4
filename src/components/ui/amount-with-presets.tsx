"use client"

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface AmountWithPresetsProps {
  id?: string
  name?: string
  min?: number
  step?: number
  presets?: number[]
}

export function AmountWithPresets({ id = 'amount_ttd', name = 'amount_ttd', min = 150, step = 0.01, presets = [150, 200, 300] }: AmountWithPresetsProps) {
  const [value, setValue] = React.useState<string>('')

  const handlePreset = (amt: number) => {
    setValue(amt.toFixed(2))
  }

  return (
    <div className="space-y-2">
      <Input
        id={id}
        name={name}
        type="number"
        step={step}
        min={min}
        required
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <Button key={p} type="button" className="bg-white/10 text-white/80 hover:bg-white/20 h-8 px-2" onClick={() => handlePreset(p)}>
            ${p.toFixed(2)}
          </Button>
        ))}
      </div>
      <div className="text-xs text-white/60">Minimum top up is $ {min.toFixed(2)} TTD.</div>
    </div>
  )
}


