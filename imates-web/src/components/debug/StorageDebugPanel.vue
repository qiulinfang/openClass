<template>
  <q-dialog v-if="isDev" v-model="isPanelVisible" position="right" maximized>
    <q-card style="width: 800px; max-width: 90vw">
      <!-- 头部 -->
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">🔧 存储调试面板</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <!-- 标签页切换 -->
      <q-card-section class="q-pb-none">
        <q-tabs v-model="activeTab" dense class="text-grey" active-color="primary" indicator-color="primary">
          <q-tab name="localStorage" label="localStorage" />
          <q-tab name="indexeddb" label="IndexedDB" />
        </q-tabs>
      </q-card-section>

      <!-- 操作按钮组 -->
      <q-card-section class="q-pt-none">
        <div class="row q-gutter-sm">
          <q-btn
            outline
            color="primary"
            icon="refresh"
            label="刷新"
            @click="refreshData"
            size="sm"
          />
          <q-btn
            outline
            color="secondary"
            icon="download"
            label="导出数据"
            @click="exportData"
            size="sm"
          />
          <q-btn
            outline
            color="negative"
            icon="delete_sweep"
            label="清空当前存储"
            @click="clearCurrentStorage"
            size="sm"
          />
        </div>
      </q-card-section>

      <!-- 内容区域 -->
      <q-separator />
      
      <q-card-section class="q-pa-none" style="max-height: calc(100vh - 200px); overflow-y: auto">
        <q-tab-panels v-model="activeTab" animated>
          <!-- localStorage 标签页 -->
          <q-tab-panel name="localStorage">
            <div class="q-pa-md">
              <!-- 统计信息 -->
              <q-banner class="bg-info text-white q-mb-md" rounded>
                <template v-slot:avatar>
                  <q-icon name="analytics" size="md" />
                </template>
                <div class="text-subtitle2">localStorage 统计</div>
                <div class="text-caption">
                  总键数: {{ localStorageKeys.length }} | 
                  总大小: {{ localStorageSize }}
                </div>
              </q-banner>

              <!-- 搜索框 -->
              <q-input
                v-model="localStorageSearch"
                placeholder="搜索键名..."
                dense
                outlined
                class="q-mb-md"
              >
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
                <template v-slot:append>
                  <q-icon
                    v-if="localStorageSearch"
                    name="clear"
                    class="cursor-pointer"
                    @click="localStorageSearch = ''"
                  />
                </template>
              </q-input>

              <!-- localStorage 列表 -->
              <q-list bordered separator>
                <q-item
                  v-for="item in filteredLocalStorageItems"
                  :key="item.key"
                  clickable
                  @click="viewLocalStorageItem(item)"
                >
                  <q-item-section>
                    <q-item-label>{{ item.key }}</q-item-label>
                    <q-item-label caption>
                      大小: {{ formatSize(item.size) }} | 
                      类型: {{ item.type }}
                    </q-item-label>
                    <q-item-label caption class="text-grey-6">
                      {{ item.preview }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <div class="row q-gutter-xs">
                      <q-btn
                        flat
                        round
                        dense
                        size="sm"
                        icon="visibility"
                        color="blue"
                        @click.stop="viewLocalStorageItem(item)"
                      >
                        <q-tooltip>查看详情</q-tooltip>
                      </q-btn>
                      <q-btn
                        flat
                        round
                        dense
                        size="sm"
                        icon="content_copy"
                        color="secondary"
                        @click.stop="copyToClipboard(item.value)"
                      >
                        <q-tooltip>复制值</q-tooltip>
                      </q-btn>
                      <q-btn
                        flat
                        round
                        dense
                        size="sm"
                        icon="delete"
                        color="negative"
                        @click.stop="deleteLocalStorageItem(item.key)"
                      >
                        <q-tooltip>删除</q-tooltip>
                      </q-btn>
                    </div>
                  </q-item-section>
                </q-item>
                <q-item v-if="filteredLocalStorageItems.length === 0">
                  <q-item-section class="text-center text-grey-6">
                    <div class="q-py-md">
                      <q-icon name="inbox" size="48px" />
                      <div class="q-mt-sm">
                        {{ localStorageSearch ? '未找到匹配项' : '暂无 localStorage 数据' }}
                      </div>
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>
            </div>
          </q-tab-panel>

          <!-- IndexedDB 标签页 -->
          <q-tab-panel name="indexeddb">
            <div class="q-pa-md">
              <!-- 统计信息 -->
              <q-banner class="bg-info text-white q-mb-md" rounded>
                <template v-slot:avatar>
                  <q-icon name="analytics" size="md" />
                </template>
                <div class="text-subtitle2">IndexedDB 统计</div>
                <div class="text-caption">
                  数据库数: {{ indexedDBDatabases.length }} | 
                  总记录数: {{ indexedDBTotalRecords }}
                </div>
              </q-banner>

              <!-- 数据库选择 -->
              <q-select
                v-model="selectedDatabase"
                :options="indexedDBDatabases"
                option-label="name"
                option-value="name"
                label="选择数据库"
                outlined
                dense
                class="q-mb-md"
                @update:model-value="loadDatabaseData"
              >
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.name }}</q-item-label>
                      <q-item-label caption>
                        版本: {{ scope.opt.version }} | 
                        对象存储: {{ scope.opt.objectStores.length }}
                      </q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>

              <!-- 对象存储选择 -->
              <q-select
                v-if="selectedDatabase"
                v-model="selectedObjectStore"
                :options="selectedDatabase.objectStores"
                option-label="name"
                option-value="name"
                label="选择对象存储"
                outlined
                dense
                class="q-mb-md"
                @update:model-value="loadObjectStoreData"
              >
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.name }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>

              <!-- 搜索框 -->
              <q-input
                v-if="selectedObjectStore"
                v-model="indexedDBSearch"
                placeholder="搜索键名..."
                dense
                outlined
                class="q-mb-md"
              >
                <template v-slot:prepend>
                  <q-icon name="search" />
                </template>
                <template v-slot:append>
                  <q-icon
                    v-if="indexedDBSearch"
                    name="clear"
                    class="cursor-pointer"
                    @click="indexedDBSearch = ''"
                  />
                </template>
              </q-input>

              <!-- IndexedDB 数据列表 -->
              <q-list v-if="selectedObjectStore && indexedDBItems.length > 0" bordered separator>
                <q-item
                  v-for="item in filteredIndexedDBItems"
                  :key="item.key"
                  clickable
                  @click="viewIndexedDBItem(item)"
                >
                  <q-item-section>
                    <q-item-label>键: {{ formatKey(item.key) }}</q-item-label>
                    <q-item-label caption>
                      大小: {{ formatSize(item.size) }} | 
                      类型: {{ item.type }}
                    </q-item-label>
                    <q-item-label caption class="text-grey-6">
                      {{ item.preview }}
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <div class="row q-gutter-xs">
                      <q-btn
                        flat
                        round
                        dense
                        size="sm"
                        icon="visibility"
                        color="blue"
                        @click.stop="viewIndexedDBItem(item)"
                      >
                        <q-tooltip>查看详情</q-tooltip>
                      </q-btn>
                      <q-btn
                        flat
                        round
                        dense
                        size="sm"
                        icon="content_copy"
                        color="secondary"
                        @click.stop="copyToClipboard(JSON.stringify(item.value, null, 2))"
                      >
                        <q-tooltip>复制值</q-tooltip>
                      </q-btn>
                      <q-btn
                        flat
                        round
                        dense
                        size="sm"
                        icon="delete"
                        color="negative"
                        @click.stop="deleteIndexedDBItem(item.key)"
                      >
                        <q-tooltip>删除</q-tooltip>
                      </q-btn>
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>

              <!-- 空状态 -->
              <q-card v-else-if="!selectedDatabase" flat bordered class="q-pa-md text-center text-grey-6">
                <q-icon name="database" size="48px" />
                <div class="q-mt-sm">请选择数据库</div>
              </q-card>
              <q-card v-else-if="!selectedObjectStore" flat bordered class="q-pa-md text-center text-grey-6">
                <q-icon name="storage" size="48px" />
                <div class="q-mt-sm">请选择对象存储</div>
              </q-card>
              <q-card v-else-if="indexedDBItems.length === 0" flat bordered class="q-pa-md text-center text-grey-6">
                <q-icon name="inbox" size="48px" />
                <div class="q-mt-sm">
                  {{ indexedDBSearch ? '未找到匹配项' : '暂无数据' }}
                </div>
              </q-card>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- localStorage 详情对话框 -->
  <q-dialog v-model="showLocalStorageDetailDialog">
    <q-card style="width: 700px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">localStorage 详情</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">键名</div>
        <div class="text-body2 q-mb-md">{{ selectedLocalStorageItem?.key }}</div>
        <div class="text-subtitle2 q-mb-sm">值</div>
        <q-scroll-area style="height: 400px">
          <pre class="text-caption" style="white-space: pre-wrap; word-break: break-all;">{{ selectedLocalStorageItem?.value }}</pre>
        </q-scroll-area>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-btn flat color="primary" icon="content_copy" label="复制" @click="copyToClipboard(selectedLocalStorageItem?.value || '')" />
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- IndexedDB 详情对话框 -->
  <q-dialog v-model="showIndexedDBDetailDialog">
    <q-card style="width: 700px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">IndexedDB 详情</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">键</div>
        <div class="text-body2 q-mb-md">{{ formatKey(selectedIndexedDBItem?.key) }}</div>
        <div class="text-subtitle2 q-mb-sm">值</div>
        <q-scroll-area style="height: 400px">
          <pre class="text-caption" style="white-space: pre-wrap; word-break: break-all;">{{ selectedIndexedDBItem ? JSON.stringify(selectedIndexedDBItem.value, null, 2) : '' }}</pre>
        </q-scroll-area>
      </q-card-section>
      <q-card-section class="q-pt-none">
        <q-btn flat color="primary" icon="content_copy" label="复制" @click="copyToClipboard(selectedIndexedDBItem ? JSON.stringify(selectedIndexedDBItem.value, null, 2) : '')" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useStorageDebugPanel } from '@/composables/useStorageDebugPanel'
import { showMessage } from '@/utils'
import { getUserId } from '@/services'

// 检查是否是开发环境
const isDev = import.meta.env.VITE_ENABLE_DEBUG === 'true' || import.meta.env.DEV

// 使用全局存储调试面板 composable
const { isPanelVisible } = useStorageDebugPanel()

// 响应式数据
const activeTab = ref<'localStorage' | 'indexeddb'>('localStorage')

// localStorage 相关
const localStorageKeys = ref<string[]>([])
const localStorageItems = ref<Array<{
  key: string
  value: string
  size: number
  type: string
  preview: string
}>>([])
const localStorageSearch = ref('')
const localStorageSize = ref('0 KB')
const selectedLocalStorageItem = ref<{ key: string; value: string } | null>(null)
const showLocalStorageDetailDialog = ref(false)

// IndexedDB 相关
const indexedDBDatabases = ref<Array<{
  name: string
  version: number
  objectStores: Array<{ name: string }>
}>>([])
const selectedDatabase = ref<{ name: string; version: number; objectStores: Array<{ name: string }> } | null>(null)
const selectedObjectStore = ref<{ name: string } | null>(null)
const indexedDBItems = ref<Array<{
  key: unknown
  value: unknown
  size: number
  type: string
  preview: string
}>>([])
const indexedDBSearch = ref('')
const selectedIndexedDBItem = ref<{ key: unknown; value: unknown } | null>(null)
const showIndexedDBDetailDialog = ref(false)

// 计算属性
const filteredLocalStorageItems = computed(() => {
  if (!localStorageSearch.value) {
    return localStorageItems.value
  }
  const search = localStorageSearch.value.toLowerCase()
  return localStorageItems.value.filter(item => 
    item.key.toLowerCase().includes(search)
  )
})

const filteredIndexedDBItems = computed(() => {
  if (!indexedDBSearch.value) {
    return indexedDBItems.value
  }
  const search = indexedDBSearch.value.toLowerCase()
  return indexedDBItems.value.filter(item => {
    const keyStr = String(item.key).toLowerCase()
    const valueStr = item.preview.toLowerCase()
    return keyStr.includes(search) || valueStr.includes(search)
  })
})

const indexedDBTotalRecords = computed(() => {
  return indexedDBItems.value.length
})

// 监听标签页切换，自动刷新数据
watch(activeTab, (newTab) => {
  if (newTab === 'localStorage') {
    refreshLocalStorage()
  } else if (newTab === 'indexeddb') {
    refreshIndexedDB()
  }
})

// 刷新所有数据
const refreshData = async () => {
  if (activeTab.value === 'localStorage') {
    await refreshLocalStorage()
  } else {
    await refreshIndexedDB()
  }
}

// 刷新 localStorage 数据
const refreshLocalStorage = () => {
  try {
    const keys: string[] = []
    const items: Array<{
      key: string
      value: string
      size: number
      type: string
      preview: string
    }> = []
    let totalSize = 0

    // 遍历所有 localStorage 键
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        keys.push(key)
        const value = localStorage.getItem(key) || ''
        const size = new Blob([value]).size
        totalSize += size

        // 判断类型
        let type = 'string'
        let preview = value.substring(0, 100)
        try {
          const parsed = JSON.parse(value)
          type = Array.isArray(parsed) ? 'array' : typeof parsed
          preview = JSON.stringify(parsed).substring(0, 100)
        } catch {
          // 不是 JSON，保持原样
        }

        items.push({
          key,
          value,
          size,
          type,
          preview: preview.length < value.length ? preview + '...' : preview
        })
      }
    }

    localStorageKeys.value = keys
    localStorageItems.value = items.sort((a, b) => a.key.localeCompare(b.key))
    localStorageSize.value = formatSize(totalSize)
  } catch (error) {
    console.error('刷新 localStorage 失败:', error)
    showMessage('刷新 localStorage 失败', 'error')
  }
}

// 刷新 IndexedDB 数据
const refreshIndexedDB = async () => {
  try {
    // 获取所有数据库
    const databases = await getIndexedDBDatabases()
    indexedDBDatabases.value = databases

    // 如果有选中的数据库，重新加载数据
    if (selectedDatabase.value) {
      const db = databases.find(d => d.name === selectedDatabase.value!.name)
      if (db) {
        selectedDatabase.value = db
        await loadDatabaseData(db)
      }
    }
  } catch (error) {
    console.error('刷新 IndexedDB 失败:', error)
    showMessage('刷新 IndexedDB 失败', 'error')
  }
}

// 获取所有 IndexedDB 数据库
const getIndexedDBDatabases = async (): Promise<Array<{
  name: string
  version: number
  objectStores: Array<{ name: string }>
}>> => {
  try {
    // 使用 indexedDB.databases() API（如果支持）
    if ('databases' in indexedDB) {
      const databases = await indexedDB.databases()
      // 为每个数据库打开并获取对象存储列表
      const result = await Promise.all(
        databases.map(async (db) => {
          try {
            const objectStores = await getObjectStores(db.name, db.version)
            return {
              name: db.name,
              version: db.version,
              objectStores: objectStores.map(name => ({ name }))
            }
          } catch (error) {
            console.warn(`无法打开数据库 ${db.name}:`, error)
            return {
              name: db.name,
              version: db.version,
              objectStores: [] as Array<{ name: string }>
            }
          }
        })
      )
      return result
    } else {
      // 降级方案：尝试打开已知的数据库
      return getKnownDatabases()
    }
  } catch (error) {
    console.error('获取数据库列表失败:', error)
    // 降级方案：尝试打开已知的数据库
    return getKnownDatabases()
  }
}

// 获取数据库的对象存储列表
const getObjectStores = async (dbName: string, version: number): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version)
    let db: IDBDatabase | null = null
    let upgradeCompleted = false
    
    request.onsuccess = () => {
      db = request.result
      const objectStoreNames = Array.from(db.objectStoreNames)
      db.close()
      if (!upgradeCompleted) {
        resolve(objectStoreNames)
      }
    }
    
    request.onerror = () => {
      reject(new Error(`打开数据库失败: ${request.error?.message}`))
    }
    
    request.onupgradeneeded = () => {
      // 如果数据库需要升级，等待升级完成后再获取对象存储列表
      db = request.result
      const transaction = request.transaction
      
      if (transaction) {
        transaction.addEventListener('complete', () => {
          upgradeCompleted = true
          if (db) {
            const objectStoreNames = Array.from(db.objectStoreNames)
            db.close()
            resolve(objectStoreNames)
          }
        })
        
        transaction.addEventListener('error', () => {
          reject(new Error(`数据库升级失败: ${transaction.error?.message}`))
        })
      } else {
        // 如果没有事务，直接获取对象存储列表
        if (db) {
          const objectStoreNames = Array.from(db.objectStoreNames)
          db.close()
          resolve(objectStoreNames)
        }
      }
    }
  })
}

// 获取已知的数据库列表（降级方案）
const getKnownDatabases = (): Array<{
  name: string
  version: number
  objectStores: Array<{ name: string }>
}> => {
  const userId = getUserId()
  return [
    {
      name: `ExerciseSolveApp_${userId}`,
      version: 1,
      objectStores: [
        { name: 'chat_history' },
        { name: 'questions' },
        { name: 'resources' }
      ]
    }
  ]
}

// 加载数据库数据
const loadDatabaseData = async (db: { name: string; version: number; objectStores: Array<{ name: string }> }) => {
  try {
    // 如果对象存储列表为空，重新获取
    if (db.objectStores.length === 0) {
      const objectStoreNames = await getObjectStores(db.name, db.version)
      db.objectStores = objectStoreNames.map(name => ({ name }))
    }
    
    selectedDatabase.value = db
    selectedObjectStore.value = null // 重置对象存储选择
    indexedDBItems.value = [] // 清空数据列表
    
    // 如果数据库只有一个对象存储，自动选择
    if (db.objectStores.length === 1) {
      selectedObjectStore.value = db.objectStores[0]
      await loadObjectStoreData(db.objectStores[0])
    } else if (db.objectStores.length > 0) {
      // 如果有多个对象存储，不自动选择，让用户选择
      // 但可以默认选择第一个（可选）
      // selectedObjectStore.value = db.objectStores[0]
      // await loadObjectStoreData(db.objectStores[0])
    }
  } catch (error) {
    console.error('加载数据库数据失败:', error)
    showMessage('加载数据库数据失败', 'error')
  }
}

// 加载对象存储数据
const loadObjectStoreData = async (objectStore: { name: string }) => {
  if (!selectedDatabase.value) return

  try {
    selectedObjectStore.value = objectStore
    
    // 打开数据库
    const db = await openDatabase(selectedDatabase.value.name, selectedDatabase.value.version)
    
    // 获取对象存储的所有数据
    const items: Array<{
      key: unknown
      value: unknown
      size: number
      type: string
      preview: string
    }> = []

    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([objectStore.name], 'readonly')
      const store = transaction.objectStore(objectStore.name)
      const request = store.openCursor()

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          const key = cursor.key
          const value = cursor.value
          const valueStr = JSON.stringify(value)
          const size = new Blob([valueStr]).size
          
          items.push({
            key,
            value,
            size,
            type: Array.isArray(value) ? 'array' : typeof value,
            preview: valueStr.substring(0, 100) + (valueStr.length > 100 ? '...' : '')
          })

          cursor.continue()
        } else {
          indexedDBItems.value = items
          db.close()
          resolve()
        }
      }

      request.onerror = () => {
        db.close()
        reject(new Error('读取对象存储数据失败'))
      }
    })
  } catch (error) {
    console.error('加载对象存储数据失败:', error)
    showMessage('加载对象存储数据失败', 'error')
  }
}

// 打开数据库
const openDatabase = (dbName: string, version: number): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version)

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(new Error(`打开数据库失败: ${request.error?.message}`))
    }

    request.onupgradeneeded = () => {
      // 数据库升级，但不在这里处理
    }
  })
}

// 查看 localStorage 项详情
const viewLocalStorageItem = (item: { key: string; value: string }) => {
  selectedLocalStorageItem.value = item
  showLocalStorageDetailDialog.value = true
}

// 查看 IndexedDB 项详情
const viewIndexedDBItem = (item: { key: unknown; value: unknown }) => {
  selectedIndexedDBItem.value = item
  showIndexedDBDetailDialog.value = true
}

// 删除 localStorage 项
const deleteLocalStorageItem = async (key: string) => {
  try {
    localStorage.removeItem(key)
    await refreshLocalStorage()
    showMessage('删除成功', 'success')
  } catch (error) {
    console.error('删除 localStorage 项失败:', error)
    showMessage('删除失败', 'error')
  }
}

// 删除 IndexedDB 项
const deleteIndexedDBItem = async (key: unknown) => {
  if (!selectedDatabase.value || !selectedObjectStore.value) return

  try {
    const db = await openDatabase(selectedDatabase.value.name, selectedDatabase.value.version)
    
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([selectedObjectStore.value!.name], 'readwrite')
      const store = transaction.objectStore(selectedObjectStore.value!.name)
      const request = store.delete(key)

      request.onsuccess = () => {
        db.close()
        loadObjectStoreData(selectedObjectStore.value!)
        showMessage('删除成功', 'success')
        resolve()
      }

      request.onerror = () => {
        db.close()
        reject(new Error('删除失败'))
      }
    })
  } catch (error) {
    console.error('删除 IndexedDB 项失败:', error)
    showMessage('删除失败', 'error')
  }
}

// 清空当前存储
const clearCurrentStorage = async () => {
  if (activeTab.value === 'localStorage') {
    if (confirm('确定要清空所有 localStorage 数据吗？此操作不可恢复！')) {
      try {
        localStorage.clear()
        await refreshLocalStorage()
        showMessage('清空成功', 'success')
      } catch (error) {
        console.error('清空 localStorage 失败:', error)
        showMessage('清空失败', 'error')
      }
    }
  } else {
    if (!selectedDatabase.value || !selectedObjectStore.value) {
      showMessage('请先选择数据库和对象存储', 'warning')
      return
    }
    if (confirm(`确定要清空对象存储 "${selectedObjectStore.value.name}" 的所有数据吗？此操作不可恢复！`)) {
      try {
        const db = await openDatabase(selectedDatabase.value.name, selectedDatabase.value.version)
        
        return new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([selectedObjectStore.value!.name], 'readwrite')
          const store = transaction.objectStore(selectedObjectStore.value!.name)
          const request = store.clear()

          request.onsuccess = () => {
            db.close()
            loadObjectStoreData(selectedObjectStore.value!)
            showMessage('清空成功', 'success')
            resolve()
          }

          request.onerror = () => {
            db.close()
            reject(new Error('清空失败'))
          }
        })
      } catch (error) {
        console.error('清空 IndexedDB 数据失败:', error)
        showMessage('清空失败', 'error')
      }
    }
  }
}

// 导出数据
const exportData = () => {
  try {
    let exportData: Record<string, unknown> = {}

    if (activeTab.value === 'localStorage') {
      exportData = {
        type: 'localStorage',
        timestamp: Date.now(),
        data: Object.fromEntries(
          localStorageItems.value.map(item => [item.key, item.value])
        )
      }
    } else {
      exportData = {
        type: 'indexeddb',
        timestamp: Date.now(),
        database: selectedDatabase.value?.name,
        objectStore: selectedObjectStore.value?.name,
        data: Object.fromEntries(
          indexedDBItems.value.map(item => [String(item.key), item.value])
        )
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `storage-debug-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    showMessage('导出成功', 'success')
  } catch (error) {
    console.error('导出失败:', error)
    showMessage('导出失败', 'error')
  }
}

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    showMessage('已复制到剪贴板', 'success')
  } catch (error) {
    console.error('复制失败:', error)
    // 降级方案
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showMessage('已复制到剪贴板', 'success')
    } catch {
      showMessage('复制失败', 'error')
    }
  }
}

// 格式化大小
const formatSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`
  } else {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }
}

// 格式化键
const formatKey = (key: unknown): string => {
  if (typeof key === 'string' || typeof key === 'number') {
    return String(key)
  }
  return JSON.stringify(key)
}

// 组件挂载时加载数据
onMounted(() => {
  refreshLocalStorage()
  refreshIndexedDB()
})
</script>

<style lang="scss" scoped>
:deep(.q-dialog__inner) {
  max-width: 800px;
}
</style>

