import { createApp, h, ref, type VNode } from 'vue'
import DraggableDialog from '@/components/base/Modal.vue'

export type DraggableDialogAction = 'confirm' | 'cancel' | 'dismiss'

export interface DraggableDialogOptions {
  title: string
  /** 文本内容（简单场景用） */
  message?: string
  /** 自定义内容渲染函数（需要更复杂布局时使用） */
  renderContent?: () => VNode
  confirmText?: string
  cancelText?: string
  showFooter?: boolean
}

/**
 * 动态挂载一个 DraggableDialog，并在确认/取消/关闭时通过 Promise 返回结果。
 */
export function showDraggableDialog(
  options: DraggableDialogOptions,
): Promise<DraggableDialogAction> {
  return new Promise<DraggableDialogAction>((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    const visible = ref(true)

    const close = (action: DraggableDialogAction) => {
      if (!visible.value) return
      visible.value = false
      resolve(action)
      // 延迟卸载，给过渡动画一点时间（如果需要可以调整或去掉）
      setTimeout(() => {
        app.unmount()
        if (container.parentNode) {
          container.parentNode.removeChild(container)
        }
      }, 0)
    }

    const app = createApp({
      setup() {
        const handleUpdateModelValue = (val: boolean) => {
          visible.value = val
          if (!val) {
            // 视为用户关闭，对外当成 cancel/dismiss
            close('dismiss')
          }
        }

        const slots = {
          default: () => {
            if (options.renderContent) return options.renderContent()
            if (options.message) return h('div', { class: 'draggable-dialog-message' }, options.message)
            return null
          },
        }

        return () =>
          h(
            DraggableDialog,
            {
              modelValue: visible.value,
              'onUpdate:modelValue': handleUpdateModelValue,
              title: options.title,
              showFooter: options.showFooter ?? true,
              confirmText: options.confirmText ?? '确定',
              cancelText: options.cancelText ?? '取消',
              onConfirm: () => close('confirm'),
              onCancel: () => close('cancel'),
            },
            slots,
          )
      },
    })

    app.mount(container)
  })
}
