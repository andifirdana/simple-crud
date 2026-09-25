
const path = require("path");
const pool = require("./db");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");

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

const folderDokumenKlien =
  path.join(
    __dirname,
    "uploads",
    "dokumen-klien"
  );

if (
  !fs.existsSync(folderDokumenKlien)
) {
  fs.mkdirSync(
    folderDokumenKlien,
    {
      recursive: true
    }
  );
}

const storageDokumenKlien =
  multer.diskStorage({
    destination: (
      req,
      file,
      callback
    ) => {
      callback(
        null,
        folderDokumenKlien
      );
    },

    filename: (
      req,
      file,
      callback
    ) => {
      const ekstensi =
        path
          .extname(file.originalname)
          .toLowerCase();

      const namaFile =
        `${Date.now()}-${crypto.randomUUID()}${ekstensi}`;

      callback(
        null,
        namaFile
      );
    }
  });

const tipeDokumenDiizinkan = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png"
];

const uploadDokumenKlien =
  multer({
    storage:
      storageDokumenKlien,

    limits: {
      fileSize:
        10 * 1024 * 1024
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
app.post("/api/partner", 
  async (req, res) => {
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


    if (!nama_partner) {

      return res.status(400).json({
        error: "Nama Partner wajib diisi"
      });

    }


    const result = await pool.query(
      `INSERT INTO partner (
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
      RETURNING *`,
      [
        nama_partner,
        inisial,
        jenis_partner,
        nama_pic,
        no_pic,
        email_pic,
        alamat,
        status || "Aktif"
      ]
    );


    res.status(201).json(
      result.rows[0]
    );


  } catch (error) {

    console.error(
      "ERROR CREATE PARTNER:",
      error
    );


    res.status(500).json({
      error: error.message
    });

  }
});

// UPDATE PARTNER
app.put("/api/partner/:id", 
  async (req, res) => {
  try {

    const { id } = req.params;


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


    const result = await pool.query(
      `UPDATE partner
       SET nama_partner = $1,
           inisial = $2,
           jenis_partner = $3,
           nama_pic = $4,
           no_pic = $5,
           email_pic = $6,
           alamat = $7,
           status = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        nama_partner,
        inisial,
        jenis_partner,
        nama_pic,
        no_pic,
        email_pic,
        alamat,
        status,
        id
      ]
    );


    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Data partner tidak ditemukan"
      });

    }


    res.json(result.rows[0]);


  } catch (error) {

    console.error(
      "ERROR UPDATE PARTNER:",
      error
    );


    res.status(500).json({
      error: error.message
    });

  }
});

// DELETE PARTNER
app.delete("/api/partner/:id", 
  async (req, res) => {
  try {

    const { id } = req.params;


    const result = await pool.query(
      `DELETE FROM partner
       WHERE id = $1
       RETURNING *`,
      [id]
    );


    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Data partner tidak ditemukan"
      });

    }


    res.json({
      message: "Data partner berhasil dihapus"
    });


  } catch (error) {

    console.error(
      "ERROR DELETE PARTNER:",
      error
    );


    res.status(500).json({
      error: error.message
    });

  }
});



// ======================================================
// IMPOR MASTER KLIEN
// ======================================================


app.post("/api/data/import", 
  async (req, res) => {
  const client = await pool.connect();

  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        error: "Data import tidak ditemukan"
      });
    }

    await client.query("BEGIN");

    let total = 0;

    for (const item of data) {
      let no_pic = item.no_pic
        ? String(item.no_pic).trim()
        : "";

      no_pic = no_pic.replace(/[\s\-()]/g, "");

      if (no_pic.startsWith("+62")) {
        no_pic = no_pic.substring(1);
      }

      if (no_pic.startsWith("0")) {
        no_pic = "62" + no_pic.substring(1);
      }

      if (
        !item.perusahaan_klien ||
        !String(item.perusahaan_klien).trim()
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
        VALUES ($1, $2, $3, $4, $5)`,
        [
          String(item.perusahaan_klien).trim(),

          item.inisial
            ? String(item.inisial).trim()
            : null,

          item.nama_pic
            ? String(item.nama_pic).trim()
            : null,

          no_pic || null,

          item.email_pic
            ? String(item.email_pic).trim()
            : null
        ]
      );

      total++;
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "Import berhasil",
      total: total
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("ERROR IMPORT KLIEN:", error);

    res.status(500).json({
      error: error.message
    });

  } finally {
    client.release();
  }
});


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
// TAMPILAN DASHBOARD
// ======================================================
// ======================================================
// DASHBOARD UTAMA
// ======================================================

app.get(
  "/api/dashboard",
  async (req, res) => {
    try {
      // ================================================
      // LOGIN
      // ================================================

      if (
        !req.session ||
        !req.session.user
      ) {
        return res.status(401).json({
          error:
            "Belum login"
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


      // ================================================
      // PROJECTS
      // ================================================

      const proyekResult =
        await pool.query(
          `
          SELECT
            p.id AS proyek_id,
            p.nama_proyek,
            p.deskripsi,
            p.jenis_proyek,
            p.sub_jenis_proyek,
            p.status_final,
            p.created_at,
            p.updated_at,

            kategori.kategori,
            kategori.kategori_list,

            klien.proyek_klien_id,
            klien.klien_id,
            klien.nama_klien,
            klien.tanggal_mulai,
            klien.tanggal_akhir,
            klien.status_pengadaan,
            klien.status_teknis,
            klien.model_pembayaran,
            klien.nilai_klien,

            COALESCE(
              partner.nilai_partner,
              0
            ) AS nilai_partner,

            COALESCE(
              partner.nama_partner,
              ''
            ) AS nama_partner,

            COALESCE(
              pic.nama_pic,
              ''
            ) AS nama_pic,

            COALESCE(
              pic.nama_pic_list,
              ARRAY[]::TEXT[]
            ) AS nama_pic_list,

            COALESCE(
              pic.pic_ids,
              ARRAY[]::INTEGER[]
            ) AS pic_ids

          FROM public.proyek p


          -- ============================================
          -- KATEGORI
          -- ============================================

          LEFT JOIN LATERAL (
            SELECT
              MIN(
                kp.nama_kategori_produk
              ) AS kategori,

              ARRAY_AGG(
                DISTINCT
                kp.nama_kategori_produk
                ORDER BY
                kp.nama_kategori_produk
              ) AS kategori_list

            FROM public.proyek_kategori pkategori

            INNER JOIN public.kategori_produk kp
              ON kp.id =
                pkategori.kategori_produk_id

            WHERE
              pkategori.proyek_id =
                p.id
          ) kategori
            ON TRUE


          -- ============================================
          -- KLIEN TERBARU
          -- ============================================

          LEFT JOIN LATERAL (
            SELECT
              pk.id AS proyek_klien_id,
              pk.klien_id,
              d.perusahaan_klien
                AS nama_klien,

              pk.tanggal_mulai,
              pk.tanggal_akhir,
              pk.status_pengadaan,
              pk.status_teknis,
              pk.model_pembayaran,

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

                      FROM public.proyek_klien_termin pkt

                      WHERE
                        pkt.proyek_klien_id =
                          pk.id
                    ),
                    0
                  )
              END AS nilai_klien

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


          -- ============================================
          -- PARTNER
          -- ============================================

          LEFT JOIN LATERAL (
            SELECT
              STRING_AGG(
                DISTINCT
                pr.nama_partner,
                ', '
                ORDER BY
                pr.nama_partner
              ) AS nama_partner,

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

                        FROM public.proyek_partner_termin ppt

                        WHERE
                          ppt.proyek_partner_id =
                            pp.id
                      ),
                      0
                    )
                END
              ) AS nilai_partner

            FROM public.proyek_partner pp

            LEFT JOIN public.partner pr
              ON pr.id =
                pp.partner_id

            WHERE
              pp.proyek_id =
                p.id
          ) partner
            ON TRUE


          -- ============================================
          -- PIC
          -- ============================================

          LEFT JOIN LATERAL (
            SELECT
              MIN(
                master_pic.nama
              ) AS nama_pic,

              ARRAY_AGG(
                DISTINCT
                master_pic.nama
                ORDER BY
                master_pic.nama
              ) AS nama_pic_list,

              ARRAY_AGG(
                DISTINCT
                master_pic.id
                ORDER BY
                master_pic.id
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

          ORDER BY
            p.id DESC
          `,
          [
            isAdmin,
            picId
          ]
        );


      const projects =
        proyekResult.rows.map(item => ({
          ...item,

          proyek_id:
            Number(item.proyek_id),

          nilai_klien:
            Number(
              item.nilai_klien ||
              0
            ),

          nilai_partner:
            Number(
              item.nilai_partner ||
              0
            )
        }));


      const proyekIds =
        projects.map(
          item =>
            item.proyek_id
        );


      // ================================================
      // JIKA TIDAK ADA PROYEK
      // ================================================

      if (proyekIds.length === 0) {
        return res.json({
          projects: [],
          revenue: [],
          forecast: [],
          termins: [],
          timelines: [],
          progress: [],
          tasks: [],
          workload: [],
          attention: []
        });
      }


      // ================================================
      // TERMIN KLIEN DAN PARTNER
      // ================================================

      const terminResult =
        await pool.query(
          `
          SELECT
            p.id AS proyek_id,
            p.nama_proyek,

            'Klien'::TEXT AS pihak,

            pkt.id AS termin_id,
            pkt.nama_termin,
            pkt.persentase,
            pkt.nominal,
            pkt.status_pembayaran,
            pkt.tanggal_jatuh_tempo,
            pkt.tanggal_bayar,

            COALESCE(
              NULLIF(
                pkt.nominal,
                0
              ),

              (
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
                COALESCE(
                  pkt.persentase,
                  0
                )
                /
                100
              ),

              0
            ) AS nilai_termin

          FROM public.proyek_klien_termin pkt

          INNER JOIN public.proyek_klien pk
            ON pk.id =
              pkt.proyek_klien_id

          INNER JOIN public.proyek p
            ON p.id =
              pk.proyek_id

          WHERE
            p.id =
              ANY($1::INTEGER[])


          UNION ALL


          SELECT
            p.id AS proyek_id,
            p.nama_proyek,

            'Partner'::TEXT AS pihak,

            ppt.id AS termin_id,
            ppt.nama_termin,
            ppt.persentase,
            ppt.nominal,
            ppt.status_pembayaran,
            ppt.tanggal_jatuh_tempo,
            ppt.tanggal_bayar,

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
            ) AS nilai_termin

          FROM public.proyek_partner_termin ppt

          INNER JOIN public.proyek_partner pp
            ON pp.id =
              ppt.proyek_partner_id

          INNER JOIN public.proyek p
            ON p.id =
              pp.proyek_id

          WHERE
            p.id =
              ANY($1::INTEGER[])

          ORDER BY
            tanggal_jatuh_tempo ASC
              NULLS LAST
          `,
          [proyekIds]
        );


      const termins =
        terminResult.rows.map(item => ({
          ...item,

          proyek_id:
            Number(item.proyek_id),

          termin_id:
            Number(item.termin_id),

          nominal:
            Number(
              item.nilai_termin ||
              item.nominal ||
              0
            ),

          persentase:
            Number(
              item.persentase ||
              0
            )
        }));


      // ================================================
      // PENDAPATAN AKTUAL BULANAN
      // ================================================

      const revenueMap =
        new Map();

      termins
        .filter(item =>
          String(
            item.pihak
          ).toLowerCase() ===
            "klien" &&

          (
            item.tanggal_bayar ||

            [
              "dibayar",
              "sudah dibayar",
              "lunas",
              "paid"
            ].includes(
              String(
                item.status_pembayaran ||
                ""
              )
                .trim()
                .toLowerCase()
            )
          )
        )
        .forEach(item => {
          if (!item.tanggal_bayar) {
            return;
          }

          const date =
            new Date(
              item.tanggal_bayar
            );

          if (
            Number.isNaN(
              date.getTime()
            )
          ) {
            return;
          }

          const key =
            `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;

          const nilaiSebelumnya =
            revenueMap.get(key) || {
              tahun:
                date.getUTCFullYear(),

              bulan:
                date.getUTCMonth() + 1,

              nilai:
                0
            };

          nilaiSebelumnya.nilai +=
            Number(
              item.nominal ||
              0
            );

          revenueMap.set(
            key,
            nilaiSebelumnya
          );
        });


      const revenue =
        [...revenueMap.values()];


      // ================================================
      // PROGNOSA BULANAN
      // Termin klien yang belum dibayar
      // ================================================

      const forecastMap =
        new Map();

      termins
        .filter(item => {
          const status =
            String(
              item.status_pembayaran ||
              ""
            )
              .trim()
              .toLowerCase();

          return (
            String(
              item.pihak
            ).toLowerCase() ===
              "klien" &&

            ![
              "dibayar",
              "sudah dibayar",
              "lunas",
              "paid"
            ].includes(status)
          );
        })
        .forEach(item => {
          if (
            !item.tanggal_jatuh_tempo
          ) {
            return;
          }

          const date =
            new Date(
              item.tanggal_jatuh_tempo
            );

          if (
            Number.isNaN(
              date.getTime()
            )
          ) {
            return;
          }

          const key =
            `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;

          const nilaiSebelumnya =
            forecastMap.get(key) || {
              tahun:
                date.getUTCFullYear(),

              bulan:
                date.getUTCMonth() + 1,

              nilai:
                0
            };

          nilaiSebelumnya.nilai +=
            Number(
              item.nominal ||
              0
            );

          forecastMap.set(
            key,
            nilaiSebelumnya
          );
        });


      const forecast =
        [...forecastMap.values()];


      // ================================================
      // TIMELINE
      // ================================================

      let timelines = [];

      try {
        const timelineResult =
          await pool.query(
            `
            SELECT
              pt.id,
              pt.proyek_id,
              p.nama_proyek,
              pt.deskripsi,
              pt.tanggal_mulai,
              pt.tanggal_akhir,
              pt.status,

              (
                pt.tanggal_akhir -
                CURRENT_DATE
              ) AS sisa_hari

            FROM public.proyek_timeline pt

            INNER JOIN public.proyek p
              ON p.id =
                pt.proyek_id

            WHERE
              pt.proyek_id =
                ANY($1::INTEGER[])

            ORDER BY
              pt.tanggal_akhir ASC
                NULLS LAST
            `,
            [proyekIds]
          );

        timelines =
          timelineResult.rows.map(
            item => {
              const sisaHari =
                Number(
                  item.sisa_hari
                );

              let berakhirDalam =
                "-";

              if (
                Number.isFinite(
                  sisaHari
                )
              ) {
                if (sisaHari < 0) {
                  berakhirDalam =
                    "Sudah berakhir";
                } else if (
                  sisaHari === 0
                ) {
                  berakhirDalam =
                    "Hari ini";
                } else {
                  berakhirDalam =
                    `${sisaHari} hari`;
                }
              }

              return {
                ...item,

                proyek_id:
                  Number(
                    item.proyek_id
                  ),

                berakhir_dalam:
                  berakhirDalam
              };
            }
          );

      } catch (timelineError) {
        console.error(
          "ERROR TIMELINE DASHBOARD:",
          timelineError.message
        );

        timelines = [];
      }


      // ================================================
      // ATTENTION
      // ================================================

      const attention = [];


      // Proyek tanpa klien

      projects
        .filter(item =>
          !item.proyek_klien_id
        )
        .forEach(item => {
          attention.push({
            proyek_id:
              item.proyek_id,

            nama_proyek:
              item.nama_proyek,

            judul:
              `${item.nama_proyek} belum memiliki klien`,

            deskripsi:
              "Tambahkan data klien agar nilai dan termin dapat dihitung.",

            level:
              "warning",

            label:
              "Klien"
          });
        });


      // Margin negatif

      projects
        .filter(item =>
          Number(item.nilai_partner) >
          Number(item.nilai_klien)
        )
        .forEach(item => {
          attention.push({
            proyek_id:
              item.proyek_id,

            nama_proyek:
              item.nama_proyek,

            judul:
              `${item.nama_proyek} memiliki margin negatif`,

            deskripsi:
              `Nilai partner ${formatAngkaDashboard(
                item.nilai_partner
              )} lebih besar daripada nilai klien ${formatAngkaDashboard(
                item.nilai_klien
              )}.`,

            level:
              "danger",

            label:
              "Margin"
          });
        });


      // Termin lewat jatuh tempo

      const hariIni =
        new Date();

      hariIni.setHours(
        0,
        0,
        0,
        0
      );

      termins
        .filter(item => {
          if (
            !item.tanggal_jatuh_tempo
          ) {
            return false;
          }

          const sudahDibayar =
            [
              "dibayar",
              "sudah dibayar",
              "lunas",
              "paid"
            ].includes(
              String(
                item.status_pembayaran ||
                ""
              )
                .trim()
                .toLowerCase()
            );

          const jatuhTempo =
            new Date(
              item.tanggal_jatuh_tempo
            );

          return (
            !sudahDibayar &&
            jatuhTempo < hariIni
          );
        })
        .forEach(item => {
          attention.push({
            proyek_id:
              item.proyek_id,

            nama_proyek:
              item.nama_proyek,

            judul:
              `${item.nama_termin} melewati jatuh tempo`,

            deskripsi:
              `${item.nama_proyek} • ${item.pihak}`,

            level:
              "danger",

            label:
              "Terlambat"
          });
        });


      // Timeline akan berakhir

      timelines
        .filter(item =>
          Number(item.sisa_hari) >= 0 &&
          Number(item.sisa_hari) <= 30
        )
        .forEach(item => {
          attention.push({
            proyek_id:
              item.proyek_id,

            nama_proyek:
              item.nama_proyek,

            judul:
              `${item.nama_proyek} akan berakhir`,

            deskripsi:
              item.berakhir_dalam,

            level:
              "warning",

            label:
              "Timeline"
          });
        });


      // ================================================
      // RESPONSE
      // Progress dan task sementara array kosong.
      // Dapat diisi setelah nama tabel dipastikan.
      // ================================================

      return res.json({
        projects,
        revenue,
        forecast,
        termins,
        timelines,

        progress: [],
        tasks: [],
        workload: [],

        attention
      });

    } catch (error) {
      console.error(
        "ERROR DASHBOARD:",
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
// API PROYEK
// ======================================================


// ======================================================
// MASTER DATA FORM PROYEK
// ======================================================

// KATEGORI AKTIF
// ======================================================
// MASTER DATA FORM PROYEK
// ======================================================


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
    try {
      // ================================================
      // VALIDASI LOGIN
      // ================================================

      if (
        !req.session ||
        !req.session.user
      ) {
        return res.status(401).json({
          error:
            "Belum login"
        });
      }


      const user =
        req.session.user;


      // ================================================
      // ROLE DAN PIC ID
      // Karena login langsung dari tabel public.pic,
      // user.id adalah PIC ID.
      // ================================================

      const role =
        String(
          user.role || ""
        )
          .trim()
          .toLowerCase();


      const isAdmin =
        role === "admin" ||
        role === "administrator";


      const picId =
        Number(user.id);


      if (
        !isAdmin &&
        (
          !Number.isInteger(picId) ||
          picId <= 0
        )
      ) {
        return res.status(403).json({
          error:
            "Data PIC pada session tidak valid"
        });
      }


      console.log(
        "AKSES DAFTAR PROYEK:",
        {
          user_id:
            user.id,

          nama:
            user.nama,

          role:
            user.role,

          is_admin:
            isAdmin,

          pic_id:
            picId
        }
      );


      // ================================================
      // QUERY DAFTAR PROYEK
      // ================================================

      const result =
        await pool.query(
          `
          SELECT
            p.id,
            p.id AS proyek_id,
            p.nama_proyek,
            p.deskripsi,
            p.jenis_proyek,
            p.sub_jenis_proyek,
            p.status_final,
            p.created_at,
            p.updated_at,

            -- ==========================================
            -- KATEGORI
            -- ==========================================

            COALESCE(
              kategori.nama_kategori_produk,
              kategori_legacy.nama_kategori_produk
            ) AS nama_kategori_produk,

            COALESCE(
              kategori.nama_kategori_produk_list,

              CASE
                WHEN
                  kategori_legacy
                    .nama_kategori_produk
                    IS NOT NULL

                THEN ARRAY[
                  kategori_legacy
                    .nama_kategori_produk
                ]

                ELSE
                  ARRAY[]::TEXT[]
              END
            ) AS nama_kategori_produk_list,

            COALESCE(
              kategori.kategori_produk_ids,

              CASE
                WHEN
                  p.kategori_produk_id
                    IS NOT NULL

                THEN ARRAY[
                  p.kategori_produk_id
                ]

                ELSE
                  ARRAY[]::INTEGER[]
              END
            ) AS kategori_produk_ids,


            -- ==========================================
            -- KLIEN
            -- ==========================================

            klien.proyek_klien_id,
            klien.klien_id,
            klien.perusahaan_klien,
            klien.tanggal_mulai
              AS tanggal_mulai_klien,
            klien.tanggal_akhir
              AS tanggal_akhir_klien,
            klien.model_pembayaran
              AS model_pembayaran_klien,
            klien.status_pengadaan
              AS status_pengadaan_klien,
            klien.status_teknis
              AS status_teknis_klien,

            COALESCE(
              klien.nilai_final_klien,
              0
            ) AS nilai_final_klien,

            COALESCE(
              klien.nilai_final_klien,
              0
            ) AS nilai_proyek,


            -- ==========================================
            -- PARTNER
            -- ==========================================

            COALESCE(
              partner.nama_partner,
              ''
            ) AS nama_partner,

            COALESCE(
              partner.nilai_partner,
              0
            ) AS nilai_partner,


            -- ==========================================
            -- MARGIN
            -- ==========================================

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
                  *
                  100
                )

              ELSE 0
            END AS margin_persen,


            -- ==========================================
            -- PIC
            -- ==========================================

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
            ) AS pic_ids


          FROM public.proyek p


          // ============================================
          // KATEGORI LEGACY
          // ============================================

          LEFT JOIN public.kategori_produk
            kategori_legacy

            ON kategori_legacy.id =
              p.kategori_produk_id


          // ============================================
          // SELURUH KATEGORI PROYEK
          // ============================================

          LEFT JOIN LATERAL (
            SELECT
              MIN(
                kp.nama_kategori_produk
              ) AS nama_kategori_produk,

              ARRAY_AGG(
                DISTINCT
                kp.nama_kategori_produk

                ORDER BY
                  kp.nama_kategori_produk
              ) AS nama_kategori_produk_list,

              ARRAY_AGG(
                DISTINCT
                kp.id

                ORDER BY
                  kp.id
              ) AS kategori_produk_ids

            FROM public.proyek_kategori pkategori

            INNER JOIN public.kategori_produk kp
              ON kp.id =
                pkategori.kategori_produk_id

            WHERE
              pkategori.proyek_id =
                p.id
          ) kategori
            ON TRUE


          // ============================================
          // KLIEN TERBARU
          // ============================================

          LEFT JOIN LATERAL (
            SELECT
              pk.id AS proyek_klien_id,
              pk.klien_id,
              d.perusahaan_klien,
              pk.tanggal_mulai,
              pk.tanggal_akhir,
              pk.model_pembayaran,
              pk.status_pengadaan,
              pk.status_teknis,

              CASE
                -- Nilai final submit/nego tersedia
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


                -- Jika nilai submit/nego kosong,
                -- gunakan total nominal termin
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

                      FROM public.proyek_klien_termin pkt

                      WHERE
                        pkt.proyek_klien_id =
                          pk.id
                    ),
                    0
                  )
              END AS nilai_final_klien

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


          // ============================================
          // PARTNER
          // ============================================

          LEFT JOIN LATERAL (
            SELECT
              STRING_AGG(
                DISTINCT
                partner_data.nama_partner,
                ', '

                ORDER BY
                  partner_data.nama_partner
              ) AS nama_partner,

              SUM(
                partner_data.nilai_final_partner
              ) AS nilai_partner

            FROM (
              SELECT
                pp.id AS proyek_partner_id,

                pr.nama_partner,

                CASE
                  -- Nilai submit/nego tersedia
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


                  -- Jika nilai submit/nego kosong,
                  -- gunakan total nominal termin partner
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

                        FROM public
                          .proyek_partner_termin ppt

                        WHERE
                          ppt.proyek_partner_id =
                            pp.id
                      ),
                      0
                    )
                END AS nilai_final_partner

              FROM public.proyek_partner pp

              LEFT JOIN public.partner pr
                ON pr.id =
                  pp.partner_id

              WHERE
                pp.proyek_id =
                  p.id
            ) partner_data
          ) partner
            ON TRUE


          // ============================================
          // PIC PROYEK
          // ============================================

          LEFT JOIN LATERAL (
            SELECT
              STRING_AGG(
                DISTINCT
                master_pic.nama,
                ', '

                ORDER BY
                  master_pic.nama
              ) AS nama_pic,

              ARRAY_AGG(
                DISTINCT
                master_pic.nama

                ORDER BY
                  master_pic.nama
              ) AS nama_pic_list,

              ARRAY_AGG(
                DISTINCT
                master_pic.id

                ORDER BY
                  master_pic.id
              ) AS pic_ids

            FROM public.proyek_pic pp_pic

            INNER JOIN public.pic master_pic
              ON master_pic.id =
                pp_pic.pic_id

            WHERE
              pp_pic.proyek_id =
                p.id
          ) daftar_pic
            ON TRUE


          // ============================================
          // FILTER AKSES BERDASARKAN PIC
          // ============================================

          WHERE
            (
              $1::BOOLEAN = TRUE

              OR EXISTS (
                SELECT 1

                FROM public.proyek_pic auth_pic

                WHERE
                  auth_pic.proyek_id =
                    p.id

                  AND auth_pic.pic_id =
                    $2
              )
            )


          ORDER BY
            p.id DESC
          `,
          [
            isAdmin,
            picId
          ]
        );


      // ================================================
      // NORMALISASI RESPONSE
      // ================================================

      const rows =
        result.rows.map(item => ({
          ...item,

          id:
            Number(item.id),

          proyek_id:
            Number(item.proyek_id),

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

          nilai_final_klien:
            Number(
              item.nilai_final_klien ||
              0
            ),

          nilai_proyek:
            Number(
              item.nilai_proyek ||
              0
            ),

          nilai_partner:
            Number(
              item.nilai_partner ||
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


      console.log(
        "DAFTAR PROYEK BERHASIL:",
        {
          nama_user:
            user.nama,

          role:
            user.role,

          jumlah_proyek:
            rows.length
        }
      );


      return res.json(rows);

    } catch (error) {
      console.error(
        "ERROR READ PROYEK:",
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
// CREATE PROYEK
// ======================================================
app.post(
  "/api/proyek",
  async (req, res) => {

    const client =
      await pool.connect();


    try {

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
      // ==================================================

      if (
        Array.isArray(pic_ids)
      ) {

        const uniquePicIds =
          [
            ...new Set(

              pic_ids

                .map(Number)

                .filter(
                  id =>
                    Number.isInteger(id) &&
                    id > 0
                )

            )
          ];


        for (
          const picId
          of uniquePicIds
        ) {

          await client.query(
            `
              INSERT INTO public.proyek_pic
              (
                proyek_id,
                pic_id
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
              picId
            ]
          );

        }

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
      // SELESAI
      // ==================================================

      await client.query(
        "COMMIT"
      );


      res.status(201).json({

        message:
          "Proyek berhasil ditambahkan",

        id:
          proyek.id,

        proyek

      });


    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


      console.error(
        "ERROR CREATE PROYEK:",
        error
      );


      res
        .status(
          error.statusCode || 500
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

// ======================================================
// HAPUS PROYEK
// ======================================================

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
      if (error.code === "23503") {
        return res.status(409).json({
          error:
            "Proyek belum dapat dihapus karena masih mempunyai data terkait.",

          constraint:
            error.constraint || null,

          detail:
            error.detail || null
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
// ======================================================
// DAFTAR PROYEK
// ======================================================

app.get(
  "/api/proyek-listing",
  async (req, res) => {

    // ==================================================
    // LOGIN
    // ==================================================

    if (
      !req.session ||
      !req.session.user
    ) {
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


    const picId =
      Number(user.id);


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


            /* =========================
               KATEGORI PROYEK
            ========================= */

            COALESCE(
              kategori.nama_kategori_produk,
              '-'
            ) AS nama_kategori_produk,

            COALESCE(
              kategori.nama_kategori_produk_list,
              ARRAY[]::TEXT[]
            ) AS nama_kategori_produk_list,


            /* =========================
               INFORMASI KLIEN
            ========================= */

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


            /* =========================
               INFORMASI PARTNER
            ========================= */

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


            /* =========================
               MARGIN NOMINAL
            ========================= */

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


            /* =========================
               MARGIN PERSEN
            ========================= */

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


          /* =========================
             MULTI KATEGORI
          ========================= */

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


          /* =========================
             DATA KLIEN TERBARU
          ========================= */

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


              /* =====================
                 NILAI FINAL KLIEN
              ===================== */

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


          /* =========================
             MULTI PARTNER
          ========================= */

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


              /* =====================
                 TOTAL NILAI PARTNER
              ===================== */

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


          /* =========================
             FILTER BERDASARKAN PIC
          ========================= */

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


          ORDER BY
            p.created_at DESC,
            p.id DESC
          `,
          [
            isAdmin,
            picId
          ]
        );


      // ==================================================
      // KONVERSI NUMERIC POSTGRESQL
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


      return res
        .status(500)
        .json({
          error:
            error.message
        });

    }

  }
);
// ======================================================
// DETAIL PROYEK
// ======================================================

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

// ======================================================
// EDIT TERMIN KLIEN
// ======================================================

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

      transaksiDimulai =
        true;

      // ================================================
      // AMBIL TERMIN DAN PROYEK KLIEN
      // ================================================

      const terminResult =
        await client.query(
          `
          SELECT
            id,
            proyek_klien_id
          FROM public.proyek_klien_termin
          WHERE id = $1
          FOR UPDATE
          `,
          [terminId]
        );

      if (terminResult.rowCount === 0) {
        await client.query("ROLLBACK");

        transaksiDimulai =
          false;

        return res.status(404).json({
          error:
            "Termin klien tidak ditemukan"
        });
      }

      const proyekKlienId =
        Number(
          terminResult
            .rows[0]
            .proyek_klien_id
        );

      // ================================================
      // AMBIL NILAI FINAL KLIEN
      // ================================================

      const nilaiFinalAsli =
        await getNilaiFinalAsliKlien(
          client,
          proyekKlienId
        );

      if (nilaiFinalAsli === null) {
        await client.query("ROLLBACK");

        transaksiDimulai =
          false;

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

      // ================================================
      // JIKA NILAI FINAL SUDAH TERSEDIA
      // ================================================

      if (nilaiFinalAsli > 0) {
        if (input_terakhir === "nominal") {
          if (
            !Number.isFinite(
              nilaiNominal
            ) ||
            nilaiNominal <= 0
          ) {
            await client.query(
              "ROLLBACK"
            );

            transaksiDimulai =
              false;

            return res.status(400).json({
              error:
                "Nominal termin harus lebih dari Rp 0"
            });
          }

          nilaiPersentase =
            nilaiNominal /
            nilaiFinalAsli *
            100;

        } else {
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

            transaksiDimulai =
              false;

            return res.status(400).json({
              error:
                "Persentase harus lebih dari 0 dan maksimal 100%"
            });
          }

          nilaiNominal =
            nilaiFinalAsli *
            nilaiPersentase /
            100;
        }

        nilaiPersentase =
          Number(
            nilaiPersentase.toFixed(2)
          );

        nilaiNominal =
          Number(
            nilaiNominal.toFixed(2)
          );

        // ==============================================
        // TOTAL TERMIN LAIN, KECUALI TERMIN YANG DIEDIT
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

          transaksiDimulai =
            false;

          return res.status(400).json({
            error:
              `Total persentase termin tidak boleh lebih dari 100%. ` +
              `Total termin lain ${totalPersentaseLain.toFixed(2)}%.`
          });
        }

      } else {
        // ================================================
        // NILAI FINAL BELUM TERSEDIA
        // ================================================

        if (
          !Number.isFinite(
            nilaiNominal
          ) ||
          nilaiNominal <= 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          transaksiDimulai =
            false;

          return res.status(400).json({
            error:
              "Nilai final belum tersedia. Isi nominal termin."
          });
        }

        nilaiNominal =
          Number(
            nilaiNominal.toFixed(2)
          );

        nilaiPersentase =
          null;
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
      // JIKA NILAI FINAL KOSONG, HITUNG ULANG SEMUA %
      // ================================================

      let nilaiFinalEfektif =
        nilaiFinalAsli;

      if (nilaiFinalAsli <= 0) {
        nilaiFinalEfektif =
          await hitungUlangPersentaseKlien(
            client,
            proyekKlienId
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

      await client.query("COMMIT");

      transaksiDimulai =
        false;

      console.log(
        "TERMIN KLIEN DIPERBARUI:",
        hasilResult.rows[0]
      );

      return res.json({
        message:
          "Termin klien berhasil diperbarui",

        nilai_final_asli:
          nilaiFinalAsli,

        nilai_final:
          nilaiFinalEfektif,

        data:
          hasilResult.rows[0]
      });

    } catch (error) {
      if (transaksiDimulai) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch (
          rollbackError
        ) {
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

    // ======================================================
    // DELETE TERMIN KLIEN
    // ======================================================

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

    // UPDATE CHECKLIST DOKUMEN
    app.put("/api/proyek/klien/dokumen/:id/check",
      async (req, res) => {

        try {

          const { id } = req.params;
          const { is_checked } = req.body;


          const checked =
            is_checked === true;


          const result = await pool.query(`
            UPDATE public.proyek_klien_dokumen

            SET
              is_checked = $1,

              checked_at =
                CASE
                  WHEN $1 = TRUE
                  THEN CURRENT_TIMESTAMP
                  ELSE NULL
                END,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE id = $2

            RETURNING *
          `, [
            checked,
            id
          ]);


          if (result.rows.length === 0) {

            return res.status(404).json({
              error: "Dokumen tidak ditemukan"
            });

          }


          res.json(
            result.rows[0]
          );


        } catch (error) {

          console.error(
            "ERROR CHECK DOKUMEN KLIEN:",
            error
          );

          res.status(500).json({
            error: error.message
          });

        }

      }
    );


    // DELETE DOKUMEN
    app.delete("/api/proyek/klien/dokumen/:id",
      async (req, res) => {

        try {

          const { id } = req.params;


          const result = await pool.query(`
            DELETE FROM public.proyek_klien_dokumen
            WHERE id = $1
            RETURNING *
          `, [id]);


          if (result.rows.length === 0) {

            return res.status(404).json({
              error: "Dokumen tidak ditemukan"
            });

          }


          res.json({
            message:
              "Dokumen berhasil dihapus"
          });


        } catch (error) {

          console.error(
            "ERROR DELETE DOKUMEN KLIEN:",
            error
          );

          res.status(500).json({
            error: error.message
          });

        }

      }
    );
    // ------------------------------------------
    // 5. DOKUMEN KLIEN
    // ------------------------------------------

    // ==========================================
// 5. DOKUMEN KLIEN
// ==========================================

let dokumenKlien = [];

if (klien) {
  const dokumenResult =
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
        ukuran_file,

        is_checked,
        checked_at

      FROM public.proyek_klien_dokumen

      WHERE proyek_klien_id = $1

      ORDER BY id ASC
      `,
      [
        klien.proyek_klien_id
      ]
    );

  dokumenKlien =
    dokumenResult.rows;
}

    // ------------------------------------------
    // 6. PARTNER
    // ------------------------------------------

    const partnerResult =
  await pool.query(
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

      const terminResult =
  await pool.query(
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
      syarat_pembayaran

    FROM public.proyek_partner_termin

    WHERE proyek_partner_id = $1

    ORDER BY id ASC
    `,
    [
      partner.proyek_partner_id
    ]
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
        is_checked,
        checked_at,
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

// ======================================================
// TAMBAH TERMIN KLIEN
// ======================================================

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
        await client.query("ROLLBACK");

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

      if (!nama_termin?.trim()) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "Nama termin wajib diisi"
        });
      }

      // ================================================
      // AMBIL NILAI FINAL ASLI
      // ================================================

      const nilaiFinalAsli =
        await getNilaiFinalAsliKlien(
          client,
          proyekKlienId
        );

      if (nilaiFinalAsli === null) {
        await client.query("ROLLBACK");

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

      let persentaseSimpan = null;
      let nominalSimpan = null;

      // ================================================
      // NILAI FINAL ASLI TERSEDIA
      // ================================================

      if (nilaiFinalAsli > 0) {
        if (
          input_terakhir ===
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
            persentaseInput;

          nominalSimpan =
            Math.round(
              (
                nilaiFinalAsli *
                persentaseSimpan
              ) / 100
            );

        } else {
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

          persentaseSimpan =
          (
            nominalSimpan /
            nilaiFinalAsli
          ) * 100;

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
        // VALIDASI TOTAL PERSENTASE
        // ==============================================

        const totalResult =
          await client.query(
            `
            SELECT
              COALESCE(
                SUM(persentase),
                0
              )::numeric AS total_persentase
            FROM public.proyek_klien_termin
            WHERE proyek_klien_id = $1
            `,
            [proyekKlienId]
          );

        const totalPersentase =
          Number(
            totalResult.rows[0]
              .total_persentase || 0
          );

        if (
          totalPersentase +
          persentaseSimpan >
          100
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error:
              `Total persentase termin tidak boleh lebih dari 100%. ` +
              `Saat ini ${totalPersentase.toFixed(2)}%.`
          });
        }

      } else {
        // ==============================================
        // NILAI FINAL TIDAK ADA
        // HANYA NOMINAL YANG BOLEH DIISI
        // ==============================================

        if (
          !Number.isFinite(
            nominalInput
          ) ||
          nominalInput <= 0
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            error:
              "Karena nilai final belum tersedia, nominal termin wajib diisi"
          });
        }

        nominalSimpan =
          nominalInput;

        /*
         * Penting:
         * Jangan simpan persentase 0.
         * Simpan NULL dahulu, kemudian helper akan
         * menghitung ulang setelah INSERT.
         */
        persentaseSimpan = null;
      }

      // ================================================
      // INSERT TERMIN
      // ================================================

      const result =
        await client.query(
          `
          INSERT INTO public.proyek_klien_termin (
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

            /*
             * Nilainya harus NULL atau lebih dari 0.
             * Jangan menggunakan persentase || 0.
             */
            persentaseSimpan,

            nominalSimpan,

            status_pembayaran ||
              "Belum Dibayar",

            tanggal_jatuh_tempo ||
              null,

            tanggal_bayar ||
              null,

            syarat_pembayaran?.trim() ||
              null
          ]
        );

      // ================================================
      // HITUNG ULANG PERSENTASE
      // ================================================

      const perhitungan =
        await hitungUlangPersentaseKlien(
          client,
          proyekKlienId
        );

      // Ambil kembali hasil setelah dihitung ulang
      const terminBaruResult =
        await client.query(
          `
          SELECT *
          FROM public.proyek_klien_termin
          WHERE id = $1
          `,
          [result.rows[0].id]
        );

      await client.query("COMMIT");

      return res.status(201).json({
        message:
          "Termin berhasil ditambahkan",

        data:
          terminBaruResult.rows[0],

        nilai_final:
          perhitungan.nilai_final,

        sumber_nilai_final:
          perhitungan.sumber
      });

    } catch (error) {
      await client.query("ROLLBACK");

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
// DOKUMEN KLIEN
// ======================================================

// ======================================================
// TAMBAH DOKUMEN KLIEN
// ======================================================
app.post(
  "/api/proyek/klien/:proyekKlienId/dokumen",

  uploadDokumenKlien.single(
    "file_dokumen"
  ),

  async (req, res) => {
    try {
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
        !Number.isInteger(
          proyekKlienId
        ) ||
        proyekKlienId <= 0
      ) {
        if (
          req.file &&
          fs.existsSync(
            req.file.path
          )
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

        return res.status(400).json({
          error:
            "ID proyek klien tidak valid"
        });
      }

      // ================================================
      // VALIDASI NAMA DOKUMEN
      // ================================================

      if (
        !nama_dokumen?.trim()
      ) {
        if (
          req.file &&
          fs.existsSync(
            req.file.path
          )
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

        return res.status(400).json({
          error:
            "Nama dokumen wajib dipilih"
        });
      }

      // ================================================
      // CEK PROYEK KLIEN
      // ================================================

      const klienResult =
        await pool.query(
          `
            SELECT id
            FROM public.proyek_klien
            WHERE id = $1
          `,
          [
            proyekKlienId
          ]
        );

      if (
        klienResult.rows.length === 0
      ) {
        if (
          req.file &&
          fs.existsSync(
            req.file.path
          )
        ) {
          fs.unlinkSync(
            req.file.path
          );
        }

        return res.status(404).json({
          error:
            "Data proyek klien tidak ditemukan"
        });
      }

      // ================================================
      // INFORMASI FILE OPSIONAL
      // ================================================

      let namaFileAsli = null;
      let namaFileSimpan = null;
      let pathFile = null;
      let tipeFile = null;
      let ukuranFile = null;

      if (req.file) {
        namaFileAsli =
          req.file.originalname ||
          null;

        namaFileSimpan =
          req.file.filename ||
          null;

        tipeFile =
          req.file.mimetype ||
          null;

        ukuranFile =
          req.file.size ||
          null;

        pathFile =
          namaFileSimpan
            ? `/uploads/dokumen-klien/${namaFileSimpan}`
            : null;
      }

      // ================================================
      // SIMPAN KE DATABASE
      // ================================================

      const result =
        await pool.query(
          `
            INSERT INTO public.proyek_klien_dokumen (
              proyek_klien_id,
              nama_dokumen,
              nomor_dokumen,
              nama_file_asli,
              nama_file_simpan,
              path_file,
              tipe_file,
              ukuran_file,
              is_checked
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
              FALSE
            )
            RETURNING *
          `,
          [
            proyekKlienId,

            nama_dokumen.trim(),

            nomor_dokumen?.trim() ||
            null,

            namaFileAsli,

            namaFileSimpan,

            pathFile,

            tipeFile,

            ukuranFile
          ]
        );

      return res.status(201).json({
        message:
          req.file
            ? "Dokumen dan file berhasil disimpan"
            : "Dokumen berhasil disimpan tanpa file",

        data:
          result.rows[0]
      });

    } catch (error) {
      // Hapus file jika file sudah terunggah,
      // tetapi penyimpanan database gagal
      if (
        req.file &&
        req.file.path &&
        fs.existsSync(
          req.file.path
        )
      ) {
        fs.unlinkSync(
          req.file.path
        );
      }

      console.error(
        "ERROR SIMPAN DOKUMEN KLIEN:",
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
    try {
      const proyekId =
        Number(req.params.proyekId);

      const {
        deskripsi,
        tanggal_mulai,
        tanggal_akhir,
        status
      } = req.body;

      if (
        !Number.isInteger(proyekId) ||
        proyekId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID proyek tidak valid"
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
            "Tanggal mulai dan akhir wajib diisi"
        });
      }

      if (
        new Date(tanggal_akhir) <
        new Date(tanggal_mulai)
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

      const result =
        await pool.query(
          `
            INSERT INTO public.proyek_timeline (
              proyek_id,
              deskripsi,
              tanggal_mulai,
              tanggal_akhir,
              status
            )
            VALUES ($1, $2, $3, $4, $5)
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

      res.status(201).json({
        message:
          "Timeline berhasil ditambahkan",

        data:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        "ERROR TAMBAH TIMELINE:",
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);


// ======================================================
// EDIT TIMELINE
// ======================================================

app.put(
  "/api/proyek/timeline/:id",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const {
        deskripsi,
        tanggal_mulai,
        tanggal_akhir,
        status
      } = req.body;

      if (
        new Date(tanggal_akhir) <
        new Date(tanggal_mulai)
      ) {
        return res.status(400).json({
          error:
            "Tanggal akhir tidak boleh sebelum tanggal mulai"
        });
      }

      const result =
        await pool.query(
          `
            UPDATE public.proyek_timeline
            SET
              deskripsi = $1,
              tanggal_mulai = $2,
              tanggal_akhir = $3,
              status = $4,
              updated_at = NOW()
            WHERE id = $5
            RETURNING *
          `,
          [
            deskripsi.trim(),
            tanggal_mulai,
            tanggal_akhir,
            status,
            id
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Timeline tidak ditemukan"
        });
      }

      res.json({
        message:
          "Timeline berhasil diperbarui",

        data:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        "ERROR EDIT TIMELINE:",
        error
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);


// ======================================================
// HAPUS TIMELINE
// ======================================================

app.delete(
  "/api/proyek/timeline/:id",
  async (req, res) => {
    try {
      const id =
        Number(req.params.id);

      const result =
        await pool.query(
          `
            DELETE FROM public.proyek_timeline
            WHERE id = $1
            RETURNING id
          `,
          [id]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Timeline tidak ditemukan"
        });
      }

      res.json({
        message:
          "Timeline berhasil dihapus"
      });

    } catch (error) {
      console.error(
        "ERROR HAPUS TIMELINE:",
        error
      );

      res.status(500).json({
        error: error.message
      });
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
      //
      // Dilakukan saat nilai submit/nego masih kosong.
      // Nilai final partner = total nominal seluruh termin.
      // ==================================================

      if (
        !isTransaksi &&
        nilaiDasarPartner <= 0 &&
        nilaiFinalPartner > 0
      ) {
        await client.query(
          `
          UPDATE
            public.proyek_partner_termin

          SET
            persentase =
              ROUND(
                (
                  COALESCE(
                    nominal,
                    0
                  )::numeric
                  /
                  $2::numeric
                ) * 100,
                6
              ),

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            proyek_partner_id = $1

            AND COALESCE(
              nominal,
              0
            ) > 0
          `,
          [
            proyekPartnerId,
            nilaiFinalPartner
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
// ======================================================
// UPDATE TERMIN PARTNER
// ======================================================

app.put(
  "/api/proyek/partner/termin/:id",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const terminId =
        Number(req.params.id);

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
        !Number.isInteger(terminId) ||
        terminId <= 0
      ) {
        return res.status(400).json({
          error:
            "ID termin partner tidak valid"
        });
      }

      if (
        !nama_termin ||
        !nama_termin.trim()
      ) {
        return res.status(400).json({
          error:
            "Nama termin wajib diisi"
        });
      }

      await client.query("BEGIN");

      // ==================================================
      // CARI TERMIN DAN JENIS PROYEK
      // ==================================================

      const terminResult =
        await client.query(
          `
          SELECT
            ppt.id,
            ppt.proyek_partner_id,
            pp.proyek_id,
            p.jenis_proyek,

            COALESCE(
              NULLIF(pp.nilai_nego_3, 0),
              NULLIF(pp.nilai_nego_2, 0),
              NULLIF(pp.nilai_nego_1, 0),
              NULLIF(pp.nilai_submit, 0),
              0
            )::numeric AS nilai_final_partner

          FROM public.proyek_partner_termin ppt

          JOIN public.proyek_partner pp
            ON pp.id =
               ppt.proyek_partner_id

          JOIN public.proyek p
            ON p.id =
               pp.proyek_id

          WHERE ppt.id = $1

          LIMIT 1
          `,
          [terminId]
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

      const jenisProyek =
        String(
          terminData.jenis_proyek || ""
        )
          .trim()
          .toLowerCase();

      const nominalMode =
        jenisProyek.includes("sewa") ||
        jenisProyek.includes(
          "transaksi"
        );

      const nilaiFinalPartner =
        Number(
          terminData
            .nilai_final_partner || 0
        );

      let persenValue = null;
      let nominalValue = null;

      // ==================================================
      // MODE NOMINAL: SEWA / TRANSAKSI
      // ==================================================

      if (nominalMode) {
        nominalValue =
          Number(nominal);

        if (
          !Number.isFinite(
            nominalValue
          ) ||
          nominalValue <= 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Nominal termin harus lebih dari Rp 0"
          });
        }

        // Hitung persentase apabila nilai final tersedia
        if (nilaiFinalPartner > 0) {
          persenValue =
            (
              nominalValue /
              nilaiFinalPartner
            ) * 100;
        }
      }

      // ==================================================
      // MODE PERSENTASE: REGULER / SLA
      // ==================================================

      else {
        persenValue =
          Number(persentase);

        if (
          !Number.isFinite(
            persenValue
          ) ||
          persenValue <= 0 ||
          persenValue > 100
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Persentase harus lebih dari 0 dan maksimal 100%"
          });
        }

        // ==================================================
        // TOTAL PERSENTASE TERMIN LAIN
        // ==================================================

        const totalResult =
          await client.query(
            `
            SELECT
              COALESCE(
                SUM(persentase),
                0
              )::numeric AS total

            FROM public.proyek_partner_termin

            WHERE proyek_partner_id = $1
              AND id <> $2
            `,
            [
              terminData.proyek_partner_id,
              terminId
            ]
          );

        const totalLain =
          Number(
            totalResult.rows[0]
              .total || 0
          );

        if (
          totalLain +
          persenValue >
          100
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              `Total persentase termin tidak boleh lebih dari 100%. ` +
              `Saat ini ${totalLain}%.`
          });
        }

        // Hitung nominal berdasarkan nilai final partner
        if (nilaiFinalPartner > 0) {
          nominalValue =
            nilaiFinalPartner *
            persenValue /
            100;
        } else {
          const nominalInput =
            Number(nominal);

          nominalValue =
            Number.isFinite(
              nominalInput
            ) &&
            nominalInput > 0
              ? nominalInput
              : null;
        }
      }

      // ==================================================
      // UPDATE TERMIN PARTNER
      // ==================================================

      const result =
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

          WHERE id = $8

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
            nama_termin.trim(),
            persenValue,
            nominalValue,
            status_pembayaran ||
              "Belum Dibayar",
            tanggal_jatuh_tempo ||
              null,
            tanggal_bayar ||
              null,
            syarat_pembayaran
              ?.trim() || null,
            terminId
          ]
        );

      await client.query(
        "COMMIT"
      );

      return res.json({
        message:
          "Termin partner berhasil diperbarui",

        data:
          result.rows[0]
      });
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


// ======================================================
// PARTNER - HAPUS TERMIN
// ======================================================

app.delete("/api/proyek/partner/termin/:id", 
  async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM public.proyek_partner_termin
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Termin partner tidak ditemukan"
      });
    }

    res.json({
      message: "Termin partner berhasil dihapus"
    });

  } catch (error) {
    console.error("ERROR HAPUS TERMIN PARTNER:", error);

    res.status(500).json({
      error: error.message
    });
  }
});

// ======================================================
// PARTNER - TAMBAH DOKUMEN
// ======================================================
app.post(
  "/api/proyek/partner/:proyekPartnerId/dokumen",

  uploadDokumenKlien.single(
    "file_dokumen"
  ),

  async (req, res) => {
    try {
      const {
        proyekPartnerId
      } = req.params;

      const {
        nama_dokumen,
        nomor_dokumen
      } = req.body;

      if (
        !nama_dokumen ||
        !nama_dokumen.trim()
      ) {
        return res.status(400).json({
          error:
            "Nama dokumen wajib dipilih"
        });
      }

      const partnerCheck =
        await pool.query(
          `
            SELECT id
            FROM public.proyek_partner
            WHERE id = $1
          `,
          [
            proyekPartnerId
          ]
        );

      if (
        partnerCheck.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Data partner proyek tidak ditemukan"
        });
      }

      // File bersifat opsional
      let namaFileAsli = null;
      let namaFileServer = null;
      let pathFile = null;
      let mimeType = null;
      let ukuranFile = null;

      if (req.file) {
        const normalizedPath =
          String(
            req.file.path || ""
          ).replaceAll(
            "\\",
            "/"
          );

        namaFileAsli =
          req.file.originalname ||
          null;

        namaFileServer =
          req.file.filename ||
          null;

        mimeType =
          req.file.mimetype ||
          null;

        ukuranFile =
          req.file.size ||
          null;

        pathFile =
          normalizedPath
            ? `/${normalizedPath.replace(
                /^.*?uploads\//,
                "uploads/"
              )}`
            : (
                namaFileServer
                  ? `/uploads/${namaFileServer}`
                  : null
              );
      }

      const result =
        await pool.query(
          `
            INSERT INTO public.proyek_partner_dokumen (
              proyek_partner_id,
              nama_dokumen,
              nomor_dokumen,
              nama_file_asli,
              nama_file_server,
              path_file,
              mime_type,
              ukuran_file,
              is_checked
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
              FALSE
            )
            RETURNING *
          `,
          [
            Number(
              proyekPartnerId
            ),

            nama_dokumen.trim(),

            nomor_dokumen?.trim() ||
            null,

            namaFileAsli,

            namaFileServer,

            pathFile,

            mimeType,

            ukuranFile
          ]
        );

      res.status(201).json({
        message:
          "Dokumen partner berhasil ditambahkan",

        data:
          result.rows[0]
      });

    } catch (error) {
      console.error(
        "ERROR TAMBAH DOKUMEN PARTNER:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ======================================================
// PARTNER - CHECK / UNCHECK DOKUMEN
// ======================================================

app.put("/api/proyek/partner/dokumen/:id/check", 
  async (req, res) => {
  try {
    const { id } = req.params;
    const { is_checked } = req.body;

    const checked =
      is_checked === true;

    const result = await pool.query(
      `
      UPDATE public.proyek_partner_dokumen
      SET
        is_checked = $1,

        checked_at = CASE
          WHEN $1 = TRUE
          THEN CURRENT_TIMESTAMP
          ELSE NULL
        END,

        updated_at = CURRENT_TIMESTAMP

      WHERE id = $2

      RETURNING *
      `,
      [
        checked,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Dokumen partner tidak ditemukan"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error(
      "ERROR CHECK DOKUMEN PARTNER:",
      error
    );

    res.status(500).json({
      error: error.message
    });
  }
});


// ======================================================
// PARTNER - HAPUS DOKUMEN
// ======================================================

app.delete("/api/proyek/partner/dokumen/:id", 
  async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM public.proyek_partner_dokumen
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Dokumen partner tidak ditemukan"
      });
    }

    res.json({
      message: "Dokumen partner berhasil dihapus"
    });

  } catch (error) {
    console.error(
      "ERROR HAPUS DOKUMEN PARTNER:",
      error
    );

    res.status(500).json({
      error: error.message
    });
  }
});

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
            nama_proyek.trim(),
            jenis_proyek,
            sub_jenis_proyek || null,
            status_final || "Aktif",
            deskripsi || null,
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
// UPDATE / TAMBAH KLIEN PROYEK
// ======================================================

// ======================================================
// UPDATE INFORMASI KLIEN PROYEK
// ======================================================

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
            id,
            status_administrasi
          FROM public.proyek_klien
          WHERE proyek_id = $1
          ORDER BY id DESC
          LIMIT 1
          FOR UPDATE
          `,
          [proyekId]
        );


      let result;
      let modeSimpan;


      // ================================================
      // UPDATE JIKA DATA SUDAH ADA
      // ================================================

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
    const client =
      await pool.connect();

    let transactionDimulai =
      false;

    try {
      const proyekId =
        Number(req.params.id);

      const {
        partners
      } = req.body;

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

      if (!Array.isArray(partners)) {
        return res.status(400).json({
          error:
            "partners harus berupa array"
        });
      }

      const partnerIds =
        partners.map(item =>
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
      // HELPER ANGKA
      // ==================================================

      function nilaiAtauNull(value) {
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

      await client.query("BEGIN");

      transactionDimulai = true;

      // ==================================================
      // PASTIKAN PROYEK TERSEDIA
      // ==================================================

      const proyekResult =
        await client.query(
          `
          SELECT id
          FROM public.proyek
          WHERE id = $1
          `,
          [proyekId]
        );

      if (
        proyekResult.rows.length === 0
      ) {
        await client.query("ROLLBACK");

        transactionDimulai = false;

        return res.status(404).json({
          error:
            "Proyek tidak ditemukan"
        });
      }

      // ==================================================
      // AMBIL PARTNER LAMA
      // ==================================================

      const existingResult =
        await client.query(
          `
          SELECT id
          FROM public.proyek_partner
          WHERE proyek_id = $1
          `,
          [proyekId]
        );

      const existingIds =
        existingResult.rows.map(
          item =>
            Number(item.id)
        );

      // ==================================================
      // ID PARTNER YANG MASIH ADA
      // ==================================================

      const incomingIds =
        partners
          .filter(
            item =>
              item.proyek_partner_id
          )
          .map(item =>
            Number(
              item.proyek_partner_id
            )
          );

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

      if (deletedIds.length > 0) {
        await client.query(
          `
          DELETE FROM public.proyek_partner
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
      // LOOP PARTNER DARI FRONTEND
      // ==================================================

      for (const item of partners) {
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
          item.model_pembayaran ||
          null;

        const statusPengadaan =
          item.status_pengadaan ||
          null;

        const statusTeknis =
          item.status_teknis ||
          null;

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

        // ==================================================
        // EDIT PARTNER LAMA
        // ==================================================

        if (item.proyek_partner_id) {
          const proyekPartnerId =
            Number(
              item.proyek_partner_id
            );

          const result =
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
            result.rows.length === 0
          ) {
            throw new Error(
              `Partner proyek ${proyekPartnerId} tidak ditemukan`
            );
          }

          jumlahDiperbarui += 1;

        } else {
          // ==================================================
          // TAMBAH PARTNER BARU
          // ==================================================

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
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
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
      // COMMIT
      // ==================================================

      await client.query("COMMIT");

      transactionDimulai = false;

      return res.json({
        message:
          "Partner proyek berhasil diperbarui",

        ditambah:
          jumlahDitambah,

        diperbarui:
          jumlahDiperbarui,

        dihapus:
          deletedIds.length
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

app.get(
  "/api/task-list/proyek",
  async (req, res) => {

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

    try {

      const user =
        req.session.user;

      const isAdmin =
        String(
          user.role || ""
        ).toLowerCase() === "admin";


      const result =
        await pool.query(
          `
          SELECT
            p.id,
            p.nama_proyek,

            kp.id AS kategori_id,
            kp.nama_kategori_produk AS kategori

          FROM public.proyek p

          LEFT JOIN public.kategori_produk kp
            ON kp.id = p.kategori_produk_id

          WHERE
            $1::boolean = TRUE

            OR EXISTS (
              SELECT 1

              FROM public.proyek_pic pp

              WHERE
                pp.proyek_id = p.id
                AND pp.pic_id = $2
            )

          ORDER BY
            p.nama_proyek ASC
          `,
          [
            isAdmin,
            user.id
          ]
        );


      res.json(
        result.rows
      );

    } catch (error) {

      console.error(
        "ERROR LOAD PROYEK TASK:",
        error
      );

      res
        .status(500)
        .json({
          error:
            error.message
        });

    }

  }
);

app.get("/api/task-list",
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
        String(user.role || "")
          .toLowerCase() ===
        "admin";


      const result =
        await pool.query(
          `
          SELECT
            t.id,
            t.proyek_id,
            t.created_by,

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
            t.tanggal_selesai,
            t.created_at,
            t.updated_at,

            p.nama_proyek,

            kp.nama_kategori_produk
              AS kategori,

            pic.nama
              AS dibuat_oleh

          FROM public.task_list t

          JOIN public.proyek p
            ON p.id =
               t.proyek_id

          LEFT JOIN public.kategori_produk kp
            ON kp.id =
               p.kategori_produk_id

          LEFT JOIN public.pic pic
            ON pic.id =
               t.created_by

          LEFT JOIN public.master_dokumen md
            ON md.id =
               t.master_dokumen_id

          WHERE
            $1::boolean = TRUE

            OR EXISTS (
              SELECT 1

              FROM public.proyek_pic pp

              WHERE
                pp.proyek_id =
                  t.proyek_id

                AND pp.pic_id =
                  $2
            )

          ORDER BY
            t.id DESC
          `,
          [
            isAdmin,
            user.id
          ]
        );


      res.json(
        result.rows
      );


    } catch (error) {

      console.error(
        "ERROR GET TASK LIST:",
        error
      );

      res.status(500).json({
        error:
          "Gagal mengambil task list"
      });

    }

  }
);

app.post(
  "/api/task-list",
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

      const {
        proyek_id,
        task,
        catatan,
        link,
        master_dokumen_id,
        nomor_dokumen,
        target_date,
        status
      } = req.body;


      if (
        !proyek_id ||
        !task ||
        !String(task).trim()
      ) {
        return res.status(400).json({
          error:
            "Proyek dan task wajib diisi"
        });
      }


      const statusValue =
        status || "Not Started";


      const statusValid = [
        "Not Started",
        "On Progress",
        "Hold",
        "Urgent",
        "Done"
      ];


      if (
        !statusValid.includes(
          statusValue
        )
      ) {
        return res.status(400).json({
          error: "Status tidak valid"
        });
      }


      const isAdmin =
        String(user.role || "")
          .toLowerCase() ===
        "admin";


      if (!isAdmin) {

        const akses =
          await pool.query(
            `
            SELECT 1

            FROM public.proyek_pic

            WHERE
              proyek_id = $1
              AND pic_id = $2

            LIMIT 1
            `,
            [
              proyek_id,
              user.id
            ]
          );


        if (
          akses.rowCount === 0
        ) {
          return res.status(403).json({
            error:
              "Anda tidak memiliki akses ke proyek ini"
          });
        }

      }


      const result =
        await pool.query(
          `
          INSERT INTO public.task_list (

            proyek_id,
            created_by,

            task,
            catatan,
            link,

            master_dokumen_id,
            nomor_dokumen,

            status,
            tanggal_mulai,
            target_date

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
            CURRENT_DATE,
            $9

          )

          RETURNING *
          `,
          [
            proyek_id,
            user.id,

            String(task).trim(),
            catatan || null,
            link || null,

            master_dokumen_id || null,
            nomor_dokumen || null,

            statusValue,
            target_date || null
          ]
        );


      res.status(201).json(
        result.rows[0]
      );


    } catch (error) {

      console.error(
        "ERROR CREATE TASK:",
        error
      );

      res.status(500).json({
        error:
          "Gagal menambahkan task"
      });

    }

  }
);

app.put("/api/task-list/:id",
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

      const taskId =
        Number(req.params.id);


      if (
        !Number.isInteger(taskId)
      ) {

        return res.status(400).json({
          error:
            "ID task tidak valid"
        });

      }


      const {

        proyek_id,
        task,
        catatan,
        link,

        master_dokumen_id,
        nomor_dokumen,

        status,
        target_date

      } = req.body;


     const statusValid = [
      "Not Started",
      "On Progress",
      "Hold",
      "Urgent",
      "Done"
    ];

      if (
        !proyek_id ||
        !task ||
        !String(task).trim()
      ) {

        return res.status(400).json({
          error:
            "Proyek dan task wajib diisi"
        });

      }


      if (
        !statusValid.includes(status)
      ) {

        return res.status(400).json({
          error:
            "Status tidak valid"
        });

      }


      const user =
        req.session.user;


      const isAdmin =
        String(user.role || "")
          .toLowerCase() ===
        "admin";


      if (!isAdmin) {

        const akses =
          await pool.query(
            `
            SELECT 1

            FROM public.proyek_pic

            WHERE
              proyek_id = $1
              AND pic_id = $2

            LIMIT 1
            `,
            [
              proyek_id,
              user.id
            ]
          );


        if (
          akses.rowCount === 0
        ) {

          return res.status(403).json({
            error:
              "Anda tidak memiliki akses ke proyek ini"
          });

        }

      }


      const result =
        await pool.query(
          `
          UPDATE public.task_list

          SET
            proyek_id =
              $1::integer,

            task =
              $2::varchar,

            catatan =
              $3::text,

            link =
              $4::text,

            master_dokumen_id =
              $5::integer,

            nomor_dokumen =
              $6::varchar,

            status =
              $7::varchar,

            target_date =
              $8::date,

            tanggal_selesai =
              CASE

                WHEN
                  $7::varchar = 'Done'
                  AND tanggal_selesai IS NULL

                THEN CURRENT_DATE


                WHEN
                  $7::varchar <> 'Done'

                THEN NULL


                ELSE tanggal_selesai

              END,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE
            id =
              $9::integer

          RETURNING *
          `,
          [

            proyek_id,

            String(task).trim(),

            catatan || null,

            link || null,

            master_dokumen_id || null,

            nomor_dokumen || null,

            status,

            target_date || null,

            taskId

          ]
        );


      if (
        result.rowCount === 0
      ) {

        return res.status(404).json({
          error:
            "Task tidak ditemukan"
        });

      }


      res.json(
        result.rows[0]
      );


    } catch (error) {

      console.error(
        "ERROR UPDATE TASK:",
        error
      );

      res.status(500).json({
          error: error.message
      });

    }

  }
);

app.delete("/api/task-list/:id",
  async (req, res) => {

    if (!req.session || !req.session.user) {
      return res.status(401).json({
        error: "Belum login"
      });
    }

    try {

      const result =
        await pool.query(
          `
          DELETE FROM public.task_list
          WHERE id = $1
          RETURNING id
          `,
          [
            req.params.id
          ]
        );


      if (result.rowCount === 0) {

        return res.status(404).json({
          error: "Task tidak ditemukan"
        });

      }


      res.json({
        success: true,
        message: "Task berhasil dihapus"
      });


    } catch (error) {

      console.error(
        "ERROR DELETE TASK:",
        error
      );

      res.status(500).json({
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
          t.task,
          t.catatan,
          t.link,
          t.status,
          t.tanggal_mulai,
          t.target_date,
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
        [
          proyekId
        ]
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

app.get("/api/pendapatan", 
  async (req, res) => {


  // ====================================================
  // CEK LOGIN
  // ====================================================

  if (!req.session || !req.session.user) {
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


    // ==================================================
    // USER LOGIN
    // ==================================================

    const user = req.session.user;

    const isAdmin =
      String(user.role || "")
        .trim()
        .toLowerCase() === "admin";

    const picId =
      Number(user.id);


    // ==================================================
    // QUERY PENDAPATAN
    // ==================================================

    const result = await pool.query(
      `
      SELECT

        LOWER(TRIM(p.jenis_proyek))
          AS jenis_proyek,

        EXTRACT(
          MONTH FROM pkt.tanggal_bayar
        )::integer
          AS bulan,


        SUM(

          CASE

            -- ==========================================
            -- TRANSAKSI
            -- Nilai berdasarkan nominal termin
            -- ==========================================

            WHEN LOWER(TRIM(p.jenis_proyek))
                 LIKE '%transaksi%'
            THEN

              COALESCE(
                pkt.nominal,
                0
              )


            -- ==========================================
            -- SEWA
            -- Nilai berdasarkan nominal termin
            -- ==========================================

            WHEN LOWER(TRIM(p.jenis_proyek))
                 LIKE '%sewa%'
            THEN

              COALESCE(
                pkt.nominal,
                0
              )


            -- ==========================================
            -- REGULER / SLA
            -- Nilai Final x Persentase Termin
            -- ==========================================

            ELSE

              COALESCE(
                pk.nilai_nego_3,
                pk.nilai_nego_2,
                pk.nilai_nego_1,
                pk.nilai_submit,
                0
              )

              *

              (
                COALESCE(
                  pkt.persentase,
                  0
                )
                / 100
              )

          END

        ) AS nilai_dibayar


      FROM public.proyek_klien_termin pkt


      JOIN public.proyek_klien pk
        ON pk.id =
           pkt.proyek_klien_id


      JOIN public.proyek p
        ON p.id =
           pk.proyek_id


      WHERE

        -- Harus sudah memiliki tanggal bayar
        pkt.tanggal_bayar IS NOT NULL


        -- Harus sudah dibayar
        AND LOWER(
          TRIM(
            COALESCE(
              pkt.status_pembayaran,
              ''
            )
          )
        ) = 'dibayar'


        -- Filter tahun
        AND EXTRACT(
          YEAR FROM pkt.tanggal_bayar
        ) = $1


        -- ==============================================
        -- ADMIN = SEMUA PROYEK
        -- PIC = HANYA PROYEK YANG DITUGASKAN
        -- ==============================================

        AND (

          $2::boolean = TRUE

          OR EXISTS (

            SELECT 1

            FROM public.proyek_pic pp

            WHERE
              pp.proyek_id = p.id
              AND pp.pic_id = $3

          )

        )


      GROUP BY

        LOWER(
          TRIM(
            p.jenis_proyek
          )
        ),

        EXTRACT(
          MONTH FROM pkt.tanggal_bayar
        )


      ORDER BY
        jenis_proyek,
        bulan
      `,
      [
        tahun,
        isAdmin,
        picId
      ]
    );


    // ==================================================
    // DEBUG HASIL SQL
    // ==================================================

    console.log(
      "RAW PENDAPATAN:",
      result.rows
    );


    // ==================================================
    // SIAPKAN DATA 12 BULAN
    // ==================================================

    const data = {

      reguler:
        Array(12).fill(0),

      sewa:
        Array(12).fill(0),

      transaksi:
        Array(12).fill(0)

    };


    // ==================================================
    // MAPPING HASIL SQL
    // ==================================================

    result.rows.forEach(item => {

      const jenisAsli =
        String(
          item.jenis_proyek || ""
        )
          .trim()
          .toLowerCase();


      const bulan =
        Number(item.bulan);


      const nilai =
        Number(
          item.nilai_dibayar || 0
        );


      let jenis = null;


      // ================================================
      // REGULER / SLA
      // ================================================

      if (
        jenisAsli.includes("reguler") ||
        jenisAsli.includes("sla")
      ) {

        jenis = "reguler";

      }


      // ================================================
      // SEWA
      // ================================================

      else if (
        jenisAsli.includes("sewa")
      ) {

        jenis = "sewa";

      }


      // ================================================
      // TRANSAKSI
      // ================================================

      else if (
        jenisAsli.includes("transaksi")
      ) {

        jenis = "transaksi";

      }


      // ================================================
      // MASUKKAN KE BULAN
      // ================================================

      if (
        jenis &&
        bulan >= 1 &&
        bulan <= 12
      ) {

        data[jenis][bulan - 1] +=
          nilai;

      }

    });


    // ==================================================
    // DEBUG HASIL FINAL
    // ==================================================

    console.log(
      "PENDAPATAN FINAL:",
      data
    );


    // ==================================================
    // RESPONSE
    // ==================================================

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
// MASTER DOKUMEN
// ======================================================


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
    try {
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

      const offset =
        (page - 1) * limit;

      const result =
        await pool.query(
          `
            SELECT
              timeline.id,
              timeline.proyek_id,
              timeline.deskripsi,
              timeline.tanggal_mulai,
              timeline.tanggal_akhir,
              timeline.status,

              proyek.nama_proyek,
              proyek.jenis_proyek,
              proyek.sub_jenis_proyek,

              COALESCE(
                kategori_data.kategori,
                '[]'::jsonb
              ) AS kategori,

              COUNT(*) OVER()
                AS total_data

            FROM public.proyek_timeline timeline

            JOIN public.proyek proyek
              ON proyek.id =
                 timeline.proyek_id

            LEFT JOIN LATERAL (
              SELECT
                COALESCE(
                  JSONB_AGG(
                    kategori.nama_kategori_produk
                    ORDER BY
                      kategori.nama_kategori_produk
                  ),
                  '[]'::jsonb
                ) AS kategori

              FROM public.proyek_kategori relasi

              JOIN public.kategori_produk kategori
                ON kategori.id =
                   relasi.kategori_produk_id

              WHERE relasi.proyek_id =
                    proyek.id
            ) kategori_data
              ON TRUE

            WHERE
              (
                $1 = ''

                OR timeline.deskripsi
                   ILIKE '%' || $1 || '%'

                OR proyek.nama_proyek
                   ILIKE '%' || $1 || '%'
              )

              AND (
                $2::integer IS NULL

                OR (
                  timeline.tanggal_akhir
                    >= CURRENT_DATE

                  AND timeline.tanggal_akhir
                    <= CURRENT_DATE +
                       (
                         $2::text ||
                         ' months'
                       )::interval
                )
              )

            ORDER BY
              timeline.tanggal_akhir ASC,
              proyek.nama_proyek ASC,
              timeline.id ASC

            LIMIT $3
            OFFSET $4
          `,
          [
            search,
            bulan,
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
            ...timeline
          } = item;

          return timeline;
        });

      res.json({
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
        }
      });

    } catch (error) {
      console.error(
        "ERROR GET TIMELINE LIST:",
        error
      );

      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

// ======================================================
// DETAIL PENDAPATAN
// Digunakan oleh halaman pendapatan.html
// API total pendapatan yang lama tidak diubah.
// ======================================================

app.get("/api/pendapatan/detail",
  async (req, res) => {
    try {
      const result =
        await pool.query(`
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

            t.nama_termin,
            t.persentase,
            t.nominal,
            t.status_pembayaran,
            t.tanggal_jatuh_tempo,
            t.tanggal_bayar,

            t.tanggal_bayar
              AS tanggal_pendapatan,

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
           * Kategori dibuat dalam subquery agar satu termin
           * tidak menjadi beberapa baris ketika proyek
           * memiliki lebih dari satu kategori.
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

            INNER JOIN public.kategori_produk kp
              ON kp.id =
                pkat.kategori_produk_id

            WHERE
              pkat.proyek_id =
                p.id
          ) kategori
            ON TRUE

          WHERE
            (
              t.tanggal_bayar IS NOT NULL

              OR

              LOWER(
                TRIM(
                  REGEXP_REPLACE(
                    COALESCE(
                      t.status_pembayaran,
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
            )

          ORDER BY
            t.tanggal_bayar DESC NULLS LAST,
            p.nama_proyek ASC,
            t.id ASC
        `);

      return res.json({
        pendapatan:
          result.rows,

        summary: {
          total_pendapatan:
            result.rows.reduce(
              (total, item) =>
                total +
                Number(
                  item.nilai_pendapatan ||
                  0
                ),
              0
            ),

          jumlah_termin:
            result.rows.length,

          jumlah_proyek:
            new Set(
              result.rows.map(
                item =>
                  Number(item.proyek_id)
              )
            ).size
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
    COALESCE(progress.version, 0) AS versi,

      progress.updated_at

    FROM public.proyek p

    LEFT JOIN LATERAL (
      SELECT
        d.perusahaan_klien,

        COALESCE(
          NULLIF(
            TRIM(to_jsonb(d)->>'inisial'),
            ''
          ),
          NULLIF(
            TRIM(to_jsonb(d)->>'kode_klien'),
            ''
          ),
          NULLIF(
            TRIM(to_jsonb(d)->>'kode'),
            ''
          )
        ) AS inisial_klien

      FROM public.proyek_klien pk

      LEFT JOIN public.data d
        ON d.id = pk.klien_id

      WHERE pk.proyek_id = p.id

      ORDER BY pk.id DESC

      LIMIT 1
    ) klien ON TRUE

    LEFT JOIN public.proyek_progress_modul progress
      ON progress.project_id = p.id

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
            ? Progress.calculate(row.dokumen)
            : null;

        res.set(
          "Cache-Control",
          "no-store"
        );

        return res.json({
          proyek: {
            id: row.id,

            nama_proyek:
              row.nama_proyek,

            nama_klien:
              row.perusahaan_klien || "-"
          },

          pic_options: [
            {
              value: "klien",

              label:
                row.inisial_klien ||
                "Klien (inisial belum tersedia)"
            },
            {
              value: "mtm",
              label: "MTM"
            }
          ],

          user_id:
            context.userId,

          version:
            Number(row.versi),

          updated_at:
            row.updated_at || null,

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

app.get(
  "/api/proyek-sewa/master/proyek",
  async (req, res) => {

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
            p.id,
            p.nama_proyek,

            (
              SELECT pk.klien_id
              FROM public.proyek_klien pk
              WHERE pk.proyek_id = p.id
              ORDER BY pk.id DESC
              LIMIT 1
            ) AS klien_id

          FROM public.proyek p

          WHERE
            $1::boolean = TRUE

            OR EXISTS (
              SELECT 1
              FROM public.proyek_pic pp
              WHERE pp.proyek_id = p.id
                AND pp.pic_id = $2
            )

          ORDER BY
            p.nama_proyek ASC
          `,
          [
            isAdmin,
            picId
          ]
        );

      res.json(rows);

    } catch (error) {

      console.error(
        "ERROR GET MASTER PROYEK UNTUK SEWA:",
        error
      );

      res.status(500).json({
        error: error.message
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

        nomor_rujukan,

        proyek_id,

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


      if (
        !klien_id
      ) {

        return res.status(400).json({
          error: "Klien wajib dipilih."
        });

      }


      if (
        !nomor_rujukan &&
        !proyek_id
      ) {

        return res.status(400).json({
          error:
            "Isi Nomor Rujukan atau pilih Proyek yang sudah ada."
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
          WHERE LOWER(BTRIM(nomor_pr))
              = LOWER(BTRIM($1))
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
      // HITUNG NILAI DARI SERVER
      //
      // Jangan percaya total dari frontend.
      // Server hitung ulang berdasarkan master produk.
      // =================================================

      let totalNilaiPerBulan = 0;
      let totalNilai = 0;

      const produkValid = [];


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


        if (
          !item.produk_id
        ) {

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
          !Array.isArray(item.orders) ||
          item.orders.length === 0
        ) {

          throw new Error(
            `Produk ${i + 1} belum memiliki order.`
          );

        }


        // ===============================================
        // AMBIL PRODUK DARI MASTER
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
              ON jp.id = mps.jenis_proyek_id

            LEFT JOIN public.jenis_proyek sjp
              ON sjp.id = mps.sub_jenis_proyek_id

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
            master.harga_jual_per_item || 0
          );


        if (
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


          if (
            !order.cabang_id
          ) {

            throw new Error(
              `Lokasi Order ${j + 1} pada Produk ${i + 1} belum dipilih.`
            );

          }


          const quantity =
            Number(
              order.quantity
            );


          if (
            !Number.isInteger(quantity) ||
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
          // PERHITUNGAN SERVER
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


          ordersValid.push({

            cabang_id:
              Number(
                order.cabang_id
              ),

            quantity,

            harga_per_bulan:
              hargaPerBulan,

            total_harga:
              totalHarga

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
      // INSERT HEADER PROYEK SEWA
      // =================================================

      const proyekSewaResult =
        await client.query(
          `
          INSERT INTO public.proyek_sewa (

            nomor_pr,

            nomor_rujukan,

            proyek_id,

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

            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP

          )

          RETURNING *
          `,
          [

            String(
              nomor_pr
            ).trim(),

            nomor_rujukan
              ? String(
                  nomor_rujukan
                ).trim()
              : null,

            proyek_id
              ? Number(
                  proyek_id
                )
              : null,

            Number(
              klien_id
            ),

            totalNilaiPerBulan,

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

              created_at,

              updated_at

            )

            VALUES (

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

              order.cabang_id,

              order.quantity,

              order.harga_per_bulan,

              order.total_harga

            ]
          );

        }

      }


      // =================================================
      // INSERT PEMBAYARAN
      // =================================================

      if (
        Array.isArray(
          pembayaran
        )
      ) {

        for (
          let i = 0;
          i < pembayaran.length;
          i++
        ) {

          const bayar =
            pembayaran[i];


          const deskripsi =
            String(
              bayar.deskripsi || ""
            ).trim();


          const tanggalBayar =
            bayar.tanggal_bayar ||
            null;


          /*
            Nominal sudah kita tambahkan
            ke tabel pembayaran.
          */

          const nominal =
            Number(
              bayar.nominal || 0
            );


          if (
            !deskripsi
          ) {

            throw new Error(
              `Deskripsi Pembayaran ${i + 1} wajib diisi.`
            );

          }


          if (
            !tanggalBayar
          ) {

            throw new Error(
              `Tanggal Pembayaran ${i + 1} wajib diisi.`
            );

          }


          if (
            !Number.isFinite(nominal) ||
            nominal < 0
          ) {

            throw new Error(
              `Nominal Pembayaran ${i + 1} tidak valid.`
            );

          }


          await client.query(
            `
            INSERT INTO public.proyek_sewa_pembayaran (

              proyek_sewa_id,

              deskripsi,

              nominal,

              tanggal_bayar,

              created_at,

              updated_at

            )

            VALUES (

              $1,
              $2,
              $3,
              $4,

              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP

            )
            `,
            [

              proyekSewa.id,

              deskripsi,

              nominal,

              tanggalBayar

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

      res.status(201).json({

        message:
          "Proyek sewa berhasil disimpan.",

        id:
          proyekSewa.id,

        nomor_pr:
          proyekSewa.nomor_pr,

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


      // Duplicate nomor PR
      if (
        error.code === "23505"
      ) {

        return res.status(409).json({
          error:
            "Nomor PR sudah digunakan."
        });

      }


      // Foreign key
      if (
        error.code === "23503"
      ) {

        return res.status(400).json({
          error:
            "Data master yang dipilih tidak valid atau sudah tidak tersedia."
        });

      }


      // Check constraint
      if (
        error.code === "23514"
      ) {

        return res.status(400).json({
          error:
            error.message
        });

      }


      res.status(500).json({
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

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login"
      });

    }


    const id =
      Number(
        req.params.id
      );


    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {

      return res.status(400).json({
        error: "ID Proyek Sewa tidak valid."
      });

    }


    try {

      // ===============================================
      // HEADER
      // ===============================================

      const proyekResult =
        await pool.query(
          `
          SELECT

            ps.id,

            ps.nomor_pr,

            ps.nomor_rujukan,

            ps.proyek_id,

            ps.klien_id,

            ps.total_nilai_per_bulan,

            ps.total_nilai,

            ps.created_at,

            ps.updated_at,

            d.perusahaan_klien
              AS nama_klien,

            p.nama_proyek

          FROM public.proyek_sewa ps

          LEFT JOIN public.data d
            ON d.id = ps.klien_id

          LEFT JOIN public.proyek p
            ON p.id = ps.proyek_id

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


      // ===============================================
      // PRODUK
      // ===============================================

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


      // ===============================================
      // ORDER
      // ===============================================

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

            mc.*

          FROM public.proyek_sewa_order pso

          LEFT JOIN public.master_cabang mc
            ON mc.id = pso.cabang_id

          WHERE
            pso.proyek_sewa_produk_id
            IN (
              SELECT id

              FROM public.proyek_sewa_produk

              WHERE proyek_sewa_id = $1
            )

          ORDER BY
            pso.id ASC
          `,
          [id]
        );


      // ===============================================
      // GABUNGKAN ORDER KE PRODUK
      // ===============================================

      const produk =
        produkResult.rows.map(
          item => ({

            ...item,

            orders:
              orderResult.rows.filter(
                order =>
                  Number(
                    order.proyek_sewa_produk_id
                  ) ===
                  Number(
                    item.id
                  )
              )

          })
        );


      // ===============================================
      // PEMBAYARAN
      // ===============================================

      const pembayaranResult =
        await pool.query(
          `
          SELECT

            id,

            proyek_sewa_id,

            deskripsi,

            nominal,

            tanggal_bayar,

            created_at,

            updated_at

          FROM public.proyek_sewa_pembayaran

          WHERE
            proyek_sewa_id = $1

          ORDER BY
            tanggal_bayar ASC,
            id ASC
          `,
          [id]
        );


      // ===============================================
      // RESPONSE
      // ===============================================

      res.json({

        proyek:
          proyekResult.rows[0],

        produk,

        pembayaran:
          pembayaranResult.rows

      });


    } catch (error) {

      console.error(
        "ERROR GET DETAIL PROYEK SEWA:",
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
// UPDATE INFORMASI PROYEK SEWA
// PUT /api/proyek-sewa/:id/informasi
// =====================================================

app.put(
  "/api/proyek-sewa/:id/informasi",
  async (req, res) => {

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login."
      });
    }

    const proyekSewaId =
      Number(req.params.id);

    const {
      nomor_pr,
      nomor_rujukan,
      proyek_id,
      klien_id
    } = req.body;

    if (
      !Number.isInteger(proyekSewaId) ||
      proyekSewaId <= 0
    ) {
      return res.status(400).json({
        error: "ID proyek sewa tidak valid."
      });
    }

    const nomorPr =
      String(nomor_pr || "").trim();

    const nomorRujukan =
      String(nomor_rujukan || "").trim() ||
      null;

    const proyekId =
      proyek_id
        ? Number(proyek_id)
        : null;

    const klienId =
      Number(klien_id);

    if (!nomorPr) {
      return res.status(400).json({
        error: "Nomor PR wajib diisi."
      });
    }

    if (
      !Number.isInteger(klienId) ||
      klienId <= 0
    ) {
      return res.status(400).json({
        error: "Klien wajib dipilih."
      });
    }

    if (
      !nomorRujukan &&
      !proyekId
    ) {
      return res.status(400).json({
        error:
          "Isi Nomor Rujukan atau pilih Proyek Existing."
      });
    }

    const client =
      await pool.connect();

    try {

      await client.query("BEGIN");

      // =============================================
      // CEK PROYEK SEWA
      // =============================================

      const existing =
        await client.query(
          `
            SELECT id
            FROM public.proyek_sewa
            WHERE id = $1
            FOR UPDATE
          `,
          [proyekSewaId]
        );

      if (
        existing.rowCount === 0
      ) {

        await client.query("ROLLBACK");

        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan."
        });
      }

      // =============================================
      // CEK DUPLIKAT NOMOR PR
      // =============================================

      const duplicatePr =
        await client.query(
          `
            SELECT id
            FROM public.proyek_sewa
            WHERE LOWER(BTRIM(nomor_pr))
                = LOWER(BTRIM($1))
              AND id <> $2
            LIMIT 1
          `,
          [
            nomorPr,
            proyekSewaId
          ]
        );

      if (
        duplicatePr.rowCount > 0
      ) {

        await client.query("ROLLBACK");

        return res.status(409).json({
          error:
            "Nomor PR sudah digunakan proyek sewa lain."
        });
      }

      // =============================================
      // CEK KLIEN
      // =============================================

      const cekKlien =
        await client.query(
          `
            SELECT id
            FROM public.data
            WHERE id = $1
          `,
          [klienId]
        );

      if (
        cekKlien.rowCount === 0
      ) {

        await client.query("ROLLBACK");

        return res.status(400).json({
          error:
            "Klien tidak ditemukan."
        });
      }

      // =============================================
      // CEK PROYEK EXISTING
      // =============================================

      if (proyekId) {

        const cekProyek =
          await client.query(
            `
              SELECT id
              FROM public.proyek
              WHERE id = $1
            `,
            [proyekId]
          );

        if (
          cekProyek.rowCount === 0
        ) {

          await client.query("ROLLBACK");

          return res.status(400).json({
            error:
              "Proyek Existing tidak ditemukan."
          });
        }
      }

      // =============================================
      // UPDATE
      // =============================================

      const updateResult =
        await client.query(
          `
            UPDATE public.proyek_sewa
            SET
              nomor_pr = $1,
              nomor_rujukan = $2,
              proyek_id = $3,
              klien_id = $4,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING *
          `,
          [
            nomorPr,
            nomorRujukan,
            proyekId,
            klienId,
            proyekSewaId
          ]
        );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message:
          "Informasi proyek sewa berhasil diperbarui.",
        data:
          updateResult.rows[0]
      });

    } catch (error) {

      await client.query("ROLLBACK");

      console.error(
        "ERROR UPDATE INFORMASI PROYEK SEWA:",
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
        error: "Belum login."
      });
    }

    const proyekSewaId =
      Number(req.params.id);

    const produk =
      Array.isArray(req.body.produk)
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

      await client.query("BEGIN");

      // =============================================
      // LOCK HEADER PROYEK SEWA
      // =============================================

      const proyekResult =
        await client.query(
          `
            SELECT id
            FROM public.proyek_sewa
            WHERE id = $1
            FOR UPDATE
          `,
          [proyekSewaId]
        );

      if (
        proyekResult.rowCount === 0
      ) {

        await client.query("ROLLBACK");

        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan."
        });
      }

      // =============================================
      // SIMPAN SNAPSHOT PRODUK LAMA
      //
      // WAJIB dilakukan sebelum DELETE.
      // Snapshot ini digunakan untuk menentukan
      // harga kontrak lama.
      // =============================================

      const produkLamaResult =
        await client.query(
          `
            SELECT
              id,
              produk_id,
              harga_per_item,
              durasi_bulan
            FROM public.proyek_sewa_produk
            WHERE proyek_sewa_id = $1
            ORDER BY id ASC
          `,
          [proyekSewaId]
        );

      const produkLama =
        produkLamaResult.rows;

      // =============================================
      // VALIDASI + SIAPKAN DATA
      // =============================================

      const dataProduk =
        [];

      for (
        let i = 0;
        i < produk.length;
        i++
      ) {

        const item =
          produk[i] || {};

        const existingProdukId =
          item.id
            ? Number(item.id)
            : null;

        const produkId =
          Number(item.produk_id);

        const durasiBulan =
          Number(item.durasi_bulan);

        const orders =
          Array.isArray(item.orders)
            ? item.orders
            : [];

        // ===========================================
        // VALIDASI PRODUK
        // ===========================================

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
        // AMBIL MASTER PRODUK TERBARU
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

                jp.name AS jenis_proyek,
                sjp.name AS sub_jenis_proyek

              FROM public.master_produk_sewa mps

              LEFT JOIN public.jenis_proyek jp
                ON jp.id = mps.jenis_proyek_id

              LEFT JOIN public.jenis_proyek sjp
                ON sjp.id = mps.sub_jenis_proyek_id

              WHERE mps.id = $1
            `,
            [produkId]
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

        // ===========================================
        // TENTUKAN HARGA YANG DIPAKAI
        // ===========================================

        let hargaPerItem = 0;

        let sumberHarga =
          "MASTER";

        let existingProduk =
          null;

        // ===========================================
        // JIKA BARIS PRODUK SUDAH ADA
        // ===========================================

        if (existingProdukId) {

          existingProduk =
            produkLama.find(
              row =>
                Number(row.id) ===
                existingProdukId
            );

          if (!existingProduk) {
            throw new Error(
              `Data Produk ${i + 1} tidak ditemukan pada proyek ini.`
            );
          }

          // =========================================
          // PRODUK TIDAK DIGANTI
          //
          // Pakai harga kontrak awal.
          // =========================================

          if (
            Number(
              existingProduk.produk_id
            ) ===
            produkId
          ) {

            hargaPerItem =
              Number(
                existingProduk.harga_per_item
              ) || 0;

            sumberHarga =
              "HARGA KONTRAK AWAL";

          } else {

            // =======================================
            // PRODUK DIGANTI
            //
            // Produk baru berarti menggunakan harga
            // master produk baru saat ini.
            // =======================================

            hargaPerItem =
              Number(
                master.harga_jual_per_item
              ) || 0;

            sumberHarga =
              "MASTER PRODUK BARU";
          }

        } else {

          // =========================================
          // PRODUK BARU DITAMBAHKAN
          // =========================================

          hargaPerItem =
            Number(
              master.harga_jual_per_item
            ) || 0;

          sumberHarga =
            "MASTER PRODUK BARU";
        }

        if (
          !Number.isFinite(hargaPerItem) ||
          hargaPerItem < 0
        ) {
          throw new Error(
            `Harga Produk ${i + 1} tidak valid.`
          );
        }

        console.log(
          `PRODUK ${i + 1}:`,
          {
            produkId,
            existingProdukId,
            namaProduk:
              master.item_produk,
            hargaPerItem,
            sumberHarga
          }
        );

        // ===========================================
        // VALIDASI ORDER
        // ===========================================

        const validOrders =
          [];

        for (
          let j = 0;
          j < orders.length;
          j++
        ) {

          const order =
            orders[j] || {};

          const cabangId =
            Number(order.cabang_id);

          const quantity =
            Number(order.quantity);

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
              [cabangId]
            );

          if (
            cabangResult.rowCount === 0
          ) {
            throw new Error(
              `Lokasi Order ${j + 1} pada Produk ${i + 1} tidak ditemukan.`
            );
          }

          // =========================================
          // PERHITUNGAN
          //
          // Harga / bulan:
          // harga kontrak × quantity
          //
          // Total:
          // harga / bulan × durasi
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
      // SEMUA VALIDASI SUDAH LOLOS
      //
      // SEKARANG BOLEH HAPUS DATA LAMA
      // =============================================

      await client.query(
        `
          DELETE FROM public.proyek_sewa_produk
          WHERE proyek_sewa_id = $1
        `,
        [proyekSewaId]
      );

      // =============================================
      // INSERT ULANG PRODUK + ORDER
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
              ) AS total_nilai_per_bulan,

              COALESCE(
                SUM(
                  pso.total_harga
                ),
                0
              ) AS total_nilai

            FROM public.proyek_sewa_produk psp

            JOIN public.proyek_sewa_order pso
              ON pso.proyek_sewa_produk_id =
                 psp.id

            WHERE
              psp.proyek_sewa_id = $1
          `,
          [proyekSewaId]
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
      // UPDATE HEADER
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

      await client.query("COMMIT");

      return res.json({
        success: true,

        message:
          "Produk & Order berhasil diperbarui.",

        total_nilai_per_bulan:
          totalPerBulan,

        total_nilai:
          totalNilai
      });

    } catch (error) {

      await client.query("ROLLBACK");

      console.error(
        "ERROR UPDATE PRODUK ORDER SEWA:",
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
// 3. UPDATE PEMBAYARAN
// PUT /api/proyek-sewa/:id/pembayaran
// =====================================================

app.put(
  "/api/proyek-sewa/:id/pembayaran",
  async (req, res) => {

    if (!req.session?.user) {
      return res.status(401).json({
        error: "Belum login."
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
          "ID proyek sewa tidak valid."
      });
    }

    const client =
      await pool.connect();

    try {

      await client.query("BEGIN");

      // =============================================
      // LOCK PROYEK
      // =============================================

      const proyekResult =
        await client.query(
          `
            SELECT
              id,
              total_nilai
            FROM public.proyek_sewa
            WHERE id = $1
            FOR UPDATE
          `,
          [proyekSewaId]
        );

      if (
        proyekResult.rowCount === 0
      ) {

        await client.query("ROLLBACK");

        return res.status(404).json({
          error:
            "Proyek sewa tidak ditemukan."
        });
      }

      // =============================================
      // VALIDASI
      // =============================================

      const pembayaranValid =
        [];

      for (
        let i = 0;
        i < pembayaran.length;
        i++
      ) {

        const item =
          pembayaran[i] || {};

        const deskripsi =
          String(
            item.deskripsi || ""
          ).trim();

        const nominal =
          Number(
            item.nominal
          ) || 0;

        const tanggalBayar =
          item.tanggal_bayar
            ? String(
                item.tanggal_bayar
              )
            : null;

        if (
          nominal < 0
        ) {
          throw new Error(
            `Nominal pembayaran ${i + 1} tidak boleh negatif.`
          );
        }

        if (
          nominal > 0 &&
          !tanggalBayar
        ) {
          throw new Error(
            `Tanggal pembayaran ${i + 1} wajib diisi.`
          );
        }

        // Abaikan baris kosong
        if (
          !deskripsi &&
          nominal === 0 &&
          !tanggalBayar
        ) {
          continue;
        }

        pembayaranValid.push({
          deskripsi,
          nominal,
          tanggalBayar
        });
      }

      // =============================================
      // HAPUS PEMBAYARAN LAMA
      // =============================================

      await client.query(
        `
          DELETE
          FROM public.proyek_sewa_pembayaran
          WHERE proyek_sewa_id = $1
        `,
        [proyekSewaId]
      );

      // =============================================
      // INSERT ULANG
      // =============================================

      for (
        const item
        of pembayaranValid
      ) {

        await client.query(
          `
            INSERT INTO public.proyek_sewa_pembayaran
            (
              proyek_sewa_id,
              deskripsi,
              nominal,
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
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `,
          [
            proyekSewaId,
            item.deskripsi,
            item.nominal,
            item.tanggalBayar
          ]
        );
      }

      // =============================================
      // TOTAL DIBAYAR
      // =============================================

      const totalBayarResult =
        await client.query(
          `
            SELECT
              COALESCE(
                SUM(nominal),
                0
              ) AS total_dibayar
            FROM public.proyek_sewa_pembayaran
            WHERE proyek_sewa_id = $1
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
          proyekResult
            .rows[0]
            .total_nilai
        ) || 0;

      const sisaPembayaran =
        Math.max(
          0,
          totalNilai -
          totalDibayar
        );

      // =============================================
      // UPDATE HEADER
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

      await client.query("COMMIT");

      return res.json({
        success: true,

        message:
          "Riwayat pembayaran berhasil diperbarui.",

        total_dibayar:
          totalDibayar,

        sisa_pembayaran:
          sisaPembayaran
      });

    } catch (error) {

      await client.query("ROLLBACK");

      console.error(
        "ERROR UPDATE PEMBAYARAN SEWA:",
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
// UPDATE PEMBAYARAN PROYEK SEWA
// PUT /api/proyek-sewa/:id/pembayaran
// =====================================================

app.put(
  "/api/proyek-sewa/:id/pembayaran",
  async (req, res) => {

    if (!req.session?.user) {

      return res.status(401).json({
        error: "Belum login."
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
          "ID proyek sewa tidak valid."
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
            SELECT
              id,
              total_nilai

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
      // VALIDASI PEMBAYARAN
      // =============================================

      const pembayaranValid =
        [];


      for (
        let i = 0;
        i < pembayaran.length;
        i++
      ) {

        const item =
          pembayaran[i];


        const deskripsi =
          String(
            item.deskripsi ||
            ""
          ).trim();


        const nominal =
          Number(
            item.nominal
          ) || 0;


        const tanggalBayar =
          item.tanggal_bayar
            ? String(
                item.tanggal_bayar
              )
            : null;


        if (
          nominal < 0
        ) {

          throw new Error(
            `Nominal pembayaran ${i + 1} tidak boleh negatif.`
          );

        }


        if (
          nominal > 0 &&
          !tanggalBayar
        ) {

          throw new Error(
            `Tanggal pembayaran ${i + 1} wajib diisi.`
          );

        }


        // Baris kosong tidak perlu disimpan
        if (
          !deskripsi &&
          nominal === 0 &&
          !tanggalBayar
        ) {

          continue;

        }


        pembayaranValid.push({

          deskripsi,

          nominal,

          tanggalBayar

        });

      }


      // =============================================
      // HAPUS PEMBAYARAN LAMA
      // =============================================

      await client.query(
        `
          DELETE FROM public.proyek_sewa_pembayaran
          WHERE proyek_sewa_id = $1
        `,
        [
          proyekSewaId
        ]
      );


      // =============================================
      // INSERT ULANG PEMBAYARAN
      // =============================================

      for (
        const item
        of pembayaranValid
      ) {

        await client.query(
          `
            INSERT INTO public.proyek_sewa_pembayaran
            (
              proyek_sewa_id,
              deskripsi,
              nominal,
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
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
          `,
          [
            proyekSewaId,
            item.deskripsi,
            item.nominal,
            item.tanggalBayar
          ]
        );

      }


      // =============================================
      // UPDATE UPDATED_AT HEADER
      // =============================================

      await client.query(
        `
          UPDATE public.proyek_sewa

          SET
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1
        `,
        [
          proyekSewaId
        ]
      );


      // =============================================
      // HITUNG TOTAL DIBAYAR
      // =============================================

      const totalBayarResult =
        await client.query(
          `
            SELECT
              COALESCE(
                SUM(nominal),
                0
              )
                AS total_dibayar

            FROM public.proyek_sewa_pembayaran

            WHERE proyek_sewa_id = $1
          `,
          [
            proyekSewaId
          ]
        );


      const totalDibayar =
        Number(
          totalBayarResult
            .rows[0]
            .total_dibayar
        ) || 0;


      const totalNilai =
        Number(
          proyekResult
            .rows[0]
            .total_nilai
        ) || 0;


      const sisaPembayaran =
        Math.max(
          0,
          totalNilai -
          totalDibayar
        );


      await client.query(
        "COMMIT"
      );


      return res.json({

        message:
          "Riwayat pembayaran berhasil diperbarui.",

        total_dibayar:
          totalDibayar,

        sisa_pembayaran:
          sisaPembayaran

      });


    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


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

// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server berjalan di port ${PORT}`);
});