// Plimbare prin site: intră, derulează pe fiecare secțiune și face captură.
// Rulare: node scripts/tour.mjs [url] [desktop|mobile] [webkit|chromium]
import { chromium, webkit } from 'playwright'
const [url = 'http://localhost:3030', mode = 'desktop', eng = 'chromium'] = process.argv.slice(2)
const vp = mode === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 }
const browser = await (eng === 'webkit' ? webkit : chromium).launch({ args: eng === 'chromium' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] })
const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(3500)
await page.screenshot({ path: `.preview/${mode}-0-loader.png` })
await page.click('#enter .btn-ghost')
await page.waitForTimeout(2500)
const n = 8
for (let i = 0; i < n; i++) {
  await page.evaluate((i) => {
    const max = document.documentElement.scrollHeight - innerHeight
    window.scrollTo(0, (max * i) / 7)
  }, i)
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `.preview/${mode}-${i + 1}.png` })
}
console.log('ERORI:', errs.filter((e) => !/glb|404|Unexpected token|JSON/i.test(e)).slice(0, 10))
await browser.close()
