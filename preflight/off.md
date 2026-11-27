# Turn off Preflight

Goal: everything Preflight added is gone, including its reports, and the project still works.

1. Read `.araniko/plugins/preflight.md` for the list of files Preflight added or changed. If it's missing, look for the things named in steps 2 to 4 anyway.
2. In the agent notes, remove everything from `<!-- plugin:preflight -->` to `<!-- /plugin:preflight -->`, including both marker lines. Leave the rest of the file exactly as it is.
3. In `.gitignore`, remove everything from `# plugin:preflight` to `# /plugin:preflight`, including both marker lines. If the record says Preflight created `.gitignore` and nothing else is left in it, delete the file.
4. Delete the folder `.araniko/plugins/preflight/` and everything in it: `project.md`, `results.json`, `report.md` and `runs/`. These are Preflight's own notes and reports, not the user's work.
5. Delete `.araniko/plugins/preflight.md`.

Don't undo any fixes made from Preflight findings. Those are normal changes the user asked for.

Done when both marker blocks are gone, the `.araniko/plugins/preflight/` folder and the record file are gone, and the project still builds.
