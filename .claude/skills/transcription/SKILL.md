---
name: transcription
description: Transcribe SCRB 111 student videos. Sends each video's sound to HUIT (Harvard's OpenAI Direct gateway, whisper-1) and writes a timestamped transcript as JSON and Markdown in outputs/<slug>/. Use when someone points at a folder of videos or names video files and asks for transcripts, or as the first step of the full run described in CLAUDE.md.
---

# Transcription

One script, `.claude/skills/transcription/scripts/transcribe.mjs`. It needs Node 20+, ffmpeg, and `HUIT_OPENAI_API_KEY` in `.env` at the project root. Run it from the project root.

```bash
node .claude/skills/transcription/scripts/transcribe.mjs "/path/to/folder of videos"   # every video under the folder
node .claude/skills/transcription/scripts/transcribe.mjs                               # the same folder as last time
node .claude/skills/transcription/scripts/transcribe.mjs /path/one.mov /path/two.mp4   # just these
node .claude/skills/transcription/scripts/transcribe.mjs "/path/to/folder" --dry-run   # what it would do; sends nothing
```

The folder can be anywhere on the computer; the videos are read where they are and never copied. The folder is remembered in `outputs/run.json`, so later steps and reruns need no path.

## What it writes

For each video, `outputs/<slug>/` (the slug comes from the file's path under the folder: `group a/Clip One.mp4` becomes `group-a--clip-one`):

- `manifest.json`: where the video is, its length and picture size
- `transcript.json`: HUIT's response, with `segments` that each have `start` and `end` in seconds
- `transcript.md`: the whole transcript, `[mm:ss]` before each segment

## Things to know

- Up to 8 videos go at once (`--jobs 4` for fewer). A video already transcribed is skipped; `--force` redoes it.
- A video longer than 55 minutes is sent in 50-minute parts and joined into one transcript with the times carried through. The join can split a word at a part boundary; the parts' start times are in `transcript.json` under `parts`.
- If HUIT is busy or the network drops, each request is tried again three times (after 5, 20, and 60 seconds) before the video is marked failed.
- Spelling hints: if `_context/course/terms.md` exists, its contents go to the transcriber as hints (names, gene and protein names, course terms). Whisper only uses about the last 200 words of hints, so that file should be a short list. `--prompt "..."` overrides it. `--language en` helps accuracy when all the speech is in one language.
- With more than a few videos, or any long ones, run the script in the background so the 10-minute limit on a foreground command doesn't stop it.
- The script prints one JSON line of results per video (`made`, `kept`, `no-audio`, `failed`) and exits 1 if any failed. A video with no sound track gets no transcript; say so in the report back and carry on with its stills.

## Privacy

The sound goes only to HUIT's gateway. Don't switch to any other transcription service for student work. Never print the key; a dry run shows it as `[hidden, N characters]`.
