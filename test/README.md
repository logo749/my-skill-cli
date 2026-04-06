# 测试工具

用于测试 my-skill-cli 功能的 Mock 服务器。

## 快速开始

### 1. 启动 Mock 服务器

```bash
node test/mock-server.js
```

服务器启动后会显示：

```
╔══════════════════════════════════════════════════════════════╗
║                    Mock 测试服务器                          ║
╠══════════════════════════════════════════════════════════════╣
║  登录页面:     http://localhost:8080/login                  ║
║  登录状态检测: http://localhost:8080/api/check-login        ║
║  当前状态:     http://localhost:8080/api/status            ║
╚══════════════════════════════════════════════════════════════╝
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# 登录页面
LOGIN_URL=http://localhost:8080/login

# 登录状态检测接口
LOGIN_STATUS_URL=http://localhost:8080/api/check-login

# 检测间隔（5秒）
LOGIN_STATUS_INTERVAL=5000
```

### 3. 启动 my-skill-cli

```bash
npm run build
node dist/index.js start
```

### 4. 测试流程

1. **登录测试**
   - 在浏览器中打开 http://localhost:8080/login
   - 点击"登录"按钮
   - 发送请求测试功能

2. **登出测试**
   - 点击"登出"按钮
   - 等待检测间隔（5秒）
   - 尝试发送请求，应该被拒绝

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/login` | GET | 登录页面 |
| `/api/check-login` | GET | 登录状态检测 |
| `/api/login` | POST | 程序化登录 |
| `/api/logout` | POST | 程序化登出 |
| `/api/status` | GET | 获取当前状态 |

### 登录状态检测

请求：
```bash
curl http://localhost:8080/api/check-login
```

已登录响应 (200)：
```json
{"loggedIn": true, "message": "用户已登录"}
```

未登录响应 (401)：
```json
{"loggedIn": false, "message": "用户未登录"}
```

### 程序化操作

```bash
# 登录
curl -X POST http://localhost:8080/api/login

# 登出
curl -X POST http://localhost:8080/api/logout

# 查看状态
curl http://localhost:8080/api/status
```

## 测试用例

### T001: 基本登录流程

```bash
# 1. 启动 mock 服务器
node test/mock-server.js &

# 2. 启动 my-skill-cli
LOGIN_URL=http://localhost:8080/login \
LOGIN_STATUS_URL=http://localhost:8080/api/check-login \
LOGIN_STATUS_INTERVAL=3000 \
node dist/index.js start

# 3. 在浏览器中登录
# 打开 http://localhost:8080/login 点击登录

# 4. 发送请求
node dist/index.js get https://httpbin.org/get

# 5. 登出
curl -X POST http://localhost:8080/api/logout

# 6. 等待检测
sleep 5

# 7. 尝试请求（应该被拒绝）
node dist/index.js get https://httpbin.org/get
# 预期输出: 请求失败: 登录状态已失效，请重新登录
```

### T002: 健康检查接口

```bash
# 检查登录状态
curl http://localhost:3000/health
# 已登录: {"status":"ok","port":3000,"isLoggedIn":true}
# 未登录: {"status":"ok","port":3000,"isLoggedIn":false}
```

## 自定义端口

```bash
# 使用不同端口启动 mock 服务器
MOCK_PORT=9000 node test/mock-server.js
```

## 清理

```bash
# 停止所有服务
node dist/index.js stop
pkill -f mock-server.js
```
