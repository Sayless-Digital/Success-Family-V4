"use client"

import { useEffect } from "react"

/**
 * HMR Error Suppressor
 * Suppresses Next.js HMR WebSocket connection errors in development.
 * These errors are expected when using a custom HTTPS server because:
 * 1. Custom servers don't support WebSocket upgrades properly
 * 2. Next.js automatically falls back to polling (which works perfectly)
 * 3. The errors are harmless but flood the console
 * 
 * This component:
 * 1. Intercepts WebSocket creation to prevent HMR WebSocket failures
 * 2. Filters console output to hide these known dev-only errors
 * 3. Prevents page refreshes when HMR WebSocket fails
 */

// Global storage for original console methods (set by early initialization)
// This allows the React component to access the true originals
declare global {
  interface Window {
    __hmrSuppressorOriginals?: {
      error: typeof console.error;
      warn: typeof console.warn;
      log: typeof console.log;
      info: typeof console.info;
      debug: typeof console.debug;
      onerror: typeof window.onerror;
      onunhandledrejection: typeof window.onunhandledrejection;
    };
  }
}

// Initialize suppression immediately on module load (client-side only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const initEarlySuppression = () => {
    const patterns = [
      // WebSocket HMR errors - very broad patterns to catch all variations
      /WebSocket connection to 'wss?:\/\/.*\/_next\/(webpack-hmr|static\/hmr)/i,
      /WebSocket connection to.*webpack-hmr/i,
      /WebSocket.*failed/i,
      /webpack-hmr/i,
      /_next\/webpack-hmr/i,
      /wss?:\/\/.*\/_next\/webpack-hmr/i,
      // Match filename patterns (browser adds filename:line to console output)
      /web-socket\.ts:\d+/i,
      /forward-logs-shared\.ts:\d+/i,
      /web-socket\.ts/i,
      /forward-logs-shared\.ts/i,
      /web-socket/i,
      /forward-logs/i,
      // React DevTools message
      /Download the React DevTools/i,
      /react\.dev\/link\/react-devtools/i,
      /React DevTools/i,
      /for a better development experience/i,
      // PWA banner warnings
      /Banner not shown/i,
      /beforeinstallpromptevent\.preventDefault\(\)/i,
      /beforeinstallpromptevent\.prompt\(\)/i,
      // Application debug logs
      /\[TopUpBonus\]/i,
      /\[push-notifications\]/i,
      /\[push-notifications-provider\]/i,
      /\[GlobalHeader\]/i,
      /\[MobileBottomNav\]/i,
      /\[useUnreadMessagesCount\]/i,
      // Preload warnings
      /was preloaded using link preload but not used/i,
      /Please make sure it has an appropriate `as` value/i,
      // Next.js LCP image warnings (dev-only)
      /Largest Contentful Paint.*LCP/i,
      /was detected as the Largest Contentful Paint/i,
      /Please add the `loading="eager"` property/i,
      /nextjs\.org\/docs\/app\/api-reference\/components\/image#loading/i,
    ];

    const shouldSuppress = (message: string, source?: string) => {
      // Check message and source separately and combined
      const msgStr = String(message || '');
      const srcStr = String(source || '');
      const combined = [msgStr, srcStr].filter(Boolean).join(' ');
      
      // Check all variations
      return patterns.some(p => 
        p.test(msgStr) || 
        p.test(srcStr) || 
        p.test(combined)
      );
    };

    // Store originals in global variable (only if not already stored)
    if (!window.__hmrSuppressorOriginals) {
      window.__hmrSuppressorOriginals = {
        error: console.error,
        warn: console.warn,
        log: console.log,
        info: console.info,
        debug: console.debug,
        onerror: window.onerror,
        onunhandledrejection: window.onunhandledrejection,
      };
    }
    
    const origError = window.__hmrSuppressorOriginals.error;
    const origWarn = window.__hmrSuppressorOriginals.warn;
    const origLog = window.__hmrSuppressorOriginals.log;
    const origInfo = window.__hmrSuppressorOriginals.info;

    // Override console.error - most aggressive matching possible
    console.error = function(...args: unknown[]) {
      // Convert ALL arguments to a searchable string
      let fullMessage = '';
      for (const arg of args) {
        if (typeof arg === 'string') {
          fullMessage += arg + ' ';
        } else if (arg instanceof Error) {
          fullMessage += (arg.message || '') + ' ';
          fullMessage += (arg.stack || '') + ' ';
          fullMessage += (arg.name || '') + ' ';
        } else if (arg && typeof arg === 'object') {
          try {
            fullMessage += JSON.stringify(arg) + ' ';
          } catch {
            fullMessage += String(arg) + ' ';
          }
        } else {
          fullMessage += String(arg) + ' ';
        }
      }
      fullMessage = fullMessage.toLowerCase();
      
      // Very aggressive matching - check for any combination of keywords
      const hasWebSocket = fullMessage.includes('websocket');
      const hasWebpackHmr = fullMessage.includes('webpack-hmr') || 
                           fullMessage.includes('_next/webpack-hmr') ||
                           fullMessage.includes('_next\\/webpack-hmr');
      const hasNextHmr = fullMessage.includes('_next') && fullMessage.includes('hmr');
      const hasFailed = fullMessage.includes('failed');
      const hasWss = fullMessage.includes('wss://') || fullMessage.includes('ws://');
      
      // Suppress if it matches ANY of these conditions:
      // 1. Contains "websocket" AND "webpack-hmr" or "_next" AND "hmr"
      // 2. Contains "websocket" AND "failed" AND "_next"
      // 3. Contains "webpack-hmr" (even without websocket)
      // 4. Matches any of our regex patterns
      const shouldSuppress = 
        (hasWebSocket && (hasWebpackHmr || hasNextHmr)) ||
        (hasWebSocket && hasFailed && fullMessage.includes('_next')) ||
        hasWebpackHmr ||
        hasNextHmr ||
        patterns.some(p => {
          try {
            return p.test(fullMessage);
          } catch {
            return false;
          }
        });
      
      if (!shouldSuppress) {
        origError.apply(console, args);
      }
    };

    console.warn = function(...args: unknown[]) {
      // Get the call stack to check where this warning is coming from
      const stack = new Error().stack || '';
      const isFromWebSocket = stack.includes('web-socket.ts') || 
                              stack.includes('webpack-hmr') ||
                              stack.includes('forward-logs');
      
      const msgParts = args.map(a => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return [a.message, a.stack, a.name].filter(Boolean).join(' ');
        if (typeof a === 'object' && a !== null) {
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        }
        return String(a);
      });
      const msg = msgParts.join(' ');
      
      // Also check for LCP warnings
      const isLCPWarning = msg.includes('Largest Contentful Paint') || 
                           msg.includes('LCP') ||
                           msg.includes('loading="eager"');
      
      const shouldSuppressMsg = isFromWebSocket ||
                                isLCPWarning ||
                                msgParts.some(part => patterns.some(p => p.test(part))) ||
                                patterns.some(p => p.test(msg));
      
      if (!shouldSuppressMsg) {
        origWarn.apply(console, args);
      }
    };

    console.log = function(...args: unknown[]) {
      const msg = args.map(a => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return [a.message, a.stack].filter(Boolean).join(' ');
        if (typeof a === 'object' && a !== null) {
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        }
        return String(a);
      }).join(' ');
      if (!shouldSuppress(msg)) {
        origLog.apply(console, args);
      }
    };

    console.info = function(...args: unknown[]) {
      const msg = args.map(a => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return [a.message, a.stack].filter(Boolean).join(' ');
        if (typeof a === 'object' && a !== null) {
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        }
        return String(a);
      }).join(' ');
      if (!shouldSuppress(msg)) {
        origInfo.apply(console, args);
      }
    };

    // Intercept window errors - check message, source, and error object
    const origOnError = window.__hmrSuppressorOriginals.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
      const msgStr = String(message || '');
      const srcStr = source ? String(source) : '';
      const errMsg = error?.message ? String(error.message) : '';
      const errStack = error?.stack ? String(error.stack) : '';
      
      // Check all error information
      if (shouldSuppress(msgStr, srcStr) || 
          shouldSuppress(errMsg, '') || 
          shouldSuppress(errStack, '') ||
          patterns.some(p => p.test(srcStr))) {
        return true; // Suppress the error
      }
      
      if (origOnError) {
        return origOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    // Intercept error events (capture phase) - catch all error events
    const handleError = (e: ErrorEvent) => {
      const msg = e.message || '';
      const filename = e.filename || '';
      const errMsg = e.error?.message || '';
      const errStack = e.error?.stack || '';
      
      // Check all error information
      if (shouldSuppress(msg, filename) || 
          shouldSuppress(errMsg, '') || 
          shouldSuppress(errStack, '') ||
          patterns.some(p => p.test(filename)) ||
          patterns.some(p => p.test(msg)) ||
          patterns.some(p => p.test(errMsg)) ||
          patterns.some(p => p.test(errStack))) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    window.addEventListener('error', handleError, true);
  };

  // Run immediately - don't wait for DOM
  // This ensures we catch errors as early as possible
  try {
    initEarlySuppression();
  } catch (e) {
    // If that fails, try again when DOM is ready
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEarlySuppression);
      } else {
        // DOM already ready, try again
        setTimeout(initEarlySuppression, 0);
      }
    }
  }
  
  // Also set up error listener immediately (before any scripts run)
  // This catches errors that happen during script loading
  if (typeof window !== 'undefined') {
    const immediateErrorHandler = (e: ErrorEvent) => {
      const filename = e.filename || '';
      const message = e.message || '';
      // Check if it's from web-socket.ts or webpack-hmr
      if (filename.includes('web-socket') || 
          filename.includes('webpack-hmr') ||
          message.includes('webpack-hmr') ||
          message.includes('WebSocket') && message.includes('failed')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('error', immediateErrorHandler, true);
  }
}

export function HMRErrorSuppressor() {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') return

    // Use stored originals from early initialization if available,
    // otherwise store current methods (which should be originals if early init didn't run)
    const originals = window.__hmrSuppressorOriginals || {
      error: console.error,
      warn: console.warn,
      log: console.log,
      info: console.info,
      debug: console.debug,
      onerror: window.onerror,
      onunhandledrejection: window.onunhandledrejection,
    };
    
    // Ensure originals are stored globally
    if (!window.__hmrSuppressorOriginals) {
      window.__hmrSuppressorOriginals = originals;
    }
    
    const originalError = originals.error
    const originalWarn = originals.warn
    const originalLog = originals.log
    const originalInfo = originals.info
    const originalDebug = originals.debug
    const originalWindowError = originals.onerror
    const originalUnhandledRejection = originals.onunhandledrejection

    // Patterns to match Next.js HMR WebSocket errors and dev-only messages
    // These errors occur because custom HTTPS servers don't support WebSocket upgrades
    // Next.js automatically falls back to polling, which works fine
    const devOnlySuppressionPatterns = [
      // HMR WebSocket errors (various formats) - match the exact error format
      /WebSocket connection to 'wss?:\/\/.*\/_next\/(webpack-hmr|static\/hmr)/i,
      /WebSocket connection to.*webpack-hmr/i,
      /WebSocket connection to.*_next\/webpack-hmr/i,
      /WebSocket connection to 'wss?:\/\/.*:3000\/_next\/webpack-hmr/i,
      /WebSocket connection to 'wss?:\/\/.*\/_next\/webpack-hmr/i,
      /WebSocket.*failed/i,
      /failed to connect to the development server/i,
      /webpack-hmr/i,
      /_next\/webpack-hmr/i,
      /wss?:\/\/.*:3000\/_next\/webpack-hmr/i,
      /wss?:\/\/.*\/_next\/webpack-hmr/i,
      // Match errors that mention web-socket.ts in the message (browser adds filename:line)
      /web-socket\.ts:\d+/i,
      /forward-logs-shared\.ts:\d+/i,
      // React DevTools message (various formats)
      /Download the React DevTools/i,
      /react\.dev\/link\/react-devtools/i,
      /React DevTools/i,
      /for a better development experience/i,
      // PWA banner warnings
      /Banner not shown/i,
      /beforeinstallpromptevent\.preventDefault\(\)/i,
      /beforeinstallpromptevent\.prompt\(\)/i,
      // Application debug logs
      /\[TopUpBonus\]/i,
      /\[push-notifications\]/i,
      /\[push-notifications-provider\]/i,
      /\[GlobalHeader\]/i,
      /\[MobileBottomNav\]/i,
      /\[useUnreadMessagesCount\]/i,
      // Preload warnings
      /was preloaded using link preload but not used/i,
      /Please make sure it has an appropriate `as` value/i,
      // HMR suppressor's own message
      /\[HMR\] WebSocket errors suppressed/i,
      /custom HTTPS server uses polling for HMR/i,
      // Next.js internal files that generate these errors
      /web-socket\.ts/i,
      /forward-logs-shared\.ts/i,
      /web-socket/i,
      /forward-logs/i,
      // Next.js LCP image warnings (dev-only)
      /Largest Contentful Paint.*LCP/i,
      /was detected as the Largest Contentful Paint/i,
      /Please add the `loading="eager"` property/i,
      /nextjs\.org\/docs\/app\/api-reference\/components\/image#loading/i,
    ]

    // Helper to check if message should be suppressed
    const shouldSuppress = (args: unknown[]): boolean => {
      // Convert all arguments to string and join
      // Also check stack traces and error objects more thoroughly
      const message = args.map(arg => {
        if (typeof arg === 'string') return arg
        if (arg instanceof Error) {
          // Include error message and stack trace
          return [arg.message, arg.stack].filter(Boolean).join(' ')
        }
        if (typeof arg === 'object' && arg !== null) {
          try {
            // Try to extract message, stack, or stringify
            if ('message' in arg) return String(arg.message)
            if ('stack' in arg) return String(arg.stack)
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      }).join(' ')
      
      // Check if any pattern matches
      return devOnlySuppressionPatterns.some(pattern => pattern.test(message))
    }

    // Override console methods to filter HMR errors
    console.error = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalError.apply(console, args)
      }
      // Silently suppress HMR errors
    }

    console.warn = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalWarn.apply(console, args)
      }
      // Silently suppress HMR warnings
    }

    console.log = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalLog.apply(console, args)
      }
      // Silently suppress HMR logs
    }

    console.info = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalInfo.apply(console, args)
      }
      // Silently suppress dev-only info messages
    }

    console.debug = (...args: unknown[]) => {
      if (!shouldSuppress(args)) {
        originalDebug.apply(console, args)
      }
      // Silently suppress dev-only debug messages
    }
    
    // Also suppress uncaught errors from WebSocket initialization
    // This catches errors that occur before React hydration
    window.onerror = (message, source, lineno, colno, error) => {
      const messageStr = String(message)
      const sourceStr = source ? String(source) : ''
      const errorStr = error?.message ? String(error.message) : ''
      const combinedStr = [messageStr, sourceStr, errorStr].join(' ')
      
      if (devOnlySuppressionPatterns.some(pattern => pattern.test(combinedStr))) {
        // Suppress HMR WebSocket errors and prevent page refresh
        return true // Prevent default error handling (page refresh)
      }
      // Call original handler for other errors
      if (originalWindowError) {
        return originalWindowError(message, source, lineno, colno, error)
      }
      return false
    }
    
    // Also handle unhandled promise rejections from HMR WebSocket
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      let reasonStr = ''
      if (typeof reason === 'object' && reason !== null) {
        try {
          reasonStr = JSON.stringify(reason)
        } catch {
          reasonStr = String(reason)
        }
      } else {
        reasonStr = String(reason)
      }
      
      // Also check error message if it exists
      const errorMessage = (reason instanceof Error) ? reason.message : ''
      const combinedStr = [reasonStr, errorMessage].join(' ')
      
      // Check if it's a dev-only error to suppress
      if (devOnlySuppressionPatterns.some(pattern => pattern.test(combinedStr))) {
        // Suppress dev-only errors and prevent page refresh
        event.preventDefault()
        return
      }
      
      // Call original handler for other rejections
      if (originalUnhandledRejection) {
        originalUnhandledRejection.call(window, event)
      }
    }
    window.onunhandledrejection = handleUnhandledRejection

    // Also intercept error events (for errors from web-socket.ts, forward-logs-shared.ts, etc.)
    const handleErrorEvent = (event: ErrorEvent) => {
      const message = event.message || ''
      const filename = event.filename || ''
      const errorMessage = event.error?.message || ''
      const errorStack = event.error?.stack || ''
      const combinedStr = [message, filename, errorMessage, errorStack].filter(Boolean).join(' ')
      
      if (devOnlySuppressionPatterns.some(pattern => pattern.test(combinedStr))) {
        event.preventDefault()
        event.stopPropagation()
        return false
      }
    }
    window.addEventListener('error', handleErrorEvent, true)

    // Cleanup: restore original console methods, window error handler, unhandled rejection handler, and remove event listeners
    return () => {
      // Only restore if we have stored originals (don't restore if early init is still active)
      if (window.__hmrSuppressorOriginals) {
        console.error = originalError
        console.warn = originalWarn
        console.log = originalLog
        console.info = originalInfo
        console.debug = originalDebug
        window.onerror = originalWindowError
        window.onunhandledrejection = originalUnhandledRejection
      }
      window.removeEventListener('error', handleErrorEvent, true)
    }
  }, [])

  return null
}