<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useNavStore } from '@/stores/nav'
import { useAuth } from '@/composables/useAuth'
import AppHeader from '@/components/layout/AppHeader.vue'
import PinnedSection from '@/components/navigation/PinnedSection.vue'
import CategorySection from '@/components/navigation/CategorySection.vue'
import SearchBar from '@/components/navigation/SearchBar.vue'
import NetworkSwitcher from '@/components/navigation/NetworkSwitcher.vue'
import SettingsPanel from '@/components/settings/SettingsPanel.vue'
import LinkEditor from '@/components/navigation/LinkEditor.vue'
import StatsPanel from '@/components/navigation/StatsPanel.vue'

const settingsStore = useSettingsStore()
const navStore = useNavStore()
const auth = useAuth()

const showSettings = ref(false)
const showLinkEditor = ref(false)
const editingLinkId = ref<string | null>(null)
const showStats = ref(false)
const scrollY = ref(0)
const showBackTop = computed(() => scrollY.value > 400)

const fabOpen = ref(false)
const showAddCategoryModal = ref(false)
const newCatName = ref('')

function toggleTheme() {
  const modes = ['light', 'dark', 'auto'] as const
  const current = settingsStore.settings.theme.mode
  const idx = modes.indexOf(current)
  const next = modes[(idx + 1) % modes.length]
  settingsStore.setThemeMode(next)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    showSettings.value = false
    showLinkEditor.value = false
    showStats.value = false
    showAddCategoryModal.value = false
    fabOpen.value = false
  }
}

function handleScroll() {
  scrollY.value = window.scrollY
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openEditor(linkId?: string) {
  editingLinkId.value = linkId || null
  showLinkEditor.value = true
  fabOpen.value = false
}

function openAddCategory() {
  newCatName.value = ''
  showAddCategoryModal.value = true
  fabOpen.value = false
}

function confirmAddCategory() {
  const name = newCatName.value.trim()
  if (!name) return
  navStore.addCategory(name, '📁', '#6366f1')
  showAddCategoryModal.value = false
  newCatName.value = ''
}

function toggleFab() {
  fabOpen.value = !fabOpen.value
}

function closeFab() {
  fabOpen.value = false
}

onMounted(async () => {
  settingsStore.init()

  if (auth.token.value) {
    const valid = await auth.checkSession()
    if (valid) {
      const ok = await auth.pull()
      if (ok) {
        settingsStore.reloadFromStorage()
        navStore.reloadFromStorage()
      }
    }
  }

  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('scroll', handleScroll, { passive: true })
  document.addEventListener('click', handleOutsideClick)

  navStore.batchFetchFavicons()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', handleScroll)
  document.removeEventListener('click', handleOutsideClick)
})

function handleOutsideClick(e: MouseEvent) {
  const fab = document.querySelector('.fab-container')
  if (fab && !fab.contains(e.target as Node)) {
    fabOpen.value = false
  }
}
</script>

<template>
  <div class="app-container">
    <AppHeader
      @open-settings="showSettings = true"
      @open-editor="openEditor()"
      @open-stats="showStats = true"
    />

    <main class="main-content">
      <div class="content-wrapper">
        <div class="search-wrapper">
          <SearchBar />
        </div>
        <PinnedSection @open-editor="openEditor" />
        <CategorySection @open-editor="openEditor" />
      </div>
    </main>

    <Transition name="slide-up">
      <SettingsPanel
        v-if="showSettings"
        @close="showSettings = false"
      />
    </Transition>

    <Transition name="slide-up">
      <LinkEditor
        v-if="showLinkEditor"
        :link-id="editingLinkId"
        @close="showLinkEditor = false"
      />
    </Transition>

    <Transition name="slide-up">
      <StatsPanel
        v-if="showStats"
        @close="showStats = false"
      />
    </Transition>

    <div class="floating-controls">
      <button class="float-btn" :title="`主题: ${settingsStore.settings.theme.mode}`" @click="toggleTheme">
        <svg v-if="settingsStore.settings.theme.mode === 'light'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        <svg v-else-if="settingsStore.settings.theme.mode === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="m16.95 16.95 2.12 2.12"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="m4.93 19.07 2.12-2.12"/><path d="m16.95 7.05 2.12-2.12"/></svg>
      </button>
      <NetworkSwitcher />

      <div class="fab-container" :class="{ 'fab-open': fabOpen }">
        <TransitionGroup name="fab-item">
          <button v-if="fabOpen" key="add-cat" class="fab-option" title="添加分类" @click="openAddCategory">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>
            <span class="fab-label">添加分类</span>
          </button>
          <button v-if="fabOpen" key="add-link" class="fab-option" title="添加链接" @click="openEditor()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            <span class="fab-label">添加链接</span>
          </button>
        </TransitionGroup>
        <button class="fab-main" title="添加" @click="toggleFab">
          <svg :class="['fab-icon', { rotated: fabOpen }]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </button>
      </div>

      <Transition name="fade">
        <button v-if="showBackTop" class="float-btn" title="回到顶部" @click="scrollToTop">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
        </button>
      </Transition>
    </div>

    <Transition name="fade">
      <div v-if="fabOpen" class="fab-backdrop" @click="closeFab"></div>
    </Transition>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showAddCategoryModal" class="add-cat-overlay" @click.self="showAddCategoryModal = false">
          <Transition name="modal-pop" appear>
            <div v-if="showAddCategoryModal" class="add-cat-modal">
              <h3>添加分类</h3>
              <input
                v-model="newCatName"
                type="text"
                class="add-cat-input"
                placeholder="输入分类名称"
                @keyup.enter="confirmAddCategory"
                autofocus
              />
              <div class="add-cat-actions">
                <button class="add-cat-cancel" @click="showAddCategoryModal = false">取消</button>
                <button class="add-cat-confirm" @click="confirmAddCategory" :disabled="!newCatName.trim()">确定</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background: var(--bg);
}

.main-content {
  padding: 0 24px 40px;
}

.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  padding-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.search-wrapper {
  display: flex;
  justify-content: center;
}

.floating-controls {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 90;
}

.float-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-card);
  border: none;
  color: var(--text-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.float-btn:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  transform: translateY(-2px);
}

.fab-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.fab-main {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary);
  border: none;
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 92;
}

.fab-main:hover {
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45);
  transform: scale(1.05);
}

.fab-open .fab-main {
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
}

.fab-icon {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-icon.rotated {
  transform: rotate(45deg);
}

.fab-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 20px;
  background: var(--bg-card);
  border: none;
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fab-option:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  transform: translateX(-4px);
}

.fab-label {
  font-size: 12px;
}

.fab-item-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-item-leave-active {
  transition: all 0.15s ease;
}

.fab-item-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.9);
}

.fab-item-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.95);
}

.fab-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(0, 0, 0, 0.15);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-up-leave-active {
  transition: all 0.18s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(12px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: scale(0.98) translateY(8px);
}

.add-cat-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-cat-modal {
  background: var(--bg-card);
  border: none;
  border-radius: 20px;
  padding: 24px;
  width: 320px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.add-cat-modal h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.add-cat-input {
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
  outline: none;
  transition: box-shadow 0.2s ease;
  box-sizing: border-box;
}

.add-cat-input:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.add-cat-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.add-cat-cancel {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.add-cat-cancel:hover {
  background: var(--bg-hover);
}

.add-cat-confirm {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  background: var(--primary);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.add-cat-confirm:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 3px 10px rgba(99, 102, 241, 0.35);
}

.add-cat-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-pop-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-pop-leave-active {
  transition: all 0.15s ease;
}

.modal-pop-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(8px);
}

.modal-pop-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(4px);
}

@media (max-width: 768px) {
  .main-content {
    padding: 0 12px 32px;
  }

  .content-wrapper {
    padding-top: 16px;
    gap: 24px;
  }

  .floating-controls {
    bottom: 16px;
    right: 16px;
    gap: 4px;
  }

  .float-btn {
    width: 32px;
    height: 32px;
  }

  .fab-main {
    width: 36px;
    height: 36px;
  }

  .fab-option {
    padding: 7px 12px;
    font-size: 11px;
  }

  .fab-label {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 0 8px 24px;
  }

  .content-wrapper {
    padding-top: 12px;
    gap: 20px;
  }

  .floating-controls {
    bottom: 12px;
    right: 12px;
  }

  .float-btn {
    width: 30px;
    height: 30px;
  }

  .float-btn svg {
    width: 14px;
    height: 14px;
  }

  .fab-main {
    width: 34px;
    height: 34px;
  }

  .fab-main svg {
    width: 16px;
    height: 16px;
  }

  .fab-option {
    padding: 6px 10px;
    gap: 4px;
  }

  .fab-option svg {
    width: 14px;
    height: 14px;
  }
}
</style>
