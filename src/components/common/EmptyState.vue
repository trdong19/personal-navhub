<script setup lang="ts">
const emit = defineEmits<{
  'add-category': []
  'add-link': []
  'open-settings': []
}>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon">🚀</div>
    <h2 class="empty-title">欢迎使用 NavHub</h2>
    <p class="empty-desc">你的个人导航站已准备就绪，开始添加你的第一个分类和书签吧！</p>
    <div class="empty-actions">
      <button class="empty-btn primary" @click="emit('add-category')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>
        创建第一个分类
      </button>
      <button class="empty-btn" @click="emit('open-settings')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        打开设置
      </button>
    </div>
    <div class="empty-tips">
      <div class="tip-item">
        <span class="tip-icon">💡</span>
        <span>使用右下角的 <strong>+</strong> 按钮快速添加分类或书签</span>
      </div>
      <div class="tip-item">
        <span class="tip-icon">🔍</span>
        <span>按 <kbd>Ctrl+K</kbd> 或 <kbd>/</kbd> 快速搜索</span>
      </div>
      <div class="tip-item">
        <span class="tip-icon">🎨</span>
        <span>在设置中自定义主题、背景图和搜索引擎</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 60px 24px 80px;
  animation: fadeInUp 0.5s ease;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.empty-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 8px;
}

.empty-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0 0 28px;
  max-width: 400px;
  line-height: 1.6;
}

.empty-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 40px;
  flex-wrap: wrap;
  justify-content: center;
}

.empty-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.empty-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.empty-btn.primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.empty-btn.primary:hover {
  background: var(--primary-dark, var(--primary));
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.empty-tips {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 380px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: left;
}

.tip-icon {
  font-size: 16px;
  flex-shrink: 0;
}

kbd {
  display: inline-block;
  padding: 2px 6px;
  font-size: 11px;
  font-family: monospace;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.06);
}
</style>
