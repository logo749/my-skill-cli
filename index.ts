import { chromium } from 'playwright-core';
import 'dotenv/config';
import http from 'http';
import url from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOGIN_URL = process.env.LOGIN_URL || 'https://example.com/login';
const BASE_PORT = parseInt(process.env.PORT || '3000');
const LOGIN_STATUS_URL = process.env.LOGIN_STATUS_URL;
const LOGIN_STATUS_INTERVAL = parseInt(process.env.LOGIN_STATUS_INTERVAL || '30000');
const PID_FILE = join(__dirname, 'server.pid');
const LOG_FILE = join(__dirname, 'server.log');

function isPortInUse(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

async function startServer() {
  if (fs.existsSync(PID_FILE)) {
    const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const [pidStr] = content.split(':');
    const pid = parseInt(pidStr);
    try {
      process.kill(pid, 0);
      console.log(`服务已在运行 (PID: ${pid})`);
      return;
    } catch {
      fs.unlinkSync(PID_FILE);
    }
  }

  let availablePort = BASE_PORT;
  while (await isPortInUse(availablePort)) {
    console.log(`端口 ${availablePort} 已被占用，尝试端口 ${availablePort + 1}...`);
    availablePort++;
  }

  console.log(`使用端口: ${availablePort}`);

  const runtime = process.execPath;
  const child = spawn(runtime, [__filename, '--server-mode'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, ACTUAL_PORT: String(availablePort) }
  });

  child.unref();
  fs.writeFileSync(PID_FILE, `${child.pid}:${availablePort}`);

  const maxRetries = 30;
  const retryInterval = 1000;
  let retries = 0;

  while (retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, retryInterval));

    try {
      const response = await fetch(`http://localhost:${availablePort}/health`);
      if (response.ok) {
        console.log(`服务已启动 (PID: ${child.pid}, 端口: ${availablePort})`);
        console.log(`查看日志: bun index.ts logs`);
        return;
      }
    } catch {
      retries++;
    }
  }

  console.log('服务启动超时');
  try {
    process.kill(child.pid, 'SIGTERM');
  } catch {}
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }
}

async function runServerMode() {
  const ACTUAL_PORT = parseInt(process.env.ACTUAL_PORT || String(BASE_PORT));
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

  function log(...args: any[]) {
    const msg = args.join(' ') + '\n';
    logStream.write(msg);
    process.stdout.write(msg);
  }

  let browser: any = null;
  let context: any = null;
  let isLoggedIn = true;
  let statusCheckTimer: NodeJS.Timeout | null = null;

  async function checkLoginStatus(): Promise<boolean> {
    if (!LOGIN_STATUS_URL) {
      return true;
    }

    try {
      const reqPage = await context.newPage();
      const response = await reqPage.request.get(LOGIN_STATUS_URL);
      await reqPage.close();

      if (response.ok()) {
        return true;
      }
      return false;
    } catch (error: any) {
      log(`登录状态检测失败: ${error.message}`);
      return false;
    }
  }

  async function startStatusCheck(): Promise<void> {
    if (!LOGIN_STATUS_URL) {
      log('未配置登录状态检测接口，跳过检测');
      return;
    }

    log(`启动登录状态检测，接口: ${LOGIN_STATUS_URL}，间隔: ${LOGIN_STATUS_INTERVAL}ms`);

    isLoggedIn = await checkLoginStatus();

    statusCheckTimer = setInterval(async () => {
      const loggedIn = await checkLoginStatus();

      if (loggedIn !== isLoggedIn) {
        isLoggedIn = loggedIn;
        if (isLoggedIn) {
          log('登录状态: 已登录');
        } else {
          log('登录状态: 已退出');
        }
      }
    }, LOGIN_STATUS_INTERVAL);
  }

  try {
    log('正在启动Chrome浏览器...');
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
    });

    browser.on('disconnected', () => {
      log('浏览器已关闭，服务即将退出...');
      if (statusCheckTimer) {
        clearInterval(statusCheckTimer);
      }
      logStream.end();
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
      process.exit(0);
    });

    context = await browser.newContext();
    const page = await context.newPage();

    log(`正在访问: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL);

    log(`服务器运行在 http://localhost:${ACTUAL_PORT}`);
    log('按 Ctrl+C 停止服务器\n');

    await startStatusCheck();

    const server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const parsedUrl = url.parse(req.url || '', true);
      const pathname = parsedUrl.pathname;
      const method = req.method || 'GET';

      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', port: ACTUAL_PORT, isLoggedIn }));
        return;
      }

      if (!isLoggedIn) {
        log(`请求被拒绝: 用户已退出登录`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: '登录状态已失效，请重新登录'
        }));
        return;
      }

      log(`\n收到请求: ${method} ${pathname}`);

      let body = '';
      if (['POST', 'PUT'].includes(method)) {
        body = await new Promise<string>((resolve) => {
          let data = '';
          req.on('data', (chunk: any) => data += chunk);
          req.on('end', () => resolve(data));
        });
      }

      try {
        const reqPage = await context.newPage();
        let response: any;

        if (method === 'GET') {
          response = await reqPage.request.get(parsedUrl.query.url as string);
        } else if (method === 'POST') {
          const data = body ? JSON.parse(body) : {};
          response = await reqPage.request.post(parsedUrl.query.url as string, { data });
        } else if (method === 'PUT') {
          const data = body ? JSON.parse(body) : {};
          response = await reqPage.request.put(parsedUrl.query.url as string, { data });
        } else if (method === 'DELETE') {
          response = await reqPage.request.delete(parsedUrl.query.url as string);
        } else {
          throw new Error('不支持的请求方法');
        }

        const responseBody = await response.text();
        log(`响应状态: ${response.status()}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: response.status(),
          body: responseBody
        }));

        await reqPage.close();
      } catch (error: any) {
        log(`请求失败: ${error.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: error.message
        }));
      }
    });

    server.listen(ACTUAL_PORT, () => {
      log(`\n可用命令:`);
      log(`  bun index.ts get https://example.com/api`);
      log(`  bun index.ts post https://example.com/api '{"key":"value"}'`);
    });

    process.on('SIGINT', async () => {
      log('\n正在关闭服务器...');
      if (statusCheckTimer) {
        clearInterval(statusCheckTimer);
      }
      await browser.close();
      logStream.end();
      if (fs.existsSync(PID_FILE)) {
        fs.unlinkSync(PID_FILE);
      }
      process.exit(0);
    });

  } catch (error: any) {
    log(`启动失败: ${error.message}`);
    if (browser) await browser.close();
    logStream.end();
    if (statusCheckTimer) {
      clearInterval(statusCheckTimer);
    }
    process.exit(1);
  }
}

function stopServer() {
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'));
    try {
      process.kill(pid, 'SIGTERM');
      fs.unlinkSync(PID_FILE);
      console.log(`服务已停止 (PID: ${pid})`);
    } catch {
      console.log('服务未运行或已停止');
      fs.unlinkSync(PID_FILE);
    }
  } else {
    console.log('服务未运行');
  }
}

function statusServer() {
  if (fs.existsSync(PID_FILE)) {
    const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const [pidStr, portStr] = content.split(':');
    const pid = parseInt(pidStr);
    const port = parseInt(portStr);
    try {
      process.kill(pid, 0);
      console.log(`服务运行中 (PID: ${pid}, 端口: ${port})`);
    } catch {
      console.log('服务未运行');
      fs.unlinkSync(PID_FILE);
    }
  } else {
    console.log('服务未运行');
  }
}

function logs() {
  if (fs.existsSync(LOG_FILE)) {
    console.log(fs.readFileSync(LOG_FILE, 'utf-8'));
  } else {
    console.log('日志文件不存在');
  }
}

function makeRequest(method: string, targetUrl: string, dataStr?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(PID_FILE)) {
      reject(new Error('服务未运行，请先运行 bun index.ts start'));
      return;
    }

    const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const [pidStr, portStr] = content.split(':');
    const pid = parseInt(pidStr);
    const port = parseInt(portStr);

    try {
      process.kill(pid, 0);
    } catch {
      reject(new Error('服务未运行'));
      return;
    }

    const postData = dataStr ? JSON.stringify({ data: dataStr }) : undefined;
    const options = {
      hostname: 'localhost',
      port: port,
      path: `/${method}?url=${encodeURIComponent(targetUrl)}`,
      method: ['POST', 'PUT'].includes(method.toUpperCase()) ? method.toUpperCase() : 'GET',
      headers: {
        'Content-Type': 'application/json',
      } as any
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk: any) => { body += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.error && res.statusCode === 401) {
            console.error('请求失败:', result.error);
            reject(new Error(result.error));
            return;
          }
          console.log(`响应状态: ${result.status}`);
          console.log('响应内容:', result.body);
          resolve(result);
        } catch {
          console.log('响应内容:', body);
          resolve(body);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === '--server-mode') {
  runServerMode();
} else if (cmd === 'start') {
  startServer();
} else if (cmd === 'stop') {
  stopServer();
} else if (cmd === 'status') {
  statusServer();
} else if (cmd === 'logs') {
  logs();
} else if (cmd === 'get') {
  const targetUrl = args[1];
  if (!targetUrl) {
    console.error('请提供URL: bun index.ts get <url>');
    process.exit(1);
  }
  makeRequest('GET', targetUrl)
    .then(() => process.exit(0))
    .catch((error: any) => {
      console.error('请求失败:', error.message || String(error));
      process.exit(1);
    });
} else if (cmd === 'post') {
  const targetUrl = args[1];
  const dataStr = args[2];
  if (!targetUrl) {
    console.error('请提供URL: bun index.ts post <url> [data]');
    process.exit(1);
  }
  makeRequest('POST', targetUrl, dataStr)
    .then(() => process.exit(0))
    .catch((error: any) => {
      console.error('请求失败:', error.message || String(error));
      process.exit(1);
    });
} else if (cmd === 'put') {
  const targetUrl = args[1];
  const dataStr = args[2];
  if (!targetUrl) {
    console.error('请提供URL: bun index.ts put <url> [data]');
    process.exit(1);
  }
  makeRequest('PUT', targetUrl, dataStr)
    .then(() => process.exit(0))
    .catch((error: any) => {
      console.error('请求失败:', error.message || String(error));
      process.exit(1);
    });
} else if (cmd === 'delete') {
  const targetUrl = args[1];
  if (!targetUrl) {
    console.error('请提供URL: bun index.ts delete <url>');
    process.exit(1);
  }
  makeRequest('DELETE', targetUrl)
    .then(() => process.exit(0))
    .catch((error: any) => {
      console.error('请求失败:', error.message || String(error));
      process.exit(1);
    });
} else {
  const cmd = 'bun ' + process.argv[1]?.split(/[\\/]/).pop() || 'index.ts';
  console.log('用法:');
  console.log('  服务管理:');
  console.log(`    ${cmd} start    # 启动服务(后台运行)`);
  console.log(`    ${cmd} stop    # 停止服务`);
  console.log(`    ${cmd} status  # 查看服务状态`);
  console.log(`    ${cmd} logs    # 查看日志`);
  console.log('  发送请求:');
  console.log(`    ${cmd} get <url>          # GET请求`);
  console.log(`    ${cmd} post <url> [data]  # POST请求`);
  console.log(`    ${cmd} put <url> [data]   # PUT请求`);
  console.log(`    ${cmd} delete <url>       # DELETE请求`);
}
