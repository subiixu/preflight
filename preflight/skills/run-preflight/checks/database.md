# Database check

Goal: make sure the data is safe, and that the database will hold up once real people use it. Assume it will grow.

Never connect to a live or production database, and never run a migration. Read the schema, migrations, access rules and the code that queries the database. `project.md` says where they are.

Look at:

- **Access rules:** with Supabase, Firebase or anything with row rules, check that every table holding user data has rules turned on, and that the rules actually limit rows to their owner. A table with rules off, or a rule that's always true, is blocking.
- **Keys in the app:** an admin or service key used in client code is blocking.
- **Migrations:** do they run in order from empty? Is anything destructive (dropping a column or table) without a way back? Would any lock a big table for a long time? Are there changes in the schema with no migration?
- **Growth:** are the fields used to look things up, filter, sort or join indexed? Does every list query have a limit or paging? Any query that loads a whole table?
- **Connections:** is connection pooling set up, especially on serverless hosting where every request can open a new connection?
- **Shape:** missing foreign keys, ids that can be guessed and are shown in URLs, personal data kept that the app doesn't need.
- **Backups:** is there a backup, and a known way to restore it? If you can't tell from the project, say so in a `review` finding and under "Only you can decide".

Blocking: data anyone can read or change, an admin key in the app, migrations that can't run from empty, a main list that loads everything with no limit.

Review: indexes, pooling, missing foreign keys, unclear backups, extra personal data.

If there's no database, set `cleared` with the summary "No database in this project".
