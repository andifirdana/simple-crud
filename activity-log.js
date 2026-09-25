// =====================================================
// ACTIVITY LOG HELPER
// =====================================================

async function simpanActivityLog(
  client,
  {
    pic_id = null,
    nama_pic = null,
    aktivitas,
    modul,
    entity_id = null,
    entity_nama = null,
    field_name = null,
    nilai_lama = null,
    nilai_baru = null,
    deskripsi
  }
) {

  try {

    await client.query(
      `
        INSERT INTO public.activity_log
        (
          pic_id,
          nama_pic,
          aktivitas,
          modul,
          entity_id,
          entity_nama,
          field_name,
          nilai_lama,
          nilai_baru,
          deskripsi,
          created_at
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
          CURRENT_TIMESTAMP
        )
      `,
      [
        pic_id,
        nama_pic,
        aktivitas,
        modul,
        entity_id,
        entity_nama,
        field_name,
        nilai_lama !== null
          ? String(nilai_lama)
          : null,
        nilai_baru !== null
          ? String(nilai_baru)
          : null,
        deskripsi
      ]
    );

  } catch (error) {

    console.error(
      "ERROR SIMPAN ACTIVITY LOG:",
      error
    );

    throw error;

  }

}


module.exports = {
  simpanActivityLog
};