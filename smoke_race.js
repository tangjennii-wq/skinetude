#!/usr/bin/env node
/**
 * Playwright smoke — cloud-save race test (real queue).
 *
 * Drives the REAL enqueueCloudSave + saveToSupabase closure from the
 * App body (not a re-implementation). Exposed via the
 * window.__ETUDE_DEBUG__ debug hook that the App installs when
 * window.__SMOKE_TEST__ is true.
 *
 * Asserts:
 *   1. Rapid saves across different keys all land in the final row.
 *   2. Upsert count is less than save count (coalescing happened).
 *   3. Newest-value-wins for colliding keys.
 *   4. Queue drains within budget.
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

const HTML_PATH = path.join(__dirname, 'index.html');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url === '/' ? '/index.html' : req.url;
      const filePath = path.join(__dirname, url.split('?')[0]);
      if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        const ext = path.extname(filePath).toLowerCase();
        const type = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  if (!fs.existsSync(HTML_PATH)) { console.error('index.html missing — run `node build_current.js` first'); process.exit(1); }
  const server = await startServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 414, height: 896 } });

  // Set the smoke-test flag before any app script runs. The App body
  // installs window.__ETUDE_DEBUG__ in a useEffect gated on this flag.
  await context.addInitScript(() => {
    window.__SMOKE_TEST__ = true;
    window.__SMOKE_RACE__ = {
      upsertCalls: [],
      readCalls: 0,
      simulatedRow: { user_id: 'race-user', data: {}, updated_at: new Date().toISOString() },
    };
  });

  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.children.length > 0;
  }, { timeout: 10000 });
  // Wait for App's debug-hook useEffect to fire.
  await page.waitForFunction(() => !!(window.__ETUDE_DEBUG__ && window.__ETUDE_DEBUG__.enqueueCloudSave), { timeout: 5000 });

  // Install the mock on the real supabaseClient object. The App's
  // saveToSupabase calls supabaseClient.from(...) — we replace .from
  // so every call goes through our mock and we can count + capture
  // reads/upserts.
  const installResult = await page.evaluate(() => {
    const dbg = window.__ETUDE_DEBUG__;
    if (!dbg || !dbg.getSupabaseClient) return { ok: false, reason: 'no debug hook' };
    const sb = dbg.getSupabaseClient();
    if (!sb) return { ok: false, reason: 'no supabaseClient (Supabase not initialized in this build)' };
    const mock = {
      from: (tableName) => {
        if (tableName !== 'user_data') return sb.from.original ? sb.from.original(tableName) : null;
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                window.__SMOKE_RACE__.readCalls += 1;
                await new Promise(r => setTimeout(r, 50));
                return { data: { data: { ...window.__SMOKE_RACE__.simulatedRow.data } }, error: null };
              },
            }),
          }),
          upsert: async (row) => {
            await new Promise(r => setTimeout(r, 30));
            window.__SMOKE_RACE__.upsertCalls.push({ payload: row.data, ts: Date.now() });
            window.__SMOKE_RACE__.simulatedRow = {
              ...window.__SMOKE_RACE__.simulatedRow,
              data: { ...window.__SMOKE_RACE__.simulatedRow.data, ...(row.data || {}) },
            };
            return { error: null };
          },
        };
      },
    };
    dbg.setSupabaseClientForTest(mock);
    return { ok: true };
  });

  if (!installResult.ok) {
    console.log(`\nFAIL — could not install mock: ${installResult.reason}`);
    await browser.close();
    server.close();
    process.exit(1);
  }

  // Fire 6 rapid saves on different keys through the REAL queue.
  const result = await page.evaluate(async () => {
    const dbg = window.__ETUDE_DEBUG__;
    const userId = 'race-user';
    dbg.enqueueCloudSave(userId, { logs: ['log1', 'log2'] });
    dbg.enqueueCloudSave(userId, { products: ['p1'] });
    dbg.enqueueCloudSave(userId, { regimenLogs: ['r1'] });
    dbg.enqueueCloudSave(userId, { userProfile: { name: 'Race' } });
    dbg.enqueueCloudSave(userId, { logs: ['log1', 'log2', 'log3'] }); // newest wins
    dbg.enqueueCloudSave(userId, { events: ['e1'] });

    // Wait for queue to drain (max 3s — accounts for 50ms read + 30ms write per batch).
    const t0 = Date.now();
    while (Date.now() - t0 < 3000) {
      const s = dbg.cloudSaveState();
      if (Object.keys(s.pending).length === 0 && !s.inFlight && !s.hasScheduledRetry) break;
      await new Promise(r => setTimeout(r, 20));
    }
    const state = window.__SMOKE_RACE__;
    const finalState = dbg.cloudSaveState();
    return {
      saveCalls: 6,
      upsertCalls: state.upsertCalls.length,
      readCalls: state.readCalls,
      finalKeys: Object.keys(state.simulatedRow.data).sort(),
      logsValue: state.simulatedRow.data.logs,
      pendingDrained: Object.keys(finalState.pending).length === 0 && !finalState.inFlight,
      retryCount: finalState.retryCount,
    };
  });

  await browser.close();
  server.close();

  console.log('\n=== Playwright cloud-save race smoke (real queue) ===\n');
  console.log(`  saveData calls fired:  ${result.saveCalls}`);
  console.log(`  Supabase upsert calls: ${result.upsertCalls}`);
  console.log(`  Supabase read calls:   ${result.readCalls}`);
  console.log(`  Final row keys:        ${result.finalKeys.join(', ')}`);
  console.log(`  Final logs value:      ${JSON.stringify(result.logsValue)}`);
  console.log(`  Queue drained:         ${result.pendingDrained}`);
  console.log(`  Retry count at end:    ${result.retryCount}`);

  const expectedKeys = ['events', 'logs', 'products', 'regimenLogs', 'userProfile'];
  const missingKeys = expectedKeys.filter(k => !result.finalKeys.includes(k));
  const coalesced = result.upsertCalls < result.saveCalls;
  const logsNewest = JSON.stringify(result.logsValue) === JSON.stringify(['log1', 'log2', 'log3']);

  const failures = [];
  if (missingKeys.length > 0) failures.push(`missing keys: ${missingKeys.join(', ')}`);
  if (!coalesced) failures.push(`no coalescing — ${result.upsertCalls} upserts for ${result.saveCalls} saves`);
  if (!logsNewest) failures.push(`logs not newest-wins — got ${JSON.stringify(result.logsValue)}`);
  if (!result.pendingDrained) failures.push('queue not drained');

  if (failures.length > 0) {
    console.log('\nFAIL — cloud-save race smoke (real queue)');
    failures.forEach(f => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
  console.log('\nPASS — cloud-save race smoke (real queue)\n');
  process.exit(0);
})();
