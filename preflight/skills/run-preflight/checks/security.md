# Security check

Goal: find anything that would let someone steal data, money or accounts, or take the app down. Assume it will be attacked.

Look at:

- **Secrets:** keys, tokens and passwords in code, config, the client bundle or git history (`git log -p` on files that hold config). A secret that reaches the browser or a mobile app is always blocking.
- **API routes:** list every route and check each one: does it need a login, and does it check for one? Is there a limit on how often it can be called? Expensive routes (AI calls, emails, exports, uploads, search) need a limit most, because anyone can run up a bill or slow the app for everyone.
- **Logins and sessions:** where tokens are kept (not in places page scripts can read, if avoidable), whether sessions expire and sign-out really ends them, password rules, limits on login attempts, and whether password reset links are single-use, short-lived and can't reveal who has an account. Sensitive actions (changing email or password, deleting the account, paying out) should ask for the password again.
- **Who can do what:** can one user read or change another user's data by changing an id? Are admin pages and routes protected by a role check on the server, not only hidden in the UI? Are team or organisation permissions enforced on the server? Follow at least the three most important routes from request to database.
- **Input:** does every backend route validate what it's sent, reject fields it doesn't expect, and limit the size of the payload? Anything that builds SQL, HTML, shell commands or file paths from user input. Unsafe loading of data formats that can run code. File uploads: type checked by content, size limited, stored outside the web root.
- **Payments and webhooks** (skip if the app takes no money): are webhook signatures verified (for example Stripe's)? Is each handler safe to run twice for the same event? Could a fake or replayed event give someone access? Is access granted from the server's own record of the payment, never from what the browser says?
- **Packages:** run the project's audit command (`npm audit`, `pnpm audit`, `pip-audit`, `cargo audit` or similar) if one works offline or the network allows it. Only report holes that are high or critical, or that the app actually uses.
- **Settings:** CORS, cookies (secure, http-only, same-site), security headers, debug mode left on, overly open permissions on storage buckets or cloud config.

Blocking: a secret reaches users, anyone can read or change another person's data, a private or admin route has no server-side check, user input reaches SQL or a shell unchecked, a webhook that grants access without verifying its signature, a critical package hole the app uses.

Review: everything else worth fixing, like missing rate limits on cheap routes, missing headers, weak password rules or old packages without a known hole.

With `depth` "Quick": secrets, login checks on routes, webhook signatures and the package audit only.
