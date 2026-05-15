<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { pinyinMatch } from '@/utils/pinyin'
import { highlightMatch } from '@/utils/helpers'

const emit = defineEmits<{
  close: []
  'open-settings': []
  'open-stats': []
}>()

const navStore = useNavStore()
const settingsStore = useSettingsStore()
const searchInput = ref<HTMLInputElement | null>(null)
const query = ref('')
// 键盘导航：当前高亮的项索引，-1 表示未选中
const activeIndex = ref(-1)

const isCommandMode = computed(() => query.value.startsWith('>'))

const suggestions = computed(() => {
  if (!query.value.trim()) return []
  if (isCommandMode.value) return []

  const q = query.value.toLowerCase()
  return navStore.links
    .filter(link =>
      pinyinMatch(link.title, q) ||
      link.description?.toLowerCase().includes(q) ||
      link.tags.some(tag => pinyinMatch(tag, q))
    )
    .slice(0, 8)
})

const commands = computed(() => {
  if (!isCommandMode.value) return []

  const cmd = query.value.slice(1).toLowerCase().trim()
  const allCommands = [
    { id: 'settings', name: '打开设置', icon: '⚙️', action: () => { emit('close'); emit('open-settings') } },
    { id: 'export', name: '导出数据', icon: '�', action: () => { handleExport() } },
    { id: 'stats', name: '查看统计', icon: '�', action: () => { emit('close'); emit('open-stats') } },
    { id: 'theme-dark', name: '切换暗色主题', icon: '🌙', action: () => { settingsStore.setThemeMode('dark'); settingsStore.save(); emit('close') } },
    { id: 'theme-light', name: '切换亮色主题', icon: '☀️', action: () => { settingsStore.setThemeMode('light'); settingsStore.save(); emit('close') } },
  ]

  if (!cmd) return allCommands
  return allCommands.filter(c => c.name.toLowerCase().includes(cmd))
})

// 合并 suggestions 和 commands 为统一列表，用于键盘导航
const navItems = computed(() => {
  const items: { type: 'link' | 'command'; data: any }[] = []
  for (const link of suggestions.value) {
    items.push({ type: 'link', data: link })
  }
  for (const cmd of commands.value) {
    items.push({ type: 'command', data: cmd })
  }
  return items
})

function handleExport() {
  const data = navStore.exportData()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'navhub-export.json'
  a.click()
  URL.revokeObjectURL(url)
  emit('close')
}

function handleSelect(link: { urls: { intranet?: string; extranet?: string } }) {
  const url = link.urls.extranet || link.urls.intranet
  if (url) {
    window.open(url, '_blank')
  }
  emit('close')
}

function handleCommandSelect(cmd: { action: () => void }) {
  cmd.action()
}

function handleSearch() {
  if (query.value.trim() && !isCommandMode.value) {
    const engine = settingsStore.currentEngine
    const url = engine.urlTemplate.replace('{q}', encodeURIComponent(query.value))
    window.open(url, '_blank')
    emit('close')
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  } else if (e.key === 'ArrowDown') {
    // 向下移动高亮项
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, navItems.value.length - 1)
    scrollToActive()
  } else if (e.key === 'ArrowUp') {
    // 向上移动高亮项
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, -1)
    scrollToActive()
  } else if (e.key === 'Enter') {
    // 如果有高亮项则选中对应项
    if (activeIndex.value >= 0 && navItems.value[activeIndex.value]) {
      const item = navItems.value[activeIndex.value]
      if (item.type === 'link') {
        handleSelect(item.data)
      } else {
        handleCommandSelect(item.data)
      }
    } else if (suggestions.value.length > 0) {
      handleSelect(suggestions.value[0])
    } else if (commands.value.length > 0 && isCommandMode.value) {
      handleCommandSelect(commands.value[0])
    } else {
      handleSearch()
    }
  }
}

/** 滚动当前高亮的项到可见区域 */
function scrollToActive() {
  nextTick(() => {
    const container = document.querySelector('.search-results') as HTMLElement
    if (!container) return
    const activeEl = container.querySelector('.result-item.active') as HTMLElement
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  })
}

onMounted(() => {
  nextTick(() => {
    searchInput.value?.focus()
  })
})
</script>

<template>
  <div class="search-overlay" role="dialog" aria-modal="true" aria-label="搜索" @mousedown.self="emit('close')">
    <div class="search-modal">
      <div class="search-header">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder="搜索网址或输入 > 查看命令..."
            aria-label="搜索书签或输入命令"
            @keydown="handleKeydown"
            autofocus
          />
          <kbd>Esc</kbd>
        </div>
      </div>

      <div v-if="suggestions.length > 0" class="search-results">
        <div class="result-section">
          <div class="result-title">网址</div>
          <div
            v-for="(link, index) in suggestions"
            :key="link.id"
            :class="['result-item', { active: index === activeIndex }]"
            @click="handleSelect(link)"
          >
            <div class="result-icon">🔗</div>
            <div class="result-info">
              <div class="result-name"><span v-html="highlightMatch(link.title, query)"></span></div>
              <div class="result-desc">{{ link.description }}</div>
            </div>
            <div class="result-url">{{ link.urls.extranet || link.urls.intranet }}</div>
          </div>
        </div>
      </div>

      <div v-if="isCommandMode && commands.length > 0" class="search-results">
        <div class="result-section">
          <div class="result-title">命令</div>
          <div
            v-for="(cmd, index) in commands"
            :key="cmd.id"
            :class="['result-item', { active: suggestions.length + index === activeIndex }]"
            @click="handleCommandSelect(cmd)"
          >
            <div class="result-icon">{{ cmd.icon }}</div>
            <div class="result-info">
              <div class="result-name">{{ cmd.name }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="!isCommandMode && suggestions.length === 0 && query.trim()" class="search-footer">
        <span class="search-engine-hint" @click="handleSearch">
          使用 {{ settingsStore.currentEngine.name }} 搜索: "{{ query }}"
        </span>
      </div>

      <div v-if="!query.trim()" class="search-tips">
        <div class="tip">💡 输入网址名称快速查找</div>
        <div class="tip">🔍 输入关键词搜索</div>
        <div class="tip">⚡ 输入 > 进入命令模式</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20vh;
}

.search-modal {
  width: 90%;
  max-width: 600px;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.search-header {
  padding: 16px;
  border-bottom: 1px solid var(--border);
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg);
  border-radius: 12px;
  border: 2px solid var(--border);
  transition: border-color 0.2s;
}

.search-input-wrapper:focus-within {
  border-color: var(--primary);
}

.search-icon {
  font-size: 18px;
  opacity: 0.5;
}

.search-input-wrapper input {
  flex: 1;
  border: none;
  background: none;
  font-size: 16px;
  color: var(--text);
  outline: none;
}

.search-input-wrapper input::placeholder {
  color: var(--text-muted);
}

.search-input-wrapper kbd {
  padding: 4px 8px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 11px;
  color: var(--text-muted);
  font-family: monospace;
}

.search-results {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.result-section {
  padding: 8px;
}

.result-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  padding: 8px 12px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.result-item:hover {
  background: var(--bg-hover);
}

.result-item.active {
  background: var(--bg-hover);
}

.result-icon {
  font-size: 20px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border-radius: 10px;
  flex-shrink: 0;
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.result-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-url {
  font-size: 11px;
  color: var(--text-muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: center;
}

.search-engine-hint {
  font-size: 13px;
  color: var(--primary);
  padding: 8px 16px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 8px;
  cursor: pointer;
}

.search-engine-hint:hover {
  background: rgba(99, 102, 241, 0.2);
}

.search-tips {
  padding: 24px 16px;
  text-align: center;
}

.tip {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
</style>
