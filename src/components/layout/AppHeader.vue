<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useNavStore } from '@/stores/nav'
import { useAuth } from '@/composables/useAuth'
import { animateDropdown } from '@/composables/useAnimation'

const emit = defineEmits<{
  'open-settings': []
  'open-editor': []
  'open-stats': []
}>()

const settingsStore = useSettingsStore()
const navStore = useNavStore()
const auth = useAuth()
const showMenu = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const menuDropdownRef = ref<HTMLElement | null>(null)
const showAuthModal = ref(false)
const isRegisterMode = ref(false)
const authForm = ref({ username: '', password: '', rememberMe: false })
const authLoading = ref(false)
const authModalRef = ref<HTMLElement | null>(null)

const showAdminPanel = ref(false)
const adminUsers = ref<{ username: string; role: string; createdAt: number }[]>([])
const adminRegistrationEnabled = ref(false)
const adminNewUser = ref({ username: '', password: '' })
const adminError = ref('')
const adminSuccess = ref('')

function openAuthModal() {
  showAuthModal.value = true
  isRegisterMode.value = false
  authForm.value = { username: '', password: '', rememberMe: false }
}

function closeAuthModal() {
  if (!auth.isLoggedIn.value) return
  showAuthModal.value = false
  authForm.value = { username: '', password: '', rememberMe: false }
}

async function handleAuthSubmit() {
  if (!authForm.value.username.trim() || !authForm.value.password.trim()) return
  authLoading.value = true
  if (isRegisterMode.value) {
    await auth.register(authForm.value.username.trim(), authForm.value.password)
    if (auth.isLoggedIn.value) {
      await auth.push()
      closeAuthModal()
    }
  } else {
    await auth.login(authForm.value.username.trim(), authForm.value.password, authForm.value.rememberMe)
    if (auth.isLoggedIn.value) {
      const hasCloudData = await auth.pull()
      if (hasCloudData) {
        settingsStore.reloadFromStorage()
        navStore.reloadFromStorage()
      } else {
        await auth.push()
      }
      closeAuthModal()
    }
  }
  authLoading.value = false
}

async function handleLogout() {
  await auth.logout()
}

async function openAdminPanel() {
  showAdminPanel.value = true
  adminError.value = ''
  adminSuccess.value = ''
  showMenu.value = false
  await loadAdminData()
}

async function loadAdminData() {
  try {
    const [users, status] = await Promise.all([
      auth.adminGetUsers(),
      auth.adminGetStatus(),
    ])
    adminUsers.value = users
    adminRegistrationEnabled.value = status.registrationEnabled
  } catch (err: any) {
    adminError.value = err.message
  }
}

async function handleAdminAddUser() {
  if (!adminNewUser.value.username.trim() || !adminNewUser.value.password.trim()) return
  adminError.value = ''
  adminSuccess.value = ''
  try {
    await auth.adminAddUser(adminNewUser.value.username.trim(), adminNewUser.value.password)
    adminSuccess.value = `用户 ${adminNewUser.value.username.trim()} 添加成功`
    adminNewUser.value = { username: '', password: '' }
    await loadAdminData()
  } catch (err: any) {
    adminError.value = err.message
  }
}

async function handleAdminDeleteUser(u: string) {
  if (!confirm(`确定删除用户「${u}」？该操作不可恢复。`)) return
  adminError.value = ''
  adminSuccess.value = ''
  try {
    await auth.adminDeleteUser(u)
    adminSuccess.value = `用户 ${u} 已删除`
    await loadAdminData()
  } catch (err: any) {
    adminError.value = err.message
  }
}

async function handleToggleRegistration() {
  adminError.value = ''
  adminSuccess.value = ''
  try {
    const result = await auth.adminToggleRegistration()
    adminRegistrationEnabled.value = result.registrationEnabled
    adminSuccess.value = `注册功能已${result.registrationEnabled ? '开启' : '关闭'}`
  } catch (err: any) {
    adminError.value = err.message
  }
}

watch(showMenu, (val) => {
  nextTick(() => {
    if (menuDropdownRef.value) {
      animateDropdown(menuDropdownRef.value, val)
    }
  })
})

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    showMenu.value = false
  }
}

function handleAuthModalBackdrop(e: MouseEvent) {
  if (!auth.isLoggedIn.value) return
  if (authModalRef.value && e.target === authModalRef.value) {
    closeAuthModal()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  if (!auth.isLoggedIn.value) {
    showAuthModal.value = true
  }
})

watch(() => auth.isLoggedIn.value, (loggedIn) => {
  if (!loggedIn) {
    showAuthModal.value = true
  }
})
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <header class="header">
    <div class="header-inner">
      <div class="header-left">
        <h1 class="logo">
          <span class="logo-icon">🍓</span>
          <span class="logo-text">{{ settingsStore.settings.siteTitle }}</span>
        </h1>
        <p v-if="settingsStore.settings.siteDescription" class="site-desc">{{ settingsStore.settings.siteDescription }}</p>
      </div>

      <div class="header-right">
        <div v-if="!auth.isLoggedIn.value" class="login-btn-wrapper">
          <button class="login-btn" @click="openAuthModal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
            登录
          </button>
        </div>
        <div v-else ref="menuRef" class="user-menu-wrapper">
          <button class="user-badge-btn" @click="showMenu = !showMenu">
            <span class="user-avatar">👤</span>
            <svg :class="['chevron', { open: showMenu }]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div v-if="showMenu" ref="menuDropdownRef" class="dropdown-menu" @click="showMenu = false">
            <button class="menu-item" @click="emit('open-settings')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              设置
            </button>
            <button class="menu-item" @click="emit('open-stats')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              访问统计
            </button>
            <button v-if="auth.isAdmin.value" class="menu-item menu-item-admin" @click="openAdminPanel">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              管理面板
            </button>
            <div class="menu-divider"></div>
            <button class="menu-item menu-item-danger" @click="handleLogout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
              退出登录
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="showAuthModal" ref="authModalRef" class="auth-modal-overlay" @click="handleAuthModalBackdrop">
        <div class="auth-modal">
          <button v-if="auth.isLoggedIn.value" class="auth-modal-close" @click="closeAuthModal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>

          <div class="auth-modal-header">
            <div class="auth-modal-icon">🍓</div>
            <h2 class="auth-modal-title">NavHub</h2>
          </div>

          <div class="auth-mode-tabs">
            <button :class="['auth-mode-btn', { active: !isRegisterMode }]" @click="isRegisterMode = false; auth.authMessage.value = ''">登录</button>
            <button :class="['auth-mode-btn', { active: isRegisterMode }]" @click="isRegisterMode = true; auth.authMessage.value = ''">注册</button>
          </div>

          <form class="auth-form" @submit.prevent="handleAuthSubmit">
            <div class="auth-field">
              <label class="auth-label">用户名</label>
              <input
                v-model="authForm.username"
                type="text"
                class="auth-input"
                placeholder="2-20个字符，支持中文"
                autocomplete="username"
              />
            </div>
            <div class="auth-field">
              <label class="auth-label">密码</label>
              <input
                v-model="authForm.password"
                type="password"
                class="auth-input"
                placeholder="4位以上"
                autocomplete="current-password"
              />
            </div>
            <div v-if="!isRegisterMode" class="auth-remember-row">
              <label class="remember-label">
                <input v-model="authForm.rememberMe" type="checkbox" class="remember-checkbox" />
                一个月内免登录
              </label>
            </div>
            <div v-if="auth.authMessage.value" :class="['auth-message', auth.authStatus.value === 'error' ? 'error' : 'success']">
              {{ auth.authMessage.value }}
            </div>
            <button type="submit" class="auth-submit" :disabled="authLoading || !authForm.username.trim() || !authForm.password.trim()">
              {{ authLoading ? '处理中...' : (isRegisterMode ? '注册' : '登录') }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showAdminPanel" class="admin-overlay" @click.self="showAdminPanel = false">
          <Transition name="modal-pop" appear>
            <div v-if="showAdminPanel" class="admin-modal">
              <div class="admin-header">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  管理面板
                </h3>
                <button class="close-btn" @click="showAdminPanel = false">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <div class="admin-body">
                <div v-if="adminError" class="admin-msg admin-msg-error">{{ adminError }}</div>
                <div v-if="adminSuccess" class="admin-msg admin-msg-success">{{ adminSuccess }}</div>

                <div class="admin-section">
                  <h4>注册控制</h4>
                  <div class="admin-toggle-row">
                    <span>允许新用户注册</span>
                    <button
                      :class="['toggle', { active: adminRegistrationEnabled }]"
                      @click="handleToggleRegistration"
                    >
                      {{ adminRegistrationEnabled ? '已开启' : '已关闭' }}
                    </button>
                  </div>
                </div>

                <div class="admin-section">
                  <h4>添加用户</h4>
                  <div class="admin-add-form">
                    <input
                      v-model="adminNewUser.username"
                      type="text"
                      class="admin-input"
                      placeholder="用户名"
                    />
                    <input
                      v-model="adminNewUser.password"
                      type="password"
                      class="admin-input"
                      placeholder="密码"
                      @keyup.enter="handleAdminAddUser"
                    />
                    <button class="admin-btn admin-btn-primary" @click="handleAdminAddUser" :disabled="!adminNewUser.username.trim() || !adminNewUser.password.trim()">
                      添加
                    </button>
                  </div>
                </div>

                <div class="admin-section">
                  <h4>用户列表 <span class="admin-count">{{ adminUsers.length }}</span></h4>
                  <div class="admin-user-list">
                    <div v-for="user in adminUsers" :key="user.username" class="admin-user-item">
                      <div class="admin-user-info">
                        <span class="admin-user-avatar">{{ user.role === 'admin' ? '👑' : '👤' }}</span>
                        <div>
                          <span class="admin-user-name">{{ user.username }}</span>
                          <span :class="['admin-user-role', user.role]">{{ user.role === 'admin' ? '管理员' : '用户' }}</span>
                        </div>
                      </div>
                      <button
                        v-if="user.role !== 'admin'"
                        class="admin-btn admin-btn-danger-sm"
                        @click="handleAdminDeleteUser(user.username)"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
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
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.04);
}

.header-inner {
  width: 100%;
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
}

.logo-icon {
  font-size: 24px;
}

.site-desc {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  line-height: 1.2;
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
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
}

.user-menu-wrapper {
  position: relative;
}

.user-badge-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 20px;
  background: var(--bg);
  border: none;
  cursor: pointer;
  transition: all var(--transition);
  font-size: 13px;
  color: var(--text);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.user-badge-btn:hover {
  background: var(--bg-hover);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
}

.user-avatar {
  font-size: 16px;
}

.chevron {
  transition: transform 0.2s ease;
  color: var(--text-muted);
}

.chevron.open {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--bg-card);
  border: none;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  min-width: 180px;
  padding: 4px;
  z-index: 200;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all var(--transition);
  cursor: pointer;
}

.menu-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.menu-item-danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.menu-divider {
  height: 1px;
  background: var(--border);
  margin: 4px 8px;
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
  border-radius: 20px;
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

.auth-mode-tabs {
  display: flex;
  gap: 4px;
  background: var(--bg);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 20px;
}

.auth-mode-btn {
  flex: 1;
  padding: 7px 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  transition: all var(--transition);
  cursor: pointer;
}

.auth-mode-btn.active {
  background: var(--bg-card);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
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

.auth-remember-row {
  display: flex;
  align-items: center;
}

.remember-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}

.remember-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
  cursor: pointer;
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

.admin-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.admin-modal {
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  background: var(--bg-card);
  border: none;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: none;
}

.admin-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.admin-msg {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.4;
}

.admin-msg-error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.admin-msg-success {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.admin-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.admin-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-weight: 500;
}

.admin-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg);
  border-radius: 10px;
  font-size: 14px;
  color: var(--text-secondary);
}

.toggle {
  padding: 5px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.toggle.active {
  background: #22c55e;
  color: white;
}

.admin-add-form {
  display: flex;
  gap: 8px;
}

.admin-input {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  color: var(--text);
  background: var(--bg);
  outline: none;
  transition: box-shadow 0.2s ease;
  box-sizing: border-box;
}

.admin-input:focus {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
}

.admin-btn {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  white-space: nowrap;
}

.admin-btn-primary {
  background: var(--primary);
  color: white;
}

.admin-btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.admin-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-btn-danger-sm {
  padding: 4px 10px;
  font-size: 12px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-btn-danger-sm:hover {
  background: #ef4444;
  color: white;
}

.admin-user-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.admin-user-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.admin-user-item:hover {
  background: var(--bg-hover);
}

.admin-user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-user-avatar {
  font-size: 18px;
}

.admin-user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  display: block;
}

.admin-user-role {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.admin-user-role.admin {
  background: rgba(234, 179, 8, 0.1);
  color: #eab308;
}

.admin-user-role.user {
  background: var(--bg-secondary);
  color: var(--text-muted);
}

.menu-item-admin {
  color: #eab308;
}

.menu-item-admin:hover {
  background: rgba(234, 179, 8, 0.08);
  color: #eab308;
}

@media (max-width: 768px) {
  .header-inner {
    padding: 0 12px;
    gap: 10px;
  }
  .logo-text {
    display: none;
  }
  .login-btn span {
    display: none;
  }
  .user-name {
    display: none;
  }
}
</style>
