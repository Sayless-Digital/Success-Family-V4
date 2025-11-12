"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Copy, Check, UserPlus, TrendingUp, Gift, Users } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface ReferralsViewProps {
  user: {
    id: string
    username: string
    first_name: string
    last_name: string
  }
  referralBonusPoints: number
  referralMaxTopups: number
  referrals: Array<{
    id: string
    referred_user_id: string
    created_at: string
    referred_user: {
      id: string
      username: string
      first_name: string
      last_name: string
      profile_picture?: string
      email: string
    }
  }>
  referralTopups: Array<{
    id: string
    transaction_id: string
    referrer_bonus_transaction_id: string | null
    bonus_points_awarded: number
    topup_number: number
    created_at: string
    referral: {
      referred_user: {
        id: string
        username: string
        first_name: string
        last_name: string
        profile_picture?: string
      }
    }
    transaction: {
      id: string
      amount_ttd: number
      created_at: string
    }
  }>
  totalEarnings: number
  bonusTransactions: Array<{
    id: string
    points_delta: number
    created_at: string
    recipient_user_id: string
    recipient: {
      id: string
      username: string
      first_name: string
      last_name: string
    }
  }>
}

export function ReferralsView({
  user,
  referralBonusPoints,
  referralMaxTopups,
  referrals,
  referralTopups,
  totalEarnings,
  bonusTransactions,
}: ReferralsViewProps) {
  const [copied, setCopied] = useState(false)
  const referralLink = typeof window !== "undefined" ? `${window.location.origin}/signup/${user.username}` : ""

  const handleCopyLink = async () => {
    if (!referralLink) return

    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast.success("Referral link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy link")
    }
  }

  const conversions = referralTopups.length
  const conversionRate = referrals.length > 0 ? (conversions / referrals.length) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Referral Link Card */}
      <Card className="bg-white/5 border-white/20 border-0">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Gift className="h-5 w-5 text-white/70" />
            Your Referral Link
          </CardTitle>
          <CardDescription className="text-white/60">
            Share this link to invite others. You'll earn {referralBonusPoints} points for each of their first {referralMaxTopups} top-ups!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={referralLink}
              readOnly
              className="bg-white/10 border-white/20 text-white"
            />
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              {copied ? (
                <Check className="h-4 w-4 text-white/70" />
              ) : (
                <Copy className="h-4 w-4 text-white/70" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/20 border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/10">
                <Users className="h-5 w-5 text-white/70" />
              </div>
              <div>
                <p className="text-sm text-white/60">Total Referrals</p>
                <p className="text-2xl font-bold text-white">{referrals.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/20 border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/10">
                <TrendingUp className="h-5 w-5 text-white/70" />
              </div>
              <div>
                <p className="text-sm text-white/60">Conversions</p>
                <p className="text-2xl font-bold text-white">{conversions}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/20 border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/10">
                <UserPlus className="h-5 w-5 text-white/70" />
              </div>
              <div>
                <p className="text-sm text-white/60">Conversion Rate</p>
                <p className="text-2xl font-bold text-white">{conversionRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/20 border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/10">
                <Gift className="h-5 w-5 text-white/70" />
              </div>
              <div>
                <p className="text-sm text-white/60">Total Earnings</p>
                <p className="text-2xl font-bold text-white">{totalEarnings.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referred Users */}
      <Card className="bg-white/5 border-white/20 border-0">
        <CardHeader>
          <CardTitle className="text-white">Referred Users</CardTitle>
          <CardDescription className="text-white/60">
            People you've referred to the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-white/40 mx-auto mb-4" />
              <p className="text-white/60">No referrals yet</p>
              <p className="text-white/40 text-sm mt-1">Share your referral link to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {referrals.map((referral) => {
                const userTopups = referralTopups.filter(
                  (rt) => rt.referral.referred_user.id === referral.referred_user.id
                )
                const hasConverted = userTopups.length > 0

                return (
                  <div
                    key={referral.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2 border-white/20">
                        <AvatarImage src={referral.referred_user.profile_picture} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-sm">
                          {referral.referred_user.first_name[0]}
                          {referral.referred_user.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Link
                          href={`/profile/${referral.referred_user.username}`}
                          className="font-medium text-white hover:text-white/80 transition-colors"
                        >
                          {referral.referred_user.first_name} {referral.referred_user.last_name}
                        </Link>
                        <p className="text-sm text-white/60">@{referral.referred_user.username}</p>
                        <p className="text-xs text-white/40">
                          Joined {new Date(referral.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {hasConverted ? (
                        <div>
                          <p className="text-sm font-medium text-white">
                            {userTopups.length} top-up{userTopups.length !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-white/60">
                            {userTopups.reduce((sum, rt) => sum + Number(rt.bonus_points_awarded || 0), 0)} points earned
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-white/60">No top-ups yet</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Earnings */}
      {bonusTransactions.length > 0 && (
        <Card className="bg-white/5 border-white/20 border-0">
          <CardHeader>
            <CardTitle className="text-white">Recent Earnings</CardTitle>
            <CardDescription className="text-white/60">
              Your recent referral bonus transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bonusTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/10">
                      <Gift className="h-4 w-4 text-white/70" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Referral bonus from {transaction.recipient.first_name}{" "}
                        {transaction.recipient.last_name}
                      </p>
                      <p className="text-xs text-white/60">
                        {new Date(transaction.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white">+{transaction.points_delta} points</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


