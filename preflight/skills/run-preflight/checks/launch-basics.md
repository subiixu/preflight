# Launch basics check

Goal: make sure the boring things a launched app needs are in place.

For every app:

- **Error pages:** a friendly not-found page and error page.
- **Config:** every setting the app needs in production is listed (for example in `.env.example`), and nothing points at a test or local address.
- **Sign-up and emails:** if there are accounts, password reset and sign-up emails work and come from a real sender name.
- **Docs:** the README says what the app is and how to run and deploy it, and what it says is still true. Flag anything in the docs that contradicts the code, and any important behaviour that's written down nowhere.
- **Setup and shipping:** can a new person get it running from the README alone? Is there an automatic check (CI) that builds, lints and tests before a change ships? Is formatting and linting enforced or only hoped for? Is there a clear, repeatable way to deploy and to roll back?

When the `audience` setting is "The public", also check:

- a privacy page, and terms if people pay or post content
- a way to contact the team or report a problem
- page titles, descriptions and a share image on public pages
- a favicon or app icon
- a cookie or tracking notice if the app uses tracking that needs one
- a way for people to delete their account and data, if there are accounts

Blocking: production config pointing at test or local services, no way to reset a password when there are accounts, and with "The public": no privacy page when the app collects personal data.

Review: everything else.
