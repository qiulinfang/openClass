import { createRouter, createWebHashHistory } from 'vue-router'
import MainView from '@/views/MainView.vue'
import ExerciseSolveView from '@/views/ExerciseSolveView.vue'
import LoginView from '@/views/LoginView.vue'
import KnowledgeGraphView from '@/views/KnowledgeGraphView.vue'
import MyProfileView from '@/views/MyProfileView.vue'
import MyResourcesView from '@/views/MyResourcesView.vue'
import FeedbackView from '@/views/FeedbackView.vue'

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