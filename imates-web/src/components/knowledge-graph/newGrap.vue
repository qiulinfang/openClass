<template>
  <div class="knowledge-graph-container" ref="containerRef">
    <!-- 气泡菜单 -->
    <div 
      class="manual-bubble-menu"
      :class="{ 'manual-bubble-menu--visible': bubbleState.visible }"
      :style="{ left: bubbleState.x + 'px', top: bubbleState.y + 'px' }"
      @mousedown.stop
      @touchstart.stop
    >
      <div class="bubble-menu-container">
        <button 
          class="bubble-menu-button bubble-menu-button--learn"
          @click="handleAction('learn')"
        >
          探索模式
        </button>
        <button 
          class="bubble-menu-button bubble-menu-button--practice"
          @click="handleAction('practice')"
        >
          练习模式
        </button>
      </div>
    </div>
    <!-- 画布 -->
    <canvas ref="canvasRef" class="space-canvas"></canvas>

    <!-- 指示器 (DOM实现) -->
    <div 
      class="right-border-indicator"
      ref="indicatorContainerRef"
      @click.stop
      @touchstart="handleIndicatorTouchStart"
      @touchmove="handleIndicatorTouchMove"
      @touchend="handleIndicatorTouchEnd"
    >
      <div 
        v-for="(moon, index) in state.moons" 
        :key="index"
        class="indicator-dot"
        :class="{ 'active': isIndicatorActive(index) }"
        :style="{
          opacity: getIndicatorOpacity(index),
          width: `${getIndicatorSize(index)}px`,
          height: `${getIndicatorSize(index)}px`
        }"
        @click="handleIndicatorClick(index)"
      >
        <img 
          v-if="isIndicatorActive(index)" 
          :src="indicatorIcon" 
          alt="Indicator" 
          class="indicator-icon"
        />
      </div>
    </div>
    
    <!-- 调试按钮 - 仅开发环境显示 -->
    <button 
      v-if="isDev"
      class="debug-toggle-btn"
      :class="{ active: debugPanelVisible }"
      @click="debugPanelVisible = !debugPanelVisible"
      title="调试面板"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m18.2 5.2l-4.2-4.2m0-6l4.2-4.2"></path>
      </svg>
    </button>
    
    <!-- 调试面板 - 仅开发环境显示 -->
    <NewGrapDebugPanel
      v-if="isDev"
      v-model="debugPanelVisible"
      :params="debugParams"
      :default-params="baseConfig"
      @update:params="(v) => Object.assign(debugParams, v)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue';
import centerNodeIcon from '/icons/centerNode.svg';
import learnedIcon from '/icons/learned.svg';
import lastLearnedIcon from '/icons/lastLearned.svg';
import notLearnedIcon from '/icons/notLearned.svg';
import indicatorIcon from '/icons/Indicator.svg';
import NewGrapDebugPanel from '../debug/NewGrapDebugPanel.vue';

// --- Props & Emits ---
const props = defineProps({
  data: {
    type: Object,
    required: true,
    default: () => ({ children: [] })
  }
});

const emit = defineEmits(['action', 'node-click']);

// --- Refs & Reactive State ---
const containerRef = ref(null); // 容器引用
const canvasRef = ref(null); // 画布引用
const indicatorContainerRef = ref(null); // 指示器容器

// 指示器状态
const isIndicatorDragging = ref(false);
const indicatorCurrentIndex = ref(null);

// 气泡状态 (仅 UI 部分响应式)
const bubbleState = reactive({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  activeType: null, // 'moon' | 'satellite'
  moonIndex: -1,
  satIndex: -1,
  data: null
});

// --- Non-Reactive State (核心性能优化: 动画变量不放入响应式系统) ---
let ctx = null; // Canvas 上下文
let animationFrameId = null; // 动画帧 ID
let width = 0; // 容器宽度
let height = 0; // 容器高度
let cx = 0; // 中心点 X
let cy = 0; // 中心点 Y

// 固定常量（不可调试）
const SATELLITE_RADIUS = 18; // 卫星半径（固定值）
const ZOOM_STEP_PER_SAT = 0.15; // 每个卫星缩放步长（固定值）

// 布局配置基础值（可通过调试面板调整）
const baseConfig = {
  orbitRadiusX: 460,//轨道半径X
  orbitRadiusY: 315,//轨道半径Y
  rotationSpeed: 0.08,//旋转速度
  moonRadiusBase: 40,//月球基础半径
  moonRadiusFocusBase: 70,//月球聚焦基础半径
  satelliteDistBase: 120,//卫星基础距离
  satelliteOrbitGrowthPerSat: 8,//每个卫星轨道半径增长量
  satelliteRadiusFocus: 31,//卫星聚焦半径
  indicatorRightMargin: 40,//指示器右侧边距
  indicatorGap: 40,//指示器间距
  indicatorRadius: 6,//指示器半径
  indicatorActiveRadius: 12,//指示器激活半径
  orbitCenterXOffset: 0,//轨道中心X轴偏移（相对于容器右边界）
  orbitCenterYOffset: -69,//轨道中心Y轴偏移（相对于容器中心）
  focusAngle: 2.8//聚焦角度（弧度，Math.PI表示左侧，0表示右侧）
};

// 实际使用的配置对象
const config = reactive({ ...baseConfig });

// 调试面板状态（仅开发环境）
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true';
const debugPanelVisible = ref(false);
const debugParams = ref({ ...baseConfig });

// 监听调试参数变化
watch(
  debugParams,
  (val) => {
    Object.assign(config, val);
    // 配置变化后重新计算轨道中心位置
    nextTick(() => {
      resize();
    });
  },
  { deep: true }
);

// 预加载中心节点及卫星 SVG 图标为 Image，用于 Canvas 绘制
const centerNodeImage = new Image();  // 中心节点 SVG 图标
centerNodeImage.src = centerNodeIcon; // 中心节点 SVG 图标路径 

const learnedImage = new Image(); // 已学习节点 SVG 图标
learnedImage.src = learnedIcon; // 已学习节点 SVG 图标路径

const lastLearnedImage = new Image(); // 上次学到节点 SVG 图标
lastLearnedImage.src = lastLearnedIcon; // 上次学到节点 SVG 图标路径

const notLearnedImage = new Image(); // 未学习节点 SVG 图标
notLearnedImage.src = notLearnedIcon; // 未学习节点 SVG 图标路径

// --- 图片离屏缓存优化 ---
const imageCache = new Map();

// 获取预渲染的离屏 Canvas
function getCachedImageCanvas(img) {
  if (!img || !img.complete) return null;
  
  // 如果已经缓存过，直接返回缓存的 Canvas
  if (imageCache.has(img.src)) {
    return imageCache.get(img.src);
  }

  // 创建离屏 Canvas
  // 设定一个适中的分辨率，例如 256x256，既保证清晰度又控制内存
  // 如果原图很大，这里起到了预缩放的作用，大幅提升渲染性能
  const size = 256; 
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // 将原图绘制到离屏 Canvas 上
  ctx.drawImage(img, 0, 0, size, size);
  
  // 存入缓存
  imageCache.set(img.src, canvas);
  
  return canvas;
}

// 物理状态
const state = reactive({ // 物理状态
  globalAngle: 0, // 全局角度
  targetGlobalAngle: 0, // 目标全局角度
  isAutoRotating: false, // 是否自动旋转
  focusedIndex: 0, // 聚焦索引
  moons: [], // 月球列表
  isInteracting: false, // 是否交互中
  startX: 0, // 开始 X
  startY: 0, // 开始 Y
  lastX: 0, // 上一次 X
  interactionMode: null, // 交互模式
  activeObject: null, // 激活对象
  forceRotation: false, // 是否强制旋转（不走最短路径）
  autoShowBubbleAfterRotation: false // 是否在旋转停止后自动显示气泡菜单
});

// --- 实体类 (Classes) ---

// 卫星类
class Satellite {
  constructor(index, total, data) {
    this.data = data;   // 数据
    this.angleOffset = (index / total) * Math.PI * 2 - Math.PI / 2; // 角度偏移
    this.x = 0; this.y = 0; // 位置
  }

  // 更新卫星位置
  update(px, py, dist) {
    this.x = px + Math.cos(this.angleOffset) * dist;
    this.y = py + Math.sin(this.angleOffset) * dist;
  }

  // 绘制卫星
  draw(context, scale, isFocused) {
    // 根据是否聚焦使用不同的半径
    const baseRadius = isFocused ? config.satelliteRadiusFocus : SATELLITE_RADIUS;
    const r = baseRadius * (0.8 + scale * 0.15);
    // 根据学习状态选择不同的 SVG 图标：未学习 / 已学习 / 上次学到
    const status = this.data.learningStatus || 'notLearned';
    let img = notLearnedImage;
    if (status === 'learned') img = learnedImage;
    else if (status === 'lastLearned') img = lastLearnedImage;

    const size = r * 2;
    
    // 尝试获取离屏缓存的 Canvas
    const cachedCanvas = getCachedImageCanvas(img);

    if (cachedCanvas) {
      // 使用离屏 Canvas 绘制，性能更高
      context.drawImage(cachedCanvas, this.x - size / 2, this.y - size / 2, size, size);
    } else {
      // 图标尚未加载完成时，回退到原来的菱形绘制
      context.beginPath();  // 开始路径 
      context.moveTo(this.x, this.y - r); // 移动到起始点
      context.lineTo(this.x + r, this.y); // 绘制到结束点
      context.lineTo(this.x, this.y + r); // 绘制到结束点
      context.lineTo(this.x - r, this.y); // 绘制到结束点
      context.closePath();
      context.fillStyle = '#a29bfe'; // 填充颜色
      context.fill();
    }

    if (scale > 1.0) {
      context.fillStyle = '#fff'; // 填充颜色
      const fontSize = 13;
      context.font = `${fontSize}px "Microsoft YaHei"`; // 字体
      
      const maxTextWidth = r * 3; // 限制在卫星直径内
      const lineHeight = fontSize * 1.2;
      const maxLines = 2;
      
      // 文字起始Y坐标
      const textStartY = this.y + r + 5;

      drawMultilineTextWithEllipsis(
        context,
        this.data.name,
        this.x,
        textStartY,
        maxTextWidth,
        lineHeight,
        maxLines,
        'center',
        'top'
      );
    }

    // 绘制“上次学到”标签
    if (status === 'lastLearned') {
      // 尺寸尽量贴近 .learning-tag
      const tagText     = '上次学到';
      const tagFontSize = 14;     // 对齐 GraphNode.vue 的 14px
      const tagWidth    = 70;     // 与 .learning-tag 的 width 一致
      const tagHeight   = 20;     // 与 .learning-tag 的 height 一致
      const tagRadius   = 10;     // 圆角大一些，接近 14,9,9,0 的效果

      context.save();

      context.font = `${tagFontSize}px "Microsoft YaHei"`;

      const offsetX = r * 1.3;    // 稍微往右一点（因为标签有 70px 宽）
      const offsetY = -r;   // 在图标上方一段距离
      const tagX = this.x + offsetX;
      const tagY = this.y + offsetY;

      // 画圆角矩形背景（以 tagX, tagY 为中心）
      const left   = tagX - tagWidth / 2;
      const top    = tagY - tagHeight / 2;
      const right  = left + tagWidth;
      const bottom = top + tagHeight;
      const radius = tagRadius;

      context.beginPath();
      context.moveTo(left + radius, top);
      context.lineTo(right - radius, top);
      context.quadraticCurveTo(right, top, right, top + radius);
      context.lineTo(right, bottom - radius);
      context.quadraticCurveTo(right, bottom, right - radius, bottom);
      context.lineTo(left + radius, bottom);
      context.quadraticCurveTo(left, bottom, left, bottom - radius);
      context.lineTo(left, top + radius);
      context.quadraticCurveTo(left, top, left + radius, top);
      context.closePath();

      // 背景颜色用旧版学习标签的红色
      context.fillStyle = '#ff6767';
      context.shadowColor = 'rgba(0, 0, 0, 0.25)';
      context.shadowBlur  = 4;
      context.fill();

      // 画文字
      context.shadowBlur = 0;
      context.fillStyle = '#FFFFFF';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(tagText, tagX, tagY);

      context.restore();
    }
  }
}

class Moon {
  constructor(index, total, data) {
    this.index = index; // 索引
    this.data = data; // 数据
    this.angleOffset = (index / total) * Math.PI * 2; // 角度偏移
    const satCount = data.children ? data.children.length : 0; // 卫星数量
    this.maxZoomFactor = Math.min(2.8, 1.5 + (satCount * ZOOM_STEP_PER_SAT)); // 最大缩放因子
    // 卫星轨道距离 = 基础距离 + 卫星数量 * 每个卫星增长量
    this.satelliteOrbitDist = config.satelliteDistBase + (satCount * config.satelliteOrbitGrowthPerSat);
    this.scale = 1; this.targetScale = 1; this.opacity = 1;
    this.x = 0; this.y = 0;
    this.satellites = [];
    if (data.children) {
      data.children.forEach((child, i) => {
        this.satellites.push(new Satellite(i, data.children.length, child));
      });
    }
  }

  // 更新月球
  update() {
    const diff = this.targetScale - this.scale; // 计算缩放差 
    this.scale += Math.abs(diff) > 0.001 ? diff * 0.1 : 0; // 缩放
    if (Math.abs(diff) <= 0.001) this.scale = this.targetScale; // 确保缩放完成

    const targetOp = (this.index === state.focusedIndex) ? 1.0 : 0.5; // 计算透明度
    this.opacity += (targetOp - this.opacity) * 0.1; // 更新透明度

    const currentAngle = state.globalAngle + this.angleOffset;  // 当前角度 
    this.x = cx + Math.cos(currentAngle) * config.orbitRadiusX; // X坐标
    this.y = cy + Math.sin(currentAngle) * config.orbitRadiusY; // Y坐标

    if (this.scale > 1.1) {
      const progress = (this.scale - 1) / (this.maxZoomFactor - 1); // 缩放进度
      const currentDist = this.satelliteOrbitDist * Math.max(0, progress);
      this.satellites.forEach(sat => sat.update(this.x, this.y, currentDist));
    }
  }

  // 绘制月球
  draw(context) {
    context.globalAlpha = this.opacity; // 设置透明度 
    if (this.scale > 1.2) this.drawFocused(context);
    else this.drawUnfocused(context);
    context.globalAlpha = 1.0; // 恢复透明度
  }

  // 绘制聚焦的月球
  drawFocused(context) {
    const r = config.moonRadiusFocusBase;
    const progress = (this.scale - 1) / (this.maxZoomFactor - 1); // 缩放进度
    const currentSatDist = this.satelliteOrbitDist * Math.max(0, progress); // 当前卫星轨道距离

    if (currentSatDist > r) {
      context.beginPath(); // 开始路径
      context.arc(this.x, this.y, currentSatDist, 0, Math.PI * 2); // 绘制轨道
      // 添加卫星轨道背景色
      context.fillStyle = 'rgba(255, 255, 255, 0.05)';
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,0.1)'; context.lineWidth = 1; context.stroke();
    }

    // 使用 GraphNode 的中心节点 SVG 图标绘制月球，替换原来的渐变圆
    const img = centerNodeImage;
    const size = r * 2;
    
    // 尝试获取离屏缓存的 Canvas
    const cachedCanvas = getCachedImageCanvas(img);

    if (cachedCanvas) {
      // 使用离屏 Canvas 绘制，性能更高
      context.drawImage(cachedCanvas, this.x - size / 2, this.y - size / 2, size, size); // 绘制月球
    } else {
      // 如果图标尚未加载完成，暂时回退到原来的渐变圆
      const grad = context.createLinearGradient(this.x, this.y - r, this.x, this.y + r);  // 创建渐变
      grad.addColorStop(0, '#a29bfe'); grad.addColorStop(1, '#6c5ce7'); // 渐变颜色
      context.fillStyle = grad; // 填充颜色
      context.beginPath(); context.arc(this.x, this.y, r, 0, Math.PI * 2); context.fill(); // 绘制月球
      context.shadowColor = 'rgba(108, 92, 231, 0.6)'; context.shadowBlur = 20; // 阴影
      context.stroke(); context.shadowBlur = 0; // 恢复阴影
    }

    // 在 SVG 图标上方继续绘制章节标题文字
    context.fillStyle = '#fff';
    const titleSize = 21; // 固定字号，避免文字跳动
    context.font = `bold ${titleSize}px "Microsoft YaHei"`; // 字体
    
    const maxTextWidth = r * 1.5;
    const lineHeight = titleSize * 1.2;
    const maxLines = 2;

    drawMultilineTextWithEllipsis(
      context,
      this.data.label,
      this.x,
      this.y,
      maxTextWidth,
      lineHeight,
      maxLines,
      'center',
      'middle'
    );

    // 聚焦状态下，卫星使用更大的半径
    this.satellites.forEach(sat => sat.draw(context, this.scale, true));
  }

  // 绘制未聚焦的月球
  drawUnfocused(context) {
    const r = config.moonRadiusBase;
    const img = centerNodeImage;
    const size = r * 2;

    // 1. 先画卫星轨道（未聚焦也有）
    // 这里不考虑缩放进度，直接用 satelliteOrbitDist
    if (this.satelliteOrbitDist > r) {
      context.beginPath();
      context.arc(this.x, this.y, this.satelliteOrbitDist / 2, 0, Math.PI * 2);
      context.fillStyle = 'rgba(255, 255, 255, 0.03)'; // 比聚焦更淡一点
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,0.08)';
      context.lineWidth = 1;
      context.stroke();
    }

    // 2. 画月球（svg 或退回圆）
    // 尝试获取离屏缓存的 Canvas
    const cachedCanvas = getCachedImageCanvas(img);

    if (cachedCanvas) {
      context.drawImage(cachedCanvas, this.x - size / 2, this.y - size / 2, size, size);
    } else {
      context.fillStyle = 'rgba(108, 92, 231, 0.3)';
      context.strokeStyle = 'rgba(162, 155, 254, 0.5)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(this.x, this.y, r, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }

    // 3. 中间编号文字
    const num = this.data.label.split(' ')[0];
    context.fillStyle = '#fff';
    context.font = `bold 14px "Microsoft YaHei"`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(num, this.x, this.y);
  }
}

// --- 核心逻辑 ---

// 初始化
function init() {
  resize();
  state.moons = [];
  const root = { ...props.data, children: [] };                // level0
  const sections = [...(props.data.children || [])].reverse();   // level1

  if (!root && !sections.length) return;

  // 1. 把 level0 根节点也渲染成一个 Moon
  state.moons.push(new Moon(0, sections.length + 1, root));

  let initialFocusIndex = 0;

  // 2. 每个 section 作为后续的 Moon，索引从 1 开始
  sections.forEach((section, idx) => {
    const moonIndex = idx + 1;
    state.moons.push(new Moon(moonIndex, sections.length + 1, section));

    if (section.learningStatus === 'lastLearned') {
      initialFocusIndex = moonIndex;  // 注意这里用 moonIndex
    }
  });

  focusOnIndex(initialFocusIndex, true);
  showBubble('moon', initialFocusIndex);

  if (!animationFrameId) loop();
}

// 重置大小
function resize() {
  if (!containerRef.value || !canvasRef.value) return; // 检查容器和画布
  
  const dpr = window.devicePixelRatio || 1; // 设备像素比
  width = containerRef.value.clientWidth; // 容器宽度
  height = containerRef.value.clientHeight; // 容器高度
  
  canvasRef.value.width = width * dpr; // 画布宽度
  canvasRef.value.height = height * dpr; // 画布高度
  canvasRef.value.style.width = width + 'px'; // 画布宽度
  canvasRef.value.style.height = height + 'px'; // 画布高度
  
  ctx.scale(dpr, dpr); // 缩放
  
  // 根据容器动态调整半径，应用偏移量
    cx = width + config.orbitCenterXOffset;      // 默认在右边框上，可通过偏移调整
    cy = height / 2 + config.orbitCenterYOffset; // 默认在容器中心，可通过偏移调整
}

// 更新
function update() {
  if (state.isAutoRotating) { // 自动旋转
    let diff = state.targetGlobalAngle - state.globalAngle; // 计算角度差   
    
    if (!state.forceRotation) {
      while (diff <= -Math.PI) diff += Math.PI * 2; // 角度差 
      while (diff > Math.PI) diff -= Math.PI * 2; // 角度差
    }
    
    if (Math.abs(diff) < 0.005) {
      state.globalAngle = state.targetGlobalAngle;  // 角度差
      state.isAutoRotating = false; // 自动旋转
      state.forceRotation = false;

      // 旋转停止后自动显示气泡菜单
      if (state.autoShowBubbleAfterRotation) {
        state.autoShowBubbleAfterRotation = false; // 重置标记
        showBubble('moon', state.focusedIndex); // 显示当前聚焦月球的气泡菜单
      }
    } else {
      state.globalAngle += diff * config.rotationSpeed; // 角度差 
    }
  }
  state.moons.forEach(m => m.update());   

  if (bubbleState.visible) {
    updateBubblePosition();
  }
}

// 更新气泡位置
function updateBubblePosition() {
  let targetX, targetY;
  const { activeType, moonIndex, satIndex } = bubbleState;    
  
  if (moonIndex === -1 || !state.moons[moonIndex]) {
    hideBubble(); // 隐藏气泡
    return;
  }
  
  const moon = state.moons[moonIndex];

  if (activeType === 'moon') {
    if (moonIndex !== state.focusedIndex) {
      hideBubble(); return; // 隐藏气泡   
    }
    targetX = moon.x; targetY = moon.y;
  } else if (activeType === 'satellite') {
    if (moonIndex !== state.focusedIndex) {
      hideBubble(); return; // 隐藏气泡
    }
    const sat = moon.satellites[satIndex];
    targetX = sat.x; targetY = sat.y;
  }

  // 更新 DOM (Logical Pixels)
  bubbleState.x = targetX;  // X坐标
  bubbleState.y = targetY - 20; // Y坐标
}

// 绘制
function draw() {
  ctx.clearRect(0, 0, width, height); // 清除画布

  // 轨道 - 已隐藏
  // ctx.beginPath();  // 开始路径
  // ctx.ellipse(cx, cy, config.orbitRadiusX, config.orbitRadiusY, 0, 0, Math.PI * 2); // 轨道
  // ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  // ctx.lineWidth = 1;
  // ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);

  [...state.moons].sort((a, b) => a.scale - b.scale).forEach(m => m.draw(ctx));
}

// --- 指示器逻辑 (复用 OldKnowledgeGraphView) ---

// 指示器与月球索引映射：显示索引 -> 实际月球索引（反转）
function getMoonIndexFromIndicator(displayIndex) {
  const total = state.moons.length;
  if (total === 0) return -1;
  return total - 1 - displayIndex;
}

// 当前指示器是否激活
function isIndicatorActive(displayIndex) {
  const moonIndex = getMoonIndexFromIndicator(displayIndex);
  return moonIndex === state.focusedIndex;
}

// 计算指示器透明度
function getIndicatorOpacity(displayIndex) {
  const total = state.moons.length;
  if (total === 0) return 1;

  const activeIndex = state.focusedIndex;

  // 将激活月球索引映射回指示器显示索引
  const activeDisplayIndex = getMoonIndexFromIndicator(activeIndex);

  // 激活的指示器完全不透明
  if (displayIndex === activeDisplayIndex) return 1;

  // 计算距离（在指示器显示顺序中的距离）
  const distance = Math.abs(displayIndex - activeDisplayIndex);
  const maxDistance = Math.max(activeDisplayIndex, total - 1 - activeDisplayIndex);

  if (maxDistance === 0) return 1;

  // 线性衰减：从1（激活）到0.2（最远）
  return Math.max(0.2, 1 - (distance / maxDistance) * 0.8);
}

// 计算指示器大小
function getIndicatorSize(displayIndex) {
  const total = state.moons.length;
  if (total === 0) return 18;

  const activeIndex = state.focusedIndex;
  const activeDisplayIndex = getMoonIndexFromIndicator(activeIndex);

  if (displayIndex === activeDisplayIndex) return 18; // 激活大小

  const distance = Math.abs(displayIndex - activeDisplayIndex);
  const maxDistance = Math.max(activeDisplayIndex, total - 1 - activeDisplayIndex);

  if (maxDistance === 0) return 18;

  // 根据距离计算大小：距离越远，大小越小
  const size = 7 + (10 * (1 - distance / maxDistance));
  return Math.max(14, Math.min(24, size));
}

// 处理指示器点击
function handleIndicatorClick(displayIndex) {
  const moonIndex = getMoonIndexFromIndicator(displayIndex);
  if (moonIndex !== -1 && moonIndex !== state.focusedIndex) {
    focusOnIndex(moonIndex);
  }
}

// 根据触摸点位置计算指示器显示索引
function getIndicatorIndexFromTouch(touchY) {
  if (!indicatorContainerRef.value) return null;
  
  const indicatorDots = indicatorContainerRef.value.querySelectorAll('.indicator-dot');
  if (indicatorDots.length === 0) return null;

  let minDistance = Infinity;
  let nearestIndex = 0;

  indicatorDots.forEach((dot, index) => {
    const dotRect = dot.getBoundingClientRect();
    const dotCenterY = dotRect.top + dotRect.height / 2;
    const distance = Math.abs(touchY - dotCenterY);

    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

// 触摸开始
function handleIndicatorTouchStart(e) {
  e.stopPropagation(); // 阻止冒泡，避免触发 Canvas 交互
  isIndicatorDragging.value = true;
  const touchY = e.touches[0].clientY;
  const displayIndex = getIndicatorIndexFromTouch(touchY);
  
  if (displayIndex !== null) {
    indicatorCurrentIndex.value = displayIndex;
    const moonIndex = state.moons.length - 1 - displayIndex;
    if (moonIndex !== -1 && moonIndex !== state.focusedIndex) {
      focusOnIndex(moonIndex);
    }
  }
}

// 触摸移动
function handleIndicatorTouchMove(e) {
  if (!isIndicatorDragging.value) return;
  e.stopPropagation();
  e.preventDefault(); // 防止滚动

  const touchY = e.touches[0].clientY;
  const displayIndex = getIndicatorIndexFromTouch(touchY);

  if (displayIndex !== null && indicatorCurrentIndex.value !== displayIndex) {
    indicatorCurrentIndex.value = displayIndex;
    const moonIndex = getMoonIndexFromIndicator(displayIndex);
    if (moonIndex !== -1 && moonIndex !== state.focusedIndex) {
      focusOnIndex(moonIndex);
    }
  }
}

// 触摸结束
function handleIndicatorTouchEnd(e) {
  if (!isIndicatorDragging.value) return;
  e.stopPropagation();
  isIndicatorDragging.value = false;
  indicatorCurrentIndex.value = null;
}

// 循环
function loop() {
  update();
  draw();
  animationFrameId = requestAnimationFrame(loop);
}

// --- 交互逻辑 ---

// 聚焦到指定索引
function focusOnIndex(index, instant = false) {
  if (index < 0 || index >= state.moons.length) return; // 检查索引 
  hideBubble(); // 隐藏气泡
  state.focusedIndex = index; // 焦点
  const targetMoon = state.moons[index]; // 目标月球

  state.moons.forEach((m, i) => {
    m.targetScale = (i === index) ? m.maxZoomFactor : 1; // 目标缩放
  });

  const currentMod = state.globalAngle % (Math.PI * 2); // 当前角度
  state.globalAngle = currentMod; // 当前角度
  state.targetGlobalAngle = config?.focusAngle - targetMoon?.angleOffset; // 目标角度（可通过config.focusAngle调整）

  if (instant) {
    state.globalAngle = state.targetGlobalAngle; // 当前角度
    state.moons.forEach(m => m.scale = m.targetScale); // 目标缩放
  } else {
    state.isAutoRotating = true; // 自动旋转
    state.autoShowBubbleAfterRotation = true; // 标记需要在旋转停止后显示气泡
  }
}

// 聚焦到指定节点ID
function focusOnNodeId(nodeId, instant = false) {
  if (!nodeId || !state.moons.length) return
  const idx = state.moons.findIndex(m => m.data && m.data.id === nodeId)
  if (idx !== -1) {
    focusOnIndex(idx, instant)
  }
}

// 显示气泡
function showBubble(type, moonIndex, satIndex = -1) {
  let titleText = "";
  const moon = state.moons[moonIndex]; // 目标月球
  let nodeData = null;

  if (type === 'moon') {
    titleText = moon.data.label;  // 标题 
    nodeData = moon.data; // 节点数据
  } else if (type === 'satellite') {
    const sat = moon.satellites[satIndex];  // 目标卫星
    titleText = sat.data.name; // 标题
    nodeData = sat.data; // 节点数据
  }

  bubbleState.title = titleText; // 标题
  bubbleState.activeType = type; // 激活类型
  bubbleState.moonIndex = moonIndex; // 月球索引
  bubbleState.satIndex = satIndex; // 卫星索引
  bubbleState.data = nodeData; // 节点数据
  bubbleState.visible = true; // 可见
  
  updateBubblePosition();
  
  // 触发节点点击事件
  emit('node-click', nodeData);
}

// 隐藏气泡
function hideBubble() {
  bubbleState.visible = false; // 可见
  bubbleState.activeType = null; // 激活类型
  bubbleState.moonIndex = -1; // 月球索引
}

// 处理动作
function handleAction(actionType) {
  console.log('handleAction', actionType, bubbleState.data);
  emit('action', { type: actionType, data: bubbleState.data }); // 触发事件
}

// 统一的点击处理
let lastClickTime = 0;
function handleClick(x, y) {
  // 防止 touch/mouse 重复触发
  const now = Date.now();
  if (now - lastClickTime < 100) return;
  lastClickTime = now;

  // 1. 卫星 (仅聚焦月球)
  const currentMoon = state.moons[state.focusedIndex]; // 当前月球
  let satelliteHit = false; // 卫星点击
  if (currentMoon && currentMoon.scale > 1.1) {
    for (let j = 0; j < currentMoon.satellites.length; j++) {
      const sat = currentMoon.satellites[j];
      const hitR = 30;
      if ((x - sat.x)**2 + (y - sat.y)**2 < hitR**2) {
        showBubble('satellite', state.focusedIndex, j);
        satelliteHit = true;
        break;
      }
    }
  }
  if (satelliteHit) return;

  // 2. 月球
  let minDist = Infinity;
  let closestIndex = -1; // 最近月球索引
  for (let i = 0; i < state.moons.length; i++) {
    const moon = state.moons[i];
    const r = (i === state.focusedIndex) ? config.moonRadiusFocusBase * (moon.scale/1.5) : config.moonRadiusBase;
    const hitR = r + 10;
    const dist = Math.sqrt((x - moon.x)**2 + (y - moon.y)**2);
    if (dist < hitR && dist < minDist) {
      minDist = dist;
      closestIndex = i; // 最近月球索引
    }
  }

  if (closestIndex !== -1) {
    console.log('closestIndex  state.focusedIndex', closestIndex, state.focusedIndex);
    if (closestIndex === state.focusedIndex) {
      showBubble('moon', closestIndex); // 显示月球气泡
    } else {
      focusOnIndex(closestIndex); // 聚焦月球
    }
  } else {
    hideBubble(); // 隐藏气泡
  }
}

// 切换焦点
function switchFocus(direction) {
  const len = state.moons.length; // 章节数 
  
  if (len === 1) {
    state.forceRotation = true;
    state.isAutoRotating = true;
    // 旋转一整圈
    const rotationAmount = Math.PI * 2;
    const baseAngle = state.isAutoRotating ? state.targetGlobalAngle : state.globalAngle;
    state.targetGlobalAngle = baseAngle + (direction === 'next' ? rotationAmount : -rotationAmount);
    return;
  }

  const newIndex = direction === 'next' 
    ? (state.focusedIndex + 1) % len 
    : (state.focusedIndex - 1 + len) % len;
  focusOnIndex(newIndex);
}

function drawMultilineTextWithEllipsis(ctx, text, x, y, maxWidth, lineHeight, maxLines, textAlign = 'center', textBaseline = 'middle') {
  if (!text) return;

  const originalBaseline = ctx.textBaseline;
  const originalTextAlign = ctx.textAlign;

  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle'; 

  const words = text.split('');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i];
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && i > 0) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  if (lines.length > maxLines) {
    const lastLineIndex = maxLines - 1;
    // 合并剩余行重新计算，确保尽可能多的文字
    // 简单点：取出最后一行原本的内容加上后面的内容尝试截断
    // 这里直接用暴力尝试法
    const fullRemaining = text.substring(lines.slice(0, lastLineIndex).join('').length);
    let testStr = fullRemaining;
    while (ctx.measureText(testStr + '...').width > maxWidth && testStr.length > 0) {
      testStr = testStr.slice(0, -1);
    }
    lines[lastLineIndex] = testStr + '...';
    lines.length = maxLines;
  }

  const totalHeight = lineHeight * lines.length;
  let startY = y;
  
  if (textBaseline === 'middle') {
    startY = y - (totalHeight / 2) + (lineHeight / 2);
  } else if (textBaseline === 'top') {
    startY = y + (lineHeight / 2);
  } else if (textBaseline === 'bottom') {
    startY = y - totalHeight + (lineHeight / 2);
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, startY + i * lineHeight);
  }

  ctx.textBaseline = originalBaseline;
  ctx.textAlign = originalTextAlign;
}

// --- Event Handlers ---

// 开始交互
function onStart(e) {
  // 如果点击了 Bubble 内部，阻止 Canvas 交互逻辑
  if (e.target.closest('.bubble-container')) return;

  const touch = e.touches ? e.touches[0] : e;
  const rect = canvasRef.value?.getBoundingClientRect();
  // 获取相对于 Canvas 的坐标
  const clientX = touch.clientX - rect.left;
  const clientY = touch.clientY - rect.top;
  
  state.isInteracting = true;
  state.startX = clientX;
  state.startY = clientY;
  state.lastX = clientX;
  state.interactionMode = null;
  
  document.body.style.cursor = 'grabbing';
}

// 移动交互
function onMove(e) {
  if (!state.isInteracting) return;
  const touch = e.touches ? e.touches[0] : e;
  const rect = canvasRef.value?.getBoundingClientRect();
  const clientX = touch.clientX - rect.left;
  const clientY = touch.clientY - rect.top;

  const dx = clientX - state.startX;
  const dy = clientY - state.startY;

  if (!state.interactionMode) {
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      // 仅允许纵向切换，去除横向旋转
      if (Math.abs(dy) > Math.abs(dx)) {
        state.interactionMode = 'SWITCH';
      }
    }
  }

  if (state.interactionMode === 'SWITCH') {
    if (dy < -50) {
      switchFocus('next');
      state.isInteracting = false;
    } else if (dy > 50) {
      switchFocus('prev');
      state.isInteracting = false;
    }
  }
  state.lastX = clientX;
}

// 结束交互
function onEnd(e) {
  state.isInteracting = false;
  document.body.style.cursor = '';

  const touch = e.changedTouches ? e.changedTouches[0] : e;
  const rect = canvasRef.value?.getBoundingClientRect();
  const clientX = touch?.clientX - rect?.left;
  const clientY = touch?.clientY - rect?.top;

  if (!state.interactionMode) {
    const dist = Math.abs(clientX - state.startX) + Math.abs(clientY - state.startY);
    if (dist < 10) {
      handleClick(clientX, clientY);
    }
  }
}

// --- Lifecycle ---

watch(() => props.data, () => {
  init();
}, { deep: true });

onMounted(() => {
  if (!canvasRef.value) return;
  ctx = canvasRef.value?.getContext('2d');

  // 绑定 Canvas 内的 Start 事件
  const canvas = canvasRef.value;
  canvas.addEventListener('mousedown', onStart); // 鼠标按下  
  canvas.addEventListener('touchstart', onStart, { passive: false }); // 触摸开始

  // 绑定 Window 级的 Move/End 事件 (处理拖拽出框)
  window.addEventListener('mousemove', onMove); // 鼠标移动
  window.addEventListener('mouseup', onEnd); // 鼠标释放
  window.addEventListener('touchmove', (e) => { // 触摸移动
    if(state.isInteracting) e.preventDefault();
    onMove(e);
  }, { passive: false });
  window.addEventListener('touchend', onEnd); // 触摸结束

  window.addEventListener('resize', resize); // 窗口大小改变

  nextTick(() => {
    init();
  });
});

onUnmounted(() => {
  cancelAnimationFrame(animationFrameId); // 取消动画帧
  window.removeEventListener('mousemove', onMove); // 移除鼠标移动事件
  window.removeEventListener('mouseup', onEnd); // 移除鼠标释放事件
  window.removeEventListener('resize', resize); // 移除窗口大小改变事件
});

// 向外部暴露方法
defineExpose({
  focusOnNodeId
})

</script>

<style scoped>
.knowledge-graph-container {
  position: relative;
  width: 100%;
  height: 100%; /* 填充父容器 */
  overflow: hidden;
  font-family: "Microsoft YaHei", sans-serif;
  user-select: none;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

.space-canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.space-canvas:active {
  cursor: grabbing;
}

/* 气泡弹窗样式，复用 GraphNode 的视觉风格 */
.manual-bubble-menu {
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(-50%, -130%);
  z-index: 100;
  pointer-events: auto;
  opacity: 0;
  display: none;
  transition: opacity 0.2s, transform 0.2s;
}

.manual-bubble-menu--visible {
  display: block;
  opacity: 1;
}

.bubble-menu-container {
  background: #ffffff;
  border-radius: 18px;
  padding: 10px 10px 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  border: none;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 120px;
}


.bubble-menu-button {
  width: 100%;
  border: none;
  border-radius: 999px;
  padding: 10px 0;
  font-size: 14px;
  cursor: pointer;
  color: #fff;
  margin-top: 8px;
  font-weight: 500;
  transition: transform 0.1s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.bubble-menu-button--learn {
  background: #6a5cff;
  box-shadow: 0 2px 8px rgba(106, 92, 255, 0.5);
}

.bubble-menu-button--practice {
  background: #ff9b59;
  box-shadow: 0 2px 8px rgba(255, 155, 89, 0.5);
}

/* 右侧指示器样式 (从老版移植) */
.right-border-indicator {
  position: absolute;
  right: 36px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
  /* 触摸交互优化 */
  touch-action: none;
}

.indicator-dot {
  width: 7px;
  height: 7px;
  background: rgba(139, 92, 246, 0.6);
  border-radius: 50%;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
  margin: 5px 0; /* 增加垂直间距匹配 design */
  
  /* 触摸优化 */
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.indicator-dot:hover {
  background: rgba(139, 92, 246, 0.8);
  transform: scale(1.1);
}

.indicator-dot:active {
  transform: scale(0.95);
  transition: transform 0.1s ease;
}

.indicator-dot.active {
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #6d28d9 100%);
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.8), 0 0 24px rgba(139, 92, 246, 0.4);
  opacity: 1 !important;
}

.indicator-icon {
  position: absolute;
  left: -30px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  z-index: 10;
  pointer-events: none;
}

@media (max-width: 768px) {
  .indicator-dot {
    min-width: 28px;
    min-height: 28px;
    margin: 10px 0;
  }
  
  .indicator-dot.active {
    min-width: 24px;
    min-height: 24px;
  }
}

.bubble-menu-button:active {
  transform: scale(0.96);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}
.debug-toggle-btn {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  z-index: 9998;
}

.debug-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.1);
}

.debug-toggle-btn.active {
  background: rgba(79, 195, 247, 0.8);
  border-color: rgba(79, 195, 247, 1);
}

.debug-toggle-btn svg {
  width: 20px;
  height: 20px;
}
</style>