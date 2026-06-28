# Salon Waiting Portal

A Vercel-ready Next.js portal for managing a salon walk-in queue with Supabase.

## What is included

- Live waiting-list dashboard
- Guest check-in form
- Service list from Supabase
- Queue status updates: waiting, in chair, done, cancelled
- Recent completed/cancelled history
- Supabase SQL schema and seed services
- Local environment setup for your Supabase project

## Local setup

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Supabase setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Click New query.
4. Paste the contents of `supabase/schema.sql`.
5. Click Run.
6. Refresh the portal.

The current schema is designed for a simple internal MVP. It allows the public anon key to read, insert, and update queue rows so the portal works without staff login. Before using it on a public website, add proper staff auth or move admin updates behind server-side routes.

## Vercel setup

1. Open Vercel.
2. Click Add New Project.
3. Import `7rohank/salon-waiting-portal`.
4. Keep the framework as Next.js.
5. Add these environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://zjrysvixcqfqiyzwwxxq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

6. Click Deploy.

## GitHub

Keep `.env.local` private. It is already ignored by Git. Use `.env.example` as the safe template for deployment setup.
