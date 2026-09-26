/**
 * Phone-viewport screenshot harness for the Android/phone presentation layer.
 *
 * Runs the dev server's workspace at Pixel-class dimensions with a stubbed
 * identity provider and a fixed note set, so a change to the phone chrome can
 * be seen rather than argued about. Usage:
 *   node scripts/phoneShots.mjs <baseUrl> <outDir> [route:name ...]
 *
 * Environment:
 *   PHONE_FONT_SCALE=2   render as Android does with the largest system font
 *                        size (WebView text zoom scales the root font size);
 *   PHONE_STRICT=1       exit 1 on horizontal overflow or a page error, so the
 *                        audit can gate CI (#490).
 */
import { openPhone } from './phoneHarness.mjs';

const [base = 'http://127.0.0.1:5188', out = '/tmp/phone-shots', ...rest] = process.argv.slice(2);
const FONT_SCALE = Number(process.env.PHONE_FONT_SCALE || 1);
const STRICT = process.env.PHONE_STRICT === '1';
let failures = 0;
const targets = (rest.length ? rest : [
  '/app/dashboard:dashboard', '/app/notes:notes', '/app/marketplace:marketplace',
]).map((t) => { const i = t.lastIndexOf(':'); return [t.slice(0, i), t.slice(i + 1)]; });

const { browser, page, errors, settle, layoutReport } = await openPhone({ fontScale: FONT_SCALE });

for (const [route, name] of targets) {
  // "path!Tap text" taps that text after the route settles, so a detail screen
  // can be captured without a second harness.
  const [path, tap] = route.split('!');
  await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  await settle();
  if (tap) {
    // "@Label" taps by accessible name; anything else by visible text.
    const target = tap.startsWith('@')
      ? page.getByRole('button', { name: tap.slice(1) })
      : page.getByText(tap, { exact: false });
    await target.first().click({ timeout: 10000 }).catch((e) => console.log('  tap failed:', e.message.split('\n')[0]));
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  const report = await layoutReport();
  console.log(`\n### ${name}  ${route}`);
  if (report.overflow.length) { failures += 1; console.log('  OVERFLOW  ', report.overflow.join('\n             ')); }
  if (report.small.length) console.log('  <44px      ', report.small.join(', '));
}
if (errors.length) { failures += 1; console.log('\nPAGE ERRORS:', [...new Set(errors)].slice(0, 6)); }
await browser.close();
if (STRICT && failures) {
  console.error(`\nPhone audit failed: ${failures} problem(s) at font scale ${FONT_SCALE}.`);
  process.exit(1);
}
