<template>
  <div class="common-date-picker" ref="rootRef">
    <button class="date-trigger" type="button" @click="togglePanel">
      <span class="date-text" :class="{ 'date-text--placeholder': !modelValue }">
        {{ displayText }}
      </span>
      <span class="date-icon-wrapper" :class="{ 'date-icon--open': isOpen }">
        <img :src="arrowIcon" alt="calendar" class="date-icon" />
      </span>
    </button>

    <transition name="fade-scale">
      <div v-if="isOpen" class="date-panel">
        <div class="date-panel-header">
          <button class="nav-btn" type="button" @click="prevMonth">‹</button>
          <div class="month-year">
            <span class="month-btn">{{ currentMonth + 1 }}月</span>
            <span class="year-btn">{{ currentYear }}</span>
          </div>
          <button class="nav-btn" type="button" @click="nextMonth">›</button>
        </div>
        <div class="date-panel-week">
          <span v-for="d in weekDays" :key="d" class="week-cell">{{ d }}</span>
        </div>
        <div class="date-panel-body">
          <button
            v-for="cell in calendarCells"
            :key="cell.key"
            class="date-cell"
            :class="{
              'date-cell--other': !cell.inCurrentMonth,
              'date-cell--today': cell.isToday,
              'date-cell--selected': cell.isSelected,
            }"
            type="button"
            @click="selectDate(cell.date)"
          >
            {{ cell.day }}
          </button>
        </div>
        <div class="date-panel-footer">
          <button class="today-btn" type="button" @click="selectToday">今天</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import arrowIcon from '/icons/arrow.svg'

const props = defineProps<{
  modelValue: string | null
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  change: [value: string | null]
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const today = new Date()
const currentYear = ref(today.getFullYear())
const currentMonth = ref(today.getMonth()) // 0-11

const parsedSelected = computed(() => {
  if (!props.modelValue) return null
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(props.modelValue)
  if (!m) return null
  const y = Number(m[1])
  const mon = Number(m[2]) - 1
  const d = Number(m[3])
  const date = new Date(y, mon, d)
  return isNaN(date.getTime()) ? null : date
})

// 当选中值变化时，同步当前视图到对应年月
watch(
  parsedSelected,
  (val) => {
    if (val) {
      currentYear.value = val.getFullYear()
      currentMonth.value = val.getMonth()
    }
  },
  { immediate: true }
)

const displayText = computed(() => {
  if (!props.modelValue) return props.placeholder ?? '请选择日期'
  return props.modelValue
})

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

interface CalendarCell {
  key: string
  day: number
  date: Date
  inCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
}

const calendarCells = computed<CalendarCell[]>(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = firstOfMonth.getDay() // 0-6
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate()

  const cells: CalendarCell[] = []

  // 前补上个月的尾巴
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const date = new Date(prevYear, prevMonth, day)
    cells.push(makeCell(date, false))
  }

  // 当前月
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push(makeCell(date, true))
  }

  // 后补下个月的开头，保证总格子数为 6*7=42
  const nextMonth = (month + 1) % 12
  const nextYear = month === 11 ? year + 1 : year
  while (cells.length < 42) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1
    const date = new Date(nextYear, nextMonth, day)
    cells.push(makeCell(date, false))
  }

  return cells
})

const makeCell = (date: Date, inCurrentMonth: boolean): CalendarCell => {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()

  const isToday =
    y === today.getFullYear() && m === today.getMonth() && d === today.getDate()

  const sel = parsedSelected.value
  const isSelected = !!(
    sel &&
    sel.getFullYear() === y &&
    sel.getMonth() === m &&
    sel.getDate() === d
  )

  return {
    key: `${y}-${m + 1}-${d}`,
    day: d,
    date,
    inCurrentMonth,
    isToday,
    isSelected,
  }
}

const togglePanel = () => {
  isOpen.value = !isOpen.value
}

const selectDate = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const value = `${y}-${m}-${d}`
  emit('update:modelValue', value)
  emit('change', value)
  isOpen.value = false
}

const selectToday = () => {
  selectDate(today)
}

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value -= 1
  } else {
    currentMonth.value -= 1
  }
}

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value += 1
  } else {
    currentMonth.value += 1
  }
}

const handleClickOutside = (event: MouseEvent) => {
  const root = rootRef.value
  if (!root) return
  if (!root.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.common-date-picker {
  position: relative;
  display: inline-block;
}

.date-trigger {
  width: 200px;
  height: 40px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  font-size: 14px;
  color: #111827;
}

.date-trigger:hover {
  border-color: #c7d2fe;
}

.date-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date-text--placeholder {
  color: #9ca3af;
}

.date-icon-wrapper {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.date-icon-wrapper.date-icon--open {
  transform: rotate(180deg);
}

.date-icon {
  width: 16px;
  height: 16px;
  display: block;
}

.date-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 280px;
  background-color: #ffffff;
  border-radius: 20px;
  box-shadow: 0 14px 40px rgba(15, 0, 46, 0.18);
  padding: 12px 16px 10px;
  z-index: 30;
}

.date-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.month-year {
  display: flex;
  gap: 8px;
}

.month-btn,
.year-btn {
  padding: 4px 10px;
  border-radius: 10px;
  border: 1px solid #e5e7ff;
  font-size: 13px;
  color: #4b4b63;
}

.nav-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid #e5e7ff;
  background-color: transparent;
  cursor: pointer;
  color: #4b4b63;
}

.nav-btn:hover {
  background-color: #f3f4ff;
}

.date-panel-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 8px;
}

.week-cell {
  text-align: center;
}

.date-panel-body {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.date-cell {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid transparent;
  background-color: transparent;
  text-align: center;
  line-height: 30px;
  font-size: 13px;
  cursor: pointer;
  color: #4b4b63;
}

.date-cell--other {
  color: #d1d5db;
}

.date-cell--today {
  border-color: #e5e7ff;
}

.date-cell--selected {
  border-color: #7c3aed;
  color: #7c3aed;
}

.date-cell:hover {
  background-color: #f3f4ff;
}

.date-panel-footer {
  margin-top: 10px;
  border-top: 1px solid #f1f3ff;
  padding-top: 8px;
}

.today-btn {
  width: 100%;
  border: none;
  background-color: transparent;
  color: #7c3aed;
  font-size: 14px;
  cursor: pointer;
}

.today-btn:hover {
  text-decoration: underline;
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
</style>
