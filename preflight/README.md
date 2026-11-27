# Preflight

Checked at every layer. Cleared for launch.

Preflight checks your app over before you ship it, then tells you plainly where you stand: **Cleared for launch**, **Review before launch** or **Launch blocked**.

Pick what to check in the Preflight tab:

- **Security:** exposed keys, unprotected routes, weak login, unsafe input, fake payment events
- **Database:** who can read and change what, risky migrations, what happens as data grows
- **Bugs:** the build, the tests, and the main things a user does
- **Tests:** whether the tests cover what matters and actually prove it works
- **Reliability:** what happens when a service fails, and whether you'd know
- **Code quality:** structure, messy spots, leftover TODOs, old or heavy packages
- **UI and UX:** confusing screens, missing empty, error and loading states
- **Accessibility:** contrast, labels, keyboard use, image descriptions
- **Speed:** heavy pages, big images, slow queries
- **Launch basics:** privacy page, error pages, docs, config, how it ships

Press Run and Preflight hands the work to Nayo, one check per worker. It only reports. Nothing is fixed until you press **Fix this** on a finding, which sends Nayo a brief for that one thing.

Results show up in the Preflight tab as soon as Nayo finishes: the verdict and score, any decision only you can make, what's blocking launch, quick wins you can send to Nayo in one go, and the rest grouped by check. Each finding points to the file it's about, explains the problem in plain words, and says how to fix it. A Plan view gives a suggested order and the patterns behind the findings, and "About this run" shows what your project already does well and what Preflight couldn't check.

Preflight asks Araniko for one permission beyond sending briefs and keeping your picks: reading the reports its own agents write in `.araniko/plugins/preflight/`. It can't see anything else in your project. Database checks read your schema and access rules. They never connect to your live database.

## What it adds to your project

- A short block in your agent notes telling Nayo how to run Preflight.
- `.araniko/plugins/preflight/project.md`: what kind of app this is and how it builds and tests.
- Lines in `.gitignore` so reports, which can describe security problems, are never committed.

Turning Preflight off removes all of it, including past reports.

## Settings

- **Who will use it:** "The public" adds the launch basics a public app needs, like a privacy page.
- **How deep to check:** "Quick" is a fast pass for a second run. "Thorough" reads more and runs more.
