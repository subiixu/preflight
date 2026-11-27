# Accessibility check

Goal: make sure people using a keyboard, a screen reader, zoom or low vision can use the app. Aim for WCAG 2.1 AA.

Look at:

- **Contrast:** work out real contrast from the colours in the code or theme. Normal text needs 4.5:1, large text 3:1. Grey text on dark cards is the usual problem.
- **Labels:** every input has a label, every icon-only button has an accessible name, every meaningful image has alt text.
- **Real controls:** clickable things are buttons or links, not divs or spans with a click handler.
- **Keyboard:** everything can be reached and used with Tab, Enter and Escape, focus is visible, dialogs keep and return focus.
- **Structure:** one main heading per page, headings in order, page titles that say where you are, the page language set.
- **Movement:** animations respect reduced motion, nothing flashes.

If the app can run here and axe, Lighthouse or Playwright is available, use them. Otherwise read the code and mark findings you couldn't prove as `likely`.

Blocking: a main flow that can't be done with a keyboard, a form field with no label on sign-up or payment, text below 3:1 on a main screen.

Review: everything else, grouped by problem with the screens listed.
