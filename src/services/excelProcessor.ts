/**
 * 前端Excel处理服务
 * 当后端超时时，使用前端进行Excel汇总处理
 */
import * as XLSX from 'xlsx'

export interface ProcessResult {
  success: boolean
  message: string
  data?: any[]
  fileName?: string
  blob?: Blob
  arrayBuffer?: ArrayBuffer
}

/**
 * 读取Excel文件
 */
function parseExcelFromArrayBuffer(buffer: ArrayBuffer): any[][] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
}

function toArrayBuffer(data: any): ArrayBuffer {
  if (data instanceof ArrayBuffer) {
    return data
  }

  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    return bytes.slice().buffer
  }

  if (typeof data === 'string') {
    const bytes = new Uint8Array(data.length)
    for (let i = 0; i < data.length; i++) {
      bytes[i] = data.charCodeAt(i) & 0xff
    }
    return bytes.buffer
  }

  throw new Error('Excel二进制格式不受支持')
}

function parseExcelFromReadData(data: any): any[][] {
  if (data instanceof ArrayBuffer) {
    return parseExcelFromArrayBuffer(data)
  }

  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    return parseExcelFromArrayBuffer(bytes.slice().buffer)
  }

  if (typeof data === 'string') {
    const workbook = XLSX.read(data, { type: 'binary' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
  }

  throw new Error('文件数据格式无效')
}

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

// #ifdef MP-WEIXIN
async function ensureReadableMpFilePath(filePath: string): Promise<string> {
  const fs = uni.getFileSystemManager()
  const wxRef: any = typeof wx !== 'undefined' ? wx : null
  const userDataPath = wxRef?.env?.USER_DATA_PATH || ''
  const extension = (filePath.match(/\.(xlsx|xls)$/i)?.[0] || '.xlsx').toLowerCase()

  const candidates = Array.from(new Set([filePath, decodePath(filePath)].filter(Boolean)))

  const canAccess = (path: string) => new Promise<boolean>((resolve) => {
    fs.access({
      path,
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
    return filePath
  }

  for (const sourcePath of candidates) {
    const destPath = `${userDataPath}/excel_in_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`
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

  return filePath
}
// #endif

export function readExcelFile(file: File): Promise<any[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer
        resolve(parseExcelFromArrayBuffer(data))
      } catch (error) {
        reject(new Error('Excel文件解析失败'))
      }
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * 从本地路径读取Excel（微信小程序/App）
 */
export async function readExcelFileByPath(filePath: string): Promise<any[][]> {
  if (!filePath) throw new Error('文件路径无效')

  // #ifdef MP-WEIXIN
  const readablePath = await ensureReadableMpFilePath(filePath)
  return await new Promise<any[][]>((resolve, reject) => {
    const fs = uni.getFileSystemManager()
    fs.readFile({
      filePath: readablePath,
      success: (res: any) => {
        try {
          resolve(parseExcelFromReadData(res.data))
        } catch {
          reject(new Error('Excel解析失败'))
        }
      },
      fail: (err: any) => {
        const errText = err?.errMsg || '读取文件失败'
        reject(new Error(`${errText}，请优先从微信会话选择文件`))
      }
    })
  })
  // #endif

  // #ifdef APP-PLUS
  return await new Promise<any[][]>((resolve, reject) => {
    const plusRef: any = (globalThis as any).plus
    if (!plusRef?.io) {
      reject(new Error('当前环境不支持本地读取'))
      return
    }

    plusRef.io.resolveLocalFileSystemURL(
      filePath,
      (entry: any) => {
        entry.file(
          (file: any) => {
            try {
              const reader = new FileReader()
              reader.onload = (e: any) => {
                try {
                  const buffer = e.target?.result as ArrayBuffer
                  resolve(parseExcelFromArrayBuffer(buffer))
                } catch {
                  reject(new Error('Excel解析失败'))
                }
              }
              reader.onerror = () => reject(new Error('读取文件失败'))
              reader.readAsArrayBuffer(file)
            } catch {
              reject(new Error('读取文件失败'))
            }
          },
          () => reject(new Error('读取文件失败'))
        )
      },
      () => reject(new Error('读取文件失败'))
    )
  })
  // #endif

  throw new Error('当前平台不支持按路径读取文件')
}

/**
 * 查找会计月列的索引
 */
function findAccountingMonthIndex(headers: string[]): number {
  const possibleNames = ['会计月', '会计期间', '会计月份', '月份', '期间']
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').trim()
    if (possibleNames.some(name => header.includes(name))) {
      return i
    }
  }
  return -1
}

/**
 * 判断值是否为数字
 */
function isNumeric(value: any): boolean {
  if (value === null || value === undefined || value === '') return false
  const num = Number(value)
  return !isNaN(num) && isFinite(num)
}

/**
 * 判断列名是否应该被排除（不参与汇总）
 * 排除：编码、编号、ID、序号等标识类列
 */
function shouldExcludeColumn(headerName: string): boolean {
  const excludeKeywords = [
    '编码', '编号', 'ID', 'id', 'Id', '序号', '代码', 
    '供应商', '客户', '单品', '物料', '产品', '商品',
    '名称', '规格', '单位', '企业', '厂家', '品名'
  ]
  return excludeKeywords.some(keyword => headerName.includes(keyword))
}

/**
 * 判断列名是否应该被汇总（数值类列）
 * 包含：数量、金额、数、价、额等
 */
function shouldIncludeColumn(headerName: string): boolean {
  const includeKeywords = [
    '数量', '金额', '数', '价', '额', '量', '率',
    '期初', '期末', '入库', '出库', '退货', '发货',
    '成本', '利润', '收入', '支出', '合计', '总'
  ]
  return includeKeywords.some(keyword => headerName.includes(keyword))
}

/**
 * 按会计月汇总Excel数据
 * @param rawData 原始数据（包含表头）
 * @returns 汇总后的数据
 */
export function summarizeByAccountingMonth(rawData: any[][]): ProcessResult {
  if (!rawData || rawData.length < 2) {
    return { success: false, message: '数据为空或格式不正确' }
  }

  // 获取表头
  const headers = rawData[0].map(h => String(h || '').trim())
  
  console.log('=== Excel处理调试信息 ===')
  console.log('表头:', headers)
  console.log('数据行数:', rawData.length - 1)
  
  // 查找会计月列
  const monthIndex = findAccountingMonthIndex(headers)
  if (monthIndex === -1) {
    return { success: false, message: '未找到"会计月"列，请确认表格格式' }
  }
  console.log('会计月列索引:', monthIndex, '列名:', headers[monthIndex])

  // 找出会计月之后的所有数值列（排除编码类列）
  const numericColumns: number[] = []
  const numericHeaders: string[] = []
  
  // 检查每一列是否为数值列（从会计月之后开始）
  for (let col = monthIndex + 1; col < headers.length; col++) {
    const headerName = headers[col] || ''
    
    // 排除编码/ID类列
    if (shouldExcludeColumn(headerName)) {
      console.log(`排除列: ${headerName} (编码/ID类)`)
      continue
    }
    
    // 优先检查列名是否包含数值类关键词
    const isValueColumn = shouldIncludeColumn(headerName)
    
    let hasNumericValue = false
    // 检查数据行中是否有数值
    for (let row = 1; row < Math.min(rawData.length, 100); row++) {
      if (rawData[row] && isNumeric(rawData[row][col])) {
        hasNumericValue = true
        break
      }
    }
    
    // 只有同时满足：有数值 且 列名包含数值关键词 才汇总
    if (hasNumericValue && isValueColumn) {
      numericColumns.push(col)
      numericHeaders.push(headerName || `列${col + 1}`)
    } else if (hasNumericValue && !isValueColumn) {
      console.log(`排除列: ${headerName} (数值但非汇总类)`)
    }
  }
  
  console.log('识别到的数值列:', numericHeaders)

  if (numericColumns.length === 0) {
    return { success: false, message: '未找到可汇总的数值列' }
  }

  // 按会计月分组汇总
  const monthlyData: Map<string, number[]> = new Map()
  const monthlyRowCount: Map<string, number> = new Map() // 记录每个月份有多少行
  
  // 打印前几行原始数据用于调试
  console.log('=== 原始数据前5行 ===')
  for (let row = 1; row < Math.min(rawData.length, 6); row++) {
    const rowData = rawData[row]
    const month = rowData[monthIndex]
    console.log(`行${row}: 会计月=${month}`, rowData.slice(monthIndex, monthIndex + 10))
  }
  
  for (let row = 1; row < rawData.length; row++) {
    const rowData = rawData[row]
    if (!rowData || rowData.length === 0) continue
    
    let month = String(rowData[monthIndex] || '').trim()
    if (!month) continue
    
    // 标准化会计月格式（如果是数字则转为字符串）
    if (/^\d+$/.test(month)) {
      // 保持原格式
    } else if (/^\d{4}[-\/]\d{1,2}$/.test(month)) {
      // 转换 2025-01 或 2025/01 格式
      month = month.replace(/[-\/]/g, '')
    }
    
    // 初始化或获取该月份的汇总数组
    if (!monthlyData.has(month)) {
      monthlyData.set(month, new Array(numericColumns.length).fill(0))
      monthlyRowCount.set(month, 0)
    }
    
    monthlyRowCount.set(month, (monthlyRowCount.get(month) || 0) + 1)
    
    const sums = monthlyData.get(month)!
    
    // 累加每个数值列
    numericColumns.forEach((colIndex, i) => {
      const value = rowData[colIndex]
      if (isNumeric(value)) {
        sums[i] += Number(value)
      }
    })
  }
  
  // 打印每个月份的行数
  console.log('=== 每个会计月的数据行数 ===')
  monthlyRowCount.forEach((count, month) => {
    console.log(`${month}: ${count}行`)
  })

  // 生成结果数据
  const resultHeaders = ['会计月', ...numericHeaders]
  const resultData: any[][] = [resultHeaders]
  
  // 按会计月排序
  const sortedMonths = Array.from(monthlyData.keys()).sort()
  
  // 生成完整的12个月数据（如果原数据是年度数据）
  const allMonths = generateAllMonths(sortedMonths)
  
  allMonths.forEach(month => {
    const sums = monthlyData.get(month) || new Array(numericColumns.length).fill(0)
    // 保留两位小数
    const roundedSums = sums.map(v => Math.round(v * 100) / 100)
    resultData.push([month, ...roundedSums])
  })

  return {
    success: true,
    message: '汇总成功',
    data: resultData
  }
}

/**
 * 生成完整的月份列表
 */
function generateAllMonths(existingMonths: string[]): string[] {
  if (existingMonths.length === 0) return []
  
  // 尝试识别年份
  const firstMonth = existingMonths[0]
  const yearMatch = firstMonth.match(/^(\d{4})/)
  
  if (yearMatch) {
    const year = yearMatch[1]
    // 生成该年12个月
    const allMonths: string[] = []
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}${m.toString().padStart(2, '0')}`
      allMonths.push(monthStr)
    }
    return allMonths
  }
  
  // 如果无法识别年份，返回原有月份
  return existingMonths
}

/**
 * 将汇总数据导出为Excel文件
 */
function buildExcelArrayBuffer(data: any[][]): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  
  // 设置列宽
  const colWidths = data[0].map((_, i) => {
    let maxWidth = 10
    data.forEach(row => {
      const cellValue = String(row[i] || '')
      const width = cellValue.length * 2 + 2
      if (width > maxWidth) maxWidth = Math.min(width, 30)
    })
    return { wch: maxWidth }
  })
  worksheet['!cols'] = colWidths
  
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '汇总数据')
  const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return toArrayBuffer(output)
}

export function exportToExcel(data: any[][], fileName: string = '汇总表格.xlsx'): Blob {
  const excelBuffer = buildExcelArrayBuffer(data)
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/**
 * 下载Blob文件
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  // #ifdef H5
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  // #endif
  
  // #ifdef MP-WEIXIN
  // 微信小程序需要先保存到临时文件再分享
  const reader = new FileReader()
  reader.onload = () => {
    const base64 = (reader.result as string).split(',')[1]
    const fs = uni.getFileSystemManager()
    const filePath = `${(wx as any).env.USER_DATA_PATH}/${fileName}`
    fs.writeFile({
      filePath,
      data: base64,
      encoding: 'base64',
      success: () => {
        uni.openDocument({
          filePath,
          showMenu: true,
          success: () => {
            uni.showToast({ title: '文件已打开', icon: 'success' })
          }
        })
      },
      fail: (err) => {
        console.error('保存文件失败', err)
        uni.showToast({ title: '保存失败', icon: 'none' })
      }
    })
  }
  reader.readAsDataURL(blob)
  // #endif
}

/**
 * 完整的Excel处理流程
 * @param file 上传的Excel文件
 * @param outputFileName 输出文件名
 */
export async function processExcelFile(
  file: File,
  outputFileName: string = '会计月汇总表.xlsx'
): Promise<ProcessResult> {
  try {
    // 1. 读取Excel
    const rawData = await readExcelFile(file)
    
    // 2. 按会计月汇总
    const result = summarizeByAccountingMonth(rawData)
    
    if (!result.success) {
      return result
    }
    
    // 3. 生成Excel文件
    const arrayBuffer = buildExcelArrayBuffer(result.data!)
    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    
    return {
      success: true,
      message: '表格处理完成',
      data: result.data,
      fileName: outputFileName,
      blob,
      arrayBuffer
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || '处理失败'
    }
  }
}

/**
 * 通过本地路径处理Excel（微信小程序/App）
 */
export async function processExcelFileByPath(
  filePath: string,
  outputFileName: string = '会计月汇总表.xlsx'
): Promise<ProcessResult> {
  try {
    const rawData = await readExcelFileByPath(filePath)
    const result = summarizeByAccountingMonth(rawData)

    if (!result.success) {
      return result
    }

    const arrayBuffer = buildExcelArrayBuffer(result.data!)
    let blob: Blob | undefined
    try {
      blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    } catch {
      blob = undefined
    }

    return {
      success: true,
      message: '表格处理完成',
      data: result.data,
      fileName: outputFileName,
      blob,
      arrayBuffer
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || '处理失败'
    }
  }
}
