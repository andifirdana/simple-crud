"use strict";

const crypto = require("node:crypto");
const multer = require("multer");
const { listTimeline, kolomUploadTimelineBelumAda } = require("./timeline-data");
const { simpanActivityLog } = require("./activity-log");

const STATUS = ["Aktif", "Berakhir", "Diperpanjang", "Selesai"];
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function validDate(value) {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function text(value, label, max = 2000) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) {
    throw fail(`${label} harus berupa teks maksimal ${max} karakter.`);
  }
  return value.trim();
}

function timelineValues(row) {
  const deskripsi = text(row.deskripsi, "Deskripsi");
  const mulai = text(row.tanggal_mulai, "Tanggal Mulai", 10);
  const akhir = text(row.tanggal_akhir, "Tanggal Akhir", 10);
  if (!deskripsi) throw fail("Deskripsi wajib diisi.");
  if (!validDate(mulai) || !validDate(akhir)) throw fail("Tanggal wajib valid dalam format YYYY-MM-DD.");
  if (akhir < mulai) throw fail("Tanggal akhir tidak boleh sebelum tanggal mulai.");
  const status = text(row.status, "Status", 30) || "Aktif";
  if (!STATUS.includes(status)) throw fail(`Status harus ${STATUS.join(", ")}.`);
  const jenis = text(row.jenis_proyek, "Jenis Proyek", 200);
  const rawId = row.proyek_id;
  if (rawId !== "" && rawId !== undefined && rawId !== null &&
      !(typeof rawId === "number" || (typeof rawId === "string" && /^[1-9]\d*$/.test(rawId.trim())))) {
    throw fail("ID Proyek tidak valid.");
  }
  const id = rawId === "" || rawId === undefined || rawId === null ? null : Number(rawId);
  if (id !== null && (!Number.isSafeInteger(id) || id <= 0)) throw fail("ID Proyek tidak valid.");
  return { deskripsi, tanggal_mulai: mulai, tanggal_akhir: akhir, status, jenis_proyek: jenis, proyek_id: id };
}

async function allowedProjects(db, user, lock = false) {
  const result = await db.query(`
    SELECT p.id, p.nama_proyek, p.jenis_proyek
    FROM public.proyek p
    WHERE $1::boolean = TRUE OR EXISTS (
      SELECT 1 FROM public.proyek_pic akses
      WHERE akses.proyek_id = p.id AND akses.pic_id = $2
    )
    ORDER BY p.nama_proyek, p.id
    ${lock ? "FOR SHARE OF p" : ""}
  `, [user.isAdmin, user.id]);
  return result.rows;
}

function resolveProject(values, name, projects) {
  let matches;
  if (values.proyek_id !== null) {
    matches = projects.filter(project => Number(project.id) === values.proyek_id);
  } else if (name) {
    matches = projects.filter(project => String(project.nama_proyek).trim().toLowerCase() === name.toLowerCase());
  } else {
    return values;
  }
  if (matches.length !== 1) throw fail("Proyek tidak ditemukan, nama ambigu, atau Anda tidak memiliki akses. Gunakan ID dari sheet Pilihan Proyek.");
  const project = matches[0];
  if (values.proyek_id !== null && name && String(project.nama_proyek).trim().toLowerCase() !== name.toLowerCase()) {
    throw fail("ID Proyek dan Nama Proyek tidak cocok.");
  }
  return { ...values, proyek_id: Number(project.id), jenis_proyek: project.jenis_proyek || "" };
}

module.exports = function registerTimelineApi(app, pool, options = {}) {
  const runExcel = options.runExcel || require("./timeline-excel").runExcel;
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 0 } });

  function requireUser(req, res, next) {
    const user = req.session?.user;
    if (!user) return res.status(401).json({ error: "Belum login" });
    const id = Number(user.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(401).json({ error: "Sesi tidak valid. Silakan login kembali." });
    req.timelineUser = { id, nama: user.nama || "", isAdmin: String(user.role || "").trim().toLowerCase() === "admin" };
    res.setHeader("Cache-Control", "no-store");
    return next();
  }

  const handle = fn => async (req, res) => {
    try { return await fn(req, res); }
    catch (error) {
      if (!error.status) console.error("ERROR API TIMELINE:", req.method, req.path, error);
      if (kolomUploadTimelineBelumAda(error)) {
        return res.status(503).json({
          error: "Upload dan edit Timeline memerlukan migrasi database 003_timeline_upload.sql."
        });
      }
      return res.status(error.status || 500).json({ error: error.status ? error.message : "Gagal memproses timeline. Silakan coba kembali." });
    }
  };

  async function transaction(work) {
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { if (client) client.release(); }
  }

  function sendWorkbook(res, buffer, filename) {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  app.get("/api/timeline", requireUser, handle(async (req, res) => {
    return res.json(await listTimeline(pool, req.query, req.timelineUser));
  }));

  app.get("/api/timeline/projects", requireUser, handle(async (req, res) => {
    return res.json(await allowedProjects(pool, req.timelineUser));
  }));

  app.get("/api/timeline/template", requireUser, handle(async (req, res) => {
    const projects = await allowedProjects(pool, req.timelineUser);
    return sendWorkbook(res, await runExcel("export", { projects, rows: [] }), "template-timeline.xlsx");
  }));

  app.get("/api/timeline/export", requireUser, handle(async (req, res) => {
    const result = await listTimeline(pool, req.query, req.timelineUser, { all: true });
    const rows = result.data.map(item => ({
      ...item,
      id_timeline: item.timeline_key,
      nama_proyek: item.proyek_id == null ? "" : item.nama_proyek,
      proyek_id: item.proyek_id ?? ""
    }));
    const projects = await allowedProjects(pool, req.timelineUser);
    return sendWorkbook(res, await runExcel("export", { rows, projects }), "data-timeline.xlsx");
  }));

  function parseUpload(req, res, next) {
    upload.single("file")(req, res, error => {
      if (error) return res.status(400).json({ error: "Upload harus satu file .xlsx maksimal 10 MB." });
      return next();
    });
  }

  app.post("/api/timeline/import", requireUser, parseUpload, handle(async (req, res) => {
    if (!req.file || !/\.xlsx$/i.test(req.file.originalname)) throw fail("Pilih file Excel berformat .xlsx.");
    const rows = await runExcel("import", req.file.buffer);
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 2000) throw fail("Upload harus berisi 1 sampai 2000 baris.");
    const result = await transaction(async client => {
      const projects = await allowedProjects(client, req.timelineUser, true);
      const prepared = rows.map((row, index) => {
        try {
          if (!row || typeof row !== "object" || Array.isArray(row)) throw fail("Baris tidak valid.");
          if (text(row.id_timeline, "ID Timeline", 100)) throw fail("Upload hanya untuk data baru. Gunakan template kosong dan edit data existing melalui halaman Timeline.");
          for (const field of ["sumber_timeline", "no_req_klien", "nama_cabang", "item_produk", "quantity"]) {
            if (text(row[field], field, 200)) throw fail("Kolom Sumber, No Req Klien, Lokasi, Produk, dan Qty khusus arsip unduhan; kosongkan saat upload data baru.");
          }
          const values = resolveProject(timelineValues(row), text(row.nama_proyek, "Nama Proyek", 500), projects);
          const fingerprint = crypto.createHash("sha256").update(JSON.stringify([req.timelineUser.id, values])).digest("hex");
          return { values, fingerprint };
        } catch (error) { throw fail(`Baris ${Number(row?.baris) || index + 2}: ${error.message}`); }
      });
      let imported = 0;
      let unassigned = 0;
      for (const { values, fingerprint } of prepared) {
        const inserted = await client.query(`
          INSERT INTO public.proyek_timeline (
            proyek_id, deskripsi, tanggal_mulai, tanggal_akhir, status,
            jenis_proyek_upload, imported_by, imported_at, import_fingerprint
          ) VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, NOW(), $8)
          ON CONFLICT (import_fingerprint) DO NOTHING
          RETURNING id
        `, [values.proyek_id, values.deskripsi, values.tanggal_mulai, values.tanggal_akhir,
          values.status, values.jenis_proyek, req.timelineUser.id, fingerprint]);
        if (inserted.rows.length) {
          imported++;
          if (values.proyek_id === null) unassigned++;
        }
      }
      await simpanActivityLog(client, {
        pic_id: req.timelineUser.id, nama_pic: req.timelineUser.nama,
        aktivitas: "CREATE", modul: "TIMELINE", field_name: "UPLOAD EXCEL",
        nilai_baru: `${imported} timeline; ${unassigned} belum di-assign`,
        deskripsi: "mengunggah data timeline dari Excel"
      });
      return { imported, unassigned, skipped: rows.length - imported };
    });
    return res.status(201).json(result);
  }));

  app.put("/api/timeline/:id", requireUser, handle(async (req, res) => {
    const id = /^[1-9]\d*$/.test(String(req.params.id)) ? Number(req.params.id) : NaN;
    if (!Number.isSafeInteger(id) || id <= 0) throw fail("ID Timeline tidak valid.");
    const values = timelineValues(req.body || {});
    const version = String(req.body?.versi ?? "");
    if (!/^\d{1,19}$/.test(version)) throw fail("Versi timeline tidak valid. Muat ulang halaman.");

    const saved = await transaction(async client => {
      const existing = await client.query(`
        SELECT t.*, t.timeline_version::text AS versi, p.nama_proyek
        FROM public.proyek_timeline t
        LEFT JOIN public.proyek p ON p.id = t.proyek_id
        WHERE t.id = $1 AND (
          $2::boolean = TRUE
          OR (t.proyek_id IS NULL AND t.imported_by = $3)
          OR EXISTS (SELECT 1 FROM public.proyek_pic akses WHERE akses.proyek_id = t.proyek_id AND akses.pic_id = $3)
        )
        FOR UPDATE OF t
      `, [id, req.timelineUser.isAdmin, req.timelineUser.id]);
      const old = existing.rows[0];
      if (!old) throw fail("Timeline tidak ditemukan atau Anda tidak memiliki akses.", 404);
      if (String(old.versi) !== version) throw fail("Timeline telah berubah. Salin isian Anda, lalu muat ulang halaman sebelum mengedit kembali.", 409);
      if (values.proyek_id === null && old.proyek_id !== null && !req.timelineUser.isAdmin && Number(old.imported_by) !== req.timelineUser.id) {
        throw fail("Hanya pengunggah atau admin yang dapat melepas assignment proyek.", 403);
      }
      const projects = await allowedProjects(client, req.timelineUser, true);
      const resolved = resolveProject(values, "", projects);
      const updated = await client.query(`
        UPDATE public.proyek_timeline SET
          proyek_id = $2, deskripsi = $3, tanggal_mulai = $4::date, tanggal_akhir = $5::date,
          status = $6, jenis_proyek_upload = $7, imported_by = COALESCE(imported_by, $8), updated_at = NOW()
        WHERE id = $1
        RETURNING id, timeline_version::text AS versi
      `, [id, resolved.proyek_id, resolved.deskripsi, resolved.tanggal_mulai,
        resolved.tanggal_akhir, resolved.status, resolved.jenis_proyek, req.timelineUser.id]);
      await simpanActivityLog(client, {
        pic_id: req.timelineUser.id, nama_pic: req.timelineUser.nama,
        aktivitas: "UPDATE", modul: "TIMELINE", entity_id: resolved.proyek_id,
        entity_nama: projects.find(project => Number(project.id) === resolved.proyek_id)?.nama_proyek || "Belum di-assign",
        field_name: `TIMELINE #${id}`, nilai_lama: JSON.stringify({ proyek_id: old.proyek_id, deskripsi: old.deskripsi, status: old.status }),
        nilai_baru: JSON.stringify(resolved), deskripsi: "mengedit timeline dan assignment proyek"
      });
      return updated.rows[0];
    });
    return res.json(saved);
  }));
};

module.exports.timelineValues = timelineValues;
