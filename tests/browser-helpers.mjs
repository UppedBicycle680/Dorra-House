import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {SUPABASE_URL} from '../online-config.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const origin = 'https://uppedbicycle680.github.io';
export const baseURL = `${origin}/Dorra-House/`;
export const supabaseHost = new URL(SUPABASE_URL).hostname;
export const responseHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': origin,
  'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version',
  'access-control-allow-methods': 'GET,POST,PUT,OPTIONS'
};

export async function launchBrowser() {
  const executablePath = process.env.DORRA_CHROMIUM_PATH ||
    (await fs.access('/usr/bin/chromium').then(() => '/usr/bin/chromium', () => undefined));
  return chromium.launch({headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage']});
}

// Serve the real source at its GitHub Pages subpath without opening a socket or
// contacting GitHub. Each test intercepts Supabase requests separately.
export async function serveSource(route, harness = null) {
  const url = new URL(route.request().url());
  if (url.origin !== origin || !url.pathname.startsWith('/Dorra-House/')) {
    await route.abort();
    return;
  }
  const relative = decodeURIComponent(url.pathname.slice('/Dorra-House/'.length));
  if (relative === '__vault-harness.html' && harness !== null) {
    await route.fulfill({status: 200, contentType: 'text/html', body: harness});
    return;
  }
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) throw new Error('Invalid static path');
  const contentType = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}[path.extname(file)] || 'application/octet-stream';
  try {
    await route.fulfill({status: 200, contentType, body: await fs.readFile(file)});
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await route.fulfill({status: 404, body: ''});
  }
}
