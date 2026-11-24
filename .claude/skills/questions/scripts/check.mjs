#!/usr/bin/env node
// check.mjs: check every outputs/<slug>/questions.json and write questions.md beside it, the same
// questions as a page that reads on its own. Exits 1 and names the problems if any file is
// missing, does not parse, or has questions without text or with times outside the video.

import { parseArgs } from 'node:util'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { clock, exists, fail as quit, prepared, writeWhole } from '../../_shared/lib.mjs'

const HELP = `Usage: node .claude/skills/questions/scripts/check.mjs [slug ...] [--root <dir>]

Checks outputs/<slug>/questions.json for every video (or only the slugs named) and writes
outputs/<slug>/questions.md from it. Run from the project root.`

let parsed
try {
  parsed = parseArgs({ allowPositionals: true, options: { root: { type: 'string' }, help: { type: 'boolean', short: 'h' } } })
} catch (error) {
  quit('check', `${error.message}\n\n${HELP}`)
}
if (parsed.values.help) { console.log(HELP); process.exit(0) }
const root = resolve(parsed.values.root || process.cwd())

const stamp = at => (typeof at === 'number' ? `[${clock(at)}] ` : '')

function markdown(manifest, q) {
  const lines = [`# Follow-up questions: ${manifest.source}`, '']
  if (q.summary) lines.push(q.summary, '')
  lines.push('## Questions', '')
  q.questions.forEach((x, i) => {
    lines.push(`${i + 1}. ${stamp(x.at)}${x.question}${x.kind ? ` *(${x.kind})*` : ''}`)
    if (x.why) lines.push(`   ${x.why}`)
    lines.push('')
  })
  if (q.observations?.length) {
    lines.push('## Moments worth noticing', '')
    for (const o of q.observations) lines.push(`- ${stamp(o.at)}${o.note}`)
    lines.push('')
  }
  if (q.uncertain?.length) {
    lines.push('## Unsure', '')
    for (const u of q.uncertain) lines.push(`- ${u}`)
    lines.push('')
  }
  if (q.written_by || q.written_at) lines.push('---', '', [q.written_by, q.written_at].filter(Boolean).join(' · '), '')
  return lines.join('\n')
}

const videos = await prepared(root, parsed.positionals)
if (!videos.length) quit('check', 'nothing in outputs/ to check')
const results = []
for (const { slug, outDir, manifest } of videos) {
  const path = join(outDir, 'questions.json')
  const problems = []
  let q = null
  if (!(await exists(path))) problems.push('no questions.json')
  else {
    try { q = JSON.parse(await readFile(path, 'utf8')) } catch (error) { problems.push(`questions.json does not parse: ${error.message}`) }
  }
  if (q) {
    if (!Array.isArray(q.questions) || !q.questions.length) problems.push('no questions')
    const timed = [...(q.questions || []).map(x => ['question', x]), ...(q.observations || []).map(x => ['observation', x])]
    for (const [what, x] of timed) {
      if (what === 'question' && !String(x.question ?? '').trim()) problems.push('a question has no text')
      if (what === 'observation' && !String(x.note ?? '').trim()) problems.push('an observation has no note')
      if (x.at === null || x.at === undefined) continue
      if (typeof x.at !== 'number' || !Number.isFinite(x.at) || x.at < 0) problems.push(`${what} time is not a number of seconds: ${JSON.stringify(x.at)}`)
      else if (manifest.duration && x.at > manifest.duration + 1) problems.push(`${what} at ${clock(x.at)} is past the end of the video (${clock(manifest.duration)})`)
    }
    if (!problems.length) await writeWhole(join(outDir, 'questions.md'), markdown(manifest, q))
  }
  results.push({ slug, questions: q?.questions?.length ?? 0, ok: !problems.length, ...(problems.length ? { problems } : {}) })
}
console.log(JSON.stringify(results, null, 2))
if (results.some(r => !r.ok)) process.exitCode = 1
