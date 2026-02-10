/**
 * API 配置文件
 * 后端接口基础地址
 */

// 后端服务器地址
export const BASE_URL = 'https://wechat-manage.onrender.com'

// DeepSeek AI接口
export const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
export const DEEPSEEK_API_KEY = 'sk-18c506a09d9e46069b769b46b994ab7b'

// API 端点 - 注意后端路径为 /api/v1/
export const API = {
  // 用户相关
  AUTH: {
    REGISTER: `${BASE_URL}/api/v1/auth/register`,
    LOGIN: `${BASE_URL}/api/v1/auth/login`,
    LOGOUT: `${BASE_URL}/api/v1/auth/logout`,
    PROFILE: `${BASE_URL}/api/v1/user/profile`,
  },
  // 文件处理
  FILE: {
    UPLOAD: `${BASE_URL}/api/v1/files/upload`,
    PROCESS: `${BASE_URL}/api/v1/files/process`,
    DOWNLOAD: `${BASE_URL}/api/v1/files/download`,
    PREVIEW: `${BASE_URL}/api/v1/files/preview`,
  },
  // 历史记录
  HISTORY: {
    LIST: `${BASE_URL}/api/v1/files/history`,
    DETAIL: `${BASE_URL}/api/v1/files/detail`,
    DELETE: `${BASE_URL}/api/v1/files`,
    CLEAR: `${BASE_URL}/api/v1/files/history/clear`,
  },
  // AI对话
  AI: {
    CHAT: `${BASE_URL}/api/v1/ai/chat`,
    HISTORY: `${BASE_URL}/api/v1/ai/history`,
  },
}
