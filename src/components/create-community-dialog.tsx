"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { useTopupCheck } from "@/hooks/use-topup-check"
import { cn } from "@/lib/utils"

interface CreateCommunityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500

export function CreateCommunityDialog({ open, onOpenChange }: CreateCommunityDialogProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { needsTopup } = useTopupCheck()
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const nameLength = name.length
  const descriptionLength = description.length
  const isNameValid = name.trim().length > 0 && nameLength <= MAX_NAME_LENGTH
  const isDescriptionValid = descriptionLength <= MAX_DESCRIPTION_LENGTH

  const reset = () => {
    setName("")
    setDescription("")
    setError(null)
  }

  const handleCreate = async () => {
    if (!user) {
      setError("Please sign in to create a community.")
      return
    }
    
    // Check if user needs to top up
    if (needsTopup) {
      onOpenChange(false)
      const returnUrl = encodeURIComponent('/communities')
      router.push(`/topup?returnUrl=${returnUrl}`)
      return
    }
    
    if (!name.trim()) {
      setError("Community name is required.")
      return
    }

    if (nameLength > MAX_NAME_LENGTH) {
      setError(`Community name must be ${MAX_NAME_LENGTH} characters or less.`)
      return
    }

    if (descriptionLength > MAX_DESCRIPTION_LENGTH) {
      setError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`)
      return
    }

    setSubmitting(true)
    setError(null)
    
    console.log('[CreateCommunity] Starting creation for:', name)
    console.log('[CreateCommunity] User ID:', user.id)
    
    try {
      // Generate slug via RPC
      console.log('[CreateCommunity] Generating slug...')
      const { data: slugData, error: slugError } = await supabase.rpc('generate_community_slug', { community_name: name })
      
      if (slugError) {
        console.error('[CreateCommunity] Slug generation error:', slugError)
        throw slugError
      }
      
      const slug = String(slugData)
      console.log('[CreateCommunity] Generated slug:', slug)

      // Insert community; mark active since there's no payment step
      console.log('[CreateCommunity] Inserting community...')
      const { data, error: insertError } = await supabase
        .from('communities')
        .insert([
          {
            name: name.trim(),
            slug,
            description: description.trim() || null,
            owner_id: user.id,
            is_active: true,
          },
        ])
        .select('slug')
        .single()

      if (insertError) {
        console.error('[CreateCommunity] Insert error:', insertError)
        throw insertError
      }

      console.log('[CreateCommunity] Community created successfully:', data)
      reset()
      onOpenChange(false)
      router.push(`/${data.slug}`)
      router.refresh()
    } catch (e: any) {
      console.error('[CreateCommunity] Error:', e)
      setError(e?.message || 'Failed to create community')
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (isNameValid && isDescriptionValid && !submitting) {
        handleCreate()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">
            Create New Community
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Community Name Field */}
          <div className="space-y-2">
            <Label htmlFor="cc-name" className="text-white/90 font-medium">
              Community Name
            </Label>
            <Input
              id="cc-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g., Tech Innovators Network"
              className={cn(
                "bg-white/5 border-white/20 text-white placeholder:text-white/40",
                "focus-visible:border-white/40 focus-visible:ring-white/20",
                nameLength > 0 && !isNameValid && "border-red-500/50 focus-visible:border-red-500/50"
              )}
              disabled={submitting}
              maxLength={MAX_NAME_LENGTH}
            />
            {nameLength > 0 && (
              <p className="text-xs text-white/40 text-right">
                {nameLength}/{MAX_NAME_LENGTH}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="cc-desc" className="text-white/90 font-medium">
              Description <span className="text-white/40 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="cc-desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setError(null)
              }}
              onKeyDown={handleKeyDown}
              placeholder="What makes your community special?"
              className={cn(
                "bg-white/5 border-white/20 text-white placeholder:text-white/40",
                "focus-visible:border-white/40 focus-visible:ring-white/20",
                "resize-none",
                descriptionLength > 0 && !isDescriptionValid && "border-red-500/50 focus-visible:border-red-500/50"
              )}
              rows={4}
              disabled={submitting}
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
            {descriptionLength > 0 && (
              <p className="text-xs text-white/40 text-right">
                {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-200 flex-1">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="border-white/20 text-white hover:bg-white/10 hover:border-white/30"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={submitting || !isNameValid || !isDescriptionValid}
              className="min-w-[120px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Community"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

