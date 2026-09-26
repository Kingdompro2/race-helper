// Nitro Type bot — Playwright + CDP keystrokes
//
// Two modes:
//   npm run sniff   → opens Chromium, logs WS frames + XHR bodies that look
//                     like race text. Use this once to confirm where the text
//                     comes from on the current build.
//   npm run run     → auto-plays races. Reads text from the sniffed source,
//                     types via CDP Input.dispatchKeyEvent with human timing.
//
// First run: a fresh Chromium window opens. Log into nitrotype.com. Close
// the browser. Your session is saved in ./profile and reused next run.

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE   = path.join(__dirname, 'profile');
const MODE      = (process.argv.find(a => a.startsWith('--mode=')) || '--mode=run').split('=')[1];

// LEGIT-MODE defaults — under-radar tuning. Wins some, loses some, looks human.
// If you want to grind harder, edit values below (and accept higher ban risk).
const CFG = {
  wpmRange:      [68, 92],    // competitive-human, sampled fresh each race
  accuracy:      0.945,       // real strong typists: 94–97%
  startLag:      [350, 1400], // human reaction time, wide variance
  thinkChance:   0.025,       // mid-race pauses
  thinkMs:       [220, 850],
  betweenRaces:  [12000, 45000], // long idle — nobody re-races in 5 seconds every time
  skipRaceChance: 0.08,       // 8% of races: don't type; sit it out (looks like AFK)
  minTextLen:    80,
  maxTextLen:    900,
  keyDownUpMs:   [12, 32],    // slower key hold, more human
  useNitros:     true,
  nitroChance:   0.75,        // per available nitro: 75% chance we fire it this race
  nitroPctRange: [0.15, 0.90],// nitros fire at random positions in this range (not fixed %s)
};

const rand  = (a, b) => a + Math.random() * (b - a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Heuristic: looks like an English race passage (letters, spaces, common punct;
// not JSON, not a URL, not a token).
function looksLikeRaceText(s) {
  if (typeof s !== 'string') return false;
  if (s.length < CFG.minTextLen || s.length > CFG.maxTextLen) return false;
  if (/[{}\[\]<>=]/.test(s)) return false;
  if (!/\s/.test(s)) return false;
  const letters = (s.match(/[a-zA-Z]/g) || []).length;
  return letters / s.length > 0.65;
}

// Walk a parsed JSON blob, return every string that looks like race text.
function findRaceStrings(obj, out = []) {
  if (obj == null) return out;
  if (typeof obj === 'string') { if (looksLikeRaceText(obj)) out.push(obj); return out; }
  if (Array.isArray(obj)) { for (const v of obj) findRaceStrings(v, out); return out; }
  if (typeof obj === 'object') { for (const v of Object.values(obj)) findRaceStrings(v, out); }
  return out;
}

function tryParse(s) { try { return JSON.parse(s); } catch { return null; } }

// ---- CDP key typing --------------------------------------------------------

async function typeViaCDP(client, text, page, nitrosAvailable = 0) {
  const targetWpm = rand(...CFG.wpmRange);
  const baseMs = 60000 / (targetWpm * 5);
  console.log(`[bot] typing ${text.length} chars @ ~${targetWpm.toFixed(0)} WPM (${nitrosAvailable} nitros)`);

  await sleep(rand(...CFG.startLag));
  let prev;
  // Pick random nitro positions this race (not fixed percentages — that's a fingerprint)
  const nitroPositions = new Set();
  if (CFG.useNitros) {
    for (let n = 0; n < nitrosAvailable; n++) {
      if (Math.random() > CFG.nitroChance) continue; // sometimes save a nitro
      const [lo, hi] = CFG.nitroPctRange;
      const pos = Math.floor(text.length * rand(lo, hi));
      nitroPositions.add(pos);
    }
  }
  let nitrosUsed = 0;

  for (let i = 0; i < text.length; i++) {
    if (nitroPositions.has(i)) {
      nitrosUsed++;
      await fireNitroKey(client);
      await sleep(rand(80, 180));
    }

    const ch = text[i];

    if (Math.random() < CFG.thinkChance) await sleep(rand(...CFG.thinkMs));

    if (Math.random() > CFG.accuracy && /[a-z]/i.test(ch)) {
      const shift = Math.random() < 0.5 ? 1 : -1;
      const code  = Math.max(97, Math.min(122, ch.toLowerCase().charCodeAt(0) + shift));
      const wrong = String.fromCharCode(code);
      await sendKey(client, wrong);
      await sleep(delayFor(prev, wrong, baseMs));
      await sleep(rand(60, 220));
      await sendKey(client, 'Backspace');
      await sleep(rand(40, 120));
    }

    await sendKey(client, ch);
    await sleep(delayFor(prev, ch, baseMs));
    prev = ch;
  }
}

async function fireNitroKey(client) {
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
  });
  await sleep(rand(...CFG.keyDownUpMs));
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
  });
  console.log('[bot] nitro fired (Enter)');
}

function delayFor(prev, curr, baseMs) {
  let d = baseMs;
  if (prev === ' ' || prev === undefined) d *= rand(1.15, 1.55);
  if (/[.,;:!?'"()\-]/.test(curr))         d *= rand(1.20, 1.70);
  if (prev && prev.toLowerCase() === curr.toLowerCase()) d *= rand(1.10, 1.35);
  if (prev && /^(th|he|in|er|an|re|on|at|en|nd|ti|es|or)$/i.test(prev + curr)) d *= rand(0.75, 0.95);
  d *= rand(0.75, 1.30);
  return d;
}

async function sendKey(client, key) {
  const holdMs = rand(...CFG.keyDownUpMs);
  if (key === 'Backspace') {
    await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await sleep(holdMs);
    await client.send('Input.dispatchKeyEvent', { type: 'keyUp',   key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    return;
  }
  const code = key === ' ' ? 'Space' : /[a-zA-Z]/.test(key) ? 'Key' + key.toUpperCase() : key;
  const vk   = key.charCodeAt(0);
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyDown', text: key, unmodifiedText: key, key, code, windowsVirtualKeyCode: vk,
  });
  await sleep(holdMs);
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key, code, windowsVirtualKeyCode: vk,
  });
}

// Send a nitro-fire message through the game's own WebSocket.
// Requires the init script that stashes the WS as window.__nt_ws.
async function fireNitroWS(page, { nUsed, tAfter, skip }) {
  const payload = { n: nUsed, t: tAfter, s: skip, k: [[null, 0, null, tAfter]] };
  const frame = '5' + JSON.stringify({ stream: 'race', msg: 'update', payload });
  const sent = await page.evaluate((f) => {
    const ws = window.__nt_ws;
    if (!ws || ws.readyState !== 1) return false;
    ws.send(f);
    return true;
  }, frame).catch(() => false);
  if (sent) console.log(`[bot] nitro fired via WS (n=${nUsed}, t=${tAfter}, s=${skip})`);
  else      console.log(`[bot] nitro WS send failed (no ws ref or not open)`);
  return sent;
}

async function fireNitro(page) {
  const result = await page.evaluate(() => {
    // Find every element whose class/id/data attribute mentions "nitro".
    const all = document.querySelectorAll('*');
    const candidates = [];
    for (const el of all) {
      // Skip ad iframes and anything inside them (nitropay etc.)
      if (el.tagName === 'IFRAME' || el.tagName === 'SCRIPT' || el.tagName === 'LINK') continue;
      if (el.closest('iframe')) continue;
      const cls = el.className?.toString?.() || '';
      const id  = el.id || '';
      const attrs = Array.from(el.attributes || []).map(a => `${a.name}=${a.value}`).join(' ');
      // Must mention nitro in class/id/data-attrs — not just in an ad's src URL
      if (!/nitro/i.test(cls + ' ' + id + ' ' + attrs)) continue;
      // Skip ad-network false positives
      if (/nitropay|ad-container|ad_container|advert/i.test(cls + ' ' + id + ' ' + attrs)) continue;
      candidates.push({
        tag: el.tagName,
        cls, id,
        text: (el.innerText || '').slice(0, 40),
        rect: el.getBoundingClientRect(),
        el,
      });
    }
    // Prefer a visible, clickable one (has size, not disabled).
    const clickable = candidates.filter(c =>
      c.rect.width > 0 && c.rect.height > 0 && !c.el.disabled
    );
    const target = clickable.find(c => c.tag === 'BUTTON') || clickable[0];
    if (target) {
      target.el.click();
      // Also try dispatching a real mouse click at its center for stubborn handlers
      const cx = target.rect.left + target.rect.width / 2;
      const cy = target.rect.top + target.rect.height / 2;
      const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0 };
      target.el.dispatchEvent(new MouseEvent('mousedown', opts));
      target.el.dispatchEvent(new MouseEvent('mouseup', opts));
      target.el.dispatchEvent(new MouseEvent('click', opts));
      return { fired: true, tag: target.tag, cls: target.cls, id: target.id };
    }
    // Nothing fired — return diagnostics for logging.
    return { fired: false, candidates: candidates.slice(0, 20).map(c => ({
      tag: c.tag, cls: c.cls, id: c.id, text: c.text, w: c.rect.width, h: c.rect.height,
    })) };
  }).catch(e => ({ fired: false, error: e.message }));

  if (result.fired) {
    console.log(`[bot] nitro fired: <${result.tag} class="${result.cls}" id="${result.id}">`);
  } else if (result.candidates?.length) {
    console.log(`[bot] nitro NOT fired. Candidates on page:`);
    for (const c of result.candidates) {
      console.log(`   <${c.tag} class="${c.cls}" id="${c.id}" ${c.w}x${c.h}> ${c.text ? '"' + c.text + '"' : ''}`);
    }
  } else if (result.error) {
    console.log(`[bot] nitro error: ${result.error}`);
  } else {
    console.log(`[bot] nitro: no elements matching /nitro/ found in DOM`);
  }
  return result.fired;
}

// ---- main ------------------------------------------------------------------

async function main() {
  // Attach to a real Chrome launched with --remote-debugging-port=9222.
  // Nitro Type detects Playwright's bundled Chromium; a real Chrome doesn't
  // carry those flags, so login and gameplay work normally.
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find(p => p.url().includes('nitrotype')) || ctx.pages()[0] || await ctx.newPage();
  const client = await page.context().newCDPSession(page);

  // Hook the game's WebSocket so we can send nitro messages through it.
  // addInitScript takes effect on next navigation; also inject NOW into the
  // current page in case WS is already open.
  const hookSrc = `
    (function(){
      if (window.__ws_hooked) return;
      window.__ws_hooked = true;
      const OrigWS = window.WebSocket;
      function WrappedWS(url, protocols) {
        const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
        if (typeof url === 'string' && /realtime\\d*ws?\\.nitrotype/.test(url)) {
          window.__nt_ws = ws;
        }
        return ws;
      }
      WrappedWS.prototype = OrigWS.prototype;
      Object.setPrototypeOf(WrappedWS, OrigWS);
      window.WebSocket = WrappedWS;
    })();
  `;
  await page.addInitScript({ content: hookSrc }).catch(() => {});
  await page.evaluate(hookSrc).catch(() => {});
  // Reload once so the hook catches the WS at creation
  await page.goto('https://www.nitrotype.com/race').catch(() => {});

  let currentText = null;
  let raceStatus  = null;
  let typing      = false;
  let nitrosAvail = 0;
  const seen = new Set();

  const handlePayload = (label, raw) => {
    if (!raw) return;
    const s = typeof raw === 'string' ? raw : String(raw);
    if (seen.has(s)) return;
    seen.add(s);

    if (MODE === 'sniff') {
      // Log EVERYTHING so we can see the wire format.
      const preview = s.length > 240 ? s.slice(0, 240) + '…' : s;
      console.log(`[sniff:${label}] (${s.length}b) ${preview}`);
    }

    // Strip common Primus/Socket.IO/Engine.IO prefixes: e.g. `4{...}`, `42["ev",...]`, `~m~123~m~{...}`
    const stripped = s
      .replace(/^~m~\d+~m~/, '')
      .replace(/^\d+(?=[\[{"])/, '')
      .replace(/^\d+\[/, '[');

    const parsed = tryParse(stripped) ?? tryParse(s) ?? s;

    // Race status signal
    if (parsed && typeof parsed === 'object' && parsed.msg === 'status' && parsed.payload?.status) {
      raceStatus = parsed.payload.status;
      console.log(`[bot] race status → ${raceStatus}`);
    }
    // Our own "joined" frame carries nitrosAvailable
    if (parsed && typeof parsed === 'object' && parsed.msg === 'joined' && parsed.payload?.nitrosAvailable != null && !parsed.payload.robot) {
      // Track only frames for our user — the value updates on ours; simplest: keep the max seen this race
      nitrosAvail = Math.max(nitrosAvail, parsed.payload.nitrosAvailable);
      console.log(`[bot] nitros available: ${nitrosAvail}`);
    }

    const hits = findRaceStrings(parsed);
    for (const h of hits) {
      console.log(`\n[MATCH:${label}] race text (${h.length} chars):\n  ${h.slice(0, 200)}${h.length > 200 ? '…' : ''}\n`);
      currentText = h;
    }
  };

  page.on('websocket', ws => {
    console.log('[ws] open:', ws.url());
    ws.on('framereceived', ev => handlePayload('ws-recv', ev.payload?.toString?.() ?? ev.payload));
    ws.on('framesent',     ev => {
      const s = ev.payload?.toString?.() ?? ev.payload;
      if (typeof s === 'string' && s.length < 400) {
        console.log(`[ws-sent] ${s}`);
      }
    });
  });
  page.on('response', async res => {
    const ct = res.headers()['content-type'] || '';
    if (!/json|text|javascript/i.test(ct)) return;
    try { handlePayload('xhr', await res.text()); } catch {}
  });

  await page.goto('https://www.nitrotype.com/race');
  console.log('[bot] browser open. Log in if needed, then click Race.');

  if (MODE === 'sniff') {
    console.log('[bot] SNIFF mode — will log candidate race-text payloads. Play a race manually.');
    return; // keep browser open
  }

  // RUN mode: wait for race text + racing status, then type. Repeat.
  console.log('[bot] RUN mode. Click Race in the Chrome window.');
  while (true) {
    // Wait for both text and status=racing
    const start = Date.now();
    while ((!currentText || raceStatus !== 'racing') && Date.now() - start < 120000) {
      await sleep(150);
    }
    if (!currentText || raceStatus !== 'racing') {
      console.log('[bot] timed out waiting for a race. Retrying.');
      raceStatus = null;
      continue;
    }

    const text = currentText;
    currentText = null;
    typing = true;
    await page.bringToFront();
    const nAvail = nitrosAvail;
    nitrosAvail = 0;
    if (Math.random() < CFG.skipRaceChance) {
      console.log('[bot] SKIP — sitting this race out (looks like AFK).');
      // Let the race play out on its own; we don't type
      await sleep(rand(15000, 35000));
    } else {
      try { await typeViaCDP(client, text, page, nAvail); } catch (e) { console.error('[bot] type error:', e.message); }
    }
    typing = false;

    // Wait for race to end (status flips off 'racing' or new one starts)
    const endWait = Date.now();
    while (raceStatus === 'racing' && Date.now() - endWait < 30000) await sleep(300);
    raceStatus = null;

    const rest = rand(...CFG.betweenRaces);
    console.log(`[bot] race done. Idling ${(rest/1000).toFixed(1)}s before next race.`);
    await sleep(rest);

    // Nitro's "Race Again" button is on canvas — can't click it. Navigate to
    // /race instead; the game re-enters matchmaking cleanly.
    console.log('[bot] navigating to /race for next round...');
    await page.goto('https://www.nitrotype.com/race').catch(e => console.log('[bot] nav error:', e.message));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
