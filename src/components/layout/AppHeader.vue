<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useNavStore } from '@/stores/nav'
import { useAuth } from '@/composables/useAuth'
import { animateDropdown } from '@/composables/useAnimation'
import { useToast } from '@/composables/useToast'

const emit = defineEmits<{
  'open-settings': []
  'open-editor': []
  'open-stats': []
  'login-success': []
  'undo-delete': []
}>()

const settingsStore = useSettingsStore()
const navStore = useNavStore()
const auth = useAuth()
const showMenu = ref(false)
const toast = useToast()

const hasDeletedLinks = computed(() => navStore.deletedLinksCache.length > 0)
const hasMovedLinks = computed(() => navStore.moveCache.length > 0)

function handleUndoDelete() {
  const count = navStore.restoreDeletedLinks()
  if (count > 0) {
    toast.success(`已撤回删除 ${count} 个链接`)
  }
}

function handleUndoMove() {
  const count = navStore.restoreMovedLinks()
  if (count > 0) {
    toast.success(`已撤回移动 ${count} 个链接`)
  }
}
const menuDropdownRef = ref<HTMLElement | null>(null)
const showAuthModal = ref(!auth.isLoggedIn.value)
const hasPassword = ref(false)
const isSetupMode = ref(false)
const authPassword = ref('')
const authConfirmPassword = ref('')
const authLoading = ref(false)
const authModalRef = ref<HTMLElement | null>(null)

function openAuthModal() {
  showAuthModal.value = true
  authPassword.value = ''
  authConfirmPassword.value = ''
}

function closeAuthModal() {
  if (!auth.isLoggedIn.value) return
  showAuthModal.value = false
  authPassword.value = ''
  authConfirmPassword.value = ''
}

async function handleAuthSubmit() {
  if (!authPassword.value.trim()) return
  if (isSetupMode.value && authPassword.value !== authConfirmPassword.value) {
    auth.authMessage.value = '两次密码不一致'
    auth.authStatus.value = 'error'
    return
  }
  authLoading.value = true
  if (isSetupMode.value) {
    const ok = await auth.setup(authPassword.value)
    if (ok) {
      settingsStore.reloadFromStorage()
      navStore.reloadFromStorage()
      closeAuthModal()
      emit('login-success')
    }
  } else {
    const ok = await auth.login(authPassword.value)
    if (ok) {
      await auth.flushPush()
      const serverVersion = await auth.checkServerVersion()
      const cachedVersion = parseInt(localStorage.getItem('nav_cached_server_version') || '0')
      if (serverVersion !== null && serverVersion > cachedVersion) {
        await auth.pull()
        settingsStore.reloadFromStorage()
        navStore.reloadFromStorage()
      }
      closeAuthModal()
      emit('login-success')
    }
  }
  authLoading.value = false
}

watch(showMenu, (val) => {
  nextTick(() => {
    if (menuDropdownRef.value) {
      animateDropdown(menuDropdownRef.value, val)
    }
  })
})

function handleClickOutside(e: MouseEvent) {
  const menuEl = document.querySelector('.user-menu-fab')
  if (menuEl && !menuEl.contains(e.target as Node)) {
    showMenu.value = false
  }
}

function handleAuthModalBackdrop(e: MouseEvent) {
  if (!auth.isLoggedIn.value) return
  if (authModalRef.value && e.target === authModalRef.value) {
    closeAuthModal()
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  if (!auth.isLoggedIn.value) {
    const setup = await auth.checkSetup()
    hasPassword.value = setup
    isSetupMode.value = !setup
    showAuthModal.value = true
  }
})

watch(() => auth.isLoggedIn.value, (loggedIn) => {
  if (!loggedIn) {
    showAuthModal.value = true
    auth.checkSetup().then(setup => {
      hasPassword.value = setup
      isSetupMode.value = !setup
    })
  }
})
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <header class="header">
    <div class="header-inner">
      <div class="header-right">
        <Transition name="fade">
          <button v-if="hasMovedLinks" class="undo-btn move-undo-btn" title="撤回移动" @click="handleUndoMove">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span class="undo-count">{{ navStore.moveCache.length }}</span>
          </button>
        </Transition>
        <Transition name="fade">
          <button v-if="hasDeletedLinks" class="undo-btn" title="撤回删除" @click="handleUndoDelete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span class="undo-count">{{ navStore.deletedLinksCache.length }}</span>
          </button>
        </Transition>

        <div v-if="!auth.isLoggedIn.value" class="login-btn-wrapper">
          <button class="login-btn" @click="openAuthModal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
            登录
          </button>
        </div>

      </div>
    </div>

    <Teleport to="body">
      <div v-if="showAuthModal" ref="authModalRef" class="auth-modal-overlay" @mousedown="handleAuthModalBackdrop">
        <div class="auth-modal">
          <button v-if="auth.isLoggedIn.value" class="auth-modal-close" @click="closeAuthModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>

          <div class="auth-modal-header">
            <div class="auth-modal-icon">🔥</div>
            <h2 class="auth-modal-title">NavHub</h2>
          </div>

          <form class="auth-form" @submit.prevent="handleAuthSubmit">
            <div class="auth-field">
              <label class="auth-label">{{ isSetupMode ? '设置密码' : '输入密码' }}</label>
              <input
                v-model="authPassword"
                type="password"
                class="auth-input"
                :placeholder="isSetupMode ? '至少4个字符' : '请输入密码'"
                autocomplete="current-password"
                autofocus
              />
            </div>
            <div v-if="isSetupMode" class="auth-field">
              <label class="auth-label">确认密码</label>
              <input
                v-model="authConfirmPassword"
                type="password"
                class="auth-input"
                placeholder="再次输入密码"
                autocomplete="new-password"
              />
            </div>
            <div v-if="auth.authMessage.value" :class="['auth-message', auth.authStatus.value === 'error' ? 'error' : 'success']">
              {{ auth.authMessage.value }}
            </div>
            <button type="submit" class="auth-submit" :disabled="authLoading || !authPassword.trim()">
              {{ authLoading ? '处理中...' : (isSetupMode ? '创建并进入' : '登录') }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>

  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-card);
  border-bottom: none;
  box-shadow: none;
}

.header-inner {
  width: 100%;
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 16px;
}



.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.login-btn-wrapper {
  flex-shrink: 0;
}

.undo-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
  transition: all var(--transition);
  cursor: pointer;
  white-space: nowrap;
  min-height: 40px;
  min-width: 60px;
}

.undo-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.3);
}

.undo-btn.move-undo-btn {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.2);
}

.undo-btn.move-undo-btn:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
}

.undo-count {
  background: #ef4444;
  color: white;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.undo-btn.move-undo-btn .undo-count {
  background: #3b82f6;
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: var(--primary);
  color: white;
  transition: all var(--transition);
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

.login-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(99, 102, 241, 0.25);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.auth-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  animation: fadeIn 0.15s ease;
}

.auth-modal {
  position: relative;
  width: 340px;
  max-width: 90vw;
  background: var(--bg-card);
  border: none;
  /* 登录弹窗圆角跟随全局设置 */
  border-radius: var(--radius);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  padding: 28px 24px;
  animation: scaleIn 0.2s ease;
}

.auth-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--text-muted);
  transition: all var(--transition);
  cursor: pointer;
}

.auth-modal-close:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.auth-modal-header {
  text-align: center;
  margin-bottom: 20px;
}

.auth-modal-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.auth-modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.auth-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.auth-input {
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  color: var(--text);
  background: var(--bg);
  outline: none;
  transition: box-shadow var(--transition);
  box-sizing: border-box;
}

.auth-input:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.auth-message {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
}

.auth-message.error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.auth-message.success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.auth-submit {
  width: 100%;
  padding: 10px 0;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  background: var(--primary);
  color: white;
  border: none;
  transition: all var(--transition);
  cursor: pointer;
  margin-top: 4px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

.auth-submit:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
}

.auth-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

@media (max-width: 768px) {
  .header-inner {
    padding: 0 12px;
    gap: 10px;
  }
  .undo-btn {
    padding: 8px 14px;
    min-height: 44px;
    min-width: 70px;
  }
  .undo-btn svg {
    width: 18px;
    height: 18px;
  }
  .undo-count {
    font-size: 12px;
    padding: 2px 7px;
  }
}
</style>
