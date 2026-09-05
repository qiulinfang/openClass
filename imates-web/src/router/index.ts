import { createRouter, createWebHashHistory } from 'vue-router'
import { getXuebanToken } from '@/services'
import { useUserClientStore } from '@/stores/userClientStore'
import { useTeacherChatStore } from '@/stores/teacherChatStore'

const router = createRouter({
  history: createWebHashHistory(), // 必须使用Hash模式
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue')
    },
    // 经开二中主页路由
    {
      path: '/app-jk',
      name: 'mainJk',
      component: () => import('@/views/JK/MainViewJK.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/app',
      component: () => import('@/views/MainView.vue'),
      redirect: '/app/knowledge-graph', // 默认重定向到知识图谱
      children: [
        // 我的习题路由
        {
          path: 'exercise-solve',
          name: 'exerciseSolve',
          component: () => import('@/views/ExerciseSolveView.vue')
        },
        // 知识图谱路由
        {
          path: 'knowledge-graph',
          name: 'knowledgeGraph',
          component: () => import('@/views/KnowledgeGraphView.vue')
        },
        // 我的资源路由
        {
          path: 'my-resources',
          name: 'myResources',
          component: () => import('@/views/MyResourcesView.vue')
        },
        // PDF查看器路由
        {
          path: 'pdf-viewer',
          name: 'pdfViewer',
          component: () => import('@/views/PdfViewerView.vue')
        },
        // 中关村一小PDF查看器路由
        {
          path: 'pdf-viewer-zgc',
          name: 'pdfViewerZgc',
          component: () => import('@/views/PdfViewerViewZGC.vue')
        },
        // 经开二中PDF查看器路由
        {
          path: 'pdf-viewer-jk',
          name: 'pdfViewerJk',
          component: () => import('@/views/JK/PdfViewerViewJK.vue')
        },
        // 首都师范PDF查看器路由
        {
          path: 'pdf-viewer-sdsf',
          name: 'pdfViewerSdsf',
          component: () => import('@/views/PdfViewerViewSdsf.vue')
        },
        // HTML查看器路由
        {
          path: 'html-viewer',
          name: 'htmlViewer',
          component: () => import('@/views/HtmlViewerView.vue')
        },
        // HTML预览器路由（用于URL预览）
        {
          path: 'html-preview',
          name: 'htmlPreview',
          component: () => import('@/views/HtmlPreviewView.vue')
        },
        // 视频查看器路由
        {
          path: 'video-viewer',
          name: 'videoViewer',
          component: () => import('@/views/VideoViewerView.vue')
        },
        // 找题路由
        {
          path: 'find-exercise',
          name: 'findExercise',
          component: () => import('@/views/FindExerciseView.vue')
        },
        // 去学习路由
        {
          path: 'learning',
          name: 'learning',
          component: () => import('@/views/LearningView.vue')
        },
        // 学习内容详情路由
        {
          path: 'learning-content',
          name: 'learningContent',
          component: () => import('@/views/LearningContentView.vue')
        },
        // 我的收藏路由
        {
          path: 'my-favorites',
          name: 'myFavorites',
          component: () => import('@/views/MyFavoritesView.vue')
        },
        // 我的作业路由
        {
          path: 'my-homework',
          name: 'myHomework',
          component: () => import('@/views/MyHomeworkView.vue')
        },
        // 作业回答路由
        {
          path: 'homework-answer/:homeworkId?',
          name: 'homeworkAnswer',
          component: () => import('@/views/HomeworkAnswerView.vue')
        },
        // 经开二中作业回答路由
        {
          path: 'homework-answer-jk/:homeworkId?',
          name: 'homeworkAnswerJk',
          component: () => import('@/views/JK/HomeworkAnswerViewJK.vue')
        },
        // 经开二中作业预习统计路由
        {
          path: 'homework-preview-analysis/:homeworkId?',
          name: 'homeworkPreviewAnalysis',
          component: () => import('@/views/JK/HomeworkPreviewAnalysisView.vue')
        },
        // 经开二中综合统计分析看板路由
        {
          path: 'jk-stats-dashboard/:homeworkId?',
          name: 'jkStatsDashboard',
          component: () => import('@/views/JK/JKStatsDashboard.vue')
        },
        // 作业答题跳转到学伴（从 homeworkAnswer 跳转专用）
        {
          path: 'homework-exercise',
          name: 'homeworkExercise',
          component: () => import('@/views/ExerciseSolveView.vue')
        }
      ]
    },
    {
      path: '/photo-search',
      name: 'photoSearch',
      component: () => import('@/views/PhotoSearchView.vue')
    },
    {
      path: '/chat-session-test',
      name: 'chatSessionTest',
      component: () => import('@/views/ChatSessionTestView.vue')
    },
    {
      path: '/debug-api',
      name: 'debugApi',
      component: () => import('@/views/ApiDebugView.vue')
    },
    {
      path: '/render-test',
      name: 'renderTest',
      component: () => import('@/views/RenderTestView.vue')
    },
    {
      path: '/lottie-test',
      name: 'lottieTest',
      component: () => import('@/views/LottieTest.vue')
    },
    {
      path: '/mini-exercise',
      name: 'miniExercise',
      component: () => import('@/views/MiniExerciseView.vue')
    },
    {
      path: '/pdf-viewer-jk2',
      name: 'pdfViewerJk2',
      component: () => import('@/views/JK/PdfViewerViewJK2.vue')
    },
    // 重定向旧路由到新路由
    {
      path: '/exercise-solve',
      redirect: '/app/exercise-solve'
    },
    {
      path: '/knowledge-graph',
      redirect: '/app/knowledge-graph'
    },
    {
      path: '/my-resources',
      redirect: '/app/my-resources'
    },
    {
      path: '/find-exercise',
      redirect: '/app/find-exercise'
    },
    {
      path: '/learning',
      redirect: '/app/learning'
    }
  ]
})

// 路由守卫 - 检查登录状态
router.beforeEach(async (to, from, next) => {
  const token = getXuebanToken()
  const isLoggedIn = !!token

  // 1. 定义免登录直接访问的公开路由白名单
  const publicRoutePaths = [
    '/login',
    '/mini-exercise',
    '/pdf-viewer-jk2',
    '/app/pdf-viewer-zgc',
    '/app/pdf-viewer-sdsf',
    '/app/pdf-viewer-jk',
    '/chat-session-test',
    '/debug-api',
    '/render-test',
    '/lottie-test'
  ]

  const isPublicRoute =
    to.name === 'login' ||
    publicRoutePaths.some(p => to.path === p || to.path.startsWith(p))

  // 如果访问公开免登页面，自动注入游客/默认凭证并直接放行
  if (isPublicRoute) {
    // 注入默认游客信息/Token，确保页面在无登录态访问时基础参数及请求不报错
    if (!getXuebanToken()) {
      localStorage.setItem('XUEBAN_TOKEN', 'GUEST_DEFAULT_TOKEN')
    }
    if (!localStorage.getItem('xuebanuserid')) {
      localStorage.setItem('xuebanuserid', 'guest')
    }
    if (!localStorage.getItem('userInfo')) {
      localStorage.setItem(
        'userInfo',
        JSON.stringify({ id: 'guest', name: '游客用户', account: 'guest' })
      )
    }

    // 如果是从已登录页面跳转到登录页面，断开 WebSocket 连接
    if (to.path === '/login' && from.path.startsWith('/app')) {
      try {
        const userClientStore = useUserClientStore()
        if (userClientStore.isConnected) {
          console.log('[路由守卫] 检测到跳转到登录页，断开客服 WebSocket 连接')
          userClientStore.disconnect()
        }

        const teacherChatStore = useTeacherChatStore()
        if (teacherChatStore.webSocketInitialized) {
          console.log('[路由守卫] 检测到跳转到登录页，断开教师 WebSocket 连接')
          teacherChatStore.cleanupMessageReceiver()
        }
      } catch (error) {
        console.error('[路由守卫] 断开 WebSocket 连接时出错:', error)
      }
    }

    next()
    return
  }

  // 2. 如果访问受保护的 /app 或 /app-jk 路由，需要登录
  if (to.path.startsWith('/app') || to.path === '/app-jk') {
    if (!isLoggedIn) {
      next({ name: 'login' })
      return
    }

    // 已登录用户进入 /app 路由，自动建立 WebSocket 连接
    try {
      // 客服WebSocket连接
      const userClientStore = useUserClientStore()
      if (!userClientStore.isConnected) {
        userClientStore.connect().catch(error => {
          console.error('[路由守卫] 客服WebSocket 连接失败:', error)
        })
      }

      // 教师WebSocket连接（单连接多会话架构）
      const teacherChatStore = useTeacherChatStore()
      if (!teacherChatStore.webSocketInitialized) {
        teacherChatStore.initMessageReceiver().catch(error => {
          console.error('[路由守卫] 教师WebSocket 连接失败:', error)
        })
      }
    } catch (error) {
      console.error('[路由守卫] 初始化 WebSocket 连接时出错:', error)
    }
  }

  // 3. 如果访问 /photo-search，需要登录
  if (to.path === '/photo-search' || to.path.startsWith('/photo-search')) {
    if (!isLoggedIn) {
      next({ name: 'login' })
      return
    }
  }

  // 正常放行
  next()
})

export default router