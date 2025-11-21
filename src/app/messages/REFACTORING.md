# Messages View Refactoring

This document outlines the refactoring of the large `messages-view.tsx` file (4306 lines) into smaller, more maintainable components.

## Created Components

### 1. **Types** (`types.ts`)
- `ViewerProfile` - User profile type
- `AttachmentState` - Attachment state management
- `ThreadPaginationState` - Pagination state

### 2. **Utils** (`utils.ts`)
- `getDisplayName()` - Get display name from profile
- `getInitials()` - Get initials from profile
- `storagePathToObjectPath()` - Convert storage path to object path
- `formatTimestamp()` - Format timestamp for display

### 3. **Hooks** (`hooks/use-swipe-to-reply.ts`)
- `useSwipeToReply()` - Handles swipe-to-reply functionality for mobile

### 4. **Components**

#### `components/reply-indicator.tsx`
- Visual indicator shown during swipe-to-reply

#### `components/message-item.tsx`
- Individual message rendering
- Handles attachments (images, videos, audio, files)
- Reply functionality
- Delete functionality
- Long press menu
- Swipe-to-reply integration

#### `components/message-composer.tsx`
- Message input area
- Attachment management
- Voice note recording
- Emoji picker integration
- Reply preview

#### `components/conversation-list.tsx`
- List of all conversations
- Search functionality
- Unread indicators
- Typing indicators
- Presence indicators

#### `components/conversation-header.tsx`
- Header for active conversation
- Peer profile display
- Back button (mobile)

#### `components/message-list.tsx`
- Container for messages
- Load older messages button
- Image lightbox integration
- Scroll management

## Next Steps

To complete the refactoring:

1. **Update `messages-view.tsx`** to:
   - Import all new components
   - Replace inline JSX with component calls
   - Keep all business logic (state, effects, handlers)
   - Pass props to components

2. **Create additional hooks** (optional):
   - `useMessageHandlers` - Send, delete, reply handlers
   - `useConversations` - Conversation management
   - `useTypingIndicator` - Typing indicator logic
   - `useRealtimeMessages` - Realtime subscription logic

3. **Test thoroughly**:
   - All message operations
   - Swipe-to-reply
   - Image lightbox
   - Voice notes
   - File attachments
   - Real-time updates

## Benefits

- **Reduced file size**: Main file will be ~2000-2500 lines instead of 4306
- **Better maintainability**: Each component has a single responsibility
- **Reusability**: Components can be reused elsewhere
- **Easier testing**: Components can be tested in isolation
- **Better organization**: Related code is grouped together

