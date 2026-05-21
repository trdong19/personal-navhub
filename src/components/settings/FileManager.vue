<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAllFiles, saveFile, deleteFile, type StoredFile, blobToDataUrl } from '@/utils/fileStore'
import { generateId } from '@/utils/helpers'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'

const auth = useAuth()
const emit = defineEmits<{
  close: []
  'select-wallpaper': [dataUrl: string]
  'delete-wallpaper': [id: string]
}>()

const toast = useToast()

const files = ref<StoredFile[]>([])
const activeCategory = ref<'wallpaper'>('wallpaper')
const previewFile = ref<StoredFile | null>(null)
const previewUrl = ref<string | null>(null)
const objectUrlCache = new Map<string, string>()

function getCachedObjectUrl(blob: Blob, id: string): string {
  let url = objectUrlCache.get(id)
  if (!url) {
    url = URL.createObjectURL(blob)
    objectUrlCache.set(id, url)
  }
  return url
}

const filteredFiles = computed(() =>
  files.value.filter(f => f.category === activeCategory.value)
)

async function loadFiles() {
  files.value = await getAllFiles()
}

async function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const fileList = input.files
  if (!fileList) return
  const uploadedIds: string[] = []
  for (const file of Array.from(fileList)) {
    if (file.size > 10 * 1024 * 1024) {
      toast.warning(`${file.name} 大小超过 10MB，跳过`)
      continue
    }
    const id = generateId()
    await saveFile({
      id,
      name: file.name,
      type: file.type,
      category: activeCategory.value,
      blob: file,
    })
    uploadedIds.push(id)
  }
  await loadFiles()
  input.value = ''
  // 推送上传的壁纸到服务器
  if (uploadedIds.length > 0) {
    const resources: Record<string, string> = {}
    for (const file of files.value) {
      if (uploadedIds.includes(file.id)) {
        resources[`wallpaper:${file.id}`] = await blobToDataUrl(file.blob)
      }
    }
    auth.incrementalSync('push-resources', { resources }).catch(() => {})
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定删除该文件？')) return
  const url = objectUrlCache.get(id)
  if (url) { URL.revokeObjectURL(url); objectUrlCache.delete(id) }
  await deleteFile(id)
  // 标记图片为已删除，避免 pull 时恢复
  const deletedImages: string[] = JSON.parse(localStorage.getItem('nav_deleted_bg_images') || '[]')
  if (!deletedImages.includes(id)) {
    deletedImages.push(id)
    localStorage.setItem('nav_deleted_bg_images', JSON.stringify(deletedImages))
  }
  await loadFiles()
  if (previewFile.value?.id === id) {
    closePreview()
  }
  // 同步删除到服务器
  auth.incrementalSync('delete-resource', { resourceId: `wallpaper:${id}` }).catch(() => {})
  emit('delete-wallpaper', id)
}

async function handleSetWallpaper(file: StoredFile) {
  const dataUrl = await blobToDataUrl(file.blob)
  emit('select-wallpaper', dataUrl)
}

function openPreview(file: StoredFile) {
  previewFile.value = file
  previewUrl.value = URL.createObjectURL(file.blob)
}

function closePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = null
  previewFile.value = null
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

onMounted(loadFiles)
</script>

<template>
  <div class="fm-overlay" @mousedown.self="emit('close')">
    <div class="fm-modal">
      <div class="fm-header">
        <h3>文件管理</h3>
        <button class="fm-close" @click="emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div class="fm-tabs">
        <button :class="['fm-tab', { active: activeCategory === 'wallpaper' }]" @click="activeCategory = 'wallpaper'">
          🖼️ 壁纸
          <span class="fm-tab-count">{{ files.filter(f => f.category === 'wallpaper').length }}</span>
        </button>
      </div>

      <div class="fm-body">
        <div class="fm-upload-area">
          <label class="fm-upload-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            上传壁纸
            <input type="file" accept="image/*" multiple @change="handleUpload" hidden />
          </label>
          <span class="fm-upload-hint">支持 jpg/png/svg/webp，最大 10MB</span>
        </div>

        <div v-if="filteredFiles.length > 0" class="fm-grid">
          <div v-for="file in filteredFiles" :key="file.id" class="fm-item">
            <div class="fm-item-preview" @click="openPreview(file)">
              <img :src="getCachedObjectUrl(file.blob, file.id)" :alt="file.name" @load="($event.target as HTMLImageElement).style.opacity='1'" @error="($event.target as HTMLImageElement).style.display='none'" style="opacity: 0; transition: opacity 0.2s" />
              <div class="fm-item-overlay">
                <span>预览</span>
              </div>
            </div>
            <div class="fm-item-info">
              <span class="fm-item-name" :title="file.name">{{ file.name }}</span>
              <span class="fm-item-size">{{ formatSize(file.blob.size) }}</span>
            </div>
            <div class="fm-item-actions">
              <button class="fm-action-btn fm-action-wallpaper" title="设为背景" @click.stop="handleSetWallpaper(file)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              </button>
              <button class="fm-action-btn fm-action-delete" title="删除" @click.stop="handleDelete(file.id)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="fm-empty">
          <span class="fm-empty-icon">🖼️</span>
          <p>还没有壁纸，点击上方按钮上传</p>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="previewUrl && previewFile" class="fm-preview-overlay" @mousedown.self="closePreview">
        <div class="fm-preview-content">
          <img :src="previewUrl" :alt="previewFile.name" />
          <div class="fm-preview-info">
            <span class="fm-preview-name">{{ previewFile.name }}</span>
            <span class="fm-preview-size">{{ formatSize(previewFile.blob.size) }}</span>
          </div>
          <div class="fm-preview-actions">
            <button v-if="previewFile.category === 'wallpaper'" class="fm-preview-action" @click="handleSetWallpaper(previewFile); closePreview()">设为背景</button>
            <button class="fm-preview-action fm-preview-delete" @click="handleDelete(previewFile.id)">删除</button>
            <button class="fm-preview-action fm-preview-close" @click="closePreview()">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.fm-overlay {
  position: fixed;
  inset: 0;
  z-index: 5500;
  background: rgba(61, 52, 40, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fmFadeIn 0.15s ease;
}

.fm-modal {
  width: 100%;
  max-width: 640px;
  max-height: 85vh;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(61, 52, 40, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: fmScaleIn 0.2s ease;
}

.fm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.fm-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.fm-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.fm-close:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.fm-tabs {
  display: flex;
  gap: 2px;
  padding: 12px 20px 0;
}

.fm-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px 8px 0 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.fm-tab:hover {
  color: var(--text-secondary);
}

.fm-tab.active {
  background: var(--bg-hover);
  color: var(--text);
}

.fm-tab-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.fm-body {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.fm-upload-area {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fm-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 50px;
  background: var(--primary);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.fm-upload-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.fm-upload-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.fm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.fm-item {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fm-item:hover {
  border-color: var(--primary);
  box-shadow: 0 4px 16px rgba(25, 200, 185, 0.12);
  transform: translateY(-2px);
}

.fm-item-preview {
  width: 100%;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.fm-item-preview img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.fm-item-overlay {
  position: absolute;
  inset: 0;
  background: rgba(61, 52, 40, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.fm-item-preview:hover .fm-item-overlay {
  opacity: 1;
}

.fm-item-overlay span {
  color: white;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  background: rgba(61, 52, 40, 0.45);
  border-radius: 6px;
}

.fm-item-info {
  padding: 8px 10px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fm-item-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fm-item-size {
  font-size: 11px;
  color: var(--text-muted);
}

.fm-item-actions {
  display: flex;
  gap: 2px;
  padding: 4px 6px 8px;
  justify-content: flex-end;
}

.fm-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.fm-action-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.fm-action-wallpaper:hover {
  background: rgba(25, 200, 185, 0.1);
  color: var(--primary);
}

.fm-action-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.fm-empty {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-muted);
}

.fm-empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
  opacity: 0.6;
}

.fm-empty p {
  font-size: 14px;
  margin: 0;
}

@keyframes fmFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fmScaleIn {
  from { opacity: 0; transform: scale(0.96) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
