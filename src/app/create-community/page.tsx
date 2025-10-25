"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { ArrowLeft, Upload, Check, Building2, Package, Copy, CreditCard, FileText } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

  // Auto-select bank account if only one available
  useEffect(() => {
    if (bankAccounts.length === 1 && !selectedBankAccount) {
      setSelectedBankAccount(bankAccounts[0])
    }
  }, [bankAccounts, selectedBankAccount])

  const fetchData = async () => {
    try {
      const [plansRes, bankAccountsRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order').order('created_at'),
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here if needed
    } catch (err) {
      console.error('Failed to copy text: ', err)
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
      console.log('Starting community creation process...')
      console.log('User:', user.id)
      console.log('User email:', user.email)
      console.log('Selected plan:', selectedPlan.id)
      console.log('Selected bank account:', selectedBankAccount.id)
      console.log('Receipt file:', receiptFile.name)
      console.log('Community name:', communityName)
      
      // Check authentication status
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Current session:', session?.user?.id)
      console.log('Session error:', sessionError)
      console.log('Session user ID type:', typeof session?.user?.id)
      console.log('Auth context user ID:', user.id)
      console.log('Auth context user ID type:', typeof user.id)
      console.log('Session and auth context match:', session?.user?.id === user.id)

      // Test database access with current session
      console.log('Testing database access...')
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', user.id)
        .single()
      
      console.log('Test query result:', testData)
      console.log('Test query error:', testError)
      
      if (testError) {
        console.error('Database access test failed:', testError)
        throw new Error(`Database access failed: ${testError.message}`)
      }

      // Upload receipt
      setUploadProgress(30)
      console.log('Uploading receipt...')
      const receiptUrl = await uploadReceipt()
      console.log('Receipt uploaded successfully:', receiptUrl)
      
      // Generate slug
      setUploadProgress(50)
      console.log('Generating slug...')
      const { data: slugData, error: slugError } = await supabase
        .rpc('generate_community_slug', { community_name: communityName })
      
      if (slugError) {
        console.error('Slug generation error:', slugError)
        throw slugError
      }
      const slug = slugData as string
      console.log('Slug generated:', slug)

      // Calculate amount
      const amount = billingCycle === 'monthly' ? selectedPlan.monthly_price : selectedPlan.annual_price
      console.log('Amount calculated:', amount)

      // Create community
      setUploadProgress(70)
      console.log('Creating community...')
      
      const communityData = {
        name: communityName,
        slug,
        description: communityDescription || null,
        owner_id: user.id,
        plan_id: selectedPlan.id,
        billing_cycle: billingCycle,
      }
      
      console.log('Community data to insert:', communityData)
      console.log('User ID from auth context:', user.id)
      console.log('User ID type:', typeof user.id)
      
      const { data: community, error: communityError } = await supabase
        .from('communities')
        .insert([communityData])
        .select()
        .single()

      if (communityError) {
        console.error('Community creation error:', communityError)
        console.error('Community error details:', JSON.stringify(communityError, null, 2))
        console.error('Community error message:', communityError.message)
        console.error('Community error code:', communityError.code)
        console.error('Community error details:', communityError.details)
        throw communityError
      }
      console.log('Community created successfully:', community.id)

      // Create payment receipt
      setUploadProgress(90)
      console.log('Creating payment receipt...')
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

      if (receiptError) {
        console.error('Payment receipt creation error:', receiptError)
        throw receiptError
      }
      console.log('Payment receipt created successfully')

      setUploadProgress(100)
      
      // Redirect to community page (will be created next)
      setTimeout(() => {
        router.push(`/${slug}`)
      }, 500)
    } catch (error) {
      console.error('Error creating community:', error)
      console.error('Error type:', typeof error)
      console.error('Error constructor:', error?.constructor?.name)
      
      // Try to extract more details from the error
      let errorMessage = 'Unknown error occurred'
      let errorDetails = ''
      
      if (error instanceof Error) {
        errorMessage = error.message
        errorDetails = error.stack || ''
      } else if (error && typeof error === 'object') {
        // Handle Supabase errors
        if ('message' in error) {
          errorMessage = String(error.message)
        }
        if ('code' in error) {
          errorDetails += `Code: ${error.code}\n`
        }
        if ('details' in error) {
          errorDetails += `Details: ${error.details}\n`
        }
        if ('hint' in error) {
          errorDetails += `Hint: ${error.hint}\n`
        }
        
        // Try to stringify the entire error object
        try {
          errorDetails += `Full error: ${JSON.stringify(error, null, 2)}`
        } catch (e) {
          errorDetails += `Error object: ${String(error)}`
        }
      }
      
      console.error('Parsed error message:', errorMessage)
      console.error('Parsed error details:', errorDetails)
      
      alert(`Failed to create community: ${errorMessage}`)
      setSubmitting(false)
      setUploadProgress(0)
    }
  }

  if (isLoading || loading) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
        <div className="fixed inset-0 z-0 overflow-hidden">
          <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
        </div>
        <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-4rem)]">
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
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
      </div>
      
      <div className="relative z-10 space-y-6 pb-8">
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
            <h1 className="text-xl sm:text-3xl font-bold text-white">Create Your Community</h1>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-primary text-white' : 'bg-white/20 text-white/60'
              }`}>
                <Package className="h-4 w-4 sm:hidden" />
                <span className="text-sm font-semibold hidden sm:block">1</span>
              </div>
              <span className={`text-xs sm:text-sm hidden sm:block ${step >= 1 ? 'text-white' : 'text-white/40'}`}>
                Choose Plan
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-primary text-white' : 'bg-white/20 text-white/60'
              }`}>
                <FileText className="h-4 w-4 sm:hidden" />
                <span className="text-sm font-semibold hidden sm:block">2</span>
              </div>
              <span className={`text-xs sm:text-sm hidden sm:block ${step >= 2 ? 'text-white' : 'text-white/40'}`}>
                Community Details
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 3 ? 'bg-primary text-white' : 'bg-white/20 text-white/60'
              }`}>
                <CreditCard className="h-4 w-4 sm:hidden" />
                <span className="text-sm font-semibold hidden sm:block">3</span>
              </div>
              <span className={`text-xs sm:text-sm hidden sm:block ${step >= 3 ? 'text-white' : 'text-white/40'}`}>
                Payment
              </span>
            </div>
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
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-6">Choose Your Plan</h2>
              
              {plans.length === 0 ? (
                <p className="text-white/60">No plans available. Please contact support.</p>
              ) : (
                <Tabs value={billingCycle} onValueChange={(value) => setBillingCycle(value as BillingCycle)} className="w-full">
                  <div className="flex justify-center">
                    <TabsList className="inline-flex">
                      <TabsTrigger value="monthly">Monthly</TabsTrigger>
                      <TabsTrigger value="annual">Annual</TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="monthly" className="mt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {plans.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan)}
                          className={`group relative rounded-xl p-6 sm:p-8 text-left transition-all duration-300 transform hover:scale-105 cursor-pointer ${
                            selectedPlan?.id === plan.id
                              ? 'bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary shadow-lg shadow-primary/20'
                              : 'bg-gradient-to-br from-white/10 to-white/5 border-2 border-transparent hover:bg-gradient-to-br hover:from-white/15 hover:to-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-white/10'
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-6">
                            <h3 className="text-lg sm:text-xl font-bold text-white flex-1">{plan.name}</h3>
                            {plan.tags && plan.tags.length > 0 && (
                              <span className="px-2 py-1 rounded-md bg-primary/30 text-white text-xs font-semibold">
                                {plan.tags[0]}
                              </span>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-white/70 text-sm sm:text-base mb-4 leading-relaxed">{plan.description}</p>
                          )}
                          <div className="space-y-2">
                            <p className="text-2xl sm:text-3xl font-bold text-white">
                              TTD ${plan.monthly_price}
                              <span className="text-base sm:text-lg font-normal text-white/60">/month</span>
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="annual" className="mt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {plans.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => setSelectedPlan(plan)}
                          className={`group relative rounded-xl p-6 sm:p-8 text-left transition-all duration-300 transform hover:scale-105 cursor-pointer ${
                            selectedPlan?.id === plan.id
                              ? 'bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary shadow-lg shadow-primary/20'
                              : 'bg-gradient-to-br from-white/10 to-white/5 border-2 border-transparent hover:bg-gradient-to-br hover:from-white/15 hover:to-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-white/10'
                          }`}
                        >
                          <div className="flex items-start gap-2 mb-6">
                            <h3 className="text-lg sm:text-xl font-bold text-white flex-1">{plan.name}</h3>
                            {plan.tags && plan.tags.length > 0 && (
                              <span className="px-2 py-1 rounded-md bg-primary/30 text-white text-xs font-semibold">
                                {plan.tags[0]}
                              </span>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-white/70 text-sm sm:text-base mb-4 leading-relaxed">{plan.description}</p>
                          )}
                          <div className="space-y-2">
                            <p className="text-2xl sm:text-3xl font-bold text-white">
                              TTD ${plan.annual_price}
                              <span className="text-base sm:text-lg font-normal text-white/60">/year</span>
                            </p>
                            <p className="text-sm font-medium text-white bg-primary/20 px-2 py-1 rounded-md inline-block">
                              2 months free
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
            
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedPlan}
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Community Details */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 space-y-4">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">Community Details</h2>
              
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
              
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="border-white/20 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!communityName.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 space-y-6">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">Payment Details</h2>
              
              {/* Bank Account Selection */}
              <div>
                <Label className="text-white">Select Bank Account *</Label>
                {bankAccounts.length === 0 ? (
                  <p className="text-white/60 mt-2">No bank accounts available. Please contact support.</p>
                ) : (
                  <div className="mt-2">
                    <Select
                      value={selectedBankAccount?.id || ""}
                      onValueChange={(value) => {
                        const account = bankAccounts.find(acc => acc.id === value)
                        setSelectedBankAccount(account || null)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a bank account" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_name} - {account.bank_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Bank Account Details */}
              {selectedBankAccount && (
                <div className="rounded-lg bg-white/5 p-4 space-y-4">
                  <h3 className="font-semibold text-white">Bank Account Details</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-white/80">Account Name:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white">{selectedBankAccount.account_name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(selectedBankAccount.account_name)}
                          className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80">Bank Name:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white">{selectedBankAccount.bank_name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(selectedBankAccount.bank_name)}
                          className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80">Account Number:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white">{selectedBankAccount.account_number}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(selectedBankAccount.account_number)}
                          className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/80">Account Type:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white capitalize">{selectedBankAccount.account_type}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(selectedBankAccount.account_type)}
                          className="h-6 w-6 text-white/60 hover:text-white hover:bg-white/10"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
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
            
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="border-white/20 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedBankAccount || !receiptFile || submitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
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