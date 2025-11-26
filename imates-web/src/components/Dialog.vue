<template>
    <dialog ref="myDialog" id="myDialog">
        <div class="dialog-inner-content">
        <div class="dialog-header">
            <span class="dialog-title">
            {{ title }}
            </span>
            <button
            @click="closeDialog"
            class="dialog-close-top"
            aria-label="关闭"
            >
            <svg
                class="icon-close"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
                />
            </svg>
            </button>
        </div>

        <p class="dialog-content-text">
            <slot>
            </slot>
        </p>

        <div class="dialog-actions">
            <button
            @click="closeDialog"
            class="dialog-button-cancel"
            >
            {{ cancelButtonText }}
            </button>
            <button
            @click="handleConfirm"
            class="dialog-button-confirm"
            >
            {{ confirmButtonText }}
            </button>
        </div>
        </div>
    </dialog>
</template>

<script setup>
import { ref, defineProps, defineEmits, defineExpose } from 'vue';

// 定义组件属性
const props = defineProps({
  title: {
    type: String,
    default: '操作确认',
  },
  confirmButtonText: {
    type: String,
    default: '确认执行',
  },
  cancelButtonText: {
    type: String,
    default: '取消',
  },
});

// 定义组件事件
const emit = defineEmits(['confirm']);

// 引用 <dialog> 元素
const myDialog = ref(null);

/**
 * 打开对话框
 */
const openDialog = () => {
  if (myDialog.value) {
    myDialog.value.showModal();
  }
};

/**
 * 关闭对话框
 */
const closeDialog = () => {
  if (myDialog.value) {
    myDialog.value.close();
  }
};

/**
 * 处理确认操作
 */
const handleConfirm = () => {
  emit('confirm');
  closeDialog();
};

// 暴露打开和关闭方法，以便父组件可以控制对话框
defineExpose({
  openDialog,
  closeDialog,
});
</script>

<style scoped>
/* ---------------------------------- */
/* 1. 对话框基础和动画样式 */
/* ---------------------------------- */
/* <dialog> 自身的样式 */
#myDialog {
    border: none;
    border-radius: 1rem;
    padding: 0;
    max-width: 90vw;
    width: 400px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    background-color: white;
    animation: fadeIn 0.3s ease-out;
}

/* 样式化 backdrop */
#myDialog::backdrop {
    /* 黑色半透明遮罩层，不进行模糊处理 */
    background-color: rgba(0, 0, 0, 0.6);
    animation: backdropFadeIn 0.3s ease-out;
}

/* Keyframes */
@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
@keyframes backdropFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

/* 隐藏未打开的对话框 */
#myDialog:not([open]) {
    display: none;
}

/* ---------------------------------- */
/* 2. 组件元素样式 (原生 CSS) */
/* ---------------------------------- */

/* 外部打开按钮 (dialog-open-button) */
.dialog-open-button {
    background-color: #4f46e5;
    color: white;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
    transition: background-color 0.2s;
    border: none;
    cursor: pointer;
}
.dialog-open-button:hover {
    background-color: #4338ca;
}

/* 对话框内部容器 */
.dialog-inner-content {
    padding: 2rem;
}
@media (min-width: 768px) {
    .dialog-inner-content {
        padding: 2rem;
    }
}

/* 头部 */
.dialog-header {
    display: flex;
    justify-content: space-between;
    /* 标题和关闭按钮在一行左右两侧，垂直居中 */
    align-items: center;
    margin-bottom: 1rem;
}

/* 标题 */
.dialog-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: #1f2937;
}

/* 顶部关闭按钮 */
.dialog-close-top {
    color: #9ca3af;
    padding: 0.25rem;
    border-radius: 9999px;
    transition: color 0.15s, background-color 0.15s;
    border: none;
    background: none;
    cursor: pointer;
}
.dialog-close-top:hover {
    color: #4b5563;
    background-color: #f3f4f6;
}

/* SVG图标尺寸 */
.icon-close {
    width: 1.25rem;
    height: 1.25rem;
}

/* 内容文本 */
.dialog-content-text {
    color: #4b5563;
    margin-bottom: 1.5rem;
}

/* 动作按钮容器 */
.dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}

/* 按钮基础样式 */
.dialog-button-cancel,
.dialog-button-confirm {
    font-weight: 500;
    border-radius: 0.5rem;
    transition: background-color 0.15s;
    border: none;
    cursor: pointer;
}

/* 取消按钮：稍小 */
.dialog-button-cancel {
    padding: 0.4rem 0.9rem;
    background-color: #e5e7eb;
    color: #1f2937;
}
.dialog-button-cancel:hover {
    background-color: #d1d5db;
}

/* 确认按钮：稍大、主色 */
.dialog-button-confirm {
    padding: 0.55rem 1.3rem; /* 比取消略大一点 */
    background-color: #6e55ff;
    color: white;
}
.dialog-button-confirm:hover {
    background-color: #6e55ff;
}
</style>