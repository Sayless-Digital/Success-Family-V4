"use client"

import React from "react"
import { Crown, Users, Calendar, Shield, CheckCircle2 } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface User {
  id: string
  username: string
  first_name: string
  last_name: string
  bio?: string
  profile_picture?: string
  role: 'admin' | 'community_owner' | 'user'
  created_at: string
}

interface ProfileViewProps {
  user: User
  ownedCommunitiesCount: number
  memberCommunitiesCount: number
  verifiedPaymentsCount: number
}

export default function ProfileView({
  user,
  ownedCommunitiesCount,
  memberCommunitiesCount,
  verifiedPaymentsCount,
}: ProfileViewProps) {
  const colorStops = useAuroraColors()

  const getRoleBadge = () => {
    switch (user.role) {
      case 'admin':
        return (
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </Badge>
        )
      case 'community_owner':
        return (
          <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
            <Crown className="h-3 w-3 mr-1" />
            Community Owner
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
      {/* Aurora Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.3} />
      </div>

      <div className="relative z-10 space-y-6">
        {/* Profile Hero Section */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <Avatar className="h-32 w-32 border-4 border-white/20">
                <AvatarImage src={user.profile_picture || ''} alt={user.username} />
                <AvatarFallback className="bg-white/10 text-white text-4xl">
                  {user.first_name?.[0] || ''}
                  {user.last_name?.[0] || ''}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left w-full sm:w-auto">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  {user.first_name} {user.last_name}
                </h2>
                {user.bio && (
                  <p className="text-white/70 text-sm sm:text-base mb-4 max-w-2xl">
                    {user.bio}
                  </p>
                )}
                <div className="flex items-center gap-1 text-white/60 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-3">
                  <Crown className="h-6 w-6 text-white/80" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{ownedCommunitiesCount}</p>
                <p className="text-white/70 text-sm">Communities Owned</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-3">
                  <Users className="h-6 w-6 text-white/70" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{memberCommunitiesCount}</p>
                <p className="text-white/70 text-sm">Community Memberships</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/10 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-white/80" />
                </div>
                <p className="text-3xl font-bold text-white mb-1">{verifiedPaymentsCount}</p>
                <p className="text-white/70 text-sm">Verified Payments</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Info Card */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardHeader>
            <CardTitle className="text-white">Public Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4 sm:col-span-2">
                <p className="text-white/70 text-sm mb-1">Username</p>
                <p className="text-white text-lg font-medium">@{user.username}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4 sm:col-span-2">
                <p className="text-white/70 text-sm mb-1">Member Since</p>
                <p className="text-white text-lg font-medium">
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

