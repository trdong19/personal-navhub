/**
 * NavHub 收藏助手 - 核心逻辑
 *
 * 流程：
 * 1. 检查是否已配置服务器地址和 token
 * 2. 未配置 → 尝试从当前页面自动获取 token
 * 3. 已配置 → 获取当前标签页信息，拉取分类列表
 * 4. 用户填写后 → 拉取全量数据，插入新链接，推送回去
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
  $('open-settings').addEventListener('click', showSetup)
  $('save-link').addEventListener('click', handleSaveLink)
})

// ==================== 自动检测 ====================

async function autoDetect() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) return

    const url = new URL(tab.url)
    const origin = `${url.protocol}//${url.host}`

    // 自动填入当前站点地址
    $('server-url').value = origin

    // 尝试从页面获取 token
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { action: 'getToken' })
      if (res?.token) {
        $('auth-token').value = res.token
        showStatus('已自动获取 Token', 'success')
      }
    } catch (e) {
      // 页面没有注入 content script（如 chrome:// 页面）
    }
  } catch (e) {
    // 无法访问当前标签页
  }
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

  // 验证连接
  const btn = $('save-setup')
  btn.disabled = true
  btn.textContent = '验证中...'

  try {
    const res = await fetch(`${url}/api/pull`, {
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
  } catch (e) {
    // fallback
  }

  // 拉取分类
  try {
    const res = await fetch(`${serverUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    })
    if (!res.ok) throw new Error('拉取失败')
    const json = await res.json()
    const categories = json.data?.categories || []

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

    // 拉取当前数据
    const pullRes = await fetch(`${serverUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
    })
    if (!pullRes.ok) throw new Error('拉取数据失败')
    const pullData = await pullRes.json()

    const existingLinks = pullData.data?.links || []
    const existingCategories = pullData.data?.categories || []
    const settings = pullData.data?.settings || null
    const accessRecords = pullData.data?.accessRecords || []
    const version = pullData.version || 0

    // 检查是否重复
    const duplicate = existingLinks.find(
      (l) => l.urls?.extranet === url || l.urls?.intranet === url
    )
    if (duplicate) {
      showStatus('该链接已存在', 'error')
      btn.disabled = false
      btn.textContent = '收藏'
      return
    }

    // 生成新链接
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
      pinnedOrder: pinned ? existingLinks.filter((l) => l.pinned).length + 1 : 0,
      order: existingLinks.filter((l) => l.category === categoryId).length,
      accessCount: 0,
      lastAccessed: 0,
      createdAt: Date.now(),
    }

    // 推送（支持 409 冲突重试）
    let currentVersion = version
    for (let attempt = 0; attempt < 2; attempt++) {
      const syncRes = await fetch(`${serverUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          data: {
            settings,
            links: [...existingLinks, newLink],
            categories: existingCategories,
            accessRecords,
            updatedAt: Date.now(),
            version: currentVersion,
          },
        }),
      })

      if (syncRes.ok) break

      if (syncRes.status === 409) {
        // 版本冲突，重新拉取后重试
        const rePull = await fetch(`${serverUrl}/api/pull`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
        })
        if (!rePull.ok) throw new Error('重新拉取数据失败')
        const reData = await rePull.json()
        existingLinks.length = 0
        existingLinks.push(...(reData.data?.links || []))
        existingCategories.length = 0
        existingCategories.push(...(reData.data?.categories || []))
        currentVersion = reData.version || 0
        // 再次检查重复
        if (existingLinks.find((l) => l.urls?.extranet === url || l.urls?.intranet === url)) {
          showStatus('该链接已存在', 'error')
          btn.disabled = false
          btn.textContent = '收藏'
          return
        }
        continue
      }

      const err = await syncRes.json().catch(() => ({}))
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
