<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useNavStore, type LinkFilter } from '@/stores/nav'
import { useAuth } from '@/composables/useAuth'
import AppHeader from '@/components/layout/AppHeader.vue'
import PinnedSection from '@/components/navigation/PinnedSection.vue'
import CategorySection from '@/components/navigation/CategorySection.vue'
import SearchBar from '@/components/navigation/SearchBar.vue'
import NetworkSwitcher from '@/components/navigation/NetworkSwitcher.vue'
import SettingsPanel from '@/components/settings/SettingsPanel.vue'
import LinkEditor from '@/components/navigation/LinkEditor.vue'
import StatsPanel from '@/components/navigation/StatsPanel.vue'
import SearchOverlay from '@/components/navigation/SearchOverlay.vue'
import ToastContainer from '@/components/common/ToastContainer.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'

const settingsStore = useSettingsStore()
const navStore = useNavStore()
const auth = useAuth()
const toast = useToast()

const showSettings = ref(false)
const showLinkEditor = ref(false)
const editingLinkId = ref<string | null>(null)
const defaultCategoryId = ref<string | undefined>(undefined)
const showStats = ref(false)
const showSearchOverlay = ref(false)
const scrollY = ref(0)
const showBackTop = computed(() => scrollY.value > 400)

const fabOpen = ref(false)
const showAddCategoryModal = ref(false)
const newCatName = ref('')
const showUserMenu = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)
const allExpanded = computed(() => navStore.categories.length > 0 && navStore.categories.every(c => !c.collapsed))
const isEmpty = computed(() => navStore.categories.length === 0 && navStore.links.length === 0)

const filterPanelOpen = ref(false)
const filterPanelRef = ref<HTMLElement | null>(null)
const toolsExpanded = ref(false)
const isMouseInBottomCorner = ref(false)
let hideToolsTimeout: number | null = null

function handleMouseMove(e: MouseEvent) {
  // 触屏设备不走鼠标悬停逻辑，避免合成的 mouse 事件干扰点击
  if (!window.matchMedia('(hover: hover)').matches) return

  const toolsPanelEl = document.querySelector('.tools-panel')
  const toolsToggleEl = document.querySelector('.tools-toggle-btn')
  const onToolsPanel = (toolsPanelEl && toolsPanelEl.contains(e.target as Node)) || (toolsToggleEl && toolsToggleEl.contains(e.target as Node))
  const hasSubmenuOpen = fabOpen.value || showUserMenu.value || filterPanelOpen.value

  if (onToolsPanel || hasSubmenuOpen) {
    isMouseInBottomCorner.value = true
    toolsExpanded.value = true
    if (hideToolsTimeout) {
      clearTimeout(hideToolsTimeout)
      hideToolsTimeout = null
    }
  } else if (isMouseInBottomCorner.value) {
    isMouseInBottomCorner.value = false
    hideToolsTimeout = window.setTimeout(() => {
      if (!isMouseInBottomCorner.value && !fabOpen.value && !showUserMenu.value && !filterPanelOpen.value) {
        toolsExpanded.value = false
      }
    }, 300)
  }
}

const filterOptions: { label: string; value: LinkFilter }[] = [
  { label: '全部显示', value: 'all' },
  { label: '仅有内网地址', value: 'intranet' },
  { label: '仅有外网地址', value: 'extranet' },
  { label: '仅有隧道地址', value: 'tunnel' },
  { label: '内网 + 外网', value: 'intranet_extranet' },
  { label: '隧道 + 内网', value: 'tunnel_intranet' },
  { label: '隧道 + 外网', value: 'tunnel_extranet' },
]

const toolbarItems = computed(() => settingsStore.getToolbar())
const visibleToolbarItems = computed(() => toolbarItems.value.filter(b => b.visible))

function toggleTheme() {
  const modes = ['light', 'dark', 'auto'] as const
  // 防御性检查：确保 theme 和 mode 存在
  const current = settingsStore.settings?.theme?.mode ?? 'auto'
  const idx = modes.indexOf(current)
  const next = modes[(idx + 1) % modes.length]
  settingsStore.setThemeMode(next)
  settingsStore.save()
}

function handleKeydown(e: KeyboardEvent) {
  const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
  
  if (e.key === 'Escape') {
    showSettings.value = false
    showLinkEditor.value = false
    showStats.value = false
    showAddCategoryModal.value = false
    fabOpen.value = false
    filterPanelOpen.value = false
    toolsExpanded.value = false
    showSearchOverlay.value = false
  }
  
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    showSearchOverlay.value = true
  }
  
  if (e.key === '/' && !isInputFocused && !showSettings.value && !showLinkEditor.value && !showStats.value) {
    e.preventDefault()
    showSearchOverlay.value = true
  }
}

function handleScroll() {
  scrollY.value = window.scrollY
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openEditor(linkId?: string | null, categoryId?: string) {
  editingLinkId.value = linkId || null
  defaultCategoryId.value = categoryId
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
  const exists = navStore.categories.some(
    c => c.name === name
  )
  if (exists) {
    toast.warning('分类名称已存在')
    return
  }
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

const showBatchMoveModal = ref(false)
const batchMoveCategoryId = ref('')
const showBatchDeleteConfirm = ref(false)

function handleBatchDelete() {
  const count = navStore.selectedLinkIds.size
  if (count === 0) return
  showBatchDeleteConfirm.value = true
}

function confirmBatchDelete() {
  const deleted = navStore.batchDeleteLinks()
  toast.success(`已删除 ${deleted} 个链接（刷新前可撤回）`)
  showBatchDeleteConfirm.value = false
}

function cancelBatchDelete() {
  showBatchDeleteConfirm.value = false
}

function handleBatchPin() {
  const pinned = navStore.batchPinLinks()
  if (pinned > 0) {
    toast.success(`已置顶 ${pinned} 个链接`)
  } else {
    toast.warning('选中的链接已全部置顶')
  }
}

function handleBatchUnpin() {
  const unpinned = navStore.batchUnpinLinks()
  if (unpinned > 0) {
    toast.success(`已取消置顶 ${unpinned} 个链接`)
  } else {
    toast.warning('选中的链接均未置顶')
  }
}

function handleUndoDelete() {
  const count = navStore.restoreDeletedLinks()
  if (count > 0) {
    toast.success(`已撤回 ${count} 个链接`)
  } else {
    toast.warning('没有可撤回的链接')
  }
}

function openBatchMove() {
  if (navStore.selectedLinkIds.size === 0) return
  batchMoveCategoryId.value = ''
  showBatchMoveModal.value = true
}

function confirmBatchMove() {
  if (!batchMoveCategoryId.value) return
  const moved = navStore.batchMoveLinks(batchMoveCategoryId.value)
  toast.success(`已移动 ${moved} 个链接`)
  showBatchMoveModal.value = false
}

function toggleExpandCollapse() {
  if (allExpanded.value) {
    navStore.collapseAllCategories()
  } else {
    navStore.expandAllCategories()
  }
}

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

function handleUserMenuOutside(e: MouseEvent) {
  const userEl = Array.isArray(userMenuRef.value) ? userMenuRef.value[0] : userMenuRef.value
  if (userEl && !userEl.contains(e.target as Node)) {
    showUserMenu.value = false
  }
}

onMounted(async () => {
  settingsStore.init()

  // 立即显示页面（从 localStorage 加载本地数据），不阻塞渲染
  auth.authReady.value = true

  // 后台同步：验证登录状态 + 拉取服务器数据
  if (auth.token.value) {
    syncInBackground()
  }

  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('click', handleOutsideClick)
  document.addEventListener('click', handleUserMenuOutside)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('nav-remote-update', handleRemoteUpdate)
  document.addEventListener('touchend', handleTouchEndCleanup, { passive: true })
  document.addEventListener('touchcancel', handleTouchEndCleanup, { passive: true })

  navStore.batchFetchFavicons()
})

/** 后台同步：先拉取服务端更新 + 再推送本地修改 */
async function syncInBackground() {
  const serverVersion = await auth.checkServerVersion()
  const cachedVersion = parseInt(localStorage.getItem('nav_cached_server_version') || '0')
  if (serverVersion !== null && serverVersion > cachedVersion) {
    const ok = await auth.pull()
    if (ok) {
      settingsStore.reloadFromStorage()
      navStore.reloadFromStorage()
    }
  }
  // 拉取后再推送本地修改（push 内部有 hash 去重，无变化会跳过）
  await auth.flushPush()
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('click', handleOutsideClick)
  document.removeEventListener('click', handleUserMenuOutside)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('nav-remote-update', handleRemoteUpdate)
  document.removeEventListener('touchend', handleTouchEndCleanup)
  document.removeEventListener('touchcancel', handleTouchEndCleanup)
})

function handleTouchEndCleanup() {
  document.body.classList.remove('is-dragging')
  // 清除所有可能残留的卡片拖拽状态
  const draggingCards = document.querySelectorAll('.card-dragging')
  draggingCards.forEach(card => card.classList.remove('card-dragging'))
  const categoryDragging = document.querySelectorAll('.cat-dragging')
  categoryDragging.forEach(cat => cat.classList.remove('cat-dragging'))
}

function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    // 页面隐藏时：推送本地数据到服务器
    auth.flushPush()
    auth.beaconPush()
  } else if (document.visibilityState === 'visible' && auth.token.value) {
    // 页面重新可见时：先拉取服务器更新，再推送本地修改
    auth.checkServerVersion().then(serverVersion => {
      if (serverVersion === null) return
      const cachedVersion = parseInt(localStorage.getItem('nav_cached_server_version') || '0')
      if (serverVersion > cachedVersion) {
        auth.pull().then(ok => {
          if (ok) {
            settingsStore.reloadFromStorage()
            navStore.reloadFromStorage()
          }
          auth.flushPush()
        })
      } else {
        auth.flushPush()
      }
    })
  }
}

function handleBeforeUnload() {
  auth.beaconPush()
}

function handleRemoteUpdate() {
  settingsStore.reloadFromStorage()
  navStore.reloadFromStorage()
}

async function handleLoginSuccess() {
  // 登录成功后无条件拉取一次服务器数据，确保多端同步
  const ok = await auth.pull()
  if (ok) {
    settingsStore.reloadFromStorage()
    navStore.reloadFromStorage()
  }
  navStore.batchFetchFavicons()
}

function handleOutsideClick(e: MouseEvent) {
  const fab = document.querySelector('.fab-container')
  if (fab && !fab.contains(e.target as Node)) {
    fabOpen.value = false
  }
  const filterEl = Array.isArray(filterPanelRef.value) ? filterPanelRef.value[0] : filterPanelRef.value
  if (filterEl && !filterEl.contains(e.target as Node)) {
    filterPanelOpen.value = false
  }
}

function toggleFilterPanel() {
  filterPanelOpen.value = !filterPanelOpen.value
}

function setFilter(filter: LinkFilter) {
  navStore.setLinkFilter(filter)
}

function toggleTools() {
  toolsExpanded.value = !toolsExpanded.value
  if (!toolsExpanded.value) {
    filterPanelOpen.value = false
  }
}
</script>

<template>
  <div v-if="!auth.authReady.value" class="auth-loading-screen"></div>
  <div v-else class="app-container">
    <ToastContainer />
    <AppHeader
      @open-settings="showSettings = true"
      @open-editor="openEditor()"
      @open-stats="showStats = true"
      @login-success="handleLoginSuccess"
    />

    <Transition name="slide-down">
      <div v-if="auth.isLoggedIn.value && navStore.selectionMode" class="batch-bar">
        <div class="batch-info">
          <span class="batch-count">已选择 {{ navStore.selectedLinkIds.size }} 个</span>
          <button class="batch-link" @click="navStore.selectAllLinks()">全选</button>
          <button class="batch-link range-select-btn" :class="{ active: navStore.rangeSelectMode }" @click="navStore.toggleRangeSelectMode()">
            {{ navStore.rangeSelectMode ? (navStore.rangeStartId ? '选择结束' : '取消范围') : '范围选择' }}
          </button>
        </div>
        <div class="batch-actions">
          <button class="batch-btn pin" :disabled="navStore.selectedLinkIds.size === 0" @click="handleBatchPin">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.76z"/></svg>
            置顶
          </button>
          <button class="batch-btn pin" :disabled="navStore.selectedLinkIds.size === 0" @click="handleBatchUnpin">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4.76z"/></svg>
            取消置顶
          </button>
          <button class="batch-btn move" :disabled="navStore.selectedLinkIds.size === 0" @click="openBatchMove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            移动
          </button>
          <button class="batch-btn delete" :disabled="navStore.selectedLinkIds.size === 0" @click="handleBatchDelete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            删除
          </button>
          <button class="batch-btn cancel" @click="navStore.exitSelectionMode()">取消</button>
        </div>
      </div>
    </Transition>

    <main v-if="auth.isLoggedIn.value" class="main-content">
      <div class="content-wrapper">
        <div class="search-wrapper">
          <SearchBar />
        </div>
        <EmptyState v-if="isEmpty" @add-category="openAddCategory" @open-settings="showSettings = true" />
        <template v-else>
          <PinnedSection @open-editor="openEditor" @batch-pin="handleBatchPin" @batch-unpin="handleBatchUnpin" @batch-delete="handleBatchDelete" />
          <CategorySection @open-editor="openEditor" @batch-pin="handleBatchPin" @batch-unpin="handleBatchUnpin" @batch-delete="handleBatchDelete" />
        </template>
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
        :default-category-id="defaultCategoryId"
        @close="showLinkEditor = false; defaultCategoryId = undefined"
      />
    </Transition>

    <Transition name="slide-up">
      <StatsPanel
        v-if="showStats"
        @close="showStats = false"
      />
    </Transition>

    <!-- 搜索浮层：使用 modal-pop 过渡动画 -->
    <Transition name="modal-pop">
      <SearchOverlay
        v-if="showSearchOverlay"
        @close="showSearchOverlay = false"
        @open-settings="showSettings = true"
        @open-stats="showStats = true"
      />
    </Transition>

    <div v-if="auth.isLoggedIn.value" class="floating-controls">
      <NetworkSwitcher />

      <Transition name="tool-expand">
        <div v-if="toolsExpanded" class="tools-panel">
          <template v-for="item in visibleToolbarItems" :key="item.id">

            <button v-if="item.id === 'theme'" class="float-btn" :title="`主题: ${settingsStore.settings?.theme?.mode ?? 'auto'}`" @click="toggleTheme">
              <svg v-if="settingsStore.settings?.theme?.mode === 'light'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              <svg v-else-if="settingsStore.settings?.theme?.mode === 'dark'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="m16.95 16.95 2.12 2.12"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="m4.93 19.07 2.12-2.12"/><path d="m16.95 7.05 2.12-2.12"/></svg>
            </button>

            <div v-else-if="item.id === 'add'" class="fab-container" :class="{ 'fab-open': fabOpen }">
              <TransitionGroup name="fab-item">
                <button v-if="fabOpen" key="add-cat" class="fab-option" title="添加分类" @click="openAddCategory">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>
                  <span class="fab-label">添加分类</span>
                </button>
                <button v-if="fabOpen" key="add-link" class="fab-option" title="添加链接" @click="openEditor()">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  <span class="fab-label">添加链接</span>
                </button>
              </TransitionGroup>
              <button class="fab-main" title="添加链接/分类" @click="toggleFab">
                <svg :class="['fab-icon', { rotated: fabOpen }]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              </button>
            </div>

            <div v-else-if="item.id === 'expand'" class="expand-collapse-group">
              <button class="float-btn" :title="allExpanded ? '一键收回所有分类' : '一键展开所有分类'" @click="toggleExpandCollapse">
                <svg v-if="allExpanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 13-6-6-6 6"/><path d="m18 21-6-6-6 6"/></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 3 6 6 6-6"/><path d="m6 11 6 6 6-6"/></svg>
              </button>
            </div>

            <div v-else-if="item.id === 'user' && auth.isLoggedIn.value" ref="userMenuRef" class="user-menu-fab">
              <button class="float-btn user-fab-btn" title="菜单" @click="toggleUserMenu">
                <svg class="user-fab-avatar" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </button>
              <div v-if="showUserMenu" class="user-dropdown" @click="showUserMenu = false">
                <div class="user-dropdown-header">
                  <svg class="user-dropdown-avatar" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span class="user-dropdown-name">菜单</span>
                </div>
                <div class="menu-divider"></div>
                <button class="menu-item" @click="showSettings = true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  设置
                </button>
                <button class="menu-item" @click="showStats = true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                  访问统计
                </button>
                <div class="menu-divider"></div>
                <button class="menu-item menu-item-danger" @click="auth.logout()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                  退出登录
                </button>
              </div>
            </div>

            <div v-else-if="item.id === 'filter'" ref="filterPanelRef" class="filter-container">
              <button
                class="float-btn filter-btn"
                :class="{ active: navStore.linkFilter !== 'all' || navStore.tagFilter.length > 0 }"
                title="链接筛选"
                @click="toggleFilterPanel"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              </button>
              <Transition name="filter-pop">
                <div v-if="filterPanelOpen" class="filter-panel">
                  <div class="filter-title">筛选链接</div>
                  <button
                    v-for="opt in filterOptions"
                    :key="opt.value"
                    class="filter-option"
                    :class="{ selected: navStore.linkFilter === opt.value }"
                    @click="setFilter(opt.value)"
                  >
                    <span class="filter-check" v-if="navStore.linkFilter === opt.value">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </span>
                    <span class="filter-radio" v-else></span>
                    {{ opt.label }}
                  </button>
                  <template v-if="navStore.allTags.length > 0">
                    <div class="filter-divider"></div>
                    <div class="filter-title">标签筛选</div>
                    <div class="tag-filter-list">
                      <button
                        v-for="tag in navStore.allTags"
                        :key="tag"
                        class="tag-chip"
                        :class="{ active: navStore.tagFilter.includes(tag) }"
                        @click="navStore.toggleTagFilter(tag)"
                      >
                        {{ tag }}
                      </button>
                    </div>
                    <button
                      v-if="navStore.tagFilter.length > 0"
                      class="filter-clear-tags"
                      @click="navStore.setTagFilter([])"
                    >
                      清除标签筛选
                    </button>
                  </template>
                </div>
              </Transition>
            </div>

            <Transition v-else-if="item.id === 'backTop'" name="fade">
              <button v-if="showBackTop" class="float-btn" title="回到顶部" @click="scrollToTop">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              </button>
            </Transition>

          </template>
        </div>
      </Transition>

      <button class="float-btn tools-toggle-btn" :class="{ expanded: toolsExpanded }" title="工具栏" @click="toggleTools">
        <svg :class="['tools-icon', { rotated: !toolsExpanded }]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
      </button>
    </div>

    <Transition name="fade">
      <div v-if="fabOpen" class="fab-backdrop" @click="closeFab"></div>
    </Transition>

    <ConfirmDialog
      :visible="showAddCategoryModal"
      title="添加分类"
      @update:visible="showAddCategoryModal = $event"
      @confirm="confirmAddCategory"
      @cancel="showAddCategoryModal = false"
    >
      <input
        v-model="newCatName"
        type="text"
        class="add-cat-input"
        placeholder="输入分类名称"
        @keyup.enter="confirmAddCategory"
        autofocus
      />
    </ConfirmDialog>

    <ConfirmDialog
      :visible="showBatchMoveModal"
      title="移动到分类"
      @update:visible="showBatchMoveModal = $event"
      @confirm="confirmBatchMove"
      @cancel="showBatchMoveModal = false"
    >
      <select v-model="batchMoveCategoryId" class="batch-move-select">
        <option value="" disabled>选择目标分类</option>
        <option v-for="cat in navStore.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
      </select>
    </ConfirmDialog>

    <ConfirmDialog
      :visible="showBatchDeleteConfirm"
      title="确认删除"
      confirm-text="确认删除"
      @update:visible="showBatchDeleteConfirm = $event"
      @confirm="confirmBatchDelete"
      @cancel="cancelBatchDelete"
    >
      <p style="margin: 0 0 12px; color: var(--text-secondary); font-size: 14px;">
        确定要删除选中的 <strong style="color: var(--text);">{{ navStore.selectedLinkIds.size }}</strong> 个链接吗？
      </p>
      <p style="margin: 0; color: #ef4444; font-size: 13px; background: rgba(239, 68, 68, 0.1); padding: 8px 12px; border-radius: 6px;">
        ⚠️ 删除后可撤回，但刷新页面后撤回功能将失效
      </p>
    </ConfirmDialog>
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
  /* 优化内容最大宽度，提升阅读体验 */
  max-width: 1200px;
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

.expand-collapse-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expand-collapse-group .float-btn {
  width: 32px;
  height: 32px;
}

.user-menu-fab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.user-fab-btn {
  font-size: 16px;
}

.user-fab-avatar {
  line-height: 1;
  color: var(--text);
}

.user-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: var(--bg-card);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  min-width: 180px;
  padding: 4px;
  z-index: 200;
  animation: userDropIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.user-dropdown-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
}

.user-dropdown-avatar {
  color: var(--text);
  flex-shrink: 0;
}

.user-dropdown-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

@keyframes userDropIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.user-dropdown .menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all var(--transition);
  cursor: pointer;
}

.user-dropdown .menu-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.user-dropdown .menu-item-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.user-dropdown .menu-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 8px;
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
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-card);
  border: none;
  color: var(--text-secondary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 92;
}

.fab-main:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  transform: translateY(-2px);
}

.fab-open .fab-main {
  background: var(--primary);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
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

.fab-option svg {
  width: 12px;
  height: 12px;
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

.slide-down-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.slide-down-leave-active {
  transition: all 0.18s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-100%);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.batch-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 24px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.batch-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
}

.batch-link {
  font-size: 13px;
  color: var(--text-muted);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.15s ease;
}

.batch-link:hover {
  color: var(--primary);
}

.range-select-btn {
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  text-decoration: none;
}

.range-select-btn:hover {
  background: rgba(99, 102, 241, 0.2);
}

.range-select-btn.active {
  background: var(--primary);
  color: white;
}

.range-select-btn.active:hover {
  background: var(--primary-dark);
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease;
}

.batch-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.batch-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.batch-btn.delete:hover:not(:disabled) {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.batch-btn.cancel {
  color: var(--text-muted);
}

.batch-move-select {
  width: 100%;
  padding: 10px 14px;
  margin-top: 4px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s ease;
}

.batch-move-select:focus {
  border-color: var(--primary);
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

.tools-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.tools-toggle-btn {
  z-index: 95;
  background: var(--primary);
  color: white;
}

.tools-toggle-btn:hover {
  background: var(--primary);
  opacity: 0.85;
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
}

.tools-toggle-btn.expanded {
  background: var(--bg-card);
  color: var(--text-secondary);
}

.tools-icon {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tools-icon.rotated {
  transform: rotate(90deg);
}

.tool-expand-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tool-expand-leave-active {
  transition: all 0.2s ease;
}

.tool-expand-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.9);
}

.tool-expand-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}

.filter-container {
  position: relative;
}

.filter-btn {
  position: relative;
}

.filter-btn.active {
  background: var(--primary);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.filter-panel {
  position: absolute;
  bottom: 0;
  right: calc(100% + 10px);
  background: var(--bg-card);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  min-width: 190px;
  padding: 8px 4px;
  z-index: 200;
}

.filter-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 6px 14px 8px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.filter-option:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.filter-option.selected {
  color: var(--primary);
  font-weight: 600;
}

.filter-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--primary);
}

.filter-radio {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid var(--border);
  margin: 5px;
  flex-shrink: 0;
}

.filter-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 10px;
}

.tag-filter-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 14px 8px;
}

.tag-chip {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.tag-chip:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.tag-chip.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.filter-clear-tags {
  width: 100%;
  padding: 6px 14px;
  border: none;
  background: none;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  text-align: center;
  transition: color 0.15s ease;
}

.filter-clear-tags:hover {
  color: #ef4444;
}

.filter-pop-enter-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.filter-pop-leave-active {
  transition: all 0.15s ease;
}

.filter-pop-enter-from {
  opacity: 0;
  transform: translateX(8px) scale(0.95);
}

.filter-pop-leave-to {
  opacity: 0;
  transform: translateX(4px) scale(0.98);
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

  /* 手机端批量选择栏适配 */
  .batch-bar {
    padding: 8px 12px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .batch-info {
    gap: 8px;
    flex-wrap: wrap;
  }

  .batch-count {
    font-size: 13px;
  }

  .batch-link {
    font-size: 12px;
    padding: 3px 8px;
  }

  .range-select-btn {
    padding: 4px 10px;
    font-size: 12px;
  }

  .batch-actions {
    gap: 6px;
    flex-wrap: wrap;
  }

  .batch-btn {
    padding: 6px 10px;
    font-size: 12px;
  }

  .batch-btn svg {
    width: 12px;
    height: 12px;
  }
}

.auth-loading-screen {
  position: fixed;
  inset: 0;
  background: var(--bg, #f8f9fa);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
}

@media (hover: none) {
  .tools-toggle-btn:hover,
  .fab-main:hover,
  .float-btn:hover {
    transform: none;
    box-shadow: none;
    opacity: 1;
  }
}
</style>
