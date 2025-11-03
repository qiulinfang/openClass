/**
 * 导航类型定义
 * 定义所有路由的参数类型
 */

export type RootStackParamList = {
  Login: undefined
  Main: undefined
  ExerciseSolve: { id?: string }
  KnowledgeGraph: undefined
  MyProfile: undefined
  MyResources: undefined
  Feedback: undefined
  PdfViewer: { url: string }
  HtmlViewer: { url: string }
  VideoViewer: { url: string }
  FindExercise: undefined
  Learning: undefined
  DrawingBoard: undefined
}

export type MainTabParamList = {
  ExerciseSolve: undefined
  KnowledgeGraph: undefined
  MyProfile: undefined
  MyResources: undefined
  Feedback: undefined
  FindExercise: undefined
  Learning: undefined
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

