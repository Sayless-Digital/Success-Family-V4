import { NextResponse } from "next/server"

// Generate version based on build time or current timestamp
const SW_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || Date.now().toString()

const swSource = `
  const SW_VERSION = "${SW_VERSION}";
  const CACHE_NAME = "success-family-v" + SW_VERSION;

  // Force immediate activation and skip waiting
  self.addEventListener("install", (event) => {
    console.log("[SW] Installing service worker version:", SW_VERSION);
    self.skipWaiting();
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        // Delete all old caches
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log("[SW] Deleting old cache:", name);
              return caches.delete(name);
            })
        );
      })
    );
  });

  self.addEventListener("activate", (event) => {
    console.log("[SW] Activating service worker version:", SW_VERSION);
    event.waitUntil(
      Promise.all([
        // Delete all old caches
        caches.keys().then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((name) => name !== CACHE_NAME)
              .map((name) => {
                console.log("[SW] Deleting old cache:", name);
                return caches.delete(name);
              })
          )
        ),
        // Take control of all clients immediately
        self.clients.claim(),
      ]).then(() => {
        // Notify all clients about the update
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "SW_UPDATED",
              version: SW_VERSION,
            });
          });
        });
      })
    );
  });

  // Network-first strategy with no caching
  self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    // Always fetch from network, never cache
    event.respondWith(
      fetch(event.request, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      })
        .then((response) => {
          // Clone the response before returning
          return response;
        })
        .catch((error) => {
          console.error("[SW] Fetch failed:", error);
          // Fallback to network request without cache headers
          return fetch(event.request);
        })
    );
  });

  // Check for updates every time the service worker is accessed
  self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
      self.skipWaiting();
    }
    if (event.data && event.data.type === "CHECK_UPDATE") {
      // Force update check
      self.registration.update();
    }
  });
`

export async function GET() {
  return new NextResponse(swSource, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  })
}