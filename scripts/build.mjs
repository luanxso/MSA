import { readdir, readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const root = process.cwd();
const staticDirectory = path.join(root, 'dist');
const assets = {};
const types = { '.svg': 'image/svg+xml', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (!['server', 'drizzle', '.openai'].includes(entry.name)) await collect(file); continue; }
    const extension = path.extname(entry.name);
    if (!types[extension]) continue;
    const data = await readFile(file);
    const binary = ['.png', '.jpg', '.ttf', '.xlsx'].includes(extension);
    assets[`/${path.relative(staticDirectory, file).split(path.sep).join('/')}`] = { type: types[extension], base64: binary, body: data.toString(binary ? 'base64' : 'utf8') };
  }
}

// Link each page to the current bytes of its scripts and styles, including presentation mode.
for (const entry of await readdir(staticDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
  const file = path.join(staticDirectory, entry.name);
  const html = await readFile(file, 'utf8');
  const references = [...html.matchAll(/(?:src|href)="((?:assets|css|js)\/[^"?]+\.(?:js|css))(?:\?[^" ]*)?"/g)];
  let updated = html;
  for (const match of references) {
    const digest = createHash('sha256').update(await readFile(path.join(staticDirectory, match[1]))).digest('hex').slice(0, 12);
    updated = updated.replace(match[0], match[0].split('=')[0] + '="' + match[1] + '?v=' + digest + '"');
  }
  if (updated !== html) await writeFile(file, updated);
}

await collect(staticDirectory);
const sandbox = { MSA: {} };
sandbox.window = sandbox;
vm.runInNewContext(await readFile('dist/assets/firebase-config.js', 'utf8'), sandbox);
const firebaseConfig = sandbox.MSA.firebaseConfig;
const auth = (await readFile('worker/auth.js', 'utf8')).replace(/^export /gm, '');
const chat = (await readFile('worker/chat.js', 'utf8')).replace(/^import .*;\n/gm, '').replace('export async function handleChatRequest', 'async function handleChatRequest');
const worker = (await readFile('worker/index.js', 'utf8')).replace(/^import .*;\n/gm, '');
const output = `const assets = ${JSON.stringify(assets)};\nconst firebaseConfig = ${JSON.stringify(firebaseConfig)};\n\n${auth}\n${chat}\n${worker}`;
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await writeFile('dist/server/index.js', output);
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
await cp('drizzle', 'dist/drizzle', { recursive: true });
console.log(`Build complete: ${Object.keys(assets).length} static assets, chat Worker and D1 migrations.`);
