# _context

What Claude reads before it chooses stills, writes questions, or writes the report. Everything in `guides/`, `course/`, and `private/` is read whole, every run, so adding or rewriting a file changes what comes out. Plain text and Markdown read best; PDFs work too.

## guides/

How to do each step, in prose. These are the current prompts, and they are meant to be rewritten.

- `guides/stills.md`: what makes a still worth keeping
- `guides/questions.md`: what the follow-up questions are for, how the professor asks, the method, the kinds
- `guides/report.md`: what goes in the overview at the top of the report

## course/

The course and the assignment.

- `01_course_description_and_goals.md`: the course description and its learning goals
- `02_final_project_guidelines.md`: the final video project
- `03_scrb111_concept_presentation_rubric.md`: the presentation rubric (audience; set-up, meaty section, outlook; grading standards)

Add anything else that applies, under any file name. One file has a special use: `terms.md`, a short list of names and technical terms (PROTAC, ubiquitin ligase, enamel, iPSC, organoid …) that the transcriber should spell correctly. Keep it to about 200 words; the transcriber ignores anything beyond that.

## prompts/

The earlier prompts for writing follow-up questions, kept whole as the sources `guides/questions.md` was built from and as material to remix. They are not read during a run, since each asks for its own output format; to bring something back from them, move it into the guide.

- `09_pipeline_prompt_2025.md`: the 2025 three-stage prompt (anchors, questions, referee)
- `10_course_and_professor_context_2024.md`: the 2024 single prompt (course, rubric, the professor's style, example questions)

## private/

For material that informs the work but is not published: past student transcripts, the professor's own follow-up questions for them, reflections, internal planning. Everything in `private/` except its README is gitignored, so it stays on this computer and never enters the repository or its history. Claude reads it the same way it reads `course/`. Past transcripts paired with the questions the professor actually asked are the most useful thing that can go here.
