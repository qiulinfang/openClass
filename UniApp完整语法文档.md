# UniApp 完整语法文档

> 基于 Vue 3 + Composition API，适用于 uni-app 3.x 版本（HBuilderX 3.x+）。覆盖 H5 / 微信小程序 / App（iOS/Android）三端。

---

## 目录

1. [项目结构](#1-项目结构)
2. [配置文件](#2-配置文件)
3. [生命周期](#3-生命周期)
4. [模板语法](#4-模板语法)
5. [内置组件](#5-内置组件)
6. [自定义组件](#6-自定义组件)
7. [路由与导航](#7-路由与导航)
8. [网络请求](#8-网络请求)
9. [数据存储](#9-数据存储)
10. [媒体 API](#10-媒体-api)
11. [设备 API](#11-设备-api)
12. [界面 API](#12-界面-api)
13. [状态管理（Pinia）](#13-状态管理pinia)
14. [样式与 rpx](#14-样式与-rpx)
15. [条件编译](#15-条件编译)
16. [事件总线](#16-事件总线)
17. [uni_modules 插件](#17-uni_modules-插件)
18. [性能优化](#18-性能优化)
19. [常见问题速查](#19-常见问题速查)

---

## 1. 项目结构

```
my-project/
├── src/
│   ├── pages/                  # 页面目录
│   │   ├── index/
│   │   │   └── index.vue       # 页面文件
│   │   └── user/
│   │       └── user.vue
│   ├── components/             # 全局组件（easycom 自动注册）
│   ├── static/                 # 静态资源（不会被 webpack 处理）
│   ├── store/                  # Pinia 状态管理
│   ├── utils/                  # 工具函数
│   ├── api/                    # 接口请求
│   ├── uni_modules/            # uni 插件
│   ├── App.vue                 # 应用根组件
│   ├── main.js                 # 入口文件
│   ├── pages.json              # 页面路由 + 窗口配置（核心配置）
│   └── manifest.json           # 应用信息 + 平台配置
├── index.html                  # H5 模板
└── vite.config.js              # Vite 配置
```

---

## 2. 配置文件

### 2.1 pages.json（路由与窗口配置）

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {
        "navigationBarTitleText": "首页",
        "navigationBarBackgroundColor": "#ffffff",
        "navigationBarTextStyle": "black",
        "backgroundColor": "#f5f5f5",
        "enablePullDownRefresh": true,
        "onReachBottomDistance": 50,
        "disableScroll": false,
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
    "navigationBarTitleText": "应用名称",
    "navigationBarBackgroundColor": "#F8F8F8",
    "backgroundColor": "#F8F8F8",
    "usingComponents": {}
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
      "root": "pagesA",
      "pages": [
        { "path": "detail/detail", "style": { "navigationBarTitleText": "详情" } }
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["pagesA"]
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

### 2.2 manifest.json（应用信息）

```json
{
  "name": "应用名称",
  "appid": "__UNI__XXXXXXX",
  "description": "应用描述",
  "versionName": "1.0.0",
  "versionCode": "100",
  "transformPx": false,
  "app-plus": {
    "usingComponents": true,
    "nvueStyleCompiler": "uni-app",
    "compilerVersion": 3,
    "splashscreen": {
      "alwaysShowBeforeRender": true,
      "waiting": true,
      "autoclose": true,
      "delay": 0
    },
    "modules": {},
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
  "quickapp": {},
  "mp-weixin": {
    "appid": "wx_your_appid",
    "setting": {
      "urlCheck": false,
      "es6": true,
      "postcss": true,
      "minified": true
    },
    "usingComponents": true,
    "lazyCodeLoading": "requiredComponents"
  },
  "mp-alipay": { "usingComponents": true },
  "mp-baidu": { "usingComponents": true },
  "mp-toutiao": { "usingComponents": true },
  "h5": {
    "title": "H5 标题",
    "domain": "https://your-domain.com",
    "router": { "mode": "hash", "base": "/" },
    "devServer": {
      "https": false,
      "port": 5173,
      "proxy": {
        "/api": {
          "target": "http://localhost:3000",
          "changeOrigin": true,
          "pathRewrite": { "^/api": "" }
        }
      }
    }
  }
}
```

### 2.3 App.vue（应用根组件）

```vue
<script setup>
import { onLaunch, onShow, onHide, onError, onUniNViewMessage } from '@dcloudio/uni-app';

// 应用启动时触发（只触发一次）
onLaunch((options) => {
  console.log('App Launch', options);
  // 检查登录态
  checkLogin();
});

// 应用从后台切换到前台
onShow((options) => {
  console.log('App Show', options);
});

// 应用切换到后台
onHide(() => {
  console.log('App Hide');
});

// 应用报错
onError((err) => {
  console.error('App Error', err);
});
</script>

<style>
/* 全局样式（不加 scoped） */
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
</style>
```

### 2.4 main.js（入口文件）

```js
import { createSSRApp } from 'vue';
import App from './App.vue';
import { createPinia } from 'pinia';

// 全局组件注册
import MyButton from './components/MyButton.vue';

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();

  app.use(pinia);
  app.component('MyButton', MyButton);

  // 全局属性
  app.config.globalProperties.$baseUrl = 'https://api.example.com';
  app.config.globalProperties.$utils = utils;

  return { app, pinia };
}
```

---

## 3. 生命周期

### 3.1 应用生命周期（App.vue）

| 函数 | 触发时机 |
|------|---------|
| `onLaunch` | 初始化完成时触发（全局只触发一次） |
| `onShow` | 启动或从后台切回前台 |
| `onHide` | 切入后台 |
| `onError` | 脚本错误或 API 调用失败 |
| `onUniNViewMessage` | nvue 页面发送消息 |
| `onPageNotFound` | 页面不存在 |
| `onUnhandledRejection` | 未处理的 Promise 拒绝 |
| `onThemeChange` | 系统主题改变（深色/浅色） |

### 3.2 页面生命周期

```vue
<script setup>
import {
  onLoad,         // 页面加载（携带参数）
  onShow,         // 页面显示（每次显示都触发）
  onReady,        // 页面初次渲染完成
  onHide,         // 页面隐藏
  onUnload,       // 页面卸载
  onPullDownRefresh,  // 下拉刷新
  onReachBottom,      // 上拉加载（触底）
  onPageScroll,       // 页面滚动
  onResize,           // 页面尺寸变化
  onTabItemTap,       // TabBar 被点击
  onShareAppMessage,  // 分享给朋友
  onShareTimeline,    // 分享到朋友圈
  onAddToFavorites,   // 收藏
  onNavigationBarButtonTap, // 原生标题栏按钮点击
  onBackPress,        // 返回键（App/H5）
} from '@dcloudio/uni-app';

// onLoad 接收路由参数
onLoad((query) => {
  console.log('页面参数:', query); // { id: '123' }
});

onShow(() => {
  console.log('页面显示');
});

onReady(() => {
  console.log('页面渲染完成，可操作 DOM');
});

onHide(() => {
  console.log('页面隐藏');
});

onUnload(() => {
  console.log('页面卸载，清理定时器等');
});

// 下拉刷新（需在 pages.json 开启 enablePullDownRefresh）
onPullDownRefresh(async () => {
  await loadData();
  uni.stopPullDownRefresh(); // 停止刷新动画
});

// 触底加载更多（需设置 onReachBottomDistance）
onReachBottom(() => {
  loadMore();
});

// 页面滚动
onPageScroll(({ scrollTop }) => {
  console.log('滚动距离:', scrollTop);
});

// 分享配置
onShareAppMessage(() => {
  return {
    title: '分享标题',
    path: '/pages/index/index?from=share',
    imageUrl: 'https://example.com/share.jpg',
  };
});
</script>
```

### 3.3 组件生命周期（Vue 3）

```vue
<script setup>
import { onMounted, onUpdated, onUnmounted, onBeforeMount, onBeforeUpdate, onBeforeUnmount, onActivated, onDeactivated } from 'vue';

onBeforeMount(() => {});   // 挂载前
onMounted(() => {});       // 挂载后（可访问 DOM）
onBeforeUpdate(() => {});  // 更新前
onUpdated(() => {});       // 更新后
onBeforeUnmount(() => {}); // 卸载前
onUnmounted(() => {});     // 卸载后（清理定时器、取消订阅）
onActivated(() => {});     // keep-alive 激活
onDeactivated(() => {});   // keep-alive 停用
</script>
```

---

## 4. 模板语法

### 4.1 数据绑定

```vue
<template>
  <!-- 插值表达式 -->
  <text>{{ message }}</text>
  <text>{{ count + 1 }}</text>
  <text>{{ ok ? '是' : '否' }}</text>
  <text>{{ name.toUpperCase() }}</text>

  <!-- v-text（不解析 HTML） -->
  <text v-text="message"></text>

  <!-- 属性绑定 -->
  <image :src="imgUrl" :style="{ width: size + 'rpx' }"></image>
  <view :class="{ active: isActive, disabled: isDisabled }"></view>
  <view :class="[baseClass, isActive ? 'active' : '']"></view>

  <!-- 一次性绑定（不响应更新） -->
  <text v-once>{{ message }}</text>
</template>
```

### 4.2 指令

```vue
<template>
  <!-- 条件渲染 -->
  <view v-if="type === 'A'">A</view>
  <view v-else-if="type === 'B'">B</view>
  <view v-else>其他</view>

  <!-- v-show（保留 DOM，切换 display） -->
  <view v-show="isVisible">可见内容</view>

  <!-- 列表渲染 -->
  <view v-for="(item, index) in list" :key="item.id">
    {{ index }}. {{ item.name }}
  </view>

  <!-- 遍历对象 -->
  <view v-for="(value, key, index) in obj" :key="key">
    {{ key }}: {{ value }}
  </view>

  <!-- 事件绑定 -->
  <button @click="handleClick">点击</button>
  <button @click="handleClick($event, 'param')">带参数</button>
  <input @input="handleInput" @blur="handleBlur" />

  <!-- 事件修饰符 -->
  <view @click.stop="handleClick">阻止冒泡</view>
  <form @submit.prevent="handleSubmit">阻止默认行为</form>
  <view @click.once="handleClickOnce">只触发一次</view>

  <!-- 双向绑定 -->
  <input v-model="inputValue" />
  <input v-model.trim="name" />
  <input v-model.number="age" type="number" />
  <input v-model.lazy="email" />  <!-- blur 时更新 -->

  <!-- 模板引用 -->
  <view ref="myView">内容</view>

  <!-- 动态组件 -->
  <component :is="currentComponent" />

  <!-- 透传所有属性 -->
  <MyComp v-bind="$attrs" />
</template>
```

### 4.3 计算属性与侦听器

```vue
<script setup>
import { ref, reactive, computed, watch, watchEffect } from 'vue';

const firstName = ref('张');
const lastName = ref('三');

// 计算属性（带缓存）
const fullName = computed(() => `${firstName.value} ${lastName.value}`);

// 可写计算属性
const fullNameWritable = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (val) => {
    const parts = val.split(' ');
    firstName.value = parts[0];
    lastName.value = parts[1] ?? '';
  },
});

// watch
watch(firstName, (newVal, oldVal) => {
  console.log(`firstName 从 ${oldVal} 变为 ${newVal}`);
}, { immediate: true, deep: false });

// 监听多个源
watch([firstName, lastName], ([newFirst, newLast]) => {
  console.log(newFirst, newLast);
});

// 监听对象（deep）
const user = reactive({ profile: { name: 'Alice' } });
watch(() => user.profile.name, (val) => {
  console.log('name changed:', val);
}, { deep: true });

// watchEffect（自动追踪依赖）
const stop = watchEffect(() => {
  console.log('firstName:', firstName.value);
  // 自动追踪 firstName
});
// 停止侦听
stop();
</script>
```

---

## 5. 内置组件

### 5.1 基础容器

```vue
<!-- view：块级容器（类似 div） -->
<view class="container" hover-class="hover" hover-start-time="20" hover-stay-time="70">
  内容
</view>

<!-- scroll-view：可滚动容器 -->
<scroll-view
  scroll-y
  :scroll-top="scrollTop"
  scroll-with-animation
  enable-back-to-top
  @scroll="handleScroll"
  @scrolltoupper="handleScrollToTop"
  @scrolltolower="handleScrollToBottom"
  @refresherrefresh="onRefresh"
  refresher-enabled
  :refresher-triggered="isRefreshing"
>
  <view v-for="item in list" :key="item.id">{{ item.name }}</view>
</scroll-view>

<!-- swiper：轮播 -->
<swiper
  :indicator-dots="true"
  :autoplay="true"
  :interval="3000"
  :duration="500"
  circular
  :current="currentIndex"
  @change="handleSwiperChange"
>
  <swiper-item v-for="item in banners" :key="item.id">
    <image :src="item.url" mode="aspectFill" />
  </swiper-item>
</swiper>
```

### 5.2 文本与图片

```vue
<!-- text：文本（类似 span） -->
<text selectable decode space="emsp">
  可选中的文本 &amp; 解码实体
</text>

<!-- rich-text：富文本 -->
<rich-text :nodes="htmlContent" />
<!-- nodes 支持 string（HTML）或 Array（node 树） -->

<!-- image：图片 -->
<image
  src="https://example.com/pic.jpg"
  mode="aspectFill"
  lazy-load
  webp
  @load="onImageLoad"
  @error="onImageError"
/>
<!--
  mode 可选值：
  scaleToFill（默认，拉伸填充）
  aspectFit（保持比例，完整显示）
  aspectFill（保持比例，填充裁剪）
  widthFix（宽度固定，高度自适应）
  heightFix（高度固定，宽度自适应）
  top / bottom / left / right / center（裁剪对齐）
-->
```

### 5.3 表单组件

```vue
<!-- input -->
<input
  v-model="value"
  type="text"
  placeholder="请输入"
  placeholder-style="color: #999"
  :maxlength="20"
  :disabled="isDisabled"
  :password="isPassword"
  confirm-type="done"
  @input="onInput"
  @focus="onFocus"
  @blur="onBlur"
  @confirm="onConfirm"
/>
<!--
  type: text / number / idcard / digit / tel / safe-password / nickname
  confirm-type: send / search / next / go / done
-->

<!-- textarea -->
<textarea
  v-model="content"
  placeholder="请输入内容"
  :maxlength="500"
  auto-height
  :show-confirm-bar="false"
/>

<!-- button -->
<button
  type="primary"
  size="default"
  :loading="isLoading"
  :disabled="isDisabled"
  @click="handleClick"
  open-type="getUserInfo"
  @getuserinfo="onGetUserInfo"
>
  按钮
</button>
<!--
  type: primary / default / warn
  size: default / mini
  open-type（微信小程序）: getUserInfo / contact / share / getPhoneNumber / launchApp / openSetting
-->

<!-- checkbox-group -->
<checkbox-group @change="onCheckChange">
  <label v-for="item in items" :key="item.value">
    <checkbox :value="item.value" :checked="item.checked" />
    {{ item.label }}
  </label>
</checkbox-group>

<!-- radio-group -->
<radio-group @change="onRadioChange">
  <label v-for="item in items" :key="item.value">
    <radio :value="item.value" :checked="selectedValue === item.value" />
    {{ item.label }}
  </label>
</radio-group>

<!-- switch -->
<switch :checked="isSwitchOn" @change="onSwitchChange" color="#007AFF" />

<!-- slider -->
<slider
  :value="sliderValue"
  :min="0"
  :max="100"
  :step="1"
  show-value
  @change="onSliderChange"
  @changing="onSliding"
/>

<!-- picker：选择器 -->
<!-- 普通选择 -->
<picker mode="selector" :range="options" :value="selectedIndex" @change="onPickerChange">
  <view>{{ options[selectedIndex] }}</view>
</picker>

<!-- 时间选择 -->
<picker mode="time" :value="time" start="09:00" end="21:00" @change="onTimeChange">
  <view>{{ time }}</view>
</picker>

<!-- 日期选择 -->
<picker mode="date" :value="date" start="2020-01-01" end="2030-12-31" @change="onDateChange">
  <view>{{ date }}</view>
</picker>

<!-- 地区选择 -->
<picker mode="region" :value="region" @change="onRegionChange">
  <view>{{ region.join(' ') }}</view>
</picker>

<!-- picker-view：嵌入式滚动选择 -->
<picker-view :value="pickerValue" @change="onPickerViewChange">
  <picker-view-column>
    <view v-for="item in column1" :key="item">{{ item }}</view>
  </picker-view-column>
  <picker-view-column>
    <view v-for="item in column2" :key="item">{{ item }}</view>
  </picker-view-column>
</picker-view>

<!-- form -->
<form @submit="onSubmit" @reset="onReset">
  <input name="username" placeholder="用户名" />
  <button form-type="submit">提交</button>
  <button form-type="reset">重置</button>
</form>
```

### 5.4 导航组件

```vue
<!-- navigator：页面跳转链接 -->
<navigator url="/pages/detail/detail?id=123" open-type="navigate">
  跳转到详情
</navigator>
<!--
  open-type: navigate / redirect / switchTab / reLaunch / navigateBack
-->
```

### 5.5 媒体组件

```vue
<!-- video -->
<video
  src="https://example.com/video.mp4"
  :controls="true"
  :autoplay="false"
  :loop="false"
  :muted="false"
  :poster="posterUrl"
  object-fit="contain"
  @play="onPlay"
  @pause="onPause"
  @ended="onEnded"
  @timeupdate="onTimeUpdate"
/>

<!-- map -->
<map
  :latitude="latitude"
  :longitude="longitude"
  :scale="14"
  :markers="markers"
  :polyline="polyline"
  :polygons="polygons"
  :show-location="true"
  @markertap="onMarkerTap"
  @callouttap="onCalloutTap"
  @regionchange="onRegionChange"
/>
```

### 5.6 其他组件

```vue
<!-- web-view：嵌入网页（不支持 tabBar 页面） -->
<web-view :src="webUrl" @message="onWebMessage" />

<!-- ad：广告 -->
<ad unit-id="your-ad-unit-id" ad-type="banner" />

<!-- live-player：直播播放 -->
<live-player src="rtmp://..." mode="live" :muted="false" />
```

---

## 6. 自定义组件

### 6.1 组合式 API 组件

```vue
<!-- components/MyCard.vue -->
<template>
  <view class="card" :class="{ 'card--shadow': shadow }">
    <slot name="header">
      <text class="card__title">{{ title }}</text>
    </slot>

    <view class="card__body">
      <slot />
    </view>

    <slot name="footer" />
  </view>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits, defineExpose } from 'vue';

// Props 定义
const props = defineProps({
  title: {
    type: String,
    default: '标题',
  },
  shadow: {
    type: Boolean,
    default: false,
  },
  modelValue: {
    type: [String, Number],
    required: false,
  },
});

// Emits 定义
const emit = defineEmits(['update:modelValue', 'click', 'close']);

// 内部状态
const isExpanded = ref(false);

// 计算属性
const cardClass = computed(() => ({
  card: true,
  'card--expanded': isExpanded.value,
}));

// 方法
function toggle() {
  isExpanded.value = !isExpanded.value;
  emit('click', isExpanded.value);
}

function close() {
  isExpanded.value = false;
  emit('close');
}

// 暴露给父组件（通过 ref 访问）
defineExpose({ toggle, close, isExpanded });
</script>

<style scoped>
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
}
.card--shadow {
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}
</style>
```

### 6.2 使用自定义组件

```vue
<template>
  <!-- easycom 自动注册，直接使用 -->
  <MyCard
    title="我的卡片"
    :shadow="true"
    v-model="value"
    @click="onCardClick"
    ref="cardRef"
  >
    <template #header>
      <text>自定义头部</text>
    </template>

    <text>默认插槽内容</text>

    <template #footer>
      <button @click="cardRef.close()">关闭</button>
    </template>
  </MyCard>
</template>

<script setup>
import { ref } from 'vue';

const value = ref('');
const cardRef = ref(null);

function onCardClick(expanded) {
  console.log('卡片状态:', expanded);
}
</script>
```

### 6.3 provide / inject（跨层级通信）

```vue
<!-- 父组件 -->
<script setup>
import { provide, ref } from 'vue';

const theme = ref('light');
const setTheme = (t) => { theme.value = t; };

provide('theme', { theme, setTheme });
</script>

<!-- 深层子组件 -->
<script setup>
import { inject } from 'vue';

const { theme, setTheme } = inject('theme', {
  theme: ref('light'),
  setTheme: () => {},
});
</script>
```

### 6.4 Composables（组合式函数）

```js
// composables/useRequest.js
import { ref, reactive } from 'vue';

export function useRequest(url, options = {}) {
  const data = ref(null);
  const loading = ref(false);
  const error = ref(null);

  async function execute(params = {}) {
    loading.value = true;
    error.value = null;
    try {
      const res = await uni.request({
        url,
        data: params,
        ...options,
      });
      data.value = res.data;
      return res.data;
    } catch (e) {
      error.value = e;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return { data, loading, error, execute };
}

// 使用
const { data, loading, execute } = useRequest('/api/users');
onLoad(() => execute({ page: 1 }));
```

---

## 7. 路由与导航

### 7.1 跳转方式

```js
// 1. navigate：保留当前页面（可返回），最多 10 层
uni.navigateTo({
  url: '/pages/detail/detail?id=123&name=Alice',
  success: (res) => { console.log('跳转成功', res); },
  fail: (err) => { console.error('跳转失败', err); },
  complete: () => {},
});

// 2. redirect：关闭当前页面后跳转（无法返回）
uni.redirectTo({ url: '/pages/login/login' });

// 3. reLaunch：关闭所有页面后跳转
uni.reLaunchTo({ url: '/pages/index/index' });

// 4. switchTab：跳转到 tabBar 页面（关闭其他非 tabBar 页面）
uni.switchTab({ url: '/pages/index/index' });

// 5. navigateBack：返回上一层（或多层）
uni.navigateBack({ delta: 1 });
uni.navigateBack({ delta: 2 }); // 返回 2 层

// 6. 预加载页面（App 端）
const page = uni.preloadPage({ url: '/pages/detail/detail' });
```

### 7.2 获取页面参数

```vue
<script setup>
import { onLoad } from '@dcloudio/uni-app';

onLoad((query) => {
  // URL 参数自动解析为对象
  const { id, name } = query;
  console.log(id, decodeURIComponent(name));
});
</script>
```

### 7.3 页面间通信

```js
// ======= 方案一：URL 参数（简单数据）=======
uni.navigateTo({ url: '/pages/detail?id=123' });

// ======= 方案二：EventChannel（navigate 时传复杂数据）=======
// 发送方（跳转时）
uni.navigateTo({
  url: '/pages/detail/detail',
  success: (res) => {
    res.eventChannel.emit('sendData', { list: [1, 2, 3] });
  },
  events: {
    // 监听目标页面返回的事件
    onDataBack: (data) => {
      console.log('收到返回数据:', data);
    },
  },
});

// 接收方（目标页面）
onLoad(() => {
  const eventChannel = getCurrentInstance().proxy.$scope.eventChannel;
  // or:
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  const channel = currentPage.getOpenerEventChannel();

  channel.on('sendData', (data) => {
    console.log('收到数据:', data);
  });
  // 向前一页发送事件
  channel.emit('onDataBack', { result: 'ok' });
});

// ======= 方案三：globalData / Pinia（全局状态）=======
// 推荐使用 Pinia

// ======= 方案四：uni.$emit / $on（事件总线）=======
// 见第 16 节
```

### 7.4 获取页面栈

```js
// 获取当前页面栈
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
const prevPage = pages[pages.length - 2];

// 直接操作前一页数据（谨慎使用）
prevPage.$vm.someData = 'updated';
prevPage.$vm.loadData();
```

---

## 8. 网络请求

### 8.1 uni.request 基础

```js
// GET 请求
uni.request({
  url: 'https://api.example.com/users',
  method: 'GET',
  data: { page: 1, size: 10 },
  header: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  success: (res) => {
    if (res.statusCode === 200) {
      console.log(res.data);
    }
  },
  fail: (err) => {
    console.error(err);
  },
});

// Promise 封装
function request(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      success: resolve,
      fail: reject,
    });
  });
}
```

### 8.2 完整封装（拦截器 + 统一错误处理）

```js
// utils/request.js
const BASE_URL = 'https://api.example.com';
const TIMEOUT = 10000;

// 请求拦截器列表
const requestInterceptors = [];
// 响应拦截器列表
const responseInterceptors = [];

function http(config) {
  // 执行请求拦截器
  let reqConfig = { ...config };
  for (const interceptor of requestInterceptors) {
    reqConfig = interceptor(reqConfig) || reqConfig;
  }

  return new Promise((resolve, reject) => {
    // 显示 loading
    uni.showLoading({ title: '加载中...', mask: true });

    const task = uni.request({
      url: BASE_URL + reqConfig.url,
      method: reqConfig.method || 'GET',
      data: reqConfig.data,
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${uni.getStorageSync('token') || ''}`,
        ...reqConfig.header,
      },
      timeout: TIMEOUT,
      success: (res) => {
        uni.hideLoading();
        // 执行响应拦截器
        let resData = res;
        for (const interceptor of responseInterceptors) {
          resData = interceptor(resData) || resData;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          const { code, data, message } = res.data;
          if (code === 0 || code === 200) {
            resolve(data);
          } else if (code === 401) {
            uni.removeStorageSync('token');
            uni.reLaunch({ url: '/pages/login/login' });
            reject(new Error('登录已过期'));
          } else {
            uni.showToast({ title: message || '请求失败', icon: 'none' });
            reject(new Error(message));
          }
        } else {
          uni.showToast({ title: `网络错误 ${res.statusCode}`, icon: 'none' });
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
      fail: (err) => {
        uni.hideLoading();
        if (err.errMsg?.includes('timeout')) {
          uni.showToast({ title: '请求超时', icon: 'none' });
        } else {
          uni.showToast({ title: '网络连接失败', icon: 'none' });
        }
        reject(err);
      },
    });

    // 保存请求任务（可用于取消请求）
    if (reqConfig.onTask) reqConfig.onTask(task);
  });
}

// 便捷方法
http.get = (url, data, config) => http({ url, method: 'GET', data, ...config });
http.post = (url, data, config) => http({ url, method: 'POST', data, ...config });
http.put = (url, data, config) => http({ url, method: 'PUT', data, ...config });
http.delete = (url, data, config) => http({ url, method: 'DELETE', data, ...config });

// 添加拦截器
http.addRequestInterceptor = (fn) => requestInterceptors.push(fn);
http.addResponseInterceptor = (fn) => responseInterceptors.push(fn);

export default http;
```

### 8.3 文件上传与下载

```js
// 上传图片
uni.chooseImage({
  count: 1,
  success: ({ tempFilePaths }) => {
    const uploadTask = uni.uploadFile({
      url: 'https://api.example.com/upload',
      filePath: tempFilePaths[0],
      name: 'file',
      formData: { userId: '123' },
      header: { Authorization: `Bearer ${token}` },
      success: (res) => {
        const data = JSON.parse(res.data);
        console.log('上传成功:', data.url);
      },
    });

    // 监听上传进度
    uploadTask.onProgressUpdate(({ progress }) => {
      console.log('上传进度:', progress);
    });

    // 取消上传
    // uploadTask.abort();
  },
});

// 下载文件
const downloadTask = uni.downloadFile({
  url: 'https://example.com/file.pdf',
  success: ({ tempFilePath }) => {
    uni.openDocument({ filePath: tempFilePath });
  },
});

downloadTask.onProgressUpdate(({ progress }) => {
  console.log('下载进度:', progress);
});
```

---

## 9. 数据存储

### 9.1 本地存储（同步）

```js
// 存储
uni.setStorageSync('key', 'value');
uni.setStorageSync('user', { name: 'Alice', age: 30 }); // 自动序列化

// 读取
const value = uni.getStorageSync('key');
const user = uni.getStorageSync('user'); // 自动反序列化

// 删除
uni.removeStorageSync('key');

// 清空
uni.clearStorageSync();

// 获取存储信息
const info = uni.getStorageInfoSync();
console.log(info.keys, info.currentSize, info.limitSize);
```

### 9.2 本地存储（异步）

```js
// 存储
uni.setStorage({
  key: 'token',
  data: 'Bearer xxx',
  success: () => console.log('存储成功'),
  fail: console.error,
});

// 读取
uni.getStorage({
  key: 'token',
  success: ({ data }) => console.log(data),
  fail: console.error,
});

// Promise 化
const { data } = await uni.getStorage({ key: 'token' });
```

### 9.3 安全存储（App 端，加密存储）

```js
// uni.setStorageSync 本身无加密，敏感数据建议：
// 1. 使用原生插件（如 DCloud 安全存储插件）
// 2. 在应用层加密后存储

// 微信小程序安全登录态存储
// wx.setStorageSync 与 uni.setStorageSync 等价

// 敏感信息存储建议（AES 加密）
import CryptoJS from 'crypto-js';

const SECRET = 'your-secret-key';

export function secureSet(key, value) {
  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(value),
    SECRET
  ).toString();
  uni.setStorageSync(key, encrypted);
}

export function secureGet(key) {
  const encrypted = uni.getStorageSync(key);
  if (!encrypted) return null;
  const bytes = CryptoJS.AES.decrypt(encrypted, SECRET);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}
```

---

## 10. 媒体 API

### 10.1 图片

```js
// 选择图片
uni.chooseImage({
  count: 9,
  sizeType: ['original', 'compressed'],
  sourceType: ['album', 'camera'],
  success: ({ tempFilePaths, tempFiles }) => {
    console.log('选择的图片路径:', tempFilePaths);
    console.log('图片文件信息:', tempFiles);
  },
});

// 预览图片
uni.previewImage({
  current: 0,  // 当前显示图片的索引或 URL
  urls: ['https://example.com/1.jpg', 'https://example.com/2.jpg'],
  longPressActions: {
    itemList: ['发送给朋友', '保存图片'],
    success: ({ tapIndex, index }) => {},
  },
});

// 保存到相册
uni.saveImageToPhotosAlbum({
  filePath: tempFilePath,
  success: () => uni.showToast({ title: '保存成功' }),
});

// 获取图片信息
uni.getImageInfo({
  src: 'https://example.com/pic.jpg',
  success: ({ width, height, path, orientation, type }) => {},
});

// 压缩图片
uni.compressImage({
  src: tempFilePath,
  quality: 80,      // 0-100
  success: ({ tempFilePath: compressed }) => {},
});
```

### 10.2 视频与相机

```js
// 选择视频
uni.chooseVideo({
  sourceType: ['album', 'camera'],
  maxDuration: 60,    // 最长录制时间（秒）
  camera: 'back',     // back / front
  compressed: true,   // 是否压缩
  success: ({ tempFilePath, duration, size, width, height }) => {},
});

// 保存视频到相册
uni.saveVideoToPhotosAlbum({ filePath: tempFilePath });

// 相机（App 端）
const cameraContext = uni.createCameraContext();
cameraContext.takePhoto({
  quality: 'high',
  success: ({ tempImagePath }) => {},
});
cameraContext.startRecord({ success: () => {} });
cameraContext.stopRecord({
  success: ({ tempThumbPath, tempVideoPath }) => {},
});
```

### 10.3 音频

```js
// 播放音效（短音频）
const audio = uni.createInnerAudioContext();
audio.src = 'https://example.com/sound.mp3';
audio.autoplay = true;
audio.loop = false;
audio.volume = 0.8;

audio.onPlay(() => console.log('开始播放'));
audio.onPause(() => console.log('暂停'));
audio.onStop(() => console.log('停止'));
audio.onEnded(() => console.log('播放完毕'));
audio.onError((err) => console.error(err));
audio.onTimeUpdate(() => {
  console.log(audio.currentTime, audio.duration);
});

audio.play();
audio.pause();
audio.stop();
audio.seek(30); // 跳到 30 秒

// 销毁实例
audio.destroy();

// 背景音频（App/微信小程序，退出后继续播放）
const bgAudio = uni.getBackgroundAudioManager();
bgAudio.src = 'https://example.com/music.mp3';
bgAudio.title = '歌曲名称';
bgAudio.singer = '歌手名';
bgAudio.coverImgUrl = 'https://example.com/cover.jpg';
bgAudio.onPlay(() => {});
bgAudio.onPause(() => {});
```

---

## 11. 设备 API

### 11.1 地理位置

```js
// 获取当前位置
uni.getLocation({
  type: 'gcj02',    // wgs84 / gcj02
  altitude: true,   // 是否需要海拔
  geocode: true,    // 是否解析地址（App 端）
  success: ({ latitude, longitude, accuracy, speed, altitude, address }) => {
    console.log(latitude, longitude);
  },
  fail: (err) => {
    if (err.code === 1) {
      uni.showModal({ title: '提示', content: '请开启位置权限' });
    }
  },
});

// 持续监听位置变化
uni.startLocationUpdate({ type: 'gcj02' });
uni.onLocationChange(({ latitude, longitude }) => {
  console.log(latitude, longitude);
});
uni.stopLocationUpdate();

// 打开地图选择位置
uni.chooseLocation({
  latitude: 39.90,
  longitude: 116.40,
  success: ({ name, address, latitude, longitude }) => {},
});

// 打开导航
uni.openLocation({
  latitude: 39.90,
  longitude: 116.40,
  name: '目的地名称',
  address: '详细地址',
  scale: 18,
});
```

### 11.2 扫码

```js
uni.scanCode({
  onlyFromCamera: false,  // 是否只允许相机扫
  scanType: ['qrCode', 'barCode'],
  success: ({ result, scanType, charSet }) => {
    console.log('扫描结果:', result);
  },
});
```

### 11.3 系统信息

```js
// 同步获取系统信息（推荐）
const sysInfo = uni.getSystemInfoSync();
console.log(sysInfo.platform);       // ios / android / web
console.log(sysInfo.osName);         // iOS / android
console.log(sysInfo.osVersion);      // 系统版本
console.log(sysInfo.windowWidth);    // 窗口宽度（px）
console.log(sysInfo.windowHeight);   // 窗口高度
console.log(sysInfo.screenWidth);
console.log(sysInfo.screenHeight);
console.log(sysInfo.statusBarHeight);// 状态栏高度
console.log(sysInfo.safeArea);       // 安全区域
console.log(sysInfo.safeAreaInsets); // 安全区域内边距
console.log(sysInfo.pixelRatio);     // 设备像素比
console.log(sysInfo.SDKVersion);     // 小程序基础库版本
console.log(sysInfo.language);
console.log(sysInfo.version);        // 微信版本号

// 获取胶囊按钮信息（微信小程序）
const menuButton = uni.getMenuButtonBoundingClientRect();
// { top, left, right, bottom, width, height }

// 自定义导航栏高度计算
const navBarHeight = sysInfo.statusBarHeight + 44;
```

### 11.4 网络状态

```js
// 获取网络类型
uni.getNetworkType({
  success: ({ networkType }) => {
    // wifi / 2g / 3g / 4g / 5g / none / unknown
    console.log('网络类型:', networkType);
  },
});

// 监听网络状态变化
uni.onNetworkStatusChange(({ isConnected, networkType }) => {
  if (!isConnected) {
    uni.showToast({ title: '网络已断开', icon: 'none' });
  }
});
uni.offNetworkStatusChange();
```

### 11.5 振动

```js
uni.vibrateShort({ type: 'medium' });  // 短振动（light/medium/heavy）
uni.vibrateLong();                      // 长振动
```

### 11.6 剪贴板

```js
// 写入剪贴板
uni.setClipboardData({
  data: '复制的内容',
  success: () => uni.showToast({ title: '已复制' }),
});

// 读取剪贴板
uni.getClipboardData({
  success: ({ data }) => console.log(data),
});
```

### 11.7 权限检查与申请（App）

```js
// 检查权限
const status = uni.getPermissionStatus({
  permissionID: 'location',
});

// 申请权限
uni.authorize({
  scope: 'scope.userLocation',
  success: () => { /* 已授权 */ },
  fail: () => {
    // 引导用户开启
    uni.showModal({
      title: '提示',
      content: '需要位置权限，请在设置中开启',
      confirmText: '去设置',
      success: ({ confirm }) => {
        if (confirm) uni.openSetting();
      },
    });
  },
});
```

---

## 12. 界面 API

### 12.1 提示框

```js
// Toast（轻提示）
uni.showToast({
  title: '操作成功',
  icon: 'success',    // success / error / fail / loading / none
  image: '',          // 自定义图标（优先于 icon）
  duration: 2000,
  mask: false,        // 是否防止触摸穿透
});
uni.hideToast();

// Loading
uni.showLoading({ title: '加载中...', mask: true });
uni.hideLoading();

// Modal（对话框）
uni.showModal({
  title: '提示',
  content: '确认删除？',
  showCancel: true,
  cancelText: '取消',
  confirmText: '确定',
  confirmColor: '#FF4757',
  editable: false,    // 是否显示输入框
  success: ({ confirm, cancel, content }) => {
    if (confirm) handleDelete();
  },
});

// ActionSheet（底部菜单）
uni.showActionSheet({
  title: '请选择操作',
  itemList: ['拍照', '从相册选择', '取消'],
  itemColor: '#333',
  success: ({ tapIndex }) => {
    const actions = ['camera', 'album', 'cancel'];
    handleAction(actions[tapIndex]);
  },
});
```

### 12.2 导航栏操作

```js
// 设置导航栏标题
uni.setNavigationBarTitle({ title: '新标题' });

// 设置导航栏颜色
uni.setNavigationBarColor({
  frontColor: '#ffffff',       // 仅支持 #ffffff 或 #000000
  backgroundColor: '#007AFF',
  animation: { duration: 400, timingFunc: 'easeIn' },
});

// 显示/隐藏导航栏 loading
uni.showNavigationBarLoading();
uni.hideNavigationBarLoading();

// 自定义右上角按钮（pages.json 中配置）
// "navigationBarButtons": [{ "text": "添加", "color": "#007AFF" }]
// 通过 onNavigationBarButtonTap 监听点击
```

### 12.3 TabBar 操作

```js
// 设置 tabBar 角标
uni.setTabBarBadge({ index: 0, text: '99+' });
uni.removeTabBarBadge({ index: 0 });

// 显示红点
uni.showTabBarRedDot({ index: 1 });
uni.hideTabBarRedDot({ index: 1 });

// 设置 tabBar 某项
uni.setTabBarItem({
  index: 0,
  text: '首页',
  iconPath: 'static/home.png',
  selectedIconPath: 'static/home-active.png',
});

// 显示/隐藏 tabBar
uni.showTabBar({ animation: true });
uni.hideTabBar({ animation: true });
```

### 12.4 页面通信与滚动

```js
// 页面滚动到指定位置
uni.pageScrollTo({
  scrollTop: 0,
  duration: 300,
  selector: '#anchor',  // 滚动到指定元素（H5 不支持 selector）
});

// 获取元素位置
const query = uni.createSelectorQuery();
query.select('#myElement').boundingClientRect((rect) => {
  console.log(rect.top, rect.left, rect.width, rect.height);
}).exec();

// 也可以链式调用
uni.createSelectorQuery()
  .selectAll('.item')
  .boundingClientRect()
  .exec(([rects]) => {
    rects.forEach(rect => console.log(rect));
  });
```

### 12.5 动画

```js
// 创建动画
const animation = uni.createAnimation({
  duration: 500,
  timingFunction: 'ease',    // linear/ease/ease-in/ease-out/ease-in-out/step-start/step-end
  delay: 0,
  transformOrigin: '50% 50% 0',
});

// 链式定义动画步骤
animation
  .opacity(0.5)
  .rotate(45)
  .step()              // 每步之间用 step() 分隔
  .opacity(1)
  .rotate(90)
  .step({ duration: 1000 });

// 导出动画数据
const animData = animation.export();

// 应用到模板
// <view :animation="animData"></view>
```

---

## 13. 状态管理（Pinia）

### 13.1 定义 Store

```js
// stores/userStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

// 组合式 Store（推荐）
export const useUserStore = defineStore('user', () => {
  // state
  const token = ref(uni.getStorageSync('token') || '');
  const userInfo = ref(null);
  const isLoggedIn = computed(() => !!token.value);

  // actions
  async function login(credentials) {
    try {
      const res = await http.post('/auth/login', credentials);
      token.value = res.token;
      userInfo.value = res.user;
      uni.setStorageSync('token', res.token);
    } catch (err) {
      throw err;
    }
  }

  function logout() {
    token.value = '';
    userInfo.value = null;
    uni.removeStorageSync('token');
    uni.reLaunch({ url: '/pages/login/login' });
  }

  async function fetchUserInfo() {
    if (!token.value) return;
    userInfo.value = await http.get('/user/info');
  }

  // 持久化
  function $persist() {
    uni.setStorageSync('user_info', JSON.stringify(userInfo.value));
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    login,
    logout,
    fetchUserInfo,
  };
});

// 选项式 Store（旧写法，也支持）
export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [],
    total: 0,
  }),
  getters: {
    itemCount: (state) => state.items.length,
    totalPrice: (state) => state.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  },
  actions: {
    addItem(product) {
      const existing = this.items.find(i => i.id === product.id);
      if (existing) {
        existing.quantity++;
      } else {
        this.items.push({ ...product, quantity: 1 });
      }
    },
    removeItem(id) {
      this.items = this.items.filter(i => i.id !== id);
    },
    clearCart() {
      this.$reset(); // 重置到初始状态
    },
  },
});
```

### 13.2 使用 Store

```vue
<script setup>
import { storeToRefs } from 'pinia';
import { useUserStore } from '@/stores/userStore';
import { useCartStore } from '@/stores/cartStore';

const userStore = useUserStore();
const cartStore = useCartStore();

// storeToRefs 保持响应性（只解构 state 和 getter）
const { token, userInfo, isLoggedIn } = storeToRefs(userStore);
// actions 直接解构
const { login, logout } = userStore;

// 订阅 store 变化
userStore.$subscribe((mutation, state) => {
  console.log('user store changed:', mutation.type, state);
});

// 直接修改（不推荐，但可用）
userStore.$patch({ token: 'new_token' });
userStore.$patch((state) => {
  state.token = 'new_token';
  state.userInfo = null;
});
</script>
```

---

## 14. 样式与 rpx

### 14.1 rpx 单位

```css
/*
  rpx（responsive pixel）：响应式单位
  以 750rpx 为设计稿宽度基准
  在 375px 宽的屏幕上：1rpx = 0.5px
  在 750px 宽的屏幕上：1rpx = 1px

  公式：rpx = 设计稿px * 750 / 设计稿宽度
  例：设计稿750px宽，元素100px → 100rpx
  例：设计稿375px宽，元素100px → 200rpx
*/
.container {
  width: 750rpx;    /* 全宽 */
  padding: 24rpx;
  font-size: 28rpx; /* 约 14px */
}
```

### 14.2 内置 CSS 变量

```css
/* 安全区域适配 */
.footer {
  padding-bottom: env(safe-area-inset-bottom);
  padding-bottom: constant(safe-area-inset-bottom); /* iOS < 11.2 */
}

.top-bar {
  padding-top: env(safe-area-inset-top);
}
```

### 14.3 样式作用域

```vue
<style scoped>
/* scoped：仅作用于当前组件，不影响子组件 */
.container { color: red; }

/* 深度选择器：穿透 scoped 影响子组件 */
:deep(.child-class) { color: blue; }
/* 旧写法（不推荐）：/deep/ 或 >>> */
</style>

<style>
/* 无 scoped：全局样式 */
.global-class { font-size: 28rpx; }
</style>

<style lang="scss">
/* 支持 SCSS/LESS（需安装对应 loader） */
$primary: #007AFF;
.button {
  background: $primary;
  &:hover { opacity: 0.8; }
}
</style>
```

### 14.4 平台样式适配

```vue
<style>
/* H5 独有样式 */
/* #ifdef H5 */
.container { max-width: 750px; margin: 0 auto; }
/* #endif */

/* 微信小程序独有样式 */
/* #ifdef MP-WEIXIN */
.nav-bar { background: #07C160; }
/* #endif */
</style>
```

---

## 15. 条件编译

### 15.1 JS 条件编译

```js
// 平台判断
// #ifdef APP-PLUS
console.log('仅在 App 端执行');
import nativePlugin from 'nativePlugin';
// #endif

// #ifdef H5
console.log('仅在 H5 端执行');
// #endif

// #ifdef MP-WEIXIN
console.log('仅在微信小程序执行');
// #endif

// #ifdef MP-ALIPAY
console.log('仅在支付宝小程序执行');
// #endif

// #ifndef H5
console.log('非 H5 端执行（排除 H5）');
// #endif

// 多平台
// #ifdef APP-PLUS || H5
console.log('App 或 H5 执行');
// #endif

// #ifdef APP-PLUS-ANDROID
console.log('仅 Android');
// #endif

// #ifdef APP-PLUS-IOS
console.log('仅 iOS');
// #endif
```

### 15.2 模板条件编译

```vue
<template>
  <!-- #ifdef H5 -->
  <view>仅 H5 显示</view>
  <!-- #endif -->

  <!-- #ifdef MP-WEIXIN -->
  <button open-type="getUserInfo">微信授权</button>
  <!-- #endif -->

  <!-- #ifndef MP-WEIXIN -->
  <button @click="customLogin">登录</button>
  <!-- #ifndef -->
</template>
```

### 15.3 pages.json 条件编译

```json
{
  "pages": [
    // #ifdef APP-PLUS
    {
      "path": "pages/app-only/index",
      "style": {}
    },
    // #endif
    {
      "path": "pages/index/index",
      "style": {}
    }
  ]
}
```

### 15.4 平台判断（运行时）

```js
// 推荐在编译期用条件编译，但也可运行时判断
const platform = uni.getSystemInfoSync().platform;

if (platform === 'android') {
  // Android 逻辑
} else if (platform === 'ios') {
  // iOS 逻辑
}

// 通过 process.env 判断
if (process.env.UNI_PLATFORM === 'h5') {
  // H5 专属逻辑
}
```

---

## 16. 事件总线

### 16.1 uni.$emit / $on（全局事件总线）

```js
// 发送事件（任意页面/组件）
uni.$emit('refreshData', { type: 'user', id: 123 });

// 监听事件（需在页面显示时注册，隐藏时注销）
onShow(() => {
  uni.$on('refreshData', handleRefresh);
});

onHide(() => {
  uni.$off('refreshData', handleRefresh);
});

function handleRefresh(data) {
  console.log('收到刷新事件:', data);
  loadData();
}

// 只监听一次
uni.$once('initDone', () => {
  console.log('初始化完成');
});

// 注销所有监听
uni.$off('refreshData');
```

---

## 17. uni_modules 插件

### 17.1 安装与使用

```
1. 在 HBuilderX 中：右键项目 → 从插件市场导入插件
2. 在 uni-app cli 项目：uni_modules 目录下自动管理
```

### 17.2 常用官方组件库（uni-ui）

```vue
<!-- 自动安装后，通过 easycom 直接使用 -->

<!-- 日历 -->
<uni-calendar :selected="selectedDates" @change="onCalendarChange" />

<!-- 轮播图增强 -->
<uni-swipe-action>
  <uni-swipe-action-item :right-options="options" @click="onSwipeClick">
    <view class="list-item">{{ item.name }}</view>
  </uni-swipe-action-item>
</uni-swipe-action>

<!-- 图标 -->
<uni-icons type="home" size="28" color="#007AFF" />

<!-- 加载更多 -->
<uni-load-more status="loading" />  <!-- loading / noMore / more -->

<!-- 搜索栏 -->
<uni-search-bar v-model="searchText" placeholder="搜索" @confirm="onSearch" />

<!-- 表单 -->
<uni-forms :model="formData" :rules="rules" ref="formRef">
  <uni-forms-item label="姓名" name="name">
    <uni-easyinput v-model="formData.name" placeholder="请输入姓名" />
  </uni-forms-item>
</uni-forms>

<!-- 数量选择 -->
<uni-number-box v-model="count" :min="1" :max="99" />

<!-- 弹出层 -->
<uni-popup ref="popupRef" type="bottom">
  <view class="popup-content">弹出内容</view>
</uni-popup>
<button @click="popupRef.open()">打开</button>
```

---

## 18. 性能优化

### 18.1 渲染优化

```vue
<!-- 1. 列表渲染必须加 key -->
<view v-for="item in list" :key="item.id">...</view>

<!-- 2. 长列表使用虚拟列表（uni-app 提供 recycle-list） -->
<recycle-list :list-data="bigList" :item-size="80">
  <cell-slot :index="index">
    <view>{{ dataItem.name }}</view>
  </cell-slot>
</recycle-list>

<!-- 3. 避免频繁操作 DOM，使用数据驱动 -->
<!-- 4. 图片懒加载 -->
<image lazy-load :src="item.url" />

<!-- 5. 使用 v-memo 缓存子树（Vue 3.2+） -->
<view v-memo="[item.id, item.status]">
  <!-- 只有 id 或 status 变化才重渲染 -->
</view>
```

### 18.2 数据优化

```js
// 1. 减少 setData 调用（小程序）
// 错误：频繁赋值
list.value.forEach((item, i) => {
  list.value[i].count++; // 每次都触发更新
});

// 正确：批量更新
const newList = list.value.map(item => ({ ...item, count: item.count + 1 }));
list.value = newList; // 一次更新

// 2. 分页加载
const page = ref(1);
const list = ref([]);
const noMore = ref(false);

async function loadMore() {
  if (noMore.value) return;
  const res = await http.get('/api/list', { page: page.value, size: 20 });
  list.value.push(...res.data);
  noMore.value = res.data.length < 20;
  page.value++;
}

// 3. 防抖搜索
import { debounce } from 'lodash-es';
const search = debounce(async (keyword) => {
  const res = await http.get('/api/search', { q: keyword });
  searchResults.value = res.data;
}, 300);
```

### 18.3 分包加载

```json
// pages.json
{
  "pages": [/* 主包页面 */],
  "subPackages": [
    {
      "root": "pagesA",
      "pages": [{ "path": "detail/index" }]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "wifi",
      "packages": ["pagesA"]
    }
  }
}
```

### 18.4 启动优化

```js
// 1. 减少首屏请求数
// 2. 使用骨架屏
// 3. 本地缓存策略
async function loadData() {
  // 先读缓存，立即显示
  const cached = uni.getStorageSync('home_data');
  if (cached) data.value = JSON.parse(cached);

  // 再请求网络，更新数据
  try {
    const fresh = await http.get('/api/home');
    data.value = fresh;
    uni.setStorageSync('home_data', JSON.stringify(fresh));
  } catch (err) {
    // 网络失败，使用缓存
  }
}
```

---

## 19. 常见问题速查

### 19.1 样式问题

```
Q: rpx 和 px 如何换算？
A: 设计稿750px时，rpx与px 1:1；设计稿375px时，1px = 2rpx

Q: 小程序不支持哪些 CSS？
A: 不支持 * 选择器、:root 选择器、属性选择器[attr]（部分支持）

Q: 如何使用字体图标？
A: 将 .ttf 文件转为 base64 后在 App.vue 全局样式中用 @font-face 引入

Q: 自定义导航栏高度如何适配？
A: statusBarHeight + 44（胶囊按钮区域）= 导航栏总高度
```

### 19.2 平台差异

```
Q: 微信小程序不支持 window/document 对象
A: 使用 uni.createSelectorQuery() 替代 querySelector

Q: H5 端路由 history 模式如何配置 Nginx？
A: try_files $uri $uri/ /index.html;

Q: App 端如何调用原生能力？
A: 使用 plus.xxx API，或 uni-app 原生插件

Q: 小程序包大小限制？
A: 主包 2MB，单个分包 2MB，总包 20MB（微信）
```

### 19.3 常见错误

```
Q: "Cannot read property of undefined"
A: 使用可选链 obj?.prop 或在模板中使用 v-if 判断

Q: 请求失败 "request:fail abort"
A: 检查域名是否在小程序后台白名单中

Q: 图片不显示
A: 检查路径（小程序不支持绝对路径本地图片），使用 @/ 相对路径或网络图片

Q: 页面返回数据丢失
A: 使用 Pinia / eventChannel / uni.$emit 传递数据

Q: iOS 安全区域遮挡内容
A: 使用 env(safe-area-inset-bottom) 添加底部内边距

Q: v-model 在自定义组件中无效
A: 确认组件 defineProps(['modelValue']) 和 emit('update:modelValue', val)

Q: 微信小程序 webview 无法使用
A: webview 页面不能是 tabBar 页面，且域名需配置业务域名白名单
```

---

> 📌 **参考资源**
> - [uni-app 官方文档](https://uniapp.dcloud.net.cn/)
> - [uni-app GitHub](https://github.com/dcloudio/uni-app)
> - [DCloud 插件市场](https://ext.dcloud.net.cn/)
> - [uni-ui 组件库](https://uniapp.dcloud.net.cn/component/uniui/uni-ui.html)
> - [HBuilderX 下载](https://www.dcloud.io/hbuilderx.html)
