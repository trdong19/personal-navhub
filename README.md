# NavHub - 个人导航中心

一个功能丰富的自托管个人导航主页，支持书签管理、分类整理、多用户同步、主题自定义等功能。

## 功能特性

- **书签管理** - 添加、编辑、删除书签，支持内网/外网双地址
- **分类系统** - 多级分类（主分类 → 子分类 → 孙分类），支持拖拽排序
- **书签导入** - 一键导入浏览器 HTML 书签文件
- **自动图标** - 自动获取并缓存网站 Favicon，跨设备同步
- **搜索功能** - 支持书签即时搜索和多搜索引擎切换（Bing / 百度 / GitHub / DuckDuckGo）
- **主题自定义** - 浅色/深色/自动模式，自定义主色、背景图、毛玻璃效果
- **卡片样式** - 自定义卡片颜色、透明度、字体颜色（支持单卡独立设置）
- **内外网切换** - 支持同时配置内网和外网地址，一键切换
- **多用户同步** - 注册登录，数据云端同步，跨设备访问
- **管理员系统** - 用户管理、注册控制、系统状态监控
- **壁纸管理** - 文件管理器，支持上传和管理背景壁纸
- **置顶与统计** - 书签置顶、访问次数统计、热门/最近访问
- **响应式设计** - 适配桌面端和移动端
- **数据导入导出** - JSON 格式一键备份和恢复

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + Composition API + TypeScript |
| 状态管理 | Pinia |
| 构建工具 | Vite |
| 图标库 | Lucide Vue |
| 后端服务 | Node.js 原生 HTTP 服务 |
| 本地存储 | localStorage + IndexedDB |
| 密码加密 | PBKDF2 (SHA-256, 100000 iterations) |

## 项目结构

```
personal-navhub/
├── server.mjs              # 后端 API 服务（认证、同步、管理员）
├── vite.config.ts          # Vite 构建配置
├── index.html              # 入口 HTML
├── package.json            # 项目依赖
├── public/                 # 静态资源
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── App.vue             # 根组件
│   ├── main.ts             # 应用入口
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppHeader.vue        # 顶部导航栏
│   │   ├── navigation/
│   │   │   ├── CategorySection.vue  # 分类区域（多级树形）
│   │   │   ├── LinkEditor.vue       # 书签编辑器弹窗
│   │   │   ├── NavCard.vue          # 书签卡片组件
│   │   │   ├── NetworkSwitcher.vue  # 内外网切换
│   │   │   ├── PinnedSection.vue    # 置顶书签区域
│   │   │   ├── SearchBar.vue        # 搜索栏
│   │   │   ├── SearchOverlay.vue    # 搜索结果覆盖层
│   │   │   └── StatsPanel.vue       # 统计面板
│   │   └── settings/
│   │       ├── FileManager.vue      # 文件管理（壁纸）
│   │       └── SettingsPanel.vue    # 设置面板
│   ├── composables/
│   │   └── useAuth.ts      # 认证与数据同步逻辑
│   ├── stores/
│   │   ├── nav.ts          # 书签/分类数据 Store
│   │   ├── network.ts      # 网络类型 Store
│   │   └── settings.ts     # 设置 Store
│   ├── styles/
│   │   └── global.css      # 全局样式与 CSS 变量
│   ├── types/
│   │   └── index.ts        # TypeScript 类型定义
│   └── utils/
│       ├── defaults.ts     # 默认设置
│       ├── fileStore.ts    # IndexedDB 文件存储
│       ├── helpers.ts      # 通用工具函数
│       └── storage.ts      # localStorage 封装
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 启动后端服务

```bash
node server.mjs
```

后端默认运行在 `http://localhost:3456`，默认管理员账号：

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin  | admin123 | 管理员 |

> **重要**：首次部署后请立即修改管理员密码！

### 启动前端开发服务

```bash
npm run dev
```

前端默认运行在 `http://localhost:5173`，API 请求自动代理到后端 `3456` 端口。

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录，可部署到任何静态文件服务器。

## 部署指南

### 本地部署

1. 克隆项目后执行 `npm install`
2. 启动后端：`node server.mjs`
3. 启动前端开发服务器：`npm run dev`
4. 浏览器访问 `http://localhost:5173`

### 生产部署

1. 构建前端：`npm run build`
2. 将 `dist/` 目录部署到 Nginx / Caddy 等 Web 服务器
3. 配置反向代理将 `/api` 路径转发到后端 `3456` 端口
4. 启动后端：`node server.mjs`

**Nginx 参考配置：**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3456;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50m;
    }
}
```

### Cloudflare Pages 部署（推荐）

本项目内置了 Cloudflare Pages Functions 支持，数据存储在 Cloudflare KV 中，无需自建后端服务器，全球边缘节点加速。

**项目已包含的文件：**
- `wrangler.toml` — Cloudflare Pages 项目配置
- `functions/api/[...path].ts` — API 函数（认证、数据同步、资源管理）

**部署步骤：**

1. **安装 Wrangler CLI**

```bash
npm install -g wrangler
wrangler login
```

2. **创建 KV 命名空间**

```bash
wrangler kv namespace create NAV_KV
wrangler kv namespace create NAV_KV --preview
```

执行后会输出类似格式的 ID：
```
{ binding = "NAV_KV", id = "xxxxxxxxxx", preview_id = "xxxxxxxxxx" }
```

3. **更新 `wrangler.toml` 中的 KV ID**

将创建的 KV 命名空间 ID 填入配置：

```toml
[[kv_namespaces]]
binding = "NAV_KV"
id = "你的KV命名空间ID"
preview_id = "你的预览KV命名空间ID"
```

4. **构建并部署**

```bash
npm run build
wrangler pages deploy dist --project-name navhub
```

5. **首次部署后配置**

- 在 Cloudflare Dashboard → Pages → 你的项目 → Settings → Functions 中确认 KV 绑定已生效
- 绑定自定义域名（可选）：Settings → Custom domains

**Cloudflare 部署的优势：**
- 数据持久化在 Cloudflare KV，不依赖本地服务器内存
- 全球边缘节点加速，访问速度快
- 自动 HTTPS，无需配置证书
- 免费额度充足（每天 10 万次 KV 读取，1000 次 KV 写入）

## 使用说明

### 书签管理

1. 点击右下角 `+` 按钮 → **添加链接**
2. 填写标题、网址（支持内网/外网双地址）、选择分类
3. 可选：设置描述、标签、颜色、字体颜色、透明度、置顶
4. 点击保存即可

### 分类管理

1. 点击右下角 `+` 按钮 → **添加分类**
2. 在分类区域点击 `+` 可添加子分类
3. 分类支持拖拽排序
4. 分类数量自动统计子分类下的书签总数

### 书签导入

1. 打开 **设置** → **书签导入**
2. 选择浏览器导出的 HTML 书签文件
3. 选择目标分类或按原始分类导入
4. 确认导入

### 主题自定义

- **设置** → **外观** 中可调整：
  - 主题模式（浅色 / 深色 / 跟随系统）
  - 主色调、背景色、背景图
  - 毛玻璃效果、背景遮罩透明度
  - 搜索框颜色与透明度
  - 书签卡片颜色与透明度
  - 字体颜色

### 数据同步

1. 注册账号或登录
2. 数据自动同步到服务器
3. 在其他设备登录同一账号即可获取数据

### 管理员功能

- 使用管理员账号登录后可在设置中管理用户
- 控制注册开关、添加/删除用户、查看系统状态

## 注意事项

- 后端数据存储在内存中，服务器重启后数据会丢失。生产环境建议替换为数据库
- Favicon 通过 Google Favicon API 获取，首次访问会自动缓存
- 默认管理员密码 `admin123`，请务必修改
- 壁纸和背景图存储在浏览器 IndexedDB 中，同步时会自动上传到服务器

## 许可证

MIT License
