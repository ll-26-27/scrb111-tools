# scrb111-tools: instructions for Claude

A pack for SCRB 111. The videos are the final projects: pairs of students presenting a concept in stem cell and regenerative biology to the general public in about five minutes. The professor points this at a folder of them on her computer and gets back transcripts, stills, the follow-up questions she asks each pair in class after the viewing, and an HTML report. `README.md` is the version for people.

## The flow

When someone gives you a folder of videos (or video files) and asks you to go through them, run the whole flow to the end without stopping to ask. She may have walked away. If something is missing or a video fails, carry on with the rest and say what happened at the end.

Four skills in `.claude/skills/`, each with its own `SKILL.md`; follow them. Run every command from this folder.

1. **transcription** and **stills (candidates)**, started at the same moment, since neither needs the other:
   ```bash
   node .claude/skills/transcription/scripts/transcribe.mjs "<folder>"
   node .claude/skills/stills/scripts/stills.mjs candidates "<folder>"
   ```
   With more than a few videos or any long ones, run both in the background and wait for them.
2. **stills (choose)** and **questions**, per video, once both scripts have finished. Each video: read `_context/guides/`, `course/`, `examples/`, and `private/` in full, read the whole transcript, look at every candidate, write `stills/stills.json`, then write `questions.json`. With more than two or three videos, one subagent per video, up to 8 at a time.
3. **Check what was written:**
   ```bash
   node .claude/skills/stills/scripts/stills.mjs keep
   node .claude/skills/questions/scripts/check.mjs
   ```
   Redo any video either one names, and run them again until both pass or a video has been tried twice.
4. **report:** write `outputs/overview.json`, then
   ```bash
   node .claude/skills/report/scripts/render.mjs
   open outputs/report.html
   ```
5. **Report back:** the full path to `outputs/report.html`; how many videos; any without a transcript, stills, or questions, and why; whether `_context/course/` had anything in it.

Someone can also ask for one step alone ("just transcribe these", "redo the stills for group-3"); then run that skill only.

## Where things are

```
_context/guides/     how to choose stills, write questions, write the overview: the prompts, in prose
_context/course/     the course description, final project guidelines, rubric; terms.md if added
_context/examples/   past transcripts and the professor's own questions for them, names removed
_context/prompts/    the 2024 and 2025 question prompts the guide was built from; not read during a run
_context/private/    anything with students' names, internal material; gitignored
.claude/skills/      transcription, stills, questions, report; _shared/lib.mjs is their common code
outputs/             everything made; gitignored
  run.json             the videos folder used last time
  report.html          the report
  overview.json        what the report's opening is rendered from
  <slug>/
    manifest.json      where the video is, its length
    transcript.json, transcript.md
    stills/            still-NN-MMmSSs.jpg, stills.json, candidates/, candidates.json
    questions.json, questions.md
    report.html        this video's page
_videos/             an optional place to put videos; gitignored. Any folder on the computer works.
.env                 HUIT_OPENAI_API_KEY; gitignored
```

## Rules

- **Read whole files.** Every file in `_context/` and every transcript is read from first line to last before writing from it. If a file is too long for one read, read it in consecutive pieces until it is finished. If something can't be read in full, say so first and name what was left out.
- **`_context/` decides.** The guides say how; `course/`, `examples/`, and `private/` say what matters in this course. When the professor's materials and a guide disagree, her materials win. Don't invent course content that isn't there: if `course/` is empty, write from the guides and say so.
- **Student work stays on this computer.** `outputs/` and `_videos/` are gitignored and stay that way. Nothing made from a video is committed, posted, uploaded, or pasted anywhere. The sound goes only to HUIT for transcription; no other outside service gets any of it.
- **`_context/private/` never goes into git,** and nothing from it is quoted in a file that does: not in a guide, a skill, the README, or a commit message. It can shape what you write in `outputs/`.
- **No grades.** The rubric is there so you know what the assignment asked. Nothing you write scores, ranks, or praises a video.
- **Students are "you"** in questions, and videos are named by file name, unless the professor asks for names.
- **The key** lives only in `.env`. Never print or commit it.
- **Scripts** use Node built-ins and ffmpeg only: no packages, no `npm install`. Shared code goes in `.claude/skills/_shared/lib.mjs`.
- Write Markdown prose without hard wraps.
