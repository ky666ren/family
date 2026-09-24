// 静态文件服务器 —— 把仓库根目录暴露到 HTTP 上（与 GitHub Pages 部署一致）。
// 应用的所有数据操作（数据库、导入导出等）现在都在浏览器里通过 IndexedDB 完成，
// 所以 server.js 不再需要任何 REST 路由，仅服务于本地开发预览。
//
// 启动：npm start  →  http://localhost:3000

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname; // 直接把仓库根目录作为静态目录

// 强制不使用缓存，方便开发期间看到最新文件
app.use(express.static(PUBLIC_DIR, {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// SPA fallback：所有未匹配路径都返回 index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`家族树管理工具已启动: http://localhost:${PORT}`);
  console.log('（数据存储在浏览器 IndexedDB，无需后端数据库）');
});