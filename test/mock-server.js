import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isLoggedIn = false;

const loginPage = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>测试登录页面</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
      min-width: 350px;
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
      font-size: 28px;
    }
    .status {
      padding: 15px 25px;
      border-radius: 10px;
      margin-bottom: 25px;
      font-size: 18px;
      font-weight: bold;
    }
    .status.logged-out {
      background: #fee;
      color: #c33;
      border: 2px solid #fcc;
    }
    .status.logged-in {
      background: #efe;
      color: #3c3;
      border: 2px solid #cfc;
    }
    button {
      padding: 15px 40px;
      border: none;
      border-radius: 10px;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.3s;
      margin: 5px;
    }
    .btn-login {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-login:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
    }
    .btn-logout {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    .btn-logout:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(245, 87, 108, 0.4);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
    .info {
      margin-top: 30px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 10px;
      font-size: 14px;
      color: #666;
    }
    .info code {
      background: #e0e0e0;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 测试登录页面</h1>
    <div id="status" class="status logged-out">当前状态：未登录</div>
    <button id="loginBtn" class="btn-login" onclick="login()">登录</button>
    <button id="logoutBtn" class="btn-logout" onclick="logout()" disabled>登出</button>
    <div class="info">
      <p>用于测试 my-skill-cli 的登录状态检测功能</p>
      <p>登录状态检测接口：<code>/api/check-login</code></p>
    </div>
  </div>

  <script>
    let loggedIn = false;

    function updateUI() {
      const status = document.getElementById('status');
      const loginBtn = document.getElementById('loginBtn');
      const logoutBtn = document.getElementById('logoutBtn');

      if (loggedIn) {
        status.className = 'status logged-in';
        status.textContent = '当前状态：已登录 ✓';
        loginBtn.disabled = true;
        logoutBtn.disabled = false;
      } else {
        status.className = 'status logged-out';
        status.textContent = '当前状态：未登录';
        loginBtn.disabled = false;
        logoutBtn.disabled = true;
      }
    }

    function login() {
      loggedIn = true;
      updateUI();
    }

    function logout() {
      loggedIn = false;
      updateUI();
    }

    window.loginState = {
      isLoggedIn: () => loggedIn
    };

    updateUI();
  </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url || '', true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === '/api/login') {
    isLoggedIn = true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: '登录成功' }));
    return;
  }

  if (pathname === '/api/logout') {
    isLoggedIn = false;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: '已退出登录' }));
    return;
  }

  if (pathname === '/api/check-login') {
    if (isLoggedIn) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ loggedIn: true, message: '用户已登录' }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ loggedIn: false, message: '用户未登录' }));
    }
    return;
  }

  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      isLoggedIn,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (pathname === '/' || pathname === '/login') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(loginPage);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.MOCK_PORT || 8080;

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    Mock 测试服务器                          ║
╠══════════════════════════════════════════════════════════════╣
║  登录页面:     http://localhost:${PORT}/login                    ║
║  登录状态检测: http://localhost:${PORT}/api/check-login          ║
║  当前状态:     http://localhost:${PORT}/api/status              ║
╠══════════════════════════════════════════════════════════════╣
║  使用说明:                                                  ║
║  1. 打开登录页面，点击"登录"按钮模拟登录                      ║
║  2. 点击"登出"按钮模拟退出登录                                ║
║  3. 启动 my-skill-cli 时配置 LOGIN_STATUS_URL 环境变量       ║
║                                                              ║
║  配置示例:                                                  ║
║  LOGIN_URL=http://localhost:${PORT}/login                    ║
║  LOGIN_STATUS_URL=http://localhost:${PORT}/api/check-login    ║
╚══════════════════════════════════════════════════════════════╝
`);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭 Mock 服务器...');
  server.close();
  process.exit(0);
});
