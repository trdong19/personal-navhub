<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useNavStore } from '@/stores/nav'
import { getEngineFavicon } from '@/utils/helpers'
import { animateDropdown } from '@/composables/useAnimation'

const settingsStore = useSettingsStore()
const navStore = useNavStore()

const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const showSuggestions = ref(false)
const showEnginePicker = ref(false)
const enginePickerRef = ref<HTMLElement | null>(null)
const engineDropdownRef = ref<HTMLElement | null>(null)
const suggestionsDropdownRef = ref<HTMLElement | null>(null)

const suggestions = computed(() => {
  if (!query.value.trim()) return []
  const q = query.value.toLowerCase()
  return navStore.links
    .filter(link =>
      link.title.toLowerCase().includes(q) ||
      link.description?.toLowerCase().includes(q) ||
      link.tags.some(tag => tag.toLowerCase().includes(q))
    )
    .slice(0, 8)
})

const currentEngine = computed(() => settingsStore.currentEngine)

function handleFaviconError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
  const fallback = img.nextElementSibling as HTMLElement
  if (fallback) fallback.style.display = ''
}

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
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (suggestions.value.length > 0) {
      handleSelect(suggestions.value[0])
    } else {
      handleSearch()
    }
  } else if (e.key === 'Escape') {
    query.value = ''
    showSuggestions.value = false
    inputRef.value?.blur()
  }
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
        <button class="engine-btn" :title="'切换搜索引擎 (当前: ' + currentEngine.name + ')'" @click="showEnginePicker = !showEnginePicker">
          <img :key="currentEngine.id" :src="getEngineFavicon(currentEngine.urlTemplate)" class="engine-favicon" @error="handleFaviconError" />
          <span class="engine-icon" style="display:none">{{ currentEngine.icon }}</span>
        </button>
        <div v-if="showEnginePicker" ref="engineDropdownRef" class="engine-dropdown">
          <button
            v-for="engine in settingsStore.settings.search.engines"
            :key="engine.id"
            :class="['engine-option', { active: engine.id === currentEngine.id }]"
            @click="selectEngine(engine.id)"
          >
            <img :src="getEngineFavicon(engine.urlTemplate)" class="engine-favicon" @error="handleFaviconError" />
            <span class="engine-option-icon" style="display:none">{{ engine.icon }}</span>
            <span>{{ engine.name }}</span>
          </button>
        </div>
      </div>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="搜索书签或输入关键词..."
        @keydown="handleKeydown"
        @focus="handleFocus"
        @input="showSuggestions = query.trim().length > 0"
      />
      <button v-if="query" class="clear-btn" @click="query = ''; showSuggestions = false; inputRef?.focus()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div v-if="showSuggestions && suggestions.length > 0" ref="suggestionsDropdownRef" class="suggestions-dropdown">
      <div
        v-for="link in suggestions"
        :key="link.id"
        class="suggestion-item"
        @click="handleSelect(link)"
      >
        <div class="suggestion-icon">🔗</div>
        <div class="suggestion-info">
          <div class="suggestion-name">{{ link.title }}</div>
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
  border-radius: 16px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.search-bar:hover {
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
  transform: translateY(-2px);
}

.search-bar:focus-within {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12), 0 6px 24px rgba(99, 102, 241, 0.18);
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
  border-radius: 15px 0 0 15px;
  color: var(--text-secondary);
  transition: all var(--transition);
}

.engine-selector .engine-btn:hover {
  background: var(--bg-hover);
}

.engine-icon {
  font-size: 18px;
}

.engine-favicon {
  width: 18px;
  height: 18px;
  object-fit: contain;
  border-radius: 3px;
}

.engine-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  background: var(--bg-card);
  border: none;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
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

.engine-option-icon {
  font-size: 15px;
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
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
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

.suggestion-icon {
  font-size: 16px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border-radius: 10px;
  flex-shrink: 0;
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
    border-radius: 12px;
  }

  .engine-selector .engine-btn {
    width: 36px;
    height: 40px;
    border-radius: 11px 0 0 11px;
  }

  .search-bar input {
    padding: 10px 12px;
    font-size: 14px;
  }

  .suggestions-dropdown {
    border-radius: 12px;
  }
}

@media (max-width: 480px) {
  .search-bar {
    border-radius: 10px;
  }

  .engine-selector .engine-btn {
    width: 32px;
    height: 36px;
    border-radius: 9px 0 0 9px;
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
