import { createClient } from '../dist/sdk.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function test() {
  console.log('='.repeat(60));
  console.log('SDK 登录状态检测测试');
  console.log('='.repeat(60));

  const client = createClient({
    loginUrl: 'http://localhost:8080/login',
    loginStatusUrl: 'http://localhost:8080/api/check-login',
    loginStatusInterval: 3000,
    onLog: (msg) => console.log('[LOG]', msg)
  });

  console.log('\n步骤1: 启动服务');
  await client.start();
  console.log('✅ 服务已启动');

  console.log('\n步骤2: 检查初始状态（未登录）');
  let status = client.getStatus();
  console.log('状态:', status);

  console.log('\n步骤3: 通过 API 登录 Mock 服务器');
  await fetch('http://localhost:8080/api/login', { method: 'POST' });
  console.log('✅ 已调用登录 API');

  console.log('\n步骤4: 等待检测间隔（4秒）');
  await sleep(4000);

  console.log('\n步骤5: 检查登录后状态');
  status = client.getStatus();
  console.log('状态:', status);

  console.log('\n步骤6: 发送 GET 请求');
  try {
    const res = await client.get('https://httpbin.org/get');
    console.log('✅ GET 请求成功，状态:', res.status);
  } catch (e) {
    console.log('❌ GET 请求失败:', e.message);
  }

  console.log('\n步骤7: 通过 API 登出 Mock 服务器');
  await fetch('http://localhost:8080/api/logout', { method: 'POST' });
  console.log('✅ 已调用登出 API');

  console.log('\n步骤8: 等待检测间隔（4秒）');
  await sleep(4000);

  console.log('\n步骤9: 检查登出后状态');
  status = client.getStatus();
  console.log('状态:', status);

  console.log('\n步骤10: 尝试发送请求（应该被拒绝）');
  try {
    const res = await client.get('https://httpbin.org/get');
    console.log('❌ 请求不应该成功');
  } catch (e) {
    console.log('✅ 请求被拒绝（预期行为）:', e.message);
  }

  console.log('\n步骤11: 停止服务');
  await client.stop();
  console.log('✅ 服务已停止');

  console.log('\n' + '='.repeat(60));
  console.log('测试完成！');
  console.log('='.repeat(60));
}

test().catch(console.error);
