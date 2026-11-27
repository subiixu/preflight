# Bugs check

Goal: find what will break for a real user.

1. Run the install, build, type check, lint and tests with the commands in `project.md`. A build that fails is blocking. Failing tests are blocking unless they're clearly marked as known or skipped.
2. List the 5 to 9 most important things a user does (sign up, sign in, the main task, paying, settings, signing out). Write them in the check's `summary` as "x of y flows checked".
3. For each flow, follow it through the code from the screen to the data and back. Look for:
   - errors that are caught and ignored, or never caught
   - missing checks for empty, null or slow answers
   - forms that can be sent twice, or sent empty
   - dates, money and time zones handled by hand
   - anything marked TODO or FIXME on the path
4. If the app can run here and there's a way to drive it (Playwright, a simulator, a dev server and curl), run each flow for real. If it can't run here, say so in the summary and mark findings you couldn't prove as `likely`.

Blocking: the build fails, tests fail, a main flow can't be finished, or data can be lost.

Review: edge cases, rare errors, things that only go wrong with slow networks.

With `depth` "Quick": step 1, and only the sign-in and main task flows.
