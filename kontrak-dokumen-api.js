"use strict";

const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { simpanActivityLog } = require("./activity-log");

const sumberDokumen = {
  klien: {
    jenis: "Klien",
    tabel: "proyek_klien_dokumen",
    relasi: "proyek_klien",
    idKontrak: "proyek_klien_id",
    fileSimpan: "nama_file_simpan",
    mime: "tipe_file"
  },
  partner: {
    jenis: "Partner",
    tabel: "proyek_partner_dokumen",
    relasi: "proyek_partner",
    idKontrak: "proyek_partner_id",
    fileSimpan: "nama_file_server",
    mime: "mime_type"
  }
};

const pemisah = "[-[:space:]_./]";
const kataKunci = [
  `Perjanjian${pemisah}+Kerja${pemisah}*Sama`,
  "PKS",
  "KPBJ",
  ["Kontrak", "Pengadaan", "Barang", "dan", "Jasa"].join(`${pemisah}+`)
].join("|");
const polaKontrak = `(^|[^[:alnum:]])(${kataKunci})($|[^[:alnum:]])`;
const kategoriDokumen = ["Draft", "PKS", "KPBJ", "SPK", "Routing Slip"];
const kategoriNormal = kategoriDokumen.map(kategori => kategori.toLowerCase());

function kondisiPdf(sumber) {
  return `(
    LOWER(BTRIM(d.${sumber.mime})) = 'application/pdf'
    OR d.nama_file_asli ~* '[.]pdf$'
    OR d.path_file ~* '[.]pdf$'
  )`;
}

function filterDokumen(sumber, parameterPola, parameterKategori) {
  return `
    AND NULLIF(BTRIM(d.path_file), '') IS NOT NULL
    AND (
      LOWER(BTRIM(d.nama_dokumen)) = ANY(${parameterKategori}::text[])
      OR (${kondisiPdf(sumber)} AND (
        d.nama_dokumen ~* ${parameterPola}
        OR d.nomor_dokumen ~* ${parameterPola}
        OR d.nama_file_asli ~* ${parameterPola}
      ))
    )
  `;
}

async function ambilDokumenKontrak(pool, kontrak) {
  if (kontrak.length === 0) return new Map();

  const sumber = Object.values(sumberDokumen);
  const ids = sumber.map(({ jenis }) => kontrak
    .filter(item => item.jenis_relasi === jenis)
    .map(item => item.kontrak_id));

  const query = sumber.map((item, index) => `
    SELECT
      '${item.jenis}' AS jenis_relasi,
      d.${item.idKontrak} AS kontrak_id,
      d.id::text AS dokumen_id,
      d.nama_dokumen,
      d.nomor_dokumen,
      d.nama_file_asli
    FROM public.${item.tabel} d
    WHERE d.${item.idKontrak} = ANY($${index + 1}::bigint[])
    ${filterDokumen(item, "$3", "$4")}
  `).join(" UNION ALL ");

  const { rows } = await pool.query(
    `${query} ORDER BY nama_dokumen, dokumen_id`,
    [...ids, polaKontrak, kategoriNormal]
  );

  const dokumenPerKontrak = new Map();
  for (const { jenis_relasi, kontrak_id, ...dokumen } of rows) {
    const key = `${jenis_relasi}:${kontrak_id}`;
    if (!dokumenPerKontrak.has(key)) dokumenPerKontrak.set(key, []);
    dokumenPerKontrak.get(key).push(dokumen);
  }
  return dokumenPerKontrak;
}

function konteksDokumen(req, res, userAdalahLegal) {
  const user = req.session?.user;
  if (!user) {
    res.status(401).json({ error: "Belum login" });
    return null;
  }

  const { jenis, kontrakId } = req.params;
  const sumber = Object.hasOwn(sumberDokumen, jenis) ? sumberDokumen[jenis] : null;
  if (!sumber || !/^[1-9]\d{0,15}$/.test(kontrakId)) {
    res.status(400).json({ error: "Kontrak tidak valid" });
    return null;
  }

  const isAdmin = String(user.role || "").trim().toLowerCase() === "admin";
  const userId = Number(user.id);
  const picId = Number.isSafeInteger(userId) && userId > 0 ? userId : null;
  if (!isAdmin && !picId) {
    res.status(403).json({ error: "Data PIC tidak valid" });
    return null;
  }

  const aksesSemua = isAdmin || userAdalahLegal(user);
  return { sumber, kontrakId, aksesSemua, picId, namaPic: user.nama || "" };
}

async function cariKontrakDokumen(db, konteks, kunci = false) {
  const { sumber, kontrakId, aksesSemua, picId } = konteks;
  const { rows } = await db.query(`
    SELECT k.proyek_id, p.nama_proyek
    FROM public.${sumber.relasi} k
    JOIN public.proyek p ON p.id = k.proyek_id
    WHERE k.id = $1 AND ($2::boolean OR EXISTS (
      SELECT 1 FROM public.proyek_pic akses
      WHERE akses.proyek_id = k.proyek_id AND akses.pic_id = $3
    ))
    ${kunci ? "FOR SHARE OF k" : ""}
  `, [kontrakId, aksesSemua, picId]);
  return rows[0];
}

function daftarRuteDokumenKontrak(app, pool, { userAdalahLegal, getFileLink, uploadFile, hapusFile, bacaUpload }) {
  app.post("/api/kontrak/:jenis/:kontrakId/dokumen", async (req, res, next) => {
    const konteks = konteksDokumen(req, res, userAdalahLegal);
    if (!konteks) return;

    try {
      if (!await cariKontrakDokumen(pool, konteks)) {
        return res.status(404).json({ error: "Kontrak tidak ditemukan atau Anda tidak memiliki akses." });
      }
      req.konteksDokumenKontrak = konteks;
      return next();
    } catch (error) {
      console.error("ERROR AKSES UPLOAD DOKUMEN KONTRAK:", error);
      return res.status(500).json({ error: "Gagal memeriksa akses kontrak." });
    }
  }, (req, res, next) => {
    bacaUpload(req, res, error => {
      if (!error) return next();
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Ukuran file maksimal 20 MB." });
      }
      return res.status(400).json({ error: "Unggah satu file dokumen yang valid." });
    });
  }, async (req, res) => {
    const { sumber, kontrakId, picId, namaPic } = req.konteksDokumenKontrak;
    const { kategori, nomor_dokumen: nomorInput = "" } = req.body || {};
    const file = req.file;
    if (!kategoriDokumen.includes(kategori) || !file?.size) {
      return res.status(400).json({ error: "Pilih kategori dan file dokumen." });
    }
    if (typeof nomorInput !== "string" || nomorInput.includes("\0") || nomorInput.trim().length > 150) {
      return res.status(400).json({ error: "Nomor dokumen harus berupa teks maksimal 150 karakter." });
    }

    const nomor = nomorInput.trim() || null;
    const namaAsli = path.basename(file.originalname.replaceAll("\\", "/")).trim() || "dokumen";
    const ext = path.extname(namaAsli).toLowerCase();
    const key = `kontrak/${randomUUID()}${/^[.][a-z0-9]{1,15}$/.test(ext) ? ext : ""}`;
    const tipe = file.mimetype || "application/octet-stream";
    let client;
    let keyTerunggah;
    let commitDimulai = false;

    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const kontrak = await cariKontrakDokumen(client, req.konteksDokumenKontrak, true);
      if (!kontrak) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Kontrak tidak ditemukan atau Anda tidak memiliki akses." });
      }

      const unggahan = await uploadFile({ ...file, mimetype: "application/octet-stream" }, key);
      keyTerunggah = unggahan.key;
      const { rows } = await client.query(`
        INSERT INTO public.${sumber.tabel} (
          ${sumber.idKontrak}, nama_dokumen, nomor_dokumen, nama_file_asli, ${sumber.fileSimpan},
          path_file, ${sumber.mime}, ukuran_file
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id::text AS dokumen_id, nama_dokumen, nomor_dokumen, nama_file_asli
      `, [kontrakId, kategori, nomor, namaAsli, keyTerunggah, keyTerunggah, tipe, file.size]);

      await simpanActivityLog(client, {
        pic_id: picId,
        nama_pic: namaPic,
        aktivitas: "CREATE",
        modul: "PROYEK",
        entity_id: kontrak.proyek_id,
        entity_nama: kontrak.nama_proyek,
        field_name: `DOKUMEN ${sumber.jenis.toUpperCase()}`,
        nilai_baru: [kategori, nomor, namaAsli].filter(Boolean).join(" · "),
        deskripsi: "mengunggah dokumen kontrak"
      });

      commitDimulai = true;
      await client.query("COMMIT");
      return res.status(201).json({ data: rows[0] });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      // Saat hasil COMMIT tidak diketahui, pertahankan file yang mungkin sudah dirujuk database.
      if (keyTerunggah && !commitDimulai) {
        await hapusFile(keyTerunggah).catch(hapusError => {
          console.error("ERROR BERSIHKAN FILE KONTRAK:", hapusError);
        });
      }
      console.error("ERROR UPLOAD DOKUMEN KONTRAK:", error);
      return res.status(500).json({ error: "Gagal mengunggah dokumen kontrak." });
    } finally {
      if (client) client.release();
    }
  });

  app.get("/api/kontrak/:jenis/:kontrakId/dokumen/:dokumenId", async (req, res, next) => {
    const konteks = konteksDokumen(req, res, userAdalahLegal);
    if (!konteks) return;

    const { dokumenId } = req.params;
    if (!/^[1-9]\d{0,15}$/.test(dokumenId)) {
      return res.status(400).json({ error: "Dokumen kontrak tidak valid" });
    }

    const { sumber, kontrakId, aksesSemua, picId } = konteks;
    try {
      const { rows } = await pool.query(`
        SELECT d.path_file, d.nama_file_asli, ${kondisiPdf(sumber)} AS is_pdf
        FROM public.${sumber.tabel} d
        JOIN public.${sumber.relasi} k ON k.id = d.${sumber.idKontrak}
        WHERE k.id = $1 AND d.id = $2
          AND ($3::boolean OR EXISTS (
            SELECT 1
            FROM public.proyek_pic akses
            WHERE akses.proyek_id = k.proyek_id AND akses.pic_id = $4
          ))
          ${filterDokumen(sumber, "$5", "$6")}
      `, [kontrakId, dokumenId, aksesSemua, picId, polaKontrak, kategoriNormal]);

      const dokumen = rows[0];
      if (!dokumen) {
        return res.status(404).json({ error: "Dokumen kontrak tidak ditemukan" });
      }

      res.setHeader("Cache-Control", "private, no-store");
      const nama = dokumen.nama_file_asli || path.basename(dokumen.path_file);
      const originalName = dokumen.is_pdf && !/[.]pdf$/i.test(nama) ? `${nama}.pdf` : nama;
      const fileLokal = /^\/?uploads\/(dokumen-(?:klien|partner))\/([^./\\][^/\\]*)$/i
        .exec(dokumen.path_file);
      if (fileLokal) {
        const options = { root: path.join(__dirname, "uploads", fileLokal[1]) };
        const onError = error => {
          if (error) next(error);
        };
        if (!dokumen.is_pdf) return res.download(fileLokal[2], originalName, options, onError);
        res.type("pdf");
        return res.sendFile(fileLokal[2], options, onError);
      }

      const url = await getFileLink(dokumen.path_file, { originalName, download: !dokumen.is_pdf });
      return res.redirect(url);
    } catch (error) {
      console.error("ERROR GET DOKUMEN KONTRAK:", error);
      return res.status(500).json({ error: "Gagal membuka dokumen kontrak" });
    }
  });
}

module.exports = { ambilDokumenKontrak, daftarRuteDokumenKontrak };
