"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Database, HardDrive, FileVideo, Loader2, AlertCircle, CheckCircle2, Plus, ShoppingCart, Minus, Calendar, ChevronRight, ChevronLeft, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserStorage, EventRecording, UploadedVideo } from "@/types"
import { toast } from "sonner"
import Link from "next/link"

interface StorageData {
  storage: UserStorage
  recordings: EventRecording[]
  uploads: UploadedVideo[]
  pricing?: {
    purchasePricePerGb: number
    monthlyCostPerGb: number
  }
}

export default function StoragePage() {
  const { user, isLoading, walletBalance, refreshWalletBalance } = useAuth()
  const router = useRouter()
  const [storageData, setStorageData] = useState<StorageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false)
  const [selectedPurchaseGb, setSelectedPurchaseGb] = useState<number | null>(null)
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false)
  const [downgradeGb, setDowngradeGb] = useState<string>('')
  const [downgrading, setDowngrading] = useState(false)
  const [showScrollIndicator, setShowScrollIndicator] = useState(false)
  const [showBackButton, setShowBackButton] = useState(false)
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  const fetchStorageData = async () => {
    try {
      const response = await fetch('/api/storage')
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.migrationRequired) {
          toast.error('Storage system not initialized. Please apply the database migration.')
          throw new Error('Migration required')
        }
        throw new Error(errorData.error || 'Failed to fetch storage data')
      }
      const data = await response.json()
      setStorageData(data)
    } catch (error: any) {
      console.error('Error fetching storage data:', error)
      if (error.message === 'Migration required') {
        // Don't show toast again, already shown
      } else {
        toast.error(error.message || 'Failed to load storage information')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchStorageData()
    }
  }, [user])

  // Check if there's more content to scroll on mobile
  useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
        setShowScrollIndicator(scrollLeft + clientWidth < scrollWidth - 10) // 10px threshold
        setShowBackButton(scrollLeft > 10) // Show back button if scrolled more than 10px
      }
    }

    checkScroll()
    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
      return () => {
        container.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }
  }, [storageData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStorageData()
  }

  const handlePurchaseClick = (additionalGb: number) => {
    setSelectedPurchaseGb(additionalGb)
    setPurchaseDialogOpen(true)
  }

  const handlePurchaseConfirm = async () => {
    if (!user || !storageData || selectedPurchaseGb === null) return

    const pricePerGb = storageData.pricing?.purchasePricePerGb ?? 10
    const costPoints = selectedPurchaseGb * pricePerGb

    if (walletBalance === null || walletBalance < costPoints) {
      toast.error(`Insufficient points. You need ${costPoints} points to purchase ${selectedPurchaseGb} GB.`)
      setPurchaseDialogOpen(false)
      return
    }

    setPurchasing(true)
    try {
      const response = await fetch('/api/storage/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ additionalGb: selectedPurchaseGb }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to purchase storage')
      }

      const data = await response.json()
      toast.success(`Successfully purchased ${selectedPurchaseGb} GB of storage!`)
      
      // Refresh storage data and wallet balance
      await fetchStorageData()
      await refreshWalletBalance()
      setPurchaseDialogOpen(false)
      setSelectedPurchaseGb(null)
    } catch (error: any) {
      console.error('Error purchasing storage:', error)
      toast.error(error.message || 'Failed to purchase storage. Please try again.')
    } finally {
      setPurchasing(false)
    }
  }

  const handleDowngrade = async () => {
    if (!user || !storageData) return

    const newLimitGb = parseInt(downgradeGb)
    if (isNaN(newLimitGb) || newLimitGb <= 0) {
      toast.error('Please enter a valid storage amount')
      return
    }

    const currentUsageGb = storageData.storage.total_storage_bytes / 1073741824
    if (newLimitGb < currentUsageGb) {
      toast.error(`Cannot decrease below current usage (${currentUsageGb.toFixed(2)} GB)`)
      return
    }

    const currentLimitGb = storageData.storage.storage_limit_bytes / 1073741824
    if (newLimitGb >= currentLimitGb) {
      toast.error('New limit must be less than current limit')
      return
    }

    setDowngrading(true)
    try {
      const response = await fetch('/api/storage/downgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newLimitGb }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to downgrade storage')
      }

      const data = await response.json()
      toast.success('Storage limit decreased. Recurring charges will be reduced.')
      
      // Refresh storage data
      await fetchStorageData()
      setDowngradeDialogOpen(false)
      setDowngradeGb('')
    } catch (error: any) {
      console.error('Error downgrading storage:', error)
      toast.error(error.message || 'Failed to downgrade storage. Please try again.')
    } finally {
      setDowngrading(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (isLoading || loading) {
    return (
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        </div>
      </div>
    )
  }

  if (!user) return null

  // Show error state if migration not applied
  if (!storageData) {
    return (
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10">
          <PageHeader
            title="Storage"
            subtitle="Manage your video storage across all communities"
          />
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-white text-lg font-semibold mb-2">Storage System Not Initialized</h3>
                <p className="text-white/70 mb-4">
                  The database migration for storage tracking needs to be applied.
                </p>
                <p className="text-white/50 text-sm">
                  Please apply the migration file: <code className="bg-white/10 px-2 py-1 rounded">supabase/migrations/20250110_add_user_storage_tracking.sql</code>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { storage, recordings, uploads } = storageData
  const usagePercent = storage.storage_limit_bytes > 0 
    ? Math.min((storage.total_storage_bytes / storage.storage_limit_bytes) * 100, 100)
    : 0
  const isOverLimit = storage.total_storage_bytes > storage.storage_limit_bytes
  const freeBytes = Math.max(0, storage.storage_limit_bytes - storage.total_storage_bytes)
  const usedGB = storage.total_storage_bytes / 1073741824
  const limitGB = storage.storage_limit_bytes / 1073741824
  const hasRecordings = recordings.length > 0
  const hasUploads = uploads.length > 0
  const totalVideos = recordings.length + uploads.length

  return (
    <div className="relative w-full">
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <PageHeader
            title="Storage"
            subtitle="Manage your video storage across all communities"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 self-start sm:self-auto"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Storage Overview Cards */}
        <div className="relative mb-6">
          <div 
            ref={scrollContainerRef}
            className="flex sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto pb-2 sm:pb-0 snap-x snap-mandatory scrollbar-hide"
          >
          {/* Total Storage */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 w-full sm:w-auto sm:min-w-0 flex-shrink-0 snap-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-white/70" />
                Total Storage
              </CardTitle>
            </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold text-white">
              {formatBytes(storage.total_storage_bytes)}
            </div>
            <p className="text-white/60 text-xs sm:text-sm mt-1">
              {usedGB.toFixed(2)} GB used
            </p>
          </CardContent>
          </Card>

          {/* Storage Limit */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 w-full sm:w-auto sm:min-w-0 flex-shrink-0 snap-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-white/70" />
                Storage Limit
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl sm:text-2xl font-bold text-white">
                {formatBytes(storage.storage_limit_bytes)}
              </div>
              <p className="text-white/60 text-xs sm:text-sm mt-1">
                {limitGB.toFixed(2)} GB total
              </p>
            </CardContent>
          </Card>

          {/* Monthly Cost */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 w-full sm:w-auto sm:min-w-0 flex-shrink-0 snap-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-white/70" />
                Monthly Cost
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl sm:text-2xl font-bold text-white">
                {storage.monthly_cost_points} pts
              </div>
              <p className="text-white/60 text-xs sm:text-sm mt-1 break-words">
                {storage.monthly_cost_points > 0 
                  ? `${((storage.total_storage_bytes - 1073741824) / 1073741824).toFixed(2)} GB × ${storageData.pricing?.monthlyCostPerGb ?? 4} pts/GB`
                  : '1 GB free included'
                }
              </p>
              <p className="text-white/50 text-xs mt-1.5 flex items-center gap-1 flex-wrap">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span>Charged on the 1st of each month</span>
              </p>
            </CardContent>
          </Card>
          </div>
          {/* Back Button */}
          {showBackButton && (
            <button
              onClick={() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' })
                }
              }}
              className="absolute -left-2 top-1/2 -translate-y-1/2 sm:hidden w-7 h-7 rounded-full bg-black/40 border-2 border-white/20 backdrop-blur-md flex items-center justify-center hover:bg-black/60 hover:border-white/30 transition-all pointer-events-auto shadow-lg z-10"
              aria-label="Scroll back"
            >
              <ChevronLeft className="h-4 w-4 text-white/90" />
            </button>
          )}
          {/* Forward Button */}
          {showScrollIndicator && (
            <button
              onClick={() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' })
                }
              }}
              className="absolute -right-2 top-1/2 -translate-y-1/2 sm:hidden w-7 h-7 rounded-full bg-black/40 border-2 border-white/20 backdrop-blur-md flex items-center justify-center hover:bg-black/60 hover:border-white/30 transition-all pointer-events-auto shadow-lg z-10"
              aria-label="Scroll to see more"
            >
              <ChevronRight className="h-4 w-4 text-white/90" />
            </button>
          )}
        </div>

        {/* Storage Usage Progress */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 mb-6">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-white text-base sm:text-lg">Storage Usage</CardTitle>
            <CardDescription className="text-white/70 text-xs sm:text-sm">
              {isOverLimit ? (
                <span className="text-red-400">You've exceeded your storage limit</span>
              ) : (
                `${formatBytes(freeBytes)} remaining`
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-xs sm:text-sm">
                <span className="text-white/70">Used: {formatBytes(storage.total_storage_bytes)}</span>
                <span className="text-white/70">Limit: {formatBytes(storage.storage_limit_bytes)}</span>
              </div>
              <div className="relative h-4 w-full rounded-full bg-white/10 p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-white via-white to-white/80 transition-all duration-500 ease-out relative rounded-full shadow-[0_0_4px_rgba(255,255,255,0.4),0_0_8px_rgba(255,255,255,0.2)]"
                  style={{ width: `${usagePercent}%` }}
                >
                  {/* Glowing effect */}
                  <div className="absolute inset-0 bg-white/30 blur-sm animate-pulse rounded-full" />
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer rounded-full" />
                </div>
                {/* Edge glow - positioned outside the overflow container */}
                {usagePercent > 0 && (
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full blur-lg animate-edge-glow pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                    style={{ left: `calc(${usagePercent}% - 5px)` }}
                  />
                )}
              </div>
              {isOverLimit && (
                <div className="flex items-start gap-2 text-red-400 text-xs sm:text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>You cannot create new recordings until you increase your storage limit</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Purchase Additional Storage */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 mb-6">
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
              Purchase Additional Storage
            </CardTitle>
            <CardDescription className="text-white/70 text-xs sm:text-sm">
              Buy more storage space. {storageData.pricing?.purchasePricePerGb ?? 10} points per GB (one-time purchase)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {[5, 10, 20, 50].map((gb) => {
                const pricePerGb = storageData.pricing?.purchasePricePerGb ?? 10
                const cost = gb * pricePerGb
                const canAfford = walletBalance !== null && walletBalance >= cost
                return (
                  <button
                    key={gb}
                    onClick={() => handlePurchaseClick(gb)}
                    disabled={purchasing || !canAfford}
                    className="group relative p-3 sm:p-4 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/20 hover:from-white/15 hover:to-white/10 hover:border-white/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-white/10 disabled:hover:to-white/5 disabled:hover:border-white/20 cursor-pointer overflow-hidden text-left"
                  >
                    {/* Subtle shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors flex-shrink-0">
                          <Plus className="h-3 w-3 sm:h-4 sm:w-4 text-white/90" />
                        </div>
                        <span className="text-white font-bold text-sm sm:text-lg leading-tight">{gb} GB</span>
                      </div>
                      <div className="text-xs sm:text-sm text-white/80 font-medium mb-1">
                        {cost} points
                      </div>
                      {!canAfford && walletBalance !== null && (
                        <div className="text-xs text-red-400/80 mt-auto line-clamp-1">
                          Need {cost - walletBalance} more
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            {walletBalance !== null && (
              <p className="text-xs sm:text-sm text-white/50 mt-3 sm:mt-4">
                Your balance: <span className="text-white/70 font-medium">{Math.trunc(walletBalance)} points</span>
              </p>
            )}
            {storage.storage_limit_bytes > 1073741824 && (
              <div className="pt-3 sm:pt-4 mt-3 sm:mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    const currentLimitGb = Math.floor(storage.storage_limit_bytes / 1073741824)
                    setDowngradeGb(String(currentLimitGb))
                    setDowngradeDialogOpen(true)
                  }}
                  className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10 text-xs sm:text-sm h-9 sm:h-10"
                >
                  <Minus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Decrease Storage Limit
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Videos List */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileVideo className="h-5 w-5" />
              Your Videos
            </CardTitle>
            <CardDescription className="text-white/70">
              {totalVideos} {totalVideos === 1 ? 'video' : 'videos'} totaling {formatBytes(storage.total_storage_bytes)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={hasRecordings ? "recordings" : "uploads"} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 border border-white/20 bg-white/5 text-white/70">
                <TabsTrigger
                  value="recordings"
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  Recordings
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] leading-none text-white/70">
                    {recordings.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="uploads"
                  className="flex items-center justify-center gap-2 px-4 py-2 text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  Uploads
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] leading-none text-white/70">
                    {uploads.length}
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="recordings" className="space-y-3 focus-visible:outline-none focus-visible:ring-0">
                {hasRecordings ? (
                  recordings.map((recording) => (
                    <div
                      key={recording.id}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <FileVideo className="h-4 w-4 flex-shrink-0 text-white/70" />
                          <p className="truncate text-white font-medium">
                            {recording.title || recording.event?.description || 'Untitled Recording'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-white/60">
                          {recording.event?.community && (
                            <Link
                              href={`/${recording.event.community.slug}/videos`}
                              className="max-w-[150px] truncate transition-colors hover:text-white sm:max-w-none"
                              prefetch={true}
                            >
                              {recording.event.community.name}
                            </Link>
                          )}
                          <span className="whitespace-nowrap">{formatDate(recording.created_at)}</span>
                          <span className="whitespace-nowrap font-medium text-white/80">
                            {formatBytes(recording.file_size_bytes || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
                    <FileVideo className="mx-auto mb-3 h-12 w-12 text-white/40" />
                    <p className="text-white/60">No recordings yet</p>
                    <p className="mt-1 text-sm text-white/40">Stream recordings you save will appear here.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="uploads" className="space-y-3 focus-visible:outline-none focus-visible:ring-0">
                {hasUploads ? (
                  uploads.map((video) => (
                    <div
                      key={video.id}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <Upload className="h-4 w-4 flex-shrink-0 text-white/70" />
                          <p className="truncate text-white font-medium">
                            {video.title || 'Untitled Upload'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-white/60">
                          {video.community?.slug && (
                            <Link
                              href={`/${video.community.slug}/videos`}
                              className="max-w-[150px] truncate transition-colors hover:text-white sm:max-w-none"
                              prefetch={true}
                            >
                              {video.community.name}
                            </Link>
                          )}
                          <span className="whitespace-nowrap">{formatDate(video.created_at)}</span>
                          <span className="whitespace-nowrap font-medium text-white/80">
                            {formatBytes(video.file_size_bytes || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
                    <Upload className="mx-auto mb-3 h-12 w-12 text-white/40" />
                    <p className="text-white/60">No uploaded videos yet</p>
                    <p className="mt-1 text-sm text-white/40">Videos you upload manually will appear here.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Purchase Confirmation Dialog */}
        <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Storage Purchase</DialogTitle>
              <DialogDescription className="text-white/70">
                Review your storage purchase details
              </DialogDescription>
            </DialogHeader>
            {selectedPurchaseGb !== null && storageData && (
              <div className="space-y-4 mb-6">
                <div className="space-y-2">
                  <p className="text-white/90 text-center">
                    You are purchasing <span className="font-semibold text-white">+{selectedPurchaseGb} GB</span> of storage.
                  </p>
                  <div className="bg-white/5 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-white/80 text-sm">
                      <span>One-time purchase:</span>
                      <span className="font-semibold text-white">
                        {(selectedPurchaseGb * (storageData.pricing?.purchasePricePerGb ?? 10))} points
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-white/80 text-sm">
                      <span>Monthly recurring cost:</span>
                      <span className="font-semibold text-white">
                        {Math.max(0, Math.ceil(((storage.total_storage_bytes + (selectedPurchaseGb * 1073741824) - 1073741824) / 1073741824) * (storageData.pricing?.monthlyCostPerGb ?? 4)))} points/month
                      </span>
                    </div>
                    <div className="pt-2 sm:pt-3 border-t border-white/10">
                      <p className="text-xs text-white/60 leading-relaxed">
                        <strong className="text-white/80">Important:</strong> The one-time purchase is non-refundable. 
                        You will be charged the monthly recurring fee on the 1st of each month for storage over 1 GB.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setPurchaseDialogOpen(false)
                  setSelectedPurchaseGb(null)
                }}
                disabled={purchasing}
                className="bg-white/5 border-white/20 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchaseConfirm}
                disabled={purchasing}
                className="bg-white/10 text-white hover:bg-white/20 w-full sm:w-auto"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Purchase'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Downgrade Storage Dialog */}
        <Dialog open={downgradeDialogOpen} onOpenChange={setDowngradeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decrease Storage Limit</DialogTitle>
              <DialogDescription className="text-white/70">
                Reduce your storage limit to lower monthly charges
              </DialogDescription>
            </DialogHeader>
            {storageData && (
              <div className="space-y-4 mb-6">
                <div className="bg-white/5 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-white/80 text-sm">
                    <span>Current limit:</span>
                    <span className="font-semibold text-white">
                      {(storage.storage_limit_bytes / 1073741824).toFixed(2)} GB
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-white/80 text-sm">
                    <span>Current usage:</span>
                    <span className="font-semibold text-white">
                      {(storage.total_storage_bytes / 1073741824).toFixed(2)} GB
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-white/80 text-sm">
                    <span>Minimum limit:</span>
                    <span className="font-semibold text-white">
                      {Math.max(1, (storage.total_storage_bytes / 1073741824)).toFixed(2)} GB
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="downgrade-gb" className="text-white/80">
                    New storage limit (GB)
                  </Label>
                  <div className="relative flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseInt(downgradeGb) || Math.max(1, Math.ceil(storage.total_storage_bytes / 1073741824))
                        const min = Math.max(1, Math.ceil(storage.total_storage_bytes / 1073741824))
                        if (current > min) {
                          setDowngradeGb(String(current - 1))
                        }
                      }}
                      disabled={!downgradeGb || parseInt(downgradeGb) <= Math.max(1, Math.ceil(storage.total_storage_bytes / 1073741824))}
                      className="w-9 h-10 rounded-md bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                      aria-label="Decrease"
                    >
                      <Minus className="h-4 w-4 text-white/90" />
                    </button>
                    <Input
                      id="downgrade-gb"
                      type="number"
                      min={Math.max(1, Math.ceil(storage.total_storage_bytes / 1073741824))}
                      max={Math.floor(storage.storage_limit_bytes / 1073741824) - 1}
                      value={downgradeGb}
                      onChange={(e) => setDowngradeGb(e.target.value)}
                      className="bg-white/5 border-white/20 text-white [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] flex-1"
                      placeholder={`Min: ${Math.max(1, Math.ceil(storage.total_storage_bytes / 1073741824))} GB`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const current = parseInt(downgradeGb) || Math.max(1, Math.ceil(storage.total_storage_bytes / 1073741824))
                        const max = Math.floor(storage.storage_limit_bytes / 1073741824) - 1
                        if (current < max) {
                          setDowngradeGb(String(current + 1))
                        }
                      }}
                      disabled={!downgradeGb || parseInt(downgradeGb) >= Math.floor(storage.storage_limit_bytes / 1073741824) - 1}
                      className="w-9 h-10 rounded-md bg-white/10 border border-white/20 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
                      aria-label="Increase"
                    >
                      <Plus className="h-4 w-4 text-white/90" />
                    </button>
                  </div>
                  <div className="pt-2 sm:pt-3 border-t border-white/10">
                    <p className="text-xs text-white/60 leading-relaxed">
                      <strong className="text-white/80">Note:</strong> You cannot decrease below your current usage. 
                      The one-time purchase amount is non-refundable. This will only reduce your monthly recurring charges.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="mt-6 gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => {
                  setDowngradeDialogOpen(false)
                  setDowngradeGb('')
                }}
                disabled={downgrading}
                className="bg-white/5 border-white/20 text-white hover:bg-white/10 w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDowngrade}
                disabled={downgrading}
                className="bg-white/10 text-white hover:bg-white/20 w-full sm:w-auto"
              >
                {downgrading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Decrease Limit'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

