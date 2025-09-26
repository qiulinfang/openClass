import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import ExerciseSolveView from '@/views/ExerciseSolveView.vue'
import FindExerciseView from '@/views/FindExerciseView.vue'
import LoginView from '@/views/LoginView.vue'
import KnowledgeGraphView from '@/views/KnowledgeGraphView.vue'

const router = createRouter({
  history: createWebHashHistory(), // 必须使用Hash模式
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/exercise-solve',
      name: 'exerciseSolve',
      component: ExerciseSolveView
    },
    {
      path: '/find-exercise',
      name: 'findExercise',
      component: FindExerciseView
    },
    {
      path: '/knowledge-graph',
      name: 'knowledgeGraph',
      component: KnowledgeGraphView
    }
  ]
})

export default router