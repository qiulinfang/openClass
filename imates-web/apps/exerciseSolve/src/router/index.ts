import { createRouter, createWebHashHistory } from 'vue-router'
import ExerciseSolveView from '@/views/ExerciseSolveView.vue'

const router = createRouter({
  history: createWebHashHistory(), // 必须使用Hash模式
  routes: [
    {
      path: '/',
      name: 'exerciseSolve',
      component: ExerciseSolveView
    }
  ]
})

export default router