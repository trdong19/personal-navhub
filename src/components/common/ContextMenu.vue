<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'

export interface ContextMenuItem {
  /** 菜单项标签 */
  label: string
  /** 菜单项图标（可选，SVG 内容） */
  icon?: string
  /** 是否为危险操作 */
  danger?: boolean
  /** 点击后执行的回调 */
  action: () => void
  /** 是否显示该菜单项（函数判断） */
  show?: () => boolean
}

const props = defineProps<{
  /** 是否显示菜单 */
  visible: boolean
  /** 菜单出现位置的 X 坐标 */
  x: number
  /** 菜单出现位置的 Y 坐标 */
  y: number
  /** 菜单项列表 */
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)

/** 过滤后的菜单项（根据 show 函数） */
const filteredItems = computed(() =>
  props.items.filter(item => !item.show || item.show())
)

/** 智能定位：检测边界，超出时反向展开 */
const menuStyle = computed(() => {
  if (!props.visible) return { left: props.x + 'px', top: props.y + 'px' }

  // 先渲染后检测，使用估算值
  const menuWidth = 170
  const menuHeight = filteredItems.value.length * 38
  const padding = 8

  let left = props.x
  let top = props.y

  // 右侧超出
  if (left + menuWidth + padding > window.innerWidth) {
    left = left - menuWidth
  }
  // 底部超出
  if (top + menuHeight + padding > window.innerHeight) {
    top = top - menuHeight
  }
  // 左侧边界
  if (left < padding) {
    left = padding
  }
  // 顶部边界
  if (top < padding) {
    top = padding
  }

  return { left: left + 'px', top: top + 'px' }
})

// 打开时用 nextTick 精确计算位置
watch(() => props.visible, (val) => {
  if (val) {
    nextTick(() => {
      if (!menuRef.value) return
      const rect = menuRef.value.getBoundingClientRect()
      let left = props.x
      let top = props.y

      if (left + rect.width + 8 > window.innerWidth) {
        left = left - rect.width
      }
      if (top + rect.height + 8 > window.innerHeight) {
        top = top - rect.height
      }
      if (left < 8) left = 8
      if (top < 8) top = 8

      menuRef.value.style.left = left + 'px'
      menuRef.value.style.top = top + 'px'
    })
  }
})

function handleItemClick(item: ContextMenuItem) {
  item.action()
  emit('close')
}

function handleBackdropClick() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <template v-if="visible">
      <div class="ctx-backdrop" @click="handleBackdropClick"></div>
      <Transition name="ctx-fade">
        <div
          v-if="visible"
          ref="menuRef"
          class="context-menu"
          :style="menuStyle"
        >
          <template v-for="(item, index) in filteredItems" :key="index">
            <!-- 分隔线：label 为空字符串时渲染分隔线 -->
            <div v-if="item.label === ''" class="ctx-divider"></div>
            <button
              v-else
              class="ctx-item"
              :class="{ 'ctx-danger': item.danger }"
              @click="handleItemClick(item)"
            >
              <!-- 图标插槽 -->
              <span v-if="item.icon" class="ctx-icon" v-html="item.icon"></span>
              {{ item.label }}
            </button>
          </template>
        </div>
      </Transition>
    </template>
  </Teleport>
</template>

<style scoped>
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
  border-radius: 24px;
  padding: 6px;
  min-width: 170px;
  box-shadow: 0 8px 32px rgba(61, 52, 40, 0.15);
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 10px;
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

.ctx-item:active {
  background: var(--bg-secondary);
  transform: scale(0.98);
}

.ctx-danger {
  color: var(--error);
}

.ctx-danger:hover {
  background: rgba(224, 90, 90, 0.1);
}

.ctx-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.ctx-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.ctx-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

/* 关闭时的 fade 动画 */
.ctx-fade-enter-active {
  transition: opacity 0.15s ease;
}

.ctx-fade-leave-active {
  transition: opacity 0.12s ease;
}

.ctx-fade-enter-from,
.ctx-fade-leave-to {
  opacity: 0;
}
</style>
