<template>
  <div>
    <Modal
      v-model="localVisible"
      title="个人信息"
      :auto-size="true"
      title-align="left"
      header-background-color="#ffffff"
      class="profile-dialog"
    >
      <div class="profile-dialog-content">
        <!-- 用户信息列表 -->
        <div class="profile-list">
          <!-- 头像项 -->
          <div class="list-item avatar-item" @click="handleAvatarClick">
            <div class="item-label">头像</div>
            <div class="item-content">
              <div class="user-avatar-list">
                <img :src="currentAvatar" alt="avatar" class="avatar-image-list" />
                <div class="avatar-overlay-list">
                  <span class="change-avatar-text">更换</span>
                </div>
              </div>
            </div>
            <div class="item-arrow">›</div>
          </div>

          <!-- 用户名项 -->
          <div class="list-item">
            <div class="item-label">用户名</div>
            <div class="item-content">
              <span class="item-value">{{ displayUserName }}</span>
            </div>
          </div>

          <!-- 用户ID项 -->
          <div class="list-item">
            <div class="item-label">用户ID</div>
            <div class="item-content">
              <span class="item-value">{{ userId }}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>

    <AvatarCropOverlay
      v-model="cropVisible"
      :src="cropSrc"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useImagePicker } from '@/composables/useImagePicker'
import { authService, getXuebanToken, getYanbanToken } from '@/services'
import { showMessage } from '@/utils'
import Modal from '@/components/base/Modal.vue'
import AvatarCropOverlay from '@/components/base/AvatarCropOverlay.vue'
import avatarIcon from '/icons/avatar.svg'

interface Props {
  modelValue: boolean
  userInfo?: {
    id: string
    name: string
    avatar: string
    avatarNew: string
    roles?: string[]
  }
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'avatar-changed', avatarUrl: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const router = useRouter()

// 使用 v-model 的本地状态
const localVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 响应式数据
const { pickImage } = useImagePicker()

const cropVisible = ref(false)
const cropSrc = ref('')

// 图片选择器

// 用户ID - 从父组件传入的用户信息中获取
const userId = computed(() => {
  return props.userInfo?.id || '未知'
})

// 当前头像 - 从父组件传入的用户信息中获取
const currentAvatar = computed(() => {
  if (props.userInfo?.avatarNew) {
    return props.userInfo.avatarNew
  }
  return avatarIcon
})

// 显示用户名 - 从父组件传入的用户信息中获取
const displayUserName = computed(() => {
  const name = props.userInfo?.name?.toString().trim()
  return name || '用户'
})

// 监听对话框打开，重置状态并更新用户信息
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    // 重置状态的逻辑可以在这里添加
  }
})


// 处理头像点击 - 选择新头像
const handleAvatarClick = async () => {
  try {
    const imageInfo = await pickImage()
    if (!imageInfo || !imageInfo.base64DataUrl) {
      return
    }

    cropSrc.value = imageInfo.base64DataUrl
    cropVisible.value = true
  } catch (error) {
    console.error('[ProfileDialog] 选择头像失败:', error)
    showMessage('头像更新失败，请重试', 'error')
  }
}

const handleCropConfirm = (croppedDataUrl: string) => {
  emit('avatar-changed', croppedDataUrl)
  showMessage('头像更新成功', 'success')
}

const handleCropCancel = () => {
  cropSrc.value = ''
}
</script>

<style lang="scss" scoped>
// 个人信息对话框样式
.profile-dialog {
  // 覆盖标题样式
  :deep(.text-h6) {
    font-size: 18px !important;
    font-weight: 600 !important;
    color: #1f2937 !important;
  }

  // 移除 header 底部边框
  :deep(.dialog-header-section) {
    border-bottom: none !important;
  }
}

.profile-dialog-content {
  padding-bottom: 10px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

// 用户信息列表
.profile-list {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
}

.list-item {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background-color: #f9fafb;
  }

  &:last-child {
    border-bottom: none;
  }

  &.avatar-item {
    padding: 20px;
  }

}

.item-label {
  font-size: 16px;
  font-weight: 500;
  color: #374151;
  min-width: 80px;
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
}

.item-value {
  font-size: 16px;
  color: #6b7280;
  text-align: right;
}

.item-arrow {
  font-size: 20px;
  color: #d1d5db;
  margin-left: 12px;
  flex-shrink: 0;
}

// 列表头像样式
.user-avatar-list {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #e3f2fd;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .avatar-image-list {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-overlay-list {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
    border-radius: 50%;
  }

  &:hover .avatar-overlay-list {
    opacity: 1;
  }

  .change-avatar-text {
    color: white;
    font-size: 12px;
    font-weight: 500;
    text-align: center;
  }
}


// 响应式设计
@media (max-width: 480px) {
  .profile-dialog-content {
    padding: 16px;
  }

  .list-item {
    padding: 14px 16px;

    &.avatar-item {
      padding: 16px;
    }
  }

  .item-label {
    font-size: 15px;
    min-width: 70px;
  }

  .item-value {
    font-size: 15px;
  }

  .user-avatar-list {
    width: 44px;
    height: 44px;
  }
}

.user-avatar-large {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: #e3f2fd;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
    border-radius: 50%;
  }

  &:hover .avatar-overlay {
    opacity: 1;
  }

  .change-avatar-text {
    color: white;
    font-size: 12px;
    font-weight: 500;
    text-align: center;
    line-height: 1.2;
  }

}

.user-details {
  flex: 1;
  min-width: 0;
}

.user-name-large {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
  word-break: break-all;
  line-height: 1.3;
}

.user-id {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

// 操作按钮区域
.action-buttons {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

// 响应式设计
@media (max-width: 480px) {
  .profile-dialog-content {
    padding: 20px 16px;
    gap: 20px;
  }

  .user-info-section {
    padding: 12px;
    gap: 12px;
  }

  .user-avatar-large {
    width: 50px;
    height: 50px;

    .change-avatar-text {
      font-size: 11px;
    }
  }

  .user-name-large {
    font-size: 16px;
  }

  .user-id {
    font-size: 13px;
  }

  .action-btn {
    min-width: 100px;
    height: 40px;
  }
}
</style>
