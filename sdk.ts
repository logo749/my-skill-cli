import { chromium, Browser, BrowserContext, Page } from 'playwright-core';
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
const PID_FILE = join(__dirname, 'server.pid');
const LOG_FILE = join(__dirname, 'server.log');

export interface ClientOptions {
  loginUrl?: string;
  port?: number;
  onLog?: (message: string) => void;
}

export interface ServiceStatus {
  running: boolean;
  pid?: number;
  port?: number;
}

export interface RequestOptions {
  url: string;
  data?: Record<string, any>;
}

export interface RequestResult {
  status: number;
  body: any;
}

export interface HttpResponse {
  status: number;
  body: string;
}

class BrowserProxyClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private port: number = BASE_PORT;
  private loginUrl: string = LOGIN_URL;
  private onLog?: (message: string) => void;

  constructor(options: ClientOptions = {}) {
    this.port = options.port || BASE_PORT;
    this.loginUrl = options.loginUrl || LOGIN_URL;
    this.onLog = options.onLog;
  }

  private log(...args: any[]): void {
    const msg = args.join(' ');
    if (this.onLog) {
      this.onLog(msg);
    }
    console.log(msg);
  }

  private async isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(true));
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(port);
    });
  }

  async start(): Promise<void> {
    if (this.browser) {
      this.log('服务已在运行');
      return;
    }

    let availablePort = this.port;
    while (await this.isPortInUse(availablePort)) {
      this.log(`端口 ${availablePort} 已被占用，尝试端口 ${availablePort + 1}...`);
      availablePort++;
    }

    this.port = availablePort;
    this.log(`使用端口: ${this.port}`);

    this.log('正在启动Chrome浏览器...');

    this.browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
    });

    this.context = await this.browser.newContext();
    const page = await this.context.newPage();

    this.log(`正在访问: ${this.loginUrl}`);
    await page.goto(this.loginUrl);

    this.log(`服务已启动 (端口: ${this.port})`);
    this.log('请在浏览器中完成登录');
  }

  async stop(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.log('服务已停止');
    }
  }

  getStatus(): ServiceStatus {
    if (fs.existsSync(PID_FILE)) {
      const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
      const [pidStr, portStr] = content.split(':');
      const pid = parseInt(pidStr);
      const port = parseInt(portStr);

      try {
        process.kill(pid, 0);
        return { running: true, pid, port };
      } catch {
        fs.unlinkSync(PID_FILE);
      }
    }
    return { running: false };
  }

  getLogs(): string {
    if (fs.existsSync(LOG_FILE)) {
      return fs.readFileSync(LOG_FILE, 'utf-8');
    }
    return '';
  }

  async get(requestUrl: string): Promise<HttpResponse> {
    if (!this.browser || !this.context) {
      throw new Error('服务未启动，请先调用 start()');
    }

    const page = await this.context.newPage();
    try {
      const response = await page.request.get(requestUrl);
      const body = await response.text();
      this.log(`GET ${requestUrl} - 响应状态: ${response.status()}`);
      return {
        status: response.status(),
        body
      };
    } finally {
      await page.close();
    }
  }

  async post(requestUrl: string, data?: Record<string, any>): Promise<HttpResponse> {
    if (!this.browser || !this.context) {
      throw new Error('服务未启动，请先调用 start()');
    }

    const page = await this.context.newPage();
    try {
      const response = await page.request.post(requestUrl, { data });
      const body = await response.text();
      this.log(`POST ${requestUrl} - 响应状态: ${response.status()}`);
      return {
        status: response.status(),
        body
      };
    } finally {
      await page.close();
    }
  }

  async put(requestUrl: string, data?: Record<string, any>): Promise<HttpResponse> {
    if (!this.browser || !this.context) {
      throw new Error('服务未启动，请先调用 start()');
    }

    const page = await this.context.newPage();
    try {
      const response = await page.request.put(requestUrl, { data });
      const body = await response.text();
      this.log(`PUT ${requestUrl} - 响应状态: ${response.status()}`);
      return {
        status: response.status(),
        body
      };
    } finally {
      await page.close();
    }
  }

  async delete(requestUrl: string): Promise<HttpResponse> {
    if (!this.browser || !this.context) {
      throw new Error('服务未启动，请先调用 start()');
    }

    const page = await this.context.newPage();
    try {
      const response = await page.request.delete(requestUrl);
      const body = await response.text();
      this.log(`DELETE ${requestUrl} - 响应状态: ${response.status()}`);
      return {
        status: response.status(),
        body
      };
    } finally {
      await page.close();
    }
  }

  async request(method: string, requestUrl: string, data?: Record<string, any>): Promise<HttpResponse> {
    switch (method.toUpperCase()) {
      case 'GET':
        return this.get(requestUrl);
      case 'POST':
        return this.post(requestUrl, data);
      case 'PUT':
        return this.put(requestUrl, data);
      case 'DELETE':
        return this.delete(requestUrl);
      default:
        throw new Error(`不支持的请求方法: ${method}`);
    }
  }
}

export function createClient(options?: ClientOptions): BrowserProxyClient {
  return new BrowserProxyClient(options);
}

export { BrowserProxyClient as Client };
export default BrowserProxyClient;
