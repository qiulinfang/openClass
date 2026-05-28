import { createBrowserRouter, Navigate } from 'react-router-dom'

export interface RouteConfig {
  path: string
  element: React.ReactNode
  children?: RouteConfig[]
}

const routes: RouteConfig[] = [
  {
    path: '/',
    element: <Navigate to="/home" replace />,
  },
  {
    path: '/home',
    element: <div>Home Page</div>,
  },
  {
    path: '/chat',
    element: <div>Chat Page</div>,
  },
  {
    path: '/profile',
    element: <div>Profile Page</div>,
  },
]

export const router = createBrowserRouter(routes)

export default router
