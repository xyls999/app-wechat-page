# 智慧表格助手 - 后端API接口文档

> 本文档列出所有需要后端实现的接口，以及前端对接代码示例

## 📌 基础信息

- **Base URL**: `https://your-api-domain.com/api/v1`
- **认证方式**: Bearer Token (JWT)
- **Content-Type**: `application/json`（文件上传除外）

---

## 1️⃣ 用户认证模块

### 1.1 用户注册

**接口地址**: `POST /auth/register`

**请求参数**:
```json
{
  "username": "string",     // 用户名，3-20字符
  "password": "string",     // 密码，6-20字符
  "nickname": "string"      // 昵称/称呼，1-10字符
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "注册成功",
  "data": {
    "id": "user_123456",
    "username": "zhangsan",
    "nickname": "张三",
    "avatar": "",
    "createdAt": "2026-02-11T10:00:00.000Z",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**错误码**:
| code | message |
|------|---------|
| 400 | 参数错误 |
| 409 | 用户名已存在 |

**前端对接代码** ([src/pages/login/index.vue](src/pages/login/index.vue)):
```typescript
// 注册接口调用
async function handleRegister() {
  const res = await uni.request({
    url: `${BASE_URL}/auth/register`,
    method: 'POST',
    data: {
      username: formData.value.username,
      password: formData.value.password,
      nickname: formData.value.nickname
    }
  })
  
  if (res.data.code === 200) {
    userStore.login(res.data.data, res.data.data.token)
    uni.redirectTo({ url: '/pages/home/index' })
  }
}
```

---

### 1.2 用户登录

**接口地址**: `POST /auth/login`

**请求参数**:
```json
{
  "username": "string",
  "password": "string"
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "id": "user_123456",
    "username": "zhangsan",
    "nickname": "张三",
    "avatar": "",
    "createdAt": "2026-02-11T10:00:00.000Z",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**错误码**:
| code | message |
|------|---------|
| 400 | 参数错误 |
| 401 | 用户名或密码错误 |

**前端对接代码**:
```typescript
// 登录接口调用
async function handleLogin() {
  const res = await uni.request({
    url: `${BASE_URL}/auth/login`,
    method: 'POST',
    data: {
      username: formData.value.username,
      password: formData.value.password
    }
  })
  
  if (res.data.code === 200) {
    userStore.login(res.data.data, res.data.data.token)
    uni.redirectTo({ url: '/pages/home/index' })
  }
}
```

---

### 1.3 获取用户信息

**接口地址**: `GET /auth/profile`

**请求头**:
```
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "id": "user_123456",
    "username": "zhangsan",
    "nickname": "张三",
    "avatar": "",
    "createdAt": "2026-02-11T10:00:00.000Z"
  }
}
```

**前端对接代码**:
```typescript
// 获取用户信息
async function fetchUserProfile() {
  const res = await uni.request({
    url: `${BASE_URL}/auth/profile`,
    method: 'GET',
    header: {
      'Authorization': `Bearer ${userStore.token}`
    }
  })
  
  if (res.data.code === 200) {
    userStore.updateUserInfo(res.data.data)
  }
}
```

---

### 1.4 退出登录

**接口地址**: `POST /auth/logout`

**请求头**:
```
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "code": 200,
  "message": "退出成功"
}
```

---

## 2️⃣ 文件处理模块

### 2.1 上传Excel文件

**接口地址**: `POST /files/upload`

**请求头**:
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**请求参数**:
| 字段 | 类型 | 说明 |
|-----|------|-----|
| file | File | Excel文件(.xlsx/.xls) |

**响应示例**:
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "fileId": "file_789012",
    "fileName": "销售数据.xlsx",
    "fileSize": 102400,
    "filePath": "/uploads/2026/02/file_789012.xlsx",
    "uploadTime": "2026-02-11T10:30:00.000Z",
    "status": "pending"
  }
}
```

**前端对接代码** ([src/pages/excel/index.vue](src/pages/excel/index.vue)):
```typescript
// 上传文件
async function uploadFile(filePath: string) {
  const res = await uni.uploadFile({
    url: `${BASE_URL}/files/upload`,
    filePath: filePath,
    name: 'file',
    header: {
      'Authorization': `Bearer ${userStore.token}`
    }
  })
  
  const data = JSON.parse(res.data)
  if (data.code === 200) {
    return data.data
  }
  throw new Error(data.message)
}
```

---

### 2.2 处理Excel文件（按会计月汇总）

**接口地址**: `POST /files/process`

**请求头**:
```
Authorization: Bearer <token>
```

**请求参数**:
```json
{
  "fileId": "file_789012"
}
```

**处理逻辑说明**:
1. 读取上传的Excel文件
2. 找到"会计月"列
3. 按会计月分组，对所有数值列求和
4. 生成汇总后的新Excel文件

**原始数据示例**:
| 税率 | 会计月 | 供应商编码 | 期初数量 | 无税期初金额 | 期初金额 | 入库数量 | ... |
|-----|--------|----------|---------|------------|---------|---------|-----|
| 17.00% | 202501 | 00002 | 700 | 25695.57 | 29036 | 500 | ... |
| 16.00% | 202501 | 00002 | 0 | 0 | 0 | 740 | ... |
| 13.00% | 202501 | 00002 | 0 | 0 | 0 | 0 | ... |

**汇总后数据**:
| 会计月 | 期初数量 | 无税期初金额 | 期初金额 | 入库数量 | 入库金额 | ... |
|--------|---------|------------|---------|---------|---------|-----|
| 202501 | 700 | 25695.57 | 29036 | 1240 | ... | ... |
| 202502 | 0 | 0 | 0 | 0 | ... | ... |
| ... | ... | ... | ... | ... | ... | ... |

**响应示例**:
```json
{
  "code": 200,
  "message": "处理完成",
  "data": {
    "originalFileId": "file_789012",
    "processedFileId": "file_789012_processed",
    "processedFileName": "销售数据_处理后.xlsx",
    "processedFilePath": "/uploads/2026/02/file_789012_processed.xlsx",
    "processTime": "2026-02-11T10:31:00.000Z",
    "status": "completed",
    "summary": {
      "totalRows": 100,
      "groupedRows": 12,
      "columns": ["会计月", "期初数量", "无税期初金额", "期初金额", "入库数量", "入库金额", "无税入库金额", "退货数量", "退货金额", "无税退货金额", "批发数量", "批发金额", "无税批发金额", "批退数量", "批退金额"]
    }
  }
}
```

**前端对接代码**:
```typescript
// 处理文件
async function processFile(fileId: string) {
  const res = await uni.request({
    url: `${BASE_URL}/files/process`,
    method: 'POST',
    header: {
      'Authorization': `Bearer ${userStore.token}`
    },
    data: { fileId }
  })
  
  if (res.data.code === 200) {
    return res.data.data
  }
  throw new Error(res.data.message)
}
```

---

### 2.3 获取文件下载链接

**接口地址**: `GET /files/download/:fileId`

**请求头**:
```
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "downloadUrl": "https://your-domain.com/downloads/file_789012_processed.xlsx?token=xxx&expires=1707660000",
    "expiresIn": 3600
  }
}
```

**前端对接代码**:
```typescript
// 下载文件
async function downloadFile(fileId: string) {
  const res = await uni.request({
    url: `${BASE_URL}/files/download/${fileId}`,
    method: 'GET',
    header: {
      'Authorization': `Bearer ${userStore.token}`
    }
  })
  
  if (res.data.code === 200) {
    const downloadUrl = res.data.data.downloadUrl
    
    // 微信小程序
    // #ifdef MP-WEIXIN
    uni.downloadFile({
      url: downloadUrl,
      success: (downloadRes) => {
        uni.saveFile({
          tempFilePath: downloadRes.tempFilePath,
          success: () => {
            uni.showToast({ title: '保存成功', icon: 'success' })
          }
        })
      }
    })
    // #endif
    
    // H5
    // #ifdef H5
    window.open(downloadUrl, '_blank')
    // #endif
  }
}
```

---

### 2.4 预览文件数据

**接口地址**: `GET /files/preview/:fileId`

**请求头**:
```
Authorization: Bearer <token>
```

**查询参数**:
| 参数 | 类型 | 说明 |
|-----|------|-----|
| page | number | 页码，默认1 |
| pageSize | number | 每页条数，默认20 |

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "columns": ["会计月", "期初数量", "无税期初金额", "期初金额"],
    "rows": [
      {"会计月": "202501", "期初数量": 700, "无税期初金额": 25695.57, "期初金额": 29036},
      {"会计月": "202502", "期初数量": 0, "无税期初金额": 0, "期初金额": 0}
    ],
    "total": 12,
    "page": 1,
    "pageSize": 20
  }
}
```

**前端对接代码**:
```typescript
// 预览文件
async function previewFile(fileId: string, page = 1) {
  const res = await uni.request({
    url: `${BASE_URL}/files/preview/${fileId}`,
    method: 'GET',
    header: {
      'Authorization': `Bearer ${userStore.token}`
    },
    data: { page, pageSize: 20 }
  })
  
  if (res.data.code === 200) {
    previewData.value = res.data.data.rows
    showPreview.value = true
  }
}
```

---

## 3️⃣ 历史记录模块

### 3.1 获取文件历史列表

**接口地址**: `GET /files/history`

**请求头**:
```
Authorization: Bearer <token>
```

**查询参数**:
| 参数 | 类型 | 说明 |
|-----|------|-----|
| type | string | 文件类型：all/original/processed |
| page | number | 页码 |
| pageSize | number | 每页条数 |

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "file_789012",
        "fileName": "销售数据.xlsx",
        "fileType": "original",
        "filePath": "/uploads/2026/02/file_789012.xlsx",
        "fileSize": 102400,
        "uploadTime": "2026-02-11T10:30:00.000Z",
        "processTime": null,
        "status": "completed"
      },
      {
        "id": "file_789012_processed",
        "fileName": "销售数据_处理后.xlsx",
        "fileType": "processed",
        "filePath": "/uploads/2026/02/file_789012_processed.xlsx",
        "fileSize": 51200,
        "uploadTime": "2026-02-11T10:30:00.000Z",
        "processTime": "2026-02-11T10:31:00.000Z",
        "status": "completed"
      }
    ],
    "total": 20,
    "page": 1,
    "pageSize": 10
  }
}
```

**前端对接代码** ([src/pages/history/index.vue](src/pages/history/index.vue)):
```typescript
// 获取历史记录
async function fetchHistory(type = 'all', page = 1) {
  const res = await uni.request({
    url: `${BASE_URL}/files/history`,
    method: 'GET',
    header: {
      'Authorization': `Bearer ${userStore.token}`
    },
    data: { type, page, pageSize: 20 }
  })
  
  if (res.data.code === 200) {
    filesStore.fileHistory = res.data.data.list
  }
}
```

---

### 3.2 删除历史记录

**接口地址**: `DELETE /files/:fileId`

**请求头**:
```
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "code": 200,
  "message": "删除成功"
}
```

**前端对接代码**:
```typescript
// 删除文件记录
async function deleteFile(fileId: string) {
  const res = await uni.request({
    url: `${BASE_URL}/files/${fileId}`,
    method: 'DELETE',
    header: {
      'Authorization': `Bearer ${userStore.token}`
    }
  })
  
  if (res.data.code === 200) {
    filesStore.removeFileRecord(fileId)
    uni.showToast({ title: '删除成功', icon: 'success' })
  }
}
```

---

### 3.3 清空所有历史

**接口地址**: `DELETE /files/history/clear`

**请求头**:
```
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "code": 200,
  "message": "清空成功"
}
```

---

## 4️⃣ AI助手模块（可选）

> 如果需要在后端代理DeepSeek API（保护API Key），可实现以下接口

### 4.1 AI对话

**接口地址**: `POST /ai/chat`

**请求头**:
```
Authorization: Bearer <token>
```

**请求参数**:
```json
{
  "messages": [
    {"role": "user", "content": "如何上传表格？"}
  ]
}
```

**响应示例**:
```json
{
  "code": 200,
  "data": {
    "reply": "您好！上传表格很简单...",
    "usage": {
      "promptTokens": 100,
      "completionTokens": 200
    }
  }
}
```

**前端对接代码** ([src/components/AiAssistant.vue](src/components/AiAssistant.vue)):
```typescript
// AI对话（通过后端代理）
async function callAI(message: string) {
  const contextMessages = messages.value
    .filter(m => !m.loading)
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content }))
  
  const res = await uni.request({
    url: `${BASE_URL}/ai/chat`,
    method: 'POST',
    header: {
      'Authorization': `Bearer ${userStore.token}`
    },
    data: {
      messages: [...contextMessages, { role: 'user', content: message }]
    }
  })
  
  if (res.data.code === 200) {
    return res.data.data.reply
  }
  throw new Error(res.data.message)
}
```

---

## 5️⃣ 前端配置文件

建议创建统一的API配置文件：

**文件路径**: `src/utils/request.ts`

```typescript
// API基础配置
export const BASE_URL = 'https://your-api-domain.com/api/v1'

// 通用请求封装
export async function request<T = any>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  needAuth?: boolean
}): Promise<T> {
  const { url, method = 'GET', data, needAuth = true } = options
  
  const header: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (needAuth) {
    const token = uni.getStorageSync('token')
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }
  }
  
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header,
      success: (res: any) => {
        if (res.data.code === 200) {
          resolve(res.data.data)
        } else if (res.data.code === 401) {
          // Token过期，跳转登录
          uni.removeStorageSync('token')
          uni.removeStorageSync('userInfo')
          uni.redirectTo({ url: '/pages/login/index' })
          reject(new Error('登录已过期'))
        } else {
          uni.showToast({
            title: res.data.message || '请求失败',
            icon: 'none'
          })
          reject(new Error(res.data.message))
        }
      },
      fail: (err) => {
        uni.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

// 文件上传封装
export async function uploadFile(filePath: string, fileName?: string): Promise<any> {
  const token = uni.getStorageSync('token')
  
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}/files/upload`,
      filePath,
      name: 'file',
      formData: fileName ? { fileName } : {},
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        const data = JSON.parse(res.data)
        if (data.code === 200) {
          resolve(data.data)
        } else {
          reject(new Error(data.message))
        }
      },
      fail: reject
    })
  })
}
```

---

## 6️⃣ 数据库表结构建议

### users 用户表
```sql
CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,  -- 加密存储
  nickname VARCHAR(20) NOT NULL,
  avatar VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### files 文件表
```sql
CREATE TABLE files (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type ENUM('original', 'processed') NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT NOT NULL,
  original_file_id VARCHAR(50) DEFAULT NULL,  -- 处理后文件关联原文件
  upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  process_time TIMESTAMP DEFAULT NULL,
  status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 7️⃣ 接口汇总表

| 模块 | 方法 | 接口 | 说明 |
|-----|------|-----|-----|
| 认证 | POST | /auth/register | 用户注册 |
| 认证 | POST | /auth/login | 用户登录 |
| 认证 | GET | /auth/profile | 获取用户信息 |
| 认证 | POST | /auth/logout | 退出登录 |
| 文件 | POST | /files/upload | 上传Excel文件 |
| 文件 | POST | /files/process | 处理文件(汇总) |
| 文件 | GET | /files/download/:fileId | 获取下载链接 |
| 文件 | GET | /files/preview/:fileId | 预览文件数据 |
| 文件 | GET | /files/history | 获取历史记录 |
| 文件 | DELETE | /files/:fileId | 删除文件 |
| 文件 | DELETE | /files/history/clear | 清空历史 |
| AI | POST | /ai/chat | AI对话(可选) |

---

## 📝 备注

1. **JWT Token**: 建议设置24小时过期，支持刷新
2. **文件存储**: 建议使用云存储（阿里云OSS/腾讯云COS）
3. **Excel处理**: 后端可使用 Python(pandas/openpyxl) 或 Node.js(xlsx/exceljs)
4. **跨域配置**: 需配置CORS允许小程序域名
5. **安全性**: 
   - 密码使用bcrypt加密
   - 文件上传限制大小(建议10MB)
   - 限制文件类型(.xlsx/.xls)

---

*文档生成时间: 2026-02-11*
