# 家族树管理工具

一个用于记录和管理家族（小说 / 真实家谱均可）人物关系的本地 Web 工具。支持多「篇章」（即多套独立数据库，可在它们之间切换），每个篇章下管理家族、角色、婚姻、亲子关系、其他羁绊（师徒、义兄弟等）、往事录与标签。

## 功能特性

- 多篇章管理：每个篇章对应一个独立的 SQLite 数据库文件，可自由切换
- 家族 / 角色 / 婚姻 / 亲子关系 / 羁绊的完整增删改查
- 角色视角的家族树：以任一角色为中心自动汇总祖辈、同辈、晚辈、姻亲、堂亲等关系
- 往事录（按角色 + 分类 + 标签筛选），分类与标签均可自定义
- 单文件 JSON 备份 / 恢复（含元数据，可追溯导出时间与所属章节）

## 两种运行模式

本项目既支持 **GitHub Pages（推荐）** 也支持 **本地 Node.js**，两种模式**用同一套代码**，只是数据存储位置不同。

| 模式 | 数据存在哪 | 适用场景 |
| --- | --- | --- |
| **GitHub Pages 模式**（默认） | 浏览器 IndexedDB + localStorage | 个人使用，访问 `https://<user>.github.io/<repo>/` 即可 |
| **本地 Node.js 模式** | 服务器文件系统 | 离线使用 / 不愿意把数据放浏览器时 |

## 部署到 GitHub Pages（推荐，零配置）

> 整个 `public/` 目录就是网站。**没有后端**，GitHub Pages 直接托管即可。

### 一次性设置

1. 在 GitHub 网页上新建一个空仓库（不要勾选 README/.gitignore/license），记下仓库地址
2. 本地：
   ```bash
   cd E:\test\family
   git init        # 已经在做的话跳过
   git add .
   git commit -m "feat: 浏览器版家族树管理工具"
   git branch -M main
   git remote add origin git@github.com:<your-name>/<repo>.git
   git push -u origin main
   ```
3. 在 GitHub 仓库页 → **Settings → Pages**：
   - Source: **Deploy from a branch**
   - Branch: `main`，Folder: **`/public`**
   - Save
4. 等待 1-2 分钟，访问 `https://<your-name>.github.io/<repo>/` 即可看到应用

### 首次使用

打开页面后，应用会自动创建一个默认篇章（名为「默认篇章」）。所有数据存在浏览器的 IndexedDB 中，**只在这台电脑的浏览器里可见**。

> ⚠️ 如果你想换浏览器或电脑使用，需要先用「导出备份」保存 JSON 文件，到新环境再「导入恢复」。

## 本地 Node.js 模式（可选）

### 环境要求

- Node.js 18 及以上
- npm

### 启动

```bash
npm install
npm start
```

浏览器访问 <http://localhost:3000>。同样用浏览器 IndexedDB 存数据——server.js 现在只是个静态文件服务器，没有 REST 接口。

### 自定义配置（可选）

`config.example.json` 复制为 `config.json` 后修改。Node.js 模式下，server.js 会读取 `config.json` 中的 `eraName` 显示在界面顶部。

## 数据存储

| 类型 | 位置（GitHub Pages） | 位置（Node.js） | 是否入 Git |
| --- | --- | --- | --- |
| 每个篇章的 SQLite 数据 | IndexedDB `chapter:<id>` 键 | 不使用 | ❌ |
| 篇章列表、激活 ID、eraName | `localStorage` 键 `ftm:chapters` / `ftm:config` | `localStorage`（仍走浏览器） | ❌ |
| 旧配置（可忽略） | — | `config.json` / `chapters.json` / `*.db`（gitignored） | ❌ |

**GitHub Pages 模式下，所有数据只存在你自己的浏览器里**，不会上传到任何服务器；GitHub Pages 只托管静态 JS 文件。

## 导入导出

应用内「设置 → 备份与恢复」中提供：

- **导出备份**：把当前激活篇章的全部数据导出为单个 JSON 文件。文件名形如 `family-tree_<章节名>_<时间戳>.json`，文件本体携带 `format` / `version` / `chapter` 等元数据。
- **导入恢复**：选择 JSON 文件，会清空当前篇章数据并替换为文件内容。导入兼容：
  - 新版（带 `format: family-tree-manager-backup` 包裹的格式）
  - 旧版（直接平铺业务表的格式）

> ⚠️ 导入为「全量覆盖」，会清空当前篇章的家族 / 角色 / 关系 / 记事 / 标签。导入前请先导出当前数据作为兜底。

## 项目结构

```
.
├── public/                      # GitHub Pages 静态托管的目录（也是本地开发的服务根）
│   ├── index.html
│   ├── app.js                   # 前端逻辑
│   ├── database.js              # UMD：浏览器用 IndexedDB、Node.js 用 fs，sql.js 在浏览器从 CDN 加载
│   ├── db-api.js                # 浏览器端 API shim：把 fetch('/api/...') 调用映射到 db 方法
│   ├── ancestry-layout.js
│   └── style.css
├── database.js                  # 旧 Node.js-only 版本（保留以兼容老引用，server.js 仍能 require）
├── server.js                    # 本地开发用的简易静态服务器
├── config.example.json          # 配置示例（仅本地模式会用）
├── package.json
└── README.md
```

## 工作原理（简版）

- `public/database.js`（UMD）：把 sql.js（SQLite 编译成 WASM）包装成一个 `FamilyTreeDB` 类，存储层做环境判断：Node.js 用 `fs`、浏览器用 IndexedDB
- `public/db-api.js`：把 `/api/families` `/api/characters` 之类 30+ 个 REST 路径，全部映射到对应的 `FamilyTreeDB` 方法上，让 `app.js` 不需要修改
- `public/index.html`：依次加载 sql.js（CDN）→ database.js → db-api.js → app.js，无需 build 步骤

## 协作时注意

- 首次 `git clone` 后，浏览器模式无需任何配置，直接 `npm install && npm start` 或推到 GitHub Pages 即可
- 数据是**按浏览器隔离**的：在 Chrome 上导出的 JSON，要在 Safari 上导入后才能看到；想换电脑必须走导入导出
- 不要把 `*.db` / `config.json` / `chapters.json` 提交进去 —— 它们已经写在 `.gitignore` 里
- 跨浏览器 / 跨设备同步：用应用内的「导出备份」功能，把 JSON 文件发给对方

## 许可证

MIT