# Recording Thumbnail Generation

This document explains how thumbnails are generated and stored for event recordings.

## Current Implementation

### 1. Stream.io Provided Thumbnails
The system first checks if Stream.io provides thumbnails with recordings. These are automatically:
- Detected from the recording data (`thumbnail_url`, `thumbnail`, or `thumbnails[0].url`)
- Downloaded from Stream.io
- Uploaded to Supabase Storage
- Saved to the database

### 2. Thumbnail Storage
- Thumbnails are stored in the same `event-recordings` bucket as videos
- File naming: `{eventId}/{streamRecordingId}-thumbnail-{timestamp}.jpg`
- Public URL is generated and saved to `thumbnail_url` in the database

## Future Enhancements

### Option 1: Server-Side FFmpeg Extraction
To generate thumbnails from videos when Stream.io doesn't provide them:

1. Install FFmpeg on your server:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install ffmpeg
   
   # macOS
   brew install ffmpeg
   ```

2. Install Node.js FFmpeg wrapper:
   ```bash
   pnpm add fluent-ffmpeg @types/fluent-ffmpeg
   ```

3. Update `src/app/api/recordings/save/route.ts` to extract frames:
   ```typescript
   import ffmpeg from 'fluent-ffmpeg'
   import { promisify } from 'util'
   import { writeFile, unlink } from 'fs/promises'
   import { tmpdir } from 'os'
   import { join } from 'path'
   
   // Extract thumbnail at 1 second into the video
   const tempVideoPath = join(tmpdir(), `${streamRecordingId}.mp4`)
   const tempThumbnailPath = join(tmpdir(), `${streamRecordingId}-thumb.jpg`)
   
   await writeFile(tempVideoPath, Buffer.from(await recordingBlob.arrayBuffer()))
   
   await new Promise((resolve, reject) => {
     ffmpeg(tempVideoPath)
       .screenshots({
         timestamps: ['00:00:01'],
         filename: `${streamRecordingId}-thumb.jpg`,
         folder: tmpdir(),
       })
       .on('end', resolve)
       .on('error', reject)
   })
   
   const thumbnailBuffer = await readFile(tempThumbnailPath)
   // Upload thumbnailBuffer to Supabase Storage
   ```

### Option 2: Client-Side Extraction
Generate thumbnails in the browser before uploading:

```typescript
function extractVideoThumbnail(videoBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    video.src = URL.createObjectURL(videoBlob)
    video.onloadedmetadata = () => {
      video.currentTime = 1 // 1 second into video
    }
    video.onseeked = () => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx?.drawImage(video, 0, 0)
      const thumbnailUrl = canvas.toDataURL('image/jpeg')
      resolve(thumbnailUrl)
    }
    video.onerror = reject
  })
}
```

### Option 3: Third-Party Service
Use a service like Cloudinary or AWS Lambda with FFmpeg:
- Upload video to processing service
- Service generates thumbnail
- Download and store thumbnail URL

## Configuration

Ensure your storage bucket allows image uploads:
- MIME types: `image/jpeg`, `image/png`, `image/webp`
- The migration file already includes these types

## Testing

To test thumbnail functionality:
1. Check server logs for `[Recording API] Thumbnail URL from Stream.io:`
2. Verify thumbnail appears in the recordings view
3. Check Supabase Storage bucket for thumbnail files

