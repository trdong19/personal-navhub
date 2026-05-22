<script setup lang="ts">
import { useNetworkStore } from '@/stores/network'

const networkStore = useNetworkStore()

const labelMap: Record<string, string> = {
  intranet: '内',
  extranet: '外',
  tunnel: '隧',
}

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
    <span class="switcher-label">{{ labelMap[networkStore.currentType] || '外' }}</span>
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
  box-shadow: 0 2px 8px rgba(61, 52, 40, 0.08);
  background: var(--bg-card);
}

.network-switcher.intranet {
  color: var(--success);
}

.network-switcher.intranet:hover {
  background: var(--success);
  color: white;
  box-shadow: 0 4px 12px rgba(111, 186, 44, 0.3);
  transform: translateY(-2px);
}

.network-switcher.extranet {
  color: var(--primary);
}

.network-switcher.extranet:hover {
  background: var(--primary);
  color: white;
  box-shadow: 0 4px 12px rgba(25, 200, 185, 0.3);
  transform: translateY(-2px);
}

.network-switcher.tunnel {
  color: var(--warning);
}

.network-switcher.tunnel:hover {
  background: var(--warning);
  color: white;
  box-shadow: 0 4px 12px rgba(245, 195, 28, 0.3);
  transform: translateY(-2px);
}

.switcher-label {
  line-height: 1;
}
</style>
