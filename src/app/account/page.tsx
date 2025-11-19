"use client"

import React, { useState, useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { User, Mail, Save, Loader2, Lock, Upload, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react"
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
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

  // Validate username format
  const validateUsernameFormat = (username: string): { valid: boolean; error?: string } => {
    if (!username) {
      return { valid: false, error: 'Username is required' }
    }
    
    // Check length (3-30 characters)
    if (username.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' }
    }
    
    if (username.length > 30) {
      return { valid: false, error: 'Username must be 30 characters or less' }
    }
    
    // Check for leading underscores first (most specific error)
    if (username.startsWith('_')) {
      return { valid: false, error: 'Username cannot start with an underscore' }
    }
    
    // Check for trailing underscores (most specific error)
    if (username.endsWith('_')) {
      return { valid: false, error: 'Username cannot end with an underscore' }
    }
    
    // Check for consecutive underscores
    if (username.includes('__')) {
      return { valid: false, error: 'Username cannot contain consecutive underscores' }
    }
    
    // Check if it starts with a letter
    if (!/^[a-z]/.test(username)) {
      return { valid: false, error: 'Username must start with a letter' }
    }
    
    // Check if it contains only lowercase letters, numbers, and underscores
    if (!/^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$/.test(username)) {
      return { valid: false, error: 'Username can only contain lowercase letters, numbers, and underscores' }
    }
    
    return { valid: true }
  }

  // Normalize username input (convert to lowercase, remove invalid characters)
  // This is less aggressive - allows typing underscores, only removes invalid chars
  const normalizeUsername = (input: string): string => {
    // Convert to lowercase
    let normalized = input.toLowerCase()
    
    // Remove all characters except letters, numbers, and underscores
    normalized = normalized.replace(/[^a-z0-9_]/g, '')
    
    // Remove consecutive underscores (but allow single underscores)
    normalized = normalized.replace(/_{2,}/g, '_')
    
    // Don't remove leading/trailing underscores while typing - let user type freely
    // Validation will catch these on submit
    
    // Limit to 30 characters
    if (normalized.length > 30) {
      normalized = normalized.substring(0, 30)
    }
    
    return normalized
  }

  // Check username availability
  useEffect(() => {
    const checkUsername = async () => {
      if (!userProfile || formData.username === userProfile.username) {
        setUsernameAvailable(null)
        return
      }
      
      // Validate format first
      const formatValidation = validateUsernameFormat(formData.username)
      if (!formatValidation.valid) {
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

  const handleProfilePictureButtonClick = () => {
    if (uploading) return
    fileInputRef.current?.click()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Validate username format
    const formatValidation = validateUsernameFormat(formData.username)
    if (!formatValidation.valid) {
      toast.error(formatValidation.error || "Invalid username format")
      return
    }

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
      <div className="relative w-full overflow-x-hidden">
        <div className="relative z-10 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Account Settings"
          subtitle="Manage your profile and password"
        />

        <div className="space-y-6">
          {/* Profile Header Section */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center gap-6">
                <div className="relative">
                  <Avatar className="h-32 w-32 border-4 border-white/20" userId={user?.id}>
                    <AvatarImage src={formData.profilePicture} alt={formData.username || 'Profile'} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-4xl">
                      {(formData.firstName?.[0] || userProfile?.first_name?.[0] || '')}
                      {(formData.lastName?.[0] || userProfile?.last_name?.[0] || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2">
                    <input
                      id="profile-upload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={handleProfilePictureButtonClick}
                      disabled={uploading}
                      className="h-10 w-10 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20 transition-colors"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">
                    {formData.firstName} {formData.lastName}
                  </h2>
                  <Link 
                    href={`/profile/${formData.username}`}
                    className="group touch-feedback inline-block"
                    prefetch={true}
                  >
                    <p className="text-white/70 text-base group-hover:text-white transition-colors">@{formData.username}</p>
                  </Link>
                  <p className="text-white/50 text-xs mt-2">
                    JPG, PNG, GIF or WebP. Max 5MB
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
            <CardHeader className="pb-6">
              <CardTitle className="text-white flex items-center gap-2 text-xl">
                <User className="h-5 w-5 text-white/70" />
                Personal Information
              </CardTitle>
              <CardDescription className="text-white/60 text-sm mt-2">
                Update your profile details and information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white font-medium">Username</Label>
                <div className="relative">
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => {
                      const normalized = normalizeUsername(e.target.value)
                      setFormData({ ...formData, username: normalized })
                    }}
                    onBlur={(e) => {
                      // On blur, clean up leading/trailing underscores
                      let cleaned = formData.username
                      cleaned = cleaned.replace(/^_+|_+$/g, '')
                      // If it doesn't start with a letter after cleaning, prepend 'user'
                      if (cleaned && !/^[a-z]/.test(cleaned)) {
                        cleaned = 'user' + cleaned
                      }
                      if (cleaned !== formData.username) {
                        setFormData({ ...formData, username: cleaned })
                      }
                    }}
                    placeholder="your_username"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-10"
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="^[a-z][a-z0-9_]*[a-z0-9]$|^[a-z]$"
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
                    {(() => {
                      const formatValidation = validateUsernameFormat(formData.username)
                      if (!formatValidation.valid) {
                        return <span className="text-red-500">{formatValidation.error}</span>
                      }
                      if (checkingUsername) {
                        return <span className="text-white/50">Checking availability...</span>
                      }
                      if (usernameAvailable === true) {
                        return <span className="text-green-500">Username is available</span>
                      }
                      if (usernameAvailable === false) {
                        return <span className="text-red-500">Username is already taken</span>
                      }
                      return <span className="text-white/50">3-30 characters, lowercase letters, numbers, and underscores only</span>
                    })()}
                  </p>
                )}
                {formData.username === userProfile?.username && (
                  <p className="text-xs mt-1 text-white/50">
                    3-30 characters, lowercase letters, numbers, and underscores only
                  </p>
                )}
              </div>

              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-white font-medium">First Name</Label>
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
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-white font-medium">Last Name</Label>
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
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="bio" className="text-white font-medium">Bio</Label>
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
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white font-medium">Email Address</Label>
                <div className="flex items-center gap-2">
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
              <div className="flex justify-end pt-4 mt-6">
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors touch-feedback min-w-[140px]"
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
            <CardHeader className="pb-6">
              <CardTitle className="text-white flex items-center gap-2 text-xl">
                <Lock className="h-5 w-5 text-white/70" />
                Change Password
              </CardTitle>
              <CardDescription className="text-white/60 text-sm mt-2">
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-white font-medium">New Password</Label>
                  <div className="relative">
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors touch-feedback"
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-white/50 text-xs mt-1">Must be at least 6 characters</p>
                </div>

                {/* Confirm New Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white font-medium">Confirm New Password</Label>
                  <div className="relative">
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60 transition-colors touch-feedback"
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4 mt-6">
                  <Button 
                    type="submit" 
                    disabled={passwordSaving || !passwordData.newPassword || !passwordData.confirmPassword}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors touch-feedback min-w-[160px]"
                    size="lg"
                  >
                    {passwordSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Changing...
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
        </div>
      </div>
    </div>
  )
}

