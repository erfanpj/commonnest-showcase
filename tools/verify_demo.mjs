#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES_PATH_PREFIX } from "../logic.js";
import { allocatePort, pagesBaseUrl } from "./pages_server.mjs";
import { browserPath, stagePagesSite } from "./stage_site.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

async function withPage(baseUrl, fn, { denyStorage = false } = {}) {
  const dbgPort = 9980 + Math.floor(Math.random() * 30);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "cn-verify-"));
  const proc = spawn(
    browserPath(),
    [
      "--headless=new",
      `--remote-debugging-port=${dbgPort}`,
      `--user-data-dir=${userData}`,
      "--disable-extensions",
      ...(denyStorage ? ["--disable-local-storage"] : []),
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  try {
    await new Promise((r) => setTimeout(r, 900));
    const tabs = await new Promise((res, rej) => {
      http
        .get(`http://127.0.0.1:${dbgPort}/json/list`, (r) => {
          let d = "";
          r.on("data", (c) => (d += c));
          r.on("end", () => res(JSON.parse(d)));
        })
        .on("error", rej);
    });
    const pageTab = tabs.find((t) => t.type === "page") || tabs[0];
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
    });
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const mid = ++id;
        pending.set(mid, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
        ws.send(JSON.stringify({ id: mid, method, params }));
      });
    await new Promise((res, rej) => {
      ws.addEventListener("open", res);
      ws.addEventListener("error", rej);
    });
    await send("Page.navigate", { url: baseUrl });
    await new Promise((r) => setTimeout(r, 1000));
    const evalJs = async (expression) => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true });
      return r.result.value;
    };
    await fn({ evalJs, send });
    ws.close();
  } finally {
    proc.kill("SIGTERM");
    try {
      fs.rmSync(userData, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const port = await allocatePort();
  const { reviewRoot } = stagePagesSite(repoRoot, PAGES_PATH_PREFIX);
  const base = pagesBaseUrl(port, PAGES_PATH_PREFIX);
  const server = spawn(
    "python",
    ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", reviewRoot],
    { stdio: "ignore" },
  );
  await new Promise((r) => setTimeout(r, 500));
  try {
    await withPage(base, async ({ evalJs }) => {
      const text = await evalJs(
        `[...document.querySelectorAll('#shoppingList li label')].map(l=>l.textContent.trim()).join('|')`,
      );
      if (!text.includes("350 g Tomatoes")) throw new Error(`tomatoes line: ${text}`);
      if (!text.includes("1 kg Tomatoes")) throw new Error(`pantry kg line missing: ${text}`);
      await evalJs(`
        const sel = document.querySelector('#taskList select[aria-label="Due day for Pick up vegetables"]');
        if (!sel) throw new Error('due select missing');
        sel.value = 'Wed';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      `);
      await new Promise((r) => setTimeout(r, 200));
      const monText = await evalJs(`document.querySelectorAll('.day-col')[0].innerText`);
      const wedText = await evalJs(`document.querySelectorAll('.day-col')[2].innerText`);
      if (monText.includes("Pick up vegetables")) throw new Error("task should leave Monday");
      if (!wedText.includes("Pick up vegetables")) throw new Error("task should appear on Wednesday");
    });

    await withPage(base, async ({ evalJs }) => {
      if (!(await evalJs(`!document.querySelector('#storageBanner').hidden`))) {
        throw new Error("expected storage-unavailable banner");
      }
      const seeded = await evalJs(`document.querySelectorAll('.day-col').length === 7`);
      if (!seeded) throw new Error("seed week should render in memory");
      await evalJs(`
        const sel = document.querySelector('#taskList select[aria-label="Due day for Pick up vegetables"]');
        sel.value = 'Wed';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      `);
      await new Promise((r) => setTimeout(r, 200));
      if (!(await evalJs(`document.querySelectorAll('.day-col')[2].innerText.includes('Pick up vegetables')`))) {
        throw new Error("in-memory task move should work without storage");
      }
    }, { denyStorage: true });

    console.log("verify_demo: ok", base);
  } finally {
    server.kill("SIGTERM");
    fs.rmSync(reviewRoot, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
