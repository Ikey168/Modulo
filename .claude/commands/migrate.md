Run Flyway database migrations for Modulo.

Determine the target environment from $ARGUMENTS:
- "dev" or empty → use /home/Ikey/Modulo/flyway.conf (connects to modulodb on localhost:5432)
- "staging" → use /home/Ikey/Modulo/flyway.staging.conf

Steps:
1. Show pending migrations first:
   `flyway -configFiles=<config> info`
   List which versions are pending vs applied.

2. If there are pending migrations, confirm with the user before proceeding (unless $ARGUMENTS contains "yes" or "--yes").

3. Run the migration:
   `flyway -configFiles=<config> migrate`

4. Run info again after to confirm applied versions.

Migration files are in /home/Ikey/Modulo/database/migrations/ (V1 through V10 currently exist).

If flyway is not on PATH, try: `cd /home/Ikey/Modulo && mvn flyway:info` and `mvn flyway:migrate` via the backend Maven plugin.
