<script setup lang="ts">
const emit = defineEmits<{
  'add-category': []
  'add-link': []
  'open-settings': []
}>()
</script>

<template>
  <div class="empty-state">
    <!-- 内联 SVG 插图：书签/导航主题 -->
    <div class="empty-illustration">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 背景圆 -->
        <circle cx="60" cy="60" r="56" fill="url(#illustGrad)" opacity="0.12" />
        <!-- 书签主体 -->
        <g class="illust-bookmark">
          <path d="M42 28h36c2.2 0 4 1.8 4 4v56l-22-12-22 12V32c0-2.2 1.8-4 4-4z"
                fill="url(#bookmarkFill)" stroke="var(--primary)" stroke-width="2.5"
                stroke-linejoin="round" stroke-linecap="round" />
          <!-- 书签内装饰线 -->
          <line x1="52" y1="44" x2="68" y2="44" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.7" />
          <line x1="52" y1="52" x2="64" y2="52" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.5" />
        </g>
        <!-- 小星星装饰 -->
        <g class="illust-star illust-star-1">
          <path d="M90 30l1.5 3 3.5.5-2.5 2.5.6 3.5-3.1-1.6-3.1 1.6.6-3.5L85 33.5l3.5-.5z"
                fill="var(--primary-light, var(--primary))" opacity="0.6" />
        </g>
        <g class="illust-star illust-star-2">
          <path d="M28 38l1 2 2.5.4-1.8 1.8.4 2.5-2.1-1.1-2.1 1.1.4-2.5L24 40.4l2.5-.4z"
                fill="var(--primary)" opacity="0.4" />
        </g>
        <!-- 小圆点装饰 -->
        <circle class="illust-dot illust-dot-1" cx="92" cy="52" r="2.5" fill="var(--primary)" opacity="0.3" />
        <circle class="illust-dot illust-dot-2" cx="30" cy="62" r="2" fill="var(--primary-light, var(--primary))" opacity="0.25" />
        <!-- 渐变定义 -->
        <defs>
          <linearGradient id="illustGrad" x1="0" y1="0" x2="120" y2="120">
            <stop offset="0%" stop-color="var(--primary)" />
            <stop offset="100%" stop-color="var(--primary-light, var(--primary))" />
          </linearGradient>
          <linearGradient id="bookmarkFill" x1="42" y1="28" x2="82" y2="88">
            <stop offset="0%" stop-color="var(--primary)" />
            <stop offset="100%" stop-color="var(--primary-dark, var(--primary))" />
          </linearGradient>
        </defs>
      </svg>
    </div>

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
        <span class="tip-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        </span>
        <span>使用右下角的 <strong>+</strong> 按钮快速添加分类或书签</span>
      </div>
      <div class="tip-item">
        <span class="tip-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <span>按 <kbd>Ctrl+K</kbd> 或 <kbd>/</kbd> 快速搜索</span>
      </div>
      <div class="tip-item">
        <span class="tip-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><path d="M17 2h4v4"/><path d="M15.5 8.5 21 3"/><circle cx="6.5" cy="13.5" r="2.5"/><path d="M2 17v4h4"/><path d="M8.5 15.5 3 21"/><circle cx="13.5" cy="17.5" r="2.5"/><path d="M21 17v4h-4"/><path d="M15.5 18.5 21 21"/></svg>
        </span>
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
  animation: fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ---- SVG 插图区域 ---- */
.empty-illustration {
  margin-bottom: 24px;
  animation: float 4s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* 书签主体微动 */
.illust-bookmark {
  transform-origin: 60px 60px;
  animation: bookmarkPulse 3s ease-in-out infinite;
}

@keyframes bookmarkPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

/* 星星闪烁 */
.illust-star-1 {
  animation: twinkle 2.5s ease-in-out infinite;
}
.illust-star-2 {
  animation: twinkle 3s ease-in-out 0.8s infinite;
}
@keyframes twinkle {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}

/* 圆点浮动 */
.illust-dot-1 {
  animation: dotFloat 3.5s ease-in-out infinite;
}
.illust-dot-2 {
  animation: dotFloat 4s ease-in-out 1s infinite;
}
@keyframes dotFloat {
  0%, 100% { transform: translateY(0); opacity: 0.3; }
  50% { transform: translateY(-4px); opacity: 0.5; }
}

/* ---- 标题与描述 ---- */
.empty-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.empty-desc {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0 0 32px;
  max-width: 420px;
  line-height: 1.7;
}

/* ---- 操作按钮 ---- */
.empty-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 40px;
  flex-wrap: wrap;
  justify-content: center;
}

.empty-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 22px;
  border-radius: 50px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 4px rgba(61, 52, 40, 0.06);
}

.empty-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(25, 200, 185, 0.12);
}

.empty-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(61, 52, 40, 0.06);
}

.empty-btn.primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-dark, var(--primary)));
  color: white;
  border-color: transparent;
  box-shadow: var(--shadow-bottom);
}

.empty-btn.primary:hover {
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(25, 200, 185, 0.35);
}

.empty-btn.primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(25, 200, 185, 0.2);
}

/* ---- 提示列表 ---- */
.empty-tips {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 400px;
}

.tip-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: left;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--bg);
  transition: background 0.2s ease;
}

.tip-item:hover {
  background: var(--bg-hover);
}

.tip-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(25, 200, 185, 0.08);
  color: var(--primary);
}

kbd {
  display: inline-block;
  padding: 2px 7px;
  font-size: 11px;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  color: var(--text);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 5px;
  box-shadow: 0 1px 1px rgba(61, 52, 40, 0.06);
  line-height: 1.4;
}

/* ---- 响应式 ---- */
@media (max-width: 480px) {
  .empty-state {
    padding: 40px 16px 60px;
  }

  .empty-title {
    font-size: 22px;
  }

  .empty-desc {
    font-size: 14px;
  }

  .empty-illustration svg {
    width: 96px;
    height: 96px;
  }
}
</style>
