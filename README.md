# NavHub

个人导航主页 — 书签管理、分类整理、主题自定义、多用户同步。

## 功能

**书签管理**
- 添加、编辑、删除书签，支持内网 / 外网 / 隧道三地址
- 多级分类（主分类 → 子分类 → 孙分类），支持拖拽排序
- FLIP 动画：拖拽时周围卡片自动让位回填
- 一键导入浏览器 HTML 书签文件
- 自动获取并缓存网站 Favicon
- 置顶、访问统计、热门 / 最近访问
- 批量选择、批量移动、删除撤回

**搜索**
- 书签即时搜索（支持拼音）
- 多搜索引擎切换（Bing / 百度 / GitHub / DuckDuckGo / 自定义）

**主题**
- 浅色 / 深色 / 跟随系统
- 自定义主色、圆角、背景图、背景色
- 毛玻璃、背景模糊、遮罩透明度
- 搜索框 / 书签卡片 / 全局字体颜色与透明度独立调整

**布局**
- 单列 / 双列分类布局
- 卡片尺寸（小 / 中 / 大）
- 分类白框开关、书签描述显示开关
- 右下角工具栏：可拖拽排序、隐藏 / 显示按钮

**多用户**
- 注册登录，数据自动同步到服务器
- 版本冲突检测，多设备同时编辑不丢失
- 管理员面板：用户管理、注册控制、系统状态

**内网 / 外网**
- 每个书签支持内网、外网、隧道三个地址
- 一键切换网络模式，按地址类型筛选显示

**其他**
- 壁纸管理器（上传 / 删除 / 设为背景）
- 数据导入导出（JSON）
- 响应式设计，适配桌面和移动端

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Pinia |
| 构建 | Vite |
| 动画 | animejs (WAAPI) |
| 后端 | Node.js 原生 HTTP |
| 存储 | localStorage + IndexedDB + JSON 文件 |
| 加密 | PBKDF2 (SHA-256, 100000 iterations) |
| 部署 | Docker / Cloudflare Pages / 本地 |

## 快速开始

```bash
npm install
npm run server   # 启动后端 http://localhost:8888
npm run dev      # 启动前端 http://localhost:5173
```

## 部署

### Docker（推荐）

```bash
docker compose up -d
```

访问 `http://localhost:8888`，**第一个注册的用户自动成为管理员**。

数据持久化在 `./data` 目录。

### 本地生产部署

```bash
npm install
npm run build
PORT=8888 node server.mjs
```

访问 `http://localhost:8888`，**第一个注册的用户自动成为管理员**。

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50m;
    }
}
```

### Cloudflare Pages

项目内置 Cloudflare Pages Functions，数据存储在 KV 中，无需自建服务器。

1. Fork 本仓库
2. 在 Cloudflare Dashboard 创建 Pages 项目，关联你的仓库
3. 构建命令：`npm run build`，输出目录：`dist`
4. 创建 KV 命名空间 `NAV_KV`，绑定到 Pages 项目
5. 重新部署，访问你的 `*.pages.dev` 域名注册管理员账号

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8888` | 服务端口 |
| `HOST` | `0.0.0.0` | 监听地址 |

## 项目结构

```
├── server.mjs              # 后端 API + 静态文件服务
├── functions/api/          # Cloudflare Pages Functions
├── src/
│   ├── App.vue             # 根组件
│   ├── components/
│   │   ├── layout/         # AppHeader
│   │   ├── navigation/     # NavCard, CategorySection, SearchBar 等
│   │   ├── settings/       # SettingsPanel, FileManager
│   │   └── common/         # Toast, ConfirmDialog, ContextMenu
│   ├── composables/        # useAuth, useAnimation, useFlipSort
│   ├── stores/             # nav, settings, network (Pinia)
│   ├── styles/             # global.css
│   ├── types/              # TypeScript 类型
│   └── utils/              # defaults, fileStore, helpers, storage
├── Dockerfile
├── docker-compose.yml
└── wrangler.toml           # Cloudflare Pages 配置（需自行创建）
```

## License

MIT
