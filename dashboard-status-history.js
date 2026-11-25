"use strict";

const statusHistoryQuery = String.raw`
  WITH waktu AS (
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date AS hari_ini
  ),
  pilihan AS (
    SELECT
      hari_ini,
      MAKE_DATE(
        $1::integer,
        COALESCE($2::integer, CASE
          WHEN $1::integer < EXTRACT(YEAR FROM hari_ini) THEN 12
          ELSE EXTRACT(MONTH FROM hari_ini)::integer
        END),
        1
      ) AS awal_bulan
    FROM waktu
  ),
  periode AS (
    SELECT
      awal_bulan,
      awal_bulan > hari_ini AS bulan_mendatang,
      DATE_TRUNC('month', hari_ini)::date = awal_bulan AS bulan_berjalan,
      awal_bulan::timestamp AT TIME ZONE 'Asia/Jakarta' AS mulai,
      MAKE_DATE($1::integer, 1, 1)::timestamp AT TIME ZONE 'Asia/Jakarta' AS awal_tahun,
      MAKE_DATE($1::integer + 1, 1, 1)::timestamp AT TIME ZONE 'Asia/Jakarta' AS akhir_tahun,
      LEAST(
        (awal_bulan + INTERVAL '1 month') AT TIME ZONE 'Asia/Jakarta',
        CURRENT_TIMESTAMP
      ) AS selesai
    FROM pilihan
  ),
  proyek_terfilter AS (
    SELECT p.id, p.created_at
    FROM public.proyek p
    WHERE ($3::integer IS NULL OR EXISTS (
        SELECT 1 FROM public.proyek_pic
        WHERE proyek_id = p.id AND pic_id = $3::integer
      ))
      AND ($4::text = '' OR LOWER(BTRIM(p.jenis_proyek)) = LOWER($4::text))
  ),
  proyek_laporan AS (
    SELECT
      p.id,
      p.created_at,
      klien.id AS klien_id,
      klien.created_at AS klien_dibuat,
      klien.updated_at AS klien_diubah,
      klien.status_pengadaan AS status_tersimpan
    FROM proyek_terfilter p
    CROSS JOIN periode
    LEFT JOIN LATERAL (
      SELECT id, created_at, updated_at, status_pengadaan
      FROM public.proyek_klien
      WHERE proyek_id = p.id
      ORDER BY id DESC
      LIMIT 1
    ) klien ON TRUE
    WHERE NOT periode.bulan_mendatang
      AND p.created_at < periode.selesai
  ),
  log_pengadaan AS (
    SELECT
      log.id,
      log.entity_id AS proyek_id,
      log.created_at,
      BTRIM(SUBSTRING(log.nilai_lama FROM
        '(?:^|, )STATUS PENGADAAN = ((?:[^,]|,(?! [A-Z][A-Z0-9 ]+ = ))*)'
      )) AS status_lama,
      BTRIM(SUBSTRING(log.nilai_baru FROM
        '(?:^|, )STATUS PENGADAAN = ((?:[^,]|,(?! [A-Z][A-Z0-9 ]+ = ))*)'
      )) AS status_baru
    FROM public.activity_log log
    JOIN proyek_terfilter proyek ON proyek.id = log.entity_id
    WHERE UPPER(log.modul) = 'PROYEK'
      AND log.field_name = 'DATA KLIEN'
      AND log.aktivitas IN ('CREATE', 'UPDATE')
      AND log.nilai_baru LIKE '%STATUS PENGADAAN = %'
  ),
  batas AS (
    SELECT 1 AS periode_id, mulai AS sebelum FROM periode
    UNION ALL
    SELECT 2, selesai FROM periode
  ),
  -- Riwayat lama menyimpan nilai sebelum dan sesudah sebagai teks.
  -- Ambil perubahan terdekat di kedua sisi batas bulan.
  log_terakhir AS (
    SELECT DISTINCT ON (log.proyek_id, batas.periode_id)
      log.proyek_id, batas.periode_id, log.status_baru
    FROM log_pengadaan log
    JOIN proyek_laporan proyek ON proyek.id = log.proyek_id
    JOIN batas ON log.created_at < batas.sebelum
    WHERE log.status_baru IS NOT NULL
    ORDER BY log.proyek_id, batas.periode_id, log.created_at DESC, log.id DESC
  ),
  log_berikut AS (
    SELECT DISTINCT ON (log.proyek_id, batas.periode_id)
      log.proyek_id, batas.periode_id, log.status_lama
    FROM log_pengadaan log
    JOIN proyek_laporan proyek ON proyek.id = log.proyek_id
    JOIN batas ON log.created_at >= batas.sebelum
    WHERE log.status_baru IS NOT NULL
    ORDER BY log.proyek_id, batas.periode_id, log.created_at, log.id
  ),
  status_per_batas AS (
    SELECT
      batas.periode_id,
      CASE
        WHEN proyek.klien_id IS NULL OR proyek.klien_dibuat >= batas.sebelum THEN
          COALESCE(log_terakhir.status_baru, '-')
        WHEN COALESCE(proyek.klien_diubah, proyek.klien_dibuat) < batas.sebelum THEN
          COALESCE(proyek.status_tersimpan, '-')
        ELSE COALESCE(log_berikut.status_lama, log_terakhir.status_baru)
      END AS status
    FROM proyek_laporan proyek
    JOIN batas ON proyek.created_at < batas.sebelum
    LEFT JOIN log_terakhir
      ON log_terakhir.proyek_id = proyek.id AND log_terakhir.periode_id = batas.periode_id
    LEFT JOIN log_berikut
      ON log_berikut.proyek_id = proyek.id AND log_berikut.periode_id = batas.periode_id
  ),
  hitungan AS (
    SELECT
      CASE
        WHEN status IS NULL THEN 'Riwayat tidak lengkap'
        WHEN status IN ('', '-') THEN 'Belum ada status'
        ELSE status
      END AS status,
      COUNT(*) FILTER (WHERE periode_id = 1)::integer AS sebelumnya,
      COUNT(*) FILTER (WHERE periode_id = 2)::integer AS terpilih
    FROM status_per_batas
    GROUP BY 1
  ),
  perubahan_tahunan AS (
    SELECT
      proyek_id,
      created_at,
      CASE WHEN status_lama IN ('', '-') THEN 'Belum ada status' ELSE status_lama END AS dari,
      CASE WHEN status_baru IN ('', '-') THEN 'Belum ada status' ELSE status_baru END AS ke
    FROM log_pengadaan
    CROSS JOIN periode
    WHERE created_at >= periode.awal_tahun
      AND created_at < LEAST(periode.akhir_tahun, CURRENT_TIMESTAMP)
      AND LOWER(status_lama) <> LOWER(status_baru)
  ),
  perubahan AS (
    SELECT perubahan_tahunan.proyek_id, dari, ke
    FROM perubahan_tahunan
    JOIN proyek_laporan proyek ON proyek.id = perubahan_tahunan.proyek_id
    CROSS JOIN periode
    WHERE perubahan_tahunan.created_at >= periode.mulai
      AND perubahan_tahunan.created_at < periode.selesai
  ),
  bulan_perubahan AS (
    SELECT
      TO_CHAR(created_at::timestamptz AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS bulan,
      COUNT(DISTINCT proyek_id)::integer AS jumlah
    FROM perubahan_tahunan
    GROUP BY 1
  ),
  daftar_status AS (
    SELECT BTRIM(deskripsi) AS status, 0 AS sebelumnya, 0 AS terpilih
    FROM public.status_proyek
    WHERE LOWER(flag) = 'pengadaan' AND LOWER(status) = 'aktif'
      AND BTRIM(deskripsi) <> ''
    UNION ALL
    SELECT status, sebelumnya, terpilih FROM hitungan
    UNION ALL
    SELECT dari, 0, 0 FROM perubahan
    UNION ALL
    SELECT ke, 0, 0 FROM perubahan
  ),
  ringkasan AS (
    SELECT MIN(status) AS status,
      SUM(sebelumnya)::integer AS sebelumnya,
      SUM(terpilih)::integer AS terpilih
    FROM daftar_status
    GROUP BY LOWER(status)
  ),
  perpindahan AS (
    SELECT MIN(dari) AS dari, MIN(ke) AS ke, COUNT(DISTINCT proyek_id)::integer AS jumlah
    FROM perubahan
    GROUP BY LOWER(dari), LOWER(ke)
  )
  SELECT
    TO_CHAR(periode.awal_bulan - INTERVAL '1 month', 'YYYY-MM') AS bulan_sebelumnya,
    TO_CHAR(periode.awal_bulan, 'YYYY-MM') AS bulan_terpilih,
    periode.bulan_berjalan,
    periode.bulan_mendatang,
    COALESCE((SELECT JSON_AGG(ringkasan ORDER BY status) FROM ringkasan), '[]') AS status,
    COALESCE((SELECT JSON_AGG(perpindahan ORDER BY jumlah DESC, dari, ke) FROM perpindahan), '[]')
      AS perpindahan,
    COALESCE((SELECT JSON_AGG(bulan_perubahan ORDER BY bulan) FROM bulan_perubahan), '[]')
      AS bulan_perubahan
  FROM periode
`;

async function readStatusHistory(pool, { tahun, bulan, filterPicId, jenisProyek }) {
  const { rows } = await pool.query(statusHistoryQuery, [
    tahun, bulan, filterPicId, jenisProyek
  ]);
  return rows[0];
}

module.exports = { readStatusHistory };
