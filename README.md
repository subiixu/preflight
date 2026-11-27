# Preflight for Araniko

Checked at every layer. Cleared for launch.

An Araniko plugin that checks your whole app before you ship it: security, database, bugs, tests, reliability, code quality, UI and UX, accessibility, speed and launch basics. You pick the checks in a Preflight tab inside your project, Nayo's workers do the work, and Preflight gives a plain verdict: **Cleared for launch**, **Review before launch** or **Launch blocked**.

The plugin is in [`preflight/`](preflight/). What it does for users is in its [README](preflight/README.md).

## How it works

- **`on.md`** writes a short profile of the project (`.araniko/plugins/preflight/project.md`), adds a block to the agent notes, and keeps reports out of git.
- **`skills/run-preflight/`** is the method: how to split checks across workers, one guide per check in `checks/`, the shape of `results.json`, and fixed rules for the verdict and scores so they mean the same thing every run.
- **`screens/preflight/`** is the tab. It sends one brief per run (well under the 10-an-hour limit) and one per **Fix this**. It remembers your picked checks and past runs in the plugin's own storage.
- **`off.md`** removes everything, reports included.

Preflight only reports. Nothing in your project is changed until you press **Fix this** on a finding.

## Reading results

The tab reads `results.json` with `can: files: read`, which lets a plugin screen read only its own folder, `.araniko/plugins/<name>/`, in the project. Araniko gained it for Preflight: see [`docs/results-api.md`](docs/results-api.md). On an older Araniko the tab still starts runs and sends fixes, and points to `report.md` for the results.

## Try it

```
araniko plugin check ./preflight
araniko plugin add ./preflight
```

Then turn it on in a project from the Plugins page. Opening `preflight/screens/preflight/index.html` in a browser shows the tab with sample results (`?state=empty` for a first run).

## List it

Push this repo, then add `plugins/preflight.yaml` to the public list:

```yaml
repo: subiixu/preflight
commit: <full 40-character commit>
path: preflight
```
