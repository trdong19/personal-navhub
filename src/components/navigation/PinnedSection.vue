<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNavStore } from '@/stores/nav'
import { useNetworkStore } from '@/stores/network'
import NavCard from './NavCard.vue'
import { useCardEntrance } from '@/composables/useAnimation'
import { useFlipSort } from '@/composables/useFlipSort'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ContextMenu from '@/components/common/ContextMenu.vue'
import type { ContextMenuItem } from '@/components/common/ContextMenu.vue'

const emit = defineEmits<{
  'open-editor': [id: string]
}>()

const navStore = useNavStore()
const networkStore = useNetworkStore()
const draggingId = ref<string | null>(null)
const gridRef = ref<HTMLElement | null>(null)

const entrance = useCardEntrance(gridRef)
const { recordPositions, animateFlip } = useFlipSort(gridRef)

function handleDragStart(id: string) {
  draggingId.value = id
  entrance.pause()
}

function handleDragOver(targetId: string) {
  if (!draggingId.value || draggingId.value === targetId) return
  const ids = navStore.pinnedLinks.map(l => l.id)
  const fromIdx = ids.indexOf(draggingId.value)
  const toIdx = ids.indexOf(targetId)
  if (fromIdx === -1 || toIdx === -1) return
  const before = recordPositions(draggingId.value)
  ids.splice(fromIdx, 1)
  ids.splice(toIdx, 0, draggingId.value)
  navStore.reorderPinnedLinks(ids)
  animateFlip(before, draggingId.value)
}

function handleDragEnd() {
  draggingId.value = null
  entrance.resume()
}

const ctxMenu = ref<{ x: number; y: number; visible: boolean; linkId: string }>({ x: 0, y: 0, visible: false, linkId: '' })

function handleCardContextMenu(payload: { id: string; x: number; y: number }) {
  ctxMenu.value = { x: payload.x, y: payload.y, visible: true, linkId: payload.id }
}

function closeCtxMenu() {
  ctxMenu.value.visible = false
}

/** 右键菜单项配置 */
const ctxMenuItems = computed<ContextMenuItem[]>(() => {
  const link = ctxLink.value
  if (!link) return []

  const { urls } = link
  const current = networkStore.currentType

  // 构建地址菜单项：排除当前模式的地址
  const addressItems: ContextMenuItem[] = []

  if (current !== 'extranet' && urls.extranet) {
    addressItems.push({
      label: '打开外网地址',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      action: () => { if (link?.urls.extranet) window.open(link.urls.extranet, '_blank') },
    })
  }
  if (current !== 'intranet' && urls.intranet) {
    addressItems.push({
      label: '打开内网地址',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>',
      action: () => { if (link?.urls.intranet) window.open(link.urls.intranet, '_blank') },
    })
  }
  if (current !== 'tunnel' && urls.tunnel) {
    addressItems.push({
      label: '打开隧道地址',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
      action: () => { if (link?.urls.tunnel) window.open(link.urls.tunnel, '_blank') },
    })
  }

  const items: ContextMenuItem[] = []

  // 如果有地址选项，添加分隔线
  if (addressItems.length > 0) {
    items.push(...addressItems)
    items.push({ label: '', action: () => {} })
  }

  // 添加其他菜单项（置顶区只有取消置顶）
  items.push(
    {
      label: '取消置顶',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z"/></svg>',
      action: () => { if (link) navStore.updateLink(link.id, { pinned: false }) },
    },
    {
      label: '编辑',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
      action: () => emit('open-editor', ctxMenu.value.linkId),
    },
    { label: '', action: () => {} },
    {
      label: '删除',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
      danger: true,
      action: () => {
        if (link) {
          deleteLinkTarget.value = link
          showDeleteConfirm.value = true
        }
      },
    },
  )

  return items
})

function confirmDeleteLink() {
  if (deleteLinkTarget.value) {
    navStore.deleteLink(deleteLinkTarget.value.id)
  }
  showDeleteConfirm.value = false
  deleteLinkTarget.value = null
}

function cancelDeleteLink() {
  showDeleteConfirm.value = false
  deleteLinkTarget.value = null
}

const ctxLink = computed(() => navStore.links.find(l => l.id === ctxMenu.value.linkId) || null)

const showDeleteConfirm = ref(false)
const deleteLinkTarget = ref<{ id: string; title: string } | null>(null)
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

    <ContextMenu
      :visible="ctxMenu.visible"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :items="ctxMenuItems"
      @close="closeCtxMenu"
    />

    <ConfirmDialog
      :visible="showDeleteConfirm"
      title="删除链接"
      :message="`确定删除「${deleteLinkTarget?.title}」吗？`"
      confirm-text="确定删除"
      danger
      @update:visible="showDeleteConfirm = $event"
      @confirm="confirmDeleteLink"
      @cancel="cancelDeleteLink"
    />
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
