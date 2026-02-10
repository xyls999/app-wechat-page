<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import AiAssistant from '@/components/AiAssistant.vue'

const userStore = useUserStore()

const upcomingFeatures = ref([
  { icon: '📊', title: '收支明细' },
  { icon: '📈', title: '数据分析' },
  { icon: '🧾', title: '发票管理' },
  { icon: '📅', title: '月度报表' }
])

function handleBack() {
  uni.navigateBack()
}

function handleFeatureClick() {
  uni.showToast({
    title: `${userStore.userHonorific}，该功能正在开发中~`,
    icon: 'none',
    duration: 2000
  })
}
</script>

<template>
  <view class="accounting-container">
    <!-- 动态背景 -->
    <view class="bg-glow glow-1"></view>
    <view class="bg-glow glow-2"></view>
    
    <!-- 顶部导航 -->
    <view class="nav-header">
      <view class="nav-back" @click="handleBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">账目核算</text>
      <view class="nav-placeholder"></view>
    </view>
    
    <!-- 主内容 -->
    <view class="main-content">
      <!-- 开发中提示 -->
      <view class="coming-card">
        <view class="coming-icon">🚧</view>
        <text class="coming-title">功能开发中</text>
        <text class="coming-subtitle">{{ userStore.userHonorific }}，此功能正在努力开发中</text>
      </view>
      
      <!-- 即将上线功能 -->
      <view class="features-section">
        <text class="section-title">✨ 即将推出</text>
        <view class="features-grid">
          <view 
            v-for="feature in upcomingFeatures" 
            :key="feature.title"
            class="feature-card"
            @click="handleFeatureClick"
          >
            <text class="feature-icon">{{ feature.icon }}</text>
            <text class="feature-title">{{ feature.title }}</text>
          </view>
        </view>
      </view>
      
      <!-- 订阅通知 -->
      <view class="subscribe-card">
        <text class="subscribe-icon">🔔</text>
        <view class="subscribe-info">
          <text class="subscribe-title">上线时通知我</text>
          <text class="subscribe-desc">功能上线第一时间通知您</text>
        </view>
        <view class="subscribe-btn">
          <text>订阅</text>
        </view>
      </view>
    </view>
    
    <!-- 底部提示 -->
    <view class="footer-tip">
      <text>💪 {{ userStore.userHonorific }}，感谢您的耐心等待！</text>
    </view>
    
    <!-- AI助手 -->
    <AiAssistant />
  </view>
</template>

<style lang="scss" scoped>
.accounting-container {
  height: 100vh;
  background: linear-gradient(180deg, #F5F2E8 0%, #EDE8DC 50%, #F8F5ED 100%);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
  opacity: 0.3;
  pointer-events: none;
  animation: float 10s ease-in-out infinite;
}

.glow-1 {
  width: 240rpx;
  height: 240rpx;
  background: linear-gradient(135deg, #D4C4A8, #C4B496);
  top: 80rpx;
  right: -50rpx;
}

.glow-2 {
  width: 200rpx;
  height: 200rpx;
  background: linear-gradient(135deg, #E8DCC8, #D8CCBA);
  bottom: 200rpx;
  left: -40rpx;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(12rpx, -8rpx) scale(1.02); }
}

.nav-header {
  display: flex;
  align-items: center;
  padding: 80rpx 32rpx 24rpx;
  position: relative;
  z-index: 1;
  
  .nav-back {
    width: 64rpx;
    height: 64rpx;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .back-icon {
      font-size: 40rpx;
      color: #8B7355;
      font-weight: bold;
    }
  }
  
  .nav-title {
    flex: 1;
    text-align: center;
    font-size: 34rpx;
    font-weight: 600;
    color: #5D4E37;
  }
  
  .nav-placeholder {
    width: 64rpx;
  }
}

.main-content {
  flex: 1;
  padding: 0 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  position: relative;
  z-index: 1;
}

.coming-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20rpx);
  border-radius: 32rpx;
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .coming-icon {
    font-size: 64rpx;
    margin-bottom: 16rpx;
  }
  
  .coming-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #8B7355;
    margin-bottom: 8rpx;
  }
  
  .coming-subtitle {
    font-size: 26rpx;
    color: #A89880;
  }
}

.features-section {
  .section-title {
    display: block;
    font-size: 28rpx;
    font-weight: 600;
    color: #5D4E37;
    margin-bottom: 16rpx;
    padding-left: 8rpx;
  }
  
  .features-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16rpx;
    
    .feature-card {
      background: rgba(255, 255, 255, 0.85);
      border-radius: 20rpx;
      padding: 24rpx 16rpx;
      display: flex;
      flex-direction: column;
      align-items: center;
      
      .feature-icon {
        font-size: 36rpx;
        margin-bottom: 8rpx;
      }
      
      .feature-title {
        font-size: 22rpx;
        color: #5D4E37;
        font-weight: 500;
      }
      
      &:active {
        transform: scale(0.95);
      }
    }
  }
}

.subscribe-card {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  
  .subscribe-icon {
    font-size: 40rpx;
  }
  
  .subscribe-info {
    flex: 1;
    margin-left: 20rpx;
    
    .subscribe-title {
      display: block;
      font-size: 28rpx;
      font-weight: 600;
      color: #5D4E37;
    }
    
    .subscribe-desc {
      font-size: 22rpx;
      color: #A89880;
    }
  }
  
  .subscribe-btn {
    background: linear-gradient(135deg, #8B7355, #A89880);
    padding: 14rpx 28rpx;
    border-radius: 20rpx;
    
    text {
      font-size: 24rpx;
      color: #FFFFFF;
      font-weight: 500;
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
}

.footer-tip {
  padding: 24rpx 0;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  text-align: center;
  position: relative;
  z-index: 1;
  
  text {
    font-size: 24rpx;
    color: #A89880;
  }
}
</style>
