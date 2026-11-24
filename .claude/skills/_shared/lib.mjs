// lib.mjs: helpers shared by the four skills' scripts. Node built-ins only, plus ffmpeg/ffprobe.
//
// The project root is the folder the scripts are run from (it holds _context/ and outputs/);
// pass --root to point elsewhere. Keys come from the shell first, then <root>/.env.
// The videos can live anywhere on the computer: see targets().

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { access, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const VIDEO_TYPES = new Set(['.mov', '.mp4', '.m4v', '.mkv', '.webm', '.avi'])

export const exists = path => access(path).then(() => true, () => false)
export const readJson = path => readFile(path, 'utf8').then(JSON.parse, () => null)
const isDir = path => stat(path).then(s => s.isDirectory(), () => false)

// Write through a temporary file, so two scripts running at once never read half a file.
export async function writeWhole(path, text) {
  const tmp = `${path}.${process.pid}.tmp`
  await writeFile(tmp, text)
  await rename(tmp, path)
}
export const writeJson = (path, data) => writeWhole(path, JSON.stringify(data, null, 2) + '\n')

// Read KEY=value lines from <root>/.env into process.env, without overriding the shell.
export function loadEnv(root) {
  const file = join(root, '.env')
  if (!existsSync(file)) return null
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m || m[1] in process.env) continue
    let value = m[2]
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    process.env[m[1]] = value
  }
  return file
}

// What a dry run shows instead of a key: never any of its characters.
export function mask(key) {
  return key ? `[hidden, ${key.length} characters]` : '[NOT SET]'
}

export function fail(script, message) {
  console.error(`${script}: ${message}`)
  process.exit(1)
}

// Run a command without blocking. Resolves with { out, err } (ffmpeg reports on stderr).
export function run(cmd, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', d => { out += d })
    child.stderr.on('data', d => { err += d })
    child.on('error', e => reject(e.code === 'ENOENT' ? new Error(`${cmd} is not installed (brew install ffmpeg)`) : e))
    child.on('close', code => (code === 0 ? resolvePromise({ out, err }) : reject(new Error((err || `${cmd} exited ${code}`).trim().split('\n').slice(-3).join('\n')))))
  })
}

// Run worker(item) over items, at most `limit` at a time; results in the items' order.
export async function pool(items, limit, worker) {
  const results = new Array(items.length)
  let next = 0
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(lanes)
  return results
}

// Duration, picture size, and whether there is sound.
export async function probe(file) {
  const data = JSON.parse((await run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file])).out)
  const streams = data.streams || []
  const video = streams.find(s => s.codec_type === 'video' && !s.disposition?.attached_pic)
  const audio = streams.find(s => s.codec_type === 'audio')
  const duration = Number(data.format?.duration ?? video?.duration ?? audio?.duration)
  return {
    duration: Number.isFinite(duration) ? duration : null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
  }
}

// 75.4 -> "01:15"; 3725 -> "1:02:05"
export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const hh = Math.floor(s / 3600)
  const mm = String(Math.floor(s / 60) % 60).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`
}

// "134.5", "2:14", or "1:02:14" -> seconds
export function parseTime(text) {
  const parts = String(text).split(':').map(Number)
  if (!parts.length || parts.length > 3 || parts.some(n => !Number.isFinite(n) || n < 0)) return null
  return parts.reduce((total, n) => total * 60 + n, 0)
}

// 75.4 -> "01m15s", for file names (minutes keep counting past 59)
export function stampName(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}m${String(s % 60).padStart(2, '0')}s`
}

// "student-a/Final cut.mov" -> "student-a--final-cut"
export function slugFor(relPath) {
  return relPath
    .replace(/\.[^./]+$/, '')
    .split(/[\\/]+/)
    .map(part => part.toLowerCase().normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('--')
}

async function findVideos(dir) {
  const found = []
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (entry.name.startsWith('.')) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...await findVideos(path))
    else if (VIDEO_TYPES.has(extname(entry.name).toLowerCase())) found.push(path)
  }
  return found.sort()
}

// Which videos to work on, as [{ file, rel }].
//   a folder (positional or --videos)  every video under it, however deep; remembered in outputs/run.json
//   one or more files                  just those
//   nothing                            the folder remembered from last time, else <root>/_videos/
export async function targets({ script, root, videos, positionals, dryRun }) {
  const outputs = join(root, 'outputs')
  const runFile = join(outputs, 'run.json')
  if (positionals.length === 1 && !videos && await isDir(resolve(positionals[0]))) {
    videos = positionals[0]
    positionals = []
  }
  if (positionals.length) return positionals.map(p => ({ file: resolve(p), rel: basename(p) }))

  const remembered = (await readJson(runFile))?.videos_dir
  const base = resolve(videos || remembered || join(root, '_videos'))
  if (!(await isDir(base))) fail(script, `there is no folder at ${base}`)
  const files = await findVideos(base)
  if (!files.length) fail(script, `no videos found under ${base} (looking for ${[...VIDEO_TYPES].join(' ')})`)
  if (!dryRun) {
    await mkdir(outputs, { recursive: true })
    await writeJson(runFile, { videos_dir: base, noted: new Date().toISOString() })
  }
  return files.map(file => ({ file, rel: relative(base, file) }))
}

// Probe one video and make sure outputs/<slug>/manifest.json describes it.
export async function openVideo({ file, rel }, root, dryRun) {
  const info0 = await stat(file).catch(() => null)
  if (!info0?.isFile()) throw new Error(`not found: ${file}`)
  const slug = slugFor(rel)
  const outDir = join(root, 'outputs', slug)
  const info = await probe(file)
  const manifestPath = join(outDir, 'manifest.json')
  const previous = await readJson(manifestPath)
  const manifest = {
    schema: 1,
    slug,
    source: rel,
    path: file,
    // For the report's player: the video stays where it is on the computer.
    video_url: pathToFileURL(file).href,
    duration: info.duration,
    width: info.width,
    height: info.height,
    has_audio: info.hasAudio,
    has_video: info.hasVideo,
    created: previous?.created ?? new Date().toISOString(),
  }
  if (!dryRun && JSON.stringify(previous) !== JSON.stringify(manifest)) {
    await mkdir(outDir, { recursive: true })
    await writeJson(manifestPath, manifest)
  }
  return { slug, outDir, info, manifest }
}

// Every outputs/<slug>/ that has a manifest, or only the slugs named.
export async function prepared(root, only = []) {
  const outputs = join(root, 'outputs')
  const names = (await readdir(outputs, { withFileTypes: true }).catch(() => []))
    .filter(e => e.isDirectory()).map(e => e.name).sort()
  const list = []
  for (const slug of names) {
    if (only.length && !only.includes(slug)) continue
    const manifest = await readJson(join(outputs, slug, 'manifest.json'))
    if (manifest) list.push({ slug, outDir: join(outputs, slug), manifest })
  }
  return list
}
