# Speed check

Goal: find what will make the app feel slow for real users, now and as it grows.

Look at:

- **What users download:** build the app and check the size of the main bundle and the biggest pages. Large libraries pulled in for one small use. Code that should load later but loads first.
- **Images, files and fonts:** images not resized or compressed, no lazy loading below the fold, many font files. Large files and uploads should be served from object storage through a CDN, not from the app server.
- **Data:** queries inside loops, lists with no limit or paging, the same data fetched several times on one screen, missing caching for things that rarely change.
- **Request handlers:** slow or blocking work done during a request that could happen in the background, blocking calls inside async code, missing timeouts on outside calls.
- **Growing without limit:** memory, files, queues, logs or tables that only ever grow.

If the app can run here and Lighthouse is available, run it on the two most important pages and include the scores in the summary.

Blocking: a main page or list that will clearly get unusable as data grows (no limit, query in a loop over all rows).

Review: everything else, with a rough idea of how much it would help.
