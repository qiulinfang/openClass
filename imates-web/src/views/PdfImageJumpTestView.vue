<template>
  <div class="pdf-image-jump-test-view">
    <div class="panel">
      <div class="title">图片跳转测试</div>
      <div class="desc">将 /public/icons/class.png 写入 IndexedDB（textbooks + textbook_files），然后跳转到 PdfViewerView。</div>

      <button class="btn" type="button" :disabled="loading" @click="handleRun">
        {{ loading ? '处理中...' : '写入并跳转' }}
      </button>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="log" class="log">{{ log }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { resourceManager } from '@/services/storage/resource-storage'

defineOptions({
  name: 'PdfImageJumpTestView',
})

const router = useRouter()

const loading = ref(false)
const error = ref('')
const log = ref('')

const QUERY = {
  id: '359438185518960640',
  textbookName: '平行四边形的面积',
  sectionName: '平行四边形的面积',
  resourceId: '391054777998479360',
  fileName: '教材.pdf',
  packageId: '391054780783497216',
  packageName: '教材',
  chapterGrade: '初一',
  chapterSubject: '数学',
  chapterTextbook: '探究型公开课',
  chapterTitle: '平行四边形的面积',
  fromLearning: 'true',
  learningNodeId: '391051348794249216',
  learningLevel: '1',
}

const ensureTextbookSkeleton = async () => {
  const id = QUERY.id

  if (!resourceManager.indexedDB.isInitialized) {
    await resourceManager.indexedDB.init()
  }

  const existing = (await resourceManager.indexedDB.get('textbooks', id)) as any
  if (existing) return existing

  const skeleton = {
    id,
    textbookId: id,
    textbookName: QUERY.textbookName,
    textbookSubjectLabel: QUERY.chapterSubject,
    textbookGradeLabel: QUERY.chapterGrade,
    textbookSemesterLabel: '',
    textbookPublisher: '',
    textbookEditionYear: '',
    textbookIsbn: '',
    textbookCover: '',
    textbookUpdateTime: '',
    totalFiles: 0,
    downloadedFiles: 0,
    isDownloaded: true,
    downloadStatus: 2,
    downloadPath: '',
    lastDownloadTime: '',
    hasUpdatesAvailable: false,
    structure: [],
    learningPackages: [
      {
        id: QUERY.packageId,
        packageId: QUERY.packageId,
        packageName: QUERY.packageName,
        // 其余字段在业务里不一定需要，这里先留空兜底
        resources: [],
        chapters: [],
      },
    ],
    localFiles: [],
    updateStructure: () => {},
    updatePackages: () => {},
    getLocalResourceFileName: () => '',
  }

  await resourceManager.indexedDB.update('textbooks', skeleton)

  const created = (await resourceManager.indexedDB.get('textbooks', id)) as any
  if (!created) {
    throw new Error(`虚拟教材写入失败: ${id}`)
  }
  return created
}

const handleRun = async () => {
  loading.value = true
  error.value = ''
  log.value = ''

  try {
    const textbook = await ensureTextbookSkeleton()

    const imgUrl = '/icons/class.png'
    const resp = await fetch(imgUrl)
    if (!resp.ok) throw new Error(`读取图片失败: ${resp.status}`)

    const blob = await resp.blob()
    const buf = await blob.arrayBuffer()
    const data = new Uint8Array(buf)

    await resourceManager.storeFileData(
      {
        id: QUERY.resourceId,
        textbookId: QUERY.id,
        packageId: QUERY.packageId,
        fileName: 'class.png',
        fileType: blob.type || 'image/png',
        fileSize: data.length,
      } as any,
      data,
      textbook,
    )

    log.value = `写入完成: fileId=${QUERY.resourceId}, bytes=${data.length}`

    await router.push({
      name: 'pdfViewer',
      query: {
        ...QUERY,
        isImage: 'true',
        imageFileName: 'class.png',
      },
    })
  } catch (e: any) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.pdf-image-jump-test-view {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0020;
}

.panel {
  width: min(520px, calc(100vw - 32px));
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 18px;
  color: #ffffff;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.desc {
  margin-top: 8px;
  font-size: 13px;
  opacity: 0.85;
  line-height: 1.5;
}

.btn {
  margin-top: 14px;
  width: 100%;
  height: 40px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  margin-top: 12px;
  color: #ffb4b4;
  font-size: 13px;
  white-space: pre-wrap;
}

.log {
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  white-space: pre-wrap;
}
</style>
