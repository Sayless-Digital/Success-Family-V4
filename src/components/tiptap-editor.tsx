"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
import Mention from "@tiptap/extension-mention"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, AtSign } from "lucide-react"
import { createPortal } from "react-dom"

interface User {
  id: string
  username: string
  first_name: string | null
  last_name: string | null
  profile_picture: string | null
  email?: string
}

interface TiptapEditorProps {
  value: string // Markdown string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minHeight?: number
  maxHeight?: number
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void | boolean
  size?: "sm" | "base" | "lg"
}

// Search users for mentions
async function searchUsers(query: string): Promise<User[]> {
  if (!query || query.length < 1) {
    return []
  }

  try {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
    const data = await response.json()
    return data.users || []
  } catch (error) {
    console.error("Error searching users:", error)
    return []
  }
}

// Convert HTML to markdown (simple version)
function htmlToMarkdown(html: string): string {
  // This is a simplified converter - for production you might want a more robust solution
  // For now, we'll store as HTML and convert on demand, or use a library like turndown
  return html
}

// Convert markdown to HTML (simple version - using Tiptap's JSON format)
function markdownToJSON(markdown: string): any {
  // Simple markdown parser for basic formatting
  if (!markdown) {
    return {
      type: "doc",
      content: [
        {
          type: "paragraph",
        },
      ],
    }
  }

  // For now, we'll parse basic markdown patterns
  // *bold*, **italic**, ~strike~, _underline_, @mentions
  const content: any[] = []
  let i = 0
  let currentText = ""

  while (i < markdown.length) {
    // Check for **italic** first (double asterisk)
    if (markdown.slice(i, i + 2) === "**") {
      if (currentText) {
        content.push({ type: "text", text: currentText })
        currentText = ""
      }
      const endIndex = markdown.indexOf("**", i + 2)
      if (endIndex !== -1) {
        const text = markdown.slice(i + 2, endIndex)
        content.push({
          type: "text",
          text,
          marks: [{ type: "italic" }],
        })
        i = endIndex + 2
        continue
      }
    }

    // Check for *bold* (single asterisk, not part of **)
    if (markdown[i] === "*" && markdown[i + 1] !== "*") {
      if (currentText) {
        content.push({ type: "text", text: currentText })
        currentText = ""
      }
      const endIndex = markdown.indexOf("*", i + 1)
      if (endIndex !== -1) {
        const text = markdown.slice(i + 1, endIndex)
        content.push({
          type: "text",
          text,
          marks: [{ type: "bold" }],
        })
        i = endIndex + 1
        continue
      }
    }

    // Check for ~strike~
    if (markdown[i] === "~") {
      if (currentText) {
        content.push({ type: "text", text: currentText })
        currentText = ""
      }
      const endIndex = markdown.indexOf("~", i + 1)
      if (endIndex !== -1) {
        const text = markdown.slice(i + 1, endIndex)
        content.push({
          type: "text",
          text,
          marks: [{ type: "strike" }],
        })
        i = endIndex + 1
        continue
      }
    }

    // Check for _underline_
    if (markdown[i] === "_") {
      if (currentText) {
        content.push({ type: "text", text: currentText })
        currentText = ""
      }
      const endIndex = markdown.indexOf("_", i + 1)
      if (endIndex !== -1) {
        const text = markdown.slice(i + 1, endIndex)
        content.push({
          type: "text",
          text,
          marks: [{ type: "underline" }],
        })
        i = endIndex + 1
        continue
      }
    }

    // Check for @mention
    if (markdown[i] === "@") {
      if (currentText) {
        content.push({ type: "text", text: currentText })
        currentText = ""
      }
      // Find end of mention (space, punctuation, or end of string)
      let endIndex = i + 1
      while (endIndex < markdown.length && /[\w]/.test(markdown[endIndex])) {
        endIndex++
      }
      const username = markdown.slice(i + 1, endIndex)
      if (username) {
        content.push({
          type: "mention",
          attrs: {
            id: username, // We'll store username as ID for now
            label: username,
          },
        })
        i = endIndex
        continue
      }
    }

    // Check for newline
    if (markdown[i] === "\n") {
      if (currentText) {
        content.push({ type: "text", text: currentText })
        currentText = ""
      }
      content.push({ type: "hardBreak" })
      i++
      continue
    }

    currentText += markdown[i]
    i++
  }

  if (currentText) {
    content.push({ type: "text", text: currentText })
  }

  return {
    type: "doc",
    content: content.length > 0
      ? [
          {
            type: "paragraph",
            content,
          },
        ]
      : [{ type: "paragraph" }],
  }
}

// Convert Tiptap JSON to markdown
function jsonToMarkdown(json: any): string {
  if (!json.content) return ""

  let markdown = ""

  const processNode = (node: any): void => {
    if (node.type === "text") {
      let text = node.text || ""
      const marks = node.marks || []

      // Apply marks in reverse order (inner to outer)
      for (const mark of marks.reverse()) {
        if (mark.type === "bold") {
          text = `*${text}*`
        } else if (mark.type === "italic") {
          text = `**${text}**`
        } else if (mark.type === "strike") {
          text = `~${text}~`
        } else if (mark.type === "underline") {
          text = `_${text}_`
        }
      }

      markdown += text
    } else if (node.type === "hardBreak") {
      markdown += "\n"
    } else if (node.type === "mention") {
      // Handle mention node - convert to @username (for markdown export)
      const username = node.attrs?.id || ""
      markdown += `@${username}`
    } else if (node.content) {
      // Process child nodes
      for (const child of node.content) {
        processNode(child)
      }
    }
  }

  for (const node of json.content || []) {
    processNode(node)
  }

  return markdown.trim()
}

// Mention suggestion component - receives selectedIndex from Tiptap's suggestion system
function MentionList({ 
  items, 
  selectedIndex,
  onSelect 
}: { 
  items: any[]
  selectedIndex: number
  onSelect: (item: any, index: number) => void 
}) {
  if (items.length === 0) return null

  return (
    <div className="bg-white/10 border border-white/20 rounded-lg shadow-lg p-1 backdrop-blur-md max-h-[300px] overflow-y-auto">
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item, index)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors",
            index === selectedIndex
              ? "bg-white/20 text-white"
              : "text-white/80 hover:bg-white/10"
          )}
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={item.avatar} />
            <AvatarFallback className="bg-white/10 text-white/80 text-xs">
              {item.fullName
                ? `${item.fullName[0] || ""}${item.fullName.split(" ")[1]?.[0] || ""}`
                : item.username?.[0] || ""}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {item.fullName || item.username || item.label}
            </div>
            {item.username && item.fullName && (
              <div className="text-xs text-white/60 truncate">@{item.username}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

export function TiptapEditor({
  value,
  onChange,
  placeholder = "Type something...",
  disabled = false,
  className,
  minHeight = 100,
  maxHeight,
  onKeyDown,
  size = "base",
}: TiptapEditorProps) {
  const [mentionItems, setMentionItems] = useState<any[]>([])
  const [showMentionList, setShowMentionList] = useState(false)
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null)
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0)
  const mentionSuggestionRef = useRef<any>(null) // Store Tiptap's suggestion props
  const mentionListRef = useRef<HTMLDivElement>(null)
  const mentionItemsRef = useRef<any[]>([]) // Store current items for onKeyDown access
  const selectedMentionIndexRef = useRef<number>(0) // Store current selected index for onKeyDown access
  const editorRef = useRef<any>(null) // Store editor instance for onKeyDown access

  // Initialize editor
  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR hydration mismatches
    extensions: [
      StarterKit.configure({
        // Exclude some features we don't need
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }) as any,
      Underline,
      Placeholder.configure({
        placeholder,
      }),
      Mention.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            avatar: {
              default: null,
              parseHTML: element => element.getAttribute('data-avatar'),
              renderHTML: attributes => {
                if (!attributes.avatar) {
                  return {}
                }
                return {
                  'data-avatar': attributes.avatar,
                }
              },
            },
          }
        },
        renderHTML({ node }) {
          const avatar = node.attrs.avatar
          const label = node.attrs.label || node.attrs.id || ''
          
          // If we have an avatar, render it with the mention (no @ symbol)
          if (avatar) {
            return [
              'span',
              {
                class: 'mention inline-flex items-center gap-1.5 bg-white/10 text-white/90 pl-0.5 pr-1.5 py-0 rounded-full text-sm',
                'data-type': 'mention',
                'data-id': node.attrs.id,
                'data-avatar': avatar,
              },
              [
                'img',
                {
                  src: avatar,
                  alt: label,
                  class: 'h-4 w-4 rounded-full object-cover',
                  style: 'display: inline-block; vertical-align: middle;',
                },
              ],
              label,
            ]
          }
          
          // Fallback: render without avatar (no @ symbol)
          return [
            'span',
            {
              class: 'mention inline-flex items-center bg-white/10 text-white/90 pl-1 pr-1.5 py-0 rounded-full text-sm',
              'data-type': 'mention',
              'data-id': node.attrs.id,
            },
            label,
          ]
        },
      }).configure({
        HTMLAttributes: {
          class: "mention inline-flex items-center gap-1.5 bg-white/10 text-white/90 pl-0.5 pr-1.5 py-0 rounded-full text-sm",
        },
        suggestion: {
          char: '@',
          items: async ({ query }) => {
            const users = await searchUsers(query)
            const items = users.map((user) => {
              const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim()
              return {
                id: user.id,
                label: fullName || user.username || user.email || "",
                username: user.username,
                fullName: fullName,
                avatar: user.profile_picture,
              }
            })
            setMentionItems(items)
            return items
          },
          command: ({ editor, range, props }: any) => {
            // Replace the @query text (including @) with the mention node
            // Tiptap's range starts after @, so we need to include @ in the deletion
            const startPos = range.from - 1 // Position of @
            const endPos = range.to // End of query text
            
            // Delete @query and insert mention in one operation (using fullName as label)
            editor
              .chain()
              .focus()
              .setTextSelection({ from: startPos, to: endPos })
              .deleteSelection()
              .insertContent({
                type: 'mention',
                attrs: {
                  id: props.item.id,
                  label: props.item.fullName || props.item.label || props.item.username,
                  avatar: props.item.avatar || null,
                },
              })
              .insertContent(" ") // Insert space after mention
              .run()
          },
          render: () => {
            // Create a container element that we'll use for React portal
            let container: HTMLDivElement | null = null
            let reactRoot: any = null

            return {
              onStart: (props: any) => {
                mentionSuggestionRef.current = props // Store props for later use
                setShowMentionList(true)
                setSelectedMentionIndex(0)
                selectedMentionIndexRef.current = 0 // Initialize ref
                setMentionItems([]) // Clear items state
                mentionItemsRef.current = [] // Clear items ref
                const rect = props.clientRect?.()
                if (rect) {
                  setMentionPosition({ top: rect.top, left: rect.left })
                }
                console.log('🚀 Mention started, waiting for items...')
              },
              onUpdate: (props: any) => {
                mentionSuggestionRef.current = props // Update stored props
                const rect = props.clientRect?.()
                if (rect) {
                  setMentionPosition({ top: rect.top, left: rect.left })
                }
                const items = props.items || []
                
                // Update items state AND ref (ref is accessible in onKeyDown closure)
                setMentionItems(items)
                mentionItemsRef.current = items // Store in ref for onKeyDown access
                
                // Sync selectedIndex from props
                // Tiptap's suggestion system should provide selectedIndex
                // If it's undefined but we have items, default to 0
                let selectedIdx = props.selectedIndex
                
                if (typeof selectedIdx !== 'number') {
                  selectedIdx = items.length > 0 ? 0 : undefined
                }
                
                if (selectedIdx !== undefined) {
                  setSelectedMentionIndex(selectedIdx)
                  selectedMentionIndexRef.current = selectedIdx // Update ref too
                }
                
                // Debug: Log when items are loaded
                if (items.length > 0) {
                  console.log('📦 Items loaded:', items.length, 'items, selectedIndex:', selectedIdx)
                }
              },
              onKeyDown: (props: any) => {
                const { event } = props
                mentionSuggestionRef.current = props // Keep props in sync
                
                // CRITICAL: Only handle keys when suggestion is ACTIVE
                // Check if we have a range (mention query in progress)
                const hasRange = !!props.range
                const items = props.items || []
                const hasItems = items.length > 0
                
                // Suggestion is active if we have a range (query in progress)
                // Items might be loading, so we check range first
                const hasActiveSuggestion = hasRange
                
                // Only handle arrow keys, Enter, and Escape when suggestion is active
                const shouldHandle = hasActiveSuggestion && 
                  (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter" || event.key === "Escape")
                
                if (!shouldHandle) {
                  return false // Let Tiptap handle normally
                }

                // Debug: Log when suggestion IS active
                if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter") {
                  console.log('✅ Suggestion onKeyDown ACTIVE:', event.key, {
                    hasRange,
                    hasItems,
                    itemsCount: items.length,
                    selectedIndex: props.selectedIndex,
                    hasSelectItem: typeof props.selectItem === 'function'
                  })
                }

                // Handle arrow keys - navigate through suggestions
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault()
                  event.stopPropagation()
                  
                  // Get items from ref (always up-to-date, updated in onUpdate)
                  // Props.items might be empty due to closure, but ref has the latest items
                  const availableItems = mentionItemsRef.current
                  
                  // If no items yet, prevent caret movement
                  if (!availableItems || availableItems.length === 0) {
                    console.log('⏳ Items not loaded yet, preventing caret movement...', {
                      refItemsLength: mentionItemsRef.current.length,
                      propsItemsLength: (props.items || []).length
                    })
                    return true // Prevent caret movement while items are loading
                  }
                  
                  // Items are loaded, we can navigate
                  // Use ref for current index (always up-to-date, not affected by React state updates)
                  // Prioritize props.selectedIndex if it's a valid number, otherwise use ref
                  const currentIndex = typeof props.selectedIndex === 'number' 
                    ? props.selectedIndex 
                    : selectedMentionIndexRef.current
                  
                  let newIndex: number
                  
                  if (event.key === "ArrowUp") {
                    newIndex = currentIndex > 0 ? currentIndex - 1 : availableItems.length - 1
                  } else {
                    newIndex = currentIndex < availableItems.length - 1 ? currentIndex + 1 : 0
                  }
                  
                  console.log('🎯 Navigating:', { 
                    from: currentIndex, 
                    to: newIndex, 
                    itemsCount: availableItems.length,
                    propsSelectedIndex: props.selectedIndex,
                    refSelectedIndex: selectedMentionIndexRef.current,
                    localSelectedIndex: selectedMentionIndex
                  })
                  
                  // Update ref FIRST (immediate, synchronous) - this ensures next keypress uses correct index
                  selectedMentionIndexRef.current = newIndex
                  
                  // Update local state for visual feedback
                  setSelectedMentionIndex(newIndex)
                  
                  // Try to use Tiptap's selectItem if available (this updates props.selectedIndex)
                  // This should trigger onUpdate which will sync our local state properly
                  if (typeof props.selectItem === 'function') {
                    try {
                      props.selectItem(newIndex)
                    } catch (e) {
                      console.warn('props.selectItem failed:', e)
                    }
                  }
                  
                  return true // Event handled - prevent caret movement
                }

                // Handle Enter key - trigger the command callback with selected item
                if (event.key === "Enter") {
                  event.preventDefault()
                  event.stopPropagation()
                  
                  // Get items from ref (always up-to-date)
                  const availableItems = mentionItemsRef.current
                  if (!availableItems || availableItems.length === 0) {
                    console.log('❌ Enter pressed but no items available')
                    return true // Prevent Enter if no items yet
                  }
                  
                  const selectedIdx = typeof props.selectedIndex === 'number' 
                    ? props.selectedIndex 
                    : (selectedMentionIndexRef.current >= 0 ? selectedMentionIndexRef.current : 0)
                  const item = availableItems[selectedIdx]
                  
                  // Get editor from ref (always up-to-date, not affected by closure)
                  const currentEditor = editorRef.current
                  
                  console.log('🔵 Enter pressed to select:', {
                    selectedIdx,
                    item: item ? { id: item.id, label: item.fullName || item.label } : null,
                    hasRange: !!props.range,
                    hasEditor: !!currentEditor && !currentEditor.isDestroyed,
                    rangeFrom: props.range?.from,
                    rangeTo: props.range?.to
                  })
                  
                  if (!item) {
                    console.warn('❌ No item found at index:', selectedIdx, 'available items:', availableItems.length)
                    return true
                  }
                  
                  if (!currentEditor || currentEditor.isDestroyed) {
                    console.warn('❌ Editor not available or destroyed')
                    return true
                  }
                  
                  if (!props.range) {
                    console.warn('❌ No range available in props')
                    return true
                  }
                  
                  const range = props.range
                  const startPos = range.from - 1 // Position of @
                  const endPos = range.to // End of query text
                  
                  console.log('✅ Inserting mention:', {
                    startPos,
                    endPos,
                    itemId: item.id,
                    itemLabel: item.fullName || item.label || item.username
                  })
                  
                  // Insert the mention using the same logic as our command callback
                  currentEditor
                    .chain()
                    .focus()
                    .setTextSelection({ from: startPos, to: endPos })
                    .deleteSelection()
                    .insertContent({
                      type: "mention",
                      attrs: {
                        id: item.id,
                        label: item.fullName || item.label || item.username,
                        avatar: item.avatar || null,
                      },
                    })
                    .insertContent(" ") // Insert space after mention
                    .run()
                  
                  console.log('✅ Mention inserted, closing suggestion list')
                  
                  setShowMentionList(false)
                  if (typeof props.hide === 'function') {
                    props.hide()
                  }
                  
                  return true
                }

                // Handle Escape key - close the suggestion list
                if (event.key === "Escape") {
                  event.preventDefault()
                  setShowMentionList(false)
                  if (typeof props.hide === 'function') {
                    props.hide()
                  }
                  return true
                }

                // For all other keys, let Tiptap handle normally
                return false
              },
              onExit: () => {
                setShowMentionList(false)
                setMentionPosition(null)
                setSelectedMentionIndex(0)
                selectedMentionIndexRef.current = 0 // Reset ref
                mentionItemsRef.current = [] // Clear items ref
                mentionSuggestionRef.current = null
              },
            }
          },
        },
      }),
    ],
    content: markdownToJSON(value),
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      const markdown = jsonToMarkdown(json)
      onChange(markdown)
    },
    editable: !disabled,
    onCreate: ({ editor }) => {
      // Store editor in ref for onKeyDown access
      editorRef.current = editor
    },
    onDestroy: () => {
      // Clear editor ref when destroyed
      editorRef.current = null
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm focus:outline-none max-w-none",
          "text-white/80",
          size === "sm" && "text-sm",
          size === "base" && "text-base",
          size === "lg" && "text-lg",
          "min-h-[100px] p-4"
        ),
      },
      handleKeyDown: (view, event) => {
        // CRITICAL: Don't interfere with mention suggestions at all
        // Tiptap's suggestion system processes keyboard events internally
        // If we're in a mention context, we must let events pass through
        // The suggestion's onKeyDown handler will process them
        if (mentionSuggestionRef.current) {
          // Don't handle anything during mentions - let suggestion system handle it
          // Returning false allows the event to continue to the suggestion system
          // But we should NOT handle custom onKeyDown either
          return false
        }
        
        // Handle backspace on mention nodes - delete entire mention including @
        if (event.key === 'Backspace' && editor && !editor.isDestroyed) {
          const { state } = editor
          const { selection } = state
          
          // Only handle if cursor is empty (no selection)
          if (selection.empty) {
            const { $from } = selection
            
            // Check if the node right before cursor is a mention
            const nodeBefore = $from.nodeBefore
            if (nodeBefore && nodeBefore.type.name === 'mention') {
              // Delete the entire mention node (including @)
              event.preventDefault()
              const mentionStart = $from.pos - nodeBefore.nodeSize
              const mentionEnd = $from.pos
              editor
                .chain()
                .focus()
                .setTextSelection({ from: mentionStart, to: mentionEnd })
                .deleteSelection()
                .run()
              return true
            }
            
            // Also check the parent node - if we're right after a mention in the same block
            const parent = $from.parent
            if (parent && $from.parentOffset > 0) {
              const indexBefore = $from.parentOffset - 1
              const nodeAtOffset = parent.child(indexBefore)
              if (nodeAtOffset && nodeAtOffset.type.name === 'mention') {
                // Delete the entire mention node
                event.preventDefault()
                // Calculate position by summing sizes of all previous siblings
                let mentionStart = $from.start() + 1 // +1 for the parent start
                for (let i = 0; i < indexBefore; i++) {
                  mentionStart += parent.child(i).nodeSize
                }
                const mentionEnd = mentionStart + nodeAtOffset.nodeSize
                editor
                  .chain()
                  .focus()
                  .setTextSelection({ from: mentionStart, to: mentionEnd })
                  .deleteSelection()
                  .run()
                return true
              }
            }
          }
        }
        
        // Handle custom keydown if provided
        // BUT: Skip this entirely when mention suggestions are active
        // to avoid interfering with the suggestion system's keyboard handling
        if (onKeyDown && !mentionSuggestionRef.current) {
          const syntheticEvent = {
            key: event.key,
            code: event.code,
            keyCode: event.keyCode,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            preventDefault: () => event.preventDefault(),
            stopPropagation: () => event.stopPropagation(),
            defaultPrevented: event.defaultPrevented,
          } as React.KeyboardEvent<HTMLDivElement>
          
          const result = onKeyDown(syntheticEvent)
          if (result === false || event.defaultPrevented) {
            return true // Prevent default
          }
        }
        
        return false // Let Tiptap handle normally
      },
    },
  })

  // Handle mention selection when clicking on an item
  // Manually replace @query with mention to ensure @ is removed
  // IMPORTANT: This must be before the early return to follow Rules of Hooks
  const handleMentionSelect = useCallback((item: any, index: number) => {
    if (!editor || editor.isDestroyed) return
    
    const props = mentionSuggestionRef.current
    
    // Get the range from Tiptap's suggestion props if available
    let startPos: number | null = null
    let endPos: number | null = null
    
    if (props && props.range) {
      // Tiptap's range starts after @, so we need to include @
      startPos = props.range.from - 1 // Position of @
      endPos = props.range.to // End of query
    } else {
      // Fallback: find @ manually
      const { state } = editor
      const { selection, doc } = state
      
      let searchPos = selection.from
      
      // Search backwards to find @
      while (searchPos > 0) {
        const char = doc.textBetween(searchPos - 1, searchPos)
        if (char === '@') {
          startPos = searchPos - 1
          endPos = selection.from
          break
        }
        searchPos--
        // Don't go too far back (max 100 chars)
        if (selection.from - searchPos > 100) break
      }
    }
    
    // Replace @query with mention and add a space after
    if (startPos !== null && endPos !== null && startPos < endPos) {
      // Delete @query and insert mention with space in one chain (using fullName as label)
      const insertPos = startPos // Position where we'll insert
      
      editor
        .chain()
        .focus()
        .setTextSelection({ from: startPos, to: endPos })
        .deleteSelection()
        .insertContent({
          type: "mention",
          attrs: {
            id: item.id,
            label: item.fullName || item.label || item.username,
            avatar: item.avatar || null,
          },
        })
        .insertContent(" ") // Insert space as plain text
        .run()
    } else {
      // Fallback: just insert mention with space if we can't find @
      editor
        .chain()
        .focus()
        .insertContent({
          type: "mention",
          attrs: {
            id: item.id,
            label: item.fullName || item.label || item.username,
            avatar: item.avatar || null,
          },
        })
        .insertContent(" ") // Insert space as plain text
        .run()
    }
    
    setShowMentionList(false)
    
    // Call Tiptap's selectItem if available to update its internal state
    if (props && typeof props.selectItem === 'function') {
      // Don't use props.selectItem as it might not use our command
      // But we can call it to close the suggestion properly
      props.hide?.()
    }
  }, [editor])

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const currentMarkdown = jsonToMarkdown(editor.getJSON())
      if (currentMarkdown !== value) {
        editor.commands.setContent(markdownToJSON(value))
      }
    }
  }, [value, editor])

  // Handle keydown - don't interfere with Tiptap's internal key handling
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Don't prevent default for @ key - let Tiptap handle it
      if (e.key === '@' || showMentionList) {
        return
      }
      
      if (onKeyDown) {
        const result = onKeyDown(e)
        if (result === false || e.defaultPrevented) {
          return
        }
      }
    },
    [onKeyDown, showMentionList]
  )

  if (!editor) return null

  return (
    <div
      className={cn(
        "w-full rounded-lg bg-white/10 border border-white/20",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={{
        minHeight: `${minHeight}px`,
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        overflowY: maxHeight ? "auto" : "visible",
      }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-white/10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => (editor.chain().focus() as any).toggleBold().run()}
          disabled={!(editor.can().chain().focus() as any).toggleBold().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive("bold") && "bg-white/20"
          )}
        >
          <Bold className="h-4 w-4 text-white/70" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => (editor.chain().focus() as any).toggleItalic().run()}
          disabled={!(editor.can().chain().focus() as any).toggleItalic().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive("italic") && "bg-white/20"
          )}
        >
          <Italic className="h-4 w-4 text-white/70" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => (editor.chain().focus() as any).toggleUnderline().run()}
          disabled={!(editor.can().chain().focus() as any).toggleUnderline().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive("underline") && "bg-white/20"
          )}
        >
          <UnderlineIcon className="h-4 w-4 text-white/70" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => (editor.chain().focus() as any).toggleStrike().run()}
          disabled={!(editor.can().chain().focus() as any).toggleStrike().run()}
          className={cn(
            "h-8 w-8 p-0",
            editor.isActive("strike") && "bg-white/20"
          )}
        >
          <Strikethrough className="h-4 w-4 text-white/70" />
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            editor.chain().focus().insertContent("@").run()
          }}
          className="h-8 w-8 p-0"
          title="Mention user"
        >
          <AtSign className="h-4 w-4 text-white/70" />
        </Button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Mention list */}
      {showMentionList && mentionItems.length > 0 && typeof window !== "undefined" && mentionPosition && createPortal(
        <div
          ref={mentionListRef}
          className="fixed z-[9999]"
          style={{
            top: `${mentionPosition.top + 20}px`,
            left: `${mentionPosition.left}px`,
          }}
        >
          <MentionList 
            items={mentionItems} 
            selectedIndex={selectedMentionIndex}
            onSelect={(item, index) => handleMentionSelect(item, index)} 
          />
        </div>,
        document.body
      )}
    </div>
  )
}

