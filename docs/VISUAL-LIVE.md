# Gridlock Live

Kota dilihat dari atas, dengan lajur kuning redup, mobil komik, persimpangan dan halftone bertitik. Informasi utama tetap memakai panel tinta padat. Kartu ilustrasi selalu berlabel EXAMPLE dan preview pembelian tetap berasal dari renderer kontrak.

1. Pasang satu canvas fixed di Shell setelah render awal dan waktu idle. Bagikan kontrol Motion antara header dan footer. Jeda saat tab tersembunyi, canvas tidak terlihat, hemat data, atau reduced motion.
2. Tambahkan tilt, progres ladder dari polling chain, flip countdown, heat, segel transaksi terkonfirmasi, dan efek pengiriman.
3. Hasilkan koleksi SVG deterministik dari geometri dan token proyek. Pasang ilustrasi status serta dokumentasikan keadaan komponen di styleguide.
4. Tambahkan pita hazard dan wipe navigasi. Uji kontrol motion dan interaksi, lalu ukur build produksi.

Anggaran per rute 20 KB gzip tambahan. Canvas memakai 14 atau 36 mobil dengan DPR maksimal 1,5 atau 2. Target 55 fps desktop, kurangi beban di atas 20 ms dan berhenti jika tetap di bawah 30 fps. Target Lighthouse mobile 95/98/95/95, CLS 0 dan TBT ≤ 150 ms. Jalankan axe WCAG 2.2 AA dan cek overflow pada 360, 768, serta 1440 px.
