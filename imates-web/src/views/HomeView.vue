<template>
  <q-layout view="lHh Lpr lFf">
    <!-- 顶部工具栏 -->
    <q-header elevated class="bg-white text-primary app-header" reveal>
      <q-toolbar class="app-toolbar">
        <div class="toolbar-title">
          <q-icon name="school" size="24px" class="q-mr-sm" />
          <span>智能学习助手</span>
        </div>
        
        <q-space />
        
        <!-- 用户信息 -->
        <div class="user-info">
          <q-avatar size="32px" color="primary" text-color="white">
            <q-icon name="person" />
          </q-avatar>
        </div>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page class="home-page">
        <!-- 主要内容区域 -->
        <div class="main-content">
          <!-- 欢迎区域 -->
          <div class="welcome-section">
            <div class="welcome-content">
              <h1 class="welcome-title">欢迎使用智能学习助手</h1>
              <p class="welcome-subtitle">选择您需要的功能开始学习</p>
            </div>
          </div>

          <!-- 功能卡片区域 -->
          <div class="features-grid">
            <!-- 习题解答功能 -->
            <q-card 
              class="feature-card exercise-solve-card"
              @click="navigateToExerciseSolve"
            >
              <q-card-section class="card-content">
                <div class="card-icon">
                  <q-icon name="quiz" size="48px" />
                </div>
                <div class="card-title">习题解答</div>
                <div class="card-description">
                  智能AI指导解题，老师答疑，查看答案，举一反三
                </div>
                <div class="card-features">
                  <q-chip size="sm" color="primary" text-color="white" icon="smart_toy">
                    AI指导
                  </q-chip>
                  <q-chip size="sm" color="secondary" text-color="white" icon="school">
                    老师答疑
                  </q-chip>
                  <q-chip size="sm" color="positive" text-color="white" icon="visibility">
                    查看答案
                  </q-chip>
                </div>
              </q-card-section>
            </q-card>

            <!-- 习题查找功能 -->
            <q-card 
              class="feature-card find-exercise-card"
              @click="navigateToFindExercise"
            >
              <q-card-section class="card-content">
                <div class="card-icon">
                  <q-icon name="search" size="48px" />
                </div>
                <div class="card-title">习题查找</div>
                <div class="card-description">
                  根据知识点查找相似题目，批量添加到练习列表
                </div>
                <div class="card-features">
                  <q-chip size="sm" color="info" text-color="white" icon="find_in_page">
                    相似题目
                  </q-chip>
                  <q-chip size="sm" color="warning" text-color="white" icon="add_circle">
                    批量添加
                  </q-chip>
                  <q-chip size="sm" color="accent" text-color="white" icon="bookmark">
                    收藏管理
                  </q-chip>
                </div>
              </q-card-section>
            </q-card>

            <!-- 学习统计功能 -->
            <q-card 
              class="feature-card statistics-card"
              @click="navigateToStatistics"
            >
              <q-card-section class="card-content">
                <div class="card-icon">
                  <q-icon name="analytics" size="48px" />
                </div>
                <div class="card-title">学习统计</div>
                <div class="card-description">
                  查看学习进度，分析学习效果，制定学习计划
                </div>
                <div class="card-features">
                  <q-chip size="sm" color="purple" text-color="white" icon="trending_up">
                    学习进度
                  </q-chip>
                  <q-chip size="sm" color="teal" text-color="white" icon="insights">
                    效果分析
                  </q-chip>
                </div>
              </q-card-section>
            </q-card>

            <!-- 设置功能 -->
            <q-card 
              class="feature-card settings-card"
              @click="navigateToSettings"
            >
              <q-card-section class="card-content">
                <div class="card-icon">
                  <q-icon name="settings" size="48px" />
                </div>
                <div class="card-title">设置</div>
                <div class="card-description">
                  个性化设置，账户管理，系统配置
                </div>
                <div class="card-features">
                  <q-chip size="sm" color="grey" text-color="white" icon="person">
                    个人设置
                  </q-chip>
                  <q-chip size="sm" color="grey-6" text-color="white" icon="tune">
                    系统配置
                  </q-chip>
                </div>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

// 导航方法
const navigateToExerciseSolve = () => {
  router.push('/exercise-solve')
}

const navigateToFindExercise = () => {
  router.push('/find-exercise')
}

const navigateToStatistics = () => {
  // 暂时显示提示，后续可以添加统计页面
  console.log('学习统计功能开发中...')
}

const navigateToSettings = () => {
  // 暂时显示提示，后续可以添加设置页面
  console.log('设置功能开发中...')
}
</script>

<style lang="scss" scoped>
// 变量定义
$header-height: 56px;
$border-color: #e5e7eb;
$primary-color: #1976d2;
$card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
$card-shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.15);

// 主要样式
.home-page {
  min-height: calc(100vh - #{$header-height});
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.app-header {
  height: $header-height;
  min-height: $header-height;
  max-height: $header-height;
  border-bottom: 1px solid $border-color;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.app-toolbar {
  height: $header-height;
  min-height: $header-height;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.toolbar-title {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.main-content {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-section {
  text-align: center;
  margin-bottom: 40px;
  padding: 40px 0;
}

.welcome-content {
  .welcome-title {
    font-size: 32px;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 16px 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .welcome-subtitle {
    font-size: 18px;
    color: #6b7280;
    margin: 0;
  }
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.feature-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: $card-shadow;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.9);

  &:hover {
    transform: translateY(-4px);
    box-shadow: $card-shadow-hover;
  }

  .card-content {
    padding: 32px 24px;
    text-align: center;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .card-icon {
    margin-bottom: 20px;
    padding: 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-title {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 12px;
  }

  .card-description {
    font-size: 14px;
    color: #6b7280;
    line-height: 1.6;
    margin-bottom: 20px;
    flex: 1;
  }

  .card-features {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
}

// 不同卡片的特殊样式
.exercise-solve-card {
  .card-icon {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
}

.find-exercise-card {
  .card-icon {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
}

.statistics-card {
  .card-icon {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
}

.settings-card {
  .card-icon {
    background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .main-content {
    padding: 16px;
  }

  .welcome-content {
    .welcome-title {
      font-size: 24px;
    }

    .welcome-subtitle {
      font-size: 16px;
    }
  }

  .features-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .feature-card {
    .card-content {
      padding: 24px 16px;
    }

    .card-title {
      font-size: 20px;
    }

    .card-description {
      font-size: 13px;
    }
  }
}

@media (max-width: 480px) {
  .welcome-section {
    padding: 20px 0;
    margin-bottom: 24px;
  }

  .welcome-content {
    .welcome-title {
      font-size: 20px;
    }

    .welcome-subtitle {
      font-size: 14px;
    }
  }

  .feature-card {
    .card-content {
      padding: 20px 12px;
    }

    .card-icon {
      padding: 16px;
      margin-bottom: 16px;
    }

    .card-title {
      font-size: 18px;
    }
  }
}
</style>
