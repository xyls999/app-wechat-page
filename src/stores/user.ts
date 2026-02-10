import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface UserInfo {
  id: string
  username: string
  nickname: string
  avatar?: string
  createdAt: string
}

export const useUserStore = defineStore('user', () => {
  const userInfo = ref<UserInfo | null>(null)
  const token = ref<string>('')
  
  // 获取用户姓氏（敬语用）
  const userHonorific = computed(() => {
    if (!userInfo.value?.nickname) return '尊敬的用户'
    const firstName = userInfo.value.nickname.charAt(0)
    return `${firstName}总`
  })
  
  // 是否已登录
  const isLoggedIn = computed(() => !!token.value && !!userInfo.value)
  
  // 登录
  function login(user: UserInfo, authToken: string) {
    userInfo.value = user
    token.value = authToken
    // 持久化存储
    uni.setStorageSync('userInfo', user)
    uni.setStorageSync('token', authToken)
  }
  
  // 登出
  function logout() {
    userInfo.value = null
    token.value = ''
    uni.removeStorageSync('userInfo')
    uni.removeStorageSync('token')
  }
  
  // 初始化（从本地存储恢复）
  function initFromStorage() {
    const storedUser = uni.getStorageSync('userInfo')
    const storedToken = uni.getStorageSync('token')
    if (storedUser && storedToken) {
      userInfo.value = storedUser
      token.value = storedToken
    }
  }
  
  // 更新用户信息
  function updateUserInfo(info: Partial<UserInfo>) {
    if (userInfo.value) {
      userInfo.value = { ...userInfo.value, ...info }
      uni.setStorageSync('userInfo', userInfo.value)
    }
  }
  
  return {
    userInfo,
    token,
    userHonorific,
    isLoggedIn,
    login,
    logout,
    initFromStorage,
    updateUserInfo
  }
})
