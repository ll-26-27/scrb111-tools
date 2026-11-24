---
name: stills
description: Pull good still frames from SCRB 111 student videos. A script takes candidate frames at shot and slide changes with ffmpeg; Claude looks at them beside the transcript, chooses the ones worth keeping, captions them, and the script writes the kept stills at full size in outputs/<slug>/stills/. Use when someone asks for stills, frames, screenshots, or images from the videos, or as part of the full run described in CLAUDE.md.
---

# Stills

Three commands in one script, `.claude/skills/stills/scripts/stills.mjs`, with a choosing step by you in the middle. Node 20+ and ffmpeg; nothing leaves the computer. Run from the project root.

## 1. Candidates

```bash
node .claude/skills/stills/scripts/stills.mjs candidates "/path/to/folder of videos"
node .claude/skills/stills/scripts/stills.mjs candidates          # the same folder as last time
```

This needs no transcript, so in a full run start it at the same moment as the transcription script. For each video it writes `outputs/<slug>/stills/candidates/c01-00m05s.jpg …` and `stills/candidates.json` (each candidate's `file`, its time `at` in seconds, and `from`: `change` if it was taken just after a shot or slide change, `spaced` if from the middle of a stretch where nothing changed). There is one candidate per 20 seconds of video, at least 12 and at most 36; `--candidates 48` asks for more, `--scene 0.2` catches subtler changes, `--force` redoes them.

## 2. Choose

For each video:

1. Read `_context/guides/stills.md` in full, and whatever is in `_context/course/` and `_context/private/`. The guide says what a good still is for this course.
2. Read `outputs/<slug>/transcript.md` in full if there is one.
3. Look at every candidate (read each JPG). Don't choose from file names or times alone.
4. If the transcript points at something on screen and no candidate shows it, pull more and look at them:
   ```bash
   node .claude/skills/stills/scripts/stills.mjs add <slug> 2:14 3:05
   ```
5. Write `outputs/<slug>/stills/stills.json`:

```json
{
  "schema": 1,
  "video": "<slug>",
  "chosen_by": "Claude (<model>)",
  "chosen_at": "<ISO time>",
  "stills": [
    {
      "candidate": "c07-02m14s.jpg",
      "caption": "What is on screen, in a sentence. Text on a slide or drawing is quoted exactly as it appears.",
      "why": "Why this frame is worth keeping."
    }
  ]
}
```

`candidate` is a file name from `candidates.json`. The caption describes only what you saw in that frame.

## 3. Keep

```bash
node .claude/skills/stills/scripts/stills.mjs keep            # every video with a stills.json
node .claude/skills/stills/scripts/stills.mjs keep <slug>     # one
```

This writes each chosen still at the video's full size as `stills/still-01-02m14s.jpg …` in time order, replaces any stills kept before, and adds each still's `file` and `at` to `stills.json`. It prints a result per video and exits 1 if any `stills.json` is missing, doesn't parse, names a candidate that doesn't exist, or has a still without a caption. Fix those and run it again.

The candidates stay in `stills/candidates/` afterwards, so the choice can be revisited.
