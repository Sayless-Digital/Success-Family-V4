"use client"

import React from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Users, Shield, BarChart3, Settings } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"

export default function AdminDashboard() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  
  // Get colors from global CSS custom properties
  const colorStops = useAuroraColors()

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Show loading state
  if (isLoading) {
    return (
      <div className="relative min-h-[calc(100vh-8rem)] w-full overflow-x-hidden">
        {/* Aurora Background */}
        <div className="fixed inset-0 z-0 overflow-hidden">
          <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
        </div>
        
        {/* Loading Content */}
        <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="flex flex-col items-center space-y-6">
            {/* Animated Loading Spinner */}
            <div className="relative">
              {/* Subtle extended blur */}
              <div className="absolute -inset-4 w-24 h-24 rounded-full bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md"></div>
              
              {/* Main spinner container */}
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-white/20 to-transparent backdrop-blur-md border border-white/20 shadow-lg">
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/30 to-transparent animate-pulse"></div>
              </div>
              
              {/* Rotating rings */}
              <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-primary/60 border-r-primary/40 animate-spin" 
                   style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-1 w-14 h-14 rounded-full border border-transparent border-b-primary/40 border-l-primary/20 animate-spin" 
                   style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}></div>
            </div>
            
            {/* Loading Text */}
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold text-white">Loading Admin Dashboard</h2>
              <p className="text-white/80 text-sm">Preparing your workspace...</p>
            </div>
            
            {/* Animated Dots */}
            <div className="flex space-x-2">
              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Don't render if not admin
  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)] w-full overflow-x-hidden">
      {/* Aurora Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
      </div>
      
      {/* Content */}
      <div className="relative z-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-white/80 mt-2">
            Manage the Success Family platform
          </p>
        </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="rounded-lg  bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Total Users</p>
              <p className="text-2xl font-bold text-white mt-2">0</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-lg  bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Community Owners</p>
              <p className="text-2xl font-bold text-white mt-2">0</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-lg  bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Communities</p>
              <p className="text-2xl font-bold text-white mt-2">0</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="rounded-lg  bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Active Sessions</p>
              <p className="text-2xl font-bold text-white mt-2">0</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <Settings className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg  bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button className="group rounded-lg  bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 text-left transition-all hover:bg-white/20 hover:scale-105">
            <h3 className="font-semibold text-white mb-2">
              Manage Users
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                →
              </span>
            </h3>
            <p className="text-sm text-white/80">
              View and manage user accounts
            </p>
          </button>

          <button className="group rounded-lg  bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 text-left transition-all hover:bg-white/20 hover:scale-105">
            <h3 className="font-semibold text-white mb-2">
              Platform Settings
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                →
              </span>
            </h3>
            <p className="text-sm text-white/80">
              Configure platform-wide settings
            </p>
          </button>

          <button className="group rounded-lg  bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 text-left transition-all hover:bg-white/20 hover:scale-105">
            <h3 className="font-semibold text-white mb-2">
              View Reports
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none ml-2">
                →
              </span>
            </h3>
            <p className="text-sm text-white/80">
              Access platform analytics and reports
            </p>
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}