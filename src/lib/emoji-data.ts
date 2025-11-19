// Import emoji data from emojibase-data
// Using dynamic import to avoid issues with require() in client components
import emojibaseDataRaw from "emojibase-data/en/data.json"

const emojibaseData: any[] = Array.isArray(emojibaseDataRaw) ? emojibaseDataRaw : []

export interface EmojiCategory {
  id: string
  name: string
  emojis: string[]
}

export interface EmojiWithMetadata {
  emoji: string
  label: string
  tags: string[]
  categoryId: string
}

// Map emojibase group numbers to category names
// Based on actual emojibase-data structure:
// Group 0: Smileys & People
// Group 1: People & Body (gestures)
// Group 2: Skin tones (filtered out)
// Group 3: Animals & Nature
// Group 4: Food & Drink
// Group 5: Travel & Places
// Group 6: Activities
// Group 7: Objects
// Group 8: Symbols
// Group 9: Flags
const GROUP_TO_CATEGORY: Record<number, { id: string; name: string }> = {
  0: { id: "smileys-people", name: "Smileys & People" },
  1: { id: "people", name: "People & Body" },
  3: { id: "animals-nature", name: "Animals & Nature" },
  4: { id: "food-drink", name: "Food & Drink" },
  5: { id: "travel-places", name: "Travel & Places" },
  6: { id: "activities", name: "Activities" },
  7: { id: "objects", name: "Objects" },
  8: { id: "symbols", name: "Symbols" },
  9: { id: "flags", name: "Flags" }
}

// Frequently used emojis (curated list)
const FREQUENTLY_USED = ["😀", "😂", "❤️", "🔥", "👍", "🎉", "✨", "💯", "😊", "🥰", "😍", "🤔", "😭", "🙏", "🎊", "💪"]

// Process emojibase data into our category format
function processEmojibaseData(): EmojiCategory[] {
  const categoriesMap = new Map<string, string[]>()
  
  // Add frequently used category
  categoriesMap.set("frequently-used", FREQUENTLY_USED)
  
  // Process all emojis from emojibase-data if available
  // emojibase-data v17.0.0 contains 1,949 base emoji characters (Unicode 17.0)
  // This includes all displayable emojis (1,923 have groups, 26 are regional indicators used for flags)
  if (emojibaseData && emojibaseData.length > 0) {
    emojibaseData.forEach((emoji: any) => {
      // Skip if no emoji character
      if (!emoji.emoji) return
      
      // Skip regional indicator letters (🇦, 🇧, etc.) - these are components for flag emojis
      if (emoji.label && emoji.label.includes('regional indicator')) return
      
      // Skip family emojis (contain zero-width joiners) - these often don't render properly
      if (emoji.emoji.includes('\u200D')) return
      
      // Skip family emojis by label/name (e.g., "family", "👪")
      const label = emoji.label?.toLowerCase() || ''
      const tags = emoji.tags?.join(' ').toLowerCase() || ''
      if (label.includes('family') || tags.includes('family')) return
      
      // Skip the specific family emoji 👪 (U+1F46A)
      if (emoji.emoji === '👪' || emoji.emoji === '👪️') return
      
      // Skip skin tones (Group 2)
      if (emoji.group === 2) return
      
      // Get category from group number
      const groupNum = emoji.group
      if (groupNum === undefined || groupNum === null) return
      
      const category = GROUP_TO_CATEGORY[groupNum]
      if (!category) return
      
      // Initialize category array if needed
      if (!categoriesMap.has(category.id)) {
        categoriesMap.set(category.id, [])
      }
      
      // Add emoji to category
      categoriesMap.get(category.id)!.push(emoji.emoji)
    })
  }
  
  // Convert map to array format
  const categories: EmojiCategory[] = [
    {
      id: "frequently-used",
      name: "Frequently Used",
      emojis: FREQUENTLY_USED
    }
  ]
  
  // Add all other categories
  Object.values(GROUP_TO_CATEGORY).forEach(({ id, name }) => {
    const emojis = categoriesMap.get(id) || []
    if (emojis.length > 0) {
      categories.push({ id, name, emojis })
    }
  })
  
  return categories
}

export const EMOJI_CATEGORIES: EmojiCategory[] = processEmojibaseData()

// Create a flat list of all emojis with metadata for searching
export function getAllEmojisWithMetadata(): EmojiWithMetadata[] {
  const allEmojis: EmojiWithMetadata[] = []
  const categories = getEmojiCategories()
  
  categories.forEach((category) => {
    category.emojis.forEach((emoji) => {
      // Find the emoji in emojibase-data to get its label and tags
      const emojiData = emojibaseData.find((e: any) => e.emoji === emoji)
      allEmojis.push({
        emoji,
        label: emojiData?.label || '',
        tags: emojiData?.tags || [],
        categoryId: category.id
      })
    })
  })
  
  return allEmojis
}

export function getEmojiCategories(): EmojiCategory[] {
  return EMOJI_CATEGORIES
}
