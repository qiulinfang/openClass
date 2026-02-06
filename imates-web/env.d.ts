/// <reference types="vite/client" />

declare module '/icons/goback.svg' {
  const src: string
  export default src
}

declare module '/icons/textbookip.svg' {
  const src: string
  export default src
}

declare module '/icons/wodezuoda_select.svg' {
  const src: string
  export default src
}

declare module '/icons/wodezuoda_unselect.svg' {
  const src: string
  export default src
}

declare module '/icons/xuebandayi_select.svg' {
  const src: string
  export default src
}

declare module '/icons/xuebandayi_unselect.svg' {
  const src: string
  export default src
}

declare module '/icons/caogaoben_select.svg' {
  const src: string
  export default src
}

declare module '/icons/caogaoben_unselect.svg' {
  const src: string
  export default src
}

declare module '/icons/screenshot.svg' {
  const src: string
  export default src
}

declare module 'pdfjs-dist/build/pdf.worker?url' {
  const src: string
  export default src
}

declare module 'mupdf' {
  export type Matrix = [number, number, number, number, number, number]
  export type Point = any
  export type PDFPage = any

  export const ColorSpace: {
    DeviceRGB: any
  }

  export class Pixmap {
    getPixels(): ArrayBuffer | Uint8Array
    getWidth(): number
    getHeight(): number
    destroy(): void
  }

  export class Page {
    getBounds(): [number, number, number, number]
    toPixmap(matrix: Matrix, colorspace: any, alpha: boolean, antialias?: boolean): Pixmap
    destroy(): void
  }

  export class Document {
    static openDocument(data: Uint8Array, mime: string): Document
    countPages(): number
    loadPage(index: number): Page
    asPDF(): any
    destroy(): void
  }
}
