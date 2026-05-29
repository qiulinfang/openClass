import { createHashRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import LoginView from '@/views/LoginView'
import MainView from '@/views/MainView'
import { getXuebanToken } from '@/services'

const ExerciseSolveView = lazy(() => import('@/views/ExerciseSolveView'))
const ExerciseSolveViewNew = lazy(() => import('@/views/ExerciseSolveViewNew'))
const KnowledgeGraphView = lazy(() => import('@/views/KnowledgeGraphView'))
const MyResourcesView = lazy(() => import('@/views/MyResourcesView'))
const PdfViewerView = lazy(() => import('@/views/PdfViewerView'))
const HtmlViewerView = lazy(() => import('@/views/HtmlViewerView'))
const HtmlPreviewView = lazy(() => import('@/views/HtmlPreviewView'))
const VideoViewerView = lazy(() => import('@/views/VideoViewerView'))
const FindExerciseView = lazy(() => import('@/views/FindExerciseView'))
const LearningView = lazy(() => import('@/views/LearningView'))
const LearningContentView = lazy(() => import('@/views/LearningContentView'))
const MyFavoritesView = lazy(() => import('@/views/MyFavoritesView'))
const PhotoSearchView = lazy(() => import('@/views/PhotoSearchView'))
const MyHomeworkView = lazy(() => import('@/views/MyHomeworkView'))
const MistakeBookView = lazy(() => import('@/views/MistakeBookView'))
const HomeworkAnswerView = lazy(() => import('@/views/HomeworkAnswerView'))
const DraftNotebookView = lazy(() => import('@/views/DraftNotebookView'))
const InteractiveCanvasView = lazy(() => import('@/views/InteractiveCanvasView'))

const Loading = () => <div>Loading...</div>

const router = createHashRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />
  },
  {
    path: '/login',
    element: <LoginView />
  },
  {
    path: '/app',
    element: <Suspense fallback={<Loading />}><MainView /></Suspense>,
    children: [
      {
        index: true,
        element: <Navigate to="/app/knowledge-graph" replace />
      },
      {
        path: 'exercise-solve',
        element: <Suspense fallback={<Loading />}><ExerciseSolveViewNew /></Suspense>
      },
      {
        path: 'knowledge-graph',
        element: <Suspense fallback={<Loading />}><KnowledgeGraphView /></Suspense>
      },
      {
        path: 'my-resources',
        element: <Suspense fallback={<Loading />}><MyResourcesView /></Suspense>
      },
      {
        path: 'pdf-viewer',
        element: <Suspense fallback={<Loading />}><PdfViewerView /></Suspense>
      },
      {
        path: 'html-viewer',
        element: <Suspense fallback={<Loading />}><HtmlViewerView /></Suspense>
      },
      {
        path: 'html-preview',
        element: <Suspense fallback={<Loading />}><HtmlPreviewView /></Suspense>
      },
      {
        path: 'video-viewer',
        element: <Suspense fallback={<Loading />}><VideoViewerView /></Suspense>
      },
      {
        path: 'find-exercise',
        element: <Suspense fallback={<Loading />}><FindExerciseView /></Suspense>
      },
      {
        path: 'learning',
        element: <Suspense fallback={<Loading />}><LearningView /></Suspense>
      },
      {
        path: 'learning-content',
        element: <Suspense fallback={<Loading />}><LearningContentView /></Suspense>
      },
      {
        path: 'my-favorites',
        element: <Suspense fallback={<Loading />}><MyFavoritesView /></Suspense>
      },
      {
        path: 'my-homework',
        element: <Suspense fallback={<Loading />}><MyHomeworkView /></Suspense>
      },
      {
        path: 'mistake-book',
        element: <Suspense fallback={<Loading />}><MistakeBookView /></Suspense>
      },
      {
        path: 'homework-answer/:homeworkId?',
        element: <Suspense fallback={<Loading />}><HomeworkAnswerView /></Suspense>
      },
      {
        path: 'draft-notebook',
        element: <Suspense fallback={<Loading />}><DraftNotebookView /></Suspense>
      }
    ]
  },
  {
    path: '/photo-search',
    element: <Suspense fallback={<Loading />}><PhotoSearchView /></Suspense>
  },
  {
    path: '/exercise-solve-new',
    element: <Suspense fallback={<Loading />}><ExerciseSolveView /></Suspense>
  },
  {
    path: '/interactive-canvas',
    element: <Suspense fallback={<Loading />}><InteractiveCanvasView /></Suspense>
  },
  // 重定向旧路由到新路由
  {
    path: '/exercise-solve',
    element: <Navigate to="/app/exercise-solve" replace />
  },
  {
    path: '/knowledge-graph',
    element: <Navigate to="/app/knowledge-graph" replace />
  },
  {
    path: '/my-resources',
    element: <Navigate to="/app/my-resources" replace />
  },
  {
    path: '/find-exercise',
    element: <Navigate to="/app/find-exercise" replace />
  },
  {
    path: '/learning',
    element: <Navigate to="/app/learning" replace />
  }
])

// 路由守卫
router.beforeEach = (to, from, next) => {
  const token = getXuebanToken()
  const isLoggedIn = !!token

  // 测试页面直接放行
  const testPaths = ['/login', '/interactive-canvas']
  if (testPaths.includes(to.path)) {
    return next()
  }

  // /app 和 /photo-search 需要登录
  if (to.path.startsWith('/app') || to.path.startsWith('/photo-search')) {
    if (!isLoggedIn) {
      return next('/login')
    }
  }

  next()
}

export default router
