<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import AiAssistant from '@/components/AiAssistant.vue'

const userStore = useUserStore()

// 功能列表 - 精简为主要功能
const features = ref([
  {
    id: 'excel',
    title: '表格处理',
    icon: '📊',
    bgColor: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
    status: 'active',
    path: '/pages/excel/index'
  },
  {
    id: 'accounting',
    title: '账目核算',
    icon: '🧮',
    bgColor: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
    status: 'coming',
    path: ''
  },
  {
    id: 'history',
    title: '历史记录',
    icon: '📁',
    bgColor: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
    status: 'active',
    path: '/pages/history/index'
  }
])

// 加载状态
const isLoading = ref(true)

// 获取当前时间段问候语
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

// 跳转到功能页面
function navigateToFeature(feature: typeof features.value[0]) {
  if (feature.status === 'coming') {
    uni.showToast({
      title: `${userStore.userHonorific}，该功能正在开发中~`,
      icon: 'none',
      duration: 2000
    })
    return
  }
  uni.navigateTo({ url: feature.path })
}

// 退出登录
function handleLogout() {
  uni.showModal({
    title: '提示',
    content: `${userStore.userHonorific}，确定要退出登录吗？`,
    confirmText: '确定退出',
    confirmColor: '#5B8C5A',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.redirectTo({ url: '/pages/login/index' })
      }
    }
  })
}

onMounted(() => {
  userStore.initFromStorage()
  setTimeout(() => {
    isLoading.value = false
  }, 600)
  if (!userStore.isLoggedIn) {
    uni.redirectTo({ url: '/pages/login/index' })
  }
})
</script>

<template>
  <view class="home-container">
    <!-- 动态背景光晕 -->
    <view class="bg-glow glow-1"></view>
    <view class="bg-glow glow-2"></view>
    
    <!-- 加载状态 -->
    <view v-if="isLoading" class="loading-mask">
      <view class="loading-content">
        <view class="loading-spinner"></view>
        <text class="loading-text">{{ userStore.userHonorific }}，正在准备...</text>
      </view>
    </view>
    
    <!-- 顶部用户区域 -->
    <view class="header-section">
      <view class="user-row">
        <view class="user-info">
          <view class="avatar-wrapper">
            <text class="avatar-emoji">😊</text>
          </view>
          <view class="user-text">
            <text class="greeting">{{ getGreeting() }}，{{ userStore.userHonorific }}</text>
            <text class="subtitle">今天也辛苦了~</text>
          </view>
        </view>
        <view class="logout-btn" @click="handleLogout">
          <text>退出</text>
        </view>
      </view>
    </view>
    
    <!-- 功能卡片区域 -->
    <view class="features-section">
      <view class="features-grid">
        <view 
          v-for="(feature, index) in features" 
          :key="feature.id"
          class="feature-card"
          :class="{ 'coming-soon': feature.status === 'coming' }"
          :style="{ animationDelay: `${index * 0.1}s` }"
          @click="navigateToFeature(feature)"
        >
          <view class="feature-icon" :style="{ background: feature.bgColor }">
            <text class="icon-emoji">{{ feature.icon }}</text>
          </view>
          <text class="feature-title">{{ feature.title }}</text>
          <view v-if="feature.status === 'coming'" class="coming-badge">
            <text>开发中</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 快捷提示 -->
    <view class="quick-tips">
      <view class="tip-item">
        <text class="tip-icon">💡</text>
        <text class="tip-text">支持 .xlsx 格式 · 自动保存记录 · AI随时帮助</text>
      </view>
    </view>
    
    <!-- 底部鼓励语 -->
    <view class="footer-message">
      <text>🌿 {{ userStore.userHonorific }}，您太棒了！🌿</text>
    </view>
    
    <!-- AI助手组件 -->
    <AiAssistant />
  </view>
</template>

<style lang="scss" scoped>
.home-container {
  height: 100vh;
  background: linear-gradient(180deg, #F0F4F0 0%, #E8EDE8 50%, #F5F8F5 100%);
  display: flex;
  flex-direction: column;
  padding: 0 32rpx;
  position: relative;
  overflow: hidden;
}

// 动态护眼光晕背景
.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
  opacity: 0.4;
  pointer-events: none;
  animation: float 8s ease-in-out infinite;
}

.glow-1 {
  width: 300rpx;
  height: 300rpx;
  background: linear-gradient(135deg, #A8D5A2, #8CC084);
  top: -50rpx;
  right: -50rpx;
  animation-delay: 0s;
}

.glow-2 {
  width: 250rpx;
  height: 250rpx;
  background: linear-gradient(135deg, #B5D6B2, #9DC49A);
  bottom: 200rpx;
  left: -80rpx;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(20rpx, -20rpx) scale(1.05); }
}

.loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(240, 244, 240, 0.98);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  
  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .loading-spinner {
    width: 60rpx;
    height: 60rpx;
    border: 4rpx solid #E0E8E0;
    border-top-color: #5B8C5A;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  .loading-text {
    margin-top: 24rpx;
    font-size: 28rpx;
    color: #5B8C5A;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.header-section {
  padding-top: 100rpx;
  padding-bottom: 40rpx;
  position: relative;
  z-index: 1;
  
  .user-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .user-info {
    display: flex;
    align-items: center;
    
    .avatar-wrapper {
      width: 88rpx;
      height: 88rpx;
      background: linear-gradient(135deg, #FFFFFF 0%, #F5F8F5 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4rpx 20rpx rgba(91, 140, 90, 0.15);
      
      .avatar-emoji {
        font-size: 44rpx;
      }
    }
    
    .user-text {
      margin-left: 20rpx;
      display: flex;
      flex-direction: column;
      
      .greeting {
        font-size: 36rpx;
        font-weight: 600;
        color: #3D5A3D;
        letter-spacing: 1rpx;
      }
      
      .subtitle {
        font-size: 24rpx;
        color: #7A9A7A;
        margin-top: 4rpx;
      }
    }
  }
  
  .logout-btn {
    padding: 12rpx 28rpx;
    background: rgba(91, 140, 90, 0.1);
    border-radius: 32rpx;
    
    text {
      font-size: 24rpx;
      color: #5B8C5A;
    }
    
    &:active {
      background: rgba(91, 140, 90, 0.2);
    }
  }
}

.features-section {
  flex: 1;
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
  
  .features-grid {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 20rpx;
  }
  
  .feature-card {
    flex: 1;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20rpx);
    border-radius: 32rpx;
    padding: 36rpx 20rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 8rpx 32rpx rgba(91, 140, 90, 0.08);
    border: 2rpx solid rgba(255, 255, 255, 0.6);
    transition: all 0.3s ease;
    animation: fadeInUp 0.5s ease-out both;
    position: relative;
    
    &:active {
      transform: scale(0.96);
      box-shadow: 0 4rpx 16rpx rgba(91, 140, 90, 0.12);
    }
    
    &.coming-soon {
      opacity: 0.65;
    }
    
    .feature-icon {
      width: 100rpx;
      height: 100rpx;
      border-radius: 28rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20rpx;
      box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
      
      .icon-emoji {
        font-size: 44rpx;
      }
    }
    
    .feature-title {
      font-size: 28rpx;
      font-weight: 600;
      color: #3D5A3D;
      text-align: center;
    }
    
    .coming-badge {
      position: absolute;
      top: 16rpx;
      right: 16rpx;
      background: linear-gradient(135deg, #FFE4CC, #FFD4B3);
      padding: 4rpx 12rpx;
      border-radius: 16rpx;
      
      text {
        font-size: 18rpx;
        color: #CC7A3D;
      }
    }
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.quick-tips {
  padding: 24rpx 0;
  position: relative;
  z-index: 1;
  
  .tip-item {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10rpx);
    border-radius: 20rpx;
    padding: 20rpx 24rpx;
    display: flex;
    align-items: center;
    
    .tip-icon {
      font-size: 28rpx;
      margin-right: 12rpx;
    }
    
    .tip-text {
      font-size: 22rpx;
      color: #6B8A6B;
      flex: 1;
    }
  }
}

.footer-message {
  padding: 32rpx 0;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  text-align: center;
  position: relative;
  z-index: 1;
  
  text {
    font-size: 26rpx;
    color: #5B8C5A;
    letter-spacing: 2rpx;
  }
}
</style>
