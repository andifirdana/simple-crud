const express = require("express");
const path = require("path");
const pool = require("./db");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// ======================================================
// MASTER DATA KLIEN
// ======================================================


// =========================
// READ KLIEN
// =========================
app.get("/api/data", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM data ORDER BY id DESC"
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
app.post("/api/data", async (req, res) => {
  try {

    const {
      perusahaan_klien,
      inisial,
      nama_pic,
      no_pic,
      email_pic
    } = req.body;


    if (!perusahaan_klien) {
      return res.status(400).json({
        error: "Perusahaan / Klien wajib diisi"
      });
    }


    const result = await pool.query(
      `INSERT INTO data (
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


    res.status(201).json(
      result.rows[0]
    );


  } catch (error) {

    console.error(
      "ERROR CREATE KLIEN:",
      error
    );


    res.status(500).json({
      error: error.message
    });

  }
});


// =========================
// UPDATE KLIEN
// =========================
app.put("/api/data/:id", async (req, res) => {
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
      `UPDATE data
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


    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Data klien tidak ditemukan"
      });

    }


    res.json(result.rows[0]);


  } catch (error) {

    console.error(
      "ERROR UPDATE KLIEN:",
      error
    );


    res.status(500).json({
      error: error.message
    });

  }
});


// =========================
// DELETE KLIEN
// =========================
app.delete("/api/data/:id", async (req, res) => {
  try {

    const { id } = req.params;


    const result = await pool.query(
      `DELETE FROM data
       WHERE id = $1
       RETURNING *`,
      [id]
    );


    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Data klien tidak ditemukan"
      });

    }


    res.json({
      message: "Data klien berhasil dihapus"
    });


  } catch (error) {

    console.error(
      "ERROR DELETE KLIEN:",
      error
    );


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
app.get("/api/partner", async (req, res) => {
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
app.post("/api/partner", async (req, res) => {
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
app.put("/api/partner/:id", async (req, res) => {
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
app.delete("/api/partner/:id", async (req, res) => {
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `Server berjalan di http://localhost:${PORT}`
  );

});