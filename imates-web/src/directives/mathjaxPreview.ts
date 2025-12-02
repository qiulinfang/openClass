import type { DirectiveBinding, ObjectDirective } from 'vue'
import { nextTick } from 'vue'
import { MathJaxUtils } from '../utils/math/mathjax'

// 使用方式：
// <div v-html="renderMessageContent(content)" v-mathjax-preview></div>
// 可选：通过自定义事件把图片点击回调抛给组件（使用 modifiers 或 dataset 配合也可扩展）

const attachImageClickListeners = (el: HTMLElement, onImageClick?: (url: string) => void) => {
  const images = el.querySelectorAll('img')
  images.forEach((img) => {
    const imageElement = img as HTMLImageElement
    if (imageElement.dataset.hasClickListener === 'true') {
      return
    }

    imageElement.dataset.hasClickListener = 'true'
    imageElement.style.cursor = 'pointer'

    imageElement.addEventListener('click', (e) => {
      e.stopPropagation()
      const imageUrl = imageElement.src
      if (imageUrl && onImageClick) {
        onImageClick(imageUrl)
      }
    })
  })
}

const renderAndBind = async (el: HTMLElement, binding: DirectiveBinding) => {
  await MathJaxUtils.renderMath(el, false)
  await nextTick()

  const onImageClick = typeof binding.value === 'function' ? binding.value : undefined
  attachImageClickListeners(el, onImageClick)
}

export const mathjaxPreview: ObjectDirective = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    void renderAndBind(el, binding)
  },
  updated(el: HTMLElement, binding: DirectiveBinding) {
    void renderAndBind(el, binding)
  },
}

export default mathjaxPreview
