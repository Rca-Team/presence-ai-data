# Cloud Setup Guide (This Project)

This document explains how to run and deploy this app with its cloud backend.

## 1) What this project expects

The app is a Vite + React frontend that connects to a cloud backend using:

- `VITE_SUPABASE_URL` (backend project URL)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (public client key)

These names are required by the current code in `src/integrations/supabase/client.ts`.

---

## 2) Backend project used by current code

Current configured backend project ref (from `supabase/config.toml`):

- `eiahucigcvsnuvviajqt`

Current default URL used in project files:

- `https://eiahucigcvsnuvviajqt.supabase.co`

> Note: The app includes fallback credentials in some files for convenience, but for production you should always set environment variables explicitly.

---

## 3) Local setup

### Prerequisites

- Node.js 20+ (or Bun)
- Bun installed (`npm i -g bun`) recommended for this repo

### Steps

1. Install dependencies:

```bash
bun install
```

2. Create `.env` in project root:

```env
VITE_SUPABASE_URL=https://eiahucigcvsnuvviajqt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

3. Run dev server:

```bash
bun run dev
```

4. Build production bundle:

```bash
bun run build
```

---

## 4) Hosting setup (Vercel)

This repo already includes `vercel.json` with:

- Install: `bun install --frozen-lockfile`
- Build: `bun run build`
- Output: `dist`
- SPA rewrite to `index.html`

Set these environment variables in Vercel Project Settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Then deploy.

---

## 5) Cloud backend checklist for features in this app

To make key features work (attendance, face samples, admin tools), confirm your backend has:

- Auth enabled (email/password and any social login you use)
- Storage bucket for face images (`face-images`)
- Tables used by app flows (for example):
  - `profiles`
  - `attendance_records`
  - `face_descriptors`
  - gate/notification/email-related tables used by your deployed functions
- RLS/policies configured so the app can read/write as intended

If you changed backend schema recently, regenerate/update typed DB types so frontend types match the live schema.

---

## 6) Edge/server functions in this repo

This project includes many server functions under:

- `supabase/functions/*`

If your environment uses these, deploy the required functions for your workflows (attendance automation, notifications, emails, face pipelines, etc.) and ensure required secrets are present in your cloud project.

---

## 7) Quick verification after setup

1. Open app and confirm login works.
2. Open Admin and verify student/face sample data loads.
3. Register a face sample and confirm image uploads to storage.
4. Test ZIP export/import flow from Face Samples.
5. Confirm attendance/gate mode writes records successfully.

---

## 8) Common issues

### Blank data / auth errors

- Wrong `VITE_SUPABASE_URL` or key
- Missing RLS policies
- User role/policy mismatch

### Face image upload fails

- Missing `face-images` bucket
- Storage policy denies insert/read

### Import/export works partly but fails on images

- Imported ZIP paths do not match manifest paths
- Storage write blocked by policy

### Works locally, fails on deployed site

- Env vars set locally but not in hosting provider
- Build used stale env values

---

## 9) Recommended hardening

- Remove hardcoded fallback keys from frontend files for production branches.
- Keep all env vars in platform/project secrets.
- Restrict storage and table policies to least privilege.
- Keep function secrets and API keys out of source code.
