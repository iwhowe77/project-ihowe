// Take desktop and mobile screenshots of the site.
//
//   npm run screenshots                      # build the site, serve dist/, shoot every page
//   npm run screenshots -- https://<preview>.pages.dev   # shoot an already-deployed site
//
// Images land in screenshots/ (gitignored) as <page>-desktop.png / <page>-mobile.png.
// The GitHub Action in .github/workflows/screenshots.yml runs this same script on PRs.

import { createServer } from 'node:http';
import { readFile, readdir, mkdir, stat, writeFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const OUT_DIR = process.env.SCREENSHOT_DIR || 'screenshots';
const DIST = 'dist';
// Pages to try against a remote URL. Missing ones (404) are skipped.
const DEFAULT_PATHS = ['/', '/now/', '/offers/', '/homeCooking/'];

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  // iPhone 13/14-sized.
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
};

async function htmlPages(dir) {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) paths.push(...(await htmlPages(full)));
    else if (entry.name === 'index.html') {
      const rel = relative(DIST, dir).split('\\').join('/');
      paths.push(rel ? `/${rel}/` : '/');
    }
  }
  return paths.sort();
}

function serveDist() {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.includes('..')) return res.writeHead(400).end();
    let file = join(DIST, p);
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const slug = (path) => (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-'));

async function main() {
  const remote = process.argv[2];
  let base, paths, server;

  if (remote) {
    base = remote.replace(/\/$/, '');
    paths = DEFAULT_PATHS;
  } else {
    if (!process.env.SKIP_BUILD) execSync('npm run build', { stdio: 'inherit' });
    server = await serveDist();
    base = `http://127.0.0.1:${server.address().port}`;
    paths = await htmlPages(DIST);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const shot = [];
  try {
    for (const [name, options] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      for (const path of paths) {
        const response = await page.goto(base + path, { waitUntil: 'networkidle' });
        if (!response || response.status() >= 400) {
          console.log(`skip ${path} (${response?.status()})`);
          continue;
        }
        const file = join(OUT_DIR, `${slug(path)}-${name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        shot.push({ path, viewport: name, file });
        console.log(`saved ${file}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server?.close();
  }
  // Manifest for the GitHub Action's PR comment.
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(shot, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
