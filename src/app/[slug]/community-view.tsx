"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Users, Calendar, Crown, AlertCircle, CheckCircle2, Globe, MessageSquare, Star, TrendingUp, Shield, Heart, CreditCard, Upload, FileText, Loader2 } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { Community, CommunityMember, PaymentStatus, BillingCycle } from "@/types"

interface CommunityViewProps {
  community: Community & {
    owner: {
      id: string
      username: string
      first_name: string
      last_name: string
      profile_picture?: string
    }
    plan: {
      name: string
      monthly_price: number
      annual_price: number
    }
    members: Array<{
      id: string
      role: string
      joined_at: string
      user: {
        id: string
        username: string
        first_name: string
        last_name: string
        profile_picture?: string
      }
    }>
  }
  userMembership: any
  paymentStatus: {
    status: PaymentStatus
    created_at: string
    rejection_reason?: string
  } | null
  currentUserId?: string
}

export default function CommunityView({ 
  community, 
  userMembership, 
  paymentStatus,
  currentUserId 
}: CommunityViewProps) {
  const router = useRouter()
  const colorStops = useAuroraColors()
  
  const isOwner = currentUserId === community.owner_id
  const isMember = !!userMembership
  const isActive = community.is_active
  
  // Subscription dialog state
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false)
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleJoinFree = async () => {
    if (!currentUserId) {
      toast.error("Please sign in to join this community")
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('community_members')
        .insert([{
          community_id: community.id,
          user_id: currentUserId,
          role: 'member'
        }])

      if (error) throw error

      toast.success("Successfully joined the community!")
      router.refresh()
    } catch (error: any) {
      console.error('Error joining community:', error)
      toast.error(error.message || "Failed to join community")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleSubscribe = async () => {
    if (!currentUserId) {
      toast.error("Please sign in to subscribe")
      return
    }

    if (!selectedFile && community.pricing_type !== 'free') {
      toast.error("Please upload a payment receipt")
      return
    }

    setIsSubmitting(true)
    
    try {
      // Upload receipt file if provided
      let receiptUrl = ''
      if (selectedFile) {
        // Path must start with user_id for RLS policies
        const fileName = `${currentUserId}/${community.id}/${Date.now()}-${selectedFile.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payment-receipts')
          .upload(fileName, selectedFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('payment-receipts')
          .getPublicUrl(fileName)
        
        receiptUrl = publicUrl
      }

      // Determine amount based on pricing type and billing cycle
      let amount = 0
      if (community.pricing_type === 'one_time') {
        amount = community.one_time_price || 0
      } else if (community.pricing_type === 'recurring') {
        amount = billingCycle === 'monthly' ? (community.monthly_price || 0) : (community.annual_price || 0)
      }

      // Create payment receipt for paid communities
      if (community.pricing_type && community.pricing_type !== 'free') {
        // Get community's bank account
        const { data: bankAccounts, error: bankError } = await supabase
          .from('bank_accounts')
          .select('id')
          .eq('community_id', community.id)
          .eq('is_active', true)
          .limit(1)
        
        if (bankError) {
          console.error('Error fetching bank account:', bankError)
          throw new Error('Failed to fetch bank account: ' + bankError.message)
        }
        
        const bankAccountId = bankAccounts && bankAccounts.length > 0 ? bankAccounts[0].id : null
        
        if (!bankAccountId) {
          throw new Error('No active bank account found for this community')
        }

        const { error: receiptError } = await supabase
          .from('payment_receipts')
          .insert([{
            community_id: community.id,
            user_id: currentUserId,
            plan_id: community.plan_id,
            billing_cycle: billingCycle,
            amount: amount,
            bank_account_id: bankAccountId,
            receipt_url: receiptUrl,
            status: 'pending'
          }])

        if (receiptError) {
          console.error('Error creating payment receipt:', receiptError)
          throw new Error('Failed to create payment receipt: ' + receiptError.message)
        }
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from('community_members')
        .insert([{
          community_id: community.id,
          user_id: currentUserId,
          role: 'member'
        }])

      if (memberError) {
        console.error('Error adding member:', memberError)
        
        // If it's a unique constraint error, user is already a member
        if (memberError.code === '23505') {
          toast.error("You are already a member of this community")
          setSubscribeDialogOpen(false)
          return
        }
        
        throw new Error('Failed to join community: ' + memberError.message)
      }

      if (community.pricing_type && community.pricing_type !== 'free') {
        toast.success("Subscription request submitted! Awaiting payment verification.")
      } else {
        toast.success("Successfully joined the community!")
      }
      
      setSubscribeDialogOpen(false)
      setSelectedFile(null)
      router.refresh()
    } catch (error: any) {
      console.error('Error subscribing:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error)
      toast.error(errorMessage || "Failed to process subscription")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.3} />
      </div>
      
      <div className="relative z-10 space-y-8">
        {/* Hero Section */}
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{community.name}</h1>
                <div className="flex items-center gap-2">
                  {isOwner && (
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                      <Crown className="h-3 w-3 mr-1" />
                      Owner
                    </Badge>
                  )}
                  {isActive && (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
              </div>
              
              {community.description && (
                <p className="text-white/90 text-xl mb-6 leading-relaxed">{community.description}</p>
              )}
              
              <div className="flex flex-wrap items-center gap-6 text-white/70 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{community.members?.length || 0} members</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Created {new Date(community.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="font-medium">Public Community</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Pricing & Subscribe Section */}
          {!isOwner && (community.pricing_type && community.pricing_type !== 'free') && (
            <div className="mt-6 p-6 rounded-lg bg-gradient-to-br from-primary/10 to-transparent backdrop-blur-md border border-primary/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Join This Community</h3>
                  <div className="flex items-center gap-4 text-white/80">
                    {community.pricing_type === 'one_time' && community.one_time_price && (
                      <span className="text-2xl font-bold text-white">
                        ${community.one_time_price.toFixed(2)}
                      </span>
                    )}
                    {community.pricing_type === 'recurring' && (
                      <div className="space-y-1">
                        {community.monthly_price && community.monthly_price > 0 && (
                          <span className="text-2xl font-bold text-white block">
                            ${community.monthly_price.toFixed(2)}/mo
                          </span>
                        )}
                        {community.annual_price && community.annual_price > 0 && (
                          <span className="text-sm text-white/70">
                            or ${community.annual_price.toFixed(2)}/year
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {!isMember && (
                  <Button 
                    size="lg" 
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => setSubscribeDialogOpen(true)}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Subscribe
                  </Button>
                )}
                {isMember && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Member
                  </Badge>
                )}
              </div>
            </div>
          )}

          {!isOwner && (!community.pricing_type || community.pricing_type === 'free') && !isMember && (
            <div className="mt-6 p-6 rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">Join This Community</h3>
                  <p className="text-white/70">Free to join</p>
                </div>
                <Button 
                  size="lg" 
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleJoinFree}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join Community'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Inactive Warning */}
          {!isActive && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-yellow-500 font-medium">Community Inactive</p>
                <p className="text-yellow-400/80 text-sm mt-1">
                  This community is currently inactive. {isOwner ? 'Your payment is being verified.' : 'Please wait for activation.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Community Overview - Single Column Layout */}
        <div className="space-y-6">
          {/* Community Owner */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Community Owner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {community.owner.first_name[0]}{community.owner.last_name[0]}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {community.owner.first_name} {community.owner.last_name}
                  </p>
                  <Link 
                    href={`/profile/${community.owner.username}`}
                    className="group"
                  >
                    <p className="text-white/60 text-sm group-hover:text-white/80 transition-colors">@{community.owner.username}</p>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Community Statistics */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Community Statistics
              </CardTitle>
              <CardDescription className="text-white/70">
                Key metrics and insights about this community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-white/5 border-0">
                  <Users className="h-8 w-8 text-white/70 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{community.members?.length || 0}</p>
                  <p className="text-white/60 text-sm">Members</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-white/5 border-0">
                  <MessageSquare className="h-8 w-8 text-white/70 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-white/60 text-sm">Posts</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-white/5 border-0">
                  <Star className="h-8 w-8 text-white/70 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-white/60 text-sm">Engagement</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-white/5 border-0">
                  <Heart className="h-8 w-8 text-white/70 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-white/60 text-sm">Likes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Community Features */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Community Features
              </CardTitle>
              <CardDescription className="text-white/70">
                What makes this community special
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border-0">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Member Directory</p>
                    <p className="text-white/60 text-sm">Connect with like-minded individuals</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border-0">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Discussion Forums</p>
                    <p className="text-white/60 text-sm">Share ideas and collaborate</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border-0">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Events & Meetups</p>
                    <p className="text-white/60 text-sm">Join community events</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border-0">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                    <Star className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Exclusive Content</p>
                    <p className="text-white/60 text-sm">Access member-only resources</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Community Status - Owner Only */}
          {isOwner && (
            <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Community Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/70">Status:</span>
                    <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                      {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {community.subscription_start_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">Started:</span>
                      <span className="text-white">{new Date(community.subscription_start_date).toLocaleDateString()}</span>
                    </div>
                  )}
                  {community.next_billing_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/70">Next billing:</span>
                      <span className="text-white">{new Date(community.next_billing_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Members List */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              Community Members
            </CardTitle>
            <CardDescription className="text-white/70">
              Meet the people who make this community special
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!community.members || community.members.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-white/40 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No members yet</h3>
                <p className="text-white/60">Be the first to join this community!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {community.members.map((member) => (
                  <div 
                    key={member.id}
                    className="rounded-lg bg-white/5 p-4 border-0 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
                        <span className="text-white font-semibold text-lg">
                          {member.user.first_name[0]}{member.user.last_name[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate">
                          {member.user.first_name} {member.user.last_name}
                        </p>
                        <Link 
                          href={`/profile/${member.user.username}`}
                          className="group"
                        >
                          <p className="text-white/60 text-sm truncate group-hover:text-white/80 transition-colors">@{member.user.username}</p>
                        </Link>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Badge variant={member.role === 'owner' ? "default" : "secondary"} className="text-xs">
                        {member.role === 'owner' ? 'Owner' : 'Member'}
                      </Badge>
                      <span className="text-white/60 text-xs">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Join Community Section */}
        {!isMember && currentUserId && (
          <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border-0">
            <CardContent className="p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <Heart className="h-8 w-8 text-white/70" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Join This Community</h3>
                <p className="text-white/80 mb-6 leading-relaxed">
                  Become a member to access exclusive content, connect with like-minded individuals, 
                  and participate in community discussions and events.
                </p>
                <div className="space-y-3">
                  <Button 
                    disabled={!isActive}
                    size="lg"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isActive ? 'Request to Join' : 'Community Inactive'}
                  </Button>
                  {!isActive && (
                    <p className="text-white/60 text-sm">
                      This community is currently inactive. Please wait for activation.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Not Authenticated Message */}
        {!currentUserId && (
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-8 text-center">
              <div className="max-w-md mx-auto">
                <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-white/60" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Sign In to Join</h3>
                <p className="text-white/80 mb-6 leading-relaxed">
                  Create an account or sign in to join this community and start connecting with other members.
                </p>
                <Button 
                  size="lg"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => router.push('/auth')}
                >
                  Sign In to Join
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Subscription Dialog */}
      <Dialog open={subscribeDialogOpen} onOpenChange={setSubscribeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscribe to {community.name}</DialogTitle>
            <DialogDescription>
              {community.pricing_type === 'one_time' 
                ? `One-time payment of $${community.one_time_price?.toFixed(2)}`
                : community.pricing_type === 'recurring'
                ? `Recurring subscription`
                : 'Free to join'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {community.pricing_type === 'recurring' && (
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select value={billingCycle} onValueChange={(value) => setBillingCycle(value as BillingCycle)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {community.monthly_price && community.monthly_price > 0 && (
                      <SelectItem value="monthly">
                        Monthly - ${community.monthly_price.toFixed(2)}/mo
                      </SelectItem>
                    )}
                    {community.annual_price && community.annual_price > 0 && (
                      <SelectItem value="annual">
                        Annual - ${community.annual_price.toFixed(2)}/year
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {community.pricing_type && community.pricing_type !== 'free' && (
              <div className="space-y-2">
                <Label htmlFor="receipt">Upload Payment Receipt</Label>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="receipt"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-lg cursor-pointer bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="h-8 w-8 mb-2 text-white/60" />
                      {selectedFile ? (
                        <p className="mb-2 text-sm text-white">{selectedFile.name}</p>
                      ) : (
                        <>
                          <p className="mb-2 text-sm text-white/80">Click to upload or drag and drop</p>
                          <p className="text-xs text-white/60">PNG, JPG, GIF or PDF</p>
                        </>
                      )}
                    </div>
                    <input 
                      id="receipt" 
                      type="file" 
                      className="hidden" 
                      onChange={handleFileSelect}
                      accept="image/*,.pdf"
                    />
                  </label>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSubscribe}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {community.pricing_type === 'free' ? 'Joining...' : 'Submitting...'}
                  </>
                ) : community.pricing_type === 'free' ? (
                  'Join Community'
                ) : (
                  'Submit Payment'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSubscribeDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}