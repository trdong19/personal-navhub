<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useNavStore } from '@/stores/nav'

const emit = defineEmits<{
  close: []
}>()

const navStore = useNavStore()

const totalLinks = computed(() => navStore.links.length)
const totalAccess = computed(() => navStore.links.reduce((sum, l) => sum + l.accessCount, 0))
const topLinks = computed(() => navStore.getTopLinks(10))
const recentLinks = computed(() => navStore.getRecentLinks(10))

const maxAccess = computed(() => {
  const max = Math.max(...topLinks.value.map(l => l.accessCount), 1)
  return max
})

function getBarWidth(count: number) {
  return `${(count / maxAccess.value) * 100}%`
}

function formatTime(ts: number) {
  if (!ts) return '从未访问'
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}
</script>

<template>
  <div class="stats-overlay" @mousedown.self="emit('close')">
    <div class="stats-modal">
      <div class="stats-header">
        <h3>访问统计</h3>
        <button class="close-btn" @click="emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div class="stats-body">
        <div class="stat-cards">
          <div class="stat-card">
            <div class="stat-number">{{ totalLinks }}</div>
            <div class="stat-label">链接总数</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ totalAccess }}</div>
            <div class="stat-label">总访问次数</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{{ navStore.categories.length }}</div>
            <div class="stat-label">分类数</div>
          </div>
        </div>

        <div class="chart-section">
          <h4>热门链接 Top 10</h4>
          <div class="bar-chart">
            <div v-for="link in topLinks" :key="link.id" class="bar-item">
              <div class="bar-label">{{ link.title }}</div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: getBarWidth(link.accessCount) }"></div>
              </div>
              <div class="bar-value">{{ link.accessCount }}</div>
            </div>
          </div>
        </div>

        <div class="recent-section">
          <h4>最近访问</h4>
          <div class="recent-list">
            <div v-for="link in recentLinks" :key="link.id" class="recent-item">
              <div class="recent-name">{{ link.title }}</div>
              <div class="recent-time">{{ formatTime(link.lastAccessed) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.stats-modal {
  width: 100%;
  max-width: 650px;
  max-height: 90vh;
  background: var(--bg-card);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: statsSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes statsSlideIn {
  from {
    opacity: 0;
    transform: scale(0.92) translateY(24px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.stats-header h3 {
  font-size: 18px;
  font-weight: 600;
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

.stats-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-card {
  background: var(--bg);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.chart-section h4,
.recent-section h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}

.bar-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bar-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bar-label {
  width: 100px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-track {
  flex: 1;
  height: 20px;
  background: var(--bg);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  border-radius: 4px;
  transition: width 0.5s ease;
  min-width: 2px;
}

.bar-value {
  width: 40px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-align: right;
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg);
  border-radius: 8px;
}

.recent-name {
  font-size: 14px;
  color: var(--text);
}

.recent-time {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
