# UniApp 完整语法与开发手册

> **适配版本**：Vue 3 + Composition API + TypeScript，适用于 uni-app 3.x（HBuilderX / Vite 驱动）。
> **跨端覆盖**：H5 / 微信小程序 (`MP-WEIXIN`) / App (iOS & Android `APP-PLUS`)。

---

## 📌 目录导航

- [一、 项目工程结构与配置文件](#一-项目工程结构与配置文件)
  - [1.1 标准目录架构](#11-标准目录架构)
  - [1.2 核心配置文件解析](#12-核心配置文件解析)
- [二、 生命周期机制（Vue 3 + UniApp）](#二-生命周期机制vue-3--uniapp)
  - [2.1 应用级生命周期 (App.vue)](#21-应用级生命周期-appvue)
  - [2.2 页面级生命周期](#22-页面级生命周期)
  - [2.3 组件级生命周期 (Vue 3 组合式)](#23-组件级生命周期-vue-3-组合式)
- [三、 Vue 3 核心语法在 UniApp 中的应用 (简约提炼)](#三-vue-3-核心语法在-uniapp-中的应用-简约提炼)
  - [3.1 模板绑定与常用指令](#31-模板绑定与常用指令)
  - [3.2 组合式 API (Script Setup)](#32-组合式-api-script-setup)
  - [3.3 组件通信](#33-组件通信)
- [四、 UniApp 核心内置组件](#四-uniapp-核心内置组件)
  - [4.1 视图与滚动容器](#41-视图与滚动容器)
  - [4.2 文本与媒体组件](#42-文本与媒体组件)
  - [4.3 表单组件](#43-表单组件)
  - [4.4 导航组件](#44-导航组件)
- [五、 页面路由与跨页通信](#五-页面路由与跨页通信)
  - [5.1 原生路由 API](#51-原生路由-api)
  - [5.2 复杂对象跨页通信 (EventChannel)](#52-复杂对象跨页通信-eventchannel)
- [六、 网络请求与数据持久化](#六-网络请求与数据持久化)
  - [6.1 原生网络请求 (uni.request 拦截器封装模式)](#61-原生网络请求-unirequest-拦截器封装模式)
  - [6.2 数据本地存储 (Storage API)](#62-数据本地存储-storage-api)
- [七、 原生设备与系统 API](#七-原生设备与系统-api)
  - [7.1 界面交互提示 (UI API)](#71-界面交互提示-ui-api)
  - [7.2 设备能力与媒体](#72-设备能力与媒体)
- [八、 全局状态管理 (Pinia)](#八-全局状态管理-pinia)
- [九、 跨端兼容与条件编译 (核心优势)](#九-跨端兼容与条件编译-核心优势)
  - [9.1 语法与注释规则](#91-语法与注释规则)
  - [9.2 跨端代码示例](#92-跨端代码示例)
- [十、 样式布局与响应式适配](#十-样式布局与响应式适配)
  - [10.1 尺寸单位 rpx 响应式原理](#101-尺寸单位-rpx-响应式原理)
  - [10.2 底部安全区域适配](#102-底部安全区域适配-针对-iphone-x-及全面屏)
- [十一、 高级特性与最佳实践](#十一-高级特性与最佳实践)
  - [11.1 事件总线 (跨组件解耦通信)](#111-事件总线-跨组件解耦通信)
  - [11.2 分包加载与小程序体积优化策略](#112-分包加载与小程序体积优化策略)
  - [11.3 性能优化要点总结](#113-性能优化要点总结)
- [十二、 微信小程序 (MP-WEIXIN) 专项开发指南](#十二-微信小程序-mp-weixin-专项开发指南)
  - [12.1 微信登录鉴权与快捷授权流程](#121-微信登录鉴权与快捷授权流程)
  - [12.2 订阅消息推送机制](#122-订阅消息推送机制)
  - [12.3 WXS 高性能视图层脚本](#123-wxs-高性能视图层脚本)
  - [12.4 独立分包与分包异步化](#124-独立分包与分包异步化)
  - [12.5 微信原生能力 (微信支付 / 小程序跳转)](#125-微信原生能力-微信支付--小程序跳转)
  - [12.6 自定义胶囊导航栏高度计算公式](#126-自定义胶囊导航栏高度计算公式)
  - [12.7 隐私协议与地理位置权限说明配置](#127-隐私协议与地理位置权限说明配置)

---

## 一、 项目工程结构与配置文件

### 1.1 标准目录架构

```text
my-uniapp-project/
├── src/
│   ├── pages/                  # 页面目录（受 pages.json 路由管控）
│   │   ├── index/
│   │   │   └── index.vue       # 主页面
│   │   └── user/
│   │       └── user.vue
│   ├── components/             # 全局组件（easycom 规则自动引入）
│   ├── static/                 # 静态资源（图片、字体，打包时不被构建压缩处理）
│   ├── store/                  # Pinia 状态管理
│   ├── utils/                  # 通用工具函数
│   ├── api/                    # 网络请求接口
│   ├── subPackages/            # 预留分包目录
│   │   └── pagesA/
│   ├── App.vue                 # 应用根组件（监听全局生命周期与全局样式）
│   ├── main.ts                 # 入口初始化文件
│   ├── pages.json              # 页面路由与窗口外观配置（核心）
│   └── manifest.json           # 多端应用配置与打包参数
├── index.html                  # H5 端入口模板
└── vite.config.ts              # Vite 构建与环境变量代理配置
```

---

### 1.2 核心配置文件解析

#### (1) `pages.json`（路由、窗口外观与分包配置）
```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "首页",
        "navigationBarBackgroundColor": "#ffffff",
        "navigationBarTextStyle": "black",
        "enablePullDownRefresh": true,
        "onReachBottomDistance": 50,
        "navigationStyle": "custom"
      }
    },
    {
      "path": "pages/user/user",
      "style": {
        "navigationBarTitleText": "个人中心"
      }
    }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "默认应用标题",
    "navigationBarBackgroundColor": "#F8F8F8",
    "backgroundColor": "#F8F8F8"
  },
  "tabBar": {
    "color": "#999999",
    "selectedColor": "#007AFF",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "首页",
        "iconPath": "static/tab/home.png",
        "selectedIconPath": "static/tab/home-active.png"
      },
      {
        "pagePath": "pages/user/user",
        "text": "我的",
        "iconPath": "static/tab/user.png",
        "selectedIconPath": "static/tab/user-active.png"
      }
    ]
  },
  "subPackages": [
    {
      "root": "subPackages/pagesA",
      "pages": [
        {
          "path": "detail/detail",
          "style": { "navigationBarTitleText": "详情页" }
        }
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["subPackages/pagesA"]
    }
  },
  "easycom": {
    "autoscan": true,
    "custom": {
      "^uni-(.*)": "@dcloudio/uni-ui/lib/uni-$1/uni-$1.vue"
    }
  }
}
```

#### (2) `manifest.json`（多端发布与环境配置）
```json
{
  "name": "UniApp应用名称",
  "appid": "__UNI__XXXXXXX",
  "versionName": "1.0.0",
  "versionCode": "100",
  "app-plus": {
    "usingComponents": true,
    "distribute": {
      "android": {
        "permissions": [
          "<uses-permission android:name=\"android.permission.INTERNET\"/>",
          "<uses-permission android:name=\"android.permission.CAMERA\"/>"
        ]
      },
      "ios": {}
    }
  },
  "mp-weixin": {
    "appid": "wx1234567890abcdef",
    "setting": {
      "urlCheck": false,
      "es6": true
    },
    "usingComponents": true,
    "lazyCodeLoading": "requiredComponents"
  },
  "h5": {
    "title": "Web 页面",
    "router": { "mode": "hash", "base": "./" }
  }
}
```

---

## 二、 生命周期机制（Vue 3 + UniApp）

### 2.1 应用级生命周期 (`App.vue`)
```vue
<script setup>
import { onLaunch, onShow, onHide, onError } from '@dcloudio/uni-app'

// 全局应用初始化（仅触发 1 次）
onLaunch((options) => {
  console.log('App Launch, 启动参数:', options)
})

// 应用切入前台
onShow((options) => {
  console.log('App Show', options)
})

// 应用切入后台
onHide(() => {
  console.log('App Hide')
})

// 应用脚本报错捕获
onError((err) => {
  console.error('App Global Error:', err)
})
</script>

<style>
/* 全局公共样式 (注意: 不加 scoped) */
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
```

---

### 2.2 页面级生命周期

```vue
<script setup>
import { 
  onLoad, 
  onShow, 
  onReady, 
  onHide, 
  onUnload, 
  onPullDownRefresh, 
  onReachBottom, 
  onPageScroll, 
  onShareAppMessage,
  onShareTimeline
} from '@dcloudio/uni-app'

// 页面加载，获取路由 query 参数
onLoad((query) => {
  console.log('页面路由参数 id:', query?.id)
})

// 页面每次显示/切回前台
onShow(() => {
  console.log('页面显示')
})

// 页面初次渲染完成（可操作 Canvas/DOM 界面节点）
onReady(() => {
  console.log('页面初次渲染完成')
})

// 页面隐藏
onHide(() => {})

// 页面卸载（清理定时器/解除事件订阅）
onUnload(() => {})

// 下拉刷新触发（需在 pages.json 中开启 "enablePullDownRefresh": true）
onPullDownRefresh(async () => {
  console.log('触发下拉刷新')
  await reloadData()
  uni.stopPullDownRefresh() // 停止动画
})

// 上拉触底触发（距离阈值由 pages.json "onReachBottomDistance" 控制）
onReachBottom(() => {
  console.log('触底加载下一页')
})

// 页面滚动监听
onPageScroll((e) => {
  console.log('当前页面滚动高度:', e.scrollTop)
})

// 微信小程序发送给朋友分享
onShareAppMessage(() => {
  return {
    title: '专属分享标题',
    path: '/pages/index/index?from=share',
    imageUrl: '/static/share-banner.png'
  }
})

// 微信小程序分享到朋友圈
onShareTimeline(() => {
  return {
    title: '朋友圈展示文案',
    query: 'from=timeline'
  }
})
</script>
```

---

### 2.3 组件级生命周期 (Vue 3 组合式)
```vue
<script setup>
import { onMounted, onUpdated, onUnmounted, onActivated, onDeactivated } from 'vue'

onMounted(() => { /* 组件挂载 */ })
onUpdated(() => { /* DOM 更新 */ })
onUnmounted(() => { /* 组件销毁 */ })
onActivated(() => { /* keep-alive 激活 */ })
onDeactivated(() => { /* keep-alive 休眠 */ })
</script>
```

---

## 三、 Vue 3 核心语法在 UniApp 中的应用 (简约提炼)

### 3.1 模板绑定与常用指令
```vue
<template>
  <!-- 文本与动态绑定 -->
  <text>{{ message }}</text>
  <image :src="avatarUrl" :style="{ width: size + 'rpx' }" />
  
  <!-- 条件与列表渲染 -->
  <view v-if="status === 'success'" class="badge">成功</view>
  <view v-else-if="status === 'pending'">处理中</view>
  <view v-else>失败</view>

  <view v-for="(item, index) in list" :key="item.id">
    {{ index + 1 }} - {{ item.name }}
  </view>

  <!-- 双向绑定与事件绑定 -->
  <input v-model="inputText" @input="handleInput" />
  <button @click="handleClick('customParam')">点击按钮</button>
  <view @click.stop="handleChildClick">阻止事件冒泡</view>
</template>
```

---

### 3.2 组合式 API (Script Setup)
```vue
<script setup>
import { ref, reactive, computed, watch, watchEffect } from 'vue'

// 基础类型与引用类型响应式
const count = ref(0)
const userInfo = reactive({ name: '张三', role: 'admin' })

// 计算属性 (带缓存)
const doubleCount = computed(() => count.value * 2)

// 侦听器
watch(count, (newVal, oldVal) => {
  console.log(`count 变更: ${oldVal} -> ${newVal}`)
})

// 自动追踪依赖侦听
watchEffect(() => {
  console.log('自动收集依赖并执行:', userInfo.name)
})
</script>
```

---

### 3.3 组件通信
```vue
<!-- 子组件 MyCard.vue -->
<template>
  <view class="card" @click="emit('card-click', title)">
    <text>{{ title }}</text>
    <slot name="content" />
  </view>
</template>

<script setup>
import { defineProps, defineEmits, defineExpose, inject } from 'vue'

const props = defineProps({
  title: { type: String, default: '默认标题' }
})

const emit = defineEmits(['card-click'])

// 注入父级 provide 传递的数据
const globalTheme = inject('globalTheme', 'light')

const childMethod = () => console.log('子组件内部暴露的方法')
defineExpose({ childMethod })
</script>
```

---

## 四、 UniApp 核心内置组件

### 4.1 视图与滚动容器
```vue
<!-- view: 基础块级容器 (支持 hover 按压反馈) -->
<view class="box" hover-class="box--active" :hover-stay-time="100">
  点击块
</view>

<!-- scroll-view: 可滚动容器 (纵向滚动、下拉刷新、触底) -->
<scroll-view
  scroll-y
  style="height: 400rpx;"
  refresher-enabled
  :refresher-triggered="isRefreshing"
  @refresherrefresh="onRefresh"
  @scrolltolower="loadMore"
>
  <view v-for="i in 20" :key="i" class="scroll-item">行数据 {{ i }}</view>
</scroll-view>

<!-- swiper: 轮播容器 -->
<swiper
  indicator-dots
  autoplay
  circular
  :interval="3000"
  :duration="500"
>
  <swiper-item v-for="(banner, idx) in banners" :key="idx">
    <image :src="banner.img" mode="aspectFill" class="banner-img" />
  </swiper-item>
</swiper>
```

---

### 4.2 文本与媒体组件
```vue
<!-- text: 可长按选中与转义文本 -->
<text selectable decode space="emsp">首行缩进&emsp;长按可选中复制</text>

<!-- rich-text: HTML 字符串富文本渲染 -->
<rich-text :nodes="htmlContentString" />

<!-- image: 切图模式模式 aspectFill / widthFix / aspectFit -->
<image src="/static/logo.png" mode="aspectFill" lazy-load @error="onImgError" />

<!-- video: 视频播放 -->
<video src="https://domain.com/video.mp4" controls autoplay poster="/static/poster.jpg" />
```

---

### 4.3 表单组件
```vue
<!-- input: 输入框 -->
<input v-model="phone" type="number" placeholder="请输入手机号" maxlength="11" confirm-type="search" />

<!-- picker: 原生选择器 (支持 selector/time/date/region) -->
<picker mode="selector" :range="genderOptions" :value="genderIndex" @change="onGenderChange">
  <view>当前选择：{{ genderOptions[genderIndex] }}</view>
</picker>

<picker mode="region" @change="onRegionChange">
  <view>选择省市区</view>
</picker>

<!-- button: 小程序快捷开放能力 open-type -->
<!-- 微信小程序获取手机号 (需认证企业主体) -->
<button type="primary" open-type="getPhoneNumber" @getphonenumber="onGetPhoneNumber">
  快捷获取手机号
</button>
```

---

### 4.4 导航组件
```vue
<!-- navigator: 页面跳转组件 -->
<navigator url="/pages/user/user" open-type="navigate">跳转到个人中心</navigator>
<navigator url="/pages/index/index" open-type="switchTab">切换 Tab 首页</navigator>
```

---

## 五、 页面路由与跨页通信

### 5.1 原生路由 API
```typescript
// 1. 保留当前页，打开新页面 (可返回)
uni.navigateTo({
  url: '/pages/detail/detail?id=1001&type=goods'
})

// 2. 关闭当前页，打开新页面
uni.redirectTo({
  url: '/pages/login/login'
})

// 3. 切换 TabBar 页面 (并关闭所有非 tabBar 页面)
uni.switchTab({
  url: '/pages/index/index'
})

// 4. 重启打开指定页面 (关闭所有历史页面)
uni.reLaunch({
  url: '/pages/index/index'
})

// 5. 返回上一页或多页
uni.navigateBack({
  delta: 1 // 返回层数
})
```

---

### 5.2 复杂对象跨页通信 (`EventChannel`)
```typescript
// 【发送页】
uni.navigateTo({
  url: '/pages/detail/detail',
  success: (res) => {
    // 弹出通道派发大数据对象
    res.eventChannel.emit('acceptDataFromOpenerPage', {
      bigObject: { name: '高清图', rawData: [...] }
    })
  }
})

// 【接收页 detail.vue】
onLoad(() => {
  // #ifdef MP-WEIXIN || APP-PLUS || H5
  const instance = getCurrentInstance()
  const eventChannel = instance?.proxy?.getOpenerEventChannel()
  eventChannel?.on('acceptDataFromOpenerPage', (data) => {
    console.log('接收到上页派发的复杂对象:', data.bigObject)
  })
  // #endif
})
```

---

## 六、 网络请求与数据持久化

### 6.1 原生网络请求 (`uni.request` 拦截器封装模式)

```typescript
// utils/request.ts
const BASE_URL = 'https://api.domain.com'

export const request = <T = any>(options: UniApp.RequestOptions): Promise<T> => {
  return new Promise((resolve, reject) => {
    // 自动拼装 Token
    const token = uni.getStorageSync('TOKEN')
    
    uni.request({
      ...options,
      url: options.url.startsWith('http') ? options.url : `${BASE_URL}${options.url}`,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const data = res.data as any
          if (data.code === 200 || data.success) {
            resolve(data)
          } else {
            uni.showToast({ title: data.message || '业务异常', icon: 'none' })
            reject(data)
          }
        } else if (res.statusCode === 401) {
          uni.removeStorageSync('TOKEN')
          uni.navigateTo({ url: '/pages/login/login' })
          reject(res)
        } else {
          uni.showToast({ title: `HTTP ${res.statusCode}`, icon: 'none' })
          reject(res)
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络连接失败', icon: 'none' })
        reject(err)
      }
    })
  })
}
```

---

### 6.2 数据本地存储 (Storage API)

```typescript
// 同步操作 (推荐)
uni.setStorageSync('USER_INFO', { id: 1, name: 'Alice' }) // 写入
const userInfo = uni.getStorageSync('USER_INFO')           // 读取
uni.removeStorageSync('USER_INFO')                        // 删除单项
uni.clearStorageSync()                                    // 清空所有缓存

// 异步操作
uni.setStorage({
  key: 'TOKEN',
  data: 'eyJhbGci...',
  success: () => console.log('异步保存成功')
})
```

---

## 七、 原生设备与系统 API

### 7.1 界面交互提示 (UI API)
```typescript
// 1. 消息提示框
uni.showToast({
  title: '操作成功',
  icon: 'success', // 'success' | 'loading' | 'error' | 'none'
  duration: 2000
})

// 2. 加载提示框
uni.showLoading({ title: '数据加载中...' })
setTimeout(() => uni.hideLoading(), 1500)

// 3. 模态弹窗 (Modal)
uni.showModal({
  title: '提示',
  content: '确定要删除该记录吗？',
  confirmColor: '#FF4D4F',
  success: (res) => {
    if (res.confirm) {
      console.log('用户点击了确定')
    }
  }
})

// 4. 底部操作菜单
uni.showActionSheet({
  itemList: ['拍照', '从相册选择'],
  success: (res) => {
    console.log('点击序号:', res.tapIndex)
  }
})
```

---

### 7.2 设备能力与媒体

```typescript
// 1. 选择图片与预览
uni.chooseImage({
  count: 3,
  sizeType: ['compressed'],
  sourceType: ['album', 'camera'],
  success: (res) => {
    const tempFilePaths = res.tempFilePaths
    uni.previewImage({
      urls: tempFilePaths,
      current: tempFilePaths[0]
    })
  }
})

// 2. 获取设备信息与顶部胶囊安全区
const windowInfo = uni.getWindowInfo()
console.log('屏幕宽度:', windowInfo.screenWidth)
console.log('底部安全区域高度:', windowInfo.safeAreaInsets?.bottom)

// #ifdef MP-WEIXIN
// 微信小程序获取右侧胶囊按钮坐标高度 (用于自定义导航栏对齐)
const menuButton = uni.getMenuButtonBoundingClientRect()
console.log('胶囊高度:', menuButton.height, '胶囊 Top:', menuButton.top)
// #endif

// 3. 剪贴板读写
uni.setClipboardData({
  data: '复制的文本内容',
  success: () => uni.showToast({ title: '已复制到剪贴板', icon: 'none' })
})
```

---

## 八、 全局状态管理 (Pinia)

```typescript
// stores/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(uni.getStorageSync('TOKEN') || '')
  const userInfo = ref<any>(null)

  const isLoggedIn = computed(() => !!token.value)

  function setToken(newToken: string) {
    token.value = newToken
    uni.setStorageSync('TOKEN', newToken)
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    uni.removeStorageSync('TOKEN')
  }

  return { token, userInfo, isLoggedIn, setToken, logout }
})
```

---

## 九、 跨端兼容与条件编译 (核心优势)

### 9.1 语法与注释规则
UniApp 使用特殊的注释 `// #ifdef` / `/* #ifdef */` / `<!-- #ifdef -->` 来对代码块进行条件编译，仅编译到指定平台。

| 标记类型 | 含义 |
| :--- | :--- |
| `#ifdef %PLATFORM%` | 仅在指定平台包含该代码 |
| `#ifndef %PLATFORM%` | 在除指定平台外的其他平台包含 |
| `#endif` | 结束条件编译块 |

---

### 9.2 跨端代码示例

```vue
<template>
  <view class="container">
    <!-- #ifdef MP-WEIXIN -->
    <view>只在微信小程序中显示的特有节点</view>
    <!-- #endif -->

    <!-- #ifdef H5 -->
    <view>只在 H5 浏览器中显示的内容</view>
    <!-- #endif -->
  </view>
</template>

<script setup>
// #ifdef APP-PLUS
console.log('只有 iOS/Android 原生 App 端才会执行的逻辑')
// #endif

// #ifndef MP-WEIXIN
console.log('除了微信小程序之外的其他平台')
// #endif
</script>

<style scoped>
/* #ifdef H5 */
.container {
  padding-top: 44px; /* H5 顶部导航补偿 */
}
/* #endif */

/* #ifdef MP-WEIXIN */
.container {
  padding-top: 0;
}
/* #endif */
</style>
```

---

## 十、 样式布局与响应式适配

### 10.1 尺寸单位 `rpx` 响应式原理
`rpx`（responsive pixel）是 UniApp 针对多端屏幕宽度自动缩放的响应式单位：
- **设计基准**：规定屏幕宽度固定为 **750rpx**；
- **公式换算**：在 iPhone 6 (屏幕宽度 375px) 下，`1px = 2rpx`；
- **开发建议**：设计稿统一按 `750px` 宽度出图，测量多少像素就直接写多少 `rpx`。

```css
.card {
  width: 750rpx;       /* 宽度占满整屏 */
  padding: 30rpx;      /* 响应式边距 */
  font-size: 28rpx;    /* 响应式字号 */
}
```

---

### 10.2 底部安全区域适配 (针对 iPhone X 及全面屏)
```css
.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  /* 自动补充全面屏底部黑条安全距离 */
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  background-color: #ffffff;
}
```

---

## 十一、 高级特性与最佳实践

### 11.1 事件总线 (跨组件解耦通信)
```typescript
// 派发事件
uni.$emit('update-user-avatar', { avatarUrl: '/static/new.png' })

// 监听事件 (建议在 onLoad 或 onMounted 中注册)
const handleAvatarUpdate = (data: any) => {
  console.log('接收到新头像:', data.avatarUrl)
}
uni.$on('update-user-avatar', handleAvatarUpdate)

// 销毁监听 (必须在 onUnload 或 onUnmounted 中及时移除，防止内存泄露)
onUnload(() => {
  uni.$off('update-user-avatar', handleAvatarUpdate)
})
```

---

### 11.2 分包加载与小程序体积优化策略
1. **主包仅保留核心 Tab 页**：把非首屏展示的页面全部分割到 `subPackages` 中；
2. **静态资源外置 CDN**：小程序主包限制 2MB，大图、音视频切勿放入 `static/`，建议统一提升至 CDN；
3. **启用按需加载**：在 `manifest.json` 中配置 `"lazyCodeLoading": "requiredComponents"`。

---

### 11.3 性能优化要点总结

```text
┌─────────────────────────┬────────────────────────────────────────────────────────┐
│ 优化方向                │ 推荐做法                                               │
├─────────────────────────┼────────────────────────────────────────────────────────┤
│ 1. 减少数据响应式开销   │ 非 DOM 渲染依赖的大对象不要挂载在 ref/reactive 中       │
│ 2. 列表视图高性能渲染   │ 页面优先使用 <scroll-view> + 分页 / 虚表机制           │
│ 3. 减少 setData 频次    │ 避免在 onPageScroll 里面做复杂的 setData/高频数据改变   │
│ 4. 样式穿透与组件重置   │ 自定义组件重写样式使用 :deep(.target) 或外部 class      │
└─────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 十二、 微信小程序 (MP-WEIXIN) 专项开发指南

### 12.1 微信登录鉴权与快捷授权流程

微信小程序推荐采用 **`uni.login()` 获取 `code` $\rightarrow$ 后端换取 `openid`/`session_key`** 的无感登录模式。

```typescript
// 1. 无感静默登录获取 Code
const handleWxLogin = async () => {
  try {
    const [err, res] = await uni.login({ provider: 'weixin' })
    if (res?.code) {
      console.log('临时登录凭证 code:', res.code)
      // 发送 code 到后端换取自定义登录态 Token & openid
      const data = await request({ url: '/api/v1/wx-login', method: 'POST', data: { code: res.code } })
      uni.setStorageSync('TOKEN', data.token)
    }
  } catch (error) {
    console.error('微信登录失败:', error)
  }
}
```

```vue
<!-- 2. 快捷获取加密手机号 (需企业主体小程序) -->
<template>
  <button type="primary" open-type="getPhoneNumber" @getphonenumber="onGetPhoneNumber">
    一键绑定手机号
  </button>

  <!-- 3. 新版微信头像与昵称填写规范 -->
  <button class="avatar-wrapper" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
    <image class="avatar" :src="avatarUrl" />
  </button>
  <input type="nickname" class="wechat-input" placeholder="请输入微信昵称" @blur="onNicknameBlur" />
</template>

<script setup>
import { ref } from 'vue'

const avatarUrl = ref('/static/default-avatar.png')

// 选择微信头像回调
const onChooseAvatar = (e) => {
  avatarUrl.value = e.detail.avatarUrl // 临时图片路径
}

// 快速获取手机号解密回调 (微信新版回传 code，传给后端解密)
const onGetPhoneNumber = async (e) => {
  if (e.detail.code) {
    await request({ url: '/api/v1/bind-phone', method: 'POST', data: { phoneCode: e.detail.code } })
    uni.showToast({ title: '绑定成功' })
  }
}
</script>
```

---

### 12.2 订阅消息推送机制

订阅消息需由用户在小程序前端**手动点击触发**授权拉起弹窗。

```typescript
const requestSubscribeMessage = () => {
  const TEMPLATE_ID = 'your_wx_template_id_xxx' // 在微信公众平台申请的模板 ID

  uni.requestSubscribeMessage({
    tmplIds: [TEMPLATE_ID],
    success: (res) => {
      if (res[TEMPLATE_ID] === 'accept') {
        uni.showToast({ title: '订阅成功，后续将收到通知', icon: 'none' })
      }
    },
    fail: (err) => console.error('订阅消息拉起失败:', err)
  })
}
```

---

### 12.3 WXS 高性能视图层脚本

**WXS（WeiXin Script）** 运行在视图层（View），能够绕过逻辑层与视图层之间的双线程跨线程通信开销，适合做 **60fps 的手势拖拽、触摸跟手与高频动画**。

```vue
<template>
  <view class="area">
    <!-- 绑定 WXS 触摸事件处理 -->
    <view 
      class="movable-box" 
      :change:prop="wxsModule.propObserver" 
      :prop="customData"
      @touchstart="wxsModule.onTouchStart" 
      @touchmove="wxsModule.onTouchMove"
    >
      拖拽我
    </view>
  </view>
</template>

<!-- #ifdef MP-WEIXIN -->
<script module="wxsModule" lang="wxs">
var startX = 0
var startY = 0

module.exports = {
  onTouchStart: function(event, ownerInstance) {
    var touch = event.touches[0] || event.changedTouches[0]
    startX = touch.clientX
    startY = touch.clientY
  },
  onTouchMove: function(event, ownerInstance) {
    var touch = event.touches[0] || event.changedTouches[0]
    var left = touch.clientX - startX
    var top = touch.clientY - startY
    // 直接修改视图层样式，无跨线程延迟
    ownerInstance.selectComponent('.movable-box').setStyle({
      transform: 'translate(' + left + 'px, ' + top + 'px)'
    })
  }
}
</script>
<!-- #endif -->
```

---

### 12.4 独立分包与分包异步化

#### (1) `pages.json` 声明独立分包 (`independent`)
独立分包无需加载主包资源即可秒开启动：

```json
{
  "subPackages": [
    {
      "root": "moduleA",
      "name": "independentModule",
      "independent": true, // 标记为独立分包
      "pages": [
        { "path": "promo/promo", "style": { "navigationBarTitleText": "限时特惠活动" } }
      ]
    }
  ]
}
```

#### (2) 分包异步化（跨分包组件与 JS 逻辑异步加载）
```json
// 在 main.json 或 pages.json 页面组件定义中配置 componentPlaceholder
{
  "usingComponents": {
    "async-header": "/subPackages/pagesA/components/Header"
  },
  "componentPlaceholder": {
    "async-header": "view" // 在组件异步加载就绪前使用 view 占位
  }
}
```

---

### 12.5 微信原生能力 (微信支付 / 小程序跳转)

```typescript
// 1. 唤起微信原生支付
const handleWxPay = async () => {
  const payParams = await request({ url: '/api/v1/create-pay-order', method: 'POST' })
  
  uni.requestPayment({
    provider: 'wxpay',
    timeStamp: payParams.timeStamp,
    nonceStr: payParams.nonceStr,
    package: payParams.packageValue,
    signType: payParams.signType || 'MD5',
    paySign: payParams.paySign,
    success: () => uni.showToast({ title: '支付成功' }),
    fail: () => uni.showToast({ title: '支付取消或失败', icon: 'none' })
  })
}

// 2. 跳转到其他微信小程序
const navigateToOtherMiniProgram = () => {
  uni.navigateToMiniProgram({
    appId: 'wx9999999999999999', // 目标小程序 AppID
    path: 'pages/index/index?from=myApp',
    extraData: { foo: 'bar' },
    envVersion: 'release' // 'develop' | 'trial' | 'release'
  })
}
```

---

### 12.6 自定义胶囊导航栏高度计算公式

当设置 `"navigationStyle": "custom"` 自定义导航栏时，需通过微信右上角**胶囊按钮坐标**动态推算 NavBar 准确高度，实现完美对齐与防遮挡：

```vue
<script setup>
import { ref, onMounted } from 'vue'

const navBarHeight = ref(0)
const statusBarHeight = ref(0)
const menuButtonHeight = ref(0)

onMounted(() => {
  // #ifdef MP-WEIXIN
  // 1. 获取系统状态栏高度
  const systemInfo = uni.getWindowInfo()
  statusBarHeight.value = systemInfo.statusBarHeight || 0

  // 2. 获取右上角胶囊按钮布局信息
  const menuButton = uni.getMenuButtonBoundingClientRect()
  menuButtonHeight.value = menuButton.height

  // 3. 计算公式：导航栏总高度 = (胶囊Top - 状态栏Top) * 2 + 胶囊自身Height + 状态栏Top
  const navHeight = (menuButton.top - statusBarHeight.value) * 2 + menuButton.height
  navBarHeight.value = navHeight
  // #endif
})
</script>

<template>
  <!-- 自定义顶部固定导航 -->
  <view class="custom-nav" :style="{ paddingTop: statusBarHeight + 'px', height: navBarHeight + 'px' }">
    <view class="nav-title" :style="{ height: menuButtonHeight + 'px', lineHeight: menuButtonHeight + 'px' }">
      自定义对齐标题
    </view>
  </view>
</template>
```

---

### 12.7 隐私协议与地理位置权限说明配置

在打包发布微信小程序前，若使用了**地理位置、摄像头、保存到相册**等能力，必须在 `manifest.json` 中明确声明原因，否则提审会被直接拒绝：

#### (1) `manifest.json` 权限与隐私声明
```json
{
  "mp-weixin": {
    "appid": "wx1234567890abcdef",
    "requiredPrivateInfos": [
      "getLocation",
      "chooseLocation",
      "chooseAddress"
    ],
    "permission": {
      "scope.userLocation": {
        "desc": "您的位置信息将用于为您精准推荐附近的线下门店与学习中心"
      }
    },
    "__usePrivacyCheck__": true
  }
}
```

#### (2) 触发微信隐私协议二次确认弹窗 (`uni.requirePrivacyAuthorize`)
```typescript
// 在调用隐私敏感 API (如选择图片/定位) 前弹出隐私协议确认
if (wx.requirePrivacyAuthorize) {
  wx.requirePrivacyAuthorize({
    success: () => {
      // 用户同意隐私协议，继续执行敏感逻辑
      uni.chooseImage({ count: 1 })
    },
    fail: () => {
      uni.showToast({ title: '需要同意隐私协议后方可继续使用', icon: 'none' })
    }
  })
}
```
