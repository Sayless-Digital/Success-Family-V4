/**
 * Extract a thumbnail frame from a video URL
 * Uses HTML5 video element and canvas to extract a frame
 */
export async function extractVideoThumbnail(videoUrl: string, timeSeconds: number = 1): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }

    // Try with CORS first
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    video.muted = true // Required for autoplay policies
    video.playsInline = true
    
    let timeoutId: NodeJS.Timeout | null = null
    let hasResolved = false
    let retryAttempted = false
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      video.src = ''
      video.load()
    }
    
    const tryExtract = () => {
      try {
        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Convert to data URL (JPEG)
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8)
        if (!hasResolved) {
          hasResolved = true
          cleanup()
          resolve(thumbnailDataUrl)
        }
      } catch (error: any) {
        if (!hasResolved && !retryAttempted) {
          retryAttempted = true
          cleanup()
          // If CORS error, try without crossOrigin
          if (error.message?.includes('cross-origin') || error.name === 'SecurityError') {
            video.crossOrigin = null
            video.src = videoUrl
            video.load()
          } else {
            reject(error)
          }
        } else if (!hasResolved) {
          cleanup()
          reject(error)
        }
      }
    }
    
    video.onloadedmetadata = () => {
      try {
        // Set canvas dimensions to video dimensions
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        
        // Seek to the desired time (or start if duration is very short)
        const seekTime = video.duration ? Math.min(timeSeconds, video.duration - 0.1) : 0
        video.currentTime = seekTime
      } catch (error) {
        if (!hasResolved) {
          cleanup()
          reject(error)
        }
      }
    }
    
    video.onseeked = () => {
      tryExtract()
    }
    
    video.onerror = () => {
      if (!hasResolved && !retryAttempted && video.crossOrigin === 'anonymous') {
        retryAttempted = true
        cleanup()
        // Try without CORS
        video.crossOrigin = null
        video.src = videoUrl
        video.load()
      } else if (!hasResolved) {
        cleanup()
        reject(new Error('Failed to load video for thumbnail extraction (CORS or network issue)'))
      }
    }
    
    // Set timeout to avoid hanging
    timeoutId = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true
        cleanup()
        reject(new Error('Thumbnail extraction timeout'))
      }
    }, 15000)
    
    video.src = videoUrl
  })
}

/**
 * Convert data URL to blob for upload
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  
  return new Blob([u8arr], { type: mime })
}

