# _context

What Claude reads before it chooses stills, writes questions, or writes the report. Everything here is read whole, every run, so adding or rewriting a file changes what comes out. Plain text and Markdown read best; PDFs work too.

## guides/

How to do each step, in prose. These are the prompts, and they are meant to be rewritten.

- `guides/stills.md`: what makes a still worth keeping
- `guides/questions.md`: what the follow-up questions are for, what a good one looks like, the kinds
- `guides/report.md`: what goes in the overview at the top of the report

## course/

Materials about the course and the assignment. Empty to start; add whatever applies, under any file names:

- the assignment prompt the students were given
- the paper or papers they presented
- the syllabus, or the part of it about this unit
- a rubric, if there is one
- `terms.md`: a short list of names and technical terms (gene and protein names, authors, lab jargon) for the transcriber to spell correctly. Keep it to about 200 words; the transcriber ignores anything beyond that.

## private/

For material that informs the work but should not be published: reflections on past years, notes on particular sections, internal planning. Everything in `private/` except its README is gitignored, so it stays on this computer and never enters the repository or its history. Claude reads it the same way it reads `course/`.
