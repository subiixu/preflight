# Code quality check

Goal: tell the user how healthy the code is, name the ugly parts plainly, and say what's worth cleaning before launch. This check rarely blocks a launch.

Look at:

- **Structure:** are the parts of the app clearly separated, or does everything reach into everything? Look for files or objects that do far too much, parts that depend on each other in a circle, screens that talk straight to the database, and one layer doing another's job.
- **Hotspots:** the longest and most branched functions and files. Name the worst three with their size.
- **Inconsistency:** the same job done several different ways (data loading, error handling, naming), and the same code copied in several places.
- **Error handling:** errors caught and ignored, missing edge cases, and type safety switched off (`any`, ignored type errors, unchecked casts).
- **Leftovers:** TODO and FIXME comments, `console.log` or print debugging, commented-out code, test or sample data, files nothing imports.
- **Comments:** comments that are wrong, rude, embarrassing, or mention private people, clients or keys.
- **Packages:** unused, out of date, no longer maintained, two doing the same job, or very heavy for what they're used for. Licences that don't fit how the app is sold. A missing or out-of-sync lockfile.
- **Warnings:** lint and compiler warnings, using the project's own commands.

Group repeats: one finding for "27 old TODO comments", with the folders they're in, not 27 findings. Label judgments ("this file's job feels unclear") as `likely` and facts as `sure`.

Blocking: only embarrassing or private comments in code users can see (public code, or a web bundle with source maps), or a package licence that forbids how the app is being used.

Review: everything else. Keep it to the findings that would help most, and put structural problems under "Patterns" in the report.
