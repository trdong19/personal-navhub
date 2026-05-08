/**
 * NavHub 后端服务 - 纯 Node.js HTTP 服务器
 * 提供用户认证、数据同步、资源管理、管理员功能等 API
 * 监听端口: 3456
 */
import http from 'node:http'
import crypto from 'node:crypto'

// ==================== 内存数据存储 ====================
// 所有数据存储在内存中（Map），服务重启后数据会丢失
// 生产环境应替换为数据库持久化存储

/** 用户数据 Map: key=用户名, value={hash, salt, createdAt, role} */
const users = new Map()
/** Token 映射 Map: key=token字符串, value=用户名 */
const tokens = new Map()
/** 用户数据存储 Map: key=用户名, value={settings, links, categories, accessRecords, updatedAt, version} */
const dataStore = new Map()
/** 资源存储 Map: key="用户名:资源ID", value=dataUrl字符串（背景图、favicon、图标等） */
const resources = new Map()

/** 注册功能是否开启（管理员可控制） */
let registrationEnabled = false

// ==================== 初始化 ====================

/**
 * 创建默认管理员账号
 * 仅在 users 中不存在 admin 时创建
 * 默认密码: admin123
 */
function createAdminAccount() {
  const adminName = 'admin'
  if (!users.has(adminName)) {
    const salt = randomHex(16)
    const hash = hashPassword('admin123', salt)
    users.set(adminName, { hash, salt, createdAt: Date.now(), role: 'admin' })
    dataStore.set(adminName, {
      settings: null, links: [], categories: [], accessRecords: [],
      updatedAt: Date.now(), version: 1,
    })
    console.log('[初始化] 已创建管理员账号: admin / admin123')
  }
}

/**
 * 判断用户是否为管理员
 * @param {string} username - 用户名
 * @returns {boolean}
 */
function isAdmin(username) {
  const user = users.get(username)
  return user && user.role === 'admin'
}

// ==================== 工具函数 ====================

/**
 * 发送 JSON 响应（带 CORS 头）
 * @param {http.ServerResponse} res - 响应对象
 * @param {object} data - 要返回的 JSON 数据
 * @param {number} status - HTTP 状态码，默认 200
 */
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

/**
 * 读取请求体并解析为 JSON
 * 超过 MAX_BODY_SIZE 时返回 {_oversized: true}
 * @param {http.IncomingMessage} req - 请求对象
 * @returns {Promise<object>} 解析后的 JSON 对象
 */
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

/**
 * PBKDF2 密码哈希（10万次迭代，SHA-256）
 * @param {string} password - 明文密码
 * @param {string} salt - 盐值（hex字符串）
 * @returns {string} 哈希后的密码（hex字符串）
 */
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')
}

/**
 * 生成随机十六进制字符串
 * @param {number} bytes - 随机字节数
 * @returns {string} hex 字符串
 */
function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex')
}

/**
 * 从请求头的 Authorization 中提取 token，并查找对应的用户名
 * @param {http.IncomingMessage} req - 请求对象
 * @returns {string|null} 用户名或 null
 */
function getTokenUser(req) {
  const auth = req.headers.authorization || ''
  const token = auth.replace('Bearer ', '')
  if (!token) return null
  return tokens.get(token) || null
}

/**
 * 生成资源存储的 key，格式为 "用户名:资源ID"
 * @param {string} username - 用户名
 * @param {string} resourceId - 资源ID
 * @returns {string}
 */
function getResourceKey(username, resourceId) {
  return `${username}:${resourceId}`
}

/** 请求体最大限制: 50MB */
const MAX_BODY_SIZE = 50 * 1024 * 1024

// ==================== HTTP 服务器主逻辑 ====================

const server = http.createServer(async (req, res) => {
  // CORS 预检请求处理
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
    return res.end()
  }

  // 解析 URL，提取 API 路径段
  const url = new URL(req.url, 'http://localhost')
  const parts = url.pathname.replace('/api/', '').split('/').filter(Boolean)
  const action = parts[0]

  // ==================== GET 请求处理 ====================
  if (req.method === 'GET') {
    // 健康检查接口
    if (action === 'health') return json(res, { status: 'ok', timestamp: Date.now() })

    // 获取当前登录用户信息
    if (action === 'me') {
      const username = getTokenUser(req)
      if (!username) return json(res, { logged_in: false })
      const user = users.get(username)
      const role = user?.role || 'user'
      return json(res, { logged_in: true, username, role })
    }

    // 获取指定资源（背景图、favicon 等）
    if (action === 'resource') {
      const username = getTokenUser(req)
      if (!username) return json(res, { error: '未登录' }, 401)
      const resourceId = parts[1]
      if (!resourceId) return json(res, { error: '缺少资源ID' }, 400)
      const data = resources.get(getResourceKey(username, resourceId))
      if (!data) return json(res, { error: '资源不存在' }, 404)
      return json(res, { data })
    }

    return json(res, { error: 'Not found' }, 404)
  }

  // ==================== POST 请求处理 ====================
  if (req.method === 'POST') {
    const body = await readBody(req)
    if (body._oversized) return json(res, { error: '请求体过大' }, 413)

    // ---------- 用户注册 ----------
    if (action === 'register') {
      if (!registrationEnabled) {
        return json(res, { error: '注册已关闭，请联系管理员开通账号' }, 403)
      }
      const { username, password } = body
      if (!username || username.length < 2 || username.length > 20)
        return json(res, { error: '用户名需要2-20个字符' }, 400)
      if (!password || password.length < 4)
        return json(res, { error: '密码至少4个字符' }, 400)
      if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username))
        return json(res, { error: '用户名只能包含字母、数字、下划线或中文' }, 400)
      if (users.has(username))
        return json(res, { error: '用户名已存在' }, 409)

      const salt = randomHex(16)
      const hash = hashPassword(password, salt)
      users.set(username, { hash, salt, createdAt: Date.now(), role: 'user' })
      dataStore.set(username, {
        settings: null, links: [], categories: [], accessRecords: [],
        updatedAt: Date.now(), version: 1,
      })

      const token = randomHex(32)
      tokens.set(token, username)

      console.log(`[注册] ${username}`)
      return json(res, { success: true, token, username })
    }

    // ---------- 用户登录 ----------
    if (action === 'login') {
      const { username, password, rememberMe } = body
      if (!username || !password)
        return json(res, { error: '请输入用户名和密码' }, 400)

      const user = users.get(username)
      if (!user)
        return json(res, { error: '用户名或密码错误' }, 401)

      const hash = hashPassword(password, user.salt)
      if (hash !== user.hash)
        return json(res, { error: '用户名或密码错误' }, 401)

      const token = randomHex(32)
      tokens.set(token, username)

      console.log(`[登录] ${username} rememberMe=${rememberMe}`)
      return json(res, { success: true, token, username, role: user.role || 'user' })
    }

    // ---------- 数据同步推送（push）----------
    // 前端将本地所有数据（设置、书签、分类、资源）打包上传
    if (action === 'sync') {
      const username = getTokenUser(req)
      if (!username) return json(res, { error: '登录已过期' }, 401)

      const syncData = {
        settings: body.data.settings,
        links: body.data.links || [],
        categories: body.data.categories || [],
        accessRecords: body.data.accessRecords || [],
        updatedAt: Date.now(),
        version: (body.data?.version || 0) + 1,
      }

      // 保存资源数据（背景图 dataUrl、favicon dataUrl、图标 dataUrl 等）
      if (body.data.resources) {
        for (const [key, val] of Object.entries(body.data.resources)) {
          resources.set(getResourceKey(username, key), val)
        }
      }

      dataStore.set(username, syncData)

      console.log(`[同步推送] ${username}`)
      return json(res, { success: true, version: syncData.version, updatedAt: syncData.updatedAt })
    }

    // ---------- 单独上传资源 ----------
    if (action === 'upload-resource') {
      const username = getTokenUser(req)
      if (!username) return json(res, { error: '登录已过期' }, 401)

      const { id, data } = body
      if (!id || !data) return json(res, { error: '缺少资源数据' }, 400)
      if (data.length > MAX_BODY_SIZE) return json(res, { error: '资源数据过大' }, 413)

      resources.set(getResourceKey(username, id), data)

      console.log(`[资源上传] ${username} ${id} (${Math.round(data.length / 1024)}KB)`)
      return json(res, { success: true, id })
    }

    // ---------- 数据拉取（pull）----------
    // 前端从服务器下载全部数据（设置、书签、分类 + 资源）
    if (action === 'pull') {
      const username = getTokenUser(req)
      if (!username) return json(res, { error: '登录已过期' }, 401)

      const data = dataStore.get(username)
      if (!data) return json(res, { data: null, message: '暂无数据' })

      // 收集该用户的所有资源
      const userResources = {}
      for (const [key, val] of resources.entries()) {
        if (key.startsWith(username + ':')) {
          const resId = key.substring(username.length + 1)
          userResources[resId] = val
        }
      }

      const responseData = {
        ...data,
        resources: Object.keys(userResources).length > 0 ? userResources : undefined,
      }

      console.log(`[数据拉取] ${username}`)
      return json(res, { data: responseData, updatedAt: data.updatedAt, version: data.version })
    }

    // ---------- 用户登出 ----------
    if (action === 'logout') {
      const auth = req.headers.authorization || ''
      const token = auth.replace('Bearer ', '')
      if (token) tokens.delete(token)
      return json(res, { success: true })
    }

    // ---------- 管理员功能 ----------
    if (action === 'admin') {
      const username = getTokenUser(req)
      if (!username || !isAdmin(username)) {
        return json(res, { error: '权限不足' }, 403)
      }

      const subAction = parts[1]

      // 获取所有用户列表
      if (subAction === 'users') {
        const userList = Array.from(users.entries()).map(([name, data]) => ({
          username: name,
          role: data.role || 'user',
          createdAt: data.createdAt,
        }))
        return json(res, { users: userList })
      }

      // 管理员手动添加用户
      if (subAction === 'add-user') {
        const { username: newUser, password: newPassword } = body
        if (!newUser || newUser.length < 2 || newUser.length > 20)
          return json(res, { error: '用户名需要2-20个字符' }, 400)
        if (!newPassword || newPassword.length < 4)
          return json(res, { error: '密码至少4个字符' }, 400)
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(newUser))
          return json(res, { error: '用户名只能包含字母、数字、下划线或中文' }, 400)
        if (users.has(newUser))
          return json(res, { error: '用户名已存在' }, 409)

        const salt = randomHex(16)
        const hash = hashPassword(newPassword, salt)
        users.set(newUser, { hash, salt, createdAt: Date.now(), role: 'user' })
        dataStore.set(newUser, {
          settings: null, links: [], categories: [], accessRecords: [],
          updatedAt: Date.now(), version: 1,
        })

        console.log(`[管理员添加用户] ${username} -> ${newUser}`)
        return json(res, { success: true, username: newUser })
      }

      // 管理员删除用户（同时清理 token 和资源）
      if (subAction === 'delete-user') {
        const { username: targetUser } = body
        if (!targetUser) return json(res, { error: '缺少用户名' }, 400)
        if (targetUser === username) return json(res, { error: '不能删除自己' }, 400)
        if (!users.has(targetUser)) return json(res, { error: '用户不存在' }, 404)

        users.delete(targetUser)
        dataStore.delete(targetUser)
        // 清理该用户的所有 token
        for (const [token, uname] of tokens.entries()) {
          if (uname === targetUser) tokens.delete(token)
        }
        // 清理该用户的所有资源
        for (const key of resources.keys()) {
          if (key.startsWith(targetUser + ':')) resources.delete(key)
        }

        console.log(`[管理员删除用户] ${username} -> ${targetUser}`)
        return json(res, { success: true })
      }

      // 切换注册功能开关
      if (subAction === 'toggle-registration') {
        registrationEnabled = !registrationEnabled
        console.log(`[管理员] 注册功能: ${registrationEnabled ? '开启' : '关闭'}`)
        return json(res, { success: true, registrationEnabled })
      }

      // 获取系统状态（注册开关、用户总数）
      if (subAction === 'status') {
        return json(res, {
          registrationEnabled,
          totalUsers: users.size,
        })
      }

      return json(res, { error: '未知管理操作' }, 404)
    }

    // ---------- 修改密码 ----------
    if (action === 'change-password') {
      const username = getTokenUser(req)
      if (!username) return json(res, { error: '登录已过期' }, 401)
      const { oldPassword, newPassword } = body
      if (!oldPassword || !newPassword) return json(res, { error: '请输入旧密码和新密码' }, 400)
      if (newPassword.length < 4) return json(res, { error: '新密码至少4个字符' }, 400)
      const user = users.get(username)
      if (!user) return json(res, { error: '用户不存在' }, 404)
      const hash = hashPassword(oldPassword, user.salt)
      if (hash !== user.hash) return json(res, { error: '旧密码错误' }, 401)
      // 生成新的盐值和哈希
      const newSalt = randomHex(16)
      const newHash = hashPassword(newPassword, newSalt)
      users.set(username, { ...user, hash: newHash, salt: newSalt })
      console.log(`[改密] ${username}`)
      return json(res, { success: true })
    }

    return json(res, { error: '未知操作' }, 404)
  }

  return json(res, { error: 'Method not allowed' }, 405)
})

// ==================== 启动服务器 ====================

const PORT = 3456
server.listen(PORT, () => {
  createAdminAccount()
  console.log(`本地API服务运行在 http://localhost:${PORT}/api`)
  console.log('端点: POST /api/register, /api/login, /api/logout, /api/sync, /api/pull, /api/upload-resource')
  console.log('      GET  /api/me, /api/health, /api/resource/:id')
  console.log('管理员: POST /api/admin/users, /api/admin/add-user, /api/admin/delete-user, /api/admin/toggle-registration, /api/admin/status')
  console.log('默认管理员: admin / admin123')
})
