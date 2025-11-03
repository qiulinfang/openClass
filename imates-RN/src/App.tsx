/**
 * 应用入口
 * 第1步：初始化用户Store
 * 第2步：渲染导航容器
 */

import React, { useEffect } from 'react'
import { StatusBar } from 'react-native'
import AppNavigator from './navigation/AppNavigator'
import { useUserStore } from './stores/userStore'

function App(): React.JSX.Element {
  const { initializeStore } = useUserStore()

  // 第1步：应用启动时初始化Store
  useEffect(() => {
    initializeStore()
  }, [initializeStore])

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <AppNavigator />
    </>
  )
}

export default App


