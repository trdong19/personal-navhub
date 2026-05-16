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

    // 获取 favicon（服务端代理，无 CORS/GFW 限制）
    let iconUrl = ''
    try {
      const iconRes = await fetch(`${serverUrl}/api/favicon?url=${encodeURIComponent(url)}`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      })
      if (iconRes.ok) {
        const iconData = await iconRes.json()
        if (iconData.icon) iconUrl = iconData.icon
      }
    } catch (e) {}
    // 兜底：本地尝试
    if (!iconUrl) {
      try { iconUrl = await fetchFaviconAsBase64(url) } catch (e) {}
    }

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

// ==================== 图标获取 ====================

async function fetchFaviconAsBase64(pageUrl) {
  const { hostname, protocol } = new URL(pageUrl)
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname)
    || hostname.endsWith('.local')
    || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)

  // 获取当前标签页的 favicon URL（Chrome 已缓存）
  let favIconUrl = ''
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
      favIconUrl = tab.favIconUrl
    }
  } catch (e) {}

  // 尝试下载转 base64：标签页图标 > 站点 favicon.ico
  const urls = [favIconUrl, `${protocol}//${hostname}/favicon.ico`].filter(Boolean)
  for (const iconUrl of urls) {
    try {
      const res = await fetch(iconUrl, { mode: 'no-cors' })
      if (res.type === 'opaque') continue
      if (!res.ok) continue
      const blob = await res.blob()
      if (blob.size === 0 || blob.size > 100 * 1024) continue
      return await blobToDataUrl(blob)
    } catch (e) {}
  }

  // 兜底：DuckDuckGo 图标（服务器可访问，内网地址也能返回默认图标）
  if (!isLocal) {
    return `${protocol}//${hostname}/favicon.ico`
  }
  return `https://icons.duckduckgo.com/ip3/${hostname}.ico`
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
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
