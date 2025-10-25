"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload, Check, Building2, Package } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import type { SubscriptionPlan, BankAccount, BillingCycle } from "@/types"

export default function CreateCommunityPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  const colorStops = useAuroraColors()
  
  const [step, setStep] = useState(1)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [communityName, setCommunityName] = useState("")
  const [communityDescription, setCommunityDescription] = useState("")
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [selectedBankAccount, setSelectedBankAccount] = useState<BankAccount | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  // Fetch data
  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      const [plansRes, bankAccountsRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('monthly_price'),
        supabase.from('bank_accounts').select('*').eq('is_active', true)
      ])

      if (plansRes.error) throw plansRes.error
      if (bankAccountsRes.error) throw bankAccountsRes.error

      setPlans(plansRes.data || [])
      setBankAccounts(bankAccountsRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type (images and PDFs)
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
      if (!validTypes.includes(file.type)) {
        alert('Please upload an image (JPG, PNG, GIF) or PDF file')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      
      setReceiptFile(file)
    }
  }

  const uploadReceipt = async (): Promise<string> => {
    if (!receiptFile || !user) throw new Error('No file or user')

    const fileExt = receiptFile.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('payment-receipts')
      .upload(fileName, receiptFile)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('payment-receipts')
      .getPublicUrl(fileName)

    return data.publicUrl
  }

  const handleSubmit = async () => {
    if (!user || !selectedPlan || !selectedBankAccount || !receiptFile) {
      alert('Please complete all fields')
      return
    }

    if (!communityName.trim()) {
      alert('Please enter a community name')
      return
    }

    setSubmitting(true)

    try {
      // Upload receipt
      setUploadProgress(30)
      const receiptUrl = await uploadReceipt()
      
      // Generate slug
      setUploadProgress(50)
      const { data: slugData, error: slugError } = await supabase
        .rpc('generate_community_slug', { community_name: communityName })
      
      if (slugError) throw slugError
      const slug = slugData as string

      // Calculate amount
      const amount = billingCycle === 'monthly' ? selectedPlan.monthly_price : selectedPlan.annual_price

      // Create community
      setUploadProgress(70)
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .insert([{
          name: communityName,
          slug,
          description: communityDescription || null,
          owner_id: user.id,
          plan_id: selectedPlan.id,
          billing_cycle: billingCycle,
        }])
        .select()
        .single()

      if (communityError) throw communityError

      // Create payment receipt
      setUploadProgress(90)
      const { error: receiptError } = await supabase
        .from('payment_receipts')
        .insert([{
          community_id: community.id,
          user_id: user.id,
          plan_id: selectedPlan.id,
          billing_cycle: billingCycle,
          amount,
          bank_account_id: selectedBankAccount.id,
          receipt_url: receiptUrl,
        }])

      if (receiptError) throw receiptError

      setUploadProgress(100)
      
      // Redirect to community page (will be created next)
      setTimeout(() => {
        router.push(`/${slug}`)
      }, 500)
    } catch (error) {
      console.error('Error creating community:', error)
      alert('Failed to create community. Please try again.')
      setSubmitting(false)
      setUploadProgress(0)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="relative min-h-[calc(100vh-8rem)] w-full overflow-x-hidden">
        <div className="fixed inset-0 z-0 overflow-hidden">
          <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
        </div>
        <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user) return null

  const price = selectedPlan 
    ? billingCycle === 'monthly' 
      ? selectedPlan.monthly_price 
      : selectedPlan.annual_price
    : 0

  return (
    <div className="relative min-h-[calc(100vh-8rem)] w-full overflow-x-hidden">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
      </div>
      
      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Create Your Community</h1>
            <p className="text-white/80 mt-1">
              Step {step} of 3
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm ${step >= 1 ? 'text-white' : 'text-white/40'}`}>
              1. Choose Plan
            </span>
            <span className={`text-sm ${step >= 2 ? 'text-white' : 'text-white/40'}`}>
              2. Community Details
            </span>
            <span className={`text-sm ${step >= 3 ? 'text-white' : 'text-white/40'}`}>
              3. Payment
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Select Plan */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Choose Your Plan</h2>
              
              {plans.length === 0 ? (
                <p className="text-white/60">No plans available. Please contact support.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`rounded-lg p-6 text-left transition-all ${
                        selectedPlan?.id === plan.id
                          ? 'bg-primary/20 border-2 border-primary'
                          : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <Package className="h-8 w-8 text-white" />
                        {selectedPlan?.id === plan.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                      {plan.description && (
                        <p className="text-white/60 text-sm mb-3">{plan.description}</p>
                      )}
                      <div className="space-y-1 text-sm text-white/80">
                        <p>Max {plan.max_tree} members</p>
                        <p className="font-semibold text-white">
                          TTD ${plan.monthly_price}/month
                        </p>
                        <p className="text-white/60">
                          or TTD ${plan.annual_price}/year
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedPlan}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Community Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6 space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">Community Details</h2>
              
              <div>
                <Label htmlFor="name" className="text-white">Community Name *</Label>
                <Input
                  id="name"
                  value={communityName}
                  onChange={(e) => setCommunityName(e.target.value)}
                  placeholder="e.g., Tech Innovators Network"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description" className="text-white">Description (Optional)</Label>
                <textarea
                  id="description"
                  value={communityDescription}
                  onChange={(e) => setCommunityDescription(e.target.value)}
                  placeholder="Brief description of your community..."
                  className="w-full min-h-[100px] rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/40"
                  rows={4}
                />
              </div>
              
              <div>
                <Label className="text-white">Billing Cycle *</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`rounded-lg p-4 text-left transition-all ${
                      billingCycle === 'monthly'
                        ? 'bg-primary/20 border-2 border-primary'
                        : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white">Monthly</span>
                      {billingCycle === 'monthly' && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <p className="text-2xl font-bold text-white">
                      TTD ${selectedPlan?.monthly_price.toFixed(2)}
                    </p>
                    <p className="text-white/60 text-sm">per month</p>
                  </button>
                  
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`rounded-lg p-4 text-left transition-all ${
                      billingCycle === 'annual'
                        ? 'bg-primary/20 border-2 border-primary'
                        : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white">Annual</span>
                      {billingCycle === 'annual' && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <p className="text-2xl font-bold text-white">
                      TTD ${selectedPlan?.annual_price.toFixed(2)}
                    </p>
                    <p className="text-white/60 text-sm">
                      Save TTD ${selectedPlan ? ((selectedPlan.monthly_price * 12) - selectedPlan.annual_price).toFixed(2) : 0}
                    </p>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!communityName.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6 space-y-6">
              <h2 className="text-xl font-semibold text-white mb-4">Payment Details</h2>
              
              {/* Order Summary */}
              <div className="rounded-lg bg-white/5 p-4 space-y-2">
                <h3 className="font-semibold text-white mb-3">Order Summary</h3>
                <div className="flex justify-between text-white/80">
                  <span>Community: {communityName}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Plan: {selectedPlan?.name}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Billing: {billingCycle === 'monthly' ? 'Monthly' : 'Annual'}</span>
                </div>
                <div className="border-t border-white/20 pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold text-white">
                    <span>Total</span>
                    <span>TTD ${price.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {/* Bank Account Selection */}
              <div>
                <Label className="text-white">Select Bank Account *</Label>
                {bankAccounts.length === 0 ? (
                  <p className="text-white/60 mt-2">No bank accounts available. Please contact support.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {bankAccounts.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => setSelectedBankAccount(account)}
                        className={`rounded-lg p-4 text-left transition-all ${
                          selectedBankAccount?.id === account.id
                            ? 'bg-primary/20 border-2 border-primary'
                            : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex gap-3">
                            <Building2 className="h-5 w-5 text-white mt-1" />
                            <div>
                              <p className="font-semibold text-white">{account.account_name}</p>
                              <p className="text-white/80 text-sm">{account.bank_name}</p>
                              <p className="text-white/60 text-sm">
                                {account.account_number} • {account.account_type}
                              </p>
                            </div>
                          </div>
                          {selectedBankAccount?.id === account.id && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Receipt Upload */}
              <div>
                <Label htmlFor="receipt" className="text-white">Upload Payment Receipt *</Label>
                <div className="mt-2">
                  <label
                    htmlFor="receipt"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer bg-white/5 hover:bg-white/10 transition-all"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-8 w-8 text-white/60 mb-2" />
                      <p className="mb-2 text-sm text-white/80">
                        {receiptFile ? (
                          <span className="font-semibold text-primary">{receiptFile.name}</span>
                        ) : (
                          <>
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </>
                        )}
                      </p>
                      <p className="text-xs text-white/60">PNG, JPG, GIF or PDF (MAX. 5MB)</p>
                    </div>
                    <input
                      id="receipt"
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept="image/*,.pdf"
                    />
                  </label>
                </div>
              </div>
              
              {/* Upload Progress */}
              {submitting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-white/80">
                    <span>Creating your community...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedBankAccount || !receiptFile || submitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {submitting ? 'Creating...' : 'Create Community'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}