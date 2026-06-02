import { computed, nextTick, ref } from 'vue'
import { androidBridge } from '@/services/business/android-bridge'

export type ScreenSnapshotResult = {
  dataUrl: string
  width: number
  height: number
}

const normalizeSnapshotDataUrl = (payload: unknown): string => {
  if (!payload) return ''

  const asDataUrl = (s: string) => {
    if (!s) return ''
    if (s.startsWith('data:image/')) return s
    if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 100) return `data:image/png;base64,${s}`
    return ''
  }

  if (typeof payload === 'string') {
    const direct = asDataUrl(payload)
    if (direct) return direct

    try {
      const obj = JSON.parse(payload)
      return normalizeSnapshotDataUrl(obj)
    } catch {
      return ''
    }
  }

  if (typeof payload === 'object') {
    const anyObj = payload as any
    return (
      asDataUrl(anyObj.dataUrl) ||
      asDataUrl(anyObj.base64DataUrl) ||
      asDataUrl(anyObj.base64) ||
      asDataUrl(anyObj.data) ||
      asDataUrl(anyObj.imageData) ||
      ''
    )
  }

  return ''
}

const measureDataUrlImage = async (dataUrl: string): Promise<{ width: number; height: number }> => {
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
  return { width: img.width, height: img.height }
}

const captureFromWeb = async (): Promise<ScreenSnapshotResult> => {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })

  try {
    const video = document.createElement('video')
    video.playsInline = true
    video.muted = true
    video.srcObject = stream

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => resolve()
      const onError = () => reject(new Error('video load failed'))
      video.addEventListener('loadedmetadata', onLoaded, { once: true })
      video.addEventListener('error', onError, { once: true })
      video.play().catch(reject)
    })

    await new Promise((r) => requestAnimationFrame(() => r(null)))

    const vw = video.videoWidth || 0
    const vh = video.videoHeight || 0
    if (!vw || !vh) throw new Error('invalid video size')

    const temp = document.createElement('canvas')
    temp.width = vw
    temp.height = vh
    const tctx = temp.getContext('2d')
    if (!tctx) throw new Error('no canvas ctx')
    tctx.drawImage(video, 0, 0, vw, vh)

    const dataUrl = temp.toDataURL('image/png')
    return { dataUrl, width: vw, height: vh }
  } finally {
    stream.getTracks().forEach((t) => t.stop())
  }
}

const captureFromAndroid = async (): Promise<ScreenSnapshotResult> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const commandId = `snapshot_${Date.now()}_${Math.random().toString(16).slice(2)}`

    let done = false
    let timeoutId: number | undefined

    const cleanup = () => {
      if (done) return
      done = true
      androidBridge.removeEventListener('snapshotTaken', onTaken)
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }

    const onTaken = (imageData: unknown) => {
      cleanup()
      const dataUrl = normalizeSnapshotDataUrl(imageData)
      if (!dataUrl) {
        reject(new Error('invalid snapshot payload'))
        return
      }
      resolve(dataUrl)
    }

    androidBridge.addEventListener('snapshotTaken', onTaken)

    const triggerNativeSnapshot = async () => {
      await new Promise((r) => setTimeout(r, 0))
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve)
        })
      })

      const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

      const waitForMediaProjectionPermissionResult = (timeoutMs = 12000) => {
        return new Promise<boolean | null>((resolve) => {
          const onResult = (granted: boolean) => {
            window.clearTimeout(tid)
            androidBridge.removeEventListener('mediaProjectionPermissionResult', onResult)
            resolve(granted)
          }

          const tid = window.setTimeout(() => {
            androidBridge.removeEventListener('mediaProjectionPermissionResult', onResult)
            resolve(null)
          }, timeoutMs)

          androidBridge.addEventListener('mediaProjectionPermissionResult', onResult)
        })
      }

      const waitForMediaProjectionPermission = async (timeoutMs = 12000, intervalMs = 250) => {
        const start = Date.now()
        while (Date.now() - start < timeoutMs) {
          if (done) return false
          if (androidBridge.hasMediaProjectionPermission()) return true
          await sleep(intervalMs)
        }
        return false
      }

      if (!androidBridge.hasMediaProjectionPermission()) {
        let permissionRequestStarted = false
        try {
          permissionRequestStarted = androidBridge.requestMediaProjectionPermission()
        } catch {
          permissionRequestStarted = false
        }

        if (!permissionRequestStarted) {
          cleanup()
          reject(new Error('MediaProjection permission request rejected'))
          return
        }

        const permissionResult = await waitForMediaProjectionPermissionResult()
        if (permissionResult === false) {
          cleanup()
          reject(new Error('MediaProjection permission denied'))
          return
        }

        const granted = permissionResult === true ? true : await waitForMediaProjectionPermission()
        if (!granted) {
          cleanup()
          reject(new Error('MediaProjection permission not granted'))
          return
        }
      }

      timeoutId = window.setTimeout(() => {
        cleanup()
        reject(new Error('takeSnapshot timeout'))
      }, 12000)

      const ok = androidBridge.takeSnapshot(commandId)
      if (!ok) {
        cleanup()
        reject(new Error('takeSnapshot failed'))
      }
    }

    triggerNativeSnapshot()
  })

  const { width, height } = await measureDataUrlImage(dataUrl)
  return { dataUrl, width, height }
}

export function useScreenSnapshot() {
  const isSnapshotPreparing = ref(false)
  const isAndroidSnapshotAvailable = computed(() => {
    return androidBridge.isAndroidBridgeAvailable() && typeof window !== 'undefined' && !!window.AndroidBridge?.takeSnapshot
  })

  const captureScreenSnapshot = async (): Promise<ScreenSnapshotResult> => {
    isSnapshotPreparing.value = true

    try {
      await nextTick()
      await new Promise((r) => requestAnimationFrame(() => r(null)))

      if (isAndroidSnapshotAvailable.value) {
        return await captureFromAndroid()
      }

      return await captureFromWeb()
    } finally {
      isSnapshotPreparing.value = false
    }
  }

  return {
    isSnapshotPreparing,
    isAndroidSnapshotAvailable,
    captureScreenSnapshot,
  }
}
