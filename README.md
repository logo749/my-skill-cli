# my-skill-cli

基于浏览器自动化的 HTTP 请求代理工具。通过 Chrome 浏览器访问目标 URL，实现认证后的 HTTP 请求转发功能。

## 核心特性

- 🚀 **自动化浏览器**：自动拉起 Chrome 浏览器，支持交互式登录
- 🔄 **请求代理**：支持 GET、POST、PUT、DELETE 等 HTTP 方法
- 🔒 **会话保持**：通过浏览器上下文保持登录状态
- 🛡️ **CORS 支持**：自动处理跨域请求
- ⚡ **健康检查**：服务就绪后再返回启动成功
- 📝 **日志管理**：完整的请求和响应日志
- 🔧 **端口管理**：自动检测并切换可用端口

## 系统要求

- **操作系统**：Windows / macOS / Linux
- **Node.js**：18.0 或更高版本
- **浏览器**：系统已安装 Chrome 浏览器

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 配置环境变量（可选）

创建 `.env` 文件：

```bash
LOGIN_URL=https://example.com/login
PORT=3000
```

### 4. 启动服务

```bash
node dist/index.js start
```

服务启动后会：
- 自动拉起 Chrome 浏览器并访问登录页面
- 等待用户完成登录
- 启动 HTTP 代理服务器

### 5. 发送请求

```bash
# GET 请求
node dist/index.js get https://api.example.com/data

# POST 请求
node dist/index.js post https://api.example.com/data '{"name":"test"}'

# PUT 请求
node dist/index.js put https://api.example.com/data/1 '{"name":"update"}'

# DELETE 请求
node dist/index.js delete https://api.example.com/data/1
```

### 6. 管理服务

```bash
# 查看服务状态
node dist/index.js status

# 查看日志
node dist/index.js logs

# 停止服务
node dist/index.js stop
```

## SDK 使用

除了命令行工具，还可以通过 Node.js SDK 在代码中使用：

### 安装和构建

```bash
npm install
npm run build:sdk
```

### 基本用法

```typescript
import { createClient } from './dist/sdk.js';

async function main() {
  const client = createClient({
    loginUrl: 'https://example.com/login'
  });

  await client.start();

  const response = await client.get('https://api.example.com/data');
  console.log(response.status, response.body);

  await client.stop();
}

main();
```

### API 列表

| 方法 | 说明 |
|------|------|
| `createClient(options)` | 创建客户端实例 |
| `client.start()` | 启动浏览器服务 |
| `client.stop()` | 停止服务 |
| `client.getStatus()` | 获取服务状态 |
| `client.getLogs()` | 获取日志 |
| `client.get(url)` | 发送 GET 请求 |
| `client.post(url, data)` | 发送 POST 请求 |
| `client.put(url, data)` | 发送 PUT 请求 |
| `client.delete(url)` | 发送 DELETE 请求 |
| `client.request(method, url, data)` | 通用请求方法 |

详细文档请参见 [SDK使用指南](./docs/SDK使用指南.md)

---

## 命令参考

### 服务管理

| 命令 | 说明 |
|------|------|
| `node dist/index.js start` | 启动服务（后台运行） |
| `node dist/index.js stop` | 停止服务 |
| `node dist/index.js status` | 查看服务状态 |
| `node dist/index.js logs` | 查看服务日志 |

### HTTP 请求

| 命令 | 说明 |
|------|------|
| `node dist/index.js get <url>` | 发送 GET 请求 |
| `node dist/index.js post <url> [data]` | 发送 POST 请求 |
| `node dist/index.js put <url> [data]` | 发送 PUT 请求 |
| `node dist/index.js delete <url>` | 发送 DELETE 请求 |

### 其他

| 命令 | 说明 |
|------|------|
| `node dist/index.js --help` | 显示帮助信息 |

## 工作原理

```
┌──────────┐     ┌───────────┐     ┌───────────┐     ┌─────────────┐
│   CLI    │────▶│ HTTP代理  │────▶│   Chrome  │────▶│  目标服务器 │
│  命令行  │     │  服务器   │     │  浏览器   │     │  (API)     │
└──────────┘     └───────────┘     └───────────┘     └─────────────┘
```

1. **启动**：CLI 启动 HTTP 代理服务器和 Chrome 浏览器
2. **登录**：用户在浏览器中完成登录认证
3. **请求**：CLI 发送 HTTP 请求到代理服务器
4. **转发**：代理服务器通过 Chrome 浏览器转发请求
5. **响应**：响应结果返回给 CLI

## 项目结构

```
MyCLI/
├── index.ts              # CLI 入口源代码
├── sdk.ts                # SDK 入口源代码
├── dist/                 # 构建输出目录
│   ├── index.js          # CLI 可执行文件
│   └── sdk.js            # SDK 模块
├── docs/                 # 文档目录
│   ├── 产品需求文档.md    # 产品需求文档
│   ├── 技术架构文档.md    # 技术架构文档
│   ├── 端到端测试用例.md # 测试用例文档
│   └── SDK使用指南.md    # SDK 使用文档
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
├── .env                  # 环境变量（需创建）
├── .gitignore            # Git 忽略配置
└── README.md             # 项目说明
```

## 构建脚本

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建 CLI 工具 |
| `npm run build:sdk` | 构建 SDK 模块 |
| `npm run clean` | 清理构建文件 |
| `npm run test` | 运行测试（构建 + 测试） |

## 测试

### 冒烟测试

```bash
# 构建
npm run build

# 启动并验证
node dist/index.js start
sleep 5
curl http://localhost:3000/health

# 发送请求
node dist/index.js get https://httpbin.org/get

# 停止
node dist/index.js stop
```

### 完整测试用例

参见 [端到端测试用例.md](./端到端测试用例.md)

## 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| LOGIN_URL | https://example.com/login | 登录页面 URL |
| PORT | 3000 | 基础端口号 |

### 运行时文件

| 文件 | 说明 |
|------|------|
| `server.pid` | 存储服务进程 ID 和端口（格式：`PID:PORT`） |
| `server.log` | 服务运行日志 |

## 常见问题

### Q: Chrome 浏览器没有拉起？

检查以下几点：
1. 系统是否已安装 Chrome 浏览器
2. 端口是否被占用
3. 查看日志：`node dist/index.js logs`

### Q: 端口被占用怎么办？

工具会自动检测端口占用并切换到下一个可用端口。

### Q: 如何修改登录页面？

在 `.env` 文件中设置 `LOGIN_URL`：

```bash
LOGIN_URL=https://your-site.com/login
```

### Q: 请求返回错误？

1. 检查服务是否运行：`node dist/index.js status`
2. 查看日志：`node dist/index.js logs`
3. 确认浏览器已完成登录

## 技术栈

- **运行时**：Node.js 18+
- **语言**：TypeScript
- **打包工具**：esbuild
- **浏览器自动化**：Playwright-core
- **环境配置**：dotenv

## 开发指南

### 本地开发

```bash
# 监听文件变化自动重启
npm run dev
```

### 代码规范

- 使用 TypeScript 类型系统
- 遵循 ES Modules 规范
- 代码注释清晰易懂

### 提交规范

1. 确保所有测试通过
2. 更新相关文档
3. 使用清晰的提交信息

## License

MIT

## 相关文档

- [SDK使用指南](./docs/SDK使用指南.md)
- [产品需求文档](./docs/产品需求文档.md)
- [技术架构文档](./docs/技术架构文档.md)
- [端到端测试用例](./docs/端到端测试用例.md)
