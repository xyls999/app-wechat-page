<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// 显示状态
const show = defineModel<boolean>('show', { default: false })

// 聊天消息
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  loading?: boolean
}

const messages = ref<Message[]>([])
const inputText = ref('')
const isLoading = ref(false)
const scrollViewId = ref('msg-bottom')

// DeepSeek API配置
const API_KEY = 'sk-18c506a09d9e46069b769b46b994ab7b'
const API_URL = 'https://api.deepseek.com/chat/completions'

// 预设问候语
const greetings = [
  '您好！有什么可以帮您的吗？',
  '需要我帮您解答什么问题？',
  '随时为您服务~'
]

// 快捷问题
const quickQuestions = [
  '如何上传表格？',
  '表格处理需要多久？',
  '支持什么格式的文件？',
  '如何下载处理结果？'
]

// 打开AI助手
function openAssistant() {
  show.value = true
  if (messages.value.length === 0) {
    // 添加欢迎消息
    messages.value.push({
      id: 'welcome',
      role: 'assistant',
      content: `${userStore.userHonorific}，您好！我是您的智能助手小智~\n\n有任何问题都可以问我哦，我会尽力帮助您！😊`,
      timestamp: Date.now()
    })
  }
}

// 关闭AI助手
function closeAssistant() {
  show.value = false
}

// 发送消息
async function sendMessage(text?: string) {
  const messageText = text || inputText.value.trim()
  if (!messageText || isLoading.value) return
  
  // 添加用户消息
  const userMsg: Message = {
    id: 'user_' + Date.now(),
    role: 'user',
    content: messageText,
    timestamp: Date.now()
  }
  messages.value.push(userMsg)
  inputText.value = ''
  
  // 添加加载消息
  const loadingMsg: Message = {
    id: 'loading_' + Date.now(),
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    loading: true
  }
  messages.value.push(loadingMsg)
  
  isLoading.value = true
  scrollToBottom()
  
  try {
    // 调用DeepSeek API
    const response = await callDeepSeekAPI(messageText)
    
    // 移除加载消息
    messages.value = messages.value.filter(m => !m.loading)
    
    // 添加AI回复
    const assistantMsg: Message = {
      id: 'assistant_' + Date.now(),
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    }
    messages.value.push(assistantMsg)
    
  } catch (error) {
    // 移除加载消息
    messages.value = messages.value.filter(m => !m.loading)
    
    // 添加错误消息
    messages.value.push({
      id: 'error_' + Date.now(),
      role: 'assistant',
      content: `${userStore.userHonorific}，抱歉，网络似乎有点问题，请稍后再试~`,
      timestamp: Date.now()
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

// 调用DeepSeek API
async function callDeepSeekAPI(message: string): Promise<string> {
  // 构建上下文
  const contextMessages = messages.value
    .filter(m => !m.loading)
    .slice(-10)
    .map(m => ({
      role: m.role,
      content: m.content
    }))
  
  // 添加系统提示
  const systemPrompt = {
    role: 'system',
    content: `你是一个友好、专业的助手，名字叫"小智"。你在一个帮助用户处理Excel表格的微信小程序中工作。
用户的称呼是"${userStore.userHonorific}"。
请用温暖、礼貌的语气回复用户，多使用敬语，比如"您"。
回复要简洁明了，如果是关于表格处理的问题，要详细解答。
可以适当使用表情符号让对话更亲切。`
  }
  
  try {
    // 使用uni.request调用API
    const res = await new Promise<any>((resolve, reject) => {
      uni.request({
        url: API_URL,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        data: {
          model: 'deepseek-chat',
          messages: [systemPrompt, ...contextMessages, { role: 'user', content: message }],
          temperature: 0.7,
          max_tokens: 1000
        },
        success: (res) => resolve(res),
        fail: (err) => reject(err)
      })
    })
    
    if (res.statusCode === 200 && res.data?.choices?.[0]?.message?.content) {
      return res.data.choices[0].message.content
    } else {
      throw new Error('API返回错误')
    }
    
  } catch (error) {
    console.error('DeepSeek API调用失败:', error)
    
    // 返回离线回复
    return getOfflineResponse(message)
  }
}

// 离线回复（API失败时使用）
function getOfflineResponse(message: string): string {
  const lowerMsg = message.toLowerCase()
  
  if (lowerMsg.includes('上传') || lowerMsg.includes('选择文件')) {
    return `${userStore.userHonorific}，上传表格很简单哦~\n\n1️⃣ 进入"表格处理"功能\n2️⃣ 点击上传区域\n3️⃣ 选择您的Excel文件（.xlsx格式）\n4️⃣ 确认后点击"开始处理"\n\n有任何问题随时问我！😊`
  }
  
  if (lowerMsg.includes('多久') || lowerMsg.includes('时间')) {
    return `${userStore.userHonorific}，处理时间取决于表格的大小~\n\n一般情况下：\n📄 小型表格（<100行）：几秒钟\n📊 中型表格（100-1000行）：约30秒\n📈 大型表格（>1000行）：1-2分钟\n\n请您耐心等待，我们会尽快处理好！💪`
  }
  
  if (lowerMsg.includes('格式') || lowerMsg.includes('支持')) {
    return `${userStore.userHonorific}，目前支持的文件格式：\n\n✅ .xlsx（推荐）\n✅ .xls\n\n建议您使用 .xlsx 格式，处理效果更好哦~📊`
  }
  
  if (lowerMsg.includes('下载')) {
    return `${userStore.userHonorific}，下载处理结果很简单~\n\n1️⃣ 等待处理完成\n2️⃣ 在结果页面点击"下载"按钮\n3️⃣ 文件会保存到您的手机\n\n处理后的文件也会自动保存到历史记录，方便您随时查看！📁`
  }
  
  if (lowerMsg.includes('历史') || lowerMsg.includes('记录')) {
    return `${userStore.userHonorific}，您可以在首页点击"历史记录"查看所有处理过的文件~\n\n包括：\n📤 您上传的原始文件\n📥 处理后的结果文件\n\n系统会自动保存最近20条记录哦！`
  }
  
  return `${userStore.userHonorific}，感谢您的提问！\n\n我是小智，您的智能助手~目前我主要帮助您解答关于表格处理的问题。\n\n如果有其他问题，欢迎继续问我哦！😊`
}

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    scrollViewId.value = 'msg-' + Date.now()
  })
}

// 清空聊天
function clearChat() {
  uni.showModal({
    title: '提示',
    content: '确定要清空聊天记录吗？',
    confirmColor: '#4CAF50',
    success: (res) => {
      if (res.confirm) {
        messages.value = []
        // 重新添加欢迎消息
        messages.value.push({
          id: 'welcome_new',
          role: 'assistant',
          content: `${userStore.userHonorific}，聊天已清空~有什么新问题吗？😊`,
          timestamp: Date.now()
        })
      }
    }
  })
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <!-- 悬浮按钮 -->
  <view class="ai-float-btn" @click="openAssistant">
    <view class="float-btn-inner">
      <text class="btn-emoji">🤖</text>
    </view>
    <view class="float-btn-pulse"></view>
  </view>
  
  <!-- 聊天弹窗 -->
  <wd-popup 
    v-model="show" 
    position="bottom"
    custom-style="height: 85vh; border-radius: 30rpx 30rpx 0 0;"
    :safe-area-inset-bottom="true"
  >
    <view class="chat-container">
      <!-- 聊天头部 -->
      <view class="chat-header">
        <view class="header-info">
          <view class="ai-avatar">
            <text>🤖</text>
          </view>
          <view class="ai-info">
            <text class="ai-name">智能助手小智</text>
            <text class="ai-status">在线 · 随时为您服务</text>
          </view>
        </view>
        <view class="header-actions">
          <view class="action-btn" @click="clearChat">
            <text>🗑️</text>
          </view>
          <view class="action-btn close" @click="closeAssistant">
            <text>✕</text>
          </view>
        </view>
      </view>
      
      <!-- 聊天内容 -->
      <scroll-view 
        class="chat-content"
        scroll-y
        :scroll-into-view="scrollViewId"
        scroll-with-animation
      >
        <!-- 消息列表 -->
        <view 
          v-for="msg in messages" 
          :key="msg.id"
          class="message-item"
          :class="msg.role"
        >
          <view v-if="msg.role === 'assistant'" class="msg-avatar">
            <text>🤖</text>
          </view>
          
          <view class="msg-content">
            <view v-if="msg.loading" class="loading-dots">
              <view class="dot"></view>
              <view class="dot"></view>
              <view class="dot"></view>
            </view>
            <text v-else class="msg-text">{{ msg.content }}</text>
            <text class="msg-time">{{ formatTime(msg.timestamp) }}</text>
          </view>
          
          <view v-if="msg.role === 'user'" class="msg-avatar user">
            <text>😊</text>
          </view>
        </view>
        
        <!-- 快捷问题 -->
        <view v-if="messages.length <= 1" class="quick-questions">
          <text class="quick-title">您可能想问：</text>
          <view class="quick-list">
            <view 
              v-for="q in quickQuestions" 
              :key="q"
              class="quick-item"
              @click="sendMessage(q)"
            >
              <text>{{ q }}</text>
            </view>
          </view>
        </view>
        
        <view :id="scrollViewId" class="scroll-anchor"></view>
      </scroll-view>
      
      <!-- 输入区域 -->
      <view class="chat-input">
        <view class="input-wrapper">
          <input 
            v-model="inputText"
            class="input-field"
            placeholder="请输入您的问题..."
            :disabled="isLoading"
            confirm-type="send"
            @confirm="sendMessage()"
          />
          <view 
            class="send-btn" 
            :class="{ active: inputText.trim() && !isLoading }"
            @click="sendMessage()"
          >
            <text v-if="isLoading">⏳</text>
            <text v-else>📤</text>
          </view>
        </view>
        <view class="input-hint">
          <text>按回车发送 · AI回复仅供参考</text>
        </view>
      </view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.ai-float-btn {
  position: fixed;
  right: 28rpx;
  bottom: 180rpx;
  z-index: 999;
  
  .float-btn-inner {
    width: 100rpx;
    height: 100rpx;
    background: linear-gradient(135deg, #5B8C5A, #7AA879);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8rpx 28rpx rgba(91, 140, 90, 0.4);
    position: relative;
    z-index: 2;
    
    .btn-emoji {
      font-size: 44rpx;
    }
  }
  
  .float-btn-pulse {
    position: absolute;
    top: 0;
    left: 0;
    width: 100rpx;
    height: 100rpx;
    background: #5B8C5A;
    border-radius: 50%;
    animation: pulse 2s ease-out infinite;
    z-index: 1;
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #F0F4F0 0%, #E8EDE8 100%);
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 28rpx;
  background: linear-gradient(135deg, #5B8C5A 0%, #7AA879 100%);
  
  .header-info {
    display: flex;
    align-items: center;
    
    .ai-avatar {
      width: 72rpx;
      height: 72rpx;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      
      text {
        font-size: 36rpx;
      }
    }
    
    .ai-info {
      margin-left: 16rpx;
      display: flex;
      flex-direction: column;
      
      .ai-name {
        font-size: 30rpx;
        font-weight: 600;
        color: #FFFFFF;
      }
      
      .ai-status {
        font-size: 22rpx;
        color: rgba(255, 255, 255, 0.8);
        margin-top: 2rpx;
      }
    }
  }
  
  .header-actions {
    display: flex;
    gap: 16rpx;
    
    .action-btn {
      width: 56rpx;
      height: 56rpx;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      
      text {
        font-size: 26rpx;
        color: #FFFFFF;
      }
      
      &.close text {
        font-size: 24rpx;
        font-weight: bold;
      }
    }
  }
}

.chat-content {
  flex: 1;
  padding: 16rpx;
  overflow: hidden;
  
  .message-item {
    display: flex;
    align-items: flex-start;
    margin-bottom: 24rpx;
    
    &.user {
      flex-direction: row-reverse;
      
      .msg-content {
        background: linear-gradient(135deg, #5B8C5A, #7AA879);
        margin-right: 12rpx;
        margin-left: 60rpx;
        
        .msg-text {
          color: #FFFFFF;
        }
        
        .msg-time {
          color: rgba(255, 255, 255, 0.7);
        }
      }
    }
    
    &.assistant {
      .msg-content {
        background: rgba(255, 255, 255, 0.9);
        margin-left: 12rpx;
        margin-right: 60rpx;
      }
    }
    
    .msg-avatar {
      width: 64rpx;
      height: 64rpx;
      background: rgba(255, 255, 255, 0.85);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      
      text {
        font-size: 32rpx;
      }
      
      &.user {
        background: rgba(91, 140, 90, 0.15);
      }
    }
    
    .msg-content {
      max-width: 70%;
      padding: 20rpx;
      border-radius: 20rpx;
      
      .msg-text {
        font-size: 26rpx;
        color: #3D5A3D;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
      }
      
      .msg-time {
        display: block;
        font-size: 20rpx;
        color: #7A9A7A;
        margin-top: 8rpx;
        text-align: right;
      }
      
      .loading-dots {
        display: flex;
        gap: 8rpx;
        padding: 8rpx 0;
        
        .dot {
          width: 14rpx;
          height: 14rpx;
          background: #5B8C5A;
          border-radius: 50%;
          animation: bounce 1.4s ease-in-out infinite;
          
          &:nth-child(1) { animation-delay: 0s; }
          &:nth-child(2) { animation-delay: 0.2s; }
          &:nth-child(3) { animation-delay: 0.4s; }
        }
      }
    }
  }
  
  .quick-questions {
    margin-top: 16rpx;
    padding: 16rpx;
    
    .quick-title {
      font-size: 24rpx;
      color: #7A9A7A;
      display: block;
      margin-bottom: 12rpx;
    }
    
    .quick-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12rpx;
      
      .quick-item {
        background: rgba(255, 255, 255, 0.85);
        padding: 14rpx 20rpx;
        border-radius: 24rpx;
        border: 2rpx solid rgba(91, 140, 90, 0.2);
        
        text {
          font-size: 24rpx;
          color: #5B8C5A;
        }
        
        &:active {
          background: rgba(91, 140, 90, 0.1);
        }
      }
    }
  }
  
  .scroll-anchor {
    height: 1rpx;
  }
}

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10rpx); }
}

.chat-input {
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.95);
  
  .input-wrapper {
    display: flex;
    align-items: center;
    background: rgba(240, 244, 240, 0.8);
    border-radius: 36rpx;
    padding: 0 16rpx;
    border: 2rpx solid rgba(91, 140, 90, 0.15);
    
    .input-field {
      flex: 1;
      height: 72rpx;
      font-size: 26rpx;
      color: #3D5A3D;
    }
    
    .send-btn {
      width: 64rpx;
      height: 64rpx;
      background: rgba(91, 140, 90, 0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
      
      text {
        font-size: 28rpx;
      }
      
      &.active {
        background: linear-gradient(135deg, #5B8C5A, #7AA879);
      }
    }
  }
  
  .input-hint {
    text-align: center;
    margin-top: 10rpx;
    
    text {
      font-size: 20rpx;
      color: #A8C8A8;
    }
  }
}
</style>
