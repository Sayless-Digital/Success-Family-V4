"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { PostMedia } from "@/types"
import { PostMediaLightbox } from "@/components/post-media-lightbox"

interface PostMediaSliderProps {
  media: PostMedia[]
}

export function PostMediaSlider({ media }: PostMediaSliderProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = React.useState(false)
  const [canScrollRight, setCanScrollRight] = React.useState(false)
  const [imageUrls, setImageUrls] = React.useState<Record<string, string>>({})
  const [lightboxOpen, setLightboxOpen] = React.useState(false)
  const [lightboxIndex, setLightboxIndex] = React.useState(0)

  // Sort media by display_order
  const sortedMedia = React.useMemo(() => {
    return [...media].sort((a, b) => a.display_order - b.display_order)
  }, [media])

  // Fetch public URLs for all images
  React.useEffect(() => {
    const fetchUrls = async () => {
      const urls: Record<string, string> = {}
      
      for (const item of sortedMedia) {
        const { data } = supabase.storage
          .from('post-media')
          .getPublicUrl(item.storage_path)
        
        if (data?.publicUrl) {
          urls[item.id] = data.publicUrl
        }
      }
      
      setImageUrls(urls)
    }

    fetchUrls()
  }, [sortedMedia])

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

  React.useEffect(() => {
    updateScrollButtons()
  }, [sortedMedia])

  const handleImageClick = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  if (sortedMedia.length === 0) return null

  return (
    <>
      <div className="relative mt-3">
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
        {sortedMedia.map((item, index) => (
          <div
            key={item.id}
            className="relative flex-shrink-0 rounded-lg overflow-hidden bg-white/10 border border-white/20 w-[calc((100%-0.5rem)/2)] md:w-[calc((100%-3*0.5rem)/4)] cursor-pointer hover:opacity-90 transition-opacity"
            style={{ 
              aspectRatio: '1 / 1'
            }}
            onClick={() => handleImageClick(index)}
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
        ))}
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