interface Env {
  NAV_KV: KVNamespace
}

interface SyncData {
  settings: unknown
  links: unknown[]
  categories: unknown[]
  accessRecords: unknown[]
  updatedAt: number
  version: number
  changeLog?: ChangeEntry[]
}

interface ChangeEntry {
  v: number
  op: string
  type: string
  id: string
  data: unknown
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  })
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function isValidToken(token: string, env: Env): Promise<boolean> {
  const stored = await env.NAV_KV.get('system:active_token')
  return stored === token
}

function getToken(req: Request): string | null {
  const auth = req.headers.get('Authorization')
  if (!auth) return null
  return auth.replace('Bearer ', '') || null
}

function resHash(data: string): string {
  let h = 0
  const step = Math.max(1, Math.floor(data.length / 200))
  for (let i = 0; i < data.length; i += step) {
    h = ((h << 5) - h + data.charCodeAt(i)) | 0
  }
  return `${data.length}_${h}`
}

function logChange(data: SyncData, op: string, type: string, id: string, entityData: unknown): void {
  data.version = (data.version || 0) + 1
  data.updatedAt = Date.now()
  if (!data.changeLog) data.changeLog = []
  data.changeLog.push({ v: data.version, op, type, id, data: entityData })
}

async function getResourcesMeta(env: Env): Promise<Record<string, string> | undefined> {
  let raw = await env.NAV_KV.get('system:res_meta')
  if (!raw) {
    // 一次性迁移：从现有资源构建元数据
    const list = await env.NAV_KV.list({ prefix: 'res:' })
    if (list.keys.length === 0) return undefined
    const meta: Record<string, string> = {}
    for (const key of list.keys) {
      const val = await env.NAV_KV.get(key.name)
      if (val) meta[key.name.replace('res:', '')] = resHash(val)
    }
    await env.NAV_KV.put('system:res_meta', JSON.stringify(meta))
    return Object.keys(meta).length > 0 ? meta : undefined
  }
  const meta = JSON.parse(raw)
  return Object.keys(meta).length > 0 ? meta : undefined
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.NAV_KV) {
      return json({ error: 'KV 存储未配置' }, 500)
    }
    const url = new URL(context.request.url)
    const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    const action = parts[0]
    const env = context.env

    // ---------- 首次设置密码 ----------
    if (action === 'setup') {
      const existing = await env.NAV_KV.get('system:credential')
      if (existing) return json({ error: '密码已设置，请使用登录' }, 400)

      let body: { password: string }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { password } = body
      if (!password || password.length < 4)
        return json({ error: '密码至少4个字符' }, 400)

      const salt = generateSalt()
      const hash = await hashPassword(password, salt)
      await env.NAV_KV.put('system:credential', JSON.stringify({ hash, salt }))

      const token = generateToken()
      await env.NAV_KV.put('system:active_token', token)

      return json({ success: true, token })
    }

    // ---------- 登录 ----------
    if (action === 'login') {
      const credRaw = await env.NAV_KV.get('system:credential')
      if (!credRaw) return json({ error: '尚未设置密码，请先设置' }, 400)

      let body: { password: string }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { password } = body
      if (!password) return json({ error: '请输入密码' }, 400)

      const cred = JSON.parse(credRaw)
      const hash = await hashPassword(password, cred.salt)
      if (hash !== cred.hash) return json({ error: '密码错误' }, 401)

      const token = generateToken()
      await env.NAV_KV.put('system:active_token', token)

      return json({ success: true, token })
    }

    // ---------- 登出 ----------
    if (action === 'logout') {
      await env.NAV_KV.delete('system:active_token')
      return json({ success: true })
    }

    // ---------- 数据同步推送 ----------
    if (action === 'sync') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { data: Record<string, unknown> }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const existingRaw = await env.NAV_KV.get('data:main')
      let version = 1
      if (existingRaw) {
        const existing = JSON.parse(existingRaw)
        const clientVersion = (body.data?.version as number) || 0

        if (clientVersion > 0 && clientVersion < existing.version) {
          return json({
            error: '数据冲突，请先拉取最新数据',
            conflict: true,
            serverVersion: existing.version,
          }, 409)
        }

        version = (existing.version || 0) + 1

        const incoming = JSON.stringify({
          s: body.data.settings,
          l: body.data.links,
          c: body.data.categories,
          r: body.data.accessRecords,
        })
        const existingCompact = JSON.stringify({
          s: existing.settings,
          l: existing.links,
          c: existing.categories,
          r: existing.accessRecords,
        })
        const noDataChange = incoming === existingCompact
        const noResChange = !body.data.resources || Object.keys(body.data.resources as object).length === 0

        if (noDataChange && noResChange) {
          return json({ success: true, version: existing.version, updatedAt: existing.updatedAt, skipped: true })
        }
      }

      const syncData: SyncData = {
        settings: body.data.settings as SyncData['settings'],
        links: (body.data.links as unknown[]) || [],
        categories: (body.data.categories as unknown[]) || [],
        accessRecords: (body.data.accessRecords as unknown[]) || [],
        updatedAt: Date.now(),
        version,
        changeLog: existingRaw ? (JSON.parse(existingRaw).changeLog || []) : [],
      }

      await env.NAV_KV.put('data:main', JSON.stringify(syncData))

      if (body.data.resources && typeof body.data.resources === 'object') {
        const resources = body.data.resources as Record<string, string>
        const metaRaw = await env.NAV_KV.get('system:res_meta')
        const meta: Record<string, string> = metaRaw ? JSON.parse(metaRaw) : {}
        for (const [key, val] of Object.entries(resources)) {
          const existingRes = await env.NAV_KV.get(`res:${key}`)
          if (existingRes !== val) {
            await env.NAV_KV.put(`res:${key}`, val)
          }
          meta[key] = resHash(val)
        }
        await env.NAV_KV.put('system:res_meta', JSON.stringify(meta))
      }

      return json({ success: true, version: syncData.version, updatedAt: syncData.updatedAt })
    }

    // ---------- 上传资源 ----------
    if (action === 'upload-resource') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { id: string; data: string }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { id, data } = body
      if (!id || !data) return json({ error: '缺少资源数据' }, 400)

      await env.NAV_KV.put(`res:${id}`, data)

      const metaRaw = await env.NAV_KV.get('system:res_meta')
      const meta: Record<string, string> = metaRaw ? JSON.parse(metaRaw) : {}
      meta[id] = resHash(data)
      await env.NAV_KV.put('system:res_meta', JSON.stringify(meta))

      return json({ success: true, id })
    }

    // ---------- 仅拉取分类（轻量接口） ----------
    if (action === 'categories') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      const raw = await env.NAV_KV.get('data:main')
      if (!raw) return json({ categories: [] })

      const data: SyncData = JSON.parse(raw)
      return json({ categories: data.categories || [] })
    }

    // ---------- 添加单条链接（轻量接口） ----------
    if (action === 'add-link') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { link: Record<string, unknown> }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const link = body.link
      if (!link || !link.title || !(link.urls as Record<string, unknown>)?.extranet) {
        return json({ error: '缺少链接数据' }, 400)
      }

      const raw = await env.NAV_KV.get('data:main')
      const data: SyncData = raw ? JSON.parse(raw) : { settings: null, links: [], categories: [], accessRecords: [], updatedAt: 0, version: 0 }

      // 检查重复
      const dup = data.links.find(
        (l: any) => l.urls?.extranet === (link.urls as any).extranet || l.urls?.intranet === (link.urls as any).extranet
      )
      if (dup) return json({ error: '该链接已存在' }, 409)

      // 提取 data URL 图标存为资源
      const newRes: Record<string, string> = {}
      if (link.iconUrl && typeof link.iconUrl === 'string' && (link.iconUrl as string).startsWith('data:')) {
        const resId = `icon_${link.id}`
        await env.NAV_KV.put(`res:${resId}`, link.iconUrl as string)
        newRes[resId] = link.iconUrl as string
        link.iconUrl = `res://${resId}`
      }
      if (link.cachedIconData && typeof link.cachedIconData === 'string' && (link.cachedIconData as string).startsWith('data:')) {
        const resId = `cachedicon_${link.id}`
        await env.NAV_KV.put(`res:${resId}`, link.cachedIconData as string)
        newRes[resId] = link.cachedIconData as string
        link.cachedIconData = `res://${resId}`
      }
      if (Object.keys(newRes).length > 0) {
        const metaRaw = await env.NAV_KV.get('system:res_meta')
        const meta: Record<string, string> = metaRaw ? JSON.parse(metaRaw) : {}
        for (const [key, val] of Object.entries(newRes)) {
          meta[key] = resHash(val)
        }
        await env.NAV_KV.put('system:res_meta', JSON.stringify(meta))
      }

      data.links.push(link as unknown as never)
      logChange(data, 'add', 'link', link.id as string, link)
      await env.NAV_KV.put('data:main', JSON.stringify(data))

      return json({ success: true, version: data.version })
    }

    // ---------- 更新单条链接 ----------
    if (action === 'update-link') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { id: string; data: Record<string, unknown> }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { id, data: updateData } = body
      if (!id || !updateData) return json({ error: '缺少参数' }, 400)

      const raw = await env.NAV_KV.get('data:main')
      if (!raw) return json({ error: '数据不存在' }, 404)
      const data: SyncData = JSON.parse(raw)

      const idx = data.links.findIndex((l: any) => l.id === id)
      if (idx === -1) return json({ error: '链接不存在' }, 404)

      data.links[idx] = { ...(data.links[idx] as any), ...updateData }
      logChange(data, 'update', 'link', id, data.links[idx])
      await env.NAV_KV.put('data:main', JSON.stringify(data))

      return json({ success: true, version: data.version })
    }

    // ---------- 删除单条链接 ----------
    if (action === 'delete-link') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { id: string }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { id } = body
      if (!id) return json({ error: '缺少链接ID' }, 400)

      const raw = await env.NAV_KV.get('data:main')
      if (!raw) return json({ error: '数据不存在' }, 404)
      const data: SyncData = JSON.parse(raw)

      const idx = data.links.findIndex((l: any) => l.id === id)
      if (idx === -1) return json({ error: '链接不存在' }, 404)

      data.links.splice(idx, 1)
      logChange(data, 'delete', 'link', id, null)
      await env.NAV_KV.put('data:main', JSON.stringify(data))

      return json({ success: true, version: data.version })
    }

    // ---------- 添加分类 ----------
    if (action === 'add-category') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { category: Record<string, unknown> }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const category = body.category
      if (!category || !category.name) return json({ error: '缺少分类数据' }, 400)

      const raw = await env.NAV_KV.get('data:main')
      const data: SyncData = raw ? JSON.parse(raw) : { settings: null, links: [], categories: [], accessRecords: [], updatedAt: 0, version: 0 }

      data.categories.push(category as unknown as never)
      logChange(data, 'add', 'category', category.id as string, category)
      await env.NAV_KV.put('data:main', JSON.stringify(data))

      return json({ success: true, version: data.version })
    }

    // ---------- 更新分类 ----------
    if (action === 'update-category') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { id: string; data: Record<string, unknown> }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { id, data: updateData } = body
      if (!id || !updateData) return json({ error: '缺少参数' }, 400)

      const raw = await env.NAV_KV.get('data:main')
      if (!raw) return json({ error: '数据不存在' }, 404)
      const data: SyncData = JSON.parse(raw)

      const idx = data.categories.findIndex((c: any) => c.id === id)
      if (idx === -1) return json({ error: '分类不存在' }, 404)

      data.categories[idx] = { ...(data.categories[idx] as any), ...updateData }
      logChange(data, 'update', 'category', id, data.categories[idx])
      await env.NAV_KV.put('data:main', JSON.stringify(data))

      return json({ success: true, version: data.version })
    }

    // ---------- 删除分类 ----------
    if (action === 'delete-category') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { id: string }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { id } = body
      if (!id) return json({ error: '缺少分类ID' }, 400)

      const raw = await env.NAV_KV.get('data:main')
      if (!raw) return json({ error: '数据不存在' }, 404)
      const data: SyncData = JSON.parse(raw)

      const idx = data.categories.findIndex((c: any) => c.id === id)
      if (idx === -1) return json({ error: '分类不存在' }, 404)

      data.categories.splice(idx, 1)
      data.links = data.links.filter((l: any) => l.category !== id)
      logChange(data, 'delete', 'category', id, null)
      await env.NAV_KV.put('data:main', JSON.stringify(data))

      return json({ success: true, version: data.version })
    }

    // ---------- 增量拉取变更 ----------
    if (action === 'changes') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { since: number }
      try { body = await context.request.json() } catch { body = { since: 0 } }

      const raw = await env.NAV_KV.get('data:main')
      if (!raw) return json({ version: 0, changes: [] })

      const data: SyncData = JSON.parse(raw)
      const since = body.since || 0
      const changeLog = data.changeLog || []

      // 过滤 > since 的变更，按 type+id 去重
      const filtered = changeLog.filter((c) => c.v > since)
      const deduped = new Map<string, ChangeEntry>()
      for (const c of filtered) {
        deduped.set(`${c.type}:${c.id}`, c)
      }

      const changes = [...deduped.values()].map(({ v, ...rest }) => rest)

      return json({ version: data.version, changes })
    }

    // ---------- 数据拉取 ----------
    if (action === 'pull') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      const raw = await env.NAV_KV.get('data:main')
      if (!raw) {
        return json({ data: null, message: '暂无数据' })
      }

      const data: SyncData & { resourcesMeta?: Record<string, string> } = JSON.parse(raw)
      const resourcesMeta = await getResourcesMeta(env)
      if (resourcesMeta) data.resourcesMeta = resourcesMeta

      return json({ data, updatedAt: data.updatedAt, version: data.version })
    }

    // ---------- 按需拉取资源 ----------
    if (action === 'pull-resources') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { ids: string[] }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
        return json({ resources: {} })
      }

      const result: Record<string, string> = {}
      for (const id of body.ids) {
        const val = await env.NAV_KV.get(`res:${id}`)
        if (val) result[id] = val
      }

      return json({ resources: result })
    }

    // ---------- 修改密码 ----------
    if (action === 'change-password') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      let body: { oldPassword: string; newPassword: string }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { oldPassword, newPassword } = body
      if (!oldPassword || !newPassword) return json({ error: '请输入旧密码和新密码' }, 400)
      if (newPassword.length < 4) return json({ error: '新密码至少4个字符' }, 400)

      const credRaw = await env.NAV_KV.get('system:credential')
      if (!credRaw) return json({ error: '未设置密码' }, 400)

      const cred = JSON.parse(credRaw)
      const hash = await hashPassword(oldPassword, cred.salt)
      if (hash !== cred.hash) return json({ error: '旧密码错误' }, 401)

      const newSalt = generateSalt()
      const newHash = await hashPassword(newPassword, newSalt)
      await env.NAV_KV.put('system:credential', JSON.stringify({ hash: newHash, salt: newSalt }))

      return json({ success: true })
    }

    // ---------- Beacon 同步 ----------
    if (action === 'sync-beacon') {
      const beaconToken = url.searchParams.get('token')
      if (!beaconToken || !(await isValidToken(beaconToken, env))) {
        return new Response(null, { status: 204, headers: corsHeaders() })
      }

      let body: { data: Record<string, unknown> }
      try { body = await context.request.json() } catch { return new Response(null, { status: 204, headers: corsHeaders() }) }

      const existingRaw = await env.NAV_KV.get('data:main')
      let version = 1
      if (existingRaw) {
        const existing = JSON.parse(existingRaw)
        const clientVersion = (body.data?.version as number) || 0
        if (clientVersion > 0 && clientVersion < existing.version) {
          return new Response(null, { status: 204, headers: corsHeaders() })
        }
        version = (existing.version || 0) + 1
      }

      const syncData: SyncData = {
        settings: body.data.settings as SyncData['settings'],
        links: (body.data.links as unknown[]) || [],
        categories: (body.data.categories as unknown[]) || [],
        accessRecords: (body.data.accessRecords as unknown[]) || [],
        updatedAt: Date.now(),
        version,
        changeLog: existingRaw ? (JSON.parse(existingRaw).changeLog || []) : [],
      }

      await env.NAV_KV.put('data:main', JSON.stringify(syncData))
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    return json({ error: '未知操作' }, 404)
  } catch (err: any) {
    return json({ error: `服务器内部错误: ${err.message || err}` }, 500)
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.NAV_KV) {
      return json({ error: 'KV 存储未配置' }, 500)
    }
    const url = new URL(context.request.url)
    const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    const action = parts[0]
    const env = context.env

    if (action === 'health') {
      return json({ status: 'ok', timestamp: Date.now() })
    }

    // 检查是否已设置密码
    if (action === 'status') {
      const cred = await env.NAV_KV.get('system:credential')
      return json({ hasPassword: !!cred })
    }

    // 版本检查
    if (action === 'check-version') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      const raw = await env.NAV_KV.get('data:main')
      if (!raw) return json({ version: 0, updatedAt: 0 })

      const data = JSON.parse(raw)
      return json({ version: data.version || 0, updatedAt: data.updatedAt || 0 })
    }

    // 代理获取网站图标
    if (action === 'favicon') {
      const token = getToken(context.request)
      if (!token || !(await isValidToken(token, env))) return json({ error: '登录已过期' }, 401)

      const targetUrl = url.searchParams.get('url')
      if (!targetUrl) return json({ error: '缺少 url 参数' }, 400)

      try {
        const { hostname, protocol } = new URL(targetUrl)
        if (!hostname) return json({ icon: '' })

        const isPrivate = ['localhost', '127.0.0.1', '::1'].includes(hostname)
          || hostname.endsWith('.local')
          || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)

        const candidates = [
          `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${protocol}//${hostname}&size=64`,
          ...(isPrivate ? [] : [
            `${protocol}//${hostname}/favicon.ico`,
            `${protocol}//${hostname}/favicon.png`,
            `${protocol}//${hostname}/favicon.svg`,
            `${protocol}//${hostname}/apple-touch-icon.png`,
          ]),
          `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
        ]

        for (const iconUrl of candidates) {
          try {
            const resp = await fetch(iconUrl, {
              signal: AbortSignal.timeout(5000),
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NavHub/1.0)' },
            })
            if (!resp.ok) continue
            const buf = await resp.arrayBuffer()
            if (buf.byteLength === 0 || buf.byteLength > 100 * 1024) continue
            const ct = resp.headers.get('content-type') || ''
            const mime = ct.includes('svg') ? 'image/svg+xml' : ct.includes('png') ? 'image/png' : ct.includes('gif') ? 'image/gif' : 'image/x-icon'
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
            return json({ icon: `data:${mime};base64,${base64}` })
          } catch {}
        }
        return json({ icon: '' })
      } catch {
        return json({ icon: '' })
      }
    }

    return json({ error: 'Not found' }, 404)
  } catch (err: any) {
    return json({ error: `服务器内部错误: ${err.message || err}` }, 500)
  }
}
