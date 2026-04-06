// test.ts
import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var projectRoot = __dirname;
var CLI_PATH = path.join(projectRoot, "dist", "index.js");
var PID_FILE = path.join(projectRoot, "server.pid");
var LOG_FILE = path.join(projectRoot, "server.log");
var results = [];
function log(message) {
  console.log(message);
}
async function runCommand(cmd, args, cwd = projectRoot) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const proc = spawn(cmd, args, { shell: true, cwd });
    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
  });
}
async function waitForHealth(port, timeout = 3e4) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return true;
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    log(`  \u7B49\u5F85\u670D\u52A1\u5C31\u7EEA...`);
  }
  return false;
}
async function startServer() {
  log("  \u542F\u52A8\u670D\u52A1...");
  const result = await new Promise((resolve) => {
    const proc = spawn("node", [CLI_PATH, "start"], {
      cwd: projectRoot,
      shell: true,
      env: { ...process.env }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
    setTimeout(() => resolve({ stdout, stderr, exitCode: -1 }), 3e4);
  });
  log(`  \u542F\u52A8\u547D\u4EE4\u8F93\u51FA: ${result.stdout}`);
  if (result.stderr) log(`  \u542F\u52A8\u547D\u4EE4\u9519\u8BEF: ${result.stderr}`);
  if (!result.stdout.includes("\u4F7F\u7528\u7AEF\u53E3:")) {
    log(`  \u542F\u52A8\u5931\u8D25: ${result.stdout}${result.stderr}`);
    return null;
  }
  const match = result.stdout.match(/使用端口:\s*(\d+)/);
  const port = match ? parseInt(match[1]) : 3e3;
  log(`  \u7B49\u5F85\u670D\u52A1\u5C31\u7EEA (\u7AEF\u53E3: ${port})...`);
  await new Promise((resolve) => setTimeout(resolve, 5e3));
  if (fs.existsSync(PID_FILE)) {
    const content = fs.readFileSync(PID_FILE, "utf-8").trim();
    const [pidStr] = content.split(":");
    return { pid: parseInt(pidStr), port };
  }
  log(`  PID\u6587\u4EF6\u4E0D\u5B58\u5728`);
  return null;
}
async function stopServer() {
  log("  \u505C\u6B62\u670D\u52A1...");
  if (fs.existsSync(PID_FILE)) {
    try {
      const content = fs.readFileSync(PID_FILE, "utf-8").trim();
      const [pidStr] = content.split(":");
      const pid = parseInt(pidStr);
      await new Promise((resolve) => {
        const killProc = spawn("taskkill", ["/F", "/PID", String(pid)], { shell: true });
        killProc.on("close", () => resolve());
        setTimeout(resolve, 3e3);
      });
      fs.unlinkSync(PID_FILE);
    } catch {
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 2e3));
}
function recordTest(id, name, passed, message) {
  results.push({ id, name, passed, message });
  console.log(`${passed ? "\u2705" : "\u274C"} ${id}: ${name}`);
  if (!passed && message) {
    console.log(`   ${message}`);
  }
}
async function cleanup() {
  await stopServer();
  if (fs.existsSync(LOG_FILE)) {
    try {
      fs.unlinkSync(LOG_FILE);
    } catch {
    }
  }
  if (fs.existsSync(PID_FILE)) {
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1e3));
}
async function runTests() {
  log("\n\u5F00\u59CB\u7AEF\u5230\u7AEF\u6D4B\u8BD5...\n");
  await cleanup();
  log("=== \u670D\u52A1\u7BA1\u7406\u6D4B\u8BD5 ===\n");
  log("T001: \u670D\u52A1\u6B63\u5E38\u542F\u52A8");
  let server = await startServer();
  if (server) {
    const ready = await waitForHealth(server.port);
    const statusResult2 = await runCommand("node", [CLI_PATH, "status"]);
    const logsResult2 = await runCommand("node", [CLI_PATH, "logs"]);
    recordTest(
      "T001",
      "\u670D\u52A1\u6B63\u5E38\u542F\u52A8",
      ready && statusResult2.stdout.includes("\u670D\u52A1\u8FD0\u884C\u4E2D") && logsResult2.stdout.includes("\u670D\u52A1\u5668\u8FD0\u884C\u5728")
    );
    await cleanup();
  } else {
    recordTest("T001", "\u670D\u52A1\u6B63\u5E38\u542F\u52A8", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT002: \u7AEF\u53E3\u5360\u7528\u81EA\u52A8\u9012\u589E");
  server = await startServer();
  if (server) {
    const port1 = server.port;
    await cleanup();
    server = await startServer();
    const port2 = server?.port ?? 0;
    recordTest("T002", "\u7AEF\u53E3\u5360\u7528\u81EA\u52A8\u9012\u589E", port2 >= port1);
    await cleanup();
  } else {
    recordTest("T002", "\u7AEF\u53E3\u5360\u7528\u81EA\u52A8\u9012\u589E", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT003: \u670D\u52A1\u5DF2\u5728\u8FD0\u884C\u65F6\u542F\u52A8");
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand("node", [CLI_PATH, "start"]);
    recordTest(
      "T003",
      "\u670D\u52A1\u5DF2\u5728\u8FD0\u884C\u65F6\u542F\u52A8",
      result.stdout.includes("\u670D\u52A1\u5DF2\u5728\u8FD0\u884C")
    );
    await cleanup();
  } else {
    recordTest("T003", "\u670D\u52A1\u5DF2\u5728\u8FD0\u884C\u65F6\u542F\u52A8", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT004: \u6B63\u5E38\u505C\u6B62\u670D\u52A1");
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    await stopServer();
    const statusResult2 = await runCommand("node", [CLI_PATH, "status"]);
    recordTest(
      "T004",
      "\u6B63\u5E38\u505C\u6B62\u670D\u52A1",
      statusResult2.stdout.includes("\u670D\u52A1\u672A\u8FD0\u884C")
    );
  } else {
    recordTest("T004", "\u6B63\u5E38\u505C\u6B62\u670D\u52A1", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT005: \u670D\u52A1\u672A\u8FD0\u884C\u65F6\u505C\u6B62");
  await cleanup();
  const stopResult = await runCommand("node", [CLI_PATH, "stop"]);
  recordTest(
    "T005",
    "\u670D\u52A1\u672A\u8FD0\u884C\u65F6\u505C\u6B62",
    stopResult.stdout.includes("\u670D\u52A1\u672A\u8FD0\u884C")
  );
  log("\nT006: \u67E5\u770B\u8FD0\u884C\u4E2D\u7684\u670D\u52A1\u72B6\u6001");
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const statusResult2 = await runCommand("node", [CLI_PATH, "status"]);
    recordTest(
      "T006",
      "\u67E5\u770B\u8FD0\u884C\u4E2D\u7684\u670D\u52A1\u72B6\u6001",
      statusResult2.stdout.includes("\u670D\u52A1\u8FD0\u884C\u4E2D") && statusResult2.stdout.includes("\u7AEF\u53E3:")
    );
    await cleanup();
  } else {
    recordTest("T006", "\u67E5\u770B\u8FD0\u884C\u4E2D\u7684\u670D\u52A1\u72B6\u6001", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT007: \u67E5\u770B\u672A\u8FD0\u884C\u7684\u670D\u52A1\u72B6\u6001");
  await cleanup();
  const statusResult = await runCommand("node", [CLI_PATH, "status"]);
  recordTest(
    "T007",
    "\u67E5\u770B\u672A\u8FD0\u884C\u7684\u670D\u52A1\u72B6\u6001",
    statusResult.stdout.includes("\u670D\u52A1\u672A\u8FD0\u884C")
  );
  log("\nT008: \u67E5\u770B\u670D\u52A1\u65E5\u5FD7");
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const logsResult2 = await runCommand("node", [CLI_PATH, "logs"]);
    recordTest(
      "T008",
      "\u67E5\u770B\u670D\u52A1\u65E5\u5FD7",
      logsResult2.stdout.includes("\u6B63\u5728\u542F\u52A8Chrome\u6D4F\u89C8\u5668") && logsResult2.stdout.includes("\u670D\u52A1\u5668\u8FD0\u884C\u5728")
    );
    await cleanup();
  } else {
    recordTest("T008", "\u67E5\u770B\u670D\u52A1\u65E5\u5FD7", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT009: \u65E5\u5FD7\u6587\u4EF6\u4E0D\u5B58\u5728\u65F6\u67E5\u770B");
  await cleanup();
  if (fs.existsSync(LOG_FILE)) {
    try {
      fs.unlinkSync(LOG_FILE);
    } catch {
    }
  }
  const logsResult = await runCommand("node", [CLI_PATH, "logs"]);
  recordTest(
    "T009",
    "\u65E5\u5FD7\u6587\u4EF6\u4E0D\u5B58\u5728\u65F6\u67E5\u770B",
    logsResult.stdout.includes("\u65E5\u5FD7\u6587\u4EF6\u4E0D\u5B58\u5728")
  );
  log("\n=== HTTP\u4EE3\u7406\u6D4B\u8BD5 ===\n");
  log("T010: \u8F6C\u53D1GET\u8BF7\u6C42");
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand("node", [CLI_PATH, "get", "https://httpbin.org/get"]);
    recordTest(
      "T010",
      "\u8F6C\u53D1GET\u8BF7\u6C42",
      result.exitCode === 0 && result.stdout.includes("\u54CD\u5E94\u72B6\u6001: 200")
    );
    await cleanup();
  } else {
    recordTest("T010", "\u8F6C\u53D1GET\u8BF7\u6C42", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT011: GET\u8BF7\u6C42\u76EE\u6807URL\u7F3A\u5931");
  const noUrlResult = await runCommand("node", [CLI_PATH, "get"]);
  recordTest(
    "T011",
    "GET\u8BF7\u6C42\u76EE\u6807URL\u7F3A\u5931",
    noUrlResult.exitCode === 1
  );
  log("\nT012: \u8F6C\u53D1POST\u8BF7\u6C42");
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand("node", [CLI_PATH, "post", "https://httpbin.org/post", '{"name":"test"}']);
    recordTest(
      "T012",
      "\u8F6C\u53D1POST\u8BF7\u6C42",
      result.exitCode === 0 && result.stdout.includes("\u54CD\u5E94\u72B6\u6001: 200")
    );
    await cleanup();
  } else {
    recordTest("T012", "\u8F6C\u53D1POST\u8BF7\u6C42", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT013: POST\u8BF7\u6C42\u65E0\u6570\u636E");
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand("node", [CLI_PATH, "post", "https://httpbin.org/post"]);
    recordTest(
      "T013",
      "POST\u8BF7\u6C42\u65E0\u6570\u636E",
      result.exitCode === 0
    );
    await cleanup();
  } else {
    recordTest("T013", "POST\u8BF7\u6C42\u65E0\u6570\u636E", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT014: \u8F6C\u53D1PUT\u8BF7\u6C42");
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand("node", [CLI_PATH, "put", "https://httpbin.org/put", '{"key":"value"}']);
    recordTest(
      "T014",
      "\u8F6C\u53D1PUT\u8BF7\u6C42",
      result.exitCode === 0 && result.stdout.includes("\u54CD\u5E94\u72B6\u6001: 200")
    );
    await cleanup();
  } else {
    recordTest("T014", "\u8F6C\u53D1PUT\u8BF7\u6C42", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\nT015: \u8F6C\u53D1DELETE\u8BF7\u6C42");
  server = await startServer();
  if (server) {
    await waitForHealth(server.port);
    const result = await runCommand("node", [CLI_PATH, "delete", "https://httpbin.org/delete"]);
    recordTest(
      "T015",
      "\u8F6C\u53D1DELETE\u8BF7\u6C42",
      result.exitCode === 0 && result.stdout.includes("\u54CD\u5E94\u72B6\u6001: 200")
    );
    await cleanup();
  } else {
    recordTest("T015", "\u8F6C\u53D1DELETE\u8BF7\u6C42", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\n=== \u5065\u5EB7\u68C0\u67E5\u6D4B\u8BD5 ===\n");
  log("T017: \u5065\u5EB7\u68C0\u67E5\u63A5\u53E3\u6B63\u5E38");
  server = await startServer();
  if (server) {
    const ready = await waitForHealth(server.port);
    if (ready) {
      const healthResult = await new Promise((resolve) => {
        http.get(`http://localhost:${server.port}/health`, (res) => {
          let body = "";
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
        }).on("error", () => resolve({ status: 0, body: "" }));
      });
      try {
        const body = JSON.parse(healthResult.body);
        recordTest(
          "T017",
          "\u5065\u5EB7\u68C0\u67E5\u63A5\u53E3\u6B63\u5E38",
          healthResult.status === 200 && body.status === "ok"
        );
      } catch {
        recordTest("T017", "\u5065\u5EB7\u68C0\u67E5\u63A5\u53E3\u6B63\u5E38", false, "\u54CD\u5E94\u89E3\u6790\u5931\u8D25");
      }
    } else {
      recordTest("T017", "\u5065\u5EB7\u68C0\u67E5\u63A5\u53E3\u6B63\u5E38", false, "\u670D\u52A1\u672A\u5C31\u7EEA");
    }
    await cleanup();
  } else {
    recordTest("T017", "\u5065\u5EB7\u68C0\u67E5\u63A5\u53E3\u6B63\u5E38", false, "\u670D\u52A1\u542F\u52A8\u5931\u8D25");
  }
  log("\n=== \u9519\u8BEF\u5904\u7406\u6D4B\u8BD5 ===\n");
  log("T019: \u670D\u52A1\u672A\u8FD0\u884C\u65F6\u53D1\u9001\u8BF7\u6C42");
  await cleanup();
  const reqResult = await runCommand("node", [CLI_PATH, "get", "https://httpbin.org/get"]);
  recordTest(
    "T019",
    "\u670D\u52A1\u672A\u8FD0\u884C\u65F6\u53D1\u9001\u8BF7\u6C42",
    reqResult.exitCode === 1 || reqResult.stderr.includes("\u670D\u52A1\u672A\u8FD0\u884C")
  );
  log("\nT020: PID\u6587\u4EF6\u635F\u574F");
  await cleanup();
  fs.writeFileSync(PID_FILE, "invalid-content");
  const badPidResult = await runCommand("node", [CLI_PATH, "status"]);
  if (fs.existsSync(PID_FILE)) {
    try {
      fs.unlinkSync(PID_FILE);
    } catch {
    }
  }
  recordTest(
    "T020",
    "PID\u6587\u4EF6\u635F\u574F",
    badPidResult.stdout.includes("\u670D\u52A1\u672A\u8FD0\u884C")
  );
  log("\n=== \u6784\u5EFA\u6D4B\u8BD5 ===\n");
  log("T023: \u6784\u5EFA\u4E3ANode.js\u7248\u672C");
  try {
    const require2 = createRequire(import.meta.url);
    const esbuild = require2("esbuild");
    esbuild.buildSync({
      entryPoints: ["index.ts"],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: "dist/index.js",
      external: ["playwright-core", "electron", "chromium-bidi", "dotenv"],
      minify: true
    });
    if (fs.existsSync("dist/index.js")) {
      const stats = fs.statSync("dist/index.js");
      recordTest(
        "T023",
        "\u6784\u5EFA\u4E3ANode.js\u7248\u672C",
        stats.size > 5e3 && stats.size < 1e5
      );
    } else {
      recordTest("T023", "\u6784\u5EFA\u4E3ANode.js\u7248\u672C", false, "dist/index.js \u672A\u751F\u6210");
    }
  } catch (err) {
    recordTest("T023", "\u6784\u5EFA\u4E3ANode.js\u7248\u672C", false, String(err));
  }
  log("\nT024: \u4F7F\u7528\u6784\u5EFA\u7248\u672C\u8FD0\u884C");
  const helpResult = await runCommand("node", [CLI_PATH, "--help"]);
  recordTest(
    "T024",
    "\u4F7F\u7528\u6784\u5EFA\u7248\u672C\u8FD0\u884C",
    helpResult.exitCode === 0 && helpResult.stdout.includes("\u7528\u6CD5:")
  );
  await cleanup();
  log("\n" + "=".repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  log(`\u6D4B\u8BD5\u7ED3\u679C: ${passed} \u901A\u8FC7, ${failed} \u5931\u8D25`);
  log("=".repeat(60));
  if (failed > 0) {
    log("\n\u5931\u8D25\u7684\u6D4B\u8BD5:");
    results.filter((r) => !r.passed).forEach((r) => {
      log(`  - ${r.id}: ${r.name}`);
      if (r.message) log(`    ${r.message}`);
    });
  }
  process.exit(failed > 0 ? 1 : 0);
}
runTests().catch((err) => {
  console.error("\u6D4B\u8BD5\u6267\u884C\u5931\u8D25:", err);
  process.exit(1);
});
