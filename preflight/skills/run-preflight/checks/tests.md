# Tests check

Goal: tell the user how much they can trust the tests, and where a safety net is missing. The bugs check runs the tests. This check judges them.

Look at:

- **What's covered:** find the core logic (money, permissions, the main thing the app does) and check whether tests cover it. Use the project's coverage command if it has one. A number alone isn't the point: name the important parts with no test.
- **What the tests prove:** do they check behaviour (the right result, the right error), or only that code runs without crashing? Tests with no real assertion, or that mock away the thing being tested, don't count.
- **Kinds of test:** are there unit tests for logic, and at least one test that runs a main flow end to end or through the real API? Say which kind is missing.
- **Flaky patterns:** tests that depend on the clock, on order, on the network or on sleeps. Tests that are skipped or commented out, and why.
- **Code that can't be tested:** core logic tangled into screens or route handlers so it can't be tested alone.
- **Do they run:** are tests run automatically (CI or a pre-push step) so a broken change can't slip in?

Fit the project: a prototype needs a few tests on what matters, not full coverage.

Blocking: almost never. Only when the app handles money or access control for the public and that logic has no test at all.

Review: everything else. Where a blocking finding from another check is about to be fixed in untested code, say so: a test should come first.

With `depth` "Quick": coverage of the core logic and whether tests run automatically.
