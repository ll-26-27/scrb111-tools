# scrb111-tools

A Claude Code pack for SCRB 111. Point it at a folder of student videos and it produces, for each video, a transcript, a set of stills, and follow-up questions to ask the student, and then one HTML report on all of them.

Built on Marlon's `video-assignment-tools` (`ll-26-27/video-assignment-tools`), November 24, 2026, and split into four skills with a `_context/` folder of course materials that steer them.

## Install (Mac)

- **Homebrew:** the one-line install at https://brew.sh
- **Node** (20 or later) and **ffmpeg:** `brew install node ffmpeg`
- **Claude Code:** https://code.claude.com
- **A HUIT API key** for OpenAI Direct, from the Harvard API Portal

There is no `npm install`; the scripts use no packages.

## Your key

1. `cp .env.example .env`
2. Open `.env` (`open -e .env`) and paste the key after `HUIT_OPENAI_API_KEY=`, no spaces or quotes.
3. Check it: `node .claude/skills/transcription/scripts/transcribe.mjs _videos --dry-run` prints the key as `[hidden, N characters]`, or says there are no videos in `_videos` yet, which also means the script runs.

`.env` is gitignored. Files starting with a dot are hidden in Finder; Cmd-Shift-. shows them.

## Use

1. Open Terminal in this folder and start Claude Code: `claude`
2. Tell it where the videos are:

   > Go through the videos in /Users/me/Desktop/SCRB111 presentations

3. Leave it. It transcribes every video and pulls candidate stills at the same time, then for each video reads the transcript, looks at the frames, keeps the good stills, and writes follow-up questions; then it writes the report and opens it.
4. The report is `outputs/report.html`.

The videos stay where they are. They can be loose in the folder or in subfolders (one per section or group); `.mov`, `.mp4`, `.m4v`, `.mkv`, `.webm`, and `.avi` are picked up. Running it again on the same folder only does what's new.

You can also ask for one step: "just transcribe these", "redo the stills for group-3", "rewrite the questions now that I've added the assignment", "rebuild the report".

## What comes out

```
outputs/
  report.html              the report: an overview, then every video with its questions
  <video>/
    transcript.md          the whole transcript, with times
    transcript.json        the same, as data
    stills/                the kept stills (still-01-02m14s.jpg …), their captions in stills.json,
                           and candidates/ with everything they were chosen from
    questions.md           the follow-up questions, moments worth noticing, anything unsure
    questions.json         the same, as data
    report.html            this video's page: player, stills, questions, transcript
```

In the report, clicking a timestamp or a still plays the video from that moment. The player reads each video from where it sits on your computer, so the pages work on this machine as long as the videos aren't moved.

## Steering it: `_context/`

Claude reads everything in `_context/` before it chooses stills or writes anything. See `_context/README.md`.

- `_context/guides/` holds the instructions for each step, written as prose: what a good still is, what a good follow-up question is, what the report's overview should say. Edit them freely.
- `_context/course/` is for the assignment prompt, the paper, the syllabus, a rubric, and `terms.md` (names and technical terms for the transcriber to spell right). The more is here, the more specific the questions.
- `_context/private/` is for anything that should inform the work but not be published. It is gitignored.

## Running the scripts yourself

```bash
node .claude/skills/transcription/scripts/transcribe.mjs "/path/to/videos"
node .claude/skills/stills/scripts/stills.mjs candidates "/path/to/videos"
# Claude writes stills/stills.json and questions.json for each video
node .claude/skills/stills/scripts/stills.mjs keep
node .claude/skills/questions/scripts/check.mjs
node .claude/skills/report/scripts/render.mjs
open outputs/report.html
```

Each script explains its options with `--help`.

## Privacy

Student videos and everything made from them stay on this computer: `outputs/` and `_videos/` are gitignored. For transcription, each video's sound (not its picture) goes to HUIT's OpenAI Direct gateway and nowhere else. The transcripts and frames are read by the model running Claude Code to choose stills and write questions.
