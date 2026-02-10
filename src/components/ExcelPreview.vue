<script setup lang="ts">
import { ref, computed, watch } from 'vue'

// 显示状态
const show = defineModel<boolean>('show', { default: false })

// 表格数据
const props = defineProps<{
  data: any[]
}>()

// 表格列（从数据中提取）
const columns = computed(() => {
  if (!props.data || props.data.length === 0) return []
  return Object.keys(props.data[0])
})

// 关闭预览
function closePreview() {
  show.value = false
}
</script>

<template>
  <wd-popup 
    v-model="show"
    position="bottom"
    custom-style="height: 70vh; border-radius: 30rpx 30rpx 0 0;"
    :safe-area-inset-bottom="true"
  >
    <view class="preview-container">
      <!-- 头部 -->
      <view class="preview-header">
        <text class="preview-title">📊 表格预览</text>
        <view class="close-btn" @click="closePreview">
          <text>✕</text>
        </view>
      </view>
      
      <!-- 表格内容 -->
      <scroll-view class="preview-content" scroll-y scroll-x>
        <view v-if="data && data.length > 0" class="table-wrapper">
          <view class="table">
            <!-- 表头 -->
            <view class="table-header">
              <view 
                v-for="col in columns" 
                :key="col"
                class="table-cell header-cell"
              >
                <text>{{ col }}</text>
              </view>
            </view>
            
            <!-- 表体 -->
            <view 
              v-for="(row, rowIndex) in data" 
              :key="rowIndex"
              class="table-row"
              :class="{ odd: rowIndex % 2 === 1 }"
            >
              <view 
                v-for="col in columns" 
                :key="col"
                class="table-cell"
              >
                <text>{{ row[col] ?? '-' }}</text>
              </view>
            </view>
          </view>
        </view>
        
        <!-- 空数据 -->
        <view v-else class="empty-data">
          <text class="empty-icon">📭</text>
          <text class="empty-text">暂无数据</text>
        </view>
      </scroll-view>
      
      <!-- 底部信息 -->
      <view class="preview-footer">
        <text class="footer-info">共 {{ data?.length || 0 }} 条数据 · 左右滑动查看更多</text>
      </view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.preview-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #F5F7FA;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30rpx;
  background: #FFFFFF;
  border-bottom: 1rpx solid #E0E0E0;
  
  .preview-title {
    font-size: 34rpx;
    font-weight: bold;
    color: #333;
  }
  
  .close-btn {
    width: 60rpx;
    height: 60rpx;
    background: #F5F5F5;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    
    text {
      font-size: 30rpx;
      color: #666;
    }
  }
}

.preview-content {
  flex: 1;
  padding: 20rpx;
  overflow: auto;
  
  .table-wrapper {
    min-width: 100%;
    display: inline-block;
  }
  
  .table {
    background: #FFFFFF;
    border-radius: 16rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  }
  
  .table-header {
    display: flex;
    background: linear-gradient(135deg, #4CAF50, #8BC34A);
    
    .header-cell {
      text {
        color: #FFFFFF;
        font-weight: bold;
      }
    }
  }
  
  .table-row {
    display: flex;
    border-bottom: 1rpx solid #F0F0F0;
    
    &:last-child {
      border-bottom: none;
    }
    
    &.odd {
      background: #FAFAFA;
    }
    
    &:active {
      background: #E8F5E9;
    }
  }
  
  .table-cell {
    min-width: 200rpx;
    padding: 24rpx 20rpx;
    display: flex;
    align-items: center;
    border-right: 1rpx solid #F0F0F0;
    
    &:last-child {
      border-right: none;
    }
    
    text {
      font-size: 26rpx;
      color: #333;
      white-space: nowrap;
    }
  }
  
  .empty-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 0;
    
    .empty-icon {
      font-size: 80rpx;
      margin-bottom: 20rpx;
    }
    
    .empty-text {
      font-size: 28rpx;
      color: #999;
    }
  }
}

.preview-footer {
  padding: 20rpx 30rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #FFFFFF;
  border-top: 1rpx solid #E0E0E0;
  text-align: center;
  
  .footer-info {
    font-size: 24rpx;
    color: #999;
  }
}
</style>
