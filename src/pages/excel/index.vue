<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useFilesStore } from '@/stores/files'
import { http, API } from '@/api'
import { processExcelFile, processExcelFileByPath, downloadBlob } from '@/services/excelProcessor'
import AiAssistant from '@/components/AiAssistant.vue'
import ExcelPreview from '@/components/ExcelPreview.vue'

const userStore = useUserStore()
const filesStore = useFilesStore()

// 页面状态
const currentStep = ref<'upload' | 'processing' | 'complete'>('upload')
const isUploading = ref(false)
const isProcessing = ref(false)
const isChoosingFile = ref(false)
const isHarmonyDevice = ref(false)

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
  arrayBuffer?: ArrayBuffer // 移动端本地处理时保存buffer
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

// 支持的Excel扩展名
const EXCEL_EXTENSIONS = ['xlsx', 'xls']

// 从路径提取文件名
function getFileNameFromPath(path = ''): string {
  if (!path) return ''
  const normalized = path.replace(/\\/g, '/')
  const last = normalized.split('/').pop() || ''
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

// 校验是否为Excel文件
function isExcelFile(name = '', path = ''): boolean {
  const target = (name || path).toLowerCase()
  return EXCEL_EXTENSIONS.some(ext => target.endsWith(`.${ext}`))
}

// 统一处理已选文件
function applySelectedFile(file: { name?: string; size?: number; path?: string; raw?: any }) {
  const path = file.path || ''
  const name = file.name || getFileNameFromPath(path)

  if (!path || !isExcelFile(name, path)) {
    uni.showToast({
      title: '请选择 .xlsx 或 .xls 文件',
      icon: 'none'
    })
    return
  }

  const raw = file.raw
  const canUseRawFile = typeof File !== 'undefined' && raw instanceof File

  currentFile.value = {
    name,
    size: Number(file.size || 0),
    path,
    _file: canUseRawFile ? raw : undefined
  }

  uni.showToast({
    title: '文件已选择',
    icon: 'success'
  })
}

// 选择文件
function extractFilePath(file: any, tempPaths: string[]): string {
  return file?.path || file?.tempFilePath || file?.filePath || tempPaths[0] || ''
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

function normalizeFileName(fileName = ''): string {
  const cleaned = fileName
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return `excel_${Date.now()}.xlsx`
  return /\.(xlsx|xls)$/i.test(cleaned) ? cleaned : `${cleaned}.xlsx`
}

function getErrorMessage(err: any, fallback: string): string {
  const text = err?.errMsg || err?.message || fallback
  if (typeof text !== 'string') return fallback
  return text.length > 34 ? text.slice(0, 34) : text
}

function getMpFileTypeByName(name = ''): 'xls' | 'xlsx' {
  return /\.xls$/i.test(name) ? 'xls' : 'xlsx'
}

function initMpDeviceProfile() {
  // #ifdef MP-WEIXIN
  try {
    const wxRef: any = typeof wx !== 'undefined' ? wx : null
    const getter = wxRef?.getDeviceInfo
    const info = typeof getter === 'function' ? getter() : wxRef?.getSystemInfoSync?.()
    const platformText = `${info?.platform || ''} ${info?.system || ''}`.toLowerCase()
    isHarmonyDevice.value = platformText.includes('harmony') || platformText.includes('ohos') || platformText.includes('hongmeng')
  } catch {
    isHarmonyDevice.value = false
  }
  // #endif
}

async function normalizeSelectedPath(path: string, fileName = ''): Promise<string> {
  if (!path) return ''

  // #ifdef MP-WEIXIN
  const fs = uni.getFileSystemManager()
  const wxRef: any = typeof wx !== 'undefined' ? wx : null
  const userDataPath = wxRef?.env?.USER_DATA_PATH || ''
  const extension = (fileName.match(/\.(xlsx|xls)$/i)?.[0] || path.match(/\.(xlsx|xls)$/i)?.[0] || '.xlsx').toLowerCase()
  const candidates = Array.from(new Set([path, decodePath(path)].filter(Boolean)))

  const canAccess = (target: string) => new Promise<boolean>((resolve) => {
    fs.access({
      path: target,
      success: () => resolve(true),
      fail: () => resolve(false)
    })
  })

  for (const candidate of candidates) {
    if (await canAccess(candidate)) {
      return candidate
    }
  }

  if (!userDataPath) {
    return path
  }

  for (const sourcePath of candidates) {
    const destPath = `${userDataPath}/excel_src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`
    const copied = await new Promise<boolean>((resolve) => {
      fs.copyFile({
        srcPath: sourcePath,
        destPath,
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    })

    if (copied && await canAccess(destPath)) {
      return destPath
    }
  }
  // #endif

  return path
}

async function chooseBySystemPicker(): Promise<void> {
  const chooseFile = (uni as any).chooseFile
  if (typeof chooseFile !== 'function') {
    throw new Error('当前平台暂不支持文件选择')
  }

  await new Promise<void>((resolve, reject) => {
    chooseFile({
      count: 1,
      type: 'all',
      extension: EXCEL_EXTENSIONS,
      success: async (res: any) => {
        try {
          const tempFiles = Array.isArray(res?.tempFiles) ? res.tempFiles : (res?.tempFiles ? [res.tempFiles] : [])
          const tempPaths = Array.isArray(res?.tempFilePaths) ? res.tempFilePaths : (res?.tempFilePaths ? [res.tempFilePaths] : [])
          const selected = tempFiles[0] || {}
          const rawPath = extractFilePath(selected, tempPaths)
          const fileName = selected.name || selected.fileName || getFileNameFromPath(rawPath)
          const normalizedPath = await normalizeSelectedPath(rawPath, fileName)

          applySelectedFile({
            name: fileName,
            size: selected.size || selected.fileSize,
            path: normalizedPath,
            raw: selected
          })
          resolve()
        } catch (err) {
          reject(err)
        }
      },
      fail: (err: any) => reject(err)
    })
  })
}

async function chooseByWechatMessageFile(): Promise<void> {
  const chooser = (uni as any).chooseMessageFile || ((typeof wx !== 'undefined' && (wx as any).chooseMessageFile) ? (wx as any).chooseMessageFile : null)
  if (typeof chooser !== 'function') {
    throw new Error('当前微信环境不支持从会话选择文件')
  }

  await new Promise<void>((resolve, reject) => {
    chooser({
      count: 1,
      type: 'file',
      extension: EXCEL_EXTENSIONS,
      success: async (res: any) => {
        const file = res.tempFiles[0] as any
        if (!file) {
          reject(new Error('未选择文件'))
          return
        }

        try {
          const tempPaths = Array.isArray((res as any)?.tempFilePaths) ? (res as any).tempFilePaths : ((res as any)?.tempFilePaths ? [(res as any).tempFilePaths] : [])
          const rawPath = file.path || file.tempFilePath || tempPaths[0] || ''
          const fileName = file.name || file.fileName || getFileNameFromPath(rawPath)
          const normalizedPath = await normalizeSelectedPath(rawPath, fileName)

          applySelectedFile({
            name: fileName,
            size: file.size || file.fileSize,
            path: normalizedPath
          })
          resolve()
        } catch (err) {
          reject(err)
        }
      },
      fail: (err: any) => reject(err)
    })
  })
}

async function handleChooseFile() {
  if (isProcessing.value || isChoosingFile.value) return
  isChoosingFile.value = true

  try {
    // 微信小程序选择文件
    // #ifdef MP-WEIXIN
    await new Promise<void>((resolve, reject) => {
      const hasSystemPicker = typeof (uni as any).chooseFile === 'function'
      const systemTitle = isHarmonyDevice.value ? '从手机文件选择(鸿蒙兼容)' : '从手机文件选择(兼容)'
      const itemList = hasSystemPicker ? ['从微信会话选择', systemTitle] : ['从微信会话选择']
      uni.showActionSheet({
        itemList,
        success: async (sheetRes) => {
          try {
            if (sheetRes.tapIndex === 0 || !hasSystemPicker) {
              await chooseByWechatMessageFile()
            } else {
              await chooseBySystemPicker()
            }
            resolve()
          } catch (error) {
            reject(error)
          }
        },
        fail: (err) => reject(err)
      })
    })
    // #endif
    
    // App/H5/其他平台选择文件
    // #ifndef MP-WEIXIN
    await chooseBySystemPicker()
    // #endif
    
  } catch (error: any) {
    if (error?.errMsg?.includes('cancel')) return
    // #ifdef MP-WEIXIN
    try {
      await chooseBySystemPicker()
      return
    } catch {}
    // #endif
    uni.showToast({
      title: getErrorMessage(error, '选择文件失败，请重试'),
      icon: 'none'
    })
  } finally {
    isChoosingFile.value = false
  }
}

// 开始处理
async function handleStartProcess() {
  if (isProcessing.value) return

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
    // 移动端优先本地处理，避免网络波动导致失败
    currentEncouragement.value = '正在上传并提交后端处理...'
    const backendResult = await tryBackendProcess()
      // 尝试使用后端处理（带超时）
      if (backendResult.success) {
        // 后端处理成功
        clearInterval(progressInterval)
        processProgress.value = 100
        
        filesStore.updateFileStatus(recordId, 'completed', new Date().toISOString())
        
        const backendData = backendResult.data || {}
        const processedFileId = backendData.processedFileId || backendData.fileId || backendData.id
        const processedName = backendData.fileName || backendData.processedFileName || currentFile.value!.name.replace(/\.(xlsx|xls)$/i, '_汇总.xlsx')
        const backendDownloadUrl = backendData.downloadUrl || backendData.processedFilePath || backendData.filePath || ''
        processedFile.value = {
          name: processedName,
          path: backendDownloadUrl,
          fileId: processedFileId,
          downloadUrl: backendDownloadUrl
        }
        
        filesStore.addFileRecord({
          id: processedFileId || 'file_' + Date.now() + '_processed',
          fileName: processedFile.value.name,
          fileType: 'processed',
          filePath: backendDownloadUrl || `${API.FILE.DOWNLOAD}/${processedFileId || ''}`,
          fileSize: currentFile.value!.size,
          uploadTime: new Date().toISOString(),
          processTime: new Date().toISOString(),
          status: 'completed'
        })
    } else {
      currentEncouragement.value = '后端处理失败，正在尝试本地处理...'
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
async function tryBackendProcess(): Promise<{ success: boolean; data?: any; message?: string }> {
  return new Promise(async (resolve) => {
    let settled = false
    const done = (result: { success: boolean; data?: any; message?: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      resolve(result)
    }

    const timeoutId = setTimeout(() => {
      done({ success: false, message: '处理超时，请稍后重试' })
    }, BACKEND_TIMEOUT)
    
    try {
      if (!currentFile.value?.path) {
        done({ success: false, message: '未获取到可上传文件路径，改走本地处理' })
        return
      }

      // 1. 上传文件到后端
      const uploadRes = await http.upload(API.FILE.UPLOAD, currentFile.value!.path, {
        formData: {
          fileName: currentFile.value!.name
        },
        showLoading: false,
        loadingText: '上传中...',
        timeout: 60000
      })
      
      const fileId = uploadRes.data.fileId
      currentFile.value!.fileId = fileId
      processProgress.value = 40
      
      // 2. 调用处理接口
      const processRes = await http.post(API.FILE.PROCESS, { fileId }, { showLoading: false, timeout: 60000 })
      
      done({ success: true, data: processRes.data })
      
    } catch (error: any) {
      done({ success: false, message: error?.message || error?.errMsg || '文件上传或处理失败' })
    }
  })
}

// 前端处理Excel
async function handleFrontendProcess(recordId: string) {
  processedByFrontend.value = true
  
  const outputName = currentFile.value!.name.replace(/\.(xlsx|xls)$/i, '_会计月汇总.xlsx')
  let result: any = null

  // #ifdef H5
  const h5File = currentFile.value?._file || null
  if (h5File) {
    result = await processExcelFile(h5File, outputName)
  } else {
    result = await processExcelFileByPath(currentFile.value!.path, outputName)
  }
  // #endif

  // #ifndef H5
  result = await processExcelFileByPath(currentFile.value!.path, outputName)
  // #endif
  
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
    arrayBuffer: result.arrayBuffer,
    previewData: result.data
  }
  
  // 添加处理后的文件记录
  filesStore.addFileRecord({
    id: 'file_' + Date.now() + '_processed',
    fileName: processedFile.value.name,
    fileType: 'processed',
    filePath: 'local',
    fileSize: result.blob?.size || result.arrayBuffer?.byteLength || 0,
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
    if (processedByFrontend.value) {
      // #ifdef H5
      if (processedFile.value.blob) {
        uni.hideLoading()
        downloadBlob(processedFile.value.blob, processedFile.value.name)
        uni.showToast({ title: '下载已开始', icon: 'success' })
        return
      }
      // #endif

      // #ifdef MP-WEIXIN
      if (processedFile.value.arrayBuffer) {
        const fs = uni.getFileSystemManager()
        const safeFileName = normalizeFileName(processedFile.value.name)
        const fileType = getMpFileTypeByName(safeFileName)
        const filePath = `${(wx as any).env.USER_DATA_PATH}/${Date.now()}_${safeFileName}`
        fs.writeFile({
          filePath,
          data: processedFile.value.arrayBuffer,
          success: () => {
            uni.hideLoading()
            uni.openDocument({
              filePath,
              fileType,
              showMenu: true,
              success: () => uni.showToast({ title: '文件已打开', icon: 'success' }),
              fail: (err: any) => uni.showToast({ title: getErrorMessage(err, '打开文件失败'), icon: 'none' })
            })
          },
          fail: (err: any) => {
            uni.hideLoading()
            uni.showToast({ title: getErrorMessage(err, '保存文件失败'), icon: 'none' })
          }
        })
        return
      }
      // #endif

      uni.hideLoading()
      uni.showToast({ title: '请使用预览查看结果', icon: 'none' })
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
          const fileType = getMpFileTypeByName(processedFile.value?.name || '')
          uni.openDocument({
            filePath: res.tempFilePath,
            fileType,
            showMenu: true,
            success: () => {
              uni.showToast({ title: '文件已打开', icon: 'success' })
            },
            fail: (err: any) => {
              uni.showToast({ title: getErrorMessage(err, '打开文件失败'), icon: 'none' })
            }
          })
        } else {
          uni.showToast({ title: `下载失败(${res.statusCode})`, icon: 'none' })
        }
      },
      fail: (err: any) => {
        uni.hideLoading()
        uni.showToast({ title: getErrorMessage(err, '下载失败'), icon: 'none' })
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

onMounted(() => {
  initMpDeviceProfile()
})
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
        <view class="upload-card" :class="{ picking: isChoosingFile }" @click="handleChooseFile">
          <text class="upload-icon">📤</text>
          <text class="upload-title">{{ isChoosingFile ? '正在打开选择器...' : '点击选择文件' }}</text>
          <text class="upload-hint">支持 .xlsx/.xls（App可选手机本机文件）</text>
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

        <view class="highlights-card">
          <view class="highlight-item">
            <text class="highlight-label">端侧处理</text>
            <text class="highlight-value">小程序/App 后端优先</text>
          </view>
          <view class="highlight-item">
            <text class="highlight-label">支持格式</text>
            <text class="highlight-value">.xlsx / .xls</text>
          </view>
          <view class="highlight-item">
            <text class="highlight-label">结果能力</text>
            <text class="highlight-value">预览 + 下载 + 历史记录</text>
          </view>
        </view>

        <view class="guide-card">
          <text class="guide-title">📱 手机端使用提示</text>
          <text class="guide-text">1. 小程序建议先选“微信会话文件”，失败再选“手机文件”。</text>
          <text class="guide-text">2. 若网络不稳，系统会自动尝试本地处理。</text>
          <text class="guide-text">3. 处理失败时优先检查：是否包含“会计月”列。</text>
        </view>
        
        <view class="submit-btn" :class="{ disabled: !currentFile || isProcessing }" @click="handleStartProcess">
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
  background: linear-gradient(180deg, #ECF4F8 0%, #E7F0F5 48%, #F7FAFC 100%);
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
  background: linear-gradient(135deg, #9CCEE0, #7FB9CF);
  top: 100rpx;
  right: -60rpx;
}

.glow-2 {
  width: 200rpx;
  height: 200rpx;
  background: linear-gradient(135deg, #B5D9E8, #8EC5DA);
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
      color: #3E6D82;
      font-weight: bold;
    }
  }
  
  .nav-title {
    flex: 1;
    text-align: center;
    font-size: 34rpx;
    font-weight: 600;
    color: #2F5667;
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
        background: #3E6D82;
        box-shadow: 0 0 12rpx rgba(62, 109, 130, 0.45);
      }
      .step-text {
        color: #3E6D82;
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
      background: #3E6D82;
    }
  }
}

.main-content {
  flex: 1;
  padding: 0 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
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
    border: 3rpx dashed rgba(70, 128, 154, 0.35);
    
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

    &:active {
      transform: scale(0.99);
    }

    &.picking {
      opacity: 0.75;
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

  .highlights-card {
    background: rgba(255, 255, 255, 0.86);
    border-radius: 22rpx;
    padding: 18rpx 22rpx;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
    border: 1rpx solid rgba(117, 170, 192, 0.22);

    .highlight-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .highlight-label {
      font-size: 23rpx;
      color: #5A7F90;
    }

    .highlight-value {
      font-size: 23rpx;
      color: #2F5667;
      font-weight: 600;
    }
  }

  .guide-card {
    background: rgba(239, 248, 252, 0.92);
    border-radius: 20rpx;
    padding: 20rpx 22rpx;
    border: 1rpx solid rgba(130, 182, 204, 0.28);

    .guide-title {
      display: block;
      font-size: 25rpx;
      color: #2F5667;
      font-weight: 600;
      margin-bottom: 8rpx;
    }

    .guide-text {
      display: block;
      font-size: 22rpx;
      color: #5A7F90;
      line-height: 1.55;
      margin-top: 4rpx;
    }
  }
  
  .submit-btn {
    margin-top: 20rpx;
    height: 88rpx;
    background: linear-gradient(135deg, #3E6D82 0%, #5E93AB 100%);
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
      pointer-events: none;
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
