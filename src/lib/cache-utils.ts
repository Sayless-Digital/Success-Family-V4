/**
 * Cache clearing utilities for troubleshooting mobile auth issues
 * These functions help resolve sign-in problems caused by corrupted cache or storage
 */

/**
 * Clear all caches, storage, and service workers
 * Useful for troubleshooting mobile sign-in issues
 */
export async function clearAllCache(): Promise<{
  success: boolean
  errors: string[]
  cleared: {
    serviceWorkers: boolean
    caches: boolean
    localStorage: boolean
    sessionStorage: boolean
    indexedDB: boolean
  }
}> {
  const result = {
    success: true,
    errors: [] as string[],
    cleared: {
      serviceWorkers: false,
      caches: false,
      localStorage: false,
      sessionStorage: false,
      indexedDB: false,
    },
  }

  // Unregister all service workers
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((reg) => reg.unregister()))
      result.cleared.serviceWorkers = true
    } catch (error) {
      result.success = false
      result.errors.push(`Service worker: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Clear all caches
  if (typeof caches !== 'undefined') {
    try {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))
      result.cleared.caches = true
    } catch (error) {
      result.success = false
      result.errors.push(`Caches: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Clear localStorage (but preserve critical auth state if needed)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Don't clear everything - preserve some settings
      // Only clear auth-related storage that might be corrupted
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('auth') || key.includes('remember') || key.includes('supabase'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))
      result.cleared.localStorage = true
    } catch (error) {
      result.success = false
      result.errors.push(`localStorage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Clear sessionStorage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.clear()
      result.cleared.sessionStorage = true
    } catch (error) {
      result.success = false
      result.errors.push(`sessionStorage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Clear IndexedDB
  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    try {
      const databases = await indexedDB.databases()
      await Promise.all(
        databases.map((db) => {
          if (db.name) {
            return new Promise<void>((resolve, reject) => {
              const deleteReq = indexedDB.deleteDatabase(db.name!)
              deleteReq.onsuccess = () => resolve()
              deleteReq.onerror = () => reject(deleteReq.error)
              deleteReq.onblocked = () => {
                // Database is in use, wait a bit and retry
                setTimeout(() => {
                  const retryReq = indexedDB.deleteDatabase(db.name!)
                  retryReq.onsuccess = () => resolve()
                  retryReq.onerror = () => reject(retryReq.error)
                }, 1000)
              }
            })
          }
          return Promise.resolve()
        })
      )
      result.cleared.indexedDB = true
    } catch (error) {
      result.success = false
      result.errors.push(`IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return result
}

/**
 * Clear only auth-related cache and storage
 * Safer than clearing everything - preserves user preferences
 */
export async function clearAuthCache(): Promise<{
  success: boolean
  errors: string[]
}> {
  const result = {
    success: true,
    errors: [] as string[],
  }

  // Clear auth-related localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('auth') || key.includes('remember') || key.includes('supabase'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))
    } catch (error) {
      result.success = false
      result.errors.push(`localStorage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Clear sessionStorage (often used for auth state)
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      sessionStorage.clear()
    } catch (error) {
      result.success = false
      result.errors.push(`sessionStorage: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return result
}

/**
 * Force service worker update
 * Useful when service worker is stuck on an old version
 */
export async function forceServiceWorkerUpdate(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.update()
    return true
  } catch (error) {
    console.error('Failed to update service worker:', error)
    return false
  }
}

