"use strict";

const { runExcel } = require("./timeline-excel");

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const tahunJakarta = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Jakarta" });

function bacaPenyesuaian(rows = []) {
  const gagal = () => Object.assign(new Error("Penyesuaian proyeksi tidak valid."), { status: 400 });
  if (!Array.isArray(rows)) throw gagal();

  const hasil = new Map();
  for (const row of rows) {
    const id = String(row?.proyek_id ?? "");
    const nama = row?.nama_proyek_proyeksi;
    const persen = row?.persentase_kenaikan;
    const hold = row?.hold ?? false;
    if (!/^[1-9]\d{0,18}$/.test(id) || typeof nama !== "string" || nama.length > 255 ||
        /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(nama) ||
        !Number.isFinite(persen) || persen < 0 || typeof hold !== "boolean" || hasil.has(id)) throw gagal();
    hasil.set(id, { nama_proyek_proyeksi: nama.trim(), persentase_kenaikan: persen, hold });
  }
  return hasil;
}

function pastikanNominal(nilai) {
  if (!Number.isFinite(nilai)) {
    throw Object.assign(new Error("Nominal proyeksi terlalu besar. Kurangi persentase kenaikan."), { status: 400 });
  }
  return nilai;
}

function buatLaporan(termin, filter, penyesuaian) {
  const tahunKini = Number(tahunJakarta.format());
  const jadwal = [];
  const tahunData = new Set();
  const jenisTersedia = new Map();
  for (const item of termin) {
    const tanggal = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(item.tanggal_proyeksi);
    if (!tanggal) continue;
    const tahun = Number(tanggal[1]);
    const jenisProyek = String(item.jenis_proyek ?? "").trim();
    const jenisKey = jenisProyek.toLocaleLowerCase("id-ID");
    tahunData.add(tahun);
    if (jenisProyek && !jenisTersedia.has(jenisKey)) jenisTersedia.set(jenisKey, jenisProyek);
    jadwal.push({ item, tahun, bulan: Number(tanggal[2]) - 1, jenisProyek, jenisKey });
  }

  const tahunTersedia = [...new Set([tahunKini, ...tahunData])].sort((a, b) => b - a);
  const tahunDefault = tahunData.has(tahunKini) || tahunData.size === 0 ? tahunKini : Math.max(...tahunData);
  const tahun = filter.tahun || tahunDefault;
  if (!tahunTersedia.includes(tahun)) {
    tahunTersedia.push(tahun);
    tahunTersedia.sort((a, b) => b - a);
  }

  const perProyek = new Map();
  let bulanAwal = 12;
  let bulanAkhir = -1;
  for (const { item, tahun: tahunJadwal, bulan, jenisProyek, jenisKey } of jadwal) {
    if (tahunJadwal !== tahun) continue;
    if (filter.jenisProyek && jenisKey !== filter.jenisProyek) continue;
    const nama = item.nama_proyek || "—";
    const pengaturan = penyesuaian.get(String(item.proyek_id));
    const namaProyeksi = pengaturan?.nama_proyek_proyeksi || nama;
    if (![nama, namaProyeksi].some(teks => teks.toLocaleLowerCase("id-ID").includes(filter.search))) continue;
    if (!perProyek.has(item.proyek_id)) {
      perProyek.set(item.proyek_id, {
        proyek_id: item.proyek_id,
        nama_proyek: nama,
        nama_proyek_proyeksi: namaProyeksi,
        persentase_kenaikan: pengaturan?.persentase_kenaikan ?? 0,
        hold: pengaturan?.hold ?? false,
        jenis_proyek: jenisProyek || "—",
        bulan: Array(12).fill(null)
      });
    }

    const proyek = perProyek.get(item.proyek_id);
    const sel = proyek.bulan[bulan] ??= { nominal: 0, nominal_awal: 0, termin: [] };
    const nilai = Number(item.nilai_termin);
    const nominalAwal = Number.isFinite(nilai) ? nilai : 0;
    const nominal = pastikanNominal(nominalAwal * (1 + proyek.persentase_kenaikan / 100));
    sel.nominal = pastikanNominal(sel.nominal + nominal);
    sel.nominal_awal += nominalAwal;
    sel.termin.push({ tanggal: item.tanggal_proyeksi, nama: item.nama_termin || "", nominal_awal: nominalAwal, nominal });
    if (!proyek.hold) {
      bulanAwal = Math.min(bulanAwal, bulan);
      bulanAkhir = Math.max(bulanAkhir, bulan);
    }
  }

  const proyekTersusun = [...perProyek.values()].sort((a, b) => a.nama_proyek.localeCompare(b.nama_proyek, "id-ID"));
  const rows = [];
  const holdRows = [];
  for (const proyek of proyekTersusun) {
    proyek.total_awal = proyek.bulan.reduce((total, bulan) => total + (bulan?.nominal_awal ?? 0), 0);
    proyek.total = pastikanNominal(proyek.bulan.reduce((total, bulan) => total + (bulan?.nominal ?? 0), 0));
    for (const bulan of proyek.bulan) {
      bulan?.termin.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    }
    (proyek.hold ? holdRows : rows).push(proyek);
  }

  let periode = String(tahun);
  if (bulanAkhir >= 0) {
    const rentang = bulanAwal === bulanAkhir ? BULAN[bulanAwal] : `${BULAN[bulanAwal]}–${BULAN[bulanAkhir]}`;
    periode = `${rentang} ${tahun}`;
  }

  return {
    tahun,
    tahun_tersedia: tahunTersedia,
    jenis_proyek_tersedia: [...jenisTersedia.values()].sort((a, b) => a.localeCompare(b, "id-ID")),
    rows,
    hold_rows: holdRows,
    ringkasan: {
      total: pastikanNominal(rows.reduce((total, proyek) => total + proyek.total, 0)),
      jumlah_proyek: rows.length,
      periode
    }
  };
}

module.exports = function daftarProyeksiPendapatan(app, wajibLogin, ambilDataPrognosa) {
  function ruteLaporan(kirim) {
    return async (req, res) => {
      const { tahun, search, jenis_proyek: jenisProyek } = req.query;
      res.setHeader("Cache-Control", "no-store");
      if (tahun !== undefined && !/^[1-9]\d{3}$/.test(typeof tahun === "string" ? tahun : "")) {
        return res.status(400).json({ error: "Pilih tahun yang valid." });
      }

      try {
        const penyesuaian = bacaPenyesuaian(req.body?.penyesuaian);
        const termin = await ambilDataPrognosa(req.session.user);
        const laporan = buatLaporan(termin, {
          tahun: Number(tahun),
          search: typeof search === "string" ? search.trim().toLocaleLowerCase("id-ID") : "",
          jenisProyek: typeof jenisProyek === "string" ? jenisProyek.trim().toLocaleLowerCase("id-ID") : ""
        }, penyesuaian);
        return await kirim(res, laporan, req.session.user);
      } catch (error) {
        if (!error.status) console.error("ERROR PROYEKSI PENDAPATAN:", error);
        return res.status(error.status || 500).json({
          error: error.status ? error.message : "Gagal memproses proyeksi pendapatan. Silakan coba kembali."
        });
      }
    };
  }

  const tampilkan = ruteLaporan((res, laporan, user) => res.json({ ...laporan, pengguna_id: String(user.id) }));
  const ekspor = ruteLaporan(async (res, { tahun, rows, ringkasan }) => {
    const file = await runExcel("export-proyeksi-pendapatan", { rows, ringkasan, bulan: BULAN });
    res.attachment(`proyeksi-pendapatan-${tahun}.xlsx`);
    return res.send(file);
  });
  app.get("/api/proyeksi-pendapatan", wajibLogin, tampilkan);
  app.post("/api/proyeksi-pendapatan", wajibLogin, tampilkan);
  app.get("/api/proyeksi-pendapatan/export", wajibLogin, ekspor);
  app.post("/api/proyeksi-pendapatan/export", wajibLogin, ekspor);
};
