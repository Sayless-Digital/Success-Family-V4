"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Wallet, Upload, FileText, X } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TopUpAmount } from "@/components/ui/topup-amount"
import { CopyField } from "@/components/ui/copy-field"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface TopUpPageViewProps {
  banks: Array<{
    id: string
    account_name: string
    bank_name: string
    account_number: string
    account_type: string
  }>
  mandatoryTopupTtd: number
  buyPricePerPoint: number
  returnUrl: string
}

export function TopUpPageView({ 
  banks, 
  mandatoryTopupTtd, 
  buyPricePerPoint,
  returnUrl 
}: TopUpPageViewProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [submitting, setSubmitting] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const singleBank = banks.length === 1 ? banks[0] : null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) {
      toast.error('Please sign in to top up')
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      const file = selectedFile || (formData.get('file') as File)
      const bankAccountId = formData.get('bank_account_id') as string
      const amountTtd = formData.get('amount_ttd') as string

      if (!file || !bankAccountId || !amountTtd) {
        toast.error('Please fill all required fields')
        setSubmitting(false)
        return
      }

      // Upload receipt to storage
      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, {
          cacheControl: '0',
          upsert: false
        })

      if (uploadError) {
        throw new Error('Failed to upload receipt: ' + uploadError.message)
      }

      // Calculate points from amount
      const amount = parseFloat(amountTtd)
      const pointsValue = Math.floor(amount / buyPricePerPoint)

      // Create transaction
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'top_up',
          points_delta: pointsValue,
          earnings_points_delta: 0,
          amount_ttd: amount,
          status: 'pending',
          bank_account_id: bankAccountId,
          receipt_url: filePath
        })

      if (transactionError) {
        throw new Error('Failed to create transaction: ' + transactionError.message)
      }

      toast.success('Top-up submitted successfully! Awaiting verification.')
      
      // Redirect to return URL after a brief delay
      setTimeout(() => {
        router.push(returnUrl)
        router.refresh()
      }, 1000)
    } catch (error: any) {
      console.error('Error submitting top-up:', error)
      toast.error(error.message || 'Failed to submit top-up')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            Top Up Your Account
          </CardTitle>
          <CardDescription className="text-white/60">
            Upload your receipt and select the bank account used to add points to your wallet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="points" className="text-white/80">
                Points
              </Label>
              <TopUpAmount 
                buyPricePerPoint={buyPricePerPoint} 
                minAmount={mandatoryTopupTtd} 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Bank Account</Label>
              {singleBank ? (
                <>
                  <input type="hidden" name="bank_account_id" value={singleBank.id} />
                  <div className="rounded-md bg-white/10 p-4 space-y-3 border border-white/20">
                    <div className="text-white/80 font-medium mb-2">{singleBank.bank_name}</div>
                    <CopyField label="Account Name" value={singleBank.account_name} />
                    <CopyField label="Account Number" value={singleBank.account_number} />
                    <CopyField label="Account Type" value={singleBank.account_type} />
                  </div>
                </>
              ) : (
                <Select name="bank_account_id" required>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
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
              <input
                ref={fileInputRef}
                id="file"
                name="file"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                required={!selectedFile}
                className="hidden"
              />
              
              {selectedFile ? (
                <div className="rounded-lg border border-white/20 bg-white/10 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-md bg-white/10 p-2.5 border border-white/20">
                      <FileText className="h-5 w-5 text-white/80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white/90 truncate">
                          {selectedFile.name}
                        </p>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
                          aria-label="Remove file"
                        >
                          <X className="h-4 w-4 text-white/70 hover:text-white/90" />
                        </button>
                      </div>
                      <p className="text-xs text-white/60 mt-1">
                        {formatFileSize(selectedFile.size)} • {selectedFile.type.includes('pdf') ? 'PDF' : 'Image'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-full rounded-lg border-2 border-dashed border-white/30 bg-white/5 p-6 transition-all",
                    "hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0",
                    "flex flex-col items-center justify-center gap-3 cursor-pointer group"
                  )}
                >
                  <div className="rounded-full bg-white/10 p-3 border border-white/20 group-hover:bg-white/20 group-hover:border-white/30 transition-colors">
                    <Upload className="h-6 w-6 text-white/70 group-hover:text-white/90" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-white/90 mb-1">
                      Click to upload receipt
                    </p>
                    <p className="text-xs text-white/60">
                      PNG, JPG, PDF up to 10MB
                    </p>
                  </div>
                </button>
              )}
              <p className="text-xs text-white/60">
                Upload a screenshot or PDF of your bank transfer receipt.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(returnUrl)}
                disabled={submitting}
                className="border-white/20 text-white hover:bg-white/10 touch-feedback"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={submitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90 touch-feedback flex-1"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4 mr-2" />
                    Submit Top-Up
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
