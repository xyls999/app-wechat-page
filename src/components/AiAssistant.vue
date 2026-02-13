<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const show = defineModel<boolean>('show', { default: false })

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  loading?: boolean
}

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const isLoading = ref(false)
const scrollViewId = ref('anchor-init')

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_API_KEY = 'sk-792891d2f7194ba1a9f6f36ee3084310'
const AI_TIMEOUT = 20000

const greetings = [
  '您好！今天想处理什么表格问题？',
  '您好，我可以帮您定位上传和处理失败原因。',
  '您好，有什么问题可以直接告诉我。'
]

const quickQuestions = [
  '为什么上传后处理失败？',
  '手机端如何选择本地Excel？',
  '支持哪些Excel格式？',
  '处理完成后怎么下载？'
]

function openAssistant() {
  show.value = true
  if (messages.value.length > 0) return

  const greeting = greetings[Math.floor(Math.random() * greetings.length)] || '您好'
  messages.value.push({
    id: 'welcome_' + Date.now(),
    role: 'assistant',
    content: `${userStore.userHonorific}，${greeting}`,
    timestamp: Date.now()
  })
}

function closeAssistant() {
  show.value = false
}

async function sendMessage(text?: string) {
  const messageText = (text || inputText.value).trim()
  if (!messageText || isLoading.value) return

  messages.value.push({
    id: 'u_' + Date.now(),
    role: 'user',
    content: messageText,
    timestamp: Date.now()
  })
  inputText.value = ''

  messages.value.push({
    id: 'l_' + Date.now(),
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    loading: true
  })

  isLoading.value = true
  scrollToBottom()

  try {
    const reply = await callDeepSeekAPI(messageText)
    messages.value = messages.value.filter(m => !m.loading)
    messages.value.push({
      id: 'a_' + Date.now(),
      role: 'assistant',
      content: reply,
      timestamp: Date.now()
    })
  } catch (error) {
    messages.value = messages.value.filter(m => !m.loading)
    messages.value.push({
      id: 'e_' + Date.now(),
      role: 'assistant',
      content: `${userStore.userHonorific}，AI请求失败，已切换本地答复：\n${getOfflineResponse(messageText)}`,
      timestamp: Date.now()
    })
  } finally {
    isLoading.value = false
    scrollToBottom()
  }
}

async function callDeepSeekAPI(message: string): Promise<string> {
  const context = messages.value
    .filter(m => !m.loading)
    .slice(-8)
    .map(m => ({ role: m.role, content: m.content }))

  const systemPrompt = {
    role: 'system',
    content: `你是一个Excel移动端助手。用户称呼是“${userStore.userHonorific}”。回答要简洁、步骤化、可执行。`
  }

  try {
    const res = await new Promise<UniApp.RequestSuccessCallbackResult>((resolve, reject) => {
      uni.request({
        url: DEEPSEEK_API_URL,
        method: 'POST',
        timeout: AI_TIMEOUT,
        header: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`
        },
        data: {
          model: 'deepseek-chat',
          messages: [systemPrompt, ...context, { role: 'user', content: message }],
          temperature: 0.5,
          max_tokens: 1024
        },
        success: resolve,
        fail: reject
      })
    })

    const payload: any = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
    const content = payload?.choices?.[0]?.message?.content
    if (res.statusCode === 200 && content) {
      return content
    }

    throw new Error(payload?.error?.message || payload?.message || 'AI返回为空')
  } catch (error) {
    console.error('DeepSeek 请求失败:', error)
    return getOfflineResponse(message)
  }
}

function getOfflineResponse(message: string): string {
  const q = message.toLowerCase()

  if (q.includes('上传') || q.includes('选择')) {
    return `${userStore.userHonorific}，请按这3步操作：\n1. 点击“选择文件”\n2. 选择 .xlsx/.xls\n3. 点击“开始处理”`
  }
  if (q.includes('失败') || q.includes('报错')) {
    return `${userStore.userHonorific}，请先检查：\n1. 文件是否为 .xlsx/.xls\n2. 表头是否包含“会计月”\n3. 文件是否被其它App占用`
  }
  if (q.includes('下载')) {
    return `${userStore.userHonorific}，处理完成后点“下载”即可。小程序里会直接打开文档。`
  }
  if (q.includes('格式') || q.includes('支持')) {
    return `${userStore.userHonorific}，目前支持 .xlsx 和 .xls，推荐 .xlsx。`
  }
  return `${userStore.userHonorific}，我可以帮您定位上传失败、处理失败、下载失败。请把具体报错发给我。`
}

function scrollToBottom() {
  nextTick(() => {
    scrollViewId.value = 'anchor-' + Date.now()
  })
}

function clearChat() {
  uni.showModal({
    title: '提示',
    content: '确定清空聊天记录吗？',
    confirmColor: '#3C6E84',
    success: (res) => {
      if (!res.confirm) return
      messages.value = []
      openAssistant()
    }
  })
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <view class="ai-float-btn" @click="openAssistant">
    <view class="float-inner">
      <text class="emoji">AI</text>
    </view>
  </view>

  <wd-popup
    v-model="show"
    position="bottom"
    custom-style="height: 86vh; border-radius: 28rpx 28rpx 0 0;"
    :safe-area-inset-bottom="true"
  >
    <view class="chat-wrap">
      <view class="chat-header">
        <text class="title">智能助手</text>
        <view class="header-actions">
          <view class="icon-btn" @click="clearChat">清空</view>
          <view class="icon-btn" @click="closeAssistant">关闭</view>
        </view>
      </view>

      <scroll-view class="chat-content" scroll-y :scroll-into-view="scrollViewId" scroll-with-animation>
        <view v-for="m in messages" :key="m.id" class="msg-row" :class="m.role">
          <view class="msg-box">
            <view v-if="m.loading" class="loading">思考中...</view>
            <text v-else class="msg-text">{{ m.content }}</text>
            <text class="msg-time">{{ formatTime(m.timestamp) }}</text>
          </view>
        </view>

        <view v-if="messages.length <= 1" class="quick-wrap">
          <view v-for="q in quickQuestions" :key="q" class="quick-item" @click="sendMessage(q)">
            <text>{{ q }}</text>
          </view>
        </view>

        <view :id="scrollViewId" class="anchor"></view>
      </scroll-view>

      <view class="chat-input">
        <input
          v-model="inputText"
          class="input"
          placeholder="输入问题后发送"
          confirm-type="send"
          :disabled="isLoading"
          @confirm="sendMessage()"
        />
        <view class="send-btn" :class="{ active: inputText.trim() && !isLoading }" @click="sendMessage()">
          <text>{{ isLoading ? '...' : '发送' }}</text>
        </view>
      </view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.ai-float-btn {
  position: fixed;
  right: 26rpx;
  bottom: 170rpx;
  z-index: 999;
}

.float-inner {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #2f6b84, #5694ae);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 26rpx rgba(47, 107, 132, 0.35);
}

.emoji {
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
}

.chat-wrap {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #eef6fa 0%, #f6fafc 100%);
}

.chat-header {
  height: 96rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #2f6b84, #5694ae);
}

.title {
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 14rpx;
}

.icon-btn {
  padding: 10rpx 16rpx;
  border-radius: 14rpx;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 22rpx;
}

.chat-content {
  flex: 1;
  padding: 18rpx;
}

.msg-row {
  margin-bottom: 18rpx;
  display: flex;
}

.msg-row.user {
  justify-content: flex-end;
}

.msg-row.assistant {
  justify-content: flex-start;
}

.msg-box {
  max-width: 78%;
  border-radius: 18rpx;
  padding: 16rpx;
  background: #fff;
}

.msg-row.user .msg-box {
  background: linear-gradient(135deg, #2f6b84, #5694ae);
}

.msg-text {
  font-size: 25rpx;
  line-height: 1.55;
  color: #2d4f5d;
  white-space: pre-wrap;
}

.msg-row.user .msg-text {
  color: #fff;
}

.msg-time {
  display: block;
  margin-top: 6rpx;
  font-size: 19rpx;
  color: #86a6b4;
  text-align: right;
}

.msg-row.user .msg-time {
  color: rgba(255, 255, 255, 0.75);
}

.loading {
  font-size: 24rpx;
  color: #5d8090;
}

.quick-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 8rpx;
}

.quick-item {
  padding: 12rpx 16rpx;
  border-radius: 18rpx;
  background: rgba(47, 107, 132, 0.1);
  border: 1rpx solid rgba(47, 107, 132, 0.2);
}

.quick-item text {
  font-size: 22rpx;
  color: #2f6b84;
}

.anchor {
  height: 1rpx;
}

.chat-input {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid rgba(0, 0, 0, 0.05);
}

.input {
  flex: 1;
  height: 72rpx;
  border-radius: 36rpx;
  background: #f1f6f9;
  padding: 0 22rpx;
  font-size: 25rpx;
  color: #274856;
}

.send-btn {
  min-width: 90rpx;
  height: 72rpx;
  padding: 0 20rpx;
  border-radius: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(47, 107, 132, 0.2);
}

.send-btn.active {
  background: linear-gradient(135deg, #2f6b84, #5694ae);
}

.send-btn text {
  color: #fff;
  font-size: 24rpx;
}
</style>
