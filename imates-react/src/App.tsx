import { RouterProvider } from 'react-router-dom'
import router from '@/router'
import ImagePicker from '@/components/chat/Input/ImagePicker'
import StorageDebugPanel from '@/components/debug/StorageDebugPanel'
import StorageDebugButton from '@/components/debug/StorageDebugButton'

// 设置Android日志接收器
if (typeof window !== 'undefined') {
  // @ts-ignore
  if (!window.onAndroidLog) {
    // @ts-ignore
    window.onAndroidLog = (level: string, tag: string, message: string) => {
      const logMessage = `[${tag}] ${message}`
      switch (level.toUpperCase()) {
        case 'DEBUG':
          break
        case 'INFO':
          break
        case 'WARN':
          console.warn(`⚠️ [Android ${level}]`, logMessage)
          break
        case 'ERROR':
          console.error(`❌ [Android ${level}]`, logMessage)
          break
        default:
          break
      }
    }
  }
}

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ImagePicker />
      <StorageDebugPanel />
      <StorageDebugButton />
    </>
  )
}

export default App
