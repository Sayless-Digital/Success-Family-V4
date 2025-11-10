declare module "plyr-react" {
  import * as React from "react"

  export interface PlyrSource {
    type: string
    sources: Array<{ src: string; type?: string }>
    poster?: string
  }

  export interface PlyrProps {
    source: PlyrSource
    options?: Record<string, unknown>
    onReady?: (event: any) => void
    onPlay?: (event: any) => void
    onPlaying?: (event: any) => void
    onPause?: (event: any) => void
    onWaiting?: (event: any) => void
    onCanPlay?: (event: any) => void
    onEnded?: (event: any) => void
    onError?: (event: any) => void
    className?: string
  }

  const Plyr: React.FC<PlyrProps>
  export default Plyr
}

declare module "plyr/dist/plyr.css"

