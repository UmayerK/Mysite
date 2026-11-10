#!/usr/bin/env node
// Headless screenshot helper for visual QA.
//
//   node scripts/shot.mjs --url /x/seam --out .shots/seam.png
//   node scripts/shot.mjs --url /x/seam --out .shots/seam-m.png --mobile
//   node scripts/shot.mjs --url / --out .shots/hub.png --wait 4000 --script scripts/my-steps.mjs
//
// Flags: --url <path>  --out <png>  --mobile  --w <px> --h <px> --dpr <n>
//        --wait <ms after load, default 2500>  --full (full-page)  --reduced (prefers-reduced-motion)
//        --script <file.mjs>  default export: async ({ page, shot }) => {...}; runs before the final
//                             capture. shot('name') saves an extra frame next to --out.
// Console errors, uncaught exceptions and failed requests are printed; exit code 1 if any occurred.
import { chromium } from 'playwright'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const base = process.env.BASE ?? 'http://127.0.0.1:5173'
const url = opt('url', '/')
const out = resolve(opt('out', '.shots/shot.png'))
const mobile = flag('mobile')
const width = Number(opt('w', mobile ? 390 : 1440))
const height = Number(opt('h', mobile ? 844 : 900))
const dpr = Number(opt('dpr', mobile ? 2 : 1))
const wait = Number(opt('wait', 2500))
const script = opt('script')

mkdirSync(dirname(out), { recursive: true })

const cached = process.env.SHOT_SHELL
  ? join(homedir(), '.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux-arm64/chrome-headless-shell')
  : join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux-arm64/chrome')
const browser = await chromium.launch({
  executablePath: existsSync(cached) ? cached : undefined,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--disable-accelerated-2d-canvas',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ],
})
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: dpr,
  isMobile: mobile,
  hasTouch: mobile,
  reducedMotion: flag('reduced') ? 'reduce' : 'no-preference',
  permissions: ['microphone'],
})
const page = await context.newPage()

let problems = 0
page.on('console', (m) => {
  if (m.type() === 'error') {
    problems++
    console.log(`[console.error] ${m.text()}`)
  } else if (m.type() === 'warning' && !/GPU stall|swiftshader|WebGL.*software/i.test(m.text())) {
    console.log(`[console.warn] ${m.text()}`)
  }
})
page.on('pageerror', (e) => {
  problems++
  console.log(`[pageerror] ${e.message}`)
})
page.on('requestfailed', (r) => {
  problems++
  console.log(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`)
})

await page.goto(base + url, { waitUntil: 'load' })
await page.waitForTimeout(wait)

// Software WebGL can starve the compositor so badly that a capture never completes, so
// requestAnimationFrame loops are parked for the duration of each screenshot and resumed after.
const freeze = () =>
  page.evaluate(() => {
    window.__raf ??= window.requestAnimationFrame.bind(window)
    window.__parked = []
    window.requestAnimationFrame = (cb) => (window.__parked.push(cb), 0)
  })
const thaw = () =>
  page.evaluate(() => {
    if (!window.__raf) return
    window.requestAnimationFrame = window.__raf
    const parked = window.__parked ?? []
    window.__parked = []
    for (const cb of parked) window.__raf(cb)
  })
const capture = async (file, fullPage = false) => {
  await freeze()
  await page.waitForTimeout(250)
  await page.screenshot({ path: file, fullPage, timeout: 120000 })
  await thaw()
  console.log(`saved ${file}`)
}

const shot = (name) => capture(out.replace(/\.png$/, `-${name}.png`))

if (script) {
  const mod = await import(pathToFileURL(resolve(script)).href)
  await mod.default({ page, shot, context })
}

await capture(out, flag('full'))
await browser.close()
process.exit(problems ? 1 : 0)
