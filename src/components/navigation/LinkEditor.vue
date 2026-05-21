<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useNavStore } from '@/stores/nav'
import type { NavLink } from '@/types'
import { getFaviconUrl, getAllFaviconFormats } from '@/utils/helpers'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  linkId: string | null
  defaultCategoryId?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const navStore = useNavStore()
const toast = useToast()

const cardColors = [
  '#19c8b9', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
]
const showCustomCardColor = ref(false)

const greenFontColors = [
  '#22c55e', '#16a34a', '#15803d', '#166534',
  '#14532d', '#12b76a', '#10b981', '#059669',
  '#047857', '#065f46', '#064e3b', '#34d399',
  '#6ee7b7', '#a7f3d0', '#0d9488', '#14b8a6',
]
const showCustomFontColor = ref(false)

const form = ref({
  title: '',
  icon: '',
  iconUrl: '',
  description: '',
  category: '',
  intranetUrl: '',
  extranetUrl: '',
  tunnelUrl: '',
  tags: '',
  pinned: false,
  color: '',
  opacity: 1,
  fontColor: '',
  fontOpacity: 1,
})

const iconPreviewSrc = ref('')
const iconPreviewFailed = ref(false)

const iconSource = computed(() => {
  if (form.value.iconUrl) return form.value.iconUrl
  const url = form.value.extranetUrl || form.value.intranetUrl || form.value.tunnelUrl
  if (url) return getFaviconUrl(url)
  return ''
})

function handleIconUrlInput(val: string) {
  form.value.iconUrl = val.trim()
  iconPreviewFailed.value = false
}

function handleIconUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 2 * 1024 * 1024) {
    toast.error('图标文件不能超过 2MB')
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    form.value.iconUrl = ev.target?.result as string
    iconPreviewFailed.value = false
  }
  reader.readAsDataURL(file)
}

function handleIconError() {
  iconPreviewFailed.value = true
}

function handleIconLoad() {
  iconPreviewFailed.value = false
}

async function handleAutoFavicon() {
  const url = form.value.extranetUrl || form.value.intranetUrl || form.value.tunnelUrl
  if (!url) return
  const candidates = getAllFaviconFormats(url)
  for (const iconUrl of candidates) {
    try {
      const resp = await fetch(iconUrl, { signal: AbortSignal.timeout(3000) })
      if (!resp.ok) continue
      const blob = await resp.blob()
      if (blob.size === 0 || blob.size > 100 * 1024) continue
      form.value.iconUrl = iconUrl
      iconPreviewFailed.value = false
      return
    } catch {}
  }
  toast.error('未找到可用的图标')
}

onMounted(() => {
  if (props.linkId) {
    const link = navStore.links.find(l => l.id === props.linkId)
    if (link) {
      form.value = {
        title: link.title,
        icon: link.icon,
        iconUrl: link.iconUrl || '',
        description: link.description || '',
        category: link.category,
        intranetUrl: link.urls.intranet || '',
        extranetUrl: link.urls.extranet || '',
        tunnelUrl: link.urls.tunnel || '',
        tags: link.tags.join(', '),
        pinned: link.pinned,
        color: link.color || '',
        opacity: link.opacity ?? 1,
        fontColor: link.fontColor || '',
        fontOpacity: link.fontOpacity ?? 1,
      }
    }
  } else if (props.defaultCategoryId) {
    // 如果是新建链接并且有默认分类 ID，设置为默认选中的分类
    form.value.category = props.defaultCategoryId
  }
})

function handleSubmit() {
  if (!form.value.title.trim()) {
    toast.warning('请输入标题')
    return
  }

  const urls: NavLink['urls'] = {}
  if (form.value.intranetUrl.trim()) urls.intranet = form.value.intranetUrl.trim()
  if (form.value.extranetUrl.trim()) urls.extranet = form.value.extranetUrl.trim()
  if (form.value.tunnelUrl.trim()) urls.tunnel = form.value.tunnelUrl.trim()

  if (!urls.intranet && !urls.extranet && !urls.tunnel) {
    toast.warning('请至少填写一个网址')
    return
  }

  if (!form.value.category) {
    toast.warning('请选择一个分类')
    return
  }

  const tags = form.value.tags.split(/[,，]/).map(t => t.trim()).filter(Boolean)

  const data: Partial<NavLink> = {
    title: form.value.title,
    icon: form.value.icon,
    iconUrl: form.value.iconUrl || undefined,
    description: form.value.description || undefined,
    category: form.value.category,
    urls,
    tags,
    pinned: form.value.pinned,
    color: form.value.color || undefined,
    opacity: form.value.opacity < 1 ? form.value.opacity : undefined,
    fontColor: form.value.fontColor || undefined,
    fontOpacity: form.value.fontOpacity < 1 ? form.value.fontOpacity : undefined,
  }

  if (props.linkId) {
    navStore.updateLink(props.linkId, data)
  } else {
    const exists = navStore.links.some(
      l => l.title === data.title && l.category === data.category
    )
    if (exists) {
      toast.warning('该分类下已存在同名链接')
      return
    }
    navStore.addLink(data as Omit<NavLink, 'id' | 'accessCount' | 'lastAccessed' | 'createdAt' | 'order'>)
  }

  emit('close')
}
</script>

<template>
  <div class="editor-overlay" @mousedown.self="emit('close')">
    <div class="editor-modal">
      <div class="editor-header">
        <h3>{{ props.linkId ? '编辑链接' : '添加链接' }}</h3>
        <button class="close-btn" @click="emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div class="editor-body">
        <div class="form-row">
          <label class="form-label">标题 *</label>
          <input v-model="form.title" type="text" placeholder="输入链接标题" class="form-input" />
        </div>

        <div class="form-row">
          <label class="form-label">图标</label>
          <div class="icon-section">
            <div class="icon-preview-area">
              <div class="icon-preview-box">
                <img
                  v-if="iconSource && !iconPreviewFailed"
                  :src="iconSource"
                  class="icon-preview-img"
                  @load="handleIconLoad"
                  @error="handleIconError"
                />
                <span v-else class="icon-preview-emoji">{{ form.icon }}</span>
              </div>
            </div>
            <div class="icon-inputs">
              <input v-model="form.icon" type="text" placeholder="emoji 如 🔗" class="form-input icon-emoji-input" />
              <div class="icon-url-row">
                <input
                  :value="form.iconUrl"
                  @input="handleIconUrlInput(($event.target as HTMLInputElement).value)"
                  type="text"
                  placeholder="图标网址 URL..."
                  class="form-input"
                />
                <button class="icon-fetch-btn" title="从网址自动获取图标" @click="handleAutoFavicon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                </button>
                <label class="icon-upload-btn" title="上传本地图片">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                  <input type="file" accept="image/*" @change="handleIconUpload" hidden />
                </label>
              </div>
              <button v-if="form.iconUrl" class="icon-clear-btn" @click="form.iconUrl = ''; iconPreviewFailed = false">清除自定义图标</button>
            </div>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">描述</label>
          <textarea v-model="form.description" placeholder="简短描述（可选）" class="form-textarea" rows="2"></textarea>
        </div>

        <div class="form-row">
          <label class="form-label">分类</label>
          <select v-model="form.category" class="form-input">
            <option value="" disabled>请选择分类</option>
            <option v-for="cat in navStore.sortedCategories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>

        <div class="form-row">
          <label class="form-label">内网地址</label>
          <input v-model="form.intranetUrl" type="url" placeholder="http://192.168.x.x" class="form-input" />
        </div>

        <div class="form-row">
          <label class="form-label">外网地址</label>
          <input v-model="form.extranetUrl" type="url" placeholder="https://..." class="form-input" />
        </div>

        <div class="form-row">
          <label class="form-label">隧道地址</label>
          <input v-model="form.tunnelUrl" type="url" placeholder="https://tunnel.example.com/..." class="form-input" />
        </div>

        <div class="form-row">
          <label class="form-label">标签（逗号分隔）</label>
          <input v-model="form.tags" type="text" placeholder="标签1, 标签2" class="form-input" />
        </div>

        <div class="form-row">
          <label class="form-label">卡片颜色</label>
          <div class="card-color-section">
            <div class="card-color-picker">
              <button
                :class="['card-color-btn', { active: !form.color }]"
                style="background: var(--bg-card); border: 2px dashed var(--border);"
                title="默认"
                @click="form.color = ''"
              >
                <span style="font-size: 10px;">默认</span>
              </button>
              <button
                v-for="c in cardColors"
                :key="c"
                :class="['card-color-btn', { active: form.color === c }]"
                :style="{ background: c }"
                @click="form.color = c"
              />
              <button
                :class="['card-color-btn color-btn-custom', { active: showCustomCardColor }]"
                @click="showCustomCardColor = !showCustomCardColor"
              >
                +
              </button>
            </div>
            <div v-if="showCustomCardColor" class="custom-color-row">
              <input type="color" :value="form.color || '#19c8b9'" @input="form.color = ($event.target as HTMLInputElement).value" class="color-input-native" />
              <input type="text" class="color-text-input" v-model="form.color" placeholder="#19c8b9" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">透明度 {{ Math.round(form.opacity * 100) }}%</label>
          <div class="opacity-row">
            <input v-model.number="form.opacity" type="range" min="0.1" max="1" step="0.05" class="opacity-slider" />
            <span class="opacity-value">{{ Math.round(form.opacity * 100) }}%</span>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">字体颜色</label>
          <div class="card-color-section">
            <div class="card-color-picker">
              <button
                :class="['card-color-btn', { active: !form.fontColor }]"
                style="background: var(--bg-card); border: 2px dashed var(--border);"
                title="默认"
                @click="form.fontColor = ''"
              >
                <span style="font-size: 10px;">默认</span>
              </button>
              <button
                v-for="c in greenFontColors"
                :key="'fc-' + c"
                :class="['card-color-btn', { active: form.fontColor === c }]"
                :style="{ background: c }"
                @click="form.fontColor = c"
              />
              <button
                :class="['card-color-btn color-btn-custom', { active: showCustomFontColor }]"
                @click="showCustomFontColor = !showCustomFontColor"
              >
                +
              </button>
            </div>
            <div v-if="showCustomFontColor" class="custom-color-row">
              <input type="color" :value="form.fontColor || '#22c55e'" @input="form.fontColor = ($event.target as HTMLInputElement).value" class="color-input-native" />
              <input type="text" class="color-text-input" v-model="form.fontColor" placeholder="#22c55e" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <label class="form-label">字体透明度 {{ Math.round(form.fontOpacity * 100) }}%</label>
          <div class="opacity-row">
            <input v-model.number="form.fontOpacity" type="range" min="0.1" max="1" step="0.05" class="opacity-slider" />
            <span class="opacity-value">{{ Math.round(form.fontOpacity * 100) }}%</span>
          </div>
        </div>

        <div class="form-row checkbox-row">
          <label class="form-label">
            <input v-model="form.pinned" type="checkbox" class="form-checkbox" />
            置顶显示
          </label>
        </div>
      </div>

      <div class="editor-footer">
        <button class="btn btn-secondary" @click="emit('close')">取消</button>
        <button class="btn btn-primary" @click="handleSubmit">
          {{ props.linkId ? '保存修改' : '添加链接' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(61, 52, 40, 0.45);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.editor-modal {
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(61, 52, 40, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: editorSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes editorSlideIn {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(24px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.editor-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--text-muted);
  transition: all var(--transition);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.editor-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-input,
.form-textarea {
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text);
  outline: none;
  transition: border-color var(--transition);
}

.form-input:focus,
.form-textarea:focus {
  border-color: var(--primary);
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

.checkbox-row {
  flex-direction: row;
}

.form-checkbox {
  accent-color: var(--primary);
  width: 16px;
  height: 16px;
}

.icon-section {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.icon-preview-area {
  flex-shrink: 0;
}

.icon-preview-box {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.icon-preview-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.icon-preview-emoji {
  font-size: 24px;
}

.icon-inputs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.icon-emoji-input {
  width: 100%;
}

.icon-url-row {
  display: flex;
  gap: 6px;
}

.icon-url-row .form-input {
  flex: 1;
  min-width: 0;
}

.icon-fetch-btn,
.icon-upload-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition);
  flex-shrink: 0;
}

.icon-fetch-btn:hover,
.icon-upload-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.icon-clear-btn {
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;
  transition: color var(--transition);
}

.icon-clear-btn:hover {
  color: var(--primary);
}

.card-color-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-color-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-color-btn:hover {
  transform: scale(1.15);
}

.card-color-btn.active {
  border-color: var(--text);
  box-shadow: 0 0 0 2px var(--bg-card);
}

.opacity-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.opacity-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 3px;
  outline: none;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(61, 52, 40, 0.2);
}

.opacity-value {
  font-size: 13px;
  color: var(--text-muted);
  min-width: 36px;
  text-align: right;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border);
}

.color-btn-custom {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg) !important;
  border: 2px dashed var(--border) !important;
}

.color-btn-custom:hover {
  border-color: var(--primary) !important;
  color: var(--primary);
}

.color-btn-custom.active {
  border-color: var(--primary) !important;
  color: var(--primary);
}

.custom-color-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}

.color-input-native {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  padding: 0;
  background: none;
}

.color-input-native::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.color-input-native::-webkit-color-swatch {
  border: 1px solid var(--border);
  border-radius: 6px;
}

.color-text-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text);
  outline: none;
  font-family: monospace;
  transition: border-color 0.2s ease;
}

.color-text-input:focus {
  border-color: var(--primary);
}
</style>
