/**
 * NavHub 后端服务 - 单密码认证
 * 提供密码认证、数据同步、资源管理等 API
 */
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'server-data.json')
const DIST_DIR = path.join(__dirname, 'dist')

/** MIME 类型映射 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
}

// ==================== 数据存储 ====================

/** 单密码认证: { hash, salt } | null */
let credential = null
/** 单个活跃 token */
let activeTokens = []
/** 应用数据 */
let appData = { settings: null, links: [], categories: [], accessRecords: [], updatedAt: 0, version: 0, changeLog: [] }
/** 资源存储 (背景图、favicon 等) */
const resources = new Map()

let saveTimer = null

function loadFromDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(DATA_FILE)) return
    const raw = fs.readFileSync(DATA_FILE, 'utf-8')
    const data = JSON.parse(raw)
    // 兼容旧格式：从 users Map 迁移
    if (data.users && data.users.length > 0) {
      const first = data.users[0]
      credential = { hash: first[1].hash, salt: first[1].salt }
      // 迁移第一个用户的数据
      if (data.dataStore && data.dataStore.length > 0) {
        appData = data.dataStore[0][1]
      }
      // 迁移资源：去掉 username: 前缀
      if (data.resources) {
        const prefix = first[0] + ':'
        for (const [k, v] of data.resources) {
          resources.set(k.startsWith(prefix) ? k.substring(prefix.length) : k, v)
        }
      }
      console.log('[迁移] 已从旧格式迁移数据')
    } else {
      // 新格式
      if (data.credential) credential = data.credential
      if (data.activeTokens) activeTokens = data.activeTokens
      else if (data.activeToken) activeTokens = [data.activeToken]
      if (data.appData) { appData = data.appData; if (!appData.changeLog) appData.changeLog = [] }
      if (data.resources) for (const [k, v] of data.resources) resources.set(k, v)
    }
    console.log(`[持久化] 已加载: ${credential ? '已设密码' : '未设密码'}, ${resources.size}资源`)
  } catch (err) {
    console.error('[持久化] 加载失败:', err.message)
  }
}

function saveToDiskDebounced() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveToDisk, 2000)
}

function saveToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    const data = {
      credential,
      activeTokens,
      appData,
      resources: [...resources.entries()],
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf-8')
  } catch (err) {
    console.error('[持久化] 保存失败:', err.message)
  }
}

loadFromDisk()

// ==================== 工具函数 ====================

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_SIZE) {
        resolve({ _oversized: true })
        return
      }
      body += chunk
    })
    req.on('end', () => {
      if (size > MAX_BODY_SIZE) return
      try { resolve(JSON.parse(body)) } catch { resolve({}) }
    })
  })
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')
}

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex')
}

function isValidToken(req) {
  const auth = req.headers.authorization || ''
  const token = auth.replace('Bearer ', '')
  return token && activeTokens.includes(token)
}

function resHash(data) {
  let h = 0
  const step = Math.max(1, Math.floor(data.length / 200))
  for (let i = 0; i < data.length; i += step) {
    h = ((h << 5) - h + data.charCodeAt(i)) | 0
  }
  return `${data.length}_${h}`
}

const MAX_BODY_SIZE = 50 * 1024 * 1024

function logChange(op, type, id, data) {
  appData.version = (appData.version || 0) + 1
  appData.updatedAt = Date.now()
  if (!appData.changeLog) appData.changeLog = []
  appData.changeLog.push({ v: appData.version, op, type, id, data: data || null })
  saveToDiskDebounced()
}

// ==================== 静态文件服务 ====================

const hasDist = fs.existsSync(DIST_DIR)

function serveStatic(req, res, url) {
  let filePath = path.join(DIST_DIR, decodeURIComponent(url.pathname))
  if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html')

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath)
    const mime = MIME[ext] || 'application/octet-stream'
    const content = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' })
    res.end(content)
  } else {
    const indexPath = path.join(DIST_DIR, 'index.html')
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(content)
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  }
}

// ==================== HTTP 服务器 ====================

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
    return res.end()
  }

  const url = new URL(req.url, 'http://localhost')

  if (!url.pathname.startsWith('/api/') && url.pathname !== '/api') {
    if (hasDist) return serveStatic(req, res, url)
    res.writeHead(404)
    res.end('Not Found')
    return
  }

  const parts = url.pathname.replace('/api/', '').split('/').filter(Boolean)
  const action = parts[0]

  // ==================== GET ====================
  if (req.method === 'GET') {
    if (action === 'health') return json(res, { status: 'ok', timestamp: Date.now() })

    // 检查是否已设置密码
    if (action === 'status') {
      return json(res, { hasPassword: !!credential })
    }

    // 轻量版本检查
    if (action === 'check-version') {
      if (!isValidToken(req)) return json(res, { error: '未登录' }, 401)
      return json(res, { version: appData.version || 0, updatedAt: appData.updatedAt || 0 })
    }

    // 获取资源
    if (action === 'resource') {
      if (!isValidToken(req)) return json(res, { error: '未登录' }, 401)
      const resourceId = parts[1]
      if (!resourceId) return json(res, { error: '缺少资源ID' }, 400)
      const data = resources.get(resourceId)
      if (!data) return json(res, { error: '资源不存在' }, 404)
      return json(res, { data })
    }

    // 代理获取网站图标
    if (action === 'favicon') {
      if (!isValidToken(req)) return json(res, { error: '未登录' }, 401)
      const targetUrl = url.searchParams.get('url')
      if (!targetUrl) return json(res, { error: '缺少 url 参数' }, 400)
      try {
        const { hostname, protocol } = new URL(targetUrl)
        if (!hostname) return json(res, { icon: '' })

        const candidates = [
          `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${protocol}//${hostname}&size=64`,
          `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
        ]

        for (const iconUrl of candidates) {
          try {
            const resp = await fetch(iconUrl, { signal: AbortSignal.timeout(5000) })
            if (!resp.ok) continue
            const buf = Buffer.from(await resp.arrayBuffer())
            if (buf.length === 0 || buf.length > 100 * 1024) continue
            const ct = resp.headers.get('content-type') || ''
            const mime = ct.includes('svg') ? 'image/svg+xml' : ct.includes('png') ? 'image/png' : ct.includes('gif') ? 'image/gif' : 'image/x-icon'
            return json(res, { icon: `data:${mime};base64,${buf.toString('base64')}` })
          } catch {}
        }
        return json(res, { icon: '' })
      } catch {
        return json(res, { icon: '' })
      }
    }

    return json(res, { error: 'Not found' }, 404)
  }

  // ==================== POST ====================
  if (req.method === 'POST') {
    console.log(`[POST] ${url.pathname} → action=${action}`)
    const body = await readBody(req)
    if (body._oversized) return json(res, { error: '请求体过大' }, 413)

    // ---------- 首次设置密码 ----------
    if (action === 'setup') {
      if (credential) return json(res, { error: '密码已设置，请使用登录' }, 400)
      const { password } = body
      if (!password || password.length < 4)
        return json(res, { error: '密码至少4个字符' }, 400)
      const salt = randomHex(16)
      const hash = hashPassword(password, salt)
      credential = { hash, salt }
      const token = randomHex(32)
      activeTokens.push(token)
      saveToDisk()
      console.log('[设置密码] 首次密码已设置')
      return json(res, { success: true, token })
    }

    // ---------- 登录 ----------
    if (action === 'login') {
      if (!credential) return json(res, { error: '尚未设置密码，请先设置' }, 400)
      const { password } = body
      if (!password) return json(res, { error: '请输入密码' }, 400)
      const hash = hashPassword(password, credential.salt)
      if (hash !== credential.hash) return json(res, { error: '密码错误' }, 401)
      const token = randomHex(32)
      activeTokens.push(token)
      saveToDisk()
      console.log('[登录] 成功')
      return json(res, { success: true, token })
    }

    // ---------- 登出 ----------
    if (action === 'logout') {
      const auth = req.headers.authorization || ''
      const token = auth.replace('Bearer ', '')
      activeTokens = activeTokens.filter(t => t !== token)
      saveToDiskDebounced()
      return json(res, { success: true })
    }

    // ---------- 数据同步推送 ----------
    if (action === 'sync') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const clientVersion = body.data?.version || 0

      if (clientVersion > 0 && clientVersion < appData.version) {
        return json(res, {
          error: '数据冲突，请先拉取最新数据',
          conflict: true,
          serverVersion: appData.version,
        }, 409)
      }

      if (clientVersion === 0 && appData.version > 0) {
        return json(res, {
          error: '本地数据为空，请先拉取服务器数据',
          conflict: true,
          serverVersion: appData.version,
        }, 409)
      }

      const oldChangeLog = appData.changeLog || []
      const newVersion = (appData.version || 0) + 1
      appData = {
        settings: body.data.settings,
        links: body.data.links || [],
        categories: body.data.categories || [],
        accessRecords: body.data.accessRecords || [],
        deletedWallpapers: body.data.deletedWallpapers || [],
        updatedAt: Date.now(),
        version: newVersion,
        changeLog: oldChangeLog,
      }
      // 写入 fullSync 标记，让其他设备知道需要全量拉取
      appData.changeLog.push({ v: newVersion, op: 'fullSync', type: 'sync', id: 'full', data: null })

      if (body.data.resources) {
        for (const [key, val] of Object.entries(body.data.resources)) {
          resources.set(key, val)
        }
      }

      // 清理已删除壁纸的服务器资源
      if (body.data.deletedWallpapers && Array.isArray(body.data.deletedWallpapers)) {
        for (const id of body.data.deletedWallpapers) {
          resources.delete(`wallpaper:${id}`)
        }
      }

      saveToDiskDebounced()
      return json(res, { success: true, version: appData.version, updatedAt: appData.updatedAt })
    }

    // ---------- Beacon 同步 ----------
    if (action === 'sync-beacon') {
      const beaconToken = url.searchParams.get('token')
      if (!beaconToken || !activeTokens.includes(beaconToken)) {
        res.writeHead(204)
        return res.end()
      }
      const clientVersion = body.data?.version || 0

      if (clientVersion > 0 && clientVersion < appData.version) {
        console.log('[Beacon跳过] 客户端版本落后')
        res.writeHead(204)
        return res.end()
      }

      const beaconVersion = (appData.version || 0) + 1
      appData = {
        settings: body.data.settings,
        links: body.data.links || [],
        categories: body.data.categories || [],
        accessRecords: body.data.accessRecords || [],
        deletedWallpapers: body.data.deletedWallpapers || appData.deletedWallpapers || [],
        updatedAt: Date.now(),
        version: beaconVersion,
        changeLog: appData.changeLog || [],
      }
      appData.changeLog.push({ v: beaconVersion, op: 'fullSync', type: 'sync', id: 'full', data: null })
      saveToDiskDebounced()
      console.log('[Beacon同步]')
      res.writeHead(204)
      return res.end()
    }

    // ---------- 上传资源 ----------
    if (action === 'upload-resource') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const { id, data } = body
      if (!id || !data) return json(res, { error: '缺少资源数据' }, 400)
      if (data.length > MAX_BODY_SIZE) return json(res, { error: '资源数据过大' }, 413)

      resources.set(id, data)
      saveToDiskDebounced()

      console.log(`[资源上传] ${id} (${Math.round(data.length / 1024)}KB)`)
      return json(res, { success: true, id })
    }

    // ---------- 仅拉取分类（轻量接口） ----------
    if (action === 'categories') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)
      return json(res, { categories: appData.categories || [] })
    }

    // ---------- 添加单条链接（轻量接口） ----------
    if (action === 'add-link') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const link = body.link
      if (!link || !link.title || !link.urls?.extranet) {
        return json(res, { error: '缺少链接数据' }, 400)
      }

      // 检查重复
      const dup = appData.links.find(
        (l) => l.urls?.extranet === link.urls.extranet || l.urls?.intranet === link.urls.extranet
      )
      if (dup) return json(res, { error: '该链接已存在' }, 409)

      // 提取 data URL 图标存为资源
      if (link.iconUrl && typeof link.iconUrl === 'string' && link.iconUrl.startsWith('data:')) {
        const resId = `icon_${link.id}`
        resources.set(resId, link.iconUrl)
        link.iconUrl = `res://${resId}`
      }
      if (link.cachedIconData && typeof link.cachedIconData === 'string' && link.cachedIconData.startsWith('data:')) {
        const resId = `cachedicon_${link.id}`
        resources.set(resId, link.cachedIconData)
        link.cachedIconData = `res://${resId}`
      }

      appData.links.push(link)
      logChange('add', 'link', link.id, link)

      return json(res, { success: true, version: appData.version })
    }

    // ---------- 更新单条链接 ----------
    if (action === 'update-link') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const { id, data: updateData } = body
      if (!id || !updateData) return json(res, { error: '缺少参数' }, 400)

      const idx = appData.links.findIndex((l) => l.id === id)
      if (idx === -1) return json(res, { error: '链接不存在' }, 404)

      appData.links[idx] = { ...appData.links[idx], ...updateData }
      logChange('update', 'link', id, appData.links[idx])

      return json(res, { success: true, version: appData.version })
    }

    // ---------- 删除单条链接 ----------
    if (action === 'delete-link') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const { id } = body
      if (!id) return json(res, { error: '缺少链接ID' }, 400)

      const idx = appData.links.findIndex((l) => l.id === id)
      if (idx === -1) return json(res, { error: '链接不存在' }, 404)

      appData.links.splice(idx, 1)
      logChange('delete', 'link', id, null)

      return json(res, { success: true, version: appData.version })
    }

    // ---------- 添加分类 ----------
    if (action === 'add-category') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const category = body.category
      if (!category || !category.name) return json(res, { error: '缺少分类数据' }, 400)

      appData.categories.push(category)
      logChange('add', 'category', category.id, category)

      return json(res, { success: true, version: appData.version })
    }

    // ---------- 更新分类 ----------
    if (action === 'update-category') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const { id, data: updateData } = body
      if (!id || !updateData) return json(res, { error: '缺少参数' }, 400)

      const idx = appData.categories.findIndex((c) => c.id === id)
      if (idx === -1) return json(res, { error: '分类不存在' }, 404)

      appData.categories[idx] = { ...appData.categories[idx], ...updateData }
      logChange('update', 'category', id, appData.categories[idx])

      return json(res, { success: true, version: appData.version })
    }

    // ---------- 删除分类 ----------
    if (action === 'delete-category') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const { id } = body
      if (!id) return json(res, { error: '缺少分类ID' }, 400)

      const idx = appData.categories.findIndex((c) => c.id === id)
      if (idx === -1) return json(res, { error: '分类不存在' }, 404)

      appData.categories.splice(idx, 1)
      // 同时删除该分类下的链接
      appData.links = appData.links.filter((l) => l.category !== id)
      logChange('delete', 'category', id, null)

      return json(res, { success: true, version: appData.version })
    }

    // ---------- 增量拉取变更 ----------
    if (action === 'changes') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const since = body.since || 0
      const changeLog = appData.changeLog || []

      // 过滤 > since 的变更
      const filtered = changeLog.filter((c) => c.v > since)

      // 检测是否有全量同步标记，有则通知客户端执行完整 pull
      if (filtered.some((c) => c.op === 'fullSync')) {
        return json(res, { version: appData.version, changes: [], fullSync: true })
      }

      // 按 type+id 去重（保留最新）
      const deduped = new Map()
      for (const c of filtered) {
        deduped.set(`${c.type}:${c.id}`, c)
      }

      const changes = [...deduped.values()].map(({ v, ...rest }) => rest)

      return json(res, { version: appData.version, changes })
    }

    // ---------- 数据拉取 ----------
    if (action === 'pull') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      if (!appData.settings && appData.links.length === 0) {
        return json(res, { data: null, message: '暂无数据' })
      }

      const resourcesMeta = {}
      for (const [key, val] of resources.entries()) {
        resourcesMeta[key] = resHash(val)
      }

      const responseData = {
        ...appData,
        resourcesMeta: Object.keys(resourcesMeta).length > 0 ? resourcesMeta : undefined,
      }

      return json(res, { data: responseData, updatedAt: appData.updatedAt, version: appData.version })
    }

    // ---------- 按需拉取资源 ----------
    if (action === 'pull-resources') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)

      const ids = body.ids
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return json(res, { resources: {} })
      }

      const result = {}
      for (const id of ids) {
        const val = resources.get(id)
        if (val) result[id] = val
      }

      return json(res, { resources: result })
    }

    // ---------- 修改密码 ----------
    if (action === 'change-password') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)
      if (!credential) return json(res, { error: '未设置密码' }, 400)
      const { oldPassword, newPassword } = body
      if (!oldPassword || !newPassword) return json(res, { error: '请输入旧密码和新密码' }, 400)
      if (newPassword.length < 4) return json(res, { error: '新密码至少4个字符' }, 400)
      const hash = hashPassword(oldPassword, credential.salt)
      if (hash !== credential.hash) return json(res, { error: '旧密码错误' }, 401)
      const newSalt = randomHex(16)
      const newHash = hashPassword(newPassword, newSalt)
      credential = { hash: newHash, salt: newSalt }
      saveToDiskDebounced()
      console.log('[改密] 成功')
      return json(res, { success: true })
    }

    // ---------- 增量同步 ----------
    if (action === 'incremental') {
      if (!isValidToken(req)) return json(res, { error: '登录已过期' }, 401)
      const { op, ...data } = body

      switch (op) {
        case 'update-settings': {
          appData.settings = data.settings
          logChange('update', 'settings', 'main', data.settings)
          break
        }
        case 'batch-links': {
          const { action: batchAction, ids, data: batchData } = data
          if (batchAction === 'pin') {
            const orders = batchData?.pinnedOrders || []
            for (const link of appData.links) {
              if (ids.includes(link.id)) {
                link.pinned = true
                const po = orders.find(o => o.id === link.id)
                if (po) link.pinnedOrder = po.pinnedOrder
              }
            }
          } else if (batchAction === 'unpin') {
            for (const link of appData.links) {
              if (ids.includes(link.id)) link.pinned = false
            }
          } else if (batchAction === 'delete') {
            appData.links = appData.links.filter(l => !ids.includes(l.id))
          } else if (batchAction === 'move' && batchData) {
            for (const link of appData.links) {
              if (ids.includes(link.id)) {
                link.category = batchData.categoryId
                const lo = batchData.linkOrders?.find(o => o.id === link.id)
                if (lo) link.order = lo.order
              }
            }
          }
          logChange('batch-links', 'link', batchAction, { ids, data: batchData })
          break
        }
        case 'reorder-links': {
          const orders = data.orders || []
          for (const { id, order } of orders) {
            const link = appData.links.find(l => l.id === id)
            if (link) link.order = order
          }
          logChange('reorder-links', 'link', 'reorder', orders)
          break
        }
        case 'reorder-pinned': {
          const orders = data.orders || []
          for (const { id, pinnedOrder } of orders) {
            const link = appData.links.find(l => l.id === id)
            if (link) link.pinnedOrder = pinnedOrder
          }
          logChange('reorder-pinned', 'link', 'reorder-pinned', orders)
          break
        }
        case 'reorder-categories': {
          const orders = data.orders || []
          for (const { id, order } of orders) {
            const cat = appData.categories.find(c => c.id === id)
            if (cat) cat.order = order
          }
          logChange('reorder-categories', 'category', 'reorder', orders)
          break
        }
        case 'record-access': {
          const link = appData.links.find(l => l.id === data.id)
          if (link) {
            link.accessCount = (link.accessCount || 0) + 1
            link.lastAccessed = Date.now()
          }
          logChange('record-access', 'link', data.id, link ? { accessCount: link.accessCount, lastAccessed: link.lastAccessed } : null)
          break
        }
        case 'batch-categories': {
          const { action: catAction, ids } = data
          if (catAction === 'toggle') {
            for (const cat of appData.categories) {
              if (ids.includes(cat.id)) cat.collapsed = !cat.collapsed
            }
          } else if (catAction === 'expand') {
            for (const cat of appData.categories) cat.collapsed = false
          } else if (catAction === 'collapse') {
            for (const cat of appData.categories) cat.collapsed = true
          }
          logChange('batch-categories', 'category', catAction, ids)
          break
        }
        case 'push-resources': {
          const resMap = data.resources || {}
          for (const [key, val] of Object.entries(resMap)) {
            if (typeof val === 'string' && val) resources.set(key, val)
          }
          break
        }
        case 'delete-resource': {
          resources.delete(data.resourceId)
          logChange('delete-resource', 'resource', data.resourceId, null)
          break
        }
        case 'import-data': {
          appData.settings = data.settings
          appData.links = data.links || []
          appData.categories = data.categories || []
          appData.accessRecords = data.accessRecords || []
          logChange('import-data', 'sync', 'import', null)
          logChange('fullSync', 'sync', 'full', null)
          break
        }
        default:
          return json(res, { error: `未知操作: ${op}` }, 400)
      }

      saveToDiskDebounced()
      return json(res, { success: true, version: appData.version })
    }

    console.log(`[未知] method=${req.method} path=${url.pathname} action=${action}`)
    return json(res, { error: '未知操作' }, 404)
  }

  return json(res, { error: 'Method not allowed' }, 405)
})

// ==================== 启动 ====================

const PORT = parseInt(process.env.PORT || '8888', 10)
const HOST = process.env.HOST || '0.0.0.0'
server.listen(PORT, HOST, () => {
  console.log(`NavHub 服务运行在 http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
  if (hasDist) console.log('静态文件服务: dist/ 目录')
  console.log('API: /api/status, /api/setup, /api/login, /api/sync, /api/pull')
})
