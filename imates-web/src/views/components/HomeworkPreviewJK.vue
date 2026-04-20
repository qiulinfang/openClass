<template>
  <div class="homework-preview-kids">
    <div class="left-panel left-panel--modern">
      <div class="kids-question-scroll-wrapper">
        <div class="kids-question-scroll">
          <div 
            v-for="(question, index) in externalQuestions" 
            :key="getQuestionKey(question)"
            class="kids-question-card"
            :class="{ 'is-mastered': isMastered(getQuestionKey(question)) }"
            @click="toggleMastery(getQuestionKey(question))"
          >
            <div class="card-header">
              <span class="question-no">第 {{ index + 1 }} 题</span>
              <div class="mastery-indicator">
                <q-icon :name="isMastered(getQuestionKey(question)) ? 'stars' : 'circle'" size="28px" />
                <span class="indicator-text">{{ isMastered(getQuestionKey(question)) ? '我会啦' : '点我点我' }}</span>
              </div>
            </div>
            <div class="question-content">
              {{ question.title || (question.structuredContent && question.structuredContent.stem) || '题目加载中...' }}
            </div>
            <div class="card-confetti" v-if="isMastered(getQuestionKey(question))">✨</div>
          </div>
        </div>
      </div>
    </div>

    <div class="right-panel">
      <div class="preview-kids-modern">
        <div class="hero-character">
          <span class="emoji-bounce">🌟</span>
        </div>
        
        <div class="tally-section">
          <div class="tally-count">{{ masteryChecklist.length }}</div>
          <div class="tally-label">道题，我已经会啦！</div>
        </div>

        <div class="kids-instruction">
          <p class="kids-subtitle">Hi！先来看看这些题，如果你觉得自己已经懂啦，就在左边点亮“我会啦”按钮告诉老师吧！</p>
        </div>

        <div class="encouragement-text">
          {{ kidsEncourageTip }}
        </div>

        <div class="bottom-action-area">
          <CommonActionButton
            label="准备好了，展示给老师"
            variant="outline"
            size="lg"
            class="kids-candy-btn-base mr-4"
            :disabled="masteryChecklist.length === 0"
            @click="$emit('submit', masteryChecklist)"
          />
          <CommonActionButton
            label="开始课堂练习"
            variant="primary"
            size="lg"
            class="kids-candy-btn-base"
            :disabled="masteryChecklist.length === 0"
            @click="$emit('submit', masteryChecklist, true)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import CommonActionButton from '@/components/base/Button.vue'

const props = defineProps<{
  externalQuestions: any[]
}>()

const emit = defineEmits<{
  (e: 'submit', checklist: string[], goToPractice?: boolean): void
}>()

// --- 状态定义 ---
const masteryChecklist = ref<string[]>([]) // 课前预习已掌握题目列表

// --- 内部逻辑 ---
const getQuestionKey = (q: any) => q ? (q.bmNo || q.id).toString() : ''

const isMastered = (key: string) => {
  return masteryChecklist.value.includes(key)
}

const toggleMastery = (key: string) => {
  const index = masteryChecklist.value.indexOf(key)
  if (index > -1) {
    masteryChecklist.value.splice(index, 1)
  } else {
    masteryChecklist.value.push(key)
  }
}

const kidsEncourageTip = computed(() => {
  const count = masteryChecklist.value.length
  if (count === 0) return '快去左边找找你会的题目吧！'
  if (count < 3) return '太棒了！继续加油，点亮更多题目！'
  if (count < 6) return '你已经学会这么多了，真了不起！'
  return '哇！你简直是数学小天才！老师一定会为你骄傲的！'
})
</script>

<style scoped lang="scss">
.homework-preview-kids {
  flex: 1;
  display: flex;
  overflow: hidden;
  gap: 20px;
}

.left-panel {
  width: 400px;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &--modern {
    background: transparent !important;
    border: none !important;
  }
}

.kids-question-scroll-wrapper {
  flex: 1;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.kids-question-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 10px;
  /* 隐藏滚动条但保留功能 */
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
}

.kids-question-card {
  background: white;
  border-radius: 20px;
  padding: 20px;
  border: 2px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease-out;
  position: relative;
  overflow: hidden;
  user-select: none;
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0,0,0,0.03);
    border-color: #cbd5e1;
  }

  &:active {
    transform: scale(0.99);
  }

  &.is-mastered {
    background: linear-gradient(135deg, #f0f7ff 0%, #ffffff 100%);
    border-color: #6e55ff;
    box-shadow: 0 6px 15px -5px rgba(110, 85, 255, 0.1);

    .question-no { color: #6e55ff; }
    .mastery-indicator { color: #6e55ff; }
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.question-no {
  font-size: 14px;
  font-weight: 800;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.mastery-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #e2e8f0;
  transition: all 0.3s;

  .indicator-text {
    font-size: 13px;
    font-weight: 700;
  }
}

.question-content {
  font-size: 16px;
  line-height: 1.6;
  color: #1e293b;
  font-weight: 500;
}

.card-confetti {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 20px;
  animation: confetti-pop 0.5s ease-out;
}

@keyframes confetti-pop {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { transform: scale(1.5) rotate(20deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}

.right-panel {
  flex: 1;
  background: white;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-kids-modern {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
  background: radial-gradient(circle at top right, #fdfcfb 0%, #e2d1c344 100%);
  position: relative;
  text-align: center;
}

.hero-character {
  font-size: 60px;
  margin-bottom: 12px;
  filter: drop-shadow(0 6px 10px rgba(0,0,0,0.1));
}

.emoji-bounce {
  display: inline-block;
}

.tally-section {
  margin-bottom: 16px;
}

.tally-count {
  font-size: 80px;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(180deg, #6e55ff 0%, #4a35cc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 4px;
}

.tally-label {
  font-size: 18px;
  color: #4b5563;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.kids-instruction {
  margin: 8px 0 16px 0;
  text-align: center;
  width: 100%;
}

.kids-subtitle {
  font-size: 15px;
  color: #4b5563;
  max-width: 380px;
  margin: 0 auto;
  line-height: 1.5;
  font-weight: 500;
}

.encouragement-text {
  font-size: 14px;
  color: #6b7280;
  max-width: 300px;
  line-height: 1.4;
  margin-bottom: 24px;
  padding: 8px 16px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 2px 10px rgba(0,0,0,0.02);
  font-style: italic;
}

.bottom-action-area {
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 16px;
}

.kids-candy-btn-base {
  min-width: 240px;
  height: 48px;
  font-weight: 800 !important;
  font-size: 16px !important;
  border-radius: 24px !important;
  box-shadow: 0 6px 15px -4px rgba(110, 85, 255, 0.2);
  transition: all 0.2s ease-out;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px -6px rgba(110, 85, 255, 0.3);
  }
}
</style>
