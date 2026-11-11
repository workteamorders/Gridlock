# PROMPT UNTUK CODEX: "Gridlock Live", polesan visual, background hidup, dan aset sendiri

Tempel seluruh isi file ini ke Codex. Bahasa kerja: Indonesia. Istilah teknis tetap Inggris.

---

## 0. Peran dan tujuan

Kamu adalah senior front-end engineer sekaligus art director untuk **Gridlock**: koleksi NFT on-chain berbentuk kartu "wanted poster" mobil fiktif bergaya komik flat-ink (hitam / merah / kuning). Situsnya sudah jadi, fungsional, lulus tes, dan cepat, tetapi tampilannya masih terasa **biasa dan statis**. Tugasmu mengubahnya menjadi situs yang **hidup, interaktif, dan punya identitas visual sendiri**, tanpa merusak kejujuran, aksesibilitas, atau kecepatan yang sudah ada.

Tiga hasil utama:

1. **Live background** yang bergerak terus dan bereaksi pada kursor/sentuhan.
2. **Live elements**: elemen UI yang bergerak, merespons interaksi, dan menampilkan data chain yang sungguhan secara hidup.
3. **Aset sendiri**: semua elemen "example", mock, dan placeholder diganti dengan aset orisinal yang kita hasilkan sendiri (deterministik, tanpa file luar), sehingga situs punya perpustakaan visual miliknya.

Jangan mulai membangun sebelum selesai bagian 2 (membaca kode) dan menulis rencana singkat di `docs/VISUAL-LIVE.md` (arah visual, daftar komponen, anggaran performa). Setelah itu langsung bangun tanpa menunggu persetujuan, lalu catat setiap keputusan ambigu di `docs/DECISIONS.md` (bagian baru "12. Visual live").

---

## 1. Fakta proyek (jangan dilanggar)

- Repo: `contracts/` (Solidity, **jangan diubah**), `web/` (situs), `docs/`.
- `web/`: Next.js 16 static export (`output: 'export'`, `trailingSlash`), React 19, TypeScript strict, **viem saja** (tanpa wagmi), CSS biasa dengan design tokens di `web/src/styles/tokens.css`. Fungsi server hanya `web/functions/api/rpc.ts` dan `geo.ts` (read-only). **Jangan ubah `functions/`, `src/lib/chain*.ts`, `src/lib/tx.ts`, `src/lib/wallet.tsx`, `src/lib/heat.ts`, ABI.**
- Halaman: `/`, `/mint/`, `/ladder/`, `/gallery/`, `/garage/`, `/hunt/`, `/rules/`, `/contracts/`, `/risk/`, `/offline/`, 404, `/styleguide/`.
- Komponen yang sudah ada: `Ladder`, `CardArt`, `CardImage`, `HeatStars`, `Countdown`, `Signs` (StopSign, YieldSign, SpeedLimit, TollGate, DeadEnd), `SupplyChart`, `Dialog`, `Toast`, `Button`, `Icon`, `Shell`, `SiteHeader`, `SiteFooter`, `HomeLadder`, dsb. Data mock ada di `web/src/lib/mock.ts` (`exampleLadder()` dan sejenisnya) dan `CardArt.tsx`.
- Palet token: INK `#0b0b0c`, PAPER `#1a1917`, PAPER2 `#262420`, CREAM `#f2eee3`, YEL `#ffc61a`, RED `#e4262b`, DIM `#6b675f`. Font: Anton (display), Barlow (body), Space Mono (angka). Semua warna **harus lewat token**; `npm run lint:tokens` gagal bila ada hex mentah di luar `tokens.css`.
- Gaya: **flat ink**: tanpa gradient, tanpa blur, tanpa glow, tanpa bayangan lembut. Kedalaman dibuat dengan offset shadow keras, halftone (lingkaran polos), garis tebal, dan blok warna datar. Pertahankan gaya ini; hidupkan, jangan ganti gayanya.
- Kartu on-chain digambar kontrak (`GridlockRenderer`, viewBox 300×420, tanpa pattern/clipPath/filter/style/text). Contoh hasil asli ada di `contracts/harness/golden/*.svg`.
- Batas CSP (dibuat `web/scripts/csp-headers.mjs`): **tanpa `unsafe-inline` untuk script**, `connect-src 'self'`, `img-src 'self' data:`, tanpa CDN, tanpa font luar, tanpa `eval`. Jangan melonggarkan CSP.
- Skor sekarang (build produksi, mobile): Performance 99–100, CLS 0, TBT < 120 ms, Accessibility 98–100, 0 pelanggaran axe WCAG 2.2 AA di 12 halaman × 3 lebar. **Skor ini tidak boleh turun di bawah anggaran bagian 7.**

## 2. Langkah 0: baca dulu

Baca `web/src/styles/tokens.css`, `base.css`, `components.css`, `app/layout.tsx`, `components/Shell.tsx`, `HomeLadder.tsx`, `Ladder.tsx`, `CardArt.tsx`, `CardImage.tsx`, `lib/mock.ts`, `app/styleguide/Styleguide.tsx`, `docs/PAGES.md`, `docs/DECISIONS.md` (bagian 11), `web/README.md`, dan skrip tes di `web/e2e/` dan `web/tests/`. Jalankan sekali `npm run check` dan `npm run build` untuk memastikan titik awal hijau.

---

## 3. Bagian A: Live background

Buat satu komponen `LiveBackground` (di `web/src/components/fx/`) yang dipasang di `Shell`, di belakang semua konten.

**Konsep: "Gridlock": kota macet dilihat dari atas, bergerak terus.**
- Kisi jalan flat (garis kuning tipis di atas INK) dengan **mobil-mobil kecil flat** (siluet blok warna dari palet: 6 bentuk, 8 warna badan, sama bahasa visual dengan renderer on-chain, tapi **orisinal**, jangan menyalin gambar kontrak piksel demi piksel) melaju di lajur-lajur, berhenti di "lampu merah", lalu jalan lagi. Ritme macet-lancar bergelombang pelan.
- **Interaksi kursor/sentuhan**:
  - Kursor menjadi "senter polisi": area di sekitar kursor menampilkan lapisan halftone yang lebih padat dan garis kisi yang lebih terang (radius ~160 px, tepi keras bukan blur).
  - Mobil di dekat kursor **mengerem lalu menyalip** (menghindar ke lajur sebelah); klik/tap menjatuhkan "cone" lalu-lintas yang memaksa mobil berpindah lajur selama beberapa detik, kemudian memudar.
  - Gerak kursor cepat meninggalkan **skid mark** (garis tebal pendek) yang memudar dalam ~1,5 detik.
  - Di sentuh/mobile: sentuh dan seret menggantikan kursor; tanpa gyroscope dan tanpa izin sensor.
- **Parallax pelan** terhadap scroll (maks 40 px, hanya `transform`).
- Warna **diredam** (opacity rendah, dasar tetap INK/PAPER) supaya semua teks di atasnya tetap lolos kontras AA. Panel dan teks utama tetap di atas permukaan solid (`panel`), bukan langsung di atas animasi.

**Implementasi (wajib):**
- Satu `<canvas>` 2D (tanpa three.js, pixi, gsap, framer-motion, lottie atau library animasi lain). `position: fixed; inset: 0; z-index: -1; pointer-events: none; aria-hidden="true"`.
- Dimuat **setelah LCP**: `dynamic import` + `requestIdleCallback` (fallback `setTimeout`). Halaman tetap tampil penuh tanpa canvas. Tempatkan wadah dengan ukuran tetap supaya **CLS tetap 0**.
- **Performance governor**: rata-rata frame time > 20 ms selama 2 detik → kurangi jumlah mobil/partikel bertahap; < 30 fps stabil → matikan dan tampilkan frame statis.
- Jeda otomatis saat tab tersembunyi (`visibilitychange`), saat canvas di luar viewport (`IntersectionObserver`), saat `navigator.connection.saveData` aktif, dan saat `prefers-reduced-motion: reduce` (tampilkan **satu frame statis** yang tetap bagus).
- DPR dibatasi 2 (1,5 di layar ≤ 768 px). Jumlah mobil: ~14 di mobile, ~36 di desktop. Tanpa alokasi objek di dalam loop frame.
- **Kontrol Motion** (WCAG 2.2.2 Pause, Stop, Hide): tombol "Motion: Full / Reduced / Off" yang terjangkau keyboard di footer dan header, tersimpan di `localStorage` (bungkus `try/catch`), default mengikuti `prefers-reduced-motion`. Parameter `?motion=off` mematikan semuanya (dipakai tes dan tangkapan layar).
- Tidak ada kilatan lebih dari 3 kali per detik di mana pun (WCAG 2.3.1).

---

## 4. Bagian B: Live elements

Tambahkan elemen hidup berikut. Semua pakai CSS transform/opacity atau Web Animations API, kecuali disebut lain; semua menghormati kontrol Motion di atas.

1. **Kartu miring 3D mengikuti kursor** (`CardTilt`): pada `CardImage` di Home, Mint, Gallery, Garage. Kemiringan maks ±10°, ada "kilau" berupa pita diagonal flat (bukan gradient) yang bergeser mengikuti kursor. Di sentuh: miring mengikuti jari. Tanpa kursor: goyang idle sangat pelan. Fokus keyboard menampilkan miring tetap kecil + outline fokus.
2. **Ladder hidup**: batang progres tiap rank beranimasi ke nilai baru saat data polling (15 detik) berubah; rank yang baru **terbuka** mendapat animasi "lampu hijau" satu kali dan segel "OPEN" menghentak (stamp). Rank terjual habis mendapat segel "SOLD OUT" miring. Hanya dipicu oleh perubahan data sungguhan.
3. **Countdown "flip"** pada `Countdown`: digit berganti dengan flip mekanis datar; sudah ada `aria-live` yang tenang, jangan dibuat bising (jangan umumkan tiap detik).
4. **Bintang heat hidup**: `HeatStars` berkedip lembut proporsional dengan heat nyata (1–2 bintang: napas pelan; 5 bintang: **light bar polisi** merah/kuning bergantian ≤ 2 Hz). Heat tetap hanya tampilan; tidak ada hak, harga, atau aturan yang terkait dengan animasi ini.
5. **Segel hasil**: setelah mint berhasil, segel "CAUGHT" (atau "CLAIMED" untuk Hunt) menghentak di atas kartu, dengan confetti **flat** (kotak/segitiga warna palet, ≤ 40 partikel, ~1,2 detik). Setelah kirim kartu: kartu "melaju" keluar dengan efek speed-line.
6. **Hazard tape marquee**: pita kuning-hitam berjalan tipis sebagai pembatas bagian di Home (pelan, dapat dijeda lewat kontrol Motion).
7. **Tombol dan tautan**: hover/press tombol punya "tekan" fisik (offset shadow mengecil, translate 2 px). Transisi antarhalaman: wipe datar bergaya garis finish ≤ 250 ms (tanpa mengganggu fokus dan `prefers-reduced-motion`).
8. **Live feed on-chain (opsional, hanya data nyata)**: strip kecil "Aktivitas terbaru" di Home yang menampilkan mint/transfer terakhir, dibaca lewat `eth_getLogs` ke `/api/rpc` (rentang blok ≤ 5000, sudah dibatasi relay). Jika belum deploy atau gagal: **sembunyikan strip**, jangan tampilkan angka palsu. **Dilarang**: "N orang sedang melihat", penjualan palsu, hitung mundur palsu, bahasa urgensi/FOMO.
9. **Kursor khusus**: hanya di area `/mint/` dan kartu: ring flat kecil mengikuti kursor; kursor asli **tetap terlihat**; nonaktif di perangkat sentuh dan saat Motion di-Off.
10. **Skeleton hidup** yang tetap seukuran konten akhir (jaga CLS 0).

---

## 5. Bagian C: Aset sendiri menggantikan semua "example"

Hari ini beberapa tampilan memakai data/gambar contoh (`mock.ts`, `CardArt.tsx`, contoh di `/styleguide/`, ladder contoh saat belum deploy). Gantikan dengan **perpustakaan aset orisinal buatan kita**:

1. Tulis generator deterministik `web/scripts/make-art.mjs` (Node, tanpa dependensi jaringan, seed tetap) yang menghasilkan ke `web/src/art/` dan `web/public/art/`:
   - **Set siluet mobil** (≥ 6 bentuk × 8 warna × 4 livery) sebagai SVG flat dan juga sebagai modul TS yang dipakai `LiveBackground`, `CardArt`, dan contoh.
   - **Ikon dan segel**: OPEN, SOLD OUT, CAUGHT, CLAIMED, WANTED, cone, lampu lalu lintas, light bar, hazard tape (SVG flat).
   - **Ilustrasi kosong/error**: untuk empty state, 404, offline (menggantikan ikon generik).
   - **Tekstur halftone** (lingkaran polos sebagai SVG/Canvas, tanpa gambar bitmap besar).
   - Gambar **OG/Twitter** baru dan `icon.svg`/`apple-touch-icon.png` yang selaras (perbarui `scripts/make-images.mjs`).
2. **Semua orisinal.** Dilarang: karakter/maskot/logo/merek nyata, bentuk mobil yang mudah dikenali sebagai model/merek tertentu, aset dari internet, font atau ikon pihak ketiga selain yang sudah berlisensi di repo. Tambahkan `docs/ASSETS.md`: asal tiap aset, "dibuat oleh generator, hak milik pemilik proyek".
3. `CardArt` dan `exampleLadder()` memakai aset baru, **tetapi tetap berlabel "EXAMPLE"** (badge jelas) selama gambarnya bukan hasil kontrak. Kartu asli dari kontrak tetap hanya lewat `tokenURI`/`previewNext`. Jangan pernah menampilkan gambar buatan situs sebagai kartu yang akan didapat pembeli.
4. Perbarui `/styleguide/` agar mendokumentasikan semua komponen baru lengkap dengan keadaan (default, hover, fokus, aktif, nonaktif, loading, error, motion off).
5. Semua warna baru lewat token (tambahkan token seperti `--fx-*` bila perlu), kontras diuji dengan `scripts/contrast.mjs`.

---

## 6. Aturan jujur dan etika (tetap berlaku)

- Tidak ada klaim nilai/untung/langka/"investasi", tidak ada leaderboard, tidak ada hak atau aturan yang bergantung pada heat. `npm run copy:check` harus tetap lolos.
- Animasi tidak boleh menyiratkan hasil yang tidak ada (mis. confetti hanya setelah transaksi **terkonfirmasi**; segel OPEN/SOLD OUT hanya dari data chain).
- Teks UI baru berbahasa Inggris sederhana seperti sisa situs, tanpa kata terlarang di `scripts/copy-check.mjs`.
- Halaman Risk dan Terms tetap draf menunggu tinjauan hukum; jangan mengubah isinya.

## 7. Anggaran dan kriteria penerimaan (semua harus terpenuhi)

| Ukuran | Batas |
|---|---|
| JS tambahan (gzip) di rute mana pun | ≤ 20 KB; background + fx dimuat lazy setelah idle |
| Lighthouse mobile, build produksi | Performance ≥ 95, Accessibility ≥ 98, Best Practices ≥ 95, SEO ≥ 95 (dengan `NEXT_PUBLIC_INDEXABLE=1`), **CLS 0**, TBT ≤ 150 ms |
| Frame rate background | ≥ 55 fps rata-rata di desktop Chrome; governor menjamin ≥ 30 fps atau berhenti |
| axe WCAG 2.2 AA | 0 pelanggaran di semua halaman × 360/768/1440, termasuk dengan background menyala |
| Scroll horizontal | 0 di 360 px |
| Motion | `prefers-reduced-motion`, `?motion=off`, kontrol Motion, `saveData`, tab tersembunyi: semua menghentikan animasi; tidak ada kilatan > 3 Hz |
| Keyboard | Seluruh alur utama bisa tanpa mouse; efek kursor tidak menghalangi klik/fokus; fokus selalu terlihat |
| CSP | Tidak berubah; `npm run build` menghasilkan `_headers` tanpa `unsafe-inline` untuk script |
| Kejujuran | `copy:check`, `secret:scan`, `lint:tokens` hijau; semua gambar non-kontrak berlabel EXAMPLE |

## 8. Tes yang wajib ditambah atau diubah

Semua tes lama harus tetap hijau: `npm run check`, `node e2e/run.mjs` (14 langkah), `node e2e/layout.mjs live` dan `undeployed`, `e2e/lighthouse.sh`. Cara menjalankan e2e ada di `web/README.md` (build dengan `NEXT_PUBLIC_CHAIN_ID=31337 NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`, pindahkan `out` menjadi `out-e2e`).

Tambahkan:
1. Langkah e2e: canvas background `aria-hidden`, `pointer-events: none`, tidak menangkap klik; semua klik/Tab lama tetap bekerja.
2. Ubah langkah "reduced motion" yang ada: dengan `reducedMotion: 'reduce'` tidak ada animasi tak-hingga **dan** canvas tidak menggambar ulang (ukur lewat penghitung frame di `window.__fx`, ekspos hanya saat `?motion=off|debug`).
3. Langkah e2e: kontrol Motion mengganti mode, tersimpan setelah reload, dapat dioperasikan keyboard.
4. Langkah e2e: gerak kursor mengubah state background (mis. mobil dekat kursor memperlambat); tidak ada error konsol.
5. Pengukuran fps (rata-rata, p5) lewat Playwright pada 3 lebar; cetak ke laporan.
6. Tangkapan layar tiap halaman × 360/768/1440 dengan `?motion=off` (deterministik) ditambah satu pass grayscale; simpan di `web/e2e/shots/`.
7. Uji unit untuk generator aset (deterministik: dua kali jalan menghasilkan hash sama) dan untuk governor (simulasi frame time).
8. Uji bahwa tidak ada aset non-orisinal: `scripts/secret-scan.mjs`/`copy-check` diperluas untuk menolak nama merek di `src/art` dan `public/art`.

## 9. Format kerja dan laporan akhir

1. Buat `docs/VISUAL-LIVE.md` (arah visual, daftar komponen, anggaran) dulu, lalu bangun bertahap: background → CardTilt + Ladder hidup → segel/confetti → aset generator → marquee dan transisi → live feed opsional → tes dan penyetelan performa.
2. Commit kecil dan terpisah per tahap. Jangan menyentuh `contracts/`.
3. Laporan akhir (bahasa Indonesia, ringkas): apa yang dibangun, tabel hasil ukur vs anggaran (Lighthouse, fps, ukuran JS, axe), tangkapan layar sebelum/sesudah, keputusan di `docs/DECISIONS.md`, apa yang **tidak** selesai atau tidak terukur, dan risiko (mis. performa di perangkat lemah). Laporkan angka apa adanya; jangan menyatakan lulus tanpa menjalankan tesnya.
