/**
 * 应用导航配置
 * 使用 React Navigation 实现路由管理
 */

import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { RootStackParamList } from './types'
import { useUserStore } from '../stores/userStore'
import LoginScreen from '../screens/LoginScreen'
import MainScreen from '../screens/MainScreen'

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator()

/**
 * 主应用标签导航器
 * 包含主要功能模块
 */
function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="MyProfile"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: '#666666',
      }}
    >
      {/* 后续添加各个标签页 */}
    </Tab.Navigator>
  )
}

/**
 * 应用导航容器
 * 第1步：检查登录状态
 * 第2步：如果未登录，显示登录页
 * 第3步：如果已登录，显示主应用
 */
function AppNavigator() {
  const { userInfo } = useUserStore()

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
        initialRouteName={userInfo ? 'Main' : 'Login'}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Main" component={MainScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default AppNavigator

