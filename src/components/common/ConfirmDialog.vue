<script setup lang="ts">
import { watch, nextTick, ref, useSlots } from 'vue'

/** 生成唯一 ID 用于 ARIA 关联 */
const titleId = `confirm-dialog-title-${Math.random().toString(36).slice(2, 9)}`

const props = withDefaults(defineProps<{
  /** 是否显示弹窗 */
  visible: boolean
  /** 弹窗标题 */
  title: string
  /** 确认消息文本（仅消息模式时使用） */
  message?: string
  /** 确认按钮文本 */
  confirmText?: string
  /** 取消按钮文本 */
  cancelText?: string
  /** 是否为危险操作（红色确认按钮） */
  danger?: boolean
}>(), {
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:visible': [val: boolean]
}>()

const slots = useSlots()
/** 是否有自定义内容插槽（输入模式） */
const hasSlot = ref(!!slots.default)

// 监听 visible 变化，打开时聚焦到第一个输入框
watch(() => props.visible, (val) => {
  if (val) {
    hasSlot.value = !!slots.default
    nextTick(() => {
      const input = document.querySelector('.confirm-dialog-overlay input, .confirm-dialog-overlay select') as HTMLElement
      input?.focus()
    })
  }
})

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('confirm-dialog-overlay')) {
    close()
  }
}

function close() {
  emit('update:visible', false)
  emit('cancel')
}

function confirm() {
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="confirm-dialog-overlay" @mousedown.self="handleOverlayClick">
        <Transition name="modal-pop" appear>
          <div v-if="visible" class="confirm-dialog-modal" role="dialog" aria-modal="true" :aria-labelledby="titleId">
            <h3 class="confirm-dialog-title" :id="titleId">{{ title }}</h3>
            <!-- 消息模式 -->
            <p v-if="message && !hasSlot" class="confirm-dialog-message">{{ message }}</p>
            <!-- 自定义内容插槽（输入模式） -->
            <slot v-else-if="hasSlot"></slot>
            <div class="confirm-dialog-actions">
              <button class="confirm-dialog-cancel" @click="close">{{ cancelText }}</button>
              <button
                class="confirm-dialog-confirm"
                :class="{ danger }"
                @click="confirm"
              >
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.confirm-dialog-modal {
  background: var(--bg-card);
  border: none;
  /* 弹窗圆角跟随全局设置 */
  border-radius: var(--radius);
  padding: 24px;
  width: 320px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.confirm-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.confirm-dialog-message {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.confirm-dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.confirm-dialog-cancel {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.confirm-dialog-cancel:hover {
  background: var(--bg-hover);
}

.confirm-dialog-confirm {
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  color: white;
  background: var(--primary);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
}

.confirm-dialog-confirm:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 3px 10px rgba(99, 102, 241, 0.35);
}

.confirm-dialog-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-dialog-confirm.danger {
  background: #ef4444;
  box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
}

.confirm-dialog-confirm.danger:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 3px 10px rgba(239, 68, 68, 0.35);
}

/* 进出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-pop-enter-active {
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-pop-leave-active {
  transition: all 0.15s ease;
}

.modal-pop-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(8px);
}

.modal-pop-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(4px);
}
</style>
