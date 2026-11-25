"use strict";

const { simpanActivityLog } = require("./activity-log");

const tables = {
  klien: "public.proyek_klien",
  partner: "public.proyek_partner"
};

function idPositif(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (!/^[1-9]\d*$/.test(String(value))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function fieldLog(jenis, id, awalan = "LOG STATUS") {
  return `${awalan} KONTRAK ${jenis.toUpperCase()} #${id}`;
}

function bacaLog(row, fieldBaru, fieldStatusLama) {
  const isi = { status: [], catatan: "" };

  if (row.field_name === fieldBaru) {
    try {
      const data = JSON.parse(row.nilai_baru);
      if (Array.isArray(data.status) && data.status.every(nama => typeof nama === "string")) {
        return {
          ...isi,
          status: data.status,
          catatan: typeof data.catatan === "string" ? data.catatan : "",
          tanggal_mulai: data.tanggal_mulai,
          tanggal_akhir: data.tanggal_akhir
        };
      }
    } catch {
      return isi;
    }
  } else if (row.field_name === fieldStatusLama) {
    isi.status = row.nilai_baru ? [row.nilai_baru] : [];
  } else {
    isi.catatan = row.nilai_baru || "";
  }

  return isi;
}

async function ambilRingkasanLogKontrak(pool, daftar) {
  if (daftar.length === 0) return new Map();

  const { rows } = await pool.query(
    `
      SELECT kontrak.jenis, kontrak.kontrak_id, log.field_name, log.nilai_baru, log.waktu
      FROM UNNEST($1::bigint[], $2::bigint[], $3::text[], $4::text[], $5::text[])
        AS kontrak(proyek_id, kontrak_id, jenis, field_baru, field_lama)
      JOIN LATERAL (
        SELECT field_name, nilai_baru, created_at AS waktu
        FROM public.activity_log
        WHERE modul = 'KONTRAK'
          AND entity_id = kontrak.proyek_id
          AND field_name IN (kontrak.field_baru, kontrak.field_lama)
        ORDER BY id DESC
        LIMIT 1
      ) log ON TRUE
    `,
    [
      daftar.map(item => item.proyek_id),
      daftar.map(item => item.kontrak_id),
      daftar.map(item => item.jenis_relasi),
      daftar.map(item => fieldLog(item.jenis_relasi, item.kontrak_id)),
      daftar.map(item => fieldLog(item.jenis_relasi, item.kontrak_id, "STATUS"))
    ]
  );

  return new Map(rows.map(row => {
    const isi = bacaLog(
      row,
      fieldLog(row.jenis, row.kontrak_id),
      fieldLog(row.jenis, row.kontrak_id, "STATUS")
    );
    return [`${row.jenis}:${row.kontrak_id}`, { ...isi, waktu: row.waktu }];
  }));
}

function konteksKontrak(req, res, userAdalahLegal) {
  const user = req.session?.user;
  if (!user) {
    res.status(401).json({ error: "Belum login" });
    return null;
  }

  const { jenis } = req.params;
  const id = idPositif(req.params.id);
  if (!Object.hasOwn(tables, jenis) || !id) {
    res.status(400).json({ error: "Kontrak tidak valid." });
    return null;
  }

  const picId = idPositif(user.id);
  if (!picId) {
    res.status(401).json({ error: "Sesi pengguna tidak valid. Silakan login kembali." });
    return null;
  }

  return {
    jenis,
    id,
    picId,
    namaPic: user.nama || "",
    aksesSemua: String(user.role || "").trim().toLowerCase() === "admin" || userAdalahLegal(user),
    fieldBaru: fieldLog(jenis, id),
    fieldStatusLama: fieldLog(jenis, id, "STATUS"),
    fieldCatatanLama: fieldLog(jenis, id, "CATATAN")
  };
}

async function cariKontrak(db, konteks, kunciPeriode = false) {
  const { rows } = await db.query(
    `
      SELECT k.proyek_id, p.nama_proyek,
        TO_CHAR(k.tanggal_mulai::date, 'YYYY-MM-DD') AS tanggal_mulai,
        TO_CHAR(k.tanggal_akhir::date, 'YYYY-MM-DD') AS tanggal_akhir
      FROM ${tables[konteks.jenis]} k
      JOIN public.proyek p ON p.id = k.proyek_id
      WHERE k.id = $1 AND ($2::boolean OR EXISTS (
        SELECT 1 FROM public.proyek_pic akses
        WHERE akses.proyek_id = k.proyek_id AND akses.pic_id = $3
      ))
      ${kunciPeriode ? "FOR SHARE OF k" : ""}
    `,
    [konteks.id, konteks.aksesSemua, konteks.picId]
  );
  return rows[0];
}

function daftarRuteLogKontrak(app, pool, { userAdalahLegal }) {
  const route = "/api/kontrak/:jenis/:id/status-log";

  app.get(route, async (req, res) => {
    const konteks = konteksKontrak(req, res, userAdalahLegal);
    if (!konteks) return;

    try {
      const kontrak = await cariKontrak(pool, konteks);
      if (!kontrak) {
        return res.status(404).json({ error: "Kontrak tidak ditemukan atau Anda tidak memiliki akses." });
      }

      const { rows } = await pool.query(
        `
          SELECT log.id, log.field_name, log.nilai_baru,
            COALESCE(NULLIF(BTRIM(log.nama_pic), ''), pic.nama, '-') AS pic,
            log.created_at AS waktu
          FROM public.activity_log log
          LEFT JOIN public.pic pic ON pic.id = log.pic_id
          WHERE log.modul = 'KONTRAK' AND log.entity_id = $1
            AND log.field_name IN ($2, $3, $4)
          ORDER BY log.id DESC
        `,
        [kontrak.proyek_id, konteks.fieldBaru, konteks.fieldStatusLama, konteks.fieldCatatanLama]
      );

      res.setHeader("Cache-Control", "no-store");
      return res.json({ data: rows.map(row => {
        const { status, catatan } = bacaLog(row, konteks.fieldBaru, konteks.fieldStatusLama);
        return { id: row.id, status, catatan, pic: row.pic, waktu: row.waktu };
      }) });
    } catch (error) {
      console.error("ERROR GET LOG KONTRAK:", error);
      return res.status(500).json({ error: "Gagal memuat log kontrak." });
    }
  });

  app.post(route, async (req, res) => {
    const konteks = konteksKontrak(req, res, userAdalahLegal);
    if (!konteks) return;

    const { status_ids, catatan = "", tanggal_mulai, tanggal_akhir } = req.body || {};
    const statusId = Array.isArray(status_ids) && status_ids.length === 1
      ? idPositif(status_ids[0])
      : null;
    if (!statusId) {
      return res.status(400).json({ error: "Pilih satu status kontrak yang valid." });
    }

    if (typeof catatan !== "string" || catatan.length > 5000 || catatan.includes("\0")) {
      return res.status(400).json({ error: "Catatan harus berupa teks maksimal 5000 karakter." });
    }

    let client;
    let transactionActive = false;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      transactionActive = true;

      const kontrak = await cariKontrak(client, konteks, true);
      if (!kontrak || kontrak.tanggal_mulai !== tanggal_mulai || kontrak.tanggal_akhir !== tanggal_akhir) {
        await client.query("ROLLBACK");
        transactionActive = false;
        return kontrak
          ? res.status(409).json({ error: "Periode kontrak berubah. Muat ulang halaman sebelum menyimpan." })
          : res.status(404).json({ error: "Kontrak tidak ditemukan atau Anda tidak memiliki akses." });
      }

      const { rows } = await client.query(
        `SELECT deskripsi, LOCALTIMESTAMP AS waktu FROM public.status_proyek
         WHERE id = $1 AND LOWER(flag) = 'kontrak' AND LOWER(status) = 'aktif'
         FOR SHARE`,
        [statusId]
      );
      const statusDipilih = rows[0];
      if (!statusDipilih) {
        await client.query("ROLLBACK");
        transactionActive = false;
        return res.status(400).json({ error: "Status kontrak tidak aktif atau sudah tidak tersedia." });
      }

      const isi = { status: [statusDipilih.deskripsi], catatan: catatan.trim(), tanggal_mulai, tanggal_akhir };
      await simpanActivityLog(client, {
        pic_id: konteks.picId,
        nama_pic: konteks.namaPic,
        aktivitas: "CREATE",
        modul: "KONTRAK",
        entity_id: kontrak.proyek_id,
        entity_nama: kontrak.nama_proyek,
        field_name: konteks.fieldBaru,
        nilai_baru: JSON.stringify(isi),
        deskripsi: "menambahkan status kontrak"
      });

      await client.query("COMMIT");
      transactionActive = false;
      res.setHeader("Cache-Control", "no-store");
      return res.status(201).json({ ...isi, waktu: statusDipilih.waktu });
    } catch (error) {
      if (client && transactionActive) await client.query("ROLLBACK").catch(() => {});
      console.error("ERROR SIMPAN LOG KONTRAK:", error);
      return res.status(500).json({ error: "Gagal menyimpan status kontrak." });
    } finally {
      if (client) client.release();
    }
  });
}

module.exports = { ambilRingkasanLogKontrak, daftarRuteLogKontrak };
