# SDK 使用指南

## 简介

my-skill-cli 不仅提供命令行工具，还提供 Node.js SDK，方便在代码中集成浏览器自动化 HTTP 代理功能。

## 安装

```bash
npm install
npm run build:sdk
```

## 快速开始

### 基本用法

```typescript
import { createClient } from 'my-skill-cli';

async function main() {
  // 创建客户端
  const client = createClient({
    loginUrl: 'https://example.com/login',
    port: 3000,
    onLog: (msg) => console.log('[LOG]', msg)
  });

  // 启动服务
  await client.start();

  // 发送请求
  const response = await client.get('https://api.example.com/data');
  console.log('响应状态:', response.status);
  console.log('响应内容:', response.body);

  // 停止服务
  await client.stop();
}

main().catch(console.error);
```

## API 参考

### createClient(options?)

创建客户端实例。

**参数：**
- `options.loginUrl` (string): 登录页面 URL，默认 `https://example.com/login`
- `options.port` (number): 基础端口号，默认 `3000`
- `options.onLog` (function): 日志回调函数
- `options.loginStatusUrl` (string): 登录状态检测接口，不配置则不检测
- `options.loginStatusInterval` (number): 检测间隔（毫秒），默认 `30000`

**返回值：** `BrowserProxyClient` 实例

### client.start()

启动 Chrome 浏览器并访问登录页面。

**返回值：** `Promise<void>`

```typescript
await client.start();
```

### client.stop()

关闭浏览器并停止服务。

**返回值：** `Promise<void>`

```typescript
await client.stop();
```

### client.getStatus()

获取服务状态。

**返回值：** `ServiceStatus`

```typescript
interface ServiceStatus {
  running: boolean;     // 是否运行中
  pid?: number;         // 进程ID
  port?: number;        // 端口号
  isLoggedIn?: boolean; // 登录状态
}

const status = client.getStatus();
console.log(status.running);    // true
console.log(status.pid);        // 12345
console.log(status.port);       // 3000
console.log(status.isLoggedIn); // true
```

### client.getLogs()

获取服务日志。

**返回值：** `string`

```typescript
const logs = client.getLogs();
console.log(logs);
```

### client.get(url)

发送 GET 请求。

**参数：**
- `url` (string): 目标 URL

**返回值：** `Promise<HttpResponse>`

```typescript
const response = await client.get('https://httpbin.org/get');
console.log(response.status);  // 200
console.log(response.body);     // 响应体
```

### client.post(url, data?)

发送 POST 请求。

**参数：**
- `url` (string): 目标 URL
- `data` (object, 可选): 请求数据

**返回值：** `Promise<HttpResponse>`

```typescript
const response = await client.post('https://httpbin.org/post', {
  name: 'test',
  value: 123
});
console.log(response.status);  // 200
console.log(response.body);    // 响应体
```

### client.put(url, data?)

发送 PUT 请求。

**参数：**
- `url` (string): 目标 URL
- `data` (object, 可选): 请求数据

**返回值：** `Promise<HttpResponse>`

```typescript
const response = await client.put('https://httpbin.org/put', {
  name: 'updated'
});
```

### client.delete(url)

发送 DELETE 请求。

**参数：**
- `url` (string): 目标 URL

**返回值：** `Promise<HttpResponse>`

```typescript
const response = await client.delete('https://httpbin.org/delete');
```

### client.request(method, url, data?)

通用请求方法。

**参数：**
- `method` (string): HTTP 方法 (GET, POST, PUT, DELETE)
- `url` (string): 目标 URL
- `data` (object, 可选): 请求数据

**返回值：** `Promise<HttpResponse>`

```typescript
const response = await client.request('POST', 'https://httpbin.org/post', {
  key: 'value'
});
```

## 类型定义

```typescript
interface ClientOptions {
  loginUrl?: string;
  port?: number;
  onLog?: (message: string) => void;
}

interface ServiceStatus {
  running: boolean;
  pid?: number;
  port?: number;
}

interface HttpResponse {
  status: number;
  body: string;
}
```

## 使用示例

### 示例 1: 基本 CRUD 操作

```typescript
import { createClient } from 'my-skill-cli';

async function apiDemo() {
  const client = createClient({
    loginUrl: 'https://your-app.com/login'
  });

  try {
    await client.start();

    // 创建资源
    const createRes = await client.post('/api/users', {
      name: '张三',
      email: 'zhangsan@example.com'
    });
    console.log('创建成功:', createRes.body);

    // 获取资源
    const getRes = await client.get('/api/users/1');
    console.log('获取成功:', getRes.body);

    // 更新资源
    const updateRes = await client.put('/api/users/1', {
      name: '李四'
    });
    console.log('更新成功:', updateRes.body);

    // 删除资源
    const deleteRes = await client.delete('/api/users/1');
    console.log('删除成功:', deleteRes.body);

  } finally {
    await client.stop();
  }
}
```

### 示例 2: 自定义日志处理

```typescript
import { createClient } from 'my-skill-cli';

async function withLogging() {
  const logs: string[] = [];

  const client = createClient({
    loginUrl: 'https://example.com/login',
    onLog: (msg) => {
      const timestamp = new Date().toISOString();
      logs.push(`[${timestamp}] ${msg}`);
    }
  });

  await client.start();

  await client.get('https://httpbin.org/get');
  await client.post('https://httpbin.org/post', { data: 'test' });

  // 保存日志
  console.log('收集到的日志:');
  logs.forEach(log => console.log(log));
}
```

### 示例 3: 错误处理

```typescript
import { createClient } from 'my-skill-cli';

async function withErrorHandling() {
  const client = createClient();

  try {
    // 尝试在启动前发送请求
    await client.get('https://httpbin.org/get');
  } catch (error) {
    console.error('错误:', error.message);
    // 输出: 错误: 服务未启动，请先调用 start()
  }

  await client.start();

  try {
    // 请求失败的情况
    const response = await client.get('https://httpbin.org/status/500');
    if (response.status >= 400) {
      console.error('请求失败:', response.body);
    }
  } catch (error) {
    console.error('请求异常:', error.message);
  }

  await client.stop();
}
```

### 示例 4: 批量请求

```typescript
import { createClient } from 'my-skill-cli';

async function batchRequests() {
  const client = createClient();
  await client.start();

  const urls = [
    'https://httpbin.org/get',
    'https://httpbin.org/ip',
    'https://httpbin.org/headers'
  ];

  // 并发发送请求
  const results = await Promise.all(
    urls.map(url => client.get(url))
  );

  results.forEach((res, index) => {
    console.log(`请求 ${index + 1}: ${res.status}`);
  });

  await client.stop();
}
```

### 示例 5: 使用 async/await 循环

```typescript
import { createClient } from 'my-skill-cli';

async function paginatedRequests() {
  const client = createClient();
  await client.start();

  let page = 1;
  const allData: any[] = [];

  while (page <= 5) {
    const response = await client.get(`https://api.example.com/items?page=${page}`);

    if (response.status !== 200) {
      console.log('请求失败，停止分页');
      break;
    }

    const data = JSON.parse(response.body);
    if (!data.items || data.items.length === 0) {
      break;
    }

    allData.push(...data.items);
    page++;
  }

  console.log(`共获取 ${allData.length} 条数据`);
  await client.stop();
}
```

## 注意事项

1. **启动顺序**：必须在发送请求前调用 `start()`
2. **资源清理**：使用完毕后调用 `stop()` 关闭浏览器
3. **错误处理**：建议使用 try/finally 确保资源释放
4. **并发限制**：浏览器上下文复用，但每个请求创建独立页面
5. **登录保持**：在浏览器中完成登录后，会话会保持直到调用 `stop()`

## 构建 SDK

```bash
npm run build:sdk
```

这会将 SDK 构建到 `dist/sdk.js`，可以使用以下方式导入：

```typescript
// ES Modules
import { createClient } from './dist/sdk.js';

// CommonJS
const { createClient } = require('./dist/sdk.js');
```
