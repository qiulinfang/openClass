import { createHashRouter, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import LoginView from '@/views/LoginView'
import MainView from '@/views/MainView'
import { getXuebanToken } from '@/services'

/**
 * 路由守卫组件 - 检查登录状态
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = getXuebanToken()
  const isLoggedIn = !!token
  const location = useLocation()

  if (!isLoggedIn) {
    // 重定向到登录页，并记录来源路径以便登录后跳转回来
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}

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
const TeacherDebugView = lazy(() => import('@/views/testView/TeacherDebugView'))
const ApiDebugView = lazy(() => import('@/views/testView/ApiDebugView'))
const ChatSessionTestView = lazy(() => import('@/views/testView/ChatSessionTestView'))
const RenderTestView = lazy(() => import('@/views/testView/RenderTestView'))
const LottieTest = lazy(() => import('@/views/testView/LottieTest'))
const MarkdownRenderTestView = lazy(() => import('@/views/testView/MarkdownRenderTestView'))
const TestExerciseView = lazy(() => import('@/views/testView/TestExerciseView'))
const TestNavView = lazy(() => import('@/views/testView/TestNavView'))

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
    element: (
      <ProtectedRoute>
        <Suspense fallback={<Loading />}>
          <MainView />
        </Suspense>
      </ProtectedRoute>
    ),
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
        path: 'exercise-solve-new',
        element: <Suspense fallback={<Loading />}><ExerciseSolveView /></Suspense>
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
        path: 'homework-exercise',
        element: <Suspense fallback={<Loading />}><ExerciseSolveView /></Suspense>
      },
      {
        path: 'draft-notebook',
        element: <Suspense fallback={<Loading />}><DraftNotebookView /></Suspense>
      }
    ]
  },
  {
    path: '/photo-search',
    element: (
      <ProtectedRoute>
        <Suspense fallback={<Loading />}>
          <PhotoSearchView />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  {
    path: '/interactive-canvas',
    element: <Suspense fallback={<Loading />}><InteractiveCanvasView /></Suspense>
  },
  {
    path: '/teacher-debug',
    element: <Suspense fallback={<Loading />}><TeacherDebugView /></Suspense>
  },
  {
    path: '/debug-api',
    element: <Suspense fallback={<Loading />}><ApiDebugView /></Suspense>
  },
  {
    path: '/chat-session-test',
    element: <Suspense fallback={<Loading />}><ChatSessionTestView /></Suspense>
  },
  {
    path: '/render-test',
    element: <Suspense fallback={<Loading />}><RenderTestView /></Suspense>
  },
  {
    path: '/lottie-test',
    element: <Suspense fallback={<Loading />}><LottieTest /></Suspense>
  },
  {
    path: '/markdown-test',
    element: <Suspense fallback={<Loading />}><MarkdownRenderTestView /></Suspense>
  },
  {
    path: '/test-exercise',
    element: <Suspense fallback={<Loading />}><TestExerciseView /></Suspense>
  },
  {
    path: '/test-nav',
    element: <Suspense fallback={<Loading />}><TestNavView /></Suspense>
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

export default router
