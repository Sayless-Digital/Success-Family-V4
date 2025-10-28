"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { User, Mail, Save, Loader2, Lock, Upload, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PageHeader } from "@/components/ui/page-header"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

export default function AccountPage() {
  const { user, userProfile, isLoading, refreshProfile } = useAuth()
  const router = useRouter()
  const colorStops = useAuroraColors()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })
  
  // Form state
  const [formData, setFormData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    bio: "",
    profilePicture: "",
  })

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (userProfile) {
      setFormData({
        username: userProfile.username || "",
        firstName: userProfile.first_name || "",
        lastName: userProfile.last_name || "",
        bio: userProfile.bio || "",
        profilePicture: userProfile.profile_picture || "",
      })
    }
  }, [userProfile])

  // Check username availability
  useEffect(() => {
    const checkUsername = async () => {
      if (!userProfile || formData.username === userProfile.username) {
        setUsernameAvailable(null)
        return
      }
      
      if (formData.username.length < 3) {
        setUsernameAvailable(null)
        return
      }

      setCheckingUsername(true)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', formData.username)
          .single()

        setUsernameAvailable(!data && error?.code === 'PGRST116')
      } catch {
        setUsernameAvailable(false)
      } finally {
        setCheckingUsername(false)
      }
    }

    const timeoutId = setTimeout(checkUsername, 300)
    return () => clearTimeout(timeoutId)
  }, [formData.username, userProfile])

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

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

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath)

      // Update form data and save
      const updatedFormData = { ...formData, profilePicture: data.publicUrl }
      setFormData(updatedFormData)

      // Save to database
      const { error: dbError } = await supabase
        .from('users')
        .update({ profile_picture: data.publicUrl })
        .eq('id', user.id)

      if (dbError) throw dbError

      await refreshProfile()
      toast.success("Profile picture updated successfully!")
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      toast.error("Failed to upload profile picture. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Check username availability
    if (formData.username !== userProfile?.username && usernameAvailable === false) {
      toast.error("Username is not available. Please choose another one.")
      return
    }

    if (formData.bio && formData.bio.length > 500) {
      toast.error("Bio must be 500 characters or less")
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          username: formData.username,
          first_name: formData.firstName,
          last_name: formData.lastName,
          bio: formData.bio || null,
          profile_picture: formData.profilePicture || null,
        })
        .eq('id', user.id)

      if (error) throw error

      // Refresh user profile
      await refreshProfile()
      toast.success("Profile updated successfully!")
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error("Failed to update profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setPasswordSaving(true)
    try {
      // Update password using Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      // Clear password fields
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })

      toast.success("Password changed successfully!")
    } catch (error: any) {
      console.error('Error changing password:', error)
      toast.error(error.message || "Failed to change password. Please try again.")
    } finally {
      setPasswordSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
        <div className="fixed inset-0 z-0 overflow-hidden">
          <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.3} />
        </div>
        <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
      {/* Aurora Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
      </div>
      
      <div className="relative z-10">
        <PageHeader
          title="Account Settings"
          subtitle="Manage your account information and preferences"
        />

        {/* Profile Picture Section - Prominent Display */}
        <div className="mb-6">
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-white/20">
                  <AvatarImage src={formData.profilePicture} alt={formData.username || 'Profile'} />
                  <AvatarFallback className="bg-white/10 text-white text-3xl sm:text-4xl">
                    {(formData.firstName?.[0] || userProfile?.first_name?.[0] || '')}
                    {(formData.lastName?.[0] || userProfile?.last_name?.[0] || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 w-full sm:w-auto">
                  <h3 className="text-white text-lg sm:text-xl font-semibold mb-1">
                    {formData.firstName} {formData.lastName}
                  </h3>
                  <Link 
                    href={`/profile/${formData.username}`}
                    className="group"
                  >
                    <p className="text-white/60 text-sm mb-4 group-hover:text-primary/80 transition-colors">@{formData.username}</p>
                  </Link>
                  <div>
                    <input
                      id="profile-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <label htmlFor="profile-upload">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        className="w-full sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors cursor-pointer"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Change Photo
                          </>
                        )}
                      </Button>
                    </label>
                  </div>
                  <p className="text-white/50 text-xs mt-2">
                    JPG, PNG, GIF or WebP. Max 5MB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription className="text-white/70">
                Update your profile details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <Label htmlFor="username" className="text-white">Username</Label>
                <div className="relative">
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="your_username"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-10"
                    required
                    minLength={3}
                  />
                  {formData.username && formData.username !== userProfile?.username && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {checkingUsername ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                      ) : usernameAvailable === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : usernameAvailable === false ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : null}
                    </div>
                  )}
                </div>
                {formData.username && formData.username !== userProfile?.username && (
                  <p className="text-xs mt-1">
                    {checkingUsername ? (
                      <span className="text-white/50">Checking availability...</span>
                    ) : usernameAvailable === true ? (
                      <span className="text-green-500">Username is available</span>
                    ) : usernameAvailable === false ? (
                      <span className="text-red-500">Username is already taken</span>
                    ) : (
                      <span className="text-white/50">Username must be at least 3 characters</span>
                    )}
                  </p>
                )}
              </div>

              {/* First Name */}
              <div>
                <Label htmlFor="firstName" className="text-white">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  required
                />
              </div>

              {/* Last Name */}
              <div>
                <Label htmlFor="lastName" className="text-white">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  required
                />
              </div>

              {/* Bio */}
              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="bio" className="text-white">Bio</Label>
                  <span className="text-xs text-white/50">
                    {formData.bio.length}/500
                  </span>
                </div>
                <textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  maxLength={500}
                  className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-1 focus:ring-inset resize-none"
                />
              </div>

              {/* Email (Read-only) */}
              <div>
                <Label htmlFor="email" className="text-white">Email Address</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Mail className="h-4 w-4 text-white/40 flex-shrink-0" />
                  <Input
                    id="email"
                    type="email"
                    value={user.email || ""}
                    disabled
                    className="bg-white/5 border-white/20 text-white/60 cursor-not-allowed"
                  />
                </div>
                <p className="text-white/50 text-xs mt-1">Email cannot be changed</p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  size="lg"
                >
                  {saving ? (
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

          {/* Password Change */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription className="text-white/70">
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* New Password */}
                <div>
                  <Label htmlFor="newPassword" className="text-white">New Password</Label>
                  <div className="relative mt-2">
                    <Input
                      id="newPassword"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-10"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-white/50 text-xs mt-1">Must be at least 6 characters</p>
                </div>

                {/* Confirm New Password */}
                <div>
                  <Label htmlFor="confirmPassword" className="text-white">Confirm New Password</Label>
                  <div className="relative mt-2">
                    <Input
                      id="confirmPassword"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors"
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit" 
                    disabled={passwordSaving || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    size="lg"
                  >
                    {passwordSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing Password...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Change Password
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Account Info */}
        <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 mt-6">
          <CardHeader>
            <CardTitle className="text-white">Account Information</CardTitle>
            <CardDescription className="text-white/70">Details about your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-white/70 text-sm mb-1">Account Created</p>
                <p className="text-white text-lg font-medium">
                  {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-white/70 text-sm mb-1">Role</p>
                <p className="text-white text-lg font-medium capitalize">{userProfile?.role || 'user'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

