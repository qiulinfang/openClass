import type { Directive, DirectiveBinding } from 'vue'

type PasteHandler = (dataUrl: string) => void

type PasteToDraftBindingValue =
  | PasteHandler
  | {
      onPaste: PasteHandler
      label?: string
      enabled?: boolean
    }

type InternalState = {
  observer?: MutationObserver
  scheduled?: number
}

const STATE_KEY = '__paste_to_draft_state__'
const STYLE_ID = '__paste_to_draft_style__'

function ensureDirectiveStyleInjected() {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.image-message-wrapper{position:relative;display:inline-block;max-width:100%}
.paste-to-draft-btn{position:absolute;top:10px;right:10px;background:rgba(34,34,34,.7);color:#fff;border:none;border-radius:10px;padding:6px 10px;font-size:12px;line-height:1;cursor:pointer;z-index:2;transition:background .12s ease,transform .12s ease}
.paste-to-draft-btn:hover{background:rgba(34,34,34,.85)}
.paste-to-draft-btn:active{transform:scale(.98)}
img.markdown-image{max-width:100%;height:auto;display:block}
`
  document.head.appendChild(style)
}

function getBindingConfig(binding: DirectiveBinding<PasteToDraftBindingValue>) {
  const v = binding.value
  if (typeof v === 'function') {
    return { onPaste: v, label: '贴到草稿本', enabled: undefined }
  }
  return {
    onPaste: v?.onPaste,
    label: v?.label || '贴到草稿本',
    enabled: typeof v?.enabled === 'boolean' ? v.enabled : undefined,
  }
}

function isDirectiveEnabled(binding: DirectiveBinding<PasteToDraftBindingValue>): boolean {
  const { enabled } = getBindingConfig(binding)
  // 优先使用传入的 enabled 参数，默认不启用
  return enabled === true
}

function scanAndEnhance(container: HTMLElement, binding: DirectiveBinding<PasteToDraftBindingValue>) {
  if (!isDirectiveEnabled(binding)) return

  ensureDirectiveStyleInjected()

  const { onPaste, label } = getBindingConfig(binding)
  if (typeof onPaste !== 'function') return

  const allImages = container.querySelectorAll('img')
  allImages.forEach((img) => {
    const mathContainer = img.closest('.mjx-chtml, .mjx-math, [data-mjx-texclass]')
    if (mathContainer) return

    // 跳过 HTML 预览卡片图片，避免 position: absolute 产生 0x0 塌陷
    if (img.classList.contains('html-card-img') || img.closest('.html-card-content')) return

    const existingWrapper = img.closest('.image-message-wrapper')
    if (existingWrapper) return

    const alreadyProcessed = (img as HTMLImageElement).dataset?.pasteToDraftProcessed
    if (alreadyProcessed === '1') return

    img.classList.add('markdown-image')

    const wrapper = document.createElement('div')
    wrapper.className = 'image-message-wrapper'

    const btn = document.createElement('button')
    btn.className = 'paste-to-draft-btn'
    btn.type = 'button'
    btn.textContent = label
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const src = (img as HTMLImageElement).src
      if (src) {
        onPaste(src)
      }
    })

    const parent = img.parentNode
    if (parent) {
      parent.insertBefore(wrapper, img)
      wrapper.appendChild(btn)
      wrapper.appendChild(img)
    }

    ;(img as HTMLImageElement).dataset.pasteToDraftProcessed = '1'
  })
}

function scheduleScan(el: HTMLElement, binding: DirectiveBinding<PasteToDraftBindingValue>) {
  const state = ((el as any)[STATE_KEY] || ((el as any)[STATE_KEY] = {})) as InternalState
  if (state.scheduled) {
    window.cancelAnimationFrame(state.scheduled)
  }
  state.scheduled = window.requestAnimationFrame(() => {
    state.scheduled = undefined
    scanAndEnhance(el, binding)
  })
}

const pasteToDraft: Directive<HTMLElement, PasteToDraftBindingValue> = {
  mounted(el, binding) {
    if (!isDirectiveEnabled(binding)) return
    ensureDirectiveStyleInjected()
    scheduleScan(el, binding)

    const state = ((el as any)[STATE_KEY] || ((el as any)[STATE_KEY] = {})) as InternalState
    state.observer = new MutationObserver(() => {
      scheduleScan(el, binding)
    })

    state.observer.observe(el, {
      childList: true,
      subtree: true,
    })
  },
  updated(el, binding) {
    if (!isDirectiveEnabled(binding)) return
    ensureDirectiveStyleInjected()
    scheduleScan(el, binding)
  },
  unmounted(el) {
    const state = (el as any)[STATE_KEY] as InternalState | undefined
    if (state?.scheduled) {
      window.cancelAnimationFrame(state.scheduled)
    }
    state?.observer?.disconnect()
    delete (el as any)[STATE_KEY]
  },
}

export default pasteToDraft
