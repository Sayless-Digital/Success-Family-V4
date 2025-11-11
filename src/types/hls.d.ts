declare module "hls.js" {
  export interface HlsConfig {
    autoStartLoad?: boolean
  }

  export default class Hls {
    static isSupported(): boolean

    constructor(config?: HlsConfig)

    attachMedia(media: HTMLVideoElement): void
    detachMedia(): void
    loadSource(sourceUrl: string): void
    stopLoad(): void
    destroy(): void
  }
}





