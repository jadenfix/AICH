import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const temporary = await mkdtemp(join(tmpdir(), 'aich-browser-'));
const output = join(root, 'artifacts');
await mkdir(output, { recursive: true });

function startServer() {
  const child = spawn('python', ['app.py', '--port', '0', '--db', join(temporary, 'workspace.sqlite3')], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.once('data', chunk => resolve({ child, url: chunk.toString().trim().split(' ').at(-1) }));
  });
}

const { child, url } = await startServer();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AICH_BROWSER_PATH || undefined,
});

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  desktop.on('pageerror', error => pageErrors.push(error.message));
  await desktop.goto(url, { waitUntil: 'networkidle' });
  await desktop.selectOption('#asset', 'ETH');
  await desktop.getByText('Ethereum / ETH').waitFor();
  assert.match(await desktop.locator('#volatility').textContent(), /%$/);
  await desktop.locator('details summary').click();
  assert.equal(await desktop.locator('details').getAttribute('open'), '');

  const author = 'Researcher <img src=x onerror=globalThis.__aichXss=true>';
  const body = '<script>globalThis.__aichXss=true</script> Compare volatility with drawdown before drawing a conclusion.';
  await desktop.locator('input[name=author]').fill(author);
  await desktop.locator('textarea[name=body]').fill(body);
  await desktop.locator('#post-form button').click();
  await desktop.getByText('Saved to your local workspace.').waitFor();
  await desktop.getByText(body, { exact: true }).waitFor();
  assert.equal(await desktop.evaluate(() => globalThis.__aichXss), undefined);

  await desktop.reload({ waitUntil: 'networkidle' });
  await desktop.getByText(body, { exact: true }).waitFor();
  await desktop.getByRole('button', { name: `Delete note by ${author}` }).click();
  await desktop.getByText('Note deleted from your local workspace.').waitFor();
  assert.equal(await desktop.getByText(body, { exact: true }).count(), 0);
  await desktop.reload({ waitUntil: 'networkidle' });
  assert.equal(await desktop.getByText(body, { exact: true }).count(), 0);
  await desktop.getByText('No saved notes in this local workspace.', { exact: true }).waitFor();
  await desktop.screenshot({ path: join(output, 'desktop.png'), fullPage: true });
  assert.deepEqual(pageErrors, []);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await mobile.goto(url, { waitUntil: 'networkidle' });
  await mobile.selectOption('#asset', 'SOL');
  await mobile.getByText('Solana / SOL').waitFor();
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.ok(overflow <= 0, `mobile horizontal overflow: ${overflow}px`);
  await mobile.screenshot({ path: join(output, 'mobile.png'), fullPage: true });
  console.log('Browser E2E passed: asset switching, methodology, safe note persistence, deletion persistence, desktop/mobile layout.');
} finally {
  await browser.close();
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
  await rm(temporary, { recursive: true, force: true });
}
