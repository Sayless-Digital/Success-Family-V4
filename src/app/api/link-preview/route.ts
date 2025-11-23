import { NextRequest, NextResponse } from "next/server"

export interface LinkPreview {
  url: string
  title?: string
  description?: string
  image?: string
  siteName?: string
}

/**
 * Server-side API route to fetch link previews
 * Parses Open Graph tags and meta tags from URLs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      )
    }

    // Validate URL format
    let targetUrl: URL
    try {
      targetUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      )
    }

    // Only allow http/https protocols
    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP/HTTPS URLs are allowed" },
        { status: 400 }
      )
    }

    // Fetch the URL
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LinkPreviewBot/1.0)",
        },
        redirect: "follow",
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()

      // Parse Open Graph and meta tags
      const preview: LinkPreview = {
        url: targetUrl.href,
      }

      // Extract title (OG title, twitter title, or meta title)
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)
      const twitterTitleMatch = html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i)
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)

      if (ogTitleMatch?.[1]) {
        preview.title = ogTitleMatch[1].trim()
      } else if (twitterTitleMatch?.[1]) {
        preview.title = twitterTitleMatch[1].trim()
      } else if (titleMatch?.[1]) {
        preview.title = titleMatch[1].trim()
      }

      // Extract description (OG description, twitter description, or meta description)
      const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
      const twitterDescMatch = html.match(/<meta\s+name=["']twitter:description["']\s+content=["']([^"']+)["']/i)
      const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)

      if (ogDescMatch?.[1]) {
        preview.description = ogDescMatch[1].trim().substring(0, 200) // Limit length
      } else if (twitterDescMatch?.[1]) {
        preview.description = twitterDescMatch[1].trim().substring(0, 200)
      } else if (metaDescMatch?.[1]) {
        preview.description = metaDescMatch[1].trim().substring(0, 200)
      }

      // Extract image (OG image, twitter image)
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
      const twitterImageMatch = html.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i)

      if (ogImageMatch?.[1]) {
        const imageUrl = ogImageMatch[1].trim()
        // Resolve relative URLs
        preview.image = new URL(imageUrl, targetUrl.href).href
      } else if (twitterImageMatch?.[1]) {
        const imageUrl = twitterImageMatch[1].trim()
        preview.image = new URL(imageUrl, targetUrl.href).href
      }

      // Extract site name
      const ogSiteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i)
      if (ogSiteMatch?.[1]) {
        preview.siteName = ogSiteMatch[1].trim()
      } else {
        // Fallback to domain name
        preview.siteName = targetUrl.hostname.replace(/^www\./, "")
      }

      return NextResponse.json(preview)
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      if (fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timeout" },
          { status: 408 }
        )
      }

      throw fetchError
    }
  } catch (error: any) {
    console.error("Link preview error:", error)
    return NextResponse.json(
      { error: "Failed to fetch link preview", details: error.message },
      { status: 500 }
    )
  }
}




