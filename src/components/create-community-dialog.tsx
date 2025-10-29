"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Building2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"

interface CreateCommunityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateCommunityDialog({ open, onOpenChange }: CreateCommunityDialogProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

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
    if (!name.trim()) {
      setError("Community name is required.")
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

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Building2 className="h-4 w-4 text-white/80" />
            Create Community
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-name" className="text-white">Community Name</Label>
            <Input
              id="cc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tech Innovators Network"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cc-desc" className="text-white">Description (optional)</Label>
            <Textarea
              id="cc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your community..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              rows={4}
            />
          </div>
          {error && <p className="text-sm text-white/70">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


