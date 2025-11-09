"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CheckCircle2, ListMusic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { FieldLabel } from "@/components/ui/field-label"
import { InfoTooltip } from "@/components/ui/tooltip"
import type { Community, EventRecording, PlaylistStatus, UploadedVideo } from "@/types"
import { cn } from "@/lib/utils"
import type {
  DialogState,
  PlaylistDialogStep,
  PlaylistFormState,
  PlaylistSourceOption,
} from "@/app/[slug]/playlists/types"
import { formatDate } from "@/app/[slug]/playlists/utils"
import { VideoSelectionGrid } from "@/app/[slug]/playlists/components/video-selection-grid"

interface PlaylistEditorDialogProps {
  community: Community
  dialogState: DialogState
  recordings: EventRecording[]
  uploadedVideos: UploadedVideo[]
  onClose: () => void
  onSaved: () => void
}

function createEmptyFormState(): PlaylistFormState {
  return {
    title: "",
    description: "",
    status: "draft",
    items: [],
  }
}

export function PlaylistEditorDialog({
  community,
  dialogState,
  recordings,
  uploadedVideos,
  onClose,
  onSaved,
}: PlaylistEditorDialogProps) {
  const [dialogStep, setDialogStep] = useState<PlaylistDialogStep>("details")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"recordings" | "uploads">("recordings")
  const [formState, setFormState] = useState<PlaylistFormState>(() => createEmptyFormState())
  const [isSaving, setIsSaving] = useState(false)

  const recordingOptions = useMemo<PlaylistSourceOption[]>(() => {
    return recordings.map((recording) => ({
      id: recording.id,
      sourceType: "recording",
      title:
        recording.title ||
        recording.event?.description ||
        `Recording ${formatDate(recording.created_at)}`,
      description: recording.event?.description || null,
      createdAt: recording.created_at,
      durationSeconds: recording.duration_seconds ?? null,
      fileSizeBytes: recording.file_size_bytes ?? null,
      previewUrl: recording.storage_url || recording.stream_recording_url || null,
    }))
  }, [recordings])

  const uploadOptions = useMemo<PlaylistSourceOption[]>(() => {
    return uploadedVideos.map((video) => ({
      id: video.id,
      sourceType: "upload",
      title: video.title || `Upload ${formatDate(video.created_at)}`,
      description: video.description || null,
      createdAt: video.created_at,
      durationSeconds: video.duration_seconds ?? null,
      fileSizeBytes: video.file_size_bytes ?? null,
      previewUrl: video.storage_url ?? null,
    }))
  }, [uploadedVideos])

  const selectedLookup = useMemo(
    () => new Set(formState.items.map((item) => `${item.sourceType}:${item.id}`)),
    [formState.items],
  )

  const selectionOrderLookup = useMemo(() => {
    const map = new Map<string, number>()
    formState.items.forEach((item, index) => {
      map.set(`${item.sourceType}:${item.id}`, index + 1)
    })
    return map
  }, [formState.items])

  const resetForm = useCallback(() => {
    setFormState(createEmptyFormState())
    setDialogStep("details")
    setSearchQuery("")
    setActiveTab("recordings")
    setIsSaving(false)
  }, [])

  const handleClose = useCallback(() => {
    resetForm()
    onClose()
  }, [onClose, resetForm])

  useEffect(() => {
    if (!dialogState) {
      resetForm()
      return
    }

    setDialogStep("details")
    setSearchQuery("")
    setActiveTab("recordings")

    if (dialogState.mode === "create") {
      setFormState(createEmptyFormState())
      return
    }

    const playlist = dialogState.playlist
    const mappedItems = (playlist.items ?? [])
      .sort((a, b) => a.position - b.position)
      .map((item) => {
        if (item.event_recording) {
          return {
            id: item.event_recording.id,
            sourceType: "recording" as const,
            title:
              item.event_recording.title ||
              item.event_recording.event?.description ||
              `Recording ${formatDate(item.event_recording.created_at)}`,
            description: item.event_recording.description ?? null,
            createdAt: item.event_recording.created_at,
            durationSeconds: item.event_recording.duration_seconds ?? null,
            fileSizeBytes: item.event_recording.file_size_bytes ?? null,
            previewUrl: item.event_recording.storage_url || item.event_recording.stream_recording_url || null,
          }
        }
        if (item.uploaded_video) {
          return {
            id: item.uploaded_video.id,
            sourceType: "upload" as const,
            title: item.uploaded_video.title || `Upload ${formatDate(item.uploaded_video.created_at ?? "")}`,
            description: item.uploaded_video.description ?? null,
            createdAt: item.uploaded_video.created_at ?? undefined,
            durationSeconds: item.uploaded_video.duration_seconds ?? null,
            fileSizeBytes: item.uploaded_video.file_size_bytes ?? null,
            previewUrl: item.uploaded_video.storage_url ?? null,
          }
        }
        return null
      })
      .filter(Boolean) as PlaylistSourceOption[]

    setFormState({
      title: playlist.title,
      description: playlist.description ?? "",
      status: playlist.status,
      items: mappedItems,
    })
  }, [dialogState, resetForm])

  const reorderOptions = useCallback(
    (options: PlaylistSourceOption[]) => {
      const query = searchQuery.trim().toLowerCase()
      return options
        .filter((option) => !query || option.title.toLowerCase().includes(query))
        .sort((a, b) => {
          const aOrder = selectionOrderLookup.get(`${a.sourceType}:${a.id}`)
          const bOrder = selectionOrderLookup.get(`${b.sourceType}:${b.id}`)
          if (aOrder && bOrder) return aOrder - bOrder
          if (aOrder) return -1
          if (bOrder) return 1
          return 0
        })
    },
    [searchQuery, selectionOrderLookup],
  )

  const filteredRecordingOptions = useMemo(
    () => reorderOptions(recordingOptions),
    [recordingOptions, reorderOptions],
  )
  const filteredUploadOptions = useMemo(() => reorderOptions(uploadOptions), [uploadOptions, reorderOptions])

  const handleToggleItem = useCallback((option: PlaylistSourceOption) => {
    setFormState((prev) => {
      const key = `${option.sourceType}:${option.id}`
      const exists = prev.items.some((item) => `${item.sourceType}:${item.id}` === key)
      return {
        ...prev,
        items: exists ? prev.items.filter((item) => `${item.sourceType}:${item.id}` !== key) : [...prev.items, option],
      }
    })
  }, [])

  const goToItemsStep = useCallback(() => {
    if (!formState.title.trim()) {
      toast.error("Add a title before continuing")
      return
    }
    setDialogStep("items")
  }, [formState.title])

  const handleSubmit = useCallback(async () => {
    if (!dialogState) return

    const trimmedTitle = formState.title.trim()
    if (!trimmedTitle) {
      toast.error("Please provide a playlist title")
      setDialogStep("details")
      return
    }

    if (formState.items.length === 0) {
      toast.error("Select at least one recording or upload")
      return
    }

    setIsSaving(true)

    const payload = {
      communityId: community.id,
      title: trimmedTitle,
      description: formState.description.trim() || null,
      status: formState.status,
      items: formState.items.map((item, index) => ({
        sourceType: item.sourceType,
        sourceId: item.id,
        position: index,
      })),
    }

    try {
      if (dialogState.mode === "create") {
        const response = await fetch("/api/playlists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error?.error || "Failed to create playlist")
        }

        toast.success("Playlist created successfully")
      } else {
        const response = await fetch(`/api/playlists/${dialogState.playlist.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error?.error || "Failed to update playlist")
        }

        toast.success("Playlist updated successfully")
      }

      onSaved()
      handleClose()
    } catch (error: unknown) {
      console.error("[Playlists UI] Failed to save playlist:", error)
      if (error instanceof Error) {
        toast.error(error.message || "Failed to save playlist")
      } else {
        toast.error("Failed to save playlist")
      }
      setIsSaving(false)
    } finally {
      setIsSaving(false)
    }
  }, [community.id, dialogState, formState.description, formState.items, formState.status, formState.title, handleClose, onSaved])

  return (
    <Dialog open={!!dialogState} onOpenChange={(open) => (open ? null : handleClose())}>
      <DialogContent
        className={cn(
          "sm:max-w-2xl p-0 h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] sm:h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-4rem)]",
          "[&>div]:flex [&>div]:h-full [&>div]:flex-col [&>div]:overflow-hidden [&>div]:p-0",
        )}
      >
        {dialogStep === "items" ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              setActiveTab(value as "recordings" | "uploads")
              setSearchQuery("")
            }}
            className="flex h-full flex-col overflow-hidden"
          >
            <div className="border-b border-white/20 bg-white/5 px-6 py-5">
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-1 text-center sm:items-start sm:text-left">
                  <Badge className="w-fit bg-white/10 text-white/70">Step 2 of 2 · Choose videos</Badge>
                  <DialogTitle className="flex items-center gap-2 text-white">
                    <ListMusic className="h-5 w-5 text-white/70" />
                    {dialogState?.mode === "edit" ? "Edit playlist" : "Create playlist"}
                    <InfoTooltip content="Pick recordings or uploaded videos to include. You can preview each item before adding it." />
                  </DialogTitle>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={`Search ${activeTab === "recordings" ? "recordings" : "uploads"} by title`}
                    className="w-full border-white/20 bg-white/5 text-white placeholder:text-white/40 sm:max-w-sm"
                  />
                  <TabsList className="grid w-full grid-cols-2 rounded-full border border-white/20 bg-white/5 p-1 sm:w-auto">
                    <TabsTrigger value="recordings" className="rounded-full text-sm">
                      Recordings
                    </TabsTrigger>
                    <TabsTrigger value="uploads" className="rounded-full text-sm">
                      Uploads
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <TabsContent value="recordings" forceMount>
                <VideoSelectionGrid
                  options={filteredRecordingOptions}
                  selectedLookup={selectedLookup}
                  selectionOrderLookup={selectionOrderLookup}
                  onToggle={handleToggleItem}
                  emptyMessage="No recordings match your search."
                />
              </TabsContent>
              <TabsContent value="uploads" forceMount>
                <VideoSelectionGrid
                  options={filteredUploadOptions}
                  selectedLookup={selectedLookup}
                  selectionOrderLookup={selectionOrderLookup}
                  onToggle={handleToggleItem}
                  emptyMessage="No uploads match your search."
                />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="border-b border-white/20 bg-white/5 px-6 py-5">
              <div className="space-y-2 text-center sm:text-left">
                <Badge className="bg-white/10 text-white/70">Step 1 of 2 · Playlist details</Badge>
                <DialogTitle className="flex items-center justify-center gap-2 text-white sm:justify-start">
                  <ListMusic className="h-5 w-5 text-white/70" />
                  {dialogState?.mode === "edit" ? "Edit playlist" : "Create playlist"}
                  <InfoTooltip content="Add a title, description, and status for your playlist to help members understand the content." />
                </DialogTitle>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <FieldLabel
                    htmlFor="playlist-title"
                    label="Title"
                    tooltipContent="Give your playlist a descriptive name that is easy for members to recognize."
                  />
                  <Input
                    id="playlist-title"
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Enter playlist title"
                    className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel
                    htmlFor="playlist-description"
                    label="Description"
                    tooltipContent="Summarize what members can expect to find inside this playlist."
                  />
                  <Textarea
                    id="playlist-description"
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Describe what members can expect"
                    className="min-h-[120px] border-white/20 bg-white/5 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel
                    htmlFor="playlist-status"
                    label="Status"
                    tooltipContent="Draft playlists stay private while you curate items. Published playlists appear to community members."
                  />
                  <Select
                    value={formState.status}
                    onValueChange={(value: PlaylistStatus) =>
                      setFormState((prev) => ({
                        ...prev,
                        status: value,
                      }))
                    }
                  >
                    <SelectTrigger id="playlist-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="border-t border-white/20 bg-white/5 px-6 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
            {dialogStep === "details" ? (
              <Button onClick={goToItemsStep} className="bg-white/10 text-white hover:bg-white/20" disabled={!formState.title.trim()}>
                Next: Choose videos
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSaving || formState.items.length === 0} className="gap-2 bg-white/10 text-white hover:bg-white/20">
                {isSaving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-white/80" />
                    Save playlist
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (dialogStep === "details") {
                  handleClose()
                } else {
                  setDialogStep("details")
                  setSearchQuery("")
                  setActiveTab("recordings")
                }
              }}
              className="sm:w-auto"
            >
              {dialogStep === "details" ? "Cancel" : "Back"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

