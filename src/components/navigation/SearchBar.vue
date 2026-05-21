<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useNavStore } from '@/stores/nav'
import { useNetworkStore } from '@/stores/network'
import { getEngineFaviconCandidates, highlightMatch, getFaviconCandidates } from '@/utils/helpers'
import { animateDropdown } from '@/composables/useAnimation'
import { pinyinMatch } from '@/utils/pinyin'
import type { NavLink } from '@/types'

const settingsStore = useSettingsStore()
const navStore = useNavStore()
const networkStore = useNetworkStore()

function getLinkIconSrc(link: NavLink): string {
  if (link.cachedIconData) return link.cachedIconData
  if (link.iconUrl) return link.iconUrl
  if (link.faviconFetchFailed) return ''
  const { urls } = link
  const url = networkStore.currentType === 'intranet'
    ? urls.intranet || urls.extranet || urls.tunnel
    : networkStore.currentType === 'tunnel'
      ? urls.tunnel || urls.extranet || urls.intranet
      : urls.extranet || urls.intranet || urls.tunnel
  if (!url) return ''
  const candidates = getFaviconCandidates(url)
  return candidates[0] || ''
}

function getLinkLetter(link: NavLink): string {
  if (link.icon) return link.icon
  const first = (link.title || '').charAt(0)
  return first ? first.toUpperCase() : '?'
}

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const showSuggestions = ref(false)
const showEnginePicker = ref(false)
const enginePickerRef = ref<HTMLElement | null>(null)
const engineDropdownRef = ref<HTMLElement | null>(null)
const suggestionsDropdownRef = ref<HTMLElement | null>(null)
// 键盘导航：当前高亮的建议项索引，-1 表示未选中
const activeIndex = ref(-1)

const suggestions = computed(() => {
  if (!query.value.trim()) return []
  const q = query.value.toLowerCase()
  return navStore.links
    .filter(link =>
      pinyinMatch(link.title, q) ||
      link.description?.toLowerCase().includes(q) ||
      link.tags.some(tag => pinyinMatch(tag, q))
    )
    .slice(0, 8)
})

const currentEngine = computed(() => settingsStore.currentEngine)

const engineIconIndex = ref<Record<string, number>>({})

function getEngineIconSrc(urlTemplate: string, id: string): string {
  const candidates = getEngineFaviconCandidates(urlTemplate)
  const idx = engineIconIndex.value[id] || 0
  return candidates[idx] || ''
}

function handleEngineFaviconError(e: Event, urlTemplate: string, id: string) {
  const candidates = getEngineFaviconCandidates(urlTemplate)
  const currentIdx = engineIconIndex.value[id] || 0
  const nextIdx = currentIdx + 1
  if (nextIdx < candidates.length) {
    engineIconIndex.value = { ...engineIconIndex.value, [id]: nextIdx }
  } else {
    engineIconIndex.value = { ...engineIconIndex.value, [id]: -1 }
  }
}

function getEngineLetter(engine: { name: string; id: string }): string {
  const name = engine.name || engine.id || '?'
  return name.charAt(0).toUpperCase()
}

watch(currentEngine, () => {
  engineIconIndex.value = {}
})

function selectEngine(id: string) {
  settingsStore.setDefaultEngine(id)
  showEnginePicker.value = false
  inputRef.value?.focus()
}

function handleSearch() {
  const q = query.value.trim()
  if (!q) return
  const engine = currentEngine.value
  const url = engine.urlTemplate.replace('{q}', encodeURIComponent(q))
  window.open(url, '_blank')
  query.value = ''
  showSuggestions.value = false
}

function handleSelect(link: { urls: { intranet?: string; extranet?: string } }) {
  const url = link.urls.extranet || link.urls.intranet
  if (url) window.open(url, '_blank')
  query.value = ''
  showSuggestions.value = false
  activeIndex.value = -1
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    // 向下移动高亮项
    e.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, suggestions.value.length - 1)
    scrollToActive()
  } else if (e.key === 'ArrowUp') {
    // 向上移动高亮项
    e.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, -1)
    scrollToActive()
  } else if (e.key === 'Enter') {
    // 如果有高亮项则选中，否则选第一个建议或执行搜索
    if (activeIndex.value >= 0 && suggestions.value[activeIndex.value]) {
      handleSelect(suggestions.value[activeIndex.value])
    } else if (suggestions.value.length > 0) {
      handleSelect(suggestions.value[0])
    } else {
      handleSearch()
    }
  } else if (e.key === 'Escape') {
    query.value = ''
    showSuggestions.value = false
    activeIndex.value = -1
    inputRef.value?.blur()
  }
}

/** 滚动当前高亮的建议项到可见区域 */
function scrollToActive() {
  nextTick(() => {
    const container = suggestionsDropdownRef.value
    if (!container) return
    const activeEl = container.querySelector('.suggestion-item.active') as HTMLElement
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  })
}

function handleFocus() {
  if (query.value.trim()) showSuggestions.value = true
}

watch(showEnginePicker, (val) => {
  nextTick(() => {
    if (engineDropdownRef.value) {
      animateDropdown(engineDropdownRef.value, val)
    }
  })
})

watch(showSuggestions, (val) => {
  nextTick(() => {
    if (suggestionsDropdownRef.value) {
      animateDropdown(suggestionsDropdownRef.value, val)
    }
  })
})

function handleClickOutside(e: MouseEvent) {
  if (enginePickerRef.value && !enginePickerRef.value.contains(e.target as Node)) {
    showEnginePicker.value = false
  }
  const target = e.target as HTMLElement
  if (!target.closest('.search-area')) {
    showSuggestions.value = false
  }
}

import { onMounted, onUnmounted } from 'vue'
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="search-area">
    <div class="search-bar" :class="{ focused: showSuggestions && suggestions.length > 0 }">
      <div ref="enginePickerRef" class="engine-selector">
        <button class="engine-btn" :title="'切换搜索引擎 (当前: ' + currentEngine.name + ')'" :aria-label="'切换搜索引擎，当前: ' + currentEngine.name" aria-haspopup="listbox" :aria-expanded="showEnginePicker" @click="showEnginePicker = !showEnginePicker">
          <template v-if="(engineIconIndex[currentEngine.id] ?? 0) >= 0">
            <img :key="currentEngine.id + '-' + (engineIconIndex[currentEngine.id] || 0)" :src="getEngineIconSrc(currentEngine.urlTemplate, currentEngine.id)" class="engine-favicon" @error="(e: Event) => handleEngineFaviconError(e, currentEngine.urlTemplate, currentEngine.id)" />
          </template>
          <span v-else class="engine-letter">{{ getEngineLetter(currentEngine) }}</span>
        </button>
        <div v-if="showEnginePicker" ref="engineDropdownRef" class="engine-dropdown">
          <button
            v-for="engine in settingsStore.settings.search.engines"
            :key="engine.id"
            :class="['engine-option', { active: engine.id === currentEngine.id }]"
            @click="selectEngine(engine.id)"
          >
            <template v-if="(engineIconIndex[engine.id] ?? 0) >= 0">
              <img :key="engine.id + '-' + (engineIconIndex[engine.id] || 0)" :src="getEngineIconSrc(engine.urlTemplate, engine.id)" class="engine-favicon" @error="(e: Event) => handleEngineFaviconError(e, engine.urlTemplate, engine.id)" />
            </template>
            <span v-else class="engine-option-letter">{{ getEngineLetter(engine) }}</span>
            <span>{{ engine.name }}</span>
          </button>
        </div>
      </div>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="搜索书签或输入关键词..."
        aria-label="搜索书签"
        @keydown="handleKeydown"
        @focus="handleFocus"
        @input="showSuggestions = query.trim().length > 0; activeIndex = -1"
      />
      <button v-if="query" class="clear-btn" @click="query = ''; showSuggestions = false; inputRef?.focus()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div v-if="showSuggestions && suggestions.length > 0" ref="suggestionsDropdownRef" class="suggestions-dropdown" role="listbox" aria-label="搜索建议">
      <div
        v-for="(link, index) in suggestions"
        :key="link.id"
        :class="['suggestion-item', { active: index === activeIndex }]"
        role="option"
        :aria-selected="index === activeIndex"
        @click="handleSelect(link)"
      >
        <div class="suggestion-icon">
          <img v-if="getLinkIconSrc(link)" :src="getLinkIconSrc(link)" :alt="link.title" @error="($event.target as HTMLImageElement).style.display='none'" />
          <span v-else class="suggestion-letter">{{ getLinkLetter(link) }}</span>
        </div>
        <div class="suggestion-info">
          <div class="suggestion-name"><span v-html="highlightMatch(link.title, query)"></span></div>
          <div class="suggestion-desc">{{ link.description }}</div>
        </div>
        <div class="suggestion-url">{{ link.urls.extranet || link.urls.intranet }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-area {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  position: relative;
  z-index: 500;
}

.search-bar {
  display: flex;
  align-items: center;
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: none;
  border-radius: 50px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-bottom-input);
}

.search-bar:hover {
  box-shadow: 0 4px 20px rgba(25, 200, 185, 0.15);
  transform: translateY(-2px);
}

.search-bar:focus-within {
  box-shadow: 0 0 0 3px rgba(25, 200, 185, 0.12), 0 6px 24px rgba(25, 200, 185, 0.18);
  transform: translateY(-2px);
}

.engine-selector {
  position: relative;
  flex-shrink: 0;
}

.engine-selector .engine-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 44px;
  /* 搜索引擎按钮左侧圆角 */
  border-radius: calc(var(--radius) - 1px) 0 0 calc(var(--radius) - 1px);
  color: var(--text-secondary);
  transition: all var(--transition);
}

.engine-selector .engine-btn:hover {
  background: var(--bg-hover);
}

.engine-favicon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  border-radius: 3px;
}

.engine-letter {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--primary, #19c8b9);
  background: var(--primary-light, rgba(25, 200, 185, 0.12));
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1;
}

.engine-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: var(--bg-card);
  border: none;
  /* 搜索引擎下拉菜单圆角 */
  border-radius: calc(var(--radius) - 2px);
  box-shadow: 0 8px 32px rgba(61, 52, 40, 0.12);
  min-width: 180px;
  padding: 4px;
  z-index: 300;
}

.engine-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 14px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all var(--transition);
}

.engine-option:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.engine-option.active {
  background: var(--primary);
  color: white;
}

.engine-option-letter {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary, #19c8b9);
  background: var(--primary-light, rgba(25, 200, 185, 0.12));
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1;
}

.engine-option .engine-favicon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  border-radius: 3px;
}

.search-bar input {
  flex: 1;
  border: none;
  background: none;
  padding: 12px 16px;
  font-size: 15px;
  color: var(--text);
  outline: none;
  min-width: 0;
}

.search-bar input::placeholder {
  color: var(--text-muted);
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-right: 8px;
  border-radius: 8px;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all var(--transition);
}

.clear-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.suggestions-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--bg-card);
  border: none;
  /* 搜索建议下拉圆角 */
  border-radius: calc(var(--radius) - 2px);
  box-shadow: 0 8px 32px rgba(61, 52, 40, 0.12);
  max-height: 360px;
  overflow-y: auto;
  z-index: 300;
  padding: 4px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.suggestion-item:hover {
  background: var(--bg-hover);
}

.suggestion-item.active {
  background: var(--bg-hover);
}

.suggestion-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border-radius: 10px;
  flex-shrink: 0;
  overflow: hidden;
}

.suggestion-icon img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.suggestion-letter {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
}

.suggestion-info {
  flex: 1;
  min-width: 0;
}

.suggestion-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.suggestion-desc {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.suggestion-url {
  font-size: 11px;
  color: var(--text-muted);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .search-area {
    max-width: 100%;
  }

  .search-bar {
    /* 平板端搜索栏圆角略小 */
    border-radius: calc(var(--radius) - 2px);
  }

  .engine-selector .engine-btn {
    width: 36px;
    height: 40px;
    /* 平板端搜索引擎按钮圆角 */
    border-radius: calc(var(--radius) - 3px) 0 0 calc(var(--radius) - 3px);
  }

  .search-bar input {
    padding: 10px 12px;
    font-size: 14px;
  }

  .suggestions-dropdown {
    /* 平板端搜索建议下拉圆角 */
    border-radius: calc(var(--radius) - 2px);
  }
}

@media (max-width: 480px) {
  .search-bar {
    /* 手机端搜索栏圆角更小 */
    border-radius: calc(var(--radius) - 4px);
  }

  .engine-selector .engine-btn {
    width: 32px;
    height: 36px;
    /* 手机端搜索引擎按钮圆角 */
    border-radius: calc(var(--radius) - 5px) 0 0 calc(var(--radius) - 5px);
  }

  .search-bar input {
    padding: 8px 10px;
    font-size: 13px;
  }

  .clear-btn {
    width: 26px;
    height: 26px;
  }

  .suggestion-url {
    display: none;
  }
}
</style>
