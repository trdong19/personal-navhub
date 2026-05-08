<script setup lang="ts">
import { ref } from 'vue'
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
        @dragstart="handleDragStart"
        @dragover="handleDragOver($event)"
        @dragend="handleDragEnd"
      />
    </div>
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
