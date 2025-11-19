"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  Smile,
  Star,
  Hand,
  Box,
  Heart,
  Activity,
  Utensils,
  Car,
  Flag as FlagIcon,
  UserRound,
  PawPrint,
  Search,
  X
} from "lucide-react"
import { getEmojiCategories, getAllEmojisWithMetadata } from "@/lib/emoji-data"

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  disabled?: boolean
}

const emojiCategories = getEmojiCategories()
const allEmojisWithMetadata = getAllEmojisWithMetadata()

const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "frequently-used": Star,
  "smileys-people": Smile,
  "gestures": Hand,
  "people": UserRound,
  "animals-nature": PawPrint,
  "food-drink": Utensils,
  "activities": Activity,
  "travel-places": Car,
  "objects": Box,
  "symbols": Heart,
  "flags": FlagIcon
}

export function EmojiPicker({ onEmojiSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const categoryRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Filter emojis based on search query
  const filteredEmojis = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return null // Show all categories
    }

    const query = searchQuery.toLowerCase().trim()
    return allEmojisWithMetadata.filter((emojiData) => {
      const labelMatch = emojiData.label.toLowerCase().includes(query)
      const tagsMatch = emojiData.tags.some((tag) => tag.toLowerCase().includes(query))
      return labelMatch || tagsMatch
    })
  }, [searchQuery])

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji)
    setOpen(false)
    setSearchQuery("")
  }

  const scrollToCategory = (categoryId: string) => {
    const element = categoryRefs.current.get(categoryId)
    if (element && scrollContainerRef.current) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const setCategoryRef = (categoryId: string, element: HTMLDivElement | null) => {
    if (element) {
      categoryRefs.current.set(categoryId, element)
    } else {
      categoryRefs.current.delete(categoryId)
    }
  }

  // Focus search input when popover opens
  React.useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    } else if (!open) {
      setSearchQuery("")
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="group relative flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white/5 border-white/20 hover:bg-white/10 hover:border-white/30"
        >
          <Smile className="h-4 w-4 text-white/70 group-hover:text-white/80 transition-all" />
          <span className="sr-only">Add Emoji</span>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[320px] sm:w-[360px] p-0 bg-white/10 backdrop-blur-md border-white/20"
        align="start"
        side="top"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
      >
        <div className="flex flex-col h-[280px] max-h-[280px] overflow-hidden">
          {/* Search Bar */}
          <div className="flex-shrink-0 border-b border-white/20 p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search emojis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-8 h-8 bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:bg-white/10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 hover:text-white/70"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Category Tabs - Hide when searching */}
          {!searchQuery && (
            <div className="flex-shrink-0 border-b border-white/20 py-2 overflow-hidden">
              <div
                className={cn(
                  "flex w-full gap-1 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory px-3",
                  "sm:max-w-none sm:justify-center sm:overflow-x-visible sm:snap-none",
                  "[&>*]:shrink-0"
                )}
                style={{ scrollbarWidth: "none" }}
              >
                {emojiCategories.map((category) => {
                  const IconComponent =
                    CATEGORY_ICON_MAP[category.id] ??
                    CATEGORY_ICON_MAP[category.name.toLowerCase()] ??
                    Smile
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => scrollToCategory(category.id)}
                      className="flex items-center justify-center h-8 w-8 rounded-md transition-colors cursor-pointer snap-start hover:bg-white/10"
                      title={category.name}
                    >
                      <IconComponent className="h-4 w-4 text-white/70" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Emoji Grid - Long Scroll or Search Results */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 min-h-0 overflow-y-auto"
          >
            <div className="p-3">
              {searchQuery && filteredEmojis ? (
                // Search Results
                filteredEmojis.length > 0 ? (
                  <>
                    <h3 className="text-xs font-medium text-white/60 mb-2 px-1">
                      Search Results
                    </h3>
                    <div className="grid grid-cols-8 gap-1">
                      {filteredEmojis.map((emojiData, index) => (
                        <button
                          key={`search-${index}`}
                          type="button"
                          onClick={() => handleEmojiClick(emojiData.emoji)}
                          className="flex items-center justify-center h-9 w-9 rounded-md hover:bg-white/20 transition-colors cursor-pointer relative group text-lg"
                          title={emojiData.label}
                        >
                          {emojiData.emoji}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/50 text-sm">No emojis found</p>
                  </div>
                )
              ) : (
                // All Categories
                emojiCategories.map((category) => (
                  <div
                    key={category.id}
                    ref={(el) => setCategoryRef(category.id, el)}
                    className="mb-6 last:mb-0"
                  >
                    <h3 className="text-xs font-medium text-white/60 mb-2 px-1">
                      {category.name}
                    </h3>
                    <div className="grid grid-cols-8 gap-1">
                      {category.emojis.map((emoji, index) => (
                        <button
                          key={`${category.id}-${index}`}
                          type="button"
                          onClick={() => handleEmojiClick(emoji)}
                          className="flex items-center justify-center h-9 w-9 rounded-md hover:bg-white/20 transition-colors cursor-pointer relative group text-lg"
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
