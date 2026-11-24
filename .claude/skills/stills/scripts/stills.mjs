#!/usr/bin/env node
// stills.mjs: still frames from each video, in outputs/<slug>/stills/. Everything happens on this
// computer with ffmpeg; no frame is sent anywhere by this script.
//
//   candidates   pull a spread of frames to choose from, one per stretch of the video, taken just
//                after a shot or slide change where there is one
//   add          pull extra candidates at times you name (a moment the transcript points to)
//   keep         read the choices in stills/stills.json and write the kept stills at full size

import { parseArgs } from 'node:util'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { clock, exists, fail as quit, openVideo, parseTime, pool, prepared, readJson, run, stampName, targets, writeJson } from '../../_shared/lib.mjs'

const HELP = `Usage, from the project root:

  node .claude/skills/stills/scripts/stills.mjs candidates [folder | video ...] [options]
  node .claude/skills/stills/scripts/stills.mjs add <slug> <time> [time ...]
  node .claude/skills/stills/scripts/stills.mjs keep [slug ...]

candidates   For each video (a folder anywhere on the computer, or files; with nothing named, the
             folder used last time, else _videos/), writes outputs/<slug>/stills/candidates/*.jpg
             and stills/candidates.json. The video is divided into equal stretches; each stretch
             gives one frame, taken just after its first shot or slide change, or from its middle
             if nothing changes.
add          Extra candidates at the times given (seconds, mm:ss, or h:mm:ss).
keep         Reads outputs/<slug>/stills/stills.json (the choices and captions) and writes each
             kept still at the video's full size as stills/still-NN-MMmSSs.jpg, replacing the
             stills kept before. With no slug, every video that has a stills.json.

Options:
  --videos <dir>      the folder of videos (same as naming it)
  --candidates <n>    how many candidates per video (default: one per 20 seconds, at least 12, at most 36)
  --scene <0-1>       how big a change counts as a new shot (default 0.3; lower catches subtler changes)
  --jobs <n>          how many videos at once (default 4)
  --force             redo candidates that already exist
  --dry-run           show what would happen; write nothing
  --root <dir>        the project root (default: the current folder)
  -h, --help          this help`

const fail = message => quit('stills', message)
const say = (message, tag) => console.error(`stills: ${tag ? `[${tag}] ` : ''}${message}`)

let parsed
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      videos: { type: 'string' },
      candidates: { type: 'string' },
      scene: { type: 'string', default: '0.3' },
      jobs: { type: 'string', default: '4' },
      force: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
} catch (error) {
  fail(`${error.message}\n\n${HELP}`)
}
const { values: opt } = parsed
const [command, ...rest] = parsed.positionals
if (opt.help || !command) { console.log(HELP); process.exit(opt.help ? 0 : 1) }

const root = resolve(opt.root || process.cwd())
const dryRun = Boolean(opt['dry-run'])
const jobs = Number.parseInt(opt.jobs, 10)
if (!Number.isInteger(jobs) || jobs < 1 || jobs > 32) fail('--jobs takes a number from 1 to 32')
const scene = Number(opt.scene)
if (!(scene > 0 && scene < 1)) fail('--scene takes a number between 0 and 1')
const asked = opt.candidates === undefined ? null : Number.parseInt(opt.candidates, 10)
if (asked !== null && (!Number.isInteger(asked) || asked < 1 || asked > 200)) fail('--candidates takes a number from 1 to 200')

// One frame near `at`. The thumbnail filter picks the most typical of the next dozen frames,
// which steps past a dissolve or a half-drawn slide.
async function grab(file, at, path, { width, quality }) {
  const filter = ['thumbnail=n=12', width ? `scale=${width}:-2` : null].filter(Boolean).join(',')
  await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', filter, '-q:v', String(quality), path])
  if (!(await exists(path))) {
    // Too close to the end for the filter to settle: take the frame as it is.
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', file, '-frames:v', '1', ...(width ? ['-vf', `scale=${width}:-2`] : []), '-q:v', String(quality), path])
  }
  if (!(await exists(path))) throw new Error(`no frame at ${clock(at)}`)
}

// The times of shot and slide changes, from ffmpeg's scene score.
async function changes(file) {
  const { err } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-an', '-vf', `scale=320:-2,select='gt(scene,${scene})',showinfo`, '-f', 'null', '-'])
  return [...err.matchAll(/Parsed_showinfo.*pts_time:([\d.]+)/g)].map(m => Number(m[1])).filter(Number.isFinite)
}

const nameFor = (n, at) => `c${String(n).padStart(2, '0')}-${stampName(at)}.jpg`

async function candidatesFor(video) {
  let opened
  try { opened = await openVideo(video, root, dryRun) } catch (error) { say(`skipping ${video.rel}: ${error.message}`); return { source: video.rel, stills: 'failed', error: error.message } }
  const { slug, outDir, info } = opened
  const result = { source: video.rel, slug }
  const listPath = join(outDir, 'stills', 'candidates.json')
  if (!info.hasVideo || !info.duration) { say('no picture, skipped', slug); return { ...result, stills: 'no-video' } }
  if (!opt.force && await exists(listPath)) { say('candidates already there', slug); return { ...result, stills: 'kept' } }
  const count = asked ?? Math.max(12, Math.min(36, Math.round(info.duration / 20)))
  if (dryRun) { say(`would write ${count} candidates to outputs/${slug}/stills/candidates/`, slug); return { ...result, stills: 'dry-run' } }

  try {
    const started = Date.now()
    const cuts = await changes(video.file)
    const last = Math.max(0, info.duration - 0.5)
    const list = []
    for (let i = 0; i < count; i++) {
      const from = (i * info.duration) / count
      const to = ((i + 1) * info.duration) / count
      const cut = cuts.find(t => t >= from && t < to)
      // Just past the change, so the new shot or slide has arrived.
      const at = Math.min(last, cut === undefined ? (from + to) / 2 : Math.min(cut + 0.4, to - 0.05))
      list.push({ file: `stills/candidates/${nameFor(i + 1, at)}`, at: +at.toFixed(2), from: cut === undefined ? 'spaced' : 'change' })
    }
    const dir = join(outDir, 'stills', 'candidates')
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    await pool(list, 4, c => grab(video.file, c.at, join(outDir, c.file), { width: 960, quality: 4 }))
    await writeJson(listPath, { schema: 1, video: slug, scene_threshold: scene, changes_found: cuts.length, candidates: list })
    say(`${list.length} candidates (${list.filter(c => c.from === 'change').length} at changes; ${cuts.length} changes found) in ${((Date.now() - started) / 1000).toFixed(1)}s`, slug)
    return { ...result, stills: 'made', candidates: list.length, changes_found: cuts.length }
  } catch (error) {
    say(`failed: ${error.message}`, slug)
    return { ...result, stills: 'failed', error: error.message }
  }
}

async function add(slug, times) {
  const [video] = await prepared(root, [slug])
  if (!video) fail(`no outputs/${slug}/manifest.json; run candidates first`)
  const listPath = join(video.outDir, 'stills', 'candidates.json')
  const data = (await readJson(listPath)) ?? { schema: 1, video: slug, candidates: [] }
  const made = []
  for (const text of times) {
    const at = parseTime(text)
    if (at === null || (video.manifest.duration && at > video.manifest.duration)) fail(`"${text}" is not a time inside this video (${clock(video.manifest.duration ?? 0)} long)`)
    const entry = { file: `stills/candidates/${nameFor(data.candidates.length + 1, at)}`, at: +at.toFixed(2), from: 'asked' }
    await mkdir(join(video.outDir, 'stills', 'candidates'), { recursive: true })
    await grab(video.manifest.path, at, join(video.outDir, entry.file), { width: 960, quality: 4 })
    data.candidates.push(entry)
    made.push(entry)
  }
  await writeJson(listPath, data)
  console.log(JSON.stringify(made, null, 2))
}

async function keepFor(video) {
  const { slug, outDir, manifest } = video
  const dir = join(outDir, 'stills')
  const choicesPath = join(dir, 'stills.json')
  let choices
  try { choices = JSON.parse(await readFile(choicesPath, 'utf8')) } catch (error) {
    return { slug, kept: 0, error: (await exists(choicesPath)) ? `stills.json does not parse: ${error.message}` : 'no stills.json yet' }
  }
  if (!Array.isArray(choices.stills) || !choices.stills.length) return { slug, kept: 0, error: 'stills.json has no stills' }
  const candidates = (await readJson(join(dir, 'candidates.json')))?.candidates ?? []
  const problems = []
  for (const s of choices.stills) {
    const from = s.candidate ? candidates.find(c => c.file === s.candidate || c.file.endsWith(`/${s.candidate}`)) : null
    if (s.candidate && !from) problems.push(`no candidate called ${s.candidate}`)
    if (from) s.at = from.at
    if (typeof s.at !== 'number' || !Number.isFinite(s.at) || s.at < 0 || (manifest.duration && s.at > manifest.duration)) problems.push(`a still has no usable time (at: ${JSON.stringify(s.at)})`)
    if (!s.caption) problems.push(`the still at ${typeof s.at === 'number' ? clock(s.at) : '?'} has no caption`)
  }
  if (problems.length) return { slug, kept: 0, error: problems.join('; ') }
  if (!(await exists(manifest.path))) return { slug, kept: 0, error: `the video is no longer at ${manifest.path}` }

  choices.stills.sort((a, b) => a.at - b.at)
  for (const name of await readdir(dir)) if (/^still-\d+-.*\.jpg$/.test(name)) await rm(join(dir, name))
  for (const [i, s] of choices.stills.entries()) {
    s.file = `stills/still-${String(i + 1).padStart(2, '0')}-${stampName(s.at)}.jpg`
    await grab(manifest.path, s.at, join(outDir, s.file), { width: null, quality: 2 })
  }
  await writeJson(choicesPath, choices)
  say(`${choices.stills.length} stills kept`, slug)
  return { slug, kept: choices.stills.length }
}

if (command === 'candidates') {
  const videos = await targets({ script: 'stills', root, videos: opt.videos, positionals: rest, dryRun })
  say(`${videos.length} video${videos.length === 1 ? '' : 's'}, up to ${Math.min(jobs, videos.length)} at a time`)
  const started = Date.now()
  const results = await pool(videos, jobs, candidatesFor)
  say(`all done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  console.log(JSON.stringify(results, null, 2))
  if (results.some(r => r.stills === 'failed')) process.exitCode = 1
} else if (command === 'add') {
  if (rest.length < 2) fail(`add takes a slug and at least one time\n\n${HELP}`)
  await add(rest[0], rest.slice(1))
} else if (command === 'keep') {
  const videos = await prepared(root, rest)
  if (!videos.length) fail(rest.length ? `nothing in outputs/ called ${rest.join(', ')}` : 'nothing in outputs/ yet')
  const results = await pool(videos, jobs, keepFor)
  console.log(JSON.stringify(results, null, 2))
  if (results.some(r => r.error)) process.exitCode = 1
} else {
  fail(`unknown command "${command}"\n\n${HELP}`)
}
