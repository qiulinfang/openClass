import { h, render } from 'vue'
import Dialog from '../components/base/Dialog.vue'

export interface ConfirmDialogOptions {
  title?: string
  confirmButtonText?: string
  cancelButtonText?: string
  // 透传给 Dialog 组件的附加配置（如选项、勾选等）
  options?: any
}

export interface ConfirmDialogHandler {
  onOk: (handler: (data?: any) => void) => ConfirmDialogHandler
}

export function ConfirmDialog(options: ConfirmDialogOptions = {}): ConfirmDialogHandler {
  let okHandler: (data?: any) => void = () => {}

  const container = document.createElement('div')
  document.body.appendChild(container)

  const vnode = h(Dialog, {
    title: options.title || '提示',
    confirmButtonText: options.confirmButtonText || '确定',
    cancelButtonText: options.cancelButtonText || '取消',
    options: options.options,
    onConfirm: (data?: any) => {
      okHandler(data)
      render(null, container)
      container.remove()
    },
  })

  render(vnode, container)

  const vm = vnode.component?.exposed as { openDialog?: () => void } | undefined
  vm?.openDialog?.()

  return {
    onOk(handler: (data?: any) => void) {
      okHandler = handler
      return this
    },
  }
}
