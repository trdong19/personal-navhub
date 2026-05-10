import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NetworkType } from '@/types'
import { storageGet, storageSet } from '@/utils/storage'

export const useNetworkStore = defineStore('network', () => {
  const currentType = ref<NetworkType>(
    storageGet('networkType', 'extranet')
  )

  const isIntranet = computed(() => currentType.value === 'intranet')
  const isExtranet = computed(() => currentType.value === 'extranet')
  const isTunnel = computed(() => currentType.value === 'tunnel')
  const statusText = computed(() => {
    const map: Record<NetworkType, string> = {
      intranet: '内网',
      extranet: '外网',
      tunnel: '隧道',
    }
    return map[currentType.value]
  })

  const statusOrder: NetworkType[] = ['extranet', 'intranet', 'tunnel']

  function setNetwork(type: NetworkType) {
    currentType.value = type
    storageSet('networkType', type)
  }

  function toggle() {
    const idx = statusOrder.indexOf(currentType.value)
    const next = statusOrder[(idx + 1) % statusOrder.length]
    setNetwork(next)
  }

  return {
    currentType,
    isIntranet,
    isExtranet,
    isTunnel,
    statusText,
    setNetwork,
    toggle,
  }
})
