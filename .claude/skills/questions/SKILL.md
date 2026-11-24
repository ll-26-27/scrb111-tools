---
name: questions
description: Write follow-up questions for SCRB 111 student videos. Claude reads each video's whole transcript and its stills, with the course materials in _context/, and writes grounded, timestamped follow-up questions as outputs/<slug>/questions.json; a script checks them and writes questions.md. Use when someone asks for follow-up questions, discussion or feedback prompts, or questions to ask students about their videos, or as part of the full run described in CLAUDE.md.
---

# Questions

This step is reading and writing by you; the script only checks the result. It needs a transcript (the transcription skill) and is better with stills (the stills skill), since the transcript misses everything on screen.

## For each video

1. Read `_context/guides/questions.md` in full. It says what the questions are for and what makes a good one. Then read everything in `_context/course/` and `_context/private/` in full: the assignment, the paper the students presented, the professor's reflections. Those decide what is worth asking; where they and the guide disagree, they win.
2. Read `outputs/<slug>/manifest.json` and `outputs/<slug>/transcript.md`, all of it.
3. Look at the stills: the kept ones in `outputs/<slug>/stills/` with their captions in `stills.json` if they have been chosen, otherwise every candidate in `stills/candidates/`. Say what is on screen only if you saw it in a frame.
4. Write `outputs/<slug>/questions.json`:

```json
{
  "schema": 1,
  "video": "<slug>",
  "written_by": "Claude (<model>)",
  "written_at": "<ISO time>",
  "summary": "Two to four plain sentences on what the video does: what it presents, how, with what on screen. Descriptive, not a grade.",
  "observations": [
    { "at": 42.5, "note": "A specific moment worth noticing, and what's there." }
  ],
  "questions": [
    {
      "at": 42.5,
      "question": "The question, as it would be asked to the student.",
      "why": "What it is for: what it might draw out, for the professor reading it.",
      "kind": "understanding"
    }
  ],
  "uncertain": ["Anything the transcript or frames leave unclear, e.g. a term that may be misheard at 01:12."]
}
```

- `at` is seconds into the video, taken from a transcript segment's `start` or a still's `at`; `null` for a question about the whole piece.
- `kind` is one of the kinds named in the guide.
- How many questions and observations: as the guide says.

If `_context/course/` is empty, write the questions anyway from the guide alone and say in your report back that they were written without the assignment.

## Many videos

With more than two or three, give each video to its own subagent, up to 8 at a time. Tell each one the project root, its slug, and to follow this skill (and the stills skill's choosing step, if stills haven't been chosen), writing only inside its own `outputs/<slug>/` and returning one line. Subagents start with none of this conversation, so the instruction to read `_context/` in full has to be in what you tell them.

## Check

```bash
node .claude/skills/questions/scripts/check.mjs           # every video
node .claude/skills/questions/scripts/check.mjs <slug>    # one
```

For each video this confirms `questions.json` exists, parses, has questions with text, and that every time falls inside the video; then it writes `outputs/<slug>/questions.md`, the same questions as a page that reads on its own. It exits 1 and names the problems otherwise. Redo any that fail and run it again before moving on.
