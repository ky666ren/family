# 家族树管理工具

一个用于记录和管理家族（小说 / 真实家谱均可）人物关系的本地 Web 工具。支持多「篇章」（即多套独立数据库，可在它们之间切换），每个篇章下管理家族、角色、婚姻、亲子关系、其他羁绊（师徒、义兄弟等）、往事录与标签。

## 功能特性

- 多篇章管理：每个篇章对应一个独立的 SQLite 数据库文件，可自由切换
- 家族 / 角色 / 婚姻 / 亲子关系 / 羁绊的完整增删改查
- 角色视角的家族树：以任一角色为中心自动汇总祖辈、同辈、晚辈、姻亲、堂亲等关系
- 往事录（按角色 + 分类 + 标签筛选），分类与标签均可自定义
- 单文件 JSON 备份 / 恢复（含元数据，可追溯导出时间与所属章节）

## 快速开始

### 环境要求

- Node.js 18 及以上
- npm

### 安装与启动

```bash
npm install
npm start
```

启动后访问 <http://localhost:3000>。也可双击根目录下的 `启动服务器.bat`。

首次启动会自动创建 `family_tree.db` 和 `config.json`，不需要任何额外配置。

### 自定义配置

可通过 `config.json` 调整：

```json
{
  "dbPath": "family_tree.db",
  "eraName": "",
  "activeChapterId": null
}
```

- `dbPath`：默认数据库路径（相对项目根目录或绝对路径均可）
- `eraName`：界面顶部的时代 / 纪年显示
- `activeChapterId`：当前激活的篇章 ID（在 UI 中切换后会自动写入）

也可以直接把 `config.example.json` 复制为 `config.json` 后修改。

## 数据存储

| 类型 | 位置 | 是否入 Git |
| --- | --- | --- |
| 默认数据库 | `family_tree.db` | ❌ |
| 篇章数据库 | `chapters/<id>.db` | ❌ |
| 章节列表 | `chapters.json` | ❌ |
| 运行时配置 | `config.json` | ❌ |

这些文件均已在 `.gitignore` 中排除，建议用 GitHub / 网盘等做异地备份，或使用应用自带的「导出备份」功能。

## 导入导出

应用内「设置 → 备份与恢复」中提供：

- **导出备份**：把当前激活篇章的全部数据导出为单个 JSON 文件。文件名形如 `family-tree_<章节名>_<时间戳>.json`，文件本体携带 `format` / `version` / `chapter` 等元数据，方便溯源。
- **导入恢复**：选择 JSON 文件，会清空当前篇章数据并替换为文件内容。导入兼容：

  - 新版（带 `format: family-tree-manager-backup` 包裹的格式）
  - 旧版（直接平铺业务表的格式）

> ⚠️ 导入为「全量覆盖」，会清空当前篇章的家族 / 角色 / 关系 / 记事 / 标签。导入前请先导出当前数据作为兜底。

### 手动备份建议

把 `family_tree.db`、`chapters/*.db`、`chapters.json` 一并复制到外部位置即可。

## 项目结构

```
.
├── server.js              # Express 入口、API 路由
├── database.js            # sql.js 封装的数据库类（含 schema / 增删改查 / 导入导出）
├── package.json
├── config.example.json    # 配置示例
├── public/                # 前端静态资源
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   └── ancestry-layout.js
├── chapters/              # 篇章数据库（运行时生成）
└── .gitignore
```

## API 概览

| 路由 | 方法 | 说明 |
| --- | --- | --- |
| `/api/chapters` | GET / POST | 列出 / 新建篇章 |
| `/api/chapters/:id/activate` | POST | 切换激活篇章 |
| `/api/chapters/:id` | DELETE | 删除篇章 |
| `/api/config` | GET / POST | 读取 / 更新全局配置 |
| `/api/families` `/api/families/:id` | GET / POST / PUT / DELETE | 家族 CRUD |
| `/api/characters` `/api/characters/:id` | GET / POST / PUT / DELETE | 角色 CRUD |
| `/api/marriages` `/api/marriages/:id` | GET / POST / DELETE | 婚姻 |
| `/api/parent-child` `/api/parent-child/:id` | GET / POST / DELETE | 亲子关系 |
| `/api/bonds` `/api/bonds/:id` | GET / POST / DELETE | 次要羁绊 |
| `/api/life-events` `/api/life-events/:id` | GET / POST / PUT / DELETE | 往事录 |
| `/api/life-event-categories` | GET / POST / PUT / DELETE | 往事录分类 |
| `/api/tags` | GET / POST / PUT / DELETE | 标签 |
| `/api/tree/:characterId` | GET | 以某角色为中心的家族树快照 |
| `/api/export` | GET | 导出当前篇章为 JSON |
| `/api/import` | POST | 从 JSON 恢复当前篇章 |

## 部署到 GitHub

本项目**不包含任何用户数据**，可以直接推送到 GitHub。典型步骤：

```bash
git init
git add .
git commit -m "feat: 初始化家族树管理工具"
git branch -M main
git remote add origin git@github.com:<your-name>/<your-repo>.git
git push -u origin main
```

如果还没有 GitHub 仓库，先在 <https://github.com/new> 创建一个空仓库（不要勾选任何初始化选项），再执行上面的命令。

### 协作时注意

- 首次 `git clone` 后，请复制 `config.example.json` 为 `config.json`，再启动 `npm install && npm start`
- 不要把 `family_tree.db` / `chapters/*.db` / `chapters.json` / `config.json` 提交进去 —— 它们已经写在 `.gitignore` 里
- 如需分享数据，请用应用内的「导出备份」功能，把 JSON 文件发给对方

## 许可证

MIT