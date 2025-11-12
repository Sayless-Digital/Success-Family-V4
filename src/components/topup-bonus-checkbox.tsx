"use client"

import * as React from "react"
import { Checkbox } from '@/components/ui/checkbox'

export function TopUpBonusCheckbox({ defaultChecked }: { defaultChecked: boolean }) {
  const [checked, setChecked] = React.useState(defaultChecked)
  const checkboxId = 'topup_bonus_enabled'
  
  return (
    <>
      <Checkbox
        id={checkboxId}
        checked={checked}
        onCheckedChange={(checked) => setChecked(checked === true)}
      />
      <input
        type="hidden"
        name={checkboxId}
        value={checked ? 'on' : ''}
      />
    </>
  )
}

