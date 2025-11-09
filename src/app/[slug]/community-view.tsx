"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Users, Calendar, Crown, AlertCircle, CheckCircle2, Globe, MessageSquare, Star, TrendingUp, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { CommunityNavigation } from "@/components/community-navigation"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { Community, CommunityMember } from "@/types"

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
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Community Avatar */}
              <div className="h-20 w-20 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-2xl border-4 border-white/20 shadow-lg backdrop-blur-md flex-shrink-0">
                {community.name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              
              {/* Community Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:gap-3">
                  <h1 className="text-3xl font-bold text-white truncate">{community.name}</h1>
                  {isMember && !isOwner && (
                    <Badge className="w-fit bg-white/10 text-white/80 border-white/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Member
                    </Badge>
                  )}
                </div>
                
                {community.description && (
                  <p className="text-white/80 text-lg mb-4 leading-relaxed">
                    {community.description}
                  </p>
                )}
                
                {/* Owner Info */}
                <div className="flex items-center gap-2 text-white/60">
                  <Crown className="h-4 w-4" />
                  <span>Created by</span>
                  <Link 
                    href={`/profile/${community.owner.username}`}
                    className="text-white hover:text-white/80 font-medium"
                  >
                    {community.owner.first_name} {community.owner.last_name}
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 text-white/70 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white mb-1">
                {community.members?.length || 0}
              </div>
              <div className="text-white/60 text-sm">Members</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-6 text-center">
              <Calendar className="h-8 w-8 text-white/70 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white mb-1">
                {new Date(community.created_at).toLocaleDateString('en-US', { month: 'short' })}
              </div>
              <div className="text-white/60 text-sm">Created</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-6 text-center">
              <MessageSquare className="h-8 w-8 text-white/70 mx-auto mb-2" />
              <div className="text-2xl font-bold text-white mb-1">
                {new Date(community.updated_at).toLocaleDateString('en-US', { month: 'short' })}
              </div>
              <div className="text-white/60 text-sm">Last Active</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          {!isOwner && !isMember && (
            <Button 
              onClick={() => setJoinDialogOpen(true)}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 touch-feedback"
            >
              <Heart className="h-5 w-5 mr-2" />
              Join Community
            </Button>
          )}
          
          {!isOwner && isMember && (
            <Button 
              onClick={handleLeaveCommunity}
              variant="outline"
              size="lg"
              className="border-white/20 text-white hover:bg-white/10 touch-feedback"
            >
              Leave Community
            </Button>
          )}
        </div>

        {/* Members Section */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members ({community.members?.length || 0})
            </CardTitle>
            <CardDescription className="text-white/60">
              Community members and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {community.members && community.members.length > 0 ? (
              <div className="space-y-3">
                {community.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <div className="h-10 w-10 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm border border-white/20 shadow-lg backdrop-blur-md">
                      {member.user.first_name[0]}{member.user.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <Link 
                          href={`/profile/${member.user.username}`}
                          className="font-medium text-white hover:text-white/80 truncate"
                        >
                          {member.user.first_name} {member.user.last_name}
                        </Link>
                        <Badge 
                          variant={member.role === 'owner' ? 'default' : 'secondary'}
                          className={member.role === 'owner' ? 'bg-white/10 text-white/80 border-white/20' : 'bg-white/10 text-white/80 border-white/20'}
                        >
                          {member.role === 'owner' ? (
                            <>
                              <Crown className="h-3 w-3 mr-1" />
                              Owner
                            </>
                          ) : (
                            'Member'
                          )}
                        </Badge>
                      </div>
                      <p className="text-white/60 text-sm">
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-white/40 mx-auto mb-4" />
                <p className="text-white/60">No members yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Join Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Heart className="h-4 w-4 text-white/80" />
              Join {community.name}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Click join to become a member of this community.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-white/5 border border-white/10">
              <h4 className="font-medium text-white mb-2">What you'll get:</h4>
              <ul className="space-y-1 text-sm text-white/80">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  Access to community discussions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  Connect with like-minded members
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  Share your experiences and insights
                </li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setJoinDialogOpen(false)}
              disabled={isSubmitting}
              className="border-white/20 text-white hover:bg-white/10 touch-feedback"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleJoinCommunity} 
              disabled={isSubmitting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 touch-feedback"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2" />
                  Joining...
                </>
              ) : (
                'Join Community'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}