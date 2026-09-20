
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
// MENU
// ======================================================
app.get('/api/menu', 
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
app.get("/api/dashboard", 
  async (req, res) => {

  // Pastikan user sudah login
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: "Belum login"
    });
  }

  try {

    const user = req.session.user;

    const isAdmin =
      String(user.role || "")
        .toLowerCase() === "admin";

    const picId = user.id;
  
    // DATA PROYEK + KLIEN
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

    -- kategori utama / legacy
    p.kategori_produk_id,

    kp.nama_kategori_produk,

    -- semua ID kategori
    COALESCE(
      (
        SELECT
          ARRAY_AGG(
            pk2.kategori_produk_id
            ORDER BY pk2.kategori_produk_id
          )

        FROM public.proyek_kategori pk2

        WHERE pk2.proyek_id = p.id
      ),

      CASE
        WHEN p.kategori_produk_id IS NOT NULL
        THEN ARRAY[
          p.kategori_produk_id
        ]
        ELSE ARRAY[]::INTEGER[]
      END
    ) AS kategori_produk_ids,

    -- semua nama kategori
    COALESCE(
      (
        SELECT
          ARRAY_AGG(
            kp2.nama_kategori_produk
            ORDER BY kp2.nama_kategori_produk
          )

        FROM public.proyek_kategori pk2

        JOIN public.kategori_produk kp2
          ON kp2.id =
             pk2.kategori_produk_id

        WHERE pk2.proyek_id = p.id
      ),

      CASE
        WHEN kp.nama_kategori_produk
             IS NOT NULL
        THEN ARRAY[
          kp.nama_kategori_produk
        ]
        ELSE ARRAY[]::TEXT[]
      END
    ) AS nama_kategori_produk_list

  FROM public.proyek p

  LEFT JOIN public.kategori_produk kp
    ON kp.id = p.kategori_produk_id

  WHERE
  $1::boolean = TRUE

  OR EXISTS (
    SELECT 1
    FROM public.proyek_pic pp_filter
    WHERE
      pp_filter.proyek_id = p.id
      AND pp_filter.pic_id = $2
  )

ORDER BY p.id DESC
`,
[
  isAdmin,
  picId
]
);

    // PIC SELURUH PROYEK
    const picResult = await pool.query(`
      SELECT
        pp.proyek_id,
        pic.id,
        pic.nama AS nama_pic

      FROM public.proyek_pic pp

      JOIN public.pic pic
        ON pic.id = pp.pic_id

      ORDER BY pic.nama ASC
    `);

    // NILAI TERMIN KLIEN
    // =================================================
    // Nilai termin =
    // nilai final klien × persentase / 100
    //
    // TERTAGIH:
    // hanya status "Dibayar"
    //
    // BELUM TERTAGIH:
    // selain status "Dibayar"
    // ==================================================

    const terminKlienResult = await pool.query(`
      SELECT
        pk.proyek_id,

        COALESCE(
          SUM(
            CASE
              WHEN pkt.status_pembayaran = 'Dibayar'
              THEN
                (
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
                )
              ELSE 0
            END
          ),
          0
        ) AS nilai_tertagih_klien,

        COALESCE(
          SUM(
            CASE
              WHEN pkt.status_pembayaran IS DISTINCT FROM 'Dibayar'
              THEN
                (
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
                )
              ELSE 0
            END
          ),
          0
        ) AS nilai_belum_tertagih_klien

      FROM public.proyek_klien pk

      LEFT JOIN public.proyek_klien_termin pkt
        ON pkt.proyek_klien_id = pk.id

      GROUP BY pk.proyek_id
    `);

    // NILAI TERMIN PARTNER
    const terminPartnerResult = await pool.query(`
      SELECT
        pp.proyek_id,

        COALESCE(
          SUM(
            CASE
              WHEN ppt.status_pembayaran = 'Dibayar'
              THEN
                (
                  COALESCE(
                    pp.nilai_nego_3,
                    pp.nilai_nego_2,
                    pp.nilai_nego_1,
                    pp.nilai_submit,
                    0
                  )
                  *
                  COALESCE(ppt.persentase, 0)
                  / 100.0
                )
              ELSE 0
            END
          ),
          0
        ) AS nilai_terbayar_partner,

        COALESCE(
          SUM(
            CASE
              WHEN ppt.status_pembayaran IS DISTINCT FROM 'Dibayar'
              THEN
                (
                  COALESCE(
                    pp.nilai_nego_3,
                    pp.nilai_nego_2,
                    pp.nilai_nego_1,
                    pp.nilai_submit,
                    0
                  )
                  *
                  COALESCE(ppt.persentase, 0)
                  / 100.0
                )
              ELSE 0
            END
          ),
          0
        ) AS nilai_belum_terbayar_partner

      FROM public.proyek_partner pp

      LEFT JOIN public.proyek_partner_termin ppt
        ON ppt.proyek_partner_id = pp.id

      GROUP BY pp.proyek_id
    `);


    // KONTRAK KLIEN JATUH TEMPO HARI INI S/D 3 BULAN KE DEPAN

    const kontrakKlienResult = await pool.query(`
  SELECT
    p.id AS proyek_id,
    p.nama_proyek,

    d.perusahaan_klien AS nama_klien,

    pk.tanggal_akhir,

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
          SELECT
            SUM(pkt.nominal)

          FROM public.proyek_klien_termin pkt

          WHERE
            pkt.proyek_klien_id = pk.id
        ),
        0
      )
    END AS nilai_final,

    (
      pk.tanggal_akhir - CURRENT_DATE
    ) AS sisa_hari

  FROM public.proyek_klien pk

  JOIN public.proyek p
    ON p.id = pk.proyek_id

  JOIN public.data d
    ON d.id = pk.klien_id

  WHERE
    pk.tanggal_akhir IS NOT NULL

    AND pk.tanggal_akhir >= CURRENT_DATE

    AND pk.tanggal_akhir <=
      CURRENT_DATE + INTERVAL '3 months'

  ORDER BY
    pk.tanggal_akhir ASC
`);

  // KONTRAK PARTNER JATUH TEMPO HARI INI S/D 3 BULAN KE DEPAN
  const kontrakPartnerResult = await pool.query(`
  SELECT
    p.id AS proyek_id,
    p.nama_proyek,

    pr.nama_partner,

    pp.tanggal_akhir,

    COALESCE(
      pp.nilai_nego_3,
      pp.nilai_nego_2,
      pp.nilai_nego_1,
      pp.nilai_submit,
      0
    ) AS nilai_final,

    (
      pp.tanggal_akhir - CURRENT_DATE
    ) AS sisa_hari

  FROM public.proyek_partner pp

  JOIN public.proyek p
    ON p.id = pp.proyek_id

  JOIN public.partner pr
    ON pr.id = pp.partner_id

  WHERE
    pp.tanggal_akhir IS NOT NULL

    AND pp.tanggal_akhir >= CURRENT_DATE

    AND pp.tanggal_akhir <=
      CURRENT_DATE + INTERVAL '3 months'

  ORDER BY
    pp.tanggal_akhir ASC
`);


  // SUSUN PIC BERDASARKAN PROYEK

    const picMap = {};

    for (const item of picResult.rows) {

      if (!picMap[item.proyek_id]) {
        picMap[item.proyek_id] = [];
      }

      picMap[item.proyek_id].push({
        id: item.id,
        nama_pic: item.nama_pic
      });

    }

  // MAP TERMIN KLIEN
    const terminKlienMap = {};

    for (const item of terminKlienResult.rows) {

      terminKlienMap[item.proyek_id] = {
        nilai_tertagih_klien:
          Number(
            item.nilai_tertagih_klien
          ) || 0,

        nilai_belum_tertagih_klien:
          Number(
            item.nilai_belum_tertagih_klien
          ) || 0
      };

    }

    // MAP TERMIN PARTNER

    const terminPartnerMap = {};

    for (const item of terminPartnerResult.rows) {

      terminPartnerMap[item.proyek_id] = {
        nilai_terbayar_partner:
          Number(
            item.nilai_terbayar_partner
          ) || 0,

        nilai_belum_terbayar_partner:
          Number(
            item.nilai_belum_terbayar_partner
          ) || 0
      };

    }

    // GABUNGKAN DATA PROYEK

    const proyek = proyekResult.rows.map(
      item => {

        const klienTermin =
          terminKlienMap[item.id] || {
            nilai_tertagih_klien: 0,
            nilai_belum_tertagih_klien: 0
          };


        const partnerTermin =
          terminPartnerMap[item.id] || {
            nilai_terbayar_partner: 0,
            nilai_belum_terbayar_partner: 0
          };


        return {

          id:
            item.id,

          nama_proyek:
            item.nama_proyek,

          status_final:
            item.status_final,

          nama_klien:
            item.nama_klien,

          tanggal_mulai:
            item.tanggal_mulai,

          tanggal_akhir:
            item.tanggal_akhir,

          nilai_proyek:
            Number(
              item.nilai_proyek
            ) || 0,

          pic:
            picMap[item.id] || [],

          nilai_tertagih_klien:
            klienTermin
              .nilai_tertagih_klien,

          nilai_belum_tertagih_klien:
            klienTermin
              .nilai_belum_tertagih_klien,

          nilai_terbayar_partner:
            partnerTermin
              .nilai_terbayar_partner,

          nilai_belum_terbayar_partner:
            partnerTermin
              .nilai_belum_terbayar_partner

        };

      }
    );

    // RESPONSE
    res.json({

      proyek,

      kontrak_klien_jatuh_tempo:
        kontrakKlienResult.rows,

      kontrak_partner_jatuh_tempo:
        kontrakPartnerResult.rows

    });


  } catch (error) {

    console.error(
      "ERROR DASHBOARD:",
      error
    );

    res.status(500).json({
      error: error.message
    });

  }

});

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

app.get(
  "/api/proyek",
  async (req, res) => {

    if (
      !req.session?.user
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
            p.jenis_proyek,
            p.sub_jenis_proyek,
            p.status_final,
            p.created_at,
            p.updated_at,

            kp.nama_kategori_produk,

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
              CASE
                WHEN kp.nama_kategori_produk IS NOT NULL
                  THEN ARRAY[kp.nama_kategori_produk]
                ELSE ARRAY[]::TEXT[]
              END
            ) AS nama_kategori_produk_list,

            d.perusahaan_klien,

            COALESCE(
              pk.nilai_nego_3,
              pk.nilai_nego_2,
              pk.nilai_nego_1,
              pk.nilai_submit,
              0
            ) AS nilai_final_klien,

            STRING_AGG(
              DISTINCT pr.nama_partner,
              ', '
            ) AS nama_partner,

            COALESCE(
              SUM(
                COALESCE(
                  pp.nilai_nego_3,
                  pp.nilai_nego_2,
                  pp.nilai_nego_1,
                  pp.nilai_submit,
                  0
                )
              ),
              0
            ) AS nilai_partner,

            COALESCE(
              pk.nilai_nego_3,
              pk.nilai_nego_2,
              pk.nilai_nego_1,
              pk.nilai_submit,
              0
            )
            -
            COALESCE(
              SUM(
                COALESCE(
                  pp.nilai_nego_3,
                  pp.nilai_nego_2,
                  pp.nilai_nego_1,
                  pp.nilai_submit,
                  0
                )
              ),
              0
            ) AS margin

          FROM public.proyek p

          LEFT JOIN public.kategori_produk kp
            ON kp.id = p.kategori_produk_id

          LEFT JOIN public.proyek_klien pk
            ON pk.proyek_id = p.id

          LEFT JOIN public.data d
            ON d.id = pk.klien_id

          LEFT JOIN public.proyek_partner pp
            ON pp.proyek_id = p.id

          LEFT JOIN public.partner pr
            ON pr.id = pp.partner_id

          WHERE
            $1::boolean = TRUE
            OR EXISTS (
              SELECT 1
              FROM public.proyek_pic auth_pic
              WHERE auth_pic.proyek_id = p.id
                AND auth_pic.pic_id = $2
            )

          GROUP BY
            p.id,
            p.nama_proyek,
            p.jenis_proyek,
            p.sub_jenis_proyek,
            p.status_final,
            p.created_at,
            p.updated_at,
            kp.nama_kategori_produk,
            d.perusahaan_klien,
            pk.nilai_submit,
            pk.nilai_nego_1,
            pk.nilai_nego_2,
            pk.nilai_nego_3

          ORDER BY p.id DESC
          `,
          [
            isAdmin,
            picId
          ]
        );

      res.json(rows);

    } catch (error) {

      console.error(
        "ERROR READ PROYEK:",
        error
      );

      res.status(500).json({
        error: error.message
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
// DAFTAR PROYEK
// ======================================================

app.get("/api/proyek-listing", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.nama_proyek,
        p.jenis_proyek,
        p.sub_jenis_proyek,
        p.status_final,
        p.created_at,
        p.updated_at,
        (
          SELECT pk.tanggal_akhir
          FROM public.proyek_klien pk
          WHERE pk.proyek_id = p.id
          ORDER BY pk.id DESC
          LIMIT 1
        ) AS tanggal_akhir_klien,

        /* =========================
           KATEGORI PROYEK
        ========================= */
        COALESCE(
          kategori.nama_kategori_produk,
          '-'
        ) AS nama_kategori_produk,

        COALESCE(
          kategori.nama_kategori_produk_list,
          ARRAY[]::text[]
        ) AS nama_kategori_produk_list,

        /* =========================
           INFORMASI KLIEN
        ========================= */
        klien.klien_id,
        klien.perusahaan_klien,
        klien.tanggal_mulai AS tanggal_mulai_klien,
        klien.tanggal_akhir AS tanggal_akhir_klien,

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
          ARRAY[]::text[]
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
          WHEN COALESCE(
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
            DISTINCT kp.nama_kategori_produk,
            ', '
            ORDER BY kp.nama_kategori_produk
          ) AS nama_kategori_produk,

          ARRAY_AGG(
            DISTINCT kp.nama_kategori_produk
            ORDER BY kp.nama_kategori_produk
          ) AS nama_kategori_produk_list

        FROM public.proyek_kategori pk

        JOIN public.kategori_produk kp
          ON kp.id = pk.kategori_produk_id

        WHERE pk.proyek_id = p.id
      ) kategori ON TRUE

      /* =========================
         DATA KLIEN PROYEK
      ========================= */
      LEFT JOIN LATERAL (
        SELECT
          pk.id,
          pk.klien_id,
          d.perusahaan_klien,
          pk.tanggal_mulai,
          pk.tanggal_akhir,

          COALESCE(
            pk.nilai_nego_3,
            pk.nilai_nego_2,
            pk.nilai_nego_1,
            pk.nilai_submit,
            0
          )::numeric AS nilai_final_klien

        FROM public.proyek_klien pk

        LEFT JOIN public.data d
          ON d.id = pk.klien_id

        WHERE pk.proyek_id = p.id

        ORDER BY pk.id DESC

        LIMIT 1
      ) klien ON TRUE

      /* =========================
         MULTI PARTNER
      ========================= */
      LEFT JOIN LATERAL (
        SELECT
          STRING_AGG(
            DISTINCT pr.nama_partner,
            ', '
            ORDER BY pr.nama_partner
          ) AS nama_partner,

          ARRAY_AGG(
            DISTINCT pr.nama_partner
            ORDER BY pr.nama_partner
          ) AS nama_partner_list,

          SUM(
            COALESCE(
              pp.nilai_nego_3,
              pp.nilai_nego_2,
              pp.nilai_nego_1,
              pp.nilai_submit,
              0
            )
          )::numeric AS nilai_partner

        FROM public.proyek_partner pp

        JOIN public.partner pr
          ON pr.id = pp.partner_id

        WHERE pp.proyek_id = p.id
      ) partner ON TRUE

      ORDER BY
        p.created_at DESC,
        p.id DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error(
      "ERROR GET LISTING PROYEK:",
      error
    );

    res.status(500).json({
      error: error.message
    });
  }
});
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

app.post("/api/proyek/partner/:proyekPartnerId/termin",
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      const proyekPartnerId =
        Number(
          req.params.proyekPartnerId
        );

      const {
        nama_termin,
        persentase,
        nominal,
        status_pembayaran,
        tanggal_jatuh_tempo,
        tanggal_bayar
      } = req.body;


      if (!proyekPartnerId) {

        return res.status(400).json({
          error:
            "ID partner proyek tidak valid"
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
      // AMBIL JENIS PROYEK
      // ==================================================

      const partnerResult =
        await client.query(
          `
          SELECT
            pp.id,
            pp.proyek_id,
            p.jenis_proyek

          FROM public.proyek_partner pp

          JOIN public.proyek p
            ON p.id = pp.proyek_id

          WHERE pp.id = $1
          `,
          [
            proyekPartnerId
          ]
        );


      if (
        partnerResult.rows.length === 0
      ) {

        throw new Error(
          "Partner proyek tidak ditemukan"
        );

      }


      const jenisProyek =
        String(
          partnerResult.rows[0]
            .jenis_proyek || ""
        )
        .trim()
        .toLowerCase();


      const isTransaksi =
        jenisProyek === "transaksi";


      // ==================================================
      // VALIDASI TRANSAKSI
      // ==================================================

      if (isTransaksi) {

        const nilaiNominal =
          Number(nominal);


        if (
          !Number.isFinite(
            nilaiNominal
          ) ||
          nilaiNominal <= 0
        ) {

          throw new Error(
            "Nominal termin harus lebih dari 0"
          );

        }

      }


      // ==================================================
      // VALIDASI REGULER / SLA / SEWA
      // ==================================================

      else {

        const nilaiPersentase =
          Number(persentase);


        if (
          !Number.isFinite(
            nilaiPersentase
          ) ||
          nilaiPersentase <= 0
        ) {

          throw new Error(
            "Persentase termin harus lebih dari 0"
          );

        }


        // CEK TOTAL TERMIN
        const totalResult =
          await client.query(
            `
            SELECT
              COALESCE(
                SUM(persentase),
                0
              ) AS total

            FROM public.proyek_partner_termin

            WHERE proyek_partner_id = $1
            `,
            [
              proyekPartnerId
            ]
          );


        const totalSekarang =
          Number(
            totalResult.rows[0].total ||
            0
          );


        if (
          totalSekarang +
          nilaiPersentase >
          100
        ) {

          throw new Error(
            `Total persentase termin tidak boleh lebih dari 100%. Saat ini ${totalSekarang}%.`
          );

        }

      }


      // ==================================================
      // INSERT TERMIN
      // ==================================================

      const result =
        await client.query(
          `
          INSERT INTO public.proyek_partner_termin
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

          RETURNING *
          `,
          [

            proyekPartnerId,

            nama_termin.trim(),

            isTransaksi
              ? null
              : Number(
                  persentase
                ),

            isTransaksi
              ? Number(
                  nominal
                )
              : null,

            status_pembayaran ||
              null,

            tanggal_jatuh_tempo ||
              null,

            tanggal_bayar ||
              null

          ]
        );


      await client.query(
        "COMMIT"
      );


      return res.json(
        result.rows[0]
      );


    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


      console.error(
        "ERROR TAMBAH TERMIN PARTNER:",
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
        status_pembayaran,
        tanggal_jatuh_tempo,
        tanggal_bayar,
        syarat_pembayaran
      } = req.body || {};

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

app.put(
  "/api/proyek/:id/klien",
  async (req, res) => {
    const proyekId =
      Number(req.params.id);

    // ==================================================
    // VALIDASI ID PROYEK
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


    // ==================================================
    // AMBIL BODY REQUEST
    // ==================================================

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


    console.log(
      "BODY UPDATE KLIEN:",
      {
        proyek_id:
          proyekId,

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
      }
    );


    // ==================================================
    // VALIDASI KLIEN
    // ==================================================

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


    // ==================================================
    // HELPER NILAI ANGKA
    // ==================================================

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

      return Number.isFinite(hasil)
        ? hasil
        : null;
    }


    // ==================================================
    // NORMALISASI MODEL PEMBAYARAN
    // ==================================================

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


    // ==================================================
    // NORMALISASI STATUS
    // ==================================================

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


    try {
      // ================================================
      // PASTIKAN PROYEK ADA
      // ================================================

      const proyekResult =
        await pool.query(
          `
          SELECT id
          FROM public.proyek
          WHERE id = $1
          LIMIT 1
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


      // ================================================
      // PASTIKAN MASTER KLIEN ADA
      // ================================================

      const masterKlienResult =
        await pool.query(
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
        return res.status(404).json({
          error:
            "Master data klien tidak ditemukan"
        });
      }


      // ================================================
      // UPDATE DATA KLIEN TERBARU
      // ================================================

      const result =
        await pool.query(
          `
          WITH klien_terbaru AS (
            SELECT id
            FROM public.proyek_klien
            WHERE proyek_id = $1
            ORDER BY id DESC
            LIMIT 1
          )

          UPDATE public.proyek_klien pk
          SET
            klien_id = $2,
            nilai_submit = $3,
            nilai_nego_1 = $4,
            nilai_nego_2 = $5,
            nilai_nego_3 = $6,
            tanggal_mulai = $7,
            tanggal_akhir = $8,
            model_pembayaran = $9,
            status_pengadaan = $10,
            status_teknis = $11,
            status_administrasi = $12,
            updated_at = NOW()

          FROM klien_terbaru kt

          WHERE pk.id = kt.id

          RETURNING
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
            pk.created_at,
            pk.updated_at
          `,
          [
            proyekId,
            klienId,

            angkaAtauNull(
              nilai_submit
            ),

            angkaAtauNull(
              nilai_nego_1
            ),

            angkaAtauNull(
              nilai_nego_2
            ),

            angkaAtauNull(
              nilai_nego_3
            ),

            tanggal_mulai || null,
            tanggal_akhir || null,
            modelPembayaran,
            statusPengadaan,
            statusTeknis,
            statusAdministrasi
          ]
        );


      // ================================================
      // JIKA BELUM ADA DATA KLIEN, BUAT DATA BARU
      // ================================================

      let dataKlien;

      if (
        result.rowCount === 0
      ) {
        const insertResult =
          await pool.query(
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
            RETURNING *
            `,
            [
              proyekId,
              klienId,

              angkaAtauNull(
                nilai_submit
              ),

              angkaAtauNull(
                nilai_nego_1
              ),

              angkaAtauNull(
                nilai_nego_2
              ),

              angkaAtauNull(
                nilai_nego_3
              ),

              tanggal_mulai || null,
              tanggal_akhir || null,
              modelPembayaran,
              statusPengadaan,
              statusTeknis,
              statusAdministrasi
            ]
          );

        dataKlien =
          insertResult.rows[0];

      } else {
        dataKlien =
          result.rows[0];
      }


      // ================================================
      // TAMBAHKAN NAMA PERUSAHAAN PADA RESPONSE
      // ================================================

      dataKlien.perusahaan_klien =
        masterKlienResult
          .rows[0]
          .perusahaan_klien;


      console.log(
        "HASIL UPDATE KLIEN:",
        dataKlien
      );


      // ================================================
      // RESPONSE BERHASIL
      // ================================================

      res.json({
        message:
          "Data klien berhasil diperbarui",

        data:
          dataKlien
      });

    } catch (error) {
      console.error(
        "ERROR UPDATE KLIEN PROYEK:",
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
        await pool.query(
          `
          SELECT
            pp.id AS proyek_partner_id,
            pr.nama_partner AS nama

          FROM public.proyek_partner pp

          JOIN public.partner pr
            ON pr.id =
               pp.partner_id

          WHERE
            pp.proyek_id = $1

          ORDER BY
            pr.nama_partner
          `,
          [proyekId]
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

      const offset =
        (page - 1) * limit;

      const result =
        await pool.query(
          `
            WITH proyek_partner_aktif AS (
              SELECT
                pp.id AS proyek_partner_id,
                pp.partner_id,
                p.id AS proyek_id,
                p.nama_proyek,
                pp.tanggal_mulai,
                pp.tanggal_akhir,

                COALESCE(
                  NULLIF(pp.nilai_nego_3, 0),
                  NULLIF(pp.nilai_nego_2, 0),
                  NULLIF(pp.nilai_nego_1, 0),
                  pp.nilai_submit,
                  0
                )::numeric
                  AS nilai_proyek

              FROM public.proyek_partner pp

              JOIN public.proyek p
                ON p.id = pp.proyek_id

              WHERE
                (
                  pp.tanggal_akhir IS NULL
                  OR pp.tanggal_akhir >=
                     CURRENT_DATE
                )

                AND LOWER(
                  COALESCE(
                    p.status_final,
                    ''
                  )
                ) NOT IN (
                  'done',
                  'cancel',
                  'Done',
                  'Cancel'
                )
            ),

            pembayaran_partner AS (
              SELECT
                ppt.proyek_partner_id,

                COALESCE(
                  SUM(
                    CASE
                      WHEN LOWER(
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
                      THEN COALESCE(
                        ppt.nominal,
                        0
                      )
                      ELSE 0
                    END
                  ),
                  0
                )::numeric
                  AS sudah_dibayar

              FROM public.proyek_partner_termin ppt

              GROUP BY
                ppt.proyek_partner_id
            ),

            daftar_proyek AS (
              SELECT
                ppa.*,

                COALESCE(
                  bayar.sudah_dibayar,
                  0
                ) AS sudah_dibayar

              FROM proyek_partner_aktif ppa

              LEFT JOIN pembayaran_partner bayar
                ON bayar.proyek_partner_id =
                   ppa.proyek_partner_id
            ),

            ringkasan_partner AS (
              SELECT
                partner.id AS partner_id,
                partner.nama_partner,
                partner.inisial,

                COUNT(
                  dp.proyek_partner_id
                )::integer
                  AS total_proyek,

                COALESCE(
                  SUM(dp.nilai_proyek),
                  0
                )::numeric
                  AS nilai_proyek,

                COALESCE(
                  SUM(dp.sudah_dibayar),
                  0
                )::numeric
                  AS sudah_dibayar,

                GREATEST(
                  COALESCE(
                    SUM(dp.nilai_proyek),
                    0
                  ) -
                  COALESCE(
                    SUM(dp.sudah_dibayar),
                    0
                  ),
                  0
                )::numeric
                  AS sisa,

                COALESCE(
                  JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                      'proyek_partner_id',
                      dp.proyek_partner_id,

                      'proyek_id',
                      dp.proyek_id,

                      'nama_proyek',
                      dp.nama_proyek,

                      'nilai_proyek',
                      dp.nilai_proyek,

                      'sudah_dibayar',
                      dp.sudah_dibayar,

                      'tanggal_mulai',
                      dp.tanggal_mulai,

                      'tanggal_akhir',
                      dp.tanggal_akhir
                    )
                    ORDER BY
                      dp.tanggal_akhir ASC NULLS LAST,
                      dp.nama_proyek ASC
                  ) FILTER (
                    WHERE
                      dp.proyek_partner_id
                      IS NOT NULL
                  ),
                  '[]'::jsonb
                ) AS proyek

              FROM public.partner partner

              JOIN daftar_proyek dp
                ON dp.partner_id =
                   partner.id

              WHERE
                (
                  $1 = ''
                  OR partner.nama_partner
                     ILIKE '%' || $1 || '%'
                  OR COALESCE(
                       partner.inisial,
                       ''
                     )
                     ILIKE '%' || $1 || '%'
                )

              GROUP BY
                partner.id,
                partner.nama_partner,
                partner.inisial
            )

            SELECT
              ringkasan_partner.*,

              COUNT(*) OVER()
                AS total_data

            FROM ringkasan_partner

           ORDER BY
              ringkasan_partner.total_proyek DESC,
              ringkasan_partner.nilai_proyek DESC,
              ringkasan_partner.nama_partner ASC

            LIMIT $2
            OFFSET $3
          `,
          [
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
            ...partner
          } = item;

          return partner;
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
        "ERROR GET PARTNER PROYEK AKTIF:",
        error
      );

      res.status(500).json({
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
// START SERVER
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server berjalan di port ${PORT}`);
});