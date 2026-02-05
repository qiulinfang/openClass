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

function getBindingConfig(binding: DirectiveBinding<PasteToDraftBindingValue>) {
  const v = binding.value
  if (typeof v === 'function') {
    return { onPaste: v, label: '贴到我的作答', enabled: undefined }
  }
  return {
    onPaste: v?.onPaste,
    label: v?.label || '贴到我的作答',
    enabled: typeof v?.enabled === 'boolean' ? v.enabled : undefined,
  }
}

function isDirectiveEnabled(binding: DirectiveBinding<PasteToDraftBindingValue>): boolean {
  const { enabled } = getBindingConfig(binding)
  if (enabled === true) return true
  if (enabled === false) return false

  // 默认禁用：仅在 ExerciseSolveView 场景下通过 provide 显式开启
  const inst = binding.instance as any
  const provides = inst?.$?.provides
  return provides?.pasteToDraftEnabled === true
}

function scanAndEnhance(container: HTMLElement, binding: DirectiveBinding<PasteToDraftBindingValue>) {
  if (!isDirectiveEnabled(binding)) return

  const { onPaste, label } = getBindingConfig(binding)
  if (typeof onPaste !== 'function') return

  const allImages = container.querySelectorAll('img')
  allImages.forEach((img) => {
    const mathContainer = img.closest('.mjx-chtml, .mjx-math, [data-mjx-texclass]')
    if (mathContainer) return

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
