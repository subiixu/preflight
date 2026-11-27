# Proposal: let a plugin screen read its own results

Preflight's tab can start a run and send fixes today. It can't show the results, because a screen can't read anything in the project, and agents can't write to a plugin's `storage`. So the verdict and findings only reach the user through Nayo's reply and `report.md`.

## The ask

One small, read-only call, limited to the plugin's own folder in the project:

```yaml
can:
  files: read        # read files in .araniko/plugins/<name>/ in this project
```

| Call | Needs | What it does |
|---|---|---|
| `araniko.files.read(file)` | `files: read` | The text of `.araniko/plugins/<plugin>/<file>` in this project, or `null` if it's missing |
| `araniko.files.list()` | `files: read` | The file names in that folder, with size and last-changed time |

Rules:

- Only that one folder. `file` is a plain file name or a path inside it: no `..`, no leading `/`, no links that point outside.
- Text files only, up to 1 MB each.
- Read only. Writing stays with agents, through briefs, so everything that changes the project still goes through Nayo and review.
- The permission list the user sees says: "Read the reports this plugin's agents write in this project".

## Why this shape

- Every plugin already keeps its record at `.araniko/plugins/<name>.md`. A matching folder for its own files is the obvious next step, and `off.md` already cleans it up.
- It's the smallest door that works. The screen can't see source code, secrets or other plugins' files.
- It works for more than Preflight: release notes could show the draft, a docs plugin could show its guide, Namlo could show what happened to each report.

## What changes in Araniko

1. `CAN_KEYS` in the plugin check (daemon `plugins/check.rs` and `scripts/check.py`) gains `files`, with `read` as the only value.
2. `rpc.rs` gains `files.read` and `files.list`, resolving paths under `<project>/.araniko/plugins/<plugin>/` and refusing anything that resolves outside it.
3. `araniko.js` exposes `araniko.files.read` and `araniko.files.list` when the plugin has `files: read`.
4. The guide's "What a screen can call" table gets the two rows above.

## What changes in Preflight

Add `files: read` under `can:` and bump the version to 0.2.0. The screen already looks for `araniko.files.read`: once it exists, results show in the tab and update every 20 seconds while a run is going.
