#!/usr/bin/env node
// render.mjs: turn everything in outputs/ into HTML: outputs/report.html, the report on all the
// videos, and outputs/<slug>/report.html, one page per video with the player, the stills, the
// questions, and the whole transcript. No dependencies, no network.

import { parseArgs } from 'node:util'
import { join, resolve } from 'node:path'
import { clock, fail as quit, prepared, readJson, writeWhole } from '../../_shared/lib.mjs'

const HELP = `Usage: node .claude/skills/report/scripts/render.mjs [slug ...] [--root <dir>]

Writes outputs/<slug>/report.html for each video (or only the slugs named) and outputs/report.html,
the report on all of them. Run from the project root, then open outputs/report.html.`

let parsed
try {
  parsed = parseArgs({ allowPositionals: true, options: { root: { type: 'string' }, help: { type: 'boolean', short: 'h' } } })
} catch (error) {
  quit('render', `${error.message}\n\n${HELP}`)
}
if (parsed.values.help) { console.log(HELP); process.exit(0) }
const root = resolve(parsed.values.root || process.cwd())
const outputs = join(root, 'outputs')

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const seconds = at => (typeof at === 'number' && Number.isFinite(at) ? at : null)

const STYLE = `
:root { --bg:#fbfaf7; --fg:#1d1d1b; --muted:#6b6a65; --line:#e3e0d8; --card:#ffffff; --accent:#b3261e; --chip:#f1eee6; }
@media (prefers-color-scheme: dark) { :root { --bg:#151514; --fg:#ecebe6; --muted:#9c9a92; --line:#2e2d2a; --card:#1d1c1a; --accent:#ff8a80; --chip:#2a2926; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.55 -apple-system, system-ui, "Inter", sans-serif; }
main { max-width:1180px; margin:0 auto; padding:24px 16px 80px; }
h1 { font-size:26px; font-weight:900; margin:0 0 4px; letter-spacing:-0.01em; }
h2 { font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.06em; margin:32px 0 10px; color:var(--muted); }
h3 { font-size:20px; font-weight:800; margin:0 0 2px; }
a { color:inherit; }
.meta { color:var(--muted); font-size:13px; }
.layout { display:grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap:28px; margin-top:20px; }
@media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
.sticky { position:sticky; top:16px; align-self:start; }
video { width:100%; background:#000; border-radius:6px; display:block; }
.stills { display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:10px; margin-top:12px; }
.stills.small { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap:6px; }
.stills figure { margin:0; }
.stills button { padding:0; border:0; background:none; cursor:pointer; display:block; width:100%; }
.stills img { width:100%; display:block; border-radius:3px; }
.stills figcaption { color:var(--muted); font-size:12px; line-height:1.35; margin-top:4px; }
.t { border:0; background:var(--chip); color:var(--fg); font:600 12px/1 ui-monospace, Menlo, monospace; padding:4px 6px; border-radius:4px; cursor:pointer; white-space:nowrap; text-decoration:none; display:inline-block; }
.t:hover { background:var(--accent); color:#fff; }
.summary { font-size:16px; }
ol.questions { padding-left:22px; margin:0; }
ol.questions li { margin:0 0 16px; }
.q { font-size:17px; font-weight:600; }
.why { color:var(--muted); font-size:13px; margin-top:3px; }
.kind { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:var(--accent); margin-left:6px; }
ul.notes { padding-left:18px; }
.transcript p { margin:0 0 6px; }
.transcript p.now { background:var(--chip); border-radius:4px; }
.empty { color:var(--muted); font-style:italic; }
.overview { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:18px 20px; margin-top:20px; }
.overview h2:first-child { margin-top:0; }
.theme { margin:0 0 12px; }
.theme strong { display:block; }
section.video { display:grid; grid-template-columns: 240px minmax(0, 1fr); gap:20px; padding:24px 0; border-top:1px solid var(--line); }
@media (max-width: 700px) { section.video { grid-template-columns: 1fr; } }
section.video img { width:100%; border-radius:4px; display:block; }
section.video ol.questions li { margin-bottom:10px; }
section.video .q { font-size:15px; }
nav.toc { columns: 2 280px; margin-top:8px; }
nav.toc a { display:block; padding:2px 0; }
`

const SCRIPT = `
const v = document.querySelector('video');
const jump = at => { if (!v) return; v.currentTime = at; v.play(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
document.addEventListener('click', e => {
  const b = e.target.closest('[data-at]');
  if (b) jump(Number(b.dataset.at));
});
const fromLink = location.hash.match(/^#t=([\\d.]+)$/);
if (fromLink && v) v.addEventListener('loadedmetadata', () => { v.currentTime = Number(fromLink[1]); }, { once: true });
const lines = [...document.querySelectorAll('.transcript p[data-start]')];
v && v.addEventListener('timeupdate', () => {
  for (const p of lines) p.classList.toggle('now', v.currentTime >= +p.dataset.start && v.currentTime < +p.dataset.end);
});
`

// On a video's own page a timestamp moves the player; on the report it opens that page at that time.
const stamp = (at, page) => {
  if (seconds(at) === null) return ''
  return page
    ? `<a class="t" href="${esc(page)}#t=${seconds(at)}">${clock(at)}</a> `
    : `<button class="t" data-at="${seconds(at)}">${clock(at)}</button> `
}

function html(title, body, script = '') {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body><main>${body}</main>${script ? `<script>${script}</script>` : ''}</body></html>
`
}

const questionList = (q, page) => (q?.questions || []).map(x =>
  `<li><div class="q">${stamp(x.at, page)}${esc(x.question)}${x.kind ? `<span class="kind">${esc(x.kind)}</span>` : ''}</div>${x.why ? `<div class="why">${esc(x.why)}</div>` : ''}</li>`).join('')

function videoPage({ manifest: m, transcript, q, kept, candidates }) {
  let pictures = ''
  if (kept.length) {
    pictures = `<div class="stills">${kept.map(s => `<figure><button data-at="${s.at}"><img src="${esc(s.file)}" alt="${esc(s.caption)}" loading="lazy"></button><figcaption>${stamp(s.at)}${esc(s.caption)}</figcaption></figure>`).join('')}</div>`
  } else if (candidates.length) {
    pictures = `<p class="meta">No stills chosen yet; these are the candidates.</p><div class="stills small">${candidates.map(c => `<figure><button data-at="${c.at}"><img src="${esc(c.file)}" alt="" loading="lazy"></button><figcaption>${clock(c.at)}</figcaption></figure>`).join('')}</div>`
  }
  const segs = transcript?.segments?.length
    ? transcript.segments.map(s => `<p data-start="${s.start}" data-end="${s.end}">${stamp(s.start)}${esc(s.text.trim())}</p>`).join('')
    : transcript?.text ? `<p>${esc(transcript.text)}</p>` : '<p class="empty">No transcript.</p>'

  let right = '<p class="empty">No questions yet.</p>'
  if (q) {
    const questions = questionList(q)
    const notes = (q.observations || []).map(o => `<li>${stamp(o.at)}${esc(o.note)}</li>`).join('')
    const unsure = (q.uncertain || []).map(u => `<li>${esc(u)}</li>`).join('')
    right = `
      ${q.summary ? `<h2>What the video does</h2><p class="summary">${esc(q.summary)}</p>` : ''}
      <h2>Follow-up questions</h2>${questions ? `<ol class="questions">${questions}</ol>` : '<p class="empty">None.</p>'}
      ${notes ? `<h2>Moments worth noticing</h2><ul class="notes">${notes}</ul>` : ''}
      ${unsure ? `<h2>Unsure</h2><ul class="notes">${unsure}</ul>` : ''}
      <p class="meta">${esc(q.written_by || '')}${q.written_at ? ` · ${esc(q.written_at)}` : ''}</p>`
  }

  return html(m.source, `
    <p class="meta"><a href="../report.html">← the report</a></p>
    <h1>${esc(m.source)}</h1>
    <p class="meta">${m.duration ? clock(m.duration) : ''}${m.width ? ` · ${m.width}×${m.height}` : ''}</p>
    <div class="layout">
      <div class="sticky">
        <video controls preload="metadata" src="${esc(m.video_url)}"></video>
        ${pictures}
      </div>
      <div>${right}</div>
    </div>
    <h2>Transcript</h2>
    <div class="transcript">${segs}</div>`, SCRIPT)
}

function overviewBlock(o, bySlug) {
  if (!o) return ''
  const names = slugs => (slugs || []).filter(s => bySlug.has(s)).map(s => `<a href="#${esc(s)}">${esc(bySlug.get(s).manifest.source)}</a>`).join(', ')
  const themes = (o.themes || []).map(t => `<div class="theme"><strong>${esc(t.title)}</strong>${esc(t.note)}${names(t.videos) ? `<div class="meta">${names(t.videos)}</div>` : ''}</div>`).join('')
  const forClass = (o.for_class || []).map(x => `<li>${esc(x)}</li>`).join('')
  return `<div class="overview">
    ${o.summary ? `<h2>Across the videos</h2><p class="summary">${esc(o.summary)}</p>` : ''}
    ${themes ? `<h2>What comes up more than once</h2>${themes}` : ''}
    ${forClass ? `<h2>To raise with the whole class</h2><ul class="notes">${forClass}</ul>` : ''}
    <p class="meta">${esc(o.written_by || '')}${o.written_at ? ` · ${esc(o.written_at)}` : ''}</p>
  </div>`
}

const all = await prepared(root)
if (!all.length) quit('render', `nothing prepared in ${outputs} yet`)
const only = new Set(parsed.positionals)
for (const v of all) {
  v.transcript = await readJson(join(v.outDir, 'transcript.json'))
  v.q = await readJson(join(v.outDir, 'questions.json'))
  v.kept = ((await readJson(join(v.outDir, 'stills', 'stills.json')))?.stills || []).filter(s => s.file)
  v.candidates = (await readJson(join(v.outDir, 'stills', 'candidates.json')))?.candidates || []
  if (!only.size || only.has(v.slug)) {
    await writeWhole(join(v.outDir, 'report.html'), videoPage(v))
    console.log(`outputs/${v.slug}/report.html`)
  }
}

const bySlug = new Map(all.map(v => [v.slug, v]))
const overview = await readJson(join(outputs, 'overview.json'))
const sections = all.map(v => {
  const page = `${v.slug}/report.html`
  const thumb = v.kept[0]?.file ?? v.candidates[Math.floor((v.candidates.length - 1) / 2)]?.file
  const questions = questionList(v.q, page)
  return `<section class="video" id="${esc(v.slug)}">
    <div>${thumb ? `<a href="${esc(page)}"><img src="${esc(v.slug)}/${esc(thumb)}" alt="" loading="lazy"></a>` : ''}</div>
    <div>
      <h3><a href="${esc(page)}">${esc(v.manifest.source)}</a></h3>
      <p class="meta">${v.manifest.duration ? clock(v.manifest.duration) : ''} · ${v.transcript ? 'transcript' : 'no transcript'} · ${v.kept.length} still${v.kept.length === 1 ? '' : 's'} · ${v.q?.questions?.length ?? 0} question${v.q?.questions?.length === 1 ? '' : 's'}</p>
      ${v.q?.summary ? `<p>${esc(v.q.summary)}</p>` : ''}
      ${questions ? `<ol class="questions">${questions}</ol>` : '<p class="empty">No questions yet.</p>'}
    </div>
  </section>`
}).join('')

await writeWhole(join(outputs, 'report.html'), html('SCRB 111 video report', `
  <h1>SCRB 111 video report</h1>
  <p class="meta">${all.length} video${all.length === 1 ? '' : 's'} · made ${new Date().toLocaleString()}</p>
  ${overviewBlock(overview, bySlug)}
  <h2>The videos</h2>
  <nav class="toc">${all.map(v => `<a href="#${esc(v.slug)}">${esc(v.manifest.source)}</a>`).join('')}</nav>
  ${sections}`))
console.log('outputs/report.html')
