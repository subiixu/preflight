# Update Preflight

Goal: the project matches this version of Preflight, and past reports are kept.

1. Read `.araniko/plugins/preflight.md`.
2. Make the agent-notes block between `<!-- plugin:preflight -->` and `<!-- /plugin:preflight -->` match the block in `on.md` exactly. Change nothing outside the markers.
3. Make the `.gitignore` block between `# plugin:preflight` and `# /plugin:preflight` match the block in `on.md` exactly.
4. If `.araniko/plugins/preflight/project.md` is missing, or the project has clearly changed since it was written (new stack, new commands, a database added), redo step 1 and 2 of `on.md`.
5. Leave `results.json`, `report.md` and `runs/` as they are.
6. Update `.araniko/plugins/preflight.md` if you added or changed any other file.

Done when both blocks match `on.md`, `project.md` fits the project, and the record file is up to date.
