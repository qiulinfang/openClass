<template>
  <div class="app-container">

    <div ref="scrollContainerRef" class="scroll-container">
      
      <div v-if="cards.length === 0" class="empty-state">
        <p>{{ emptyText }}</p>
      </div>

      <div v-else class="cards-wrapper">
        <TransitionGroup name="card-list">
          <div
            v-for="(card, index) in cards"
            :key="card.id"
            :ref="(el) => setCardRef(el, card.id)"
            class="card-item-wrapper"
            :style="getCardStyle(index)"
            @touchstart="(e) => onTouchStart(e, card.id)"
          >
            <div class="card">
              
              <div class="card-header">
                <div class="card-title-group">
                  <span class="card-title">{{ card.title }}</span>
                </div>
                <button class="close-btn" @click.stop="requestRemove(card.id)" @touchstart.stop>
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                    <path :d="ICONS.x" />
                  </svg>
                </button>
              </div>

              <div class="card-body">
                <!-- 卡片主体内容插槽 -->
                <slot name="card-body" :card="card"></slot>
              </div>

              <div class="highlight-border"></div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue';

// --- 1. Props 定义 ---
const props = defineProps({
  // v-model 绑定的卡片数据
  modelValue: {
    type: Array,
    default: null, // null 表示使用内部默认数据
  },
  // 空状态提示文字
  emptyText: {
    type: String,
    default: '无打开的标签页',
  },
  // 是否启用横向滑动删除功能
  swipeToDelete: {
    type: Boolean,
    default: true,
  },
});

// --- 2. Events 定义 ---
const emit = defineEmits([
  'update:modelValue', // v-model 更新
  'card-click',        // 卡片点击
  'card-remove',       // 卡片删除完成
  'card-remove-request', // 请求删除卡片（用于显示确认对话框）
  'card-add',          // 卡片新增
]);

// --- 3. 配置常量 ---
const CARD_HEIGHT = 400; 
const HEADER_VISIBLE_HEIGHT = 160;

// --- 4. 图标路径数据 ---
const ICONS = {
  plus: "M12 5v14M5 12h14",
  x: "M18 6L6 18M6 6l12 12",
};

// --- 5. 默认卡片数据（当外部未传入 modelValue 时使用） ---
const DEFAULT_CARDS = [
  { id: 1, title: '默认会话 1' },
  { id: 2, title: '默认会话 2' },
];

// --- 6. 内部状态 ---
const internalCards = ref([...DEFAULT_CARDS]);
const cardRefs = ref(new Map());
// 使用普通 ref，避免在 JS 脚本中使用 TS 泛型导致模板 ref 失效
const scrollContainerRef = ref(null);

// --- 7. 计算属性：实际使用的卡片数据 ---
const cards = computed({
  get() {
    // 如果外部传入了 modelValue，使用外部数据
    return props.modelValue !== null ? props.modelValue : internalCards.value;
  },
  set(newValue) {
    if (props.modelValue !== null) {
      // 外部控制模式：通知父组件更新
      emit('update:modelValue', newValue);
    } else {
      // 内部控制模式：直接更新内部状态
      internalCards.value = newValue;
    }
  },
});

// --- 8. 方法逻辑 ---

// 重置为默认卡片
const handleReset = () => {
  cards.value = [...DEFAULT_CARDS];
};

// 滚动到底部（显示最新的会话卡片区域）
const scrollToBottom = async () => {
  await nextTick();
  const el = scrollContainerRef.value;
  if (el) {
    console.log('[CardStack] scrollToBottom before, scrollTop =', el.scrollTop, 'scrollHeight =', el.scrollHeight, 'clientHeight =', el.clientHeight);
    el.scrollTop = el.scrollHeight;
    console.log('[CardStack] scrollToBottom after, scrollTop =', el.scrollTop);
  }
};

// 标记正在执行删除动画的卡片ID，避免重复触发
const removingIds = ref(new Set());

// 请求删除卡片（触发事件，由外部决定是否显示确认对话框）
const requestRemove = (id) => {
  emit('card-remove-request', id);
};

// 删除卡片（执行删除动画并移除数据）
const handleRemove = (id, skipAnimation = false) => {
  // 如果正在删除中，忽略重复调用
  if (removingIds.value.has(id)) return;
  
  const removeCard = () => {
    const newCards = cards.value.filter(c => c.id !== id);
    cards.value = newCards;
    emit('card-remove', id);
  };
  
  // 滑动删除已经有自己的动画，直接移除数据
  if (skipAnimation) {
    removeCard();
    return;
  }
  
  // 点击删除：先播放退出动画，再移除数据
  const cardEl = cardRefs.value.get(id);
  if (cardEl) {
    removingIds.value.add(id);
    
    // 添加退出动画
    cardEl.style.transition = 'all 0.3s ease-out';
    cardEl.style.transform = 'scale(0.9)';
    cardEl.style.opacity = '0';
    
    // 动画结束后移除数据
    setTimeout(() => {
      removeCard();
      removingIds.value.delete(id);
      cardRefs.value.delete(id);
    }, 300);
  } else {
    // 没有元素引用，直接移除
    removeCard();
  }
};

const setCardRef = (el, id) => {
  if (el) cardRefs.value.set(id, el);
};


onMounted(() => {
  scrollToBottom();
});

// 获取卡片样式：核心堆叠逻辑
const getCardStyle = (index) => {
  return {
    position: 'sticky',
    top: `${index * 5}px`, // 每张卡往下错开一点，形成阶梯
    zIndex: index, // z-index 保证堆叠顺序
    // 负 margin 实现覆盖效果
    marginTop: index === 0 ? '0px' : `-${CARD_HEIGHT - HEADER_VISIBLE_HEIGHT}px`,
    height: `${CARD_HEIGHT}px`,
    marginBottom: '20px',
    touchAction: 'pan-y' // 允许垂直滚动，接管水平滑动
  };
};

// --- 6. 触摸交互逻辑 (原生 Touch) ---
const onTouchStart = (e, id) => {
  // 如果禁用了滑动删除，直接返回
  if (!props.swipeToDelete) return;
  
  const cardEl = cardRefs.value.get(id);
  if (!cardEl) return;

  const startX = e.touches[0].clientX;
  const startY = e.touches[0].clientY;
  let currentX = 0;

  // 方向锁：只在确定是横向滑动后才启用删除交互
  let isDirectionLocked = false;
  let isHorizontalSwipe = false;

  // 禁用过渡，保证跟手实时响应
  cardEl.style.transition = 'none';

  const onTouchMove = (moveEvent) => {
    const moveX = moveEvent.touches[0].clientX;
    const moveY = moveEvent.touches[0].clientY;
    const deltaX = moveX - startX;
    const deltaY = moveY - startY;

    // 还未锁定方向时，根据一小段位移判断主方向
    if (!isDirectionLocked) {
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      // 只有位移达到一定阈值后才锁定方向，避免轻微抖动
      if (distance > 6) {
        isDirectionLocked = true;
        isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      } else {
        // 位移太小，不做任何处理，交给浏览器默认滚动
        return;
      }
    }

    // 如果最终判定为纵向滚动，则完全交给浏览器处理（不修改 transform/opacity）
    if (!isHorizontalSwipe) {
      return;
    }

    // 横向滑动：阻止默认滚动行为，启动卡片滑动效果
    if (moveEvent.cancelable) {
      moveEvent.preventDefault();
    }

    currentX = deltaX;

    // 计算透明度
    const opacity = 1 - Math.min(Math.abs(currentX) / 250, 1);

    // 设置变换
    cardEl.style.transform = `translateX(${currentX}px)`;
    cardEl.style.opacity = opacity;

    // 控制垃圾桶显隐 (通过 class)
    if (Math.abs(currentX) > 40) {
      cardEl.classList.add('is-dragging');
    } else {
      cardEl.classList.remove('is-dragging');
    }
  };

  const onTouchEnd = () => {
    // 恢复过渡动画
    cardEl.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    cardEl.classList.remove('is-dragging');

    // 只有在已经识别为横向滑动时，才进行删除/回弹逻辑
    if (isHorizontalSwipe && Math.abs(currentX) > 0) {
      // 删除阈值判断
      if (Math.abs(currentX) > 100) {
        const direction = currentX > 0 ? 1 : -1;

        // 飞出动画
        cardEl.style.transform = `translateX(${direction * 500}px)`;
        cardEl.style.opacity = '0';

        setTimeout(() => {
          // 滑动删除：跳过动画，直接移除数据
          handleRemove(id, true);
        }, 300);
      } else {
        // 回弹
        cardEl.style.transform = 'translateX(0)';
        cardEl.style.opacity = '1';
      }
    }

    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
  };

  window.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd);
};
// 新建卡片
const addCard = (cardData = {}) => {
  const newId = Date.now();
  const newCard = {
    id: newId,
    title: cardData.title || `新会话 ${cards.value.length + 1}`,
    ...cardData,
  };
  
  // 更新卡片列表（会自动触发 v-model 更新）
  const newCards = [newCard, ...cards.value];
  cards.value = newCards;
  
  emit('card-add', newCard);
  scrollToBottom();
  return newCard;
};

// 暴露给父组件
defineExpose({
  cards,
  addCard,
  handleRemove,
  handleReset,
  scrollToBottom,
});
</script>


<style scoped>
/* --- 全局容器 --- */
.app-container {
  height: 100vh;
  width: 100%;
  background-color: #f7f6ff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* --- 滚动区域 --- */
.scroll-container {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 230px; /* 给底部留空间 */
  /* 隐藏滚动条 */
  scrollbar-width: none; 
}
.scroll-container::-webkit-scrollbar {
  display: none;
}

/* --- 空状态 --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  color: #9ca3af;
}


/* --- 卡片样式 --- */
.cards-wrapper {
  width: 100%;
  margin: 0 auto;
  position: relative;
  /* min-height 保证内容少时也能滚动一点 */
  min-height: 100%;
}

.card-item-wrapper {
  width: 100%;
  transform-origin: top center;
  will-change: transform;
}

.card {
  width: 100%;
  height: 100%;
  background: white;
  border-radius: 16px;
  box-shadow: 0 -5px 25px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.6);
}

/* 卡片头部 */
.card-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #f3f4f6;
  background-color: white;
  z-index: 20;
  position: sticky;
  top: 0;
}

.card-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: -0.01em;
}

.close-btn {
  background: transparent;
  border: none;
  color: #9ca3af;
  padding: 6px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
}
.close-btn:hover {
  background-color: #f3f4f6;
  color: #374151;
}

/* 卡片主体 */
.card-body {
  flex: 1;
  background-color: #f9fafb;
  position: relative;
}

/* 高光边框 */
.highlight-border {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.8), transparent);
  z-index: 30;
}

/* --- 底部工具栏 --- */
.bottom-bar {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 56px;
  background-color: #ffffff;
  border-top: 1px solid rgba(0,0,0,0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  z-index: 100;
  color: #6b7280;
}

.bottom-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
  font-size: 13px;
}

.bottom-action svg {
  flex-shrink: 0;
}

.bottom-action-text {
  white-space: nowrap;
}

.bottom-action.primary {
  color: #4b5563;
  font-weight: 500;
}

.bottom-action.disabled {
  color: #d1d5db;
  cursor: default;
}

/* --- 列表动画 (Vue TransitionGroup) --- */
/* 只保留 move 动画，删除动画由 JS 控制 */
.card-list-move {
  transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.card-list-enter-active {
  transition: all 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.card-list-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

/* 禁用 TransitionGroup 的 leave 动画，由 JS 手动控制 */
.card-list-leave-active {
  display: none;
}
</style>