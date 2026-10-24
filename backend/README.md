# Backend

## Local setup

1. Copy `.env.example` to `.env` and configure `DATABASE_URL`.
2. Set `AUTH_SECRET` to a unique random value of at least 32 characters. The
   existing `JWT_SECRET` variable is also accepted for local compatibility.
3. Apply the SQL migrations in order from `migrations/` (`001`, then `002`).
4. Start the API with `go run .`.

The frontend provides email/password registration and login at `/auth`. API
upload, history, detail, and AI analysis routes require a bearer token.
Passwords are stored as bcrypt hashes. Accounts do not have roles.

Migration `002` assigns new uploads to their authenticated owner. Existing
uploads from before that migration remain unassigned and are intentionally
excluded from every user's history; assign them to a verified account only if
you have a reliable ownership mapping.
