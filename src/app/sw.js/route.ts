import { NextResponse } from "next/server"

const swSource = `
  self.addEventListener("install", () => {
    self.skipWaiting();
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.map((key) => caches.delete(key)))
      )
    );
    self.clients.claim();
  });

  self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const request = new Request(event.request, { cache: "no-store" });

    event.respondWith(
      fetch(request).catch(() => fetch(event.request))
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