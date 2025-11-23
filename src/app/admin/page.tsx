"use client"

import React from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Users, Shield, BarChart3, Settings, Mail, Briefcase, Database, FileText, CreditCard, Coins, GraduationCap, Building2, TrendingUp, Wallet } from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"

export default function AdminDashboard() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])


  // Don't render if not admin
  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      {/* Content */}
      <div className="relative z-10 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb items={[]} />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-white/80">Total Users</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">0</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-white/80">Community Owners</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">0</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-white/80">Communities</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">0</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-white/80">Active Sessions</p>
              <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">0</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
        <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <button
            onClick={() => router.push('/admin/bank-accounts')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Building2 className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Bank Accounts
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Manage payment bank accounts
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/revenue')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <TrendingUp className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Platform Revenue
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              View revenue breakdown and analytics
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/withdrawals')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Wallet className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Withdrawals
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Manage platform withdrawals
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/users')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Users className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Manage Users
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              View and manage user accounts
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/payments')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <CreditCard className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Payment Verification
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Review and verify payment receipts
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/settings')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Settings className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Platform Settings
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Configure platform-wide settings
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/reports')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <FileText className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                View Reports
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Access platform analytics and reports
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/emails')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Mail className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Test Emails
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Test email templates and verify delivery
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/webinar-signups')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <GraduationCap className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Webinar Signups
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              View and manage webinar signups
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/crm')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Briefcase className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                CRM
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Manage customer relationships and leads
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/roles')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Shield className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Roles & Permissions
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Manage user roles and permissions
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/database')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Database className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Database
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Access database management tools
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/transactions')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <CreditCard className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Transactions
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              View and manage all transactions
            </p>
          </button>

          <button
            onClick={() => router.push('/admin/payouts')}
            className="group rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-3 sm:p-4 text-left transition-all hover:bg-white/20 hover:scale-105 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <Coins className="h-4 w-4 text-white/80" />
              <h3 className="font-semibold text-white text-sm sm:text-base">
                Payouts
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                  →
                </span>
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-white/80">
              Manage community and user payouts
            </p>
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}