"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter, useParams } from "next/navigation"
import { Save, Loader2, Upload, Image as ImageIcon } from "lucide-react"
import { TopUpGuard } from "@/components/topup-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Community } from "@/types"
import { CommunityNavigation } from "@/components/community-navigation"

export default function CommunitySettingsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [autoSaveCount, setAutoSaveCount] = useState(0)
  const autoSaving = autoSaveCount > 0
  const [community, setCommunity] = useState<Community | null>(null)
  
  const logoInputRef = useRef<HTMLInputElement | null>(null)
  const bannerInputRef = useRef<HTMLInputElement | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    logoUrl: "",
    bannerUrl: "",
  })

  const syncCommunityState = useCallback((updated: Community) => {
    setCommunity(updated)
    setFormData({
      name: updated.name || "",
      description: updated.description || "",
      logoUrl: updated.logo_url || "",
      bannerUrl: updated.banner_url || "",
    })
  }, [setCommunity, setFormData])

  const patchCommunitySettings = useCallback(
    async (updates: Partial<{ name: string; description: string | null; logo_url: string | null; banner_url: string | null }>) => {
      if (!community) {
        throw new Error("Community not loaded")
      }

      const response = await fetch(`/api/communities/${community.id}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || "Failed to update community settings")
      }

      const data = await response.json()
      const updatedCommunity = data.community as Community
      syncCommunityState(updatedCommunity)
      return updatedCommunity
    },
    [community, syncCommunityState]
  )

  // Fetch community data
  useEffect(() => {
    const fetchCommunity = async () => {
      if (!slug) return

      try {
        const { data, error } = await supabase
          .from('communities')
          .select('*')
          .eq('slug', slug)
          .single()

        if (error) throw error

        if (data) {
          syncCommunityState(data)
        }
      } catch (error) {
        console.error('Error fetching community:', error)
        toast.error("Failed to load community settings")
      } finally {
        setLoading(false)
      }
    }

    fetchCommunity()
  }, [slug, syncCommunityState])

  // Redirect if not authenticated or not owner
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${slug}`)
    }
    if (community && user && community.owner_id !== user.id) {
      toast.error("Only community owners can access settings")
      router.push(`/${slug}`)
    }
  }, [user, authLoading, community, slug, router])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user || !community) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setUploadingLogo(true)
    const previousLogoUrl = formData.logoUrl
    let uploadSucceeded = false
    let fileName = ""
    let autoSaveIncremented = false
    try {
      const fileExt = file.name.split('.').pop()
      fileName = `${community.id}/${Date.now()}.${fileExt}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('community-logos')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError
      uploadSucceeded = true

      // Get public URL
      const { data } = supabase.storage
        .from('community-logos')
        .getPublicUrl(fileName)

      // Update form data
      setFormData(prev => ({ ...prev, logoUrl: data.publicUrl }))

      setAutoSaveCount(count => count + 1)
      autoSaveIncremented = true
      await patchCommunitySettings({ logo_url: data.publicUrl })
      toast.success("Logo uploaded and saved!")
    } catch (error) {
      console.error('Error uploading logo:', error)
      if (uploadSucceeded && fileName) {
        try {
          await supabase.storage
            .from('community-logos')
            .remove([fileName])
        } catch (removeError) {
          console.error('Error cleaning up failed logo upload:', removeError)
        }
        setFormData(prev => ({ ...prev, logoUrl: previousLogoUrl }))
      }
      toast.error("Failed to upload logo. Please try again.")
    } finally {
      if (autoSaveIncremented) {
        setAutoSaveCount(count => Math.max(0, count - 1))
      }
      setUploadingLogo(false)
    }
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user || !community) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }

    setUploadingBanner(true)
    const previousBannerUrl = formData.bannerUrl
    let uploadSucceeded = false
    let fileName = ""
    let autoSaveIncremented = false
    try {
      const fileExt = file.name.split('.').pop()
      fileName = `${community.id}/${Date.now()}.${fileExt}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('community-banners')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError
      uploadSucceeded = true

      // Get public URL
      const { data } = supabase.storage
        .from('community-banners')
        .getPublicUrl(fileName)

      // Update form data
      setFormData(prev => ({ ...prev, bannerUrl: data.publicUrl }))

      setAutoSaveCount(count => count + 1)
      autoSaveIncremented = true
      await patchCommunitySettings({ banner_url: data.publicUrl })
      toast.success("Banner uploaded and saved!")
    } catch (error) {
      console.error('Error uploading banner:', error)
      if (uploadSucceeded && fileName) {
        try {
          await supabase.storage
            .from('community-banners')
            .remove([fileName])
        } catch (removeError) {
          console.error('Error cleaning up failed banner upload:', removeError)
        }
        setFormData(prev => ({ ...prev, bannerUrl: previousBannerUrl }))
      }
      toast.error("Failed to upload banner. Please try again.")
    } finally {
      if (autoSaveIncremented) {
        setAutoSaveCount(count => Math.max(0, count - 1))
      }
      setUploadingBanner(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !community) return

    if (formData.name.trim().length < 3) {
      toast.error("Community name must be at least 3 characters")
      return
    }

    if (formData.description && formData.description.length > 500) {
      toast.error("Description must be 500 characters or less")
      return
    }

    setSaving(true)
    try {
      const updatedCommunity = await patchCommunitySettings({
        name: formData.name,
        description: formData.description || null,
        logo_url: formData.logoUrl || null,
        banner_url: formData.bannerUrl || null,
      })
      toast.success("Community settings updated successfully!")
      
      // Redirect if slug might have changed
      if (updatedCommunity.slug !== slug) {
        router.push(`/${updatedCommunity.slug}/settings`)
      }
    } catch (error) {
      console.error('Error updating community:', error)
      toast.error("Failed to update community settings. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      </div>
    )
  }

  if (!user || !community) return null

  const isOwner = community.owner_id === user.id

  return (
    <TopUpGuard communitySlug={slug}>
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        <CommunityNavigation
          slug={community.slug}
          isOwner={isOwner}
        />

        {/* Banner Section */}
        <div className="mb-6">
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-white text-lg font-semibold mb-2 block">
                    Community Banner
                  </Label>
                  <div className="relative w-full h-48 bg-white/5 rounded-lg overflow-hidden mb-4">
                    {formData.bannerUrl ? (
                      <img
                        src={formData.bannerUrl}
                        alt="Community Banner"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-white/20" />
                      </div>
                    )}
                  </div>
                  <input
                    id="banner-upload"
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="hidden"
                    disabled={uploadingBanner}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={uploadingBanner}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors touch-feedback"
                  >
                    {uploadingBanner ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Banner
                      </>
                    )}
                  </Button>
                  <p className="text-white/50 text-xs mt-2">
                    Recommended: 1200x300px. JPG, PNG, GIF or WebP. Max 5MB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logo and Information Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Logo Section */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Community Logo
              </CardTitle>
              <CardDescription className="text-white/70">
                Upload a logo for your community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-32 h-32 bg-white/5 rounded-full overflow-hidden">
                  {formData.logoUrl ? (
                    <img
                      src={formData.logoUrl}
                      alt="Community Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-white/20" />
                    </div>
                  )}
                </div>
                <input
                  id="logo-upload"
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploadingLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors touch-feedback"
                >
                  {uploadingLogo ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Logo
                    </>
                  )}
                </Button>
                <p className="text-white/50 text-xs text-center">
                  JPG, PNG, GIF or WebP. Max 5MB
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Community Information */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardHeader>
              <CardTitle className="text-white">Community Information</CardTitle>
              <CardDescription className="text-white/70">
                Update your community details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <Label htmlFor="name" className="text-white">Community Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Community"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    required
                    minLength={3}
                  />
                </div>

                {/* Description */}
                <div>
                  <div className="flex justify-between items-center">
                    <Label htmlFor="description" className="text-white">Description</Label>
                    <span className="text-xs text-white/50">
                      {formData.description.length}/500
                    </span>
                  </div>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Tell people about your community..."
                    rows={4}
                    maxLength={500}
                    className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-1 focus:ring-inset resize-none"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit" 
                    disabled={saving || autoSaving}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors touch-feedback"
                    size="lg"
                  >
                    {saving || autoSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </TopUpGuard>
  )
}