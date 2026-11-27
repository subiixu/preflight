---
name: run-preflight
description: Use when the user or a Preflight brief asks for a preflight check, a pre-launch check, or "are we ready to ship?". Runs the picked checks, writes the report and gives a verdict.
---

# Run Preflight

Goal: an honest verdict on whether this project is ready to launch, backed by findings the user can act on. Preflight reports. It never fixes anything unless a brief asks to fix one named finding.

## How to think

Don't ask only "does it work?". Ask whether it survives real use:

- Assume the app will be attacked.
- Assume users will do unexpected things.
- Assume outside services will fail.
- Assume the database will grow.

And stay honest:

- Read before judging. Understand what the project is and how it's built before you call anything a problem.
- Ground every finding in a real file and line. If you can't verify something, say so. Never guess.
- Fit the project. Use `project.md` to see how mature it is and how it already does things. Don't ask a weekend prototype for enterprise infrastructure, and recommend fixes in the project's own style.
- A few findings you're sure of beat many you're not. If a check is healthy, say so in one line and move on.
- In a large project, go deep on the core that does most of the work, and say which areas got a lighter look.

## Before you start

1. Read `.araniko/plugins/preflight/project.md`. If it's missing or clearly out of date, rebuild it as `on.md` step 1 and 2 describe, then continue.
2. Work out which checks to run. A Preflight brief lists them. If the user just asked in words, run all ten.
3. Note the settings the brief gives: `audience` ("Just me and my team" or "The public") and `depth` ("Quick" or "Thorough").

## Split the work

Give each check its own worker, with its own small brief. One check per worker keeps every brief narrow. Each worker brief says:

- the check, and the guide to follow: `checks/<id>.md` in this skill's folder
- the "How to think" rules above
- the `depth` and `audience` settings
- "Report only. Don't change any file except your handoff."
- "Return your findings in the shape below, plus up to three things this area does well, then stop."

If the project is small (under about 50 source files), you may run two or three related checks in one worker. Never more than three.

The check ids: `security`, `database`, `bugs`, `tests`, `reliability`, `code`, `ux`, `accessibility`, `speed`, `launch-basics`.

## What each check returns

For the check:

- `status`: `cleared`, `review`, `blocked` or `could-not-check`
- `summary`: one plain line, like "2 critical, 1 to review"

And a list of findings, at most 8 per check, the most important first. Each has:

- `id`: the check id plus a number, like `security-1`
- `level`: `blocking` (must be fixed before launch) or `review` (worth fixing, the user decides)
- `title`: what's wrong, in plain words, under 70 characters. Say the effect, not the jargon: "Anyone signed in can read every household", not "Missing RLS policy".
- `detail`: one or two sentences: why it matters, and how it would actually go wrong with real users
- `fix`: the specific fix, in one or two sentences, in this project's own stack and style. Never vague advice like "improve validation": name the change.
- `where`: `path/to/file:line`, or the screen or flow it's about
- `confidence`: `sure` (you verified it) or `likely` (a judgment, or something you couldn't prove)
- `effort`: `S` (under 2 hours), `M` (half a day) or `L` (a day or more)

Rules for every finding:

- Check it for real: read the file, run the command, follow the code. Never report a guess as `sure`.
- One problem per finding. Group repeats ("27 old TODO comments") instead of listing each one.
- Never copy a secret's value into a finding. Say where it is, not what it is.
- If a check can't be done (no app to run, needs a real device, needs a paid account), set `could-not-check` and say why in `summary`. Never count it as passed.

## Put it together

When every worker is done, you (not a worker) write the results in the main checkout:

1. `.araniko/plugins/preflight/results.json`, in exactly this shape:

   ```json
   {
     "version": 2,
     "started_at": "2026-11-27T14:14:00+11:00",
     "finished_at": "2026-11-27T14:41:00+11:00",
     "settings": { "audience": "The public", "depth": "Thorough" },
     "verdict": "blocked",
     "headline": "Launch blocked",
     "summary": "Fix the 3 critical issues before continuing.",
     "score": 72,
     "checks": [
       { "id": "security", "status": "blocked", "summary": "2 critical, 1 to review", "score": 58 }
     ],
     "findings": [
       {
         "id": "security-1", "check": "security", "level": "blocking",
         "title": "Payment secret key is sent to the browser",
         "detail": "Anyone could read it from the app and charge cards.",
         "fix": "Move the charge call into a server route and read the key from the server's environment only.",
         "where": "src/lib/pay.ts:12", "confidence": "sure", "effort": "S", "state": "open",
         "note": "Also reported as bugs-2."
       }
     ],
     "decisions": [
       {
         "id": "public",
         "question": "Is this app really open to the public?",
         "detail": "Two plain sentences: what you found, and which findings depend on the answer.",
         "findings": ["launch-basics-1", "launch-basics-2"],
         "options": [
           { "label": "Open it to the public properly", "brief": "What Nayo should do if the user picks this, in two or three sentences." },
           { "label": "Keep it private, turn sign-ups off", "brief": "What Nayo should do if the user picks this." }
         ]
       },
       { "id": "backups", "question": "Backups and a separate dev database", "detail": "Both cost money on Supabase.", "findings": ["database-1"], "options": [] }
     ],
     "quick_wins": ["tests-2", "ux-3"],
     "order": [
       { "title": "Safety net first", "text": "One or two plain sentences.", "findings": ["tests-2", "tests-1"] }
     ],
     "patterns": [ { "title": "Failures stop at the throw", "text": "One or two plain sentences: what's going on, and what good looks like." } ],
     "not_now": [ "One line each: the thing, and why it can wait." ],
     "strengths": [ "One line each." ],
     "limits": [ "One line each: what couldn't be checked or got a lighter look, and why." ],
     "notes": [ "Anything you changed while putting it together, like merged duplicates or a level you changed." ]
   }
   ```

   Only list checks that were picked. `state` is `open` for every new finding. Every list holds the same things as the matching section of `report.md` (see below), so the Preflight tab can show the whole report:

   - `decisions` is "Only you can decide". Put the one that most changes what to fix first. Give `options` only when the choices are clear and each one is something Nayo can do; each option's `brief` is what gets sent to Nayo if the user picks it. Otherwise leave `options` empty.
   - `quick_wins` lists finding ids with effort `S` that help most, best first, at most 8.
   - `order` is the suggested order. Each step names the findings it covers, if any.
   - Keep every text short and plain: the tab shows them as they are.

2. `.araniko/plugins/preflight/report.md`: the same results for a person to read, in this order. Skip a section that has nothing in it.
   - The headline and summary.
   - **Blocking launch:** each finding with its fix.
   - **Review before launch:** each finding with its fix.
   - **Quick wins:** the findings with effort `S` that help most, as a short list.
   - **Patterns:** the 3 to 5 themes that explain most of the findings (for example "errors are handled differently in every file"), each with one line on what good looks like.
   - **Suggested order:** first a safety net if one is missing (tests around what's about to change, a build check), then the blocking findings, then the quick wins, then the rest.
   - **Not worth fixing now:** things you noticed and deliberately left out, and why (too much effort for the payoff at this stage).
   - **What this project does well:** up to five strengths worth keeping.
   - **Only you can decide:** open questions about product intent, taste, people or money.
   - **Couldn't check:** the checks or areas that couldn't be done or got a lighter look, and why.
   - The cleared checks, in one line.

3. Before writing, move the old `results.json` and `report.md` into `.araniko/plugins/preflight/runs/<started_at date and time>/`. Keep the 5 newest runs and delete older ones.

### The verdict

- `blocked`, headline "Launch blocked": at least one `blocking` finding.
- `review`, headline "Review before launch": no blocking findings, but at least one `review` finding or a check that couldn't be done.
- `cleared`, headline "Cleared for launch": nothing left.

The `summary` is one plain sentence saying what to do next: "Fix the 3 critical issues before continuing.", "2 checks need your attention.", "All required checks passed."

### The scores

So scores mean the same thing every run, work them out, don't judge them:

- A check's score starts at 100. Take off 25 for each `blocking` finding and 8 for each `review` finding. The lowest is 0. A check that couldn't be done has no score.
- The overall `score` is the average of the checks that have one, rounded.

## Reply to the user

End with three to five lines, in Preflight's voice: calm, precise, plain words, no alarm and no emoji.

1. The headline and summary.
2. The blocking findings, one line each, if there are any.
3. "Full report: .araniko/plugins/preflight/report.md"

Then offer to fix the blocking findings one at a time.

## Fixing one finding

When a brief says "Fix Preflight finding `<id>`":

1. Read that finding in `results.json`.
2. Fix only that problem, in the smallest change that solves it, and run the project's checks. Start from the finding's `fix`, but check it still fits the code as it is now.
3. Re-check just that finding the way its check guide says.
4. In `results.json`, set the finding's `state` to `fixed` if it's solved, or leave it `open` and add a `note` saying what's left. Work the verdict, check scores and overall score out again with the rules above, counting only `open` findings. Update `report.md` to match.

A brief may name several findings ("Fix Preflight findings `a`, `b` and `c`"). Fix them one at a time, as above, in the order given, and run the project's checks after each one.

## Acting on a decision

When a brief says "Preflight decision `<id>`: <the option's label>", do what the option's brief describes. Then remove that decision from `decisions` in `results.json` and `report.md`, and update any findings it settled.
