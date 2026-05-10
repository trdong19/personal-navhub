<script setup lang="ts">
import { ref, computed } from 'vue'
import type { NavCategory, NavLink } from '@/types'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import NavCard from './NavCard.vue'
import { useFlipSort } from '@/composables/useFlipSort'
import { useToast } from '@/composables/useToast'

const emit = defineEmits<{
  'open-editor': [id: string]
}>()

const navStore = useNavStore()
const settingsStore = useSettingsStore()
const toast = useToast()
const isDoubleColumn = computed(() => settingsStore.settings.layout.categoryLayout === 'double')
const draggingId = ref<string | null>(null)
const categoryListRef = ref<HTMLElement | null>(null)
const { recordPositions, animateFlip } = useFlipSort(categoryListRef)
const dropTargetCategory = ref<string | null>(null)

const draggingCategoryId = ref<string | null>(null)
const categoryDropTarget = ref<string | null>(null)

const showAddCategory = ref(false)
const newCatName = ref('')
const newCatParentId = ref<string | undefined>(undefined)

const showDeleteConfirm = ref(false)
const deleteTarget = ref<NavCategory | null>(null)

const showLinkDeleteConfirm = ref(false)
const deleteLinkTarget = ref<NavLink | null>(null)

const topCategories = computed(() =>
  navStore.sortedCategories.filter(c => !c.parentId)
)

function getChildren(parentId: string): NavCategory[] {
  return navStore.sortedCategories.filter(c => c.parentId === parentId)
}

let lastDragOverTarget = ''
let dragOverThrottle = 0

function handleDragStart(id: string) {
  draggingId.value = id
  lastDragOverTarget = ''
}

function handleDragOver(targetId: string, categoryId: string) {
  if (!draggingId.value) return
  if (draggingId.value === targetId) return

  const now = Date.now()
  if (targetId === lastDragOverTarget && now - dragOverThrottle < 80) return
  lastDragOverTarget = targetId
  dragOverThrottle = now

  dropTargetCategory.value = categoryId
  const categoryLinks = navStore.getLinksByCategory(categoryId)
  const ids = categoryLinks.map(l => l.id)
  const fromIdx = ids.indexOf(draggingId.value)
  const toIdx = ids.indexOf(targetId)

  const before = recordPositions(draggingId.value)

  if (toIdx === -1) {
    navStore.updateLink(draggingId.value, { category: categoryId })
    animateFlip(before, draggingId.value)
    return
  }

  if (fromIdx !== -1) {
    ids.splice(fromIdx, 1)
    ids.splice(toIdx, 0, draggingId.value)
  } else {
    ids.splice(toIdx, 0, draggingId.value)
    navStore.updateLink(draggingId.value, { category: categoryId })
  }
  navStore.reorderLinks(ids)
  animateFlip(before, draggingId.value)
}

function handleCategoryDragOver(e: DragEvent, categoryId: string) {
  e.preventDefault()
  e.stopPropagation()
  e.dataTransfer!.dropEffect = 'move'
  dropTargetCategory.value = categoryId
}

function handleCategoryDrop(e: DragEvent, categoryId: string) {
  e.preventDefault()
  e.stopPropagation()
  if (!draggingId.value) return
  const link = navStore.links.find(l => l.id === draggingId.value)
  if (link && link.category !== categoryId) {
    navStore.updateLink(draggingId.value, { category: categoryId })
  }
  dropTargetCategory.value = null
  draggingId.value = null
}

function handleDragEnd() {
  draggingId.value = null
  dropTargetCategory.value = null
}

function handleCategoryHeaderDragStart(e: DragEvent, categoryId: string) {
  if (draggingId.value) return
  draggingCategoryId.value = categoryId
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', categoryId)
}

function handleCategoryHeaderDragOver(e: DragEvent, targetId: string) {
  if (!draggingCategoryId.value || draggingCategoryId.value === targetId) return
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  categoryDropTarget.value = targetId
}

function handleCategoryHeaderDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  if (!draggingCategoryId.value || draggingCategoryId.value === targetId) return
  const ids = topCategories.value.map(c => c.id)
  const fromIdx = ids.indexOf(draggingCategoryId.value)
  const toIdx = ids.indexOf(targetId)
  if (fromIdx === -1 || toIdx === -1) return
  ids.splice(fromIdx, 1)
  ids.splice(toIdx, 0, draggingCategoryId.value)
  navStore.reorderCategories(ids)
  draggingCategoryId.value = null
  categoryDropTarget.value = null
}

function handleCategoryHeaderDragEnd() {
  draggingCategoryId.value = null
  categoryDropTarget.value = null
}

function toggleCategory(categoryId: string) {
  navStore.toggleCategory(categoryId)
}

function openAddCategory(parentId?: string) {
  newCatName.value = ''
  newCatParentId.value = parentId
  showAddCategory.value = true
}

function confirmAddCategory() {
  const name = newCatName.value.trim()
  if (!name) return
  const exists = navStore.categories.some(
    c => c.name === name && c.parentId === (newCatParentId.value || undefined)
  )
  if (exists) {
    toast.warning('该分类下已存在同名分类')
    return
  }
  navStore.addCategory(name, '📁', '#6366f1', newCatParentId.value)
  showAddCategory.value = false
  newCatName.value = ''
}

function requestDeleteCategory(cat: NavCategory) {
  deleteTarget.value = cat
  showDeleteConfirm.value = true
}

function confirmDeleteCategory() {
  if (deleteTarget.value) {
    navStore.deleteCategory(deleteTarget.value.id)
  }
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

function cancelDeleteCategory() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

const deleteMsg = computed(() => {
  if (!deleteTarget.value) return ''
  const cat = deleteTarget.value
  const childCount = getChildren(cat.id).length
  const linkCount = navStore.getTotalLinksByCategory(cat.id)
  if (childCount > 0) return `确定删除分类「${cat.name}」及其 ${childCount} 个子分类和 ${linkCount} 个链接吗？`
  if (linkCount > 0) return `确定删除分类「${cat.name}」及其 ${linkCount} 个链接吗？`
  return `确定删除分类「${cat.name}」吗？`
})

const ctxMenu = ref<{ x: number; y: number; visible: boolean; linkId: string }>({ x: 0, y: 0, visible: false, linkId: '' })

function handleCardContextMenu(payload: { id: string; x: number; y: number }) {
  ctxMenu.value = { x: payload.x, y: payload.y, visible: true, linkId: payload.id }
}

function closeCtxMenu() {
  ctxMenu.value.visible = false
}

function ctxOpenExtranet() {
  const link = navStore.links.find(l => l.id === ctxMenu.value.linkId)
  if (link?.urls.extranet) window.open(link.urls.extranet, '_blank')
  closeCtxMenu()
}

function ctxOpenIntranet() {
  const link = navStore.links.find(l => l.id === ctxMenu.value.linkId)
  if (link?.urls.intranet) window.open(link.urls.intranet, '_blank')
  closeCtxMenu()
}

function ctxOpenTunnel() {
  const link = navStore.links.find(l => l.id === ctxMenu.value.linkId)
  if (link?.urls.tunnel) window.open(link.urls.tunnel, '_blank')
  closeCtxMenu()
}

function ctxTogglePin() {
  const link = navStore.links.find(l => l.id === ctxMenu.value.linkId)
  if (link) navStore.updateLink(link.id, { pinned: !link.pinned })
  closeCtxMenu()
}

function ctxEdit() {
  emit('open-editor', ctxMenu.value.linkId)
  closeCtxMenu()
}

function ctxBatchSelect() {
  navStore.enterSelectionMode()
  navStore.toggleLinkSelection(ctxMenu.value.linkId)
  closeCtxMenu()
}

function ctxDelete() {
  const link = navStore.links.find(l => l.id === ctxMenu.value.linkId)
  if (link) {
    deleteLinkTarget.value = link
    showLinkDeleteConfirm.value = true
  }
  closeCtxMenu()
}

function confirmDeleteLink() {
  if (deleteLinkTarget.value) {
    navStore.deleteLink(deleteLinkTarget.value.id)
  }
  showLinkDeleteConfirm.value = false
  deleteLinkTarget.value = null
}

function cancelDeleteLink() {
  showLinkDeleteConfirm.value = false
  deleteLinkTarget.value = null
}

const ctxLink = computed(() => navStore.links.find(l => l.id === ctxMenu.value.linkId) || null)
</script>

<template>
  <div ref="categoryListRef" class="category-list" :class="{ 'double-column': isDoubleColumn }">
    <section
      v-for="category in topCategories"
      :key="category.id"
      class="category-section"
      :class="{
        'drop-target': dropTargetCategory === category.id,
        'cat-drop-target': categoryDropTarget === category.id,
        'cat-dragging': draggingCategoryId === category.id
      }"
      :draggable="true"
      @dragstart="handleCategoryHeaderDragStart($event, category.id)"
      @dragover="draggingCategoryId ? handleCategoryHeaderDragOver($event, category.id) : handleCategoryDragOver($event, category.id)"
      @drop="draggingCategoryId ? handleCategoryHeaderDrop($event, category.id) : handleCategoryDrop($event, category.id)"
      @dragend="handleCategoryHeaderDragEnd"
      @dragleave="dropTargetCategory === category.id && (dropTargetCategory = null); categoryDropTarget === category.id && (categoryDropTarget = null)"
    >
      <div class="category-header">
        <div class="category-drag-handle" @click.stop>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
        </div>
        <div class="category-title-wrapper" @click="toggleCategory(category.id)" :draggable="false">
          <span class="category-icon" :style="{ background: category.color }">
            <svg :class="['chevron-icon', { rotated: !category.collapsed }]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </span>
          <h3 class="category-name">{{ category.name }}</h3>
          <span class="category-count">{{ navStore.getTotalLinksByCategory(category.id) }}</span>
        </div>
        <div class="category-actions">
          <button class="cat-action-btn" title="添加子分类" @click.stop="openAddCategory(category.id)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          </button>
          <button class="cat-action-btn cat-action-delete" title="删除分类" @click.stop="requestDeleteCategory(category)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <div :class="['category-collapse', { collapsed: category.collapsed }]">
        <div class="category-collapse-inner">
          <div class="nav-grid">
            <NavCard
              v-for="link in navStore.getLinksByCategory(category.id)"
              :key="link.id"
              :link="link"
              @edit="emit('open-editor', $event)"
              @contextmenu="handleCardContextMenu"
              @dragstart="handleDragStart"
              @dragover="handleDragOver($event, category.id)"
              @dragend="handleDragEnd"
            />
          </div>

          <template v-for="child in getChildren(category.id)" :key="child.id">
            <div
              class="sub-category"
              @dragover="handleCategoryDragOver($event, child.id)"
              @drop="handleCategoryDrop($event, child.id)"
              @dragleave="dropTargetCategory === child.id && (dropTargetCategory = null)"
              :class="{ 'drop-target': dropTargetCategory === child.id }"
            >
              <div class="sub-category-header">
                <div class="sub-category-title-wrapper" @click="toggleCategory(child.id)">
                  <svg :class="['chevron-icon-sm', { rotated: !child.collapsed }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  <span class="sub-cat-dot" :style="{ background: child.color }"></span>
                  <span class="sub-cat-name">{{ child.name }}</span>
                  <span class="sub-cat-count">{{ navStore.getTotalLinksByCategory(child.id) }}</span>
                </div>
                <div class="category-actions">
                  <button class="cat-action-btn" title="添加子分类" @click.stop="openAddCategory(child.id)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                  </button>
                  <button class="cat-action-btn cat-action-delete" title="删除分类" @click.stop="requestDeleteCategory(child)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>

              <div :class="['category-collapse', { collapsed: child.collapsed }]">
                <div class="category-collapse-inner">
                  <div class="nav-grid">
                    <NavCard
                      v-for="link in navStore.getLinksByCategory(child.id)"
                      :key="link.id"
                      :link="link"
                      @edit="emit('open-editor', $event)"
                      @contextmenu="handleCardContextMenu"
                      @dragstart="handleDragStart"
                      @dragover="handleDragOver($event, child.id)"
                      @dragend="handleDragEnd"
                    />
                  </div>

                  <template v-for="grandchild in getChildren(child.id)" :key="grandchild.id">
                    <div
                      class="sub-category sub-category-deep"
                      @dragover="handleCategoryDragOver($event, grandchild.id)"
                      @drop="handleCategoryDrop($event, grandchild.id)"
                      @dragleave="dropTargetCategory === grandchild.id && (dropTargetCategory = null)"
                      :class="{ 'drop-target': dropTargetCategory === grandchild.id }"
                    >
                      <div class="sub-category-header">
                        <div class="sub-category-title-wrapper" @click="toggleCategory(grandchild.id)">
                          <svg :class="['chevron-icon-sm', { rotated: !grandchild.collapsed }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          <span class="sub-cat-dot" :style="{ background: grandchild.color }"></span>
                          <span class="sub-cat-name">{{ grandchild.name }}</span>
                          <span class="sub-cat-count">{{ navStore.getTotalLinksByCategory(grandchild.id) }}</span>
                        </div>
                        <div class="category-actions">
                          <button class="cat-action-btn cat-action-delete" title="删除分类" @click.stop="requestDeleteCategory(grandchild)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </div>

                      <div :class="['category-collapse', { collapsed: grandchild.collapsed }]">
                        <div class="category-collapse-inner">
                          <div class="nav-grid">
                            <NavCard
                              v-for="link in navStore.getLinksByCategory(grandchild.id)"
                              :key="link.id"
                              :link="link"
                              @edit="emit('open-editor', $event)"
                              @contextmenu="handleCardContextMenu"
                              @dragstart="handleDragStart"
                              @dragover="handleDragOver($event, grandchild.id)"
                              @dragend="handleDragEnd"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="ctxMenu.visible" class="ctx-backdrop" @click="closeCtxMenu"></div>
      <div v-if="ctxMenu.visible" class="context-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }">
        <button v-if="ctxLink?.urls.extranet" class="ctx-item" @click="ctxOpenExtranet">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          打开外网地址
        </button>
        <button v-if="ctxLink?.urls.intranet" class="ctx-item" @click="ctxOpenIntranet">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>
          打开内网地址
        </button>
        <button v-if="ctxLink?.urls.tunnel" class="ctx-item" @click="ctxOpenTunnel">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
          打开隧道地址
        </button>
        <div class="ctx-divider"></div>
        <button class="ctx-item" @click="ctxTogglePin">
          <svg width="14" height="14" viewBox="0 0 24 24" :fill="ctxLink?.pinned ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z"/></svg>
          {{ ctxLink?.pinned ? '取消置顶' : '置顶' }}
        </button>
        <button class="ctx-item" @click="ctxEdit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          编辑
        </button>
        <div class="ctx-divider"></div>
        <button class="ctx-item" @click="ctxBatchSelect">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
          批量选择
        </button>
        <button class="ctx-item ctx-danger" @click="ctxDelete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          删除
        </button>
      </div>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showAddCategory" class="add-cat-overlay" @mousedown.self="showAddCategory = false">
          <Transition name="modal-pop" appear>
            <div v-if="showAddCategory" class="add-cat-modal">
              <h3>添加{{ newCatParentId ? '子' : '' }}分类</h3>
              <input
                v-model="newCatName"
                type="text"
                class="add-cat-input"
                placeholder="输入分类名称"
                @keyup.enter="confirmAddCategory"
                autofocus
              />
              <div class="add-cat-actions">
                <button class="add-cat-cancel" @click="showAddCategory = false">取消</button>
                <button class="add-cat-confirm" @click="confirmAddCategory" :disabled="!newCatName.trim()">确定</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>

      <Transition name="fade">
        <div v-if="showDeleteConfirm" class="add-cat-overlay" @mousedown.self="cancelDeleteCategory">
          <Transition name="modal-pop" appear>
            <div v-if="showDeleteConfirm" class="add-cat-modal">
              <h3>删除分类</h3>
              <p class="delete-confirm-msg">{{ deleteMsg }}</p>
              <div class="add-cat-actions">
                <button class="add-cat-cancel" @click="cancelDeleteCategory">取消</button>
                <button class="add-cat-delete-btn" @click="confirmDeleteCategory">确定删除</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>

      <Transition name="fade">
        <div v-if="showLinkDeleteConfirm" class="add-cat-overlay" @mousedown.self="cancelDeleteLink">
          <Transition name="modal-pop" appear>
            <div v-if="showLinkDeleteConfirm" class="add-cat-modal">
              <h3>删除链接</h3>
              <p class="delete-confirm-msg">确定删除「{{ deleteLinkTarget?.title }}」吗？</p>
              <div class="add-cat-actions">
                <button class="add-cat-cancel" @click="cancelDeleteLink">取消</button>
                <button class="add-cat-delete-btn" @click="confirmDeleteLink">确定删除</button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.category-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.category-list.double-column {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.category-section {
  transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 12px;
  padding: 0 4px;
}

.category-section.drop-target {
  box-shadow: 0 0 0 2px var(--primary), 0 4px 16px rgba(99, 102, 241, 0.15);
}

.category-header {
  display: flex;
  align-items: center;
  padding: 8px 0;
  gap: 8px;
}

.category-title-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px;
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.category-title-wrapper:hover {
  background: var(--bg-hover);
}

.category-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.category-header:hover .category-icon {
  transform: scale(1.05);
}

.chevron-icon {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: rotate(-90deg);
}

.chevron-icon.rotated {
  transform: rotate(0deg);
}

.chevron-icon-sm {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: rotate(-90deg);
}

.chevron-icon-sm.rotated {
  transform: rotate(0deg);
}

.category-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.category-count {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--bg-secondary);
  border-radius: 10px;
  color: var(--text-muted);
}

.category-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.category-header:hover .category-actions,
.sub-category-header:hover .category-actions {
  opacity: 1;
}

.cat-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: var(--text-muted);
  transition: all 0.2s ease;
  cursor: pointer;
}

.cat-action-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.cat-action-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.category-collapse {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.category-collapse.collapsed {
  grid-template-rows: 0fr;
}

.category-collapse-inner {
  overflow: hidden;
  min-height: 0;
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  padding-top: 6px;
  padding-bottom: 4px;
}

.sub-category {
  margin-top: 8px;
  margin-left: 20px;
  padding: 4px 8px;
  border-left: 2px solid var(--border);
  transition: box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 0 8px 8px 0;
}

.sub-category.drop-target {
  border-left-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary), 0 4px 16px rgba(99, 102, 241, 0.15);
}

.sub-category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}

.sub-category-title-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  transition: background 0.2s ease;
}

.sub-category-title-wrapper:hover {
  background: var(--bg-hover);
}

.sub-cat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sub-cat-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.sub-cat-count {
  font-size: 11px;
  padding: 1px 6px;
  background: var(--bg-secondary);
  border-radius: 8px;
  color: var(--text-muted);
}

.sub-category-deep {
  margin-left: 20px;
  border-left: 2px solid rgba(99, 102, 241, 0.2);
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

.delete-confirm-msg {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.add-cat-delete-btn {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  background: #ef4444;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
}

.add-cat-delete-btn:hover {
  opacity: 0.9;
  box-shadow: 0 3px 10px rgba(239, 68, 68, 0.35);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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

.category-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 28px;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: grab;
  opacity: 0.35;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.category-drag-handle:hover {
  opacity: 0.8;
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.category-section:active .category-drag-handle {
  cursor: grabbing;
}

.category-section.cat-dragging {
  opacity: 0.4;
  transform: scale(0.98);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.category-section.cat-drop-target {
  position: relative;
  transform: translateY(4px);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.category-section.cat-drop-target::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--primary);
  border-radius: 3px;
  animation: cat-drop-pulse 1s ease-in-out infinite;
}

@keyframes cat-drop-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 768px) {
  .nav-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }

  .category-name {
    font-size: 15px;
  }

  .sub-category {
    margin-left: 12px;
  }
}

@media (max-width: 480px) {
  .nav-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .category-icon {
    width: 24px;
    height: 24px;
  }

  .category-name {
    font-size: 14px;
  }

  .category-count {
    font-size: 11px;
    padding: 1px 6px;
  }

  .sub-category {
    margin-left: 8px;
  }

  .sub-cat-name {
    font-size: 13px;
  }
}
</style>

<style>
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 4998;
}

.context-menu {
  position: fixed;
  z-index: 4999;
  background: var(--bg-card);
  border: none;
  border-radius: 14px;
  padding: 6px;
  min-width: 170px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  animation: ctxIn 0.15s ease;
}

@keyframes ctxIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text);
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.ctx-item:hover {
  background: var(--bg-hover);
}

.ctx-danger {
  color: #ef4444;
}

.ctx-danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.ctx-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
</style>
