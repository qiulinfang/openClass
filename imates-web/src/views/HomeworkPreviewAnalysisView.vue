<template>
  <div class="homework-preview-analysis">
    <header class="analysis-header">
      <div class="toolbar-left">
        <div class="back-btn" @click="goBack">
          <img src="/icons/goback.svg" alt="返回" class="back-icon" />
        </div>
      </div>
      <div class="analysis-title">预习掌握情况统计</div>
      <div class="toolbar-right">
        <CommonActionButton 
          label="提交给教师" 
          variant="primary" 
          size="sm"
          :loading="submitting"
          @click="handleSubmit"
        />
      </div>
    </header>

    <div class="analysis-body">
      <div class="summary-cards">
        <div class="summary-card layer-a">
          <div class="card-count">{{ layerAStudents.length }}</div>
          <div class="card-label">A层 (冲刺型)</div>
          <div class="card-desc">掌握 8-10 题</div>
        </div>
        <div class="summary-card layer-b">
          <div class="card-count">{{ layerBStudents.length }}</div>
          <div class="card-label">B层 (提升型)</div>
          <div class="card-desc">掌握 4-7 题</div>
        </div>
        <div class="summary-card layer-c">
          <div class="card-count">{{ layerCStudents.length }}</div>
          <div class="card-label">C层 (基础型)</div>
          <div class="card-desc">掌握 0-3 题</div>
        </div>
      </div>

      <div class="student-list-container">
        <div class="list-header">
          <div class="list-title">学生掌握详情 (模拟 30 人数据)</div>
        </div>
        <div class="student-grid">
          <div 
            v-for="student in students" 
            :key="student.id" 
            class="student-item"
            :class="'layer-' + student.layer.toLowerCase()"
          >
            <div class="student-info">
              <span class="student-name">{{ student.name }}</span>
              <span class="student-score">掌握 {{ student.score }} 题</span>
            </div>
            <div class="student-layer-badge">{{ student.layer }}层</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CommonActionButton from '@/components/base/Button.vue'
import { showMessage } from '@/utils'

const router = useRouter()
const submitting = ref(false)

interface Student {
  id: number
  name: string
  score: number
  layer: 'A' | 'B' | 'C'
}

// 模拟 30 个学生数据
const students = ref<Student[]>([])

const generateMockData = () => {
  const names = [
    '张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十',
    '陈一', '林二', '何三', '郭四', '罗五', '梁六', '宋七', '郑八',
    '高九', '徐十', '唐一', '冯二', '杨三', '黄四', '周五', '吴六',
    '徐七', '朱八', '秦九', '尤十', '许一', '何二'
  ]
  
  const mockStudents: Student[] = []
  for (let i = 0; i < 30; i++) {
    const score = Math.floor(Math.random() * 11) // 0-10题
    let layer: 'A' | 'B' | 'C'
    if (score >= 8) layer = 'A'
    else if (score >= 4) layer = 'B'
    else layer = 'C'
    
    mockStudents.push({
      id: i + 1,
      name: names[i] || `学生${i + 1}`,
      score,
      layer
    })
  }
  students.value = mockStudents
}

const layerAStudents = computed(() => students.value.filter(s => s.layer === 'A'))
const layerBStudents = computed(() => students.value.filter(s => s.layer === 'B'))
const layerCStudents = computed(() => students.value.filter(s => s.layer === 'C'))

const goBack = () => router.back()

const handleSubmit = async () => {
  submitting.value = true
  try {
    // 模拟接口调用
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const layerStats = {
      A: layerAStudents.value.length,
      B: layerBStudents.value.length,
      C: layerCStudents.value.length
    }
    
    console.log('提交给后端的数据:', layerStats)
    showMessage('预习统计已成功提交给老师', 'success')
    
    // 跳转到核心探究
    router.push({
      name: 'homeworkAnswerJk',
      query: { stage: 'exploration' }
    })
  } catch (error) {
    showMessage('提交失败，请重试', 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  generateMockData()
})
</script>

<style scoped lang="scss">
.homework-preview-analysis {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
}

.analysis-header {
  height: 64px;
  background: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid #e2e8f0;
}

.toolbar-left, .toolbar-right {
  width: 120px;
  display: flex;
  align-items: center;
}

.toolbar-right {
  justify-content: flex-end;
}

.back-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
}

.back-icon { width: 24px; height: 24px; }
.analysis-title { flex: 1; text-align: center; font-size: 18px; font-weight: 600; }

.analysis-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.summary-card {
  background: white;
  padding: 24px;
  border-radius: 20px;
  text-align: center;
  border: 2px solid transparent;
  box-shadow: 0 4px 12px rgba(0,0,0,0.02);

  .card-count {
    font-size: 48px;
    font-weight: 900;
    margin-bottom: 8px;
  }
  .card-label {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .card-desc {
    font-size: 14px;
    color: #64748b;
  }

  &.layer-a {
    border-color: #fee2e2;
    .card-count { color: #ef4444; }
    .card-label { color: #ef4444; }
  }
  &.layer-b {
    border-color: #fef3c7;
    .card-count { color: #f59e0b; }
    .card-label { color: #f59e0b; }
  }
  &.layer-c {
    border-color: #dbeafe;
    .card-count { color: #3b82f6; }
    .card-label { color: #3b82f6; }
  }
}

.student-list-container {
  background: white;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.02);
}

.list-header {
  margin-bottom: 20px;
  .list-title {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
  }
}

.student-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.student-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;

  .student-name {
    display: block;
    font-weight: 600;
    color: #1e293b;
  }
  .student-score {
    display: block;
    font-size: 12px;
    color: #64748b;
  }
  
  .student-layer-badge {
    font-size: 12px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 6px;
  }

  &.layer-a {
    border-left: 4px solid #ef4444;
    .student-layer-badge { background: #fee2e2; color: #ef4444; }
  }
  &.layer-b {
    border-left: 4px solid #f59e0b;
    .student-layer-badge { background: #fef3c7; color: #f59e0b; }
  }
  &.layer-c {
    border-left: 4px solid #3b82f6;
    .student-layer-badge { background: #dbeafe; color: #3b82f6; }
  }
}
</style>
