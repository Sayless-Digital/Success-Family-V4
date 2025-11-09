import { NextResponse } from "next/server"

const swSource = `
  const CACHE = "success-family-cache-v1";
  const PRECACHE_URLS = ["/", "/manifest.webmanifest"];

  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
        )
      )
    );
    self.clients.claim();
  });

  self.addEventListener("fetch", (event) => {
    const { request } = event;

    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/supabase")) return;

    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        });
      })
    );
  });
`

export async function GET() {
  return new NextResponse(swSource, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  })
}