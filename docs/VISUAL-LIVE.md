# Gridlock Live

Kota dilihat dari atas, dengan lajur kuning redup, mobil komik, persimpangan dan halftone bertitik. Informasi utama tetap memakai panel tinta padat. Kartu ilustrasi selalu berlabel EXAMPLE dan preview pembelian tetap berasal dari renderer kontrak.

1. Pasang satu canvas fixed di Shell setelah render awal dan waktu idle. Bagikan kontrol Motion antara header dan footer. Jeda saat tab tersembunyi, canvas tidak terlihat, hemat data, atau reduced motion.
2. Tambahkan tilt, progres ladder dari polling chain, flip countdown, heat, segel transaksi terkonfirmasi, dan efek pengiriman.
3. Hasilkan koleksi SVG deterministik dari geometri dan token proyek. Pasang ilustrasi status serta dokumentasikan keadaan komponen di styleguide.
4. Tambahkan pita hazard dan wipe navigasi. Uji kontrol motion dan interaksi, lalu ukur build produksi.

Anggaran per rute 20 KB gzip tambahan. Canvas memakai 14 atau 36 mobil dengan DPR maksimal 1,5 atau 2. Target 55 fps desktop, kurangi beban di atas 20 ms dan berhenti jika tetap di bawah 30 fps. Target Lighthouse mobile 95/98/95/95, CLS 0 dan TBT ≤ 150 ms. Jalankan axe WCAG 2.2 AA dan cek overflow pada 360, 768, serta 1440 px.

## Panggung (tambahan)

Hero dinding poster, bab "Case File", pita rantai miring, scroll climb 15 anak tangga, intro stempel sekali per sesi, flip kartu, angka bergulir, tombol magnetik, suara sintesis (default mati) dan halftone WebGL. Semuanya diatur kontrol Motion kecuali suara yang punya tombol sendiri.

Hasil ukur build produksi lokal (Chrome headless, tanpa GPU):

| Ukuran | Hasil |
|---|---|
| Unit test | 30 lulus (7 baru: climb, counter, magnet, suara, ribbon, hero art) |
| E2E | 27 dari 27 langkah (9 baru dari panggung, sisanya dari persimpangan dan alur sebelumnya) |
| Axe WCAG 2.2 AA + overflow, 39 kombinasi halaman dan lebar | 0 temuan, live dan undeployed |
| Lighthouse mobile Home (dengan persimpangan) | performa 99, aksesibilitas 100, best practices 100, LCP 1,5 s, CLS 0, TBT 124 ms |
| Lighthouse mobile halaman lain | performa 97 sampai 100, aksesibilitas 100, TBT 90 sampai 150 ms |
| JS tambahan per rute (gzip) | Home +10,0 KB (sudah termasuk mesin persimpangan), rute lain +4,8 sampai +5,7 KB, batas 20 KB |
| fps `?motion=debug` (software) | 60 pada 360, 768 dan 1440 px |
| CLS | 0 |

SEO Lighthouse 66 sampai 69 karena build ini sengaja `noindex` (`NEXT_PUBLIC_INDEXABLE` belum diset). Efek yang butuh GPU (halftone WebGL dan gerak lapisan hero) tidak bisa diukur di lingkungan ini. Kodenya diuji pada renderer software dan jalur "live" diuji dengan menandai hero secara manual.
