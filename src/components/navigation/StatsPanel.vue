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

const categoryStats = computed(() => {
  return navStore.categories.map(cat => {
    const catLinks = navStore.links.filter(l => l.category === cat.id)
    const totalAccess = catLinks.reduce((sum, l) => sum + l.accessCount, 0)
    return {
      id: cat.id,
      name: cat.name,
      linkCount: catLinks.length,
      totalAccess,
    }
  }).sort((a, b) => b.linkCount - a.linkCount)
})

const maxCatLinks = computed(() => Math.max(...categoryStats.value.map(c => c.linkCount), 1))

function getCatBarWidth(count: number) {
  return `${(count / maxCatLinks.value) * 100}%`
}

const weeklyTrend = computed(() => {
  const now = new Date()
  const days: { label: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const dayEnd = dayStart + 86400000
    const count = navStore.accessRecords.filter(r => r.timestamp >= dayStart && r.timestamp < dayEnd).length
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    days.push({ label, count })
  }
  return days
})

const maxTrendCount = computed(() => Math.max(...weeklyTrend.value.map(d => d.count), 1))

function getTrendBarHeight(count: number) {
  return `${Math.max((count / maxTrendCount.value) * 100, 4)}%`
}

const staleLinks = computed(() => {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 3600000
  return navStore.links
    .filter(l => !l.lastAccessed || l.lastAccessed < thirtyDaysAgo)
    .sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0))
    .slice(0, 10)
})

const activeTab = ref<'overview' | 'categories' | 'stale'>('overview')
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

      <div class="stats-tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">概览</button>
        <button class="tab-btn" :class="{ active: activeTab === 'categories' }" @click="activeTab = 'categories'">分类统计</button>
        <button class="tab-btn" :class="{ active: activeTab === 'stale' }" @click="activeTab = 'stale'">
          未访问提醒
          <span v-if="staleLinks.length > 0" class="tab-badge">{{ staleLinks.length }}</span>
        </button>
      </div>

      <div class="stats-body">
        <template v-if="activeTab === 'overview'">
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

          <div class="trend-section">
            <h4>近 7 天访问趋势</h4>
            <div class="trend-chart">
              <div v-for="day in weeklyTrend" :key="day.label" class="trend-col">
                <div class="trend-bar-wrap">
                  <div class="trend-bar" :style="{ height: getTrendBarHeight(day.count) }">
                    <span v-if="day.count > 0" class="trend-val">{{ day.count }}</span>
                  </div>
                </div>
                <div class="trend-label">{{ day.label }}</div>
              </div>
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
        </template>

        <template v-if="activeTab === 'categories'">
          <div class="cat-stats-list">
            <div v-for="cat in categoryStats" :key="cat.id" class="cat-stat-item">
              <div class="cat-stat-header">
                <span class="cat-stat-name">{{ cat.name }}</span>
                <span class="cat-stat-info">{{ cat.linkCount }} 个链接 · {{ cat.totalAccess }} 次访问</span>
              </div>
              <div class="cat-stat-track">
                <div class="cat-stat-fill" :style="{ width: getCatBarWidth(cat.linkCount) }"></div>
              </div>
            </div>
            <div v-if="categoryStats.length === 0" class="empty-hint">暂无分类数据</div>
          </div>
        </template>

        <template v-if="activeTab === 'stale'">
          <div class="stale-section">
            <p class="stale-desc">以下链接超过 30 天未被访问，或从未被访问过：</p>
            <div class="stale-list">
              <div v-for="link in staleLinks" :key="link.id" class="stale-item">
                <div class="stale-name">{{ link.title }}</div>
                <div class="stale-time">{{ formatTime(link.lastAccessed) }}</div>
              </div>
            </div>
            <div v-if="staleLinks.length === 0" class="empty-hint">太棒了！所有链接都在近 30 天内被访问过 🎉</div>
          </div>
        </template>
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

.stats-tabs {
  display: flex;
  gap: 4px;
  padding: 0 24px;
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: -1px;
}

.tab-btn:hover {
  color: var(--text);
}

.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 600;
  background: #ef4444;
  color: white;
}

.trend-section h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 120px;
  padding: 0 4px;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.trend-bar-wrap {
  flex: 1;
  display: flex;
  align-items: flex-end;
  width: 100%;
}

.trend-bar {
  width: 100%;
  background: linear-gradient(180deg, var(--primary), var(--primary-light, var(--primary)));
  border-radius: 4px 4px 0 0;
  min-height: 4px;
  position: relative;
  transition: height 0.4s ease;
}

.trend-val {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
}

.trend-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 6px;
  white-space: nowrap;
}

.cat-stats-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cat-stat-item {
  background: var(--bg);
  border-radius: 10px;
  padding: 14px 16px;
}

.cat-stat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.cat-stat-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.cat-stat-info {
  font-size: 12px;
  color: var(--text-muted);
}

.cat-stat-track {
  height: 8px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}

.cat-stat-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), #818cf8);
  border-radius: 4px;
  transition: width 0.5s ease;
  min-width: 2px;
}

.stale-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stale-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}

.stale-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stale-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg);
  border-radius: 8px;
  border-left: 3px solid #f59e0b;
}

.stale-name {
  font-size: 14px;
  color: var(--text);
}

.stale-time {
  font-size: 12px;
  color: #f59e0b;
  font-weight: 500;
}

.empty-hint {
  text-align: center;
  padding: 24px;
  font-size: 14px;
  color: var(--text-muted);
}
</style>
