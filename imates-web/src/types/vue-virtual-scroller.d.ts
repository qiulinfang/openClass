declare module 'vue-virtual-scroller' {
  import type { DefineComponent } from 'vue'
  export const RecycleScroller: DefineComponent
  export const DynamicScroller: DefineComponent
  export const DynamicScrollerItem: DefineComponent
}

declare module 'markdown-it-katex' {
  const plugin: any
  export default plugin
}