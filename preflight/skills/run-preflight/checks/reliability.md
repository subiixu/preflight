# Reliability check

Goal: find out what happens when something goes wrong, and whether anyone would know. Assume outside services will fail and traffic will spike.

Look at:

- **Outside services failing:** for each service the app calls (payments, email, AI, storage, auth), what happens if it's slow, down or returns an error? Look for timeouts, sensible retries, and a clear message to the user. A call with no timeout can hang the whole request.
- **Doing things twice:** if a request is retried or a button is pressed twice, can it charge, send or create twice?
- **Failed payments** (skip if the app takes no money): are failed, cancelled and refunded payments handled, and is access taken away or kept correctly?
- **Slow work:** is slow work (sending emails, making files, calling AI, big imports) done in the background, or does the user's request wait on it?
- **The app's own screens:** are there error boundaries so one broken component doesn't blank the whole app? Does every screen that loads data have a loading state and a failure state? Are API failures shown clearly, with a way to try again?
- **Knowing about problems:** are errors logged in production somewhere the team can see, not only printed? Are logs structured and useful (what happened, to whom, which request)? Are passwords, tokens and personal data kept out of logs? Is there a health check? Would anyone be alerted if sign-in, payments or the database broke?
- **Config:** are environment variables checked when the app starts, so it fails fast with a clear message when one is missing? Are development and production settings kept apart?

Blocking: a payment or other money step that can run twice, a main flow that fails silently and loses the user's work, errors in production that go nowhere when the app is for the public.

Review: missing timeouts and retries, missing error boundaries, noisy or thin logs, no health check or alerts, config not checked at startup.

With `depth` "Quick": outside-service failures on the main flow, error logging, and config checks.
