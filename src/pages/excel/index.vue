<script setup lang="ts">
import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useFilesStore } from '@/stores/files'
import { http, API } from '@/api'
import { processExcelFile, downloadBlob } from '@/services/excelProcessor'
import AiAssistant from '@/components/AiAssistant.vue'
import ExcelPreview from '@/components/ExcelPreview.vue'

const userStore = useUserStore()
const filesStore = useFilesStore()

// 页面状态
const currentStep = ref<'upload' | 'processing' | 'complete'>('upload')
const isUploading = ref(false)
const isProcessing = ref(false)

// 后端超时时间（毫秒）- 超过此时间使用前端处理
const BACKEND_TIMEOUT = 15000

// 当前文件信息
const currentFile = ref<{
  name: string
  size: number
  path: string
  fileId?: string
  _file?: File // H5环境保存原始File对象
} | null>(null)

// 处理后的文件
const processedFile = ref<{
  name: string
  path: string
  fileId?: string
  downloadUrl?: string
  blob?: Blob // 前端处理时保存Blob
  previewData?: any[] // 预览数据
} | null>(null)

// 预览弹窗
const showPreview = ref(false)
const previewData = ref<any[]>([])

// 处理进度
const processProgress = ref(0)

// 处理方式标记
const processedByFrontend = ref(false)

// 励志话语列表
const encouragements = [
  '您的表格正在处理中，请稍候~',
  '数据正在汇总，马上就好~',
  '智能分析进行中...',
  '正在为您整理数据...',
  '即将完成，请耐心等待~'
]
const currentEncouragement = ref(encouragements[0])

// 格式化文件大小
function formatFileSize(size: number): string {
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  return (size / (1024 * 1024)).toFixed(2) + ' MB'
}

// 选择文件
async function handleChooseFile() {
  try {
    // 微信小程序选择文件
    // #ifdef MP-WEIXIN
    uni.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: (res) => {
        const file = res.tempFiles[0]
        if (file) {
          currentFile.value = {
            name: file.name,
            size: file.size,
            path: file.path
          }
          
          uni.showToast({
            title: '文件已选择',
            icon: 'success'
          })
        }
      },
      fail: () => {
        uni.showToast({
          title: '选择文件失败',
          icon: 'none'
        })
      }
    })
    // #endif
    
    // H5环境模拟选择
    // #ifdef H5
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls'
    input.onchange = (e: any) => {
      const file = e.target.files[0]
      if (file) {
        currentFile.value = {
          name: file.name,
          size: file.size,
          path: URL.createObjectURL(file),
          _file: file // 保存原始File对象用于前端处理
        }
        uni.showToast({
          title: '文件已选择',
          icon: 'success'
        })
      }
    }
    input.click()
    // #endif
    
  } catch (error) {
    uni.showToast({
      title: '选择文件失败，请重试',
      icon: 'none'
    })
  }
}

// 开始处理
async function handleStartProcess() {
  if (!currentFile.value) {
    uni.showToast({
      title: '请先选择文件',
      icon: 'none'
    })
    return
  }
  
  currentStep.value = 'processing'
  isProcessing.value = true
  processProgress.value = 0
  processedByFrontend.value = false
  
  // 添加到文件记录
  const recordId = 'file_' + Date.now()
  filesStore.addFileRecord({
    id: recordId,
    fileName: currentFile.value.name,
    fileType: 'original',
    filePath: currentFile.value.path,
    fileSize: currentFile.value.size,
    uploadTime: new Date().toISOString(),
    status: 'processing'
  })
  
  // 模拟处理进度
  const progressInterval = setInterval(() => {
    if (processProgress.value < 90) {
      processProgress.value += Math.random() * 10
      currentEncouragement.value = encouragements[Math.floor(Math.random() * encouragements.length)]
    }
  }, 500)
  
  try {
    // 尝试使用后端处理（带超时）
    const backendResult = await tryBackendProcess()
    
    if (backendResult.success) {
      // 后端处理成功
      clearInterval(progressInterval)
      processProgress.value = 100
      
      filesStore.updateFileStatus(recordId, 'completed', new Date().toISOString())
      
      const { processedFileId, fileName, downloadUrl } = backendResult.data
      processedFile.value = {
        name: fileName || currentFile.value!.name.replace('.xlsx', '_汇总.xlsx'),
        path: downloadUrl,
        fileId: processedFileId,
        downloadUrl
      }
      
      filesStore.addFileRecord({
        id: processedFileId || 'file_' + Date.now() + '_processed',
        fileName: processedFile.value.name,
        fileType: 'processed',
        filePath: downloadUrl,
        fileSize: currentFile.value!.size,
        uploadTime: new Date().toISOString(),
        processTime: new Date().toISOString(),
        status: 'completed'
      })
      
    } else {
      // 后端超时或失败，使用前端处理
      console.log('后端处理超时，切换到前端处理...')
      currentEncouragement.value = '正在本地处理您的表格...'
      
      await handleFrontendProcess(recordId)
    }
    
    clearInterval(progressInterval)
    processProgress.value = 100
    currentStep.value = 'complete'
    
    uni.showToast({
      title: `${userStore.userHonorific}，您的表格已处理好啦！`,
      icon: 'success',
      duration: 2500
    })
    
  } catch (error: any) {
    clearInterval(progressInterval)
    filesStore.updateFileStatus(recordId, 'failed')
    
    uni.showToast({
      title: error.message || '处理失败，请重试',
      icon: 'none'
    })
    
    currentStep.value = 'upload'
  } finally {
    isProcessing.value = false
  }
}

// 尝试后端处理（带超时）
async function tryBackendProcess(): Promise<{ success: boolean; data?: any }> {
  return new Promise(async (resolve) => {
    // 设置超时
    const timeoutId = setTimeout(() => {
      resolve({ success: false })
    }, BACKEND_TIMEOUT)
    
    try {
      // 1. 上传文件到后端
      const uploadRes = await http.upload(API.FILE.UPLOAD, currentFile.value!.path, {
        showLoading: false,
        loadingText: '上传中...'
      })
      
      const fileId = uploadRes.data.fileId
      currentFile.value!.fileId = fileId
      processProgress.value = 40
      
      // 2. 调用处理接口
      const processRes = await http.post(API.FILE.PROCESS, { fileId }, { showLoading: false })
      
      clearTimeout(timeoutId)
      resolve({ success: true, data: processRes.data })
      
    } catch (error) {
      clearTimeout(timeoutId)
      resolve({ success: false })
    }
  })
}

// 前端处理Excel
async function handleFrontendProcess(recordId: string) {
  processedByFrontend.value = true
  
  // 获取File对象
  let file: File | null = null
  
  // #ifdef H5
  file = currentFile.value?._file || null
  // #endif
  
  // #ifdef MP-WEIXIN
  // 微信小程序需要从临时路径读取
  // 这里需要特殊处理，暂时使用模拟数据
  // #endif
  
  if (!file) {
    throw new Error('无法获取文件，请重试')
  }
  
  // 使用前端Excel处理服务
  const result = await processExcelFile(file, currentFile.value!.name.replace('.xlsx', '_会计月汇总.xlsx'))
  
  if (!result.success) {
    throw new Error(result.message)
  }
  
  // 更新状态
  filesStore.updateFileStatus(recordId, 'completed', new Date().toISOString())
  
  // 设置处理后的文件信息
  processedFile.value = {
    name: result.fileName!,
    path: '',
    blob: result.blob,
    previewData: result.data
  }
  
  // 添加处理后的文件记录
  filesStore.addFileRecord({
    id: 'file_' + Date.now() + '_processed',
    fileName: processedFile.value.name,
    fileType: 'processed',
    filePath: 'local',
    fileSize: result.blob!.size,
    uploadTime: new Date().toISOString(),
    processTime: new Date().toISOString(),
    status: 'completed'
  })
}

// 预览表格
async function handlePreview(type: 'original' | 'processed') {
  try {
    if (type === 'processed' && processedByFrontend.value && processedFile.value?.previewData) {
      // 前端处理的结果，直接使用预览数据
      const data = processedFile.value.previewData
      // 将二维数组转换为对象数组
      const headers = data[0] as string[]
      previewData.value = data.slice(1).map((row: any[]) => {
        const obj: any = {}
        headers.forEach((h, i) => {
          obj[h] = row[i]
        })
        return obj
      })
      showPreview.value = true
      return
    }
    
    const fileId = type === 'original' ? currentFile.value?.fileId : processedFile.value?.fileId
    
    if (fileId) {
      // 从后端获取预览数据
      const res = await http.get(`${API.FILE.PREVIEW}/${fileId}`, null, { loadingText: '加载预览...' })
      previewData.value = res.data.rows || []
    } else {
      // 本地模拟预览数据
      previewData.value = [
        { '会计月': '202501', '期初数量': 700, '无税期初金额': 25695.57, '期初金额': 29036, '入库数量': 500 },
        { '会计月': '202502', '期初数量': 0, '无税期初金额': 0, '期初金额': 0, '入库数量': 0 },
      ]
    }
    showPreview.value = true
  } catch (error) {
    uni.showToast({ title: '加载预览失败', icon: 'none' })
  }
}

// 下载文件
async function handleDownload() {
  if (!processedFile.value) return
  
  uni.showLoading({ title: '正在准备下载...' })
  
  try {
    // 前端处理的结果，直接下载Blob
    if (processedByFrontend.value && processedFile.value.blob) {
      uni.hideLoading()
      downloadBlob(processedFile.value.blob, processedFile.value.name)
      uni.showToast({ title: '下载已开始', icon: 'success' })
      return
    }
    
    // 后端处理的结果，从服务器下载
    const downloadUrl = processedFile.value.downloadUrl || `${API.FILE.DOWNLOAD}/${processedFile.value.fileId}`
    
    // #ifdef MP-WEIXIN
    // 微信小程序下载文件
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
    // H5直接下载
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = processedFile.value.name
    link.click()
    uni.hideLoading()
    uni.showToast({ title: '下载已开始', icon: 'success' })
    // #endif
    
  } catch (error) {
    uni.hideLoading()
    uni.showToast({ title: '下载失败', icon: 'none' })
  }
}

// 重新处理
function handleReset() {
  currentStep.value = 'upload'
  currentFile.value = null
  processedFile.value = null
  processProgress.value = 0
}

// 返回
function handleBack() {
  uni.navigateBack()
}
</script>

<template>
  <view class="excel-container">
    <!-- 动态背景 -->
    <view class="bg-glow glow-1"></view>
    <view class="bg-glow glow-2"></view>
    
    <!-- 顶部导航 -->
    <view class="nav-header">
      <view class="nav-back" @click="handleBack">
        <text class="back-icon">‹</text>
      </view>
      <text class="nav-title">表格处理</text>
      <view class="nav-placeholder"></view>
    </view>
    
    <!-- 步骤指示器 -->
    <view class="steps-indicator">
      <view class="step" :class="{ active: currentStep === 'upload', completed: currentStep !== 'upload' }">
        <view class="step-dot"></view>
        <text class="step-text">选择</text>
      </view>
      <view class="step-line" :class="{ active: currentStep !== 'upload' }"></view>
      <view class="step" :class="{ active: currentStep === 'processing', completed: currentStep === 'complete' }">
        <view class="step-dot"></view>
        <text class="step-text">处理</text>
      </view>
      <view class="step-line" :class="{ active: currentStep === 'complete' }"></view>
      <view class="step" :class="{ active: currentStep === 'complete' }">
        <view class="step-dot"></view>
        <text class="step-text">完成</text>
      </view>
    </view>
    
    <!-- 主内容区 -->
    <view class="main-content">
      <!-- 上传区域 -->
      <view v-if="currentStep === 'upload'" class="upload-section">
        <view class="upload-card" @click="handleChooseFile">
          <text class="upload-icon">📤</text>
          <text class="upload-title">点击选择文件</text>
          <text class="upload-hint">支持 .xlsx 格式</text>
        </view>
        
        <view v-if="currentFile" class="file-card">
          <text class="file-emoji">📄</text>
          <view class="file-info">
            <text class="file-name">{{ currentFile.name }}</text>
            <text class="file-size">{{ formatFileSize(currentFile.size) }}</text>
          </view>
          <view class="preview-btn" @click.stop="handlePreview('original')">预览</view>
        </view>
        
        <view class="tips-card">
          <text class="tips-title">📋 功能说明</text>
          <text class="tips-text">上传Excel → 按会计月汇总 → 预览下载</text>
        </view>
        
        <view class="submit-btn" :class="{ disabled: !currentFile }" @click="handleStartProcess">
          <text>开始处理</text>
        </view>
      </view>
      
      <!-- 处理中区域 -->
      <view v-if="currentStep === 'processing'" class="processing-section">
        <view class="process-icon">
          <text class="spin-emoji">⚙️</text>
          <view class="process-ring"></view>
        </view>
        
        <text class="process-title">{{ userStore.userHonorific }}，请稍候...</text>
        <text class="process-hint">{{ currentEncouragement }}</text>
        
        <view class="progress-wrap">
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: processProgress + '%' }"></view>
          </view>
          <text class="progress-num">{{ Math.round(processProgress) }}%</text>
        </view>
        
        <text class="process-tip">🌿 耐心等待，马上完成 🌿</text>
      </view>
      
      <!-- 完成区域 -->
      <view v-if="currentStep === 'complete'" class="complete-section">
        <view class="success-badge">
          <text>🎉</text>
        </view>
        <text class="success-title">处理完成！</text>
        <text class="success-subtitle">{{ userStore.userHonorific }}，您的表格已处理好</text>
        
        <view class="result-card" v-if="processedFile">
          <text class="result-emoji">✨</text>
          <view class="result-info">
            <text class="result-name">{{ processedFile.name }}</text>
            <text class="result-hint">按会计月汇总完成</text>
          </view>
        </view>
        
        <view class="action-row">
          <view class="action-btn outline" @click="handlePreview('processed')">预览</view>
          <view class="action-btn primary" @click="handleDownload">下载</view>
        </view>
        
        <view class="reset-link" @click="handleReset">
          <text>处理新文件</text>
        </view>
      </view>
    </view>
    
    <!-- 预览弹窗 -->
    <ExcelPreview v-model:show="showPreview" :data="previewData" />
    
    <!-- AI助手 -->
    <AiAssistant />
  </view>
</template>

<style lang="scss" scoped>
.excel-container {
  height: 100vh;
  background: linear-gradient(180deg, #F0F4F0 0%, #E8EDE8 50%, #F5F8F5 100%);
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
  width: 250rpx;
  height: 250rpx;
  background: linear-gradient(135deg, #B5D6B2, #9DC49A);
  top: 100rpx;
  right: -60rpx;
}

.glow-2 {
  width: 200rpx;
  height: 200rpx;
  background: linear-gradient(135deg, #C5E1C2, #A8D5A2);
  bottom: 200rpx;
  left: -50rpx;
  animation-delay: 4s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(15rpx, -10rpx) scale(1.03); }
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
      color: #5B8C5A;
      font-weight: bold;
    }
  }
  
  .nav-title {
    flex: 1;
    text-align: center;
    font-size: 34rpx;
    font-weight: 600;
    color: #3D5A3D;
  }
  
  .nav-placeholder {
    width: 64rpx;
  }
}

.steps-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx 60rpx;
  position: relative;
  z-index: 1;
  
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    
    .step-dot {
      width: 24rpx;
      height: 24rpx;
      border-radius: 50%;
      background: rgba(91, 140, 90, 0.3);
      transition: all 0.3s;
    }
    
    .step-text {
      font-size: 22rpx;
      color: #7A9A7A;
      margin-top: 8rpx;
    }
    
    &.active, &.completed {
      .step-dot {
        background: #5B8C5A;
        box-shadow: 0 0 12rpx rgba(91, 140, 90, 0.5);
      }
      .step-text {
        color: #5B8C5A;
        font-weight: 600;
      }
    }
  }
  
  .step-line {
    width: 80rpx;
    height: 4rpx;
    background: rgba(91, 140, 90, 0.2);
    margin: 0 16rpx;
    margin-bottom: 28rpx;
    transition: all 0.3s;
    
    &.active {
      background: #5B8C5A;
    }
  }
}

.main-content {
  flex: 1;
  padding: 0 32rpx;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  
  .upload-card {
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20rpx);
    border-radius: 28rpx;
    padding: 48rpx 32rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 3rpx dashed rgba(91, 140, 90, 0.4);
    
    .upload-icon {
      font-size: 56rpx;
      margin-bottom: 16rpx;
    }
    
    .upload-title {
      font-size: 30rpx;
      font-weight: 600;
      color: #3D5A3D;
    }
    
    .upload-hint {
      font-size: 24rpx;
      color: #7A9A7A;
      margin-top: 8rpx;
    }
  }
  
  .file-card {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 24rpx;
    padding: 24rpx;
    display: flex;
    align-items: center;
    
    .file-emoji {
      font-size: 40rpx;
    }
    
    .file-info {
      flex: 1;
      margin-left: 20rpx;
      display: flex;
      flex-direction: column;
      
      .file-name {
        font-size: 26rpx;
        color: #3D5A3D;
        font-weight: 500;
      }
      
      .file-size {
        font-size: 22rpx;
        color: #7A9A7A;
        margin-top: 4rpx;
      }
    }
    
    .preview-btn {
      background: rgba(91, 140, 90, 0.15);
      padding: 12rpx 24rpx;
      border-radius: 20rpx;
      font-size: 24rpx;
      color: #5B8C5A;
    }
  }
  
  .tips-card {
    background: rgba(255, 255, 255, 0.8);
    border-radius: 20rpx;
    padding: 24rpx;
    
    .tips-title {
      font-size: 26rpx;
      font-weight: 600;
      color: #3D5A3D;
      display: block;
      margin-bottom: 8rpx;
    }
    
    .tips-text {
      font-size: 24rpx;
      color: #6B8A6B;
    }
  }
  
  .submit-btn {
    margin-top: 20rpx;
    height: 88rpx;
    background: linear-gradient(135deg, #5B8C5A 0%, #7AA879 100%);
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 24rpx rgba(91, 140, 90, 0.25);
    
    text {
      font-size: 30rpx;
      font-weight: 600;
      color: #FFFFFF;
    }
    
    &.disabled {
      opacity: 0.5;
    }
    
    &:active {
      transform: scale(0.98);
    }
  }
}

.processing-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  
  .process-icon {
    position: relative;
    width: 120rpx;
    height: 120rpx;
    margin-bottom: 32rpx;
    
    .spin-emoji {
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 56rpx;
      animation: spin 2s linear infinite;
    }
    
    .process-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border: 4rpx solid rgba(91, 140, 90, 0.2);
      border-top-color: #5B8C5A;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }
  
  .process-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #3D5A3D;
    margin-bottom: 12rpx;
  }
  
  .process-hint {
    font-size: 26rpx;
    color: #6B8A6B;
    margin-bottom: 40rpx;
  }
  
  .progress-wrap {
    width: 100%;
    max-width: 500rpx;
    
    .progress-bar {
      height: 12rpx;
      background: rgba(91, 140, 90, 0.15);
      border-radius: 6rpx;
      overflow: hidden;
      
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #5B8C5A, #7AA879);
        border-radius: 6rpx;
        transition: width 0.3s;
      }
    }
    
    .progress-num {
      display: block;
      text-align: center;
      font-size: 26rpx;
      color: #5B8C5A;
      font-weight: 600;
      margin-top: 12rpx;
    }
  }
  
  .process-tip {
    margin-top: 40rpx;
    font-size: 24rpx;
    color: #7A9A7A;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.complete-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40rpx;
  
  .success-badge {
    width: 100rpx;
    height: 100rpx;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 32rpx rgba(91, 140, 90, 0.2);
    margin-bottom: 20rpx;
    
    text {
      font-size: 48rpx;
    }
  }
  
  .success-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #3D5A3D;
    margin-bottom: 8rpx;
  }
  
  .success-subtitle {
    font-size: 26rpx;
    color: #6B8A6B;
    margin-bottom: 32rpx;
  }
  
  .result-card {
    width: 100%;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 24rpx;
    padding: 28rpx;
    display: flex;
    align-items: center;
    border: 2rpx solid rgba(91, 140, 90, 0.3);
    
    .result-emoji {
      font-size: 40rpx;
    }
    
    .result-info {
      flex: 1;
      margin-left: 20rpx;
      
      .result-name {
        display: block;
        font-size: 28rpx;
        color: #3D5A3D;
        font-weight: 500;
      }
      
      .result-hint {
        font-size: 24rpx;
        color: #7A9A7A;
        margin-top: 4rpx;
      }
    }
  }
  
  .action-row {
    display: flex;
    gap: 24rpx;
    margin-top: 32rpx;
    width: 100%;
    
    .action-btn {
      flex: 1;
      height: 80rpx;
      border-radius: 40rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28rpx;
      font-weight: 500;
      
      &.outline {
        background: rgba(91, 140, 90, 0.1);
        color: #5B8C5A;
      }
      
      &.primary {
        background: linear-gradient(135deg, #5B8C5A 0%, #7AA879 100%);
        color: #FFFFFF;
        box-shadow: 0 6rpx 20rpx rgba(91, 140, 90, 0.25);
      }
      
      &:active {
        transform: scale(0.98);
      }
    }
  }
  
  .reset-link {
    margin-top: 28rpx;
    padding: 16rpx 32rpx;
    
    text {
      font-size: 26rpx;
      color: #5B8C5A;
    }
  }
}
</style>
