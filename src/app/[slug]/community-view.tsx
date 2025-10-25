"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Users, Calendar, Package, Crown, AlertCircle, CheckCircle2, Clock, XCircle } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import type { Community, CommunityMember, PaymentStatus } from "@/types"

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
      max_tree: number
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
  
  const getPaymentStatusBadge = () => {
    if (!paymentStatus) return null
    
    switch (paymentStatus.status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span className="text-yellow-500 text-sm font-medium">Payment Pending Verification</span>
          </div>
        )
      case 'verified':
        return (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-green-500 text-sm font-medium">Payment Verified</span>
          </div>
        )
      case 'rejected':
        return (
          <div className="flex items-col gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-500 text-sm font-medium">Payment Rejected</span>
            </div>
            {paymentStatus.rejection_reason && (
              <p className="text-red-400 text-xs mt-1">{paymentStatus.rejection_reason}</p>
            )}
          </div>
        )
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)] w-full overflow-x-hidden">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
      </div>
      
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-white">{community.name}</h1>
                {isOwner && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                    <Crown className="h-3 w-3" />
                    Owner
                  </span>
                )}
              </div>
              
              {community.description && (
                <p className="text-white/80 text-lg mb-4">{community.description}</p>
              )}
              
              <div className="flex items-center gap-6 text-white/60 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{community.members?.length || 0} / {community.plan.max_tree} members</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span>{community.plan.name} Plan</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Created {new Date(community.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Payment Status for Owner */}
          {isOwner && paymentStatus && (
            <div className="mb-4">
              {getPaymentStatusBadge()}
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

        {/* Community Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80">Total Members</span>
              <Users className="h-5 w-5 text-white/60" />
            </div>
            <p className="text-3xl font-bold text-white">{community.members?.length || 0}</p>
            <p className="text-white/60 text-sm mt-1">
              {community.plan.max_tree - (community.members?.length || 0)} slots remaining
            </p>
          </div>
          
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80">Subscription</span>
              <Package className="h-5 w-5 text-white/60" />
            </div>
            <p className="text-3xl font-bold text-white">{community.plan.name}</p>
            <p className="text-white/60 text-sm mt-1">
              {community.billing_cycle === 'monthly' ? 'Monthly' : 'Annual'} billing
            </p>
          </div>
          
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80">Community Owner</span>
              <Crown className="h-5 w-5 text-white/60" />
            </div>
            <p className="text-lg font-semibold text-white">
              {community.owner.first_name} {community.owner.last_name}
            </p>
            <p className="text-white/60 text-sm mt-1">@{community.owner.username}</p>
          </div>
        </div>

        {/* Members List */}
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Community Members</h2>
          
          {!community.members || community.members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-white/40 mx-auto mb-4" />
              <p className="text-white/60">No members yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {community.members.map((member) => (
                <div 
                  key={member.id}
                  className="rounded-lg bg-white/5 p-4 border border-white/10"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {member.user.first_name[0]}{member.user.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">
                        {member.user.first_name} {member.user.last_name}
                      </p>
                      <p className="text-white/60 text-sm truncate">@{member.user.username}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 rounded-full ${
                      member.role === 'owner' 
                        ? 'bg-primary/20 text-primary' 
                        : 'bg-white/10 text-white/80'
                    }`}>
                      {member.role === 'owner' ? 'Owner' : 'Member'}
                    </span>
                    <span className="text-white/60">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions for non-members */}
        {!isMember && currentUserId && (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6 text-center">
            <h3 className="text-xl font-semibold text-white mb-2">Join This Community</h3>
            <p className="text-white/60 mb-4">
              Become a member to access exclusive content and connect with others
            </p>
            <Button 
              disabled={!isActive}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isActive ? 'Request to Join' : 'Community Inactive'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}