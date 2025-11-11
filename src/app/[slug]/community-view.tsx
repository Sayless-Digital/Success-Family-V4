"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Users, Calendar, Crown, AlertCircle, CheckCircle2, Globe, MessageSquare, Star, TrendingUp, Heart, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { CommunityNavigation } from "@/components/community-navigation"
import { useTopupCheck } from "@/hooks/use-topup-check"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { Community, CommunityMember } from "@/types"
import { CommunityLogo } from "@/components/community-logo"

interface CommunityViewProps {
  community: Community & {
    owner: {
      id: string
      username: string
      first_name: string
      last_name: string
      profile_picture?: string
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
  currentUserId?: string
}

export default function CommunityView({ 
  community, 
  userMembership, 
  currentUserId 
}: CommunityViewProps) {
  const router = useRouter()
  const { needsTopup } = useTopupCheck()
  
  const isOwner = currentUserId === community.owner_id
  const isMember = !!userMembership
  const isActive = community.is_active
  
  // Join dialog state
  const [joinDialogOpen, setJoinDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleJoinCommunity = async () => {
    if (!currentUserId) {
      toast.error("Please sign in to join this community")
      return
    }

    // Check if user needs to top up
    if (needsTopup) {
      setJoinDialogOpen(false)
      const returnUrl = encodeURIComponent(`/${community.slug}`)
      router.push(`/topup?returnUrl=${returnUrl}`)
      return
    }

    setIsSubmitting(true)
    
    try {
      // Add user as community member
      const { error: memberError } = await supabase
        .from('community_members')
        .insert([{
          community_id: community.id,
          user_id: currentUserId,
          role: 'member'
        }])

      if (memberError) {
        console.error('Error joining community:', memberError)
        throw new Error('Failed to join community: ' + memberError.message)
      }

      toast.success("Successfully joined the community!")
      setJoinDialogOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Error joining community:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLeaveCommunity = async () => {
    if (!currentUserId || !userMembership) return

    try {
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', community.id)
        .eq('user_id', currentUserId)

      if (error) throw error

      toast.success("Left the community")
      router.refresh()
    } catch (error: any) {
      console.error('Error leaving community:', error)
      toast.error(error.message || "Failed to leave community")
    }
  }

  if (!isActive) {
    return (
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 max-w-md mx-4">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-16 w-16 text-white/60 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Community Inactive</h2>
              <p className="text-white/80 mb-6">
                This community is currently inactive and not accepting new members.
              </p>
              <Button asChild>
                <Link href="/communities">
                  Browse Other Communities
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Navigation Tabs */}
        <CommunityNavigation 
          slug={community.slug} 
          isOwner={isOwner} 
          isMember={isMember} 
        />

        {/* Community Header */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 w-full">
          <CardContent className="p-4 sm:p-6 w-full">
            {/* Mobile: All content centered */}
            <div className="flex flex-col items-center justify-center sm:hidden gap-3 w-full max-w-full">
              <CommunityLogo
                name={community.name}
                logoUrl={community.logo_url}
                size="xl"
                className="border-4 border-white/20 mx-auto"
              />
              <div className="flex flex-col items-center gap-2 w-full">
                <h1 className="text-xl font-bold text-white break-words leading-tight text-center w-full">{community.name}</h1>
                {isMember && !isOwner && (
                  <Badge className="w-fit bg-white/10 text-white/80 border-white/20 flex-shrink-0 text-xs px-1.5 py-0.5 mx-auto">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                    Member
                  </Badge>
                )}
              </div>
              
              {community.description && (
                <p className="text-white/80 text-sm mb-2 leading-relaxed break-words overflow-wrap-anywhere text-center w-full max-w-full">
                  {community.description}
                </p>
              )}
              
              <div className="flex items-center justify-center gap-1.5 text-white/60 flex-wrap text-xs w-full">
                <Crown className="h-3 w-3 flex-shrink-0" />
                <span>Created by</span>
                <Link 
                  href={`/profile/${community.owner.username}`}
                  className="text-white hover:text-white/80 font-medium break-words"
                >
                  {community.owner.first_name} {community.owner.last_name}
                </Link>
              </div>
            </div>

            {/* Desktop: Side-by-side layout */}
            <div className="hidden sm:flex flex-row gap-6">
              <CommunityLogo
                name={community.name}
                logoUrl={community.logo_url}
                size="xl"
                className="border-4 border-white/20 flex-shrink-0"
              />
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-row items-center gap-2 mb-1.5">
                  <h1 className="text-xl font-bold text-white break-words leading-tight">{community.name}</h1>
                  {isMember && !isOwner && (
                    <Badge className="w-fit bg-white/10 text-white/80 border-white/20 flex-shrink-0 text-xs px-1.5 py-0.5">
                      <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                      Member
                    </Badge>
                  )}
                </div>
                
                {community.description && (
                  <p className="text-white/80 text-base mb-2 leading-relaxed break-words overflow-wrap-anywhere">
                    {community.description}
                  </p>
                )}
                
                <div className="flex items-center gap-1.5 text-white/60 flex-wrap text-xs">
                  <Crown className="h-3 w-3 flex-shrink-0" />
                  <span>Created by</span>
                  <Link 
                    href={`/profile/${community.owner.username}`}
                    className="text-white hover:text-white/80 font-medium break-words"
                  >
                    {community.owner.first_name} {community.owner.last_name}
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!isOwner && !isMember && (
            <Button 
              onClick={() => setJoinDialogOpen(true)}
              size="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90 touch-feedback text-sm sm:text-base animate-shimmer-slow"
            >
              <Heart className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Join Community
            </Button>
          )}
          
          {!isOwner && isMember && (
            <Button 
              onClick={handleLeaveCommunity}
              variant="outline"
              size="default"
              className="border-white/20 text-white hover:bg-white/10 touch-feedback text-sm sm:text-base"
            >
              Leave Community
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="flex w-full gap-3 overflow-x-auto pb-2 pr-4 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0">
          <Card className="min-w-[200px] md:min-w-0 flex-shrink-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-4 sm:p-6 text-center">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-white/70 mx-auto mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-white mb-1">
                {community.members?.length || 0}
              </div>
              <div className="text-white/60 text-xs sm:text-sm">Members</div>
            </CardContent>
          </Card>
          
          <Card className="min-w-[200px] md:min-w-0 flex-shrink-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-4 sm:p-6 text-center">
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-white/70 mx-auto mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-white mb-1">
                {new Date(community.created_at).toLocaleDateString('en-US', { month: 'short' })}
              </div>
              <div className="text-white/60 text-xs sm:text-sm">Created</div>
            </CardContent>
          </Card>
          
          <Card className="min-w-[200px] md:min-w-0 flex-shrink-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-4 sm:p-6 text-center">
              <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-white/70 mx-auto mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-white mb-1">
                {new Date(community.updated_at).toLocaleDateString('en-US', { month: 'short' })}
              </div>
              <div className="text-white/60 text-xs sm:text-sm">Last Active</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Join Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[400000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            onInteractOutside={(event) => {
              const target = event.target as HTMLElement
              if (target?.closest('[data-sonner-toaster]')) {
                event.preventDefault()
              }
            }}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className={cn(
              "fixed z-[400001] flex flex-col border border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md shadow-lg duration-200 rounded-lg",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              // Mobile: full screen with fixed footer
              "top-2 left-2 right-2 bottom-2",
              "w-[calc(100vw-1rem)] h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)]",
              "overflow-hidden",
              // Desktop: centered with max-width
              "sm:left-[50%] sm:top-[50%] sm:right-auto sm:bottom-auto",
              "sm:w-full sm:max-w-lg",
              "sm:translate-x-[-50%] sm:translate-y-[-50%]",
              "sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:min-h-0",
              "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
              "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
            )}
          >
            {/* Close Button */}
            <DialogPrimitive.Close 
              tabIndex={-1}
              className="absolute right-4 top-4 rounded-sm opacity-70 text-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-white/20 data-[state=open]:text-white cursor-pointer z-10"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            {/* Scrollable Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-6 [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255, 255, 255, 0.2) transparent' }}>
              <div className="text-center space-y-4">
                {/* Community Logo */}
                <div className="flex justify-center">
                  <CommunityLogo
                    name={community.name}
                    logoUrl={community.logo_url}
                    size="xl"
                    className="border-4 border-white/20"
                  />
                </div>
                
                <div className="space-y-2">
                  <DialogPrimitive.Title className="text-2xl font-bold text-white">
                    Join {community.name}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-white/70 text-base">
                    Become a member and start engaging with the community
                  </DialogPrimitive.Description>
                </div>
              </div>
              
              <div className="space-y-6 py-6">
                {/* Community Info */}
                {community.description && (
                  <div className="text-center">
                    <p className="text-white/80 text-sm leading-relaxed">
                      {community.description}
                    </p>
                  </div>
                )}
                
                {/* Stats */}
                <div className="flex items-center justify-center gap-6 py-4 border-y border-white/10">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {community.members?.length || 0}
                    </div>
                    <div className="text-xs text-white/60 uppercase tracking-wide mt-1">
                      Members
                    </div>
                  </div>
                  <div className="w-px h-12 bg-white/10" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white">
                      {new Date(community.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                    <div className="text-xs text-white/60 uppercase tracking-wide mt-1">
                      Created
                    </div>
                  </div>
                </div>
                
                {/* Benefits */}
                <div className="space-y-3 pb-6">
                  <h4 className="font-semibold text-white text-sm uppercase tracking-wide">What you'll get:</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MessageSquare className="h-4 w-4 text-white/70" />
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm mb-1">Community Discussions</div>
                        <div className="text-xs text-white/60">Participate in conversations and share your thoughts</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Users className="h-4 w-4 text-white/70" />
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm mb-1">Connect with Members</div>
                        <div className="text-xs text-white/60">Build relationships with like-minded people</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Star className="h-4 w-4 text-white/70" />
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm mb-1">Share Your Insights</div>
                        <div className="text-xs text-white/60">Contribute your experiences and knowledge</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Coins className="h-4 w-4 text-white/70" />
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm mb-1">Earn Points</div>
                        <div className="text-xs text-white/60">Get rewarded with points for posts and contributions</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed Footer Button - Outside scroll area, stuck to bottom */}
            <div className="flex-shrink-0 border-t border-white/10 bg-gradient-to-b from-white/10 via-white/10 to-white/10 backdrop-blur-md p-4 sm:p-6">
              <Button 
                onClick={handleJoinCommunity} 
                disabled={isSubmitting}
                size="lg"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 touch-feedback animate-shimmer-slow"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Heart className="h-4 w-4 mr-2" />
                    Join Community
                  </>
                )}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </Dialog>
    </div>
  )
}
