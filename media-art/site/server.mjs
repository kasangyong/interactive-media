// media-art 팀 갤러리 — 로컬 서버 (외부 의존성 없음)
//   npm run media:gallery        → http://127.0.0.1:5190
// 업로드한 파일은 media-art/gallery/<시각>-<제목>/ 에 저장되고, autocommit 이 커밋·푸시한다.
// 다른 팀원은 git pull 만 하면 자기 로컬 갤러리에서 같은 목록을 본다.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');   // media-art/
// GALLERY_DIR 로 저장 위치를 바꿀 수 있다(테스트용)
const GALLERY = process.env.GALLERY_DIR ? resolve(process.env.GALLERY_DIR) : join(ROOT, 'gallery');
const PORT = Number(process.env.PORT || 5190);
const HOST = '127.0.0.1';
const MAX_FILE = 45 * 1024 * 1024;   // GitHub 은 50MB 이상 파일에 경고, 100MB 이상은 거부
const MAX_FILES = 6;
const THEMES = ['숲', '바다', '우주', '꽃밭', '기타'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
};
const UPLOADABLE = new Set(['.html', '.mp4', '.webm', '.mov', '.gif', '.png', '.jpg', '.jpeg', '.webp']);
const KIND = (ext) => (ext === '.html' ? 'html' : ['.mp4', '.webm', '.mov'].includes(ext) ? 'video' : 'image');

const json = (res, code, body) => { res.writeHead(code, { 'content-type': TYPES['.json'] }); res.end(JSON.stringify(body)); };
/** 경로 조작(../) 차단: ROOT 안의 파일만 */
const safePath = (rel) => { const p = resolve(ROOT, '.' + sep + rel); return p.startsWith(ROOT + sep) || p === ROOT ? p : null; };
const exists = (p) => stat(p).then(() => true, () => false);
const slug = (s) => s.normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'untitled';
const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; };

/** 공식 결과물: 현재 작품, 시안, 렌더(renders/<작품>/) */
async function officialItems() {
  const items = [
    { id: 'official-index', official: true, title: '추상의 네 장면 (현재 작품)', author: 'Codex · Claude', theme: '기타', note: '숲·바다·우주·꽃밭 48초 × 4. 손(마우스)으로 반응합니다.', files: [{ name: 'index.html', url: '/files/index.html', kind: 'html' }], preview: '/files/shots/r10/sheet.jpg' },
    { id: 'official-v2', official: true, title: 'Claude 시안 v2', author: 'Claude', theme: '기타', note: '비교용 시안', files: [{ name: 'claude-v2.html', url: '/files/claude-v2.html', kind: 'html' }], preview: null },
  ];
  const names = { forest: ['숲', '숨을 쉬는 숲'], sea: ['바다', '조류의 기억'], space: ['우주', '중력의 편지'], flower: ['꽃밭', '피었다 지는 시간'] };
  for (const [key, [theme, title]] of Object.entries(names)) {
    const dir = join(ROOT, 'renders', key);
    if (!(await exists(dir))) continue;
    const files = [];
    for (const f of [`${key}.mp4`, 'preview.mp4', 'highlight.gif', 'act1.jpg', 'act2.jpg', 'act3.jpg']) {
      if (await exists(join(dir, f))) files.push({ name: f, url: `/files/renders/${key}/${f}`, kind: KIND(extname(f)) });
    }
    if (files.length) items.push({ id: `render-${key}`, official: true, title: `${title} — 렌더`, author: '자동 렌더', theme, note: '48초 원본 MP4(렌더한 PC에만) · 2막 미리보기 MP4·GIF · 막별 스틸', files, preview: files.find((f) => f.name === 'highlight.gif')?.url ?? files.find((f) => f.kind === 'image')?.url ?? null });
  }
  return items;
}

async function galleryItems() {
  if (!(await exists(GALLERY))) return [];
  const out = [];
  for (const d of await readdir(GALLERY, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    try {
      const meta = JSON.parse(await readFile(join(GALLERY, d.name, 'meta.json'), 'utf8'));
      const files = meta.files.map((f) => ({ ...f, url: `/files/gallery/${encodeURIComponent(d.name)}/${encodeURIComponent(f.name)}` }));
      const pv = files.find((f) => f.kind === 'image') ?? files.find((f) => f.kind === 'video');
      out.push({ ...meta, id: d.name, official: false, files, preview: pv?.url ?? null });
    } catch { /* meta.json 이 없거나 깨진 폴더는 건너뜀 */ }
  }
  return out.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? ''));
}

async function handleUpload(req, res) {
  const len = Number(req.headers['content-length'] || 0);
  if (len > MAX_FILE * MAX_FILES + 1e6) return json(res, 413, { error: `전체 용량이 너무 큽니다 (파일당 ${MAX_FILE / 1048576}MB, 최대 ${MAX_FILES}개)` });
  let form;
  try {
    form = await new Request('http://local/upload', { method: 'POST', headers: req.headers, body: req, duplex: 'half' }).formData();
  } catch {
    return json(res, 400, { error: '업로드 형식을 읽지 못했습니다' });
  }
  const title = String(form.get('title') || '').trim().slice(0, 80);
  const author = String(form.get('author') || '').trim().slice(0, 40);
  const theme = THEMES.includes(String(form.get('theme'))) ? String(form.get('theme')) : '기타';
  const note = String(form.get('note') || '').trim().slice(0, 600);
  const files = form.getAll('files').filter((f) => typeof f === 'object' && f.size > 0);
  if (!title || !author) return json(res, 400, { error: '제목과 작성자를 입력해 주세요' });
  if (!files.length) return json(res, 400, { error: '파일을 하나 이상 올려 주세요' });
  if (files.length > MAX_FILES) return json(res, 400, { error: `파일은 최대 ${MAX_FILES}개까지입니다` });
  for (const f of files) {
    const ext = extname(f.name).toLowerCase();
    if (!UPLOADABLE.has(ext)) return json(res, 400, { error: `${f.name}: 올릴 수 없는 형식입니다 (html, mp4, webm, mov, gif, png, jpg, webp)` });
    if (f.size > MAX_FILE) return json(res, 400, { error: `${f.name}: ${MAX_FILE / 1048576}MB를 넘습니다. 영상은 줄여서 올려 주세요` });
  }
  const id = `${stamp()}-${slug(title)}`;
  const dir = join(GALLERY, id);
  await mkdir(dir, { recursive: true });
  const saved = [];
  for (const f of files) {
    const ext = extname(f.name).toLowerCase();
    let name = `${slug(f.name.slice(0, -ext.length))}${ext}`;
    if (saved.some((s) => s.name === name)) name = `${saved.length}-${name}`;
    await writeFile(join(dir, name), Buffer.from(await f.arrayBuffer()));
    saved.push({ name, kind: KIND(ext), size: f.size });
  }
  const meta = { title, author, theme, note, created: new Date().toISOString(), files: saved };
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  json(res, 200, { ok: true, id });
}

/** 정적 파일 (영상 탐색을 위한 Range 지원) */
async function serveFile(req, res, p) {
  let st;
  try { st = await stat(p); } catch { res.writeHead(404).end('not found'); return; }
  if (!st.isFile()) { res.writeHead(404).end('not found'); return; }
  const type = TYPES[extname(p).toLowerCase()] ?? 'application/octet-stream';
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
    res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${st.size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
    createReadStream(p, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes', 'cache-control': 'no-cache' });
  createReadStream(p).pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return serveFile(req, res, join(ROOT, 'site', 'index.html'));
    if (req.method === 'GET' && url.pathname === '/api/items') return json(res, 200, { official: await officialItems(), gallery: await galleryItems(), themes: THEMES });
    if (req.method === 'POST' && url.pathname === '/api/upload') return handleUpload(req, res);
    if (req.method === 'GET' && url.pathname.startsWith('/files/')) {
      const rel = decodeURIComponent(url.pathname.slice('/files/'.length));
      let p = safePath(rel);
      if (rel.startsWith('gallery/')) {                      // 업로드는 GALLERY 위치를 따른다
        const g = resolve(GALLERY, '.' + sep + rel.slice('gallery/'.length));
        p = g.startsWith(GALLERY + sep) ? g : null;
      }
      if (!p) { res.writeHead(403).end(); return; }
      return serveFile(req, res, p);
    }
    res.writeHead(404).end('not found');
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: '서버 오류' });
  }
}).listen(PORT, HOST, () => console.log(`media-art 갤러리: http://${HOST}:${PORT}`));
