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