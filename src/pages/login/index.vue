<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { http, API } from '@/api'

const userStore = useUserStore()

// 表单模式
const isLoginMode = ref(true)

// 表单数据
const formData = ref({
  username: '',
  password: '',
  confirmPassword: '',
  nickname: ''
})

// 加载状态
const loading = ref(false)

// 切换模式
function toggleMode() {
  isLoginMode.value = !isLoginMode.value
  // 清空表单
  formData.value = {
    username: '',
    password: '',
    confirmPassword: '',
    nickname: ''
  }
}

// 表单验证
function validateForm(): boolean {
  if (!formData.value.username.trim()) {
    uni.showToast({ title: '请输入用户名', icon: 'none' })
    return false
  }
  if (formData.value.username.length < 3) {
    uni.showToast({ title: '用户名至少3个字符', icon: 'none' })
    return false
  }
  if (!formData.value.password) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return false
  }
  if (formData.value.password.length < 6) {
    uni.showToast({ title: '密码至少6位', icon: 'none' })
    return false
  }
  
  if (!isLoginMode.value) {
    if (formData.value.password !== formData.value.confirmPassword) {
      uni.showToast({ title: '两次密码不一致', icon: 'none' })
      return false
    }
    if (!formData.value.nickname.trim()) {
      uni.showToast({ title: '请输入您的称呼', icon: 'none' })
      return false
    }
  }
  
  return true
}

// 提交表单
async function handleSubmit() {
  if (!validateForm()) return
  
  loading.value = true
  
  try {
    if (isLoginMode.value) {
      // 登录 - 调用后端接口
      const res = await http.post(API.AUTH.LOGIN, {
        username: formData.value.username,
        password: formData.value.password,
      }, { showLoading: false })
      
      // 后端返回: { code, message, data: { id, username, nickname, token, ... } }
      const userData = res.data
      const token = userData.token
      const user = {
        id: userData.id,
        username: userData.username,
        nickname: userData.nickname,
        avatar: userData.avatar
      }
      userStore.login(user, token)
      
      const firstName = user.nickname?.charAt(0) || user.username.charAt(0)
      uni.showToast({ 
        title: `${firstName}总，欢迎回来！`, 
        icon: 'success',
        duration: 2000
      })
      
      // 跳转到主页
      setTimeout(() => {
        uni.redirectTo({ url: '/pages/home/index' })
      }, 1500)
      
    } else {
      // 注册 - 调用后端接口
      const res = await http.post(API.AUTH.REGISTER, {
        username: formData.value.username,
        password: formData.value.password,
        nickname: formData.value.nickname,
      }, { showLoading: false })
      
      // 后端返回: { code, message, data: { id, username, nickname, token, ... } }
      const userData = res.data
      const token = userData.token
      const user = {
        id: userData.id,
        username: userData.username,
        nickname: userData.nickname,
        avatar: userData.avatar
      }
      
      const firstName = formData.value.nickname.charAt(0)
      uni.showToast({ 
        title: `${firstName}总，注册成功！`, 
        icon: 'success' 
      })
      
      // 自动登录
      userStore.login(user, token)
      
      setTimeout(() => {
        uni.redirectTo({ url: '/pages/home/index' })
      }, 1500)
    }
    
  } catch (error: any) {
    uni.showToast({ 
      title: error.message || '操作失败，请稍后重试', 
      icon: 'none' 
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="login-container">
    <!-- 动态背景光晕 -->
    <view class="bg-glow glow-1"></view>
    <view class="bg-glow glow-2"></view>
    <view class="bg-glow glow-3"></view>
    
    <!-- Logo区域 -->
    <view class="logo-section">
      <view class="logo-icon">
        <text class="logo-text">📊</text>
      </view>
      <text class="app-title">智慧表格助手</text>
    </view>
    
    <!-- 表单区域 -->
    <view class="form-section">
      <text class="form-title">{{ isLoginMode ? '欢迎回来' : '创建账号' }}</text>
      
      <view class="input-group">
        <view class="input-wrapper">
          <text class="input-icon">👤</text>
          <input 
            v-model="formData.username"
            class="input-field"
            placeholder="请输入用户名"
            :maxlength="20"
          />
        </view>
      </view>
      
      <view v-if="!isLoginMode" class="input-group">
        <view class="input-wrapper">
          <text class="input-icon">📛</text>
          <input 
            v-model="formData.nickname"
            class="input-field"
            placeholder="您的称呼（如：张三）"
            :maxlength="10"
          />
        </view>
        <text class="input-hint">我们将称呼您为"X总"</text>
      </view>
      
      <view class="input-group">
        <view class="input-wrapper">
          <text class="input-icon">🔒</text>
          <input 
            v-model="formData.password"
            class="input-field"
            password
            placeholder="请输入密码"
            :maxlength="20"
          />
        </view>
      </view>
      
      <view v-if="!isLoginMode" class="input-group">
        <view class="input-wrapper">
          <text class="input-icon">🔐</text>
          <input 
            v-model="formData.confirmPassword"
            class="input-field"
            password
            placeholder="请再次输入密码"
            :maxlength="20"
          />
        </view>
      </view>
      
      <!-- 提交按钮 -->
      <view class="submit-btn" :class="{ loading: loading }" @click="handleSubmit">
        <text v-if="!loading">{{ isLoginMode ? '登 录' : '注 册' }}</text>
        <view v-else class="btn-spinner"></view>
      </view>
      
      <!-- 切换模式 -->
      <view class="switch-mode" @click="toggleMode">
        <text v-if="isLoginMode">还没有账号？<text class="link">立即注册</text></text>
        <text v-else>已有账号？<text class="link">立即登录</text></text>
      </view>
    </view>
    
    <!-- 底部提示 -->
    <view class="footer-tip">
      <text>🌿 用心服务，让您省心 🌿</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-container {
  height: 100vh;
  background: linear-gradient(180deg, #F0F4F0 0%, #E8EDE8 50%, #F5F8F5 100%);
  padding: 0 40rpx;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

// 动态护眼光晕
.bg-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(80rpx);
  opacity: 0.35;
  pointer-events: none;
  animation: float 10s ease-in-out infinite;
}

.glow-1 {
  width: 280rpx;
  height: 280rpx;
  background: linear-gradient(135deg, #B5D6B2, #9DC49A);
  top: -80rpx;
  left: -60rpx;
}

.glow-2 {
  width: 200rpx;
  height: 200rpx;
  background: linear-gradient(135deg, #C5E1C2, #A8D5A2);
  top: 300rpx;
  right: -40rpx;
  animation-delay: 3s;
}

.glow-3 {
  width: 180rpx;
  height: 180rpx;
  background: linear-gradient(135deg, #D4ECD1, #BFE0BB);
  bottom: 150rpx;
  left: -30rpx;
  animation-delay: 6s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(15rpx, -15rpx) scale(1.03); }
  66% { transform: translate(-10rpx, 10rpx) scale(0.97); }
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 100rpx;
  margin-bottom: 40rpx;
  position: relative;
  z-index: 1;
  
  .logo-icon {
    width: 120rpx;
    height: 120rpx;
    background: linear-gradient(135deg, #5B8C5A 0%, #7AA879 100%);
    border-radius: 32rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 32rpx rgba(91, 140, 90, 0.3);
    margin-bottom: 20rpx;
    
    .logo-text {
      font-size: 56rpx;
    }
  }
  
  .app-title {
    font-size: 40rpx;
    font-weight: 600;
    color: #3D5A3D;
    letter-spacing: 2rpx;
  }
}

.form-section {
  flex: 1;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20rpx);
  border-radius: 40rpx 40rpx 0 0;
  padding: 48rpx 40rpx;
  box-shadow: 0 -8rpx 40rpx rgba(91, 140, 90, 0.08);
  position: relative;
  z-index: 1;
  
  .form-title {
    display: block;
    font-size: 36rpx;
    font-weight: 600;
    color: #3D5A3D;
    text-align: center;
    margin-bottom: 40rpx;
  }
}

.input-group {
  margin-bottom: 28rpx;
  
  .input-wrapper {
    display: flex;
    align-items: center;
    background: rgba(245, 248, 245, 0.8);
    border-radius: 24rpx;
    padding: 0 28rpx;
    height: 96rpx;
    border: 2rpx solid rgba(91, 140, 90, 0.15);
    transition: all 0.3s;
    
    &:focus-within {
      border-color: rgba(91, 140, 90, 0.4);
      background: #FFFFFF;
      box-shadow: 0 4rpx 16rpx rgba(91, 140, 90, 0.1);
    }
    
    .input-icon {
      font-size: 32rpx;
      margin-right: 16rpx;
    }
    
    .input-field {
      flex: 1;
      font-size: 30rpx;
      color: #3D5A3D;
    }
  }
  
  .input-hint {
    font-size: 22rpx;
    color: #7A9A7A;
    margin-top: 8rpx;
    padding-left: 16rpx;
  }
}

.submit-btn {
  margin-top: 36rpx;
  height: 96rpx;
  background: linear-gradient(135deg, #5B8C5A 0%, #7AA879 100%);
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(91, 140, 90, 0.25);
  transition: all 0.3s;
  
  text {
    font-size: 32rpx;
    font-weight: 600;
    color: #FFFFFF;
    letter-spacing: 8rpx;
  }
  
  &:active {
    transform: scale(0.98);
    box-shadow: 0 4rpx 12rpx rgba(91, 140, 90, 0.2);
  }
  
  &.loading {
    opacity: 0.8;
  }
  
  .btn-spinner {
    width: 36rpx;
    height: 36rpx;
    border: 4rpx solid rgba(255, 255, 255, 0.3);
    border-top-color: #FFFFFF;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.switch-mode {
  text-align: center;
  margin-top: 32rpx;
  font-size: 26rpx;
  color: #6B8A6B;
  
  .link {
    color: #5B8C5A;
    font-weight: 600;
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
    color: #7A9A7A;
    letter-spacing: 2rpx;
  }
}
</style>
