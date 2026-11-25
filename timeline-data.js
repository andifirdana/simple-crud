"use strict";

// Shared by listing and Excel export so filters, access, and ordering stay identical.
function buatQueryTimeline(uploadTersedia) {
  return `
          WITH tanggal_acuan AS (
            SELECT
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE
                'Asia/Jakarta'
              )::date AS hari_ini
          ),

          timeline_dasar AS (

            /* ========================================
             * TIMELINE PROYEK BIASA
             * ======================================== */

            SELECT
              timeline.id,

              (
                'proyek-' ||
                timeline.id::text
              ) AS timeline_key,

              'Proyek'::text
                AS sumber_timeline,

              ${uploadTersedia ? "TRUE" : "FALSE"}
                AS dapat_diubah,

              ${uploadTersedia ? "timeline.timeline_version::text" : "NULL::text"} AS versi,

              timeline.proyek_id,

              NULL::integer
                AS proyek_sewa_id,

              NULL::integer
                AS proyek_sewa_produk_id,

              timeline.deskripsi,

              timeline.tanggal_mulai::date
                AS tanggal_mulai,

              timeline.tanggal_akhir::date
                AS tanggal_akhir,

              timeline.status,

              COALESCE(proyek.nama_proyek, 'Belum di-assign') AS nama_proyek,
              ${uploadTersedia
                ? "COALESCE(NULLIF(BTRIM(proyek.jenis_proyek), ''), timeline.jenis_proyek_upload)"
                : "NULLIF(BTRIM(proyek.jenis_proyek), '')"} AS jenis_proyek,
              proyek.sub_jenis_proyek,

              proyek.status_final,

              NULL::text
                AS nomor_pr,

              NULL::text
                AS no_do,

              NULL::text
                AS item_produk,

              NULL::text
                AS nama_cabang,

              NULL::integer AS quantity,
              NULL::text AS no_req_klien,

              COALESCE(
                kategori_data.kategori,
                '[]'::jsonb
              ) AS kategori,

              (
                LOWER(
                  BTRIM(
                    COALESCE(
                      proyek.status_final,
                      ''
                    )
                  )
                ) = 'aktif'

                AND (

                  LOWER(
                    COALESCE(
                      proyek.jenis_proyek,
                      ''
                    )
                  ) LIKE '%sewa%'

                  OR

                  LOWER(
                    COALESCE(
                      proyek.sub_jenis_proyek,
                      ''
                    )
                  ) LIKE '%sewa%'

                  OR

                  LOWER(
                    COALESCE(
                      proyek.sub_jenis_proyek,
                      ''
                    )
                  ) LIKE '%lisensi%'
                )
              ) AS masuk_contract_overview

            FROM public.proyek_timeline timeline

            LEFT JOIN public.proyek proyek
              ON proyek.id =
                 timeline.proyek_id

            LEFT JOIN LATERAL (
              SELECT
                COALESCE(
                  JSONB_AGG(
                    DISTINCT
                    kategori.nama_kategori_produk

                    ORDER BY
                      kategori.nama_kategori_produk
                  ),
                  '[]'::jsonb
                ) AS kategori

              FROM public.proyek_kategori relasi

              INNER JOIN public.kategori_produk kategori
                ON kategori.id =
                   relasi.kategori_produk_id

              WHERE relasi.proyek_id =
                    proyek.id
            ) kategori_data
              ON TRUE

            WHERE
              (
                $7::boolean = TRUE

                ${uploadTersedia ? "OR (timeline.proyek_id IS NULL AND timeline.imported_by = $8)" : ""}

                OR EXISTS (
                  SELECT 1

                  FROM public.proyek_pic akses_pic

                  WHERE
                    akses_pic.proyek_id =
                      proyek.id

                    AND akses_pic.pic_id =
                      $8
                )
              )

            UNION ALL

            /* ========================================
             * TIMELINE PROYEK SEWA
             * Mulai = tanggal DO
             * Akhir = end date sewa
             * ======================================== */

            SELECT
              sewa_order.id,

              (
                'sewa-' ||
                sewa_order.id::text
              ) AS timeline_key,

              'Sewa'::text
                AS sumber_timeline,

              FALSE
                AS dapat_diubah,

              NULL::text AS versi,

              proyek_sewa.proyek_id,

              proyek_sewa.id
                AS proyek_sewa_id,

              sewa_produk.id
                AS proyek_sewa_produk_id,

              COALESCE(
                NULLIF(
                  BTRIM(
                    master_produk.item_produk
                  ),
                  ''
                ),

                NULLIF(
                  BTRIM(
                    sewa_produk.sub_jenis_proyek
                  ),
                  ''
                ),

                'Sewa'
              ) AS deskripsi,

              sewa_order.tanggal_do::date
                AS tanggal_mulai,

              sewa_order.end_date::date
                AS tanggal_akhir,

              CASE
                WHEN
                  sewa_order.end_date::date <
                  tanggal_acuan.hari_ini
                THEN 'Berakhir'

                ELSE 'Aktif'
              END::text AS status,

              /* Nama proyek pada listing = Nomor PR */
              COALESCE(
                NULLIF(
                  BTRIM(
                    proyek_sewa.nomor_pr
                  ),
                  ''
                ),
                'Tanpa Nomor PR'
              ) AS nama_proyek,

              'Sewa'::text
                AS jenis_proyek,

              COALESCE(
                NULLIF(
                  BTRIM(
                    sewa_produk.sub_jenis_proyek
                  ),
                  ''
                ),

                NULLIF(
                  BTRIM(
                    proyek.sub_jenis_proyek
                  ),
                  ''
                ),

                'Sewa'
              ) AS sub_jenis_proyek,

              proyek.status_final,

              proyek_sewa.nomor_pr,
              sewa_order.no_do,
              master_produk.item_produk,
              master_cabang.nama_cabang,
              sewa_order.quantity,
              sewa_order.no_req_klien,

              /* Kategori = proyek yang dipilih */
              CASE
                WHEN
                  NULLIF(
                    BTRIM(
                      COALESCE(
                        proyek.nama_proyek,
                        ''
                      )
                    ),
                    ''
                  ) IS NULL
                THEN '[]'::jsonb

                ELSE JSONB_BUILD_ARRAY(
                  BTRIM(
                    proyek.nama_proyek
                  )
                )
              END AS kategori,

              (
                LOWER(
                  BTRIM(
                    COALESCE(
                      proyek.status_final,
                      ''
                    )
                  )
                ) = 'aktif'
              ) AS masuk_contract_overview

            FROM public.proyek_sewa_order sewa_order

            INNER JOIN public.proyek_sewa_produk sewa_produk
              ON sewa_produk.id =
                 sewa_order.proyek_sewa_produk_id

            INNER JOIN public.proyek_sewa proyek_sewa
              ON proyek_sewa.id =
                 sewa_produk.proyek_sewa_id

            INNER JOIN public.proyek proyek
              ON proyek.id =
                 proyek_sewa.proyek_id

            LEFT JOIN public.master_produk_sewa master_produk
              ON master_produk.id =
                 sewa_produk.produk_id

            LEFT JOIN public.master_cabang master_cabang
              ON master_cabang.id =
                 sewa_order.cabang_id

            CROSS JOIN tanggal_acuan

            WHERE
              sewa_order.tanggal_do IS NOT NULL

              AND sewa_order.end_date IS NOT NULL

              AND (
                $7::boolean = TRUE

                OR EXISTS (
                  SELECT 1

                  FROM public.proyek_pic akses_pic

                  WHERE
                    akses_pic.proyek_id =
                      proyek.id

                    AND akses_pic.pic_id =
                      $8
                )
              )
          )

          SELECT
            timeline.id,
            timeline.timeline_key,
            timeline.sumber_timeline,
            timeline.dapat_diubah,
            timeline.versi,

            timeline.proyek_id,
            timeline.proyek_sewa_id,
            timeline.proyek_sewa_produk_id,

            timeline.deskripsi,
            TO_CHAR(timeline.tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai,
            TO_CHAR(timeline.tanggal_akhir, 'YYYY-MM-DD') AS tanggal_akhir,
            timeline.status,

            timeline.nama_proyek,
            timeline.jenis_proyek,
            timeline.sub_jenis_proyek,
            timeline.status_final,

            timeline.nomor_pr,
            timeline.no_do,
            timeline.item_produk,
            timeline.nama_cabang,
            timeline.quantity,
            timeline.no_req_klien,
            timeline.kategori,

            (
              timeline.tanggal_akhir -
              tanggal_acuan.hari_ini
            )::integer AS sisa_hari,

            CASE
              WHEN
                timeline.tanggal_akhir <
                tanggal_acuan.hari_ini
              THEN 'expired'

              WHEN
                timeline.tanggal_akhir =
                tanggal_acuan.hari_ini
              THEN 'hari-ini'

              ELSE 'aktif'
            END AS status_periode,

            COUNT(*) OVER()
              AS total_data

          FROM timeline_dasar timeline

          CROSS JOIN tanggal_acuan

          WHERE
            (
              $1 = ''

              OR timeline.deskripsi
                 ILIKE '%' || $1 || '%'

              OR timeline.nama_proyek
                 ILIKE '%' || $1 || '%'

              OR COALESCE(
                timeline.nomor_pr,
                ''
              ) ILIKE '%' || $1 || '%'

              OR COALESCE(
                timeline.no_do,
                ''
              ) ILIKE '%' || $1 || '%'

              OR COALESCE(
                timeline.item_produk,
                ''
              ) ILIKE '%' || $1 || '%'

              OR COALESCE(
                timeline.nama_cabang,
                ''
              ) ILIKE '%' || $1 || '%'
            )

            AND ($10::boolean = FALSE OR timeline.proyek_id IS NULL)

            /* Filter jenis diterapkan sebelum hitung total dan pagination. */
            AND (
              $9 = ''
              OR LOWER(BTRIM(COALESCE(timeline.jenis_proyek, ''))) = LOWER($9)
            )

            /* Filter kartu Contract Overview */
            AND (
              $6::boolean = FALSE

              OR timeline.masuk_contract_overview = TRUE
            )

            /* Filter periode */
            AND (
              (
                $2::integer IS NULL
                AND $5 = ''
              )

              OR

              (
                $2::integer IS NOT NULL
                AND $5 = ''

                AND timeline.tanggal_akhir >=
                    tanggal_acuan.hari_ini

                AND timeline.tanggal_akhir <=
                    (
                      tanggal_acuan.hari_ini +
                      (
                        $2::text ||
                        ' months'
                      )::interval
                    )::date
              )

              OR

              (
                $5 = 'expired'

                AND timeline.tanggal_akhir <
                    tanggal_acuan.hari_ini
              )
            )

          ORDER BY
            timeline.tanggal_akhir ASC
              NULLS LAST,

            timeline.nama_proyek ASC,
            timeline.sumber_timeline ASC,
            timeline.id ASC

          LIMIT $3
          OFFSET $4
          `;
}

const TIMELINE_SQL = buatQueryTimeline(true);
const TIMELINE_LEGACY_SQL = buatQueryTimeline(false);

function kolomUploadTimelineBelumAda(error) {
  return error?.code === "42703" &&
    /\b(timeline_version|jenis_proyek_upload|imported_by|imported_at|import_fingerprint)\b/i
      .test(error.column || error.message || "");
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

async function listTimeline(pool, query, user, { all = false } = {}) {
  for (const key of ["search", "jenis_proyek", "bulan", "status", "mode", "page", "limit", "unassigned"]) {
    if (query[key] !== undefined && typeof query[key] !== "string") {
      throw badRequest(`Parameter ${key} tidak valid.`);
    }
  }
  const page = all ? 1 : Math.max(Number(query.page) || 1, 1);
  const limit = all ? 10001 : Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || !Number.isSafeInteger((page - 1) * limit)) {
    throw badRequest("Halaman tidak valid.");
  }
  const search = String(query.search || "").trim();
  const jenis = String(query.jenis_proyek || "").trim();
  const bulan = [1, 3, 6].includes(Number(query.bulan)) ? Number(query.bulan) : null;
  const status = String(query.status || "").trim().toLowerCase() === "expired" ? "expired" : "";
  const mode = String(query.mode || "").trim().toLowerCase();
  const unassigned = query.unassigned === "1";
  const params = [
    search, bulan, limit, (page - 1) * limit, status,
    mode === "contract-overview", user.isAdmin, user.id, jenis, unassigned
  ];
  let result;
  let uploadTersedia = true;
  try {
    result = await pool.query(TIMELINE_SQL, params);
  } catch (error) {
    if (!kolomUploadTimelineBelumAda(error)) throw error;

    // Database lama tetap dapat membaca timeline dengan aturan akses proyek yang sama.
    uploadTersedia = false;
    result = await pool.query(TIMELINE_LEGACY_SQL, params);
  }

  const total = Number(result.rows[0]?.total_data || 0);
  if (all && total > 10000) {
    throw Object.assign(new Error("Maksimal 10000 data per unduhan. Persempit filter lalu unduh kembali."), { status: 422 });
  }
  return {
    data: result.rows.map(({ total_data, ...item }) => item),
    capabilities: { upload: uploadTersedia },
    pagination: { page, limit, total_data: total, total_pages: Math.max(Math.ceil(total / limit), 1) },
    filter: { search, bulan, status, mode, jenis_proyek: jenis, unassigned }
  };
}

module.exports = { listTimeline, TIMELINE_SQL, kolomUploadTimelineBelumAda };
