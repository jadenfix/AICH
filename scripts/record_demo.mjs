import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const output = join(root, 'docs', 'demo');
const temporary = await mkdtemp(join(tmpdir(), 'aich-record-'));
await mkdir(output, { recursive: true });
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
if (dirty) throw new Error(`Refusing to record from a dirty tracked checkout:\n${dirty}`);

const child = spawn('python', ['app.py', '--port', '0', '--db', join(temporary, 'workspace.sqlite3')], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});
const url = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.stdout.once('data', chunk => resolve(chunk.toString().trim().split(' ').at(-1)));
});
const browser = await chromium.launch({ headless: true, executablePath: process.env.AICH_BROWSER_PATH || undefined });

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: temporary, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  const pause = ms => page.waitForTimeout(ms);
  await page.goto(url, { waitUntil: 'networkidle' });
  await pause(1500);
  await page.selectOption('#asset', 'ETH');
  await page.getByText('Ethereum / ETH').waitFor();
  await pause(1400);
  await page.selectOption('#asset', 'SOL');
  await page.getByText('Solana / SOL').waitFor();
  await pause(1500);
  await page.locator('details summary').click();
  await pause(1300);
  await page.locator('.bottom').scrollIntoViewIfNeeded();
  await pause(1000);
  await page.locator('input[name=author]').fill('Fixture analyst');
  await page.locator('textarea[name=body]').fill('Compare volatility with drawdown before treating a synthetic pattern as evidence.');
  await pause(800);
  await page.locator('#post-form button').click();
  await page.getByText('Saved to your local workspace.').waitFor();
  await pause(1600);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.bottom').scrollIntoViewIfNeeded();
  await page.getByText('Compare volatility with drawdown before treating a synthetic pattern as evidence.', { exact: true }).waitFor();
  await pause(1600);
  await page.getByRole('button', { name: 'Delete note by Fixture analyst' }).click();
  await page.getByText('Note deleted from your local workspace.').waitFor();
  await pause(1500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.bottom').scrollIntoViewIfNeeded();
  await page.getByText('No saved notes in this local workspace.', { exact: true }).waitFor();
  await pause(1600);
  await page.screenshot({ path: join(output, 'aich-workspace-poster.png') });
  const video = page.video();
  await context.close();
  const rawPath = await video.path();
  await rename(rawPath, join(temporary, 'capture.webm'));
} finally {
  await browser.close();
  child.kill('SIGTERM');
  await new Promise(resolve => child.once('exit', resolve));
}

const raw = join(temporary, 'capture.webm');
const mp4 = join(output, 'aich-workspace.mp4');
const gif = join(output, 'aich-workspace.gif');
const palette = join(temporary, 'palette.png');
for (const args of [
  ['-y', '-i', raw, '-vf', 'scale=960:-2:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
  ['-y', '-i', raw, '-vf', 'fps=10,scale=960:-2:flags=lanczos,palettegen=max_colors=128:stats_mode=diff', palette],
  ['-y', '-i', raw, '-i', palette, '-lavfi', 'fps=10,scale=960:-2:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', gif],
]) {
  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed with ${result.status}`);
}

const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourcePaths = ['app.py', 'static/app.js', 'static/index.html', 'static/style.css', 'scripts/browser_e2e.mjs', 'scripts/record_demo.mjs'];
const sourceBlobs = Object.fromEntries(sourcePaths.map(path => [
  path,
  execFileSync('git', ['rev-parse', `${sourceCommit}:${path}`], { cwd: root, encoding: 'utf8' }).trim(),
]));
const artifacts = {};
for (const name of ['aich-workspace.gif', 'aich-workspace.mp4', 'aich-workspace-poster.png']) {
  const bytes = await readFile(join(output, name));
  artifacts[name] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await writeFile(join(output, 'capture.json'), JSON.stringify({
  schema: 'aich-demo/v1',
  scope: 'Provider-free synthetic fixture; local SQLite note lifecycle; no live market, model, wallet or trading path.',
  source_commit: sourceCommit,
  source_blobs: sourceBlobs,
  artifacts,
}, null, 2) + '\n');
await rm(temporary, { recursive: true, force: true });
console.log(`Recorded AICH demo from ${sourceCommit}`);
