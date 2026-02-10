import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import Components from '@uni-helper/vite-plugin-uni-components'
import { WotResolver } from '@uni-helper/vite-plugin-uni-components/resolvers'
import { ZPagingResolver } from '@uni-helper/vite-plugin-uni-components/resolvers'
import { UniEchartsResolver } from 'uni-echarts/resolver'
import { UniEcharts } from 'uni-echarts/vite'
import Uni from '@uni-helper/plugin-uni'
import UnoCSS from 'unocss/vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    // https://uni-helper.js.org/vite-plugin-uni-components
    Components({
      dts: true,
      resolvers: [UniEchartsResolver(), ZPagingResolver(), WotResolver()]
    }),
    // https://uni-echarts.xiaohe.ink
    UniEcharts(),
    // https://uni-helper.js.org/plugin-uni
    Uni(),
    UnoCSS(),
  ],
  build: {
    target: "es6",
    cssTarget: "chrome61"
  },
  optimizeDeps: {
    exclude: [
      "vue-demi",
      "uni-echarts"
    ]
  }  
})


