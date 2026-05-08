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
  const statusText = computed(() => {
    const map: Record<NetworkType, string> = {
      intranet: '内网',
      extranet: '外网',
    }
    return map[currentType.value]
  })

  function setNetwork(type: NetworkType) {
    currentType.value = type
    storageSet('networkType', type)
  }

  function toggle() {
    setNetwork(currentType.value === 'intranet' ? 'extranet' : 'intranet')
  }

  return {
    currentType,
    isIntranet,
    isExtranet,
    statusText,
    setNetwork,
    toggle,
  }
})
