/**
 * 统一请求封装
 * 基于 uni.request 的 HTTP 请求工具
 */
import { BASE_URL } from './config'

// 请求拦截器 - 添加token
function getAuthHeader(): Record<string, string> {
  const token = uni.getStorageSync('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// 统一请求方法
interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  showLoading?: boolean
  loadingText?: string
  timeout?: number
}

interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export async function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  const {
    url,
    method = 'GET',
    data,
    header = {},
    showLoading = true,
    loadingText = '加载中...',
    timeout = 30000
  } = options

  // 显示加载
  if (showLoading) {
    uni.showLoading({ title: loadingText, mask: true })
  }

  try {
    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: url.startsWith('http') ? url : `${BASE_URL}${url}`,
        method,
        data,
        header: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
          ...header,
        },
        timeout,
        success: resolve,
        fail: reject,
      })
    })

    // 隐藏加载
    if (showLoading) {
      uni.hideLoading()
    }

    const response = res.data as ApiResponse<T>

    // 统一处理错误
    if (response.code !== 200 && response.code !== 0) {
      // token失效
      if (response.code === 401) {
        uni.removeStorageSync('token')
        uni.removeStorageSync('userInfo')
        uni.redirectTo({ url: '/pages/login/index' })
        return Promise.reject(new Error('登录已过期，请重新登录'))
      }
      return Promise.reject(new Error(response.message || '请求失败'))
    }

    return response
  } catch (error: any) {
    if (showLoading) {
      uni.hideLoading()
    }
    
    const errText = error?.errMsg || error?.message || '网络请求失败'
    uni.showToast({
      title: errText,
      icon: 'none',
    })
    
    return Promise.reject(error)
  }
}

// 上传文件方法
interface UploadOptions {
  url: string
  filePath: string
  name?: string
  formData?: Record<string, any>
  showLoading?: boolean
  loadingText?: string
  timeout?: number
}

export async function uploadFile<T = any>(options: UploadOptions): Promise<ApiResponse<T>> {
  const {
    url,
    filePath,
    name = 'file',
    formData = {},
    showLoading = true,
    loadingText = '上传中...',
    timeout = 60000
  } = options

  if (showLoading) {
    uni.showLoading({ title: loadingText, mask: true })
  }

  try {
    const res = await new Promise<UniApp.UploadFileSuccessCallbackResult>((resolve, reject) => {
      uni.uploadFile({
        url: url.startsWith('http') ? url : `${BASE_URL}${url}`,
        filePath,
        name,
        formData,
        header: {
          ...getAuthHeader(),
        },
        timeout,
        success: resolve,
        fail: reject,
      })
    })

    if (showLoading) {
      uni.hideLoading()
    }

    const response = JSON.parse(res.data) as ApiResponse<T>
    
    if (response.code !== 200 && response.code !== 0) {
      return Promise.reject(new Error(response.message || '上传失败'))
    }

    return response
  } catch (error: any) {
    if (showLoading) {
      uni.hideLoading()
    }
    
    const errText = error?.errMsg || error?.message || '上传失败'
    uni.showToast({
      title: errText,
      icon: 'none',
    })
    
    return Promise.reject(error)
  }
}

// 便捷方法
export const http = {
  get: <T = any>(url: string, data?: any, options?: Partial<RequestOptions>) =>
    request<T>({ url, method: 'GET', data, ...options }),
    
  post: <T = any>(url: string, data?: any, options?: Partial<RequestOptions>) =>
    request<T>({ url, method: 'POST', data, ...options }),
    
  put: <T = any>(url: string, data?: any, options?: Partial<RequestOptions>) =>
    request<T>({ url, method: 'PUT', data, ...options }),
    
  delete: <T = any>(url: string, data?: any, options?: Partial<RequestOptions>) =>
    request<T>({ url, method: 'DELETE', data, ...options }),
    
  upload: <T = any>(url: string, filePath: string, options?: Partial<UploadOptions>) =>
    uploadFile<T>({ url, filePath, ...options }),
}

export default http
