
const path = require("path");
const pool = require("./db");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");



const app = express();

// ======================================================
// LOGIN
// ======================================================

app.use(express.json());

// ======================================================
// SESSION LOGIN
// ======================================================

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


      // ======================================
      // BUAT SESSION
      // ======================================

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


      // ======================================
      // SIMPAN SESSION SEBELUM RESPONSE
      // ======================================

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


// ======================================================
// LOGOUT
// ======================================================

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
    "/task.html"

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
// MASTER DATA KLIEN
// ======================================================


// =========================
// READ KLIEN
// =========================
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



// =========================
// CREATE KLIEN
// =========================
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


// =========================
// UPDATE KLIEN
// =========================
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


// =========================
// DELETE KLIEN
// =========================
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


// =========================
// READ PARTNER
// =========================
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


// =========================
// CREATE PARTNER
// =========================
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


// =========================
// UPDATE PARTNER
// =========================
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


// =========================
// DELETE PARTNER
// =========================
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
// SERVER
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


// READ
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


// CREATE
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


// UPDATE
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


// DELETE
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


// READ
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


// CREATE
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


// UPDATE
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


// DELETE
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
// DASHBOARD
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
  

    // ==================================================
    // 1. DATA PROYEK + KLIEN
    // ==================================================

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

  WHERE p.id = $1
`,
      [
    isAdmin,
    picId
      ]
    );


    // ==================================================
    // 2. PIC SELURUH PROYEK
    // ==================================================

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


    // ==================================================
    // 3. NILAI TERMIN KLIEN
    // ==================================================
    //
    // Nilai termin =
    // nilai final klien × persentase / 100
    //
    // TERTAGIH:
    // hanya status "Dibayar"
    //
    // BELUM TERTAGIH:
    // selain status "Dibayar"
    //
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


    // ==================================================
    // 4. NILAI TERMIN PARTNER
    // ==================================================

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


    // ==================================================
    // 5. KONTRAK KLIEN JATUH TEMPO
    //    HARI INI S/D 3 BULAN KE DEPAN
    // ==================================================

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


    // ==================================================
    // 6. KONTRAK PARTNER JATUH TEMPO
    //    HARI INI S/D 3 BULAN KE DEPAN
    // ==================================================

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


    // ==================================================
    // 7. SUSUN PIC BERDASARKAN PROYEK
    // ==================================================

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


    // ==================================================
    // 8. MAP TERMIN KLIEN
    // ==================================================

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


    // ==================================================
    // 9. MAP TERMIN PARTNER
    // ==================================================

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


    // ==================================================
    // 10. GABUNGKAN DATA PROYEK
    // ==================================================

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


    // ==================================================
    // 11. RESPONSE
    // ==================================================

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
// API FORM PROYEK
// ======================================================


// ------------------------------------------------------
// GET KATEGORI PRODUK AKTIF
// ------------------------------------------------------

app.get("/api/proyek/kategori", 
  async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        id,
        nama_kategori_produk,
        total_nilai,
        status
      FROM public.kategori_produk
      WHERE status = 'Aktif'
      ORDER BY nama_kategori_produk ASC
    `);

    res.json(result.rows);

  } catch (error) {

    console.error(
      "ERROR GET KATEGORI PROYEK:",
      error
    );

    res.status(500).json({
      error: error.message
    });

  }

});


// ------------------------------------------------------
// GET PIC BERDASARKAN KATEGORI
// ------------------------------------------------------

app.get("/api/proyek/kategori/:id/pic",
  async (req, res) => {

    try {

      const { id } = req.params;

      const result = await pool.query(`
        SELECT
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

        WHERE kpp.kategori_produk_id = $1

        ORDER BY p.nama ASC
      `, [id]);

      res.json(result.rows);

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


// ------------------------------------------------------
// GET MASTER KLIEN
// ------------------------------------------------------

app.get("/api/proyek/klien",
  async (req, res) => {

    try {

      const result = await pool.query(`
        SELECT
          id,
          perusahaan_klien,
          inisial,
          nama_pic
        FROM public.data
        ORDER BY perusahaan_klien ASC
      `);

      res.json(result.rows);

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


// ------------------------------------------------------
// GET MASTER PARTNER
// ------------------------------------------------------

app.get("/api/proyek/partner",
  async (req, res) => {

    try {

      const result = await pool.query(`
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

      res.json(result.rows);

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

app.get("/api/proyek", 
  async (req, res) => {

  if (!req.session || !req.session.user) {
    return res.status(401).json({
      error: "Belum login"
    });
  }

  const user = req.session.user;

  const isAdmin =
    String(user.role || "")
      .toLowerCase() === "admin";

  const picId = user.id;

  try {

    const result = await pool.query(
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

        pk.nilai_submit,
        pk.nilai_nego_1,
        pk.nilai_nego_2,
        pk.nilai_nego_3,

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

        (
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
          )
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

    res.json(result.rows);

  } catch (error) {

    console.error(
      "ERROR READ PROYEK:",
      error
    );

    res.status(500).json({
      error: error.message
    });

  }

});

// ======================================================
// MASTER DATA UNTUK FORM PROYEK
// ======================================================

// KATEGORI AKTIF
app.get("/api/proyek/kategori", 
  async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, nama_kategori_produk, total_nilai, status
      FROM public.kategori_produk
      WHERE status = 'Aktif'
      ORDER BY nama_kategori_produk ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET KATEGORI:", error);
    res.status(500).json({ error: error.message });
  }
});


// PIC BERDASARKAN KATEGORI
app.get("/api/proyek/kategori/:id/pic", 
  async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
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
      WHERE kpp.kategori_produk_id = $1
      ORDER BY p.nama ASC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET PIC KATEGORI:", error);
    res.status(500).json({ error: error.message });
  }
});


// MASTER KLIEN
app.get("/api/proyek/klien", 
  async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, perusahaan_klien, inisial, nama_pic
      FROM public.data
      ORDER BY perusahaan_klien ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET KLIEN:", error);
    res.status(500).json({ error: error.message });
  }
});


// MASTER PARTNER
app.get("/api/proyek/partner", 
  async (req, res) => {
  try {
    const result = await pool.query(`
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

    res.json(result.rows);
  } catch (error) {
    console.error("ERROR GET PARTNER:", error);
    res.status(500).json({ error: error.message });
  }
});


// ======================================================
// CREATE PROYEK
// ======================================================

app.post("/api/proyek", 
  async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      kategori_produk_ids,
      jenis_proyek,
      sub_jenis_proyek,
      nama_proyek,
      deskripsi,
      status_final,
      pic_ids,

      klien_id,
      nilai_submit_klien,
      nilai_nego_1_klien,
      nilai_nego_2_klien,
      nilai_nego_3_klien,
      tanggal_mulai_klien,
      tanggal_akhir_klien,
      status_pengadaan_klien,
      status_teknis_klien,

      partners
    } = req.body;

    if (
  !Array.isArray(kategori_produk_ids) ||
  kategori_produk_ids.length === 0
    ) {
      return res.status(400).json({
        error: "Minimal satu kategori wajib dipilih"
      });
    }

    if (!jenis_proyek) {
      return res.status(400).json({
        error: "Jenis proyek wajib dipilih"
      });
    }

    if (!nama_proyek || !nama_proyek.trim()) {
      return res.status(400).json({
        error: "Nama proyek wajib diisi"
      });
    }

    await client.query("BEGIN");

    // PROYEK UTAMA
    const kategoriUtamaId =
      Number(kategori_produk_ids[0]);
    const proyekResult = await client.query(`
      INSERT INTO public.proyek (
        kategoriUtamaId,,
        jenis_proyek,
        sub_jenis_proyek,
        nama_proyek,
        deskripsi,
        status_final
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [
      kategori_produk_id,
      jenis_proyek,
      sub_jenis_proyek || null,
      nama_proyek.trim(),
      deskripsi || null,
      status_final || "Aktif"
    ]);

    const proyek = proyekResult.rows[0];

    for (
  const kategoriId
  of kategori_produk_ids
) {

  const idKategori =
    Number(kategoriId);

  if (
    !Number.isInteger(idKategori)
  ) {
    continue;
  }

  await client.query(
    `
    INSERT INTO public.proyek_kategori (
      proyek_id,
      kategori_produk_id
    )
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    `,
    [
      proyek.id,
      idKategori
    ]
  );

}


    // PIC PROYEK
    if (Array.isArray(pic_ids)) {
      for (const picId of pic_ids) {
        await client.query(`
          INSERT INTO public.proyek_pic (
            proyek_id,
            pic_id
          )
          VALUES ($1,$2)
          ON CONFLICT DO NOTHING
        `, [
          proyek.id,
          picId
        ]);
      }
    }


    // KLIEN
    if (klien_id) {
      await client.query(`
        INSERT INTO public.proyek_klien (
          proyek_id,
          klien_id,
          nilai_submit,
          nilai_nego_1,
          nilai_nego_2,
          nilai_nego_3,
          tanggal_mulai,
          tanggal_akhir,
          status_pengadaan,
          status_teknis
        )
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10
        )
      `, [
        proyek.id,
        klien_id,
        nilai_submit_klien || 0,
        nilai_nego_1_klien || null,
        nilai_nego_2_klien || null,
        nilai_nego_3_klien || null,
        tanggal_mulai_klien || null,
        tanggal_akhir_klien || null,
        status_pengadaan_klien || null,
        status_teknis_klien || null
      ]);
    }


    // ======================================================
    // MULTI PARTNER
    // ======================================================

    console.log("JUMLAH PARTNER:", partners?.length || 0);
    console.log("DATA PARTNER:", partners);

    if (Array.isArray(partners) && partners.length > 0) {

      for (const item of partners) {

        console.log("SIMPAN PARTNER:", item);

        if (!item.partner_id) {
          console.log("SKIP PARTNER - partner_id kosong");
          continue;
        }

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
            status_pengadaan,
            status_teknis
          )
          VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10
          )
          `,
          [
            proyek.id,
            Number(item.partner_id),

            item.nilai_submit !== null &&
            item.nilai_submit !== undefined
              ? Number(item.nilai_submit)
              : 0,

            item.nilai_nego_1 !== null &&
            item.nilai_nego_1 !== undefined
              ? Number(item.nilai_nego_1)
              : null,

            item.nilai_nego_2 !== null &&
            item.nilai_nego_2 !== undefined
              ? Number(item.nilai_nego_2)
              : null,

            item.nilai_nego_3 !== null &&
            item.nilai_nego_3 !== undefined
              ? Number(item.nilai_nego_3)
              : null,

            item.tanggal_mulai || null,
            item.tanggal_akhir || null,
            item.status_pengadaan || null,
            item.status_teknis || null
          ]
        );

      }

    }


    // ======================================================
    // COMMIT
    // ======================================================

    await client.query("COMMIT");

    console.log("PROYEK BERHASIL DISIMPAN:", proyek.id);

    res.status(201).json({
      message: "Proyek berhasil ditambahkan",
      id: proyek.id,
      proyek: proyek
    });


  } catch (error) {

    await client.query("ROLLBACK");

    console.error(
      "ERROR CREATE PROYEK:",
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
// DAFTAR PROYEK
// ======================================================

app.get("/api/proyek", 
  async (req, res) => {
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

        kp.nama_kategori_produk,

        d.perusahaan_klien,

        COALESCE(
          pk.nilai_nego_3,
          pk.nilai_nego_2,
          pk.nilai_nego_1,
          pk.nilai_submit,
          0
        ) AS nilai_final_klien

      FROM public.proyek p

      LEFT JOIN public.kategori_produk kp
        ON kp.id = p.kategori_produk_id

      LEFT JOIN public.proyek_klien pk
        ON pk.proyek_id = p.id

      LEFT JOIN public.data d
        ON d.id = pk.klien_id

      ORDER BY p.id DESC
    `);

    res.json(result.rows);

  } catch (error) {
    console.error("ERROR READ PROYEK:", error);

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


    // CREATE TERMIN KLIEN
    // ======================================================
    // DETAIL PROYEK
    // ======================================================

    app.get(
      "/api/proyek/:id/detail",
      async (req, res) => {

        console.log(
          "DETAIL PROYEK DIPANGGIL:",
          req.params.id
        );

        try {

          const id =
            req.params.id;

          // query-query detail proyek...

          const proyek =
            proyekResult.rows[0];

          // query PIC
          // query klien
          // query partner
          // dst.

          res.json({
            proyek,
            // data lainnya
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

      }
    );


    // ======================================================
    // TERMIN PEMBAYARAN KLIEN
    // ======================================================

    // ======================================================
    // CREATE TERMIN KLIEN
    // ======================================================

    app.post(
      "/api/proyek/klien/:proyekKlienId/termin",
      async (req, res) => {
        try {

          const proyekKlienId =
            Number(req.params.proyekKlienId);

          const {
            nama_termin,
            persentase,
            nominal,
            status_pembayaran,
            tanggal_jatuh_tempo,
            tanggal_bayar
          } = req.body;


          if (!proyekKlienId) {
            return res.status(400).json({
              error: "ID proyek klien tidak valid"
            });
          }


          if (
            !nama_termin ||
            !nama_termin.trim()
          ) {
            return res.status(400).json({
              error: "Nama termin wajib diisi"
            });
          }


          // ==========================================
          // 1. CEK NILAI PROYEK
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

          const terminPertamaResult =
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
            terminPertamaResult.rows[0] ||
            null;


          // ==========================================
          // 3. TENTUKAN MODE
          // ==========================================

          let mode;


          if (terminPertama) {

            if (
              terminPertama.persentase !== null
            ) {
              mode = "persentase";
            } else {
              mode = "nominal";
            }

          } else {

            if (nilaiProyek > 0) {
              mode = "persentase";
            } else {
              mode = "nominal";
            }

          }


          console.log(
            "MODE TERMIN KLIEN:",
            {
              proyekKlienId,
              nilaiProyek,
              terminPertama,
              mode
            }
          );


          let persenValue = null;
          let nominalValue = null;


          // ==========================================
          // 4. MODE PERSENTASE
          // ==========================================

          if (mode === "persentase") {

            persenValue =
              Number(persentase);


            if (
              !Number.isFinite(
                persenValue
              ) ||
              persenValue <= 0 ||
              persenValue > 100
            ) {
              return res.status(400).json({
                error:
                  "Termin proyek ini harus menggunakan persentase"
              });
            }


            const totalResult =
              await pool.query(`
                SELECT
                  COALESCE(
                    SUM(persentase),
                    0
                  ) AS total

                FROM public.proyek_klien_termin

                WHERE proyek_klien_id = $1
              `, [proyekKlienId]);


            const totalSekarang =
              Number(
                totalResult.rows[0]
                  .total || 0
              );


            if (
              totalSekarang +
              persenValue >
              100
            ) {
              return res.status(400).json({
                error:
                  `Total termin tidak boleh melebihi 100%. ` +
                  `Saat ini sudah ${totalSekarang}%.`
              });
            }

          }


          // ==========================================
          // 5. MODE NOMINAL
          // ==========================================

          else {

            nominalValue =
              Number(nominal);


            if (
              !Number.isFinite(
                nominalValue
              ) ||
              nominalValue <= 0
            ) {
              return res.status(400).json({
                error:
                  "Termin proyek ini harus menggunakan nominal"
              });
            }

          }


          // ==========================================
          // 6. SIMPAN TERMIN
          // ==========================================

          const result =
            await pool.query(`
              INSERT INTO
                public.proyek_klien_termin
              (
                proyek_klien_id,
                nama_termin,
                persentase,
                nominal,
                status_pembayaran,
                tanggal_jatuh_tempo,
                tanggal_bayar
              )

              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
              )

              RETURNING *
            `, [
              proyekKlienId,
              nama_termin.trim(),
              persenValue,
              nominalValue,
              status_pembayaran ||
                "Belum Dibayar",
              tanggal_jatuh_tempo ||
                null,
              tanggal_bayar ||
                null
            ]);


          return res.status(201).json({
            ...result.rows[0],
            mode_termin: mode
          });


        } catch (error) {

          console.error(
            "ERROR CREATE TERMIN KLIEN:",
            error
          );

          return res.status(500).json({
            error: error.message
          });

        }
      }
    );

    // ======================================================
    // UPDATE TERMIN KLIEN
    // ======================================================

    app.put("/api/proyek/klien/termin/:id",
      async (req, res) => {
        try {

          const terminId =
            Number(req.params.id);

          const {
            nama_termin,
            persentase,
            nominal,
            status_pembayaran,
            tanggal_jatuh_tempo,
            tanggal_bayar
          } = req.body;


          if (!terminId) {
            return res.status(400).json({
              error: "ID termin tidak valid"
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


          // ==========================================
          // 1. CARI TERMIN YANG AKAN DIEDIT
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
          // 2. CARI TERMIN PERTAMA
          // ==========================================

          const terminPertamaResult =
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
            terminPertamaResult.rows[0];


          // ==========================================
          // 3. TENTUKAN MODE DARI TERMIN PERTAMA
          // ==========================================

          let mode;


          if (
            terminPertama.persentase !== null
          ) {

            mode = "persentase";

          } else {

            mode = "nominal";

          }


          console.log(
            "UPDATE TERMIN KLIEN:",
            {
              terminId,
              proyekKlienId,
              terminPertama:
                terminPertama.id,
              mode
            }
          );


          let persenValue = null;
          let nominalValue = null;


          // ==========================================
          // 4. MODE PERSENTASE
          // ==========================================

          if (
            mode === "persentase"
          ) {

            persenValue =
              Number(persentase);


            if (
              !Number.isFinite(
                persenValue
              ) ||
              persenValue <= 0 ||
              persenValue > 100
            ) {

              return res.status(400).json({
                error:
                  "Termin proyek ini menggunakan persentase"
              });

            }


            // Hitung termin lainnya
            const totalResult =
              await pool.query(`
                SELECT
                  COALESCE(
                    SUM(persentase),
                    0
                  ) AS total

                FROM public.proyek_klien_termin

                WHERE proyek_klien_id = $1
                  AND id <> $2
              `, [
                proyekKlienId,
                terminId
              ]);


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

              return res.status(400).json({
                error:
                  `Total termin tidak boleh melebihi 100%. ` +
                  `Termin lainnya sudah ${totalLain}%.`
              });

            }

          }


          // ==========================================
          // 5. MODE NOMINAL
          // ==========================================

          else {

            nominalValue =
              Number(nominal);


            if (
              !Number.isFinite(
                nominalValue
              ) ||
              nominalValue <= 0
            ) {

              return res.status(400).json({
                error:
                  "Termin proyek ini menggunakan nominal"
              });

            }

          }


          // ==========================================
          // 6. UPDATE TERMIN
          // ==========================================

          const result =
            await pool.query(`
              UPDATE
                public.proyek_klien_termin

              SET
                nama_termin = $1,
                persentase = $2,
                nominal = $3,
                status_pembayaran = $4,
                tanggal_jatuh_tempo = $5,
                tanggal_bayar = $6,
                updated_at =
                  CURRENT_TIMESTAMP

              WHERE id = $7

              RETURNING *
            `, [
              nama_termin.trim(),
              persenValue,
              nominalValue,
              status_pembayaran ||
                "Belum Dibayar",
              tanggal_jatuh_tempo ||
                null,
              tanggal_bayar ||
                null,
              terminId
            ]);


          return res.json({
            ...result.rows[0],
            mode_termin: mode
          });


        } catch (error) {

          console.error(
            "ERROR UPDATE TERMIN KLIEN:",
            error
          );

          return res.status(500).json({
            error: error.message
          });

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

    
    const klienResult = await pool.query(`
      SELECT
        pk.id AS proyek_klien_id,

        d.id AS klien_id,
        d.perusahaan_klien,
        d.inisial,

        pk.nilai_submit,
        pk.nilai_nego_1,
        pk.nilai_nego_2,
        pk.nilai_nego_3,

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

        pk.tanggal_mulai,
        pk.tanggal_akhir,
        pk.status_pengadaan,
        pk.status_teknis

      FROM public.proyek_klien pk

      JOIN public.data d
        ON d.id = pk.klien_id

      WHERE pk.proyek_id = $1

      LIMIT 1
    `, [id]);

    const klien =
      klienResult.rows.length > 0
        ? klienResult.rows[0]
        : null;


    // ------------------------------------------
    // 4. TERMIN KLIEN
    // ------------------------------------------

    let terminKlien = [];

    if (klien) {
      const terminResult = await pool.query(`
        SELECT
          id,
          nama_termin,
          persentase,
          nominal,
          status_pembayaran,
          tanggal_jatuh_tempo,
          tanggal_bayar
        FROM public.proyek_klien_termin
        WHERE proyek_klien_id = $1
        ORDER BY id ASC
      `, [klien.proyek_klien_id]);

      terminKlien = terminResult.rows;
    }


  // ======================================================
  // DOKUMEN KLIEN
  // ======================================================


  // CREATE DOKUMEN
    app.post("/api/proyek/klien/:proyekKlienId/dokumen",
      async (req, res) => {

        try {

          const { proyekKlienId } = req.params;
          const { nama_dokumen,nomor_dokumen } = req.body;


          if (!nama_dokumen || !nama_dokumen.trim()) {

            return res.status(400).json({
              error: "Nama dokumen wajib diisi"
            });

          }


          res.status(201).json(
            result.rows[0]
          );


        } catch (error) {

          console.error(
            "ERROR CREATE DOKUMEN KLIEN:",
            error
          );

          res.status(500).json({
            error: error.message
          });

        }

      }
    );


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

    let dokumenKlien = [];

    if (klien) {
      const dokumenResult = await pool.query(`
        SELECT
          id,
          nama_dokumen,
          is_checked,
          checked_at
        FROM public.proyek_klien_dokumen
        WHERE proyek_klien_id = $1
        ORDER BY id ASC
      `, [klien.proyek_klien_id]);

      dokumenKlien = dokumenResult.rows;
    }


    // ------------------------------------------
    // 6. PARTNER
    // ------------------------------------------

    const partnerResult = await pool.query(`
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
      pp.nilai_nego_3,
      pp.nilai_nego_2,
      pp.nilai_nego_1,
      pp.nilai_submit,
      0
    ) AS nilai_final,

    pp.tanggal_mulai,
    pp.tanggal_akhir,
    pp.status_pengadaan,
    pp.status_teknis

  FROM public.proyek_partner pp

  JOIN public.partner pr
    ON pr.id = pp.partner_id

  WHERE pp.proyek_id = $1

  ORDER BY pp.id ASC
`, [id]);


    const partners = [];

    for (const partner of partnerResult.rows) {

      const terminResult = await pool.query(`
        SELECT
          id,
          nama_termin,
          persentase,
          nominal,
          status_pembayaran,
          tanggal_jatuh_tempo,
          tanggal_bayar
        FROM public.proyek_partner_termin
        WHERE proyek_partner_id = $1
        ORDER BY id ASC
      `, [partner.proyek_partner_id]);


      const dokumenResult = await pool.query(`
        SELECT
          id,
          nama_dokumen,
          is_checked,
          checked_at
        FROM public.proyek_partner_dokumen
        WHERE proyek_partner_id = $1
        ORDER BY id ASC
      `, [partner.proyek_partner_id]);


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
// CREATE TERMIN KLIEN
// ======================================================

app.post(
  "/api/proyek/klien/:proyekKlienId/termin",
  async (req, res) => {
    try {

      const proyekKlienId =
        Number(req.params.proyekKlienId);

      const {
        nama_termin,
        persentase,
        nominal,
        status_pembayaran,
        tanggal_jatuh_tempo,
        tanggal_bayar
      } = req.body;


      if (!proyekKlienId) {

        return res.status(400).json({
          error: "ID proyek klien tidak valid"
        });

      }


      if (
        !nama_termin ||
        !nama_termin.trim()
      ) {

        return res.status(400).json({
          error: "Nama termin wajib diisi"
        });

      }


      // ==================================================
      // AMBIL NILAI PROYEK KLIEN
      // ==================================================

      const proyekResult =
        await pool.query(
          `
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
          `,
          [proyekKlienId]
        );


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
          proyekResult
            .rows[0]
            .nilai_proyek || 0
        );


      // ==================================================
      // AMBIL TERMIN PERTAMA
      // ==================================================

      const terminResult =
        await pool.query(
          `
          SELECT
            id,
            persentase,
            nominal

          FROM public.proyek_klien_termin

          WHERE proyek_klien_id = $1

          ORDER BY id ASC

          LIMIT 1
          `,
          [proyekKlienId]
        );


      const terminPertama =
        terminResult.rows[0] || null;


      // ==================================================
      // TENTUKAN MODE TERMIN
      // ==================================================

      let mode;


      // Kalau sudah ada termin,
      // ikuti mode termin pertama
      if (terminPertama) {

        mode =
          terminPertama.persentase !== null
            ? "persentase"
            : "nominal";

      } else {

        // Termin pertama:
        // ada nilai proyek = persentase
        // tidak ada nilai proyek = nominal

        mode =
          nilaiProyek > 0
            ? "persentase"
            : "nominal";

      }


      console.log(
        "=== CREATE TERMIN KLIEN ==="
      );

      console.log(
        "proyekKlienId:",
        proyekKlienId
      );

      console.log(
        "nilaiProyek:",
        nilaiProyek
      );

      console.log(
        "terminPertama:",
        terminPertama
      );

      console.log(
        "mode:",
        mode
      );

      console.log(
        "body:",
        req.body
      );


      // ==================================================
      // VALIDASI SESUAI MODE
      // ==================================================

      let persenValue = null;
      let nominalValue = null;


      // =========================
      // MODE NOMINAL
      // =========================

      if (mode === "nominal") {

        nominalValue =
          Number(nominal);


        if (
          !Number.isFinite(
            nominalValue
          ) ||
          nominalValue <= 0
        ) {

          return res.status(400).json({
            error:
              "Nominal termin harus lebih dari Rp 0"
          });

        }


        persenValue = null;

      }


      // =========================
      // MODE PERSENTASE
      // =========================

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

          return res.status(400).json({
            error:
              "Persentase harus lebih dari 0 dan maksimal 100%"
          });

        }


        const totalResult =
          await pool.query(
            `
            SELECT
              COALESCE(
                SUM(persentase),
                0
              ) AS total

            FROM public.proyek_klien_termin

            WHERE proyek_klien_id = $1
            `,
            [proyekKlienId]
          );


        const totalSekarang =
          Number(
            totalResult
              .rows[0]
              .total || 0
          );


        if (
          totalSekarang +
          persenValue >
          100
        ) {

          return res.status(400).json({
            error:
              `Total persentase termin tidak boleh lebih dari 100%. ` +
              `Saat ini ${totalSekarang}%.`
          });

        }


        nominalValue = null;

      }


      // ==================================================
      // INSERT TERMIN
      // ==================================================

      const result =
        await pool.query(
          `
          INSERT INTO public.proyek_klien_termin
          (
            proyek_klien_id,
            nama_termin,
            persentase,
            nominal,
            status_pembayaran,
            tanggal_jatuh_tempo,
            tanggal_bayar
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )

          RETURNING *
          `,
          [
            proyekKlienId,

            nama_termin.trim(),

            persenValue,

            nominalValue,

            status_pembayaran ||
              "Belum Dibayar",

            tanggal_jatuh_tempo ||
              null,

            tanggal_bayar ||
              null
          ]
        );


      return res
        .status(201)
        .json(
          result.rows[0]
        );


    } catch (error) {

      console.error(
        "ERROR CREATE TERMIN KLIEN:",
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

// ======================================================
// TAMBAH DOKUMEN KLIEN
// ======================================================

app.post("/api/proyek/klien/:proyekKlienId/dokumen",
  async (req, res) => {

    try {

      const { proyekKlienId } = req.params;

      const {
        nama_dokumen,
        nomor_dokumen
      } = req.body;


      // Validasi nama dokumen
      if (
        !nama_dokumen ||
        !nama_dokumen.trim()
      ) {

        return res.status(400).json({
          error: "Nama dokumen wajib diisi"
        });

      }


      const result =
        await pool.query(
          `
          INSERT INTO public.proyek_klien_dokumen (
            proyek_klien_id,
            nama_dokumen,
            nomor_dokumen,
            is_checked
          )
          VALUES ($1, $2, $3, FALSE)
          RETURNING *
          `,
          [
            proyekKlienId,

            nama_dokumen.trim(),

            nomor_dokumen
              ? nomor_dokumen.trim()
              : null
          ]
        );


      res.status(201).json(
        result.rows[0]
      );


    } catch (error) {

      console.error(
        "ERROR CREATE DOKUMEN:",
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

app.put("/api/proyek/partner/termin/:id",
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
        tanggal_bayar
      } = req.body;


      if (!terminId) {

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
      // CARI TERMIN + JENIS PROYEK
      // ==================================================

      const terminResult =
        await client.query(
          `
          SELECT
            ppt.id,
            ppt.proyek_partner_id,
            pp.proyek_id,
            p.jenis_proyek

          FROM public.proyek_partner_termin ppt

          JOIN public.proyek_partner pp
            ON pp.id =
               ppt.proyek_partner_id

          JOIN public.proyek p
            ON p.id =
               pp.proyek_id

          WHERE ppt.id = $1
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


      // sama dengan frontend
      const nominalMode =
        jenisProyek.includes("sewa") ||
        jenisProyek.includes(
          "transaksi"
        );


      // ==================================================
      // VALIDASI NOMINAL
      // SEWA / TRANSAKSI
      // ==================================================

      if (nominalMode) {

        const nominalNumber =
          Number(nominal || 0);


        if (
          !nominalNumber ||
          nominalNumber <= 0
        ) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Nominal termin harus lebih dari Rp 0"
          });

        }

      }


      // ==================================================
      // VALIDASI PERSENTASE
      // REGULER / SLA
      // ==================================================

      else {

        const persenNumber =
          Number(persentase || 0);


        if (
          !persenNumber ||
          persenNumber <= 0 ||
          persenNumber > 100
        ) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Persentase harus lebih dari 0 dan maksimal 100%"
          });

        }


        // ================================================
        // TOTAL PERSENTASE TERMIN LAIN
        // ================================================

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
              AND id <> $2
            `,
            [
              terminData.proyek_partner_id,
              terminId
            ]
          );


        const totalLain =
          Number(
            totalResult.rows[0].total ||
            0
          );


        if (
          totalLain +
          persenNumber >
          100
        ) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              `Total persentase termin tidak boleh lebih dari 100%. Saat ini ${totalLain}%`
          });

        }

      }


      // ==================================================
      // UPDATE
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

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $7

          RETURNING *
          `,
          [
            nama_termin.trim(),

            nominalMode
              ? null
              : Number(persentase),

            nominalMode
              ? Number(nominal)
              : null,

            status_pembayaran || null,

            tanggal_jatuh_tempo ||
              null,

            tanggal_bayar ||
              null,

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

app.post("/api/proyek/partner/:proyekPartnerId/dokumen", 
  async (req, res) => {
  try {
    const { proyekPartnerId } = req.params;
    const { nama_dokumen,nomor_dokumen } = req.body;

    if (!nama_dokumen || !nama_dokumen.trim()) {
      return res.status(400).json({
        error: "Nama dokumen wajib diisi"
      });
    }

    const partnerCheck = await pool.query(
      `
      SELECT id
      FROM public.proyek_partner
      WHERE id = $1
      `,
      [proyekPartnerId]
    );

    if (partnerCheck.rows.length === 0) {
      return res.status(404).json({
        error: "Data partner proyek tidak ditemukan"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO public.proyek_partner_dokumen (
        proyek_partner_id,
        nama_dokumen,
        nomor_dokumen
        is_checked
      )
      VALUES ($1,$2,$3,FALSE)
      RETURNING *
      `,
      [
        proyekPartnerId,
        nama_dokumen.trim()
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("ERROR TAMBAH DOKUMEN PARTNER:", error);

    res.status(500).json({
      error: error.message
    });
  }
});


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

app.put("/api/proyek/:id/klien", 
  async (req, res) => {

  try {

    const { id } = req.params;


    const {
      klien_id,

      nilai_submit,
      nilai_nego_1,
      nilai_nego_2,
      nilai_nego_3,

      tanggal_mulai,
      tanggal_akhir,

      status_pengadaan,
      status_teknis

    } = req.body;


    if (!klien_id) {

      return res.status(400).json({
        error: "Klien wajib dipilih"
      });

    }


    // Cek apakah proyek sudah punya klien
    const existing =
      await pool.query(
        `
        SELECT id
        FROM public.proyek_klien
        WHERE proyek_id = $1
        LIMIT 1
        `,
        [id]
      );


    let result;


    // ==================================================
    // UPDATE KLIEN EXISTING
    // ==================================================

    if (existing.rows.length > 0) {

      result =
        await pool.query(
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
            status_pengadaan = $8,
            status_teknis = $9,
            updated_at = CURRENT_TIMESTAMP

          WHERE id = $10

          RETURNING *
          `,
          [
            Number(klien_id),

            nilai_submit !== null &&
            nilai_submit !== undefined
              ? Number(nilai_submit)
              : 0,

            nilai_nego_1 !== null &&
            nilai_nego_1 !== undefined
              ? Number(nilai_nego_1)
              : null,

            nilai_nego_2 !== null &&
            nilai_nego_2 !== undefined
              ? Number(nilai_nego_2)
              : null,

            nilai_nego_3 !== null &&
            nilai_nego_3 !== undefined
              ? Number(nilai_nego_3)
              : null,

            tanggal_mulai || null,
            tanggal_akhir || null,

            status_pengadaan || null,
            status_teknis || null,

            existing.rows[0].id
          ]
        );

    }


    // ==================================================
    // TAMBAH KLIEN JIKA BELUM ADA
    // ==================================================

    else {

      result =
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
            status_pengadaan,
            status_teknis
          )

          VALUES (
            $1,$2,$3,$4,$5,
            $6,$7,$8,$9,$10
          )

          RETURNING *
          `,
          [
            id,
            Number(klien_id),

            nilai_submit !== null &&
            nilai_submit !== undefined
              ? Number(nilai_submit)
              : 0,

            nilai_nego_1 !== null &&
            nilai_nego_1 !== undefined
              ? Number(nilai_nego_1)
              : null,

            nilai_nego_2 !== null &&
            nilai_nego_2 !== undefined
              ? Number(nilai_nego_2)
              : null,

            nilai_nego_3 !== null &&
            nilai_nego_3 !== undefined
              ? Number(nilai_nego_3)
              : null,

            tanggal_mulai || null,
            tanggal_akhir || null,

            status_pengadaan || null,
            status_teknis || null
          ]
        );

    }


    res.json({
      message:
        "Data klien berhasil diperbarui",

      klien:
        result.rows[0]
    });


  } catch (error) {

    console.error(
      "ERROR UPDATE KLIEN PROYEK:",
      error
    );


    res.status(500).json({
      error: error.message
    });

  }

});



// ======================================================
// UPDATE / TAMBAH / HAPUS PARTNER PROYEK
// ======================================================

app.put("/api/proyek/:id/partners",
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      const proyekId =
        Number(req.params.id);

      const {
        partners
      } = req.body;


      // ==================================================
      // VALIDASI
      // ==================================================

      if (!proyekId) {

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


      await client.query(
        "BEGIN"
      );


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
          [
            proyekId
          ]
        );


      const existingIds =
        existingResult.rows.map(
          item =>
            Number(item.id)
        );


      // ==================================================
      // ID PARTNER YANG MASIH ADA DARI FRONTEND
      // ==================================================

      const incomingIds =
        partners
          .filter(
            item =>
              item.proyek_partner_id
          )
          .map(
            item =>
              Number(
                item.proyek_partner_id
              )
          );


      // ==================================================
      // CARI PARTNER YANG DIHAPUS
      // ==================================================

      const deletedIds =
        existingIds.filter(
          id =>
            !incomingIds.includes(id)
        );


      // ==================================================
      // HAPUS PARTNER YANG SUDAH DIHILANGKAN DARI FORM
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


      // ==================================================
      // LOOP PARTNER DARI FRONTEND
      // ==================================================

      for (const item of partners) {

        const partnerId =
          Number(
            item.partner_id
          );


        if (!partnerId) {

          throw new Error(
            "Partner tidak valid"
          );

        }


        // ==================================================
        // EDIT PARTNER LAMA
        // ==================================================

        if (
          item.proyek_partner_id
        ) {

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
                status_pengadaan = $8,
                status_teknis = $9,
                updated_at =
                  CURRENT_TIMESTAMP

              WHERE id = $10
                AND proyek_id = $11

              RETURNING *
              `,
              [

                partnerId,


                item.nilai_submit !== null &&
                item.nilai_submit !== undefined

                  ? Number(
                      item.nilai_submit
                    )

                  : 0,


                item.nilai_nego_1 !== null &&
                item.nilai_nego_1 !== undefined

                  ? Number(
                      item.nilai_nego_1
                    )

                  : null,


                item.nilai_nego_2 !== null &&
                item.nilai_nego_2 !== undefined

                  ? Number(
                      item.nilai_nego_2
                    )

                  : null,


                item.nilai_nego_3 !== null &&
                item.nilai_nego_3 !== undefined

                  ? Number(
                      item.nilai_nego_3
                    )

                  : null,


                item.tanggal_mulai ||
                  null,


                item.tanggal_akhir ||
                  null,


                item.status_pengadaan ||
                  null,


                item.status_teknis ||
                  null,


                Number(
                  item.proyek_partner_id
                ),


                proyekId

              ]
            );


          if (
            result.rows.length === 0
          ) {

            throw new Error(
              `Partner proyek ${item.proyek_partner_id} tidak ditemukan`
            );

          }

        }


        // ==================================================
        // TAMBAH PARTNER BARU
        // ==================================================

        else {

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
              status_pengadaan,
              status_teknis,
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
              $8,
              $9,
              $10,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )

            RETURNING *
            `,
            [

              proyekId,

              partnerId,


              item.nilai_submit !== null &&
              item.nilai_submit !== undefined

                ? Number(
                    item.nilai_submit
                  )

                : 0,


              item.nilai_nego_1 !== null &&
              item.nilai_nego_1 !== undefined

                ? Number(
                    item.nilai_nego_1
                  )

                : null,


              item.nilai_nego_2 !== null &&
              item.nilai_nego_2 !== undefined

                ? Number(
                    item.nilai_nego_2
                  )

                : null,


              item.nilai_nego_3 !== null &&
              item.nilai_nego_3 !== undefined

                ? Number(
                    item.nilai_nego_3
                  )

                : null,


              item.tanggal_mulai ||
                null,


              item.tanggal_akhir ||
                null,


              item.status_pengadaan ||
                null,


              item.status_teknis ||
                null

            ]
          );

        }

      }


      // ==================================================
      // COMMIT
      // ==================================================

      await client.query(
        "COMMIT"
      );


      return res.json({

        message:
          "Partner proyek berhasil diperbarui",

        ditambah:
          partners.filter(
            item =>
              !item.proyek_partner_id
          ).length,

        diperbarui:
          incomingIds.length,

        dihapus:
          deletedIds.length

      });


    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


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
// START SERVER
// ======================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server berjalan di port ${PORT}`);
});