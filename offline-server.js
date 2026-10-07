const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {createHash} = require('crypto');
const {spawn} = require('child_process');

const root = __dirname, host = '127.0.0.1';
const port = Number(process.env.DORRA_PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('DORRA_PORT must be a port between 1024 and 65535.');
const origin = `http://${host}:${port}`;
const installation = createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0, 20);
const dataDirectory = process.env.DORRA_AIRPORT_DATA_DIR || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'DorraHouse', 'airports');
const resolvedData = path.resolve(dataDirectory);
if (resolvedData === root || resolvedData.startsWith(root + path.sep)) throw new Error('Airport saves must be outside the website directory.');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.mp3':'audio/mpeg','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream'};
let servicePromise, airportService, startupError, stopping = false;

function json(response, status, value) {
  response.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  response.end(JSON.stringify(value));
}
async function readBody(request) {
  if (!(request.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('Use an application/json request.'), {status:415});
  let size = 0, chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) throw Object.assign(new Error('Airport request is too large.'), {status:413});
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON request.'), {status:400}); }
}
const server = http.createServer(async (request, response) => {
  if (request.headers.host !== `${host}:${port}`) { json(response, 403, {error:'Use the local address printed by START DORRA GAME.'}); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, origin).pathname); }
  catch { json(response, 400, {error:'Bad request'}); return; }
  if (pathname.includes('\0') || pathname.includes('\\')) { json(response, 400, {error:'Invalid path'}); return; }
  if (pathname === '/api/airport/health' && request.method === 'GET') {
    json(response, 200, {app:'dorra-house', version:1, installation, ready:!!airportService, error:startupError?.message || null}); return;
  }
  if (pathname.startsWith('/api/airport/')) {
    if (request.method !== 'POST') { json(response, 405, {error:'This operation requires POST.'}); return; }
    if (request.headers.origin !== origin || request.headers['sec-fetch-site'] === 'cross-site') { json(response, 403, {error:'Airport commands must come from the local Dorra game.'}); return; }
    try {
      const body = await readBody(request);
      if (!servicePromise) throw Object.assign(new Error('The local airport server is starting. Please retry.'), {status:503});
      const service = await servicePromise;
      json(response, 200, await service.handle(pathname.slice('/api/airport/'.length), body));
    } catch (error) { json(response, error.status || 400, {error:error.message || 'Airport operation failed.', code:error.code || 'AIRPORT_ERROR'}); }
    return;
  }
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end('Method not allowed'); return; }
  if (pathname === '/') pathname = '/index.html';
  const relative = pathname.replace(/^\/+/, ''), segments = relative.split(/[\\/]/), ext = path.extname(relative).toLowerCase();
  const normalized = segments.join('/').toLowerCase();
  const protectedPath = segments.some(part => part.startsWith('.')) || ['tmp','output'].includes(segments[0].toLowerCase()) || /(?:regression|test)\.(?:m?js)$/.test(normalized) || ['offline-server.js','airport/server.mjs','airport/store.mjs'].includes(normalized);
  if (protectedPath || !mime[ext]) { response.writeHead(404); response.end('Not found'); return; }
  const target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(root + path.sep)) { response.writeHead(403); response.end('Forbidden'); return; }
  fs.realpath(target, (realError, realTarget) => {
    if (realError || !realTarget.startsWith(root + path.sep)) { response.writeHead(404); response.end('Not found'); return; }
    fs.stat(realTarget, (error, stat) => {
      if (error || !stat.isFile()) { response.writeHead(404); response.end('Not found'); return; }
      response.writeHead(200, {'Content-Type':mime[ext],'Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      if (request.method === 'HEAD') response.end(); else fs.createReadStream(realTarget).pipe(response);
    });
  });
});
function openGame() {
  if (process.env.DORRA_NO_OPEN === '1') return;
  if (process.platform === 'win32') spawn('cmd.exe', ['/c','start','',origin], {detached:true, stdio:'ignore', windowsHide:true}).unref();
}
server.on('error', async error => {
  if (error.code === 'EADDRINUSE') {
    try {
      const existing = await fetch(`${origin}/api/airport/health`, {signal:AbortSignal.timeout(2500)}).then(response => response.json());
      if (existing.app === 'dorra-house' && existing.installation === installation && existing.version === 1) {
        console.log(`Dorra House is already running at ${origin}. Reusing your existing server and save.`); openGame(); return;
      }
    } catch {}
    console.error(`Port ${port} is already in use. Close the old Dorra server or the program using that port, then restart. The port was not changed, so your browser save stays at its original address.`);
  } else console.error(error.message);
  process.exitCode = 1;
});
async function stop() {
  if (stopping) return; stopping = true;
  server.close();
  await airportService?.close();
  process.exit(0);
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
server.listen(port, host, () => {
  servicePromise = import('./airport/server.mjs').then(({createAirportService}) => createAirportService({directory:dataDirectory}));
  servicePromise.then(service => { airportService = service; }, error => { startupError = error; console.error(`Airports: ${error.message}`); });
  console.log('DO NOT CLOSE THIS WINDOW WHILE PLAYING.');
  console.log(`Dorra House is running offline at ${origin}`);
  console.log('Airport progress is saved by this local server. Reopening calculates up to 24 hours away.');
  console.log('When finished, press Ctrl+C to stop the server safely.');
  openGame();
});
