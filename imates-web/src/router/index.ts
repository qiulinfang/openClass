import { createRouter, createWebHashHistory } from 'vue-router'
import MainView from '@/views/MainView.vue'
import ExerciseSolveView from '@/views/ExerciseSolveView.vue'
import LoginView from '@/views/LoginView.vue'
import KnowledgeGraphView from '@/views/KnowledgeGraphView.vue'
import MyResourcesView from '@/views/MyResourcesView.vue'
import PdfViewerView from '@/views/PdfViewerView.vue'
import HtmlViewerView from '@/views/HtmlViewerView.vue'
import VideoViewerView from '@/views/VideoViewerView.vue'
import FindExerciseView from '@/views/FindExerciseView.vue'
import LearningView from '@/views/LearningView.vue'
import LearningContentView from '@/views/LearningContentView.vue'
import DrawingBoardView from '@/views/DrawingBoardView.vue'
import MyFavoritesView from '@/views/MyFavoritesView.vue'
import PhotoSearchView from '@/views/PhotoSearchView.vue'
import MyHomeworkView from '@/views/MyHomeworkView.vue'
import HomeworkAnswerView from '@/views/HomeworkAnswerView.vue'
import ChatSessionTestView from '@/views/ChatSessionTestView.vue'
import ApiDebugView from '@/views/ApiDebugView.vue'
import RenderTestView from '@/views/RenderTestView.vue'
import { getXuebanToken } from '@/services'

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
        // 画板路由
        {
          path: 'drawing-board',
          name: 'drawingBoard',
          component: DrawingBoardView
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
    to.name === 'renderTest' ||
    to.path === '/render-test'
  ) {
    next()
    return
  }
  
  // 如果访问 /app 下的任何路由，需要登录
  if (to.path.startsWith('/app')) {
    if (!isLoggedIn) {
      next({ name: 'login' })
      return
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