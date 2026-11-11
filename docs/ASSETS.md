# Aset Gridlock

`web/scripts/make-art.mjs` membuat semua aset di bawah ini secara deterministik tanpa akses jaringan. Geometri, komposisi dan desain dibuat untuk Gridlock. Hak milik pemilik proyek.

| Aset | Asal dan penggunaan |
|---|---|
| `src/art/cars.ts` dan `public/art/cars.svg` | Enam siluet fiktif dalam delapan warna token dan empat livery. Modul dipakai untuk lalu lintas canvas, kartu EXAMPLE, dan fixture penjualan ladder. SVG menampilkan 192 kombinasi. |
| `public/art/{open,sold-out,caught,claimed,wanted}.svg` | Lima segel flat dengan warna dari token. |
| `public/art/{cone,signal,light-bar,hazard,halftone}.svg` | Geometri rambu, lampu, garis hazard dan tekstur titik buatan generator. |
| `public/art/{empty,offline,error}.svg` | Ilustrasi dekoratif untuk garasi kosong, bantuan offline dan jalan buntu. |
| `public/icon.svg`, `public/apple-touch-icon.png`, `public/og.png` | Siluet dan halftone yang sama. `make-images.mjs` merasterisasi SVG lokal untuk Apple dan OG/Twitter. |

Anton, Barlow dan Space Mono tetap menggunakan file lokal dan lisensi yang sudah disertakan di `web/src/fonts/licenses/`. Kartu asli memakai SVG renderer melalui data chain.

Jalankan `node scripts/make-images.mjs` dari `web/` untuk membuat ulang semua aset, atau `node scripts/make-art.mjs` untuk SVG dan modul TypeScript saja.
