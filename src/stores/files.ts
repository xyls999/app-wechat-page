import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface FileRecord {
  id: string
  fileId?: string           // 后端返回的文件ID
  name?: string             // 兼容的文件名字段
  fileName: string
  fileType: 'original' | 'processed'
  filePath: string
  fileSize: number
  uploadTime: string
  processTime?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string      // 下载链接
}

export const useFilesStore = defineStore('files', () => {
  const fileHistory = ref<FileRecord[]>([])
  const maxHistoryCount = 20 // 最多保存20条记录
  
  // 原始文件列表
  const originalFiles = computed(() => 
    fileHistory.value.filter(f => f.fileType === 'original')
  )
  
  // 处理后的文件列表
  const processedFiles = computed(() => 
    fileHistory.value.filter(f => f.fileType === 'processed')
  )
  
  // 添加文件记录
  function addFileRecord(record: FileRecord) {
    fileHistory.value.unshift(record)
    // 限制历史记录数量
    if (fileHistory.value.length > maxHistoryCount) {
      fileHistory.value = fileHistory.value.slice(0, maxHistoryCount)
    }
    saveToStorage()
  }
  
  // 更新文件状态
  function updateFileStatus(id: string, status: FileRecord['status'], processTime?: string) {
    const file = fileHistory.value.find(f => f.id === id)
    if (file) {
      file.status = status
      if (processTime) file.processTime = processTime
      saveToStorage()
    }
  }
  
  // 删除文件记录
  function removeFileRecord(id: string) {
    fileHistory.value = fileHistory.value.filter(f => f.id !== id)
    saveToStorage()
  }
  
  // 清空历史
  function clearHistory() {
    fileHistory.value = []
    saveToStorage()
  }
  
  // 从后端同步数据
  function syncFromServer(records: any[]) {
    fileHistory.value = records.map(r => ({
      id: r.id || r._id,
      fileId: r.fileId || r.id,
      name: r.name || r.fileName,
      fileName: r.fileName || r.name,
      fileType: r.fileType || 'original',
      filePath: r.filePath || '',
      fileSize: r.fileSize || 0,
      uploadTime: r.uploadTime || r.createdAt,
      processTime: r.processTime,
      status: r.status || 'completed',
      downloadUrl: r.downloadUrl
    }))
    saveToStorage()
  }
  
  // 持久化存储
  function saveToStorage() {
    uni.setStorageSync('fileHistory', fileHistory.value)
  }
  
  // 从存储恢复
  function initFromStorage() {
    const stored = uni.getStorageSync('fileHistory')
    if (stored && Array.isArray(stored)) {
      fileHistory.value = stored
    }
  }
  
  return {
    fileHistory,
    originalFiles,
    processedFiles,
    addFileRecord,
    updateFileStatus,
    removeFileRecord,
    clearHistory,
    syncFromServer,
    initFromStorage
  }
})
