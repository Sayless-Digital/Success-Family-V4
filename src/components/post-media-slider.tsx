"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Mic, Play, Pause, Lock, Video } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { PostMedia, PostAuthorSummary } from "@/types"
import { PostMediaLightbox } from "@/components/post-media-lightbox"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface PostMediaSliderProps {
  media: PostMedia[]
  author?: PostAuthorSummary
  userHasBoosted?: boolean
  authorId?: string
  currentUserId?: string
}

export function PostMediaSlider({ media, author, userHasBoosted = false, authorId, currentUserId }: PostMediaSliderProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)
  const [imageUrls, setImageUrls] = React.useState<Record<string, string>>({})
  const [videoUrls, setVideoUrls] = React.useState<Record<string, string>>({})
  const [audioUrls, setAudioUrls] = React.useState<Record<string, string>>({})
  const [playingAudio, setPlayingAudio] = React.useState<string | null>(null)
  const [playingVideo, setPlayingVideo] = React.useState<string | null>(null)
  const [audioProgress, setAudioProgress] = React.useState<Record<string, { current: number; duration: number }>>({})
  const [lightboxOpen, setLightboxOpen] = React.useState(false)
  const [lightboxIndex, setLightboxIndex] = React.useState(0)
  const audioRefs = React.useRef<Record<string, HTMLAudioElement>>({})
  const videoRefs = React.useRef<Record<string, HTMLVideoElement>>({})

  // Sort media by display_order and separate audio from images
  const sortedMedia = React.useMemo(() => {
    return [...media].sort((a, b) => a.display_order - b.display_order)
  }, [media])

  const voiceNote = React.useMemo(() => {
    return sortedMedia.find(m => m.media_type === 'audio') || null
  }, [sortedMedia])

  // Check if voice note is locked
  const isVoiceNoteLocked = React.useMemo(() => {
    if (!voiceNote || !voiceNote.requires_boost) return false
    // Voice note is accessible if user has boosted or is the author
    const isAuthor = authorId && currentUserId && authorId === currentUserId
    return !userHasBoosted && !isAuthor
  }, [voiceNote, userHasBoosted, authorId, currentUserId])

  const images = React.useMemo(() => {
    return sortedMedia.filter(m => m.media_type === 'image')
  }, [sortedMedia])

  const videos = React.useMemo(() => {
    return sortedMedia.filter(m => m.media_type === 'video')
  }, [sortedMedia])

  // Fetch public URLs for all media
  React.useEffect(() => {
    const fetchUrls = async () => {
      const imgUrls: Record<string, string> = {}
      const vidUrls: Record<string, string> = {}
      const audUrls: Record<string, string> = {}
      
      for (const item of sortedMedia) {
        const { data } = supabase.storage
          .from('post-media')
          .getPublicUrl(item.storage_path)
        
        if (data?.publicUrl) {
          if (item.media_type === 'audio') {
            audUrls[item.id] = data.publicUrl
          } else if (item.media_type === 'video') {
            vidUrls[item.id] = data.publicUrl
          } else {
            imgUrls[item.id] = data.publicUrl
          }
        }
      }
      
      setImageUrls(imgUrls)
      setVideoUrls(vidUrls)
      setAudioUrls(audUrls)
    }

    fetchUrls()
  }, [sortedMedia])

  // Preload audio metadata to get duration immediately
  React.useEffect(() => {
    Object.entries(audioUrls).forEach(([audioId, audioUrl]) => {
      // Only create if it doesn't exist yet
      if (!audioRefs.current[audioId]) {
        const audio = new Audio(audioUrl)
        
        audio.addEventListener('loadedmetadata', () => {
          setAudioProgress(prev => ({
            ...prev,
            [audioId]: {
              current: 0,
              duration: audio.duration || 0
            }
          }))
        })
        
        audio.addEventListener('timeupdate', () => {
          setAudioProgress(prev => ({
            ...prev,
            [audioId]: {
              current: audio.currentTime,
              duration: audio.duration || 0
            }
          }))
        })
        
        audio.addEventListener('ended', () => {
          setPlayingAudio(null)
          setAudioProgress(prev => ({
            ...prev,
            [audioId]: {
              current: 0,
              duration: prev[audioId]?.duration || 0
            }
          }))
        })
        
        audio.addEventListener('pause', () => {
          if (audio.ended) {
            setPlayingAudio(null)
          }
        })
        
        audioRefs.current[audioId] = audio
        // Load metadata immediately to get duration
        audio.load()
      }
    })
  }, [audioUrls])

  const formatAudioTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAudioPlay = (audioId: string) => {
    // Stop any OTHER currently playing audio (not the one we're about to play)
    Object.keys(audioRefs.current).forEach(key => {
      if (key !== audioId) {
        const audio = audioRefs.current[key]
        if (audio && !audio.paused) {
          audio.pause()
          audio.currentTime = 0
        }
      }
    })

    // Get audio element (should already exist from preload)
    const audio = audioRefs.current[audioId]
    if (!audio) return
    
    if (playingAudio === audioId) {
      // Pause if already playing - preserve currentTime
      audio.pause()
      setPlayingAudio(null)
    } else {
      // Play (or resume from where it was paused)
      audio.play()
      setPlayingAudio(audioId)
    }
  }

  React.useEffect(() => {
    // Cleanup audio elements on unmount
    return () => {
      Object.values(audioRefs.current).forEach(audio => {
        audio.pause()
        audio.src = ''
      })
    }
  }, [])

  const updateScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' })
    }
  }

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
  }

  const handleVideoPlay = (videoId: string) => {
    // Stop any OTHER currently playing video
    Object.keys(videoRefs.current).forEach(key => {
      if (key !== videoId) {
        const video = videoRefs.current[key]
        if (video && !video.paused) {
          video.pause()
          video.currentTime = 0
        }
      }
    })

    // Stop any currently playing audio
    Object.keys(audioRefs.current).forEach(key => {
      const audio = audioRefs.current[key]
      if (audio && !audio.paused) {
        audio.pause()
        audio.currentTime = 0
      }
    })
    setPlayingAudio(null)

    const video = videoRefs.current[videoId]
    if (!video) return
    
    if (playingVideo === videoId) {
      video.pause()
      setPlayingVideo(null)
    } else {
      video.play()
      setPlayingVideo(videoId)
    }
  }

  React.useEffect(() => {
    // Cleanup video elements on unmount
    return () => {
      Object.values(videoRefs.current).forEach(video => {
        if (video) {
          video.pause()
          video.src = ''
        }
      })
    }
  }, [])

  React.useEffect(() => {
    updateScrollButtons()
  }, [images, videos])

  const handleImageClick = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  if (sortedMedia.length === 0) return null

  return (
    <>
      <div className="relative mt-3">
      {/* Voice Note - Separate Container Above */}
      {voiceNote && (
        <div className={cn(
          "rounded-lg overflow-hidden border mb-3",
          isVoiceNoteLocked
            ? "bg-white/5 border-white/10 opacity-60"
            : "bg-white/10 border-white/20"
        )}>
          {isVoiceNoteLocked && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg">
              <div className="flex flex-col items-center gap-2 text-white/80">
                <Lock className="h-6 w-6" />
                <span className="text-sm font-medium">Boost to unlock</span>
              </div>
            </div>
          )}
          <div className="p-3 relative overflow-hidden">
            <div className="flex items-center gap-2">
              <div className="font-mono text-sm text-white/80">
                {audioProgress[voiceNote.id]?.duration 
                  ? `${formatAudioTime(audioProgress[voiceNote.id].current || 0)} / ${formatAudioTime(audioProgress[voiceNote.id].duration)}`
                  : `0:00 / —`
                }
              </div>
              <div className="flex-1" />
              {author ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isVoiceNoteLocked) {
                      handleAudioPlay(voiceNote.id)
                    }
                  }}
                  disabled={isVoiceNoteLocked}
                  className={cn(
                    "flex-shrink-0 relative h-10 w-10 cursor-pointer",
                    isVoiceNoteLocked && "opacity-50 cursor-not-allowed"
                  )}
                  style={{ transformOrigin: 'center center' }}
                >
                  <div className="relative h-10 w-10" style={{ transformOrigin: 'center center' }}>
                    <div className={cn(
                      "transition-transform h-10 w-10",
                      playingAudio === voiceNote.id && "animate-spin"
                    )}
                    style={{
                      animationDuration: playingAudio === voiceNote.id ? '2s' : 'none',
                      transformOrigin: 'center center'
                    }}
                    >
                      <Avatar className="h-10 w-10 border-2 border-white/20" userId={author?.id}>
                        <AvatarImage src={author.profile_picture} alt={`${author.first_name} ${author.last_name}`} />
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-sm">
                          {author.first_name[0]}{author.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      {playingAudio === voiceNote.id ? (
                        <Pause className="h-5 w-5 text-white/90 drop-shadow-lg fill-white/90" />
                      ) : (
                        <Play className="h-5 w-5 text-white/90 drop-shadow-lg fill-white/90" />
                      )}
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isVoiceNoteLocked) {
                      handleAudioPlay(voiceNote.id)
                    }
                  }}
                  disabled={isVoiceNoteLocked}
                  className={cn(
                    "flex items-center justify-center p-2 rounded-full border transition-all flex-shrink-0",
                    isVoiceNoteLocked
                      ? "bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                      : "bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30 cursor-pointer"
                  )}
                >
                  {playingAudio === voiceNote.id ? (
                    <Pause className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
                  ) : (
                    <Play className="h-4 w-4 text-white/70 hover:text-white/80 transition-all" />
                  )}
                </button>
              )}
            </div>
            <div 
              className={cn(
                "w-full h-2 bg-white/10 rounded-full mt-2 relative group backdrop-blur-sm overflow-visible",
                !isVoiceNoteLocked && "cursor-pointer"
              )}
              onClick={(e) => {
                if (isVoiceNoteLocked) return
                const audio = audioRefs.current[voiceNote.id]
                if (!audio || !audioProgress[voiceNote.id]?.duration) return
                
                const rect = e.currentTarget.getBoundingClientRect()
                const clickX = e.clientX - rect.left
                const percentage = clickX / rect.width
                const newTime = percentage * audioProgress[voiceNote.id].duration
                
                audio.currentTime = Math.max(0, Math.min(newTime, audio.duration))
                setAudioProgress(prev => ({
                  ...prev,
                  [voiceNote.id]: {
                    current: audio.currentTime,
                    duration: prev[voiceNote.id]?.duration || 0
                  }
                }))
              }}
            >
              <div 
                className="h-full bg-gradient-to-r from-white via-white to-white transition-all duration-100 rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5),0_0_8px_rgba(255,255,255,0.3)] relative"
                style={{ 
                  width: audioProgress[voiceNote.id]?.duration 
                    ? `${(audioProgress[voiceNote.id].current / audioProgress[voiceNote.id].duration) * 100}%`
                    : '0%'
                }}
              >
                <div
                  className={cn(
                    "absolute right-0 top-1/2 w-8 h-8 bg-white/90 blur-lg rounded-full pointer-events-none transition-opacity",
                    playingAudio === voiceNote.id ? "animate-edge-glow opacity-100" : "opacity-0"
                  )}
                  style={{
                    transform: 'translate(50%, -50%)'
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Videos and Images Slider - Below Voice Note */}
      {(images.length > 0 || videos.length > 0) && (
        <div className="relative" style={{ transformOrigin: 'center center' }}>
          {/* Left Navigation Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                scrollLeft()
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
          )}

          {/* Scrollable Container */}
          <div
            ref={scrollContainerRef}
            onScroll={updateScrollButtons}
            className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Render videos first */}
            {videos.map((item) => {
              const originalIndex = sortedMedia.findIndex(m => m.id === item.id)
              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative flex-shrink-0 rounded-lg bg-white/10 border border-white/20 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity aspect-square",
                    "w-[calc((100%-0.5rem)/2)] md:w-[calc((100%-3*0.5rem)/4)]"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleVideoPlay(item.id)
                  }}
                >
                  {videoUrls[item.id] ? (
                    <>
                      <video
                        ref={(el) => {
                          if (el) {
                            videoRefs.current[item.id] = el
                            // Set up event listeners
                            el.addEventListener('play', () => setPlayingVideo(item.id))
                            el.addEventListener('pause', () => {
                              if (el.paused) {
                                setPlayingVideo(null)
                              }
                            })
                            el.addEventListener('ended', () => {
                              setPlayingVideo(null)
                            })
                          }
                        }}
                        src={videoUrls[item.id]}
                        className="w-full h-full object-cover"
                        muted={false}
                        playsInline
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none z-10">
                        {playingVideo === item.id ? (
                          <Pause className="h-8 w-8 text-white/90 drop-shadow-lg fill-white/90" />
                        ) : (
                          <Play className="h-8 w-8 text-white/90 drop-shadow-lg fill-white/90" />
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-black/20">
                      <Video className="h-8 w-8 text-white/50" />
                    </div>
                  )}
                </div>
              )
            })}
            {/* Render images */}
            {images.map((item) => {
              const originalIndex = sortedMedia.findIndex(m => m.id === item.id)
              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative flex-shrink-0 rounded-lg bg-white/10 border border-white/20 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity aspect-square",
                    "w-[calc((100%-0.5rem)/2)] md:w-[calc((100%-3*0.5rem)/4)]"
                  )}
                  onClick={() => handleImageClick(originalIndex)}
                >
                  {imageUrls[item.id] ? (
                    <img
                      src={imageUrls[item.id]}
                      alt={item.file_name}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="animate-pulse bg-white/20 w-full h-full" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right Navigation Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                scrollRight()
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
      )}
      </div>

    <PostMediaLightbox
      media={sortedMedia}
      imageUrls={imageUrls}
      initialIndex={lightboxIndex}
      open={lightboxOpen}
      onOpenChange={setLightboxOpen}
    />
    </>
  )
}