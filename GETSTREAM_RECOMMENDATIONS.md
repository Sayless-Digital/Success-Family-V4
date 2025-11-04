# GetStream SDK Features You Should Consider Adding

## Currently Using ✅
- ✅ `ParticipantView` - Video rendering
- ✅ `useCallStateHooks` - Basic participant state
- ✅ `useParticipants` - Get participants list
- ✅ `useParticipantCount` - Count participants
- ✅ `useLocalParticipant` - Local participant state
- ✅ Custom layouts (Speaker, Grid)

## Recommended Additions 🎯

### 1. **Connection Quality Indicators** ⚠️ HIGH PRIORITY
**Why:** Show network quality to users so they understand video/audio issues

```typescript
import { useConnectionQuality } from "@stream-io/video-react-sdk"

// In ParticipantVideo component:
const connectionQuality = useConnectionQuality(participant.sessionId)
// Returns: 'excellent' | 'good' | 'poor' | 'unsupported'

// Display indicator:
{connectionQuality === 'poor' && (
  <Badge className="bg-yellow-500/90 text-white text-xs">
    Poor Connection
  </Badge>
)}
```

### 2. **Dominant Speaker Detection** ⚠️ HIGH PRIORITY
**Why:** Automatically spotlight whoever is speaking (better UX than manual selection)

```typescript
import { useDominantSpeaker } from "@stream-io/video-react-sdk"

// In CustomSpeakerLayout:
const { useDominantSpeaker } = useCallStateHooks()
const dominantSpeaker = useDominantSpeaker()

// Automatically spotlight dominant speaker
const mainParticipant = dominantSpeaker || ownerParticipant || participants[0]
```

### 3. **Viewport Optimization** ⚠️ HIGH PRIORITY
**Why:** Better performance for large calls - only subscribe to visible videos

```typescript
// In CallContent component:
React.useEffect(() => {
  if (!call) return
  
  const viewport = document.getElementById('video-container')
  if (viewport) {
    const unset = call.setViewport(viewport)
    return () => unset?.()
  }
}, [call])
```

### 4. **Call State Management** ⚠️ MEDIUM PRIORITY
**Why:** Better error handling and call status tracking

```typescript
import { useCallState } from "@stream-io/video-react-sdk"

const { useCallState } = useCallStateHooks()
const callState = useCallState()
// Returns: call status, duration, errors, etc.

// Handle call errors
if (callState.status === 'failed') {
  // Show error message
}
```

### 5. **Screen Share State** ⚠️ MEDIUM PRIORITY
**Why:** Show when someone is sharing screen, adjust layout accordingly

```typescript
import { useScreenShareState } from "@stream-io/video-react-sdk"

const { useScreenShareState } = useCallStateHooks()
const screenShareState = useScreenShareState()

// Show screen share indicator
{screenShareState.screenShareStream && (
  <div>Screen sharing active</div>
)}
```

### 6. **Recording State** (if needed) ⚠️ LOW PRIORITY
**Why:** Show recording indicator if you plan to record streams

```typescript
import { useRecordingState } from "@stream-io/video-react-sdk"

const { useRecordingState } = useCallStateHooks()
const recordingState = useRecordingState()

{recordingState.status === 'recording' && (
  <Badge className="bg-red-500">Recording</Badge>
)}
```

### 7. **Participant Network Quality** ⚠️ MEDIUM PRIORITY
**Why:** Show individual participant connection quality

```typescript
// Each participant has a networkQuality property
const networkQuality = participant.networkQuality
// Returns: 'excellent' | 'good' | 'poor' | 'unsupported'

// Display per participant
{networkQuality === 'poor' && (
  <Tooltip content="Poor connection">
    <Signal className="h-4 w-4 text-yellow-500" />
  </Tooltip>
)}
```

### 8. **Error Boundaries** ⚠️ HIGH PRIORITY
**Why:** Better error handling for video rendering failures

```typescript
import { ErrorBoundary } from "@stream-io/video-react-sdk"

<ErrorBoundary onError={(error) => console.error(error)}>
  <ParticipantView participant={participant} />
</ErrorBoundary>
```

## Implementation Priority

### Phase 1 (Do Now) 🚨
1. **Viewport Optimization** - Better performance
2. **Connection Quality Indicators** - Better UX
3. **Error Boundaries** - Better reliability

### Phase 2 (Soon) 📅
4. **Dominant Speaker Detection** - Better UX
5. **Call State Management** - Better error handling
6. **Participant Network Quality** - Better UX

### Phase 3 (If Needed) 📋
7. **Screen Share State** - If screen sharing is important
8. **Recording State** - If recording is needed

## Code Examples

See attached code snippets for each feature above.

