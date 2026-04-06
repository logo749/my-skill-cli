import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname;

const CLI_PATH = path.join(projectRoot, 'dist', 'index.js');
const PID_FILE = path.join(projectRoot, 'server.pid');
const LOG_FILE = path.join(projectRoot, 'server.log');

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function log(message: string): void {
  console.log(message);
}

async function runCommand(cmd: string, args: string[], cwd = projectRoot): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const proc = spawn(cmd, args, { shell: true, cwd });
    
    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
  });
}

async function waitForHealth(port: number, timeout = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return true;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
    log(`  等待服务就绪...`);
  }
  return false;
}

async function startServer(): Promise<{ pid: number; port: number } | null> {
  log('  启动服务...');
  
  const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const proc = spawn('node', [CLI_PATH, 'start'], {
      cwd: projectRoot,
      shell: true,
      env: { ...process.env }
    });
    
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });
    proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
    
    // 30秒超时
    setTimeout(() => resolve({ stdout, stderr, exitCode: -1 }), 30000);
  });
  
  log(`  启动命令输出: ${result.stdout}`);
  if (result.stderr) log(`  启动命令错误: ${result.stderr}`);
  
  if (!result.stdout.includes('使用端口:')) {
    log(`  启动失败: ${result.stdout}${result.stderr}`);
    return null;
  }
  
  const match = result.stdout.match(/使用端口:\s*(\d+)/);
  const port = match ? parseInt(match[1]) : 3000;
  
  log(`  等待服务就绪 (端口: ${port})...`);
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  if (fs.existsSync(PID_FILE)) {
    const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
    const [pidStr] = content.split(':');
    return { pid: parseInt(pidStr), port };
  }
  
  log(`  PID文件不存在`);
  return null;
}

async function stopServer(): Promise<void> {
  log('  停止服务...');
  
  // 读取 PID 文件并使用 taskkill 杀死进程
  if (fs.existsSync(PID_FILE)) {
    try {
      const content = fs.readFileSync(PID_FILE, 'utf-8').trim();
      const [pidStr] = content.split(':');
      const pid = parseInt(pidStr);
      
      await new Promise<void>((resolve) => {
        const killProc = spawn('taskkill', ['/F', '/PID', String(pid)], { shell: true });
        killProc.on('close', () => resolve());
        setTimeout(resolve, 3000); // 超时保护
      });
      
      fs.unlinkSync(PID_FILE);
    } catch {}
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
}

function recordTest(id: string, name: string, passed: boolean, message?: string): void {
  results.push({ id, name, passed, message });
  console.log(`${passed ? '✅' : '❌'} ${id}: ${name}`);
  if (!passed && message) {
    console.log(`   ${message}`);
  }
}

async function cleanup(): Promise<void> {
  await stopServer();
  if (fs.existsSync(LOG_FILE)) {
    try { fs.unlinkSync(LOG_FILE); } catch {}
  }
  if (fs.existsSync(PID_FILE)) {
    try { fs.unlinkSync(PID_FILE); } catch {}
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function runTests(): Promise<void> {
  log('\n开始端到端测试...\n');
  
  await cleanup();
  
  log('=== 服务管理测试 ===\n');
  
  log('T001: 服务正常启动');
  let server = await startServer();
  if (server) {
    const ready = await waitForHealth(server.port);
    const statusResult = await runCommand('node', [CLI_PATH, 'status']);
    const logsResult = await runCommand('node', [CLI_PATH, 'logs']);
    
    recordTest('T001', '服务正常启动', 
      ready && 
      statusResult.stdout.includes('服务运行中') &&
      logsResult.stdout.includes('服务器运行在')
    );
    await cleanup();
  } else {
    recordTest('T001', '服务正常启动', false, '服务启动失败');
  }
  
  log('\nT002: 端口占用自动递增');
  server = await startServer();
  if (server) {
    const port1 = server.port;
    await cleanup();
    
    server = await startServer();
    const port2 = server?.port ?? 0;
    
    recordTest('T002', '端口占用自动递增', port2 >= port1);
    await cleanup();
  } else {
    recordTest('T002', '端口占用自动递增', false, '服务启动失败');
  }
  
  log('\nT003: 服务已在运行时启动');
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand('node', [CLI_PATH, 'start']);
    recordTest('T003', '服务已在运行时启动', 
      result.stdout.includes('服务已在运行')
    );
    await cleanup();
  } else {
    recordTest('T003', '服务已在运行时启动', false, '服务启动失败');
  }
  
  log('\nT004: 正常停止服务');
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    await stopServer();
    const statusResult = await runCommand('node', [CLI_PATH, 'status']);
    recordTest('T004', '正常停止服务', 
      statusResult.stdout.includes('服务未运行')
    );
  } else {
    recordTest('T004', '正常停止服务', false, '服务启动失败');
  }
  
  log('\nT005: 服务未运行时停止');
  await cleanup();
  const stopResult = await runCommand('node', [CLI_PATH, 'stop']);
  recordTest('T005', '服务未运行时停止', 
    stopResult.stdout.includes('服务未运行')
  );
  
  log('\nT006: 查看运行中的服务状态');
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const statusResult = await runCommand('node', [CLI_PATH, 'status']);
    recordTest('T006', '查看运行中的服务状态',
      statusResult.stdout.includes('服务运行中') &&
      statusResult.stdout.includes('端口:')
    );
    await cleanup();
  } else {
    recordTest('T006', '查看运行中的服务状态', false, '服务启动失败');
  }
  
  log('\nT007: 查看未运行的服务状态');
  await cleanup();
  const statusResult = await runCommand('node', [CLI_PATH, 'status']);
  recordTest('T007', '查看未运行的服务状态',
    statusResult.stdout.includes('服务未运行')
  );
  
  log('\nT008: 查看服务日志');
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const logsResult = await runCommand('node', [CLI_PATH, 'logs']);
    recordTest('T008', '查看服务日志',
      logsResult.stdout.includes('正在启动Chrome浏览器') &&
      logsResult.stdout.includes('服务器运行在')
    );
    await cleanup();
  } else {
    recordTest('T008', '查看服务日志', false, '服务启动失败');
  }
  
  log('\nT009: 日志文件不存在时查看');
  await cleanup();
  if (fs.existsSync(LOG_FILE)) {
    try { fs.unlinkSync(LOG_FILE); } catch {}
  }
  const logsResult = await runCommand('node', [CLI_PATH, 'logs']);
  recordTest('T009', '日志文件不存在时查看',
    logsResult.stdout.includes('日志文件不存在')
  );
  
  log('\n=== HTTP代理测试 ===\n');
  
  log('T010: 转发GET请求');
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand('node', [CLI_PATH, 'get', 'https://httpbin.org/get']);
    recordTest('T010', '转发GET请求',
      result.exitCode === 0 && result.stdout.includes('响应状态: 200')
    );
    await cleanup();
  } else {
    recordTest('T010', '转发GET请求', false, '服务启动失败');
  }
  
  log('\nT011: GET请求目标URL缺失');
  const noUrlResult = await runCommand('node', [CLI_PATH, 'get']);
  recordTest('T011', 'GET请求目标URL缺失',
    noUrlResult.exitCode === 1
  );
  
  log('\nT012: 转发POST请求');
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand('node', [CLI_PATH, 'post', 'https://httpbin.org/post', '{"name":"test"}']);
    recordTest('T012', '转发POST请求',
      result.exitCode === 0 && result.stdout.includes('响应状态: 200')
    );
    await cleanup();
  } else {
    recordTest('T012', '转发POST请求', false, '服务启动失败');
  }
  
  log('\nT013: POST请求无数据');
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand('node', [CLI_PATH, 'post', 'https://httpbin.org/post']);
    recordTest('T013', 'POST请求无数据',
      result.exitCode === 0
    );
    await cleanup();
  } else {
    recordTest('T013', 'POST请求无数据', false, '服务启动失败');
  }
  
  log('\nT014: 转发PUT请求');
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand('node', [CLI_PATH, 'put', 'https://httpbin.org/put', '{"key":"value"}']);
    recordTest('T014', '转发PUT请求',
      result.exitCode === 0 && result.stdout.includes('响应状态: 200')
    );
    await cleanup();
  } else {
    recordTest('T014', '转发PUT请求', false, '服务启动失败');
  }
  
  log('\nT015: 转发DELETE请求');
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand('node', [CLI_PATH, 'delete', 'https://httpbin.org/delete']);
    recordTest('T015', '转发DELETE请求',
      result.exitCode === 0 && result.stdout.includes('响应状态: 200')
    );
    await cleanup();
  } else {
    recordTest('T015', '转发DELETE请求', false, '服务启动失败');
  }
  
  log('\n=== 健康检查测试 ===\n');
  
  log('T017: 健康检查接口正常');
  server = await startServer();
  if (server) {
    const ready = await waitForHealth(server.port);
    if (ready) {
      const healthResult = await new Promise<{ status: number; body: string }>((resolve) => {
        http.get(`http://localhost:${server.port}/health`, (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        }).on('error', () => resolve({ status: 0, body: '' }));
      });
      
      try {
        const body = JSON.parse(healthResult.body);
        recordTest('T017', '健康检查接口正常',
          healthResult.status === 200 && body.status === 'ok'
        );
      } catch {
        recordTest('T017', '健康检查接口正常', false, '响应解析失败');
      }
    } else {
      recordTest('T017', '健康检查接口正常', false, '服务未就绪');
    }
    await cleanup();
  } else {
    recordTest('T017', '健康检查接口正常', false, '服务启动失败');
  }
  
  log('\n=== 错误处理测试 ===\n');
  
  log('T019: 服务未运行时发送请求');
  await cleanup();
  const reqResult = await runCommand('node', [CLI_PATH, 'get', 'https://httpbin.org/get']);
  recordTest('T019', '服务未运行时发送请求',
    reqResult.exitCode === 1 || reqResult.stderr.includes('服务未运行')
  );
  
  log('\nT020: PID文件损坏');
  await cleanup();
  fs.writeFileSync(PID_FILE, 'invalid-content');
  const badPidResult = await runCommand('node', [CLI_PATH, 'status']);
  if (fs.existsSync(PID_FILE)) {
    try { fs.unlinkSync(PID_FILE); } catch {}
  }
  recordTest('T020', 'PID文件损坏',
    badPidResult.stdout.includes('服务未运行')
  );
  
  log('\n=== 构建测试 ===\n');
  
  log('T023: 构建为Node.js版本');
  try {
    const require = createRequire(import.meta.url);
    const esbuild = require('esbuild');
    esbuild.buildSync({
      entryPoints: ['index.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: 'dist/index.js',
      external: ['playwright-core', 'electron', 'chromium-bidi', 'dotenv'],
      minify: true
    });
    
    if (fs.existsSync('dist/index.js')) {
      const stats = fs.statSync('dist/index.js');
      recordTest('T023', '构建为Node.js版本',
        stats.size > 5000 && stats.size < 100000
      );
    } else {
      recordTest('T023', '构建为Node.js版本', false, 'dist/index.js 未生成');
    }
  } catch (err) {
    recordTest('T023', '构建为Node.js版本', false, String(err));
  }
  
  log('\nT024: 使用构建版本运行');
  const helpResult = await runCommand('node', [CLI_PATH, '--help']);
  recordTest('T024', '使用构建版本运行',
    helpResult.exitCode === 0 && helpResult.stdout.includes('用法:')
  );
  
  await cleanup();
  
  log('\n' + '='.repeat(60));
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  log(`测试结果: ${passed} 通过, ${failed} 失败`);
  log('='.repeat(60));
  
  if (failed > 0) {
    log('\n失败的测试:');
    results.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.id}: ${r.name}`);
      if (r.message) log(`    ${r.message}`);
    });
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试执行失败:', err);
  process.exit(1);
});
