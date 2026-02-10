<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const isLoading = ref(true)
const loadingText = ref('正在启动...')

onMounted(async () => {
  // 初始化用户状态
  userStore.initFromStorage()
  
  // 模拟启动加载
  await new Promise(resolve => setTimeout(resolve, 500))
  loadingText.value = '正在加载资源...'
  
  await new Promise(resolve => setTimeout(resolve, 800))
  loadingText.value = '即将进入...'
  
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 检查登录状态并跳转
  if (userStore.isLoggedIn) {
    uni.redirectTo({ url: '/pages/home/index' })
  } else {
    uni.redirectTo({ url: '/pages/login/index' })
  }
})
</script>

<template>
  <view class="splash-container">
    <!-- 背景装饰 -->
    <view class="bg-glow glow-1"></view>
    <view class="bg-glow glow-2"></view>
    <view class="bg-glow glow-3"></view>
    
    <!-- Logo区域 -->
    <view class="logo-section">
      <view class="logo-icon">
        <text class="logo-emoji">📊</text>
      </view>
      <text class="app-name">智慧表格助手</text>
      <text class="app-slogan">让工作更轻松，让生活更美好</text>
    </view>
    
    <!-- 加载动画 -->
    <view class="loading-section">
      <view class="loading-bar">
        <view class="loading-progress"></view>
      </view>
      <text class="loading-text">{{ loadingText }}</text>
    </view>
    
    <!-- 底部信息 -->
    <view class="footer-section">
      <text class="footer-text">🌿 用心服务每一位用户 🌿</text>
      <text class="version">v1.0.0</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.splash-container {
  height: 100vh;
  background: linear-gradient(180deg, #F0F4F0 0%, #E8EDE8 50%, #F5F8F5 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
  opacity: 0.35;
  pointer-events: none;
  animation: float 8s ease-in-out infinite;
}

.glow-1 {
  width: 280rpx;
  height: 280rpx;
  background: linear-gradient(135deg, #B5D6B2, #9DC49A);
  top: -80rpx;
  left: -80rpx;
}

.glow-2 {
  width: 220rpx;
  height: 220rpx;
  background: linear-gradient(135deg, #C5E1C2, #A8D5A2);
  top: 180rpx;
  right: -60rpx;
  animation-delay: 3s;
}

.glow-3 {
  width: 200rpx;
  height: 200rpx;
  background: linear-gradient(135deg, #D4ECD1, #BFE0BB);
  bottom: 120rpx;
  left: -50rpx;
  animation-delay: 6s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(15rpx, -20rpx) scale(1.05); }
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
  
  .logo-icon {
    width: 160rpx;
    height: 160rpx;
    background: linear-gradient(135deg, #5B8C5A 0%, #7AA879 100%);
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 16rpx 48rpx rgba(91, 140, 90, 0.35);
    margin-bottom: 36rpx;
    animation: pulse-shadow 2s ease-in-out infinite;
    
    .logo-emoji {
      font-size: 80rpx;
    }
  }
  
  .app-name {
    font-size: 48rpx;
    font-weight: 600;
    color: #3D5A3D;
    margin-bottom: 12rpx;
    letter-spacing: 2rpx;
  }
  
  .app-slogan {
    font-size: 26rpx;
    color: #7A9A7A;
  }
}

@keyframes pulse-shadow {
  0%, 100% { box-shadow: 0 16rpx 48rpx rgba(91, 140, 90, 0.35); }
  50% { box-shadow: 0 24rpx 64rpx rgba(91, 140, 90, 0.5); }
}

.loading-section {
  margin-top: 80rpx;
  width: 320rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
  
  .loading-bar {
    width: 100%;
    height: 8rpx;
    background: rgba(91, 140, 90, 0.15);
    border-radius: 4rpx;
    overflow: hidden;
    
    .loading-progress {
      height: 100%;
      background: linear-gradient(90deg, #5B8C5A, #7AA879);
      border-radius: 4rpx;
      animation: loading 2s ease-in-out infinite;
    }
  }
  
  .loading-text {
    margin-top: 20rpx;
    font-size: 24rpx;
    color: #7A9A7A;
  }
}

@keyframes loading {
  0% { width: 0; }
  50% { width: 70%; }
  100% { width: 100%; }
}

.footer-section {
  position: absolute;
  bottom: 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .footer-text {
    font-size: 24rpx;
    color: #7A9A7A;
    margin-bottom: 8rpx;
  }
  
  .version {
    font-size: 20rpx;
    color: #A8C8A8;
  }
}
</style>
