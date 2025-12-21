After review part19-riseworks-disbursement-tdd.md, I found that Part 19 has 54 files for Claude Code (web) to build

These numerous number of files to build create issues related to Long running Agents which are Agents work in discrete sessions without memory of previous work. Each new context window is like a new engineer arriving with no knowledge of what happened before, leading to two main failures - trying to do too much at once and running out of context mid-task, or declaring victory prematurely when seeing partial progress.

I would like you to alleviate issues related to Long running Agents by dividing Part 19 into 3 smaller prompts; namely, Part 19A, Part 19B, and Part 19C according Vertical Slices Approach (You are required to design Vertical Slices Approach for dividing Part 19 into Part 19A, Part 19B, and Part 19C)

Critical Requirements for Division

For division into 19A, 19B, and 19C, Each part MUST include:

1. Handoff Section:
2. Validation Gate:
3. Rollback Plan:

=============================================

These 3 parts must have seamless transition from parts to parts + maintain coherence of contexts across parts + allow Claude Code (web) to build code with smooth transition between parts. All the 3 prompts to Claude Code (web) must be fully self-contained context with full
mission,
dependencies (prerequisite check),
mutual integration with part 12,
essential files to read (reference documents),
critical business rules,
tdd methodology,
unified authentication,
affiliate business logic,
clear and systematic build sequence,
coverage target,
git workflow (commit strategy),
validation requirements,
critical tdd rules,
success criteria,
execution/validation checklist,
file count (reconciliation of number of files built in Part 19A, Part 19B, Part 19C with your previously created Part 18 to ensure that files to build in the 3 parts (19A, 19B, 19C) are not missing),
Troubleshooting Common Issues

Important : I will upload EACH prompt (19A, 19B, 19C) to Claude Code to EACH chat session therefore each prompt must be fully self contained contexts and contents as per requirements above.

Please create Part 19A, Part 19B, and Part 19C in the ARTIFACTS that could be downloaded as txt files (ASCII-only code blocks, Plain text formatting, AI-readable prompts, Copy-paste safe examples, Target: automated code generation).
