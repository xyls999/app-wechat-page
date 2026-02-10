<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { useUserStore } from '@/stores/user'
import { useFilesStore } from '@/stores/files'

onLaunch(() => {
  console.log('App Launch')
  
  // 初始化用户状态
  const userStore = useUserStore()
  userStore.initFromStorage()
  
  // 初始化文件历史
  const filesStore = useFilesStore()
  filesStore.initFromStorage()
})

onShow(() => {
  console.log('App Show')
})
</script>

<style>
/* 全局样式 */
page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 28rpx;
  color: #333;
  background-color: #F5F7FA;
  box-sizing: border-box;
}

view, text, input, button, image {
  box-sizing: border-box;
}

/* 安全区域适配 */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
