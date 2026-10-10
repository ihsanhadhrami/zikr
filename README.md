# Zikir Pagi & Petang (PWA)

Zikir Pagi & Petang ialah aplikasi ringkas dan moden untuk zikir pagi dan petang susunan
Dr. Mutlaq al-Jasir. Satu zikir dipaparkan pada satu masa dalam bahasa Arab, dengan panduan
dalam bahasa Melayu dan pengira tasbih terbina dalam. Aplikasi ini menukar lafaz pagi dan
petang secara automatik, merekod istiqamah harian anda, dan boleh digunakan tanpa internet
setelah dipasang di telefon.

*Zikir Pagi & Petang is a simple, modern app for the morning and evening adhkar compiled by
Dr. Mutlaq al-Jasir. It shows one zikr at a time in Arabic, with instructions in Malay and a
built-in tasbih counter. The app switches between morning and evening wording on its own,
tracks your daily streak, and works offline once installed on your phone.*

## Fail
Semua fail aplikasi berada dalam `public/`:
- `index.html`: struktur halaman
- `styles.css`: reka bentuk (tema Ungu / Zamrud / Emas)
- `data.js`: teks zikir dan turutan (edit di sini)
- `app.js`: logik pengira, navigasi, statistik, tetapan
- `sw.js`: service worker (berfungsi tanpa internet)
- `manifest.webmanifest`, `icons/`: maklumat pemasangan PWA
- `_headers`: header HTTP untuk Cloudflare (jenis manifest, cache service worker)

`wrangler.jsonc` ialah konfigurasi Cloudflare Worker.

## Uji secara lokal
```
python -m http.server 5173 --directory public
```
Buka http://localhost:5173

Atau uji seperti di Cloudflare:
```
npx wrangler dev
```

## Terbitkan ke Cloudflare Workers
```
npx wrangler login
npx wrangler deploy
```
Aplikasi akan tersedia di `https://zikir.<subdomain-anda>.workers.dev`.
Domain sendiri boleh ditambah di papan pemuka Cloudflare (Workers → zikir → Settings → Domains & Routes).

Selepas mengubah sebarang fail, tukar `VERSION` dalam `public/sw.js` (cth. `zikir-v2`)
supaya pengguna menerima versi terkini, kemudian jalankan `npx wrangler deploy` semula.
