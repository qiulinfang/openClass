declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.gif' {
  const src: string
  export default src
}

declare global {
  interface Window {
    onMediaProjectionPermissionResult?: (granted: boolean) => void
  }
}

export {}
