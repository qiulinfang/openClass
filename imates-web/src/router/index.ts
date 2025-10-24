import { createRouter, createWebHashHistory } from 'vue-router'
import MainView from '@/views/MainView.vue'
import ExerciseSolveView from '@/views/ExerciseSolveView.vue'
import LoginView from '@/views/LoginView.vue'
import KnowledgeGraphView from '@/views/KnowledgeGraphView.vue'
import MyProfileView from '@/views/MyProfileView.vue'
import MyResourcesView from '@/views/MyResourcesView.vue'
import FeedbackView from '@/views/FeedbackView.vue'
import PdfViewerView from '@/views/PdfViewerView.vue'
import FindExerciseView from '@/views/FindExerciseView.vue'
import LearningView from '@/views/LearningView.vue'
import DrawingBoard from '@/components/DrawingBoard.vue'

const router = createRouter({
  history: createWebHashHistory(), // 必须使用Hash模式
  routes: [
    {
      path: '/',
      name: 'login',
      component: LoginView
    },
    {
      path: '/app',
      component: MainView,
      redirect: '/app/my-profile', // 默认重定向到知识图谱
      children: [
        {
          path: 'exercise-solve',
          name: 'exerciseSolve',
          component: ExerciseSolveView
        },
        {
          path: 'knowledge-graph',
          name: 'knowledgeGraph',
          component: KnowledgeGraphView
        },
        {
          path: 'my-profile',
          name: 'myProfile',
          component: MyProfileView
        },
        {
          path: 'my-resources',
          name: 'myResources',
          component: MyResourcesView
        },
        {
          path: 'feedback',
          name: 'feedback',
          component: FeedbackView
        },
        {
          path: 'pdf-viewer',
          name: 'pdfViewer',
          component: PdfViewerView
        },
        {
          path: 'find-exercise',
          name: 'findExercise',
          component: FindExerciseView
        },
        {
          path: 'learning',
          name: 'learning',
          component: LearningView
        },
        {
          path: 'drawing-board',
          name: 'drawingBoard',
          component: DrawingBoard
        }
      ]
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
      path: '/my-profile',
      redirect: '/app/my-profile'
    },
    {
      path: '/my-resources',
      redirect: '/app/my-resources'
    },
    {
      path: '/feedback',
      redirect: '/app/feedback'
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
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('XUEBAN_TOKEN')
  const isLoggedIn = !!token
  
  // 如果访问登录页面，直接放行
  if (to.name === 'login') {
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
  
  // 已登录，正常访问
  next()
})

export default router