"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import Plyr from "plyr-react"
import "plyr/dist/plyr.css"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDate } from "@/app/[slug]/playlists/utils"

type CarouselSourceType = "recording" | "upload"

export interface CarouselItem {
  id: string | number
  title: string
  type: "Recording" | "Upload"
  sourceType: CarouselSourceType
  sourceId: string
  storagePath?: string | null
  fallbackUrl?: string | null
  createdAt: string | null
  description: string | null
  communityId: string
}

interface PlaylistMediaCarouselProps {
  playlistId: string
  items: CarouselItem[]
  className?: string
}

interface PlaybackState {
  src: string | null
  expiresAt: number | null
  loading: boolean
  error: string | null
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60

export function PlaylistMediaCarousel({ playlistId, items, className }: PlaylistMediaCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemWidthRef = useRef<number>(320)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollButtons = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    setCanScrollLeft(scrollLeft > 8)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8)
  }, [])

  useEffect(() => {
    updateScrollButtons()
  }, [items, updateScrollButtons])

  const handleScroll = useCallback(() => {
    updateScrollButtons()
  }, [updateScrollButtons])

  const scrollByAmount = useCallback((direction: "left" | "right") => {
    const container = scrollRef.current
    if (!container) return
    const firstChild = container.firstElementChild as HTMLElement | null
    const gapValue = getComputedStyle(container).columnGap || getComputedStyle(container).gap || "16px"
    const gap = parseFloat(gapValue)
    const width = firstChild ? firstChild.getBoundingClientRect().width : itemWidthRef.current
    itemWidthRef.current = width
    const delta = direction === "left" ? -(width + gap) : width + gap
    container.scrollBy({ left: delta, behavior: "smooth" })
  }, [])

  if (items.length === 0) {
    return null
  }

  return (
    <div className={cn("relative w-full", className)}>
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount("left")}
          className="absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition hover:bg-black/80 sm:flex cursor-pointer"
          aria-label="Scroll videos left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount("right")}
          className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition hover:bg-black/80 sm:flex cursor-pointer"
          aria-label="Scroll videos right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-color:transparent transparent] [scrollbar-width:none]"
        style={{ msOverflowStyle: "none" }}
      >
        {items.map((item, index) => {
          const position = index + 1
          const displayNumber = position < 10 ? `0${position}` : String(position)

          return (
            <div
              key={item.id}
              className="group relative flex w-[240px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-white/5/70 shadow-lg transition hover:border-white/30 hover:shadow-white/10 sm:w-[280px] md:w-[320px]"
            >
              <span className="pointer-events-none absolute left-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/60 text-xs font-semibold text-white/80 backdrop-blur">
                {displayNumber}
              </span>
              <SecureVideoCard playlistId={playlistId} communityId={item.communityId} item={item} />

              <div className="space-y-3 px-5 py-4">
                <div className="space-y-2">
                  <p className="line-clamp-1 text-sm font-semibold text-white">{item.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-white/60">
                    <Badge className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-white/80">
                      {item.type}
                    </Badge>
                    {item.createdAt ? <span>{formatDate(item.createdAt)}</span> : null}
                  </div>
                </div>
                {item.description ? (
                  <p className="line-clamp-2 text-xs text-white/65">{item.description}</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface SecureVideoCardProps {
  playlistId?: string
  communityId: string
  item: CarouselItem
}

export function SecureVideoCard({ playlistId, communityId, item }: SecureVideoCardProps) {
  const stateRef = useRef<PlaybackState>({
    src: null,
    expiresAt: null,
    loading: false,
    error: null,
  })
  const [playback, setPlayback] = useState<PlaybackState>(stateRef.current)
  const refreshTimerRef = useRef<number | null>(null)

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    stateRef.current = playback
  }, [playback])

  const ensureSource = useCallback(
    async (force = false) => {
      const current = stateRef.current
      if (current.loading) return

      if (
        !force &&
        current.src &&
        current.expiresAt &&
        Date.now() < current.expiresAt - 5000
      ) {
        return
      }

      if (!item.storagePath) {
        clearRefreshTimer()
        const next: PlaybackState = item.fallbackUrl
          ? { src: item.fallbackUrl, expiresAt: null, loading: false, error: null }
          : { src: null, expiresAt: null, loading: false, error: "Video unavailable" }
        stateRef.current = next
        setPlayback(next)
        return
      }

      try {
        const loadingState: PlaybackState = {
          src: current.src,
          expiresAt: current.expiresAt,
          loading: true,
          error: null,
        }
        stateRef.current = loadingState
        setPlayback(loadingState)

        const response = await fetch("/api/storage/signed-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playlistId,
            communityId,
            sourceType: item.sourceType,
            sourceId: item.sourceId,
          }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error || "Failed to load video")
        }

        const data = (await response.json()) as { signedUrl?: string; expiresIn?: number }
        if (!data?.signedUrl) {
          throw new Error("Signed URL missing")
        }

        const ttlSeconds = Math.max(5, data.expiresIn ?? DEFAULT_SIGNED_URL_TTL_SECONDS)
        const expiresAt = Date.now() + ttlSeconds * 1000

        const next: PlaybackState = {
          src: data.signedUrl,
          expiresAt,
          loading: false,
          error: null,
        }

        stateRef.current = next
        setPlayback(next)

        clearRefreshTimer()
        refreshTimerRef.current = window.setTimeout(() => {
          ensureSource(true).catch(() => undefined)
        }, Math.max(0, expiresAt - Date.now() - 5000))
      } catch (error) {
        console.error("[SecureVideoCard]", error)
        clearRefreshTimer()
        const message = error instanceof Error ? error.message : "Unable to prepare video"
        const next: PlaybackState = {
          src: current.src,
          expiresAt: current.expiresAt,
          loading: false,
          error: message,
        }
        stateRef.current = next
        setPlayback(next)
        toast.error(message)
      }
    },
    [clearRefreshTimer, communityId, item.fallbackUrl, item.sourceId, item.sourceType, item.storagePath, playlistId],
  )

  useEffect(() => {
    ensureSource(false).catch(() => undefined)
    return () => {
      clearRefreshTimer()
    }
  }, [ensureSource, clearRefreshTimer])

  const handleRetry = useCallback(() => {
    clearRefreshTimer()
    const next: PlaybackState = { src: null, expiresAt: null, loading: false, error: null }
    stateRef.current = next
    setPlayback(next)
    ensureSource(true).catch(() => undefined)
  }, [clearRefreshTimer, ensureSource])

  const plyrSource = useMemo(() => {
    if (!playback.src) {
      return { type: "video", sources: [] }
    }
    return {
      type: "video",
      sources: [
        {
          src: playback.src,
          type: detectMime(playback.src) ?? "video/mp4",
        },
      ],
    }
  }, [playback.src])

  const plyrOptions = useMemo(
    () => ({
      controls: ["play", "progress", "current-time", "mute", "volume", "fullscreen"],
      clickToPlay: true,
      tooltips: { controls: true, seek: true },
      keyboard: { focused: true, global: false },
    }),
    [],
  )

  const playerStyles = useMemo(
    () => ({
      "--plyr-color-main": "hsl(var(--primary))",
    }) as CSSProperties,
    [],
  )

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-black"
      onContextMenu={(evt) => evt.preventDefault()}
      style={playerStyles}
    >
      <Plyr source={plyrSource} options={plyrOptions} />

      {playback.loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
          <Loader2 className="h-6 w-6 animate-spin text-white/80" />
        </div>
      ) : null}

      {!playback.loading && !playback.src ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white/70">
          <p className="text-sm font-medium">{playback.error ?? "Video unavailable"}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-full border border-white/25 px-4 py-2 text-xs uppercase tracking-wide text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  )
}

function detectMime(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const lower = url.toLowerCase()
  if (lower.endsWith(".mp4")) return "video/mp4"
  if (lower.endsWith(".webm")) return "video/webm"
  if (lower.endsWith(".ogv") || lower.endsWith(".ogg")) return "video/ogg"
  return undefined
}

