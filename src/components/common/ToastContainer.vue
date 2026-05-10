<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, removeToast } = useToast()

const iconMap = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast-item"
          :class="toast.type"
          @click="removeToast(toast.id)"
        >
          <span class="toast-icon">{{ iconMap[toast.type] }}</span>
          <span class="toast-msg">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  pointer-events: auto;
  cursor: pointer;
  white-space: nowrap;
  max-width: 90vw;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.toast-item.success {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.08);
}

.toast-item.error {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.toast-item.warning {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
}

.toast-item.info {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.08);
}

html.dark .toast-item.success {
  background: rgba(34, 197, 94, 0.15);
}

html.dark .toast-item.error {
  background: rgba(239, 68, 68, 0.15);
}

html.dark .toast-item.warning {
  background: rgba(245, 158, 11, 0.15);
}

html.dark .toast-item.info {
  background: rgba(99, 102, 241, 0.15);
}

.toast-icon {
  font-size: 14px;
  line-height: 1;
}

.toast-msg {
  line-height: 1.4;
}

.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-16px) scale(0.9);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
</style>
