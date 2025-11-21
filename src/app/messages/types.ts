export type ViewerProfile = {
  id: string
  username: string | null
  first_name: string | null
  last_name: string | null
  profile_picture: string | null
}

export type AttachmentState = {
  id: string
  fileName: string
  mediaType: "image" | "audio" | "file" | "video"
  status: "uploading" | "ready" | "error"
  previewUrl?: string
  storagePath?: string
  objectPath?: string
  mimeType?: string
  fileSize?: number
  durationSeconds?: number
  error?: string
}

export type ThreadPaginationState = Record<string, { hasMore: boolean; nextCursor: string | null }>


