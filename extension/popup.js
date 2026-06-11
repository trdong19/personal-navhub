/**
 * NavHub 收藏助手 - 核心逻辑
 */

const $ = (id) => document.getElementById(id)
const storage = chrome.storage.local
let currentIconUrl = ''

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

  // 获取当前标签页信息，自动识别地址类型
  let currentTab = null
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    currentTab = tab
    if (tab) {
      $('link-title').value = tab.title || ''
      const url = tab.url || ''
      if (/^(https?:\/\/)?10\.8/i.test(url)) {
        $('link-tunnel').value = url
      } else if (/^(https?:\/\/)?(192\.168\.|10\.\d|172\.(1[6-9]|2\d|3[01])\.|127\.0\.|localhost|.*\.local|.*\.lan)/i.test(url)) {
        $('link-intranet').value = url
      } else {
        $('link-url').value = url
      }
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

  // 获取当前页面图标
  loadFavicon(currentTab, serverUrl, authToken)
}

// ==================== 图标获取 ====================

async function loadFavicon(tab, serverUrl, authToken) {
  const previewImg = $('icon-preview-img')
  const previewStatus = $('icon-preview-status')
  previewStatus.textContent = '获取中...'
  previewStatus.className = 'icon-status'

  let iconUrl = ''

  // 先通过 content script 在页面上下文获取（内网也能访问）
  if (tab?.id) {
    try {
      // 确保 content script 已注入
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      })
      const res = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { action: 'getFavicon' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('超时')), 5000)),
      ])
      if (res?.dataUrl) iconUrl = res.dataUrl
    } catch (e) {}
  }

  // 回退：服务器代理
  if (!iconUrl) {
    const url = tab?.url || ''
    if (url) {
      try {
        const iconRes = await fetch(`${serverUrl}/api/favicon?url=${encodeURIComponent(url)}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        })
        if (iconRes.ok) {
          const iconData = await iconRes.json()
          if (iconData.icon) iconUrl = iconData.icon
        }
      } catch (e) {}
    }
  }

  if (iconUrl) {
    previewImg.src = iconUrl
    previewStatus.textContent = '已获取 ✓'
    previewStatus.className = 'icon-status ok'
  } else {
    previewImg.src = ''
    previewStatus.textContent = '未获取到图标'
    previewStatus.className = 'icon-status fail'
  }
  currentIconUrl = iconUrl
}

// ==================== 保存链接 ====================

async function handleSaveLink() {
  const title = $('link-title').value.trim()
  const extranetUrl = $('link-url').value.trim()
  const intranetUrl = $('link-intranet').value.trim()
  const tunnelUrl = $('link-tunnel').value.trim()
  const categoryId = $('link-category').value
  const tagsStr = $('link-tags').value.trim()
  const pinned = $('link-pinned').checked

  if (!title) { showStatus('请输入名称', 'error'); return }
  if (!extranetUrl && !intranetUrl && !tunnelUrl) { showStatus('至少填写一个地址', 'error'); return }
  if (!categoryId) { showStatus('请选择分类', 'error'); return }

  const urls = {}
  if (extranetUrl) urls.extranet = extranetUrl
  if (intranetUrl) urls.intranet = intranetUrl
  if (tunnelUrl) urls.tunnel = tunnelUrl

  const btn = $('save-link')
  btn.disabled = true
  btn.textContent = '保存中...'

  try {
    const config = await storage.get(['serverUrl', 'authToken'])
    const { serverUrl, authToken } = config

    // 使用已获取的图标，没有则再获取一次
    let iconUrl = currentIconUrl
    if (!iconUrl) {
      const fallbackUrl = extranetUrl || intranetUrl || tunnelUrl
      try {
        const iconRes = await fetch(`${serverUrl}/api/favicon?url=${encodeURIComponent(fallbackUrl)}`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        })
        if (iconRes.ok) {
          const iconData = await iconRes.json()
          if (iconData.icon) iconUrl = iconData.icon
        }
      } catch (e) {}
    }

    // 拉取已有书签，检查名称是否重复
    let existingLink = null
    try {
      const pullRes = await fetch(`${serverUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      })
      if (pullRes.ok) {
        const pullData = await pullRes.json()
        const links = pullData.data?.links || []
        existingLink = links.find(l => l.title === title)
      }
    } catch (e) {}

    // 名称已存在 → 尝试补充地址
    if (existingLink) {
      const patch = {}
      if (extranetUrl && !existingLink.urls?.extranet) patch.extranet = extranetUrl
      if (intranetUrl && !existingLink.urls?.intranet) patch.intranet = intranetUrl
      if (tunnelUrl && !existingLink.urls?.tunnel) patch.tunnel = tunnelUrl

      const hasNewUrl = Object.keys(patch).length > 0
      if (!hasNewUrl) {
        showStatus('已经保存有了', 'success')
        btn.disabled = false
        btn.textContent = '收藏'
        setTimeout(() => window.close(), 1200)
        return
      }

      // 补充地址到已有书签
      const updatedUrls = { ...existingLink.urls, ...patch }
      const res = await fetch(`${serverUrl}/api/update-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ id: existingLink.id, data: { urls: updatedUrls } }),
      })
      if (res.ok) {
        const added = Object.keys(patch).map(k => k === 'extranet' ? '外网' : k === 'intranet' ? '内网' : '隧道').join('、')
        showStatus(`已补充${added}地址`, 'success')
      } else {
        showStatus('更新地址失败', 'error')
      }
      btn.disabled = false
      btn.textContent = '收藏'
      setTimeout(() => window.close(), 1200)
      return
    }

    // 新书签 → 正常添加
    const newLink = {
      id: generateId(),
      title,
      icon: '',
      iconUrl,
      category: categoryId,
      urls,
      tags: tagsStr ? tagsStr.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
      pinned,
      pinnedOrder: pinned ? 1 : 0,
      order: 0,
      accessCount: 0,
      lastAccessed: 0,
      createdAt: Date.now(),
    }

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
