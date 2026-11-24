---
name: report
description: Build the final HTML report on SCRB 111 student videos from everything in outputs/. Claude reads all the questions and transcripts and writes a short overview across the videos; a script renders outputs/report.html plus one page per video with the player, stills, questions, and full transcript. Use when someone asks for the report, the HTML, a summary across the videos, or as the last step of the full run described in CLAUDE.md.
---

# Report

Two parts: an overview you write, and a script that renders the pages. The script works with whatever is there, so it can also be run early to look at transcripts and candidate stills before any questions exist.

## 1. Write the overview

Skip this if there is only one video.

1. Read `_context/guides/report.md` in full, and everything in `_context/course/` and `_context/private/`.
2. Read every `outputs/<slug>/questions.json` and every `outputs/<slug>/transcript.md`, all of each. If there are too many to hold at once, read them in several passes and keep notes per video; don't skip any and don't read part of one.
3. Write `outputs/overview.json`:

```json
{
  "schema": 1,
  "written_by": "Claude (<model>)",
  "written_at": "<ISO time>",
  "summary": "A short paragraph on the set as a whole: how many videos, what they cover, how they go about it.",
  "themes": [
    { "title": "A few words", "note": "Something that comes up in more than one video, said specifically.", "videos": ["<slug>", "<slug>"] }
  ],
  "for_class": ["A question or point worth raising with everyone, because several videos lead to it."]
}
```

Every slug under `videos` must be a real folder in `outputs/`.

## 2. Render

```bash
node .claude/skills/report/scripts/render.mjs           # every video's page, and the report
node .claude/skills/report/scripts/render.mjs <slug>    # one video's page, and the report
open outputs/report.html
```

- `outputs/report.html`: the overview, then every video with its first still, length, summary, and questions. Each timestamp opens that video's page at that moment.
- `outputs/<slug>/report.html`: the player, the kept stills with captions (or the candidates, if none were chosen), the questions, moments worth noticing, anything unsure, and the whole transcript. Clicking a timestamp or still moves the player.

The player plays each video from where it sits on the computer (the path in `manifest.json`), so the pages work on this machine as long as the videos stay put. No network, no dependencies.

## 3. Say where it is

Give the full path to `outputs/report.html`, how many videos are in it, and anything missing (a video with no transcript, no stills, or no questions, and why).
