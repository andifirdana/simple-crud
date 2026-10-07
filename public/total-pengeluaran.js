// =====================================================
// TOTAL PENGELUARAN BERDASARKAN JENIS PROYEK
// =====================================================
app.get("/api/total-pengeluaran", async (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({
      error: "Belum login"
    });
  }

  const tahun = req.query.tahun === undefined
    ? new Date().getFullYear()
    : Number(req.query.tahun);

  if (
    !Number.isInteger(tahun) ||
    tahun < 1 ||
    tahun > 9998
  ) {
    return res.status(400).json({
      error: "Tahun tidak valid"
    });
  }

  const user = req.session.user;

  const isAdmin = String(user.role || "")
    .trim()
    .toLowerCase() === "admin";

  const picId = isAdmin
    ? null
    : Number(user.id);

  if (
    !isAdmin &&
    (!Number.isSafeInteger(picId) || picId <= 0)
  ) {
    return res.status(403).json({
      error: "PIC pengguna tidak valid"
    });
  }

  try {
    const { rows } = await pool.query(
      `
      WITH pembayaran_sewa AS (
        SELECT
          CASE
            WHEN LOWER(
              TRIM(COALESCE(p.jenis_proyek, ''))
            ) LIKE '%transaksi%'
              THEN 'transaksi'

            WHEN LOWER(
              TRIM(COALESCE(p.jenis_proyek, ''))
            ) LIKE '%sewa%'
              THEN 'sewa'

            ELSE 'reguler'
          END AS jenis,

          bayar.tanggal_bayar::date AS tanggal,

          COALESCE(
            bayar.nominal,
            0
          )::numeric AS nilai

        FROM public.proyek_sewa_pembayaran_partner bayar

        JOIN public.proyek_sewa sewa
          ON sewa.id = bayar.proyek_sewa_id

        JOIN public.proyek p
          ON p.id = sewa.proyek_id

        WHERE LOWER(
          TRIM(
            REGEXP_REPLACE(
              COALESCE(bayar.status_pembayaran, ''),
              '[[:space:]]+',
              ' ',
              'g'
            )
          )
        ) IN (
          'dibayar',
          'sudah dibayar',
          'lunas',
          'paid'
        )

        AND bayar.tanggal_bayar >=
          MAKE_DATE($1::int, 1, 1)

        AND bayar.tanggal_bayar <
          MAKE_DATE($1::int + 1, 1, 1)

        AND (
          $2::boolean = TRUE

          OR EXISTS (
            SELECT 1
            FROM public.proyek_pic akses

            WHERE akses.proyek_id = sewa.proyek_id
              AND akses.pic_id = $3
          )
        )
      ),

      pembayaran_termin AS (
        SELECT
          CASE
            WHEN LOWER(
              TRIM(COALESCE(p.jenis_proyek, ''))
            ) LIKE '%transaksi%'
              THEN 'transaksi'

            WHEN LOWER(
              TRIM(COALESCE(p.jenis_proyek, ''))
            ) LIKE '%sewa%'
              THEN 'sewa'

            ELSE 'reguler'
          END AS jenis,

          termin.tanggal_bayar::date AS tanggal,

          COALESCE(
            NULLIF(termin.nominal, 0),

            COALESCE(
              NULLIF(partner.nilai_nego_3, 0),
              NULLIF(partner.nilai_nego_2, 0),
              NULLIF(partner.nilai_nego_1, 0),
              NULLIF(partner.nilai_submit, 0),
              0
            )
            * COALESCE(termin.persentase, 0)
            / 100.0,

            0
          )::numeric AS nilai

        FROM public.proyek_partner_termin termin

        JOIN public.proyek_partner partner
          ON partner.id = termin.proyek_partner_id

        JOIN public.proyek p
          ON p.id = partner.proyek_id

        WHERE LOWER(
          TRIM(
            REGEXP_REPLACE(
              COALESCE(termin.status_pembayaran, ''),
              '[[:space:]]+',
              ' ',
              'g'
            )
          )
        ) IN (
          'dibayar',
          'sudah dibayar',
          'lunas',
          'paid'
        )

        AND termin.tanggal_bayar >=
          MAKE_DATE($1::int, 1, 1)

        AND termin.tanggal_bayar <
          MAKE_DATE($1::int + 1, 1, 1)

        AND (
          $2::boolean = TRUE

          OR EXISTS (
            SELECT 1
            FROM public.proyek_pic akses

            WHERE akses.proyek_id = partner.proyek_id
              AND akses.pic_id = $3
          )
        )
      ),

      pembayaran AS (
        SELECT * FROM pembayaran_sewa

        UNION ALL

        SELECT * FROM pembayaran_termin
      ),

      rekap AS (
        SELECT
          bulan.nomor AS bulan,

          COALESCE(
            SUM(bayar.nilai) FILTER (
              WHERE bayar.jenis = 'reguler'
            ),
            0
          )::numeric AS reguler,

          COALESCE(
            SUM(bayar.nilai) FILTER (
              WHERE bayar.jenis = 'sewa'
            ),
            0
          )::numeric AS sewa,

          COALESCE(
            SUM(bayar.nilai) FILTER (
              WHERE bayar.jenis = 'transaksi'
            ),
            0
          )::numeric AS transaksi,

          COALESCE(
            SUM(bayar.nilai),
            0
          )::numeric AS total,

          COUNT(
            bayar.jenis
          )::int AS jumlah_pembayaran

        FROM GENERATE_SERIES(1, 12) AS bulan(nomor)

        LEFT JOIN pembayaran bayar
          ON EXTRACT(
            MONTH FROM bayar.tanggal
          )::int = bulan.nomor

        GROUP BY bulan.nomor
      )

      SELECT
        *,

        SUM(reguler) OVER () AS total_reguler,

        SUM(sewa) OVER () AS total_sewa,

        SUM(transaksi) OVER () AS total_transaksi,

        SUM(total) OVER () AS total_pengeluaran,

        SUM(jumlah_pembayaran) OVER ()
          AS jumlah_pembayaran_tahun

      FROM rekap

      ORDER BY bulan
      `,
      [tahun, isAdmin, picId]
    );

    const ringkasan = rows[0] || {};

    return res.json({
      tahun,

      dasar_tanggal: "tanggal_bayar",

      status_pembayaran: [
        "Dibayar",
        "Sudah Dibayar",
        "Lunas",
        "Paid"
      ],

      ringkasan: {
        reguler: String(
          ringkasan.total_reguler ?? "0"
        ),

        sewa: String(
          ringkasan.total_sewa ?? "0"
        ),

        transaksi: String(
          ringkasan.total_transaksi ?? "0"
        ),

        total: String(
          ringkasan.total_pengeluaran ?? "0"
        ),

        jumlah_pembayaran: Number(
          ringkasan.jumlah_pembayaran_tahun || 0
        )
      },

      bulanan: rows.map(row => ({
        bulan: Number(row.bulan),

        reguler: String(row.reguler),

        sewa: String(row.sewa),

        transaksi: String(row.transaksi),

        total: String(row.total),

        jumlah_pembayaran: Number(
          row.jumlah_pembayaran
        )
      }))
    });

  } catch (error) {
    console.error(
      "ERROR TOTAL PENGELUARAN:",
      error
    );

    return res.status(500).json({
      error:
        "Gagal mengambil total pengeluaran. Periksa log server."
    });
  }
});