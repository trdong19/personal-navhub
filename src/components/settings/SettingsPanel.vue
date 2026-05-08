<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { useAuth } from '@/composables/useAuth'
import FileManager from './FileManager.vue'

const emit = defineEmits<{
  close: []
}>()

const navStore = useNavStore()
const settingsStore = useSettingsStore()
const auth = useAuth()

const activeTab = ref<'theme' | 'layout' | 'search' | 'data' | 'account'>('theme')

const tabs = [
  { id: 'theme', name: '主题', icon: '🎨' },
  { id: 'layout', name: '布局', icon: '📐' },
  { id: 'search', name: '搜索', icon: '🔍' },
  { id: 'data', name: '数据', icon: '💾' },
  { id: 'account', name: '账户', icon: '👤' },
] as const

const showPasswordForm = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const pwdLoading = ref(false)
const pwdError = ref('')
const pwdSuccess = ref(false)

async function handleChangePassword() {
  pwdError.value = ''
  pwdSuccess.value = false
  if (!pwdForm.oldPassword || !pwdForm.newPassword) { pwdError.value = '请输入旧密码和新密码'; return }
  if (pwdForm.newPassword.length < 4) { pwdError.value = '新密码至少4个字符'; return }
  if (pwdForm.newPassword !== pwdForm.confirmPassword) { pwdError.value = '两次密码不一致'; return }
  pwdLoading.value = true
  try {
    await auth.changePassword(pwdForm.oldPassword, pwdForm.newPassword)
    pwdSuccess.value = true
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
    pwdForm.confirmPassword = ''
    setTimeout(() => { showPasswordForm.value = false; pwdSuccess.value = false }, 1500)
  } catch (e: any) {
    pwdError.value = e.message || '修改失败'
  } finally {
    pwdLoading.value = false
  }
}

const showFileManager = ref(false)

onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.body.style.overflow = ''
  document.documentElement.style.overflow = ''
})

function handleFileManagerSelect(dataUrl: string) {
  settingsStore.setBackgroundImage(dataUrl)
}

const themeColors = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1',
]

const bgColors = [
  '#f8fafc', '#f1f5f9', '#e2e8f0', '#fce7f3',
  '#fdf2f8', '#fae8ff', '#f3e8ff', '#ede9fe',
  '#e0e7ff', '#dbeafe', '#e0f2fe', '#ccfbf1',
  '#d1fae5', '#ecfccb', '#fef9c3', '#fef3c7',
  '#0f172a', '#1e293b', '#334155', '#1a1a2e',
]

const showCustomColorInput = ref(false)
const showCustomBgInput = ref(false)
const showCustomTextColorInput = ref(false)
const showCustomSearchColor = ref(false)
const showCustomCardColor = ref(false)

const textColors = [
  '#0f172a', '#1e293b', '#334155', '#475569',
  '#64748b', '#94a3b8', '#f1f5f9', '#ffffff',
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f59e0b', '#22c55e', '#3b82f6', '#14b8a6',
]

const effectiveBgImage = computed(() => settingsStore.effectiveBgImage)

const showEngineForm = ref(false)
const editingEngineId = ref<string | null>(null)
const engineForm = reactive({
  name: '',
  shortcut: '',
  urlTemplate: '',
  icon: '',
})

function resetEngineForm() {
  engineForm.name = ''
  engineForm.shortcut = ''
  engineForm.urlTemplate = ''
  engineForm.icon = ''
  editingEngineId.value = null
  showEngineForm.value = false
}

function openAddEngine() {
  resetEngineForm()
  showEngineForm.value = true
}

function openEditEngine(id: string) {
  const engine = settingsStore.settings.search.engines.find(e => e.id === id)
  if (!engine) return
  editingEngineId.value = id
  engineForm.name = engine.name
  engineForm.shortcut = engine.shortcut
  engineForm.urlTemplate = engine.urlTemplate
  engineForm.icon = engine.icon
  showEngineForm.value = true
}

function saveEngine() {
  if (!engineForm.name || !engineForm.urlTemplate) return
  if (editingEngineId.value) {
    settingsStore.updateEngine(editingEngineId.value, {
      name: engineForm.name,
      shortcut: engineForm.shortcut,
      urlTemplate: engineForm.urlTemplate,
      icon: engineForm.icon || '🔍',
    })
  } else {
    settingsStore.addEngine({
      name: engineForm.name,
      shortcut: engineForm.shortcut,
      urlTemplate: engineForm.urlTemplate,
      icon: engineForm.icon || '🔍',
    })
  }
  resetEngineForm()
}

function removeEngine(id: string) {
  if (!confirm('确定删除该搜索引擎？')) return
  settingsStore.removeEngine(id)
}

function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    const success = navStore.importData(content)
    if (success) {
      alert('数据导入成功')
    } else {
      alert('数据格式错误')
    }
  }
  reader.readAsText(file)
}

function handleExport() {
  const data = navStore.exportData()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'navhub-export.json'
  a.click()
  URL.revokeObjectURL(url)
}

const showResetDialog = ref(false)

function handleReset() {
  showResetDialog.value = true
}

function doResetSettings() {
  settingsStore.resetSettingsOnly()
  showResetDialog.value = false
  navStore.reloadFromStorage()
  alert('基础设置已重置，书签数据已保留')
}

function doResetAll() {
  settingsStore.resetAll()
  showResetDialog.value = false
  navStore.reloadFromStorage()
  alert('所有设置和书签数据已重置')
}

const bookmarkImportMode = ref<'original' | 'select'>('original')
const bookmarkCategories = ref<{ name: string; count: number; selected: boolean }[]>([])
const parsedBookmarkItems = ref<{ title: string; url: string; icon?: string; category: string }[]>([])
const showBookmarkImport = ref(false)
const selectedImportCategory = ref('tools')
const bookmarkImportFile = ref<File | null>(null)

function handleBookmarkImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  bookmarkImportFile.value = file
  const reader = new FileReader()
  reader.onload = (e) => {
    const html = e.target?.result as string
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const items: { title: string; url: string; icon?: string; category: string }[] = []
    const categoryMap = new Map<string, number>()

    function parseDL(dl: Element, parentCategory: string) {
      const children = dl.children
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.tagName === 'DT') {
          const h3 = child.querySelector(':scope > H3')
          const a = child.querySelector(':scope > A')
          if (h3) {
            const catName = h3.textContent?.trim() || '未分类'
            categoryMap.set(catName, (categoryMap.get(catName) || 0))
            const subDL = child.querySelector(':scope > DL')
            if (subDL) parseDL(subDL, catName)
          } else if (a) {
            const href = a.getAttribute('href')
            const title = a.textContent?.trim()
            const icon = a.getAttribute('ICON')
            if (href && title && (href.startsWith('http') || href.startsWith('file'))) {
              const cat = parentCategory || '未分类'
              items.push({ title, url: href, icon: icon || undefined, category: cat })
              categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1)
            }
          }
        }
      }
    }

    const rootDL = doc.querySelector('dl')
    if (rootDL) parseDL(rootDL, '')

    if (items.length === 0) {
      alert('未找到有效书签')
      return
    }

    parsedBookmarkItems.value = items
    bookmarkCategories.value = Array.from(categoryMap.entries()).map(([name, count]) => ({ name, count, selected: true }))
    showBookmarkImport.value = true
  }
  reader.readAsText(file)
  ;(event.target as HTMLInputElement).value = ''
}

function confirmBookmarkImport() {
  let items = parsedBookmarkItems.value
  if (bookmarkImportMode.value === 'select') {
    const targetCat = selectedImportCategory.value
    items = items.map(item => ({ ...item, category: targetCat }))
  } else {
    const selectedCats = new Set(bookmarkCategories.value.filter(c => c.selected).map(c => c.name))
    items = items.filter(item => selectedCats.has(item.category))
  }
  if (items.length === 0) {
    alert('没有可导入的书签')
    return
  }
  const catSet = new Set(items.map(i => i.category))
  for (const catName of catSet) {
    const existing = navStore.categories.find(c => c.name === catName)
    if (!existing) {
      navStore.addCategory(catName, '📁', '#6366f1')
    }
  }
  let imported = 0
  for (const item of items) {
    const exists = navStore.links.some(l => l.urls.extranet === item.url || l.urls.intranet === item.url)
    if (!exists) {
      const cat = navStore.categories.find(c => c.name === item.category)
      navStore.addLink({
        title: item.title,
        icon: 'link',
        iconUrl: item.icon,
        category: cat ? cat.id : 'tools',
        urls: { extranet: item.url },
        tags: [],
        pinned: false,
      })
      imported++
    }
  }
  showBookmarkImport.value = false
  alert(`成功导入 ${imported} 个书签（跳过 ${items.length - imported} 个重复项）`)
  if (imported > 0) {
    navStore.batchFetchFavicons()
  }
}

async function handleLocalImageUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 50 * 1024 * 1024) {
    alert('图片大小不能超过 50MB')
    return
  }
  const reader = new FileReader()
  reader.onload = async (e) => {
    let dataUrl = e.target?.result as string
    if (file.size > 4 * 1024 * 1024) {
      dataUrl = await compressImage(dataUrl, 2560, 0.85)
    }
    settingsStore.setBackgroundImage(dataUrl)
  }
  reader.readAsDataURL(file)
}

function compressImage(dataUrl: string, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
</script>

<template>
  <div class="settings-overlay" @click.self="emit('close')">
    <div class="settings-modal">
      <div class="settings-header">
        <h3>设置</h3>
        <button class="close-btn" @click="emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div class="settings-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab-btn', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          <span>{{ tab.icon }}</span>
          {{ tab.name }}
        </button>
      </div>

      <div class="settings-content">
        <div v-show="activeTab === 'theme'" class="settings-section">
          <h4>网站信息</h4>
          <div class="form-group">
            <label>网站标题</label>
            <input
              type="text"
              :value="settingsStore.settings.siteTitle"
              @input="settingsStore.setSiteTitle(($event.target as HTMLInputElement).value)"
              placeholder="NavHub"
            />
          </div>
          <div class="form-group">
            <label>网站描述</label>
            <input
              type="text"
              :value="settingsStore.settings.siteDescription"
              @input="settingsStore.setSiteDescription(($event.target as HTMLInputElement).value)"
              placeholder="个人导航中心"
            />
          </div>

          <h4>主题模式</h4>
          <div class="theme-modes">
            <button
              v-for="mode in ['light', 'dark', 'auto']"
              :key="mode"
              :class="['mode-btn', { active: settingsStore.settings.theme.mode === mode }]"
              @click="settingsStore.setThemeMode(mode as any)"
            >
              {{ mode === 'light' ? '☀️' : mode === 'dark' ? '🌙' : '🔄' }}
              {{ mode === 'light' ? '亮色' : mode === 'dark' ? '暗色' : '自动' }}
            </button>
          </div>

          <h4>主题色</h4>
          <div class="color-picker">
            <button
              v-for="color in themeColors"
              :key="color"
              :class="['color-btn', { active: settingsStore.settings.theme.primaryColor === color }]"
              :style="{ background: color }"
              @click="settingsStore.setPrimaryColor(color)"
            />
            <button
              :class="['color-btn color-btn-custom', { active: showCustomColorInput }]"
              @click="showCustomColorInput = !showCustomColorInput"
            >
              +
            </button>
          </div>
          <div v-if="showCustomColorInput" class="custom-color-row">
            <input
              type="color"
              :value="settingsStore.settings.theme.primaryColor"
              @input="settingsStore.setPrimaryColor(($event.target as HTMLInputElement).value)"
              class="color-input-native"
            />
            <input
              type="text"
              class="color-text-input"
              :value="settingsStore.settings.theme.primaryColor"
              @input="settingsStore.setPrimaryColor(($event.target as HTMLInputElement).value)"
              placeholder="#6366f1"
            />
          </div>

          <h4>纯色背景</h4>
          <div class="color-picker">
            <button
              :class="['color-btn', { active: !settingsStore.settings.theme.backgroundColor }]"
              :style="{ background: 'var(--bg-card)', border: '2px dashed var(--border)' }"
              title="跟随主题"
              @click="settingsStore.setBackgroundColor('')"
            />
            <button
              v-for="color in bgColors"
              :key="color"
              :class="['color-btn', { active: settingsStore.settings.theme.backgroundColor === color }]"
              :style="{ background: color }"
              @click="settingsStore.setBackgroundColor(color)"
            />
            <button
              :class="['color-btn color-btn-custom', { active: showCustomBgInput }]"
              @click="showCustomBgInput = !showCustomBgInput"
            >
              +
            </button>
          </div>
          <div v-if="showCustomBgInput" class="custom-color-row">
            <input
              type="color"
              :value="settingsStore.settings.theme.backgroundColor || '#f8fafc'"
              @input="settingsStore.setBackgroundColor(($event.target as HTMLInputElement).value)"
              class="color-input-native"
            />
            <input
              type="text"
              class="color-text-input"
              :value="settingsStore.settings.theme.backgroundColor"
              @input="settingsStore.setBackgroundColor(($event.target as HTMLInputElement).value)"
              placeholder="输入颜色值..."
            />
          </div>

          <h4>自定义背景图</h4>
          <div class="bg-section">
            <div class="bg-input-row">
              <input
                type="text"
                class="bg-url-input"
                placeholder="输入图片 URL 地址..."
                :value="effectiveBgImage.startsWith('data:') ? '' : effectiveBgImage"
                @input="settingsStore.setBackgroundImage(($event.target as HTMLInputElement).value)"
              />
              <label class="bg-upload-btn" title="上传本地图片">
                📁
                <input type="file" accept="image/*" @change="handleLocalImageUpload" hidden />
              </label>
              <button
                v-if="effectiveBgImage"
                class="bg-clear-btn"
                title="清除背景图"
                @click="settingsStore.setBackgroundImage('')"
              >
                ✕
              </button>
            </div>
            <div class="bg-hint">输入图片 URL 或上传本地图片作为背景</div>
            <div v-if="effectiveBgImage" class="slider-row">
              <span>模糊强度</span>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                :value="settingsStore.settings.theme.bgBlur ?? 0"
                @input="settingsStore.setBgBlur(Number(($event.target as HTMLInputElement).value))"
                class="range-slider"
              />
              <span class="slider-val">{{ settingsStore.settings.theme.bgBlur ?? 0 }}px</span>
            </div>
            <div v-if="effectiveBgImage" class="toggle-row">
              <span>毛玻璃效果</span>
              <button
                :class="['toggle', { active: settingsStore.settings.theme.glassEffect }]"
                @click="settingsStore.toggleGlassEffect()"
              >
                {{ settingsStore.settings.theme.glassEffect ? '开' : '关' }}
              </button>
            </div>
            <div v-if="effectiveBgImage" class="slider-row">
              <span>白膜透明度</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                :value="settingsStore.settings.theme.bgOverlayOpacity ?? 0.12"
                @input="settingsStore.setBgOverlayOpacity(Number(($event.target as HTMLInputElement).value))"
                class="range-slider"
              />
              <span class="slider-val">{{ Math.round((settingsStore.settings.theme.bgOverlayOpacity ?? 0.12) * 100) }}%</span>
            </div>
          </div>

          <h4>搜索框样式</h4>
          <div class="color-picker">
            <button
              :class="['color-btn', { active: !settingsStore.settings.theme.searchColor }]"
              :style="{ background: 'var(--bg-card)', border: '2px dashed var(--border)' }"
              title="跟随主题"
              @click="settingsStore.setSearchColor('')"
            />
            <button
              v-for="color in themeColors"
              :key="'sc-' + color"
              :class="['color-btn', { active: settingsStore.settings.theme.searchColor === color }]"
              :style="{ background: color }"
              @click="settingsStore.setSearchColor(color)"
            />
            <button
              :class="['color-btn color-btn-custom', { active: showCustomSearchColor }]"
              @click="showCustomSearchColor = !showCustomSearchColor"
            >
              +
            </button>
          </div>
          <div v-if="showCustomSearchColor" class="custom-color-row">
            <input type="color" :value="settingsStore.settings.theme.searchColor || '#ffffff'" @input="settingsStore.setSearchColor(($event.target as HTMLInputElement).value)" class="color-input-native" />
            <input type="text" class="color-text-input" :value="settingsStore.settings.theme.searchColor" @input="settingsStore.setSearchColor(($event.target as HTMLInputElement).value)" placeholder="#ffffff" />
          </div>
          <div class="slider-row">
            <span>搜索框透明度</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              :value="settingsStore.settings.theme.searchOpacity ?? 1"
              @input="settingsStore.setSearchOpacity(Number(($event.target as HTMLInputElement).value))"
              class="range-slider"
            />
            <span class="slider-val">{{ Math.round((settingsStore.settings.theme.searchOpacity ?? 1) * 100) }}%</span>
          </div>

          <h4>书签卡片样式</h4>
          <div class="color-picker">
            <button
              :class="['color-btn', { active: !settingsStore.settings.theme.cardColor }]"
              :style="{ background: 'var(--bg-card)', border: '2px dashed var(--border)' }"
              title="跟随主题"
              @click="settingsStore.setCardColor('')"
            />
            <button
              v-for="color in themeColors"
              :key="'cc-' + color"
              :class="['color-btn', { active: settingsStore.settings.theme.cardColor === color }]"
              :style="{ background: color }"
              @click="settingsStore.setCardColor(color)"
            />
            <button
              :class="['color-btn color-btn-custom', { active: showCustomCardColor }]"
              @click="showCustomCardColor = !showCustomCardColor"
            >
              +
            </button>
          </div>
          <div v-if="showCustomCardColor" class="custom-color-row">
            <input type="color" :value="settingsStore.settings.theme.cardColor || '#ffffff'" @input="settingsStore.setCardColor(($event.target as HTMLInputElement).value)" class="color-input-native" />
            <input type="text" class="color-text-input" :value="settingsStore.settings.theme.cardColor" @input="settingsStore.setCardColor(($event.target as HTMLInputElement).value)" placeholder="#ffffff" />
          </div>
          <div class="slider-row">
            <span>卡片透明度</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              :value="settingsStore.settings.theme.cardOpacity ?? 1"
              @input="settingsStore.setCardOpacity(Number(($event.target as HTMLInputElement).value))"
              class="range-slider"
            />
            <span class="slider-val">{{ Math.round((settingsStore.settings.theme.cardOpacity ?? 1) * 100) }}%</span>
          </div>

          <h4>字体颜色</h4>
          <div class="color-picker">
            <button
              :class="['color-btn', { active: !settingsStore.settings.theme.textColor }]"
              :style="{ background: 'var(--bg-card)', border: '2px dashed var(--border)' }"
              title="跟随主题"
              @click="settingsStore.setTextColor('')"
            />
            <button
              v-for="color in textColors"
              :key="'tc-' + color"
              :class="['color-btn', { active: settingsStore.settings.theme.textColor === color }]"
              :style="{ background: color }"
              @click="settingsStore.setTextColor(color)"
            />
            <button
              :class="['color-btn color-btn-custom', { active: showCustomTextColorInput }]"
              @click="showCustomTextColorInput = !showCustomTextColorInput"
            >
              +
            </button>
          </div>
          <div v-if="showCustomTextColorInput" class="custom-color-row">
            <input
              type="color"
              :value="settingsStore.settings.theme.textColor || '#0f172a'"
              @input="settingsStore.setTextColor(($event.target as HTMLInputElement).value)"
              class="color-input-native"
            />
            <input
              type="text"
              class="color-text-input"
              :value="settingsStore.settings.theme.textColor"
              @input="settingsStore.setTextColor(($event.target as HTMLInputElement).value)"
              placeholder="#0f172a"
            />
          </div>
        </div>

        <div v-show="activeTab === 'layout'" class="settings-section">
          <h4>卡片尺寸</h4>
          <div class="layout-modes">
            <button
              v-for="size in ['small', 'medium', 'large']"
              :key="size"
              :class="['mode-btn', { active: settingsStore.settings.layout.cardSize === size }]"
              @click="settingsStore.setCardSize(size as any)"
            >
              {{ size === 'small' ? '小' : size === 'medium' ? '中' : '大' }}
            </button>
          </div>

          <h4>其他设置</h4>
          <div class="toggle-row">
            <span>显示描述</span>
            <button
              :class="['toggle', { active: settingsStore.settings.layout.showDescription }]"
              @click="settingsStore.toggleDescription()"
            >
              {{ settingsStore.settings.layout.showDescription ? '开' : '关' }}
            </button>
          </div>
          <div class="toggle-row">
            <span>紧凑模式</span>
            <button
              :class="['toggle', { active: settingsStore.settings.layout.compactMode }]"
              @click="settingsStore.toggleCompact()"
            >
              {{ settingsStore.settings.layout.compactMode ? '开' : '关' }}
            </button>
          </div>
        </div>

        <div v-show="activeTab === 'search'" class="settings-section">
          <h4>搜索引擎</h4>
          <div class="engine-list">
            <div
              v-for="engine in settingsStore.settings.search.engines"
              :key="engine.id"
              :class="['engine-item', { active: settingsStore.settings.search.defaultEngine === engine.id }]"
            >
              <div class="engine-item-main" @click="settingsStore.setDefaultEngine(engine.id)">
                <span class="engine-item-icon">{{ engine.icon }}</span>
                <div class="engine-item-info">
                  <div class="engine-item-name">{{ engine.name }}</div>
                  <div class="engine-item-url">{{ engine.urlTemplate }}</div>
                </div>
                <div v-if="settingsStore.settings.search.defaultEngine === engine.id" class="engine-item-check">✓</div>
              </div>
              <div class="engine-item-actions">
                <button class="engine-action-btn" title="编辑" @click.stop="openEditEngine(engine.id)">✏️</button>
                <button class="engine-action-btn" title="删除" @click.stop="removeEngine(engine.id)">🗑️</button>
              </div>
            </div>
          </div>
          <button class="btn btn-secondary add-engine-btn" @click="openAddEngine">
            ＋ 添加搜索引擎
          </button>

          <Transition name="fade">
            <div v-if="showEngineForm" class="engine-form">
              <h4>{{ editingEngineId ? '编辑搜索引擎' : '添加搜索引擎' }}</h4>
              <div class="form-group">
                <label>名称</label>
                <input v-model="engineForm.name" placeholder="如：Google" />
              </div>
              <div class="form-group">
                <label>图标 (emoji)</label>
                <input v-model="engineForm.icon" placeholder="如：🔍" />
              </div>
              <div class="form-group">
                <label>URL 模板</label>
                <input v-model="engineForm.urlTemplate" placeholder="如：https://www.google.com/search?q={q}" />
                <span class="form-hint">用 {q} 表示搜索词位置</span>
              </div>
              <div class="form-actions">
                <button class="btn btn-secondary" @click="resetEngineForm">取消</button>
                <button class="btn btn-primary" @click="saveEngine">保存</button>
              </div>
            </div>
          </Transition>
        </div>

        <div v-show="activeTab === 'data'" class="settings-section">
          <h4>数据导入导出</h4>
          <div class="data-actions">
            <button class="btn btn-secondary" @click="handleExport">
              📤 导出数据
            </button>
            <label class="btn btn-secondary">
              📥 导入数据
              <input type="file" accept=".json" @change="handleImport" hidden />
            </label>
          </div>

          <h4>书签导入</h4>
          <label class="btn btn-secondary">
            📑 从浏览器书签导入
            <input type="file" accept=".html,.htm" @change="handleBookmarkImport" hidden />
          </label>

          <h4>文件管理</h4>
          <button class="btn btn-secondary" @click="showFileManager = true">
            📂 管理壁纸和图标
          </button>

          <h4>危险操作</h4>
          <button class="btn btn-danger" @click="handleReset">
            🗑️ 重置所有设置
          </button>
        </div>

        <div v-show="activeTab === 'account'" class="settings-section">
          <h4>账户信息</h4>
          <div class="account-info">
            <div class="account-row">
              <span class="account-label">用户名</span>
              <span class="account-value">{{ auth.username }}</span>
            </div>
            <div class="account-row">
              <span class="account-label">身份</span>
              <span class="account-value">{{ auth.isAdmin ? '管理员' : '普通用户' }}</span>
            </div>
          </div>

          <h4>修改密码</h4>
          <button v-if="!showPasswordForm" class="btn btn-secondary" @click="showPasswordForm = true">
            🔑 修改密码
          </button>
          <Transition name="fade">
            <div v-if="showPasswordForm" class="engine-form">
              <div class="form-group">
                <label>旧密码</label>
                <input type="password" v-model="pwdForm.oldPassword" placeholder="输入旧密码" />
              </div>
              <div class="form-group">
                <label>新密码</label>
                <input type="password" v-model="pwdForm.newPassword" placeholder="输入新密码（至少4个字符）" />
              </div>
              <div class="form-group">
                <label>确认新密码</label>
                <input type="password" v-model="pwdForm.confirmPassword" placeholder="再次输入新密码" />
              </div>
              <div v-if="pwdError" class="form-error">{{ pwdError }}</div>
              <div v-if="pwdSuccess" class="form-success">密码修改成功</div>
              <div class="form-actions">
                <button class="btn btn-secondary" @click="showPasswordForm = false; pwdError = ''; pwdForm.oldPassword = ''; pwdForm.newPassword = ''; pwdForm.confirmPassword = ''">取消</button>
                <button class="btn btn-primary" :disabled="pwdLoading" @click="handleChangePassword">
                  {{ pwdLoading ? '修改中...' : '确认修改' }}
                </button>
              </div>
            </div>
          </Transition>

          <div class="logout-section">
            <button class="btn btn-danger" @click="auth.logout(); emit('close')">
              🚪 退出登录
            </button>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <div v-if="showBookmarkImport" class="bookmark-import-overlay" @click.self="showBookmarkImport = false">
          <div class="bookmark-import-modal">
            <div class="bi-header">
              <h3>导入书签</h3>
              <span class="bi-count">共发现 {{ parsedBookmarkItems.length }} 个书签</span>
            </div>

            <div class="bi-modes">
              <button :class="['mode-btn', { active: bookmarkImportMode === 'original' }]" @click="bookmarkImportMode = 'original'">按原分类导入</button>
              <button :class="['mode-btn', { active: bookmarkImportMode === 'select' }]" @click="bookmarkImportMode = 'select'">导入到指定分类</button>
            </div>

            <div v-if="bookmarkImportMode === 'original'" class="bi-category-list">
              <div v-for="cat in bookmarkCategories" :key="cat.name" class="bi-cat-item" @click="cat.selected = !cat.selected">
                <input type="checkbox" v-model="cat.selected" class="bi-checkbox" />
                <span class="bi-cat-name">{{ cat.name }}</span>
                <span class="bi-cat-count">{{ cat.count }} 个书签</span>
              </div>
            </div>

            <div v-else class="bi-select-target">
              <label class="bi-label">选择目标分类</label>
              <select v-model="selectedImportCategory" class="bi-select">
                <option v-for="cat in navStore.sortedCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                <option value="tools">工具网站</option>
              </select>
            </div>

            <div class="bi-actions">
              <button class="btn btn-secondary" @click="showBookmarkImport = false">取消</button>
              <button class="btn btn-primary" @click="confirmBookmarkImport">开始导入</button>
            </div>
          </div>
        </div>
      </Teleport>

      <FileManager
        v-if="showFileManager"
        @close="showFileManager = false"
        @select-wallpaper="handleFileManagerSelect"
      />

      <Transition name="fade">
        <div v-if="showResetDialog" class="reset-overlay" @click.self="showResetDialog = false">
          <Transition name="modal-pop" appear>
            <div v-if="showResetDialog" class="reset-modal">
              <h3>重置设置</h3>
              <p class="reset-desc">请选择重置方式：</p>
              <div class="reset-options">
                <button class="reset-option reset-option-safe" @click="doResetSettings">
                  <div class="reset-option-icon">⚙️</div>
                  <div class="reset-option-info">
                    <div class="reset-option-title">基础设置重置</div>
                    <div class="reset-option-desc">仅重置主题、布局等配置，保留所有书签数据</div>
                  </div>
                </button>
                <button class="reset-option reset-option-danger" @click="doResetAll">
                  <div class="reset-option-icon">🗑️</div>
                  <div class="reset-option-info">
                    <div class="reset-option-title">全部重置</div>
                    <div class="reset-option-desc">重置所有设置并删除所有书签，恢复到初始状态</div>
                  </div>
                </button>
              </div>
              <button class="btn btn-secondary btn-block" @click="showResetDialog = false">取消</button>
            </div>
          </Transition>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
}

.settings-modal {
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: modalSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(24px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.settings-header h3 {
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

.settings-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  transition: all var(--transition);
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.tab-btn.active {
  background: var(--primary);
  color: white;
}

.settings-content {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-top: 8px;
}

.settings-section h4:first-child {
  margin-top: 0;
}

.theme-modes,
.layout-modes {
  display: flex;
  gap: 8px;
}

.mode-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  transition: all var(--transition);
}

.mode-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.mode-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.color-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all var(--transition);
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: var(--text);
  transform: scale(1.1);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text);
}

.toggle {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: var(--bg);
  color: var(--text-muted);
  transition: all var(--transition);
}

.toggle.active {
  background: var(--primary);
  color: white;
}

.search-engines {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.engine-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  transition: all var(--transition);
}

.engine-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.engine-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}

.engine-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.engine-item {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all var(--transition);
  overflow: hidden;
}

.engine-item.active {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.05);
}

.engine-item-main {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  flex: 1;
  cursor: pointer;
  min-width: 0;
}

.engine-item-main:hover {
  background: var(--bg-hover);
}

.engine-item-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.engine-item-info {
  flex: 1;
  min-width: 0;
}

.engine-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.engine-item-url {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.engine-item-check {
  color: var(--primary);
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.engine-item-actions {
  display: flex;
  gap: 2px;
  padding: 0 6px;
  flex-shrink: 0;
}

.engine-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-muted);
  transition: all var(--transition);
  cursor: pointer;
}

.engine-action-btn:hover {
  background: var(--bg-hover);
}

.add-engine-btn {
  align-self: flex-start;
}

.engine-form {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.engine-form h4 {
  margin: 0;
  font-size: 14px;
  color: var(--text);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.form-group input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text);
  background: var(--bg-card);
  outline: none;
  transition: border-color var(--transition);
}

.form-group input:focus {
  border-color: var(--primary);
}

.form-group input::placeholder {
  color: var(--text-muted);
}

.form-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.form-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-primary {
  background: var(--primary);
  color: white;
  border: 1px solid var(--primary);
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.data-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-secondary {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.bg-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bg-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bg-url-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text);
  background: var(--bg-card);
  outline: none;
  transition: border-color var(--transition);
}

.bg-url-input:focus {
  border-color: var(--primary);
}

.bg-url-input::placeholder {
  color: var(--text-muted);
}

.bg-clear-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
  cursor: pointer;
}

.bg-clear-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.bg-hint {
  font-size: 11px;
  color: var(--text-muted);
}

.bg-preview {
  width: 100%;
  height: 120px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.bg-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.color-btn-custom {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg);
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
}

.color-input-native {
  width: 40px;
  height: 32px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  background: var(--bg-card);
}

.color-text-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  font-family: monospace;
  color: var(--text);
  background: var(--bg-card);
  outline: none;
  transition: border-color var(--transition);
}

.color-text-input:focus {
  border-color: var(--primary);
}

.color-text-input::placeholder {
  color: var(--text-muted);
}

.bg-upload-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all var(--transition);
  flex-shrink: 0;
}

.bg-upload-btn:hover {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.05);
}

.sync-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sync-hint {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-mode-tabs {
  display: flex;
  gap: 0;
  background: var(--bg);
  border-radius: 8px;
  padding: 3px;
  border: 1px solid var(--border);
}

.auth-mode-btn {
  flex: 1;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 6px;
  color: var(--text-secondary);
  transition: all var(--transition);
}

.auth-mode-btn.active {
  background: var(--primary);
  color: #fff;
}

.auth-remember-row {
  display: flex;
  align-items: center;
}

.remember-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.remember-label input[type="checkbox"] {
  accent-color: var(--primary);
  width: 15px;
  height: 15px;
}

.auth-message {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  text-align: center;
}

.auth-message.loading {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.auth-message.success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.auth-message.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.auth-message.idle {
  display: none;
}

.auth-logged-in {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.auth-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg);
  border-radius: 10px;
  border: 1px solid var(--border);
}

.auth-label {
  font-size: 12px;
  color: var(--text-muted);
}

.auth-username {
  flex: 1;
  font-size: 18px;
  font-weight: 700;
  color: var(--primary);
}

.auth-actions {
  display: flex;
  gap: 8px;
}

.auth-actions .btn {
  flex: 1;
  justify-content: center;
}

.btn-block {
  width: 100%;
  justify-content: center;
}

.copy-btn {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  transition: all var(--transition);
}

.copy-btn:hover {
  background: var(--primary);
  color: #fff;
}

.btn-danger-outline {
  background: transparent;
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger-outline:hover {
  background: rgba(239, 68, 68, 0.1);
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 14px;
  color: var(--text);
}

.range-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-hover);
  outline: none;
}

.range-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.range-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.slider-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: right;
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg);
  border-radius: 10px;
  border: 1px solid var(--border);
}

.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.account-label {
  font-size: 13px;
  color: var(--text-muted);
}

.account-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.form-error {
  font-size: 12px;
  color: #ef4444;
  padding: 6px 10px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 6px;
}

.form-success {
  font-size: 12px;
  color: #22c55e;
  padding: 6px 10px;
  background: rgba(34, 197, 94, 0.08);
  border-radius: 6px;
}

.logout-section {
  margin-top: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
</style>

<style>
.bookmark-import-overlay {
  position: fixed;
  inset: 0;
  z-index: 6000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.15s ease;
}

.bookmark-import-modal {
  width: 420px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: scaleIn 0.2s ease;
  overflow-y: auto;
}

.bi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.bi-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.bi-count {
  font-size: 12px;
  color: var(--text-muted);
  padding: 3px 10px;
  background: var(--bg);
  border-radius: 10px;
}

.bi-modes {
  display: flex;
  gap: 4px;
  background: var(--bg);
  border-radius: 10px;
  padding: 3px;
}

.bi-modes .mode-btn {
  flex: 1;
  padding: 8px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  transition: all var(--transition);
  cursor: pointer;
  border: none;
  outline: none;
}

.bi-modes .mode-btn.active {
  background: var(--bg-card);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.bi-category-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.bi-cat-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.bi-cat-item:hover {
  background: var(--bg-hover);
}

.bi-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
  cursor: pointer;
}

.bi-cat-name {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.bi-cat-count {
  font-size: 12px;
  color: var(--text-muted);
}

.bi-select-target {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bi-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.bi-select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  cursor: pointer;
}

.bi-select:focus {
  border-color: var(--primary);
}

.bi-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.bi-actions .btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.bi-actions .btn-secondary {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.bi-actions .btn-secondary:hover {
  background: var(--bg);
}

.bi-actions .btn-primary {
  background: var(--primary);
  color: #fff;
  border: none;
}

.bi-actions .btn-primary:hover {
  opacity: 0.9;
}

.btn-sm {
  padding: 7px 14px;
  font-size: 12px;
  align-self: flex-start;
}

.reset-overlay {
  position: fixed;
  inset: 0;
  z-index: 6000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.reset-modal {
  width: 380px;
  max-width: 90vw;
  background: var(--bg-card);
  border: none;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reset-modal h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.reset-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.reset-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reset-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--bg);
  border: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-align: left;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.reset-option:hover {
  transform: translateY(-1px);
}

.reset-option-safe:hover {
  background: rgba(99, 102, 241, 0.08);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.reset-option-danger:hover {
  background: rgba(239, 68, 68, 0.08);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
}

.reset-option-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.reset-option-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reset-option-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.reset-option-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}
</style>
