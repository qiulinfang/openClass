import { createApp } from 'vue'
import { createPinia } from 'pinia'
import quasarUserOptions from './quasar'
import JKStatsDashboard from './views/JK/JKStatsDashboard.vue'

// 导入项目全局样式
import './styles/native-app.css'
import 'katex/dist/katex.min.css'

const app = createApp(JKStatsDashboard)

app.use(createPinia())
quasarUserOptions(app)

app.mount('#app')
