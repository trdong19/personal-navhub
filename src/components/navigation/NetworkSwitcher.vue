<script setup lang="ts">
import { useNetworkStore } from '@/stores/network'

const networkStore = useNetworkStore()

function toggle() {
  networkStore.toggle()
}
</script>

<template>
  <button
    class="network-switcher"
    :class="networkStore.currentType"
    @click="toggle"
    :title="`当前: ${networkStore.statusText}，点击切换`"
  >
    <span class="switcher-label">{{ networkStore.currentType === 'intranet' ? '内' : '外' }}</span>
  </button>
</template>

<style scoped>
.network-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 700;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: none;
  outline: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  background: var(--bg-card);
}

.network-switcher.intranet {
  color: #10b981;
}

.network-switcher.intranet:hover {
  background: #10b981;
  color: white;
  border-color: #10b981;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  transform: translateY(-2px);
}

.network-switcher.extranet {
  color: #3b82f6;
}

.network-switcher.extranet:hover {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}

.switcher-label {
  line-height: 1;
}
</style>
