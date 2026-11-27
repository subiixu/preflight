# Turn on Preflight

Goal: Nayo knows how to run Preflight in this project, Preflight has a place to keep its reports, and those reports can never be committed.

Don't run any checks now. This step only sets things up.

1. Look at the project first and note down, in plain words:
   - what kind of app it is (website, web app, mobile app, desktop app, command-line tool, library), what it's for and who uses it
   - how mature it is (prototype, internal tool, live product, library)
   - the stack, the main folders with one line each, the entry points, and how data flows through it
   - the habits the code already has (naming, how modules are split, how errors are handled, how tests are written), so advice fits them
   - anything that surprised you
   - the real commands to install, build, run, test and lint, as this project already uses them (write "none" if there isn't one)
   - where the database schema, migrations and access rules live, and which database it is (write "no database" if there isn't one)
   - whether it has sign-ups, payments, file uploads or personal data, and which outside services it calls
   - how it's deployed, and whether anything checks changes automatically (CI), if you can tell

   Read the package files, build and CI config, environment examples and docs before the code.

2. Create the folder `.araniko/plugins/preflight/` and write what you found to `.araniko/plugins/preflight/project.md`, under these headings: "What this is", "How it's built", "Habits to keep", "Commands", "Database", "Sensitive parts", "Deploy". Keep it to one page.

3. Add this block to the project's agent notes (`AGENTS.md`, or the file this project already uses for agent rules). Keep the marker lines exactly as written:

   ```
   <!-- plugin:preflight -->
   When the user or a Preflight brief asks for a preflight check, use the `run-preflight` skill.
   Preflight only reports. Fix a Preflight finding only when a brief asks you to fix that finding.
   <!-- /plugin:preflight -->
   ```

4. Add this block to the end of the project's `.gitignore` (create the file if there isn't one). Keep the marker lines exactly as written:

   ```
   # plugin:preflight
   .araniko/plugins/preflight/results.json
   .araniko/plugins/preflight/report.md
   .araniko/plugins/preflight/runs/
   # /plugin:preflight
   ```

5. Write `.araniko/plugins/preflight.md` listing every file you added or changed, one per line, with "added" or "changed" after it.

Done when `project.md` exists and matches the project, both blocks are in place, and the record file lists every change.
