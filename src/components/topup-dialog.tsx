"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TopUpAmount } from "@/components/ui/topup-amount"
import { CopyField } from "@/components/ui/copy-field"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface TopUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message?: string
  actionText?: string
}

interface Bank {
  id: string
  account_name: string
  bank_name: string
  account_number: string
  account_type: string
}

export function TopUpDialog({ open, onOpenChange, message, actionText = "Top Up Required" }: TopUpDialogProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [banks, setBanks] = React.useState<Bank[]>([])
  const [mandatoryTopupTtd, setMandatoryTopupTtd] = React.useState<number>(25)
  const [buyPricePerPoint, setBuyPricePerPoint] = React.useState<number>(0.01)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)

  // Fetch banks and platform settings
  React.useEffect(() => {
    const fetchData = async () => {
      if (!user || !open) return

      setLoading(true)
      try {
        // Fetch banks
        const { data: banksData } = await supabase
          .from('bank_accounts')
          .select('*')
          .eq('is_active', true)
          .is('community_id', null)

        if (banksData) {
          setBanks(banksData as Bank[])
        }

        // Fetch platform settings
        const { data: settings } = await supabase
          .from('platform_settings')
          .select('mandatory_topup_ttd, buy_price_per_point')
          .eq('id', 1)
          .single()

        if (settings) {
          setMandatoryTopupTtd(settings.mandatory_topup_ttd || 25)
          setBuyPricePerPoint(settings.buy_price_per_point || 0.01)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, open])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) return

    setSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      const file = formData.get('file') as File
      const bankAccountId = formData.get('bank_account_id') as string
      const points = formData.get('points') as string

      if (!file || !bankAccountId || !points) {
        toast.error('Please fill all required fields')
        return
      }

      // Upload receipt to storage
      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error('Failed to upload receipt: ' + uploadError.message)
      }

      // Create transaction
      const pointsValue = parseInt(points)
      const amountTtd = pointsValue * buyPricePerPoint

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'top_up',
          points_delta: pointsValue,
          earnings_points_delta: 0,
          amount_ttd: amountTtd,
          status: 'pending',
          bank_account_id: bankAccountId,
          receipt_url: filePath
        })

      if (transactionError) {
        throw new Error('Failed to create transaction: ' + transactionError.message)
      }

      toast.success('Top-up submitted successfully! Awaiting verification.')
      onOpenChange(false)
      router.refresh()
    } catch (error: any) {
      console.error('Error submitting top-up:', error)
      toast.error(error.message || 'Failed to submit top-up')
    } finally {
      setSubmitting(false)
    }
  }

  const singleBank = banks.length === 1 ? banks[0] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            {actionText}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {message || "Please top up your account to continue using this feature."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="points" className="text-white/80">
                Points
              </Label>
              <TopUpAmount buyPricePerPoint={Number(buyPricePerPoint)} minAmount={mandatoryTopupTtd} />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Bank Account</Label>
              {singleBank ? (
                <>
                  <input type="hidden" name="bank_account_id" value={singleBank.id} />
                  <div className="rounded-md bg-white/10 p-3 space-y-2">
                    <div className="text-white/80 text-sm mb-1">{singleBank.bank_name}</div>
                    <CopyField label="Account Name" value={singleBank.account_name} />
                    <CopyField label="Account Number" value={singleBank.account_number} />
                    <CopyField label="Account Type" value={singleBank.account_type} />
                  </div>
                </>
              ) : (
                <Select name="bank_account_id" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.bank_name} — {b.account_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="file" className="text-white/80">
                Receipt File
              </Label>
              <Input 
                id="file" 
                name="file" 
                type="file" 
                accept="image/*,application/pdf" 
                required 
                className="bg-white/10 border-white/20 text-white"
              />
            </div>

            <DialogFooter className="w-full flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="border-white/20 text-white hover:bg-white/10 touch-feedback w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitting}
                className="bg-white/10 text-white/80 hover:bg-white/20 touch-feedback w-full sm:w-auto"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Top-Up'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}