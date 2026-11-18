# ONE LIGHT-DAY — ASPS, PEC

A Next.js experience celebrating Voyager 1's one-light-day milestone and collecting short messages from students for a shared digital Golden Record.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production build

```bash
npm run build
npm start
```

## Deploy to Vercel

Import this repository into Vercel. Use the default Next.js build settings. Add the Supabase environment variables below if you want submissions shared across devices.

## Shared submissions (optional)

Set these Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Run `supabase/schema.sql` in the Supabase SQL editor. Without these variables, submissions are saved in the visitor's browser only.

## 3D model

The official Voyager Probe (B) GLB is bundled at `public/models/voyager-probe-b.glb`. It is loaded locally; the site does not request a model from a third-party host.

## Notes

The Voyager distance display is an estimate anchored to a stated reference value and cruise-speed assumption, not live NASA telemetry. The collective progress is a symbolic club contribution counter: one submission adds ten minutes, with 144 submissions representing 24 hours.

## Admin moderation

Submissions are published immediately. The visitor's browser enforces a six-hour cooldown after a successful send. This is intentionally per-browser, not per-person.

To enable the private delete-only moderation page, configure these server-side environment variables in Vercel:

- `ADMIN_SECRET_PATH`: a long, unguessable URL segment. The page is available at `/admin/<ADMIN_SECRET_PATH>`.
- `ADMIN_PASSWORD`: a strong administrator password.
- `ADMIN_SESSION_SECRET`: a long random signing secret (at least 32 characters).
- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: your Supabase service-role key. Keep this secret; never expose it as a `NEXT_PUBLIC_*` variable.

Also configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the public archive and submissions. Run the updated `supabase/schema.sql` in the Supabase SQL editor. Re-deploy after setting the variables.

The admin route is obscured and password protected. The password is verified server-side; the session cookie is HTTP-only and signed. Moderators can permanently delete public transmissions. This is not an approval queue.
