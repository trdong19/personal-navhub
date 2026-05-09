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

async function extractUser(token: string, env: Env): Promise<string | null> {
  const raw = await env.NAV_KV.get(`token:${token}`)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    return data.username
  } catch {
    return null
  }
}

async function getUserRole(username: string, env: Env): Promise<string> {
  const raw = await env.NAV_KV.get(`user:${username}`)
  if (!raw) return 'user'
  try {
    return JSON.parse(raw).role || 'user'
  } catch {
    return 'user'
  }
}

async function isAdmin(username: string, env: Env): Promise<boolean> {
  return (await getUserRole(username, env)) === 'admin'
}

function resHash(data: string): string {
  let h = 0
  const step = Math.max(1, Math.floor(data.length / 200))
  for (let i = 0; i < data.length; i += step) {
    h = ((h << 5) - h + data.charCodeAt(i)) | 0
  }
  return `${data.length}_${h}`
}

async function getUserResourcesMeta(username: string, env: Env): Promise<Record<string, string> | undefined> {
  const list = await env.NAV_KV.list({ prefix: `res:${username}:` })
  if (list.keys.length === 0) return undefined
  const meta: Record<string, string> = {}
  for (const key of list.keys) {
    const val = await env.NAV_KV.get(key.name)
    if (val) {
      const resId = key.name.replace(`res:${username}:`, '')
      meta[resId] = resHash(val)
    }
  }
  return Object.keys(meta).length > 0 ? meta : undefined
}

async function getUserResources(username: string, env: Env, ids?: string[]): Promise<Record<string, string> | undefined> {
  if (ids && ids.length > 0) {
    const result: Record<string, string> = {}
    for (const id of ids) {
      const val = await env.NAV_KV.get(`res:${username}:${id}`)
      if (val) result[id] = val
    }
    return Object.keys(result).length > 0 ? result : undefined
  }
  const list = await env.NAV_KV.list({ prefix: `res:${username}:` })
  if (list.keys.length === 0) return undefined
  const result: Record<string, string> = {}
  for (const key of list.keys) {
    const val = await env.NAV_KV.get(key.name)
    if (val) {
      const resId = key.name.replace(`res:${username}:`, '')
      result[resId] = val
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

async function hasAnyUser(env: Env): Promise<boolean> {
  const list = await env.NAV_KV.list({ prefix: 'user:', limit: 1 })
  return list.keys.length > 0
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.NAV_KV) {
      return json({ error: 'KV 存储未配置，请在 Cloudflare Dashboard → Pages → 设置 → Functions → KV 命名空间绑定中添加 NAV_KV' }, 500)
    }
    const url = new URL(context.request.url)
    const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    const action = parts[0]
    const env = context.env

  if (action === 'register') {
    let body: { username: string; password: string }
    try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

    const { username, password } = body
    if (!username || username.length < 2 || username.length > 20) {
      return json({ error: '用户名需要2-20个字符' }, 400)
    }
    if (!password || password.length < 4) {
      return json({ error: '密码至少4个字符' }, 400)
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
      return json({ error: '用户名只能包含字母、数字、下划线或中文' }, 400)
    }

    const existing = await env.NAV_KV.get(`user:${username}`)
    if (existing) {
      return json({ error: '用户名已存在' }, 409)
    }

    const isFirst = !(await hasAnyUser(env))
    const role = isFirst ? 'admin' : 'user'
    const salt = generateSalt()
    const hash = await hashPassword(password, salt)
    await env.NAV_KV.put(`user:${username}`, JSON.stringify({ hash, salt, createdAt: Date.now(), role }))

    const initData: SyncData = {
      settings: null, links: [], categories: [], accessRecords: [],
      updatedAt: Date.now(), version: 1,
    }
    await env.NAV_KV.put(`data:${username}`, JSON.stringify(initData))

    const token = generateToken()
    await env.NAV_KV.put(`token:${token}`, JSON.stringify({ username }), { expirationTtl: 86400 * 30 })

    return json({ success: true, token, username, role })
  }

  if (action === 'login') {
    let body: { username: string; password: string; rememberMe?: boolean }
    try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

    const { username, password, rememberMe } = body
    if (!username || !password) {
      return json({ error: '请输入用户名和密码' }, 400)
    }

    const raw = await env.NAV_KV.get(`user:${username}`)
    if (!raw) {
      return json({ error: '用户名或密码错误' }, 401)
    }

    const user = JSON.parse(raw)
    const hash = await hashPassword(password, user.salt)
    if (hash !== user.hash) {
      return json({ error: '用户名或密码错误' }, 401)
    }

    const token = generateToken()
    const ttl = rememberMe ? 86400 * 30 : 86400
    await env.NAV_KV.put(`token:${token}`, JSON.stringify({ username }), { expirationTtl: ttl })

    return json({ success: true, token, username, role: user.role || 'user' })
  }

  if (action === 'sync') {
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return json({ error: '未登录' }, 401)

    const username = await extractUser(token, env)
    if (!username) return json({ error: '登录已过期' }, 401)

    let body: { data: Record<string, unknown> }
    try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

    const syncData: SyncData = {
      settings: body.data.settings as SyncData['settings'],
      links: (body.data.links as unknown[]) || [],
      categories: (body.data.categories as unknown[]) || [],
      accessRecords: (body.data.accessRecords as unknown[]) || [],
      updatedAt: Date.now(),
      version: ((body.data.version as number) || 0) + 1,
    }

    await env.NAV_KV.put(`data:${username}`, JSON.stringify(syncData))

    if (body.data.resources && typeof body.data.resources === 'object') {
      const resources = body.data.resources as Record<string, string>
      for (const [key, val] of Object.entries(resources)) {
        await env.NAV_KV.put(`res:${username}:${key}`, val)
      }
    }

    return json({ success: true, version: syncData.version, updatedAt: syncData.updatedAt })
  }

  if (action === 'upload-resource') {
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return json({ error: '未登录' }, 401)

    const username = await extractUser(token, env)
    if (!username) return json({ error: '登录已过期' }, 401)

    let body: { id: string; data: string }
    try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

    const { id, data } = body
    if (!id || !data) return json({ error: '缺少资源数据' }, 400)

    await env.NAV_KV.put(`res:${username}:${id}`, data)

    return json({ success: true, id })
  }

  if (action === 'pull') {
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return json({ error: '未登录' }, 401)

    const username = await extractUser(token, env)
    if (!username) return json({ error: '登录已过期' }, 401)

    const raw = await env.NAV_KV.get(`data:${username}`)
    if (!raw) {
      return json({ data: null, message: '暂无数据' })
    }

    const data: SyncData & { resources?: Record<string, string>; resourcesMeta?: Record<string, string> } = JSON.parse(raw)
    const resourcesMeta = await getUserResourcesMeta(username, env)
    if (resourcesMeta) {
      data.resourcesMeta = resourcesMeta
    }

    return json({ data, updatedAt: data.updatedAt, version: data.version })
  }

  if (action === 'pull-resources') {
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return json({ error: '未登录' }, 401)

    const username = await extractUser(token, env)
    if (!username) return json({ error: '登录已过期' }, 401)

    let body: { ids: string[] }
    try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return json({ resources: {} })
    }

    const resources = await getUserResources(username, env, body.ids)
    return json({ resources: resources || {} })
  }

  if (action === 'logout') {
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (token) {
      await env.NAV_KV.delete(`token:${token}`)
    }
    return json({ success: true })
  }

  if (action === 'admin') {
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return json({ error: '未登录' }, 401)

    const username = await extractUser(token, env)
    if (!username || !(await isAdmin(username, env))) {
      return json({ error: '权限不足' }, 403)
    }

    const subAction = parts[1]

    if (subAction === 'users') {
      const list = await env.NAV_KV.list({ prefix: 'user:' })
      const users = []
      for (const key of list.keys) {
        const val = await env.NAV_KV.get(key.name)
        if (val) {
          const data = JSON.parse(val)
          users.push({
            username: key.name.replace('user:', ''),
            role: data.role || 'user',
            createdAt: data.createdAt,
          })
        }
      }
      return json({ users })
    }

    if (subAction === 'add-user') {
      let body: { username: string; password: string }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { username: newUser, password: newPassword } = body
      if (!newUser || newUser.length < 2 || newUser.length > 20)
        return json({ error: '用户名需要2-20个字符' }, 400)
      if (!newPassword || newPassword.length < 4)
        return json({ error: '密码至少4个字符' }, 400)
      if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(newUser))
        return json({ error: '用户名只能包含字母、数字、下划线或中文' }, 400)
      if (await env.NAV_KV.get(`user:${newUser}`))
        return json({ error: '用户名已存在' }, 409)

      const salt = generateSalt()
      const hash = await hashPassword(newPassword, salt)
      await env.NAV_KV.put(`user:${newUser}`, JSON.stringify({ hash, salt, createdAt: Date.now(), role: 'user' }))
      await env.NAV_KV.put(`data:${newUser}`, JSON.stringify({
        settings: null, links: [], categories: [], accessRecords: [],
        updatedAt: Date.now(), version: 1,
      }))

      return json({ success: true, username: newUser })
    }

    if (subAction === 'delete-user') {
      let body: { username: string }
      try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

      const { username: targetUser } = body
      if (!targetUser) return json({ error: '缺少用户名' }, 400)
      if (targetUser === username) return json({ error: '不能删除自己' }, 400)
      if (!(await env.NAV_KV.get(`user:${targetUser}`))) return json({ error: '用户不存在' }, 404)

      await env.NAV_KV.delete(`user:${targetUser}`)
      await env.NAV_KV.delete(`data:${targetUser}`)

      const tokenList = await env.NAV_KV.list({ prefix: 'token:' })
      for (const key of tokenList.keys) {
        const val = await env.NAV_KV.get(key.name)
        if (val) {
          try {
            const data = JSON.parse(val)
            if (data.username === targetUser) await env.NAV_KV.delete(key.name)
          } catch {}
        }
      }

      const resList = await env.NAV_KV.list({ prefix: `res:${targetUser}:` })
      for (const key of resList.keys) {
        await env.NAV_KV.delete(key.name)
      }

      return json({ success: true })
    }

    if (subAction === 'toggle-registration') {
      const current = await env.NAV_KV.get('system:registration_enabled')
      const newVal = current !== 'false'
      await env.NAV_KV.put('system:registration_enabled', newVal ? 'false' : 'true')
      return json({ success: true, registrationEnabled: !newVal })
    }

    if (subAction === 'status') {
      const regRaw = await env.NAV_KV.get('system:registration_enabled')
      const registrationEnabled = regRaw !== 'false'
      const userList = await env.NAV_KV.list({ prefix: 'user:' })
      return json({ registrationEnabled, totalUsers: userList.keys.length })
    }

    return json({ error: '未知管理操作' }, 404)
  }

  if (action === 'change-password') {
    const authHeader = context.request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return json({ error: '未登录' }, 401)

    const username = await extractUser(token, env)
    if (!username) return json({ error: '登录已过期' }, 401)

    let body: { oldPassword: string; newPassword: string }
    try { body = await context.request.json() } catch { return json({ error: '无效请求' }, 400) }

    const { oldPassword, newPassword } = body
    if (!oldPassword || !newPassword) return json({ error: '请输入旧密码和新密码' }, 400)
    if (newPassword.length < 4) return json({ error: '新密码至少4个字符' }, 400)

    const raw = await env.NAV_KV.get(`user:${username}`)
    if (!raw) return json({ error: '用户不存在' }, 404)

    const user = JSON.parse(raw)
    const hash = await hashPassword(oldPassword, user.salt)
    if (hash !== user.hash) return json({ error: '旧密码错误' }, 401)

    const newSalt = generateSalt()
    const newHash = await hashPassword(newPassword, newSalt)
    await env.NAV_KV.put(`user:${username}`, JSON.stringify({ ...user, hash: newHash, salt: newSalt }))

    return json({ success: true })
  }

  return json({ error: '未知操作' }, 404)
  } catch (err: any) {
    return json({ error: `服务器内部错误: ${err.message || err}` }, 500)
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.NAV_KV) {
      return json({ error: 'KV 存储未配置，请在 Cloudflare Dashboard → Pages → 设置 → Functions → KV 命名空间绑定中添加 NAV_KV' }, 500)
    }
    const url = new URL(context.request.url)
    const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean)
    const action = parts[0]
    const env = context.env

    if (action === 'health') {
      return json({ status: 'ok', timestamp: Date.now() })
    }

    if (action === 'me') {
      const authHeader = context.request.headers.get('Authorization')
      const token = authHeader?.replace('Bearer ', '')
      if (!token) return json({ logged_in: false })

      const username = await extractUser(token, env)
      if (!username) return json({ logged_in: false })

      const role = await getUserRole(username, env)
      return json({ logged_in: true, username, role })
    }

    return json({ error: 'Not found' }, 404)
  } catch (err: any) {
    return json({ error: `服务器内部错误: ${err.message || err}` }, 500)
  }
}
