# UI and UX check

Goal: find what will confuse or annoy a first-time user.

Go through each screen in the main flows (the bugs check lists them, or work them out from the routes). If the app can run here and you can take screenshots, look at the real screens. If not, read the screen code and say so in the summary.

For each screen, check:

- **First use:** does a new user know what to do? Is there an empty state that says what goes here and how to start?
- **Waiting and errors:** is there a loading state? Do errors say what happened and what to do, in plain words, without codes or raw messages?
- **Words:** are labels and buttons clear? Is the same thing called the same name everywhere? Any placeholder text ("Lorem ipsum", "TODO", "Test") left in?
- **Small screens:** if it's a web app, does the layout work at phone width?
- **Dead ends:** buttons that do nothing, links to missing pages, screens with no way back.
- **Consistency:** spacing, fonts, colours and buttons that don't match the rest of the app.

Blocking: a main flow a new user can't finish, placeholder text on a main screen, a screen that breaks at phone width when the app is meant for phones.

Review: everything else. Say which screen each finding is on in `where`.
