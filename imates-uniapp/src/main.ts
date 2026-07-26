import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import 'katex/dist/katex.min.css'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  app.use(Pinia.createPinia())
  return {
    app,
    Pinia
  }
}
