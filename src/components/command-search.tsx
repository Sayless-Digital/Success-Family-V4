"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, Hash, Users, Building2, FileText, Sparkles, TrendingUp, Clock, Crown, Loader2, Check, X } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import type { Topic, Community, User as UserType } from "@/types"

interface CommandSearchProps {
  onSelect?: (type: "for-you" | "trending" | "popular" | "recent" | "new-creators" | "topic", value?: string) => void
  activeView?: "for-you" | "trending" | "popular" | "recent" | "new-creators" | "topic"
  activeTopicId?: string
}

export function CommandSearch({ onSelect, activeView, activeTopicId }: CommandSearchProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [topics, setTopics] = React.useState<Topic[]>([])
  const [communities, setCommunities] = React.useState<Community[]>([])
  const [users, setUsers] = React.useState<UserType[]>([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [activeTopic, setActiveTopic] = React.useState<Topic | null>(null)
  const router = useRouter()
  const { user } = useAuth()

  // Fetch active topic data when activeTopicId (slug) is set
  React.useEffect(() => {
    if (activeTopicId && activeView === "topic") {
      const fetchActiveTopic = async () => {
        const { data } = await supabase
          .from("topics")
          .select("id, slug, label, description, is_featured")
          .eq("slug", activeTopicId)
          .eq("is_active", true)
          .single()
        
        if (data) {
          setActiveTopic(data)
        }
      }
      fetchActiveTopic()
    } else {
      setActiveTopic(null)
    }
  }, [activeTopicId, activeView])

  // Search across all entities
  React.useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setTopics([])
      setCommunities([])
      setUsers([])
      setIsSearching(false)
      return
    }

    const searchAll = async () => {
      setIsSearching(true)
      const query = searchQuery.toLowerCase().trim()
      
      console.log("Searching for:", query)

      try {
        // Parallel search across all entities - use separate queries for reliability
        const searchPattern = `%${query}%`
        
        // Search topics - try both label and slug separately, then combine
        const [topicsByLabel, topicsBySlug] = await Promise.all([
          supabase
            .from("topics")
            .select("id, slug, label, description, is_featured")
            .eq("is_active", true)
            .ilike("label", searchPattern)
            .limit(10),
          supabase
            .from("topics")
            .select("id, slug, label, description, is_featured")
            .eq("is_active", true)
            .ilike("slug", searchPattern)
            .limit(10),
        ])
        
        const topicsMap = new Map()
        if (topicsByLabel.data) topicsByLabel.data.forEach(t => topicsMap.set(t.id, t))
        if (topicsBySlug.data) topicsBySlug.data.forEach(t => topicsMap.set(t.id, t))
        const topicsData = Array.from(topicsMap.values()).slice(0, 10)
        
        if (topicsByLabel.error) console.error("Topics by label error:", topicsByLabel.error)
        if (topicsBySlug.error) console.error("Topics by slug error:", topicsBySlug.error)
        console.log("Topics found:", topicsData.length)
        
        // Search communities - try both name and slug separately, then combine
        const [communitiesByName, communitiesBySlug] = await Promise.all([
          supabase
            .from("communities")
            .select("id, name, slug, description, logo_url")
            .eq("is_active", true)
            .ilike("name", searchPattern)
            .limit(10),
          supabase
            .from("communities")
            .select("id, name, slug, description, logo_url")
            .eq("is_active", true)
            .ilike("slug", searchPattern)
            .limit(10),
        ])
        
        const communitiesMap = new Map()
        if (communitiesByName.data) communitiesByName.data.forEach(c => communitiesMap.set(c.id, c))
        if (communitiesBySlug.data) communitiesBySlug.data.forEach(c => communitiesMap.set(c.id, c))
        const communitiesData = Array.from(communitiesMap.values()).slice(0, 10)
        
        if (communitiesByName.error) console.error("Communities by name error:", communitiesByName.error)
        if (communitiesBySlug.error) console.error("Communities by slug error:", communitiesBySlug.error)
        console.log("Communities found:", communitiesData.length)
        
        // Search users - try username, first_name, and last_name separately, then combine
        const [usersByUsername, usersByFirstName, usersByLastName] = await Promise.all([
          supabase
            .from("users")
            .select("id, username, first_name, last_name, profile_picture")
            .ilike("username", searchPattern)
            .limit(10),
          supabase
            .from("users")
            .select("id, username, first_name, last_name, profile_picture")
            .ilike("first_name", searchPattern)
            .limit(10),
          supabase
            .from("users")
            .select("id, username, first_name, last_name, profile_picture")
            .ilike("last_name", searchPattern)
            .limit(10),
        ])
        
        const usersMap = new Map()
        if (usersByUsername.data) usersByUsername.data.forEach(u => usersMap.set(u.id, u))
        if (usersByFirstName.data) usersByFirstName.data.forEach(u => usersMap.set(u.id, u))
        if (usersByLastName.data) usersByLastName.data.forEach(u => usersMap.set(u.id, u))
        const usersData = Array.from(usersMap.values()).slice(0, 10)
        
        if (usersByUsername.error) console.error("Users by username error:", usersByUsername.error)
        if (usersByFirstName.error) console.error("Users by first name error:", usersByFirstName.error)
        if (usersByLastName.error) console.error("Users by last name error:", usersByLastName.error)
        console.log("Users found:", usersData.length)

        // Set results
        setTopics(topicsData)
        setCommunities(communitiesData)
        setUsers(usersData)

        // Log results for debugging
        console.log("Search query:", query)
        console.log("Search pattern:", searchPattern)
        console.log("Final results:", { 
          topics: topicsData.length, 
          communities: communitiesData.length,
          users: usersData.length
        })
        if (topicsData.length > 0) {
          console.log("Sample topic:", topicsData[0])
        }
        if (communitiesData.length > 0) {
          console.log("Sample community:", communitiesData[0])
        }
        if (usersData.length > 0) {
          console.log("Sample user:", usersData[0])
        }
      } catch (error) {
        console.error("Search error:", error)
        setTopics([])
        setCommunities([])
        setUsers([])
      } finally {
        setIsSearching(false)
      }
    }

    const timeoutId = setTimeout(searchAll, 300) // Debounce
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Debug: Log state changes
  React.useEffect(() => {
    console.log("State updated - Topics:", topics.length, "Communities:", communities.length, "Users:", users.length)
    if (topics.length > 0) console.log("Topics data:", topics)
    if (communities.length > 0) console.log("Communities data:", communities)
    if (users.length > 0) console.log("Users data:", users)
  }, [topics, communities, users])

  // Keyboard shortcut to open (Cmd/Ctrl + K)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleSelectTopic = (topic: Topic) => {
    setOpen(false)
    setSearchQuery("")
    // Filter posts by topic slug
    if (onSelect) {
      onSelect("topic", topic.slug)
    }
  }

  const handleSelectCommunity = (community: Community) => {
    setOpen(false)
    setSearchQuery("")
    router.push(`/${community.slug}`)
  }

  const handleSelectUser = (user: UserType) => {
    setOpen(false)
    setSearchQuery("")
    router.push(`/profile/${user.username}`)
  }

  const handleSelectFeed = (feed: "for-you" | "trending" | "popular" | "recent" | "new-creators") => {
    setOpen(false)
    setSearchQuery("")
    if (onSelect) {
      onSelect(feed)
    }
  }

  const hasResults = topics.length > 0 || communities.length > 0 || users.length > 0

  // Get active view label and icon
  const getActiveViewInfo = () => {
    if (!activeView) return null
    
    if (activeView === "topic" && activeTopicId) {
      // Use activeTopic state or find in topics list
      const topic = activeTopic || topics.find(t => t.id === activeTopicId)
      if (topic) {
        return { label: `#${topic.label}`, icon: null as any }
      }
      return { label: "Topic", icon: null as any }
    }
    
    if (activeView === "topic") return null
    
    const viewInfo = {
      "for-you": { label: "For You", icon: Sparkles },
      "trending": { label: "Trending", icon: TrendingUp },
      "popular": { label: "Popular", icon: Crown },
      "recent": { label: "Recent", icon: Clock },
      "new-creators": { label: "New Creators", icon: Users },
    } as const
    
    return viewInfo[activeView as keyof typeof viewInfo]
  }

  const activeViewInfo = getActiveViewInfo()
  const ActiveViewIcon = activeViewInfo?.icon

  return (
    <>
      {/* Search Bar Trigger */}
      <div className="relative flex items-center gap-3 w-full">
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "flex items-center gap-3 w-full px-4 py-2 rounded-xl",
            "bg-white/10 backdrop-blur-sm border border-white/20 text-white/70",
            "hover:bg-white/15 hover:border-white/30 hover:text-white/90",
            "transition-all duration-200 cursor-pointer text-left",
            "shadow-sm hover:shadow-md"
          )}
        >
          <Search className="h-5 w-5 shrink-0 text-white/60" />
          <span className="flex-1 text-sm font-medium">
            {activeViewInfo ? (
              <span className="flex items-center gap-2">
                {ActiveViewIcon && <ActiveViewIcon className="h-4 w-4 text-white/80" />}
                <span className="font-semibold text-white/90">{activeViewInfo.label}</span>
              </span>
            ) : (
              "Search communities, profiles, topics..."
            )}
          </span>
          <kbd className="hidden md:inline-flex h-6 items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 text-[10px] font-semibold text-white/70 shadow-sm">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
        {activeViewInfo && activeView !== "for-you" && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (onSelect) {
                onSelect("for-you")
              }
            }}
            className="absolute right-12 sm:right-16 flex items-center justify-center h-6 w-6 rounded-md hover:bg-white/10 transition-colors text-white/60 hover:text-white/80 cursor-pointer z-10"
            aria-label="Clear filter"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <CommandDialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) {
          // Reset search when dialog closes
          setSearchQuery("")
          setTopics([])
          setCommunities([])
          setUsers([])
        }
      }}>
        <CommandInput
          placeholder="Search communities, profiles, topics..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          loading={isSearching}
        />
        <CommandList>
          {/* Only show CommandEmpty when there are no results and not searching */}
          {!isSearching && topics.length === 0 && communities.length === 0 && users.length === 0 && (
            <CommandEmpty>
              {searchQuery.length < 2 ? "Type at least 2 characters to search" : "No results found."}
            </CommandEmpty>
          )}

          {/* Quick Actions / Feed Filters */}
          {!searchQuery && (
            <CommandGroup heading="Quick Actions">
              {user && (
                <CommandItem onSelect={() => handleSelectFeed("for-you")} className="text-white">
                  <Sparkles className="h-4 w-4 text-white/60" />
                  <span className="font-medium">For You</span>
                  {activeView === "for-you" && (
                    <Check className="h-4 w-4 ml-auto text-white/80" />
                  )}
                </CommandItem>
              )}
              <CommandItem onSelect={() => handleSelectFeed("trending")} className="text-white">
                <TrendingUp className="h-4 w-4 text-white/60" />
                <span className="font-medium">Trending</span>
                {activeView === "trending" && (
                  <Check className="h-4 w-4 ml-auto text-white/80" />
                )}
              </CommandItem>
              <CommandItem onSelect={() => handleSelectFeed("popular")} className="text-white">
                <Crown className="h-4 w-4 text-white/60" />
                <span className="font-medium">Popular</span>
                {activeView === "popular" && (
                  <Check className="h-4 w-4 ml-auto text-white/80" />
                )}
              </CommandItem>
              <CommandItem onSelect={() => handleSelectFeed("recent")} className="text-white">
                <Clock className="h-4 w-4 text-white/60" />
                <span className="font-medium">Recent</span>
                {activeView === "recent" && (
                  <Check className="h-4 w-4 ml-auto text-white/80" />
                )}
              </CommandItem>
              <CommandItem onSelect={() => handleSelectFeed("new-creators")} className="text-white">
                <Users className="h-4 w-4 text-white/60" />
                <span className="font-medium">New Creators</span>
                {activeView === "new-creators" && (
                  <Check className="h-4 w-4 ml-auto text-white/80" />
                )}
              </CommandItem>
            </CommandGroup>
          )}

          {/* Topics Results */}
          {topics.length > 0 && (
            <CommandGroup heading="Topics">
              {topics.map((topic) => (
                <CommandItem
                  key={topic.id}
                  onSelect={() => handleSelectTopic(topic)}
                  className="text-white"
                >
                  <Hash className="h-4 w-4 text-white/60" />
                  <span className="font-medium">#{topic.label}</span>
                  {topic.is_featured && (
                    <Sparkles className="h-3.5 w-3.5 ml-auto text-white/50" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Communities Results */}
          {communities.length > 0 && (
            <CommandGroup heading="Communities">
              {communities.map((community) => (
                <CommandItem
                  key={community.id}
                  onSelect={() => handleSelectCommunity(community)}
                  className="text-white"
                >
                  {community.logo_url ? (
                    <Avatar className="h-6 w-6 border border-white/20">
                      <AvatarImage src={community.logo_url} alt={community.name} />
                      <AvatarFallback className="bg-white/10 text-white/80 text-xs">
                        {community.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Building2 className="h-4 w-4 text-white/60" />
                  )}
                  <span className="font-medium">{community.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Users/Profiles Results */}
          {users.length > 0 && (
            <CommandGroup heading="Profiles">
              {users.map((userItem) => (
                <CommandItem
                  key={userItem.id}
                  onSelect={() => handleSelectUser(userItem)}
                  className="text-white"
                >
                  <Avatar className="h-6 w-6 border border-white/20">
                    <AvatarImage src={userItem.profile_picture || undefined} alt={userItem.username} />
                    <AvatarFallback className="bg-white/10 text-white/80 text-xs">
                      {userItem.first_name?.[0] || userItem.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium">@{userItem.username}</span>
                    {(userItem.first_name || userItem.last_name) && (
                      <span className="text-white/50 text-xs truncate">
                        {userItem.first_name} {userItem.last_name}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

