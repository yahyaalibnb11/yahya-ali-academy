# Yahya Ali Academy · Airbnb Arbitrage Mukammal Course

Static website (no build step) for the recorded course: public landing page, student portal with protected video, and admin panel.

| File | What it is |
|---|---|
| `index.html` | Public landing page (Instagram bio link): 3D hero, curriculum explorer, profit calculator, pricing, FAQ |
| `portal.html` | Student area: sign up / login, free preview, payment submit, lessons, protected player, toolkit |
| `admin.html` | Approve payments (unlocks access instantly), students, grant/revoke access, device reset |
| `assets/course.js` | All modules, lessons, homework, and which video each lesson uses. Edit when new lessons go live |
| `assets/config.js` | Supabase keys, price, payment accounts, contact (left empty on purpose), online gateway switch |
| `supabase/` | Database migration and edge functions (`acad-play`, `acad-key`, `acad-upload`) |
| `tools/` | `encode-lesson.sh` (4K HLG → encrypted 1080/720/480 HLS) and `upload-video.mjs` |

## How video protection works
- Videos are AES-128 encrypted HLS in a private storage bucket. Nobody gets a public file link.
- `acad-play` checks login, enrollment (or free preview) and that this is the student's active device, then returns playlists with 4-hour signed segment links.
- `acad-key` gives the decryption key only for a signed, unexpired request from the active device.
- One device at a time: logging in on a new device stops the old one.
- Player: moving watermark (email · phone · id), no download, no PiP, no right-click, pauses when the tab is hidden, own fullscreen so the watermark stays.
- Honest limit: no website can fully block screen recording or a phone camera pointed at the screen. The watermark makes any leak traceable to the student.

## Adding a new lesson
1. `tools/encode-lesson.sh <edited-4K.mp4> <slug>` (creates `hls/<slug>` and a key)
2. `UPLOAD_SECRET=... NODE_USE_ENV_PROXY=1 node tools/upload-video.mjs hls/<slug> <slug> keys/<slug>.key 1080,720,480`
3. In `assets/course.js` add the video under `videos` and set the 4th value of each lesson it covers to the slug.

## Deploy
Import this repo into Vercel (Framework preset: Other, no build command). Everything is static, served from Vercel's CDN.
Backend currently lives in the `ember-os` Supabase project, all prefixed `acad_` / `academy_private`. To move it to its own project, run the migration there, deploy the 3 functions, re-upload videos, and change `supabaseUrl` / `supabaseKey` in `assets/config.js`.
