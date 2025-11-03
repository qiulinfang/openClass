/**
 * 主应用页面
 * 包含侧边导航菜单、内容区域和悬浮功能按钮
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  PanResponder,
  Animated,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'

const Stack = createNativeStackNavigator<RootStackParamList>()
const { width, height } = Dimensions.get('window')

const MainScreen: React.FC = () => {
  const [activeNavItem, setActiveNavItem] = useState('knowledge')
  const navigation = useNavigation()
  const route = useRoute()

  // 监听路由变化，更新激活状态
  useEffect(() => {
    const routeName = route.name
    switch (routeName) {
      case 'MyProfile':
        setActiveNavItem('toolbox')
        break
      case 'MyResources':
        setActiveNavItem('resources')
        break
      case 'ExerciseSolve':
        setActiveNavItem('exercises')
        break
      case 'KnowledgeGraph':
        setActiveNavItem('knowledge')
        break
      default:
        // 保持当前状态
        break
    }
  }, [route.name])

  // 导航处理函数
  const handleToolBoxClick = () => {
    setActiveNavItem('toolbox')
    navigation.navigate('MyProfile' as never)
  }

  const handleMyResourcesClick = () => {
    setActiveNavItem('resources')
    navigation.navigate('MyResources' as never)
  }

  const handleMyExercisesClick = () => {
    setActiveNavItem('exercises')
    navigation.navigate('ExerciseSolve' as never)
  }

  const handleKnowledgeGraphClick = () => {
    setActiveNavItem('knowledge')
    navigation.navigate('KnowledgeGraph' as never)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mainView}>
        {/* 侧边导航菜单 */}
        <View style={styles.sidebar}>
          {/* 用户头像 */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar} />
          </View>

          {/* 导航项 */}
          <View style={styles.navItemsContainer}>
            <TouchableOpacity
              style={[
                styles.navItem,
                activeNavItem === 'toolbox' && styles.navItemActive,
              ]}
              onPress={handleToolBoxClick}
              activeOpacity={0.7}
            >
              <Text style={styles.navIcon}>📦</Text>
              <Text
                style={[
                  styles.navText,
                  activeNavItem === 'toolbox' && styles.navTextActive,
                ]}
              >
                功能箱
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navItem,
                activeNavItem === 'resources' && styles.navItemActive,
              ]}
              onPress={handleMyResourcesClick}
              activeOpacity={0.7}
            >
              <Text style={styles.navIcon}>📥</Text>
              <Text
                style={[
                  styles.navText,
                  activeNavItem === 'resources' && styles.navTextActive,
                ]}
              >
                我的资源
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navItem,
                activeNavItem === 'exercises' && styles.navItemActive,
              ]}
              onPress={handleMyExercisesClick}
              activeOpacity={0.7}
            >
              <Text style={styles.navIcon}>📚</Text>
              <Text
                style={[
                  styles.navText,
                  activeNavItem === 'exercises' && styles.navTextActive,
                ]}
              >
                我的习题
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.navItem,
                activeNavItem === 'knowledge' && styles.navItemActive,
              ]}
              onPress={handleKnowledgeGraphClick}
              activeOpacity={0.7}
            >
              <Text style={styles.navIcon}>🗺️</Text>
              <Text
                style={[
                  styles.navText,
                  activeNavItem === 'knowledge' && styles.navTextActive,
                ]}
              >
                知识图谱
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 内容区域 */}
        <View style={styles.contentArea}>
          {/* 使用嵌套导航器显示子路由 */}
          {/* 注意：实际应用中应该使用 Stack.Navigator 来显示子路由 */}
          <View style={styles.contentPlaceholder}>
            <Text style={styles.placeholderText}>内容区域</Text>
            <Text style={styles.placeholderSubtext}>
              当前路由: {route.name || '未知'}
            </Text>
            <Text style={styles.placeholderSubtext}>
              激活导航项: {activeNavItem}
            </Text>
            <Text style={styles.placeholderSubtext}>
              提示: 子路由将在后续实现中完善
            </Text>
          </View>
        </View>

        {/* 悬浮功能按钮 */}
        {/* 注意：悬浮按钮功能将在后续实现 */}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#100035',
  },
  mainView: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#100035',
  },
  sidebar: {
    width: width * 0.07,
    minWidth: 80,
    backgroundColor: '#100035',
    borderRightWidth: 1,
    borderRightColor: 'rgba(229, 231, 235, 0.3)',
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'center',
  },
  avatarContainer: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a1c4e',
  },
  navItemsContainer: {
    flex: 1,
    alignItems: 'center',
  },
  navItem: {
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginVertical: 2,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemActive: {
    backgroundColor: '#2a1c4e',
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  navText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
    textAlign: 'center',
  },
  navTextActive: {
    color: '#9059FF',
    fontWeight: '600',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 16,
    color: '#666',
  },
})

export default MainScreen
