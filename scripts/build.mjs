import {readdir, readFile, writeFile, mkdir, rm, copyFile, stat, access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {availableParallelism} from 'node:os';
import sharp from 'sharp';
import {build as bundle} from 'esbuild';

const root = path.resolve(import.meta.dirname, '..');
const destination = path.join(root, 'dist');
const cache = path.join(root, 'work/build-cache/webp-q95-v1');
const publicFolders = new Set(['assets', 'airport', 'football', 'vendor']);
const ignoredFolders = new Set(['qa', 'work', 'node_modules', '.git']);
const ignoredFiles = new Set(['offline-server.js', 'save-worker.js', 'server.mjs', 'store.mjs', 'vault-bridge.mjs']);
const textExtensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.geojson', '.svg', '.txt']);
const fileExtensions = new Set([...textExtensions, '.png', '.webp', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.wav', '.ogg', '.mp4']);
const sizeLimit = 900 * 1024 * 1024;
// This legacy upstream PNG has an invalid IDAT stream. Its newer image already
// used by the car catalog depicts the same Taycan trim and Volcano Grey paint.
// Keep both original sources untouched and substitute only the published file.
const knownArtworkFallbacks = new Map([
  ['assets/cars/matrix/porschetaycan-t0-volcanogrey-standard.png', 'assets/cars/imagegen-matrix-v2/porschetaycan-t0-volcanogrey-standard.png']
]);
const artworkFallbacks = [];
const jobs = Math.max(1, Math.min(4, availableParallelism()));
sharp.concurrency(1);
sharp.cache({memory: 32, files: 0, items: 64});

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function collect(relative = '') {
  const found = [];
  for (const item of await readdir(path.join(root, relative), {withFileTypes: true})) {
    const next = path.join(relative, item.name);
    if (item.isDirectory()) {
      if (ignoredFolders.has(item.name) || (!relative && !publicFolders.has(item.name))) continue;
      found.push(...await collect(next));
    } else if (item.isFile() && !ignoredFiles.has(item.name) && fileExtensions.has(path.extname(item.name).toLowerCase())) {
      // Package metadata, credentials and migrations never form part of Pages.
      if (!relative && !['.html', '.css', '.js', '.mjs', '.ico'].includes(path.extname(item.name).toLowerCase())) continue;
      found.push(next);
    }
  }
  return found.sort();
}

function rewriteImages(source) {
  // Local literal and dynamically assembled PNG paths are all converted. Keep
  // external reference/citation URLs unchanged: their servers still serve PNG.
  const external = source.match(/https?:\/\/[^\s'"<>`)]+/g) || [];
  let result = source.replace(/\.png\b/gi, '.webp');
  for (const url of external) result = result.replaceAll(url.replace(/\.png\b/gi, '.webp'), url);
  return result;
}

const sourceFiles = await collect();
const pngFiles = sourceFiles.filter(file => /\.png$/i.test(file));
const convertedTargets = new Set(pngFiles.map(file => file.replace(/\.png$/i, '.webp')));
let converted = 0, cached = 0, beforeBytes = 0, afterBytes = 0;
const optimizations = new Map();
await rm(destination, {recursive: true, force: true});
await mkdir(destination, {recursive: true});
await mkdir(cache, {recursive: true});

async function publish(relative) {
  const original = path.join(root, relative);
  if (/\.webp$/i.test(relative) && convertedTargets.has(relative)) return;
  const published = path.join(destination, relative.replace(/\.png$/i, '.webp'));
  await mkdir(path.dirname(published), {recursive: true});
  if (/\.png$/i.test(relative)) {
    const bytes = await readFile(original);
    const key = createHash('sha256').update(bytes).digest('hex');
    const optimized = path.join(cache, `${key}.webp`);
    let optimization = optimizations.get(key);
    if (!optimization) {
      optimization = (async () => {
        if (await exists(optimized)) { cached++; return optimized; }
        try {
          await sharp(bytes, {animated: true}).webp({quality: 95, alphaQuality: 100, effort: 4}).toFile(optimized);
          return optimized;
        } catch (cause) {
          const fallback = knownArtworkFallbacks.get(relative);
          if (!fallback) throw cause;
          const substitute = await readFile(path.join(root, fallback));
          const fallbackKey = createHash('sha256').update(bytes).update(substitute).digest('hex');
          const recovered = path.join(cache, `${fallbackKey}.webp`);
          if (await exists(recovered)) cached++;
          else await sharp(substitute, {animated: true}).webp({quality: 95, alphaQuality: 100, effort: 4}).toFile(recovered);
          artworkFallbacks.push({source: relative, replacement: fallback, reason: 'Upstream PNG has a corrupt IDAT stream.'});
          console.warn(`Published artwork fallback: ${relative} uses ${fallback}; original source is unchanged.`);
          return recovered;
        }
      })();
      optimizations.set(key, optimization);
    } else cached++;
    let encoded;
    try { encoded = await optimization; }
    catch (cause) { throw new Error(`Could not optimize ${relative}: ${cause.message}`, {cause}); }
    await copyFile(encoded, published);
    beforeBytes += bytes.length;
    afterBytes += (await stat(published)).size;
    converted++;
    if (converted % 100 === 0) console.log(`Optimized ${converted}/${pngFiles.length} PNG assets.`);
  } else if (textExtensions.has(path.extname(relative).toLowerCase())) {
    await writeFile(published, rewriteImages(await readFile(original, 'utf8')));
  } else await copyFile(original, published);
}

let cursor = 0;
await Promise.all(Array.from({length: jobs}, async () => {
  while (cursor < sourceFiles.length) await publish(sourceFiles[cursor++]);
}));

await bundle({
  stdin: {contents: "export {createClient} from '@supabase/supabase-js';", resolveDir: root, sourcefile: 'supabase-client-entry.js'},
  bundle: true, format: 'esm', platform: 'browser', target: ['es2022'], minify: true,
  legalComments: 'eof', outfile: path.join(destination, 'vendor/supabase/supabase.js')
});
await writeFile(path.join(destination, '.nojekyll'), '');

async function publishedSize(directory) {
  let size = 0;
  for (const item of await readdir(directory, {withFileTypes: true})) {
    const file = path.join(directory, item.name);
    size += item.isDirectory() ? await publishedSize(file) : (await stat(file)).size;
  }
  return size;
}
const size = await publishedSize(destination);
if (size > sizeLimit) throw new Error(`Published site is ${(size / 1024 ** 2).toFixed(1)} MiB; GitHub Pages build budget is 900 MiB.`);
const mib = value => (value / 1024 ** 2).toFixed(1);
await writeFile(path.join(destination, 'build-report.json'), JSON.stringify({
  publishedBytes: size, pngAssets: converted, originalPngBytes: beforeBytes, publishedWebpBytes: afterBytes,
  imageQuality: 95, preservesDimensions: true, artworkFallbacks
}, null, 2));
console.log(`Published dist: ${mib(size)} MiB. Converted ${converted} PNGs (${cached} cached), ${mib(beforeBytes)} → ${mib(afterBytes)} MiB at original dimensions, WebP quality 95.`);
