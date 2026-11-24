#!/usr/bin/env node
// transcribe.mjs: a timestamped transcript for each video, in outputs/<slug>/.
//
// Transcription goes only to HUIT's OpenAI Direct gateway (whisper-1). The sound is pulled out
// locally with ffmpeg; the picture is never sent anywhere.

import { parseArgs } from 'node:util'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join, relative, resolve } from 'node:path'
import { clock, exists, fail as quit, loadEnv, mask, openVideo, pool, probe, run, targets, writeJson, writeWhole } from '../../_shared/lib.mjs'

const HELP = `Usage: node .claude/skills/transcription/scripts/transcribe.mjs [folder | video ...] [options]

Run from the project root. Name a folder of videos anywhere on the computer (every video under it
is done, however deep), or one or more video files. With nothing named, the folder used last time
is used again, else _videos/. For each video, writes outputs/<slug>/:

  manifest.json      where the video is, its length and picture size
  transcript.json    HUIT's verbose_json response (segments with start and end in seconds)
  transcript.md      the whole transcript, a [mm:ss] before each segment

Videos already transcribed are skipped, so a rerun only fills gaps.

Options:
  --videos <dir>      the folder of videos (same as naming it)
  --jobs <n>          how many videos at once (default 8)
  --language <code>   language of the speech, e.g. en (helps accuracy)
  --prompt <text>     spelling hints for the transcriber: names, course terms
                      (default: the contents of _context/course/terms.md, if that file exists)
  --force             redo transcripts that already exist
  --dry-run           show what would happen (key masked); send and write nothing
  --root <dir>        the project root (default: the current folder)
  -h, --help          this help

Keys (shell first, then <root>/.env):
  HUIT_OPENAI_API_KEY    your OpenAI Direct key from the Harvard API Portal
  HUIT_OPENAI_BASE_URL   default https://apis.huit.harvard.edu/ais-openai-direct/v2

HUIT takes 25 MB of sound per request. The sound is sent as mono 16 kHz MP3 at 48 kbps; a video
longer than 55 minutes is sent in 50-minute parts and the parts are joined into one transcript
with the times carried through, so nothing is left out.`

const DEFAULT_BASE = 'https://apis.huit.harvard.edu/ais-openai-direct/v2'
const MAX_BYTES = 25 * 1024 * 1024
const ONE_REQUEST = 55 * 60 // seconds: longer than this goes in parts
const PART = 50 * 60
const fail = message => quit('transcribe', message)
const say = (message, tag) => console.error(`transcribe: ${tag ? `[${tag}] ` : ''}${message}`)
const sleep = ms => new Promise(r => setTimeout(r, ms))

let parsed
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      videos: { type: 'string' },
      jobs: { type: 'string', default: '8' },
      language: { type: 'string' },
      prompt: { type: 'string' },
      force: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
} catch (error) {
  fail(`${error.message}\n\n${HELP}`)
}
const { values: opt, positionals } = parsed
if (opt.help) { console.log(HELP); process.exit(0) }

const root = resolve(opt.root || process.cwd())
const dryRun = Boolean(opt['dry-run'])
const jobs = Number.parseInt(opt.jobs, 10)
if (!Number.isInteger(jobs) || jobs < 1 || jobs > 32) fail('--jobs takes a number from 1 to 32')
const envFile = loadEnv(root)
const key = process.env.HUIT_OPENAI_API_KEY
const base = (process.env.HUIT_OPENAI_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '')
const url = `${base}/audio/transcriptions`
if (!dryRun && !key) fail(`HUIT_OPENAI_API_KEY is not set. Put it in ${join(root, '.env')} (see .env.example).`)

const termsFile = join(root, '_context', 'course', 'terms.md')
const hints = opt.prompt ?? (await readFile(termsFile, 'utf8').then(t => t.trim(), () => '')) ?? ''
const fields = { model: 'whisper-1', response_format: 'verbose_json', 'timestamp_granularities[]': 'segment' }
if (opt.language) fields.language = opt.language
if (hints) fields.prompt = hints

const videos = await targets({ script: 'transcribe', root, videos: opt.videos, positionals, dryRun })

// One request to HUIT, tried again a few times if the gateway is busy or the network drops.
async function send(bytes, name, tag) {
  const waits = [5, 20, 60]
  for (let attempt = 0; ; attempt++) {
    let problem
    try {
      const form = new FormData()
      form.set('file', new Blob([bytes], { type: 'audio/mpeg' }), name)
      for (const [field, value] of Object.entries(fields)) form.set(field, value)
      const response = await fetch(url, { method: 'POST', headers: { 'api-key': key }, body: form })
      const body = await response.text()
      if (response.ok) return JSON.parse(body)
      problem = new Error(`HUIT answered HTTP ${response.status}: ${body.split(key).join('[key]')}`)
      if (response.status !== 429 && response.status < 500) throw Object.assign(problem, { final: true })
    } catch (error) {
      if (error.final) throw error
      problem = error
    }
    if (attempt >= waits.length) throw problem
    say(`${problem.message.split('\n')[0]}; trying again in ${waits[attempt]}s`, tag)
    await sleep(waits[attempt] * 1000)
  }
}

function transcriptMarkdown(source, data) {
  const lines = [
    `# Transcript: ${source}`,
    '',
    `- model: whisper-1 (HUIT OpenAI Direct)`,
    `- language: ${data.language ?? 'unknown'}`,
    `- duration: ${typeof data.duration === 'number' ? clock(data.duration) : 'unknown'}`,
    `- transcribed: ${new Date().toISOString()}`,
    ...(data.parts?.length > 1 ? [`- sent in ${data.parts.length} parts, joined`] : []),
    '',
    '---',
    '',
  ]
  if (Array.isArray(data.segments) && data.segments.length) {
    for (const seg of data.segments) lines.push(`[${clock(seg.start)}] ${seg.text.trim()}`, '')
  } else {
    lines.push((data.text ?? '').trim() || '(no speech found)', '')
  }
  return lines.join('\n')
}

async function transcribeOne(video) {
  let opened
  try { opened = await openVideo(video, root, dryRun) } catch (error) { say(`skipping ${video.rel}: ${error.message}`); return { source: video.rel, transcript: 'failed', error: error.message } }
  const { slug, outDir, info } = opened
  const result = { source: video.rel, slug, duration: info.duration }
  const jsonPath = join(outDir, 'transcript.json')
  if (!opt.force && await exists(jsonPath)) { say('already there', slug); return { ...result, transcript: 'kept' } }
  if (!info.hasAudio) { say('no sound track, skipped', slug); return { ...result, transcript: 'no-audio' } }
  const inParts = info.duration !== null && info.duration > ONE_REQUEST
  if (dryRun) {
    say(`would POST the sound (mono 16 kHz MP3${inParts ? `, in ${Math.ceil(info.duration / PART)} parts` : ''}) to ${url} with api-key ${mask(key)} and ${JSON.stringify(fields)}`, slug)
    return { ...result, transcript: 'dry-run' }
  }

  const scratch = await mkdtemp(join(tmpdir(), 'scrb111-sound-'))
  try {
    const started = Date.now()
    const whole = join(scratch, 'sound.mp3')
    await run('ffmpeg', ['-v', 'error', '-i', video.file, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-b:a', '48k', whole])
    let parts = [whole]
    if (inParts) {
      await run('ffmpeg', ['-v', 'error', '-i', whole, '-f', 'segment', '-segment_time', String(PART), '-c', 'copy', join(scratch, 'part-%03d.mp3')])
      parts = (await readdir(scratch)).filter(n => n.startsWith('part-')).sort().map(n => join(scratch, n))
    }
    const stem = basename(video.file, extname(video.file))
    const joined = { text: '', language: null, duration: 0, segments: [], parts: [] }
    let single = null
    let offset = 0
    for (const [i, part] of parts.entries()) {
      const bytes = await readFile(part)
      if (bytes.length > MAX_BYTES) throw new Error(`a part of the sound is ${(bytes.length / 1048576).toFixed(1)} MB; HUIT's limit is 25 MB`)
      say(`sending ${(bytes.length / 1024).toFixed(0)} KB of sound to HUIT${parts.length > 1 ? ` (part ${i + 1} of ${parts.length})` : ''}`, slug)
      const data = await send(bytes, `${stem}${parts.length > 1 ? `-${i + 1}` : ''}.mp3`, slug)
      if (parts.length === 1) { single = data; break }
      const length = (await probe(part)).duration ?? data.duration ?? 0
      for (const seg of data.segments || []) {
        joined.segments.push({ ...seg, id: joined.segments.length, start: +(seg.start + offset).toFixed(2), end: +(seg.end + offset).toFixed(2) })
      }
      joined.text += (joined.text ? ' ' : '') + (data.text ?? '').trim()
      joined.language ??= data.language ?? null
      joined.parts.push({ start: +offset.toFixed(2), duration: +length.toFixed(2) })
      offset += length
    }
    joined.duration = +offset.toFixed(2)
    const data = single ?? joined
    await writeJson(jsonPath, data)
    await writeWhole(join(outDir, 'transcript.md'), transcriptMarkdown(video.rel, data))
    say(`done in ${((Date.now() - started) / 1000).toFixed(1)}s, ${data.segments?.length ?? 0} segments`, slug)
    return { ...result, transcript: 'made', segments: data.segments?.length ?? 0 }
  } catch (error) {
    say(`failed: ${error.message}`, slug)
    return { ...result, transcript: 'failed', error: error.message }
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

if (envFile) say(`keys from ${relative(process.cwd(), envFile) || envFile}`)
if (hints && !opt.prompt) say(`spelling hints from ${relative(process.cwd(), termsFile)}`)
say(`${videos.length} video${videos.length === 1 ? '' : 's'}, up to ${Math.min(jobs, videos.length)} at a time`)
const started = Date.now()
const results = await pool(videos, jobs, transcribeOne)
say(`all done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(JSON.stringify(results, null, 2))
if (results.some(r => r.transcript === 'failed')) process.exitCode = 1
