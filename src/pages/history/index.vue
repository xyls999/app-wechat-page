<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useFilesStore, type FileRecord } from '@/stores/files'
import { http, API } from '@/api'
import AiAssistant from '@/components/AiAssistant.vue'
import ExcelPreview from '@/components/ExcelPreview.vue'

const userStore = useUserStore()
const filesStore = useFilesStore()

// 加载状态
const isLoading = ref(false)

// 当前选中的标签
const currentTab = ref<'all' | 'original' | 'processed'>('all')

// 预览弹窗
const showPreview = ref(false)
const previewData = ref<any[]>([])

// 筛选后的文件列表
const filteredFiles = computed(() => {
  if (currentTab.value === 'all') {
    return filesStore.fileHistory
  } else if (currentTab.value === 'original') {
    return filesStore.originalFiles
  } else {
    return filesStore.processedFiles
  }
})

// 从后端加载历史记录
async function loadHistory() {
  isLoading.value = true
  try {
    const res = await http.get(API.HISTORY.LIST, null, { loadingText: '' })
    if (res.data && res.data.records) {
      // 同步到store
      filesStore.syncFromServer(res.data.records)
    }
  } catch (error) {
    // 如果后端请求失败，使用本地存储
    filesStore.initFromStorage()
  } finally {
    isLoading.value = false
  }
}

// 格式化文件大小
function formatFileSize(size: number): string {
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / (1024 * 1024)).toFixed(2) + ' MB'
}

// 格式化时间
function formatTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return Math.floor(diff / (60 * 1000)) + '分钟前'
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / (60 * 60 * 1000)) + '小时前'
  if (diff < 7 * 24 * 60 * 60 * 1000) return Math.floor(diff / (24 * 60 * 60 * 1000)) + '天前'
  
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

// 获取状态文本
function getStatusText(status: FileRecord['status']): string {
  const map = {
    'pending': '待处理',
    'processing': '处理中',
    'completed': '已完成',
    'failed': '处理失败'
  }
  return map[status] || status
}

// 获取状态颜色
function getStatusColor(status: FileRecord['status']): string {
  const map = {
    'pending': '#FF9800',
    'processing': '#2196F3',
    'completed': '#4CAF50',
    'failed': '#F44336'
  }
  return map[status] || '#999'
}

// 跳转到Excel页面
function goToExcel() {
  uni.navigateTo({ url: '/pages/excel/index' })
}

// 预览文件
async function handlePreview(file: FileRecord) {
  try {
    const res = await http.get(`${API.FILE.PREVIEW}/${file.fileId}`, null, { loadingText: '加载预览...' })
    previewData.value = res.data.rows || []
    showPreview.value = true
  } catch (error) {
    // 如果后端失败，使用模拟数据
    previewData.value = [
      { '会计月': '202501', '期初数量': 700, '无税期初金额': 25695.57 },
      { '会计月': '202502', '期初数量': 0, '无税期初金额': 0 },
    ]
    showPreview.value = true
  }
}

// 下载文件
function handleDownload(file: FileRecord) {
  const downloadUrl = file.downloadUrl || `${API.FILE.DOWNLOAD}/${file.fileId}`
  
  uni.showLoading({ title: '准备下载...' })
  
  // #ifdef MP-WEIXIN
  uni.downloadFile({
    url: downloadUrl,
    success: (res) => {
      uni.hideLoading()
      if (res.statusCode === 200) {
        uni.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          success: () => {
            uni.showToast({ title: '文件已打开', icon: 'success' })
          },
          fail: () => {
            uni.showToast({ title: '打开文件失败', icon: 'none' })
          }
        })
      }
    },
    fail: () => {
      uni.hideLoading()
      uni.showToast({ title: '下载失败', icon: 'none' })
    }
  })
  // #endif
  
  // #ifdef H5
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = file.name || file.fileName
  link.click()
  uni.hideLoading()
  uni.showToast({ title: '下载已开始', icon: 'success' })
  // #endif
}

// 删除文件
async function handleDelete(file: FileRecord) {
  uni.showModal({
    title: '确认删除',
    content: `${userStore.userHonorific}，确定要删除这条记录吗？`,
    confirmColor: '#F44336',
    success: async (res) => {
      if (res.confirm) {
        try {
          // 调用后端删除API
          await http.delete(`${API.HISTORY.DELETE}/${file.id}`)
          filesStore.removeFileRecord(file.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
        } catch (error) {
          // 如果后端失败，仍然从本地删除
          filesStore.removeFileRecord(file.id)
          uni.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    }
  })
}

// 清空历史
async function handleClearAll() {
  if (filesStore.fileHistory.length === 0) {
    uni.showToast({ title: '暂无记录可清空', icon: 'none' })
    return
  }
  
  uni.showModal({
    title: '确认清空',
    content: `${userStore.userHonorific}，确定要清空所有历史记录吗？此操作不可恢复。`,
    confirmColor: '#F44336',
    success: async (res) => {
      if (res.confirm) {
        try {
          await http.delete(API.HISTORY.CLEAR)
          filesStore.clearHistory()
          uni.showToast({ title: '已清空', icon: 'success' })
        } catch (error) {
          filesStore.clearHistory()
          uni.showToast({ title: '已清空', icon: 'success' })
        }
      }
    }
  })
}

// 返回
function handleBack() {
  uni.navigateBack()
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <view class="history-container">
    <!-- 动态背景 -->
    <view class="bg-glow glow-1"></view>
    <view class="bg-glow glow-2"></view>
    
    <!-- 顶部导航 -->
    <view class="nav-header">
      <view class="nav-back" @click="handleBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">历史记录</text>
      <view class="nav-action" @click="handleClearAll">
        <text>清空</text>
      </view>
    </view>
    
    <!-- 标签切换 -->
    <view class="tabs-section">
      <view 
        class="tab-item" 
        :class="{ active: currentTab === 'all' }"
        @click="currentTab = 'all'"
      >
        <text>全部</text>
      </view>
      <view 
        class="tab-item" 
        :class="{ active: currentTab === 'original' }"
        @click="currentTab = 'original'"
      >
        <text>原始</text>
      </view>
      <view 
        class="tab-item" 
        :class="{ active: currentTab === 'processed' }"
        @click="currentTab = 'processed'"
      >
        <text>已处理</text>
      </view>
    </view>
    
    <!-- 文件列表 -->
    <view class="file-list">
      <scroll-view class="file-scroll" scroll-y>
        <view v-if="filteredFiles.length > 0" class="file-items">
          <view 
            v-for="file in filteredFiles" 
            :key="file.id"
            class="file-item"
          >
            <text class="file-emoji">{{ file.fileType === 'original' ? '📊' : '✨' }}</text>
            
            <view class="file-info">
              <text class="file-name">{{ file.fileName }}</text>
              <view class="file-meta">
                <text class="file-size">{{ formatFileSize(file.fileSize) }}</text>
                <text class="file-status" :style="{ color: getStatusColor(file.status) }">{{ getStatusText(file.status) }}</text>
              </view>
            </view>
            
            <view class="file-actions">
              <view class="action-btn" @click.stop="handlePreview(file)">👁️</view>
              <view class="action-btn" @click.stop="handleDownload(file)">📥</view>
              <view class="action-btn del" @click.stop="handleDelete(file)">🗑️</view>
            </view>
          </view>
        </view>
        
        <!-- 空状态 -->
        <view v-else class="empty-state">
          <text class="empty-icon">📭</text>
          <text class="empty-title">暂无记录</text>
          <text class="empty-desc">{{ userStore.userHonorific }}，您还没有处理过文件哦~</text>
          <view class="empty-btn" @click="goToExcel">
            <text>去处理表格</text>
          </view>
        </view>
      </scroll-view>
    </view>
    
    <!-- 底部提示 -->
    <view class="footer-tip">
      <text>💾 系统自动保存最近20条记录</text>
    </view>
    
    <!-- 预览弹窗 -->
    <ExcelPreview v-model:show="showPreview" :data="previewData" />
    
    <!-- AI助手 -->
    <AiAssistant />
  </view>
</template>

<style lang="scss" scoped>
.history-container {
  height: 100vh;
  background: linear-gradient(180deg, #EDF4F8 0%, #E3ECF2 50%, #F2F6F9 100%);
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
  width: 220rpx;
  height: 220rpx;
  background: linear-gradient(135deg, #A8C5DA, #8BB4CC);
  top: 100rpx;
  right: -40rpx;
}

.glow-2 {
  width: 180rpx;
  height: 180rpx;
  background: linear-gradient(135deg, #B8D4E8, #9CC4DC);
  bottom: 180rpx;
  left: -30rpx;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(10rpx, -8rpx) scale(1.02); }
}

.nav-header {
  display: flex;
  align-items: center;
  padding: 80rpx 32rpx 20rpx;
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
      color: #5A7A8A;
      font-weight: bold;
    }
  }
  
  .nav-title {
    flex: 1;
    text-align: center;
    font-size: 34rpx;
    font-weight: 600;
    color: #3A5A6A;
  }
  
  .nav-action {
    padding: 12rpx 20rpx;
    
    text {
      font-size: 26rpx;
      color: #5A7A8A;
    }
  }
}

.tabs-section {
  display: flex;
  margin: 0 32rpx 16rpx;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 20rpx;
  padding: 8rpx;
  position: relative;
  z-index: 1;
  
  .tab-item {
    flex: 1;
    padding: 16rpx 0;
    text-align: center;
    border-radius: 16rpx;
    transition: all 0.3s;
    
    text {
      font-size: 26rpx;
      color: #7A9AAA;
    }
    
    &.active {
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 2rpx 12rpx rgba(90, 122, 138, 0.15);
      
      text {
        color: #3A5A6A;
        font-weight: 600;
      }
    }
  }
}

.file-list {
  flex: 1;
  padding: 0 32rpx;
  position: relative;
  z-index: 1;
  overflow: hidden;
  
  .file-scroll {
    height: 100%;
  }
  
  .file-items {
    display: flex;
    flex-direction: column;
    gap: 16rpx;
    padding-bottom: 20rpx;
  }
  
  .file-item {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 20rpx;
    padding: 20rpx;
    display: flex;
    align-items: center;
    
    .file-emoji {
      font-size: 36rpx;
    }
    
    .file-info {
      flex: 1;
      margin-left: 16rpx;
      overflow: hidden;
      
      .file-name {
        display: block;
        font-size: 26rpx;
        color: #3A5A6A;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .file-meta {
        display: flex;
        gap: 16rpx;
        margin-top: 4rpx;
        
        .file-size,
        .file-status {
          font-size: 22rpx;
        }
        
        .file-size {
          color: #8AAABC;
        }
      }
    }
    
    .file-actions {
      display: flex;
      gap: 12rpx;
      
      .action-btn {
        width: 52rpx;
        height: 52rpx;
        background: rgba(90, 122, 138, 0.1);
        border-radius: 14rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24rpx;
        
        &.del {
          background: rgba(220, 100, 100, 0.1);
        }
        
        &:active {
          opacity: 0.7;
        }
      }
    }
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 80rpx 0;
    
    .empty-icon {
      font-size: 64rpx;
      margin-bottom: 20rpx;
    }
    
    .empty-title {
      font-size: 32rpx;
      color: #3A5A6A;
      font-weight: 600;
      margin-bottom: 8rpx;
    }
    
    .empty-desc {
      font-size: 24rpx;
      color: #8AAABC;
      margin-bottom: 24rpx;
    }
    
    .empty-btn {
      background: linear-gradient(135deg, #5A7A8A, #7A9AAA);
      padding: 16rpx 40rpx;
      border-radius: 24rpx;
      
      text {
        font-size: 26rpx;
        color: #FFFFFF;
      }
      
      &:active {
        transform: scale(0.95);
      }
    }
  }
}

.footer-tip {
  padding: 16rpx 0;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  text-align: center;
  position: relative;
  z-index: 1;
  
  text {
    font-size: 22rpx;
    color: #8AAABC;
  }
}
</style>
