/**
 * NavHub 收藏助手 - 核心逻辑
 */

const $ = (id) => document.getElementById(id)
const storage = chrome.storage.local

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', async () => {
  const config = await storage.get(['serverUrl', 'authToken'])

  if (!config.serverUrl || !config.authToken) {
    showSetup()
    await autoDetect()
  } else {
    await showCollect(config.serverUrl, config.authToken)
  }

  $('save-setup').addEventListener('click', handleSaveSetup)
  $('open-settings').addEventListener('click', () => showSetup())
  $('save-link').addEventListener('click', handleSaveLink)
})

// ==================== 自动检测 ====================

async function autoDetect() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) return

    const url = new URL(tab.url)
    $('server-url').value = `${url.protocol}//${url.host}`

    try {
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'getToken' })
      if (res?.token) {
        $('auth-token').value = res.token
        showStatus('已自动获取 Token', 'success')
      }
    } catch (e) {}
  } catch (e) {}
}

// ==================== 设置面板 ====================

function showSetup() {
  $('setup-panel').classList.remove('hidden')
  $('collect-panel').classList.add('hidden')
  storage.get(['serverUrl', 'authToken']).then((config) => {
    if (config.serverUrl) $('server-url').value = config.serverUrl
    if (config.authToken) $('auth-token').value = config.authToken
  })
}

async function handleSaveSetup() {
  const url = $('server-url').value.trim().replace(/\/+$/, '')
  const token = $('auth-token').value.trim()

  if (!url) { showStatus('请输入服务器地址', 'error'); return }
  if (!token) { showStatus('请输入 Token', 'error'); return }

  const btn = $('save-setup')
  btn.disabled = true
  btn.textContent = '验证中...'

  try {
    const res = await fetch(`${url}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    })
    if (res.status === 401) { showStatus('Token 无效或已过期', 'error'); btn.disabled = false; btn.textContent = '保存连接'; return }
    if (!res.ok) { showStatus(`连接失败 (${res.status})`, 'error'); btn.disabled = false; btn.textContent = '保存连接'; return }
  } catch (e) {
    showStatus('无法连接服务器，请检查地址', 'error')
    btn.disabled = false
    btn.textContent = '保存连接'
    return
  }

  await storage.set({ serverUrl: url, authToken: token })
  showCollect(url, token)
}

// ==================== 收藏面板 ====================

async function showCollect(serverUrl, authToken) {
  $('setup-panel').classList.add('hidden')
  $('collect-panel').classList.remove('hidden')

  // 获取当前标签页信息
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab) {
      $('link-title').value = tab.title || ''
      $('link-url').value = tab.url || ''
    }
  } catch (e) {}

  // 拉取分类
  try {
    const res = await fetch(`${serverUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    })
    if (!res.ok) throw new Error('拉取失败')
    const json = await res.json()
    const categories = json.categories || []

    const select = $('link-category')
    select.innerHTML = ''
    if (categories.length === 0) {
      select.innerHTML = '<option value="" disabled>暂无分类</option>'
    } else {
      for (const cat of categories) {
        const opt = document.createElement('option')
        opt.value = cat.id
        opt.textContent = `${cat.icon || '📁'} ${cat.name}`
        select.appendChild(opt)
      }
    }
  } catch (e) {
    $('link-category').innerHTML = '<option value="" disabled>加载分类失败</option>'
  }
}

// ==================== 保存链接 ====================

async function handleSaveLink() {
  const title = $('link-title').value.trim()
  const url = $('link-url').value.trim()
  const categoryId = $('link-category').value
  const tagsStr = $('link-tags').value.trim()
  const pinned = $('link-pinned').checked

  if (!title) { showStatus('请输入名称', 'error'); return }
  if (!url) { showStatus('地址不能为空', 'error'); return }
  if (!categoryId) { showStatus('请选择分类', 'error'); return }

  const btn = $('save-link')
  btn.disabled = true
  btn.textContent = '保存中...'

  try {
    const config = await storage.get(['serverUrl', 'authToken'])
    const { serverUrl, authToken } = config

    // 生成 favicon URL
    let iconUrl = ''
    try {
      const { hostname, protocol } = new URL(url)
      const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname) || hostname.endsWith('.local') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
      iconUrl = isLocal
        ? `https://icons.duckduckgo.com/ip3/${hostname}.ico`
        : `${protocol}//${hostname}/favicon.ico`
    } catch (e) {}

    const newLink = {
      id: generateId(),
      title,
      icon: '',
      iconUrl,
      category: categoryId,
      urls: { extranet: url },
      tags: tagsStr ? tagsStr.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
      pinned,
      pinnedOrder: pinned ? 1 : 0,
      order: 0,
      accessCount: 0,
      lastAccessed: 0,
      createdAt: Date.now(),
    }

    // 一次请求添加链接
    const res = await fetch(`${serverUrl}/api/add-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ link: newLink }),
    })

    if (res.status === 409) {
      const data = await res.json().catch(() => ({}))
      showStatus(data.error || '该链接已存在', 'error')
      btn.disabled = false
      btn.textContent = '收藏'
      return
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || '保存失败')
    }

    showStatus('收藏成功！', 'success')
    btn.textContent = '已收藏'
    setTimeout(() => window.close(), 1000)
  } catch (e) {
    showStatus(e.message || '保存失败', 'error')
    btn.disabled = false
    btn.textContent = '收藏'
  }
}

// ==================== 工具函数 ====================

function showStatus(msg, type) {
  const el = $('status-msg')
  el.textContent = msg
  el.className = `status ${type}`
  el.classList.remove('hidden')
  if (type === 'success') {
    setTimeout(() => el.classList.add('hidden'), 2000)
  }
}

function generateId() {
  return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
