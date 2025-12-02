<template>
  <div class="app-container">

    <div class="scroll-container">
      
      <div v-if="cards.length === 0" class="empty-state">
        <p>无打开的标签页</p>
        <button class="fab-button" @click="handleReset">
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none">
            <path :d="ICONS.plus" />
          </svg>
        </button>
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
                  <div class="icon-box" :style="{ color: card.themeColor, backgroundColor: card.themeColor + '15' }">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                      <path :d="ICONS[card.icon]" />
                    </svg>
                  </div>
                  <span class="card-title">{{ card.title }}</span>
                </div>
                <button class="close-btn" @click.stop="handleRemove(card.id)" @touchstart.stop>
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none">
                    <path :d="ICONS.x" />
                  </svg>
                </button>
              </div>

              <div class="card-body">
                <div class="skeleton-group">
                  <div class="sk-line w-30"></div>
                  <div class="sk-block"></div>
                  <div class="sk-line w-full"></div>
                  <div class="sk-line w-80"></div>
                </div>

                <div class="watermark">Quark</div>

                <div class="delete-overlay">
                  <div class="trash-icon left">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path :d="ICONS.trash" /></svg>
                  </div>
                  <div class="trash-icon right">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path :d="ICONS.trash" /></svg>
                  </div>
                </div>
              </div>

              <div class="highlight-border"></div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>

    <div class="bottom-bar">
      <button class="tool-btn add" @click="handleReset">
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path :d="ICONS.plus" /></svg>
      </button>
      <span class="tab-count">{{ cards.length }}个标签页</span>
      <div class="tool-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path :d="ICONS.layers" /></svg>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue';

// --- 1. 配置常量 ---
const CARD_HEIGHT = 550; 
const HEADER_VISIBLE_HEIGHT = 140;

// --- 2. 图标路径数据 (替代 Lucide) ---
const ICONS = {
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2l-4.35-4.35",
  globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18c-2.5 0-4.8-3-5.7-7h11.4c-.9 4-3.2 7-5.7 7zm-5.7-9c.9-4 3.2-7 5.7-7s4.8 3 5.7 7H6.3z",
  book: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  plus: "M12 5v14M5 12h14",
  x: "M18 6L6 18M6 6l12 12",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
};

// --- 3. 初始数据 ---
const INITIAL_CARDS = [
  { id: 1, title: "主页 - Quark", icon: 'home', themeColor: '#3b82f6' },
  { id: 2, title: "AI 智能搜索助手", icon: 'search', themeColor: '#f97316' },
  { id: 3, title: "今日科技热点新闻", icon: 'globe', themeColor: '#3b82f6' },
  { id: 4, title: "沉浸式阅读模式", icon: 'book', themeColor: '#10b981' },
  { id: 5, title: "系统多任务管理", icon: 'layers', themeColor: '#8b5cf6' },
  { id: 6, title: "个人中心", icon: 'user', themeColor: '#ec4899' },
];

// --- 4. 状态管理 ---
const cards = ref([...INITIAL_CARDS]);
const cardRefs = ref(new Map());

// --- 5. 方法逻辑 ---

const handleReset = () => {
  cards.value = [...INITIAL_CARDS];
};

// 标记正在执行删除动画的卡片ID，避免重复触发
const removingIds = ref(new Set());

const handleRemove = (id, skipAnimation = false) => {
  // 如果正在删除中，忽略重复调用
  if (removingIds.value.has(id)) return;
  
  // 滑动删除已经有自己的动画，直接移除数据
  if (skipAnimation) {
    cards.value = cards.value.filter(c => c.id !== id);
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
      cards.value = cards.value.filter(c => c.id !== id);
      removingIds.value.delete(id);
      cardRefs.value.delete(id);
    }, 300);
  } else {
    // 没有元素引用，直接移除
    cards.value = cards.value.filter(c => c.id !== id);
  }
};

const setCardRef = (el, id) => {
  if (el) cardRefs.value.set(id, el);
};

// 获取卡片样式：核心堆叠逻辑
const getCardStyle = (index) => {
  return {
    position: 'sticky',
    top: `${index * 5}px`, // 顶部吸附位置 + 阶梯视差
    zIndex: index,
    // 负 margin 实现覆盖效果
    marginTop: index === 0 ? '0px' : `-${CARD_HEIGHT - HEADER_VISIBLE_HEIGHT}px`,
    height: `${CARD_HEIGHT}px`,
    marginBottom: '20px',
    touchAction: 'pan-y' // 允许垂直滚动，接管水平滑动
  };
};

// --- 6. 触摸交互逻辑 (原生 Touch) ---
const onTouchStart = (e, id) => {
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
</script>


<style scoped>
/* --- 全局容器 --- */
.app-container {
  height: 100vh;
  width: 100%;
  background-color: #f2f4f6;
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
  scroll-behavior: smooth;
  padding-bottom: 120px; /* 给底部留空间 */
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

.fab-button {
  margin-top: 24px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: #2563eb;
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);
  cursor: pointer;
  transition: transform 0.1s;
}
.fab-button:active {
  transform: scale(0.95);
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

.icon-box {
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* 骨架屏装饰 */
.skeleton-group {
  padding: 24px;
  opacity: 0.5;
  pointer-events: none;
}
.sk-line { height: 16px; background: #e5e7eb; border-radius: 4px; margin-bottom: 12px; }
.sk-block { height: 180px; background: #e5e7eb; border-radius: 12px; margin-bottom: 16px; width: 100%; }
.w-30 { width: 30%; }
.w-80 { width: 80%; }
.w-full { width: 100%; }

/* 水印 */
.watermark {
  position: absolute;
  bottom: 40px;
  width: 100%;
  text-align: center;
  font-size: 60px;
  font-weight: 900;
  color: rgba(0,0,0,0.03);
  pointer-events: none;
  letter-spacing: -2px;
}

/* 删除遮罩层 */
.delete-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(254, 226, 226, 0.9);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  z-index: 30;
}

.is-dragging .delete-overlay {
  opacity: 1;
}

.trash-icon {
  color: #ef4444;
  /* 简单的呼吸动画 */
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
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
  height: 64px;
  background-color: rgba(242, 244, 246, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 100;
  color: #9ca3af;
}

.tool-btn {
  background: none;
  border: none;
  color: inherit;
  padding: 8px;
  cursor: pointer;
  display: flex;
}

.tool-btn.add {
  color: #2563eb;
}

.tab-count {
  font-size: 14px;
  font-weight: 500;
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