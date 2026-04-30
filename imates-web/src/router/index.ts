import { createRouter, createWebHashHistory } from 'vue-router'
import MainView from '@/views/MainView.vue'
import ExerciseSolveView from '@/views/ExerciseSolveView.vue'
import LoginView from '@/views/LoginView.vue'
import KnowledgeGraphView from '@/views/KnowledgeGraphView.vue'
import MyResourcesView from '@/views/MyResourcesView.vue'
import PdfViewerView from '@/views/PdfViewerView.vue'
import HtmlViewerView from '@/views/HtmlViewerView.vue'
import HtmlPreviewView from '@/views/HtmlPreviewView.vue'
import VideoViewerView from '@/views/VideoViewerView.vue'
import FindExerciseView from '@/views/FindExerciseView.vue'
import LearningView from '@/views/LearningView.vue'
import LearningContentView from '@/views/LearningContentView.vue'
import MyFavoritesView from '@/views/MyFavoritesView.vue'
import PhotoSearchView from '@/views/PhotoSearchView.vue'
import MyHomeworkView from '@/views/MyHomeworkView.vue'
import HomeworkAnswerView from '@/views/HomeworkAnswerView.vue'
import ChatSessionTestView from '@/views/ChatSessionTestView.vue'
import ApiDebugView from '@/views/ApiDebugView.vue'
import RenderTestView from '@/views/RenderTestView.vue'
import LottieTest from '@/views/LottieTest.vue'
import ExerciseSolveViewNew from '@/views/ExerciseSolveViewNew.vue'
import InteractiveCanvasView from '@/views/InteractiveCanvasView.vue'
import TeacherDebugView from '@/views/ApiTest/TeacherDebugView.vue'
import QuestionStructureTest from '@/views/ApiTest/QuestionStructureTest.vue'
import ApiTestIndex from '@/views/ApiTest/Index.vue'
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
      component: LoginView
    },
    {
      path: '/app',
      component: MainView,
      redirect: '/app/knowledge-graph', // 默认重定向到知识图谱
      children: [
        // 我的习题路由
        {
          path: 'exercise-solve',
          name: 'exerciseSolve',
          component: ExerciseSolveViewNew
        },
        {
          path: '/exercise-solve-new',
          name: 'exerciseSolveNew',
          component: ExerciseSolveView
        },
        // 知识图谱路由
        {
          path: 'knowledge-graph',
          name: 'knowledgeGraph',
          component: KnowledgeGraphView
        },
        // 我的资源路由
        {
          path: 'my-resources',
          name: 'myResources',
          component: MyResourcesView
        },
        // PDF查看器路由
        {
          path: 'pdf-viewer',
          name: 'pdfViewer',
          component: PdfViewerView
        },
        // HTML查看器路由
        {
          path: 'html-viewer',
          name: 'htmlViewer',
          component: HtmlViewerView
        },
        // HTML预览器路由（用于URL预览）
        {
          path: 'html-preview',
          name: 'htmlPreview',
          component: HtmlPreviewView
        },
        // 视频查看器路由
        {
          path: 'video-viewer',
          name: 'videoViewer',
          component: VideoViewerView
        },
        // 找题路由
        {
          path: 'find-exercise',
          name: 'findExercise',
          component: FindExerciseView
        },
        // 去学习路由
        {
          path: 'learning',
          name: 'learning',
          component: LearningView
        },
        // 学习内容详情路由
        {
          path: 'learning-content',
          name: 'learningContent',
          component: LearningContentView
        },
        // 我的收藏路由
        {
          path: 'my-favorites',
          name: 'myFavorites',
          component: MyFavoritesView
        },
        // 我的作业路由
        {
          path: 'my-homework',
          name: 'myHomework',
          component: MyHomeworkView
        },
        // 作业回答路由
        {
          path: 'homework-answer/:homeworkId?',
          name: 'homeworkAnswer',
          component: HomeworkAnswerView
        },
        // 作业答题跳转到学伴（从 homeworkAnswer 跳转专用）
        {
          path: 'homework-exercise',
          name: 'homeworkExercise',
          component: ExerciseSolveView
        }
      ]
    },
    {
      path: '/photo-search',
      name: 'photoSearch',
      component: PhotoSearchView
    },
    {
      path: '/chat-session-test',
      name: 'chatSessionTest',
      component: ChatSessionTestView
    },
    {
      path: '/debug-api',
      name: 'debugApi',
      component: ApiDebugView
    },
    {
      path: '/render-test',
      name: 'renderTest',
      component: RenderTestView
    },
    {
      path: '/lottie-test',
      name: 'lottieTest',
      component: LottieTest
    },
    {
      path: '/interactive-canvas',
      name: 'interactiveCanvas',
      component: InteractiveCanvasView
    },
    {
      path: '/teacher-debug',
      name: 'teacherDebug',
      component: TeacherDebugView
    },
    {
      path: '/api-test',
      name: 'ApiTestIndex',
      component: ApiTestIndex
    },
    {
      path: '/api-test/structure',
      name: 'QuestionStructureTest',
      component: QuestionStructureTest
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

  // 如果访问登录页面或测试页面，直接放行
  if (
    to.name === 'login' ||
    to.path === '/login' ||
    to.name === 'chatSessionTest' ||
    to.path === '/chat-session-test' ||
    to.name === 'debugApi' ||
    to.path === '/debug-api' ||
    to.name === 'teacherDebug' ||
    to.path === '/teacher-debug' ||
    to.name === 'ApiTestIndex' ||
    to.path === '/api-test' ||
    to.name === 'QuestionStructureTest' ||
    to.path === '/api-test/structure' ||
    to.name === 'renderTest' ||
    to.path === '/render-test'
  ) {
    console.log("from.path111", from.path)
    // 如果是从已登录页面跳转到登录页面（比如登录过期），断开 WebSocket 连接
    console.log("isLoggedIn111", isLoggedIn)
    if (from.path.startsWith('/app')) {
      try {
        // 断开客服WebSocket连接
        const userClientStore = useUserClientStore()
        console.log("userClientStore.isConnected111", userClientStore.isConnected)
        if (userClientStore.isConnected) {
          console.log('[路由守卫] 检测到登录过期或退出登录，断开客服 WebSocket 连接')
          userClientStore.disconnect()
        }

        // 断开教师WebSocket连接
        const teacherChatStore = useTeacherChatStore()
        if (teacherChatStore.webSocketInitialized) {
          console.log('[路由守卫] 检测到登录过期或退出登录，断开教师 WebSocket 连接')
          teacherChatStore.cleanupMessageReceiver()
        }

      } catch (error) {
        console.error('[路由守卫] 断开 WebSocket 连接时出错:', error)
      }
    }

    next()
    return
  }

  // 如果访问 /app 下的任何路由，需要登录
  if (to.path.startsWith('/app')) {
    if (!isLoggedIn) {
      next({ name: 'login' })
      return
    }
    console.log("to.path111", to.path)

    // 已登录用户进入 /app 路由，自动建立 WebSocket 连接
    try {
      // 客服WebSocket连接
      const userClientStore = useUserClientStore()
      console.log("userClientStore.isConnected111", userClientStore.isConnected)
      // 只有在未连接状态时才建立连接
      if (!userClientStore.isConnected) {
        console.log('[路由守卫] 检测到用户进入 /app 路由，开始建立客服 WebSocket 连接')
        // 注意：这里不等待连接结果，避免阻塞路由跳转
        userClientStore.connect().catch(error => {
          console.error('[路由守卫] 客服WebSocket 连接失败:', error)
          // 连接失败不阻止路由跳转，用户可以在界面上重试
        })
      }

      // 教师WebSocket连接（单连接多会话架构）
      const teacherChatStore = useTeacherChatStore()
      console.log("teacherChatStore.webSocketInitialized111", teacherChatStore.webSocketInitialized)
      // 只有在未初始化状态时才建立连接
      if (!teacherChatStore.webSocketInitialized) {
        console.log('[路由守卫] 检测到用户进入 /app 路由，开始建立教师 WebSocket 连接')
        // 注意：这里不等待连接结果，避免阻塞路由跳转
        teacherChatStore.initMessageReceiver().catch(error => {
          console.error('[路由守卫] 教师WebSocket 连接失败:', error)
          // 连接失败不阻止路由跳转，用户可以在界面上重试
        })
      }

    } catch (error) {
      console.error('[路由守卫] 初始化 WebSocket 连接时出错:', error)
    }
  }

  // 如果访问 /photo-search，需要登录
  if (to.path === '/photo-search' || to.path.startsWith('/photo-search')) {
    if (!isLoggedIn) {
      next({ name: 'login' })
      return
    }
  }

  // 已登录，正常访问
  next()
})

export default router