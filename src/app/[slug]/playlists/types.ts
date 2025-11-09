import type {
  CommunityPlaylist,
  CommunityPlaylistItem,
  EventRecording,
  PlaylistStatus,
  UploadedVideo,
} from "@/types"

export interface PlaylistWithItems extends CommunityPlaylist {
  items?: Array<
    CommunityPlaylistItem & {
      event_recording?: EventRecording | null
      uploaded_video?: UploadedVideo | null
    }
  >
}

export interface PlaylistSourceOption {
  id: string
  sourceType: "recording" | "upload"
  title: string
  description?: string | null
  createdAt?: string
  durationSeconds?: number | null
  fileSizeBytes?: number | null
  previewUrl?: string | null
}

export type PlaylistDialogStep = "details" | "items"

export type DialogState =
  | { mode: "create" }
  | { mode: "edit"; playlist: PlaylistWithItems }
  | null

export type PlaylistFormState = {
  title: string
  description: string
  status: PlaylistStatus
  items: PlaylistSourceOption[]
}

