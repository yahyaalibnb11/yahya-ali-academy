# Yahya Ali Academy

Static website (no build step) for the 14-day Airbnb Arbitrage, Co-Hosting & AI program.

- `index.html` – public sales page (Instagram bio link)
- `portal.html` – student area: sign up, pay, upload screenshot, watch classes after approval
- `admin.html` – approve payments, add class video links, read messages
- `assets/config.js` – prices, WhatsApp number, payment accounts, Supabase keys
- `assets/classes.js` – the 14 classes shown on the public page

Backend: Supabase project `yahya-ali-academy` (tables, row-level security, private `payment-proofs` bucket).

Deploy: import this repo into Vercel as a static site (Framework preset: Other, no build command).

Class videos: host them on Bunny Stream (recommended, with allowed-domain lock), Vimeo, or YouTube unlisted, then paste each link in Admin → Class videos.
