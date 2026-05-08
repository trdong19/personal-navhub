<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNavStore } from '@/stores/nav'
import NavCard from './NavCard.vue'
import { useCardEntrance } from '@/composables/useAnimation'

const emit = defineEmits<{
  'open-editor': [id: string]
}>()

const navStore = useNavStore()
const draggingId = ref<string | null>(null)
const gridRef = ref<HTMLElement | null>(null)

useCardEntrance(gridRef)

function handleDragStart(id: string) {
  draggingId.value = id
}

function handleDragOver(targetId: string) {
  if (!draggingId.value || draggingId.value === targetId) return
  const ids = navStore.pinnedLinks.map(l => l.id)
  const fromIdx = ids.indexOf(draggingId.value)
  const toIdx = ids.indexOf(targetId)
  if (fromIdx === -1 || toIdx === -1) return
  ids.splice(fromIdx, 1)
  ids.splice(toIdx, 0, draggingId.value)
  navStore.reorderLinks(ids)
}

function handleDragEnd() {
  draggingId.value = null
}

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

function ctxUnpin() {
  const link = navStore.links.find(l => l.id === ctxMenu.value.linkId)
  if (link) navStore.updateLink(link.id, { pinned: false })
  closeCtxMenu()
}

function ctxEdit() {
  emit('open-editor', ctxMenu.value.linkId)
  closeCtxMenu()
}

function ctxDelete() {
  const link = navStore.links.find(l => l.id === ctxMenu.value.linkId)
  if (link && confirm(`确定删除「${link.title}」吗？`)) {
    navStore.deleteLink(link.id)
  }
  closeCtxMenu()
}

const ctxLink = computed(() => navStore.links.find(l => l.id === ctxMenu.value.linkId) || null)
</script>

<template>
  <section v-if="navStore.pinnedLinks.length > 0" class="pinned-section">
    <h2 class="section-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z"/></svg>
      常用导航
    </h2>
    <div ref="gridRef" class="nav-grid">
      <NavCard
        v-for="link in navStore.pinnedLinks"
        :key="link.id"
        :link="link"
        @edit="emit('open-editor', $event)"
        @contextmenu="handleCardContextMenu"
        @dragstart="handleDragStart"
        @dragover="handleDragOver($event)"
        @dragend="handleDragEnd"
      />
    </div>

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
        <div class="ctx-divider"></div>
        <button class="ctx-item" @click="ctxUnpin">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z"/></svg>
          取消置顶
        </button>
        <button class="ctx-item" @click="ctxEdit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          编辑
        </button>
        <button class="ctx-item ctx-danger" @click="ctxDelete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          删除
        </button>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.pinned-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px;
  min-width: 160px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 2px;
  backdrop-filter: blur(10px);
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  border-radius: 7px;
  cursor: pointer;
  transition: all var(--transition);
  text-align: left;
}

.ctx-item:hover {
  background: var(--primary);
  color: white;
}

.ctx-item.ctx-danger:hover {
  background: #ef4444;
}

.ctx-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

@media (max-width: 768px) {
  .nav-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }
}

@media (max-width: 480px) {
  .nav-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
}
</style>
