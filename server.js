
const path = require("path");
const pool = require("./db");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");
const {
  simpanActivityLog
} = require("./activity-log");

const {
  S3Client,
  DeleteObjectCommand
} = require("@aws-sdk/client-s3");

require("dotenv").config();

const {
  client: s3Client,
  uploadFile,
  getImageLinkPresigned,
  getFileLink
} = require("./s3-service");

const app = express();

// ======================================================
// LOGIN
// ======================================================

app.use(express.json());

// SESSION LOGIN

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "projectflow-secret-key",

    resave: false,

    saveUninitialized: false,

    cookie: {
      httpOnly: true,

      secure: false,

      sameSite: "lax",

      maxAge:
        1000 *
        60 *
        60 *
        8
    }
  })
);

console.log(
  'API Master Produk Sewa terdaftar'
);

app.post("/api/login",
  async (req, res) => {

    try {

      const {
        email,
        password
      } = req.body;


      if (!email || !password) {

        return res.status(400).json({
          error:
            "Email dan password wajib diisi"
        });

      }


      const result =
        await pool.query(
          `
          SELECT
            id,
            nama,
            email,
            jabatan,
            role,
            password_hash,
            is_active

          FROM public.pic

          WHERE LOWER(email) =
                LOWER($1)

          LIMIT 1
          `,
          [
            email.trim()
          ]
        );


      if (
        result.rows.length === 0
      ) {

        return res.status(401).json({
          error:
            "Email atau password salah"
        });

      }


      const user =
        result.rows[0];


      if (
        user.is_active === false
      ) {

        return res.status(403).json({
          error:
            "Akun tidak aktif"
        });

      }


      if (!user.password_hash) {

        return res.status(401).json({
          error:
            "Akun belum memiliki password"
        });

      }


      const passwordBenar =
        await bcrypt.compare(
          password,
          user.password_hash
        );


      if (!passwordBenar) {

        return res.status(401).json({
          error:
            "Email atau password salah"
        });

      }

      // BUAT SESSION
      req.session.user = {

        id:
          user.id,

        nama:
          user.nama,

        email:
          user.email,

        jabatan:
          user.jabatan,

        role:
          user.role || "PIC"

      };

      // SIMPAN SESSION SEBELUM RESPONSE

      req.session.save(
        error => {

          if (error) {

            console.error(
              "ERROR SAVE SESSION:",
              error
            );


            return res.status(500).json({
              error:
                "Gagal membuat session"
            });

          }


          console.log(
            "LOGIN BERHASIL:",
            req.session.user
          );


          res.json({

            success: true,

            message:
              "Login berhasil",

            redirect:
              "/dashboard.html",

            user:
              req.session.user

          });

        }
      );


    } catch (error) {

      console.error(
        "ERROR LOGIN:",
        error
      );


      res.status(500).json({
        error:
          error.message
      });

    }

  }
);

app.get("/api/me",
  (req, res) => {

    console.log(
      "SESSION /ME:",
      req.session
    );


    if (
      !req.session ||
      !req.session.user
    ) {

      return res.status(401).json({
        error:
          "Belum login"
      });

    }


    res.json({

      loggedIn: true,

      user:
        req.session.user

    });

  }
);

// LOGOUT

app.post("/api/logout",
  (req, res) => {

    if (!req.session) {

      return res.json({
        success: true
      });

    }

    req.session.destroy(
      error => {

        if (error) {

          console.error(
            "ERROR LOGOUT:",
            error
          );

          return res.status(500).json({
            error: "Gagal logout"
          });

        }

        res.clearCookie("connect.sid");

        res.json({
          success: true,
          message: "Logout berhasil"
        });

      }
    );

  }
);


// =====================================================
// PIC PENGGUNA YANG SEDANG LOGIN
// =====================================================

app.get(
  "/api/proyek/pic-saya",
  async (req, res) => {
    try {

      if (!req.session?.user) {
        return res.status(401).json({
          error: "Belum login"
        });
      }

      const user =
        req.session.user;

      /*
       * Jika session sudah memiliki pic_id,
       * gunakan pic_id.
       *
       * Jika tidak, gunakan user.id karena pada
       * aplikasi ini user.id digunakan sebagai PIC ID.
       */

      const picId =
        Number(
          user.pic_id ||
          user.id
        );

      if (
        !Number.isInteger(picId) ||
        picId <= 0
      ) {
        return res.status(400).json({
          error:
            "PIC pengguna login tidak valid"
        });
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            nama,
            nik,
            jabatan,
            email,
            no_hp

          FROM public.pic

          WHERE id = $1

          LIMIT 1
          `,
          [picId]
        );

      /*
       * Admin mungkin tidak terdaftar sebagai PIC.
       * Karena itu response tetap 200 dengan pic null.
       */

      if (result.rowCount === 0) {
        return res.json({
          pic: null
        });
      }

      return res.json({
        pic:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        "ERROR GET PIC LOGIN:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);
// ======================================================
// MIDDLEWARE LOGIN
// ======================================================

function wajibLogin(
  req,
  res,
  next
) {
  if (
    !req.session ||
    !req.session.user
  ) {
    return res.status(401).json({
      error:
        "Silakan login terlebih dahulu"
    });
  }

  next();
}


// =====================================================
// TENTUKAN CAKUPAN AKSES TASK LIST
//
// KABAG / KADIV : LIHAT SEMUA
// SELAIN ITU    : HANYA PROYEK MILIKNYA
// =====================================================

async function setTaskListAccess(
  req,
  res,
  next
) {
  try {

    // ================================================
    // VALIDASI LOGIN
    // ================================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    const user =
      req.session.user;

    const picId =
      Number(
        user.pic_id ||
        user.id
      );

    if (
      !Number.isInteger(picId) ||
      picId <= 0
    ) {
      return res.status(403).json({
        error:
          "Data PIC pengguna tidak valid"
      });
    }

    // ================================================
    // AMBIL JABATAN DARI DATABASE
    // ================================================

    const picResult =
      await pool.query(
        `
        SELECT
          id,
          nama,
          jabatan

        FROM public.pic

        WHERE id = $1

        LIMIT 1
        `,
        [picId]
      );

    if (
      picResult.rowCount === 0
    ) {
      return res.status(403).json({
        error:
          "Data PIC pengguna tidak ditemukan"
      });
    }

    const pic =
      picResult.rows[0];

    const jabatan =
      String(
        pic.jabatan || ""
      )
        .trim()
        .toLowerCase()
        .replace(
          /\s+/g,
          " "
        );

    // ================================================
    // KABAG DAN KADIV DAPAT MELIHAT SEMUA
    // ================================================

    const dapatMelihatSemua =
      jabatan === "kabag" ||
      jabatan.startsWith(
        "kabag "
      ) ||
      jabatan === "kadiv" ||
      jabatan.startsWith(
        "kadiv "
      ) ||
      jabatan ===
        "kepala bagian" ||
      jabatan.startsWith(
        "kepala bagian "
      ) ||
      jabatan ===
        "kepala divisi" ||
      jabatan.startsWith(
        "kepala divisi "
      );

    req.taskListAccess = {
      pic_id:
        Number(pic.id),

      nama:
        pic.nama,

      jabatan:
        pic.jabatan,

      dapat_melihat_semua:
        dapatMelihatSemua
    };

    next();

  } catch (error) {
    console.error(
      "ERROR SET TASK LIST ACCESS:",
      error
    );

    return res.status(500).json({
      error:
        "Gagal memeriksa hak akses Task List"
    });
  }
}

// ======================================================
// CEK ROLE ADMIN
// ======================================================

function userAdalahAdmin(user) {
  const role =
    String(
      user?.role || ""
    )
      .trim()
      .toLowerCase();

  return (
    role === "admin" ||
    role === "administrator"
  );
}

// ======================================================
// HELPER LOG EDIT KLIEN
// ======================================================
const BULAN_INDONESIA = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

function formatTeksLog(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "-";
  }

  return String(value).trim();
}

function formatRupiahLog(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const angka = Number(value);

  if (!Number.isFinite(angka)) {
    return formatTeksLog(value);
  }

  return `Rp ${new Intl.NumberFormat(
    "id-ID",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ).format(angka)}`;
}

function formatTanggalLog(value) {
  if (!value) {
    return "-";
  }

  let tahun;
  let bulan;
  let tanggal;

  if (value instanceof Date) {
    tahun = value.getUTCFullYear();
    bulan = value.getUTCMonth() + 1;
    tanggal = value.getUTCDate();
  } else {
    const cocok =
      String(value).match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );

    if (!cocok) {
      return formatTeksLog(value);
    }

    tahun = Number(cocok[1]);
    bulan = Number(cocok[2]);
    tanggal = Number(cocok[3]);
  }

  return `${tanggal} ${
    BULAN_INDONESIA[bulan - 1]
  } ${tahun}`;
}

function buatDetailLogKlien(data) {
  return [
    {
      label: "KLIEN",
      nilai: formatTeksLog(
        data.perusahaan_klien
      )
    },
    {
      label: "NILAI SUBMIT",
      nilai: formatRupiahLog(
        data.nilai_submit
      )
    },
    {
      label: "NILAI NEGO 1",
      nilai: formatRupiahLog(
        data.nilai_nego_1
      )
    },
    {
      label: "NILAI NEGO 2",
      nilai: formatRupiahLog(
        data.nilai_nego_2
      )
    },
    {
      label: "NILAI NEGO 3",
      nilai: formatRupiahLog(
        data.nilai_nego_3
      )
    },
    {
      label: "TANGGAL MULAI",
      nilai: formatTanggalLog(
        data.tanggal_mulai
      )
    },
    {
      label: "TANGGAL AKHIR",
      nilai: formatTanggalLog(
        data.tanggal_akhir
      )
    },
    {
      label: "MODEL PEMBAYARAN",
      nilai: formatTeksLog(
        data.model_pembayaran
      )
    },
    {
      label: "STATUS PENGADAAN",
      nilai: formatTeksLog(
        data.status_pengadaan
      )
    },
    {
      label: "STATUS TEKNIS",
      nilai: formatTeksLog(
        data.status_teknis
      )
    },
    {
      label: "STATUS ADMINISTRASI",
      nilai: formatTeksLog(
        data.status_administrasi
      )
    }
  ];
}

function gabungkanDetailLog(daftar) {
  return daftar
    .map(
      item =>
        `${item.label} = ${item.nilai}`
    )
    .join(", ");
}
// ======================================================
// VALIDASI AKSES PROYEK
//
// ADMIN:
// Dapat membuka seluruh proyek.
//
// PIC:
// Hanya dapat membuka proyek yang terdaftar
// pada tabel proyek_pic.
// ======================================================

async function validasiAksesProyek(
  req,
  res,
  next
) {
  try {
    const user =
      req.session?.user;

    if (!user) {
      return res.status(401).json({
        error:
          "Silakan login terlebih dahulu"
      });
    }


    // ID proyek dapat bernama :id
    // atau :proyekId

    const proyekId =
      Number(
        req.params.id ||
        req.params.proyekId
      );


    if (
      !Number.isInteger(proyekId) ||
      proyekId <= 0
    ) {
      return res.status(400).json({
        error:
          "ID proyek tidak valid"
      });
    }


    // Admin dapat mengakses seluruh proyek

    if (userAdalahAdmin(user)) {
      req.proyekId =
        proyekId;

      return next();
    }


    // Karena login dari tabel public.pic,
    // session user.id adalah PIC ID

    const picId =
      Number(user.id);


    if (
      !Number.isInteger(picId) ||
      picId <= 0
    ) {
      return res.status(403).json({
        error:
          "Data PIC pada session tidak valid"
      });
    }


    const aksesResult =
      await pool.query(
        `
        SELECT
          proyek_id,
          pic_id

        FROM public.proyek_pic

        WHERE
          proyek_id = $1

          AND pic_id = $2

        LIMIT 1
        `,
        [
          proyekId,
          picId
        ]
      );


    if (
      aksesResult.rowCount === 0
    ) {
      console.warn(
        "AKSES PROYEK DITOLAK:",
        {
          proyek_id:
            proyekId,

          pic_id:
            picId,

          nama:
            user.nama,

          role:
            user.role
        }
      );

      return res.status(403).json({
        error:
          "Anda tidak memiliki akses ke proyek ini"
      });
    }


    req.proyekId =
      proyekId;

    req.picId =
      picId;

    return next();

  } catch (error) {
    console.error(
      "ERROR VALIDASI AKSES PROYEK:",
      error
    );

    return res.status(500).json({
      error:
        "Gagal memeriksa akses proyek"
    });
  }
}
// ======================================================
// MENU
// ======================================================
app.get('/api/menu',
   wajibLogin, 
  async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        nama_menu,
        kode_menu,
        url,
        icon,
        group_menu,
        parent_id,
        urutan,
        status
      FROM master_menu
      WHERE status = 'Aktif'
      ORDER BY
        CASE
          WHEN group_menu = 'Overview' THEN 1
          WHEN group_menu = 'Master Data' THEN 2
          ELSE 99
        END,
        urutan,
        id
    `);

    res.json(result.rows);

  } catch (error) {
    console.error('Error mengambil menu:', error);

    res.status(500).json({
      message: 'Gagal mengambil data menu'
    });
  }
});

// ======================================================
// PROTEKSI DASHBOARD
// ======================================================

app.get( "/dashboard.html",
  (req, res, next) => {

    if (!req.session || !req.session.user) {

      return res.redirect(
        "/login.html"
      );

    }

    next();

  }
);

// ======================================================
// PROTEKSI HALAMAN PROYEK
// ======================================================

app.get(
[
    "/proyek.html",
    "/proyek-form.html",
    "/detail-proyek.html",
    "/index.html",
    "/kategori.html",
    "/partner.html",
    "/pic.html",
    "/task.html",
    "/pendapatan.html"
  ],
  (req, res, next) => {

    if (!req.session || !req.session.user) {

      return res.redirect(
        "/login.html"
      );

    }

    next();

  }
);

// ======================================================
// STATIC FILE
// ======================================================
app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

// ======================================================
// UPLOAD DOKUMEN KLIEN
// ======================================================

// ======================================================
// KONFIGURASI UPLOAD DOKUMEN KE S3
// ======================================================

const tipeDokumenDiizinkan = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png"
];

const uploadDokumenKlien = multer({

  // File disimpan sementara di memory
  storage: multer.memoryStorage(),

  // Maksimal 10 MB
  limits: {
    fileSize: 10 * 1024 * 1024
  },

  fileFilter: (
    req,
    file,
    callback
  ) => {

    if (
      !tipeDokumenDiizinkan.includes(
        file.mimetype
      )
    ) {

      return callback(
        new Error(
          "Format file tidak didukung. Gunakan PDF, Word, Excel, JPG, atau PNG."
        )
      );

    }

    callback(null, true);

  }

});

app.use(
  "/uploads",
  express.static(
    path.join(
      __dirname,
      "uploads"
    )
  )
);

// ======================================================
// DASHBOARD
// ======================================================

app.get("/dashboard.html",
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "dashboard.html"
      )
    );

  }
);

// ======================================================
// ROOT
// ======================================================

app.get("/",
  (req, res) => {

    if (req.session.user) {

      return res.redirect(
        "/dashboard.html"
      );

    }

    return res.redirect(
      "/login.html"
    );

  }
);

// ======================================================
// AUTH MIDDLEWARE
// ======================================================

function requireLogin(req, res, next) {

  if (!req.session || !req.session.user) {

    return res.status(401).json({
      error: "Belum login"
    });

  }

  next();
}
// ======================================================
// HELPER: AMBIL NILAI FINAL ASLI KLIEN
// ======================================================

async function getNilaiFinalAsliKlien(
  client,
  proyekKlienId
) {
  const result =
    await client.query(
      `
      SELECT
        COALESCE(
          NULLIF(nilai_nego_3, 0),
          NULLIF(nilai_nego_2, 0),
          NULLIF(nilai_nego_1, 0),
          NULLIF(nilai_submit, 0),
          0
        ) AS nilai_final

      FROM public.proyek_klien

      WHERE id = $1

      LIMIT 1
      `,
      [proyekKlienId]
    );

  if (result.rowCount === 0) {
    return null;
  }

  return Number(
    result.rows[0].nilai_final ||
    0
  );
}

// ======================================================
// HELPER: HITUNG ULANG PRESENTASE KIEN
// ======================================================
async function hitungUlangPersentaseKlien(
  client,
  proyekKlienId
) {
  const proyekResult =
    await client.query(
      `
      SELECT
        COALESCE(
          NULLIF(nilai_nego_3, 0),
          NULLIF(nilai_nego_2, 0),
          NULLIF(nilai_nego_1, 0),
          NULLIF(nilai_submit, 0),
          0
        )::numeric AS nilai_final
      FROM public.proyek_klien
      WHERE id = $1
      `,
      [proyekKlienId]
    );

  if (
    proyekResult.rows.length === 0
  ) {
    throw new Error(
      "Data proyek klien tidak ditemukan"
    );
  }

  const nilaiFinalAsli =
    Number(
      proyekResult.rows[0]
        .nilai_final || 0
    );

  // ================================================
  // ADA NILAI FINAL ASLI
  // ================================================

  if (nilaiFinalAsli > 0) {
    await client.query(
      `
      UPDATE public.proyek_klien_termin
      SET
        persentase =
          (nominal / $1::numeric) * 100
      WHERE proyek_klien_id = $2
        AND nominal IS NOT NULL
        AND nominal > 0
      `,
      [
        nilaiFinalAsli,
        proyekKlienId
      ]
    );

    return {
      nilai_final:
        nilaiFinalAsli,

      sumber:
        "nilai_proyek"
    };
  }

  // ================================================
  // NILAI FINAL BERDASARKAN TOTAL NOMINAL TERMIN
  // ================================================

  const totalResult =
    await client.query(
      `
      SELECT
        COALESCE(
          SUM(nominal),
          0
        )::numeric AS total_nominal
      FROM public.proyek_klien_termin
      WHERE proyek_klien_id = $1
        AND nominal IS NOT NULL
        AND nominal > 0
      `,
      [proyekKlienId]
    );

  const totalNominal =
    Number(
      totalResult.rows[0]
        .total_nominal || 0
    );

  if (totalNominal > 0) {
    await client.query(
      `
      UPDATE public.proyek_klien_termin
      SET
        persentase =
          (nominal / $1::numeric) * 100
      WHERE proyek_klien_id = $2
        AND nominal IS NOT NULL
        AND nominal > 0
      `,
      [
        totalNominal,
        proyekKlienId
      ]
    );
  }

  return {
    nilai_final:
      totalNominal,

    sumber:
      "total_termin"
  };
}

// =====================================================
// GET USER UNTUK ACTIVITY LOG
// =====================================================

function getActivityUser(req) {

  const user =
    req.session?.user;


  if (!user) {

    return {
      pic_id: null,
      nama_pic: "Unknown User"
    };

  }


  return {

    pic_id:
      Number(user.id) ||
      null,

    nama_pic:
      user.nama ||
      "Unknown User"

  };

}
// ======================================================
// MASTER DATA KLIEN
// ======================================================

// READ KLIEN
app.get("/api/data", 
  async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM public.data ORDER BY id DESC"
    );

    res.json(result.rows);

  } catch (error) {
    console.error("ERROR READ KLIEN:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// CREATE KLIEN
app.post("/api/data", 
  async (req, res) => {
  try {
    const {
      perusahaan_klien,
      inisial,
      nama_pic,
      no_pic,
      email_pic
    } = req.body;

    const result = await pool.query(
      `INSERT INTO public.data (
        perusahaan_klien,
        inisial,
        nama_pic,
        no_pic,
        email_pic
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        perusahaan_klien,
        inisial,
        nama_pic,
        no_pic,
        email_pic
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("ERROR CREATE KLIEN:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// UPDATE KLIEN
app.put("/api/data/:id", 
  async (req, res) => {
  try {
    const { id } = req.params;

    const {
      perusahaan_klien,
      inisial,
      nama_pic,
      no_pic,
      email_pic
    } = req.body;

    const result = await pool.query(
      `UPDATE public.data
       SET perusahaan_klien = $1,
           inisial = $2,
           nama_pic = $3,
           no_pic = $4,
           email_pic = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        perusahaan_klien,
        inisial,
        nama_pic,
        no_pic,
        email_pic,
        id
      ]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error("ERROR UPDATE KLIEN:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// DELETE KLIEN
app.delete("/api/data/:id", 
  async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM public.data
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({
      message: "Data berhasil dihapus"
    });

  } catch (error) {
    console.error("ERROR DELETE KLIEN:", error);

    res.status(500).json({
      error: error.message
    });
  }
});


// ======================================================
// MASTER DATA PARTNER
// ======================================================

// READ PARTNER
app.get("/api/partner", 
  async (req, res) => {
  try {

    const result = await pool.query(
      `SELECT *
       FROM partner
       ORDER BY id DESC`
    );


    res.json(result.rows);


  } catch (error) {

    console.error(
      "ERROR READ PARTNER:",
      error
    );


    res.status(500).json({
      error: error.message
    });

  }
});

// CREATE PARTNER
app.post(
  "/api/partner",
  async (req, res) => {
    const client =
      await pool.connect();

    let transaksiDimulai =
      false;

    try {
      const {
        nama_partner,
        inisial,
        jenis_partner,
        nama_pic,
        no_pic,
        email_pic,
        alamat,
        status
      } = req.body;


      // ================================================
      // VALIDASI
      // ================================================

      if (
        !nama_partner ||
        !String(
          nama_partner
        ).trim()
      ) {
        return res.status(400).json({
          error:
            "Nama Partner wajib diisi"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // SIMPAN PARTNER
      // ================================================

      const result =
        await client.query(
          `
            INSERT INTO partner (
              nama_partner,
              inisial,
              jenis_partner,
              nama_pic,
              no_pic,
              email_pic,
              alamat,
              status
            )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8
            )

            RETURNING *
          `,
          [
            String(
              nama_partner
            ).trim(),

            String(
              inisial || ""
            ).trim() || null,

            String(
              jenis_partner || ""
            ).trim() || null,

            String(
              nama_pic || ""
            ).trim() || null,

            String(
              no_pic || ""
            ).trim() || null,

            String(
              email_pic || ""
            ).trim() || null,

            String(
              alamat || ""
            ).trim() || null,

            String(
              status || "Aktif"
            ).trim()
          ]
        );


      const partnerBaru =
        result.rows[0];


      // ================================================
      // FORMAT NILAI LOG
      // ================================================

      const formatNilaiPartner =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const nilaiBaruLog = [
        `NAMA PARTNER = ${
          formatNilaiPartner(
            partnerBaru.nama_partner
          )
        }`,

        `INISIAL = ${
          formatNilaiPartner(
            partnerBaru.inisial
          )
        }`,

        `JENIS PARTNER = ${
          formatNilaiPartner(
            partnerBaru.jenis_partner
          )
        }`,

        `NAMA PIC = ${
          formatNilaiPartner(
            partnerBaru.nama_pic
          )
        }`,

        `NO. PIC = ${
          formatNilaiPartner(
            partnerBaru.no_pic
          )
        }`,

        `EMAIL PIC = ${
          formatNilaiPartner(
            partnerBaru.email_pic
          )
        }`,

        `ALAMAT = ${
          formatNilaiPartner(
            partnerBaru.alamat
          )
        }`,

        `STATUS = ${
          formatNilaiPartner(
            partnerBaru.status
          )
        }`
      ].join(", ");


      // ================================================
      // SIMPAN ACTIVITY LOG
      // CREATE HANYA NILAI BARU
      // ================================================

      await simpanActivityLog(
        client,
        {
          ...getActivityUser(req),

          aktivitas: "CREATE",

          modul:
            "MASTER PARTNER",

          // Master partner memakai ID partner
          entity_id:
            partnerBaru.id,

          entity_nama:
            partnerBaru.nama_partner,

          field_name:
            "DATA PARTNER",

          nilai_lama: null,

          nilai_baru:
            nilaiBaruLog,

          deskripsi:
            "menambahkan master partner"
        }
      );


      // ================================================
      // COMMIT
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;


      return res
        .status(201)
        .json(partnerBaru);

    } catch (error) {
      if (transaksiDimulai) {
        try {
          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK CREATE PARTNER:",
            rollbackError
          );
        }
      }


      console.error(
        "ERROR CREATE PARTNER:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);

// UPDATE PARTNER
app.put(
  "/api/partner/:id",
  async (req, res) => {
    const client =
      await pool.connect();

    let transaksiDimulai =
      false;

    try {
      const id =
        Number(req.params.id);


      const {
        nama_partner,
        inisial,
        jenis_partner,
        nama_pic,
        no_pic,
        email_pic,
        alamat,
        status
      } = req.body;


      // ================================================
      // VALIDASI
      // ================================================

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID partner tidak valid"
        });
      }


      if (
        !nama_partner ||
        !String(
          nama_partner
        ).trim()
      ) {
        return res.status(400).json({
          error:
            "Nama Partner wajib diisi"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // AMBIL DATA PARTNER LAMA
      // ================================================

      const oldResult =
        await client.query(
          `
            SELECT
              id,
              nama_partner,
              inisial,
              jenis_partner,
              nama_pic,
              no_pic,
              email_pic,
              alamat,
              status

            FROM partner

            WHERE id = $1

            FOR UPDATE
          `,
          [id]
        );


      if (
        oldResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Data partner tidak ditemukan"
        });
      }


      const partnerLama =
        oldResult.rows[0];


      // ================================================
      // UPDATE PARTNER
      // ================================================

      const result =
        await client.query(
          `
            UPDATE partner

            SET
              nama_partner = $1,
              inisial = $2,
              jenis_partner = $3,
              nama_pic = $4,
              no_pic = $5,
              email_pic = $6,
              alamat = $7,
              status = $8,
              updated_at =
                CURRENT_TIMESTAMP

            WHERE id = $9

            RETURNING *
          `,
          [
            String(
              nama_partner
            ).trim(),

            String(
              inisial || ""
            ).trim() || null,

            String(
              jenis_partner || ""
            ).trim() || null,

            String(
              nama_pic || ""
            ).trim() || null,

            String(
              no_pic || ""
            ).trim() || null,

            String(
              email_pic || ""
            ).trim() || null,

            String(
              alamat || ""
            ).trim() || null,

            String(
              status || "Aktif"
            ).trim(),

            id
          ]
        );


      const partnerBaru =
        result.rows[0];


      // ================================================
      // FORMAT NILAI LOG
      // ================================================

      const formatNilaiPartner =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const detailPartnerLama = [
        {
          label:
            "NAMA PARTNER",

          nilai:
            formatNilaiPartner(
              partnerLama.nama_partner
            )
        },
        {
          label:
            "INISIAL",

          nilai:
            formatNilaiPartner(
              partnerLama.inisial
            )
        },
        {
          label:
            "JENIS PARTNER",

          nilai:
            formatNilaiPartner(
              partnerLama.jenis_partner
            )
        },
        {
          label:
            "NAMA PIC",

          nilai:
            formatNilaiPartner(
              partnerLama.nama_pic
            )
        },
        {
          label:
            "NO. PIC",

          nilai:
            formatNilaiPartner(
              partnerLama.no_pic
            )
        },
        {
          label:
            "EMAIL PIC",

          nilai:
            formatNilaiPartner(
              partnerLama.email_pic
            )
        },
        {
          label:
            "ALAMAT",

          nilai:
            formatNilaiPartner(
              partnerLama.alamat
            )
        },
        {
          label:
            "STATUS",

          nilai:
            formatNilaiPartner(
              partnerLama.status
            )
        }
      ];


      const detailPartnerBaru = [
        {
          label:
            "NAMA PARTNER",

          nilai:
            formatNilaiPartner(
              partnerBaru.nama_partner
            )
        },
        {
          label:
            "INISIAL",

          nilai:
            formatNilaiPartner(
              partnerBaru.inisial
            )
        },
        {
          label:
            "JENIS PARTNER",

          nilai:
            formatNilaiPartner(
              partnerBaru.jenis_partner
            )
        },
        {
          label:
            "NAMA PIC",

          nilai:
            formatNilaiPartner(
              partnerBaru.nama_pic
            )
        },
        {
          label:
            "NO. PIC",

          nilai:
            formatNilaiPartner(
              partnerBaru.no_pic
            )
        },
        {
          label:
            "EMAIL PIC",

          nilai:
            formatNilaiPartner(
              partnerBaru.email_pic
            )
        },
        {
          label:
            "ALAMAT",

          nilai:
            formatNilaiPartner(
              partnerBaru.alamat
            )
        },
        {
          label:
            "STATUS",

          nilai:
            formatNilaiPartner(
              partnerBaru.status
            )
        }
      ];


      // ================================================
      // HANYA AMBIL FIELD YANG BERUBAH
      // ================================================

      const perubahanPartner =
        detailPartnerBaru
          .map(
            (
              itemBaru,
              index
            ) => ({
              label:
                itemBaru.label,

              nilai_lama:
                detailPartnerLama[index]
                  .nilai,

              nilai_baru:
                itemBaru.nilai
            })
          )
          .filter(
            item =>
              item.nilai_lama !==
              item.nilai_baru
          );


      // ================================================
      // SIMPAN SATU ACTIVITY LOG
      // ================================================

      if (
        perubahanPartner.length > 0
      ) {
        await simpanActivityLog(
          client,
          {
            ...getActivityUser(req),

            aktivitas: "UPDATE",

            modul:
              "MASTER PARTNER",

            // Master partner menggunakan ID partner
            entity_id:
              partnerBaru.id,

            entity_nama:
              partnerBaru.nama_partner,

            field_name:
              "DATA PARTNER",

            nilai_lama:
              perubahanPartner
                .map(
                  item =>
                    `${item.label} = ${item.nilai_lama}`
                )
                .join(", "),

            nilai_baru:
              perubahanPartner
                .map(
                  item =>
                    `${item.label} = ${item.nilai_baru}`
                )
                .join(", "),

            deskripsi:
              "memperbarui master partner"
          }
        );
      }


      // ================================================
      // COMMIT
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;


      return res.json(
        partnerBaru
      );

    } catch (error) {
      if (transaksiDimulai) {
        try {
          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK UPDATE PARTNER:",
            rollbackError
          );
        }
      }


      console.error(
        "ERROR UPDATE PARTNER:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);

// DELETE PARTNER
app.delete(
  "/api/partner/:id",
  async (req, res) => {
    const client =
      await pool.connect();

    let transaksiDimulai =
      false;

    try {
      const id =
        Number(req.params.id);


      // ================================================
      // VALIDASI ID
      // ================================================

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID partner tidak valid"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // AMBIL DATA PARTNER LAMA
      // ================================================

      const oldResult =
        await client.query(
          `
            SELECT
              id,
              nama_partner,
              inisial,
              jenis_partner,
              nama_pic,
              no_pic,
              email_pic,
              alamat,
              status

            FROM partner

            WHERE id = $1

            FOR UPDATE
          `,
          [id]
        );


      if (
        oldResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Data partner tidak ditemukan"
        });
      }


      const partnerLama =
        oldResult.rows[0];


      // ================================================
      // HAPUS PARTNER
      // ================================================

      const result =
        await client.query(
          `
            DELETE FROM partner

            WHERE id = $1

            RETURNING *
          `,
          [id]
        );


      if (
        result.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Data partner tidak ditemukan"
        });
      }


      // ================================================
      // FORMAT NILAI LAMA
      // ================================================

      const formatNilaiPartner =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const nilaiLamaLog = [
        `NAMA PARTNER = ${
          formatNilaiPartner(
            partnerLama.nama_partner
          )
        }`,

        `INISIAL = ${
          formatNilaiPartner(
            partnerLama.inisial
          )
        }`,

        `JENIS PARTNER = ${
          formatNilaiPartner(
            partnerLama.jenis_partner
          )
        }`,

        `NAMA PIC = ${
          formatNilaiPartner(
            partnerLama.nama_pic
          )
        }`,

        `NO. PIC = ${
          formatNilaiPartner(
            partnerLama.no_pic
          )
        }`,

        `EMAIL PIC = ${
          formatNilaiPartner(
            partnerLama.email_pic
          )
        }`,

        `ALAMAT = ${
          formatNilaiPartner(
            partnerLama.alamat
          )
        }`,

        `STATUS = ${
          formatNilaiPartner(
            partnerLama.status
          )
        }`
      ].join(", ");


      // ================================================
      // SIMPAN ACTIVITY LOG
      // DELETE HANYA NILAI LAMA
      // ================================================

      await simpanActivityLog(
        client,
        {
          ...getActivityUser(req),

          aktivitas: "DELETE",

          modul:
            "MASTER PARTNER",

          // Master partner menggunakan ID partner
          entity_id:
            partnerLama.id,

          entity_nama:
            partnerLama.nama_partner,

          field_name:
            "DATA PARTNER",

          nilai_lama:
            nilaiLamaLog,

          nilai_baru: null,

          deskripsi:
            "menghapus master partner"
        }
      );


      // ================================================
      // COMMIT
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;


      return res.json({
        message:
          "Data partner berhasil dihapus"
      });

    } catch (error) {
      if (transaksiDimulai) {
        try {
          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK DELETE PARTNER:",
            rollbackError
          );
        }
      }


      console.error(
        "ERROR DELETE PARTNER:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);

// ======================================================
// MASTER PIC
// ======================================================


// READ PIC
app.get("/api/pic", 
  async (req, res) => {

  try {

    const result =
      await pool.query(
        `SELECT *
         FROM public.pic
         ORDER BY id DESC`
      );

    res.json(result.rows);

  } catch (error) {

    console.error(
      "ERROR READ PIC:",
      error
    );

    res.status(500).json({
      error: error.message
    });

  }

});


// CREATE PIC
app.post("/api/pic", 
  async (req, res) => {

  try {

    const {
      nama,
      nik,
      inisial,
      jabatan,
      email,
      no_hp
    } = req.body;


    const result =
      await pool.query(
        `INSERT INTO public.pic (
          nama,
          nik,
          inisial,
          jabatan,
          email,
          no_hp
        )
        VALUES (
          $1,$2,$3,$4,$5,$6
        )
        RETURNING *`,
        [
          nama,
          nik,
          inisial || null,
          jabatan,
          email || null,
          no_hp || null
        ]
      );


    res.status(201)
      .json(result.rows[0]);


  } catch (error) {

    console.error(
      "ERROR CREATE PIC:",
      error
    );

    res.status(500).json({
      error: error.message
    });

  }

});


// UPDATE PIC
app.put("/api/pic/:id", 
  async (req, res) => {

  try {

    const { id } =
      req.params;


    const {
      nama,
      nik,
      inisial,
      jabatan,
      email,
      no_hp
    } = req.body;


    const result =
      await pool.query(
        `UPDATE public.pic
         SET
            nama = $1,
            nik = $2,
            inisial = $3,
            jabatan = $4,
            email = $5,
            no_hp = $6,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [
          nama,
          nik,
          inisial || null,
          jabatan,
          email || null,
          no_hp || null,
          id
        ]
      );


    if (
      result.rows.length === 0
    ) {

      return res
        .status(404)
        .json({
          error:
            "PIC tidak ditemukan"
        });

    }


    res.json(result.rows[0]);


  } catch (error) {

    console.error(
      "ERROR UPDATE PIC:",
      error
    );

    res.status(500).json({
      error: error.message
    });

  }

});


// DELETE PIC
app.delete("/api/pic/:id", 
  async (req, res) => {

  try {

    const { id } =
      req.params;


    const result =
      await pool.query(
        `DELETE
         FROM public.pic
         WHERE id = $1
         RETURNING *`,
        [id]
      );


    if (
      result.rows.length === 0
    ) {

      return res
        .status(404)
        .json({
          error:
            "PIC tidak ditemukan"
        });

    }


    res.json({
      message:
        "PIC berhasil dihapus"
    });


  } catch (error) {

    console.error(
      "ERROR DELETE PIC:",
      error
    );

    res.status(500).json({
      error: error.message
    });

  }

});

// ======================================================
// MASTER KATEGORI PRODUK
// ======================================================


// READ KATEGORI PRODUK
app.get("/api/kategori-produk",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT
            kp.id,
            kp.nama_kategori_produk,
            kp.total_nilai,
            kp.status,
            kp.created_at,
            kp.updated_at,

            COALESCE(
              json_agg(
                json_build_object(
                  'id', p.id,
                  'nama', p.nama,
                  'nik', p.nik,
                  'inisial', p.inisial,
                  'jabatan', p.jabatan
                )
              )
              FILTER (
                WHERE p.id IS NOT NULL
              ),
              '[]'
            ) AS pic

          FROM public.kategori_produk kp

          LEFT JOIN
            public.kategori_produk_pic kpp
            ON kpp.kategori_produk_id = kp.id

          LEFT JOIN
            public.pic p
            ON p.id = kpp.pic_id

          GROUP BY kp.id

          ORDER BY kp.id DESC
        `);


      res.json(result.rows);


    } catch (error) {

      console.error(
        "ERROR READ KATEGORI:",
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// CREATE KATEGORI PRODUK
app.post("/api/kategori-produk",
  async (req, res) => {

    const client =
      await pool.connect();


    try {

      const {
        nama_kategori_produk,
        total_nilai,
        status,
        pic_ids
      } = req.body;


      if (!nama_kategori_produk) {

        return res
          .status(400)
          .json({
            error:
              "Nama kategori wajib diisi"
          });

      }


      await client.query("BEGIN");


      const kategori =
        await client.query(
          `INSERT INTO
             public.kategori_produk (
               nama_kategori_produk,
               total_nilai,
               status
             )
           VALUES ($1,$2,$3)
           RETURNING *`,
          [
            nama_kategori_produk,
            total_nilai || 0,
            status || "Aktif"
          ]
        );


      const kategoriId =
        kategori.rows[0].id;


      if (
        Array.isArray(pic_ids)
      ) {

        for (
          const picId
          of pic_ids
        ) {

          await client.query(
            `INSERT INTO
               public.kategori_produk_pic (
                 kategori_produk_id,
                 pic_id
               )
             VALUES ($1,$2)`,
            [
              kategoriId,
              picId
            ]
          );

        }

      }


      await client.query(
        "COMMIT"
      );


      res.status(201).json(
        kategori.rows[0]
      );


    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


      console.error(
        "ERROR CREATE KATEGORI:",
        error
      );


      res.status(500).json({
        error: error.message
      });


    } finally {

      client.release();

    }

  }
);


// UPDATE KATEGORI PRODUK
app.put("/api/kategori-produk/:id",
  async (req, res) => {

    const client =
      await pool.connect();


    try {

      const { id } =
        req.params;


      const {
        nama_kategori_produk,
        total_nilai,
        status,
        pic_ids
      } = req.body;


      await client.query(
        "BEGIN"
      );


      const kategori =
        await client.query(
          `UPDATE
             public.kategori_produk

           SET
             nama_kategori_produk = $1,
             total_nilai = $2,
             status = $3,
             updated_at =
               CURRENT_TIMESTAMP

           WHERE id = $4

           RETURNING *`,
          [
            nama_kategori_produk,
            total_nilai || 0,
            status,
            id
          ]
        );


      if (
        kategori.rows.length === 0
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res
          .status(404)
          .json({
            error:
              "Kategori tidak ditemukan"
          });

      }


      // HAPUS RELASI LAMA

      await client.query(
        `DELETE FROM
           public.kategori_produk_pic
         WHERE
           kategori_produk_id = $1`,
        [id]
      );


      // SIMPAN RELASI BARU

      if (
        Array.isArray(pic_ids)
      ) {

        for (
          const picId
          of pic_ids
        ) {

          await client.query(
            `INSERT INTO
               public.kategori_produk_pic (
                 kategori_produk_id,
                 pic_id
               )
             VALUES ($1,$2)`,
            [
              id,
              picId
            ]
          );

        }

      }


      await client.query(
        "COMMIT"
      );


      res.json(
        kategori.rows[0]
      );


    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


      console.error(
        "ERROR UPDATE KATEGORI:",
        error
      );


      res.status(500).json({
        error: error.message
      });


    } finally {

      client.release();

    }

  }
);


// DELETE KATEGORI PRODUK
app.delete("/api/kategori-produk/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;


      const result =
        await pool.query(
          `DELETE FROM
             public.kategori_produk

           WHERE id = $1

           RETURNING *`,
          [id]
        );


      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({
            error:
              "Kategori tidak ditemukan"
          });

      }


      res.json({
        message:
          "Kategori berhasil dihapus"
      });


    } catch (error) {

      console.error(
        "ERROR DELETE KATEGORI:",
        error
      );


      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// HELPER DASHBOARD
// ======================================================

function dashboardRequireLogin(
  req,
  res,
  next
) {
  if (!req.session?.user) {
    return res.status(401).json({
      error: "Belum login"
    });
  }

  next();
}

function dashboardGetContext(req) {
  const tahunInput =
    Number(req.query.tahun);

  const tahunSekarangJakarta =
    Number(
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            "Asia/Jakarta",

          year:
            "numeric"
        }
      ).format(new Date())
    );


  const tahun =
    Number.isInteger(tahunInput) &&
    tahunInput >= 2020 &&
    tahunInput <= 2100
      ? tahunInput
      : tahunSekarangJakarta;


  const user =
    req.session.user;


  const role =
    String(
      user.role || ""
    )
      .trim()
      .toLowerCase();


  const jabatan =
    String(
      user.jabatan ||
      user.nama_jabatan ||
      ""
    )
      .trim()
      .toLowerCase();


  const bolehLihatSemua =
    role === "admin" ||
    jabatan.includes("kabag") ||
    jabatan.includes(
      "kepala bagian"
    ) ||
    jabatan.includes("kadiv") ||
    jabatan.includes(
      "kepala divisi"
    );


  const picLoginIdInput =
    Number(user.id);


  const picId =
    Number.isInteger(
      picLoginIdInput
    ) &&
    picLoginIdInput > 0
      ? picLoginIdInput
      : 0;


  const picFilterInput =
    Number(req.query.pic_id);


  /*
   * Admin/Kabag/Kadiv:
   * - Boleh memilih PIC.
   * - Jika kosong, tampilkan semua PIC.
   *
   * PIC biasa:
   * - Selalu dipaksa menggunakan
   *   ID pengguna yang login.
   */

  const filterPicId =
    bolehLihatSemua
      ? (
          Number.isInteger(
            picFilterInput
          ) &&
          picFilterInput > 0
            ? picFilterInput
            : null
        )
      : picId;


  const jenisProyek =
    String(
      req.query.jenis_proyek ||
      ""
    ).trim();


  return {
    tahun,
    bolehLihatSemua,
    picId,
    filterPicId,
    jenisProyek
  };
}

function dashboardAngka(value) {
  const hasil =
    Number(value);

  return Number.isFinite(hasil)
    ? hasil
    : 0;
}


// ======================================================
// 1. DASHBOARD PROJECT
// ======================================================

app.get(
  "/api/dashboard/project",

  dashboardRequireLogin,

  async (req, res) => {
    try {
      // ==================================================
      // KONTEKS LOGIN
      // ==================================================

      const context =
        dashboardGetContext(req);

      const bolehLihatSemua =
        context.bolehLihatSemua;

      const picLoginId =
        context.picId;

      // ==================================================
      // TAHUN LAPORAN
      // ==================================================

      const tahunBerjalan =
        Number(
          new Intl.DateTimeFormat(
            "en-US",
            {
              timeZone: "Asia/Jakarta",
              year: "numeric"
            }
          ).format(new Date())
        );

      const tahunInput =
        Number(req.query.tahun);

      const tahun =
        Number.isInteger(tahunInput) &&
        tahunInput >= 2020 &&
        tahunInput <= 2100
          ? tahunInput
          : tahunBerjalan;

      // ==================================================
      // FILTER JENIS PROYEK
      // ==================================================

      const jenisProyek =
        String(
          req.query.jenis_proyek || ""
        ).trim();

      // ==================================================
      // FILTER PIC
      // ==================================================

      const picFilterRaw =
        String(
          req.query.pic_id || ""
        ).trim();

      let picFilterId = null;

      if (picFilterRaw) {
        const parsedPicId =
          Number(picFilterRaw);

        if (
          !Number.isInteger(parsedPicId) ||
          parsedPicId <= 0
        ) {
          return res.status(400).json({
            error:
              "Filter PIC tidak valid"
          });
        }

        picFilterId =
          parsedPicId;
      }

      // ==================================================
      // QUERY PROJECT OVERVIEW
      // ==================================================

      const result =
        await pool.query(
          `
          WITH periode AS (
            SELECT
              MAKE_DATE(
                $1::INTEGER,
                1,
                1
              ) AS awal_tahun,

              MAKE_DATE(
                $1::INTEGER + 1,
                1,
                1
              ) AS akhir_tahun
          ),

          proyek_base AS (
            SELECT
              p.id,
              p.nama_proyek,
              p.jenis_proyek,
              p.created_at,

              LOWER(
                BTRIM(
                  COALESCE(
                    p.status_final,
                    ''
                  )
                )
              ) AS status_final,

              LOWER(
                BTRIM(
                  REGEXP_REPLACE(
                    COALESCE(
                      pk.status_pengadaan,
                      ''
                    ),
                    '\\s+',
                    ' ',
                    'g'
                  )
                )
              ) AS status_pengadaan,

              LOWER(
                BTRIM(
                  REGEXP_REPLACE(
                    COALESCE(
                      pk.status_teknis,
                      ''
                    ),
                    '\\s+',
                    ' ',
                    'g'
                  )
                )
              ) AS status_teknis,

              pk.tanggal_mulai,
              pk.tanggal_akhir,

              /*
               * Proyek masuk tahun laporan jika kontrak
               * klien bersinggungan dengan tahun terpilih.
               */
              EXISTS (
                SELECT 1
                FROM public.proyek_klien kontrak
                CROSS JOIN periode

                WHERE
                  kontrak.proyek_id = p.id

                  AND kontrak.tanggal_mulai
                    IS NOT NULL

                  AND kontrak.tanggal_akhir
                    IS NOT NULL

                  AND kontrak.tanggal_mulai <
                    periode.akhir_tahun

                  AND kontrak.tanggal_akhir >=
                    periode.awal_tahun
              ) AS masuk_tahun,

              /*
               * Nilai proyek:
               * Nego 3 → Nego 2 → Nego 1
               * → Submit → Total Termin.
               */
              COALESCE(
                NULLIF(
                  pk.nilai_nego_3,
                  0
                ),

                NULLIF(
                  pk.nilai_nego_2,
                  0
                ),

                NULLIF(
                  pk.nilai_nego_1,
                  0
                ),

                NULLIF(
                  pk.nilai_submit,
                  0
                ),

                (
                  SELECT
                    SUM(
                      COALESCE(
                        termin.nominal,
                        0
                      )
                    )

                  FROM public.proyek_klien_termin
                    termin

                  WHERE
                    termin.proyek_klien_id =
                      pk.id
                ),

                0
              )::NUMERIC AS nilai_proyek

            FROM public.proyek p

            /*
             * Gunakan informasi klien terbaru
             * untuk setiap proyek.
             */
            LEFT JOIN LATERAL (
              SELECT
                klien.id,
                klien.status_pengadaan,
                klien.status_teknis,
                klien.tanggal_mulai,
                klien.tanggal_akhir,
                klien.nilai_submit,
                klien.nilai_nego_1,
                klien.nilai_nego_2,
                klien.nilai_nego_3

              FROM public.proyek_klien klien

              WHERE
                klien.proyek_id =
                  p.id

              ORDER BY
                klien.id DESC

              LIMIT 1
            ) pk
              ON TRUE

            WHERE
              /*
               * Hak akses pengguna login.
               */
              (
                $2::BOOLEAN = TRUE

                OR EXISTS (
                  SELECT 1
                  FROM public.proyek_pic akses_login

                  WHERE
                    akses_login.proyek_id =
                      p.id

                    AND akses_login.pic_id =
                      $3
                )
              )

              /*
               * Filter jenis proyek.
               */
              AND (
                $4::TEXT = ''

                OR LOWER(
                  BTRIM(
                    COALESCE(
                      p.jenis_proyek,
                      ''
                    )
                  )
                ) =
                LOWER(
                  BTRIM($4::TEXT)
                )
              )

              /*
               * Filter PIC dashboard.
               */
              AND (
                $5::INTEGER IS NULL

                OR EXISTS (
                  SELECT 1
                  FROM public.proyek_pic filter_pic

                  WHERE
                    filter_pic.proyek_id =
                      p.id

                    AND filter_pic.pic_id =
                      $5
                )
              )
          )

          SELECT
            /* ============================================
             * PROJECT OVERVIEW — PIPELINE
             * ============================================ */

            COUNT(*) FILTER (
              WHERE
                status_final = 'aktif'

                AND status_pengadaan
                  LIKE '%pipeline%'
            )::INTEGER AS total_pipeline,

            COALESCE(
              SUM(nilai_proyek) FILTER (
                WHERE
                  status_final = 'aktif'

                  AND status_pengadaan
                    LIKE '%pipeline%'
              ),
              0
            )::NUMERIC AS nilai_pipeline,

            /* ============================================
             * PROJECT OVERVIEW — SUBMIT PENAWARAN
             * ============================================ */

            COUNT(*) FILTER (
              WHERE
                status_final = 'aktif'

                AND status_pengadaan
                  LIKE '%submit penawaran%'
            )::INTEGER AS total_submit_penawaran,

            COALESCE(
              SUM(nilai_proyek) FILTER (
                WHERE
                  status_final = 'aktif'

                  AND status_pengadaan
                    LIKE '%submit penawaran%'
              ),
              0
            )::NUMERIC AS nilai_submit_penawaran,

            /* ============================================
             * PROJECT OVERVIEW — PROSES PENGADAAN
             *
             * Mengambil:
             * 1. Submit Pengadaan
             * 2. Negosiasi/Nego
             * ============================================ */

            COUNT(*) FILTER (
              WHERE
                status_final = 'aktif'

                AND (
                  status_pengadaan
                    LIKE '%submit%pengadaan%'

                  OR status_pengadaan
                    LIKE '%negosiasi%'

                  OR status_pengadaan
                    LIKE '%nego%'
                )
            )::INTEGER AS total_submit_pengadaan,

            COALESCE(
              SUM(nilai_proyek) FILTER (
                WHERE
                  status_final = 'aktif'

                  AND (
                    status_pengadaan
                      LIKE '%submit%pengadaan%'

                    OR status_pengadaan
                      LIKE '%negosiasi%'

                    OR status_pengadaan
                      LIKE '%nego%'
                  )
              ),
              0
            )::NUMERIC AS nilai_submit_pengadaan,

            /* ============================================
             * PROJECT OVERVIEW — PROSES KONTRAK
             * ============================================ */

            COUNT(*) FILTER (
              WHERE
                status_final = 'aktif'

                AND (
                  status_pengadaan
                    LIKE '%proses%kontrak%'

                  OR status_pengadaan =
                    'kontrak'
                )
            )::INTEGER AS total_kontrak,

            COALESCE(
              SUM(nilai_proyek) FILTER (
                WHERE
                  status_final = 'aktif'

                  AND (
                    status_pengadaan
                      LIKE '%proses%kontrak%'

                    OR status_pengadaan =
                      'kontrak'
                  )
              ),
              0
            )::NUMERIC AS nilai_kontrak,

            /* ============================================
             * PROJECT OVERVIEW — PROYEK AKTIF
             *
             * Status final Aktif
             * Status pengadaan Done
             * Masuk tahun laporan
             * ============================================ */

            COUNT(*) FILTER (
              WHERE
                status_final = 'aktif'

                AND status_pengadaan =
                  'done'

                AND masuk_tahun
            )::INTEGER AS total_proyek_aktif,

            COALESCE(
              SUM(nilai_proyek) FILTER (
                WHERE
                  status_final = 'aktif'

                  AND status_pengadaan =
                    'done'

                  AND masuk_tahun
              ),
              0
            )::NUMERIC AS nilai_proyek_aktif,

            /* ============================================
             * PROJECT OVERVIEW — PROYEK SELESAI
             * ============================================ */

            COUNT(*) FILTER (
              WHERE
                status_final IN (
                  'done',
                  'selesai'
                )

                AND masuk_tahun
            )::INTEGER AS total_proyek_done,

            COALESCE(
              SUM(nilai_proyek) FILTER (
                WHERE
                  status_final IN (
                    'done',
                    'selesai'
                  )

                  AND masuk_tahun
              ),
              0
            )::NUMERIC AS nilai_proyek_done,

            /* ============================================
             * PROJECT OVERVIEW — PROYEK TERLAMBAT
             *
             * Status final Aktif
             * Status pengadaan Done
             * Tanggal akhir telah lewat
             * Status teknis bukan Done/Selesai
             * ============================================ */

            COUNT(*) FILTER (
              WHERE
                status_final = 'aktif'

                AND status_pengadaan =
                  'done'

                AND tanggal_akhir
                  IS NOT NULL

                AND tanggal_akhir <
                  CURRENT_DATE

                AND status_teknis NOT IN (
                  'done',
                  'selesai'
                )
            )::INTEGER AS total_proyek_terlambat,

            COALESCE(
              SUM(nilai_proyek) FILTER (
                WHERE
                  status_final = 'aktif'

                  AND status_pengadaan =
                    'done'

                  AND tanggal_akhir
                    IS NOT NULL

                  AND tanggal_akhir <
                    CURRENT_DATE

                  AND status_teknis NOT IN (
                    'done',
                    'selesai'
                  )
              ),
              0
            )::NUMERIC AS nilai_proyek_terlambat

          FROM proyek_base
          `,
          [
            tahun,
            bolehLihatSemua,
            picLoginId,
            jenisProyek,
            picFilterId
          ]
        );

      const data =
        result.rows[0] || {};

      // ==================================================
      // NORMALISASI ANGKA
      // ==================================================

      const angka = value => {
        const hasil =
          Number(value);

        return Number.isFinite(hasil)
          ? hasil
          : 0;
      };

      // ==================================================
      // PERHITUNGAN TOTAL PROYEK
      //
      // Total merupakan penjumlahan seluruh card:
      // Pipeline
      // Submit Penawaran
      // Proses Pengadaan
      // Proses Kontrak
      // Proyek Aktif
      // Proyek Selesai
      // Proyek Terlambat
      // ==================================================

      const totalSemuaProyek =
        angka(data.total_pipeline) +
        angka(data.total_submit_penawaran) +
        angka(data.total_submit_pengadaan) +
        angka(data.total_kontrak) +
        angka(data.total_proyek_aktif) +
        angka(data.total_proyek_done) +
        angka(data.total_proyek_terlambat);

      const nilaiTotalProyek =
        angka(data.nilai_pipeline) +
        angka(data.nilai_submit_penawaran) +
        angka(data.nilai_submit_pengadaan) +
        angka(data.nilai_kontrak) +
        angka(data.nilai_proyek_aktif) +
        angka(data.nilai_proyek_done) +
        angka(data.nilai_proyek_terlambat);

      // ==================================================
      // RESPONSE
      // ==================================================

      return res.json({
        tahun,

        filter: {
          jenis_proyek:
            jenisProyek || null,

          pic_id:
            picFilterId
        },

        generated_at:
          new Date().toISOString(),

        project_overview: {
          total_pipeline:
            dashboardAngka(
              data.total_pipeline
            ),

          nilai_pipeline:
            dashboardAngka(
              data.nilai_pipeline
            ),

          total_submit_penawaran:
            dashboardAngka(
              data.total_submit_penawaran
            ),

          nilai_submit_penawaran:
            dashboardAngka(
              data.nilai_submit_penawaran
            ),

          /*
           * Field tetap menggunakan nama lama
           * agar dashboard.js tidak perlu diubah.
           */
          total_submit_pengadaan:
            dashboardAngka(
              data.total_submit_pengadaan
            ),

          nilai_submit_pengadaan:
            dashboardAngka(
              data.nilai_submit_pengadaan
            ),

          total_kontrak:
            dashboardAngka(
              data.total_kontrak
            ),

          nilai_kontrak:
            dashboardAngka(
              data.nilai_kontrak
            ),

          total_proyek_aktif:
            dashboardAngka(
              data.total_proyek_aktif
            ),

          nilai_proyek_aktif:
            dashboardAngka(
              data.nilai_proyek_aktif
            ),

          total_proyek_done:
            dashboardAngka(
              data.total_proyek_done
            ),

          nilai_proyek_done:
            dashboardAngka(
              data.nilai_proyek_done
            ),

          total_proyek_terlambat:
            dashboardAngka(
              data.total_proyek_terlambat
            ),

          nilai_proyek_terlambat:
            dashboardAngka(
              data.nilai_proyek_terlambat
            ),

          total_semua_proyek:
            dashboardAngka(
              totalSemuaProyek
            ),

          nilai_total_proyek:
            dashboardAngka(
              nilaiTotalProyek
            )
        }
      });

    } catch (error) {
      console.error(
        "ERROR DASHBOARD PROJECT:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);
// ======================================================
// 2. DASHBOARD FINANCIAL
// ======================================================

app.get(
  "/api/dashboard/financial",

  dashboardRequireLogin,

  async (req, res) => {
    try {
      const {
        tahun,
        bolehLihatSemua,
        picId,
        filterPicId,
        jenisProyek
      } = dashboardGetContext(req);


      const result =
        await pool.query(
          `
          WITH pengaturan AS (
            SELECT
              MAKE_DATE(
                $1::integer,
                1,
                1
              ) AS awal_tahun,

              MAKE_DATE(
                $1::integer + 1,
                1,
                1
              ) AS akhir_tahun,

              MAKE_DATE(
                $1::integer,

                EXTRACT(
                  MONTH FROM (
                    CURRENT_TIMESTAMP
                    AT TIME ZONE
                      'Asia/Jakarta'
                  )
                )::integer,

                1
              ) AS awal_bulan
          ),


          /* =================================================
             PROYEK SESUAI HAK AKSES DAN FILTER DASHBOARD
             ================================================= */

          proyek_terfilter AS (
            SELECT
              p.id,
              p.jenis_proyek

            FROM public.proyek p

            WHERE
              /*
               * Hak akses pengguna yang login.
               */

              (
                $2::boolean = TRUE

                OR EXISTS (
                  SELECT 1

                  FROM public.proyek_pic
                    akses_login

                  WHERE
                    akses_login.proyek_id =
                      p.id

                    AND akses_login.pic_id =
                      $3
                )
              )


              /*
               * Filter PIC dashboard.
               *
               * NULL berarti semua PIC.
               */

              AND (
                $4::bigint IS NULL

                OR EXISTS (
                  SELECT 1

                  FROM public.proyek_pic
                    filter_pic

                  WHERE
                    filter_pic.proyek_id =
                      p.id

                    AND filter_pic.pic_id =
                      $4
                )
              )


              /*
               * Filter Jenis Proyek dashboard.
               *
               * String kosong berarti semua jenis.
               */

              AND (
                BTRIM(
                  $5::text
                ) = ''

                OR LOWER(
                  BTRIM(
                    COALESCE(
                      p.jenis_proyek,
                      ''
                    )
                  )
                ) =
                LOWER(
                  BTRIM(
                    $5::text
                  )
                )

                OR (
                  LOWER(
                    BTRIM(
                      $5::text
                    )
                  ) IN (
                    'reguler',
                    'reguler/sla'
                  )

                  AND LOWER(
                    BTRIM(
                      COALESCE(
                        p.jenis_proyek,
                        ''
                      )
                    )
                  ) LIKE 'reguler%'
                )
              )
          ),


          /* =================================================
             PENDAPATAN REGULER / TRANSAKSI
             ================================================= */

          pendapatan_reguler_dasar AS (
            SELECT
              CASE
                WHEN LOWER(
                  COALESCE(
                    proyek.jenis_proyek,
                    ''
                  )
                ) LIKE '%transaksi%'
                THEN 'Transaksi'

                ELSE 'Reguler'
              END AS jenis,

              termin.tanggal_jatuh_tempo::date
                AS tanggal_jatuh_tempo,

              termin.tanggal_bayar::date
                AS tanggal_bayar,

              NULL::date
                AS tanggal_do,

              COALESCE(
                termin.tanggal_bayar::date,
                termin.tanggal_jatuh_tempo::date,
                termin.created_at::date
              ) AS tanggal_acuan,

              COALESCE(
                NULLIF(
                  termin.nominal,
                  0
                ),

                (
                  COALESCE(
                    NULLIF(
                      klien.nilai_nego_3,
                      0
                    ),

                    NULLIF(
                      klien.nilai_nego_2,
                      0
                    ),

                    NULLIF(
                      klien.nilai_nego_1,
                      0
                    ),

                    NULLIF(
                      klien.nilai_submit,
                      0
                    ),

                    0
                  )

                  *

                  COALESCE(
                    termin.persentase,
                    0
                  )

                  / 100
                ),

                0
              )::numeric AS nilai,

              LOWER(
                BTRIM(
                  REGEXP_REPLACE(
                    COALESCE(
                      termin.status_pembayaran,
                      ''
                    ),
                    '\\s+',
                    ' ',
                    'g'
                  )
                )
              ) AS status

            FROM
              public.proyek_klien_termin
                termin

            INNER JOIN
              public.proyek_klien
                klien

              ON klien.id =
                termin.proyek_klien_id

            INNER JOIN
              proyek_terfilter
                proyek

              ON proyek.id =
                klien.proyek_id

            WHERE
              LOWER(
                COALESCE(
                  proyek.jenis_proyek,
                  ''
                )
              ) NOT LIKE '%sewa%'
          ),


          pendapatan_reguler AS (
            SELECT
              dasar.*,

              (
                dasar.status IN (
                  'dibayar',
                  'sudah dibayar',
                  'lunas',
                  'paid'
                )

                OR dasar.tanggal_jatuh_tempo
                  IS NOT NULL

                OR dasar.tanggal_bayar
                  IS NOT NULL
              ) AS pendapatan_diakui,

              (
                dasar.status IN (
                  'dibayar',
                  'sudah dibayar',
                  'lunas',
                  'paid'
                )

                OR dasar.tanggal_bayar
                  IS NOT NULL
              ) AS sudah_dibayar

            FROM pendapatan_reguler_dasar
              dasar
          ),


          /* =================================================
             PENDAPATAN SEWA
             ================================================= */

          pendapatan_sewa_dasar AS (
            SELECT
              'Sewa'::text
                AS jenis,

              NULL::date
                AS tanggal_jatuh_tempo,

              pembayaran.tanggal_bayar::date
                AS tanggal_bayar,

              data_do.tanggal_do,

              COALESCE(
                pembayaran.tanggal_bayar::date,
                data_do.tanggal_do,
                pembayaran.created_at::date
              ) AS tanggal_acuan,

              COALESCE(
                pembayaran.nominal,
                0
              )::numeric AS nilai,

              LOWER(
                BTRIM(
                  REGEXP_REPLACE(
                    COALESCE(
                      pembayaran.status_pembayaran,
                      ''
                    ),
                    '\\s+',
                    ' ',
                    'g'
                  )
                )
              ) AS status

            FROM
              public.proyek_sewa_pembayaran
                pembayaran

            INNER JOIN
              public.proyek_sewa
                sewa

              ON sewa.id =
                pembayaran.proyek_sewa_id

            INNER JOIN
              proyek_terfilter
                proyek

              ON proyek.id =
                sewa.proyek_id

            LEFT JOIN LATERAL (
              SELECT
                MIN(
                  pesanan.tanggal_do
                )::date AS tanggal_do

              FROM
                public.proyek_sewa_produk
                  produk

              INNER JOIN
                public.proyek_sewa_order
                  pesanan

                ON pesanan
                  .proyek_sewa_produk_id =
                  produk.id

              WHERE
                produk.proyek_sewa_id =
                  sewa.id

                AND pesanan.tanggal_do
                  IS NOT NULL
            ) data_do
              ON TRUE
          ),


          pendapatan_sewa AS (
            SELECT
              dasar.*,

              (
                dasar.status IN (
                  'dibayar',
                  'sudah dibayar',
                  'lunas',
                  'paid'
                )

                OR dasar.tanggal_do
                  IS NOT NULL

                OR dasar.tanggal_bayar
                  IS NOT NULL
              ) AS pendapatan_diakui,

              (
                dasar.status IN (
                  'dibayar',
                  'sudah dibayar',
                  'lunas',
                  'paid'
                )

                OR dasar.tanggal_bayar
                  IS NOT NULL
              ) AS sudah_dibayar

            FROM pendapatan_sewa_dasar
              dasar
          ),


          pendapatan AS (
            SELECT *
            FROM pendapatan_reguler

            UNION ALL

            SELECT *
            FROM pendapatan_sewa
          ),


          /* =================================================
             PENGELUARAN REGULER
             ================================================= */

          pengeluaran_reguler AS (
            SELECT
              termin.tanggal_bayar::date
                AS tanggal_bayar,

              COALESCE(
                termin.tanggal_bayar::date,
                termin.tanggal_jatuh_tempo::date,
                termin.created_at::date
              ) AS tanggal_acuan,

              COALESCE(
                NULLIF(
                  termin.nominal,
                  0
                ),

                (
                  COALESCE(
                    NULLIF(
                      partner.nilai_nego_3,
                      0
                    ),

                    NULLIF(
                      partner.nilai_nego_2,
                      0
                    ),

                    NULLIF(
                      partner.nilai_nego_1,
                      0
                    ),

                    NULLIF(
                      partner.nilai_submit,
                      0
                    ),

                    0
                  )

                  *

                  COALESCE(
                    termin.persentase,
                    0
                  )

                  / 100
                ),

                0
              )::numeric AS nilai,

              LOWER(
                BTRIM(
                  REGEXP_REPLACE(
                    COALESCE(
                      termin.status_pembayaran,
                      ''
                    ),
                    '\\s+',
                    ' ',
                    'g'
                  )
                )
              ) AS status

            FROM
              public.proyek_partner_termin
                termin

            INNER JOIN
              public.proyek_partner
                partner

              ON partner.id =
                termin.proyek_partner_id

            INNER JOIN
              proyek_terfilter
                proyek

              ON proyek.id =
                partner.proyek_id

            WHERE
              LOWER(
                COALESCE(
                  proyek.jenis_proyek,
                  ''
                )
              ) NOT LIKE '%sewa%'
          ),


          /* =================================================
             PENGELUARAN SEWA
             ================================================= */

          pengeluaran_sewa AS (
            SELECT
              pembayaran.tanggal_bayar::date
                AS tanggal_bayar,

              COALESCE(
                pembayaran.tanggal_bayar::date,
                pembayaran.created_at::date
              ) AS tanggal_acuan,

              COALESCE(
                pembayaran.nominal,
                0
              )::numeric AS nilai,

              LOWER(
                BTRIM(
                  REGEXP_REPLACE(
                    COALESCE(
                      pembayaran.status_pembayaran,
                      ''
                    ),
                    '\\s+',
                    ' ',
                    'g'
                  )
                )
              ) AS status

            FROM
              public.proyek_sewa_pembayaran_partner
                pembayaran

            INNER JOIN
              public.proyek_sewa
                sewa

              ON sewa.id =
                pembayaran.proyek_sewa_id

            INNER JOIN
              proyek_terfilter
                proyek

              ON proyek.id =
                sewa.proyek_id
          ),


          pengeluaran AS (
            SELECT *
            FROM pengeluaran_reguler

            UNION ALL

            SELECT *
            FROM pengeluaran_sewa
          ),


          bulan AS (
            SELECT
              GENERATE_SERIES(
                1,
                12
              )::integer AS nomor
          )


          SELECT
            /* ===============================================
               KPI SESUAI JENIS PROYEK
               =============================================== */

            /* ===============================================
   KPI

   master_kpi belum memiliki kolom jenis_proyek,
   sehingga KPI hanya difilter berdasarkan tahun.
   =============================================== */

COALESCE(
  (
    SELECT
      SUM(kpi.nilai_kpi)

    FROM public.master_kpi kpi

    WHERE
      kpi.tahun = $1
  ),
  0
)::numeric AS kpi,


            /* ===============================================
               PENDAPATAN REGULER
               =============================================== */

            COALESCE(
              (
                SELECT SUM(nilai)

                FROM pendapatan
                CROSS JOIN pengaturan

                WHERE
                  jenis = 'Reguler'

                  AND pendapatan_diakui =
                    TRUE

                  AND tanggal_acuan >=
                    pengaturan.awal_tahun

                  AND tanggal_acuan <
                    pengaturan.akhir_tahun
              ),
              0
            )::numeric
              AS reguler_dibayar,


            /* ===============================================
               PENDAPATAN SEWA
               =============================================== */

            COALESCE(
              (
                SELECT SUM(nilai)

                FROM pendapatan
                CROSS JOIN pengaturan

                WHERE
                  jenis = 'Sewa'

                  AND pendapatan_diakui =
                    TRUE

                  AND tanggal_acuan >=
                    pengaturan.awal_tahun

                  AND tanggal_acuan <
                    pengaturan.akhir_tahun
              ),
              0
            )::numeric
              AS sewa_dibayar,


            /* ===============================================
               PENDAPATAN TRANSAKSI
               =============================================== */

            COALESCE(
              (
                SELECT SUM(nilai)

                FROM pendapatan
                CROSS JOIN pengaturan

                WHERE
                  jenis = 'Transaksi'

                  AND pendapatan_diakui =
                    TRUE

                  AND tanggal_acuan >=
                    pengaturan.awal_tahun

                  AND tanggal_acuan <
                    pengaturan.akhir_tahun
              ),
              0
            )::numeric
              AS transaksi_dibayar,


            /* ===============================================
               PIUTANG KLIEN
               =============================================== */

            COALESCE(
              (
                SELECT SUM(nilai)

                FROM pendapatan
                CROSS JOIN pengaturan

                WHERE
                  pendapatan_diakui =
                    TRUE

                  AND sudah_dibayar =
                    FALSE

                  AND tanggal_acuan >=
                    pengaturan.awal_tahun

                  AND tanggal_acuan <
                    pengaturan.akhir_tahun
              ),
              0
            )::numeric
              AS piutang_klien,


            /* ===============================================
               SUDAH DIBAYAR KLIEN
               =============================================== */

            COALESCE(
              (
                SELECT SUM(nilai)

                FROM pendapatan
                CROSS JOIN pengaturan

                WHERE
                  sudah_dibayar =
                    TRUE

                  AND tanggal_acuan >=
                    pengaturan.awal_tahun

                  AND tanggal_acuan <
                    pengaturan.akhir_tahun
              ),
              0
            )::numeric
              AS sudah_dibayar_klien,


            /* ===============================================
               PENDAPATAN BULAN BERJALAN
               =============================================== */

            COALESCE(
              (
                SELECT SUM(nilai)

                FROM pendapatan
                CROSS JOIN pengaturan

                WHERE
                  pendapatan_diakui =
                    TRUE

                  AND tanggal_acuan >=
                    pengaturan.awal_bulan

                  AND tanggal_acuan <
                    pengaturan.awal_bulan
                    + INTERVAL '1 month'
              ),
              0
            )::numeric
              AS pendapatan_bulan_berjalan,


            /* ===============================================
               PENDAPATAN BULAN SEBELUMNYA
               =============================================== */

            COALESCE(
              (
                SELECT SUM(nilai)

                FROM pendapatan
                CROSS JOIN pengaturan

                WHERE
                  pendapatan_diakui =
                    TRUE

                  AND tanggal_acuan >=
                    pengaturan.awal_bulan
                    - INTERVAL '1 month'

                  AND tanggal_acuan <
                    pengaturan.awal_bulan
              ),
              0
            )::numeric
              AS pendapatan_bulan_sebelumnya,


            /* ===============================================
               HUTANG PARTNER
               =============================================== */

            COALESCE(
              (
                SELECT SUM(nilai)

                FROM pengeluaran
                CROSS JOIN pengaturan

                WHERE
                  status IN (
                    'belum dibayar',
                    'belum bayar',
                    'unpaid',
                    'proses',
                    'diproses',
                    'processing'
                  )

                  AND tanggal_acuan >=
                    pengaturan.awal_tahun

                  AND tanggal_acuan <
                    pengaturan.akhir_tahun
              ),
              0
            )::numeric
              AS hutang_partner,


            /* ===============================================
               SUDAH DIBAYAR PARTNER
               =============================================== */

            COALESCE(
              (
                SELECT SUM(nilai)

                FROM pengeluaran
                CROSS JOIN pengaturan

                WHERE
                  status IN (
                    'dibayar',
                    'sudah dibayar',
                    'lunas',
                    'paid'
                  )

                  AND tanggal_bayar >=
                    pengaturan.awal_tahun

                  AND tanggal_bayar <
                    pengaturan.akhir_tahun
              ),
              0
            )::numeric
              AS dibayar_partner,


            /* ===============================================
               GRAFIK PENDAPATAN
               =============================================== */

            (
              SELECT
                JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'bulan',
                    bulan.nomor,

                    'reguler',
                    COALESCE(
                      (
                        SELECT SUM(p.nilai)

                        FROM pendapatan p
                        CROSS JOIN pengaturan

                        WHERE
                          p.jenis =
                            'Reguler'

                          AND p
                            .pendapatan_diakui =
                            TRUE

                          AND p.tanggal_acuan >=
                            pengaturan.awal_tahun

                          AND p.tanggal_acuan <
                            pengaturan.akhir_tahun

                          AND EXTRACT(
                            MONTH FROM
                              p.tanggal_acuan
                          )::integer =
                            bulan.nomor
                      ),
                      0
                    ),

                    'sewa',
                    COALESCE(
                      (
                        SELECT SUM(p.nilai)

                        FROM pendapatan p
                        CROSS JOIN pengaturan

                        WHERE
                          p.jenis =
                            'Sewa'

                          AND p
                            .pendapatan_diakui =
                            TRUE

                          AND p.tanggal_acuan >=
                            pengaturan.awal_tahun

                          AND p.tanggal_acuan <
                            pengaturan.akhir_tahun

                          AND EXTRACT(
                            MONTH FROM
                              p.tanggal_acuan
                          )::integer =
                            bulan.nomor
                      ),
                      0
                    ),

                    'transaksi',
                    COALESCE(
                      (
                        SELECT SUM(p.nilai)

                        FROM pendapatan p
                        CROSS JOIN pengaturan

                        WHERE
                          p.jenis =
                            'Transaksi'

                          AND p
                            .pendapatan_diakui =
                            TRUE

                          AND p.tanggal_acuan >=
                            pengaturan.awal_tahun

                          AND p.tanggal_acuan <
                            pengaturan.akhir_tahun

                          AND EXTRACT(
                            MONTH FROM
                              p.tanggal_acuan
                          )::integer =
                            bulan.nomor
                      ),
                      0
                    )
                  )

                  ORDER BY
                    bulan.nomor
                )

              FROM bulan
            ) AS income_monthly,


            /* ===============================================
               GRAFIK PENGELUARAN
               =============================================== */

            (
              SELECT
                JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'bulan',
                    bulan.nomor,

                    'dibayar',
                    COALESCE(
                      (
                        SELECT SUM(p.nilai)

                        FROM pengeluaran p
                        CROSS JOIN pengaturan

                        WHERE
                          p.status IN (
                            'dibayar',
                            'sudah dibayar',
                            'lunas',
                            'paid'
                          )

                          AND p.tanggal_bayar >=
                            pengaturan.awal_tahun

                          AND p.tanggal_bayar <
                            pengaturan.akhir_tahun

                          AND EXTRACT(
                            MONTH FROM
                              p.tanggal_bayar
                          )::integer =
                            bulan.nomor
                      ),
                      0
                    )
                  )

                  ORDER BY
                    bulan.nomor
                )

              FROM bulan
            ) AS partner_monthly
          `,

          [
            tahun,
            bolehLihatSemua,
            picId,
            filterPicId,
            jenisProyek
          ]
        );


      const data =
        result.rows[0] || {};


      const kpi =
        dashboardAngka(
          data.kpi
        );


      const reguler =
        dashboardAngka(
          data.reguler_dibayar
        );


      const sewa =
        dashboardAngka(
          data.sewa_dibayar
        );


      const realisasiKpi =
        reguler + sewa;


      const persentaseKpi =
        kpi > 0
          ? (
              realisasiKpi /
              kpi
            ) * 100
          : 0;


      return res.json({
        tahun,

        filter: {
          jenis_proyek:
            jenisProyek || null,

          pic_id:
            filterPicId
        },

        generated_at:
          new Date().toISOString(),

        financial_overview: {
          kpi,

          realisasi_kpi:
            realisasiKpi,

          persentase_kpi:
            persentaseKpi,

          reguler_dibayar:
            reguler,

          sewa_dibayar:
            sewa,

          transaksi_dibayar:
            dashboardAngka(
              data.transaksi_dibayar
            ),

          piutang_klien:
            dashboardAngka(
              data.piutang_klien
            ),

          sudah_dibayar_klien:
            dashboardAngka(
              data.sudah_dibayar_klien
            ),

          hutang_partner:
            dashboardAngka(
              data.hutang_partner
            ),

          dibayar_partner:
            dashboardAngka(
              data.dibayar_partner
            ),

          pendapatan_bulan_berjalan:
            dashboardAngka(
              data
                .pendapatan_bulan_berjalan
            ),

          pendapatan_bulan_sebelumnya:
            dashboardAngka(
              data
                .pendapatan_bulan_sebelumnya
            )
        },

        income_monthly:
          Array.isArray(
            data.income_monthly
          )
            ? data.income_monthly
            : [],

        partner_monthly:
          Array.isArray(
            data.partner_monthly
          )
            ? data.partner_monthly
            : []
      });

    } catch (error) {
      console.error(
        "ERROR DASHBOARD FINANCIAL:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ======================================================
// 3. DASHBOARD CONTRACT
// ======================================================

app.get(
  "/api/dashboard/contract",

  dashboardRequireLogin,

  async (req, res) => {
    try {
      const {
        tahun,
        bolehLihatSemua,
        picId
      } = dashboardGetContext(req);

      const result =
        await pool.query(
          `
          WITH pengaturan AS (
            SELECT
              (
                CURRENT_TIMESTAMP
                AT TIME ZONE
                  'Asia/Jakarta'
              )::date AS hari_ini
          ),

          akses_proyek AS (
            SELECT
              p.id

            FROM public.proyek p

            WHERE
              $1::boolean = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic
                  akses

                WHERE
                  akses.proyek_id =
                    p.id

                  AND akses.pic_id =
                    $2
              )
          ),

          timeline_dashboard AS (
            SELECT
              timeline.tanggal_akhir::date
                AS tanggal_akhir

            FROM public.proyek_timeline
              timeline

            INNER JOIN public.proyek p
              ON p.id =
                timeline.proyek_id

            INNER JOIN akses_proyek akses
              ON akses.id =
                p.id

            WHERE
              LOWER(
                BTRIM(
                  COALESCE(
                    p.status_final,
                    ''
                  )
                )
              ) = 'aktif'

              AND timeline.tanggal_akhir
                IS NOT NULL

            UNION ALL

            SELECT
              pesanan.end_date::date
                AS tanggal_akhir

            FROM
              public.proyek_sewa_order
                pesanan

            INNER JOIN
              public.proyek_sewa_produk
                produk

              ON produk.id =
                pesanan
                  .proyek_sewa_produk_id

            INNER JOIN
              public.proyek_sewa
                sewa

              ON sewa.id =
                produk.proyek_sewa_id

            INNER JOIN public.proyek p
              ON p.id =
                sewa.proyek_id

            INNER JOIN akses_proyek akses
              ON akses.id =
                p.id

            WHERE
              LOWER(
                BTRIM(
                  COALESCE(
                    p.status_final,
                    ''
                  )
                )
              ) = 'aktif'

              AND pesanan.tanggal_do
                IS NOT NULL

              AND pesanan.end_date
                IS NOT NULL
          )

          SELECT
            (
              SELECT
                COUNT(*)::integer

              FROM public.proyek_klien
                klien

              INNER JOIN public.proyek p
                ON p.id =
                  klien.proyek_id

              INNER JOIN akses_proyek akses
                ON akses.id =
                  p.id

              CROSS JOIN pengaturan

              WHERE
                LOWER(
                  BTRIM(
                    COALESCE(
                      p.status_final,
                      ''
                    )
                  )
                ) = 'aktif'

                AND klien.tanggal_akhir >=
                  pengaturan.hari_ini

                AND klien.tanggal_akhir <=
                  pengaturan.hari_ini
                  + INTERVAL '3 months'
            ) AS
              kontrak_klien_akan_jatuh_tempo,

            (
              SELECT
                COUNT(*)::integer

              FROM public.proyek_partner
                partner

              INNER JOIN public.proyek p
                ON p.id =
                  partner.proyek_id

              INNER JOIN akses_proyek akses
                ON akses.id =
                  p.id

              CROSS JOIN pengaturan

              WHERE
                LOWER(
                  BTRIM(
                    COALESCE(
                      p.status_final,
                      ''
                    )
                  )
                ) = 'aktif'

                AND partner.tanggal_akhir >=
                  pengaturan.hari_ini

                AND partner.tanggal_akhir <=
                  pengaturan.hari_ini
                  + INTERVAL '3 months'
            ) AS
              kontrak_partner_akan_jatuh_tempo,

            (
              SELECT
                COUNT(*)::integer

              FROM public.proyek_klien
                klien

              INNER JOIN public.proyek p
                ON p.id =
                  klien.proyek_id

              INNER JOIN akses_proyek akses
                ON akses.id =
                  p.id

              CROSS JOIN pengaturan

              WHERE
                LOWER(
                  BTRIM(
                    COALESCE(
                      p.status_final,
                      ''
                    )
                  )
                ) = 'aktif'

                AND klien.tanggal_akhir <
                  pengaturan.hari_ini
            ) AS
              kontrak_klien_jatuh_tempo,

            (
              SELECT
                COUNT(*)::integer

              FROM public.proyek_partner
                partner

              INNER JOIN public.proyek p
                ON p.id =
                  partner.proyek_id

              INNER JOIN akses_proyek akses
                ON akses.id =
                  p.id

              CROSS JOIN pengaturan

              WHERE
                LOWER(
                  BTRIM(
                    COALESCE(
                      p.status_final,
                      ''
                    )
                  )
                ) = 'aktif'

                AND partner.tanggal_akhir <
                  pengaturan.hari_ini
            ) AS
              kontrak_partner_jatuh_tempo,

            (
              SELECT
                COUNT(*)::integer

              FROM timeline_dashboard
                timeline

              CROSS JOIN pengaturan

              WHERE
                timeline.tanggal_akhir >=
                  pengaturan.hari_ini

                AND timeline.tanggal_akhir <=
                  pengaturan.hari_ini
                  + INTERVAL '3 months'
            ) AS
              lisensi_sewa_akan_jatuh_tempo,

            (
              SELECT
                COUNT(*)::integer

              FROM timeline_dashboard
                timeline

              CROSS JOIN pengaturan

              WHERE
                timeline.tanggal_akhir <
                  pengaturan.hari_ini
            ) AS
              lisensi_sewa_jatuh_tempo,

            (
              SELECT
                COUNT(
                  DISTINCT p.id
                )::integer

              FROM public.proyek p

              INNER JOIN akses_proyek akses
                ON akses.id =
                  p.id

              INNER JOIN public.proyek_klien
                klien

                ON klien.proyek_id =
                  p.id

              CROSS JOIN pengaturan

              WHERE
                LOWER(
                  BTRIM(
                    COALESCE(
                      p.status_final,
                      ''
                    )
                  )
                ) = 'aktif'

                AND klien.tanggal_akhir <
                  pengaturan.hari_ini

                AND LOWER(
                  BTRIM(
                    COALESCE(
                      klien.status_teknis,
                      ''
                    )
                  )
                ) NOT IN (
                  'done',
                  'selesai'
                )
            ) AS total_proyek_terlambat
          `,
          [
            bolehLihatSemua,
            picId
          ]
        );

      const data =
        result.rows[0] || {};

      return res.json({
        tahun,

        generated_at:
          new Date().toISOString(),

        contract_overview: {
          kontrak_klien_akan_jatuh_tempo:
            dashboardAngka(
              data
                .kontrak_klien_akan_jatuh_tempo
            ),

          kontrak_partner_akan_jatuh_tempo:
            dashboardAngka(
              data
                .kontrak_partner_akan_jatuh_tempo
            ),

          kontrak_klien_jatuh_tempo:
            dashboardAngka(
              data
                .kontrak_klien_jatuh_tempo
            ),

          kontrak_partner_jatuh_tempo:
            dashboardAngka(
              data
                .kontrak_partner_jatuh_tempo
            ),

          lisensi_sewa_akan_jatuh_tempo:
            dashboardAngka(
              data
                .lisensi_sewa_akan_jatuh_tempo
            ),

          lisensi_sewa_jatuh_tempo:
            dashboardAngka(
              data
                .lisensi_sewa_jatuh_tempo
            ),

          total_proyek_terlambat:
            dashboardAngka(
              data
                .total_proyek_terlambat
            )
        }
      });

    } catch (error) {
      console.error(
        "ERROR DASHBOARD CONTRACT:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);


// ======================================================
// 4. DASHBOARD BUSINESS
// ======================================================

app.get(
  "/api/dashboard/business",

  dashboardRequireLogin,

  async (req, res) => {
    try {
      const {
        tahun,
        bolehLihatSemua,
        picId
      } = dashboardGetContext(req);

      const result =
        await pool.query(
          `
          WITH proyek_aktif AS (
            SELECT
              p.id,

              COALESCE(
                p.updated_at,
                p.created_at
              ) AS terakhir_update

            FROM public.proyek p

            WHERE
              LOWER(
                BTRIM(
                  COALESCE(
                    p.status_final,
                    ''
                  )
                )
              ) = 'aktif'

              AND (
                $1::boolean = TRUE

                OR EXISTS (
                  SELECT 1

                  FROM public.proyek_pic
                    akses

                  WHERE
                    akses.proyek_id =
                      p.id

                    AND akses.pic_id =
                      $2
                )
              )
          ),

          nilai_klien AS (
            SELECT
              aktif.id
                AS proyek_id,

              COALESCE(
                NULLIF(
                  klien.nilai_nego_3,
                  0
                ),
                NULLIF(
                  klien.nilai_nego_2,
                  0
                ),
                NULLIF(
                  klien.nilai_nego_1,
                  0
                ),
                NULLIF(
                  klien.nilai_submit,
                  0
                ),
                (
                  SELECT
                    SUM(
                      COALESCE(
                        termin.nominal,
                        0
                      )
                    )

                  FROM
                    public.proyek_klien_termin
                      termin

                  WHERE
                    termin.proyek_klien_id =
                      klien.id
                ),
                0
              )::numeric
                AS nilai

            FROM proyek_aktif aktif

            LEFT JOIN LATERAL (
              SELECT
                pk.id,
                pk.nilai_submit,
                pk.nilai_nego_1,
                pk.nilai_nego_2,
                pk.nilai_nego_3

              FROM public.proyek_klien pk

              WHERE
                pk.proyek_id =
                  aktif.id

              ORDER BY
                pk.id DESC

              LIMIT 1
            ) klien
              ON TRUE
          ),

          nilai_partner AS (
            SELECT
              partner.proyek_id,

              SUM(
                COALESCE(
                  NULLIF(
                    partner.nilai_nego_3,
                    0
                  ),
                  NULLIF(
                    partner.nilai_nego_2,
                    0
                  ),
                  NULLIF(
                    partner.nilai_nego_1,
                    0
                  ),
                  NULLIF(
                    partner.nilai_submit,
                    0
                  ),
                  (
                    SELECT
                      SUM(
                        COALESCE(
                          termin.nominal,
                          0
                        )
                      )

                    FROM
                      public.proyek_partner_termin
                        termin

                    WHERE
                      termin.proyek_partner_id =
                        partner.id
                  ),
                  0
                )
              )::numeric AS nilai

            FROM public.proyek_partner
              partner

            INNER JOIN proyek_aktif aktif
              ON aktif.id =
                partner.proyek_id

            GROUP BY
              partner.proyek_id
          )

          SELECT
            COALESCE(
              AVG(
                (
                  (
                    klien.nilai -
                    partner.nilai
                  )
                  /
                  NULLIF(
                    klien.nilai,
                    0
                  )
                ) * 100
              ) FILTER (
                WHERE
                  klien.nilai > 0

                  AND partner.nilai >= 0
              ),
              0
            )::numeric
              AS margin_rata_rata,

            (
              SELECT
                COUNT(*)::integer

              FROM proyek_aktif

              WHERE
                terakhir_update <
                  CURRENT_TIMESTAMP
                  - INTERVAL '7 days'
            ) AS proyek_belum_update

          FROM nilai_klien klien

          INNER JOIN nilai_partner partner
            ON partner.proyek_id =
              klien.proyek_id
          `,
          [
            bolehLihatSemua,
            picId
          ]
        );

      const data =
        result.rows[0] || {};

      return res.json({
        tahun,

        generated_at:
          new Date().toISOString(),

        business_performance: {
          margin_rata_rata:
            dashboardAngka(
              data.margin_rata_rata
            ),

          proyek_belum_update:
            dashboardAngka(
              data.proyek_belum_update
            )
        }
      });

    } catch (error) {
      console.error(
        "ERROR DASHBOARD BUSINESS:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ======================================================
// FORMAT ANGKA UNTUK PESAN DASHBOARD
// ======================================================

function formatAngkaDashboard(value) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(
    Number(value) || 0
  );
}

// ======================================================
// IMPORT MASSAL MASTER KLIEN
// ======================================================

app.post("/api/data/import", 
  async (req, res) => {

  const client =
    await pool.connect();


  try {

    const { data } =
      req.body;


    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {

      return res.status(400).json({
        error:
          "Data import tidak ditemukan"
      });

    }


    await client.query("BEGIN");


    let total = 0;


    for (const item of data) {

      let no_pic =
        item.no_pic
          ? String(item.no_pic).trim()
          : "";


      // hapus spasi, strip dan kurung
      no_pic =
        no_pic.replace(
          /[\s\-()]/g,
          ""
        );


      // +62xxxx menjadi 62xxxx
      if (
        no_pic.startsWith("+62")
      ) {

        no_pic =
          no_pic.substring(1);

      }


      // 08xxx menjadi 628xxx
      if (
        no_pic.startsWith("0")
      ) {

        no_pic =
          "62" +
          no_pic.substring(1);

      }


      if (
        !item.perusahaan_klien ||
        !String(
          item.perusahaan_klien
        ).trim()
      ) {

        continue;

      }


      await client.query(
        `INSERT INTO public.data (
          perusahaan_klien,
          inisial,
          nama_pic,
          no_pic,
          email_pic
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5
        )`,
        [
          String(
            item.perusahaan_klien
          ).trim(),

          item.inisial
            ? String(
                item.inisial
              ).trim()
            : null,

          item.nama_pic
            ? String(
                item.nama_pic
              ).trim()
            : null,

          no_pic || null,

          item.email_pic
            ? String(
                item.email_pic
              ).trim()
            : null
        ]
      );


      total++;

    }


    await client.query(
      "COMMIT"
    );


    res.status(201).json({

      message:
        "Import berhasil",

      total

    });


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );


    console.error(
      "ERROR IMPORT KLIEN:",
      error
    );


    res.status(500).json({
      error: error.message
    });


  } finally {

    client.release();

  }

});

// ======================================================
// GET KATEGORI PRODUK AKTIF
// ======================================================

app.get(
  "/api/proyek/kategori",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT
            id,
            nama_kategori_produk,
            total_nilai,
            status
          FROM public.kategori_produk
          WHERE LOWER(status) = 'aktif'
          ORDER BY nama_kategori_produk ASC
        `);


      res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET KATEGORI AKTIF:",
        error
      );


      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// GET JENIS PROYEK UTAMA AKTIF
// ======================================================

app.get(
  "/api/proyek/jenis",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT
            id,
            name,
            deskripsi,
            status
          FROM public.jenis_proyek
          WHERE parent_id IS NULL
            AND LOWER(status) = 'aktif'
          ORDER BY id ASC
        `);


      res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET JENIS PROYEK:",
        error
      );


      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// GET SUB JENIS BERDASARKAN JENIS INDUK
// ======================================================

app.get(
  "/api/proyek/sub-jenis",
  async (req, res) => {

    try {

      const jenisId =
        Number(
          req.query.jenis_id
        );


      if (
        !Number.isInteger(jenisId) ||
        jenisId <= 0
      ) {

        return res.status(400).json({
          error:
            "jenis_id tidak valid"
        });

      }


      const result =
        await pool.query(
          `
            SELECT
              id,
              name,
              deskripsi,
              status,
              parent_id
            FROM public.jenis_proyek
            WHERE parent_id = $1
              AND LOWER(status) = 'aktif'
            ORDER BY id ASC
          `,
          [
            jenisId
          ]
        );


      res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET SUB JENIS PROYEK:",
        error
      );


      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// GET SEMUA STATUS PROYEK AKTIF
// ======================================================

app.get(
  "/api/proyek/status",
  async (req, res) => {

    try {

      const allowedFlags = [
        "pengadaan",
        "teknis",
        "administrasi",
        "final"
      ];


      const flag =
        req.query.flag
          ? String(
              req.query.flag
            ).toLowerCase()
          : null;


      if (
        flag &&
        !allowedFlags.includes(flag)
      ) {

        return res.status(400).json({
          error:
            "Flag status tidak valid"
        });

      }


      const result =
        await pool.query(
          `
            SELECT
              id,
              deskripsi,
              LOWER(flag) AS flag,
              status,
              created_at,
              updated_at
            FROM public.status_proyek
            WHERE LOWER(status) = 'aktif'
              AND (
                $1::text IS NULL
                OR LOWER(flag) = $1
              )
            ORDER BY
              LOWER(flag) ASC,
              id ASC
          `,
          [
            flag
          ]
        );


      res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET STATUS PROYEK:",
        error
      );


      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// GET KLIEN
// HANYA TAMBAHKAN JIKA BELUM ADA
// ======================================================

app.get(
  "/api/proyek/klien",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT
            id,
            perusahaan_klien,
            inisial,
            nama_pic,
            no_pic,
            email_pic
          FROM public.data
          ORDER BY perusahaan_klien ASC
        `);


      res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET KLIEN:",
        error
      );


      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// GET PARTNER
// HANYA TAMBAHKAN JIKA BELUM ADA
// ======================================================

app.get(
  "/api/proyek/partner",
  async (req, res) => {

    try {

      const result =
        await pool.query(`
          SELECT
            id,
            nama_partner
          FROM public.partner
          ORDER BY nama_partner ASC
        `);


      res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET PARTNER:",
        error
      );


      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// GET PIC BERDASARKAN KATEGORI
// ======================================================

app.get(
  "/api/proyek/kategori/:kategoriId/pic",
  async (req, res) => {

    try {

      const kategoriId =
        Number(
          req.params.kategoriId
        );


      if (
        !Number.isInteger(kategoriId) ||
        kategoriId <= 0
      ) {

        return res.status(400).json({
          error:
            "Kategori tidak valid"
        });

      }


      const result =
        await pool.query(
          `
            SELECT DISTINCT
              p.id,
              p.nama,
              p.nik,
              p.inisial,
              p.jabatan,
              p.email,
              p.no_hp
            FROM public.kategori_produk_pic kpp

            JOIN public.pic p
              ON p.id = kpp.pic_id

            WHERE
              kpp.kategori_produk_id = $1

            ORDER BY
              p.nama ASC
          `,
          [
            kategoriId
          ]
        );


      res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET PIC KATEGORI:",
        error
      );


      res.status(500).json({
        error: error.message
      });

    }

  }
);

// KLIEN
app.get(
  "/api/proyek/klien",
  async (req, res) => {

    try {

      const { rows } =
        await pool.query(`
          SELECT
            id,
            perusahaan_klien,
            inisial,
            nama_pic
          FROM public.data
          ORDER BY perusahaan_klien ASC
        `);

      res.json(rows);

    } catch (error) {

      console.error(
        "ERROR GET KLIEN:",
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// PARTNER AKTIF
app.get(
  "/api/proyek/partner",
  async (req, res) => {

    try {

      const { rows } =
        await pool.query(`
          SELECT
            id,
            nama_partner,
            inisial,
            jenis_partner,
            status
          FROM public.partner
          WHERE status = 'Aktif'
          ORDER BY nama_partner ASC
        `);

      res.json(rows);

    } catch (error) {

      console.error(
        "ERROR GET PARTNER:",
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// ======================================================
// GET DAFTAR PROYEK
// ======================================================
// ======================================================
// GET DAFTAR PROYEK
//
// ADMIN:
// Melihat seluruh proyek.
//
// PIC:
// Hanya melihat proyek yang terdaftar
// pada tabel public.proyek_pic.
// ======================================================

app.get(
  "/api/proyek",
  async (req, res) => {
    // =============================================
    // VALIDASI LOGIN
    // =============================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    try {
      const user =
        req.session.user;

      const isAdmin =
        String(user.role || "")
          .trim()
          .toLowerCase() === "admin";

      const userId =
        Number(user.id);

      const picId =
        Number.isInteger(userId) &&
        userId > 0
          ? userId
          : null;

      // =============================================
      // AMBIL DAFTAR PROYEK
      // =============================================

      const result =
        await pool.query(
          `
          SELECT
            p.id,
            p.kategori_produk_id,
            p.nama_proyek,
            p.deskripsi,
            p.jenis_proyek,
            p.sub_jenis_proyek,
            p.status_final,
            p.created_at,
            p.updated_at,

            -- =====================================
            -- KATEGORI
            -- =====================================

            COALESCE(
              kategori.nama_kategori_produk,
              kategori_legacy.nama_kategori_produk,
              '-'
            ) AS nama_kategori_produk,

            COALESCE(
              kategori.kategori_produk_list,
              CASE
                WHEN kategori_legacy.nama_kategori_produk
                  IS NOT NULL
                THEN ARRAY[
                  kategori_legacy.nama_kategori_produk
                ]::text[]
                ELSE ARRAY[]::text[]
              END
            ) AS kategori_produk_list,

            COALESCE(
              kategori.kategori_produk_ids,
              CASE
                WHEN kategori_legacy.id
                  IS NOT NULL
                THEN ARRAY[
                  kategori_legacy.id
                ]::integer[]
                ELSE ARRAY[]::integer[]
              END
            ) AS kategori_produk_ids,

            -- =====================================
            -- PIC PROYEK
            -- =====================================

            COALESCE(
              daftar_pic.nama_pic,
              ''
            ) AS nama_pic,

            COALESCE(
              daftar_pic.nama_pic_list,
              ARRAY[]::text[]
            ) AS nama_pic_list,

            COALESCE(
              daftar_pic.pic_ids,
              ARRAY[]::integer[]
            ) AS pic_ids,

            -- =====================================
            -- INFORMASI KLIEN TERAKHIR
            -- =====================================

            klien.proyek_klien_id,
            klien.klien_id,
            klien.nama_klien,
            klien.tanggal_mulai,
            klien.tanggal_akhir,
            klien.model_pembayaran,
            klien.status_pengadaan,
            klien.status_teknis,

            COALESCE(
              klien.nilai_final_klien,
              0
            )::numeric AS nilai_final_klien,

            -- =====================================
            -- INFORMASI PARTNER
            -- =====================================

            COALESCE(
              partner.nama_partner,
              ''
            ) AS nama_partner,

            COALESCE(
              partner.nilai_final_partner,
              0
            )::numeric AS nilai_final_partner,

            -- =====================================
            -- PERHITUNGAN MARGIN
            -- =====================================

            (
              COALESCE(
                klien.nilai_final_klien,
                0
              )
              -
              COALESCE(
                partner.nilai_final_partner,
                0
              )
            )::numeric AS nilai_margin,

            CASE
              WHEN COALESCE(
                klien.nilai_final_klien,
                0
              ) > 0
              THEN ROUND(
                (
                  (
                    COALESCE(
                      klien.nilai_final_klien,
                      0
                    )
                    -
                    COALESCE(
                      partner.nilai_final_partner,
                      0
                    )
                  )
                  /
                  klien.nilai_final_klien
                ) * 100,
                2
              )
              ELSE 0
            END AS persentase_margin

          FROM public.proyek p

          -- =======================================
          -- KATEGORI LEGACY
          -- =======================================

          LEFT JOIN public.kategori_produk
            kategori_legacy
            ON kategori_legacy.id =
               p.kategori_produk_id

          -- =======================================
          -- SEMUA KATEGORI PROYEK
          -- =======================================

          LEFT JOIN LATERAL (
            SELECT
              MIN(
                master_kategori.nama_kategori_produk
              ) AS nama_kategori_produk,

              ARRAY_AGG(
                DISTINCT
                master_kategori.nama_kategori_produk

                ORDER BY
                  master_kategori.nama_kategori_produk
              ) AS kategori_produk_list,

              ARRAY_AGG(
                DISTINCT
                master_kategori.id

                ORDER BY
                  master_kategori.id
              ) AS kategori_produk_ids

            FROM public.proyek_kategori relasi

            INNER JOIN public.kategori_produk
              master_kategori
              ON master_kategori.id =
                 relasi.kategori_produk_id

            WHERE relasi.proyek_id =
                  p.id
          ) kategori
            ON TRUE

          -- =======================================
          -- SEMUA PIC PROYEK
          -- =======================================

          LEFT JOIN LATERAL (
            SELECT
              STRING_AGG(
                data_pic.nama_pic,
                ', '

                ORDER BY
                  data_pic.nama_pic
              ) AS nama_pic,

              ARRAY_AGG(
                data_pic.nama_pic

                ORDER BY
                  data_pic.nama_pic
              ) AS nama_pic_list,

              ARRAY_AGG(
                data_pic.id

                ORDER BY
                  data_pic.id
              ) AS pic_ids

            FROM (
              SELECT DISTINCT
                master_pic.id,

                COALESCE(
                  NULLIF(
                    TRIM(master_pic.nama),
                    ''
                  ),

                  NULLIF(
                    TRIM(master_pic.inisial),
                    ''
                  ),

                  'PIC ' ||
                  master_pic.id::text
                ) AS nama_pic

              FROM public.proyek_pic relasi_pic

              INNER JOIN public.pic master_pic
                ON master_pic.id =
                   relasi_pic.pic_id

              WHERE relasi_pic.proyek_id =
                    p.id
            ) data_pic
          ) daftar_pic
            ON TRUE

          -- =======================================
          -- KLIEN TERAKHIR
          -- =======================================

          LEFT JOIN LATERAL (
            SELECT
              pk.id AS proyek_klien_id,
              pk.klien_id,

              data_klien.perusahaan_klien
                AS nama_klien,

              pk.tanggal_mulai,
              pk.tanggal_akhir,
              pk.model_pembayaran,
              pk.status_pengadaan,
              pk.status_teknis,

              COALESCE(
                NULLIF(
                  pk.nilai_nego_3,
                  0
                ),

                NULLIF(
                  pk.nilai_nego_2,
                  0
                ),

                NULLIF(
                  pk.nilai_nego_1,
                  0
                ),

                NULLIF(
                  pk.nilai_submit,
                  0
                ),

                (
                  SELECT
                    SUM(
                      COALESCE(
                        termin_klien.nominal,
                        0
                      )
                    )

                  FROM public.proyek_klien_termin
                    termin_klien

                  WHERE
                    termin_klien.proyek_klien_id =
                    pk.id
                ),

                0
              )::numeric AS nilai_final_klien

            FROM public.proyek_klien pk

            LEFT JOIN public.data data_klien
              ON data_klien.id =
                 pk.klien_id

            WHERE pk.proyek_id =
                  p.id

            ORDER BY
              pk.id DESC

            LIMIT 1
          ) klien
            ON TRUE

          -- =======================================
          -- SEMUA PARTNER PROYEK
          -- =======================================

          LEFT JOIN LATERAL (
            SELECT
              STRING_AGG(
                data_partner.nama_partner,
                ', '

                ORDER BY
                  data_partner.nama_partner
              ) AS nama_partner,

              SUM(
                data_partner.nilai_final
              )::numeric AS nilai_final_partner

            FROM (
              SELECT
                pp.id,

                COALESCE(
                  NULLIF(
                    TRIM(master_partner.nama_partner),
                    ''
                  ),
                  '-'
                ) AS nama_partner,

                COALESCE(
                  NULLIF(
                    pp.nilai_nego_3,
                    0
                  ),

                  NULLIF(
                    pp.nilai_nego_2,
                    0
                  ),

                  NULLIF(
                    pp.nilai_nego_1,
                    0
                  ),

                  NULLIF(
                    pp.nilai_submit,
                    0
                  ),

                  (
                    SELECT
                      SUM(
                        COALESCE(
                          termin_partner.nominal,
                          0
                        )
                      )

                    FROM public.proyek_partner_termin
                      termin_partner

                    WHERE
                      termin_partner.proyek_partner_id =
                      pp.id
                  ),

                  0
                )::numeric AS nilai_final

              FROM public.proyek_partner pp

              LEFT JOIN public.partner
                master_partner
                ON master_partner.id =
                   pp.partner_id

              WHERE pp.proyek_id =
                    p.id
            ) data_partner
          ) partner
            ON TRUE

          -- =======================================
          -- HAK AKSES
          -- Admin melihat semua.
          -- Selain Admin hanya proyek PIC terkait.
          -- =======================================

          WHERE
            $1::boolean = TRUE

            OR EXISTS (
              SELECT 1

              FROM public.proyek_pic auth_pic

              WHERE
                auth_pic.proyek_id =
                  p.id

                AND auth_pic.pic_id =
                  $2
            )

          ORDER BY
            CASE
              WHEN LOWER(
                TRIM(
                  COALESCE(
                    p.status_final,
                    ''
                  )
                )
              ) = 'aktif'
              THEN 1

              WHEN LOWER(
                TRIM(
                  COALESCE(
                    p.status_final,
                    ''
                  )
                )
              ) = 'done'
              THEN 2

              ELSE 0
            END,

            p.nama_proyek ASC,
            p.id DESC
          `,
          [
            isAdmin,
            picId
          ]
        );

      // =============================================
// NORMALISASI RESPONSE
// =============================================

const data =
  result.rows.map(proyek => ({
    ...proyek,

    nama_pic:
      String(
        proyek.nama_pic || ""
      ).trim(),

    nama_pic_list:
      Array.isArray(
        proyek.nama_pic_list
      )
        ? proyek.nama_pic_list
        : [],

    pic_ids:
      Array.isArray(
        proyek.pic_ids
      )
        ? proyek.pic_ids
            .map(Number)
            .filter(Number.isInteger)
        : [],

    kategori_produk_list:
      Array.isArray(
        proyek.kategori_produk_list
      )
        ? proyek.kategori_produk_list
        : [],

    kategori_produk_ids:
      Array.isArray(
        proyek.kategori_produk_ids
      )
        ? proyek.kategori_produk_ids
            .map(Number)
            .filter(Number.isInteger)
        : [],

    nilai_final_klien:
      Number(
        proyek.nilai_final_klien || 0
      ),

    nilai_final_partner:
      Number(
        proyek.nilai_final_partner || 0
      ),

    nilai_margin:
      Number(
        proyek.nilai_margin || 0
      ),

    persentase_margin:
      Number(
        proyek.persentase_margin || 0
      )
  }));

return res.json(data);

    } catch (error) {
      console.error(
        "ERROR GET DAFTAR PROYEK:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// CREATE PROYEK
app.post(
  "/api/proyek",
  async (req, res) => {

    const client =
      await pool.connect();


    try {
    // ==================================================
// VALIDASI LOGIN DAN PIC PEMBUAT
// ==================================================

if (!req.session?.user) {
  return res.status(401).json({
    error: "Belum login"
  });
}

const picLoginId =
  Number(
    req.session.user.pic_id ||
    req.session.user.id
  );

if (
  !Number.isInteger(picLoginId) ||
  picLoginId <= 0
) {
  return res.status(403).json({
    error:
      "PIC pengguna login tidak valid"
  });
}

      const {
        kategori_produk_ids,

        jenis_proyek,
        jenis_proyek_id,

        sub_jenis_proyek,
        sub_jenis_proyek_id,

        nama_proyek,
        deskripsi,

        status_final,
        status_final_id,

        pic_ids,

        klien_id,

        nilai_submit_klien,
        nilai_nego_1_klien,
        nilai_nego_2_klien,
        nilai_nego_3_klien,

        tanggal_mulai_klien,
        tanggal_akhir_klien,

        model_pembayaran_klien,
        jumlah_bulan_klien,
        jumlah_hari_klien,

        status_pengadaan_klien,
        status_teknis_klien,
        status_administrasi_klien,

        partners = []

      } = req.body;


      // ==================================================
      // HELPER ANGKA
      // ==================================================

      const numberOrNull =
        value => {

          if (
            value === "" ||
            value === null ||
            value === undefined
          ) {

            return null;

          }


          const number =
            Number(value);


          return Number.isFinite(number)
            ? number
            : null;

        };


      // ==================================================
      // VALIDASI KATEGORI
      // ==================================================

      if (
        !Array.isArray(
          kategori_produk_ids
        ) ||
        kategori_produk_ids.length === 0
      ) {

        return res.status(400).json({
          error:
            "Minimal satu kategori wajib dipilih"
        });

      }


      const kategoriIds =
        [
          ...new Set(

            kategori_produk_ids

              .map(Number)

              .filter(
                id =>
                  Number.isInteger(id) &&
                  id > 0
              )

          )
        ];


      if (
        kategoriIds.length === 0
      ) {

        return res.status(400).json({
          error:
            "Kategori tidak valid"
        });

      }


      const kategoriUtamaId =
        kategoriIds[0];


      // ==================================================
      // VALIDASI JENIS PROYEK
      // ==================================================

      const jenisProyekId =
        numberOrNull(
          jenis_proyek_id
        );


      if (
        !jenisProyekId ||
        !Number.isInteger(
          jenisProyekId
        )
      ) {

        return res.status(400).json({
          error:
            "Jenis proyek wajib dipilih"
        });

      }


      // ==================================================
      // VALIDASI NAMA PROYEK
      // ==================================================

      if (
        !nama_proyek ||
        !nama_proyek.trim()
      ) {

        return res.status(400).json({
          error:
            "Nama proyek wajib diisi"
        });

      }


      // ==================================================
      // VALIDASI PARTNERS
      // ==================================================

      if (
        !Array.isArray(partners)
      ) {

        return res.status(400).json({
          error:
            "Format data partner tidak valid"
        });

      }


      // ==================================================
      // MULAI TRANSAKSI
      // ==================================================

      await client.query(
        "BEGIN"
      );
      await client.query(
        "SET LOCAL lock_timeout = '10s'"
      );

      await client.query(
        "SET LOCAL statement_timeout = '60s'"
      );


      // ==================================================
      // CEK KATEGORI AKTIF
      // ==================================================

      const kategoriCheck =
        await client.query(
          `
            SELECT id
            FROM public.kategori_produk
            WHERE id = ANY($1::bigint[])
              AND LOWER(status) = 'aktif'
          `,
          [
            kategoriIds
          ]
        );


      if (
        kategoriCheck.rows.length !==
        kategoriIds.length
      ) {

        const error =
          new Error(
            "Terdapat kategori yang tidak ditemukan atau sudah tidak aktif"
          );

        error.statusCode =
          400;

        throw error;

      }


      // ==================================================
      // CEK JENIS PROYEK UTAMA
      // ==================================================

      const jenisResult =
        await client.query(
          `
            SELECT
              id,
              name,
              parent_id
            FROM public.jenis_proyek
            WHERE id = $1
              AND parent_id IS NULL
              AND LOWER(status) = 'aktif'
          `,
          [
            jenisProyekId
          ]
        );


      if (
        jenisResult.rows.length === 0
      ) {

        const error =
          new Error(
            "Jenis proyek tidak ditemukan atau sudah tidak aktif"
          );

        error.statusCode =
          400;

        throw error;

      }


      const jenisData =
        jenisResult.rows[0];


      // ==================================================
      // CEK SUB JENIS
      // ==================================================

      let subJenisProyekId =
        numberOrNull(
          sub_jenis_proyek_id
        );


      let subJenisData =
        null;


      if (subJenisProyekId) {

        const subJenisResult =
          await client.query(
            `
              SELECT
                id,
                name,
                parent_id
              FROM public.jenis_proyek
              WHERE id = $1
                AND parent_id = $2
                AND LOWER(status) = 'aktif'
            `,
            [
              subJenisProyekId,
              jenisProyekId
            ]
          );


        if (
          subJenisResult.rows.length === 0
        ) {

          const error =
            new Error(
              "Sub jenis tidak sesuai dengan jenis proyek yang dipilih"
            );

          error.statusCode =
            400;

          throw error;

        }


        subJenisData =
          subJenisResult.rows[0];

      }


      // ==================================================
      // CEK STATUS FINAL
      // ==================================================

      let statusFinalId =
        numberOrNull(
          status_final_id
        );


      let statusFinalValue =
        status_final || null;


      if (statusFinalId) {

        const statusFinalResult =
          await client.query(
            `
              SELECT
                id,
                deskripsi
              FROM public.status_proyek
              WHERE id = $1
                AND LOWER(flag) = 'final'
                AND LOWER(status) = 'aktif'
            `,
            [
              statusFinalId
            ]
          );


        if (
          statusFinalResult.rows.length === 0
        ) {

          const error =
            new Error(
              "Status final tidak ditemukan atau sudah tidak aktif"
            );

          error.statusCode =
            400;

          throw error;

        }


        statusFinalValue =
          statusFinalResult
            .rows[0]
            .deskripsi;

      }


      // ==================================================
      // PROYEK UTAMA
      // ==================================================

      const proyekResult =
        await client.query(
          `
            INSERT INTO public.proyek
            (
              kategori_produk_id,

              jenis_proyek,
              jenis_proyek_id,

              sub_jenis_proyek,
              sub_jenis_proyek_id,

              nama_proyek,
              deskripsi,

              status_final,
              status_final_id
            )
            VALUES
            (
              $1,

              $2,
              $3,

              $4,
              $5,

              $6,
              $7,

              $8,
              $9
            )
            RETURNING *
          `,
          [
            kategoriUtamaId,

            jenisData.name,
            jenisData.id,

            subJenisData
              ? subJenisData.name
              : null,

            subJenisData
              ? subJenisData.id
              : null,

            nama_proyek.trim(),

            deskripsi
              ? String(deskripsi).trim()
              : null,

            statusFinalValue,

            statusFinalId
          ]
        );


      const proyek =
        proyekResult.rows[0];


      // ==================================================
      // MULTI KATEGORI
      // ==================================================

      for (
        const kategoriId
        of kategoriIds
      ) {

        await client.query(
          `
            INSERT INTO public.proyek_kategori
            (
              proyek_id,
              kategori_produk_id
            )
            VALUES
            (
              $1,
              $2
            )
            ON CONFLICT DO NOTHING
          `,
          [
            proyek.id,
            kategoriId
          ]
        );

      }


      // ==================================================
// PIC PROYEK
// PIC LOGIN OTOMATIS IKUT TERSIMPAN
// ==================================================

const picIdsDariForm =
  Array.isArray(pic_ids)
    ? pic_ids
        .map(Number)
        .filter(
          id =>
            Number.isInteger(id) &&
            id > 0
        )
    : [];

/*
 * Gabungkan PIC pilihan dari form
 * dengan PIC pengguna yang membuat proyek.
 */

const uniquePicIds =
  [
    ...new Set([
      ...picIdsDariForm,
      picLoginId
    ])
  ];

// ==================================================
// VALIDASI SEMUA PIC
// ==================================================

const picCheck =
  await client.query(
    `
    SELECT
      id,
      nama,
      jabatan

    FROM public.pic

    WHERE id =
      ANY($1::bigint[])
    `,
    [
      uniquePicIds
    ]
  );

if (
  picCheck.rows.length !==
  uniquePicIds.length
) {
  const ditemukan =
    new Set(
      picCheck.rows.map(
        item =>
          Number(item.id)
      )
    );

  const tidakDitemukan =
    uniquePicIds.filter(
      id =>
        !ditemukan.has(
          Number(id)
        )
    );

  const error =
    new Error(
      `PIC tidak ditemukan: ${
        tidakDitemukan.join(", ")
      }`
    );

  error.statusCode = 400;

  throw error;
}

// ==================================================
// SIMPAN PIC PROYEK
// ==================================================

for (
  const picId
  of uniquePicIds
) {
  await client.query(
    `
    INSERT INTO public.proyek_pic (
      proyek_id,
      pic_id
    )

    VALUES (
      $1,
      $2
    )

    ON CONFLICT DO NOTHING
    `,
    [
      proyek.id,
      picId
    ]
  );
}


      // ==================================================
      // INFORMASI KLIEN
      // ==================================================

      const klienId =
        numberOrNull(
          klien_id
        );


      if (klienId) {

        await client.query(
          `
            INSERT INTO public.proyek_klien
            (
              proyek_id,
              klien_id,

              nilai_submit,
              nilai_nego_1,
              nilai_nego_2,
              nilai_nego_3,

              tanggal_mulai,
              tanggal_akhir,

              model_pembayaran,
              jumlah_bulan,
              jumlah_hari,

              status_pengadaan,
              status_teknis,
              status_administrasi
            )
            VALUES
            (
              $1,
              $2,

              $3,
              $4,
              $5,
              $6,

              $7,
              $8,

              $9,
              $10,
              $11,

              $12,
              $13,
              $14
            )
          `,
          [
            proyek.id,
            klienId,

            numberOrNull(
              nilai_submit_klien
            ) ?? 0,

            numberOrNull(
              nilai_nego_1_klien
            ),

            numberOrNull(
              nilai_nego_2_klien
            ),

            numberOrNull(
              nilai_nego_3_klien
            ),

            tanggal_mulai_klien ||
              null,

            tanggal_akhir_klien ||
              null,

            model_pembayaran_klien ||
              null,

            numberOrNull(
              jumlah_bulan_klien
            ),

            numberOrNull(
              jumlah_hari_klien
            ),

            status_pengadaan_klien ||
              null,

            status_teknis_klien ||
              null,

            status_administrasi_klien ||
              null
          ]
        );

      }


      // ==================================================
      // MULTI PARTNER
      // ==================================================

      const partnerIds =
        new Set();


      for (
        const item
        of partners
      ) {

        const partnerId =
          numberOrNull(
            item.partner_id
          );


        if (!partnerId) {
          continue;
        }


        if (
          partnerIds.has(
            partnerId
          )
        ) {

          const error =
            new Error(
              "Partner tidak boleh dipilih lebih dari satu kali"
            );

          error.statusCode =
            400;

          throw error;

        }


        partnerIds.add(
          partnerId
        );


        await client.query(
          `
            INSERT INTO public.proyek_partner
            (
              proyek_id,
              partner_id,

              nilai_submit,
              nilai_nego_1,
              nilai_nego_2,
              nilai_nego_3,

              tanggal_mulai,
              tanggal_akhir,

              model_pembayaran,
              jumlah_bulan,
              jumlah_hari,

              status_pengadaan,
              status_teknis,
              status_administrasi
            )
            VALUES
            (
              $1,
              $2,

              $3,
              $4,
              $5,
              $6,

              $7,
              $8,

              $9,
              $10,
              $11,

              $12,
              $13,
              $14
            )
          `,
          [
            proyek.id,
            partnerId,

            numberOrNull(
              item.nilai_submit
            ) ?? 0,

            numberOrNull(
              item.nilai_nego_1
            ),

            numberOrNull(
              item.nilai_nego_2
            ),

            numberOrNull(
              item.nilai_nego_3
            ),

            item.tanggal_mulai ||
              null,

            item.tanggal_akhir ||
              null,

            item.model_pembayaran ||
              null,

            numberOrNull(
              item.jumlah_bulan
            ),

            numberOrNull(
              item.jumlah_hari
            ),

            item.status_pengadaan ||
              null,

            item.status_teknis ||
              null,

            item.status_administrasi ||
              null
          ]
        );

      }


// ==================================================
// ACTIVITY LOG - CREATE PROYEK
// ==================================================

const activityUser =
  getActivityUser(req);


await simpanActivityLog(
  client,
  {
    pic_id:
      activityUser.pic_id,

    nama_pic:
      activityUser.nama_pic,

    aktivitas:
      "CREATE",

    modul:
      "Proyek",

    entity_id:
      proyek.id,

    entity_nama:
      proyek.nama_proyek,

    field_name:
      null,

    nilai_lama:
      null,

    nilai_baru:
      proyek.nama_proyek,

    deskripsi:
      `membuat proyek ${proyek.nama_proyek}`
  }
);


// ==================================================
// SELESAI
// ==================================================

await client.query(
  "COMMIT"
);


      return res.status(201).json({
  message:
    "Proyek berhasil ditambahkan",

  id:
    proyek.id,

  proyek,

  pic_ids:
    uniquePicIds,

  pic_pembuat_id:
    picLoginId
});

        } catch (error) {

      // ================================================
      // ROLLBACK TRANSAKSI
      // ================================================

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (rollbackError) {

        console.error(
          "ERROR ROLLBACK CREATE PROYEK:",
          rollbackError
        );

      }


      // ================================================
      // LOG ERROR
      // ================================================

      console.error(
        "ERROR CREATE PROYEK:",
        error
      );


      // Hindari mengirim response dua kali
      if (res.headersSent) {
        return;
      }


      // ================================================
      // RESPONSE ERROR
      // ================================================

      if (
        error.code === "23503"
      ) {

        return res.status(400).json({
          error:
            "Data PIC, kategori, klien, partner, atau master yang dipilih tidak valid."
        });

      }


      if (
        error.code === "23505"
      ) {

        return res.status(409).json({
          error:
            "Data proyek atau relasi yang sama sudah tersedia."
        });

      }


      if (
  error.code === "23514"
) {

  console.error(
    "CHECK CONSTRAINT CREATE PROYEK:",
    {
      table:
        error.table || null,

      constraint:
        error.constraint || null,

      column:
        error.column || null,

      detail:
        error.detail || null,

      message:
        error.message || null
    }
  );

  return res.status(400).json({
    error:
      error.constraint
        ? `Data proyek tidak memenuhi ketentuan database: ${error.constraint}`
        : "Data proyek tidak memenuhi ketentuan database.",

    detail:
      error.detail || null
  });

}


      if (
        error.code === "22P02"
      ) {

        return res.status(400).json({
          error:
            "Format ID atau nilai angka tidak valid."
        });

      }


      if (
        error.code === "55P03"
      ) {

        return res.status(409).json({
          error:
            "Data sedang digunakan oleh proses lain. Silakan coba kembali."
        });

      }


      if (
        error.code === "57014"
      ) {

        return res.status(408).json({
          error:
            "Proses penyimpanan terlalu lama. Silakan coba kembali."
        });

      }


      return res.status(
        Number(error.statusCode) || 500
      ).json({
        error:
          error.message ||
          "Gagal menyimpan proyek."
      });


    } finally {

      // ================================================
      // KEMBALIKAN CONNECTION KE POOL
      // ================================================

      client.release();

    }

  }
);

// HAPUS PROYEK
app.delete(
  "/api/proyek/:proyekId",
  async (req, res) => {
    const client =
      await pool.connect();

    let transactionStarted =
      false;

    try {
      // ================================================
      // CEK LOGIN
      // ================================================

      if (
        !req.session ||
        !req.session.user
      ) {
        return res.status(401).json({
          error:
            "Belum login."
        });
      }


      // ================================================
      // HANYA ADMIN
      // ================================================

      const role =
        String(
          req.session.user.role ||
          ""
        )
          .trim()
          .toLowerCase();

      if (role !== "admin") {
        return res.status(403).json({
          error:
            "Hanya admin yang dapat menghapus proyek."
        });
      }


      // ================================================
      // VALIDASI ID
      // ================================================

      const proyekId =
        Number(
          req.params.proyekId
        );

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID proyek tidak valid."
        });
      }


      await client.query("BEGIN");

      transactionStarted = true;


      // ================================================
      // HAPUS PROYEK
      // Relasi anak harus memakai ON DELETE CASCADE
      // ================================================

      const result =
        await client.query(
          `
          DELETE FROM public.proyek

          WHERE id = $1

          RETURNING
            id,
            nama_proyek
          `,
          [proyekId]
        );


      if (result.rows.length === 0) {
        await client.query(
          "ROLLBACK"
        );

        transactionStarted =
          false;

        return res.status(404).json({
          error:
            "Proyek tidak ditemukan."
        });
      }


      await client.query(
        "COMMIT"
      );

      transactionStarted =
        false;


      return res.json({
        message:
          "Proyek berhasil dihapus.",

        data:
          result.rows[0]
      });

    } catch (error) {
      if (transactionStarted) {
        await client.query(
          "ROLLBACK"
        );
      }

      console.error(
        "ERROR HAPUS PROYEK:",
        error
      );


      // Foreign key masih menghalangi penghapusan
      if (
  error.code === "23503"
) {

  console.error(
    "FOREIGN KEY ERROR PROYEK SEWA:",
    {
      constraint:
        error.constraint,

      detail:
        error.detail,

      table:
        error.table
    }
  );

  return res.status(400).json({
    error:
      "Data master yang dipilih tidak valid atau sudah tidak tersedia.",

    constraint:
      error.constraint,

    detail:
      error.detail
  });

}

      return res.status(500).json({
        error:
          error.message ||
          "Terjadi kesalahan saat menghapus proyek."
      });

    } finally {
      client.release();
    }
  }
);

// DAFTAR PROYEK
app.get(
  "/api/proyek-listing",
  async (req, res) => {

    // ==================================================
    // VALIDASI LOGIN
    // ==================================================

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login"
      });

    }


    const user =
      req.session.user;


    const isAdmin =
      String(
        user.role || ""
      )
        .trim()
        .toLowerCase() ===
      "admin";


    const sessionPicInput =
      Number(user.id);


    const sessionPicId =
      Number.isInteger(sessionPicInput) &&
      sessionPicInput > 0
        ? sessionPicInput
        : null;


    // ==================================================
    // FILTER DARI DASHBOARD
    // ==================================================

    const jenisProyekFilter =
      String(
        req.query.jenis_proyek || ""
      ).trim();


    const picFilterInput =
      Number(
        req.query.pic_id
      );


    const picFilterId =
      Number.isInteger(picFilterInput) &&
      picFilterInput > 0
        ? picFilterInput
        : null;


    try {

      const result =
        await pool.query(
          `
          SELECT
            p.id,
            p.nama_proyek,
            p.jenis_proyek,
            p.sub_jenis_proyek,
            p.status_final,
            p.created_at,
            p.updated_at,


            /* =========================================
               INFORMASI PIC PROYEK
            ========================================= */

            COALESCE(
              daftar_pic.nama_pic,
              ''
            ) AS nama_pic,

            COALESCE(
              daftar_pic.nama_pic_list,
              ARRAY[]::TEXT[]
            ) AS nama_pic_list,

            COALESCE(
              daftar_pic.pic_ids,
              ARRAY[]::INTEGER[]
            ) AS pic_ids,

            COALESCE(
              daftar_pic.pic_list,
              '[]'::JSONB
            ) AS pic_list,


            /* =========================================
               KATEGORI PROYEK
            ========================================= */

            COALESCE(
              kategori.nama_kategori_produk,
              '-'
            ) AS nama_kategori_produk,

            COALESCE(
              kategori.nama_kategori_produk_list,
              ARRAY[]::TEXT[]
            ) AS nama_kategori_produk_list,


            /* =========================================
               INFORMASI KLIEN
            ========================================= */

            klien.proyek_klien_id,
            klien.klien_id,
            klien.perusahaan_klien,

            klien.tanggal_mulai
              AS tanggal_mulai_klien,

            klien.tanggal_akhir
              AS tanggal_akhir_klien,

            klien.status_pengadaan
              AS status_pengadaan,

            klien.status_pengadaan
              AS status_pengadaan_klien,

            klien.status_teknis
              AS status_teknis,

            klien.status_teknis
              AS status_teknis_klien,

            klien.model_pembayaran
              AS model_pembayaran_klien,

            COALESCE(
              klien.nilai_final_klien,
              0
            ) AS nilai_final_klien,


            /* =========================================
               INFORMASI PARTNER
            ========================================= */

            COALESCE(
              partner.nama_partner,
              '-'
            ) AS nama_partner,

            COALESCE(
              partner.nama_partner_list,
              ARRAY[]::TEXT[]
            ) AS nama_partner_list,

            COALESCE(
              partner.nilai_partner,
              0
            ) AS nilai_partner,

            COALESCE(
              partner.nilai_partner,
              0
            ) AS nilai_final_partner,


            /* =========================================
               MARGIN NOMINAL
            ========================================= */

            (
              COALESCE(
                klien.nilai_final_klien,
                0
              )
              -
              COALESCE(
                partner.nilai_partner,
                0
              )
            ) AS margin,


            /* =========================================
               MARGIN PERSEN
            ========================================= */

            CASE
              WHEN
                COALESCE(
                  klien.nilai_final_klien,
                  0
                ) > 0

              THEN
                (
                  (
                    COALESCE(
                      klien.nilai_final_klien,
                      0
                    )
                    -
                    COALESCE(
                      partner.nilai_partner,
                      0
                    )
                  )
                  /
                  COALESCE(
                    klien.nilai_final_klien,
                    0
                  )
                ) * 100

              ELSE 0
            END AS margin_persen


          FROM public.proyek p


          /* =========================================
             MULTI KATEGORI
          ========================================= */

          LEFT JOIN LATERAL (

            SELECT
              STRING_AGG(
                DISTINCT
                kp.nama_kategori_produk,
                ', '
                ORDER BY
                  kp.nama_kategori_produk
              ) AS nama_kategori_produk,

              ARRAY_AGG(
                DISTINCT
                kp.nama_kategori_produk
                ORDER BY
                  kp.nama_kategori_produk
              ) AS nama_kategori_produk_list

            FROM public.proyek_kategori pk

            INNER JOIN public.kategori_produk kp
              ON kp.id =
                pk.kategori_produk_id

            WHERE
              pk.proyek_id =
                p.id

          ) kategori
            ON TRUE


          /* =========================================
             MULTI PIC PROYEK
          ========================================= */

          LEFT JOIN LATERAL (

            SELECT
              STRING_AGG(
                data_pic.nama_pic,
                ', '
                ORDER BY
                  data_pic.nama_pic,
                  data_pic.pic_id
              ) AS nama_pic,

              ARRAY_AGG(
                data_pic.nama_pic
                ORDER BY
                  data_pic.nama_pic,
                  data_pic.pic_id
              ) AS nama_pic_list,

              ARRAY_AGG(
                data_pic.pic_id
                ORDER BY
                  data_pic.nama_pic,
                  data_pic.pic_id
              ) AS pic_ids,

              JSONB_AGG(
                JSONB_BUILD_OBJECT(
                  'id',
                  data_pic.pic_id,

                  'nama',
                  data_pic.nama_pic
                )
                ORDER BY
                  data_pic.nama_pic,
                  data_pic.pic_id
              ) AS pic_list

            FROM (

              SELECT DISTINCT
                master_pic.id
                  AS pic_id,

                COALESCE(
                  NULLIF(
                    TRIM(
                      master_pic.nama
                    ),
                    ''
                  ),

                  NULLIF(
                    TRIM(
                      master_pic.inisial
                    ),
                    ''
                  ),

                  'PIC ' ||
                  master_pic.id::TEXT
                ) AS nama_pic

              FROM public.proyek_pic relasi_pic

              INNER JOIN public.pic master_pic
                ON master_pic.id =
                  relasi_pic.pic_id

              WHERE
                relasi_pic.proyek_id =
                  p.id

            ) data_pic

          ) daftar_pic
            ON TRUE


          /* =========================================
             DATA KLIEN TERBARU
          ========================================= */

          LEFT JOIN LATERAL (

            SELECT
              pk.id
                AS proyek_klien_id,

              pk.klien_id,

              d.perusahaan_klien,

              pk.tanggal_mulai,

              pk.tanggal_akhir,

              pk.status_pengadaan,

              pk.status_teknis,

              pk.model_pembayaran,


              /* =====================================
                 NILAI FINAL KLIEN
              ===================================== */

              CASE
                WHEN
                  COALESCE(
                    NULLIF(
                      pk.nilai_nego_3,
                      0
                    ),

                    NULLIF(
                      pk.nilai_nego_2,
                      0
                    ),

                    NULLIF(
                      pk.nilai_nego_1,
                      0
                    ),

                    NULLIF(
                      pk.nilai_submit,
                      0
                    ),

                    0
                  ) > 0

                THEN
                  COALESCE(
                    NULLIF(
                      pk.nilai_nego_3,
                      0
                    ),

                    NULLIF(
                      pk.nilai_nego_2,
                      0
                    ),

                    NULLIF(
                      pk.nilai_nego_1,
                      0
                    ),

                    NULLIF(
                      pk.nilai_submit,
                      0
                    ),

                    0
                  )

                ELSE
                  COALESCE(
                    (
                      SELECT
                        SUM(
                          COALESCE(
                            pkt.nominal,
                            0
                          )
                        )

                      FROM
                        public.proyek_klien_termin pkt

                      WHERE
                        pkt.proyek_klien_id =
                          pk.id
                    ),
                    0
                  )

              END::NUMERIC
                AS nilai_final_klien

            FROM public.proyek_klien pk

            LEFT JOIN public.data d
              ON d.id =
                pk.klien_id

            WHERE
              pk.proyek_id =
                p.id

            ORDER BY
              pk.id DESC

            LIMIT 1

          ) klien
            ON TRUE


          /* =========================================
             MULTI PARTNER
          ========================================= */

          LEFT JOIN LATERAL (

            SELECT
              STRING_AGG(
                DISTINCT
                pr.nama_partner,
                ', '
                ORDER BY
                  pr.nama_partner
              ) AS nama_partner,

              ARRAY_AGG(
                DISTINCT
                pr.nama_partner
                ORDER BY
                  pr.nama_partner
              ) AS nama_partner_list,


              /* =====================================
                 TOTAL NILAI PARTNER
              ===================================== */

              SUM(
                CASE
                  WHEN
                    COALESCE(
                      NULLIF(
                        pp.nilai_nego_3,
                        0
                      ),

                      NULLIF(
                        pp.nilai_nego_2,
                        0
                      ),

                      NULLIF(
                        pp.nilai_nego_1,
                        0
                      ),

                      NULLIF(
                        pp.nilai_submit,
                        0
                      ),

                      0
                    ) > 0

                  THEN
                    COALESCE(
                      NULLIF(
                        pp.nilai_nego_3,
                        0
                      ),

                      NULLIF(
                        pp.nilai_nego_2,
                        0
                      ),

                      NULLIF(
                        pp.nilai_nego_1,
                        0
                      ),

                      NULLIF(
                        pp.nilai_submit,
                        0
                      ),

                      0
                    )

                  ELSE
                    COALESCE(
                      (
                        SELECT
                          SUM(
                            COALESCE(
                              ppt.nominal,
                              0
                            )
                          )

                        FROM
                          public.proyek_partner_termin ppt

                        WHERE
                          ppt.proyek_partner_id =
                            pp.id
                      ),
                      0
                    )

                END
              )::NUMERIC
                AS nilai_partner

            FROM public.proyek_partner pp

            LEFT JOIN public.partner pr
              ON pr.id =
                pp.partner_id

            WHERE
              pp.proyek_id =
                p.id

          ) partner
            ON TRUE


          /* =========================================
             HAK AKSES LOGIN DAN FILTER DASHBOARD
          ========================================= */

          WHERE
            (
              /*
               * Admin boleh mengakses seluruh proyek.
               * PIC hanya boleh mengakses proyeknya.
               */

              $1::BOOLEAN = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic akses_pic

                WHERE
                  akses_pic.proyek_id =
                    p.id

                  AND akses_pic.pic_id =
                    $2
              )
            )


            /*
             * Filter jenis proyek dari dashboard.
             */

            AND (
              $3::TEXT = ''

              OR LOWER(
                BTRIM(
                  COALESCE(
                    p.jenis_proyek,
                    ''
                  )
                )
              ) =
              LOWER(
                BTRIM($3)
              )
            )


            /*
             * Filter PIC yang dipilih dari dashboard.
             * Kondisi ini tetap berlaku untuk admin.
             */

            AND (
              $4::INTEGER IS NULL

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic filter_pic

                WHERE
                  filter_pic.proyek_id =
                    p.id

                  AND filter_pic.pic_id =
                    $4
              )
            )


          ORDER BY
            p.created_at DESC,
            p.id DESC
          `,
          [
            isAdmin,
            sessionPicId,
            jenisProyekFilter,
            picFilterId
          ]
        );


      // ==================================================
      // KONVERSI NILAI POSTGRESQL
      // ==================================================

      const data =
        result.rows.map(item => ({

          ...item,


          id:
            Number(item.id),


          proyek_klien_id:
            item.proyek_klien_id
              ? Number(
                  item.proyek_klien_id
                )
              : null,


          klien_id:
            item.klien_id
              ? Number(
                  item.klien_id
                )
              : null,


          nama_pic:
            String(
              item.nama_pic || ""
            ).trim(),


          nama_pic_list:
            Array.isArray(
              item.nama_pic_list
            )
              ? item.nama_pic_list
                  .map(nama =>
                    String(
                      nama || ""
                    ).trim()
                  )
                  .filter(Boolean)
              : [],


          pic_ids:
            Array.isArray(
              item.pic_ids
            )
              ? item.pic_ids
                  .map(Number)
                  .filter(value =>
                    Number.isInteger(value) &&
                    value > 0
                  )
              : [],


          pic_list:
            Array.isArray(
              item.pic_list
            )
              ? item.pic_list
                  .map(pic => ({

                    id:
                      Number(pic.id),

                    nama:
                      String(
                        pic.nama || ""
                      ).trim()

                  }))
                  .filter(pic =>
                    Number.isInteger(pic.id) &&
                    pic.id > 0
                  )
              : [],


          nilai_final_klien:
            Number(
              item.nilai_final_klien ||
              0
            ),


          nilai_partner:
            Number(
              item.nilai_partner ||
              0
            ),


          nilai_final_partner:
            Number(
              item.nilai_final_partner ||
              0
            ),


          margin:
            Number(
              item.margin ||
              0
            ),


          margin_persen:
            Number(
              item.margin_persen ||
              0
            )

        }));


      return res.json(
        data
      );


    } catch (error) {

      console.error(
        "ERROR GET LISTING PROYEK:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    }

  }
);

// DETAIL PROYEK
app.get("/api/proyek/:id/detail", 
  async (req, res) => {

  console.log("DETAIL PROYEK DIPANGGIL:", req.params.id);

  try {

    const id = req.params.id;

    console.log("ID PROYEK:", id);

    // ------------------------------------------
    // 1. DATA UTAMA PROYEK
    // ------------------------------------------

    const proyekResult = await pool.query(`
  SELECT
    p.id,
    p.nama_proyek,
    p.deskripsi,
    p.jenis_proyek,
    p.sub_jenis_proyek,
    p.status_final,
    p.created_at,
    p.updated_at,

    p.kategori_produk_id,

    kp.nama_kategori_produk,

    COALESCE(
      (
        SELECT ARRAY_AGG(
          pk.kategori_produk_id
          ORDER BY pk.kategori_produk_id
        )
        FROM public.proyek_kategori pk
        WHERE pk.proyek_id = p.id
      ),
      ARRAY[]::INTEGER[]
    ) AS kategori_produk_ids,

    COALESCE(
      (
        SELECT ARRAY_AGG(
          kp2.nama_kategori_produk
          ORDER BY kp2.nama_kategori_produk
        )

        FROM public.proyek_kategori pk2

        JOIN public.kategori_produk kp2
          ON kp2.id = pk2.kategori_produk_id

        WHERE pk2.proyek_id = p.id
      ),
      ARRAY[]::TEXT[]
    ) AS nama_kategori_produk_list

  FROM public.proyek p

  LEFT JOIN public.kategori_produk kp
    ON kp.id = p.kategori_produk_id

  WHERE p.id = $1
`, [id]);
    if (proyekResult.rows.length === 0) {
      return res.status(404).json({
        error: "Proyek tidak ditemukan"
      });
    }

    const proyek = proyekResult.rows[0];

    // ======================================================
    // TERMIN PEMBAYARAN KLIEN
    // ======================================================

// EDIT TERMIN KLIEN

app.put(
  "/api/proyek/klien/termin/:id",
  async (req, res) => {
    const client =
      await pool.connect();

    let transaksiDimulai =
      false;

    try {
      const terminId =
        Number(req.params.id);


      if (
        !Number.isInteger(terminId) ||
        terminId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID termin klien tidak valid"
        });
      }


      const {
        nama_termin,
        persentase,
        nominal,
        input_terakhir,
        status_pembayaran,
        tanggal_jatuh_tempo,
        tanggal_bayar,
        syarat_pembayaran
      } = req.body;


      if (
        !nama_termin ||
        !String(nama_termin).trim()
      ) {
        return res.status(400).json({
          error:
            "Nama termin wajib diisi"
        });
      }


      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // AMBIL TERMIN LAMA DAN INFORMASI PROYEK
      // ================================================

      const terminResult =
        await client.query(
          `
            SELECT
              t.id,
              t.proyek_klien_id,
              t.nama_termin,
              t.persentase,
              t.nominal,
              t.status_pembayaran,
              t.tanggal_jatuh_tempo,
              t.tanggal_bayar,
              t.syarat_pembayaran,

              pk.proyek_id,
              p.nama_proyek

            FROM public.proyek_klien_termin t

            JOIN public.proyek_klien pk
              ON pk.id = t.proyek_klien_id

            JOIN public.proyek p
              ON p.id = pk.proyek_id

            WHERE t.id = $1

            FOR UPDATE OF t
          `,
          [terminId]
        );


      if (
        terminResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Termin klien tidak ditemukan"
        });
      }


      const dataTerminLama =
        terminResult.rows[0];

      const proyekKlienId =
        Number(
          dataTerminLama
            .proyek_klien_id
        );

      const proyekId =
        Number(
          dataTerminLama.proyek_id
        );

      const namaProyek =
        dataTerminLama.nama_proyek;


      // ================================================
      // AMBIL NILAI FINAL
      //
      // HELPER INI TETAP DIGUNAKAN AGAR NILAI FINAL
      // MENGIKUTI SUMMARY JIKA NILAI SUBMIT KOSONG
      // ================================================

      const nilaiFinalAsli =
        await getNilaiFinalAsliKlien(
          client,
          proyekKlienId
        );


      if (nilaiFinalAsli === null) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Data proyek klien tidak ditemukan"
        });
      }


      // ================================================
      // NORMALISASI NILAI
      // ================================================

      let nilaiPersentase =
        persentase === null ||
        persentase === undefined ||
        persentase === ""
          ? null
          : Number(persentase);


      let nilaiNominal =
        nominal === null ||
        nominal === undefined ||
        nominal === ""
          ? null
          : Number(nominal);


      const inputTerakhir =
        String(
          input_terakhir || ""
        )
          .trim()
          .toLowerCase();


      // ================================================
      // NILAI FINAL TERSEDIA
      // ================================================

      if (nilaiFinalAsli > 0) {
        // ==============================================
        // INPUT PERSENTASE
        // NOMINAL DIHITUNG OTOMATIS
        // ==============================================

        if (
          inputTerakhir ===
          "persentase"
        ) {
          if (
            !Number.isFinite(
              nilaiPersentase
            ) ||
            nilaiPersentase <= 0 ||
            nilaiPersentase > 100
          ) {
            await client.query(
              "ROLLBACK"
            );

            transaksiDimulai = false;

            return res.status(400).json({
              error:
                "Persentase harus lebih dari 0 dan maksimal 100%"
            });
          }


          nilaiNominal =
            (
              nilaiFinalAsli *
              nilaiPersentase
            ) / 100;
        }

        // ==============================================
        // INPUT NOMINAL
        // PERSENTASE DIHITUNG OTOMATIS
        // ==============================================

        else if (
          inputTerakhir ===
          "nominal"
        ) {
          if (
            !Number.isFinite(
              nilaiNominal
            ) ||
            nilaiNominal <= 0
          ) {
            await client.query(
              "ROLLBACK"
            );

            transaksiDimulai = false;

            return res.status(400).json({
              error:
                "Nominal termin harus lebih dari Rp 0"
            });
          }


          nilaiPersentase =
            (
              nilaiNominal /
              nilaiFinalAsli
            ) * 100;


          if (
            nilaiPersentase <= 0 ||
            nilaiPersentase > 100
          ) {
            await client.query(
              "ROLLBACK"
            );

            transaksiDimulai = false;

            return res.status(400).json({
              error:
                "Nominal termin tidak boleh melebihi nilai final proyek"
            });
          }
        }

        // ==============================================
        // INPUT TERAKHIR TIDAK VALID
        // ==============================================

        else {
          await client.query(
            "ROLLBACK"
          );

          transaksiDimulai = false;

          return res.status(400).json({
            error:
              "Input terakhir harus persentase atau nominal"
          });
        }


        // Simpan keduanya
        nilaiPersentase =
          Number(
            nilaiPersentase.toFixed(2)
          );

        nilaiNominal =
          Number(
            nilaiNominal.toFixed(2)
          );


        // ==============================================
        // TOTAL TERMIN LAIN
        // KECUALI TERMIN YANG SEDANG DIEDIT
        // ==============================================

        const totalResult =
          await client.query(
            `
              SELECT
                COALESCE(
                  SUM(persentase),
                  0
                ) AS total_persentase

              FROM public.proyek_klien_termin

              WHERE proyek_klien_id = $1
                AND id <> $2
            `,
            [
              proyekKlienId,
              terminId
            ]
          );


        const totalPersentaseLain =
          Number(
            totalResult
              .rows[0]
              .total_persentase || 0
          );


        if (
          totalPersentaseLain +
          nilaiPersentase >
          100.01
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaksiDimulai = false;

          return res.status(400).json({
            error:
              `Total persentase termin tidak boleh lebih dari 100%. ` +
              `Total termin lain ${totalPersentaseLain.toFixed(2)}%.`
          });
        }
      }

      // ================================================
      // NILAI FINAL BELUM TERSEDIA
      // ================================================

      else {
        if (
          !Number.isFinite(
            nilaiNominal
          ) ||
          nilaiNominal <= 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaksiDimulai = false;

          return res.status(400).json({
            error:
              "Nilai final belum tersedia. Isi nominal termin."
          });
        }


        nilaiNominal =
          Number(
            nilaiNominal.toFixed(2)
          );

        /*
         * Persentase dihitung ulang berdasarkan
         * nilai final Summary setelah UPDATE.
         */
        nilaiPersentase = null;
      }


      // ================================================
      // UPDATE TERMIN
      // ================================================

      await client.query(
        `
          UPDATE public.proyek_klien_termin

          SET
            nama_termin = $1,
            persentase = $2,
            nominal = $3,
            status_pembayaran = $4,
            tanggal_jatuh_tempo = $5,
            tanggal_bayar = $6,
            syarat_pembayaran = $7

          WHERE id = $8
        `,
        [
          String(
            nama_termin
          ).trim(),

          nilaiPersentase,

          nilaiNominal,

          status_pembayaran ||
            "Belum Dibayar",

          tanggal_jatuh_tempo ||
            null,

          tanggal_bayar ||
            null,

          String(
            syarat_pembayaran || ""
          ).trim() || null,

          terminId
        ]
      );


      // ================================================
      // JIKA NILAI FINAL BELUM TERSEDIA,
      // HITUNG ULANG BERDASARKAN SUMMARY
      // ================================================

      let nilaiFinalEfektif =
        nilaiFinalAsli;


      if (nilaiFinalAsli <= 0) {
        const perhitungan =
          await hitungUlangPersentaseKlien(
            client,
            proyekKlienId
          );


        /*
         * Mendukung helper yang mengembalikan object
         * maupun langsung berupa angka.
         */
        nilaiFinalEfektif =
          perhitungan &&
          typeof perhitungan === "object"
            ? Number(
                perhitungan.nilai_final ||
                0
              )
            : Number(
                perhitungan || 0
              );
      }


      // ================================================
      // AMBIL DATA HASIL UPDATE
      // ================================================

      const hasilResult =
        await client.query(
          `
            SELECT
              id,
              proyek_klien_id,
              nama_termin,
              persentase,
              nominal,
              status_pembayaran,
              tanggal_jatuh_tempo,
              tanggal_bayar,
              syarat_pembayaran

            FROM public.proyek_klien_termin

            WHERE id = $1
          `,
          [terminId]
        );


      const dataTerminBaru =
        hasilResult.rows[0];


      // ================================================
      // FORMAT ACTIVITY LOG
      // ================================================

      const formatTeksTerminLog =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const formatRupiahTerminLog =
        value => {
          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {
            return "-";
          }

          const angka =
            Number(value);

          if (!Number.isFinite(angka)) {
            return String(value);
          }

          return `Rp ${new Intl.NumberFormat(
            "id-ID",
            {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            }
          ).format(angka)}`;
        };


      const formatPersentaseTerminLog =
        value => {
          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {
            return "-";
          }

          const angka =
            Number(value);

          if (!Number.isFinite(angka)) {
            return String(value);
          }

          return `${
            new Intl.NumberFormat(
              "id-ID",
              {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
              }
            ).format(angka)
          }%`;
        };


      const formatTanggalTerminLog =
        value => {
          if (!value) {
            return "-";
          }

          const daftarBulan = [
            "Januari",
            "Februari",
            "Maret",
            "April",
            "Mei",
            "Juni",
            "Juli",
            "Agustus",
            "September",
            "Oktober",
            "November",
            "Desember"
          ];

          let tahun;
          let bulan;
          let tanggal;

          if (value instanceof Date) {
            tahun =
              value.getUTCFullYear();

            bulan =
              value.getUTCMonth() + 1;

            tanggal =
              value.getUTCDate();
          } else {
            const cocok =
              String(value).match(
                /^(\d{4})-(\d{2})-(\d{2})/
              );

            if (!cocok) {
              return String(value);
            }

            tahun =
              Number(cocok[1]);

            bulan =
              Number(cocok[2]);

            tanggal =
              Number(cocok[3]);
          }

          return `${tanggal} ${
            daftarBulan[bulan - 1]
          } ${tahun}`;
        };


      const buatDetailTerminLog =
        data => [
          {
            label:
              "NAMA TERMIN",

            nilai:
              formatTeksTerminLog(
                data.nama_termin
              )
          },
          {
            label:
              "PERSENTASE",

            nilai:
              formatPersentaseTerminLog(
                data.persentase
              )
          },
          {
            label:
              "NOMINAL",

            nilai:
              formatRupiahTerminLog(
                data.nominal
              )
          },
          {
            label:
              "STATUS PEMBAYARAN",

            nilai:
              formatTeksTerminLog(
                data.status_pembayaran
              )
          },
          {
            label:
              "TANGGAL JATUH TEMPO",

            nilai:
              formatTanggalTerminLog(
                data.tanggal_jatuh_tempo
              )
          },
          {
            label:
              "TANGGAL BAYAR",

            nilai:
              formatTanggalTerminLog(
                data.tanggal_bayar
              )
          },
          {
            label:
              "SYARAT PEMBAYARAN",

            nilai:
              formatTeksTerminLog(
                data.syarat_pembayaran
              )
          }
        ];


      const detailTerminLama =
        buatDetailTerminLog(
          dataTerminLama
        );

      const detailTerminBaru =
        buatDetailTerminLog(
          dataTerminBaru
        );


      // ================================================
      // HANYA CATAT FIELD YANG BERUBAH
      // ================================================

      const perubahanTermin =
        detailTerminBaru
          .map(
            (
              itemBaru,
              index
            ) => ({
              label:
                itemBaru.label,

              nilai_lama:
                detailTerminLama[index]
                  .nilai,

              nilai_baru:
                itemBaru.nilai
            })
          )
          .filter(
            item =>
              item.nilai_lama !==
              item.nilai_baru
          );


      // ================================================
      // SIMPAN SATU ACTIVITY LOG
      // ================================================

      if (
        perubahanTermin.length > 0
      ) {
        await simpanActivityLog(
          client,
          {
            ...getActivityUser(req),

            aktivitas: "UPDATE",
            modul: "PROYEK",

            // Menggunakan proyek ID
            entity_id: proyekId,
            entity_nama: namaProyek,

            field_name:
              "TERMIN KLIEN",

            nilai_lama:
              perubahanTermin
                .map(
                  item =>
                    `${item.label} = ${item.nilai_lama}`
                )
                .join(", "),

            nilai_baru:
              perubahanTermin
                .map(
                  item =>
                    `${item.label} = ${item.nilai_baru}`
                )
                .join(", "),

            deskripsi:
              "memperbarui termin klien"
          }
        );
      }


      await client.query("COMMIT");

      transaksiDimulai = false;


      console.log(
        "TERMIN KLIEN DIPERBARUI:",
        dataTerminBaru
      );


      return res.json({
        message:
          "Termin klien berhasil diperbarui",

        nilai_final_asli:
          nilaiFinalAsli,

        nilai_final:
          nilaiFinalEfektif,

        data:
          dataTerminBaru
      });

    } catch (error) {
      if (transaksiDimulai) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK TERMIN KLIEN:",
            rollbackError
          );
        }
      }


      console.error(
        "ERROR UPDATE TERMIN KLIEN:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);

// DELETE TERMIN KLIEN

    app.delete(
      "/api/proyek/klien/termin/:id",
      async (req, res) => {
        try {

          const terminId =
            Number(req.params.id);


          if (!terminId) {
            return res.status(400).json({
              error:
                "ID termin tidak valid"
            });
          }


          // ==========================================
          // 1. CARI TERMIN SEBELUM DIHAPUS
          // ==========================================

          const currentResult =
            await pool.query(`
              SELECT
                id,
                proyek_klien_id,
                persentase,
                nominal

              FROM public.proyek_klien_termin

              WHERE id = $1
            `, [terminId]);


          if (
            currentResult.rows.length === 0
          ) {

            return res.status(404).json({
              error:
                "Termin tidak ditemukan"
            });

          }


          const current =
            currentResult.rows[0];

          const proyekKlienId =
            current.proyek_klien_id;


          // ==========================================
          // 2. HAPUS TERMIN
          // ==========================================

          await pool.query(`
            DELETE FROM
              public.proyek_klien_termin

            WHERE id = $1
          `, [terminId]);


          // ==========================================
          // 3. HITUNG ULANG TOTAL NOMINAL
          // ==========================================

          const totalNominalResult =
            await pool.query(`
              SELECT
                COALESCE(
                  SUM(nominal),
                  0
                ) AS total_nominal

              FROM public.proyek_klien_termin

              WHERE proyek_klien_id = $1
            `, [proyekKlienId]);


          const totalNominal =
            Number(
              totalNominalResult.rows[0]
                .total_nominal || 0
            );


          // ==========================================
          // 4. HITUNG ULANG TOTAL PERSENTASE
          // ==========================================

          const totalPersenResult =
            await pool.query(`
              SELECT
                COALESCE(
                  SUM(persentase),
                  0
                ) AS total_persentase

              FROM public.proyek_klien_termin

              WHERE proyek_klien_id = $1
            `, [proyekKlienId]);


          const totalPersentase =
            Number(
              totalPersenResult.rows[0]
                .total_persentase || 0
            );


          return res.json({
            message:
              "Termin berhasil dihapus",

            proyek_klien_id:
              proyekKlienId,

            total_nominal:
              totalNominal,

            total_persentase:
              totalPersentase
          });


        } catch (error) {

          console.error(
            "ERROR DELETE TERMIN KLIEN:",
            error
          );

          return res.status(500).json({
            error: error.message
          });

        }
      }
    );

    // ======================================================
    // GET MODE TERMIN KLIEN
    // ======================================================

    app.get(
      "/api/proyek/klien/:proyekKlienId/termin-mode",
      async (req, res) => {
        try {

          const proyekKlienId =
            Number(req.params.proyekKlienId);


          if (!proyekKlienId) {
            return res.status(400).json({
              error: "ID proyek klien tidak valid"
            });
          }


          // ==========================================
          // 1. CEK NILAI PROYEK KLIEN
          // ==========================================

          const proyekResult =
            await pool.query(`
              SELECT
                id,

                COALESCE(
                  nilai_nego_3,
                  nilai_nego_2,
                  nilai_nego_1,
                  nilai_submit,
                  0
                ) AS nilai_proyek

              FROM public.proyek_klien

              WHERE id = $1
            `, [proyekKlienId]);


          if (
            proyekResult.rows.length === 0
          ) {
            return res.status(404).json({
              error:
                "Data proyek klien tidak ditemukan"
            });
          }


          const nilaiProyek =
            Number(
              proyekResult.rows[0]
                .nilai_proyek || 0
            );


          // ==========================================
          // 2. CEK TERMIN PERTAMA
          // ==========================================

          const terminResult =
            await pool.query(`
              SELECT
                id,
                persentase,
                nominal

              FROM public.proyek_klien_termin

              WHERE proyek_klien_id = $1

              ORDER BY id ASC

              LIMIT 1
            `, [proyekKlienId]);


          const terminPertama =
            terminResult.rows[0] || null;


          // ==========================================
          // 3. TENTUKAN MODE
          // ==========================================

          let mode;


          if (terminPertama) {

            mode =
              terminPertama.persentase !== null
                ? "persentase"
                : "nominal";

          } else {

            mode =
              nilaiProyek > 0
                ? "persentase"
                : "nominal";

          }


          return res.json({
            proyek_klien_id:
              proyekKlienId,

            nilai_proyek:
              nilaiProyek,

            sudah_ada_termin:
              Boolean(terminPertama),

            mode_termin:
              mode
          });


        } catch (error) {

          console.error(
            "ERROR GET MODE TERMIN KLIEN:",
            error
          );

          return res.status(500).json({
            error: error.message
          });

        }
      }
    );

    // ------------------------------------------
    // 2. PIC PROYEK
    // ------------------------------------------

    const picResult = await pool.query(`
      SELECT
        pic.id,
        pic.nama,
        pic.nik,
        pic.inisial,
        pic.jabatan,
        pic.email,
        pic.no_hp

      FROM public.proyek_pic pp

      JOIN public.pic pic
        ON pic.id = pp.pic_id

      WHERE pp.proyek_id = $1

      ORDER BY pic.nama ASC
    `, [id]);


    // ------------------------------------------
    // 3. DATA KLIEN
    // ------------------------------------------

// ======================================================
// AMBIL INFORMASI KLIEN PROYEK
// ======================================================

const klienResult =
  await pool.query(
    `
    SELECT
      pk.id AS proyek_klien_id,
      pk.proyek_id,

      d.id AS klien_id,
      d.perusahaan_klien,
      d.inisial,

      pk.nilai_submit,
      pk.nilai_nego_1,
      pk.nilai_nego_2,
      pk.nilai_nego_3,

      /*
       * Nilai final:
       * 1. Nego 3 jika lebih dari 0
       * 2. Nego 2 jika lebih dari 0
       * 3. Nego 1 jika lebih dari 0
       * 4. Nilai submit jika lebih dari 0
       * 5. Total termin
       */
      COALESCE(
        NULLIF(
          pk.nilai_nego_3,
          0
        ),

        NULLIF(
          pk.nilai_nego_2,
          0
        ),

        NULLIF(
          pk.nilai_nego_1,
          0
        ),

        NULLIF(
          pk.nilai_submit,
          0
        ),

        (
          SELECT
            SUM(
              COALESCE(
                pkt.nominal,
                0
              )
            )

          FROM public.proyek_klien_termin pkt

          WHERE
            pkt.proyek_klien_id =
              pk.id
        ),

        0
      ) AS nilai_final,

      pk.tanggal_mulai,
      pk.tanggal_akhir,

      /*
       * FIELD YANG SEBELUMNYA BELUM DIAMBIL
       */
      pk.model_pembayaran,

      pk.status_pengadaan,
      pk.status_teknis,
      pk.status_administrasi,

      pk.created_at,
      pk.updated_at

    FROM public.proyek_klien pk

    JOIN public.data d
      ON d.id = pk.klien_id

    WHERE pk.proyek_id = $1

    ORDER BY pk.id DESC

    LIMIT 1
    `,
    [id]
  );


const klien =
  klienResult.rows.length > 0
    ? klienResult.rows[0]
    : null;


console.log(
  "DATA KLIEN DETAIL:",
  klien
);

    // ------------------------------------------
    // 4. TERMIN KLIEN
    // ------------------------------------------

    let terminKlien = [];

    if (klien) {
      const terminResult =
  await pool.query(
    `
    SELECT
      id,
      nama_termin,
      persentase,
      nominal,
      status_pembayaran,
      tanggal_jatuh_tempo,
      tanggal_bayar,
      syarat_pembayaran

    FROM public.proyek_klien_termin

    WHERE proyek_klien_id = $1

    ORDER BY id ASC
    `,
    [klien.proyek_klien_id]
  );

terminKlien =
  terminResult.rows;
    }
// ======================================================
// DOKUMEN KLIEN
// ======================================================


// ======================================================
// GET DOKUMEN KLIEN
// ======================================================

let dokumenKlien = [];

if (klien) {

  const proyekKlienId =
    klien.proyek_klien_id ?? klien.id;

  const dokumenKlienResult =
    await pool.query(
      `
      SELECT
        id,
        proyek_klien_id,
        nama_dokumen,
        nomor_dokumen,
        nama_file_asli,
        nama_file_simpan,
        path_file,
        tipe_file,
        ukuran_file
      FROM public.proyek_klien_dokumen
      WHERE proyek_klien_id = $1
      ORDER BY id ASC
      `,
      [proyekKlienId]
    );

  dokumenKlien =
    dokumenKlienResult.rows;

  console.log(
    "DOKUMEN KLIEN:",
    {
      proyekKlienId,
      jumlah: dokumenKlien.length
    }
  );

}
    // ------------------------------------------
    // 6. PARTNER
    // ------------------------------------------

  const partnerResult = await pool.query(
  `
  SELECT
    pp.id AS proyek_partner_id,

    pr.id AS partner_id,
    pr.nama_partner,
    pr.inisial,

    pp.nilai_submit,
    pp.nilai_nego_1,
    pp.nilai_nego_2,
    pp.nilai_nego_3,

    COALESCE(
      NULLIF(pp.nilai_nego_3, 0),
      NULLIF(pp.nilai_nego_2, 0),
      NULLIF(pp.nilai_nego_1, 0),
      NULLIF(pp.nilai_submit, 0),

      (
        SELECT SUM(COALESCE(ppt.nominal, 0))
        FROM public.proyek_partner_termin ppt
        WHERE ppt.proyek_partner_id = pp.id
      ),

      0
    ) AS nilai_final,

    pp.tanggal_mulai,
    pp.tanggal_akhir,
    pp.model_pembayaran,
    pp.status_pengadaan,
    pp.status_teknis

  FROM public.proyek_partner pp

  JOIN public.partner pr
    ON pr.id = pp.partner_id

  WHERE pp.proyek_id = $1

  ORDER BY pp.id ASC
  `,
  [id]
);


    const partners = [];

    for (const partner of partnerResult.rows) {

  const terminResult = await pool.query(
  `
  SELECT
    ppt.id,
    ppt.proyek_partner_id,
    ppt.nama_termin,

    CASE
      WHEN COALESCE(
        NULLIF(pp.nilai_nego_3, 0),
        NULLIF(pp.nilai_nego_2, 0),
        NULLIF(pp.nilai_nego_1, 0),
        NULLIF(pp.nilai_submit, 0),
        0
      ) = 0

      THEN COALESCE(
        ROUND(
          COALESCE(ppt.nominal, 0)::numeric
          /
          NULLIF(
            SUM(COALESCE(ppt.nominal, 0)) OVER (
              PARTITION BY ppt.proyek_partner_id
            ),
            0
          )
          * 100,
          6
        ),
        0
      )

      ELSE ppt.persentase
    END AS persentase,

    ppt.nominal,
    ppt.status_pembayaran,
    ppt.tanggal_jatuh_tempo,
    ppt.tanggal_bayar,
    ppt.syarat_pembayaran

  FROM public.proyek_partner_termin ppt

  JOIN public.proyek_partner pp
    ON pp.id = ppt.proyek_partner_id

  WHERE ppt.proyek_partner_id = $1

  ORDER BY ppt.id ASC
  `,
  [partner.proyek_partner_id]
);

  const dokumenResult =
  await pool.query(
    `
      SELECT
        id,
        proyek_partner_id,
        nama_dokumen,
        nomor_dokumen,
        nama_file_asli,
        nama_file_server,
        path_file,
        mime_type,
        ukuran_file,
        created_at
      FROM public.proyek_partner_dokumen
      WHERE proyek_partner_id = $1
      ORDER BY id ASC
    `,
    [
      partner.proyek_partner_id
    ]
  );


      partners.push({
        ...partner,
        termin: terminResult.rows,
        dokumen: dokumenResult.rows
      });
    }


    // ------------------------------------------
    // 7. HITUNG NILAI & MARGIN
    // ------------------------------------------

    const nilaiKlien =
      klien
        ? Number(klien.nilai_final || 0)
        : 0;


    const nilaiPartner =
      partners.reduce(
        (total, item) =>
          total + Number(item.nilai_final || 0),
        0
      );


    const margin =
      nilaiKlien - nilaiPartner;


    const marginPersen =
      nilaiKlien > 0
        ? (margin / nilaiKlien) * 100
        : 0;


    // ------------------------------------------
    // RESPONSE
    // ------------------------------------------

    res.json({
      proyek,

      pic: picResult.rows,

      klien: klien
        ? {
            ...klien,
            termin: terminKlien,
            dokumen: dokumenKlien
          }
        : null,

      partners,

      summary: {
        nilai_klien: nilaiKlien,
        nilai_partner: nilaiPartner,
        margin,
        margin_persen: marginPersen
      }
    });

  } catch (error) {

    console.error(
      "ERROR DETAIL PROYEK:",
      error
    );

    res.status(500).json({
      error: error.message
    });
  }
});


// TAMBAH TERMIN KLIEN

app.post(
  "/api/proyek/klien/:proyekKlienId/termin",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      await client.query("BEGIN");


      const proyekKlienId =
        Number(
          req.params.proyekKlienId
        );


      if (
        !Number.isInteger(proyekKlienId) ||
        proyekKlienId <= 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          error:
            "ID proyek klien tidak valid"
        });
      }


      const {
        nama_termin,
        persentase,
        nominal,
        input_terakhir,
        status_pembayaran,
        tanggal_jatuh_tempo,
        tanggal_bayar,
        syarat_pembayaran
      } = req.body;


      if (
        !nama_termin?.trim()
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          error:
            "Nama termin wajib diisi"
        });
      }


      // ================================================
      // AMBIL INFORMASI PROYEK UNTUK LOG
      // ================================================

      const proyekInfoResult =
        await client.query(
          `
            SELECT
              pk.proyek_id,
              p.nama_proyek

            FROM public.proyek_klien pk

            JOIN public.proyek p
              ON p.id = pk.proyek_id

            WHERE pk.id = $1

            LIMIT 1
          `,
          [proyekKlienId]
        );


      if (
        proyekInfoResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Data proyek klien tidak ditemukan"
        });
      }


      const proyekId =
        Number(
          proyekInfoResult
            .rows[0]
            .proyek_id
        );

      const namaProyek =
        proyekInfoResult
          .rows[0]
          .nama_proyek;


      // ================================================
      // AMBIL NILAI FINAL
      //
      // TETAP MENGGUNAKAN HELPER INI.
      // JIKA NILAI SUBMIT KOSONG, HELPER MENGAMBIL
      // NILAI FINAL YANG SAMA DENGAN SUMMARY.
      // ================================================

      const nilaiFinalAsli =
        await getNilaiFinalAsliKlien(
          client,
          proyekKlienId
        );


      if (nilaiFinalAsli === null) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Data proyek klien tidak ditemukan"
        });
      }


      // ================================================
      // NORMALISASI INPUT
      // ================================================

      const persentaseInput =
        persentase === null ||
        persentase === undefined ||
        persentase === ""
          ? null
          : Number(persentase);


      const nominalInput =
        nominal === null ||
        nominal === undefined ||
        nominal === ""
          ? null
          : Number(nominal);


      const inputTerakhir =
        String(
          input_terakhir || ""
        )
          .trim()
          .toLowerCase();


      let persentaseSimpan = null;
      let nominalSimpan = null;


      // ================================================
      // NILAI FINAL TERSEDIA
      // ================================================

      if (nilaiFinalAsli > 0) {
        // ==============================================
        // INPUT PERSENTASE
        // HITUNG NOMINAL
        // ==============================================

        if (
          inputTerakhir ===
          "persentase"
        ) {
          if (
            !Number.isFinite(
              persentaseInput
            ) ||
            persentaseInput <= 0 ||
            persentaseInput > 100
          ) {
            await client.query(
              "ROLLBACK"
            );

            return res.status(400).json({
              error:
                "Persentase harus lebih dari 0 dan maksimal 100%"
            });
          }


          persentaseSimpan =
            Number(
              persentaseInput.toFixed(2)
            );


          nominalSimpan =
            Math.round(
              (
                nilaiFinalAsli *
                persentaseSimpan
              ) / 100
            );
        }

        // ==============================================
        // INPUT NOMINAL
        // HITUNG PERSENTASE
        // ==============================================

        else if (
          inputTerakhir ===
          "nominal"
        ) {
          if (
            !Number.isFinite(
              nominalInput
            ) ||
            nominalInput <= 0
          ) {
            await client.query(
              "ROLLBACK"
            );

            return res.status(400).json({
              error:
                "Nominal termin harus lebih dari Rp 0"
            });
          }


          /*
           * Ini perbaikan utamanya.
           * nominalSimpan harus diisi sebelum dipakai
           * untuk menghitung persentase.
           */
          nominalSimpan =
            Math.round(
              nominalInput
            );


          persentaseSimpan =
            Number(
              (
                (
                  nominalSimpan /
                  nilaiFinalAsli
                ) * 100
              ).toFixed(2)
            );


          if (
            persentaseSimpan <= 0 ||
            persentaseSimpan > 100
          ) {
            await client.query(
              "ROLLBACK"
            );

            return res.status(400).json({
              error:
                "Nominal termin tidak boleh melebihi nilai final proyek"
            });
          }
        }

        // ==============================================
        // INPUT TERAKHIR TIDAK DIKIRIM
        // ==============================================

        else {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Input terakhir harus persentase atau nominal"
          });
        }


        // ==============================================
        // VALIDASI TOTAL PERSENTASE
        // ==============================================

        const totalResult =
          await client.query(
            `
              SELECT
                COALESCE(
                  SUM(persentase),
                  0
                )::numeric
                  AS total_persentase

              FROM public.proyek_klien_termin

              WHERE proyek_klien_id = $1
            `,
            [proyekKlienId]
          );


        const totalPersentase =
          Number(
            totalResult
              .rows[0]
              .total_persentase || 0
          );


        if (
          totalPersentase +
          persentaseSimpan >
          100.01
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              `Total persentase termin tidak boleh lebih dari 100%. ` +
              `Saat ini ${totalPersentase.toFixed(2)}%.`
          });
        }
      }

      // ================================================
      // NILAI FINAL BELUM TERSEDIA
      // ================================================

      else {
        if (
          !Number.isFinite(
            nominalInput
          ) ||
          nominalInput <= 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Karena nilai final belum tersedia, nominal termin wajib diisi"
          });
        }


        nominalSimpan =
          Math.round(
            nominalInput
          );

        /*
         * Persentase sementara NULL.
         * Setelah INSERT, helper menghitung ulang
         * berdasarkan nilai final Summary.
         */
        persentaseSimpan = null;
      }


      // ================================================
      // INSERT TERMIN
      // ================================================

      const result =
        await client.query(
          `
            INSERT INTO
              public.proyek_klien_termin (
                proyek_klien_id,
                nama_termin,
                persentase,
                nominal,
                status_pembayaran,
                tanggal_jatuh_tempo,
                tanggal_bayar,
                syarat_pembayaran
              )

            VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8
            )

            RETURNING *
          `,
          [
            proyekKlienId,

            nama_termin.trim(),

            persentaseSimpan,

            nominalSimpan,

            status_pembayaran ||
              "Belum Dibayar",

            tanggal_jatuh_tempo ||
              null,

            tanggal_bayar ||
              null,

            syarat_pembayaran
              ?.trim() || null
          ]
        );


      // ================================================
      // HITUNG ULANG PERSENTASE
      //
      // DIGUNAKAN JIKA NILAI SUBMIT KOSONG DAN
      // NILAI FINAL BERASAL DARI SUMMARY TERMIN.
      // ================================================

      const perhitungan =
        await hitungUlangPersentaseKlien(
          client,
          proyekKlienId
        );


      // ================================================
      // AMBIL HASIL TERBARU
      // PERSENTASE DAN NOMINAL KEDUANYA DIKEMBALIKAN
      // ================================================

      const terminBaruResult =
        await client.query(
          `
            SELECT
              id,
              proyek_klien_id,
              nama_termin,
              persentase,
              nominal,
              status_pembayaran,
              tanggal_jatuh_tempo,
              tanggal_bayar,
              syarat_pembayaran

            FROM public.proyek_klien_termin

            WHERE id = $1
          `,
          [result.rows[0].id]
        );


      const dataTerminBaru =
        terminBaruResult.rows[0];


      // ================================================
      // FORMAT LOG
      // ================================================

      const formatTeksTerminLog =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const formatNominalTerminLog =
        value => {
          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {
            return "-";
          }

          return `Rp ${new Intl.NumberFormat(
            "id-ID",
            {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            }
          ).format(Number(value))}`;
        };


      const formatPersentaseTerminLog =
        value => {
          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {
            return "-";
          }

          return `${
            new Intl.NumberFormat(
              "id-ID",
              {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
              }
            ).format(Number(value))
          }%`;
        };


      const formatTanggalTerminLog =
        value => {
          if (!value) {
            return "-";
          }

          const daftarBulan = [
            "Januari",
            "Februari",
            "Maret",
            "April",
            "Mei",
            "Juni",
            "Juli",
            "Agustus",
            "September",
            "Oktober",
            "November",
            "Desember"
          ];

          let tahun;
          let bulan;
          let tanggal;

          if (value instanceof Date) {
            tahun =
              value.getUTCFullYear();

            bulan =
              value.getUTCMonth() + 1;

            tanggal =
              value.getUTCDate();
          } else {
            const cocok =
              String(value).match(
                /^(\d{4})-(\d{2})-(\d{2})/
              );

            if (!cocok) {
              return String(value);
            }

            tahun =
              Number(cocok[1]);

            bulan =
              Number(cocok[2]);

            tanggal =
              Number(cocok[3]);
          }

          return `${tanggal} ${
            daftarBulan[bulan - 1]
          } ${tahun}`;
        };


      // ================================================
      // ACTIVITY LOG
      // CREATE HANYA NILAI BARU
      //
      // PERSENTASE DAN NOMINAL KEDUANYA DIMUNCULKAN
      // ================================================

      const nilaiBaruLog = [
        `NAMA TERMIN = ${
          formatTeksTerminLog(
            dataTerminBaru.nama_termin
          )
        }`,

        `PERSENTASE = ${
          formatPersentaseTerminLog(
            dataTerminBaru.persentase
          )
        }`,

        `NOMINAL = ${
          formatNominalTerminLog(
            dataTerminBaru.nominal
          )
        }`,

        `STATUS PEMBAYARAN = ${
          formatTeksTerminLog(
            dataTerminBaru
              .status_pembayaran
          )
        }`,

        `TANGGAL JATUH TEMPO = ${
          formatTanggalTerminLog(
            dataTerminBaru
              .tanggal_jatuh_tempo
          )
        }`,

        `TANGGAL BAYAR = ${
          formatTanggalTerminLog(
            dataTerminBaru
              .tanggal_bayar
          )
        }`,

        `SYARAT PEMBAYARAN = ${
          formatTeksTerminLog(
            dataTerminBaru
              .syarat_pembayaran
          )
        }`
      ].join(", ");


      await simpanActivityLog(
        client,
        {
          ...getActivityUser(req),

          aktivitas: "CREATE",
          modul: "PROYEK",

          entity_id: proyekId,
          entity_nama: namaProyek,

          field_name:
            "TERMIN KLIEN",

          nilai_lama: null,
          nilai_baru: nilaiBaruLog,

          deskripsi:
            "menambahkan termin klien"
        }
      );


      await client.query("COMMIT");


      return res.status(201).json({
        message:
          "Termin berhasil ditambahkan",

        data:
          dataTerminBaru,

        nilai_final:
          perhitungan.nilai_final,

        sumber_nilai_final:
          perhitungan.sumber
      });

    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "ERROR CREATE TERMIN KLIEN:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);
// ======================================================
// GET URL FILE DOKUMEN KLIEN
// ======================================================

app.get(
  "/api/proyek/klien/dokumen/:id/file",

  async (req, res) => {

    try {

      // ================================================
      // VALIDASI LOGIN
      // ================================================

      if (!req.session?.user) {

        return res.status(401).json({
          error: "Belum login"
        });

      }

      // ================================================
      // VALIDASI ID DOKUMEN
      // ================================================

      const dokumenId =
        Number(req.params.id);

      if (
        !Number.isInteger(dokumenId) ||
        dokumenId <= 0
      ) {

        return res.status(400).json({
          error: "ID dokumen tidak valid"
        });

      }

      // ================================================
      // AMBIL DOKUMEN DARI DATABASE
      // ================================================

      const result =
        await pool.query(
          `
          SELECT
            d.id,
            d.proyek_klien_id,
            d.nama_dokumen,
            d.nama_file_asli,
            d.path_file,
            pk.proyek_id

          FROM public.proyek_klien_dokumen d

          JOIN public.proyek_klien pk
            ON pk.id = d.proyek_klien_id

          WHERE d.id = $1
          `,
          [dokumenId]
        );

      // ================================================
      // VALIDASI DATA DOKUMEN
      // ================================================

      if (result.rows.length === 0) {

        return res.status(404).json({
          error: "Dokumen tidak ditemukan"
        });

      }

      const dokumen =
        result.rows[0];

      if (!dokumen.path_file) {

        return res.status(404).json({
          error: "File dokumen belum tersedia"
        });

      }

      // ================================================
      // VALIDASI HAK AKSES PROYEK
      // ================================================

      // Tambahkan pemeriksaan hak akses berdasarkan
      // dokumen.proyek_id menggunakan aturan PIC
      // dan Admin yang sudah ada di PORTOPRO.
      //
      // Pemeriksaan login saja tidak cukup.
      // Jangan membuat URL sebelum akses disetujui.

      // ================================================
// GENERATE PRESIGNED URL S3
// ================================================

const url =
  await getFileLink(
    dokumen.path_file,
    {
      download:
        req.query.download === "true",

      isPrivate: true,

      originalName:
        dokumen.nama_file_asli
    }
  );

// ================================================
// RESPONSE
// ================================================

return res.json({
  url
});

      // Setelah pemeriksaan hak akses diterapkan,
      // ganti respons 501 di atas dengan kode
      // pembuatan URL pada langkah berikutnya.

    } catch (error) {

      console.error(
        "ERROR GET FILE DOKUMEN KLIEN:",
        error
      );

      return res.status(500).json({
        error: error.message
      });

    }

  }
);
// ======================================================
// DOKUMEN KLIEN
// ======================================================


// TAMBAH DOKUMEN KLIEN - UPLOAD KE S3

app.post(
  "/api/proyek/klien/:proyekKlienId/dokumen",

  uploadDokumenKlien.single(
    "file_dokumen"
  ),

  async (req, res) => {
    const client =
      await pool.connect();

    let s3Key = null;

    let transaksiDimulai =
      false;

    try {
      // ================================================
      // AMBIL DATA
      // ================================================

      const proyekKlienId =
        Number(
          req.params.proyekKlienId
        );

      const {
        nama_dokumen,
        nomor_dokumen
      } = req.body;


      // ================================================
      // VALIDASI ID
      // ================================================

      if (
        !Number.isInteger(proyekKlienId) ||
        proyekKlienId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID proyek klien tidak valid"
        });
      }


      // ================================================
      // VALIDASI NAMA DOKUMEN
      // ================================================

      if (
        !nama_dokumen ||
        !String(
          nama_dokumen
        ).trim()
      ) {
        return res.status(400).json({
          error:
            "Nama dokumen wajib dipilih"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // CEK PROYEK KLIEN
      // SEKALIGUS AMBIL PROYEK ID
      // ================================================

      const klienResult =
        await client.query(
          `
            SELECT
              pk.id,
              pk.proyek_id,
              p.nama_proyek

            FROM public.proyek_klien pk

            JOIN public.proyek p
              ON p.id = pk.proyek_id

            WHERE pk.id = $1

            LIMIT 1
          `,
          [proyekKlienId]
        );


      if (
        klienResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Data proyek klien tidak ditemukan"
        });
      }


      const proyekId =
        Number(
          klienResult
            .rows[0]
            .proyek_id
        );

      const namaProyek =
        klienResult
          .rows[0]
          .nama_proyek;


      // ================================================
      // INFORMASI FILE OPSIONAL
      // ================================================

      let namaFileAsli = null;
      let namaFileSimpan = null;
      let pathFile = null;
      let tipeFile = null;
      let ukuranFile = null;


      // ================================================
      // UPLOAD FILE KE S3
      // ================================================

      if (req.file) {
        const ekstensi =
          path.extname(
            req.file.originalname
          ).toLowerCase();


        const namaFile =
          `/${crypto.randomUUID()}${ekstensi}`;


        const hasilUpload =
          await uploadFile(
            req.file,
            namaFile
          );


        s3Key =
          hasilUpload.key;

        namaFileAsli =
          req.file.originalname ||
          null;

        namaFileSimpan =
          hasilUpload.key;

        pathFile =
          hasilUpload.key;

        tipeFile =
          req.file.mimetype ||
          null;

        ukuranFile =
          req.file.size ??
          null;
      }


      // ================================================
      // SIMPAN KE DATABASE
      // ================================================

      const result =
        await client.query(
          `
            INSERT INTO
              public.proyek_klien_dokumen (
                proyek_klien_id,
                nama_dokumen,
                nomor_dokumen,
                nama_file_asli,
                nama_file_simpan,
                path_file,
                tipe_file,
                ukuran_file
              )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8
            )

            RETURNING *
          `,
          [
            proyekKlienId,

            String(
              nama_dokumen
            ).trim(),

            String(
              nomor_dokumen || ""
            ).trim() || null,

            namaFileAsli,

            namaFileSimpan,

            pathFile,

            tipeFile,

            ukuranFile
          ]
        );


      const dokumenBaru =
        result.rows[0];


      // ================================================
      // FORMAT NILAI ACTIVITY LOG
      // ================================================

      const formatNilaiDokumen =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const nilaiBaruLog = [
        `NAMA DOKUMEN = ${
          formatNilaiDokumen(
            dokumenBaru.nama_dokumen
          )
        }`,

        `NOMOR DOKUMEN = ${
          formatNilaiDokumen(
            dokumenBaru.nomor_dokumen
          )
        }`,

        `NAMA FILE = ${
          dokumenBaru.nama_file_asli
            ? formatNilaiDokumen(
                dokumenBaru
                  .nama_file_asli
              )
            : "Tanpa file"
        }`
      ].join(", ");


      // ================================================
      // SIMPAN ACTIVITY LOG
      // CREATE HANYA NILAI BARU
      // ================================================

      await simpanActivityLog(
        client,
        {
          ...getActivityUser(req),

          aktivitas: "CREATE",
          modul: "PROYEK",

          // Menggunakan proyek ID
          entity_id: proyekId,
          entity_nama: namaProyek,

          field_name:
            "DOKUMEN KLIEN",

          nilai_lama: null,

          nilai_baru:
            nilaiBaruLog,

          deskripsi:
            "menambahkan dokumen klien"
        }
      );


      // ================================================
      // COMMIT
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;


      /*
       * Upload dan database sudah berhasil.
       * Kosongkan agar file tidak dihapus
       * setelah transaksi berhasil.
       */
      s3Key = null;


      // ================================================
      // RESPONSE
      // ================================================

      return res.status(201).json({
        message:
          req.file
            ? "Dokumen dan file berhasil disimpan ke S3"
            : "Dokumen berhasil disimpan tanpa file",

        data:
          dokumenBaru
      });

    } catch (error) {
      // ================================================
      // ROLLBACK DATABASE
      // ================================================

      if (transaksiDimulai) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK DOKUMEN KLIEN:",
            rollbackError
          );
        }
      }


      // ================================================
      // HAPUS FILE S3 JIKA DATABASE / LOG GAGAL
      // ================================================

      if (s3Key) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket:
                process.env.bucket_name,

              Key:
                s3Key
            })
          );

        } catch (hapusError) {
          console.error(
            "GAGAL MEMBERSIHKAN FILE S3:",
            hapusError
          );
        }
      }


      console.error(
        "ERROR SIMPAN DOKUMEN KLIEN:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);

// EDIT DOKUMEN KLIEN - UPLOAD KE S3

app.put(
  "/api/proyek/klien/dokumen/:id",

  uploadDokumenKlien.single(
    "file_dokumen"
  ),

  async (req, res) => {
    let client = null;

    let transaksiDimulai =
      false;

    let s3KeyBaru = null;

    let databaseBerhasil =
      false;

    try {
      // ================================================
      // VALIDASI LOGIN
      // ================================================

      if (!req.session?.user) {
        return res.status(401).json({
          error: "Belum login"
        });
      }


      // ================================================
      // AMBIL DATA
      // ================================================

      const id =
        Number(req.params.id);

      const {
        nama_dokumen,
        nomor_dokumen
      } = req.body;


      // ================================================
      // VALIDASI ID
      // ================================================

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID dokumen tidak valid"
        });
      }


      // ================================================
      // VALIDASI NAMA DOKUMEN
      // ================================================

      if (
        !String(
          nama_dokumen || ""
        ).trim()
      ) {
        return res.status(400).json({
          error:
            "Nama dokumen wajib dipilih"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      client =
        await pool.connect();

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // AMBIL DATA DOKUMEN LAMA
      // ================================================

      const oldResult =
        await client.query(
          `
            SELECT
              d.id,
              d.proyek_klien_id,
              d.nama_dokumen,
              d.nomor_dokumen,
              d.nama_file_asli,
              d.nama_file_simpan,
              d.path_file,
              d.tipe_file,
              d.ukuran_file,

              pk.proyek_id,
              p.nama_proyek

            FROM public.proyek_klien_dokumen d

            JOIN public.proyek_klien pk
              ON pk.id =
                d.proyek_klien_id

            JOIN public.proyek p
              ON p.id =
                pk.proyek_id

            WHERE d.id = $1

            FOR UPDATE OF d
          `,
          [id]
        );


      if (
        oldResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Dokumen tidak ditemukan"
        });
      }


      const dokumenLama =
        oldResult.rows[0];

      const proyekId =
        Number(
          dokumenLama.proyek_id
        );

      const namaProyek =
        dokumenLama.nama_proyek;


      // ================================================
      // VALIDASI HAK AKSES PROYEK
      // ================================================

      /*
       * Terapkan pemeriksaan Admin/PIC
       * menggunakan dokumenLama.proyek_id
       * jika validasi hak akses sudah tersedia.
       */


      // ================================================
      // DEFAULT MENGGUNAKAN FILE LAMA
      // ================================================

      let namaFileAsli =
        dokumenLama.nama_file_asli;

      let namaFileSimpan =
        dokumenLama.nama_file_simpan;

      let pathFile =
        dokumenLama.path_file;

      let tipeFile =
        dokumenLama.tipe_file;

      let ukuranFile =
        dokumenLama.ukuran_file;


      // ================================================
      // JIKA ADA FILE BARU
      // ================================================

      if (req.file) {
        const ekstensi =
          path.extname(
            req.file.originalname
          ).toLowerCase();


        const namaFile =
          `${crypto.randomUUID()}${ekstensi}`;


        const hasilUpload =
          await uploadFile(
            req.file,
            namaFile
          );


        // Digunakan untuk rollback S3
        s3KeyBaru =
          hasilUpload.key;


        namaFileAsli =
          req.file.originalname;

        namaFileSimpan =
          hasilUpload.key;

        pathFile =
          hasilUpload.key;

        tipeFile =
          req.file.mimetype;

        ukuranFile =
          req.file.size;
      }


      // ================================================
      // UPDATE DATABASE
      // ================================================

      const result =
        await client.query(
          `
            UPDATE
              public.proyek_klien_dokumen

            SET
              nama_dokumen = $1,
              nomor_dokumen = $2,
              nama_file_asli = $3,
              nama_file_simpan = $4,
              path_file = $5,
              tipe_file = $6,
              ukuran_file = $7

            WHERE id = $8

            RETURNING *
          `,
          [
            String(
              nama_dokumen
            ).trim(),

            String(
              nomor_dokumen || ""
            ).trim() || null,

            namaFileAsli,

            namaFileSimpan,

            pathFile,

            tipeFile,

            ukuranFile,

            id
          ]
        );


      const dokumenBaru =
        result.rows[0];


      // ================================================
      // FORMAT ACTIVITY LOG
      // ================================================

      const formatNilaiDokumen =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      // ================================================
      // CARI FIELD YANG BERUBAH
      // ================================================

      const perubahanDokumen = [
        {
          label:
            "NAMA DOKUMEN",

          nilai_lama:
            formatNilaiDokumen(
              dokumenLama
                .nama_dokumen
            ),

          nilai_baru:
            formatNilaiDokumen(
              dokumenBaru
                .nama_dokumen
            ),

          paksa: false
        },
        {
          label:
            "NOMOR DOKUMEN",

          nilai_lama:
            formatNilaiDokumen(
              dokumenLama
                .nomor_dokumen
            ),

          nilai_baru:
            formatNilaiDokumen(
              dokumenBaru
                .nomor_dokumen
            ),

          paksa: false
        },
        {
          label:
            "NAMA FILE",

          nilai_lama:
            dokumenLama
              .nama_file_asli
                ? formatNilaiDokumen(
                    dokumenLama
                      .nama_file_asli
                  )
                : "Tanpa file",

          nilai_baru:
            dokumenBaru
              .nama_file_asli
                ? formatNilaiDokumen(
                    dokumenBaru
                      .nama_file_asli
                  )
                : "Tanpa file",

          /*
           * Tetap dianggap berubah jika ada
           * upload file baru, meskipun nama
           * file lama dan baru sama.
           */
          paksa:
            Boolean(req.file)
        }
      ].filter(
        item =>
          item.paksa ||
          item.nilai_lama !==
            item.nilai_baru
      );


      // ================================================
      // SIMPAN SATU ACTIVITY LOG
      // ================================================

      if (
        perubahanDokumen.length > 0
      ) {
        await simpanActivityLog(
          client,
          {
            ...getActivityUser(req),

            aktivitas: "UPDATE",
            modul: "PROYEK",

            // Entity menggunakan proyek ID
            entity_id: proyekId,
            entity_nama: namaProyek,

            field_name:
              "DOKUMEN KLIEN",

            nilai_lama:
              perubahanDokumen
                .map(
                  item =>
                    `${item.label} = ${item.nilai_lama}`
                )
                .join(", "),

            nilai_baru:
              perubahanDokumen
                .map(
                  item =>
                    `${item.label} = ${item.nilai_baru}`
                )
                .join(", "),

            deskripsi:
              "memperbarui dokumen klien"
          }
        );
      }


      // ================================================
      // COMMIT DATABASE DAN LOG
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;
      databaseBerhasil = true;


      // ================================================
      // HAPUS FILE S3 LAMA
      // HANYA SETELAH DATABASE BERHASIL
      // ================================================

      if (
        req.file &&
        dokumenLama.path_file
      ) {
        const s3KeyLama =
          String(
            dokumenLama.path_file
          ).trim();


        const formatKeyS3 =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;


        if (
          formatKeyS3.test(
            s3KeyLama
          ) &&
          s3KeyLama !== s3KeyBaru
        ) {
          try {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket:
                  process.env
                    .bucket_name,

                Key:
                  s3KeyLama
              })
            );

          } catch (hapusError) {
            /*
             * Database sudah berhasil.
             * Kegagalan menghapus file lama
             * tidak membatalkan perubahan.
             */
            console.error(
              "GAGAL HAPUS FILE S3 LAMA:",
              hapusError
            );
          }
        }
      }


      // ================================================
      // RESPONSE
      // ================================================

      return res.json({
        message:
          req.file
            ? "Dokumen dan file berhasil diperbarui"
            : "Dokumen berhasil diperbarui",

        data:
          dokumenBaru
      });

    } catch (error) {
      // ================================================
      // ROLLBACK DATABASE DAN LOG
      // ================================================

      if (
        transaksiDimulai &&
        client
      ) {
        try {
          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK EDIT DOKUMEN KLIEN:",
            rollbackError
          );
        }
      }


      // ================================================
      // HAPUS FILE BARU JIKA TRANSAKSI GAGAL
      // ================================================

      if (
        s3KeyBaru &&
        !databaseBerhasil
      ) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket:
                process.env
                  .bucket_name,

              Key:
                s3KeyBaru
            })
          );

        } catch (hapusError) {
          console.error(
            "GAGAL ROLLBACK FILE S3 BARU:",
            hapusError
          );
        }
      }


      console.error(
        "ERROR EDIT DOKUMEN KLIEN:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// HAPUS DOKUMEN KLIEN
    app.delete(
  "/api/proyek/klien/dokumen/:id",
  async (req, res) => {
    const client =
      await pool.connect();

    let transaksiDimulai =
      false;

    try {
      const id =
        Number(req.params.id);


      // ================================================
      // VALIDASI ID
      // ================================================

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID dokumen tidak valid"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // AMBIL NILAI LAMA DAN INFORMASI PROYEK
      // ================================================

      const oldResult =
        await client.query(
          `
            SELECT
              d.id,
              d.proyek_klien_id,
              d.nama_dokumen,
              d.nomor_dokumen,
              d.nama_file_asli,
              d.nama_file_simpan,
              d.path_file,
              d.tipe_file,
              d.ukuran_file,

              pk.proyek_id,
              p.nama_proyek

            FROM public.proyek_klien_dokumen d

            JOIN public.proyek_klien pk
              ON pk.id =
                d.proyek_klien_id

            JOIN public.proyek p
              ON p.id =
                pk.proyek_id

            WHERE d.id = $1

            FOR UPDATE OF d
          `,
          [id]
        );


      if (
        oldResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Dokumen tidak ditemukan"
        });
      }


      const dokumenLama =
        oldResult.rows[0];

      const proyekId =
        Number(
          dokumenLama.proyek_id
        );

      const namaProyek =
        dokumenLama.nama_proyek;


      // ================================================
      // HAPUS DOKUMEN DARI DATABASE
      // ================================================

      const result =
        await client.query(
          `
            DELETE FROM
              public.proyek_klien_dokumen

            WHERE id = $1

            RETURNING *
          `,
          [id]
        );


      if (
        result.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Dokumen tidak ditemukan"
        });
      }


      // ================================================
      // FORMAT NILAI LAMA
      // ================================================

      const formatNilaiDokumen =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const nilaiLamaLog = [
        `NAMA DOKUMEN = ${
          formatNilaiDokumen(
            dokumenLama.nama_dokumen
          )
        }`,

        `NOMOR DOKUMEN = ${
          formatNilaiDokumen(
            dokumenLama.nomor_dokumen
          )
        }`,

        `NAMA FILE = ${
          dokumenLama.nama_file_asli
            ? formatNilaiDokumen(
                dokumenLama
                  .nama_file_asli
              )
            : "Tanpa file"
        }`
      ].join(", ");


      // ================================================
      // SIMPAN ACTIVITY LOG
      // DELETE HANYA NILAI LAMA
      // ================================================

      await simpanActivityLog(
        client,
        {
          ...getActivityUser(req),

          aktivitas: "DELETE",
          modul: "PROYEK",

          // Entity menggunakan proyek ID
          entity_id: proyekId,
          entity_nama: namaProyek,

          field_name:
            "DOKUMEN KLIEN",

          nilai_lama:
            nilaiLamaLog,

          nilai_baru: null,

          deskripsi:
            "menghapus dokumen klien"
        }
      );


      // ================================================
      // COMMIT
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;


      return res.json({
        message:
          "Dokumen berhasil dihapus"
      });

    } catch (error) {
      if (transaksiDimulai) {
        try {
          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK DELETE DOKUMEN KLIEN:",
            rollbackError
          );
        }
      }


      console.error(
        "ERROR DELETE DOKUMEN KLIEN:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);


// ======================================================
// DOKUMEN PARTNER
// ======================================================


// GET URL FILE DOKUMEN PARTNER

app.get(
  "/api/proyek/partner/dokumen/:id/file",

  async (req, res) => {

    try {

      // ================================================
      // VALIDASI LOGIN
      // ================================================

      if (!req.session?.user) {

        return res.status(401).json({
          error: "Belum login"
        });

      }

      // ================================================
      // VALIDASI ID
      // ================================================

      const dokumenId =
        Number(req.params.id);

      if (
        !Number.isInteger(dokumenId) ||
        dokumenId <= 0
      ) {

        return res.status(400).json({
          error: "ID dokumen partner tidak valid"
        });

      }

      // ================================================
      // AMBIL DATA DOKUMEN
      // ================================================

      const result =
        await pool.query(
          `
          SELECT
            d.id,
            d.nama_file_asli,
            d.path_file,
            pp.proyek_id

          FROM public.proyek_partner_dokumen d

          JOIN public.proyek_partner pp
            ON pp.id = d.proyek_partner_id

          WHERE d.id = $1
          `,
          [dokumenId]
        );

      if (result.rows.length === 0) {

        return res.status(404).json({
          error: "Dokumen partner tidak ditemukan"
        });

      }

      const dokumen =
        result.rows[0];

      if (!dokumen.path_file) {

        return res.status(404).json({
          error: "File dokumen belum tersedia"
        });

      }

      // ================================================
      // VALIDASI HAK AKSES PROYEK
      // ================================================

      // Terapkan aturan akses Admin/PIC PORTOPRO
      // terhadap dokumen.proyek_id.
      //
      // Jangan membuat presigned URL sebelum
      // hak akses pengguna berhasil diverifikasi.

      
      const url =
        await getFileLink(
          dokumen.path_file,
          {
            download:
              req.query.download === "true",

            isPrivate: true,

            originalName:
              dokumen.nama_file_asli
          }
        );

      return res.json({
        url
      });

      // Setelah pemeriksaan hak akses diterapkan,
      // ganti respons 501 dengan kode pada
      // langkah berikutnya.

    } catch (error) {

      console.error(
        "ERROR GET FILE DOKUMEN PARTNER:",
        error
      );

      return res.status(500).json({
        error: error.message
      });

    }

  }
);
// TAMBAH DOKUMEN PARTNER - UPLOAD KE S3

app.post(
  "/api/proyek/partner/:proyekPartnerId/dokumen",

  uploadDokumenKlien.single(
    "file_dokumen"
  ),

  async (req, res) => {
    let client = null;

    let transaksiDimulai =
      false;

    let s3KeyBaru = null;

    let databaseBerhasil =
      false;

    try {
      // ================================================
      // VALIDASI LOGIN
      // ================================================

      if (!req.session?.user) {
        return res.status(401).json({
          error: "Belum login"
        });
      }


      // ================================================
      // AMBIL DATA
      // ================================================

      const proyekPartnerId =
        Number(
          req.params.proyekPartnerId
        );

      const {
        nama_dokumen,
        nomor_dokumen
      } = req.body;


      // ================================================
      // VALIDASI ID
      // ================================================

      if (
        !Number.isInteger(
          proyekPartnerId
        ) ||
        proyekPartnerId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID partner proyek tidak valid"
        });
      }


      // ================================================
      // VALIDASI NAMA DOKUMEN
      // ================================================

      if (
        !String(
          nama_dokumen || ""
        ).trim()
      ) {
        return res.status(400).json({
          error:
            "Nama dokumen wajib dipilih"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      client =
        await pool.connect();

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // CEK PARTNER PROYEK
      // SEKALIGUS AMBIL PROYEK ID DAN NAMA PROYEK
      // ================================================

      const partnerCheck =
        await client.query(
          `
            SELECT
              pp.id,
              pp.proyek_id,
              p.nama_proyek

            FROM public.proyek_partner pp

            JOIN public.proyek p
              ON p.id = pp.proyek_id

            WHERE pp.id = $1

            LIMIT 1
          `,
          [proyekPartnerId]
        );


      if (
        partnerCheck.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Data partner proyek tidak ditemukan"
        });
      }


      const proyekId =
        Number(
          partnerCheck
            .rows[0]
            .proyek_id
        );

      const namaProyek =
        partnerCheck
          .rows[0]
          .nama_proyek;


      // ================================================
      // VALIDASI HAK AKSES PROYEK
      // ================================================

      /*
       * Terapkan pemeriksaan Admin/PIC terhadap
       * proyekId jika fungsi validasi hak akses
       * sudah tersedia.
       */


      // ================================================
      // DEFAULT FILE OPSIONAL
      // ================================================

      let namaFileAsli = null;
      let namaFileServer = null;
      let pathFile = null;
      let mimeType = null;
      let ukuranFile = null;


      // ================================================
      // JIKA ADA FILE, UPLOAD KE S3
      // ================================================

      if (req.file) {
        const ekstensi =
          path.extname(
            req.file.originalname
          ).toLowerCase();


        const namaFile =
          `${crypto.randomUUID()}${ekstensi}`;


        const hasilUpload =
          await uploadFile(
            req.file,
            namaFile
          );


        // Digunakan untuk rollback S3
        s3KeyBaru =
          hasilUpload.key;


        namaFileAsli =
          req.file.originalname;

        namaFileServer =
          hasilUpload.key;

        pathFile =
          hasilUpload.key;

        mimeType =
          req.file.mimetype;

        ukuranFile =
          req.file.size;
      }


      // ================================================
      // SIMPAN KE DATABASE
      // ================================================

      const result =
        await client.query(
          `
            INSERT INTO
              public.proyek_partner_dokumen (
                proyek_partner_id,
                nama_dokumen,
                nomor_dokumen,
                nama_file_asli,
                nama_file_server,
                path_file,
                mime_type,
                ukuran_file
              )

            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8
            )

            RETURNING *
          `,
          [
            proyekPartnerId,

            String(
              nama_dokumen
            ).trim(),

            String(
              nomor_dokumen || ""
            ).trim() || null,

            namaFileAsli,

            namaFileServer,

            pathFile,

            mimeType,

            ukuranFile
          ]
        );


      const dokumenBaru =
        result.rows[0];


      // ================================================
      // FORMAT NILAI LOG
      // ================================================

      const formatNilaiDokumen =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const nilaiBaruLog = [
        `NAMA DOKUMEN = ${
          formatNilaiDokumen(
            dokumenBaru.nama_dokumen
          )
        }`,

        `NOMOR DOKUMEN = ${
          formatNilaiDokumen(
            dokumenBaru.nomor_dokumen
          )
        }`,

        `NAMA FILE = ${
          dokumenBaru.nama_file_asli
            ? formatNilaiDokumen(
                dokumenBaru
                  .nama_file_asli
              )
            : "Tanpa file"
        }`
      ].join(", ");


      // ================================================
      // SIMPAN ACTIVITY LOG
      // CREATE HANYA NILAI BARU
      // ================================================

      await simpanActivityLog(
        client,
        {
          ...getActivityUser(req),

          aktivitas: "CREATE",
          modul: "PROYEK",

          // Entity menggunakan proyek ID
          entity_id: proyekId,
          entity_nama: namaProyek,

          field_name:
            "DOKUMEN PARTNER",

          nilai_lama: null,

          nilai_baru:
            nilaiBaruLog,

          deskripsi:
            "menambahkan dokumen partner"
        }
      );


      // ================================================
      // COMMIT DATABASE DAN LOG
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;
      databaseBerhasil = true;


      // ================================================
      // RESPONSE
      // ================================================

      return res.status(201).json({
        message:
          "Dokumen partner berhasil ditambahkan",

        data:
          dokumenBaru
      });

    } catch (error) {
      // ================================================
      // ROLLBACK DATABASE DAN LOG
      // ================================================

      if (
        transaksiDimulai &&
        client
      ) {
        try {
          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK DOKUMEN PARTNER:",
            rollbackError
          );
        }
      }


      // ================================================
      // ROLLBACK FILE S3 JIKA INSERT / LOG GAGAL
      // ================================================

      if (
        s3KeyBaru &&
        !databaseBerhasil
      ) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket:
                process.env
                  .bucket_name,

              Key:
                s3KeyBaru
            })
          );

        } catch (hapusError) {
          console.error(
            "GAGAL ROLLBACK FILE S3 PARTNER:",
            hapusError
          );
        }
      }


      console.error(
        "ERROR TAMBAH DOKUMEN PARTNER:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// EDIT DOKUMEN PARTNER - UPLOAD KE S3

app.put(
  "/api/proyek/partner/dokumen/:id",

  uploadDokumenKlien.single(
    "file_dokumen"
  ),

  async (req, res) => {
    let client = null;

    let transaksiDimulai =
      false;

    let s3KeyBaru = null;

    let databaseBerhasil =
      false;

    try {
      // ================================================
      // VALIDASI LOGIN
      // ================================================

      if (!req.session?.user) {
        return res.status(401).json({
          error: "Belum login"
        });
      }


      // ================================================
      // AMBIL DATA
      // ================================================

      const id =
        Number(req.params.id);

      const {
        nama_dokumen,
        nomor_dokumen
      } = req.body;


      // ================================================
      // VALIDASI ID
      // ================================================

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID dokumen partner tidak valid"
        });
      }


      // ================================================
      // VALIDASI NAMA DOKUMEN
      // ================================================

      if (
        !String(
          nama_dokumen || ""
        ).trim()
      ) {
        return res.status(400).json({
          error:
            "Nama dokumen wajib diisi"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      client =
        await pool.connect();

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // AMBIL DATA DOKUMEN LAMA
      // ================================================

      const dokumenResult =
        await client.query(
          `
            SELECT
              d.id,
              d.proyek_partner_id,
              d.nama_dokumen,
              d.nomor_dokumen,
              d.nama_file_asli,
              d.nama_file_server,
              d.path_file,
              d.mime_type,
              d.ukuran_file,

              pp.proyek_id,
              p.nama_proyek

            FROM public.proyek_partner_dokumen d

            JOIN public.proyek_partner pp
              ON pp.id =
                d.proyek_partner_id

            JOIN public.proyek p
              ON p.id =
                pp.proyek_id

            WHERE d.id = $1

            FOR UPDATE OF d
          `,
          [id]
        );


      if (
        dokumenResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Dokumen partner tidak ditemukan"
        });
      }


      const dokumenLama =
        dokumenResult.rows[0];

      const proyekId =
        Number(
          dokumenLama.proyek_id
        );

      const namaProyek =
        dokumenLama.nama_proyek;


      // ================================================
      // VALIDASI HAK AKSES PROYEK
      // ================================================

      /*
       * Terapkan pemeriksaan Admin/PIC
       * terhadap dokumenLama.proyek_id
       * jika fungsi hak akses sudah tersedia.
       */


      // ================================================
      // DEFAULT MENGGUNAKAN FILE LAMA
      // ================================================

      let namaFileAsli =
        dokumenLama.nama_file_asli;

      let namaFileServer =
        dokumenLama.nama_file_server;

      let pathFile =
        dokumenLama.path_file;

      let mimeType =
        dokumenLama.mime_type;

      let ukuranFile =
        dokumenLama.ukuran_file;


      // ================================================
      // JIKA ADA FILE BARU
      // ================================================

      if (req.file) {
        const ekstensi =
          path.extname(
            req.file.originalname
          ).toLowerCase();


        const namaFile =
          `${crypto.randomUUID()}${ekstensi}`;


        const hasilUpload =
          await uploadFile(
            req.file,
            namaFile
          );


        // Digunakan jika transaksi gagal
        s3KeyBaru =
          hasilUpload.key;


        namaFileAsli =
          req.file.originalname;

        namaFileServer =
          hasilUpload.key;

        pathFile =
          hasilUpload.key;

        mimeType =
          req.file.mimetype;

        ukuranFile =
          req.file.size;
      }


      // ================================================
      // UPDATE DATABASE
      // ================================================

      const result =
        await client.query(
          `
            UPDATE
              public.proyek_partner_dokumen

            SET
              nama_dokumen = $1,
              nomor_dokumen = $2,
              nama_file_asli = $3,
              nama_file_server = $4,
              path_file = $5,
              mime_type = $6,
              ukuran_file = $7

            WHERE id = $8

            RETURNING *
          `,
          [
            String(
              nama_dokumen
            ).trim(),

            String(
              nomor_dokumen || ""
            ).trim() || null,

            namaFileAsli,

            namaFileServer,

            pathFile,

            mimeType,

            ukuranFile,

            id
          ]
        );


      const dokumenBaru =
        result.rows[0];


      // ================================================
      // FORMAT NILAI LOG
      // ================================================

      const formatNilaiDokumen =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      // ================================================
      // CARI FIELD YANG BERUBAH
      // ================================================

      const perubahanDokumen = [
        {
          label:
            "NAMA DOKUMEN",

          nilai_lama:
            formatNilaiDokumen(
              dokumenLama
                .nama_dokumen
            ),

          nilai_baru:
            formatNilaiDokumen(
              dokumenBaru
                .nama_dokumen
            ),

          paksa: false
        },
        {
          label:
            "NOMOR DOKUMEN",

          nilai_lama:
            formatNilaiDokumen(
              dokumenLama
                .nomor_dokumen
            ),

          nilai_baru:
            formatNilaiDokumen(
              dokumenBaru
                .nomor_dokumen
            ),

          paksa: false
        },
        {
          label:
            "NAMA FILE",

          nilai_lama:
            dokumenLama
              .nama_file_asli
                ? formatNilaiDokumen(
                    dokumenLama
                      .nama_file_asli
                  )
                : "Tanpa file",

          nilai_baru:
            dokumenBaru
              .nama_file_asli
                ? formatNilaiDokumen(
                    dokumenBaru
                      .nama_file_asli
                  )
                : "Tanpa file",

          /*
           * Tetap dianggap berubah apabila
           * file baru diunggah meskipun nama
           * file sama dengan file sebelumnya.
           */
          paksa:
            Boolean(req.file)
        }
      ].filter(
        item =>
          item.paksa ||
          item.nilai_lama !==
            item.nilai_baru
      );


      // ================================================
      // SIMPAN SATU ACTIVITY LOG
      // ================================================

      if (
        perubahanDokumen.length > 0
      ) {
        await simpanActivityLog(
          client,
          {
            ...getActivityUser(req),

            aktivitas: "UPDATE",
            modul: "PROYEK",

            // Entity menggunakan proyek ID
            entity_id: proyekId,
            entity_nama: namaProyek,

            field_name:
              "DOKUMEN PARTNER",

            nilai_lama:
              perubahanDokumen
                .map(
                  item =>
                    `${item.label} = ${item.nilai_lama}`
                )
                .join(", "),

            nilai_baru:
              perubahanDokumen
                .map(
                  item =>
                    `${item.label} = ${item.nilai_baru}`
                )
                .join(", "),

            deskripsi:
              "memperbarui dokumen partner"
          }
        );
      }


      // ================================================
      // COMMIT DATABASE DAN LOG
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;
      databaseBerhasil = true;


      // ================================================
      // HAPUS FILE S3 LAMA
      // HANYA SETELAH DATABASE BERHASIL
      // ================================================

      if (
        req.file &&
        dokumenLama.path_file
      ) {
        const s3KeyLama =
          String(
            dokumenLama.path_file
          ).trim();


        const formatKeyS3 =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;


        if (
          formatKeyS3.test(
            s3KeyLama
          ) &&
          s3KeyLama !== s3KeyBaru
        ) {
          try {
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket:
                  process.env
                    .bucket_name,

                Key:
                  s3KeyLama
              })
            );

          } catch (hapusError) {
            /*
             * Database sudah berhasil.
             * Kegagalan menghapus file lama
             * tidak membatalkan perubahan.
             */
            console.error(
              "GAGAL HAPUS FILE S3 PARTNER LAMA:",
              hapusError
            );
          }
        }
      }


      // ================================================
      // RESPONSE
      // ================================================

      return res.json({
        message:
          req.file
            ? "Dokumen dan file partner berhasil diperbarui"
            : "Dokumen partner berhasil diperbarui",

        data:
          dokumenBaru
      });

    } catch (error) {
      // ================================================
      // ROLLBACK DATABASE DAN LOG
      // ================================================

      if (
        transaksiDimulai &&
        client
      ) {
        try {
          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK EDIT DOKUMEN PARTNER:",
            rollbackError
          );
        }
      }


      // ================================================
      // ROLLBACK FILE S3 BARU
      // ================================================

      if (
        s3KeyBaru &&
        !databaseBerhasil
      ) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket:
                process.env
                  .bucket_name,

              Key:
                s3KeyBaru
            })
          );

        } catch (hapusError) {
          console.error(
            "GAGAL ROLLBACK FILE S3 PARTNER:",
            hapusError
          );
        }
      }


      console.error(
        "ERROR EDIT DOKUMEN PARTNER:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// HAPUS DOKUMEN PARTNER

app.delete(
  "/api/proyek/partner/dokumen/:id",
  async (req, res) => {
    const client =
      await pool.connect();

    let transaksiDimulai =
      false;

    try {
      const id =
        Number(req.params.id);


      // ================================================
      // VALIDASI ID
      // ================================================

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID dokumen partner tidak valid"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // AMBIL NILAI LAMA DAN INFORMASI PROYEK
      // ================================================

      const oldResult =
        await client.query(
          `
            SELECT
              d.id,
              d.proyek_partner_id,
              d.nama_dokumen,
              d.nomor_dokumen,
              d.nama_file_asli,
              d.nama_file_server,
              d.path_file,
              d.mime_type,
              d.ukuran_file,

              pp.proyek_id,
              p.nama_proyek

            FROM public.proyek_partner_dokumen d

            JOIN public.proyek_partner pp
              ON pp.id =
                d.proyek_partner_id

            JOIN public.proyek p
              ON p.id =
                pp.proyek_id

            WHERE d.id = $1

            FOR UPDATE OF d
          `,
          [id]
        );


      if (
        oldResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Dokumen partner tidak ditemukan"
        });
      }


      const dokumenLama =
        oldResult.rows[0];

      const proyekId =
        Number(
          dokumenLama.proyek_id
        );

      const namaProyek =
        dokumenLama.nama_proyek;


      // ================================================
      // HAPUS DOKUMEN PARTNER
      // ================================================

      const result =
        await client.query(
          `
            DELETE FROM
              public.proyek_partner_dokumen

            WHERE id = $1

            RETURNING *
          `,
          [id]
        );


      if (
        result.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Dokumen partner tidak ditemukan"
        });
      }


      // ================================================
      // FORMAT NILAI LAMA
      // ================================================

      const formatNilaiDokumen =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const nilaiLamaLog = [
        `NAMA DOKUMEN = ${
          formatNilaiDokumen(
            dokumenLama.nama_dokumen
          )
        }`,

        `NOMOR DOKUMEN = ${
          formatNilaiDokumen(
            dokumenLama.nomor_dokumen
          )
        }`,

        `NAMA FILE = ${
          dokumenLama.nama_file_asli
            ? formatNilaiDokumen(
                dokumenLama
                  .nama_file_asli
              )
            : "Tanpa file"
        }`
      ].join(", ");


      // ================================================
      // SIMPAN ACTIVITY LOG
      // DELETE HANYA NILAI LAMA
      // ================================================

      await simpanActivityLog(
        client,
        {
          ...getActivityUser(req),

          aktivitas: "DELETE",
          modul: "PROYEK",

          // Entity menggunakan proyek ID
          entity_id: proyekId,
          entity_nama: namaProyek,

          field_name:
            "DOKUMEN PARTNER",

          nilai_lama:
            nilaiLamaLog,

          nilai_baru: null,

          deskripsi:
            "menghapus dokumen partner"
        }
      );


      // ================================================
      // COMMIT
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;


      return res.json({
        message:
          "Dokumen partner berhasil dihapus"
      });

    } catch (error) {
      if (transaksiDimulai) {
        try {
          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK HAPUS DOKUMEN PARTNER:",
            rollbackError
          );
        }
      }


      console.error(
        "ERROR HAPUS DOKUMEN PARTNER:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);

// ======================================================
// GET TIMELINE PROYEK
// ======================================================

app.get(
  "/api/proyek/:proyekId/timeline",
  async (req, res) => {
    try {
      const proyekId =
        Number(req.params.proyekId);

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID proyek tidak valid"
        });
      }

      const result =
        await pool.query(
          `
            SELECT
              id,
              proyek_id,
              deskripsi,
              tanggal_mulai,
              tanggal_akhir,
              status,
              created_at,
              updated_at
            FROM public.proyek_timeline
            WHERE proyek_id = $1
            ORDER BY
              tanggal_mulai ASC,
              id ASC
          `,
          [proyekId]
        );

      res.json(result.rows);

    } catch (error) {
      console.error(
        "ERROR GET TIMELINE:",
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);


// ======================================================
// TAMBAH TIMELINE
// ======================================================

app.post(
  "/api/proyek/:proyekId/timeline",
  async (req, res) => {

    const client =
      await pool.connect();

    let transactionAktif =
      false;

    try {

      const proyekId =
        Number(
          req.params.proyekId
        );

      const {
        deskripsi,
        tanggal_mulai,
        tanggal_akhir,
        status
      } = req.body;


      // =========================================
      // VALIDASI PROYEK ID
      // =========================================

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {

        return res.status(400).json({
          error:
            "ID proyek tidak valid"
        });

      }


      // =========================================
      // VALIDASI DESKRIPSI
      // =========================================

      if (!deskripsi?.trim()) {

        return res.status(400).json({
          error:
            "Deskripsi wajib diisi"
        });

      }


      // =========================================
      // VALIDASI TANGGAL
      // =========================================

      if (
        !tanggal_mulai ||
        !tanggal_akhir
      ) {

        return res.status(400).json({
          error:
            "Tanggal mulai dan akhir wajib diisi"
        });

      }


      if (
        tanggal_akhir <
        tanggal_mulai
      ) {

        return res.status(400).json({
          error:
            "Tanggal akhir tidak boleh sebelum tanggal mulai"
        });

      }


      // =========================================
      // VALIDASI STATUS
      // =========================================

      const statusValid = [
        "Aktif",
        "Berakhir",
        "Diperpanjang"
      ];


      if (
        !statusValid.includes(status)
      ) {

        return res.status(400).json({
          error:
            "Status Timeline tidak valid"
        });

      }


      await client.query(
        "BEGIN"
      );

      transactionAktif =
        true;


      // =========================================
      // AMBIL INFORMASI PROYEK
      // =========================================

      const proyekResult =
        await client.query(
          `
          SELECT
            id,
            nama_proyek

          FROM public.proyek

          WHERE id = $1
          `,
          [proyekId]
        );


      if (
        proyekResult.rows.length === 0
      ) {

        await client.query(
          "ROLLBACK"
        );

        transactionAktif =
          false;

        return res.status(404).json({
          error:
            "Proyek tidak ditemukan"
        });

      }


      const proyek =
        proyekResult.rows[0];


      // =========================================
      // SIMPAN TIMELINE
      // =========================================

      const result =
        await client.query(
          `
          INSERT INTO
            public.proyek_timeline (
              proyek_id,
              deskripsi,
              tanggal_mulai,
              tanggal_akhir,
              status
            )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )

          RETURNING *
          `,
          [
            proyekId,
            deskripsi.trim(),
            tanggal_mulai,
            tanggal_akhir,
            status
          ]
        );


      const savedTimeline =
        result.rows[0];


      // =========================================
      // FORMAT TANGGAL INDONESIA
      // Tidak menggunakan new Date agar tanggal
      // tidak mundur akibat konversi timezone
      // =========================================

      const namaBulan = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember"
      ];


      const formatTanggalIndonesia =
        value => {

          const [
            tahun,
            bulan,
            tanggal
          ] = String(value)
            .slice(0, 10)
            .split("-");


          return (
            `${Number(tanggal)} ` +
            `${namaBulan[
              Number(bulan) - 1
            ]} ` +
            `${tahun}`
          );

        };


     const tanggalMulaiText =
  formatTanggalIndonesia(
    tanggal_mulai
  );


const tanggalAkhirText =
  formatTanggalIndonesia(
    tanggal_akhir
  );


const nilaiLog =
  [
    `DESKRIPSI = ${deskripsi.trim()}`,
    `TANGGAL MULAI = ${tanggalMulaiText}`,
    `TANGGAL AKHIR = ${tanggalAkhirText}`
  ].join(", ");


const activityUser =
  getActivityUser(req);


await simpanActivityLog(
  client,
  {
    ...activityUser,

    aktivitas:
      "CREATE",

    modul:
      "PROYEK",

    entity_id:
      proyekId,

    entity_nama:
      proyek.nama_proyek,

    field_name:
      "TIMELINE",

    nilai_lama:
      "-",

    nilai_baru:
      nilaiLog,

    deskripsi:
      "menambahkan timeline proyek"
  }
);


      // =========================================
      // COMMIT
      // =========================================

      await client.query(
        "COMMIT"
      );

      transactionAktif =
        false;


      return res
        .status(201)
        .json({
          message:
            "Timeline berhasil ditambahkan",

          data:
            savedTimeline
        });


    } catch (error) {

      if (transactionAktif) {

        try {

          await client.query(
            "ROLLBACK"
          );

        } catch (
          rollbackError
        ) {

          console.error(
            "ERROR ROLLBACK TIMELINE:",
            rollbackError
          );

        }

      }


      console.error(
        "ERROR TAMBAH TIMELINE:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });


    } finally {

      client.release();

    }

  }
);


// ======================================================
// EDIT TIMELINE
// ======================================================

app.put(
  "/api/proyek/timeline/:id",
  async (req, res) => {

    const client =
      await pool.connect();

    let transactionAktif =
      false;

    try {

      const timelineId =
        Number(req.params.id);

      const {
        deskripsi,
        tanggal_mulai,
        tanggal_akhir,
        status
      } = req.body;


      // =========================================
      // VALIDASI
      // =========================================

      if (
        !Number.isInteger(
          timelineId
        ) ||
        timelineId <= 0
      ) {

        return res.status(400).json({
          error:
            "ID timeline tidak valid"
        });

      }


      if (!deskripsi?.trim()) {

        return res.status(400).json({
          error:
            "Deskripsi wajib diisi"
        });

      }


      if (
        !tanggal_mulai ||
        !tanggal_akhir
      ) {

        return res.status(400).json({
          error:
            "Tanggal mulai dan tanggal akhir wajib diisi"
        });

      }


      /*
       * Karena format input adalah YYYY-MM-DD,
       * perbandingan string dapat digunakan dan
       * tidak terkena masalah timezone.
       */
      if (
        tanggal_akhir <
        tanggal_mulai
      ) {

        return res.status(400).json({
          error:
            "Tanggal akhir tidak boleh sebelum tanggal mulai"
        });

      }


      const statusValid = [
        "Aktif",
        "Berakhir",
        "Diperpanjang"
      ];


      if (
        !statusValid.includes(status)
      ) {

        return res.status(400).json({
          error:
            "Status Timeline tidak valid"
        });

      }


      await client.query(
        "BEGIN"
      );

      transactionAktif =
        true;


      // =========================================
      // AMBIL DATA TIMELINE SEBELUM DIUBAH
      // =========================================

      const oldResult =
        await client.query(
          `
          SELECT
            timeline.id,
            timeline.proyek_id,
            timeline.deskripsi,
            timeline.tanggal_mulai,
            timeline.tanggal_akhir,
            timeline.status,
            proyek.nama_proyek

          FROM public.proyek_timeline timeline

          JOIN public.proyek proyek
            ON proyek.id =
              timeline.proyek_id

          WHERE timeline.id = $1

          FOR UPDATE
          `,
          [timelineId]
        );


      if (
        oldResult.rows.length === 0
      ) {

        await client.query(
          "ROLLBACK"
        );

        transactionAktif =
          false;

        return res.status(404).json({
          error:
            "Timeline tidak ditemukan"
        });

      }


      const timelineLama =
        oldResult.rows[0];


      // =========================================
      // NORMALISASI NILAI
      // =========================================

      const deskripsiBaru =
        deskripsi.trim();


      const normalisasiTanggal =
        value => {

          if (!value) {
            return "";
          }

          if (
            typeof value === "string"
          ) {

            return value.slice(
              0,
              10
            );

          }

          if (
            value instanceof Date
          ) {

            return value
              .toISOString()
              .slice(0, 10);

          }

          return String(value)
            .slice(0, 10);

        };


      const tanggalMulaiLama =
        normalisasiTanggal(
          timelineLama.tanggal_mulai
        );


      const tanggalAkhirLama =
        normalisasiTanggal(
          timelineLama.tanggal_akhir
        );


      const tanggalMulaiBaru =
        normalisasiTanggal(
          tanggal_mulai
        );


      const tanggalAkhirBaru =
        normalisasiTanggal(
          tanggal_akhir
        );


      // =========================================
      // UPDATE TIMELINE
      // =========================================

      const result =
        await client.query(
          `
          UPDATE public.proyek_timeline

          SET
            deskripsi = $1,
            tanggal_mulai = $2,
            tanggal_akhir = $3,
            status = $4,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $5

          RETURNING *
          `,
          [
            deskripsiBaru,
            tanggalMulaiBaru,
            tanggalAkhirBaru,
            status,
            timelineId
          ]
        );


      const timelineBaru =
        result.rows[0];


      // =========================================
      // FORMAT TANGGAL INDONESIA
      // =========================================

      const namaBulan = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember"
      ];


      const formatTanggalIndonesia =
        value => {

          if (!value) {
            return "-";
          }

          const [
            tahun,
            bulan,
            tanggal
          ] = normalisasiTanggal(
            value
          ).split("-");


          return (
            `${Number(tanggal)} ` +
            `${namaBulan[
              Number(bulan) - 1
            ]} ` +
            `${tahun}`
          );

        };


      // =========================================
      // CATAT FIELD YANG BERUBAH
      // DALAM SATU ACTIVITY LOG
      // =========================================

      const nilaiLamaLog = [];
      const nilaiBaruLog = [];


      if (
        timelineLama.deskripsi !==
        deskripsiBaru
      ) {

        nilaiLamaLog.push(
          `DESKRIPSI = ${timelineLama.deskripsi || "-"}`
        );

        nilaiBaruLog.push(
          `DESKRIPSI = ${deskripsiBaru}`
        );

      }


      if (
        tanggalMulaiLama !==
        tanggalMulaiBaru
      ) {

        nilaiLamaLog.push(
          `TANGGAL MULAI = ${
            formatTanggalIndonesia(
              tanggalMulaiLama
            )
          }`
        );

        nilaiBaruLog.push(
          `TANGGAL MULAI = ${
            formatTanggalIndonesia(
              tanggalMulaiBaru
            )
          }`
        );

      }


      if (
        tanggalAkhirLama !==
        tanggalAkhirBaru
      ) {

        nilaiLamaLog.push(
          `TANGGAL AKHIR = ${
            formatTanggalIndonesia(
              tanggalAkhirLama
            )
          }`
        );

        nilaiBaruLog.push(
          `TANGGAL AKHIR = ${
            formatTanggalIndonesia(
              tanggalAkhirBaru
            )
          }`
        );

      }


      if (
        timelineLama.status !==
        status
      ) {

        nilaiLamaLog.push(
          `STATUS = ${
            timelineLama.status ||
            "-"
          }`
        );

        nilaiBaruLog.push(
          `STATUS = ${status}`
        );

      }


      // =========================================
      // SIMPAN SATU ACTIVITY LOG
      // =========================================

      if (
        nilaiBaruLog.length > 0
      ) {

        const activityUser =
          getActivityUser(req);


        await simpanActivityLog(
          client,
          {
            ...activityUser,

            aktivitas:
              "UPDATE",

            modul:
              "PROYEK",

            /*
             * Entity ID menggunakan
             * proyek_id, bukan timelineId.
             */
            entity_id:
              timelineLama.proyek_id,

            entity_nama:
              timelineLama.nama_proyek,

            field_name:
              "TIMELINE",

            nilai_lama:
              nilaiLamaLog.join(", "),

            nilai_baru:
              nilaiBaruLog.join(", "),

            deskripsi:
              "memperbarui timeline proyek"
          }
        );

      }


      await client.query(
        "COMMIT"
      );

      transactionAktif =
        false;


      return res.json({
        message:
          nilaiBaruLog.length > 0
            ? "Timeline berhasil diperbarui"
            : "Tidak ada perubahan pada timeline",

        data:
          timelineBaru
      });


    } catch (error) {

      if (transactionAktif) {

        try {

          await client.query(
            "ROLLBACK"
          );

        } catch (
          rollbackError
        ) {

          console.error(
            "ERROR ROLLBACK EDIT TIMELINE:",
            rollbackError
          );

        }

      }


      console.error(
        "ERROR EDIT TIMELINE:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });


    } finally {

      client.release();

    }

  }
);


// ======================================================
// HAPUS TIMELINE
// ======================================================

app.delete(
  "/api/proyek/timeline/:id",
  async (req, res) => {

    const client =
      await pool.connect();

    let transactionAktif =
      false;

    try {

      const timelineId =
        Number(req.params.id);


      // =========================================
      // VALIDASI ID TIMELINE
      // =========================================

      if (
        !Number.isInteger(
          timelineId
        ) ||
        timelineId <= 0
      ) {

        return res.status(400).json({
          error:
            "ID timeline tidak valid"
        });

      }


      await client.query(
        "BEGIN"
      );

      transactionAktif =
        true;


      // =========================================
      // AMBIL DATA SEBELUM DIHAPUS
      // =========================================

      const oldResult =
        await client.query(
          `
          SELECT
            timeline.id,
            timeline.proyek_id,
            timeline.deskripsi,
            timeline.tanggal_mulai,
            timeline.tanggal_akhir,
            timeline.status,
            proyek.nama_proyek

          FROM public.proyek_timeline timeline

          JOIN public.proyek proyek
            ON proyek.id =
              timeline.proyek_id

          WHERE timeline.id = $1

          FOR UPDATE OF timeline
          `,
          [timelineId]
        );


      if (
        oldResult.rows.length === 0
      ) {

        await client.query(
          "ROLLBACK"
        );

        transactionAktif =
          false;

        return res.status(404).json({
          error:
            "Timeline tidak ditemukan"
        });

      }


      const timelineLama =
        oldResult.rows[0];


      // =========================================
      // FORMAT TANGGAL INDONESIA
      // =========================================

      const namaBulan = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember"
      ];


      const normalisasiTanggal =
        value => {

          if (!value) {
            return "";
          }

          if (
            typeof value === "string"
          ) {

            return value.slice(
              0,
              10
            );

          }

          if (
            value instanceof Date
          ) {

            return value
              .toISOString()
              .slice(0, 10);

          }

          return String(value)
            .slice(0, 10);

        };


      const formatTanggalIndonesia =
        value => {

          const tanggalNormal =
            normalisasiTanggal(value);


          if (!tanggalNormal) {
            return "-";
          }


          const [
            tahun,
            bulan,
            tanggal
          ] = tanggalNormal.split("-");


          return (
            `${Number(tanggal)} ` +
            `${namaBulan[
              Number(bulan) - 1
            ]} ` +
            `${tahun}`
          );

        };


      // =========================================
      // SUSUN ISI LOG SEBELUM DIHAPUS
      // =========================================

      const nilaiLamaLog =
        [
          `DESKRIPSI = ${
            timelineLama.deskripsi ||
            "-"
          }`,

          `TANGGAL MULAI = ${
            formatTanggalIndonesia(
              timelineLama.tanggal_mulai
            )
          }`,

          `TANGGAL AKHIR = ${
            formatTanggalIndonesia(
              timelineLama.tanggal_akhir
            )
          }`,

          `STATUS = ${
            timelineLama.status ||
            "-"
          }`
        ].join(", ");


      // =========================================
      // HAPUS TIMELINE
      // =========================================

      const deleteResult =
        await client.query(
          `
          DELETE FROM
            public.proyek_timeline

          WHERE id = $1

          RETURNING id
          `,
          [timelineId]
        );


      if (
        deleteResult.rows.length === 0
      ) {

        throw new Error(
          "Timeline gagal dihapus"
        );

      }


      // =========================================
      // SIMPAN ACTIVITY LOG
      // entity_id = proyek_id
      // =========================================

      const activityUser =
        getActivityUser(req);


      await simpanActivityLog(
        client,
        {
          ...activityUser,

          aktivitas:
            "DELETE",

          modul:
            "PROYEK",

          /*
           * Entity ID menggunakan
           * proyek_id, bukan timelineId.
           */
          entity_id:
            timelineLama.proyek_id,

          entity_nama:
            timelineLama.nama_proyek,

          field_name:
            "TIMELINE",

          nilai_lama:
            nilaiLamaLog,

          nilai_baru:
            "-",

          deskripsi:
            "menghapus timeline proyek"
        }
      );


      // =========================================
      // COMMIT
      // =========================================

      await client.query(
        "COMMIT"
      );

      transactionAktif =
        false;


      return res.json({
        message:
          "Timeline berhasil dihapus"
      });


    } catch (error) {

      if (transactionAktif) {

        try {

          await client.query(
            "ROLLBACK"
          );

        } catch (
          rollbackError
        ) {

          console.error(
            "ERROR ROLLBACK HAPUS TIMELINE:",
            rollbackError
          );

        }

      }


      console.error(
        "ERROR HAPUS TIMELINE:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });


    } finally {

      client.release();

    }

  }
);


// ======================================================
// TAMBAH TERMIN PARTNER
// Reguler/SLA & Sewa = Persentase
// Transaksi = Nominal
// ======================================================

app.post(
  "/api/proyek/partner/:proyekPartnerId/termin",
  async (req, res) => {
    const client =
      await pool.connect();

    let transactionStarted =
      false;


    // ==================================================
    // PARSE ANGKA INDONESIA
    // ==================================================

    function parseAngka(value) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return 0;
      }

      if (typeof value === "number") {
        return Number.isFinite(value)
          ? value
          : 0;
      }

      let text =
        String(value)
          .trim()
          .replace(/rp/gi, "")
          .replace(/%/g, "")
          .replace(/\s/g, "");

      /*
        Format Indonesia:
        1.000.000  -> 1000000
        25,50      -> 25.50
      */

      if (
        text.includes(".") &&
        text.includes(",")
      ) {
        text =
          text
            .replace(/\./g, "")
            .replace(",", ".");
      } else if (
        text.includes(",")
      ) {
        text =
          text.replace(",", ".");
      } else if (
        /^\d{1,3}(\.\d{3})+$/.test(text)
      ) {
        text =
          text.replace(/\./g, "");
      }

      const number =
        Number(text);

      return Number.isFinite(number)
        ? number
        : 0;
    }


    // ==================================================
    // ERROR VALIDASI
    // ==================================================

    function validationError(message) {
      const error =
        new Error(message);

      error.statusCode =
        400;

      return error;
    }


    try {
      const proyekPartnerId =
        Number(
          req.params.proyekPartnerId
        );

      const {
        nama_termin,
        persentase,
        nominal,
        input_terakhir,
        status_pembayaran,
        tanggal_jatuh_tempo,
        tanggal_bayar
      } = req.body;


      // ==================================================
      // VALIDASI PARAMETER DASAR
      // ==================================================

      if (
        !Number.isInteger(proyekPartnerId) ||
        proyekPartnerId <= 0
      ) {
        throw validationError(
          "ID partner proyek tidak valid."
        );
      }

      if (
        !nama_termin ||
        !String(nama_termin).trim()
      ) {
        throw validationError(
          "Nama termin wajib diisi."
        );
      }


      const nilaiPersentase =
        parseAngka(persentase);

      const nilaiNominal =
        parseAngka(nominal);

      const modeInput =
        String(input_terakhir || "")
          .trim()
          .toLowerCase();


      console.log(
        "PAYLOAD TERMIN PARTNER:",
        {
          proyekPartnerId,
          nama_termin,

          jenis_input:
            modeInput,

          persentase_asli:
            persentase,

          persentase_parse:
            nilaiPersentase,

          nominal_asli:
            nominal,

          nominal_parse:
            nilaiNominal,

          status_pembayaran,
          tanggal_jatuh_tempo,
          tanggal_bayar
        }
      );


      await client.query("BEGIN");

      transactionStarted =
        true;


      // ==================================================
      // AMBIL DATA PARTNER PROYEK
      // ==================================================

      const partnerResult =
        await client.query(
          `
          SELECT
  pp.id,
  pp.proyek_id,
  p.nama_proyek,
  p.jenis_proyek,

  COALESCE(
    NULLIF(
      pp.nilai_nego_3,
      0
    ),
    NULLIF(
      pp.nilai_nego_2,
      0
    ),
    NULLIF(
      pp.nilai_nego_1,
      0
    ),
    NULLIF(
      pp.nilai_submit,
      0
    ),
    0
  )::numeric
    AS nilai_dasar_partner

          FROM public.proyek_partner pp

          INNER JOIN public.proyek p
            ON p.id =
              pp.proyek_id

          WHERE
            pp.id = $1

          FOR UPDATE
          `,
          [
            proyekPartnerId
          ]
        );


      if (
        partnerResult.rows.length === 0
      ) {
        throw validationError(
          "Partner proyek tidak ditemukan."
        );
      }


      const partnerData =
        partnerResult.rows[0];

      const jenisProyek =
        String(
          partnerData.jenis_proyek ||
          ""
        )
          .trim()
          .toLowerCase();

      const isTransaksi =
        jenisProyek ===
        "transaksi";

      const nilaiDasarPartner =
        parseAngka(
          partnerData.nilai_dasar_partner
        );


      // ==================================================
      // TOTAL TERMIN SEBELUM INSERT
      // ==================================================

      const totalTerminResult =
        await client.query(
          `
          SELECT
            COALESCE(
              SUM(
                COALESCE(
                  nominal,
                  0
                )
              ),
              0
            )::numeric
              AS total_nominal,

            COALESCE(
              SUM(
                COALESCE(
                  persentase,
                  0
                )
              ),
              0
            )::numeric
              AS total_persentase

          FROM public.proyek_partner_termin

          WHERE
            proyek_partner_id = $1
          `,
          [
            proyekPartnerId
          ]
        );


      const totalNominalSebelumnya =
        parseAngka(
          totalTerminResult
            .rows[0]
            .total_nominal
        );

      const totalPersentaseSebelumnya =
        parseAngka(
          totalTerminResult
            .rows[0]
            .total_persentase
        );


      let persentaseFinal =
        nilaiPersentase;

      let nominalFinal =
        nilaiNominal;

      let sumberNilaiFinal =
        nilaiDasarPartner > 0
          ? "nilai_partner"
          : "total_nominal_termin";


      // ==================================================
      // PROYEK TRANSAKSI
      // Wajib memakai nominal
      // ==================================================

      if (isTransaksi) {
        if (
          !Number.isFinite(nilaiNominal) ||
          nilaiNominal <= 0
        ) {
          throw validationError(
            "Nominal termin harus lebih dari 0 untuk proyek Transaksi."
          );
        }

        nominalFinal =
          nilaiNominal;

        /*
          Persentase transaksi tidak digunakan.
          Jika constraint database mengharuskan salah satu
          nilai terisi, nominal sudah memenuhi.
        */

        persentaseFinal =
          null;
      }


      // ==================================================
      // PROYEK REGULER / SLA / SEWA
      // Bisa input nominal atau persentase
      // ==================================================

      if (!isTransaksi) {
       
      const menggunakanNominal =
        nilaiDasarPartner <= 0 ||
        modeInput === "nominal" ||
        (
          nilaiNominal > 0 &&
          nilaiPersentase <= 0
        );

        const menggunakanPersentase =
          modeInput === "persentase" ||
          (
            nilaiPersentase > 0 &&
            nilaiNominal <= 0
          );


        // ================================================
        // INPUT NOMINAL
        // ================================================

        if (menggunakanNominal) {
          if (
            !Number.isFinite(nilaiNominal) ||
            nilaiNominal <= 0
          ) {
            throw validationError(
              "Nominal termin harus lebih dari 0."
            );
          }

          nominalFinal =
            nilaiNominal;


          /*
            Jika nilai partner sudah ada:
            persentase = nominal / nilai partner × 100
          */

          if (nilaiDasarPartner > 0) {
            persentaseFinal =
              (
                nominalFinal /
                nilaiDasarPartner
              ) * 100;
          } else {
            /*
              Jika nilai final partner masih kosong:
              nilai final = total nominal termin setelah
              termin baru ditambahkan.
            */

            const nilaiFinalSementara =
              totalNominalSebelumnya +
              nominalFinal;

            if (nilaiFinalSementara <= 0) {
              throw validationError(
                "Total nominal termin partner harus lebih dari 0."
              );
            }

            persentaseFinal =
              (
                nominalFinal /
                nilaiFinalSementara
              ) * 100;

            sumberNilaiFinal =
              "total_nominal_termin";
          }
        }


        // ================================================
        // INPUT PERSENTASE
        // ================================================

        else if (menggunakanPersentase) {
          if (
            !Number.isFinite(nilaiPersentase) ||
            nilaiPersentase <= 0
          ) {
            throw validationError(
              "Persentase termin harus lebih dari 0."
            );
          }

          if (nilaiPersentase > 100) {
            throw validationError(
              "Persentase termin tidak boleh lebih dari 100%."
            );
          }

          if (nilaiDasarPartner <= 0) {
            throw validationError(
              "Nilai partner masih kosong. Isi nominal termin terlebih dahulu agar nilai final partner dapat dihitung dari total nominal termin."
            );
          }

          persentaseFinal =
            nilaiPersentase;

          nominalFinal =
            (
              nilaiDasarPartner *
              persentaseFinal
            ) / 100;

          sumberNilaiFinal =
            "nilai_partner";
        }


        // ================================================
        // KEDUA INPUT KOSONG
        // ================================================

        else {
          throw validationError(
            "Nominal atau persentase termin harus lebih dari 0."
          );
        }


        // ================================================
        // VALIDASI HASIL PERHITUNGAN
        // ================================================

        if (
          !Number.isFinite(nominalFinal) ||
          nominalFinal <= 0
        ) {
          throw validationError(
            "Nominal termin hasil perhitungan tidak valid."
          );
        }

        if (
          !Number.isFinite(persentaseFinal) ||
          persentaseFinal <= 0
        ) {
          throw validationError(
            "Persentase termin hasil perhitungan tidak valid."
          );
        }


        /*
          Total persentase hanya diperiksa langsung jika
          nilai final berasal dari nilai submit/nego.

          Jika nilai final berasal dari total nominal termin,
          seluruh persentase akan dihitung ulang setelah insert.
        */

        if (nilaiDasarPartner > 0) {
          const totalSetelahDitambah =
            totalPersentaseSebelumnya +
            persentaseFinal;

          if (
            totalSetelahDitambah >
            100.000001
          ) {
            throw validationError(
              `Total persentase termin tidak boleh lebih dari 100%. Persentase saat ini ${totalPersentaseSebelumnya.toFixed(2)}%, ditambah ${persentaseFinal.toFixed(2)}% menjadi ${totalSetelahDitambah.toFixed(2)}%.`
            );
          }
        }
      }


      // ==================================================
      // INSERT TERMIN PARTNER
      // ==================================================

      const insertResult =
        await client.query(
          `
          INSERT INTO
            public.proyek_partner_termin
          (
            proyek_partner_id,
            nama_termin,
            persentase,
            nominal,
            status_pembayaran,
            tanggal_jatuh_tempo,
            tanggal_bayar,
            created_at,
            updated_at
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          RETURNING
            id
          `,
          [
            proyekPartnerId,

            String(
              nama_termin
            ).trim(),

            isTransaksi
              ? null
              : persentaseFinal,

            nominalFinal,

            status_pembayaran
              ? String(
                  status_pembayaran
                ).trim()
              : null,

            tanggal_jatuh_tempo ||
              null,

            tanggal_bayar ||
              null
          ]
        );


      const terminId =
        Number(
          insertResult.rows[0].id
        );


      // ==================================================
      // HITUNG NILAI FINAL PARTNER
      // ==================================================

      const nilaiFinalResult =
        await client.query(
          `
          SELECT
            COALESCE(
              NULLIF(
                pp.nilai_nego_3,
                0
              ),
              NULLIF(
                pp.nilai_nego_2,
                0
              ),
              NULLIF(
                pp.nilai_nego_1,
                0
              ),
              NULLIF(
                pp.nilai_submit,
                0
              ),
              (
                SELECT
                  COALESCE(
                    SUM(
                      COALESCE(
                        ppt.nominal,
                        0
                      )
                    ),
                    0
                  )

                FROM
                  public.proyek_partner_termin ppt

                WHERE
                  ppt.proyek_partner_id =
                    pp.id
              ),
              0
            )::numeric
              AS nilai_final_partner,

            COALESCE(
              (
                SELECT
                  SUM(
                    COALESCE(
                      ppt.nominal,
                      0
                    )
                  )

                FROM
                  public.proyek_partner_termin ppt

                WHERE
                  ppt.proyek_partner_id =
                    pp.id
              ),
              0
            )::numeric
              AS total_nominal_termin

          FROM public.proyek_partner pp

          WHERE
            pp.id = $1
          `,
          [
            proyekPartnerId
          ]
        );


      const nilaiFinalPartner =
        parseAngka(
          nilaiFinalResult
            .rows[0]
            .nilai_final_partner
        );

      const totalNominalTermin =
        parseAngka(
          nilaiFinalResult
            .rows[0]
            .total_nominal_termin
        );


      // ==================================================
      // HITUNG ULANG PERSENTASE
      // Dilakukan saat nilai submit/nego masih kosong.
      // Nilai final partner = total nominal seluruh termin.
      // ==================================================
// Jika submit dan seluruh nego kosong/nol,
// hitung ulang persentase SEMUA termin partner.

if (
  nilaiDasarPartner <= 0 &&
  totalNominalTermin > 0
) {
  await client.query(
    `
    UPDATE public.proyek_partner_termin

    SET
      persentase = ROUND(
        COALESCE(nominal, 0)::numeric
        / $2::numeric
        * 100,
        6
      ),

      updated_at = CURRENT_TIMESTAMP

    WHERE proyek_partner_id = $1
    `,
    [
      proyekPartnerId,
      totalNominalTermin
    ]
  );
}


      // ==================================================
      // AMBIL DATA TERMIN TERBARU
      // ==================================================

      const terminResult =
        await client.query(
          `
          SELECT
            id,
            proyek_partner_id,
            nama_termin,
            persentase,
            nominal,
            status_pembayaran,
            tanggal_jatuh_tempo,
            tanggal_bayar,
            created_at,
            updated_at

          FROM
            public.proyek_partner_termin

          WHERE
            id = $1
          `,
          [
            terminId
          ]
        );

// ==================================================
// ACTIVITY LOG TERMIN PARTNER
// CREATE HANYA NILAI BARU
// ==================================================

const dataTerminBaru =
  terminResult.rows[0];


const formatTeksTerminPartnerLog =
  value => {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return "-";
    }

    return String(value).trim();
  };


const formatRupiahTerminPartnerLog =
  value => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    const angka =
      Number(value);

    if (!Number.isFinite(angka)) {
      return String(value);
    }

    return `Rp ${new Intl.NumberFormat(
      "id-ID",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    ).format(angka)}`;
  };


const formatPersentaseTerminPartnerLog =
  value => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    const angka =
      Number(value);

    if (!Number.isFinite(angka)) {
      return String(value);
    }

    return `${
      new Intl.NumberFormat(
        "id-ID",
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2
        }
      ).format(angka)
    }%`;
  };


const formatTanggalTerminPartnerLog =
  value => {
    if (!value) {
      return "-";
    }

    const daftarBulan = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember"
    ];

    let tahun;
    let bulan;
    let tanggal;

    if (value instanceof Date) {
      tahun =
        value.getUTCFullYear();

      bulan =
        value.getUTCMonth() + 1;

      tanggal =
        value.getUTCDate();
    } else {
      const cocok =
        String(value).match(
          /^(\d{4})-(\d{2})-(\d{2})/
        );

      if (!cocok) {
        return String(value);
      }

      tahun =
        Number(cocok[1]);

      bulan =
        Number(cocok[2]);

      tanggal =
        Number(cocok[3]);
    }

    return `${tanggal} ${
      daftarBulan[bulan - 1]
    } ${tahun}`;
  };


const nilaiBaruLog = [
  `NAMA TERMIN = ${
    formatTeksTerminPartnerLog(
      dataTerminBaru.nama_termin
    )
  }`,

  `PERSENTASE = ${
    formatPersentaseTerminPartnerLog(
      dataTerminBaru.persentase
    )
  }`,

  `NOMINAL = ${
    formatRupiahTerminPartnerLog(
      dataTerminBaru.nominal
    )
  }`,

  `STATUS PEMBAYARAN = ${
    formatTeksTerminPartnerLog(
      dataTerminBaru
        .status_pembayaran
    )
  }`,

  `TANGGAL JATUH TEMPO = ${
    formatTanggalTerminPartnerLog(
      dataTerminBaru
        .tanggal_jatuh_tempo
    )
  }`,

  `TANGGAL BAYAR = ${
    formatTanggalTerminPartnerLog(
      dataTerminBaru
        .tanggal_bayar
    )
  }`
].join(", ");


await simpanActivityLog(
  client,
  {
    ...getActivityUser(req),

    aktivitas: "CREATE",
    modul: "PROYEK",

    // Entity menggunakan proyek ID
    entity_id:
      Number(
        partnerData.proyek_id
      ),

    entity_nama:
      partnerData.nama_proyek,

    field_name:
      "TERMIN PARTNER",

    // CREATE hanya nilai baru
    nilai_lama: null,

    nilai_baru:
      nilaiBaruLog,

    deskripsi:
      "menambahkan termin partner"
  }
);
      await client.query("COMMIT");

      transactionStarted =
        false;


      return res
        .status(201)
        .json({
          message:
            "Termin partner berhasil ditambahkan.",

          data:
            terminResult.rows[0],

          nilai_final_partner:
            nilaiFinalPartner,

          total_nominal_termin:
            totalNominalTermin,

          sumber_nilai_final:
            sumberNilaiFinal
        });

    } catch (error) {
      if (transactionStarted) {
        await client.query(
          "ROLLBACK"
        );
      }

      console.error(
        "ERROR TAMBAH TERMIN PARTNER:",
        error
      );

      return res
        .status(
          error.statusCode ||
          500
        )
        .json({
          error:
            error.message
        });

    } finally {
      client.release();
    }
  }
);

// UPDATE TERMIN PARTNER

app.put(
  "/api/proyek/partner/termin/:id",
  async (req, res) => {

    const client =
      await pool.connect();


    try {

      const terminId =
        Number(
          req.params.id
        );


      const {
        nama_termin,
        persentase,
        nominal,
        input_terakhir,
        status_pembayaran,
        tanggal_jatuh_tempo,
        tanggal_bayar,
        syarat_pembayaran
      } = req.body;


      // ==================================================
      // VALIDASI DASAR
      // ==================================================

      if (
        !Number.isInteger(
          terminId
        ) ||
        terminId <= 0
      ) {

        return res.status(400).json({
          error:
            "ID termin partner tidak valid"
        });

      }


      if (
        !nama_termin ||
        !String(
          nama_termin
        ).trim()
      ) {

        return res.status(400).json({
          error:
            "Nama termin wajib diisi"
        });

      }


      await client.query(
        "BEGIN"
      );
      // Kunci partner induk agar tambah/edit pada
      // partner yang sama dihitung secara bergantian.

        await client.query(
          `
          SELECT pp.id

          FROM public.proyek_partner pp

          WHERE pp.id = (
            SELECT ppt.proyek_partner_id
            FROM public.proyek_partner_termin ppt
            WHERE ppt.id = $1
          )

          FOR UPDATE OF pp
          `,
          [terminId]
        );


      // ==================================================
      // CARI TERMIN DAN JENIS PROYEK
      // ==================================================

      const terminResult =
        await client.query(
          `
          SELECT
            ppt.id,
            ppt.proyek_partner_id,
            ppt.nama_termin,
            ppt.persentase,
            ppt.nominal,
            ppt.status_pembayaran,
            ppt.tanggal_jatuh_tempo,
            ppt.tanggal_bayar,
            ppt.syarat_pembayaran,

            pp.proyek_id,

            p.nama_proyek,
            p.jenis_proyek,

            COALESCE(
              NULLIF(
                pp.nilai_nego_3,
                0
              ),
              NULLIF(
                pp.nilai_nego_2,
                0
              ),
              NULLIF(
                pp.nilai_nego_1,
                0
              ),
              NULLIF(
                pp.nilai_submit,
                0
              ),
              0
            )::NUMERIC
              AS nilai_final_partner

          FROM public.proyek_partner_termin ppt

          JOIN public.proyek_partner pp
            ON pp.id =
              ppt.proyek_partner_id

          JOIN public.proyek p
            ON p.id =
              pp.proyek_id

          WHERE
            ppt.id = $1

          LIMIT 1

          FOR UPDATE OF ppt
          `,
          [
            terminId
          ]
        );


      if (
        terminResult.rows.length === 0
      ) {

        await client.query(
          "ROLLBACK"
        );


        return res.status(404).json({
          error:
            "Termin partner tidak ditemukan"
        });

      }


      const terminData =
        terminResult.rows[0];


      // ==================================================
      // JENIS PROYEK DAN NILAI DASAR PARTNER
      // ==================================================

      const jenisProyek =
        String(
          terminData.jenis_proyek ||
          ""
        )
          .trim()
          .toLowerCase();


      const isTransaksi =
        jenisProyek ===
        "transaksi";


      /*
       * Nilai dasar berasal dari:
       *
       * nego 3 → nego 2 → nego 1 → submit.
       *
       * Jika semuanya kosong, nilai final akan
       * menggunakan total nominal seluruh termin.
       */

      const nilaiDasarPartner =
        Number(
          terminData
            .nilai_final_partner ||
          0
        );


      // ==================================================
      // NORMALISASI INPUT TERAKHIR
      // ==================================================

      let modeInput =
        String(
          input_terakhir || ""
        )
          .trim()
          .toLowerCase();


      if (
        modeInput !== "nominal" &&
        modeInput !== "persentase"
      ) {

        modeInput =
          "nominal";

      }


      /*
       * Jika submit/nego partner kosong,
       * nominal menjadi dasar perhitungan.
       *
       * Ini juga berlaku apabila pengguna hanya
       * mengubah status, tanggal, atau syarat.
       */

      if (
        !isTransaksi &&
        nilaiDasarPartner <= 0
      ) {

        modeInput =
          "nominal";

      }


      // ==================================================
      // PARSE PERSENTASE
      // ==================================================

      const persentaseText =
        String(
          persentase ?? ""
        )
          .trim()
          .replace(/%/g, "")
          .replace(/\s/g, "")
          .replace(",", ".");


      const persentaseInput =
        persentaseText === ""
          ? null
          : Number(
              persentaseText
            );


      // ==================================================
      // PARSE NOMINAL
      // ==================================================

      let nominalText =
        String(
          nominal ?? ""
        )
          .trim()
          .replace(/rp/gi, "")
          .replace(/\s/g, "");


      if (
        /^\d{1,3}(\.\d{3})+$/.test(
          nominalText
        )
      ) {

        nominalText =
          nominalText.replace(
            /\./g,
            ""
          );

      } else if (
        nominalText.includes(".") &&
        nominalText.includes(",")
      ) {

        nominalText =
          nominalText
            .replace(/\./g, "")
            .replace(",", ".");

      } else if (
        nominalText.includes(",")
      ) {

        nominalText =
          nominalText.replace(
            ",",
            "."
          );

      }


      const nominalInput =
        nominalText === ""
          ? null
          : Number(
              nominalText
            );


      // ==================================================
      // NILAI YANG AKAN DISIMPAN
      // ==================================================

      let persenValue =
        null;


      let nominalValue =
        null;


      // ==================================================
      // PROYEK TRANSAKSI
      // ==================================================

      if (isTransaksi) {

        if (
          nominalInput === null ||
          !Number.isFinite(
            nominalInput
          ) ||
          nominalInput <= 0
        ) {

          await client.query(
            "ROLLBACK"
          );


          return res.status(400).json({
            error:
              "Nominal termin harus lebih dari Rp 0"
          });

        }


        nominalValue =
          Math.round(
            nominalInput
          );


        persenValue =
          null;

      }


      // ==================================================
      // NOMINAL TERAKHIR DIEDIT
      // ==================================================

      else if (
        modeInput === "nominal"
      ) {

        if (
          nominalInput === null ||
          !Number.isFinite(
            nominalInput
          ) ||
          nominalInput <= 0
        ) {

          await client.query(
            "ROLLBACK"
          );


          return res.status(400).json({
            error:
              "Nominal termin harus lebih dari Rp 0"
          });

        }


        nominalValue =
          Math.round(
            nominalInput
          );


        /*
         * Jika submit/nego tersedia,
         * persentase langsung dihitung berdasarkan
         * nilai submit/nego tersebut.
         */

        if (
          nilaiDasarPartner > 0
        ) {

          persenValue =
            Number(
              (
                nominalValue /
                nilaiDasarPartner *
                100
              ).toFixed(6)
            );


          if (
            persenValue <= 0 ||
            persenValue > 100
          ) {

            await client.query(
              "ROLLBACK"
            );


            return res.status(400).json({
              error:
                "Nominal termin tidak boleh melebihi nilai final partner"
            });

          }

        } else {

          /*
           * Jangan menggunakan persentase lama.
           *
           * Setelah nominal disimpan, seluruh
           * persentase akan dihitung ulang.
           */

          persenValue =
            null;

        }

      }


      // ==================================================
      // PERSENTASE TERAKHIR DIEDIT
      // ==================================================

      else {

        if (
          persentaseInput === null ||
          !Number.isFinite(
            persentaseInput
          ) ||
          persentaseInput <= 0 ||
          persentaseInput > 100
        ) {

          await client.query(
            "ROLLBACK"
          );


          return res.status(400).json({
            error:
              "Persentase harus lebih dari 0 dan maksimal 100%"
          });

        }


        /*
         * Jika nilai submit/nego kosong,
         * nominal wajib menjadi dasar perhitungan.
         */

        if (
          nilaiDasarPartner <= 0
        ) {

          await client.query(
            "ROLLBACK"
          );


          return res.status(400).json({
            error:
              "Nilai final partner belum tersedia. Ubah nominal termin agar persentase dihitung ulang otomatis."
          });

        }


        persenValue =
          Number(
            persentaseInput
              .toFixed(6)
          );


        nominalValue =
          Math.round(
            nilaiDasarPartner *
            persenValue /
            100
          );

      }


      // ==================================================
      // VALIDASI TOTAL PERSENTASE
      //
      // Hanya dilakukan jika nilai submit/nego tersedia.
      // Jika submit/nego kosong, seluruh persentase akan
      // dihitung ulang setelah nominal diperbarui.
      // ==================================================

      if (
        !isTransaksi &&
        nilaiDasarPartner > 0 &&
        persenValue !== null
      ) {

        const totalResult =
          await client.query(
            `
            SELECT
              COALESCE(
                SUM(
                  COALESCE(
                    persentase,
                    0
                  )
                ),
                0
              )::NUMERIC
                AS total

            FROM public.proyek_partner_termin

            WHERE
              proyek_partner_id = $1
              AND id <> $2
            `,
            [
              terminData
                .proyek_partner_id,

              terminId
            ]
          );


        const totalLain =
          Number(
            totalResult
              .rows[0]
              .total || 0
          );


        const totalSetelahUpdate =
          totalLain +
          persenValue;


        if (
          totalSetelahUpdate >
          100.000001
        ) {

          await client.query(
            "ROLLBACK"
          );


          return res.status(400).json({

            error:
              `Total persentase termin tidak boleh lebih dari 100%. ` +
              `Total termin lain ${totalLain.toFixed(2)}%, ` +
              `termin ini ${persenValue.toFixed(2)}%.`

          });

        }

      }


      // ==================================================
      // UPDATE TERMIN PARTNER
      // ==================================================

      let result =
        await client.query(
          `
          UPDATE public.proyek_partner_termin

          SET
            nama_termin = $1,
            persentase = $2,
            nominal = $3,
            status_pembayaran = $4,
            tanggal_jatuh_tempo = $5,
            tanggal_bayar = $6,
            syarat_pembayaran = $7,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id = $8

          RETURNING
            id,
            proyek_partner_id,
            nama_termin,
            persentase,
            nominal,
            status_pembayaran,
            tanggal_jatuh_tempo,
            tanggal_bayar,
            syarat_pembayaran,
            created_at,
            updated_at
          `,
          [
            String(
              nama_termin
            ).trim(),

            persenValue,

            nominalValue,

            status_pembayaran ||
              "Belum Dibayar",

            tanggal_jatuh_tempo ||
              null,

            tanggal_bayar ||
              null,

            syarat_pembayaran
              ?.trim() ||
              null,

            terminId
          ]
        );


      // Total dihitung setelah nominal termin diperbarui.

const totalNominalResult = await client.query(
  `
  SELECT
    COALESCE(
      SUM(COALESCE(nominal, 0)),
      0
    )::numeric AS total_nominal

  FROM public.proyek_partner_termin

  WHERE proyek_partner_id = $1
  `,
  [terminData.proyek_partner_id]
);

const totalNominalTerbaru = Number(
  totalNominalResult.rows[0].total_nominal || 0
);

const nilaiFinalPartner =
  nilaiDasarPartner > 0
    ? nilaiDasarPartner
    : totalNominalTerbaru;

// Hitung ulang semua persentase hanya ketika
// nilai submit dan seluruh nego kosong/nol.

if (nilaiDasarPartner <= 0) {
  if (totalNominalTerbaru <= 0) {
    await client.query("ROLLBACK");

    return res.status(400).json({
      error:
        "Total nominal termin partner harus lebih dari Rp 0"
    });
  }

  await client.query(
    `
    UPDATE public.proyek_partner_termin

    SET
      persentase = ROUND(
        COALESCE(nominal, 0)::numeric
        / $2::numeric
        * 100,
        6
      ),

      updated_at = CURRENT_TIMESTAMP

    WHERE proyek_partner_id = $1
    `,
    [
      terminData.proyek_partner_id,
      totalNominalTerbaru
    ]
  );

  // Ambil ulang termin yang diedit agar respons
  // dan activity log memakai persentase terbaru.

  result = await client.query(
    `
    SELECT
      id,
      proyek_partner_id,
      nama_termin,
      persentase,
      nominal,
      status_pembayaran,
      tanggal_jatuh_tempo,
      tanggal_bayar,
      syarat_pembayaran,
      created_at,
      updated_at

    FROM public.proyek_partner_termin

    WHERE id = $1
    `,
    [terminId]
  );
}


      // ==================================================
      // ACTIVITY LOG TERMIN PARTNER
      // ==================================================

      const dataTerminBaru =
        result.rows[0];


      const formatTeksTerminPartnerLog =
        value => {

          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {

            return "-";

          }


          return String(
            value
          ).trim();

        };


      const formatRupiahTerminPartnerLog =
        value => {

          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {

            return "-";

          }


          const angka =
            Number(value);


          if (
            !Number.isFinite(
              angka
            )
          ) {

            return String(value);

          }


          return `Rp ${new Intl.NumberFormat(
            "id-ID",
            {
              minimumFractionDigits:
                0,

              maximumFractionDigits:
                2
            }
          ).format(angka)}`;

        };


      const formatPersentaseTerminPartnerLog =
        value => {

          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {

            return "-";

          }


          const angka =
            Number(value);


          if (
            !Number.isFinite(
              angka
            )
          ) {

            return String(value);

          }


          return `${
            new Intl.NumberFormat(
              "id-ID",
              {
                minimumFractionDigits:
                  0,

                maximumFractionDigits:
                  2
              }
            ).format(angka)
          }%`;

        };


      const formatTanggalTerminPartnerLog =
        value => {

          if (!value) {

            return "-";

          }


          const daftarBulan = [
            "Januari",
            "Februari",
            "Maret",
            "April",
            "Mei",
            "Juni",
            "Juli",
            "Agustus",
            "September",
            "Oktober",
            "November",
            "Desember"
          ];


          let tahun;
          let bulan;
          let tanggal;


          if (
            value instanceof Date
          ) {

            tahun =
              value.getUTCFullYear();

            bulan =
              value.getUTCMonth() + 1;

            tanggal =
              value.getUTCDate();

          } else {

            const cocok =
              String(value).match(
                /^(\d{4})-(\d{2})-(\d{2})/
              );


            if (!cocok) {

              return String(value);

            }


            tahun =
              Number(cocok[1]);

            bulan =
              Number(cocok[2]);

            tanggal =
              Number(cocok[3]);

          }


          return `${tanggal} ${
            daftarBulan[bulan - 1]
          } ${tahun}`;

        };


      const buatDetailTerminPartnerLog =
        data => [

          {
            label:
              "NAMA TERMIN",

            nilai:
              formatTeksTerminPartnerLog(
                data.nama_termin
              )
          },

          {
            label:
              "PERSENTASE",

            nilai:
              formatPersentaseTerminPartnerLog(
                data.persentase
              )
          },

          {
            label:
              "NOMINAL",

            nilai:
              formatRupiahTerminPartnerLog(
                data.nominal
              )
          },

          {
            label:
              "STATUS PEMBAYARAN",

            nilai:
              formatTeksTerminPartnerLog(
                data.status_pembayaran
              )
          },

          {
            label:
              "TANGGAL JATUH TEMPO",

            nilai:
              formatTanggalTerminPartnerLog(
                data.tanggal_jatuh_tempo
              )
          },

          {
            label:
              "TANGGAL BAYAR",

            nilai:
              formatTanggalTerminPartnerLog(
                data.tanggal_bayar
              )
          },

          {
            label:
              "SYARAT PEMBAYARAN",

            nilai:
              formatTeksTerminPartnerLog(
                data.syarat_pembayaran
              )
          }

        ];


      const detailTerminLama =
        buatDetailTerminPartnerLog(
          terminData
        );


      const detailTerminBaru =
        buatDetailTerminPartnerLog(
          dataTerminBaru
        );


      /*
       * Hanya ambil field yang berubah.
       */

      const perubahanTermin =
        detailTerminBaru
          .map(
            (
              itemBaru,
              index
            ) => ({

              label:
                itemBaru.label,

              nilai_lama:
                detailTerminLama[index]
                  .nilai,

              nilai_baru:
                itemBaru.nilai

            })
          )
          .filter(
            item =>
              item.nilai_lama !==
              item.nilai_baru
          );


      if (
        perubahanTermin.length > 0
      ) {

        await simpanActivityLog(
          client,
          {

            ...getActivityUser(req),

            aktivitas:
              "UPDATE",

            modul:
              "PROYEK",

            // Entity menggunakan proyek ID
            entity_id:
              Number(
                terminData.proyek_id
              ),

            entity_nama:
              terminData.nama_proyek,

            field_name:
              "TERMIN PARTNER",

            nilai_lama:
              perubahanTermin
                .map(
                  item =>
                    `${item.label} = ${item.nilai_lama}`
                )
                .join(", "),

            nilai_baru:
              perubahanTermin
                .map(
                  item =>
                    `${item.label} = ${item.nilai_baru}`
                )
                .join(", "),

            deskripsi:
              "memperbarui termin partner"

          }
        );

      }


      await client.query(
        "COMMIT"
      );



    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


      console.error(
        "ERROR UPDATE TERMIN PARTNER:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });


    } finally {

      client.release();

    }

  }
);

// HAPUS TERMIN PARTNER

app.delete(
  "/api/proyek/partner/termin/:id",
  async (req, res) => {
    const client =
      await pool.connect();

    let transaksiDimulai =
      false;

    try {
      const terminId =
        Number(req.params.id);


      // ================================================
      // VALIDASI ID
      // ================================================

      if (
        !Number.isInteger(terminId) ||
        terminId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID termin partner tidak valid"
        });
      }


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      await client.query("BEGIN");

      transaksiDimulai = true;


      // ================================================
      // AMBIL NILAI LAMA DAN INFORMASI PROYEK
      // ================================================

      const oldResult =
        await client.query(
          `
            SELECT
              ppt.id,
              ppt.proyek_partner_id,
              ppt.nama_termin,
              ppt.persentase,
              ppt.nominal,
              ppt.status_pembayaran,
              ppt.tanggal_jatuh_tempo,
              ppt.tanggal_bayar,
              ppt.syarat_pembayaran,

              pp.proyek_id,
              p.nama_proyek

            FROM public.proyek_partner_termin ppt

            JOIN public.proyek_partner pp
              ON pp.id =
                ppt.proyek_partner_id

            JOIN public.proyek p
              ON p.id =
                pp.proyek_id

            WHERE ppt.id = $1

            FOR UPDATE OF ppt
          `,
          [terminId]
        );


      if (
        oldResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Termin partner tidak ditemukan"
        });
      }


      const terminLama =
        oldResult.rows[0];

      const proyekId =
        Number(
          terminLama.proyek_id
        );

      const namaProyek =
        terminLama.nama_proyek;


      // ================================================
      // HAPUS TERMIN PARTNER
      // ================================================

      const result =
        await client.query(
          `
            DELETE FROM
              public.proyek_partner_termin

            WHERE id = $1

            RETURNING *
          `,
          [terminId]
        );


      if (
        result.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai = false;

        return res.status(404).json({
          error:
            "Termin partner tidak ditemukan"
        });
      }


      // ================================================
      // FORMAT NILAI LOG
      // ================================================

      const formatTeksTerminLog =
        value => {
          if (
            value === null ||
            value === undefined ||
            String(value).trim() === ""
          ) {
            return "-";
          }

          return String(value).trim();
        };


      const formatRupiahTerminLog =
        value => {
          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {
            return "-";
          }

          const angka =
            Number(value);

          if (!Number.isFinite(angka)) {
            return String(value);
          }

          return `Rp ${new Intl.NumberFormat(
            "id-ID",
            {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2
            }
          ).format(angka)}`;
        };


      const formatPersentaseTerminLog =
        value => {
          if (
            value === null ||
            value === undefined ||
            value === ""
          ) {
            return "-";
          }

          const angka =
            Number(value);

          if (!Number.isFinite(angka)) {
            return String(value);
          }

          return `${
            new Intl.NumberFormat(
              "id-ID",
              {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
              }
            ).format(angka)
          }%`;
        };


      const formatTanggalTerminLog =
        value => {
          if (!value) {
            return "-";
          }

          const daftarBulan = [
            "Januari",
            "Februari",
            "Maret",
            "April",
            "Mei",
            "Juni",
            "Juli",
            "Agustus",
            "September",
            "Oktober",
            "November",
            "Desember"
          ];

          let tahun;
          let bulan;
          let tanggal;

          if (value instanceof Date) {
            tahun =
              value.getUTCFullYear();

            bulan =
              value.getUTCMonth() + 1;

            tanggal =
              value.getUTCDate();
          } else {
            const cocok =
              String(value).match(
                /^(\d{4})-(\d{2})-(\d{2})/
              );

            if (!cocok) {
              return String(value);
            }

            tahun =
              Number(cocok[1]);

            bulan =
              Number(cocok[2]);

            tanggal =
              Number(cocok[3]);
          }

          return `${tanggal} ${
            daftarBulan[bulan - 1]
          } ${tahun}`;
        };


      // ================================================
      // SUSUN NILAI LAMA
      // ================================================

      const nilaiLamaLog = [
        `NAMA TERMIN = ${
          formatTeksTerminLog(
            terminLama.nama_termin
          )
        }`,

        `PERSENTASE = ${
          formatPersentaseTerminLog(
            terminLama.persentase
          )
        }`,

        `NOMINAL = ${
          formatRupiahTerminLog(
            terminLama.nominal
          )
        }`,

        `STATUS PEMBAYARAN = ${
          formatTeksTerminLog(
            terminLama
              .status_pembayaran
          )
        }`,

        `TANGGAL JATUH TEMPO = ${
          formatTanggalTerminLog(
            terminLama
              .tanggal_jatuh_tempo
          )
        }`,

        `TANGGAL BAYAR = ${
          formatTanggalTerminLog(
            terminLama
              .tanggal_bayar
          )
        }`,

        `SYARAT PEMBAYARAN = ${
          formatTeksTerminLog(
            terminLama
              .syarat_pembayaran
          )
        }`
      ].join(", ");


      // ================================================
      // SIMPAN ACTIVITY LOG
      // DELETE HANYA NILAI LAMA
      // ================================================

      await simpanActivityLog(
        client,
        {
          ...getActivityUser(req),

          aktivitas: "DELETE",
          modul: "PROYEK",

          // Entity menggunakan proyek ID
          entity_id: proyekId,
          entity_nama: namaProyek,

          field_name:
            "TERMIN PARTNER",

          nilai_lama:
            nilaiLamaLog,

          nilai_baru: null,

          deskripsi:
            "menghapus termin partner"
        }
      );


      // ================================================
      // COMMIT
      // ================================================

      await client.query("COMMIT");

      transaksiDimulai = false;


      return res.json({
        message:
          "Termin partner berhasil dihapus"
      });

    } catch (error) {
      if (transaksiDimulai) {
        try {
          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {
          console.error(
            "ERROR ROLLBACK HAPUS TERMIN PARTNER:",
            rollbackError
          );
        }
      }


      console.error(
        "ERROR HAPUS TERMIN PARTNER:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);



// ======================================================
// UPDATE INFORMASI PROYEK
// ======================================================

app.put("/api/proyek/:id",
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      const { id } =
        req.params;

      const {
        kategori_produk_ids,
        nama_proyek,
        jenis_proyek,
        sub_jenis_proyek,
        status_final,
        deskripsi
      } = req.body;


      // =========================================
      // VALIDASI KATEGORI
      // =========================================

      if (
        !Array.isArray(
          kategori_produk_ids
        ) ||
        kategori_produk_ids.length === 0
      ) {

        return res.status(400).json({
          error:
            "Minimal satu kategori wajib dipilih"
        });

      }


      const kategoriIds =
        kategori_produk_ids
          .map(Number)
          .filter(
            value =>
              Number.isInteger(value) &&
              value > 0
          );


      if (kategoriIds.length === 0) {

        return res.status(400).json({
          error:
            "Kategori tidak valid"
        });

      }


      if (
        !nama_proyek ||
        !nama_proyek.trim()
      ) {

        return res.status(400).json({
          error:
            "Nama proyek wajib diisi"
        });

      }


      // Kategori pertama tetap disimpan
      // di tabel proyek untuk kompatibilitas lama
      const kategoriUtamaId =
        kategoriIds[0];


     await client.query(
  "BEGIN"
);


// =========================================
// AMBIL DATA SEBELUM PERUBAHAN
// =========================================

const oldResult =
  await client.query(
    `
    SELECT
      p.id,
      p.nama_proyek,
      p.jenis_proyek,
      p.sub_jenis_proyek,
      p.status_final,
      p.deskripsi,

      COALESCE(
        ARRAY_AGG(
          pk.kategori_produk_id
          ORDER BY pk.kategori_produk_id
        ) FILTER (
          WHERE
            pk.kategori_produk_id
              IS NOT NULL
        ),
        '{}'
      ) AS kategori_produk_ids

    FROM public.proyek p

    LEFT JOIN public.proyek_kategori pk
      ON pk.proyek_id = p.id

    WHERE p.id = $1

    GROUP BY p.id
    `,
    [id]
  );


if (
  oldResult.rows.length === 0
) {

  await client.query(
    "ROLLBACK"
  );

  return res.status(404).json({
    error:
      "Proyek tidak ditemukan"
  });

}


const proyekLama =
  oldResult.rows[0];


// =========================================
// NILAI BARU
// =========================================

const namaProyekBaru =
  nama_proyek.trim();

const jenisProyekBaru =
  jenis_proyek || null;

const subJenisProyekBaru =
  sub_jenis_proyek || null;

const statusFinalBaru =
  status_final || "Aktif";

const deskripsiBaru =
  deskripsi?.trim() || null;


// =========================================
// UPDATE INFORMASI PROYEK
// =========================================

const result =
  await client.query(
    `
    UPDATE public.proyek

    SET
      kategori_produk_id = $1,
      nama_proyek = $2,
      jenis_proyek = $3,
      sub_jenis_proyek = $4,
      status_final = $5,
      deskripsi = $6,
      updated_at =
        CURRENT_TIMESTAMP

    WHERE id = $7

    RETURNING *
    `,
    [
      kategoriUtamaId,
      namaProyekBaru,
      jenisProyekBaru,
      subJenisProyekBaru,
      statusFinalBaru,
      deskripsiBaru,
      id
    ]
  );


if (
  result.rows.length === 0
) {

  await client.query(
    "ROLLBACK"
  );

  return res.status(404).json({
    error:
      "Proyek tidak ditemukan"
  });

}


// =========================================
// HAPUS KATEGORI LAMA
// =========================================

await client.query(
  `
  DELETE FROM
    public.proyek_kategori

  WHERE proyek_id = $1
  `,
  [id]
);


// =========================================
// SIMPAN KATEGORI BARU
// =========================================

for (
  const kategoriId
  of kategoriIds
) {

  await client.query(
    `
    INSERT INTO
      public.proyek_kategori (
        proyek_id,
        kategori_produk_id
      )

    VALUES ($1, $2)

    ON CONFLICT DO NOTHING
    `,
    [
      id,
      kategoriId
    ]
  );

}


// =========================================
// SIAPKAN PERBANDINGAN DATA
// =========================================

const tampilkanNilaiLog = value => {

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {

    return "-";

  }

  return String(value).trim();

};


const kategoriLama =
  (
    proyekLama
      .kategori_produk_ids ||
    []
  )
    .map(Number)
    .sort(
      (a, b) => a - b
    );


const kategoriBaru =
  [...kategoriIds]
    .map(Number)
    .sort(
      (a, b) => a - b
    );


// =========================================
// AMBIL NAMA KATEGORI PRODUK
// =========================================

const semuaKategoriIds = [
  ...new Set([
    ...kategoriLama,
    ...kategoriBaru
  ])
];


const namaKategoriMap =
  new Map();


if (
  semuaKategoriIds.length > 0
) {

  const kategoriResult =
    await client.query(
      `
      SELECT
        id::text AS id,
        nama_kategori_produk

      FROM public.kategori_produk

      WHERE id::text =
        ANY($1::text[])
      `,
      [
        semuaKategoriIds.map(
          value => String(value)
        )
      ]
    );


  for (
    const kategori
    of kategoriResult.rows
  ) {

    namaKategoriMap.set(
      String(kategori.id),
      kategori.nama_kategori_produk
    );

  }

}


// =========================================
// UBAH ID KATEGORI MENJADI NAMA
// =========================================

const kategoriLamaText =
  kategoriLama.length
    ? kategoriLama
        .map(
          kategoriId =>
            namaKategoriMap.get(
              String(kategoriId)
            ) ||
            "Kategori tidak ditemukan"
        )
        .join(", ")
    : "-";


const kategoriBaruText =
  kategoriBaru.length
    ? kategoriBaru
        .map(
          kategoriId =>
            namaKategoriMap.get(
              String(kategoriId)
            ) ||
            "Kategori tidak ditemukan"
        )
        .join(", ")
    : "-";

// =========================================
// DAFTAR SEMUA NILAI YANG DIPERIKSA
// =========================================

const daftarPerubahan = [

  {
    field:
      "KATEGORI PRODUK",

    lama:
      kategoriLamaText,

    baru:
      kategoriBaruText
  },

  {
    field:
      "NAMA PROYEK",

    lama:
      proyekLama.nama_proyek,

    baru:
      namaProyekBaru
  },

  {
    field:
      "JENIS PROYEK",

    lama:
      proyekLama.jenis_proyek,

    baru:
      jenisProyekBaru
  },

  {
    field:
      "SUB JENIS PROYEK",

    lama:
      proyekLama.sub_jenis_proyek,

    baru:
      subJenisProyekBaru
  },

  {
    field:
      "STATUS FINAL",

    lama:
      proyekLama.status_final,

    baru:
      statusFinalBaru
  },

  {
    field:
      "DESKRIPSI",

    lama:
      proyekLama.deskripsi,

    baru:
      deskripsiBaru
  }

];


// =========================================
// AMBIL USER YANG MELAKUKAN PERUBAHAN
// =========================================

const activityUser =
  getActivityUser(req);

const proyekBaru =
  result.rows[0];


// =========================================
// SIMPAN LOG HANYA UNTUK DATA YANG BERUBAH
// =========================================

for (
  const perubahan
  of daftarPerubahan
) {

  const nilaiLama =
    tampilkanNilaiLog(
      perubahan.lama
    );

  const nilaiBaru =
    tampilkanNilaiLog(
      perubahan.baru
    );


  // Jangan simpan log jika nilainya sama
  if (
    nilaiLama === nilaiBaru
  ) {

    continue;

  }


  await simpanActivityLog(
    client,
    {
      ...activityUser,

      aktivitas:
        "UPDATE",

      modul:
        "PROYEK",

      // ENTITY ID = PROYEK ID
      entity_id:
        proyekBaru.id,

      entity_nama:
        proyekBaru.nama_proyek,

      field_name:
        perubahan.field,

      nilai_lama:
        `${perubahan.field} - ${nilaiLama}`,

      nilai_baru:
        `${perubahan.field} - ${nilaiBaru}`,

      // Tidak mencantumkan nama proyek
      // agar tidak tampil dua kali
      deskripsi:
        `memperbarui ${perubahan.field.toLowerCase()}`
    }
  );

}


// =========================================
// SIMPAN SEMUA PERUBAHAN
// =========================================

await client.query(
  "COMMIT"
);

      await client.query(
        "COMMIT"
      );


      res.json({
        message:
          "Informasi proyek berhasil diperbarui",

        proyek:
          result.rows[0],

        kategori_produk_ids:
          kategoriIds
      });


    } catch (error) {

      await client.query(
        "ROLLBACK"
      );

      console.error(
        "ERROR UPDATE INFORMASI PROYEK:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });

    } finally {

      client.release();

    }

  }
);



// ======================================================
// UPDATE PIC PROYEK
// ======================================================

app.put("/api/proyek/:id/pic", 
  async (req, res) => {

  const client =
    await pool.connect();


  try {

    const { id } = req.params;

    const {
      pic_ids
    } = req.body;


    if (!Array.isArray(pic_ids)) {

      return res.status(400).json({
        error: "pic_ids harus berupa array"
      });

    }


    await client.query("BEGIN");


    // Hapus PIC lama
    await client.query(
      `
      DELETE FROM public.proyek_pic
      WHERE proyek_id = $1
      `,
      [id]
    );


    // Masukkan PIC baru
    for (const picId of pic_ids) {

      await client.query(
        `
        INSERT INTO public.proyek_pic (
          proyek_id,
          pic_id
        )
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [
          id,
          Number(picId)
        ]
      );

    }


    await client.query("COMMIT");


    res.json({
      message:
        "PIC proyek berhasil diperbarui"
    });


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );


    console.error(
      "ERROR UPDATE PIC PROYEK:",
      error
    );


    res.status(500).json({
      error: error.message
    });


  } finally {

    client.release();

  }

});


// ======================================================
// TAMBAH / EDIT DATA KLIEN PROYEK
// ======================================================

app.put(
  "/api/proyek/:id/klien",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      // ================================================
      // ID PROYEK
      // ================================================

      const proyekId =
        Number(req.params.id);

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID proyek tidak valid"
        });
      }


      // ================================================
      // AMBIL BODY
      // ================================================

      const {
        klien_id,
        nilai_submit,
        nilai_nego_1,
        nilai_nego_2,
        nilai_nego_3,
        tanggal_mulai,
        tanggal_akhir,
        model_pembayaran,
        status_pengadaan,
        status_teknis,
        status_administrasi
      } = req.body;


      // ================================================
      // VALIDASI KLIEN
      // ================================================

      const klienId =
        Number(klien_id);

      if (
        !Number.isInteger(klienId) ||
        klienId <= 0
      ) {
        return res.status(400).json({
          error:
            "Klien wajib dipilih"
        });
      }


      // ================================================
      // HELPER ANGKA
      // ================================================

      function angkaAtauNull(value) {
        if (
          value === "" ||
          value === null ||
          value === undefined
        ) {
          return null;
        }

        const hasil =
          Number(value);

        if (
          !Number.isFinite(hasil)
        ) {
          return null;
        }

        return hasil;
      }


      // ================================================
      // NORMALISASI NILAI
      // ================================================

      const nilaiSubmit =
        angkaAtauNull(
          nilai_submit
        );

      const nilaiNego1 =
        angkaAtauNull(
          nilai_nego_1
        );

      const nilaiNego2 =
        angkaAtauNull(
          nilai_nego_2
        );

      const nilaiNego3 =
        angkaAtauNull(
          nilai_nego_3
        );


      // ================================================
      // VALIDASI NILAI TIDAK NEGATIF
      // ================================================

      const daftarNilai = [
        {
          nama: "Nilai submit",
          nilai: nilaiSubmit
        },
        {
          nama: "Nilai nego 1",
          nilai: nilaiNego1
        },
        {
          nama: "Nilai nego 2",
          nilai: nilaiNego2
        },
        {
          nama: "Nilai nego 3",
          nilai: nilaiNego3
        }
      ];

      const nilaiNegatif =
        daftarNilai.find(
          item =>
            item.nilai !== null &&
            item.nilai < 0
        );

      if (nilaiNegatif) {
        return res.status(400).json({
          error:
            `${nilaiNegatif.nama} tidak boleh negatif`
        });
      }


      // ================================================
      // NORMALISASI TANGGAL
      // ================================================

      const tanggalMulai =
        String(
          tanggal_mulai || ""
        ).trim() || null;

      const tanggalAkhir =
        String(
          tanggal_akhir || ""
        ).trim() || null;

      if (
        tanggalMulai &&
        tanggalAkhir &&
        tanggalAkhir < tanggalMulai
      ) {
        return res.status(400).json({
          error:
            "Tanggal akhir tidak boleh lebih kecil dari tanggal mulai"
        });
      }


      // ================================================
      // NORMALISASI MODEL PEMBAYARAN
      // ================================================

      const modelPembayaran =
        String(
          model_pembayaran || ""
        ).trim() || null;

      const daftarModelPembayaran = [
        "Tahunan",
        "Bulanan",
        "Termin",
        "One Time Charge"
      ];

      if (
        modelPembayaran &&
        !daftarModelPembayaran.includes(
          modelPembayaran
        )
      ) {
        return res.status(400).json({
          error:
            "Model pembayaran tidak valid"
        });
      }


      // ================================================
      // NORMALISASI STATUS
      // Status berasal dari master status
      // ================================================

      const statusPengadaan =
        String(
          status_pengadaan || ""
        ).trim() || null;

      const statusTeknis =
        String(
          status_teknis || ""
        ).trim() || null;

      const statusAdministrasi =
        String(
          status_administrasi || ""
        ).trim() || null;


      console.log(
        "SIMPAN DATA KLIEN:",
        {
          proyek_id:
            proyekId,

          klien_id:
            klienId,

          nilai_submit:
            nilaiSubmit,

          nilai_nego_1:
            nilaiNego1,

          nilai_nego_2:
            nilaiNego2,

          nilai_nego_3:
            nilaiNego3,

          tanggal_mulai:
            tanggalMulai,

          tanggal_akhir:
            tanggalAkhir,

          model_pembayaran:
            modelPembayaran,

          status_pengadaan:
            statusPengadaan,

          status_teknis:
            statusTeknis,

          status_administrasi:
            statusAdministrasi
        }
      );


      // ================================================
      // MULAI TRANSAKSI
      // ================================================

      await client.query(
        "BEGIN"
      );


      // ================================================
      // PASTIKAN PROYEK ADA
      // ================================================

      const proyekResult =
        await client.query(
          `
          SELECT
            id,
            nama_proyek
          FROM public.proyek
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
          `,
          [proyekId]
        );

      if (
        proyekResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Proyek tidak ditemukan"
        });
      }


      // ================================================
      // PASTIKAN MASTER KLIEN ADA
      // ================================================

      const masterKlienResult =
        await client.query(
          `
          SELECT
            id,
            perusahaan_klien
          FROM public.data
          WHERE id = $1
          LIMIT 1
          `,
          [klienId]
        );

      if (
        masterKlienResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Master data klien tidak ditemukan"
        });
      }


      // ================================================
      // CARI DATA KLIEN PROYEK TERBARU
      // ================================================

     const proyekKlienResult =
  await client.query(
    `
      SELECT
        pk.id,
        pk.proyek_id,
        pk.klien_id,
        pk.nilai_submit,
        pk.nilai_nego_1,
        pk.nilai_nego_2,
        pk.nilai_nego_3,
        pk.tanggal_mulai,
        pk.tanggal_akhir,
        pk.model_pembayaran,
        pk.status_pengadaan,
        pk.status_teknis,
        pk.status_administrasi,
        d.perusahaan_klien

      FROM public.proyek_klien pk

      LEFT JOIN public.data d
        ON d.id = pk.klien_id

      WHERE pk.proyek_id = $1

      ORDER BY pk.id DESC
      LIMIT 1

      FOR UPDATE OF pk
    `,
    [proyekId]
  );

const dataKlienLama =
  proyekKlienResult.rows[0] || null;


      // ================================================
      // UPDATE JIKA DATA SUDAH ADA
      // ================================================
if (dataKlienLama) {
  const proyekKlienId =
    dataKlienLama.id;

  // query UPDATE tetap seperti sebelumnya
}
      if (
        proyekKlienResult.rowCount > 0
      ) {
        const proyekKlienId =
          proyekKlienResult
            .rows[0]
            .id;
        result =
          await client.query(
            `
            UPDATE public.proyek_klien
            SET
              klien_id = $1,
              nilai_submit = $2,
              nilai_nego_1 = $3,
              nilai_nego_2 = $4,
              nilai_nego_3 = $5,
              tanggal_mulai = $6,
              tanggal_akhir = $7,
              model_pembayaran = $8,
              status_pengadaan = $9,
              status_teknis = $10,

              status_administrasi =
                COALESCE(
                  $11,
                  status_administrasi
                ),

              updated_at = NOW()

            WHERE id = $12

            RETURNING
              id,
              proyek_id,
              klien_id,
              nilai_submit,
              nilai_nego_1,
              nilai_nego_2,
              nilai_nego_3,
              tanggal_mulai,
              tanggal_akhir,
              model_pembayaran,
              status_pengadaan,
              status_teknis,
              status_administrasi,
              created_at,
              updated_at
            `,
            [
              klienId,
              nilaiSubmit,
              nilaiNego1,
              nilaiNego2,
              nilaiNego3,
              tanggalMulai,
              tanggalAkhir,
              modelPembayaran,
              statusPengadaan,
              statusTeknis,
              statusAdministrasi,
              proyekKlienId
            ]
          );

        modeSimpan =
          "edit";
      }


      // ================================================
      // INSERT JIKA BELUM ADA DATA KLIEN
      // ================================================

      else {
        result =
          await client.query(
            `
            INSERT INTO public.proyek_klien (
              proyek_id,
              klien_id,
              nilai_submit,
              nilai_nego_1,
              nilai_nego_2,
              nilai_nego_3,
              tanggal_mulai,
              tanggal_akhir,
              model_pembayaran,
              status_pengadaan,
              status_teknis,
              status_administrasi,
              created_at,
              updated_at
            )
            VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8,
              $9, $10, $11, $12,
              NOW(), NOW()
            )
            RETURNING
              id,
              proyek_id,
              klien_id,
              nilai_submit,
              nilai_nego_1,
              nilai_nego_2,
              nilai_nego_3,
              tanggal_mulai,
              tanggal_akhir,
              model_pembayaran,
              status_pengadaan,
              status_teknis,
              status_administrasi,
              created_at,
              updated_at
            `,
            [
              proyekId,
              klienId,
              nilaiSubmit,
              nilaiNego1,
              nilaiNego2,
              nilaiNego3,
              tanggalMulai,
              tanggalAkhir,
              modelPembayaran,
              statusPengadaan,
              statusTeknis,
              statusAdministrasi
            ]
          );

        modeSimpan =
          "tambah";
      }


      // ================================================
      // SUSUN RESPONSE
      // ================================================

const dataKlien = {
  ...result.rows[0],

  perusahaan_klien:
    masterKlienResult
      .rows[0]
      .perusahaan_klien
};


// ================================================
// SIMPAN ACTIVITY LOG
// ================================================

const namaProyek =
  proyekResult.rows[0].nama_proyek;

const detailBaru =
  buatDetailLogKlien(dataKlien);


if (modeSimpan === "tambah") {
  // CREATE hanya mempunyai nilai baru
  await simpanActivityLog(
    client,
    {
      ...getActivityUser(req),

      aktivitas: "CREATE",
      modul: "PROYEK",

      // Entity wajib menggunakan proyek ID
      entity_id: proyekId,
      entity_nama: namaProyek,

      field_name: "DATA KLIEN",

      nilai_lama: null,

      nilai_baru:
        gabungkanDetailLog(
          detailBaru
        ),

      deskripsi:
        "menambahkan data klien proyek"
    }
  );
} else {
  const detailLama =
    buatDetailLogKlien(
      dataKlienLama
    );

  // Hanya field yang benar-benar berubah
  const perubahan =
    detailBaru
      .map(
        (itemBaru, index) => ({
          label:
            itemBaru.label,

          nilai_lama:
            detailLama[index].nilai,

          nilai_baru:
            itemBaru.nilai
        })
      )
      .filter(
        item =>
          item.nilai_lama !==
          item.nilai_baru
      );

  // Jangan membuat log kosong
  if (perubahan.length > 0) {
    await simpanActivityLog(
      client,
      {
        ...getActivityUser(req),

        aktivitas: "UPDATE",
        modul: "PROYEK",

        // Entity tetap menggunakan proyek ID
        entity_id: proyekId,
        entity_nama: namaProyek,

        field_name:
          "DATA KLIEN",

        nilai_lama:
          perubahan
            .map(
              item =>
                `${item.label} = ${item.nilai_lama}`
            )
            .join(", "),

        nilai_baru:
          perubahan
            .map(
              item =>
                `${item.label} = ${item.nilai_baru}`
            )
            .join(", "),

        deskripsi:
          "memperbarui data klien proyek"
      }
    );
  }
}

      // ================================================
      // COMMIT
      // ================================================

      await client.query(
        "COMMIT"
      );


      console.log(
        "HASIL SIMPAN KLIEN:",
        {
          mode:
            modeSimpan,

          data:
            dataKlien
        }
      );


      // ================================================
      // RESPONSE BERHASIL
      // ================================================

      return res.json({
        message:
          modeSimpan === "tambah"
            ? "Data klien berhasil ditambahkan"
            : "Data klien berhasil diperbarui",

        mode:
          modeSimpan,

        data:
          dataKlien
      });

    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "ERROR ROLLBACK KLIEN:",
          rollbackError
        );
      }

      console.error(
        "ERROR SIMPAN KLIEN PROYEK:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });

    } finally {
      client.release();
    }
  }
);
// ======================================================
// UPDATE / TAMBAH / HAPUS PARTNER PROYEK
// ======================================================

app.put(
  "/api/proyek/:id/partners",
  async (req, res) => {

    // ==================================================
    // VALIDASI LOGIN
    // ==================================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    const client =
      await pool.connect();

    let transactionDimulai =
      false;

    try {

      // ==================================================
      // AMBIL DATA
      // ==================================================

      const proyekId =
        Number(req.params.id);

      const partners =
        Array.isArray(
          req.body?.partners
        )
          ? req.body.partners
          : null;

      // ==================================================
      // VALIDASI
      // ==================================================

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID proyek tidak valid"
        });
      }

      if (!partners) {
        return res.status(400).json({
          error:
            "partners harus berupa array"
        });
      }

      const partnerIds =
        partners.map(
          item =>
            Number(item.partner_id)
        );

      if (
        partnerIds.some(
          id =>
            !Number.isInteger(id) ||
            id <= 0
        )
      ) {
        return res.status(400).json({
          error:
            "Terdapat partner yang tidak valid"
        });
      }

      if (
        new Set(partnerIds).size !==
        partnerIds.length
      ) {
        return res.status(400).json({
          error:
            "Partner yang sama tidak boleh ditambahkan dua kali"
        });
      }

      // ==================================================
      // HELPER NILAI
      // ==================================================

      function nilaiAtauNull(
        value
      ) {
        if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return null;
        }

        const hasil =
          Number(value);

        return Number.isFinite(hasil)
          ? hasil
          : null;
      }

      // ==================================================
      // MULAI TRANSAKSI
      // ==================================================

      await client.query(
        "BEGIN"
      );

      transactionDimulai =
        true;

      // ==================================================
      // AMBIL PROYEK
      // ==================================================

      const proyekResult =
        await client.query(
          `
            SELECT
              id,
              nama_proyek

            FROM public.proyek

            WHERE id = $1

            FOR UPDATE
          `,
          [proyekId]
        );

      if (
        proyekResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transactionDimulai =
          false;

        return res.status(404).json({
          error:
            "Proyek tidak ditemukan"
        });
      }

      const namaProyek =
        proyekResult.rows[0]
          .nama_proyek;

      // ==================================================
      // AMBIL PARTNER LAMA
      // ==================================================

      const existingResult =
        await client.query(
          `
            SELECT
              pp.id,
              pp.partner_id,
              pr.nama_partner,
              pp.nilai_submit,
              pp.nilai_nego_1,
              pp.nilai_nego_2,
              pp.nilai_nego_3,
              pp.tanggal_mulai,
              pp.tanggal_akhir,
              pp.model_pembayaran,
              pp.status_pengadaan,
              pp.status_teknis

            FROM public.proyek_partner pp

            LEFT JOIN public.partner pr
              ON pr.id = pp.partner_id

            WHERE pp.proyek_id = $1

            ORDER BY
              pp.id ASC

            FOR UPDATE OF pp
          `,
          [proyekId]
        );

      const partnerLama =
        existingResult.rows;

      const existingIds =
        partnerLama.map(
          item =>
            Number(item.id)
        );

      // ==================================================
      // ID PARTNER PROYEK DARI FRONTEND
      // ==================================================

      const incomingIds =
        partners
          .filter(
            item =>
              item.proyek_partner_id !==
                null &&
              item.proyek_partner_id !==
                undefined &&
              item.proyek_partner_id !==
                ""
          )
          .map(
            item =>
              Number(
                item.proyek_partner_id
              )
          );

      if (
        new Set(incomingIds).size !==
        incomingIds.length
      ) {
        throw new Error(
          "Data partner proyek yang sama tidak boleh dikirim dua kali"
        );
      }

      const incomingIdTidakValid =
        incomingIds.some(
          id =>
            !Number.isInteger(id) ||
            id <= 0 ||
            !existingIds.includes(id)
        );

      if (incomingIdTidakValid) {
        throw new Error(
          "Terdapat data partner proyek yang tidak valid"
        );
      }

      // ==================================================
      // CARI PARTNER YANG DIHAPUS
      // ==================================================

      const deletedIds =
        existingIds.filter(
          id =>
            !incomingIds.includes(id)
        );

      // ==================================================
      // HAPUS PARTNER
      // ==================================================

      if (
        deletedIds.length > 0
      ) {
        await client.query(
          `
            DELETE FROM
              public.proyek_partner

            WHERE proyek_id = $1

              AND id = ANY(
                $2::integer[]
              )
          `,
          [
            proyekId,
            deletedIds
          ]
        );
      }

      let jumlahDitambah = 0;
      let jumlahDiperbarui = 0;

      // ==================================================
      // UPDATE DAN INSERT PARTNER
      // ==================================================

      for (
        const item
        of partners
      ) {
        const partnerId =
          Number(item.partner_id);

        const nilaiSubmit =
          nilaiAtauNull(
            item.nilai_submit
          );

        const nilaiNego1 =
          nilaiAtauNull(
            item.nilai_nego_1
          );

        const nilaiNego2 =
          nilaiAtauNull(
            item.nilai_nego_2
          );

        const nilaiNego3 =
          nilaiAtauNull(
            item.nilai_nego_3
          );

        const tanggalMulai =
          item.tanggal_mulai ||
          null;

        const tanggalAkhir =
          item.tanggal_akhir ||
          null;

        const modelPembayaran =
          String(
            item.model_pembayaran ||
            ""
          ).trim() || null;

        const statusPengadaan =
          String(
            item.status_pengadaan ||
            ""
          ).trim() || null;

        const statusTeknis =
          String(
            item.status_teknis ||
            ""
          ).trim() || null;

        if (
          tanggalMulai &&
          tanggalAkhir &&
          tanggalAkhir <
            tanggalMulai
        ) {
          throw new Error(
            "Tanggal akhir partner tidak boleh sebelum tanggal mulai"
          );
        }

        // ================================================
        // UPDATE PARTNER LAMA
        // ================================================

        if (
          item.proyek_partner_id !==
            null &&
          item.proyek_partner_id !==
            undefined &&
          item.proyek_partner_id !==
            ""
        ) {
          const proyekPartnerId =
            Number(
              item.proyek_partner_id
            );

          const updateResult =
            await client.query(
              `
                UPDATE public.proyek_partner

                SET
                  partner_id = $1,
                  nilai_submit = $2,
                  nilai_nego_1 = $3,
                  nilai_nego_2 = $4,
                  nilai_nego_3 = $5,
                  tanggal_mulai = $6,
                  tanggal_akhir = $7,
                  model_pembayaran = $8,
                  status_pengadaan = $9,
                  status_teknis = $10,
                  updated_at =
                    CURRENT_TIMESTAMP

                WHERE id = $11
                  AND proyek_id = $12

                RETURNING *
              `,
              [
                partnerId,
                nilaiSubmit,
                nilaiNego1,
                nilaiNego2,
                nilaiNego3,
                tanggalMulai,
                tanggalAkhir,
                modelPembayaran,
                statusPengadaan,
                statusTeknis,
                proyekPartnerId,
                proyekId
              ]
            );

          if (
            updateResult.rows.length ===
            0
          ) {
            throw new Error(
              `Partner proyek ${proyekPartnerId} tidak ditemukan`
            );
          }

          jumlahDiperbarui += 1;

        } else {

          // ==============================================
          // INSERT PARTNER BARU
          // ==============================================

          await client.query(
            `
              INSERT INTO public.proyek_partner (
                proyek_id,
                partner_id,
                nilai_submit,
                nilai_nego_1,
                nilai_nego_2,
                nilai_nego_3,
                tanggal_mulai,
                tanggal_akhir,
                model_pembayaran,
                status_pengadaan,
                status_teknis,
                created_at,
                updated_at
              )

              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )

              RETURNING *
            `,
            [
              proyekId,
              partnerId,
              nilaiSubmit,
              nilaiNego1,
              nilaiNego2,
              nilaiNego3,
              tanggalMulai,
              tanggalAkhir,
              modelPembayaran,
              statusPengadaan,
              statusTeknis
            ]
          );

          jumlahDitambah += 1;
        }
      }

      // ==================================================
      // AMBIL PARTNER SETELAH PERUBAHAN
      // ==================================================

      const partnerBaruResult =
        await client.query(
          `
            SELECT
              pp.id,
              pp.partner_id,
              pr.nama_partner,
              pp.nilai_submit,
              pp.nilai_nego_1,
              pp.nilai_nego_2,
              pp.nilai_nego_3,
              pp.tanggal_mulai,
              pp.tanggal_akhir,
              pp.model_pembayaran,
              pp.status_pengadaan,
              pp.status_teknis

            FROM public.proyek_partner pp

            LEFT JOIN public.partner pr
              ON pr.id = pp.partner_id

            WHERE pp.proyek_id = $1

            ORDER BY
              pp.id ASC
          `,
          [proyekId]
        );

      const partnerBaru =
        partnerBaruResult.rows;

      // ==================================================
      // HELPER ACTIVITY LOG
      // ==================================================

      function normalisasiNominalLog(
        value
      ) {
        if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return null;
        }

        const hasil =
          Number(value);

        return Number.isFinite(hasil)
          ? hasil
          : null;
      }

      function formatNominalLog(
        value
      ) {
        const hasil =
          normalisasiNominalLog(
            value
          );

        if (hasil === null) {
          return "-";
        }

        return (
          "Rp " +
          Math.round(hasil)
            .toLocaleString(
              "id-ID"
            )
        );
      }

      function normalisasiTeksLog(
        value
      ) {
        const hasil =
          String(value || "")
            .trim();

        return hasil || null;
      }

      function formatTeksLog(
        value
      ) {
        return (
          normalisasiTeksLog(
            value
          ) || "-"
        );
      }

      function normalisasiTanggalLog(
        value
      ) {
        if (!value) {
          return null;
        }

        if (
          value instanceof Date
        ) {
          const tahun =
            value.getUTCFullYear();

          const bulan =
            String(
              value.getUTCMonth() + 1
            ).padStart(2, "0");

          const tanggal =
            String(
              value.getUTCDate()
            ).padStart(2, "0");

          return (
            `${tahun}-${bulan}-${tanggal}`
          );
        }

        const hasil =
          String(value)
            .trim()
            .match(
              /^\d{4}-\d{2}-\d{2}/
            );

        return hasil
          ? hasil[0]
          : null;
      }

      function formatTanggalLog(
        value
      ) {
        const tanggal =
          normalisasiTanggalLog(
            value
          );

        if (!tanggal) {
          return "-";
        }

        const [
          tahun,
          bulan,
          hari
        ] =
          tanggal
            .split("-")
            .map(Number);

        const namaBulan = [
          "Januari",
          "Februari",
          "Maret",
          "April",
          "Mei",
          "Juni",
          "Juli",
          "Agustus",
          "September",
          "Oktober",
          "November",
          "Desember"
        ];

        return (
          `${hari} ` +
          `${namaBulan[bulan - 1]} ` +
          `${tahun}`
        );
      }

      // ==================================================
      // BANDINGKAN FIELD YANG BERUBAH
      // ==================================================

      const perubahanPartner =
        [];

      const partnerLamaMap =
        new Map(
          partnerLama.map(
            item => [
              Number(item.id),
              item
            ]
          )
        );

      const partnerBaruMap =
        new Map(
          partnerBaru.map(
            item => [
              Number(item.id),
              item
            ]
          )
        );

      function tambahPerubahan(
        identitas,
        field,
        nilaiLama,
        nilaiBaru,
        formatter
      ) {
        if (
          nilaiLama === nilaiBaru
        ) {
          return;
        }

        perubahanPartner.push({
          label:
            `${identitas} - ${field}`,

          nilai_lama:
            formatter(nilaiLama),

          nilai_baru:
            formatter(nilaiBaru)
        });
      }

      // ==================================================
      // PARTNER YANG DIHAPUS
      // ==================================================

      partnerLama.forEach(
        (
          lama,
          index
        ) => {
          if (
            partnerBaruMap.has(
              Number(lama.id)
            )
          ) {
            return;
          }

          perubahanPartner.push({
            label:
              `PARTNER ${
                index + 1
              } DIHAPUS`,

            nilai_lama:
              lama.nama_partner ||
              `Partner ID ${
                lama.partner_id
              }`,

            nilai_baru:
              "-"
          });
        }
      );

      // ==================================================
      // PARTNER BARU ATAU DIPERBARUI
      // ==================================================

      partnerBaru.forEach(
        (
          baru,
          index
        ) => {
          const lama =
            partnerLamaMap.get(
              Number(baru.id)
            );

          const identitas =
            `PARTNER ${
              index + 1
            } (${
              baru.nama_partner ||
              lama?.nama_partner ||
              `ID ${baru.partner_id}`
            })`;

          // Partner baru
          if (!lama) {
            perubahanPartner.push({
              label:
                `PARTNER ${
                  index + 1
                } DITAMBAHKAN`,

              nilai_lama:
                "-",

              nilai_baru:
                baru.nama_partner ||
                `Partner ID ${
                  baru.partner_id
                }`
            });

            return;
          }

          // Nama partner
          if (
            Number(
              lama.partner_id
            ) !==
            Number(
              baru.partner_id
            )
          ) {
            perubahanPartner.push({
              label:
                `${identitas} - NAMA PARTNER`,

              nilai_lama:
                lama.nama_partner ||
                `Partner ID ${
                  lama.partner_id
                }`,

              nilai_baru:
                baru.nama_partner ||
                `Partner ID ${
                  baru.partner_id
                }`
            });
          }

          // Nilai Submit
          tambahPerubahan(
            identitas,
            "NILAI SUBMIT",
            normalisasiNominalLog(
              lama.nilai_submit
            ),
            normalisasiNominalLog(
              baru.nilai_submit
            ),
            formatNominalLog
          );

          // Nilai Nego 1
          tambahPerubahan(
            identitas,
            "NILAI NEGO 1",
            normalisasiNominalLog(
              lama.nilai_nego_1
            ),
            normalisasiNominalLog(
              baru.nilai_nego_1
            ),
            formatNominalLog
          );

          // Nilai Nego 2
          tambahPerubahan(
            identitas,
            "NILAI NEGO 2",
            normalisasiNominalLog(
              lama.nilai_nego_2
            ),
            normalisasiNominalLog(
              baru.nilai_nego_2
            ),
            formatNominalLog
          );

          // Nilai Nego 3
          tambahPerubahan(
            identitas,
            "NILAI NEGO 3",
            normalisasiNominalLog(
              lama.nilai_nego_3
            ),
            normalisasiNominalLog(
              baru.nilai_nego_3
            ),
            formatNominalLog
          );

          // Tanggal Mulai
          tambahPerubahan(
            identitas,
            "TANGGAL MULAI",
            normalisasiTanggalLog(
              lama.tanggal_mulai
            ),
            normalisasiTanggalLog(
              baru.tanggal_mulai
            ),
            formatTanggalLog
          );

          // Tanggal Akhir
          tambahPerubahan(
            identitas,
            "TANGGAL AKHIR",
            normalisasiTanggalLog(
              lama.tanggal_akhir
            ),
            normalisasiTanggalLog(
              baru.tanggal_akhir
            ),
            formatTanggalLog
          );

          // Model Pembayaran
          tambahPerubahan(
            identitas,
            "MODEL PEMBAYARAN",
            normalisasiTeksLog(
              lama.model_pembayaran
            ),
            normalisasiTeksLog(
              baru.model_pembayaran
            ),
            formatTeksLog
          );

          // Status Pengadaan
          tambahPerubahan(
            identitas,
            "STATUS PENGADAAN",
            normalisasiTeksLog(
              lama.status_pengadaan
            ),
            normalisasiTeksLog(
              baru.status_pengadaan
            ),
            formatTeksLog
          );

          // Status Teknis
          tambahPerubahan(
            identitas,
            "STATUS TEKNIS",
            normalisasiTeksLog(
              lama.status_teknis
            ),
            normalisasiTeksLog(
              baru.status_teknis
            ),
            formatTeksLog
          );
        }
      );

      // ==================================================
      // SIMPAN LOG HANYA FIELD YANG BERUBAH
      // ==================================================

      if (
        perubahanPartner.length > 0
      ) {
        await simpanActivityLog(
          client,
          {
            ...getActivityUser(req),

            aktivitas:
              "UPDATE",

            modul:
              "PROYEK",

            entity_id:
              proyekId,

            entity_nama:
              namaProyek,

            field_name:
              "PARTNER PROYEK",

            nilai_lama:
              perubahanPartner
                .map(
                  item =>
                    `${item.label} = ` +
                    `${item.nilai_lama}`
                )
                .join(" | "),

            nilai_baru:
              perubahanPartner
                .map(
                  item =>
                    `${item.label} = ` +
                    `${item.nilai_baru}`
                )
                .join(" | "),

            deskripsi:
              "memperbarui data partner proyek"
          }
        );
      }

      // ==================================================
      // COMMIT
      // ==================================================

      await client.query(
        "COMMIT"
      );

      transactionDimulai =
        false;

      return res.json({
        message:
          "Partner proyek berhasil diperbarui",

        ditambah:
          jumlahDitambah,

        diperbarui:
          jumlahDiperbarui,

        dihapus:
          deletedIds.length,

        perubahan:
          perubahanPartner.length
      });

    } catch (error) {

      if (transactionDimulai) {
        await client.query(
          "ROLLBACK"
        );
      }

      console.error(
        "ERROR UPDATE PARTNER PROYEK:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });

    } finally {

      client.release();

    }
  }
);
// ======================================================
// TASK LIST
// ======================================================
// ======================================================
// TASK LIST - DAFTAR PROYEK
// ======================================================

// =====================================================
// PILIHAN PROYEK TASK LIST
// =====================================================

app.get(
  "/api/task-list/proyek",

  setTaskListAccess,

  async (req, res) => {
    try {
      const {
        pic_id,
        dapat_melihat_semua
      } = req.taskListAccess;

      const result =
        await pool.query(
          `
          SELECT
            p.id,
            p.nama_proyek,

            p.kategori_produk_id
              AS kategori_id,

            COALESCE(
              kategori_data.kategori,
              kategori_utama.nama_kategori_produk,
              'Tanpa Kategori'
            ) AS kategori

          FROM public.proyek p

          LEFT JOIN public.kategori_produk
            kategori_utama

            ON kategori_utama.id =
               p.kategori_produk_id

          LEFT JOIN LATERAL (
            SELECT
              STRING_AGG(
                DISTINCT
                kategori.nama_kategori_produk,
                ', '
                ORDER BY
                  kategori.nama_kategori_produk
              ) AS kategori

            FROM public.proyek_kategori relasi

            INNER JOIN public.kategori_produk kategori
              ON kategori.id =
                 relasi.kategori_produk_id

            WHERE relasi.proyek_id =
                  p.id
          ) kategori_data
            ON TRUE

          WHERE
            $1::boolean = TRUE

            OR EXISTS (
              SELECT 1

              FROM public.proyek_pic pp

              WHERE pp.proyek_id =
                    p.id

                AND pp.pic_id =
                    $2
            )

          ORDER BY
            p.nama_proyek ASC,
            p.id ASC
          `,
          [
            dapat_melihat_semua,
            pic_id
          ]
        );

      return res.json(
        result.rows
      );

    } catch (error) {
      console.error(
        "ERROR LOAD PROYEK TASK:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Gagal mengambil proyek Task List"
      });
    }
  }
);

// =====================================================
// GET TASK LIST
//
// KABAG/KADIV : MELIHAT SEMUA TASK
// LAINNYA     : HANYA TASK YANG DIBUAT SENDIRI
// =====================================================

app.get(
  "/api/task-list",

  setTaskListAccess,

  async (req, res) => {
    try {

      const {
        pic_id,
        dapat_melihat_semua
      } = req.taskListAccess;


      const result =
        await pool.query(
          `
          SELECT
            t.id,
            t.proyek_id,
            t.created_by,

            t.parent_task_id,
            t.need_follow_up,

            t.task,
            t.catatan,
            t.link,

            t.master_dokumen_id,
            t.nomor_dokumen,

            md.kode
              AS kode_dokumen,

            md.deskripsi
              AS deskripsi_dokumen,

            md.flag
              AS flag_dokumen,

            t.status,
            t.tanggal_mulai,
            t.target_date,

            t.tanggal_tindak_lanjut,

            t.tanggal_selesai,
            t.created_at,
            t.updated_at,

            p.nama_proyek,

            COALESCE(
              kategori_data.kategori,
              kategori_utama.nama_kategori_produk,
              'Tanpa Kategori'
            ) AS kategori,

            pembuat.nama
              AS dibuat_oleh

          FROM public.task_list t

          INNER JOIN public.proyek p
            ON p.id =
               t.proyek_id

          LEFT JOIN public.kategori_produk
            kategori_utama

            ON kategori_utama.id =
               p.kategori_produk_id

          LEFT JOIN LATERAL (
            SELECT
              STRING_AGG(
                DISTINCT
                kategori.nama_kategori_produk,
                ', '
                ORDER BY
                  kategori.nama_kategori_produk
              ) AS kategori

            FROM public.proyek_kategori relasi

            INNER JOIN public.kategori_produk kategori
              ON kategori.id =
                 relasi.kategori_produk_id

            WHERE
              relasi.proyek_id =
                p.id
          ) kategori_data
            ON TRUE

          LEFT JOIN public.pic pembuat
            ON pembuat.id =
               t.created_by

          LEFT JOIN public.master_dokumen md
            ON md.id =
               t.master_dokumen_id

          /*
           * Kabag/Kadiv:
           * $1 = TRUE sehingga melihat seluruh task.
           *
           * Selain Kabag/Kadiv:
           * hanya task yang dibuat oleh PIC login.
           */

          WHERE (
            $1::boolean = TRUE

            OR t.created_by = $2
          )

          ORDER BY
            t.id DESC
          `,
          [
            dapat_melihat_semua,
            pic_id
          ]
        );


      return res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET TASK LIST:",
        error
      );


      return res.status(500).json({
        error:
          error.message ||
          "Gagal mengambil Task List"
      });

    }
  }
);

// =====================================================
// CREATE TASK LIST
// =====================================================
app.post(
  "/api/task-list",
  async (req, res) => {

    // =================================================
    // VALIDASI LOGIN
    // =================================================

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login"
      });

    }


    const client =
      await pool.connect();


    let transactionAktif =
      false;


    try {

      const user =
        req.session.user;


      const {
        proyek_id,
        task,
        catatan,
        link,

        master_dokumen_id,
        nomor_dokumen,

        target_date,
        tanggal_tindak_lanjut,

        status,
        need_follow_up,
        parent_task_id
      } = req.body;


      // =================================================
      // NORMALISASI ID
      // =================================================

      const proyekId =
        Number(proyek_id);


      const parentTaskId =
        parent_task_id === null ||
        parent_task_id === undefined ||
        parent_task_id === ""
          ? null
          : Number(parent_task_id);


      const masterDokumenId =
        master_dokumen_id === null ||
        master_dokumen_id === undefined ||
        master_dokumen_id === ""
          ? null
          : Number(master_dokumen_id);


      // =================================================
      // VALIDASI ID PROYEK
      // =================================================

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {

        return res.status(400).json({
          error:
            "Proyek wajib dipilih"
        });

      }


      // =================================================
      // VALIDASI TASK
      // =================================================

      const taskValue =
        String(task || "")
          .trim();


      if (!taskValue) {

        return res.status(400).json({
          error:
            "Task wajib diisi"
        });

      }


      if (
        taskValue.length > 250
      ) {

        return res.status(400).json({
          error:
            "Task maksimal 250 karakter"
        });

      }


      // =================================================
      // VALIDASI PARENT TASK
      // =================================================

      if (
        parentTaskId !== null &&
        (
          !Number.isInteger(
            parentTaskId
          ) ||
          parentTaskId <= 0
        )
      ) {

        return res.status(400).json({
          error:
            "Parent Task tidak valid"
        });

      }


      // =================================================
      // VALIDASI MASTER DOKUMEN
      // =================================================

      if (
        masterDokumenId !== null &&
        (
          !Number.isInteger(
            masterDokumenId
          ) ||
          masterDokumenId <= 0
        )
      ) {

        return res.status(400).json({
          error:
            "Master Dokumen tidak valid"
        });

      }


      // =================================================
      // NORMALISASI NEED FOLLOW UP
      // =================================================

      const needFollowUpValue =
        need_follow_up === true ||
        need_follow_up === "true" ||
        need_follow_up === 1 ||
        need_follow_up === "1";


      // =================================================
      // NORMALISASI STATUS
      // =================================================

      const statusInput =
        String(
          status || "Not Started"
        )
          .trim()
          .toLowerCase();


      const statusMap = {

        "not started":
          "Not Started",

        "on progress":
          "On Progress",

        "hold":
          "Hold",

        "urgent":
          "Urgent",

        "done":
          "Done",

        "need follow up":
          "Need Follow Up"

      };


      let statusValue =
        statusMap[statusInput] ||
        null;


      /*
       * Jika checkbox Need Follow Up aktif,
       * status task utama otomatis menjadi
       * Need Follow Up.
       */

      if (needFollowUpValue) {

        statusValue =
          "Need Follow Up";

      }


      const statusValid = [
        "Not Started",
        "On Progress",
        "Hold",
        "Urgent",
        "Done",
        "Need Follow Up"
      ];


      if (
        !statusValue ||
        !statusValid.includes(
          statusValue
        )
      ) {

        return res.status(400).json({
          error:
            "Status tidak valid"
        });

      }


      // =================================================
      // NORMALISASI TANGGAL
      // =================================================

      const targetDateValue =
        target_date
          ? String(target_date).trim()
          : null;


      const tanggalTindakLanjutValue =
        tanggal_tindak_lanjut
          ? String(
              tanggal_tindak_lanjut
            ).trim()
          : null;


      const formatTanggal =
        /^\d{4}-\d{2}-\d{2}$/;


      // =================================================
      // TARGET DATE WAJIB
      // =================================================

      if (!targetDateValue) {

        return res.status(400).json({
          error:
            "Target Date wajib diisi"
        });

      }


      if (
        !formatTanggal.test(
          targetDateValue
        )
      ) {

        return res.status(400).json({
          error:
            "Format Target Date tidak valid"
        });

      }


      if (
        tanggalTindakLanjutValue &&
        !formatTanggal.test(
          tanggalTindakLanjutValue
        )
      ) {

        return res.status(400).json({
          error:
            "Format Tanggal Tindak Lanjut tidak valid"
        });

      }


      // =================================================
      // TANGGAL TINDAK LANJUT WAJIB
      // JIKA NEED FOLLOW UP AKTIF
      // =================================================

      if (
        needFollowUpValue &&
        !tanggalTindakLanjutValue
      ) {

        return res.status(400).json({
          error:
            "Tanggal Tindak Lanjut wajib diisi"
        });

      }


      // =================================================
      // NORMALISASI FIELD LAIN
      // =================================================

      const catatanValue =
        String(catatan || "")
          .trim() ||
        null;


      let linkValue =
        String(link || "")
          .trim() ||
        null;


      if (
        linkValue &&
        !/^https?:\/\//i.test(
          linkValue
        )
      ) {

        linkValue =
          `https://${linkValue}`;

      }


      const nomorDokumenValue =
        String(
          nomor_dokumen || ""
        )
          .trim() ||
        null;


      // =================================================
      // CEK ROLE
      // =================================================

      const isAdmin =
        String(
          user.role || ""
        )
          .trim()
          .toLowerCase() ===
        "admin";


      await client.query("BEGIN");

      transactionAktif =
        true;


      // =================================================
      // CEK PROYEK DAN HAK AKSES
      // =================================================

      const proyekResult =
        await client.query(
          `
          SELECT
            proyek.id,
            proyek.nama_proyek

          FROM public.proyek proyek

          WHERE
            proyek.id = $1

            AND (
              $2::boolean = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic akses

                WHERE
                  akses.proyek_id =
                    proyek.id

                  AND akses.pic_id =
                    $3
              )
            )

          LIMIT 1
          `,
          [
            proyekId,
            isAdmin,
            Number(user.id)
          ]
        );


      if (
        proyekResult.rowCount === 0
      ) {

        await client.query(
          "ROLLBACK"
        );

        transactionAktif =
          false;


        return res.status(403).json({
          error:
            "Proyek tidak ditemukan atau Anda tidak memiliki akses"
        });

      }


      const namaProyek =
        proyekResult
          .rows[0]
          .nama_proyek;


      // =================================================
      // CEK PARENT TASK
      // Parent harus berada pada proyek yang sama.
      // =================================================

      let parentTask = null;


      if (
        parentTaskId !== null
      ) {

        const parentResult =
          await client.query(
            `
            SELECT
              id,
              proyek_id,
              task

            FROM public.task_list

            WHERE
              id = $1

              AND proyek_id = $2

            LIMIT 1
            `,
            [
              parentTaskId,
              proyekId
            ]
          );


        if (
          parentResult.rowCount === 0
        ) {

          await client.query(
            "ROLLBACK"
          );

          transactionAktif =
            false;


          return res.status(400).json({
            error:
              "Parent Task tidak ditemukan atau berbeda proyek"
          });

        }


        parentTask =
          parentResult.rows[0];

      }


      // =================================================
      // CEK MASTER DOKUMEN
      // =================================================

      if (
        masterDokumenId !== null
      ) {

        const dokumenResult =
          await client.query(
            `
            SELECT id

            FROM public.master_dokumen

            WHERE id = $1

            LIMIT 1
            `,
            [masterDokumenId]
          );


        if (
          dokumenResult.rowCount === 0
        ) {

          await client.query(
            "ROLLBACK"
          );

          transactionAktif =
            false;


          return res.status(400).json({
            error:
              "Master Dokumen tidak ditemukan"
          });

        }

      }


      // =================================================
      // INSERT TASK
      // =================================================

      const result =
        await client.query(
          `
          INSERT INTO public.task_list (
            proyek_id,
            created_by,

            parent_task_id,
            task,
            catatan,
            link,

            master_dokumen_id,
            nomor_dokumen,

            status,
            need_follow_up,

            tanggal_mulai,
            target_date,
            tanggal_tindak_lanjut,
            tanggal_selesai,

            created_at,
            updated_at
          )

          VALUES (
            $1::integer,
            $2::integer,

            $3::integer,
            $4::varchar,
            $5::text,
            $6::text,

            $7::integer,
            $8::varchar,

            $9::varchar,
            $10::boolean,

            CURRENT_DATE,
            $11::date,
            $12::date,

            CASE
              WHEN
                $9::varchar = 'Done'
              THEN CURRENT_DATE

              ELSE NULL
            END,

            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          RETURNING *
          `,
          [
            proyekId,
            Number(user.id),

            parentTaskId,
            taskValue,
            catatanValue,
            linkValue,

            masterDokumenId,
            nomorDokumenValue,

            statusValue,
            needFollowUpValue,

            targetDateValue,

            needFollowUpValue
              ? tanggalTindakLanjutValue
              : null
          ]
        );


      const savedTask =
        result.rows[0];


      // =================================================
      // ACTIVITY LOG
      // =================================================

      const activityUser =
        getActivityUser(req);


      const jenisTask =
        parentTaskId !== null
          ? "Sub Task"
          : "Task Utama";


      const nilaiBaru = [

        `Proyek = ${namaProyek}`,

        `Jenis = ${jenisTask}`,

        parentTask
          ? `Parent Task = ${parentTask.task}`
          : null,

        `Task = ${savedTask.task}`,

        `Target Date = ${
          savedTask.target_date ||
          "-"
        }`,

        `Need Follow Up = ${
          savedTask.need_follow_up
            ? "Ya"
            : "Tidak"
        }`,

        `Tanggal Tindak Lanjut = ${
          savedTask
            .tanggal_tindak_lanjut ||
          "-"
        }`,

        `Status = ${
          savedTask.status
        }`

      ]
        .filter(Boolean)
        .join(", ");


      await simpanActivityLog(
        client,
        {
          ...activityUser,

          aktivitas:
            "CREATE",

          modul:
            "TASK_LIST",

          entity_id:
            savedTask.id,

          entity_nama:
            savedTask.task,

          field_name:
            null,

          nilai_lama:
            null,

          nilai_baru:
            nilaiBaru,

          deskripsi:
            parentTaskId !== null
              ? `menambahkan Sub Task ${savedTask.task}`
              : `menambahkan Task List ${savedTask.task}`
        }
      );


      // =================================================
      // COMMIT
      // =================================================

      await client.query(
        "COMMIT"
      );


      transactionAktif =
        false;


      // =================================================
      // RESPONSE
      // =================================================

      return res
        .status(201)
        .json({
          message:
            parentTaskId !== null
              ? "Sub Task berhasil ditambahkan"
              : "Task berhasil ditambahkan",

          data:
            savedTask
        });


    } catch (error) {

      if (transactionAktif) {

        try {

          await client.query(
            "ROLLBACK"
          );

        } catch (
          rollbackError
        ) {

          console.error(
            "ERROR ROLLBACK CREATE TASK:",
            rollbackError
          );

        }

      }


      console.error(
        "ERROR CREATE TASK:",
        error
      );


      if (
        error.code === "23514"
      ) {

        return res.status(400).json({
          error:
            "Data task tidak sesuai dengan ketentuan database"
        });

      }


      if (
        error.code === "23503"
      ) {

        return res.status(400).json({
          error:
            "Proyek, Parent Task, pengguna, atau Master Dokumen tidak ditemukan"
        });

      }


      return res.status(500).json({
        error:
          error.message ||
          "Gagal menambahkan task"
      });


    } finally {

      client.release();

    }

  }
);
// =====================================================
// UPDATE TASK LIST + ACTIVITY LOG
// =====================================================

app.put(
  "/api/task-list/:id",
  async (req, res) => {

    // =================================================
    // CEK LOGIN
    // =================================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }


    const client =
      await pool.connect();


    try {

      const user =
        req.session.user;

      const taskId =
        Number(req.params.id);


      if (
        !Number.isInteger(taskId) ||
        taskId <= 0
      ) {
        return res.status(400).json({
          error: "ID task tidak valid"
        });
      }


      const {
        proyek_id,
        parent_task_id,
        task,
        catatan,
        link,
        master_dokumen_id,
        nomor_dokumen,
        target_date,
        tanggal_tindak_lanjut,
        status,
        need_follow_up
      } = req.body || {};


      // =================================================
      // NORMALISASI DATA
      // =================================================

      const proyekId =
        Number(proyek_id);

      const namaTask =
        String(task || "").trim();

      const catatanValue =
        String(catatan || "").trim() ||
        null;

      const linkValue =
        String(link || "").trim() ||
        null;

      const nomorDokumenInput =
        String(
          nomor_dokumen || ""
        ).trim() || null;


      const parentTaskId =
        parent_task_id === null ||
        parent_task_id === undefined ||
        parent_task_id === ""
          ? null
          : Number(parent_task_id);


      const needFollowUpValue =
        need_follow_up === true ||
        need_follow_up === 1 ||
        need_follow_up === "1" ||
        String(need_follow_up)
          .trim()
          .toLowerCase() === "true";


      const targetDateValue =
        target_date
          ? String(target_date).trim()
          : null;


      const tanggalTindakLanjutValue =
        needFollowUpValue &&
        tanggal_tindak_lanjut
          ? String(
              tanggal_tindak_lanjut
            ).trim()
          : null;


      // =================================================
      // VALIDASI DASAR
      // =================================================

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {
        return res.status(400).json({
          error:
            "Proyek wajib dipilih"
        });
      }


      if (!namaTask) {
        return res.status(400).json({
          error:
            "Task wajib diisi"
        });
      }


      if (!targetDateValue) {
        return res.status(400).json({
          error:
            "Target Date wajib diisi"
        });
      }


      if (
        parentTaskId !== null &&
        (
          !Number.isInteger(
            parentTaskId
          ) ||
          parentTaskId <= 0
        )
      ) {
        return res.status(400).json({
          error:
            "Parent Task tidak valid"
        });
      }


      if (
        parentTaskId !== null &&
        parentTaskId === taskId
      ) {
        return res.status(400).json({
          error:
            "Task tidak dapat menjadi parent untuk dirinya sendiri"
        });
      }


      // =================================================
      // VALIDASI FORMAT TANGGAL
      // =================================================

      const formatTanggal =
        /^\d{4}-\d{2}-\d{2}$/;


      if (
        !formatTanggal.test(
          targetDateValue
        )
      ) {
        return res.status(400).json({
          error:
            "Format Target Date harus YYYY-MM-DD"
        });
      }


      if (
        tanggalTindakLanjutValue &&
        !formatTanggal.test(
          tanggalTindakLanjutValue
        )
      ) {
        return res.status(400).json({
          error:
            "Format Tanggal Tindak Lanjut harus YYYY-MM-DD"
        });
      }


      if (
        needFollowUpValue &&
        !tanggalTindakLanjutValue
      ) {
        return res.status(400).json({
          error:
            "Tanggal Tindak Lanjut wajib diisi apabila Need Follow Up dipilih"
        });
      }


      // =================================================
      // NORMALISASI STATUS
      // =================================================

      const statusMap = {
        "not started":
          "Not Started",

        "on progress":
          "On Progress",

        "hold":
          "Hold",

        "urgent":
          "Urgent",

        "done":
          "Done",

        "need follow up":
          "Need Follow Up",

        "need follow-up":
          "Need Follow Up"
      };


      let statusValue =
        statusMap[
          String(
            status || "Not Started"
          )
            .trim()
            .toLowerCase()
        ];


      if (needFollowUpValue) {
        statusValue =
          "Need Follow Up";
      }


      const statusValid = [
        "Not Started",
        "On Progress",
        "Hold",
        "Urgent",
        "Done",
        "Need Follow Up"
      ];


      if (
        !statusValue ||
        !statusValid.includes(
          statusValue
        )
      ) {
        return res.status(400).json({
          error:
            "Status tidak valid"
        });
      }


      await client.query("BEGIN");


      // =================================================
      // AMBIL DATA TASK LAMA
      // =================================================

      const oldResult =
        await client.query(
          `
          SELECT
            t.*,

            p.nama_proyek,

            md.deskripsi
              AS nama_master_dokumen,

            parent.task
              AS nama_parent_task

          FROM public.task_list t

          JOIN public.proyek p
            ON p.id =
               t.proyek_id

          LEFT JOIN public.master_dokumen md
            ON md.id =
               t.master_dokumen_id

          LEFT JOIN public.task_list parent
            ON parent.id =
               t.parent_task_id

          WHERE t.id = $1

          FOR UPDATE OF t
          `,
          [taskId]
        );


      if (
        oldResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Task tidak ditemukan"
        });
      }


      const taskLama =
        oldResult.rows[0];


      // =================================================
      // CEK PROYEK TUJUAN
      // =================================================

      const proyekResult =
        await client.query(
          `
          SELECT
            id,
            nama_proyek

          FROM public.proyek

          WHERE id = $1

          LIMIT 1
          `,
          [proyekId]
        );


      if (
        proyekResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Proyek tidak ditemukan"
        });
      }


      const namaProyekBaru =
        proyekResult.rows[0]
          .nama_proyek;


      // =================================================
      // CEK HAK AKSES PROYEK
      // =================================================

      const isAdmin =
        String(user.role || "")
          .trim()
          .toLowerCase() ===
        "admin";


      if (!isAdmin) {

        const aksesResult =
          await client.query(
            `
            SELECT 1

            FROM public.proyek_pic

            WHERE
              proyek_id = $1
              AND pic_id = $2

            LIMIT 1
            `,
            [
              proyekId,
              user.id
            ]
          );


        if (
          aksesResult.rowCount === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(403).json({
            error:
              "Anda tidak memiliki akses ke proyek ini"
          });
        }
      }


      // =================================================
      // VALIDASI PARENT TASK
      // =================================================

      let namaParentBaru =
        null;


      if (parentTaskId !== null) {

        const parentResult =
          await client.query(
            `
            SELECT
              id,
              proyek_id,
              task

            FROM public.task_list

            WHERE id = $1

            LIMIT 1
            `,
            [parentTaskId]
          );


        if (
          parentResult.rowCount === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(404).json({
            error:
              "Parent Task tidak ditemukan"
          });
        }


        if (
          Number(
            parentResult.rows[0]
              .proyek_id
          ) !== proyekId
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Parent Task harus berasal dari proyek yang sama"
          });
        }


        namaParentBaru =
          parentResult.rows[0].task;
      }


      // =================================================
      // MASTER DOKUMEN
      // Pertahankan data lama jika field tidak dikirim
      // =================================================

      let masterDokumenValue;
      let nomorDokumenValue;


      if (
        master_dokumen_id ===
        undefined
      ) {
        masterDokumenValue =
          taskLama.master_dokumen_id;

        nomorDokumenValue =
          taskLama.nomor_dokumen;

      } else {

        masterDokumenValue =
          master_dokumen_id === null ||
          master_dokumen_id === ""
            ? null
            : Number(
                master_dokumen_id
              );

        nomorDokumenValue =
          masterDokumenValue
            ? nomorDokumenInput
            : null;
      }


      let namaMasterDokumenBaru =
        null;


      if (masterDokumenValue) {

        if (
          !Number.isInteger(
            Number(masterDokumenValue)
          ) ||
          Number(masterDokumenValue) <= 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Master dokumen tidak valid"
          });
        }


        const dokumenResult =
          await client.query(
            `
            SELECT
              id,
              deskripsi

            FROM public.master_dokumen

            WHERE id = $1

            LIMIT 1
            `,
            [masterDokumenValue]
          );


        if (
          dokumenResult.rowCount === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(404).json({
            error:
              "Master dokumen tidak ditemukan"
          });
        }


        namaMasterDokumenBaru =
          dokumenResult.rows[0]
            .deskripsi;
      }


      // =================================================
      // UPDATE TASK
      // =================================================

      const updateResult =
        await client.query(
          `
          UPDATE public.task_list

          SET
            proyek_id = $1,
            task = $2,
            catatan = $3,
            link = $4,

            master_dokumen_id = $5,
            nomor_dokumen = $6,

            status = $7,
            target_date = $8,
            tanggal_tindak_lanjut = $9,

            parent_task_id = $10,
            need_follow_up = $11,

            tanggal_selesai =
              CASE
                WHEN $7::varchar = 'Done'
                THEN COALESCE(
                  tanggal_selesai,
                  CURRENT_DATE
                )
                ELSE NULL
              END,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $12

          RETURNING *
          `,
          [
            proyekId,
            namaTask,
            catatanValue,
            linkValue,

            masterDokumenValue,
            nomorDokumenValue,

            statusValue,
            targetDateValue,
            tanggalTindakLanjutValue,

            parentTaskId,
            needFollowUpValue,

            taskId
          ]
        );


      const taskBaru =
        updateResult.rows[0];


      // =================================================
      // ACTIVITY LOG
      // HANYA FIELD YANG BERUBAH
      // =================================================

      const activityUser =
        getActivityUser(req);


      function normalisasiNilai(
        value
      ) {
        if (
          value === null ||
          value === undefined ||
          value === ""
        ) {
          return "-";
        }

        if (value instanceof Date) {
          return value
            .toISOString()
            .substring(0, 10);
        }

        return String(value);
      }


      function tanggalLog(value) {
        if (!value) {
          return "-";
        }

        return String(value)
          .substring(0, 10);
      }


      const perubahan = [];


      function tambahPerubahan(
        field,
        label,
        nilaiLama,
        nilaiBaru
      ) {

        const lama =
          normalisasiNilai(
            nilaiLama
          );

        const baru =
          normalisasiNilai(
            nilaiBaru
          );


        if (lama !== baru) {
          perubahan.push({
            field,
            label,
            lama,
            baru
          });
        }
      }


      tambahPerubahan(
        "proyek_id",
        "Proyek",
        taskLama.nama_proyek,
        namaProyekBaru
      );


      tambahPerubahan(
        "parent_task_id",
        "Parent Task",
        taskLama.nama_parent_task,
        namaParentBaru
      );


      tambahPerubahan(
        "task",
        "Task",
        taskLama.task,
        taskBaru.task
      );


      tambahPerubahan(
        "catatan",
        "Catatan",
        taskLama.catatan,
        taskBaru.catatan
      );


      tambahPerubahan(
        "link",
        "Link",
        taskLama.link,
        taskBaru.link
      );


      tambahPerubahan(
        "master_dokumen_id",
        "Master Dokumen",
        taskLama.nama_master_dokumen,
        namaMasterDokumenBaru
      );


      tambahPerubahan(
        "nomor_dokumen",
        "Nomor Dokumen",
        taskLama.nomor_dokumen,
        taskBaru.nomor_dokumen
      );


      tambahPerubahan(
        "target_date",
        "Target Date",
        tanggalLog(
          taskLama.target_date
        ),
        tanggalLog(
          taskBaru.target_date
        )
      );


      tambahPerubahan(
        "need_follow_up",
        "Need Follow Up",
        taskLama.need_follow_up
          ? "Ya"
          : "Tidak",
        taskBaru.need_follow_up
          ? "Ya"
          : "Tidak"
      );


      tambahPerubahan(
        "tanggal_tindak_lanjut",
        "Tanggal Tindak Lanjut",
        tanggalLog(
          taskLama
            .tanggal_tindak_lanjut
        ),
        tanggalLog(
          taskBaru
            .tanggal_tindak_lanjut
        )
      );


      tambahPerubahan(
        "status",
        "Status",
        taskLama.status,
        taskBaru.status
      );


      for (
        const item of perubahan
      ) {

        await simpanActivityLog(
          client,
          {
            ...activityUser,

            aktivitas:
              "UPDATE",

            modul:
              "TASK_LIST",

            entity_id:
              taskBaru.id,

            entity_nama:
              taskBaru.task,

            field_name:
              item.field,

            nilai_lama:
              item.lama,

            nilai_baru:
              item.baru,

            deskripsi:
              `mengubah ${item.label} Task List ` +
              `${taskBaru.task} dari ` +
              `${item.lama} menjadi ${item.baru}`
          }
        );
      }


      await client.query(
        "COMMIT"
      );


      return res.json({
        message:
          perubahan.length > 0
            ? "Task berhasil diperbarui"
            : "Tidak ada perubahan pada task",

        data:
          taskBaru,

        jumlah_perubahan:
          perubahan.length
      });


    } catch (error) {

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "ERROR ROLLBACK UPDATE TASK:",
          rollbackError
        );
      }


      console.error(
        "ERROR UPDATE TASK:",
        error
      );


      if (
        error.code === "23514"
      ) {
        return res.status(400).json({
          error:
            "Data task melanggar ketentuan database. Periksa Status, Need Follow Up, dan Tanggal Tindak Lanjut."
        });
      }


      if (
        error.code === "23503"
      ) {
        return res.status(400).json({
          error:
            "Proyek, Parent Task, atau Master Dokumen tidak valid."
        });
      }


      return res.status(500).json({
        error:
          error.message ||
          "Gagal memperbarui task"
      });


    } finally {

      client.release();

    }
  }
);

app.delete(
  "/api/task-list/:id",
  async (req, res) => {

    // =================================================
    // CEK LOGIN
    // =================================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }


    const client =
      await pool.connect();


    try {

      const user =
        req.session.user;

      const taskId =
        Number(req.params.id);


      // =================================================
      // VALIDASI ID
      // =================================================

      if (
        !Number.isInteger(taskId) ||
        taskId <= 0
      ) {
        return res.status(400).json({
          error: "ID task tidak valid"
        });
      }


      await client.query("BEGIN");


      // =================================================
      // AMBIL DAN LOCK DATA TASK
      // =================================================

      const taskResult =
        await client.query(
          `
          SELECT
            t.id,
            t.proyek_id,
            t.parent_task_id,
            t.created_by,
            t.task,
            t.catatan,
            t.link,
            t.master_dokumen_id,
            t.nomor_dokumen,
            t.status,
            t.tanggal_mulai,
            t.target_date,
            t.tanggal_selesai,
            t.need_follow_up,
            t.tanggal_tindak_lanjut,

            p.nama_proyek,

            COALESCE(
              kategori_data.kategori,
              '-'
            ) AS kategori

          FROM public.task_list t

          JOIN public.proyek p
            ON p.id = t.proyek_id

          LEFT JOIN LATERAL (
            SELECT
              STRING_AGG(
                DISTINCT
                kp.nama_kategori_produk,
                ', '
                ORDER BY
                kp.nama_kategori_produk
              ) AS kategori

            FROM public.proyek_kategori relasi

            JOIN public.kategori_produk kp
              ON kp.id =
                 relasi.kategori_produk_id

            WHERE
              relasi.proyek_id =
                t.proyek_id
          ) kategori_data
            ON TRUE

          WHERE t.id = $1

          FOR UPDATE OF t
          `,
          [taskId]
        );


      if (
        taskResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error: "Task tidak ditemukan"
        });
      }


      const taskLama =
        taskResult.rows[0];


      // =================================================
      // VALIDASI HAK AKSES
      // Admin dapat menghapus semua task.
      // Selain Admin harus menjadi PIC proyek.
      // =================================================

      const isAdmin =
        String(user.role || "")
          .trim()
          .toLowerCase() ===
        "admin";


      if (!isAdmin) {

        const aksesResult =
          await client.query(
            `
            SELECT 1

            FROM public.proyek_pic

            WHERE
              proyek_id = $1
              AND pic_id = $2

            LIMIT 1
            `,
            [
              taskLama.proyek_id,
              user.id
            ]
          );


        if (
          aksesResult.rowCount === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(403).json({
            error:
              "Anda tidak memiliki akses untuk menghapus task ini"
          });
        }
      }


      // =================================================
      // AMBIL SUB TASK YANG AKAN IKUT DIHAPUS
      // =================================================

      const subTaskResult =
        await client.query(
          `
          SELECT
            id,
            task,
            status,
            target_date,
            tanggal_tindak_lanjut

          FROM public.task_list

          WHERE parent_task_id = $1

          ORDER BY id ASC

          FOR UPDATE
          `,
          [taskId]
        );


      const daftarSubTask =
        subTaskResult.rows;


      // =================================================
      // HAPUS SUB TASK TERLEBIH DAHULU
      // =================================================

      if (daftarSubTask.length > 0) {

        await client.query(
          `
          DELETE FROM public.task_list

          WHERE parent_task_id = $1
          `,
          [taskId]
        );
      }


      // =================================================
      // HAPUS TASK UTAMA / TASK TERPILIH
      // =================================================

      const deleteResult =
        await client.query(
          `
          DELETE FROM public.task_list

          WHERE id = $1

          RETURNING *
          `,
          [taskId]
        );


      if (
        deleteResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error: "Task tidak ditemukan"
        });
      }


      // =================================================
      // FORMAT TANGGAL UNTUK LOG
      // =================================================

      function formatTanggalLog(
        value
      ) {

        if (!value) {
          return "-";
        }

        return String(value)
          .substring(0, 10);
      }


      // =================================================
      // ACTIVITY LOG SUB TASK
      // =================================================

      const activityUser =
        getActivityUser(req);


      for (
        const subTask
        of daftarSubTask
      ) {

        const nilaiLamaSubTask = [
          `Proyek = ${taskLama.nama_proyek}`,
          `Kategori = ${taskLama.kategori}`,
          `Parent Task = ${taskLama.task}`,
          `Sub Task = ${subTask.task}`,
          `Target Date = ${
            formatTanggalLog(
              subTask.target_date
            )
          }`,
          `Status = ${
            subTask.status || "-"
          }`
        ].join(", ");


        await simpanActivityLog(
          client,
          {
            ...activityUser,

            aktivitas:
              "DELETE",

            modul:
              "TASK_LIST",

            entity_id:
              subTask.id,

            entity_nama:
              subTask.task,

            field_name:
              null,

            nilai_lama:
              nilaiLamaSubTask,

            nilai_baru:
              null,

            deskripsi:
              `menghapus Sub Task ${subTask.task} ` +
              `karena Task Utama ${taskLama.task} dihapus`
          }
        );
      }


      // =================================================
      // ACTIVITY LOG TASK YANG DIHAPUS
      // =================================================

      const nilaiLama = [
        `Proyek = ${taskLama.nama_proyek}`,
        `Kategori = ${taskLama.kategori}`,
        `Task = ${taskLama.task}`,
        `Catatan = ${taskLama.catatan || "-"}`,
        `Link = ${taskLama.link || "-"}`,
        `Target Date = ${
          formatTanggalLog(
            taskLama.target_date
          )
        }`,
        `Need Follow Up = ${
          taskLama.need_follow_up
            ? "Ya"
            : "Tidak"
        }`,
        `Tanggal Tindak Lanjut = ${
          formatTanggalLog(
            taskLama
              .tanggal_tindak_lanjut
          )
        }`,
        `Status = ${taskLama.status || "-"}`
      ].join(", ");


      await simpanActivityLog(
        client,
        {
          ...activityUser,

          aktivitas:
            "DELETE",

          modul:
            "TASK_LIST",

          entity_id:
            taskLama.id,

          entity_nama:
            taskLama.task,

          field_name:
            null,

          nilai_lama:
            nilaiLama,

          nilai_baru:
            null,

          deskripsi:
            `menghapus Task List ${taskLama.task}`
        }
      );


      await client.query("COMMIT");


      // =================================================
      // RESPONSE
      // =================================================

      return res.json({
        success: true,

        message:
          daftarSubTask.length > 0
            ? `Task dan ${daftarSubTask.length} Sub Task berhasil dihapus`
            : "Task berhasil dihapus",

        data: {
          id:
            taskLama.id,

          task:
            taskLama.task,

          proyek_id:
            taskLama.proyek_id,

          jumlah_sub_task_dihapus:
            daftarSubTask.length
        }
      });


    } catch (error) {

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (rollbackError) {
        console.error(
          "ERROR ROLLBACK DELETE TASK:",
          rollbackError
        );
      }


      console.error(
        "ERROR DELETE TASK:",
        error
      );


      if (
        error.code === "23503"
      ) {
        return res.status(409).json({
          error:
            "Task masih digunakan oleh data lain dan belum dapat dihapus"
        });
      }


      return res.status(500).json({
        error:
          error.message ||
          "Gagal menghapus task"
      });


    } finally {

      client.release();

    }
  }
);

app.get(
  "/api/notifikasi/task",
  async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    try {
      const user = req.session.user;

      const userId = Number(user.id);

      const jabatan = String(user.jabatan || "")
        .trim()
        .toLowerCase();

      const bolehLihatSemua =
        jabatan.includes("kabag") ||
        jabatan.includes("kepala bagian") ||
        jabatan.includes("kadiv") ||
        jabatan.includes("kepala divisi");

      const result = await pool.query(
        `
        SELECT
          t.id AS task_id,
          t.proyek_id,
          t.task,
          t.catatan,
          t.link,
          t.target_date,
          t.tanggal_tindak_lanjut,
          t.status,

          CASE
            WHEN
              COALESCE(t.need_follow_up, FALSE)
              OR LOWER(
                TRIM(COALESCE(t.status, ''))
              ) = 'need follow up'
            THEN t.tanggal_tindak_lanjut::date
            ELSE t.target_date::date
          END AS tanggal_notifikasi,

          p.nama_proyek,

          COALESCE(
            kategori.nama_kategori,
            'Tanpa Kategori'
          ) AS kategori,

          CASE
            WHEN baca.id IS NULL THEN FALSE
            ELSE TRUE
          END AS sudah_dibaca

        FROM public.task_list t

        JOIN public.proyek p
          ON p.id = t.proyek_id

        LEFT JOIN LATERAL (
          SELECT
            STRING_AGG(
              DISTINCT kp.nama_kategori_produk,
              ', '
              ORDER BY kp.nama_kategori_produk
            ) AS nama_kategori

          FROM public.proyek_kategori pk

          JOIN public.kategori_produk kp
            ON kp.id = pk.kategori_produk_id

          WHERE pk.proyek_id = p.id
        ) kategori
          ON TRUE

        LEFT JOIN public.task_notification_read baca
          ON baca.task_id = t.id
         AND baca.user_id = $1

        WHERE
          (
            CASE
              WHEN
                COALESCE(t.need_follow_up, FALSE)
                OR LOWER(
                  TRIM(COALESCE(t.status, ''))
                ) = 'need follow up'
              THEN t.tanggal_tindak_lanjut::date
              ELSE t.target_date::date
            END
          ) <= (
            (
              CURRENT_TIMESTAMP
              AT TIME ZONE 'Asia/Jakarta'
            )::date + 1
          )

          AND LOWER(
            TRIM(COALESCE(t.status, ''))
          ) NOT IN (
            'done',
            'selesai',
            'completed'
          )

          AND (
            $2::boolean = TRUE
            OR t.created_by = $1
          )

        ORDER BY
          sudah_dibaca ASC,
          tanggal_notifikasi ASC,
          t.id DESC
        `,
        [
          userId,
          bolehLihatSemua
        ]
      );

      const belumDibaca = result.rows.filter(
        item => !item.sudah_dibaca
      ).length;

      return res.json({
        jumlah_belum_dibaca: belumDibaca,
        data: result.rows
      });

    } catch (error) {
      console.error(
        "ERROR GET NOTIFIKASI TASK:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);

app.put(
  "/api/notifikasi/task/:taskId/baca",
  async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    try {
      const taskId =
        Number(req.params.taskId);

      const userId =
        Number(req.session.user.id);

      if (
        !Number.isInteger(taskId) ||
        taskId <= 0
      ) {
        return res.status(400).json({
          error: "ID task tidak valid"
        });
      }

      await pool.query(
        `
        INSERT INTO
          public.task_notification_read (
            task_id,
            user_id
          )
        VALUES ($1, $2)

        ON CONFLICT (
          task_id,
          user_id
        )
        DO UPDATE SET
          dibaca_at =
            CURRENT_TIMESTAMP
        `,
        [
          taskId,
          userId
        ]
      );

      return res.json({
        message:
          "Notifikasi sudah dibaca"
      });

    } catch (error) {
      console.error(
        "ERROR BACA NOTIFIKASI:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);
// ======================================================
// TASK LIST DETAIL PROYEK
// SEMUA PIC - TASK TERBARU DI ATAS
// ======================================================

app.get("/api/proyek/:id/task-list",
  async (req, res) => {

    if (!req.session || !req.session.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    const proyekId = Number(req.params.id);

    if (!proyekId) {
      return res.status(400).json({
        error: "ID proyek tidak valid"
      });
    }

    try {

      console.log(
        "AMBIL TASK PROYEK:",
        proyekId
      );

      const result = await pool.query(
  `
  SELECT
    t.id,
    t.proyek_id,
    t.parent_task_id,
    t.task,
    t.catatan,
    t.link,
    t.status,
    t.need_follow_up,

    t.tanggal_mulai,
    t.target_date,
    t.tanggal_tindak_lanjut,
    t.tanggal_selesai,

    t.created_at,
    t.created_by,

    pic.nama AS nama_pic

  FROM public.task_list t

  LEFT JOIN public.pic pic
    ON pic.id = t.created_by

  WHERE
    t.proyek_id = $1

  ORDER BY
    t.created_at DESC,
    t.id DESC
  `,
  [proyekId]
);

      console.log(
        "JUMLAH TASK DITEMUKAN:",
        result.rows.length
      );

      return res.json(
        result.rows
      );

    } catch (error) {

      console.error(
        "ERROR TASK DETAIL PROYEK:",
        error
      );

      return res.status(500).json({
        error: error.message
      });

    }

  }
);
// ======================================================
// PENDAPATAN KLIEN PER BULAN & JENIS PROYEK
// ======================================================

app.get("/api/pendapatan", async (req, res) => {

  // ====================================================
  // CEK LOGIN
  // ====================================================

  if (!req.session?.user) {
    return res.status(401).json({
      error: "Belum login"
    });
  }

  try {

    // ==================================================
    // FILTER TAHUN
    // ==================================================

    const tahun =
      Number(req.query.tahun) ||
      new Date().getFullYear();

    if (
      !Number.isInteger(tahun) ||
      tahun < 1 ||
      tahun > 9998
    ) {
      return res.status(400).json({
        error: "Tahun tidak valid"
      });
    }

    // ==================================================
    // USER LOGIN
    // ==================================================

    const user = req.session.user;

    const isAdmin =
      String(user.role || "")
        .trim()
        .toLowerCase() === "admin";

    const picId = Number(user.id);

    console.log("PENDAPATAN API SEWA V2:", {
      tahun,
      role: user.role,
      isAdmin
    });

    if (
      !isAdmin &&
      (!Number.isInteger(picId) || picId <= 0)
    ) {
      return res.status(403).json({
        error: "PIC pengguna tidak valid"
      });
    }

    // ==================================================
    // QUERY PENDAPATAN
    // ==================================================

    const result = await pool.query(
      `
      WITH pendapatan_klien AS (

        SELECT

          CASE
            WHEN LOWER(TRIM(p.jenis_proyek))
              LIKE '%transaksi%'
            THEN 'transaksi'

            WHEN LOWER(TRIM(p.jenis_proyek))
              LIKE '%reguler%'
              OR LOWER(TRIM(p.jenis_proyek))
              LIKE '%sla%'
            THEN 'reguler'

            ELSE NULL
          END AS jenis_proyek,

          COALESCE(
            pkt.tanggal_bayar::date,
            pkt.tanggal_jatuh_tempo::date
          ) AS tanggal_pendapatan,

          CASE

            -- Transaksi menggunakan nominal termin.
            WHEN LOWER(TRIM(p.jenis_proyek))
              LIKE '%transaksi%'
            THEN COALESCE(pkt.nominal, 0)

            -- Reguler/SLA menggunakan nilai final
            -- dikalikan persentase termin.
            ELSE
              COALESCE(
                pk.nilai_nego_3,
                pk.nilai_nego_2,
                pk.nilai_nego_1,
                pk.nilai_submit,
                0
              )
              *
              COALESCE(pkt.persentase, 0)
              / 100.0

          END AS nilai

        FROM public.proyek_klien_termin pkt

        JOIN public.proyek_klien pk
          ON pk.id = pkt.proyek_klien_id

        JOIN public.proyek p
          ON p.id = pk.proyek_id

        WHERE

          LOWER(
            TRIM(
              REGEXP_REPLACE(
                COALESCE(pkt.status_pembayaran, ''),
                '[[:space:]]+',
                ' ',
                'g'
              )
            )
          ) IN (
            'dibayar',
            'sudah dibayar'
          )

          -- Sewa diambil dari tabel pembayaran sewa.
          -- Tidak dihitung lagi dari termin klien.
          AND LOWER(
            TRIM(
              COALESCE(p.jenis_proyek, '')
            )
          ) NOT LIKE '%sewa%'

          AND (
            $2::boolean = TRUE

            OR EXISTS (
              SELECT 1
              FROM public.proyek_pic pp
              WHERE pp.proyek_id = p.id
                AND pp.pic_id = $3
            )
          )

      ),

      pendapatan_sewa AS (

        SELECT

          'sewa'::text AS jenis_proyek,

          COALESCE(

            -- Prioritas pertama: tanggal bayar.
            pembayaran.tanggal_bayar::date,

            -- Prioritas kedua: tanggal_do pada pembayaran
            -- jika kolom tersebut tersedia dan terisi.
            NULLIF(
              to_jsonb(pembayaran) ->> 'tanggal_do',
              ''
            )::date,

            -- Cadangan: tanggal DO pertama dari order sewa.
            do_sewa.tanggal_do

          ) AS tanggal_pendapatan,

          COALESCE(
            pembayaran.nominal,
            0
          ) AS nilai

        FROM public.proyek_sewa_pembayaran pembayaran

        JOIN public.proyek_sewa sewa
          ON sewa.id = pembayaran.proyek_sewa_id

        -- Satu tanggal per pembayaran agar nominal
        -- tidak berulang saat ada beberapa order.
        LEFT JOIN LATERAL (

          SELECT
            MIN(
              pesanan.tanggal_do::date
            ) AS tanggal_do

          FROM public.proyek_sewa_produk produk

          JOIN public.proyek_sewa_order pesanan
            ON pesanan.proyek_sewa_produk_id =
               produk.id

          WHERE
            produk.proyek_sewa_id = sewa.id

            AND pembayaran.tanggal_bayar IS NULL

            AND NULLIF(
              to_jsonb(pembayaran) ->> 'tanggal_do',
              ''
            ) IS NULL

        ) do_sewa ON TRUE

        WHERE

          LOWER(
            TRIM(
              REGEXP_REPLACE(
                COALESCE(
                  pembayaran.status_pembayaran,
                  ''
                ),
                '[[:space:]]+',
                ' ',
                'g'
              )
            )
          ) IN (
            'dibayar',
            'sudah dibayar'
          )

          -- Admin dapat melihat semua pembayaran,
          -- termasuk proyek yang belum memiliki PIC.
          AND (
            $2::boolean = TRUE

            OR EXISTS (
              SELECT 1
              FROM public.proyek_pic pp
              WHERE pp.proyek_id = sewa.proyek_id
                AND pp.pic_id = $3
            )
          )

      ),

      pendapatan AS (

        SELECT
          jenis_proyek,
          tanggal_pendapatan,
          nilai
        FROM pendapatan_klien

        UNION ALL

        SELECT
          jenis_proyek,
          tanggal_pendapatan,
          nilai
        FROM pendapatan_sewa

      )

      SELECT

        jenis_proyek,

        EXTRACT(
          MONTH FROM tanggal_pendapatan
        )::integer AS bulan,

        COALESCE(
          SUM(nilai),
          0
        ) AS nilai_dibayar

      FROM pendapatan

      WHERE

        jenis_proyek IS NOT NULL

        AND tanggal_pendapatan >=
          MAKE_DATE($1::integer, 1, 1)

        AND tanggal_pendapatan <
          MAKE_DATE($1::integer + 1, 1, 1)

      GROUP BY

        jenis_proyek,

        EXTRACT(
          MONTH FROM tanggal_pendapatan
        )

      ORDER BY
        jenis_proyek,
        bulan
      `,
      [
        tahun,
        isAdmin,
        Number.isInteger(picId) ? picId : null
      ]
    );

    console.log(
      "HASIL QUERY PENDAPATAN:",
      result.rows
    );

    // ==================================================
    // SIAPKAN DATA 12 BULAN
    // ==================================================

    const data = {
      reguler: Array(12).fill(0),
      sewa: Array(12).fill(0),
      transaksi: Array(12).fill(0)
    };

    // ==================================================
    // MAPPING HASIL QUERY
    // ==================================================

    for (const item of result.rows) {

      const jenis = item.jenis_proyek;
      const bulan = Number(item.bulan);
      const nilai = Number(item.nilai_dibayar || 0);

      if (
        Object.prototype.hasOwnProperty.call(
          data,
          jenis
        ) &&
        bulan >= 1 &&
        bulan <= 12
      ) {
        data[jenis][bulan - 1] += nilai;
      }

    }

    console.log(
      "PENDAPATAN FINAL:",
      data
    );

    return res.json(data);

  } catch (error) {

    console.error(
      "ERROR GET PENDAPATAN:",
      error
    );

    return res.status(500).json({
      error: error.message
    });

  }

});

// ======================================================
// GET SEMUA MASTER DOKUMEN
// ======================================================

app.get("/api/master-dokumen",
  async (req, res) => {

    try {

      if (
        !req.session ||
        !req.session.user
      ) {

        return res
          .status(401)
          .json({
            error: "Belum login"
          });

      }


      const result =
        await pool.query(
          `
          SELECT
            id,
            flag,
            kode,
            deskripsi,
            created_at,
            updated_at
          FROM public.master_dokumen
          ORDER BY id DESC
          `
        );


      res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET MASTER DOKUMEN:",
        error
      );

      res
        .status(500)
        .json({
          error: error.message
        });

    }

  }
);


// ======================================================
// POST MASTER DOKUMEN
// ======================================================

app.post("/api/master-dokumen",
  async (req, res) => {

    try {

      if (
        !req.session ||
        !req.session.user
      ) {

        return res
          .status(401)
          .json({
            error: "Belum login"
          });

      }


      const {
        flag,
        kode,
        deskripsi
      } = req.body;


      // ================================
      // VALIDASI
      // ================================

      if (
        !flag ||
        !kode ||
        !deskripsi
      ) {

        return res
          .status(400)
          .json({
            error:
              "Flag, kode dan deskripsi wajib diisi."
          });

      }


      const allowedFlag = [
        "Admin",
        "Teknis",
        "Pembayaran"
      ];


      if (
        !allowedFlag.includes(flag)
      ) {

        return res
          .status(400)
          .json({
            error:
              "Flag dokumen tidak valid."
          });

      }


      // ================================
      // INSERT
      // ================================

      const result =
        await pool.query(
          `
          INSERT INTO public.master_dokumen (
            flag,
            kode,
            deskripsi
          )
          VALUES (
            $1,
            $2,
            $3
          )
          RETURNING
            id,
            flag,
            kode,
            deskripsi,
            created_at,
            updated_at
          `,
          [
            flag,
            kode.trim().toUpperCase(),
            deskripsi.trim()
          ]
        );


      res
        .status(201)
        .json(
          result.rows[0]
        );


    } catch (error) {

      console.error(
        "ERROR CREATE MASTER DOKUMEN:",
        error
      );


      // UNIQUE KODE
      if (
        error.code === "23505"
      ) {

        return res
          .status(400)
          .json({
            error:
              "Kode dokumen sudah digunakan."
          });

      }


      res
        .status(500)
        .json({
          error: error.message
        });

    }

  }
);


// ======================================================
// PUT / EDIT MASTER DOKUMEN
// ======================================================

app.put("/api/master-dokumen/:id",
  async (req, res) => {

    try {

      if (
        !req.session ||
        !req.session.user
      ) {

        return res
          .status(401)
          .json({
            error: "Belum login"
          });

      }


      const id =
        Number(req.params.id);


      const {
        flag,
        kode,
        deskripsi
      } = req.body;


      if (
        !Number.isInteger(id)
      ) {

        return res
          .status(400)
          .json({
            error:
              "ID dokumen tidak valid."
          });

      }


      if (
        !flag ||
        !kode ||
        !deskripsi
      ) {

        return res
          .status(400)
          .json({
            error:
              "Flag, kode dan deskripsi wajib diisi."
          });

      }


      const allowedFlag = [
        "Admin",
        "Teknis",
        "Pembayaran"
      ];


      if (
        !allowedFlag.includes(flag)
      ) {

        return res
          .status(400)
          .json({
            error:
              "Flag dokumen tidak valid."
          });

      }


      const result =
        await pool.query(
          `
          UPDATE public.master_dokumen
          SET
            flag = $1,
            kode = $2,
            deskripsi = $3
          WHERE id = $4
          RETURNING
            id,
            flag,
            kode,
            deskripsi,
            created_at,
            updated_at
          `,
          [
            flag,
            kode.trim().toUpperCase(),
            deskripsi.trim(),
            id
          ]
        );


      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({
            error:
              "Dokumen tidak ditemukan."
          });

      }


      res.json(
        result.rows[0]
      );


    } catch (error) {

      console.error(
        "ERROR UPDATE MASTER DOKUMEN:",
        error
      );


      if (
        error.code === "23505"
      ) {

        return res
          .status(400)
          .json({
            error:
              "Kode dokumen sudah digunakan."
          });

      }


      res
        .status(500)
        .json({
          error: error.message
        });

    }

  }
);


// ======================================================
// DELETE MASTER DOKUMEN
// ======================================================

app.delete("/api/master-dokumen/:id",
  async (req, res) => {

    try {

      if (
        !req.session ||
        !req.session.user
      ) {

        return res
          .status(401)
          .json({
            error: "Belum login"
          });

      }


      const id =
        Number(req.params.id);


      if (
        !Number.isInteger(id)
      ) {

        return res
          .status(400)
          .json({
            error:
              "ID dokumen tidak valid."
          });

      }


      const result =
        await pool.query(
          `
          DELETE FROM public.master_dokumen
          WHERE id = $1
          RETURNING id
          `,
          [id]
        );


      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({
            error:
              "Dokumen tidak ditemukan."
          });

      }


      res.json({
        message:
          "Master dokumen berhasil dihapus."
      });


    } catch (error) {

      console.error(
        "ERROR DELETE MASTER DOKUMEN:",
        error
      );


      res
        .status(500)
        .json({
          error: error.message
        });

    }

  }
);


// ======================================================
// START SERVER
// ======================================================

// const PORT = process.env.PORT || 3000;

// app.listen(PORT, async () => {

//   console.log(
//     `Server berjalan di http://localhost:${PORT}`
//   );

//   try {

//     const result = await pool.query(`
//       SELECT
//         current_database(),
//         current_user,
//         current_schema()
//     `);

//     console.log(
//       "KONEKSI DATABASE:",
//       result.rows[0]
//     );

//   } catch (error) {

//     console.error(
//       "GAGAL KONEKSI DATABASE:",
//       error.message
//     );

//   }

// });

app.get(
  "/api/task-list/proyek/:id/pembayaran-target",
  async (req, res) => {

    if (
      !req.session ||
      !req.session.user
    ) {

      return res.status(401).json({
        error: "Belum login"
      });

    }


    try {

      const proyekId =
        Number(req.params.id);


      const proyekResult =
        await pool.query(
          `
          SELECT
            id,
            nama_proyek,
            jenis_proyek

          FROM public.proyek

          WHERE id = $1
          `,
          [proyekId]
        );


      if (
        proyekResult.rowCount === 0
      ) {

        return res.status(404).json({
          error:
            "Proyek tidak ditemukan"
        });

      }


      const klienResult =
        await pool.query(
          `
          SELECT
            pk.id AS proyek_klien_id,
            d.perusahaan_klien AS nama

          FROM public.proyek_klien pk

          JOIN public.data d
            ON d.id = pk.klien_id

          WHERE
            pk.proyek_id = $1

          ORDER BY
            d.perusahaan_klien
          `,
          [proyekId]
        );


      const partnerResult =
  await client.query(
    `
    SELECT
      pp.id,
      pp.proyek_id,
      p.jenis_proyek,

      COALESCE(
        NULLIF(
          pp.nilai_nego_3,
          0
        ),
        NULLIF(
          pp.nilai_nego_2,
          0
        ),
        NULLIF(
          pp.nilai_nego_1,
          0
        ),
        NULLIF(
          pp.nilai_submit,
          0
        ),
        0
      )::NUMERIC
        AS nilai_partner

    FROM public.proyek_partner pp

    INNER JOIN public.proyek p
      ON p.id =
        pp.proyek_id

    WHERE
      pp.id = $1
    `,
    [
      proyekPartnerId
    ]
  );

      res.json({

        proyek:
          proyekResult.rows[0],

        klien:
          klienResult.rows,

        partner:
          partnerResult.rows

      });


    } catch (error) {

      console.error(
        "ERROR TARGET PEMBAYARAN TASK:",
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);

// ======================================================
// GET PROGNOSA
// ======================================================

app.get(
  "/api/prognosa",
  async (req, res) => {

    if (
      !req.session ||
      !req.session.user
    ) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    try {

      const user =
        req.session.user;

      const isAdmin =
        String(
          user.role || ""
        ).toLowerCase() === "admin";

      const picId =
        user.id;


      const result =
        await pool.query(
          `

          SELECT

            -- ==========================
            -- PROYEK
            -- ==========================

            p.id AS proyek_id,

            p.nama_proyek,

            p.jenis_proyek,

            p.sub_jenis_proyek,

            p.status_final,


            -- ==========================
            -- KATEGORI / KATEGORI BAYANGAN
            -- ==========================

            COALESCE(
              (
                SELECT STRING_AGG(
                  DISTINCT kp.nama_kategori_produk,
                  ', '
                  ORDER BY kp.nama_kategori_produk
                )

                FROM public.proyek_kategori pkat

                JOIN public.kategori_produk kp
                  ON kp.id =
                     pkat.kategori_produk_id

                WHERE
                  pkat.proyek_id = p.id
              ),
              'Tanpa Kategori'
            ) AS kategori_prognosa,


            -- ==========================
            -- KLIEN
            -- ==========================

            d.id AS klien_id,

            d.perusahaan_klien
              AS nama_klien,


            -- ==========================
            -- KONTRAK
            -- ==========================

            pk.id
              AS proyek_klien_id,

            pk.tanggal_mulai
              AS tanggal_mulai_kontrak,

            pk.tanggal_akhir
              AS tanggal_akhir_kontrak,

            pk.status_pengadaan,
            pk.status_teknis,



            -- ==========================
            -- NILAI KONTRAK
            -- ==========================

            CASE

              WHEN COALESCE(
                pk.nilai_nego_3,
                pk.nilai_nego_2,
                pk.nilai_nego_1,
                pk.nilai_submit,
                0
              ) > 0

              THEN COALESCE(
                pk.nilai_nego_3,
                pk.nilai_nego_2,
                pk.nilai_nego_1,
                pk.nilai_submit,
                0
              )

              ELSE COALESCE(
                (
                  SELECT SUM(
                    COALESCE(pkt2.nominal, 0)
                  )

                  FROM public.proyek_klien_termin pkt2

                  WHERE
                    pkt2.proyek_klien_id = pk.id
                ),
                0
              )

            END AS nilai_kontrak,


            -- ==========================
            -- TERMIN
            -- ==========================

            pkt.id AS termin_id,

            pkt.nama_termin,

            pkt.persentase,

            pkt.nominal,

            pkt.status_pembayaran,

            pkt.tanggal_jatuh_tempo,

            pkt.tanggal_bayar,


            -- ==========================
            -- NILAI TERMIN
            -- ==========================

            CASE

              WHEN pkt.nominal IS NOT NULL
              THEN pkt.nominal

              WHEN pkt.persentase IS NOT NULL
              THEN

                COALESCE(
                  pk.nilai_nego_3,
                  pk.nilai_nego_2,
                  pk.nilai_nego_1,
                  pk.nilai_submit,
                  0
                )

                *

                pkt.persentase

                / 100.0

              ELSE 0

            END AS nilai_termin,


            -- ==========================
            -- TANGGAL PROGNOSA
            -- ==========================

            (
              pkt.tanggal_jatuh_tempo
              + INTERVAL '1 year'
            )::date
              AS tanggal_prognosa


          FROM public.proyek_klien_termin pkt


          JOIN public.proyek_klien pk
            ON pk.id =
               pkt.proyek_klien_id


          JOIN public.proyek p
            ON p.id =
               pk.proyek_id


          LEFT JOIN public.data d
            ON d.id =
               pk.klien_id


          WHERE

            pkt.tanggal_jatuh_tempo
              IS NOT NULL

            AND (

              $1::boolean = TRUE

              OR EXISTS (

                SELECT 1

                FROM public.proyek_pic pp

                WHERE
                  pp.proyek_id = p.id

                  AND pp.pic_id = $2

              )

            )


          ORDER BY

            p.jenis_proyek ASC,

            p.sub_jenis_proyek ASC,

            kategori_prognosa ASC,

            p.nama_proyek ASC,

            tanggal_prognosa ASC

          `,
          [
            isAdmin,
            picId
          ]
        );


      const prognosa =
        result.rows.map(
          item => ({

            proyek_id:
              item.proyek_id,

            nama_proyek:
              item.nama_proyek,

            jenis_proyek:
              item.jenis_proyek,

            sub_jenis_proyek:
              item.sub_jenis_proyek,

            kategori_prognosa:
              item.kategori_prognosa,

            status_final:
              item.status_final,

            klien_id:
              item.klien_id,

            nama_klien:
              item.nama_klien,

            proyek_klien_id:
              item.proyek_klien_id,

            tanggal_mulai_kontrak:
              item.tanggal_mulai_kontrak,

            tanggal_akhir_kontrak:
              item.tanggal_akhir_kontrak,

            status_pengadaan:
              item.status_pengadaan,

            status_teknis:
              item.status_teknis,

            nilai_kontrak:
              Number(
                item.nilai_kontrak
              ) || 0,

            termin_id:
              item.termin_id,

            nama_termin:
              item.nama_termin,

            persentase:
              item.persentase !== null
                ? Number(item.persentase)
                : null,

            nominal:
              item.nominal !== null
                ? Number(item.nominal)
                : null,

            status_pembayaran:
              item.status_pembayaran,

            tanggal_jatuh_tempo:
              item.tanggal_jatuh_tempo,

            tanggal_bayar:
              item.tanggal_bayar,

            nilai_termin:
              Number(
                item.nilai_termin
              ) || 0,

            tanggal_prognosa:
              item.tanggal_prognosa

          })
        );


      const totalPrognosa =
        prognosa.reduce(
          (total, item) =>
            total +
            Number(
              item.nilai_termin || 0
            ),
          0
        );


      const proyekIds =
        new Set(
          prognosa.map(
            item =>
              Number(item.proyek_id)
          )
        );


      res.json({

        summary: {

          total_prognosa:
            totalPrognosa,

          jumlah_proyek:
            proyekIds.size,

          jumlah_termin:
            prognosa.length

        },

        prognosa

      });


    } catch (error) {

      console.error(
        "ERROR GET PROGNOSA:",
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);


app.get("/api/debug-tanggal-klien/:proyekId", async (req, res) => {
  try {
    const proyekId = Number(req.params.proyekId);

    const result = await pool.query(
      `
      SELECT
        id,
        proyek_id,
        klien_id,
        tanggal_mulai,
        tanggal_akhir,
        nilai_submit,
        nilai_nego_1,
        nilai_nego_2,
        nilai_nego_3
      FROM public.proyek_klien
      WHERE proyek_id = $1
      ORDER BY id DESC
      `,
      [proyekId]
    );

    res.json({
      route: "DEBUG TANGGAL KLIEN AKTIF",
      proyek_id: proyekId,
      jumlah_data: result.rowCount,
      data: result.rows
    });

  } catch (error) {
    console.error("ERROR DEBUG TANGGAL:", error);

    res.status(500).json({
      error: error.message
    });
  }
});


app.get(
  "/api/partner-proyek-aktif",
  async (req, res) => {

    // ==================================================
    // LOGIN
    // ==================================================

    if (
      !req.session ||
      !req.session.user
    ) {
      return res
        .status(401)
        .json({
          error: "Belum login"
        });
    }


    const user =
      req.session.user;


    const isAdmin =
      String(
        user.role || ""
      )
        .trim()
        .toLowerCase() ===
      "admin";


    const picId =
      Number(user.id);


    try {

      // ==================================================
      // PAGINATION
      // ==================================================

      const page =
        Math.max(
          Number(
            req.query.page
          ) || 1,
          1
        );


      const limit =
        Math.min(
          Math.max(
            Number(
              req.query.limit
            ) || 10,
            1
          ),
          100
        );


      const search =
        String(
          req.query.search || ""
        ).trim();


      const offset =
        (
          page - 1
        ) * limit;


      // ==================================================
      // QUERY
      // ==================================================

      const result =
        await pool.query(
          `
          WITH proyek_partner_semua AS (

            SELECT
              pp.id
                AS proyek_partner_id,

              pp.partner_id,

              p.id
                AS proyek_id,

              p.nama_proyek,

              p.status_final,

              pp.status_pengadaan,

              pp.status_teknis,

              pp.tanggal_mulai,

              pp.tanggal_akhir,


              /* =====================
                 NILAI PROYEK PARTNER
              ===================== */

              CASE
                WHEN
                  COALESCE(
                    NULLIF(
                      pp.nilai_nego_3,
                      0
                    ),
                    NULLIF(
                      pp.nilai_nego_2,
                      0
                    ),
                    NULLIF(
                      pp.nilai_nego_1,
                      0
                    ),
                    NULLIF(
                      pp.nilai_submit,
                      0
                    ),
                    0
                  ) > 0
                THEN
                  COALESCE(
                    NULLIF(
                      pp.nilai_nego_3,
                      0
                    ),
                    NULLIF(
                      pp.nilai_nego_2,
                      0
                    ),
                    NULLIF(
                      pp.nilai_nego_1,
                      0
                    ),
                    NULLIF(
                      pp.nilai_submit,
                      0
                    ),
                    0
                  )

                ELSE
                  COALESCE(
                    (
                      SELECT
                        SUM(
                          COALESCE(
                            ppt.nominal,
                            0
                          )
                        )

                      FROM
                        public.proyek_partner_termin ppt

                      WHERE
                        ppt.proyek_partner_id =
                          pp.id
                    ),
                    0
                  )
              END::NUMERIC
                AS nilai_proyek


            FROM public.proyek_partner pp


            INNER JOIN public.proyek p
              ON p.id =
                pp.proyek_id


            /* =========================
               FILTER BERDASARKAN PIC
            ========================= */

            WHERE
              $2::BOOLEAN = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic akses_pic

                WHERE
                  akses_pic.proyek_id =
                    p.id

                  AND akses_pic.pic_id =
                    $3
              )

          ),


          /* ============================================
             PEMBAYARAN PARTNER
          ============================================ */

          pembayaran_partner AS (

            SELECT
              ppt.proyek_partner_id,


              COALESCE(
                SUM(
                  CASE
                    WHEN
                      LOWER(
                        TRIM(
                          COALESCE(
                            ppt.status_pembayaran,
                            ''
                          )
                        )
                      ) IN (
                        'dibayar',
                        'sudah dibayar',
                        'lunas',
                        'paid'
                      )
                    THEN
                      COALESCE(
                        NULLIF(
                          ppt.nominal,
                          0
                        ),

                        (
                          COALESCE(
                            NULLIF(
                              pp.nilai_nego_3,
                              0
                            ),
                            NULLIF(
                              pp.nilai_nego_2,
                              0
                            ),
                            NULLIF(
                              pp.nilai_nego_1,
                              0
                            ),
                            NULLIF(
                              pp.nilai_submit,
                              0
                            ),
                            0
                          )
                          *
                          COALESCE(
                            ppt.persentase,
                            0
                          )
                          /
                          100
                        ),

                        0
                      )

                    ELSE 0
                  END
                ),
                0
              )::NUMERIC
                AS sudah_dibayar


            FROM
              public.proyek_partner_termin ppt


            INNER JOIN public.proyek_partner pp
              ON pp.id =
                ppt.proyek_partner_id


            GROUP BY
              ppt.proyek_partner_id

          ),


          /* ============================================
             DAFTAR PROYEK
          ============================================ */

          daftar_proyek AS (

            SELECT
              pps.*,

              COALESCE(
                bayar.sudah_dibayar,
                0
              )::NUMERIC
                AS sudah_dibayar,


              GREATEST(
                COALESCE(
                  pps.nilai_proyek,
                  0
                )
                -
                COALESCE(
                  bayar.sudah_dibayar,
                  0
                ),
                0
              )::NUMERIC
                AS sisa


            FROM
              proyek_partner_semua pps


            LEFT JOIN
              pembayaran_partner bayar

              ON bayar.proyek_partner_id =
                pps.proyek_partner_id

          ),


          /* ============================================
             RINGKASAN PER PARTNER
          ============================================ */

          ringkasan_partner AS (

            SELECT
              partner.id
                AS partner_id,

              partner.nama_partner,

              partner.inisial,


              /* =====================
                 TOTAL SEMUA PROYEK
              ===================== */

              COUNT(
                dp.proyek_partner_id
              )::INTEGER
                AS total_proyek,


              COALESCE(
                SUM(
                  dp.nilai_proyek
                ),
                0
              )::NUMERIC
                AS nilai_proyek,


              COALESCE(
                SUM(
                  dp.sudah_dibayar
                ),
                0
              )::NUMERIC
                AS sudah_dibayar,


              GREATEST(
                COALESCE(
                  SUM(
                    dp.nilai_proyek
                  ),
                  0
                )
                -
                COALESCE(
                  SUM(
                    dp.sudah_dibayar
                  ),
                  0
                ),
                0
              )::NUMERIC
                AS sisa,


              /* =====================
                 TOTAL PROYEK AKTIF
              ===================== */

              COUNT(
                dp.proyek_partner_id
              ) FILTER (
                WHERE
                  LOWER(
                    TRIM(
                      COALESCE(
                        dp.status_final,
                        ''
                      )
                    )
                  ) = 'aktif'
              )::INTEGER
                AS total_proyek_aktif,


              COALESCE(
                SUM(
                  dp.nilai_proyek
                ) FILTER (
                  WHERE
                    LOWER(
                      TRIM(
                        COALESCE(
                          dp.status_final,
                          ''
                        )
                      )
                    ) = 'aktif'
                ),
                0
              )::NUMERIC
                AS nilai_proyek_aktif,


              /* =====================
                 TOTAL PROYEK DONE
              ===================== */

              COUNT(
                dp.proyek_partner_id
              ) FILTER (
                WHERE
                  LOWER(
                    TRIM(
                      COALESCE(
                        dp.status_final,
                        ''
                      )
                    )
                  ) IN (
                    'done',
                    'selesai'
                  )
              )::INTEGER
                AS total_proyek_selesai,


              COALESCE(
                SUM(
                  dp.nilai_proyek
                ) FILTER (
                  WHERE
                    LOWER(
                      TRIM(
                        COALESCE(
                          dp.status_final,
                          ''
                        )
                      )
                    ) IN (
                      'done',
                      'selesai'
                    )
                ),
                0
              )::NUMERIC
                AS nilai_proyek_selesai,


              /* =====================
                 TOTAL PROYEK CANCEL
              ===================== */

              COUNT(
                dp.proyek_partner_id
              ) FILTER (
                WHERE
                  LOWER(
                    TRIM(
                      COALESCE(
                        dp.status_final,
                        ''
                      )
                    )
                  ) IN (
                    'cancel',
                    'batal'
                  )
              )::INTEGER
                AS total_proyek_cancel,


              COALESCE(
                SUM(
                  dp.nilai_proyek
                ) FILTER (
                  WHERE
                    LOWER(
                      TRIM(
                        COALESCE(
                          dp.status_final,
                          ''
                        )
                      )
                    ) IN (
                      'cancel',
                      'batal'
                    )
                ),
                0
              )::NUMERIC
                AS nilai_proyek_cancel,


              /* =====================
                 LISTING SEMUA PROYEK
              ===================== */

              COALESCE(
                JSONB_AGG(
                  JSONB_BUILD_OBJECT(
                    'proyek_partner_id',
                    dp.proyek_partner_id,

                    'proyek_id',
                    dp.proyek_id,

                    'nama_proyek',
                    dp.nama_proyek,

                    'status_final',
                    dp.status_final,

                    'status_pengadaan',
                    dp.status_pengadaan,

                    'status_teknis',
                    dp.status_teknis,

                    'nilai_proyek',
                    dp.nilai_proyek,

                    'sudah_dibayar',
                    dp.sudah_dibayar,

                    'sisa',
                    dp.sisa,

                    'tanggal_mulai',
                    dp.tanggal_mulai,

                    'tanggal_akhir',
                    dp.tanggal_akhir
                  )

                  ORDER BY
                    CASE
                      WHEN
                        LOWER(
                          TRIM(
                            COALESCE(
                              dp.status_final,
                              ''
                            )
                          )
                        ) = 'aktif'
                      THEN 1

                      WHEN
                        LOWER(
                          TRIM(
                            COALESCE(
                              dp.status_final,
                              ''
                            )
                          )
                        ) IN (
                          'done',
                          'selesai'
                        )
                      THEN 2

                      WHEN
                        LOWER(
                          TRIM(
                            COALESCE(
                              dp.status_final,
                              ''
                            )
                          )
                        ) IN (
                          'cancel',
                          'batal'
                        )
                      THEN 3

                      ELSE 4
                    END,

                    dp.tanggal_akhir ASC
                      NULLS LAST,

                    dp.nama_proyek ASC
                ) FILTER (
                  WHERE
                    dp.proyek_partner_id
                    IS NOT NULL
                ),
                '[]'::JSONB
              ) AS proyek


            FROM public.partner partner


            INNER JOIN daftar_proyek dp
              ON dp.partner_id =
                partner.id


            WHERE
              (
                $1 = ''

                OR partner.nama_partner
                  ILIKE
                    '%' || $1 || '%'

                OR COALESCE(
                  partner.inisial,
                  ''
                )
                  ILIKE
                    '%' || $1 || '%'
              )


            GROUP BY
              partner.id,
              partner.nama_partner,
              partner.inisial

          )


          /* ============================================
             HASIL AKHIR
          ============================================ */

          SELECT
            ringkasan_partner.*,

            COUNT(*) OVER()
              AS total_data


          FROM ringkasan_partner


          ORDER BY
            ringkasan_partner.total_proyek
              DESC,

            ringkasan_partner.nilai_proyek
              DESC,

            ringkasan_partner.nama_partner
              ASC


          LIMIT $4

          OFFSET $5
          `,
          [
            search,
            isAdmin,
            picId,
            limit,
            offset
          ]
        );


      // ==================================================
      // TOTAL DATA
      // ==================================================

      const totalData =
        result.rows.length > 0
          ? Number(
              result.rows[0]
                .total_data
            )
          : 0;


      // ==================================================
      // NORMALISASI RESPONSE
      // ==================================================

      const data =
        result.rows.map(item => {
          const {
            total_data,
            ...partner
          } = item;


          return {
            ...partner,

            partner_id:
              Number(
                partner.partner_id
              ),

            total_proyek:
              Number(
                partner.total_proyek ||
                0
              ),

            nilai_proyek:
              Number(
                partner.nilai_proyek ||
                0
              ),

            sudah_dibayar:
              Number(
                partner.sudah_dibayar ||
                0
              ),

            sisa:
              Number(
                partner.sisa ||
                0
              ),

            total_proyek_aktif:
              Number(
                partner.total_proyek_aktif ||
                0
              ),

            nilai_proyek_aktif:
              Number(
                partner.nilai_proyek_aktif ||
                0
              ),

            total_proyek_selesai:
              Number(
                partner.total_proyek_selesai ||
                0
              ),

            nilai_proyek_selesai:
              Number(
                partner.nilai_proyek_selesai ||
                0
              ),

            total_proyek_cancel:
              Number(
                partner.total_proyek_cancel ||
                0
              ),

            nilai_proyek_cancel:
              Number(
                partner.nilai_proyek_cancel ||
                0
              ),

            proyek:
              Array.isArray(
                partner.proyek
              )
                ? partner.proyek
                : []
          };
        });


      // ==================================================
      // RESPONSE
      // ==================================================

      return res.json({
        data,

        pagination: {
          page,
          limit,

          total_data:
            totalData,

          total_pages:
            Math.max(
              Math.ceil(
                totalData /
                limit
              ),
              1
            )
        }
      });

    } catch (error) {

      console.error(
        "ERROR GET PARTNER PROYEK:",
        error
      );


      return res
        .status(500)
        .json({
          error:
            error.message
        });

    }

  }
);

app.get(
  "/api/timeline",
  async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    try {
      const user =
        req.session.user;

      const isAdmin =
        String(user.role || "")
          .trim()
          .toLowerCase() === "admin";

      const picId =
        Number(user.id) || 0;

      const page =
        Math.max(
          Number(req.query.page) || 1,
          1
        );

      const limit =
        Math.min(
          Math.max(
            Number(req.query.limit) || 10,
            1
          ),
          100
        );

      const search =
        String(
          req.query.search || ""
        ).trim();

      const bulan =
        [1, 3, 6].includes(
          Number(req.query.bulan)
        )
          ? Number(req.query.bulan)
          : null;

      const status =
        String(
          req.query.status || ""
        )
          .trim()
          .toLowerCase() === "expired"
            ? "expired"
            : "";

      const mode =
        String(
          req.query.mode || ""
        )
          .trim()
          .toLowerCase();

      const contractOverview =
        mode === "contract-overview";

      const offset =
        (page - 1) * limit;

      const result =
        await pool.query(
          `
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

              TRUE
                AS dapat_diubah,

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

              proyek.nama_proyek,
              proyek.jenis_proyek,
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

            INNER JOIN public.proyek proyek
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

            timeline.proyek_id,
            timeline.proyek_sewa_id,
            timeline.proyek_sewa_produk_id,

            timeline.deskripsi,
            timeline.tanggal_mulai,
            timeline.tanggal_akhir,
            timeline.status,

            timeline.nama_proyek,
            timeline.jenis_proyek,
            timeline.sub_jenis_proyek,
            timeline.status_final,

            timeline.nomor_pr,
            timeline.no_do,
            timeline.item_produk,
            timeline.nama_cabang,
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
          `,
          [
            search,             // $1
            bulan,              // $2
            limit,              // $3
            offset,             // $4
            status,             // $5
            contractOverview,   // $6
            isAdmin,            // $7
            picId               // $8
          ]
        );

      const totalData =
        result.rows.length > 0
          ? Number(
              result.rows[0]
                .total_data
            )
          : 0;

      const data =
        result.rows.map(item => {
          const {
            total_data,
            ...timeline
          } = item;

          return timeline;
        });

      return res.json({
        data,

        pagination: {
          page,
          limit,

          total_data:
            totalData,

          total_pages:
            Math.max(
              Math.ceil(
                totalData / limit
              ),
              1
            )
        },

        filter: {
          search,
          bulan,
          status,
          mode
        }
      });

    } catch (error) {
      console.error(
        "ERROR GET TIMELINE LIST:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);

// ======================================================
// DETAIL PENDAPATAN
// Digunakan oleh halaman pendapatan.html
// API total pendapatan yang lama tidak diubah.
// ======================================================

app.get(
  "/api/pendapatan/detail",
  async (req, res) => {
    try {

      // ================================================
      // AMBIL SEMUA TERMIN KLIEN
      // ================================================

      const result =
        await pool.query(
          `
          SELECT
            t.id AS termin_id,

            p.id AS proyek_id,
            p.nama_proyek,
            p.jenis_proyek,
            p.sub_jenis_proyek,
            p.status_final,

            pk.id AS proyek_klien_id,
            pk.klien_id,

            d.perusahaan_klien
              AS nama_klien,

            pk.tanggal_mulai
              AS tanggal_mulai_kontrak,

            pk.tanggal_akhir
              AS tanggal_akhir_kontrak,

            pk.status_pengadaan,
            pk.status_teknis,
            pk.model_pembayaran,

            -- ==========================================
            -- NILAI KONTRAK KLIEN
            -- ==========================================

            COALESCE(
              NULLIF(
                pk.nilai_nego_3,
                0
              ),
              NULLIF(
                pk.nilai_nego_2,
                0
              ),
              NULLIF(
                pk.nilai_nego_1,
                0
              ),
              NULLIF(
                pk.nilai_submit,
                0
              ),
              0
            ) AS nilai_kontrak,

            -- ==========================================
            -- INFORMASI TERMIN
            -- ==========================================

            t.nama_termin,
            t.persentase,
            t.nominal,
            t.status_pembayaran,
            t.tanggal_jatuh_tempo,
            t.tanggal_bayar,
            t.created_at,

            -- ==========================================
            -- TANGGAL UNTUK FILTER PENDAPATAN
            --
            -- Sudah Dibayar:
            -- gunakan tanggal bayar
            --
            -- Belum Dibayar / Proses:
            -- gunakan tanggal jatuh tempo
            -- ==========================================

            CASE
              WHEN
                LOWER(
                  TRIM(
                    COALESCE(
                      t.status_pembayaran,
                      ''
                    )
                  )
                ) IN (
                  'dibayar',
                  'sudah dibayar',
                  'lunas',
                  'paid'
                )

              THEN
                COALESCE(
                  t.tanggal_bayar,
                  t.tanggal_jatuh_tempo,
                  t.created_at::date,
                  pk.tanggal_mulai
                )

              WHEN
                LOWER(
                  TRIM(
                    COALESCE(
                      t.status_pembayaran,
                      ''
                    )
                  )
                ) IN (
                  'belum dibayar',
                  'belum bayar',
                  'unpaid',
                  'proses',
                  'diproses',
                  'processing'
                )

              THEN
                COALESCE(
                  t.tanggal_jatuh_tempo,
                  t.created_at::date,
                  pk.tanggal_mulai
                )

              WHEN
                t.tanggal_bayar
                IS NOT NULL

              THEN
                t.tanggal_bayar

              ELSE
                COALESCE(
                  t.tanggal_jatuh_tempo,
                  t.created_at::date,
                  pk.tanggal_mulai
                )
            END AS tanggal_pendapatan,

            -- ==========================================
            -- NILAI PENDAPATAN / NILAI TERMIN
            --
            -- Gunakan nominal jika tersedia.
            -- Jika nominal kosong, hitung dari persentase.
            -- ==========================================

            COALESCE(
              NULLIF(
                t.nominal,
                0
              ),

              CASE
                WHEN
                  COALESCE(
                    t.persentase,
                    0
                  ) > 0

                THEN
                  COALESCE(
                    NULLIF(
                      pk.nilai_nego_3,
                      0
                    ),
                    NULLIF(
                      pk.nilai_nego_2,
                      0
                    ),
                    NULLIF(
                      pk.nilai_nego_1,
                      0
                    ),
                    NULLIF(
                      pk.nilai_submit,
                      0
                    ),
                    0
                  )
                  *
                  t.persentase
                  /
                  100

                ELSE 0
              END,

              0
            ) AS nilai_pendapatan,

            -- ==========================================
            -- KATEGORI PROYEK
            -- ==========================================

            COALESCE(
              kategori.kategori_pendapatan,
              'Tanpa Kategori'
            ) AS kategori_pendapatan

          FROM public.proyek_klien_termin t

          INNER JOIN public.proyek_klien pk
            ON pk.id =
              t.proyek_klien_id

          INNER JOIN public.proyek p
            ON p.id =
              pk.proyek_id

          LEFT JOIN public.data d
            ON d.id =
              pk.klien_id

          /*
           * Kategori menggunakan LATERAL agar
           * satu termin tetap menjadi satu baris
           * meskipun proyek memiliki banyak kategori.
           */

          LEFT JOIN LATERAL (
            SELECT
              STRING_AGG(
                DISTINCT
                kp.nama_kategori_produk,
                ', '
                ORDER BY
                kp.nama_kategori_produk
              ) AS kategori_pendapatan

            FROM public.proyek_kategori pkat

            INNER JOIN
              public.kategori_produk kp
                ON kp.id =
                  pkat.kategori_produk_id

            WHERE
              pkat.proyek_id =
                p.id
          ) kategori
            ON TRUE

          /*
           * Tidak menggunakan WHERE status pembayaran.
           *
           * Semua status dikirim:
           * - Sudah Dibayar
           * - Belum Dibayar
           * - Proses
           */

          ORDER BY
            CASE
              WHEN
                LOWER(
                  TRIM(
                    COALESCE(
                      t.status_pembayaran,
                      ''
                    )
                  )
                ) IN (
                  'dibayar',
                  'sudah dibayar',
                  'lunas',
                  'paid'
                )

              THEN
                COALESCE(
                  t.tanggal_bayar,
                  t.tanggal_jatuh_tempo,
                  t.created_at::date,
                  pk.tanggal_mulai
                )

              ELSE
                COALESCE(
                  t.tanggal_jatuh_tempo,
                  t.created_at::date,
                  pk.tanggal_mulai
                )
            END DESC NULLS LAST,

            p.nama_proyek ASC,
            t.id ASC
          `
        );

      const rows =
        result.rows;

      // ================================================
      // NORMALISASI STATUS PEMBAYARAN
      // ================================================

      const getStatusPembayaran =
        item => {
          const status =
            String(
              item.status_pembayaran ||
              ""
            )
              .trim()
              .replace(/\s+/g, " ")
              .toLowerCase();

          /*
           * Dahulukan status yang tersimpan
           * di database.
           */

          if (
            status ===
              "belum dibayar" ||
            status ===
              "belum bayar" ||
            status ===
              "unpaid"
          ) {
            return "Belum Dibayar";
          }

          if (
            status.includes(
              "proses"
            ) ||
            status === "diproses" ||
            status === "processing"
          ) {
            return "Proses";
          }

          if (
            status === "dibayar" ||
            status ===
              "sudah dibayar" ||
            status === "lunas" ||
            status === "paid"
          ) {
            return "Sudah Dibayar";
          }

          /*
           * Tanggal bayar digunakan sebagai
           * fallback jika status kosong.
           */

          if (item.tanggal_bayar) {
            return "Sudah Dibayar";
          }

          return "Belum Dibayar";
        };

      // ================================================
      // KELOMPOKKAN TERMIN
      // ================================================

      const terminDibayar =
        rows.filter(
          item =>
            getStatusPembayaran(
              item
            ) ===
              "Sudah Dibayar"
        );

      const terminBelumDibayar =
        rows.filter(
          item =>
            getStatusPembayaran(
              item
            ) ===
              "Belum Dibayar"
        );

      const terminProses =
        rows.filter(
          item =>
            getStatusPembayaran(
              item
            ) ===
              "Proses"
        );

      // ================================================
      // HITUNG TOTAL NOMINAL
      // ================================================

      const hitungTotal =
        data =>
          data.reduce(
            (
              total,
              item
            ) =>
              total +
              Number(
                item.nilai_pendapatan ||
                0
              ),
            0
          );

      // ================================================
      // JUMLAH PROYEK
      // ================================================

      const jumlahProyek =
        new Set(
          rows
            .map(
              item =>
                Number(
                  item.proyek_id
                )
            )
            .filter(
              value =>
                Number.isInteger(
                  value
                ) &&
                value > 0
            )
        ).size;

      // ================================================
      // RESPONSE
      // ================================================

      return res.json({
        pendapatan:
          rows,

        summary: {
          total_pendapatan:
            hitungTotal(
              terminDibayar
            ),

          total_belum_dibayar:
            hitungTotal(
              terminBelumDibayar
            ),

          total_proses:
            hitungTotal(
              terminProses
            ),

          jumlah_termin:
            rows.length,

          jumlah_termin_dibayar:
            terminDibayar.length,

          jumlah_termin_belum_dibayar:
            terminBelumDibayar.length,

          jumlah_termin_proses:
            terminProses.length,

          jumlah_proyek:
            jumlahProyek
        }
      });

    } catch (error) {
      console.error(
        "ERROR GET DETAIL PENDAPATAN:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// DETAIL PENDAPATAN - SEWA
app.get(
  "/api/pendapatan/sewa/detail",
  async (req, res) => {

    try {

      if (!req.session?.user) {
        return res.status(401).json({
          error: "Belum login"
        });
      }

      const result =
        await pool.query(
          `
          SELECT
            pembayaran.id
              AS termin_id,

            'SEWA'::text
              AS sumber_pendapatan,

            ps.id
              AS proyek_sewa_id,

            ps.nomor_pr,

            p.id
              AS proyek_id,

            p.nama_proyek,

            'Sewa'::text
              AS jenis_proyek,

            COALESCE(
              NULLIF(
                TRIM(
                  p.sub_jenis_proyek
                ),
                ''
              ),
              'Sewa'
            ) AS sub_jenis_proyek,

            klien.id
              AS proyek_klien_id,

            klien.klien_id,

            d.perusahaan_klien
              AS nama_klien,

            klien.tanggal_mulai
              AS tanggal_mulai_kontrak,

            klien.tanggal_akhir
              AS tanggal_akhir_kontrak,

            klien.status_pengadaan,
            klien.status_teknis,

            COALESCE(
              ps.total_nilai,
              0
            )::numeric
              AS nilai_kontrak,

            pembayaran.deskripsi
              AS nama_termin,

            NULL::numeric
              AS persentase,

            COALESCE(
              pembayaran.nominal,
              0
            )::numeric
              AS nominal,

            pembayaran.status_pembayaran,

            NULL::date
              AS tanggal_jatuh_tempo,

            pembayaran.tanggal_bayar,

            pembayaran.tanggal_bayar
              AS tanggal_pendapatan,

            COALESCE(
              pembayaran.nominal,
              0
            )::numeric
              AS nilai_pendapatan,

            p.nama_proyek
              AS kategori_pendapatan,

            pembayaran.syarat_pembayaran,
            pembayaran.created_at,
            pembayaran.updated_at

          FROM public.proyek_sewa_pembayaran
            pembayaran

          INNER JOIN public.proyek_sewa ps
            ON ps.id =
              pembayaran.proyek_sewa_id

          INNER JOIN public.proyek p
            ON p.id =
              ps.proyek_id

          /*
           * Mengambil data klien terbaru dari
           * proyek yang dipilih pada proyek sewa.
           */
          LEFT JOIN LATERAL (
            SELECT
              pk.id,
              pk.klien_id,
              pk.tanggal_mulai,
              pk.tanggal_akhir,
              pk.status_pengadaan,
              pk.status_teknis

            FROM public.proyek_klien pk

            WHERE pk.proyek_id =
              p.id

            ORDER BY
              pk.id DESC

            LIMIT 1
          ) klien
            ON TRUE

          LEFT JOIN public.data d
            ON d.id =
              klien.klien_id

          ORDER BY
            pembayaran.tanggal_bayar
              DESC NULLS LAST,

            pembayaran.created_at
              DESC,

            pembayaran.id
              DESC
          `
        );

      return res.json({
        pendapatan:
          result.rows
      });

    } catch (error) {

      console.error(
        "ERROR GET PENDAPATAN SEWA:",
        error
      );

      return res.status(500).json({
        error: error.message
      });

    }

  }
);
// ======================================================
// LAST UPDATE DETAIL PROYEK
// ======================================================

app.get(
  "/api/proyek/:proyekId/last-update",
  async (req, res) => {
    try {
      if (
        !req.session ||
        !req.session.user
      ) {
        return res.status(401).json({
          error:
            "Belum login."
        });
      }


      const proyekId =
        Number(
          req.params.proyekId
        );


      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID proyek tidak valid."
        });
      }


      const result =
        await pool.query(
          `
          SELECT
            MAX(riwayat.updated_at)
              AS last_update

          FROM (
            -- Data utama proyek
            SELECT
              COALESCE(
                p.updated_at,
                p.created_at
              ) AS updated_at

            FROM public.proyek p

            WHERE p.id = $1


            UNION ALL


            -- Data klien
            SELECT
              COALESCE(
                pk.updated_at,
                pk.created_at
              )

            FROM public.proyek_klien pk

            WHERE pk.proyek_id = $1


            UNION ALL


            -- Termin klien
            SELECT
              COALESCE(
                pkt.updated_at,
                pkt.created_at
              )

            FROM public.proyek_klien_termin pkt

            INNER JOIN public.proyek_klien pk
              ON pk.id =
                pkt.proyek_klien_id

            WHERE pk.proyek_id = $1


            UNION ALL


            -- Data partner
            SELECT
              COALESCE(
                pp.updated_at,
                pp.created_at
              )

            FROM public.proyek_partner pp

            WHERE pp.proyek_id = $1


            UNION ALL


            -- Termin partner
            SELECT
              COALESCE(
                ppt.updated_at,
                ppt.created_at
              )

            FROM public.proyek_partner_termin ppt

            INNER JOIN public.proyek_partner pp
              ON pp.id =
                ppt.proyek_partner_id

            WHERE pp.proyek_id = $1


            UNION ALL


            -- Timeline proyek
            SELECT
              COALESCE(
                pt.updated_at,
                pt.created_at
              )

            FROM public.proyek_timeline pt

            WHERE pt.proyek_id = $1

          ) riwayat
          `,
          [proyekId]
        );


      return res.json({
        last_update:
          result.rows[0]
            ?.last_update ||
          null
      });

    } catch (error) {
      console.error(
        "ERROR GET LAST UPDATE PROYEK:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ======================================================
// PROYEK BELUM DIUPDATE MINGGU BERJALAN
// Periode Senin - Minggu
// ======================================================
// ======================================================
// PROYEK BELUM DIUPDATE MINGGU BERJALAN
// ======================================================

app.get(
  "/api/proyek-belum-update",
  async (req, res) => {
    try {
      if (
        !req.session ||
        !req.session.user
      ) {
        return res.status(401).json({
          error:
            "Belum login."
        });
      }


      const user =
        req.session.user;


      const isAdmin =
        String(
          user.role || ""
        )
          .trim()
          .toLowerCase() ===
        "admin";


      const picId =
        Number(user.id);


      const page =
        Math.max(
          Number(req.query.page) || 1,
          1
        );


      const limit =
        Math.min(
          Math.max(
            Number(req.query.limit) || 15,
            1
          ),
          100
        );


      const search =
        String(
          req.query.search || ""
        ).trim();


      const offset =
        (page - 1) * limit;


      const result =
        await pool.query(
          `
          WITH periode AS (
            SELECT
              DATE_TRUNC(
                'week',
                CURRENT_DATE
              )::DATE
                AS tanggal_mulai,

              (
                DATE_TRUNC(
                  'week',
                  CURRENT_DATE
                )::DATE
                +
                INTERVAL '6 days'
              )::DATE
                AS tanggal_akhir
          ),

          proyek_dengan_update AS (
            SELECT
              p.id AS proyek_id,
              p.nama_proyek,
              p.jenis_proyek,
              p.sub_jenis_proyek,
              p.status_final,

              kategori.nama_kategori_produk,
              kategori.nama_kategori_produk_list,

              pic.nama_pic,
              pic.nama_pic_list,
              pic.pic_ids,

              update_terakhir.last_update

            FROM public.proyek p


            -- ==========================================
            -- KATEGORI
            -- ==========================================

            LEFT JOIN LATERAL (
              SELECT
                STRING_AGG(
                  DISTINCT kp.nama_kategori_produk,
                  ', '
                  ORDER BY kp.nama_kategori_produk
                ) AS nama_kategori_produk,

                ARRAY_AGG(
                  DISTINCT kp.nama_kategori_produk
                  ORDER BY kp.nama_kategori_produk
                ) AS nama_kategori_produk_list

              FROM public.proyek_kategori pkategori

              INNER JOIN public.kategori_produk kp
                ON kp.id =
                  pkategori.kategori_produk_id

              WHERE
                pkategori.proyek_id =
                  p.id
            ) kategori
              ON TRUE


            -- ==========================================
            -- PIC
            -- ==========================================

            LEFT JOIN LATERAL (
              SELECT
                STRING_AGG(
                  DISTINCT master_pic.nama,
                  ', '
                  ORDER BY master_pic.nama
                ) AS nama_pic,

                ARRAY_AGG(
                  DISTINCT master_pic.nama
                  ORDER BY master_pic.nama
                ) AS nama_pic_list,

                ARRAY_AGG(
                  DISTINCT master_pic.id
                  ORDER BY master_pic.id
                ) AS pic_ids

              FROM public.proyek_pic proyek_pic

              INNER JOIN public.pic master_pic
                ON master_pic.id =
                  proyek_pic.pic_id

              WHERE
                proyek_pic.proyek_id =
                  p.id
            ) pic
              ON TRUE


            -- ==========================================
            -- LAST UPDATE
            -- ==========================================

            LEFT JOIN LATERAL (
              SELECT
                MAX(riwayat.updated_at)
                  AS last_update

              FROM (
                SELECT
                  COALESCE(
                    p.updated_at,
                    p.created_at
                  ) AS updated_at


                UNION ALL


                SELECT
                  COALESCE(
                    pk.updated_at,
                    pk.created_at
                  )

                FROM public.proyek_klien pk

                WHERE
                  pk.proyek_id =
                    p.id


                UNION ALL


                SELECT
                  COALESCE(
                    pkt.updated_at,
                    pkt.created_at
                  )

                FROM public.proyek_klien_termin pkt

                INNER JOIN public.proyek_klien pk
                  ON pk.id =
                    pkt.proyek_klien_id

                WHERE
                  pk.proyek_id =
                    p.id


                UNION ALL


                SELECT
                  COALESCE(
                    pp.updated_at,
                    pp.created_at
                  )

                FROM public.proyek_partner pp

                WHERE
                  pp.proyek_id =
                    p.id


                UNION ALL


                SELECT
                  COALESCE(
                    ppt.updated_at,
                    ppt.created_at
                  )

                FROM public.proyek_partner_termin ppt

                INNER JOIN public.proyek_partner pp
                  ON pp.id =
                    ppt.proyek_partner_id

                WHERE
                  pp.proyek_id =
                    p.id


                UNION ALL


                SELECT
                  COALESCE(
                    pt.updated_at,
                    pt.created_at
                  )

                FROM public.proyek_timeline pt

                WHERE
                  pt.proyek_id =
                    p.id

              ) riwayat
            ) update_terakhir
              ON TRUE


            -- ==========================================
            -- AKSES ADMIN ATAU PIC
            -- ==========================================

            WHERE
              $1::BOOLEAN = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic akses_pic

                WHERE
                  akses_pic.proyek_id =
                    p.id

                  AND akses_pic.pic_id =
                    $2
              )
          ),

          proyek_terlambat_update AS (
            SELECT
              pdu.*,
              periode.tanggal_mulai,
              periode.tanggal_akhir,

              CASE
                WHEN pdu.last_update IS NULL
                  THEN NULL

                ELSE GREATEST(
                  CURRENT_DATE
                  -
                  pdu.last_update::DATE,
                  0
                )::INTEGER
              END
                AS tidak_diupdate_selama_hari

            FROM proyek_dengan_update pdu

            CROSS JOIN periode

            WHERE
              (
                pdu.last_update IS NULL

                OR pdu.last_update <
                  periode.tanggal_mulai
              )

              AND (
                $3 = ''

                OR pdu.nama_proyek
                  ILIKE '%' || $3 || '%'

                OR COALESCE(
                    pdu.jenis_proyek,
                    ''
                  )
                  ILIKE '%' || $3 || '%'

                OR COALESCE(
                    pdu.nama_kategori_produk,
                    ''
                  )
                  ILIKE '%' || $3 || '%'

                OR COALESCE(
                    pdu.nama_pic,
                    ''
                  )
                  ILIKE '%' || $3 || '%'

                OR COALESCE(
                    pdu.status_final,
                    ''
                  )
                  ILIKE '%' || $3 || '%'
              )
          )

          SELECT
            proyek_terlambat_update.*,

            COUNT(*) OVER()
              AS total_data

          FROM proyek_terlambat_update

          ORDER BY
            last_update ASC
              NULLS FIRST,

            nama_proyek ASC

          LIMIT $4
          OFFSET $5
          `,
          [
            isAdmin,
            picId,
            search,
            limit,
            offset
          ]
        );


      const totalData =
        result.rows.length > 0
          ? Number(
              result.rows[0]
                .total_data
            )
          : 0;


      const data =
        result.rows.map(item => {
          const {
            total_data,
            ...proyek
          } = item;


          return {
            ...proyek,

            proyek_id:
              Number(
                proyek.proyek_id
              ),

            tidak_diupdate_selama_hari:
              proyek
                .tidak_diupdate_selama_hari ===
                null
                ? null
                : Number(
                    proyek
                      .tidak_diupdate_selama_hari
                  )
          };
        });


      const periodeResult =
        await pool.query(
          `
          SELECT
            DATE_TRUNC(
              'week',
              CURRENT_DATE
            )::DATE
              AS tanggal_mulai,

            (
              DATE_TRUNC(
                'week',
                CURRENT_DATE
              )::DATE
              +
              INTERVAL '6 days'
            )::DATE
              AS tanggal_akhir
          `
        );


      return res.json({
        data,

        periode:
          periodeResult.rows[0],

        pagination: {
          page,
          limit,

          total_data:
            totalData,

          total_pages:
            Math.max(
              Math.ceil(
                totalData / limit
              ),
              1
            )
        }
      });

    } catch (error) {
      console.error(
        "ERROR GET PROYEK BELUM UPDATE:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ======================================================
// MASTER KPI
// ======================================================

function parseNominalKpi(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const text =
    String(value)
      .replace(/[^\d]/g, "");

  const number =
    Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
}

// ======================================================
// GET MASTER KPI
// ======================================================

app.get(
  "/api/master-kpi",
  async (req, res) => {
    try {
      if (
        !req.session ||
        !req.session.user
      ) {
        return res.status(401).json({
          error:
            "Belum login."
        });
      }


      const result =
        await pool.query(
          `
          SELECT
            mk.id,
            mk.jenis_proyek_id,
            mk.nilai_kpi,
            mk.tahun,
            mk.created_at,
            mk.updated_at

          FROM public.master_kpi mk

          ORDER BY
            mk.tahun DESC,
            mk.jenis_proyek_id ASC
          `
        );


      const data =
        result.rows.map(item => ({
          ...item,

          id:
            Number(item.id),

          jenis_proyek_id:
            Number(
              item.jenis_proyek_id
            ),

          nilai_kpi:
            Number(
              item.nilai_kpi ||
              0
            ),

          tahun:
            Number(item.tahun)
        }));


      return res.json(data);

    } catch (error) {
      console.error(
        "ERROR GET MASTER KPI:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ======================================================
// TAMBAH MASTER KPI
// ======================================================

app.post(
  "/api/master-kpi",
  async (req, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({
          error:
            "Belum login."
        });
      }


      const isAdmin =
        String(
          req.session.user.role || ""
        )
          .trim()
          .toLowerCase() ===
        "admin";


      if (!isAdmin) {
        return res.status(403).json({
          error:
            "Hanya admin yang dapat menambahkan KPI."
        });
      }


      const jenisProyekId =
        Number(
          req.body.jenis_proyek_id
        );


      const nilaiKpi =
        parseNominalKpi(
          req.body.nilai_kpi
        );


      const tahun =
        Number(req.body.tahun);


      if (
        !Number.isInteger(
          jenisProyekId
        ) ||
        jenisProyekId <= 0
      ) {
        return res.status(400).json({
          error:
            "Jenis proyek wajib dipilih."
        });
      }


      if (
        !Number.isFinite(nilaiKpi) ||
        nilaiKpi <= 0
      ) {
        return res.status(400).json({
          error:
            "Nilai KPI harus lebih dari 0."
        });
      }


      if (
        !Number.isInteger(tahun) ||
        tahun < 2000 ||
        tahun > 2100
      ) {
        return res.status(400).json({
          error:
            "Tahun KPI tidak valid."
        });
      }


      const result =
        await pool.query(
          `
          INSERT INTO public.master_kpi
          (
            jenis_proyek_id,
            nilai_kpi,
            tahun,
            created_at,
            updated_at
          )

          VALUES
          (
            $1,
            $2,
            $3,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          RETURNING *
          `,
          [
            jenisProyekId,
            nilaiKpi,
            tahun
          ]
        );


      return res
        .status(201)
        .json({
          message:
            "Master KPI berhasil ditambahkan.",

          data:
            result.rows[0]
        });

    } catch (error) {
      console.error(
        "ERROR TAMBAH MASTER KPI:",
        error
      );


      if (error.code === "23505") {
        return res.status(409).json({
          error:
            "KPI untuk jenis proyek dan tahun tersebut sudah tersedia."
        });
      }


      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);


// ======================================================
// EDIT MASTER KPI
// ======================================================

app.put(
  "/api/master-kpi/:id",
  async (req, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({
          error:
            "Belum login."
        });
      }


      const isAdmin =
        String(
          req.session.user.role || ""
        )
          .trim()
          .toLowerCase() ===
        "admin";


      if (!isAdmin) {
        return res.status(403).json({
          error:
            "Hanya admin yang dapat mengubah KPI."
        });
      }


      const id =
        Number(req.params.id);


      const jenisProyekId =
        Number(
          req.body.jenis_proyek_id
        );


      const nilaiKpi =
        parseNominalKpi(
          req.body.nilai_kpi
        );


      const tahun =
        Number(req.body.tahun);


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID KPI tidak valid."
        });
      }


      if (
        !Number.isInteger(
          jenisProyekId
        ) ||
        jenisProyekId <= 0
      ) {
        return res.status(400).json({
          error:
            "Jenis proyek wajib dipilih."
        });
      }


      if (
        !Number.isFinite(nilaiKpi) ||
        nilaiKpi <= 0
      ) {
        return res.status(400).json({
          error:
            "Nilai KPI harus lebih dari 0."
        });
      }


      if (
        !Number.isInteger(tahun) ||
        tahun < 2000 ||
        tahun > 2100
      ) {
        return res.status(400).json({
          error:
            "Tahun KPI tidak valid."
        });
      }


      const result =
        await pool.query(
          `
          UPDATE public.master_kpi

          SET
            jenis_proyek_id = $1,
            nilai_kpi = $2,
            tahun = $3,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $4

          RETURNING *
          `,
          [
            jenisProyekId,
            nilaiKpi,
            tahun,
            id
          ]
        );


      if (result.rows.length === 0) {
        return res.status(404).json({
          error:
            "Data KPI tidak ditemukan."
        });
      }


      return res.json({
        message:
          "Master KPI berhasil diperbarui.",

        data:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        "ERROR EDIT MASTER KPI:",
        error
      );


      if (error.code === "23505") {
        return res.status(409).json({
          error:
            "KPI untuk jenis proyek dan tahun tersebut sudah tersedia."
        });
      }


      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);


// ======================================================
// HAPUS MASTER KPI
// ======================================================

app.delete(
  "/api/master-kpi/:id",
  async (req, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({
          error:
            "Belum login."
        });
      }


      const isAdmin =
        String(
          req.session.user.role || ""
        )
          .trim()
          .toLowerCase() ===
        "admin";


      if (!isAdmin) {
        return res.status(403).json({
          error:
            "Hanya admin yang dapat menghapus KPI."
        });
      }


      const id =
        Number(req.params.id);


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID KPI tidak valid."
        });
      }


      const result =
        await pool.query(
          `
          DELETE FROM public.master_kpi

          WHERE id = $1

          RETURNING
            id,
            jenis_proyek_id,
            tahun
          `,
          [id]
        );


      if (result.rows.length === 0) {
        return res.status(404).json({
          error:
            "Data KPI tidak ditemukan."
        });
      }


      return res.json({
        message:
          "Master KPI berhasil dihapus."
      });

    } catch (error) {
      console.error(
        "ERROR HAPUS MASTER KPI:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ======================================================
// PROGRESS MODUL PROYEK
// GET  /api/proyek/:id/progress-modul
// POST /api/proyek/:id/progress-modul
// ======================================================

;(function registerProgressModulRoutes() {
  "use strict";

  // ====================================================
  // PERHITUNGAN DAN VALIDASI
  // ====================================================

  const Progress = (function () {
    const DAY = 86400000;

    function dateNumber(value) {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return null;
      }

      const [year, month, day] =
        value.split("-").map(Number);

      if (year < 1000 || year > 9999) {
        return null;
      }

      const time =
        Date.UTC(year, month - 1, day);

      const date =
        new Date(time);

      const valid =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;

      return valid ? time : null;
    }

    function difference(start, end) {
      const first = dateNumber(start);
      const last = dateNumber(end);

      if (first === null || last === null) {
        return null;
      }

      return (last - first) / DAY;
    }

    function duration(start, end) {
      const days = difference(start, end);

      return days === null || days < 0
        ? null
        : days;
    }

    function dateError(start, end) {
      if (start && dateNumber(start) === null) {
        return "Tanggal mulai tidak valid.";
      }

      if (end && dateNumber(end) === null) {
        return "Tanggal akhir tidak valid.";
      }

      if (end && !start) {
        return "Isi tanggal mulai sebelum tanggal akhir.";
      }

      if (
        start &&
        end &&
        difference(start, end) < 0
      ) {
        return "Tanggal akhir tidak boleh sebelum tanggal mulai.";
      }

      return "";
    }

    function rowStatus(row) {
      if (
        dateError(
          row.actualStart,
          row.actualEnd
        )
      ) {
        return "Tanggal tidak valid";
      }

      if (
        !row.actualStart &&
        !row.actualEnd
      ) {
        return "Not Yet";
      }

      return row.actualEnd
        ? "Done"
        : "In Progress";
    }

    // ==================================================
    // HITUNG HASIL PROGRESS
    // ==================================================

    function calculate(documentData) {
      const modules =
        (documentData.modules || []).map(group => ({
          ...group,

          items: group.items.map((item, index) => {
            const targetDuration =
              duration(
                item.targetStart,
                item.targetEnd
              );

            const actualDuration =
              duration(
                item.actualStart,
                item.actualEnd
              );

            const delayDays =
              Math.max(
                0,
                difference(
                  item.targetStart,
                  item.actualStart
                ) ?? 0
              );

            const excessDays =
              targetDuration !== null &&
              actualDuration !== null
                ? Math.max(
                    0,
                    actualDuration - targetDuration
                  )
                : 0;

            const notices = [];

            if (delayDays > 0) {
              notices.push(
                `Keterlambatan mulai pekerjaan ${delayDays} hari.`
              );
            }

            if (excessDays > 0) {
              notices.push(
                `Kelebihan durasi pekerjaan ${excessDays} hari.`
              );
            }

            return {
              ...item,
              subNo: `${group.no || "?"}.${index + 1}`,
              status: rowStatus(item),
              targetDuration,
              actualDuration,
              delayDays,
              excessDays,
              notices
            };
          })
        }));

      const items =
        modules.flatMap(group => group.items);

      const totalTargetDuration =
        items.reduce(
          (sum, row) =>
            sum + (row.targetDuration ?? 0),
          0
        );

      const totalActualDuration =
        items.reduce(
          (sum, row) =>
            sum + (row.actualDuration ?? 0),
          0
        );

      items.forEach(row => {
        row.targetWeight =
          totalTargetDuration > 0
            ? (
                (row.targetDuration ?? 0) /
                totalTargetDuration
              ) * 100
            : 0;

        row.actualWeight =
          totalActualDuration > 0
            ? (
                (row.actualDuration ?? 0) /
                totalActualDuration
              ) * 100
            : 0;
      });

      return {
        ...documentData,
        modules,

        summary: {
          moduleCount: modules.length,
          itemCount: items.length,

          completedCount:
            items.filter(
              row => row.status === "Done"
            ).length,

          totalTargetDuration,
          totalActualDuration,

          totalTargetWeight:
            totalTargetDuration > 0 ? 100 : 0,

          totalActualWeight:
            totalActualDuration > 0 ? 100 : 0
        }
      };
    }

    // ==================================================
    // VALIDASI INPUT
    // Hasil hitungan dari browser tidak dipercaya.
    // ==================================================

    function validateDocument(input) {
      function fail(message) {
        throw new Error(message);
      }

      if (
        !input ||
        typeof input !== "object"
      ) {
        fail("Data progress tidak valid.");
      }

      if (
        dateNumber(input.reportDate) === null
      ) {
        fail(
          "Tanggal laporan wajib diisi dengan tanggal yang valid."
        );
      }

      if (
        !Array.isArray(input.modules) ||
        input.modules.length > 100
      ) {
        fail("Maksimal 100 modul utama.");
      }

      const usedIds = new Set();
      const usedNumbers = new Set();

      let rowCount = 0;

      function text(
        value,
        label,
        max,
        required = false
      ) {
        if (typeof value !== "string") {
          fail(`${label} harus berupa teks.`);
        }

        const result = value.trim();

        if (required && !result) {
          fail(`${label} wajib diisi.`);
        }

        if (result.length > max) {
          fail(
            `${label} maksimal ${max} karakter.`
          );
        }

        return result;
      }

      function identity(value) {
        if (
          typeof value !== "string" ||
          !/^[a-zA-Z0-9_-]{1,64}$/.test(value) ||
          usedIds.has(value)
        ) {
          fail(
            "Identitas modul tidak valid atau duplikat."
          );
        }

        usedIds.add(value);

        return value;
      }

      const modules =
        input.modules.map(group => {
          if (
            !group ||
            typeof group !== "object"
          ) {
            fail("Modul utama tidak valid.");
          }

          if (
            !Number.isSafeInteger(group.no) ||
            group.no < 1 ||
            usedNumbers.has(group.no)
          ) {
            fail(
              "No modul utama harus bilangan bulat positif dan tidak boleh sama."
            );
          }

          usedNumbers.add(group.no);

          if (
            !Array.isArray(group.items) ||
            group.items.length === 0
          ) {
            fail(
              `Modul ${group.no} perlu minimal satu submodul.`
            );
          }

          rowCount += group.items.length;

          if (rowCount > 1000) {
            fail(
              "Maksimal 1.000 submodul dalam satu proyek."
            );
          }

          return {
            id: identity(group.id),
            no: group.no,

            module: text(
              group.module,
              `Nama modul ${group.no}`,
              300,
              true
            ),

            items: group.items.map((item, index) => {
              const label =
                `Submodul ${group.no}.${index + 1}`;

              if (
                !item ||
                typeof item !== "object"
              ) {
                fail(`${label} tidak valid.`);
              }

              if (
                !["klien", "mtm"].includes(item.pic)
              ) {
                fail(
                  `${label}: pilih PIC Klien atau MTM.`
                );
              }

              const row = {
                id: identity(item.id),

                module: text(
                  item.module,
                  `${label}: nama pekerjaan`,
                  300,
                  true
                ),

                pic: item.pic,

                notes: text(
                  item.notes ?? "",
                  `${label}: catatan`,
                  2000
                )
              };

              const dateFields = [
                "targetStart",
                "targetEnd",
                "actualStart",
                "actualEnd"
              ];

              for (const name of dateFields) {
                const value =
                  item[name] ?? "";

                if (
                  typeof value !== "string" ||
                  (
                    value &&
                    dateNumber(value) === null
                  )
                ) {
                  fail(
                    `${label}: tanggal tidak valid.`
                  );
                }

                row[name] = value;
              }

              const targetError =
                dateError(
                  row.targetStart,
                  row.targetEnd
                );

              const actualError =
                dateError(
                  row.actualStart,
                  row.actualEnd
                );

              if (targetError) {
                fail(
                  `${label} — Target: ${targetError}`
                );
              }

              if (actualError) {
                fail(
                  `${label} — Aktual: ${actualError}`
                );
              }

              return row;
            })
          };
        });

      return {
        schemaVersion: 1,
        reportDate: input.reportDate,
        modules
      };
    }

    return {
      calculate,
      validateDocument
    };
  })();

  // ====================================================
  // ERROR
  // ====================================================

  function error(message, statusCode) {
    return Object.assign(
      new Error(message),
      { statusCode }
    );
  }

  function sendError(res, caught) {
    const code =
      caught.statusCode || 500;

    if (code === 500) {
      console.error(
        "ERROR PROGRESS MODUL:",
        caught
      );
    }

    return res.status(code).json({
      error:
        code === 500
          ? "Gagal memproses progress proyek. Periksa log server."
          : caught.message
    });
  }

  // ====================================================
  // SESSION DAN IDENTITAS PENGGUNA
  // Sama dengan dashboard: user.id digunakan sebagai pic_id.
  // ====================================================

  function access(req) {
    if (!req.session?.user) {
      throw error(
        "Belum login.",
        401
      );
    }

    const user =
      req.session.user;

    const isAdmin =
      String(user.role || "")
        .trim()
        .toLowerCase() === "admin";

    const picId =
      Number(user.id);

    if (
      !isAdmin &&
      (
        !Number.isSafeInteger(picId) ||
        picId <= 0
      )
    ) {
      throw error(
        "Sesi pengguna tidak valid.",
        401
      );
    }

    const proyekId =
      Number(req.params.id);

    if (
      !Number.isSafeInteger(proyekId) ||
      proyekId <= 0
    ) {
      throw error(
        "ID proyek tidak valid.",
        400
      );
    }

    return {
      proyekId,
      isAdmin,

      picId:
        Number.isSafeInteger(picId)
          ? picId
          : null,

      userId:
        String(user.id)
    };
  }

  // ====================================================
  // QUERY DATA PROYEK DAN PROGRESS
  // ====================================================
const projectSql = `
  SELECT
    p.id,
    p.nama_proyek,

    klien.perusahaan_klien,
    klien.inisial_klien,

    progress.data_json AS dokumen,

    COALESCE(
      progress.version,
      0
    ) AS versi,

    progress.updated_at

  FROM public.proyek p


  -- ==================================================
  -- KLIEN PROYEK
  -- ==================================================

  LEFT JOIN LATERAL (

    SELECT
      d.perusahaan_klien,

      COALESCE(

        NULLIF(
          TRIM(
            to_jsonb(d)->>'inisial'
          ),
          ''
        ),

        NULLIF(
          TRIM(
            to_jsonb(d)->>'kode_klien'
          ),
          ''
        ),

        NULLIF(
          TRIM(
            to_jsonb(d)->>'kode'
          ),
          ''
        )

      ) AS inisial_klien

    FROM public.proyek_klien pk

    LEFT JOIN public.data d
      ON d.id = pk.klien_id

    WHERE
      pk.proyek_id = p.id

    ORDER BY
      pk.id DESC

    LIMIT 1

  ) klien
    ON TRUE


  -- ==================================================
  -- PROGRESS TERBARU
  -- ==================================================

  LEFT JOIN LATERAL (

    SELECT
      ppm.data_json,
      ppm.version,
      ppm.updated_at

    FROM public.proyek_progress_modul ppm

    WHERE
      ppm.project_id = p.id

    ORDER BY
      ppm.updated_at DESC NULLS LAST,
      ppm.id DESC

    LIMIT 1

  ) progress
    ON TRUE


  -- ==================================================
  -- FILTER PROYEK + HAK AKSES
  -- ==================================================

  WHERE
    p.id = $1

    AND (

      $2::BOOLEAN = TRUE

      OR EXISTS (

        SELECT 1

        FROM public.proyek_pic pp

        WHERE
          pp.proyek_id = p.id
          AND pp.pic_id = $3

      )

    )

  LIMIT 1
`;
  // ====================================================
  // GET PROGRESS
  // ====================================================

  app.get(
  "/api/proyek/:id/progress-modul",
  async (req, res) => {

    try {

      const context =
        access(req);


      const result =
        await pool.query(
          projectSql,
          [
            context.proyekId,
            context.isAdmin,
            context.picId
          ]
        );


      const row =
        result.rows[0];


      if (!row) {

        throw error(
          "Proyek tidak ditemukan atau tidak dapat diakses.",
          404
        );

      }


      const report =
        row.dokumen
          ? Progress.calculate(
              row.dokumen
            )
          : null;


      res.set(
        "Cache-Control",
        "no-store"
      );


      return res.json({

        proyek: {

          id:
            row.id,

          nama_proyek:
            row.nama_proyek,

          nama_klien:
            row.perusahaan_klien ||
            "-"

        },


        pic_options: [

          {
            value:
              "klien",

            label:
              row.inisial_klien ||
              "Klien (inisial belum tersedia)"
          },

          {
            value:
              "mtm",

            label:
              "MTM"
          }

        ],


        user_id:
          context.userId,


        version:
          Number(
            row.versi || 0
          ),


        updated_at:
          row.updated_at ||
          null,


        data:
          report

      });


    } catch (caught) {

      return sendError(
        res,
        caught
      );

    }

  }
);
  // ====================================================
  // POST PROGRESS
  // Menyimpan seluruh susunan modul dan submodul.
  // ====================================================

  app.post(
    "/api/proyek/:id/progress-modul",
    async (req, res) => {
      let client;

      let transactionStarted =
        false;

      try {
        const context =
          access(req);

        const version =
          req.body?.version;

        if (
          !Number.isSafeInteger(version) ||
          version < 0
        ) {
          throw error(
            "Versi data tidak valid. Muat ulang halaman.",
            400
          );
        }

        let documentData;

        try {
          documentData =
            Progress.validateDocument(
              req.body
            );

        } catch (caught) {
          throw error(
            caught.message,
            400
          );
        }

        client =
          await pool.connect();

        await client.query(
          "BEGIN"
        );

        transactionStarted =
          true;

        // ==============================================
        // CEK AKSES DAN KUNCI PROYEK
        // ==============================================

        const project =
          await client.query(
            `
            SELECT p.id

            FROM public.proyek p

            WHERE
              p.id = $1

              AND (
                $2::BOOLEAN

                OR EXISTS (
                  SELECT 1

                  FROM public.proyek_pic pp

                  WHERE
                    pp.proyek_id = p.id
                    AND pp.pic_id = $3
                )
              )

            FOR UPDATE OF p
            `,
            [
              context.proyekId,
              context.isAdmin,
              context.picId
            ]
          );

        if (
          project.rows.length === 0
        ) {
          throw error(
            "Proyek tidak ditemukan atau tidak dapat diakses.",
            404
          );
        }

        // ==============================================
        // CEK VERSI AGAR DATA TERBARU TIDAK TERTIMPA
        // ==============================================

        const current = await client.query(
  `
    SELECT id, version AS versi
    FROM public.proyek_progress_modul
    WHERE project_id = $1
    ORDER BY updated_at DESC NULLS LAST, id DESC
    LIMIT 1
  `,
  [context.proyekId]
);

const savedVersion = Number(
  current.rows[0]?.versi || 0
);

if (version !== savedVersion) {
  throw error(
    "Progress telah diubah. Muat ulang halaman sebelum menyimpan.",
    409
  );
}

const dokumenJson = JSON.stringify(documentData);
const versiBaru = savedVersion + 1;

const saved = current.rows.length
  ? await client.query(
      `
        UPDATE public.proyek_progress_modul
        SET data_json = $2::jsonb,
            version = $3,
            updated_by = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING version AS versi, updated_at
      `,
      [
        current.rows[0].id,
        dokumenJson,
        versiBaru,
        context.picId
      ]
    )
  : await client.query(
      `
        INSERT INTO public.proyek_progress_modul
          (project_id, data_json, version, created_by, updated_by)
        VALUES ($1, $2::jsonb, $3, $4, $4)
        RETURNING version AS versi, updated_at
      `,
      [
        context.proyekId,
        dokumenJson,
        versiBaru,
        context.picId
      ]
    );
        // ==============================================
        // PERBARUI LAST UPDATE PROYEK
        // ==============================================

        await client.query(
          `
          UPDATE public.proyek

          SET updated_at = CURRENT_TIMESTAMP

          WHERE id = $1
          `,
          [
            context.proyekId
          ]
        );

        await client.query(
          "COMMIT"
        );

        transactionStarted =
          false;

        res.set(
          "Cache-Control",
          "no-store"
        );

        return res.json({
          message:
            "Progress proyek berhasil disimpan.",

          version:
            Number(
              saved.rows[0].versi
            ),

          updated_at:
            saved.rows[0].updated_at,

          data:
            Progress.calculate(
              documentData
            )
        });

      } catch (caught) {
        if (
          transactionStarted &&
          client
        ) {
          try {
            await client.query(
              "ROLLBACK"
            );

          } catch (rollbackError) {
            console.error(
              "ERROR ROLLBACK PROGRESS:",
              rollbackError
            );
          }
        }

        return sendError(
          res,
          caught
        );

      } finally {
        if (client) {
          client.release();
        }
      }
    }
  );

})();

// =====================================================
// ---- BATAS API UNTUK DICONSUME SEWA
// =====================================================

// =====================================================
// API MASTER PRODUK SEWA
// =====================================================

const PRODUK_SEWA_API =
  "/api/master-produk-sewa";

const PRODUK_SEWA_FIELDS = `
  id,
  jenis_proyek,
  jenis_proyek_id,
  sub_jenis_proyek_id,
  item_produk,
  deskripsi,
  harga_jual_per_item::text
    AS harga_jual_per_item,
  harga_beli_per_item::text
    AS harga_beli_per_item,
  (
    harga_jual_per_item -
    harga_beli_per_item
  )::text AS margin_per_item
`;


function produkSewaIsAdmin(req) {

  return String(
    req.session?.user?.role || ""
  )
    .trim()
    .toLowerCase() === "admin";

}


function produkSewaRequireLogin(
  req,
  res,
  next
) {

  res.set(
    "Cache-Control",
    "no-store"
  );

  if (!req.session?.user) {

    return res.status(401).json({
      error: "Belum login."
    });

  }

  next();

}


function produkSewaRequireAdmin(
  req,
  res,
  next
) {

  if (!produkSewaIsAdmin(req)) {

    return res.status(403).json({
      error:
        "Hanya admin yang dapat mengubah Master Produk Sewa."
    });

  }

  next();

}


function produkSewaError(
  message,
  statusCode = 400
) {

  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;

}


function produkSewaValidId(value) {

  const text =
    String(value ?? "");

  return (
    /^[1-9]\d{0,18}$/.test(text) &&
    BigInt(text) <=
      9223372036854775807n
  );

}


function produkSewaNominal(
  value,
  label
) {

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {

    throw produkSewaError(
      `${label} wajib diisi.`
    );

  }


  if (
    typeof value === "number" &&
    !Number.isSafeInteger(value)
  ) {

    throw produkSewaError(
      `${label} harus berupa rupiah bulat.`
    );

  }


  const text =
    String(value).trim();


  if (
    !/^(0|[1-9]\d{0,17})$/.test(
      text
    )
  ) {

    throw produkSewaError(
      `${label} harus berupa angka bulat tanpa titik atau koma.`
    );

  }

  return text;

}


function validasiProdukSewa(
  body = {}
) {

  if (
    body.jenis_proyek !== undefined &&
    body.jenis_proyek !== "Sewa"
  ) {

    throw produkSewaError(
      "Jenis Proyek harus Sewa."
    );

  }


  if (
    !produkSewaValidId(
      body.sub_jenis_proyek_id
    )
  ) {

    throw produkSewaError(
      "Pilih Sub Jenis Proyek."
    );

  }


  if (
    typeof body.item_produk !==
    "string"
  ) {

    throw produkSewaError(
      "Item/Produk wajib diisi."
    );

  }


  const itemProduk =
    body.item_produk.trim();


  if (
    !itemProduk ||
    [...itemProduk].length > 200
  ) {

    throw produkSewaError(
      "Item/Produk wajib diisi, maksimal 200 karakter."
    );

  }


  const deskripsi =
    body.deskripsi === undefined
      ? ""
      : body.deskripsi;


  if (
    typeof deskripsi !== "string" ||
    [...deskripsi.trim()].length >
      1000
  ) {

    throw produkSewaError(
      "Deskripsi maksimal 1000 karakter."
    );

  }


  return {

    subJenisId: String(
      body.sub_jenis_proyek_id
    ),

    itemProduk,

    deskripsi:
      deskripsi.trim(),

    hargaJual:
      produkSewaNominal(
        body.harga_jual_per_item,
        "Harga Jual Per Item"
      ),

    hargaBeli:
      produkSewaNominal(
        body.harga_beli_per_item,
        "Harga Beli Per Item"
      )

  };

}


async function ambilSubJenisSewa(id) {

  const { rows } =
    await pool.query(
      `
        SELECT
          sub.id,
          sub.name,
          induk.id
            AS jenis_proyek_id
        FROM public.jenis_proyek sub
        JOIN public.jenis_proyek induk
          ON induk.id =
            sub.parent_id
        WHERE sub.id = $1
          AND induk.parent_id
            IS NULL
          AND LOWER(
            BTRIM(induk.name)
          ) = 'sewa'
          AND LOWER(
            BTRIM(induk.status)
          ) = 'aktif'
          AND LOWER(
            BTRIM(sub.status)
          ) = 'aktif'
      `,
      [id]
    );


  if (!rows.length) {

    throw produkSewaError(
      "Sub jenis tidak ditemukan, tidak aktif, atau bukan sub jenis Sewa."
    );

  }

  return rows[0];

}


function handleProdukSewaError(
  res,
  error
) {

  if (error.statusCode) {

    return res
      .status(error.statusCode)
      .json({
        error: error.message
      });

  }


  if (error.code === "23503") {

    return res.status(409).json({
      error:
        "Data masih digunakan atau master terkait sudah berubah."
    });

  }


  if (error.code === "23514") {

    return res.status(400).json({
      error:
        "Periksa sub jenis, nama produk, deskripsi, dan harga."
    });

  }


  if (error.code === "23505") {

    return res.status(409).json({
      error:
        "Data produk tersebut sudah tersedia."
    });

  }


  console.error(
    "ERROR MASTER PRODUK SEWA:",
    error
  );


  return res.status(500).json({
    error:
      "Gagal memproses Master Produk Sewa."
  });

}


// =====================================================
// GET OPTIONS PRODUK SEWA
// =====================================================

app.get(
  `${PRODUK_SEWA_API}/options`,
  produkSewaRequireLogin,
  async (req, res) => {

    try {

      const jenisResult =
        await pool.query(`
          SELECT
            id,
            name
          FROM public.jenis_proyek
          WHERE parent_id IS NULL
            AND LOWER(
              BTRIM(name)
            ) = 'sewa'
            AND LOWER(
              BTRIM(status)
            ) = 'aktif'
          ORDER BY id
        `);


      if (
        jenisResult.rows.length !== 1
      ) {

        throw produkSewaError(
          "Pastikan terdapat satu Jenis Proyek Sewa yang aktif.",
          409
        );

      }


      const jenisSewa =
        jenisResult.rows[0];


      const subResult =
        await pool.query(
          `
            SELECT
              id,
              name
            FROM public.jenis_proyek
            WHERE parent_id = $1
              AND LOWER(
                BTRIM(status)
              ) = 'aktif'
            ORDER BY
              name ASC,
              id ASC
          `,
          [jenisSewa.id]
        );


      return res.json({

        jenis_proyek: {
          id: jenisSewa.id,
          name: "Sewa"
        },

        sub_jenis:
          subResult.rows,

        can_manage:
          produkSewaIsAdmin(req)

      });

    } catch (error) {

      return handleProdukSewaError(
        res,
        error
      );

    }

  }
);


// =====================================================
// GET DAFTAR PRODUK SEWA
// =====================================================

app.get(
  PRODUK_SEWA_API,
  produkSewaRequireLogin,
  async (req, res) => {

    try {

      const { rows } =
        await pool.query(`
          SELECT
            produk.id,
            produk.jenis_proyek,
            produk.jenis_proyek_id,
            produk.sub_jenis_proyek_id,

            sub.name
              AS sub_jenis_proyek,

            produk.item_produk,
            produk.deskripsi,

            produk.harga_jual_per_item::text
              AS harga_jual_per_item,

            produk.harga_beli_per_item::text
              AS harga_beli_per_item,

            (
              produk.harga_jual_per_item -
              produk.harga_beli_per_item
            )::text
              AS margin_per_item

          FROM public.master_produk_sewa produk

          JOIN public.jenis_proyek sub
            ON sub.id =
              produk.sub_jenis_proyek_id

          ORDER BY
            produk.item_produk ASC,
            produk.id DESC
        `);


      return res.json(rows);

    } catch (error) {

      return handleProdukSewaError(
        res,
        error
      );

    }

  }
);


// =====================================================
// POST TAMBAH PRODUK SEWA
// =====================================================

app.post(
  PRODUK_SEWA_API,
  produkSewaRequireLogin,
  produkSewaRequireAdmin,
  async (req, res) => {

    try {

      const data =
        validasiProdukSewa(
          req.body || {}
        );


      const subJenis =
        await ambilSubJenisSewa(
          data.subJenisId
        );


      const { rows } =
        await pool.query(
          `
            INSERT INTO
              public.master_produk_sewa
            (
              jenis_proyek,
              jenis_proyek_id,
              sub_jenis_proyek_id,
              item_produk,
              deskripsi,
              harga_jual_per_item,
              harga_beli_per_item
            )
            VALUES
            (
              'Sewa',
              $1,
              $2,
              $3,
              $4,
              $5,
              $6
            )
            RETURNING
              ${PRODUK_SEWA_FIELDS}
          `,
          [
            subJenis.jenis_proyek_id,
            data.subJenisId,
            data.itemProduk,
            data.deskripsi,
            data.hargaJual,
            data.hargaBeli
          ]
        );


      return res
        .status(201)
        .json({

          ...rows[0],

          sub_jenis_proyek:
            subJenis.name

        });

    } catch (error) {

      return handleProdukSewaError(
        res,
        error
      );

    }

  }
);


// =====================================================
// PUT EDIT PRODUK SEWA
// =====================================================

app.put(
  `${PRODUK_SEWA_API}/:id`,
  produkSewaRequireLogin,
  produkSewaRequireAdmin,
  async (req, res) => {

    try {

      if (
        !produkSewaValidId(
          req.params.id
        )
      ) {

        throw produkSewaError(
          "ID produk tidak valid."
        );

      }


      const data =
        validasiProdukSewa(
          req.body || {}
        );


      const subJenis =
        await ambilSubJenisSewa(
          data.subJenisId
        );


      const { rows } =
        await pool.query(
          `
            UPDATE
              public.master_produk_sewa
            SET
              jenis_proyek =
                'Sewa',

              jenis_proyek_id =
                $1,

              sub_jenis_proyek_id =
                $2,

              item_produk =
                $3,

              deskripsi =
                $4,

              harga_jual_per_item =
                $5,

              harga_beli_per_item =
                $6,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE id = $7

            RETURNING
              ${PRODUK_SEWA_FIELDS}
          `,
          [
            subJenis.jenis_proyek_id,
            data.subJenisId,
            data.itemProduk,
            data.deskripsi,
            data.hargaJual,
            data.hargaBeli,
            req.params.id
          ]
        );


      if (!rows.length) {

        throw produkSewaError(
          "Produk tidak ditemukan.",
          404
        );

      }


      return res.json({

        ...rows[0],

        sub_jenis_proyek:
          subJenis.name

      });

    } catch (error) {

      return handleProdukSewaError(
        res,
        error
      );

    }

  }
);


// =====================================================
// DELETE PRODUK SEWA
// =====================================================

app.delete(
  `${PRODUK_SEWA_API}/:id`,
  produkSewaRequireLogin,
  produkSewaRequireAdmin,
  async (req, res) => {

    try {

      if (
        !produkSewaValidId(
          req.params.id
        )
      ) {

        throw produkSewaError(
          "ID produk tidak valid."
        );

      }


      const result =
        await pool.query(
          `
            DELETE FROM
              public.master_produk_sewa
            WHERE id = $1
          `,
          [req.params.id]
        );


      if (!result.rowCount) {

        throw produkSewaError(
          "Produk tidak ditemukan.",
          404
        );

      }


      return res.json({
        success: true
      });

    } catch (error) {

      return handleProdukSewaError(
        res,
        error
      );

    }

  }
);

console.log(
  "API Master Produk Sewa aktif"
);

// =====================================================
// MASTER DATA - PROYEK SEWA
// =====================================================


// =====================================================
// 1. GET MASTER KLIEN
// =====================================================

app.get(
  "/api/proyek-sewa/master/klien",
  async (req, res) => {

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login"
      });

    }

    try {

      const { rows } =
        await pool.query(`
          SELECT
            id,
            perusahaan_klien,
            inisial,
            nama_pic,
            no_pic,
            email_pic
          FROM public.data
          ORDER BY perusahaan_klien ASC
        `);

      res.json(rows);

    } catch (error) {

      console.error(
        "ERROR GET MASTER KLIEN PROYEK SEWA:",
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// =====================================================
// 2. GET MASTER PROYEK
// =====================================================

// =====================================================
// MASTER PROYEK SEWA
// HANYA JENIS PROYEK = SEWA
// TETAP FILTER BERDASARKAN ADMIN / PIC
// =====================================================

app.get(
  "/api/proyek-sewa/master/proyek",
  async (req, res) => {

    // ================================================
    // VALIDASI LOGIN
    // ================================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    // ================================================
    // DATA USER
    // ================================================

    const user =
      req.session.user;

    const isAdmin =
      String(
        user.role || ""
      )
        .trim()
        .toLowerCase() ===
      "admin";

    const picId =
      Number(user.id);

    try {

      // ================================================
      // AMBIL PROYEK JENIS SEWA
      // ================================================

      const { rows } =
        await pool.query(
          `
          SELECT
            p.id,
            p.nama_proyek,
            p.jenis_proyek,
            p.sub_jenis_proyek,
            p.status_final,

            /*
             * Ambil klien terakhir dari proyek.
             */

            (
              SELECT
                pk.klien_id

              FROM public.proyek_klien pk

              WHERE
                pk.proyek_id =
                  p.id

              ORDER BY
                pk.id DESC

              LIMIT 1
            ) AS klien_id,

            /*
             * Ambil nama klien terakhir.
             */

            (
              SELECT
                d.perusahaan_klien

              FROM public.proyek_klien pk

              LEFT JOIN public.data d
                ON d.id =
                  pk.klien_id

              WHERE
                pk.proyek_id =
                  p.id

              ORDER BY
                pk.id DESC

              LIMIT 1
            ) AS nama_klien

          FROM public.proyek p

          WHERE
            /*
             * Hanya proyek dengan jenis Sewa.
             */

            LOWER(
              TRIM(
                COALESCE(
                  p.jenis_proyek,
                  ''
                )
              )
            ) = 'sewa'

            AND

            /*
             * Admin dapat melihat semua proyek Sewa.
             * PIC hanya dapat melihat proyek yang
             * ditugaskan kepadanya.
             */

            (
              $1::boolean = TRUE

              OR

              EXISTS (
                SELECT 1

                FROM public.proyek_pic pp

                WHERE
                  pp.proyek_id =
                    p.id

                  AND

                  pp.pic_id =
                    $2
              )
            )

          ORDER BY
            p.nama_proyek ASC,
            p.id DESC
          `,
          [
            isAdmin,
            picId
          ]
        );

      // ================================================
      // RESPONSE
      // ================================================

      return res.json(rows);

    } catch (error) {
      console.error(
        "ERROR GET MASTER PROYEK UNTUK SEWA:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });
    }
  }
);


// =====================================================
// 3. GET MASTER PRODUK SEWA
// =====================================================

app.get(
  "/api/proyek-sewa/master/produk",
  async (req, res) => {

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login"
      });

    }

    try {

      const { rows } =
        await pool.query(`
          SELECT
            mps.id,

            mps.item_produk,

            mps.harga_jual_per_item,

            mps.jenis_proyek_id,

            jp.name
              AS jenis_proyek,

            mps.sub_jenis_proyek_id,

            sjp.name
              AS sub_jenis_proyek,

            mps.deskripsi

          FROM public.master_produk_sewa mps

          LEFT JOIN public.jenis_proyek jp
            ON jp.id = mps.jenis_proyek_id

          LEFT JOIN public.jenis_proyek sjp
            ON sjp.id = mps.sub_jenis_proyek_id

          ORDER BY
            mps.item_produk ASC
        `);

      res.json(rows);

    } catch (error) {

      console.error(
        "ERROR GET MASTER PRODUK SEWA:",
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);


// =====================================================
// 4. GET MASTER CABANG
// =====================================================

app.get(
  "/api/proyek-sewa/master/cabang",
  async (req, res) => {

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login"
      });

    }

    try {

      const { rows } =
        await pool.query(`
          SELECT
            *
          FROM public.master_cabang
          ORDER BY id ASC
        `);

      res.json(rows);

    } catch (error) {

      console.error(
        "ERROR GET MASTER CABANG PROYEK SEWA:",
        error
      );

      res.status(500).json({
        error: error.message
      });

    }

  }
);

// =====================================================
// PARTNER BERDASARKAN PROYEK/KONTRAK TERPILIH
// =====================================================

app.get(
  "/api/proyek-sewa/master/proyek/:proyekId/partners",
  async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    try {
      const proyekId =
        Number(req.params.proyekId);

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {
        return res.status(400).json({
          error: "ID proyek tidak valid"
        });
      }

      const result =
        await pool.query(
          `
          SELECT
            pp.id AS proyek_partner_id,
            pp.partner_id,

            partner.nama_partner,

            COALESCE(
              NULLIF(pp.nilai_nego_3, 0),
              NULLIF(pp.nilai_nego_2, 0),
              NULLIF(pp.nilai_nego_1, 0),
              NULLIF(pp.nilai_submit, 0),
              0
            )::numeric
              AS nilai_final_partner,

            pp.tanggal_mulai,
            pp.tanggal_akhir,
            pp.status_pengadaan,
            pp.status_teknis

          FROM public.proyek_partner pp

          INNER JOIN public.partner partner
            ON partner.id =
               pp.partner_id

          WHERE pp.proyek_id = $1

          ORDER BY
            partner.nama_partner ASC,
            pp.id ASC
          `,
          [proyekId]
        );

      return res.json(result.rows);

    } catch (error) {
      console.error(
        "ERROR GET PARTNER PROYEK SEWA:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);
async function tentukanPartnerProyekSewa(
  client,
  proyekId,
  proyekPartnerId
) {
  if (
    !Number.isInteger(Number(proyekId)) ||
    Number(proyekId) <= 0
  ) {
    return null;
  }

  const result =
    await client.query(
      `
      SELECT
        pp.id AS proyek_partner_id

      FROM public.proyek_partner pp

      WHERE pp.proyek_id = $1

      ORDER BY pp.id ASC
      `,
      [Number(proyekId)]
    );

  // Tidak ada partner pada kontrak
  if (result.rows.length === 0) {
    return null;
  }

  // Hanya satu partner: otomatis dipilih
  if (
    result.rows.length === 1 &&
    !proyekPartnerId
  ) {
    return Number(
      result.rows[0]
        .proyek_partner_id
    );
  }

  const partnerDipilih =
    Number(proyekPartnerId);

  const partnerValid =
    result.rows.some(
      item =>
        Number(
          item.proyek_partner_id
        ) === partnerDipilih
    );

  if (!partnerValid) {
    throw new Error(
      result.rows.length > 1
        ? "Pilih partner berdasarkan kontrak yang dipilih."
        : "Partner tidak sesuai dengan kontrak yang dipilih."
    );
  }

  return partnerDipilih;
}
// =====================================================
// POST PROYEK SEWA
// =====================================================

app.post(
  "/api/proyek-sewa",
  async (req, res) => {

    // =================================================
    // CEK LOGIN
    // =================================================

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login"
      });

    }


    const client =
      await pool.connect();


    try {

      // =================================================
      // AMBIL PAYLOAD
      // =================================================

     const {
        nomor_pr,
        tanggal_pr,
        proyek_id,
        proyek_partner_id,
        klien_id,
        produk,
        pembayaran
      } = req.body;

      // =================================================
      // VALIDASI HEADER
      // =================================================

      if (
        !nomor_pr ||
        !String(nomor_pr).trim()
      ) {

        return res.status(400).json({
          error: "Nomor PR wajib diisi."
        });

      }


      if (!klien_id) {

        return res.status(400).json({
          error: "Klien wajib dipilih."
        });

      }


      if (
        !Array.isArray(produk) ||
        produk.length === 0
      ) {

        return res.status(400).json({
          error:
            "Minimal harus ada 1 produk."
        });

      }


      // =================================================
      // MULAI TRANSACTION
      // =================================================

      await client.query(
        "BEGIN"
      );

    const proyekPartnerIdSimpan =
      await tentukanPartnerProyekSewa(
        client,
        proyek_id,
        proyek_partner_id
      );
      // =================================================
      // CEK KLIEN
      // =================================================

      const klienResult =
        await client.query(
          `
            SELECT id
            FROM public.data
            WHERE id = $1
            LIMIT 1
          `,
          [
            Number(klien_id)
          ]
        );


      if (
        klienResult.rowCount === 0
      ) {

        throw new Error(
          "Klien tidak ditemukan."
        );

      }


      // =================================================
      // CEK PROYEK EXISTING
      // =================================================

      if (proyek_id) {

        const proyekResult =
          await client.query(
            `
              SELECT id
              FROM public.proyek
              WHERE id = $1
              LIMIT 1
            `,
            [
              Number(proyek_id)
            ]
          );


        if (
          proyekResult.rowCount === 0
        ) {

          throw new Error(
            "Proyek yang dipilih tidak ditemukan."
          );

        }

      }


      // =================================================
      // CEK NOMOR PR DUPLIKAT
      // =================================================

      const nomorPrResult =
        await client.query(
          `
            SELECT id
            FROM public.proyek_sewa

            WHERE LOWER(
              BTRIM(nomor_pr)
            ) =
            LOWER(
              BTRIM($1)
            )

            LIMIT 1
          `,
          [
            String(nomor_pr)
          ]
        );


      if (
        nomorPrResult.rowCount > 0
      ) {

        throw new Error(
          "Nomor PR sudah digunakan."
        );

      }


      // =================================================
      // HELPER HITUNG END DATE
      //
      // Tanggal DO + durasi bulan
      // Contoh:
      // 2026-09-25 + 12 bulan
      // = 2027-09-25
      //
      // 2026-01-31 + 1 bulan
      // = 2026-02-28
      // =================================================

      function hitungEndDate(
        tanggalDO,
        durasiBulan
      ) {

        if (
          !tanggalDO ||
          !durasiBulan
        ) {

          return null;

        }


        const parts =
          String(tanggalDO)
            .split("-")
            .map(Number);


        if (
          parts.length !== 3
        ) {

          return null;

        }


        const [
          year,
          month,
          day
        ] = parts;


        if (
          !year ||
          !month ||
          !day
        ) {

          return null;

        }


        /*
          Gunakan tanggal 1 terlebih dahulu.

          Ini mencegah JavaScript lompat bulan
          pada tanggal seperti 31 Januari.
        */

        const result =
          new Date(
            year,
            month - 1,
            1
          );


        result.setMonth(
          result.getMonth() +
          Number(durasiBulan)
        );


        // Hari terakhir bulan tujuan

        const lastDay =
          new Date(
            result.getFullYear(),
            result.getMonth() + 1,
            0
          ).getDate();


        result.setDate(
          Math.min(
            day,
            lastDay
          )
        );


        const yyyy =
          result.getFullYear();


        const mm =
          String(
            result.getMonth() + 1
          ).padStart(
            2,
            "0"
          );


        const dd =
          String(
            result.getDate()
          ).padStart(
            2,
            "0"
          );


        return `${yyyy}-${mm}-${dd}`;

      }


      // =================================================
      // TOTAL
      // =================================================

      let totalNilaiPerBulan = 0;

      let totalNilai = 0;


      const produkValid = [];


      // Untuk membuat nomor_rujukan

      const semuaNoReqKlien = [];


      // =================================================
      // LOOP PRODUK
      // =================================================

      for (
        let i = 0;
        i < produk.length;
        i++
      ) {

        const item =
          produk[i];


        // ===============================================
        // VALIDASI PRODUK
        // ===============================================

        if (!item.produk_id) {

          throw new Error(
            `Produk ${i + 1} belum dipilih.`
          );

        }


        const durasi =
          Number(
            item.durasi_bulan
          );


        if (
          !Number.isInteger(durasi) ||
          durasi <= 0
        ) {

          throw new Error(
            `Durasi Produk ${i + 1} tidak valid.`
          );

        }


        if (
          !Array.isArray(
            item.orders
          ) ||
          item.orders.length === 0
        ) {

          throw new Error(
            `Produk ${i + 1} belum memiliki order.`
          );

        }


        // ===============================================
        // AMBIL MASTER PRODUK
        // ===============================================

        const masterResult =
          await client.query(
            `
              SELECT

                mps.id,

                mps.item_produk,

                mps.harga_jual_per_item,

                mps.jenis_proyek_id,

                mps.sub_jenis_proyek_id,

                jp.name
                  AS jenis_proyek,

                sjp.name
                  AS sub_jenis_proyek

              FROM public.master_produk_sewa mps

              LEFT JOIN public.jenis_proyek jp
                ON jp.id =
                   mps.jenis_proyek_id

              LEFT JOIN public.jenis_proyek sjp
                ON sjp.id =
                   mps.sub_jenis_proyek_id

              WHERE mps.id = $1

              LIMIT 1
            `,
            [
              Number(
                item.produk_id
              )
            ]
          );


        if (
          masterResult.rowCount === 0
        ) {

          throw new Error(
            `Master Produk ${i + 1} tidak ditemukan.`
          );

        }


        const master =
          masterResult.rows[0];


        // ===============================================
        // HARGA HARUS DARI MASTER
        // ===============================================

        const hargaPerItem =
          Number(
            master.harga_jual_per_item ||
            0
          );


        if (
          !Number.isFinite(
            hargaPerItem
          ) ||
          hargaPerItem < 0
        ) {

          throw new Error(
            `Harga Produk ${master.item_produk} tidak valid.`
          );

        }


        const ordersValid = [];


        // ===============================================
        // LOOP ORDER
        // ===============================================

        for (
          let j = 0;
          j < item.orders.length;
          j++
        ) {

          const order =
            item.orders[j];


          // =============================================
          // LOKASI
          // =============================================

          if (!order.cabang_id) {

            throw new Error(
              `Lokasi Order ${j + 1} pada Produk ${i + 1} belum dipilih.`
            );

          }


          // =============================================
          // QUANTITY
          // =============================================

          const quantity =
            Number(
              order.quantity
            );


          if (
            !Number.isInteger(
              quantity
            ) ||
            quantity <= 0
          ) {

            throw new Error(
              `Quantity Order ${j + 1} pada Produk ${i + 1} tidak valid.`
            );

          }


          // =============================================
          // CEK CABANG
          // =============================================

          const cabangResult =
            await client.query(
              `
                SELECT id
                FROM public.master_cabang

                WHERE id = $1

                LIMIT 1
              `,
              [
                Number(
                  order.cabang_id
                )
              ]
            );


          if (
            cabangResult.rowCount === 0
          ) {

            throw new Error(
              `Lokasi Order ${j + 1} tidak ditemukan.`
            );

          }


          // =============================================
          // DATA TAMBAHAN ORDER
          //
          // SEMUA NON MANDATORY
          // =============================================

          const noReqKlien =
            order.no_req_klien
              ? String(
                  order.no_req_klien
                ).trim()
              : null;


          const tanggalReqKlien =
            order.tanggal_req_klien ||
            null;


          const tanggalDO =
            order.tanggal_do ||
            null;


          const noDO =
            order.no_do
              ? String(
                  order.no_do
                ).trim()
              : null;


          // =============================================
          // KUMPULKAN NO REQ
          // =============================================

          if (noReqKlien) {

            semuaNoReqKlien.push(
              noReqKlien
            );

          }


          // =============================================
          // HITUNG END DATE SERVER
          // =============================================

          const endDate =
            tanggalDO
              ? hitungEndDate(
                  tanggalDO,
                  durasi
                )
              : null;


          // =============================================
          // PERHITUNGAN HARGA SERVER
          // =============================================

          const hargaPerBulan =
            quantity *
            hargaPerItem;


          const totalHarga =
            hargaPerBulan *
            durasi;


          totalNilaiPerBulan +=
            hargaPerBulan;


          totalNilai +=
            totalHarga;


          // =============================================
          // ORDER VALID
          // =============================================

          ordersValid.push({

            cabang_id:
              Number(
                order.cabang_id
              ),

            quantity,

            harga_per_bulan:
              hargaPerBulan,

            total_harga:
              totalHarga,

            no_req_klien:
              noReqKlien,

            tanggal_req_klien:
              tanggalReqKlien,

            tanggal_do:
              tanggalDO,

            no_do:
              noDO,

            end_date:
              endDate

          });

        }


        // ===============================================
        // PRODUK VALID
        // ===============================================

        produkValid.push({

          produk_id:
            Number(
              master.id
            ),

          harga_per_item:
            hargaPerItem,

          jenis_proyek:
            master.jenis_proyek ||
            "Sewa",

          sub_jenis_proyek:
            master.sub_jenis_proyek ||
            null,

          durasi_bulan:
            durasi,

          orders:
            ordersValid

        });

      }


      // =================================================
      // BUAT RUJUKAN KONTRAK
      //
      // Hapus duplikat lalu gabungkan koma.
      //
      // REQ-001, REQ-002, REQ-003
      // =================================================

      const nomorRujukan =
        [
          ...new Set(
            semuaNoReqKlien
          )
        ]
          .filter(Boolean)
          .join(", ");


      // Jika semua No Req kosong,
      // nomor_rujukan = NULL

      const nomorRujukanFinal =
        nomorRujukan ||
        null;


      // =================================================
      // INSERT HEADER PROYEK SEWA
      // =================================================

   // =================================================
// INSERT HEADER PROYEK SEWA
// =================================================

const proyekSewaResult =
  await client.query(
    `
      INSERT INTO public.proyek_sewa (
        nomor_pr,
        tanggal_pr,
        nomor_rujukan,
        proyek_id,
        proyek_partner_id,
        klien_id,
        total_nilai_per_bulan,
        total_nilai,
        created_at,
        updated_at
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )

      RETURNING *
    `,
    [
      // $1 = nomor_pr
      String(
        nomor_pr
      ).trim(),

      // $2 = tanggal_pr
      tanggal_pr ||
        null,

      // $3 = nomor_rujukan
      nomorRujukanFinal,

      // $4 = proyek_id
      proyek_id
        ? Number(
            proyek_id
          )
        : null,

      // $5 = proyek_partner_id
      proyekPartnerIdSimpan,

      // $6 = klien_id
      Number(
        klien_id
      ),

      // $7 = total_nilai_per_bulan
      totalNilaiPerBulan,

      // $8 = total_nilai
      totalNilai
    ]
  );

      const proyekSewa =
        proyekSewaResult.rows[0];


      // =================================================
      // INSERT PRODUK
      // =================================================

      for (
        const item
        of produkValid
      ) {

        const produkResult =
          await client.query(
            `
              INSERT INTO public.proyek_sewa_produk (

                proyek_sewa_id,

                produk_id,

                harga_per_item,

                jenis_proyek,

                sub_jenis_proyek,

                durasi_bulan,

                created_at,

                updated_at

              )

              VALUES (

                $1,
                $2,
                $3,
                $4,
                $5,
                $6,

                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP

              )

              RETURNING id
            `,
            [

              proyekSewa.id,

              item.produk_id,

              item.harga_per_item,

              item.jenis_proyek,

              item.sub_jenis_proyek,

              item.durasi_bulan

            ]
          );


        const proyekSewaProdukId =
          produkResult.rows[0].id;


        // ===============================================
        // INSERT ORDER
        // ===============================================

        for (
          const order
          of item.orders
        ) {

          await client.query(
            `
              INSERT INTO public.proyek_sewa_order (

                proyek_sewa_produk_id,

                cabang_id,

                quantity,

                harga_per_bulan,

                total_harga,

                no_req_klien,

                tanggal_req_klien,

                tanggal_do,

                no_do,

                end_date,

                created_at,

                updated_at

              )

              VALUES (

                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,

                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP

              )
            `,
            [

              proyekSewaProdukId,

              order.cabang_id,

              order.quantity,

              order.harga_per_bulan,

              order.total_harga,

              order.no_req_klien,

              order.tanggal_req_klien,

              order.tanggal_do,

              order.no_do,

              order.end_date

            ]
          );

        }

      }


// =================================================
// INSERT PEMBAYARAN
// =================================================

if (
  Array.isArray(pembayaran)
) {
  const statusValid = [
    "Belum Dibayar",
    "Proses",
    "Sudah Dibayar"
  ];

  for (
    let i = 0;
    i < pembayaran.length;
    i += 1
  ) {
    const bayar =
      pembayaran[i] || {};

    const deskripsi =
      String(
        bayar.deskripsi || ""
      ).trim();

    const nominal =
      bayar.nominal === null ||
      bayar.nominal === undefined ||
      bayar.nominal === ""
        ? 0
        : Number(bayar.nominal);

    const tanggalBayarInput =
      bayar.tanggal_bayar
        ? String(
            bayar.tanggal_bayar
          )
            .trim()
            .slice(0, 10)
        : null;

    const syaratPembayaran =
      String(
        bayar.syarat_pembayaran ||
        ""
      ).trim();

    /*
     * Untuk kompatibilitas:
     * jika status belum dikirim tetapi tanggal bayar
     * tersedia, status dianggap Sudah Dibayar.
     */
    const statusPembayaran =
      String(
        bayar.status_pembayaran ||
        (
          tanggalBayarInput
            ? "Sudah Dibayar"
            : "Belum Dibayar"
        )
      ).trim();

    // Abaikan baris kosong
    if (
      !deskripsi &&
      nominal === 0 &&
      !tanggalBayarInput &&
      !syaratPembayaran
    ) {
      continue;
    }

    if (!deskripsi) {
      throw new Error(
        `Deskripsi Pembayaran ${
          i + 1
        } wajib diisi.`
      );
    }

    if (
      !Number.isFinite(nominal) ||
      nominal < 0
    ) {
      throw new Error(
        `Nominal Pembayaran ${
          i + 1
        } tidak valid.`
      );
    }

    if (
      !statusValid.includes(
        statusPembayaran
      )
    ) {
      throw new Error(
        `Status Pembayaran ${
          i + 1
        } tidak valid.`
      );
    }

    if (
      statusPembayaran ===
        "Sudah Dibayar" &&
      !tanggalBayarInput
    ) {
      throw new Error(
        `Tanggal Bayar Pembayaran ${
          i + 1
        } wajib diisi karena statusnya Sudah Dibayar.`
      );
    }

    const tanggalBayarSimpan =
      statusPembayaran ===
        "Sudah Dibayar"
        ? tanggalBayarInput
        : null;

    await client.query(
      `
        INSERT INTO
          public.proyek_sewa_pembayaran
        (
          proyek_sewa_id,
          deskripsi,
          nominal,
          status_pembayaran,
          tanggal_bayar,
          syarat_pembayaran,
          created_at,
          updated_at
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `,
      [
        proyekSewa.id,
        deskripsi,
        nominal,
        statusPembayaran,
        tanggalBayarSimpan,
        syaratPembayaran || null
      ]
    );
  }
}

      // =================================================
      // COMMIT
      // =================================================

      await client.query(
        "COMMIT"
      );


      // =================================================
      // RESPONSE
      // =================================================

      return res
        .status(201)
        .json({

          message:
            "Proyek sewa berhasil disimpan.",

          id:
            proyekSewa.id,

          nomor_pr:
            proyekSewa.nomor_pr,

          tanggal_pr:
            proyekSewa.tanggal_pr,

          nomor_rujukan:
            proyekSewa.nomor_rujukan,

          total_nilai_per_bulan:
            totalNilaiPerBulan,

          total_nilai:
            totalNilai

        });


    } catch (error) {

      // =================================================
      // ROLLBACK
      // =================================================

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "ERROR ROLLBACK PROYEK SEWA:",
          rollbackError
        );

      }


      console.error(
        "ERROR SAVE PROYEK SEWA:",
        error
      );


      // =================================================
      // DUPLICATE
      // =================================================

      if (
        error.code === "23505"
      ) {

        return res.status(409).json({
          error:
            "Nomor PR sudah digunakan."
        });

      }


      // =================================================
      // FOREIGN KEY
      // =================================================

      if (
        error.code === "23503"
      ) {

        return res.status(400).json({
          error:
            "Data master yang dipilih tidak valid atau sudah tidak tersedia."
        });

      }


      // =================================================
      // CHECK CONSTRAINT
      // =================================================

      if (
        error.code === "23514"
      ) {

        return res.status(400).json({
          error:
            error.message
        });

      }


      return res.status(500).json({
        error:
          error.message ||
          "Gagal menyimpan proyek sewa."
      });


    } finally {

      client.release();

    }

  }
);

// =====================================================
// GET DAFTAR PROYEK SEWA
// =====================================================

app.get(
  "/api/proyek-sewa",
  async (req, res) => {

    // ===============================================
    // CEK LOGIN
    // ===============================================

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login"
      });

    }


    const user =
      req.session.user;


    const isAdmin =
      String(
        user.role || ""
      ).toLowerCase() === "admin";


    const picId =
      user.id;


    try {

      const { rows } =
        await pool.query(
          `
          SELECT

            ps.id,

            ps.nomor_pr,

            ps.nomor_rujukan,

            ps.proyek_id,

            ps.klien_id,

            d.perusahaan_klien
              AS nama_klien,

            p.nama_proyek,

            ps.total_nilai_per_bulan,

            ps.total_nilai,


            -- =========================================
            -- JENIS PRODUK
            -- =========================================

            COALESCE(
              (
                SELECT
                  STRING_AGG(
                    DISTINCT mps.item_produk,
                    ', '
                    ORDER BY mps.item_produk
                  )

                FROM public.proyek_sewa_produk psp

                JOIN public.master_produk_sewa mps
                  ON mps.id = psp.produk_id

                WHERE
                  psp.proyek_sewa_id = ps.id
              ),
              '-'
            ) AS jenis_produk,

          -- =========================================
          -- SUMMARY
          -- =========================================

          COALESCE(
            (
              SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                  'produk_id',
                  psp.produk_id,

                  'item_produk',
                  mps.item_produk,

                  'orders',
                  (
                    SELECT COALESCE(
                      JSON_AGG(
                        JSON_BUILD_OBJECT(
                          'cabang_id',
                          pso.cabang_id,

                          'nama_cabang',
                          mc.nama_cabang,

                          'quantity',
                          pso.quantity
                        )
                        ORDER BY pso.id
                      ),
                      '[]'::json
                    )

                    FROM public.proyek_sewa_order pso

                    LEFT JOIN public.master_cabang mc
                      ON mc.id = pso.cabang_id

                    WHERE
                      pso.proyek_sewa_produk_id =
                      psp.id
                  )
                )
                ORDER BY psp.id
              )

              FROM public.proyek_sewa_produk psp

              LEFT JOIN public.master_produk_sewa mps
                ON mps.id = psp.produk_id

              WHERE
                psp.proyek_sewa_id =
                ps.id
            ),
            '[]'::json
          ) AS produk_summary,

            -- =========================================
            -- TOTAL DIBAYAR
            -- =========================================

            COALESCE(
              (
                SELECT
                  SUM(
                    pby.nominal
                  )

                FROM public.proyek_sewa_pembayaran pby

                WHERE
                  pby.proyek_sewa_id = ps.id
              ),
              0
            ) AS total_dibayar,


            -- =========================================
            -- NILAI BULAN BERJALAN
            --
            -- Untuk sementara menggunakan total nilai
            -- per bulan proyek.
            -- =========================================

            ps.total_nilai_per_bulan
              AS nilai_bulan_berjalan,


            ps.created_at,

            ps.updated_at


          FROM public.proyek_sewa ps


          -- =========================================
          -- KLIEN
          -- =========================================

          LEFT JOIN public.data d
            ON d.id = ps.klien_id


          -- =========================================
          -- PROYEK EXISTING
          -- =========================================

          LEFT JOIN public.proyek p
            ON p.id = ps.proyek_id


          -- =========================================
          -- ADMIN / PIC
          -- =========================================

          WHERE

            $1::boolean = TRUE

            OR ps.proyek_id IS NULL

            OR EXISTS (

              SELECT 1

              FROM public.proyek_pic pp

              WHERE
                pp.proyek_id = ps.proyek_id

                AND pp.pic_id = $2

            )


          ORDER BY
            ps.id DESC
          `,
          [
            isAdmin,
            picId
          ]
        );


      res.json(rows);


    } catch (error) {

      console.error(
        "ERROR GET PROYEK SEWA:",
        error
      );


      res.status(500).json({
        error:
          error.message
      });

    }

  }
);

// =====================================================
// GET DETAIL PROYEK SEWA
// =====================================================

app.get(
  "/api/proyek-sewa/:id/detail",
  async (req, res) => {

    // ================================================
    // CEK LOGIN
    // ================================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    // ================================================
    // VALIDASI ID
    // ================================================

    const id =
      Number(req.params.id);

    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {
      return res.status(400).json({
        error:
          "ID Proyek Sewa tidak valid."
      });
    }

    try {

      // ==============================================
      // HEADER PROYEK SEWA
      // ==============================================

      const proyekResult =
        await pool.query(
          `
            SELECT
              ps.id,
              ps.nomor_pr,
              ps.tanggal_pr,
              ps.nomor_rujukan,
              ps.proyek_id,
              ps.klien_id,
              ps.total_nilai_per_bulan,
              ps.total_nilai,
              ps.created_at,
              ps.updated_at,
              ps.proyek_partner_id,

              pp.partner_id,

              partner.nama_partner,

              COALESCE(
                NULLIF(pp.nilai_nego_3, 0),
                NULLIF(pp.nilai_nego_2, 0),
                NULLIF(pp.nilai_nego_1, 0),
                NULLIF(pp.nilai_submit, 0),
                0
              )::numeric AS nilai_final_partner,

              d.perusahaan_klien
                AS nama_klien,

              p.nama_proyek

            FROM public.proyek_sewa ps

            LEFT JOIN public.data d
              ON d.id = ps.klien_id

            LEFT JOIN public.proyek p
              ON p.id = ps.proyek_id

            LEFT JOIN public.proyek_partner pp
            ON pp.id =
              ps.proyek_partner_id

          LEFT JOIN public.partner partner
            ON partner.id =
              pp.partner_id

            WHERE ps.id = $1

            LIMIT 1
          `,
          [id]
        );

      if (
        proyekResult.rowCount === 0
      ) {
        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan."
        });
      }

      // ==============================================
      // PRODUK
      // ==============================================

      const produkResult =
        await pool.query(
          `
            SELECT
              psp.id,
              psp.proyek_sewa_id,
              psp.produk_id,

              mps.item_produk,

              psp.harga_per_item,
              psp.jenis_proyek,
              psp.sub_jenis_proyek,
              psp.durasi_bulan,
              psp.created_at,
              psp.updated_at

            FROM public.proyek_sewa_produk psp

            LEFT JOIN public.master_produk_sewa mps
              ON mps.id = psp.produk_id

            WHERE
              psp.proyek_sewa_id = $1

            ORDER BY
              psp.id ASC
          `,
          [id]
        );

      // ==============================================
      // ORDER
      // ==============================================

      const orderResult =
        await pool.query(
          `
            SELECT
              pso.id,
              pso.proyek_sewa_produk_id,
              pso.cabang_id,
              pso.quantity,
              pso.harga_per_bulan,
              pso.total_harga,
              pso.no_req_klien,
              pso.tanggal_req_klien,
              pso.tanggal_do,
              pso.no_do,
              pso.end_date,
              pso.created_at,
              pso.updated_at,

              mc.nama_cabang

            FROM public.proyek_sewa_order pso

            LEFT JOIN public.master_cabang mc
              ON mc.id = pso.cabang_id

            WHERE
              pso.proyek_sewa_produk_id
              IN (
                SELECT
                  id

                FROM public.proyek_sewa_produk

                WHERE
                  proyek_sewa_id = $1
              )

            ORDER BY
              pso.id ASC
          `,
          [id]
        );

      // ==============================================
      // GABUNGKAN ORDER KE PRODUK
      // ==============================================

      const produk =
        produkResult.rows.map(
          item => {

            const orders =
              orderResult.rows.filter(
                order =>
                  Number(
                    order.proyek_sewa_produk_id
                  ) ===
                  Number(item.id)
              );

            return {
              ...item,
              orders
            };
          }
        );

      // ==============================================
      // PEMBAYARAN
      // ==============================================

      const pembayaranResult =
        await pool.query(
          `
            SELECT
              id,
              proyek_sewa_id,
              deskripsi,
              nominal,

              CASE
                WHEN LOWER(
                  TRIM(
                    COALESCE(
                      status_pembayaran,
                      ''
                    )
                  )
                ) IN (
                  'sudah dibayar',
                  'dibayar',
                  'lunas',
                  'paid'
                )
                THEN 'Sudah Dibayar'

                WHEN LOWER(
                  TRIM(
                    COALESCE(
                      status_pembayaran,
                      ''
                    )
                  )
                ) IN (
                  'proses',
                  'diproses',
                  'processing'
                )
                THEN 'Proses'

                /*
                 * Kompatibilitas data lama:
                 * apabila tanggal bayar sudah ada,
                 * dianggap sudah dibayar.
                 */
                WHEN tanggal_bayar IS NOT NULL
                THEN 'Sudah Dibayar'

                ELSE 'Belum Dibayar'
              END AS status_pembayaran,

              tanggal_bayar,
              syarat_pembayaran,
              created_at,
              updated_at

            FROM public.proyek_sewa_pembayaran

            WHERE
              proyek_sewa_id = $1

            ORDER BY
              id ASC
          `,
          [id]
        );

      const pembayaran =
        pembayaranResult.rows;

      // ==============================================
      // TOTAL DIBAYAR
      // HANYA STATUS SUDAH DIBAYAR
      // ==============================================

      const totalDibayar =
        pembayaran
          .filter(
            item =>
              item.status_pembayaran ===
              "Sudah Dibayar"
          )
          .reduce(
            (
              total,
              item
            ) =>
              total +
              Number(
                item.nominal || 0
              ),
            0
          );

      // ==============================================
      // TOTAL PROYEK DAN SISA
      // ==============================================

      const totalNilai =
        Number(
          proyekResult
            .rows[0]
            .total_nilai || 0
        );

      const sisaPembayaran =
        Math.max(
          0,
          totalNilai -
          totalDibayar
        );

        const dokumenResult =
  await pool.query(
    `
    SELECT *
    FROM public.proyek_sewa_dokumen
    WHERE proyek_sewa_id = $1
    ORDER BY id DESC
    `,
    [id]
  );


const pembayaranPartnerResult =
  await pool.query(
    `
    SELECT *
    FROM public.proyek_sewa_pembayaran_partner
    WHERE proyek_sewa_id = $1
    ORDER BY id ASC
    `,
    [id]
  );
      // ==============================================
      // RESPONSE
      // ==============================================

      return res.json({
  proyek:
    proyekResult.rows[0],

  partner: {
    proyek_partner_id:
      proyekResult.rows[0]
        .proyek_partner_id,

    partner_id:
      proyekResult.rows[0]
        .partner_id,

    nama_partner:
      proyekResult.rows[0]
        .nama_partner,

    nilai_final_partner:
      Number(
        proyekResult.rows[0]
          .nilai_final_partner || 0
      )
  },

  produk,

  pembayaran:
    pembayaranResult.rows,

  pembayaran_partner:
    pembayaranPartnerResult.rows,

  dokumen:
    dokumenResult.rows,

  summary: {
    total_nilai_per_bulan:
      Number(
        proyekResult.rows[0]
          .total_nilai_per_bulan || 0
      ),

    total_nilai:
      totalNilai,

    total_dibayar:
      totalDibayar,

    sisa_pembayaran:
      sisaPembayaran
  }
});

    } catch (error) {

      console.error(
        "ERROR GET DETAIL PROYEK SEWA:",
        error
      );

      return res.status(500).json({
        error:
          error.message ||
          "Gagal mengambil Detail Proyek Sewa."
      });
    }
  }
);

// =====================================================
// UPDATE INFORMASI PROYEK SEWA
// PUT /api/proyek-sewa/:id/informasi
// =====================================================

app.put(
  "/api/proyek-sewa/:id/informasi",
  async (req, res) => {

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }


    const client =
      await pool.connect();


    try {

      const proyekSewaId =
        Number(req.params.id);


      if (
        !Number.isInteger(proyekSewaId) ||
        proyekSewaId <= 0
      ) {
        return res.status(400).json({
          error: "ID Proyek Sewa tidak valid."
        });
      }


     const {
        nomor_pr,
        tanggal_pr,
        proyek_id,
        proyek_partner_id,
        klien_id
      } = req.body;


      if (
        !nomor_pr ||
        !String(nomor_pr).trim()
      ) {
        return res.status(400).json({
          error: "Nomor PR wajib diisi."
        });
      }


      if (!klien_id) {
        return res.status(400).json({
          error: "Klien wajib dipilih."
        });
      }


      await client.query("BEGIN");


      // =================================================
      // CEK PROYEK SEWA
      // =================================================

      const existingResult =
        await client.query(
          `
            SELECT *
            FROM public.proyek_sewa
            WHERE id = $1
            FOR UPDATE
          `,
          [proyekSewaId]
        );


      if (
        existingResult.rowCount === 0
      ) {
        throw new Error(
          "Proyek Sewa tidak ditemukan."
        );
      }


      // =================================================
      // CEK NOMOR PR DUPLIKAT
      // =================================================

      const duplicateResult =
        await client.query(
          `
            SELECT id
            FROM public.proyek_sewa

            WHERE
              LOWER(BTRIM(nomor_pr)) =
              LOWER(BTRIM($1))

              AND id <> $2

            LIMIT 1
          `,
          [
            String(nomor_pr).trim(),
            proyekSewaId
          ]
        );


      if (
        duplicateResult.rowCount > 0
      ) {
        throw new Error(
          "Nomor PR sudah digunakan."
        );
      }


      // =================================================
      // CEK KLIEN
      // =================================================

      const klienResult =
        await client.query(
          `
            SELECT id
            FROM public.data
            WHERE id = $1
            LIMIT 1
          `,
          [
            Number(klien_id)
          ]
        );


      if (
        klienResult.rowCount === 0
      ) {
        throw new Error(
          "Klien tidak ditemukan."
        );
      }


      // =================================================
      // CEK PROYEK EXISTING
      // =================================================

      if (proyek_id) {

        const proyekResult =
          await client.query(
            `
              SELECT id
              FROM public.proyek
              WHERE id = $1
              LIMIT 1
            `,
            [
              Number(proyek_id)
            ]
          );


        if (
          proyekResult.rowCount === 0
        ) {
          throw new Error(
            "Proyek existing tidak ditemukan."
          );
        }

      }

// =================================================
// VALIDASI DAN TENTUKAN PARTNER
// =================================================

const proyekPartnerIdSimpan =
  await tentukanPartnerProyekSewa(
    client,

    proyek_id
      ? Number(proyek_id)
      : null,

    proyek_partner_id
      ? Number(
          proyek_partner_id
        )
      : null
  );
      // =================================================
      // UPDATE
      //
      // nomor_rujukan TIDAK diedit di sini.
      // Rujukan akan mengikuti No Req Klien pada Order.
      // =================================================

      const updateResult =
  await client.query(
    `
      UPDATE public.proyek_sewa

      SET
        nomor_pr = $1,
        tanggal_pr = $2,
        proyek_id = $3,
        proyek_partner_id = $4,
        klien_id = $5,
        updated_at =
          CURRENT_TIMESTAMP

      WHERE id = $6

      RETURNING *
    `,
    [
      // $1
      String(
        nomor_pr
      ).trim(),

      // $2
      tanggal_pr ||
        null,

      // $3
      proyek_id
        ? Number(
            proyek_id
          )
        : null,

      // $4
      proyekPartnerIdSimpan,

      // $5
      Number(
        klien_id
      ),

      // $6
      proyekSewaId
    ]
  );
      await client.query("COMMIT");


      return res.json({
        message:
          "Informasi Proyek Sewa berhasil diperbarui.",

        proyek:
          updateResult.rows[0]
      });


    } catch (error) {

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}


      console.error(
        "ERROR UPDATE INFORMASI PROYEK SEWA:",
        error
      );


      if (
        error.code === "23505" ||
        error.message ===
          "Nomor PR sudah digunakan."
      ) {
        return res.status(409).json({
          error:
            "Nomor PR sudah digunakan."
        });
      }


      return res.status(500).json({
        error:
          error.message ||
          "Gagal memperbarui informasi Proyek Sewa."
      });


    } finally {

      client.release();

    }

  }
);

app.put(
  "/api/proyek-sewa/:id/partner",
  async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    const client =
      await pool.connect();

    try {
      const proyekSewaId =
        Number(req.params.id);

      const proyekPartnerId =
        Number(
          req.body.proyek_partner_id
        );

      if (
        !Number.isInteger(proyekSewaId) ||
        proyekSewaId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID proyek sewa tidak valid"
        });
      }

      await client.query("BEGIN");

      const proyekResult =
        await client.query(
          `
          SELECT
            id,
            proyek_id,
            proyek_partner_id

          FROM public.proyek_sewa

          WHERE id = $1

          FOR UPDATE
          `,
          [proyekSewaId]
        );

      if (proyekResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan"
        });
      }

      const proyekId =
        proyekResult.rows[0]
          .proyek_id;

      const partnerSimpan =
        await tentukanPartnerProyekSewa(
          client,
          proyekId,
          proyekPartnerId
        );

      const pembayaranLain =
        await client.query(
          `
          SELECT 1

          FROM public.proyek_sewa_pembayaran_partner

          WHERE proyek_sewa_id = $1
            AND proyek_partner_id <> $2

          LIMIT 1
          `,
          [
            proyekSewaId,
            partnerSimpan
          ]
        );

      if (pembayaranLain.rowCount > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error:
            "Partner tidak dapat diganti karena sudah memiliki pembayaran partner."
        });
      }

      const result =
        await client.query(
          `
          UPDATE public.proyek_sewa

          SET
            proyek_partner_id = $1,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $2

          RETURNING *
          `,
          [
            partnerSimpan,
            proyekSewaId
          ]
        );

      await client.query("COMMIT");

      return res.json({
        message:
          "Partner proyek sewa berhasil diperbarui",

        data:
          result.rows[0]
      });

    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "ERROR UPDATE PARTNER PROYEK SEWA:",
        error
      );

      return res.status(500).json({
        error: error.message
      });

    } finally {
      client.release();
    }
  }
);
// =====================================================
// 2. UPDATE PRODUK & ORDER
// PUT /api/proyek-sewa/:id/produk
//
// ATURAN HARGA:
//
// Produk existing + produk tidak berubah
// -> gunakan harga_per_item proyek lama.
//
// Produk existing tetapi produknya diganti
// -> gunakan harga master produk baru.
//
// Produk baru
// -> gunakan harga master saat ini.
//
// Jadi perubahan harga pada master TIDAK mengubah
// kontrak proyek lama.
// =====================================================

app.put(
  "/api/proyek-sewa/:id/produk",
  async (req, res) => {

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }


    const client =
      await pool.connect();


    // =================================================
    // HELPER END DATE
    // =================================================

    function hitungEndDate(
      tanggalDO,
      durasiBulan
    ) {

      if (
        !tanggalDO ||
        !durasiBulan
      ) {
        return null;
      }


      const parts =
        String(tanggalDO)
          .split("-")
          .map(Number);


      if (
        parts.length !== 3
      ) {
        return null;
      }


      const [
        year,
        month,
        day
      ] = parts;


      if (
        !year ||
        !month ||
        !day
      ) {
        return null;
      }


      const result =
        new Date(
          year,
          month - 1,
          1
        );


      result.setMonth(
        result.getMonth() +
        Number(durasiBulan)
      );


      const lastDay =
        new Date(
          result.getFullYear(),
          result.getMonth() + 1,
          0
        ).getDate();


      result.setDate(
        Math.min(
          day,
          lastDay
        )
      );


      const yyyy =
        result.getFullYear();


      const mm =
        String(
          result.getMonth() + 1
        ).padStart(
          2,
          "0"
        );


      const dd =
        String(
          result.getDate()
        ).padStart(
          2,
          "0"
        );


      return `${yyyy}-${mm}-${dd}`;
    }


    try {

      const proyekSewaId =
        Number(req.params.id);


      const {
        produk
      } = req.body;


      if (
        !Number.isInteger(proyekSewaId) ||
        proyekSewaId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID Proyek Sewa tidak valid."
        });
      }


      if (
        !Array.isArray(produk) ||
        produk.length === 0
      ) {
        return res.status(400).json({
          error:
            "Minimal harus ada 1 produk."
        });
      }


      await client.query("BEGIN");


      // =================================================
      // LOCK HEADER
      // =================================================

      const proyekResult =
        await client.query(
          `
            SELECT id
            FROM public.proyek_sewa
            WHERE id = $1
            FOR UPDATE
          `,
          [
            proyekSewaId
          ]
        );


      if (
        proyekResult.rowCount === 0
      ) {
        throw new Error(
          "Proyek Sewa tidak ditemukan."
        );
      }


      // =================================================
      // SNAPSHOT PRODUK LAMA
      //
      // Ini penting untuk mempertahankan
      // harga kontrak lama.
      // =================================================

      const oldProdukResult =
        await client.query(
          `
            SELECT
              id,
              produk_id,
              harga_per_item,
              durasi_bulan

            FROM public.proyek_sewa_produk

            WHERE proyek_sewa_id = $1
          `,
          [
            proyekSewaId
          ]
        );


      const oldProduk =
        oldProdukResult.rows;


      let totalNilaiPerBulan = 0;

      let totalNilai = 0;


      const produkValid = [];

      const semuaNoReqKlien = [];


      // =================================================
      // VALIDASI SEMUA DATA TERLEBIH DAHULU
      // =================================================

      for (
        let i = 0;
        i < produk.length;
        i++
      ) {

        const item =
          produk[i];


        if (!item.produk_id) {
          throw new Error(
            `Produk ${i + 1} belum dipilih.`
          );
        }


        const durasi =
          Number(
            item.durasi_bulan
          );


        if (
          !Number.isInteger(durasi) ||
          durasi <= 0
        ) {
          throw new Error(
            `Durasi Produk ${i + 1} tidak valid.`
          );
        }


        if (
          !Array.isArray(
            item.orders
          ) ||
          item.orders.length === 0
        ) {
          throw new Error(
            `Produk ${i + 1} minimal memiliki 1 Order.`
          );
        }


        // =================================================
        // MASTER PRODUK
        // =================================================

        const masterResult =
          await client.query(
            `
              SELECT

                mps.id,

                mps.item_produk,

                mps.harga_jual_per_item,

                mps.jenis_proyek_id,

                mps.sub_jenis_proyek_id,

                jp.name
                  AS jenis_proyek,

                sjp.name
                  AS sub_jenis_proyek

              FROM public.master_produk_sewa mps

              LEFT JOIN public.jenis_proyek jp
                ON jp.id =
                   mps.jenis_proyek_id

              LEFT JOIN public.jenis_proyek sjp
                ON sjp.id =
                   mps.sub_jenis_proyek_id

              WHERE mps.id = $1

              LIMIT 1
            `,
            [
              Number(
                item.produk_id
              )
            ]
          );


        if (
          masterResult.rowCount === 0
        ) {
          throw new Error(
            `Master Produk ${i + 1} tidak ditemukan.`
          );
        }


        const master =
          masterResult.rows[0];


        // =================================================
        // TENTUKAN HARGA
        //
        // Jika row produk lama masih sama:
        // gunakan harga kontrak lama.
        //
        // Kalau produk diganti / produk baru:
        // gunakan harga master sekarang.
        // =================================================

        let hargaPerItem =
          Number(
            master.harga_jual_per_item ||
            0
          );


        if (item.id) {

          const existing =
            oldProduk.find(
              row =>
                Number(row.id) ===
                Number(item.id)
            );


          if (
            existing &&
            Number(
              existing.produk_id
            ) ===
            Number(
              item.produk_id
            )
          ) {

            hargaPerItem =
              Number(
                existing.harga_per_item ||
                0
              );

          }

        }


        if (
          !Number.isFinite(
            hargaPerItem
          ) ||
          hargaPerItem < 0
        ) {
          throw new Error(
            `Harga Produk ${master.item_produk} tidak valid.`
          );
        }


        const ordersValid = [];


        // =================================================
        // ORDER
        // =================================================

        for (
          let j = 0;
          j < item.orders.length;
          j++
        ) {

          const order =
            item.orders[j];


          if (!order.cabang_id) {
            throw new Error(
              `Lokasi Order ${j + 1} pada Produk ${i + 1} belum dipilih.`
            );
          }


          const quantity =
            Number(
              order.quantity
            );


          if (
            !Number.isInteger(
              quantity
            ) ||
            quantity <= 0
          ) {
            throw new Error(
              `Quantity Order ${j + 1} pada Produk ${i + 1} tidak valid.`
            );
          }


          // =================================================
          // CEK CABANG
          // =================================================

          const cabangResult =
            await client.query(
              `
                SELECT id
                FROM public.master_cabang
                WHERE id = $1
                LIMIT 1
              `,
              [
                Number(
                  order.cabang_id
                )
              ]
            );


          if (
            cabangResult.rowCount === 0
          ) {
            throw new Error(
              `Lokasi Order ${j + 1} tidak ditemukan.`
            );
          }


          // =================================================
          // FIELD ORDER BARU
          // =================================================

          const noReqKlien =
            order.no_req_klien
              ? String(
                  order.no_req_klien
                ).trim()
              : null;


          const tanggalReqKlien =
            order.tanggal_req_klien ||
            null;


          const tanggalDO =
            order.tanggal_do ||
            null;


          const noDO =
            order.no_do
              ? String(
                  order.no_do
                ).trim()
              : null;


          // =================================================
          // RUJUKAN
          // =================================================

          if (noReqKlien) {

            semuaNoReqKlien.push(
              noReqKlien
            );

          }


          // =================================================
          // END DATE
          //
          // Tidak percaya nilai dari frontend.
          // Server hitung ulang.
          // =================================================

          const endDate =
            tanggalDO
              ? hitungEndDate(
                  tanggalDO,
                  durasi
                )
              : null;


          // =================================================
          // NILAI
          // =================================================

          const hargaPerBulan =
            quantity *
            hargaPerItem;


          const totalHarga =
            hargaPerBulan *
            durasi;


          totalNilaiPerBulan +=
            hargaPerBulan;


          totalNilai +=
            totalHarga;


          ordersValid.push({

            cabang_id:
              Number(
                order.cabang_id
              ),

            quantity,

            harga_per_bulan:
              hargaPerBulan,

            total_harga:
              totalHarga,

            no_req_klien:
              noReqKlien,

            tanggal_req_klien:
              tanggalReqKlien,

            tanggal_do:
              tanggalDO,

            no_do:
              noDO,

            end_date:
              endDate

          });

        }


        produkValid.push({

          produk_id:
            Number(
              master.id
            ),

          harga_per_item:
            hargaPerItem,

          jenis_proyek:
            master.jenis_proyek ||
            "Sewa",

          sub_jenis_proyek:
            master.sub_jenis_proyek ||
            null,

          durasi_bulan:
            durasi,

          orders:
            ordersValid

        });

      }


      // =================================================
      // RUJUKAN KONTRAK
      //
      // Dari semua No Req Klien
      // =================================================

      const nomorRujukan =
        [
          ...new Set(
            semuaNoReqKlien
          )
        ]
          .filter(Boolean)
          .join(", ");


      // =================================================
      // HAPUS PRODUK LAMA
      //
      // Order ikut terhapus jika FK ON DELETE CASCADE.
      // =================================================

      await client.query(
        `
          DELETE FROM public.proyek_sewa_produk
          WHERE proyek_sewa_id = $1
        `,
        [
          proyekSewaId
        ]
      );


      // =================================================
      // INSERT ULANG PRODUK
      // =================================================

      for (
        const item
        of produkValid
      ) {

        const insertProdukResult =
          await client.query(
            `
              INSERT INTO public.proyek_sewa_produk (

                proyek_sewa_id,

                produk_id,

                harga_per_item,

                jenis_proyek,

                sub_jenis_proyek,

                durasi_bulan,

                created_at,

                updated_at

              )

              VALUES (

                $1,
                $2,
                $3,
                $4,
                $5,
                $6,

                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP

              )

              RETURNING id
            `,
            [

              proyekSewaId,

              item.produk_id,

              item.harga_per_item,

              item.jenis_proyek,

              item.sub_jenis_proyek,

              item.durasi_bulan

            ]
          );


        const proyekSewaProdukId =
          insertProdukResult
            .rows[0]
            .id;


        // =================================================
        // INSERT ORDER
        // =================================================

        for (
          const order
          of item.orders
        ) {

          await client.query(
            `
              INSERT INTO public.proyek_sewa_order (

                proyek_sewa_produk_id,

                cabang_id,

                quantity,

                harga_per_bulan,

                total_harga,

                no_req_klien,

                tanggal_req_klien,

                tanggal_do,

                no_do,

                end_date,

                created_at,

                updated_at

              )

              VALUES (

                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,

                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP

              )
            `,
            [

              proyekSewaProdukId,

              order.cabang_id,

              order.quantity,

              order.harga_per_bulan,

              order.total_harga,

              order.no_req_klien,

              order.tanggal_req_klien,

              order.tanggal_do,

              order.no_do,

              order.end_date

            ]
          );

        }

      }


      // =================================================
      // UPDATE HEADER
      //
      // nomor_rujukan ikut diperbarui otomatis
      // =================================================

      await client.query(
        `
          UPDATE public.proyek_sewa

          SET
            nomor_rujukan = $1,
            total_nilai_per_bulan = $2,
            total_nilai = $3,
            updated_at = CURRENT_TIMESTAMP

          WHERE id = $4
        `,
        [

          nomorRujukan ||
            null,

          totalNilaiPerBulan,

          totalNilai,

          proyekSewaId

        ]
      );


      await client.query(
        "COMMIT"
      );


      return res.json({

        message:
          "Produk dan Order berhasil diperbarui.",

        nomor_rujukan:
          nomorRujukan ||
          null,

        total_nilai_per_bulan:
          totalNilaiPerBulan,

        total_nilai:
          totalNilai

      });


    } catch (error) {

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}


      console.error(
        "ERROR UPDATE PRODUK PROYEK SEWA:",
        error
      );


      return res.status(500).json({
        error:
          error.message ||
          "Gagal memperbarui Produk dan Order."
      });


    } finally {

      client.release();

    }

  }
);

// =====================================================
// 3. UPDATE PEMBAYARAN
// PUT /api/proyek-sewa/:id/pembayaran
// =====================================================

app.put(
  "/api/proyek-sewa/:id/pembayaran",
  async (req, res) => {

    // ===============================================
    // VALIDASI LOGIN
    // ===============================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login."
      });
    }

    // ===============================================
    // AMBIL DATA
    // ===============================================

    const proyekSewaId =
      Number(req.params.id);

    const pembayaran =
      Array.isArray(
        req.body.pembayaran
      )
        ? req.body.pembayaran
        : [];

    // ===============================================
    // VALIDASI ID PROYEK SEWA
    // ===============================================

    if (
      !Number.isInteger(proyekSewaId) ||
      proyekSewaId <= 0
    ) {
      return res.status(400).json({
        error:
          "ID proyek sewa tidak valid."
      });
    }

    const client =
      await pool.connect();

    let transaksiDimulai =
      false;

    try {

      await client.query(
        "BEGIN"
      );

      transaksiDimulai =
        true;

      // =============================================
      // LOCK PROYEK SEWA
      // SEKALIGUS AMBIL PROYEK ID DAN NAMA PROYEK
      // =============================================

      const proyekResult =
        await client.query(
          `
            SELECT
              ps.id,
              ps.proyek_id,
              ps.total_nilai,
              p.nama_proyek

            FROM public.proyek_sewa ps

            INNER JOIN public.proyek p
              ON p.id = ps.proyek_id

            WHERE ps.id = $1

            FOR UPDATE OF ps
          `,
          [proyekSewaId]
        );

      if (
        proyekResult.rowCount === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        transaksiDimulai =
          false;

        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan."
        });
      }

      const proyekSewa =
        proyekResult.rows[0];

      const proyekId =
        Number(
          proyekSewa.proyek_id
        );

      const namaProyek =
        proyekSewa.nama_proyek ||
        `Proyek ${proyekId}`;

      // =============================================
      // AMBIL PEMBAYARAN LAMA UNTUK LOG
      // =============================================

      const pembayaranLamaResult =
        await client.query(
          `
            SELECT
              id,
              deskripsi,
              nominal,
              status_pembayaran,
              tanggal_bayar,
              syarat_pembayaran

            FROM public.proyek_sewa_pembayaran

            WHERE proyek_sewa_id = $1

            ORDER BY
              id ASC
          `,
          [proyekSewaId]
        );

      const pembayaranLama =
        pembayaranLamaResult.rows;

      // =============================================
      // VALIDASI DATA PEMBAYARAN
      // =============================================

      const statusValid = [
        "Belum Dibayar",
        "Proses",
        "Sudah Dibayar"
      ];

      const pembayaranValid =
        [];

      for (
        let i = 0;
        i < pembayaran.length;
        i += 1
      ) {
        const item =
          pembayaran[i] || {};

        const deskripsi =
          String(
            item.deskripsi || ""
          ).trim();

        const nominalInput =
          item.nominal === null ||
          item.nominal === undefined ||
          item.nominal === ""
            ? 0
            : Number(item.nominal);

        const statusPembayaran =
          String(
            item.status_pembayaran ||
            "Belum Dibayar"
          ).trim();

        const tanggalBayarInput =
          item.tanggal_bayar
            ? String(
                item.tanggal_bayar
              )
                .trim()
                .slice(0, 10)
            : null;

        const syaratPembayaran =
          String(
            item.syarat_pembayaran ||
            ""
          ).trim();

        // ===========================================
        // ABAIKAN BARIS BENAR-BENAR KOSONG
        // ===========================================

        if (
          !deskripsi &&
          nominalInput === 0 &&
          !tanggalBayarInput &&
          !syaratPembayaran
        ) {
          continue;
        }

        // ===========================================
        // VALIDASI DESKRIPSI
        // ===========================================

        if (!deskripsi) {
          throw new Error(
            `Deskripsi pembayaran ${
              i + 1
            } wajib diisi.`
          );
        }

        // ===========================================
        // VALIDASI NOMINAL
        // ===========================================

        if (
          !Number.isFinite(
            nominalInput
          ) ||
          nominalInput < 0
        ) {
          throw new Error(
            `Nominal pembayaran ${
              i + 1
            } tidak valid.`
          );
        }

        // ===========================================
        // VALIDASI STATUS PEMBAYARAN
        // ===========================================

        if (
          !statusValid.includes(
            statusPembayaran
          )
        ) {
          throw new Error(
            `Status pembayaran ${
              i + 1
            } tidak valid.`
          );
        }

        // ===========================================
        // TANGGAL WAJIB JIKA SUDAH DIBAYAR
        // ===========================================

        if (
          statusPembayaran ===
            "Sudah Dibayar" &&
          !tanggalBayarInput
        ) {
          throw new Error(
            `Tanggal bayar pembayaran ${
              i + 1
            } wajib diisi karena statusnya Sudah Dibayar.`
          );
        }

        /*
         * Tanggal bayar hanya disimpan ketika
         * status pembayaran Sudah Dibayar.
         */
        const tanggalBayarSimpan =
          statusPembayaran ===
            "Sudah Dibayar"
            ? tanggalBayarInput
            : null;

        pembayaranValid.push({
          deskripsi:
            deskripsi,

          nominal:
            nominalInput,

          status_pembayaran:
            statusPembayaran,

          tanggal_bayar:
            tanggalBayarSimpan,

          syarat_pembayaran:
            syaratPembayaran ||
            null
        });
      }

      // =============================================
      // HAPUS PEMBAYARAN LAMA
      // =============================================

      await client.query(
        `
          DELETE FROM
            public.proyek_sewa_pembayaran

          WHERE proyek_sewa_id = $1
        `,
        [proyekSewaId]
      );

      // =============================================
      // INSERT ULANG PEMBAYARAN
      // =============================================

      const pembayaranTersimpan =
        [];

      for (
        const item
        of pembayaranValid
      ) {
        const insertResult =
          await client.query(
            `
              INSERT INTO
                public.proyek_sewa_pembayaran
              (
                proyek_sewa_id,
                deskripsi,
                nominal,
                status_pembayaran,
                tanggal_bayar,
                syarat_pembayaran,
                created_at,
                updated_at
              )

              VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )

              RETURNING
                id,
                proyek_sewa_id,
                deskripsi,
                nominal,
                status_pembayaran,
                tanggal_bayar,
                syarat_pembayaran,
                created_at,
                updated_at
            `,
            [
              proyekSewaId,
              item.deskripsi,
              item.nominal,
              item.status_pembayaran,
              item.tanggal_bayar,
              item.syarat_pembayaran
            ]
          );

        pembayaranTersimpan.push(
          insertResult.rows[0]
        );
      }

      // =============================================
      // TOTAL DIBAYAR
      // HANYA STATUS SUDAH DIBAYAR
      // =============================================

      const totalBayarResult =
        await client.query(
          `
            SELECT
              COALESCE(
                SUM(nominal),
                0
              )::numeric
                AS total_dibayar

            FROM public.proyek_sewa_pembayaran

            WHERE proyek_sewa_id = $1

              AND LOWER(
                TRIM(
                  COALESCE(
                    status_pembayaran,
                    ''
                  )
                )
              ) IN (
                'sudah dibayar',
                'dibayar',
                'lunas',
                'paid'
              )
          `,
          [proyekSewaId]
        );

      const totalDibayar =
        Number(
          totalBayarResult
            .rows[0]
            .total_dibayar
        ) || 0;

      const totalNilai =
        Number(
          proyekSewa.total_nilai
        ) || 0;

      const sisaPembayaran =
        Math.max(
          0,
          totalNilai -
          totalDibayar
        );

      // =============================================
      // FORMAT TANGGAL UNTUK LOG
      // =============================================

      const formatTanggalLog =
        value => {

          if (!value) {
            return "-";
          }

          const namaBulan = [
            "Januari",
            "Februari",
            "Maret",
            "April",
            "Mei",
            "Juni",
            "Juli",
            "Agustus",
            "September",
            "Oktober",
            "November",
            "Desember"
          ];

          let tahun;
          let bulan;
          let tanggal;

          if (
            value instanceof Date
          ) {
            tahun =
              value.getFullYear();

            bulan =
              value.getMonth() + 1;

            tanggal =
              value.getDate();

          } else {
            const tanggalString =
              String(value)
                .slice(0, 10);

            const bagian =
              tanggalString.split("-");

            if (
              bagian.length !== 3
            ) {
              return tanggalString;
            }

            tahun =
              Number(bagian[0]);

            bulan =
              Number(bagian[1]);

            tanggal =
              Number(bagian[2]);
          }

          if (
            !tahun ||
            !bulan ||
            !tanggal
          ) {
            return "-";
          }

          return (
            `${tanggal} ` +
            `${namaBulan[bulan - 1]} ` +
            `${tahun}`
          );
        };

      // =============================================
      // FORMAT PEMBAYARAN UNTUK LOG
      // =============================================

      const buatDetailPembayaranLog =
        daftar => {

          if (
            !Array.isArray(daftar) ||
            daftar.length === 0
          ) {
            return "-";
          }

          return daftar
            .map(
              (
                item,
                index
              ) => {

                const status =
                  String(
                    item.status_pembayaran ||
                    "Belum Dibayar"
                  ).trim();

                const tanggalBayar =
                  status ===
                    "Sudah Dibayar"
                    ? formatTanggalLog(
                        item.tanggal_bayar
                      )
                    : "-";

                return [
                  `Pembayaran ${index + 1}`,

                  `Deskripsi = ${
                    item.deskripsi ||
                    "-"
                  }`,

                  `Nominal = Rp ${Number(
                    item.nominal || 0
                  ).toLocaleString(
                    "id-ID"
                  )}`,

                  `Status = ${status}`,

                  `Tanggal Bayar = ${
                    tanggalBayar
                  }`,

                  `Syarat Pembayaran = ${
                    item.syarat_pembayaran ||
                    "-"
                  }`
                ].join(", ");
              }
            )
            .join(" | ");
        };

      const nilaiLama =
        buatDetailPembayaranLog(
          pembayaranLama
        );

      const nilaiBaru =
        buatDetailPembayaranLog(
          pembayaranTersimpan
        );

      // =============================================
      // SIMPAN ACTIVITY LOG
      // ENTITY ID MENGGUNAKAN PROYEK ID
      // =============================================

      if (
        nilaiLama !== nilaiBaru
      ) {
        await simpanActivityLog(
          client,
          {
            ...getActivityUser(req),

            aktivitas:
              "UPDATE",

            modul:
              "PROYEK",

            entity_id:
              proyekId,

            entity_nama:
              namaProyek,

            field_name:
              "PEMBAYARAN SEWA",

            nilai_lama:
              nilaiLama,

            nilai_baru:
              nilaiBaru,

            deskripsi:
              "memperbarui pembayaran proyek sewa"
          }
        );
      }

      // =============================================
      // UPDATE HEADER PROYEK SEWA
      // =============================================

      await client.query(
        `
          UPDATE public.proyek_sewa

          SET
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1
        `,
        [proyekSewaId]
      );

      // =============================================
      // COMMIT
      // =============================================

      await client.query(
        "COMMIT"
      );

      transaksiDimulai =
        false;

      // =============================================
      // RESPONSE
      // =============================================

      return res.json({
        success:
          true,

        message:
          "Riwayat pembayaran berhasil diperbarui.",

        pembayaran:
          pembayaranTersimpan,

        total_dibayar:
          totalDibayar,

        sisa_pembayaran:
          sisaPembayaran
      });

    } catch (error) {

      if (transaksiDimulai) {
        await client.query(
          "ROLLBACK"
        );
      }

      console.error(
        "ERROR UPDATE PEMBAYARAN SEWA:",
        error
      );

      return res.status(500).json({
        error:
          error.message
      });

    } finally {

      client.release();

    }
  }
);
// =====================================================
// UPDATE PRODUK & ORDER PROYEK SEWA
// PUT /api/proyek-sewa/:id/produk
// =====================================================

app.put(
  "/api/proyek-sewa/:id/produk",
  async (req, res) => {

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login."
      });

    }


    const proyekSewaId =
      Number(req.params.id);


    const produk =
      Array.isArray(
        req.body.produk
      )
        ? req.body.produk
        : [];


    if (
      !Number.isInteger(proyekSewaId) ||
      proyekSewaId <= 0
    ) {

      return res.status(400).json({
        error:
          "ID proyek sewa tidak valid."
      });

    }


    if (
      produk.length === 0
    ) {

      return res.status(400).json({
        error:
          "Minimal harus ada 1 produk."
      });

    }


    const client =
      await pool.connect();


    try {

      await client.query(
        "BEGIN"
      );


      // =============================================
      // LOCK PROYEK SEWA
      // =============================================

      const proyekResult =
        await client.query(
          `
            SELECT id
            FROM public.proyek_sewa
            WHERE id = $1
            FOR UPDATE
          `,
          [
            proyekSewaId
          ]
        );


      if (
        proyekResult.rowCount === 0
      ) {

        await client.query(
          "ROLLBACK"
        );


        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan."
        });

      }


      // =============================================
      // VALIDASI SEMUA DATA DULU
      // =============================================

      const dataProduk =
        [];


      for (
        let i = 0;
        i < produk.length;
        i++
      ) {

        const item =
          produk[i];


        const produkId =
          Number(
            item.produk_id
          );


        const durasiBulan =
          Number(
            item.durasi_bulan
          );


        const orders =
          Array.isArray(
            item.orders
          )
            ? item.orders
            : [];


        if (
          !Number.isInteger(produkId) ||
          produkId <= 0
        ) {

          throw new Error(
            `Produk ${i + 1} belum dipilih.`
          );

        }


        if (
          !Number.isFinite(durasiBulan) ||
          durasiBulan <= 0
        ) {

          throw new Error(
            `Durasi Produk ${i + 1} harus lebih dari 0 bulan.`
          );

        }


        if (
          orders.length === 0
        ) {

          throw new Error(
            `Produk ${i + 1} minimal memiliki 1 order.`
          );

        }


        // ===========================================
        // AMBIL MASTER PRODUK
        // Harga tidak dipercaya dari frontend
        // ===========================================

        const masterResult =
          await client.query(
            `
              SELECT
                mps.id,
                mps.item_produk,
                mps.harga_jual_per_item,
                mps.jenis_proyek_id,
                mps.sub_jenis_proyek_id,

                jp.name
                  AS jenis_proyek,

                sjp.name
                  AS sub_jenis_proyek

              FROM public.master_produk_sewa mps

              LEFT JOIN public.jenis_proyek jp
                ON jp.id =
                   mps.jenis_proyek_id

              LEFT JOIN public.jenis_proyek sjp
                ON sjp.id =
                   mps.sub_jenis_proyek_id

              WHERE mps.id = $1
            `,
            [
              produkId
            ]
          );


        if (
          masterResult.rowCount === 0
        ) {

          throw new Error(
            `Master Produk ${i + 1} tidak ditemukan.`
          );

        }


        const master =
          masterResult.rows[0];


        const hargaPerItem =
          Number(
            master.harga_jual_per_item
          ) || 0;


        if (
          hargaPerItem < 0
        ) {

          throw new Error(
            `Harga Produk ${i + 1} tidak valid.`
          );

        }


        const validOrders =
          [];


        // ===========================================
        // VALIDASI ORDER
        // ===========================================

        for (
          let j = 0;
          j < orders.length;
          j++
        ) {

          const order =
            orders[j];


          const cabangId =
            Number(
              order.cabang_id
            );


          const quantity =
            Number(
              order.quantity
            );


          if (
            !Number.isInteger(cabangId) ||
            cabangId <= 0
          ) {

            throw new Error(
              `Lokasi Order ${j + 1} pada Produk ${i + 1} belum dipilih.`
            );

          }


          if (
            !Number.isFinite(quantity) ||
            quantity <= 0
          ) {

            throw new Error(
              `Quantity Order ${j + 1} pada Produk ${i + 1} harus lebih dari 0.`
            );

          }


          // =========================================
          // CEK CABANG
          // =========================================

          const cabangResult =
            await client.query(
              `
                SELECT id
                FROM public.master_cabang
                WHERE id = $1
              `,
              [
                cabangId
              ]
            );


          if (
            cabangResult.rowCount === 0
          ) {

            throw new Error(
              `Lokasi Order ${j + 1} pada Produk ${i + 1} tidak ditemukan.`
            );

          }


          // =========================================
          // HITUNG SERVER SIDE
          // =========================================

          const hargaPerBulan =
            hargaPerItem *
            quantity;


          const totalHarga =
            hargaPerBulan *
            durasiBulan;


          validOrders.push({

            cabangId,

            quantity,

            hargaPerBulan,

            totalHarga

          });

        }


        dataProduk.push({

          produkId,

          hargaPerItem,

          jenisProyek:
            master.jenis_proyek ||
            "Sewa",

          subJenisProyek:
            master.sub_jenis_proyek ||
            null,

          durasiBulan,

          orders:
            validOrders

        });

      }


      // =============================================
      // HAPUS DATA PRODUK LAMA
      //
      // Order otomatis ikut terhapus jika FK
      // proyek_sewa_order -> proyek_sewa_produk
      // memakai ON DELETE CASCADE.
      // =============================================

      await client.query(
        `
          DELETE FROM public.proyek_sewa_produk
          WHERE proyek_sewa_id = $1
        `,
        [
          proyekSewaId
        ]
      );


      // =============================================
      // INSERT ULANG PRODUK
      // =============================================

      for (
        const item
        of dataProduk
      ) {

        const insertProduk =
          await client.query(
            `
              INSERT INTO public.proyek_sewa_produk
              (
                proyek_sewa_id,
                produk_id,
                harga_per_item,
                jenis_proyek,
                sub_jenis_proyek,
                durasi_bulan,
                created_at,
                updated_at
              )

              VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )

              RETURNING id
            `,
            [
              proyekSewaId,
              item.produkId,
              item.hargaPerItem,
              item.jenisProyek,
              item.subJenisProyek,
              item.durasiBulan
            ]
          );


        const proyekSewaProdukId =
          insertProduk.rows[0].id;


        // ===========================================
        // INSERT ORDER
        // ===========================================

        for (
          const order
          of item.orders
        ) {

          await client.query(
            `
              INSERT INTO public.proyek_sewa_order
              (
                proyek_sewa_produk_id,
                cabang_id,
                quantity,
                harga_per_bulan,
                total_harga,
                created_at,
                updated_at
              )

              VALUES
              (
                $1,
                $2,
                $3,
                $4,
                $5,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )
            `,
            [
              proyekSewaProdukId,
              order.cabangId,
              order.quantity,
              order.hargaPerBulan,
              order.totalHarga
            ]
          );

        }

      }


      // =============================================
      // HITUNG ULANG TOTAL DARI DATABASE
      // =============================================

      const totalResult =
        await client.query(
          `
            SELECT

              COALESCE(
                SUM(
                  pso.harga_per_bulan
                ),
                0
              )
                AS total_nilai_per_bulan,

              COALESCE(
                SUM(
                  pso.total_harga
                ),
                0
              )
                AS total_nilai

            FROM public.proyek_sewa_produk psp

            JOIN public.proyek_sewa_order pso
              ON pso.proyek_sewa_produk_id =
                 psp.id

            WHERE
              psp.proyek_sewa_id = $1
          `,
          [
            proyekSewaId
          ]
        );


      const totalPerBulan =
        Number(
          totalResult
            .rows[0]
            .total_nilai_per_bulan
        ) || 0;


      const totalNilai =
        Number(
          totalResult
            .rows[0]
            .total_nilai
        ) || 0;


      // =============================================
      // UPDATE HEADER PROYEK SEWA
      // =============================================

      await client.query(
        `
          UPDATE public.proyek_sewa

          SET
            total_nilai_per_bulan = $1,
            total_nilai = $2,
            updated_at = CURRENT_TIMESTAMP

          WHERE id = $3
        `,
        [
          totalPerBulan,
          totalNilai,
          proyekSewaId
        ]
      );


      await client.query(
        "COMMIT"
      );


      return res.json({

        message:
          "Produk & Order berhasil diperbarui.",

        total_nilai_per_bulan:
          totalPerBulan,

        total_nilai:
          totalNilai

      });


    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


      console.error(
        "ERROR UPDATE PRODUK ORDER SEWA:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });


    } finally {

      client.release();

    }

  }
);
// =====================================================
// PEMBAYARAN PARTNER SEWA
// =====================================================
app.put(
  "/api/proyek-sewa/:id/pembayaran-partner",
  async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    const proyekSewaId =
      Number(req.params.id);

    const pembayaran =
      Array.isArray(
        req.body.pembayaran
      )
        ? req.body.pembayaran
        : [];

    if (
      !Number.isInteger(proyekSewaId) ||
      proyekSewaId <= 0
    ) {
      return res.status(400).json({
        error:
          "ID proyek sewa tidak valid"
      });
    }

    const client =
      await pool.connect();

    try {
      await client.query("BEGIN");

      const proyekResult =
        await client.query(
          `
          SELECT
            ps.id,
            ps.proyek_partner_id,

            COALESCE(
              NULLIF(pp.nilai_nego_3, 0),
              NULLIF(pp.nilai_nego_2, 0),
              NULLIF(pp.nilai_nego_1, 0),
              NULLIF(pp.nilai_submit, 0),
              0
            )::numeric
              AS nilai_final_partner

          FROM public.proyek_sewa ps

          LEFT JOIN public.proyek_partner pp
            ON pp.id =
               ps.proyek_partner_id

          WHERE ps.id = $1

          FOR UPDATE OF ps
          `,
          [proyekSewaId]
        );

      if (proyekResult.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan"
        });
      }

      const proyekPartnerId =
        Number(
          proyekResult.rows[0]
            .proyek_partner_id
        );

      if (
        !Number.isInteger(
          proyekPartnerId
        ) ||
        proyekPartnerId <= 0
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "Pilih partner proyek sewa terlebih dahulu"
        });
      }

      const statusValid = [
        "Belum Dibayar",
        "Proses",
        "Sudah Dibayar"
      ];

      const dataValid = [];

      for (
        let index = 0;
        index < pembayaran.length;
        index += 1
      ) {
        const item =
          pembayaran[index] || {};

        const deskripsi =
          String(
            item.deskripsi || ""
          ).trim();

        const nominal =
          Number(
            item.nominal || 0
          );

        const status =
          String(
            item.status_pembayaran ||
            "Belum Dibayar"
          ).trim();

        const tanggalBayar =
          item.tanggal_bayar
            ? String(
                item.tanggal_bayar
              ).slice(0, 10)
            : null;

        const syarat =
          String(
            item.syarat_pembayaran ||
            ""
          ).trim() || null;

        if (
          !deskripsi &&
          nominal === 0 &&
          !tanggalBayar &&
          !syarat
        ) {
          continue;
        }

        if (!deskripsi) {
          throw new Error(
            `Deskripsi pembayaran partner ${index + 1} wajib diisi`
          );
        }

        if (
          !Number.isFinite(nominal) ||
          nominal < 0
        ) {
          throw new Error(
            `Nominal pembayaran partner ${index + 1} tidak valid`
          );
        }

        if (!statusValid.includes(status)) {
          throw new Error(
            `Status pembayaran partner ${index + 1} tidak valid`
          );
        }

        if (
          status === "Sudah Dibayar" &&
          !tanggalBayar
        ) {
          throw new Error(
            `Tanggal bayar partner ${index + 1} wajib diisi`
          );
        }

        dataValid.push({
          deskripsi,
          nominal,

          status_pembayaran:
            status,

          tanggal_bayar:
            status === "Sudah Dibayar"
              ? tanggalBayar
              : null,

          syarat_pembayaran:
            syarat
        });
      }

      await client.query(
        `
        DELETE FROM
          public.proyek_sewa_pembayaran_partner

        WHERE proyek_sewa_id = $1
          AND proyek_partner_id = $2
        `,
        [
          proyekSewaId,
          proyekPartnerId
        ]
      );

      const dataTersimpan = [];

      for (const item of dataValid) {
        const result =
          await client.query(
            `
            INSERT INTO
              public.proyek_sewa_pembayaran_partner
            (
              proyek_sewa_id,
              proyek_partner_id,
              deskripsi,
              nominal,
              status_pembayaran,
              tanggal_bayar,
              syarat_pembayaran
            )

            VALUES (
              $1, $2, $3, $4,
              $5, $6, $7
            )

            RETURNING *
            `,
            [
              proyekSewaId,
              proyekPartnerId,
              item.deskripsi,
              item.nominal,
              item.status_pembayaran,
              item.tanggal_bayar,
              item.syarat_pembayaran
            ]
          );

        dataTersimpan.push(
          result.rows[0]
        );
      }

      const totalDibayar =
        dataTersimpan
          .filter(
            item =>
              item.status_pembayaran ===
              "Sudah Dibayar"
          )
          .reduce(
            (total, item) =>
              total +
              Number(item.nominal || 0),
            0
          );

      const nilaiPartner =
        Number(
          proyekResult.rows[0]
            .nilai_final_partner || 0
        );

      await client.query(
        `
        UPDATE public.proyek_sewa
        SET updated_at =
          CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [proyekSewaId]
      );

      await client.query("COMMIT");

      return res.json({
        message:
          "Pembayaran partner berhasil diperbarui",

        pembayaran_partner:
          dataTersimpan,

        nilai_partner:
          nilaiPartner,

        total_dibayar_partner:
          totalDibayar,

        sisa_pembayaran_partner:
          Math.max(
            0,
            nilaiPartner -
            totalDibayar
          )
      });

    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "ERROR PEMBAYARAN PARTNER SEWA:",
        error
      );

      return res.status(500).json({
        error: error.message
      });

    } finally {
      client.release();
    }
  }
);

app.delete(
  "/api/proyek-sewa/:id",
  async (req, res) => {

    // =================================================
    // CEK LOGIN
    // =================================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login."
      });
    }


    const proyekSewaId =
      Number(req.params.id);


    // =================================================
    // VALIDASI ID
    // =================================================

    if (
      !Number.isInteger(proyekSewaId) ||
      proyekSewaId <= 0
    ) {
      return res.status(400).json({
        error:
          "ID proyek sewa tidak valid."
      });
    }


    const client =
      await pool.connect();


    try {

      await client.query("BEGIN");


      // =================================================
      // AMBIL DATA PROYEK SEWA
      // =================================================

      const proyekResult =
        await client.query(
          `
          SELECT
            ps.*

          FROM public.proyek_sewa ps

          WHERE ps.id = $1

          FOR UPDATE
          `,
          [proyekSewaId]
        );


      if (
        proyekResult.rowCount === 0
      ) {

        await client.query(
          "ROLLBACK"
        );


        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan."
        });
      }


      const proyekSewaLama =
        proyekResult.rows[0];


      // =================================================
      // HAPUS PEMBAYARAN KLIEN
      // =================================================

      await client.query(
        `
        DELETE FROM
          public.proyek_sewa_pembayaran

        WHERE proyek_sewa_id = $1
        `,
        [proyekSewaId]
      );


      // =================================================
      // HAPUS PEMBAYARAN PARTNER
      // =================================================

      await client.query(
        `
        DELETE FROM
          public.proyek_sewa_pembayaran_partner

        WHERE proyek_sewa_id = $1
        `,
        [proyekSewaId]
      );


      // =================================================
      // HAPUS DOKUMEN
      // =================================================

      await client.query(
        `
        DELETE FROM
          public.proyek_sewa_dokumen

        WHERE proyek_sewa_id = $1
        `,
        [proyekSewaId]
      );


      // =================================================
      // HAPUS DETAIL ITEM
      // Aktifkan hanya jika tabel ini tersedia
      // =================================================

      const tabelItemResult =
        await client.query(
          `
          SELECT
            TO_REGCLASS(
              'public.proyek_sewa_item'
            ) AS nama_tabel
          `
        );


      if (
        tabelItemResult.rows[0]
          .nama_tabel
      ) {

        await client.query(
          `
          DELETE FROM
            public.proyek_sewa_item

          WHERE proyek_sewa_id = $1
          `,
          [proyekSewaId]
        );
      }


      // =================================================
      // HAPUS HEADER PROYEK SEWA
      // =================================================

      const deleteResult =
        await client.query(
          `
          DELETE FROM public.proyek_sewa

          WHERE id = $1

          RETURNING *
          `,
          [proyekSewaId]
        );


      // =================================================
      // ACTIVITY LOG
      // =================================================

      if (
        typeof simpanActivityLog ===
        "function"
      ) {

        const activityUser =
          getActivityUser(req);


        await simpanActivityLog(
          client,
          {
            ...activityUser,

            aktivitas:
              "DELETE",

            modul:
              "PROYEK_SEWA",

            entity_id:
              proyekSewaLama.id,

            entity_nama:
              proyekSewaLama.nomor_rujukan ||
              `Proyek Sewa ${proyekSewaLama.id}`,

            field_name:
              null,

            nilai_lama:
              [
                `ID = ${proyekSewaLama.id}`,

                `Nomor Rujukan = ${
                  proyekSewaLama
                    .nomor_rujukan ||
                  "-"
                }`,

                `Jumlah = ${
                  proyekSewaLama.jumlah ||
                  proyekSewaLama.quantity ||
                  "-"
                }`,

                `Total Nilai = ${
                  proyekSewaLama
                    .total_nilai ||
                  0
                }`
              ].join(", "),

            nilai_baru:
              null,

            deskripsi:
              `menghapus Proyek Sewa ${
                proyekSewaLama
                  .nomor_rujukan ||
                proyekSewaLama.id
              }`
          }
        );
      }


      await client.query("COMMIT");


      return res.json({
        success: true,

        message:
          "Proyek sewa berhasil dihapus.",

        data:
          deleteResult.rows[0]
      });


    } catch (error) {

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (rollbackError) {

        console.error(
          "ERROR ROLLBACK DELETE PROYEK SEWA:",
          rollbackError
        );

      }


      console.error(
        "ERROR DELETE PROYEK SEWA:",
        error
      );


      if (
        error.code === "42P01"
      ) {
        return res.status(500).json({
          error:
            `Tabel terkait belum tersedia: ${error.message}`
        });
      }


      if (
        error.code === "23503"
      ) {
        return res.status(409).json({
          error:
            "Proyek sewa masih digunakan oleh data lain dan belum dapat dihapus."
        });
      }


      return res.status(500).json({
        error:
          error.message ||
          "Gagal menghapus proyek sewa."
      });


    } finally {

      client.release();

    }
  }
);
// =====================================================
// DOKUMEN PROYEK SEWA
// =====================================================
app.post(
  "/api/proyek-sewa/:proyekSewaId/dokumen",

  uploadDokumenKlien.single(
    "file_dokumen"
  ),

  async (req, res) => {
    let s3KeyBaru = null;

    try {
      if (!req.session?.user) {
        return res.status(401).json({
          error: "Belum login"
        });
      }

      const proyekSewaId =
        Number(
          req.params.proyekSewaId
        );

      const namaDokumen =
        String(
          req.body.nama_dokumen || ""
        ).trim();

      const nomorDokumen =
        String(
          req.body.nomor_dokumen || ""
        ).trim() || null;

      if (
        !Number.isInteger(proyekSewaId) ||
        proyekSewaId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID proyek sewa tidak valid"
        });
      }

      if (!namaDokumen) {
        return res.status(400).json({
          error:
            "Pilih dokumen terlebih dahulu"
        });
      }

      const proyekCheck =
        await pool.query(
          `
          SELECT id
          FROM public.proyek_sewa
          WHERE id = $1
          `,
          [proyekSewaId]
        );

      if (proyekCheck.rowCount === 0) {
        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan"
        });
      }

      let namaFileAsli = null;
      let namaFileSimpan = null;
      let pathFile = null;
      let tipeFile = null;
      let ukuranFile = null;

      if (req.file) {
        const ekstensi =
          path.extname(
            req.file.originalname
          ).toLowerCase();

        const namaFile =
          `${crypto.randomUUID()}` +
          `${ekstensi}`;

        const hasilUpload =
          await uploadFile(
            req.file,
            namaFile
          );

        s3KeyBaru =
          hasilUpload.key;

        namaFileAsli =
          req.file.originalname;

        namaFileSimpan =
          hasilUpload.key;

        pathFile =
          hasilUpload.key;

        tipeFile =
          req.file.mimetype;

        ukuranFile =
          req.file.size;
      }

      const result =
        await pool.query(
          `
          INSERT INTO public.proyek_sewa_dokumen (
            proyek_sewa_id,
            nama_dokumen,
            nomor_dokumen,
            nama_file_asli,
            nama_file_simpan,
            path_file,
            tipe_file,
            ukuran_file
          )

          VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8
          )

          RETURNING *
          `,
          [
            proyekSewaId,
            namaDokumen,
            nomorDokumen,
            namaFileAsli,
            namaFileSimpan,
            pathFile,
            tipeFile,
            ukuranFile
          ]
        );

      return res.status(201).json({
        message:
          "Dokumen proyek sewa berhasil ditambahkan",

        data:
          result.rows[0]
      });

    } catch (error) {
      if (s3KeyBaru) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket:
                process.env.bucket_name,

              Key:
                s3KeyBaru
            })
          );
        } catch (hapusError) {
          console.error(
            "GAGAL ROLLBACK FILE DOKUMEN SEWA:",
            hapusError
          );
        }
      }

      console.error(
        "ERROR TAMBAH DOKUMEN SEWA:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);

app.put(
  "/api/proyek-sewa/dokumen/:id",

  uploadDokumenKlien.single(
    "file_dokumen"
  ),

  async (req, res) => {
    let s3KeyBaru = null;
    let databaseBerhasil = false;

    try {
      if (!req.session?.user) {
        return res.status(401).json({
          error: "Belum login"
        });
      }

      const id =
        Number(req.params.id);

      const namaDokumen =
        String(
          req.body.nama_dokumen || ""
        ).trim();

      const nomorDokumen =
        String(
          req.body.nomor_dokumen || ""
        ).trim() || null;

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID dokumen tidak valid"
        });
      }

      if (!namaDokumen) {
        return res.status(400).json({
          error:
            "Pilih dokumen terlebih dahulu"
        });
      }

      const oldResult =
        await pool.query(
          `
          SELECT *
          FROM public.proyek_sewa_dokumen
          WHERE id = $1
          `,
          [id]
        );

      if (oldResult.rowCount === 0) {
        return res.status(404).json({
          error:
            "Dokumen proyek sewa tidak ditemukan"
        });
      }

      const dokumenLama =
        oldResult.rows[0];

      let namaFileAsli =
        dokumenLama.nama_file_asli;

      let namaFileSimpan =
        dokumenLama.nama_file_simpan;

      let pathFile =
        dokumenLama.path_file;

      let tipeFile =
        dokumenLama.tipe_file;

      let ukuranFile =
        dokumenLama.ukuran_file;

      if (req.file) {
        const ekstensi =
          path.extname(
            req.file.originalname
          ).toLowerCase();

        const namaFile =
          `${crypto.randomUUID()}` +
          `${ekstensi}`;

        const hasilUpload =
          await uploadFile(
            req.file,
            namaFile
          );

        s3KeyBaru =
          hasilUpload.key;

        namaFileAsli =
          req.file.originalname;

        namaFileSimpan =
          hasilUpload.key;

        pathFile =
          hasilUpload.key;

        tipeFile =
          req.file.mimetype;

        ukuranFile =
          req.file.size;
      }

      const result =
        await pool.query(
          `
          UPDATE public.proyek_sewa_dokumen

          SET
            nama_dokumen = $1,
            nomor_dokumen = $2,
            nama_file_asli = $3,
            nama_file_simpan = $4,
            path_file = $5,
            tipe_file = $6,
            ukuran_file = $7,
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $8

          RETURNING *
          `,
          [
            namaDokumen,
            nomorDokumen,
            namaFileAsli,
            namaFileSimpan,
            pathFile,
            tipeFile,
            ukuranFile,
            id
          ]
        );

      databaseBerhasil = true;

      if (
        req.file &&
        dokumenLama.path_file &&
        dokumenLama.path_file !==
          s3KeyBaru
      ) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket:
                process.env.bucket_name,

              Key:
                dokumenLama.path_file
            })
          );
        } catch (hapusError) {
          console.error(
            "GAGAL HAPUS FILE DOKUMEN SEWA LAMA:",
            hapusError
          );
        }
      }

      return res.json({
        message:
          "Dokumen proyek sewa berhasil diperbarui",

        data:
          result.rows[0]
      });

    } catch (error) {
      if (
        s3KeyBaru &&
        !databaseBerhasil
      ) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket:
                process.env.bucket_name,

              Key:
                s3KeyBaru
            })
          );
        } catch (hapusError) {
          console.error(
            "GAGAL ROLLBACK FILE BARU:",
            hapusError
          );
        }
      }

      console.error(
        "ERROR EDIT DOKUMEN SEWA:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);

// =====================================================
// LIHAT / UNDUH FILE DOKUMEN PROYEK SEWA
// =====================================================

app.get(
  "/api/proyek-sewa/dokumen/:id/file",
  async (req, res) => {
    try {

      // ==============================================
      // VALIDASI LOGIN
      // ==============================================

      if (!req.session?.user) {
        return res.status(401).json({
          error: "Belum login"
        });
      }

      // ==============================================
      // VALIDASI ID
      // ==============================================

      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID dokumen tidak valid"
        });
      }

      // ==============================================
      // AMBIL DATA DOKUMEN
      // ==============================================

      const dokumenResult =
        await pool.query(
          `
          SELECT
            id,
            proyek_sewa_id,
            nama_dokumen,
            nomor_dokumen,
            nama_file_asli,
            nama_file_simpan,
            path_file,
            tipe_file,
            ukuran_file

          FROM public.proyek_sewa_dokumen

          WHERE id = $1

          LIMIT 1
          `,
          [id]
        );

      if (
        dokumenResult.rowCount === 0
      ) {
        return res.status(404).json({
          error:
            "Dokumen proyek sewa tidak ditemukan"
        });
      }

      const dokumen =
        dokumenResult.rows[0];

      // ==============================================
      // AMBIL S3 KEY
      // ==============================================

      const s3Key =
        String(
          dokumen.path_file ||
          dokumen.nama_file_simpan ||
          ""
        ).trim();

      if (!s3Key) {
        return res.status(404).json({
          error:
            "File belum tersedia pada dokumen ini"
        });
      }

      // ==============================================
      // MODE LIHAT / UNDUH
      // ==============================================

      const download =
        ["1", "true", "yes", "ya"]
          .includes(
            String(
              req.query.download || ""
            )
              .trim()
              .toLowerCase()
          );

      // ==============================================
      // NAMA FILE ASLI
      // ==============================================

      const originalName =
        String(
          dokumen.nama_file_asli ||
          dokumen.nama_dokumen ||
          `dokumen-${dokumen.id}`
        ).trim();

      // ==============================================
      // BUAT PRESIGNED URL
      // ==============================================

      const fileUrl =
        await getFileLink(
          s3Key,
          {
            download,
            isPrivate: true,
            originalName
          }
        );

      if (!fileUrl) {
        return res.status(500).json({
          error:
            "Gagal membuat URL dokumen"
        });
      }

      console.log(
        "AKSES FILE DOKUMEN SEWA:",
        {
          dokumen_id:
            dokumen.id,

          proyek_sewa_id:
            dokumen.proyek_sewa_id,

          key:
            s3Key,

          mode:
            download
              ? "unduh"
              : "lihat"
        }
      );

      // Jangan simpan presigned URL pada cache browser.
      res.setHeader(
        "Cache-Control",
        "private, no-store, max-age=0"
      );

      // Redirect ke presigned URL S3.
      return res.redirect(
        302,
        fileUrl
      );

    } catch (error) {

      console.error(
        "ERROR AKSES FILE DOKUMEN SEWA:",
        {
          name:
            error?.name,

          code:
            error?.Code ||
            error?.code,

          message:
            error?.message,

          status:
            error?.$metadata
              ?.httpStatusCode,

          stack:
            error?.stack
        }
      );

      return res.status(500).json({
        error:
          error?.message ||
          "Gagal membuka file dokumen"
      });
    }
  }
);

app.delete(
  "/api/proyek-sewa/dokumen/:id",
  async (req, res) => {
    try {
      if (!req.session?.user) {
        return res.status(401).json({
          error: "Belum login"
        });
      }

      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          error:
            "ID dokumen tidak valid"
        });
      }

      const result =
        await pool.query(
          `
          DELETE FROM
            public.proyek_sewa_dokumen

          WHERE id = $1

          RETURNING *
          `,
          [id]
        );

      if (result.rowCount === 0) {
        return res.status(404).json({
          error:
            "Dokumen proyek sewa tidak ditemukan"
        });
      }

      const dokumenLama =
        result.rows[0];

      if (dokumenLama.path_file) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket:
                process.env.bucket_name,

              Key:
                dokumenLama.path_file
            })
          );
        } catch (hapusError) {
          console.error(
            "GAGAL HAPUS FILE DOKUMEN SEWA:",
            hapusError
          );
        }
      }

      return res.json({
        message:
          "Dokumen proyek sewa berhasil dihapus",

        data_lama:
          dokumenLama
      });

    } catch (error) {
      console.error(
        "ERROR HAPUS DOKUMEN SEWA:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);

// =====================================================
// -- BATAS API ACTIVITY LOG
// =====================================================

// =====================================================
// GET ACTIVITY LOG
// =====================================================

app.get(
  "/api/activity-log",
  async (req, res) => {

    if (
      !req.session ||
      !req.session.user
    ) {

      return res.status(401).json({
        error: "Belum login"
      });

    }


    try {

      const limitRaw =
        Number(req.query.limit) || 100;

      const limit =
        Math.min(
          Math.max(
            limitRaw,
            1
          ),
          500
        );


      const result =
        await pool.query(
          `
            SELECT
              al.id,
              al.pic_id,
              al.nama_pic,
              al.aktivitas,
              al.modul,
              al.entity_id,
              al.entity_nama,
              al.field_name,
              al.nilai_lama,
              al.nilai_baru,
              al.deskripsi,
              al.created_at

            FROM public.activity_log al

            ORDER BY
              al.created_at DESC,
              al.id DESC

            LIMIT $1
          `,
          [
            limit
          ]
        );


      return res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET ACTIVITY LOG:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    }

  }
);

app.get(
  "/api/proyek/:id/activity-log",
  async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    try {
      const proyekId =
        Number(req.params.id);

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {
        return res.status(400).json({
          error: "ID proyek tidak valid"
        });
      }

      const user =
        req.session.user;

      const isAdmin =
        String(user.role || "")
          .trim()
          .toLowerCase() ===
        "admin";

      // ================================================
      // CEK PROYEK DAN HAK AKSES
      // ================================================

      const proyekResult =
        await pool.query(
          `
            SELECT
              p.id,
              p.nama_proyek
            FROM public.proyek p
            WHERE p.id = $1
              AND (
                $2::boolean = TRUE

                OR EXISTS (
                  SELECT 1
                  FROM public.proyek_pic pp
                  WHERE pp.proyek_id = p.id
                    AND pp.pic_id = $3
                )
              )
            LIMIT 1
          `,
          [
            proyekId,
            isAdmin,
            Number(user.id)
          ]
        );

      if (proyekResult.rowCount === 0) {
        return res.status(404).json({
          error:
            "Proyek tidak ditemukan atau Anda tidak memiliki akses"
        });
      }

      // ================================================
      // AMBIL SELURUH LOG TERKAIT PROYEK
      // ================================================

      const logResult =
  await pool.query(
    `
      SELECT
        activity.*,

        COALESCE(
          NULLIF(
            BTRIM(pic.nama),
            ''
          ),
          'Sistem'
        ) AS dibuat_oleh

      FROM public.activity_log activity

      LEFT JOIN public.pic pic
        ON pic.id =
          activity.pic_id

      WHERE
        (
          activity.entity_id = $1

          AND UPPER(
            COALESCE(
              activity.modul,
              ''
            )
          ) <> 'TASK_LIST'
        )

        OR
        (
          UPPER(
            COALESCE(
              activity.modul,
              ''
            )
          ) = 'TASK_LIST'

          AND activity.entity_id IN (
            SELECT task.id
            FROM public.task_list task
            WHERE task.proyek_id = $1
          )
        )

      ORDER BY
        activity.created_at DESC,
        activity.id DESC
    `,
    [proyekId]
  );

      return res.json({
        proyek: proyekResult.rows[0],
        data: logResult.rows,
        total: logResult.rows.length
      });

    } catch (error) {
      console.error(
        "ERROR GET ACTIVITY LOG PROYEK:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);
// =====================================================
// S3 
// =====================================================
const uploadS3 =
  multer({

    storage:
      multer.memoryStorage(),

    limits: {

      fileSize:
        10 * 1024 * 1024

    }

  });
// ======================================================
// -- BATAS API KONTRAK
// ======================================================

app.get(
  "/api/kontrak",
  async (req, res) => {
    // ================================================
    // VALIDASI LOGIN
    // ================================================

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    // ================================================
    // PAGINATION
    // ================================================

    const page =
      Math.max(
        Number(req.query.page) || 1,
        1
      );

    const limit =
      Math.min(
        Math.max(
          Number(req.query.limit) || 20,
          1
        ),
        100
      );

    const offset =
      (page - 1) * limit;

    // ================================================
    // FILTER PENCARIAN
    // ================================================

    const search =
      String(
        req.query.search || ""
      ).trim();

    // ================================================
    // FILTER JENIS
    // ================================================

    const jenisInput =
      String(
        req.query.jenis || ""
      ).trim();

    const jenis =
      [
        "Klien",
        "Partner"
      ].includes(jenisInput)
        ? jenisInput
        : "";

    // ================================================
    // FILTER STATUS
    // ================================================

    const statusInput =
      String(
        req.query.status || ""
      )
        .trim()
        .toLowerCase();

    const status =
      [
        "berjalan",
        "berakhir",
        "selesai"
      ].includes(statusInput)
        ? statusInput
        : "";

    // ================================================
    // FILTER PERIODE
    // ================================================

    const periodeInput =
      String(
        req.query.periode || ""
      )
        .trim()
        .toLowerCase();

    const periode =
      periodeInput === "3-bulan"
        ? "3-bulan"
        : "";

    // ================================================
    // INFORMASI LOGIN
    // ================================================

    const user =
      req.session.user;

    const isAdmin =
      String(user.role || "")
        .trim()
        .toLowerCase() === "admin";

    const picIdInput =
      Number(user.id);

    const picId =
      Number.isInteger(picIdInput)
        ? picIdInput
        : 0;

    try {
      const result =
        await pool.query(
          `
          WITH kontrak AS (
            /*
             * =========================================
             * KONTRAK KLIEN
             * =========================================
             */
            SELECT
              'Klien'::text
                AS jenis_relasi,

              pk.id
                AS kontrak_id,

              p.id
                AS proyek_id,

              p.nama_proyek,

              p.status_final,

              d.perusahaan_klien
                AS nama_relasi,

              pk.tanggal_mulai::date
                AS tanggal_mulai,

              pk.tanggal_akhir::date
                AS tanggal_akhir

            FROM public.proyek_klien pk

            INNER JOIN public.proyek p
              ON p.id =
                pk.proyek_id

            LEFT JOIN public.data d
              ON d.id =
                pk.klien_id

            WHERE
              $7::boolean = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic akses_pic

                WHERE
                  akses_pic.proyek_id =
                    p.id

                  AND akses_pic.pic_id =
                    $8
              )

            UNION ALL

            /*
             * =========================================
             * KONTRAK PARTNER
             * =========================================
             */
            SELECT
              'Partner'::text
                AS jenis_relasi,

              pp.id
                AS kontrak_id,

              p.id
                AS proyek_id,

              p.nama_proyek,

              p.status_final,

              partner.nama_partner
                AS nama_relasi,

              pp.tanggal_mulai::date
                AS tanggal_mulai,

              pp.tanggal_akhir::date
                AS tanggal_akhir

            FROM public.proyek_partner pp

            INNER JOIN public.proyek p
              ON p.id =
                pp.proyek_id

            LEFT JOIN public.partner partner
              ON partner.id =
                pp.partner_id

            WHERE
              $7::boolean = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic akses_pic

                WHERE
                  akses_pic.proyek_id =
                    p.id

                  AND akses_pic.pic_id =
                    $8
              )
          ),

          /*
           * ===========================================
           * NORMALISASI STATUS KONTRAK
           * ===========================================
           */
          kontrak_status AS (
            SELECT
              kontrak.*,

              LOWER(
                BTRIM(
                  COALESCE(
                    kontrak.status_final,
                    ''
                  )
                )
              ) AS status_final_normal,

              CASE
                /*
                 * Status final Done/Selesai
                 * diprioritaskan dari tanggal akhir.
                 */
                WHEN
                  LOWER(
                    BTRIM(
                      COALESCE(
                        kontrak.status_final,
                        ''
                      )
                    )
                  ) IN (
                    'done',
                    'selesai'
                  )
                THEN
                  'selesai'

                /*
                 * Tanggal akhir belum diisi.
                 */
                WHEN
                  kontrak.tanggal_akhir
                    IS NULL
                THEN
                  'belum_ditentukan'

                /*
                 * Tanggal akhir sudah lewat.
                 */
                WHEN
                  kontrak.tanggal_akhir <
                    CURRENT_DATE
                THEN
                  'berakhir'

                /*
                 * Tanggal akhir masih berjalan.
                 */
                ELSE
                  'berjalan'
              END AS status_kontrak,

              CASE
                /*
                 * Kontrak selesai tidak perlu
                 * menghitung sisa hari.
                 */
                WHEN
                  LOWER(
                    BTRIM(
                      COALESCE(
                        kontrak.status_final,
                        ''
                      )
                    )
                  ) IN (
                    'done',
                    'selesai'
                  )
                THEN NULL

                WHEN
                  kontrak.tanggal_akhir
                    IS NULL
                THEN NULL

                ELSE
                  (
                    kontrak.tanggal_akhir -
                    CURRENT_DATE
                  )::int
              END AS sisa_hari

            FROM kontrak
          ),

          /*
           * ===========================================
           * FILTER DATA
           * ===========================================
           */
          kontrak_filter AS (
            SELECT
              *

            FROM kontrak_status

            WHERE
              /*
              * FILTER PENCARIAN
              */
              (
                $1 = ''

                OR nama_proyek
                  ILIKE '%' || $1 || '%'

                OR nama_relasi
                  ILIKE '%' || $1 || '%'
              )

              /*
              * FILTER KLIEN/PARTNER
              */
              AND (
                $2 = ''

                OR jenis_relasi =
                  $2
              )

              /*
              * FILTER STATUS KONTRAK
              */
              AND (
                $3 = ''

                OR status_kontrak =
                  $3
              )

              /*
              * FILTER PERIODE TIGA BULAN
              */
              AND (
                $4 = ''

                OR (
                  $4 = '3-bulan'

                  AND status_kontrak =
                    'berjalan'

                  AND tanggal_akhir
                    IS NOT NULL

                  AND tanggal_akhir >=
                    CURRENT_DATE

                  AND tanggal_akhir <=
                    CURRENT_DATE +
                    INTERVAL '3 months'
                )
              )

              /*
              * SAMAKAN DENGAN CONTRACT OVERVIEW.
              *
              * Filter berjalan, berakhir, dan tiga bulan
              * hanya menghitung proyek Status Final Aktif.
              *
              * Status selesai tetap mengambil Final Done.
              */
              AND (
                NOT (
                  $3 IN (
                    'berjalan',
                    'berakhir'
                  )

                  OR $4 = '3-bulan'
                )

                OR status_final_normal =
                  'aktif'
              )
          )

          /*
           * ===========================================
           * HASIL AKHIR
           * ===========================================
           */
          SELECT
            jenis_relasi,
            kontrak_id,
            proyek_id,
            nama_proyek,
            status_final,
            nama_relasi,
            tanggal_mulai,
            tanggal_akhir,
            status_kontrak,
            sisa_hari,

            CASE
              /*
               * Status final Done/Selesai.
               */
              WHEN
                status_kontrak =
                  'selesai'
              THEN
                'Kontrak Telah Selesai'

              /*
               * Tanggal akhir belum diisi.
               */
              WHEN
                tanggal_akhir IS NULL
              THEN
                'Belum ditentukan'

              /*
               * Tanggal akhir sudah lewat.
               */
              WHEN
                tanggal_akhir <
                  CURRENT_DATE
              THEN
                'Telah Berakhir'

              /*
               * Tanggal akhir hari ini.
               */
              WHEN
                tanggal_akhir =
                  CURRENT_DATE
              THEN
                'Berakhir Hari Ini'

              /*
               * Tanggal akhir masih berjalan.
               */
              ELSE
                (
                  tanggal_akhir -
                  CURRENT_DATE
                )::text ||
                ' hari lagi'
            END AS berakhir_pada,

            COUNT(*) OVER()
              AS total_data

          FROM kontrak_filter

          ORDER BY
            /*
             * Kontrak berjalan ditampilkan
             * lebih dahulu.
             */
            CASE status_kontrak
              WHEN 'berjalan'
                THEN 1

              WHEN 'belum_ditentukan'
                THEN 2

              WHEN 'selesai'
                THEN 3

              WHEN 'berakhir'
                THEN 4

              ELSE 5
            END,

            /*
             * Tanggal akhir terdekat.
             */
            tanggal_akhir ASC
              NULLS LAST,

            nama_proyek ASC,

            jenis_relasi ASC

          LIMIT $5
          OFFSET $6
          `,
          [
            /*
             * $1
             */
            search,

            /*
             * $2
             */
            jenis,

            /*
             * $3
             */
            status,

            /*
             * $4
             */
            periode,

            /*
             * $5
             */
            limit,

            /*
             * $6
             */
            offset,

            /*
             * $7
             */
            isAdmin,

            /*
             * $8
             */
            picId
          ]
        );

      // ================================================
      // TOTAL DATA
      // ================================================

      const totalData =
        result.rows.length > 0
          ? Number(
              result.rows[0]
                .total_data || 0
            )
          : 0;

      // ================================================
      // NORMALISASI RESPONSE
      // ================================================

      const data =
        result.rows.map(item => {
          const {
            total_data,
            ...kontrak
          } = item;

          return {
            ...kontrak,

            kontrak_id:
              Number(
                kontrak.kontrak_id
              ),

            proyek_id:
              Number(
                kontrak.proyek_id
              ),

            sisa_hari:
              kontrak.sisa_hari === null ||
              kontrak.sisa_hari === undefined
                ? null
                : Number(
                    kontrak.sisa_hari
                  )
          };
        });

      // ================================================
      // RESPONSE
      // ================================================

      return res.json({
        data,

        filter: {
          search,
          jenis,
          status,
          periode
        },

        pagination: {
          page,
          limit,

          total_data:
            totalData,

          total_pages:
            Math.max(
              Math.ceil(
                totalData / limit
              ),
              1
            )
        }
      });

    } catch (error) {
      console.error(
        "ERROR GET KONTRAK:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);

// =====================================================
// GET DETAIL PENGELUARAN
//
// SUMBER DATA:
// 1. public.proyek_partner_termin
// 2. public.proyek_sewa_pembayaran_partner
//
// DEFAULT:
// - Tahun berjalan
// - Status sudah dibayar
// =====================================================

app.get(
  "/api/pengeluaran/detail",
  async (req, res) => {

    // =================================================
    // VALIDASI LOGIN
    // =================================================

    if (
      !req.session ||
      !req.session.user
    ) {

      return res.status(401).json({
        error: "Belum login"
      });

    }


    try {

      const user =
        req.session.user;


      const isAdmin =
        String(
          user.role || ""
        )
          .trim()
          .toLowerCase() ===
        "admin";


      const picId =
        Number(
          user.id
        );


      // =================================================
      // TAHUN SUMMARY
      // =================================================

      const tahunQuery =
        Number(
          req.query.tahun
        );


      const tahunSekarang =
        new Date()
          .getFullYear();


      const tahun =
        Number.isInteger(
          tahunQuery
        ) &&
        tahunQuery >= 2000 &&
        tahunQuery <= 2100

          ? tahunQuery

          : tahunSekarang;


      // =================================================
      // QUERY PENGELUARAN
      // =================================================

      const result =
        await pool.query(
          `
          WITH pengeluaran_proyek AS (

            /*
             * ===========================================
             * PENGELUARAN PROYEK REGULER / TRANSAKSI
             * SUMBER: proyek_partner_termin
             * ===========================================
             */

            SELECT
              termin.id::bigint
                AS id,

              termin.id::bigint
                AS termin_id,

              NULL::bigint
                AS pembayaran_id,

              partner_proyek.proyek_id::bigint
                AS proyek_id,

              NULL::bigint
                AS proyek_sewa_id,

              proyek.nama_proyek,

              NULL::text
                AS nomor_pr,

              master_partner.id::bigint
                AS partner_id,

              master_partner.nama_partner,

              COALESCE(
                proyek.jenis_proyek,
                'Reguler'
              )::text
                AS jenis_proyek,

              proyek.sub_jenis_proyek,

              'Proyek'::text
                AS sumber,

              termin.nama_termin,

              COALESCE(
                termin.nama_termin,
                '-'
              )::text
                AS deskripsi,

              termin.persentase,

              /*
               * Jika nominal termin tersedia,
               * gunakan nominal termin.
               *
               * Jika nominal kosong tetapi persentase ada,
               * hitung dari nilai final partner.
               */

              COALESCE(
                NULLIF(
                  termin.nominal,
                  0
                ),

                CASE
                  WHEN
                    COALESCE(
                      termin.persentase,
                      0
                    ) > 0
                  THEN
                    (
                      COALESCE(
                        NULLIF(
                          partner_proyek.nilai_nego_3,
                          0
                        ),

                        NULLIF(
                          partner_proyek.nilai_nego_2,
                          0
                        ),

                        NULLIF(
                          partner_proyek.nilai_nego_1,
                          0
                        ),

                        NULLIF(
                          partner_proyek.nilai_submit,
                          0
                        ),

                        0
                      )
                      *
                      termin.persentase
                      /
                      100
                    )

                  ELSE 0
                END,

                0
              )::numeric
                AS nominal,

              COALESCE(
                NULLIF(
                  termin.nominal,
                  0
                ),

                CASE
                  WHEN
                    COALESCE(
                      termin.persentase,
                      0
                    ) > 0
                  THEN
                    (
                      COALESCE(
                        NULLIF(
                          partner_proyek.nilai_nego_3,
                          0
                        ),

                        NULLIF(
                          partner_proyek.nilai_nego_2,
                          0
                        ),

                        NULLIF(
                          partner_proyek.nilai_nego_1,
                          0
                        ),

                        NULLIF(
                          partner_proyek.nilai_submit,
                          0
                        ),

                        0
                      )
                      *
                      termin.persentase
                      /
                      100
                    )

                  ELSE 0
                END,

                0
              )::numeric
                AS nilai_pengeluaran,

              /*
               * Normalisasi status proyek partner:
               *
               * dibayar / lunas
               * menjadi Sudah Dibayar
               *
               * proses
               * menjadi Proses
               *
               * selainnya
               * menjadi Belum Dibayar
               */

              CASE

                WHEN LOWER(
                  BTRIM(
                    REGEXP_REPLACE(
                      COALESCE(
                        termin.status_pembayaran,
                        ''
                      ),
                      '\\s+',
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
                THEN 'Sudah Dibayar'

                WHEN LOWER(
                  BTRIM(
                    REGEXP_REPLACE(
                      COALESCE(
                        termin.status_pembayaran,
                        ''
                      ),
                      '\\s+',
                      ' ',
                      'g'
                    )
                  )
                ) IN (
                  'proses',
                  'diproses',
                  'processing'
                )
                THEN 'Proses'

                ELSE 'Belum Dibayar'

              END::text
                AS status_pembayaran,

              termin.status_pembayaran::text
                AS status_pembayaran_asli,

              termin.tanggal_jatuh_tempo,

              termin.tanggal_bayar,

              termin.syarat_pembayaran,

              COALESCE(
                termin.tanggal_bayar::date,
                termin.tanggal_jatuh_tempo::date,
                termin.created_at::date
              ) AS tanggal_acuan,

              termin.created_at,
              termin.updated_at

            FROM public.proyek_partner_termin termin

            INNER JOIN public.proyek_partner partner_proyek
              ON partner_proyek.id =
                 termin.proyek_partner_id

            INNER JOIN public.proyek proyek
              ON proyek.id =
                 partner_proyek.proyek_id

            LEFT JOIN public.partner master_partner
              ON master_partner.id =
                 partner_proyek.partner_id

            WHERE
              $1::boolean = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic akses_pic

                WHERE
                  akses_pic.proyek_id =
                    partner_proyek.proyek_id

                  AND akses_pic.pic_id =
                    $2
              )
          ),


          pengeluaran_proyek_sewa AS (

            /*
             * ===========================================
             * PENGELUARAN PROYEK SEWA
             * SUMBER: proyek_sewa_pembayaran_partner
             * ===========================================
             */

            SELECT
              pembayaran.id::bigint
                AS id,

              NULL::bigint
                AS termin_id,

              pembayaran.id::bigint
                AS pembayaran_id,

              sewa.proyek_id::bigint
                AS proyek_id,

              sewa.id::bigint
                AS proyek_sewa_id,

              /*
               * Pada listing pengeluaran,
               * proyek sewa ditampilkan menggunakan
               * nomor PR.
               */

              COALESCE(
                NULLIF(
                  BTRIM(
                    sewa.nomor_pr
                  ),
                  ''
                ),

                proyek.nama_proyek,

                '-'
              )::text
                AS nama_proyek,

              sewa.nomor_pr,

              master_partner.id::bigint
                AS partner_id,

              master_partner.nama_partner,

              'Sewa'::text
                AS jenis_proyek,

              proyek.sub_jenis_proyek,

              'Proyek Sewa'::text
                AS sumber,

              NULL::text
                AS nama_termin,

              COALESCE(
                pembayaran.deskripsi,
                '-'
              )::text
                AS deskripsi,

              NULL::numeric
                AS persentase,

              COALESCE(
                pembayaran.nominal,
                0
              )::numeric
                AS nominal,

              COALESCE(
                pembayaran.nominal,
                0
              )::numeric
                AS nilai_pengeluaran,

              /*
               * Normalisasi status pembayaran sewa:
               *
               * sudah dibayar / dibayar
               * menjadi Sudah Dibayar
               *
               * proses
               * menjadi Proses
               *
               * selainnya
               * menjadi Belum Dibayar
               */

              CASE

                WHEN LOWER(
                  BTRIM(
                    REGEXP_REPLACE(
                      COALESCE(
                        pembayaran.status_pembayaran,
                        ''
                      ),
                      '\\s+',
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
                THEN 'Sudah Dibayar'

                WHEN LOWER(
                  BTRIM(
                    REGEXP_REPLACE(
                      COALESCE(
                        pembayaran.status_pembayaran,
                        ''
                      ),
                      '\\s+',
                      ' ',
                      'g'
                    )
                  )
                ) IN (
                  'proses',
                  'diproses',
                  'processing'
                )
                THEN 'Proses'

                ELSE 'Belum Dibayar'

              END::text
                AS status_pembayaran,

              pembayaran.status_pembayaran::text
                AS status_pembayaran_asli,

              NULL::date
                AS tanggal_jatuh_tempo,

              pembayaran.tanggal_bayar,

              pembayaran.syarat_pembayaran,

              COALESCE(
                pembayaran.tanggal_bayar::date,
                pembayaran.created_at::date
              ) AS tanggal_acuan,

              pembayaran.created_at,
              pembayaran.updated_at

            FROM public.proyek_sewa_pembayaran_partner pembayaran

            INNER JOIN public.proyek_sewa sewa
              ON sewa.id =
                 pembayaran.proyek_sewa_id

            LEFT JOIN public.proyek proyek
              ON proyek.id =
                 sewa.proyek_id

            LEFT JOIN public.proyek_partner partner_proyek
              ON partner_proyek.id =
                 pembayaran.proyek_partner_id

            LEFT JOIN public.partner master_partner
              ON master_partner.id =
                 partner_proyek.partner_id

            WHERE
              $1::boolean = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic akses_pic

                WHERE
                  akses_pic.proyek_id =
                    sewa.proyek_id

                  AND akses_pic.pic_id =
                    $2
              )
          ),


          semua_pengeluaran AS (

            SELECT *
            FROM pengeluaran_proyek

            UNION ALL

            SELECT *
            FROM pengeluaran_proyek_sewa

          )


          SELECT
            id,
            termin_id,
            pembayaran_id,
            proyek_id,
            proyek_sewa_id,
            nama_proyek,
            nomor_pr,
            partner_id,

            COALESCE(
              nama_partner,
              '-'
            ) AS nama_partner,

            jenis_proyek,
            sub_jenis_proyek,
            sumber,
            nama_termin,
            deskripsi,
            persentase,
            nominal,
            nilai_pengeluaran,
            status_pembayaran,
            status_pembayaran_asli,
            tanggal_jatuh_tempo,
            tanggal_bayar,
            tanggal_acuan,
            syarat_pembayaran,
            created_at,
            updated_at

          FROM semua_pengeluaran

          ORDER BY
            tanggal_bayar DESC NULLS LAST,
            tanggal_acuan DESC NULLS LAST,
            created_at DESC,
            id DESC
          `,
          [
            isAdmin,
            picId
          ]
        );


      // =================================================
      // SUMMARY TAHUN TERPILIH
      // =================================================

      const dataTahun =
        result.rows.filter(
          item => {

            const tanggal =
              item.tanggal_acuan;

            if (!tanggal) {
              return false;
            }

            const tahunData =
              Number(
                String(
                  tanggal
                ).slice(
                  0,
                  4
                )
              );

            return (
              tahunData ===
              tahun
            );

          }
        );


      const sudahDibayar =
        dataTahun.filter(
          item =>
            item.status_pembayaran ===
            "Sudah Dibayar" &&
            item.tanggal_bayar
        );


      const belumDibayar =
        dataTahun.filter(
          item =>
            item.status_pembayaran ===
            "Belum Dibayar"
        );


      const proses =
        dataTahun.filter(
          item =>
            item.status_pembayaran ===
            "Proses"
        );


      const hitungTotal =
        data =>
          data.reduce(
            (
              total,
              item
            ) =>
              total +
              Number(
                item.nilai_pengeluaran ||
                item.nominal ||
                0
              ),

            0
          );


      // =================================================
      // RESPONSE
      // =================================================

      return res.json({

        pengeluaran:
          result.rows,

        summary: {

          tahun,

          /*
           * Total pengeluaran hanya mengambil
           * pembayaran dengan status sudah dibayar
           * dan memiliki tanggal bayar pada
           * tahun terpilih.
           */

          total_pengeluaran:
            hitungTotal(
              sudahDibayar
            ),

          total_belum_dibayar:
            hitungTotal(
              belumDibayar
            ),

          total_proses:
            hitungTotal(
              proses
            ),

          termin_dibayar:
            sudahDibayar.length,

          termin_belum_dibayar:
            belumDibayar.length +
            proses.length,

          jumlah_data:
            dataTahun.length

        }

      });

    } catch (error) {

      console.error(
        "ERROR GET DETAIL PENGELUARAN:",
        error
      );


      return res.status(500).json({
        error:
          error.message
      });

    }

  }
);

// =====================================================
// TOTAL PENGELUARAN PER BULAN
// =====================================================
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

// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server berjalan di port ${PORT}`);
});





  