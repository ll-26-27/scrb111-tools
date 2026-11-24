# Writing follow-up questions for a SCRB 111 final-project video

*November 24, 2026. Built from the course's 2024 prompt and 2025 three-stage prompt (both in `_context/prompts/`), the rubric, and the final project guidelines. This file is the professor's to rewrite: the questions skill reads all of it every time, so changing a sentence here changes the questions.*

## What the videos are and what the questions are for

Each video is a pair of students' final project: a presentation of about five minutes on a key concept in stem cell and regenerative biology, made for the general public. The rubric (`_context/course/03_scrb111_concept_presentation_rubric.md`) expects a set-up (why anyone should care), a meaty section (how it actually works), and an outlook (what problems remain).

The questions are the ones the professor asks the pair in class after their video is shown. They are spoken aloud, in front of the other students, so they have to be short, plain, and answerable on the spot by someone who made the video. They get the students to say more about the biology and to think one step past what the video said.

## How the professor asks

- She cares about conceptual understanding more than jargon or technical detail.
- She probes definitions, mechanisms, and how ideas connect.
- She asks students to reason about feasibility (how would this be delivered, tested, targeted) and about limitations and ethics.
- Sometimes she asks about how the presentation is built: the order of ideas, whether an analogy does its job.
- She gives no praise and no general evaluation. Only open-ended questions.
- Her tone is collegial, curious, supportive, precise.

`_context/examples/` holds four past transcripts and the professor's own questions for each. Read each transcript beside its questions before writing: they are the best evidence of what she asks. Match their length and register; don't reuse their wording.

## Method

Work in three passes. The first two go into `questions.json`; the third is a check on what you wrote.

### 1. Anchors (`observations`)

Read the whole transcript and look at the stills, then pick six to eight anchors: statements, terms, or mechanisms in the video that are worth probing. For each, give its time, quote the students' words, and say in a clause why it invites a question.

Look for these, in this order of priority:

1. **A term used but not defined or explained.** The audience is the general public, so a word like "fate," "self-organized," or "factors" that goes by without a definition is the first thing she asks about.
2. **A mechanism with a step missing.** The video says that something happens but not how: what recognizes what, what connects two things, what makes it specific.
3. **A limitation or a question of delivery that goes unexamined.** How it gets into the body, how it reaches only the cells that need it, what could go wrong, what is glossed in a phrase like "much safer."
4. **An analogy or a choice of structure.** Optional, and secondary to the first three.

### 2. Questions

Write three to five questions from the strongest anchors, the most important first. The first three should cover, between them:

- a term or phrase that needs clarifying,
- a mechanism or a question of feasibility,
- a limitation, the outlook, or how clear the explanation is for the public.

A fourth or fifth is worth adding only when a strong anchor is left over. In past years the set was exactly three, so the first three must stand on their own.

Each question:

- **Is short.** Twenty-five words at most; twelve to eighteen is ideal.
- **Asks one thing.** No two-part questions.
- **Is open.** Not answerable yes or no, unless the yes or no plainly invites more.
- **Uses the students' own words.** Quote the term or phrase from the video: "What does 'fate' mean in your usage here?"
- **Adds no jargon.** Use only technical terms that are in the transcript; otherwise everyday words.
- **Stays in the video.** Ask only about what was said or shown. No invented details.
- **Carries no praise, no grade, no verdict.** If the science sounds wrong or thin, ask the students to walk through it, and put what you suspect in `why`, where the professor will read it and the students won't.

Examples of the register, from the 2024 prompt (for tone and length, not to copy):

- "What does 'fate' mean in your usage here?"
- "How are enamel-producing cells and dental pulp connected?"
- "What features are recognized when the cell decides a protein should be degraded?"
- "How would this approach target only the affected tissue?"
- "Which limitations you mentioned would most affect real-world success?"

### 3. Check each question before keeping it

1. Twenty-five words or fewer, one part.
2. Grounded in an anchor; nothing invented.
3. No technical term that isn't in the transcript.
4. Names or quotes the term or claim it is about.
5. Together, the first three touch clarity, mechanism or feasibility, and limitation or outlook.
6. Curious, collegial, precise.

If a question breaks one of these, rewrite it as lightly as possible.

## Kinds of question (`kind`)

- `clarity`: what a term or phrase means. ("What does [term] mean in this context?")
- `mechanism`: how a process works or how two things are connected. ("How does [process] ensure [outcome]?")
- `feasibility`: delivery, targeting, testing. ("How would this be delivered or tested in vivo?")
- `limitations`: risks, constraints, ethics. ("What risks or constraints might affect this approach?")
- `communication`: structure, order, analogy. ("Would your analogy work better earlier or later?")
- `reflection`: what they would expand or do next. ("What aspect of your explanation could you expand for a general audience?")

## The other fields

- `summary`: two to four sentences on what the video presents and how it goes about it: the topic, the problem it sets up, the explanation in the meaty section, the outlook, and what is on screen. Descriptive only.
- `why`, on each question: one sentence for the professor on what the question is after, including any suspected gap or error behind it.
- `uncertain`: anything the transcript or stills leave unclear.

## Stay inside the evidence

- You have a transcript and some stills, not the video. If a question depends on what happens between frames, say so in `why` or put it in `uncertain`.
- The transcriber gets technical terms wrong, often as an ordinary word that sounds similar ("Protax" for PROTAC and "animal" for enamel in the past transcripts), and may spell the same term several ways in one transcript. Work out the intended term from context and use the correct spelling in the question; note the correction in `uncertain` with its time. If you can't tell what was said, don't build a question on it.
- The rubric's grading standards are in `_context/course/` so you know what the assignment asked for. Don't apply them: no grades, no rubric language, no ranking of videos.
- No guesses about the students' personal lives, feelings, or identity, and no student names unless the professor asks for them.
