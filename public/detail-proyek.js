const params =
  new URLSearchParams(window.location.search);

const proyekId =
  params.get("id");


let detailData = null;
let activePartnerTerminId = null;
let activePartnerId = null;
let activePartnerDokumenId = null;



// ======================================================
// FORMAT
// ======================================================

function rupiah(value) {

  const number =
    Number(value || 0);

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(number);

}


function tanggal(value) {

  if (!value) return "-";

  return new Date(value)
    .toLocaleDateString("id-ID");

}


function tanggalInput(value) {

  if (!value) return "";

  return String(value)
    .substring(0, 10);

}

// ======================================================
// EDIT KATEGORI
// ======================================================
async function loadKategoriEdit() {

  const select =
    document.getElementById(
      "editKategoriProyek"
    );

  try {

    const response =
      await fetch(
        "/api/proyek/kategori"
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Gagal mengambil kategori"
      );
    }

    select.innerHTML =
      '<option value="">Pilih Kategori</option>';

    data.forEach(item => {

      const option =
        document.createElement("option");

      option.value =
        item.id;

      option.textContent =
        item.nama_kategori_produk;

      select.appendChild(option);

    });

  } catch (error) {

    console.error(
      "ERROR LOAD KATEGORI EDIT:",
      error
    );

    alert(
      "Gagal mengambil kategori."
    );

  }

}
// ======================================================
// LOAD DETAIL
// ======================================================

async function loadDetail() {

  if (!proyekId) {

    alert("ID proyek tidak ditemukan.");

    window.location.href =
      "/proyek.html";

    return;
  }


  try {

    const response =
      await fetch(
        `/api/proyek/${proyekId}/detail`
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal mengambil detail proyek"
      );

    }


    detailData = result;

    renderDetail();


  } catch (error) {

    console.error(
      "ERROR DETAIL:",
      error
    );

    alert(error.message);

  }

}


// ======================================================
// RENDER
// ======================================================

function renderDetail() {

  const {
    proyek,
    pic,
    klien,
    partners,
    summary
  } = detailData;


  // HEADER

  document.getElementById(
    "judulProyek"
  ).textContent =
    proyek.nama_proyek;


  document.getElementById(
    "kategoriProyek"
  ).textContent =
    proyek.nama_kategori_produk || "-";


  // SUMMARY

  document.getElementById(
    "nilaiKlien"
  ).textContent =
    rupiah(summary.nilai_klien);


  document.getElementById(
    "nilaiPartner"
  ).textContent =
    rupiah(summary.nilai_partner);


  document.getElementById(
    "margin"
  ).textContent =
    rupiah(summary.margin);


  document.getElementById(
    "marginPersen"
  ).textContent =
    `${Number(
      summary.margin_persen || 0
    ).toFixed(2)}%`;


  // PROYEK

  document.getElementById(
  "kategoriInfoProyek"
).textContent =
  detailData.proyek.nama_kategori_produk || "-";

  document.getElementById(
    "jenisProyek"
  ).textContent =
    proyek.jenis_proyek || "-";


  document.getElementById(
    "subJenisProyek"
  ).textContent =
    proyek.sub_jenis_proyek || "-";


  document.getElementById(
    "statusFinal"
  ).textContent =
    proyek.status_final || "-";


  document.getElementById(
    "deskripsi"
  ).textContent =
    proyek.deskripsi || "-";


  // PIC

  renderPIC(pic);


  // KLIEN

  renderKlien(klien);


  // TERMIN

  renderTermin(klien);


  // DOKUMEN

  renderDokumen(klien);


  // PARTNER

  renderPartner(partners);

}


// ======================================================
// PIC
// ======================================================

function renderPIC(pic) {

  const container =
    document.getElementById(
      "picContainer"
    );


  if (!pic || pic.length === 0) {

    container.innerHTML =
      `<div class="empty">
        Belum ada PIC.
      </div>`;

    return;
  }


  container.innerHTML =
    pic.map(item => `
      <div style="
        margin-bottom:8px;
        padding:10px;
        background:#f9fafb;
        border-radius:8px;
      ">
        <strong>
          ${item.nama}
        </strong>

        ${item.inisial
          ? `(${item.inisial})`
          : ""
        }

        <div class="label">
          ${item.jabatan || "-"}
        </div>
      </div>
    `).join("");

}


// ======================================================
// KLIEN
// ======================================================

function renderKlien(klien) {

  const container =
    document.getElementById(
      "klienInfo"
    );


  if (!klien) {

    container.innerHTML =
      `<div class="empty">
        Belum ada klien.
      </div>`;

    return;
  }


  container.innerHTML = `

    <div class="grid">

      <div class="info">
        <div class="label">
          Perusahaan
        </div>

        <div class="value">
          ${klien.perusahaan_klien}
        </div>
      </div>


      <div class="info">
        <div class="label">
          Tanggal Mulai
        </div>

        <div class="value">
          ${tanggal(klien.tanggal_mulai)}
        </div>
      </div>


      <div class="info">
        <div class="label">
          Tanggal Akhir
        </div>

        <div class="value">
          ${tanggal(klien.tanggal_akhir)}
        </div>
      </div>


      <div class="info">
        <div class="label">
          Nilai Submit
        </div>

        <div class="value">
          ${rupiah(klien.nilai_submit)}
        </div>
      </div>


      <div class="info">
        <div class="label">
          Nilai Final
        </div>

        <div class="value">
          ${rupiah(klien.nilai_final)}
        </div>
      </div>


      <div class="info">
        <div class="label">
          Status Pengadaan
        </div>

        <div class="value">
          ${klien.status_pengadaan || "-"}
        </div>
      </div>


      <div class="info">
        <div class="label">
          Status Teknis
        </div>

        <div class="value">
          ${klien.status_teknis || "-"}
        </div>
      </div>

    </div>
  `;

}


// ======================================================
// TERMIN
// ======================================================

function renderTermin(klien) {

  const tbody =
    document.getElementById(
      "terminTable"
    );


  if (
    !klien ||
    !klien.termin ||
    klien.termin.length === 0
  ) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          Belum ada termin pembayaran.
        </td>
      </tr>
    `;


    document.getElementById(
      "totalTermin"
    ).textContent = "0%";


    document.getElementById(
      "terminProgress"
    ).style.width = "0%";


    return;
  }


  const nilaiFinal =
    Number(klien.nilai_final || 0);


  let totalPersen = 0;


  tbody.innerHTML =
    klien.termin.map(item => {

      const persen =
        Number(item.persentase || 0);

      totalPersen += persen;


      const nominal =
        nilaiFinal *
        persen /
        100;


      return `

        <tr>

          <td>
            ${item.nama_termin}
          </td>

          <td>
            ${persen.toFixed(2)}%
          </td>

          <td>
            ${rupiah(nominal)}
          </td>

          <td>
            ${item.status_pembayaran}
          </td>

          <td>
            ${tanggal(
              item.tanggal_jatuh_tempo
            )}
          </td>

          <td>
            ${tanggal(
              item.tanggal_bayar
            )}
          </td>

          <td>

            <button
              class="btn-secondary"
              onclick="editTermin(${item.id})">
              Edit
            </button>

            <button
              class="btn-danger"
              onclick="hapusTermin(${item.id})">
              Hapus
            </button>

          </td>

        </tr>

      `;

    }).join("");


  document.getElementById(
    "totalTermin"
  ).textContent =
    `${totalPersen.toFixed(2)}%`;


  document.getElementById(
    "terminProgress"
  ).style.width =
    `${Math.min(
      totalPersen,
      100
    )}%`;

}




// ======================================================
// MODAL TERMIN
// ======================================================

const terminModal =
  document.getElementById(
    "terminModal"
  );


document.getElementById(
  "tambahTerminButton"
).addEventListener(
  "click",
  () => {

    if (!detailData.klien) {

      alert(
        "Proyek belum memiliki klien."
      );

      return;
    }


    // PENTING:
    // reset mode partner karena ini Termin KLIEN
    activePartnerId = null;
    activePartnerTerminId = null;


    document.getElementById(
      "terminForm"
    ).reset();


    document.getElementById(
      "terminId"
    ).value = "";


    document.getElementById(
      "terminModalTitle"
    ).textContent =
      "Tambah Termin Klien";


    terminModal.classList.add(
      "show"
    );

  }
);


document.getElementById(
  "batalTermin"
).addEventListener(
  "click",
  () => {

    terminModal.classList.remove(
      "show"
    );

    // reset mode partner
    activePartnerId = null;
    activePartnerTerminId = null;

  }
);


// ======================================================
// SAVE TERMIN
// ======================================================

document.getElementById(
  "terminForm"
).addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const terminId =
      document.getElementById(
        "terminId"
      ).value;


    const payload = {

      nama_termin:
        document.getElementById(
          "namaTermin"
        ).value.trim(),

      persentase:
        Number(
          document.getElementById(
            "persentaseTermin"
          ).value
        ),

      status_pembayaran:
        document.getElementById(
          "statusPembayaran"
        ).value,

      tanggal_jatuh_tempo:
        document.getElementById(
          "tanggalJatuhTempo"
        ).value || null,

      tanggal_bayar:
        document.getElementById(
          "tanggalBayar"
        ).value || null

    };


    if (!payload.nama_termin) {

      alert("Nama termin wajib diisi.");

      return;
    }


    if (
      !payload.persentase ||
      payload.persentase <= 0 ||
      payload.persentase > 100
    ) {

      alert(
        "Persentase harus lebih dari 0 dan maksimal 100%."
      );

      return;
    }


    let url;
    let method;


    // ==========================================
    // TERMIN PARTNER
    // ==========================================

    if (activePartnerId) {

      if (activePartnerTerminId) {

        url =
          `/api/proyek/partner/termin/${activePartnerTerminId}`;

        method = "PUT";

      } else {

        url =
          `/api/proyek/partner/${activePartnerId}/termin`;

        method = "POST";

      }


    // ==========================================
    // TERMIN KLIEN - EDIT
    // ==========================================

    } else if (terminId) {

      url =
        `/api/proyek/klien/termin/${terminId}`;

      method = "PUT";


    // ==========================================
    // TERMIN KLIEN - TAMBAH
    // ==========================================

    } else {

      if (
        !detailData.klien ||
        !detailData.klien.proyek_klien_id
      ) {

        alert(
          "Data proyek klien tidak ditemukan."
        );

        return;
      }


      url =
        `/api/proyek/klien/${detailData.klien.proyek_klien_id}/termin`;

      method = "POST";

    }


    try {

      console.log(
        "SIMPAN TERMIN:",
        {
          url,
          method,
          payload,
          activePartnerId,
          activePartnerTerminId
        }
      );


      const response =
        await fetch(
          url,
          {
            method,

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(payload)
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Gagal menyimpan termin"
        );

      }


      terminModal.classList.remove(
        "show"
      );


      // reset mode partner
      activePartnerId = null;
      activePartnerTerminId = null;


      await loadDetail();


    } catch (error) {

      console.error(
        "ERROR SIMPAN TERMIN:",
        error
      );

      alert(error.message);

    }

  }
);


// ======================================================
// HAPUS TERMIN PARTNER
// ======================================================

async function hapusTerminPartner(id) {

  const konfirmasi =
    confirm(
      "Hapus termin partner ini?"
    );


  if (!konfirmasi) return;


  try {

    const response =
      await fetch(
        `/api/proyek/partner/termin/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menghapus termin partner"
      );

    }


    await loadDetail();


  } catch (error) {

    console.error(
      "ERROR HAPUS TERMIN PARTNER:",
      error
    );

    alert(error.message);

  }

}


// ======================================================
// DOKUMEN PARTNER
// ======================================================

function renderDokumenPartner(dokumen) {

  if (
    !dokumen ||
    dokumen.length === 0
  ) {

    return `
      <div class="empty">
        Belum ada dokumen partner.
      </div>
    `;

  }


  return dokumen.map(item => {

    const checked =
      item.is_checked === true;


    return `

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:12px 0;
        border-bottom:1px solid #e5e7eb;
      ">

        <div style="
          display:flex;
          align-items:center;
          gap:10px;
        ">

          <input
            type="checkbox"

            ${checked
              ? "checked"
              : ""
            }

            onchange="
              toggleDokumenPartner(
                ${item.id},
                this.checked
              )
            "

            style="
              width:auto;
              transform:scale(1.2);
            "
          >


          <div>

            <strong>
              ${item.nama_dokumen}
            </strong>

            <div class="label">

              ${
                checked
                  ? "Selesai • " +
                    formatTanggalWaktu(
                      item.checked_at
                    )
                  : "Belum selesai"
              }

            </div>

          </div>

        </div>


        <button
          class="btn-danger"
          onclick="
            hapusDokumenPartner(${item.id})
          ">
          Hapus
        </button>

      </div>

    `;

  }).join("");

}


async function tambahDokumenPartner(
  proyekPartnerId
) {

  const nama =
    prompt(
      "Nama dokumen partner:"
    );


  if (
    !nama ||
    !nama.trim()
  ) {

    return;

  }


  try {

    const response =
      await fetch(
        `/api/proyek/partner/${proyekPartnerId}/dokumen`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              nama_dokumen:
                nama.trim()
            })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menambahkan dokumen partner"
      );

    }


    await loadDetail();


  } catch (error) {

    console.error(
      "ERROR TAMBAH DOKUMEN PARTNER:",
      error
    );

    alert(error.message);

  }

}


async function toggleDokumenPartner(
  id,
  checked
) {

  try {

    const response =
      await fetch(
        `/api/proyek/partner/dokumen/${id}/check`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              is_checked: checked
            })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal memperbarui dokumen partner"
      );

    }


    await loadDetail();


  } catch (error) {

    console.error(
      "ERROR CHECK DOKUMEN PARTNER:",
      error
    );

    alert(error.message);

    await loadDetail();

  }

}


async function hapusDokumenPartner(id) {

  const konfirmasi =
    confirm(
      "Hapus dokumen partner ini?"
    );


  if (!konfirmasi) return;


  try {

    const response =
      await fetch(
        `/api/proyek/partner/dokumen/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menghapus dokumen partner"
      );

    }


    await loadDetail();


  } catch (error) {

    console.error(
      "ERROR HAPUS DOKUMEN PARTNER:",
      error
    );

    alert(error.message);

  }

}

// ======================================================
// EDIT TERMIN
// ======================================================

function editTermin(id) {

  const termin =
    detailData.klien.termin.find(
      item =>
        Number(item.id) ===
        Number(id)
    );


  if (!termin) return;


  document.getElementById(
    "terminId"
  ).value =
    termin.id;


  document.getElementById(
    "namaTermin"
  ).value =
    termin.nama_termin;


  document.getElementById(
    "persentaseTermin"
  ).value =
    termin.persentase;


  document.getElementById(
    "statusPembayaran"
  ).value =
    termin.status_pembayaran;


  document.getElementById(
    "tanggalJatuhTempo"
  ).value =
    tanggalInput(
      termin.tanggal_jatuh_tempo
    );


  document.getElementById(
    "tanggalBayar"
  ).value =
    tanggalInput(
      termin.tanggal_bayar
    );


  document.getElementById(
    "terminModalTitle"
  ).textContent =
    "Edit Termin";


  terminModal.classList.add(
    "show"
  );

}


// ======================================================
// DELETE TERMIN
// ======================================================

async function hapusTermin(id) {

  const konfirmasi =
    confirm(
      "Hapus termin ini?"
    );


  if (!konfirmasi) return;


  try {

    const response =
      await fetch(
        `/api/proyek/klien/termin/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menghapus termin"
      );

    }


    await loadDetail();


  } catch (error) {

    alert(error.message);

  }

}


// ======================================================
// DOKUMEN
// ======================================================

function renderDokumen(klien) {

  const container =
    document.getElementById(
      "dokumenContainer"
    );


  if (
    !klien ||
    !klien.dokumen ||
    klien.dokumen.length === 0
  ) {

    container.innerHTML = `
      <div class="empty">
        Belum ada dokumen.
      </div>
    `;

    return;
  }


  container.innerHTML =
    klien.dokumen.map(item => {

      const checked =
        item.is_checked === true;


      return `

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          padding:12px 0;
          border-bottom:1px solid #e5e7eb;
        ">

          <div style="
            display:flex;
            align-items:center;
            gap:10px;
          ">

            <input
              type="checkbox"

              ${checked
                ? "checked"
                : ""
              }

              onchange="
                toggleDokumen(
                  ${item.id},
                  this.checked
                )
              "

              style="
                width:auto;
                transform:scale(1.2);
              "
            >


            <div>

              <strong>
                ${item.nama_dokumen}
              </strong>

              <div class="label">
                No. Dokumen:
                ${item.nomor_dokumen || "-"}
              </div>

              <div class="label">

                ${
                  checked
                    ? "Selesai • " +
                      formatTanggalWaktu(
                        item.checked_at
                      )
                    : "Belum selesai"
                }

              </div>

            </div>

          </div>


          <button
            class="btn-danger"
            onclick="
              hapusDokumen(${item.id})
            ">
            Hapus
          </button>

        </div>

      `;

    }).join("");

}


// ======================================================
// DOKUMEN KLIEN
// ======================================================

const dokumenModal =
  document.getElementById(
    "dokumenModal"
  );


// ======================================================
// BUKA MODAL
// ======================================================

document.getElementById(
  "tambahDokumenButton"
).addEventListener(
  "click",
  () => {

    if (!detailData.klien) {

      alert(
        "Proyek belum memiliki klien."
      );

      return;
    }


    document.getElementById(
      "dokumenForm"
    ).reset();


    dokumenModal.classList.add(
      "show"
    );

  }
);


// ======================================================
// TUTUP MODAL
// ======================================================

document.getElementById(
  "batalDokumen"
).addEventListener(
  "click",
  () => {

    dokumenModal.classList.remove(
      "show"
    );

  }
);


// ======================================================
// SIMPAN DOKUMEN
// ======================================================

document.getElementById(
  "dokumenForm"
).addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const namaDokumen =
      document.getElementById(
        "namaDokumen"
      ).value.trim();


    const nomorDokumen =
      document.getElementById(
        "nomorDokumen"
      ).value.trim();


    if (!namaDokumen) {

      alert(
        "Nama dokumen wajib diisi."
      );

      return;
    }


    try {

      const response =
        await fetch(
          `/api/proyek/klien/${detailData.klien.proyek_klien_id}/dokumen`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({

                nama_dokumen:
                  namaDokumen,

                nomor_dokumen:
                  nomorDokumen || null

              })
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Gagal menambahkan dokumen"
        );

      }


      dokumenModal.classList.remove(
        "show"
      );


      await loadDetail();


    } catch (error) {

      console.error(
        "ERROR TAMBAH DOKUMEN:",
        error
      );

      alert(error.message);

    }

  }
);


// ======================================================
// CHECK / UNCHECK
// ======================================================

async function toggleDokumen(
  id,
  checked
) {

  try {

    const response =
      await fetch(
        `/api/proyek/klien/dokumen/${id}/check`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              is_checked:
                checked
            })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal memperbarui dokumen"
      );

    }


    await loadDetail();


  } catch (error) {

    alert(error.message);

    await loadDetail();

  }

}


// ======================================================
// HAPUS DOKUMEN
// ======================================================

async function hapusDokumen(id) {

  const konfirmasi =
    confirm(
      "Hapus dokumen ini?"
    );


  if (!konfirmasi) return;


  try {

    const response =
      await fetch(
        `/api/proyek/klien/dokumen/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menghapus dokumen"
      );

    }


    await loadDetail();


  } catch (error) {

    alert(error.message);

  }

}

// FORMAT WAKTU CHECKLIST
function formatTanggalWaktu(value) {

  if (!value) return "-";


  return new Date(value)
    .toLocaleString(
      "id-ID",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );

}


// ======================================================
// PARTNER
// ======================================================

function renderPartner(partners) {

  const container =
    document.getElementById("partnerContainer");

  if (!partners || partners.length === 0) {

    container.innerHTML = `
      <div class="empty">
        Belum ada partner.
      </div>
    `;

    return;
  }

  container.innerHTML =
    partners.map((item, index) => {

      const termin =
        Array.isArray(item.termin)
          ? item.termin
          : [];

      const dokumen =
        Array.isArray(item.dokumen)
          ? item.dokumen
          : [];

      const nilaiFinal =
        Number(item.nilai_final || 0);

      const totalTermin =
        termin.reduce(
          (total, t) =>
            total + Number(t.persentase || 0),
          0
        );

      return `

        <div style="
          border:1px solid #e5e7eb;
          border-radius:12px;
          margin-bottom:24px;
          overflow:hidden;
          background:white;
        ">

          <div style="
            padding:16px 20px;
            background:#f9fafb;
            border-bottom:1px solid #e5e7eb;
          ">

            <div class="label">
              PARTNER ${index + 1}
            </div>

            <div style="
              font-size:18px;
              font-weight:700;
              margin-top:4px;
            ">
              ${item.nama_partner || "-"}
            </div>

          </div>


          <div style="padding:20px;">

            <div class="grid">

              <div class="info">
                <div class="label">
                  Tanggal Mulai
                </div>
                <div class="value">
                  ${tanggal(item.tanggal_mulai)}
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Tanggal Akhir
                </div>
                <div class="value">
                  ${tanggal(item.tanggal_akhir)}
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Nilai Submit
                </div>
                <div class="value">
                  ${rupiah(item.nilai_submit)}
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Nego 1
                </div>
                <div class="value">
                  ${rupiah(item.nilai_nego_1)}
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Nego 2
                </div>
                <div class="value">
                  ${rupiah(item.nilai_nego_2)}
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Nego 3
                </div>
                <div class="value">
                  ${rupiah(item.nilai_nego_3)}
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Nilai Final
                </div>
                <div class="value">
                  ${rupiah(nilaiFinal)}
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Status Pengadaan
                </div>
                <div class="value">
                  ${item.status_pengadaan || "-"}
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Status Teknis
                </div>
                <div class="value">
                  ${item.status_teknis || "-"}
                </div>
              </div>

            </div>


            <div style="
              margin-top:24px;
              border-top:1px solid #e5e7eb;
              padding-top:20px;
            ">

              <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:12px;
              ">

                <strong>
                  Termin Pembayaran
                </strong>

                <button
                  class="btn-secondary"
                  onclick="tambahTerminPartner(${item.proyek_partner_id})">
                  + Tambah Termin
                </button>

              </div>

              <div style="
                margin-bottom:12px;
                font-size:13px;
              ">
                Total Termin:
                <strong>
                  ${totalTermin.toFixed(2)}%
                </strong>
              </div>

              ${renderTerminPartner(
                termin,
                nilaiFinal
              )}

            </div>


            <div style="
              margin-top:24px;
              border-top:1px solid #e5e7eb;
              padding-top:20px;
            ">

              <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:12px;
              ">

                <strong>
                  Dokumen
                </strong>

                <button
                  class="btn-secondary"
                  onclick="tambahDokumenPartner(${item.proyek_partner_id})">
                  + Tambah Dokumen
                </button>

              </div>

              ${renderDokumenPartner(dokumen)}

            </div>

          </div>

        </div>

      `;

    }).join("");
}

function renderTerminPartner(
  termin,
  nilaiFinal
) {

  if (!termin || termin.length === 0) {

    return `
      <div class="empty">
        Belum ada termin partner.
      </div>
    `;
  }

  return `

    <div style="overflow-x:auto;">

      <table style="width:100%;">

        <thead>
          <tr>
            <th>Termin</th>
            <th>Persentase</th>
            <th>Nominal</th>
            <th>Status</th>
            <th>Jatuh Tempo</th>
            <th>Tanggal Bayar</th>
            <th>Aksi</th>
          </tr>
        </thead>

        <tbody>

          ${termin.map(item => {

            const persen =
              Number(item.persentase || 0);

            const nominal =
              Number(nilaiFinal || 0) *
              persen /
              100;

            return `

              <tr>

                <td>
                  ${item.nama_termin}
                </td>

                <td>
                  ${persen.toFixed(2)}%
                </td>

                <td>
                  ${rupiah(nominal)}
                </td>

                <td>
                  ${item.status_pembayaran || "-"}
                </td>

                <td>
                  ${tanggal(
                    item.tanggal_jatuh_tempo
                  )}
                </td>

                <td>
                  ${tanggal(
                    item.tanggal_bayar
                  )}
                </td>

                <td>

                  <button
                    class="btn-secondary"
                    onclick="editTerminPartner(${item.id})">
                    Edit
                  </button>

                  <button
                    class="btn-danger"
                    onclick="hapusTerminPartner(${item.id})">
                    Hapus
                  </button>

                </td>

              </tr>

            `;

          }).join("")}

        </tbody>

      </table>

    </div>
  `;
}

function tambahTerminPartner(
  proyekPartnerId
) {

  activePartnerId =
    proyekPartnerId;

  activePartnerTerminId =
    null;

  document.getElementById(
    "terminForm"
  ).reset();

  document.getElementById(
    "terminId"
  ).value = "";

  document.getElementById(
    "terminModalTitle"
  ).textContent =
    "Tambah Termin Partner";

  terminModal.classList.add("show");
}


function editTerminPartner(id) {

  let found = null;
  let partnerId = null;

  for (
    const partner of detailData.partners || []
  ) {

    const termin =
      (partner.termin || []).find(
        item =>
          Number(item.id) === Number(id)
      );

    if (termin) {

      found = termin;

      partnerId =
        partner.proyek_partner_id;

      break;
    }
  }

  if (!found) {
    alert("Termin partner tidak ditemukan.");
    return;
  }

  activePartnerTerminId =
    found.id;

  activePartnerId =
    partnerId;

  document.getElementById(
    "terminId"
  ).value = "";

  document.getElementById(
    "namaTermin"
  ).value =
    found.nama_termin || "";

  document.getElementById(
    "persentaseTermin"
  ).value =
    found.persentase || "";

  document.getElementById(
    "statusPembayaran"
  ).value =
    found.status_pembayaran ||
    "Belum Dibayar";

  document.getElementById(
    "tanggalJatuhTempo"
  ).value =
    tanggalInput(
      found.tanggal_jatuh_tempo
    );

  document.getElementById(
    "tanggalBayar"
  ).value =
    tanggalInput(
      found.tanggal_bayar
    );

  document.getElementById(
    "terminModalTitle"
  ).textContent =
    "Edit Termin Partner";

  terminModal.classList.add("show");
}

// ======================================================
// EDIT INFORMASI PROYEK
// ======================================================

document.getElementById(
  "editProyekButton"
).addEventListener(
  "click",
  async () => {

    // NAMA PROYEK
    document.getElementById(
      "editNamaProyek"
    ).value =
      detailData.proyek.nama_proyek || "";


    // KATEGORI
    await loadKategoriEdit();

    document.getElementById(
      "editKategoriProyek"
    ).value =
      detailData.proyek.kategori_produk_id || "";


    // JENIS PROYEK
    document.getElementById(
      "editJenisProyek"
    ).value =
      detailData.proyek.jenis_proyek || "";


    // SUB JENIS
    document.getElementById(
      "editSubJenisProyek"
    ).value =
      detailData.proyek.sub_jenis_proyek || "";


    // STATUS
    document.getElementById(
      "editStatusFinal"
    ).value =
      detailData.proyek.status_final || "Aktif";


    // DESKRIPSI
    document.getElementById(
      "editDeskripsi"
    ).value =
      detailData.proyek.deskripsi || "";


    // BUKA MODAL
    document.getElementById(
      "editProyekModal"
    ).classList.add("show");

  }
);


if (batalEditProyek) {

  batalEditProyek.addEventListener(
    "click",
    () => {

      editProyekModal.classList.remove(
        "show"
      );

    }
  );

}



// ======================================================
// EDIT PIC
// ======================================================

const editPicButton =
  document.getElementById("editPicButton");

const editPicModal =
  document.getElementById("editPicModal");

const editPicContainer =
  document.getElementById(
    "editPicContainer"
  );

const batalEditPic =
  document.getElementById(
    "batalEditPic"
  );


if (editPicButton) {

  editPicButton.addEventListener(
    "click",
    async () => {

      try {

        const response =
          await fetch("/api/pic");

        const allPic =
          await response.json();


        if (!response.ok) {

          throw new Error(
            allPic.error ||
            "Gagal mengambil PIC"
          );

        }


        const selectedIds =
          new Set(
            (detailData.pic || [])
              .map(
                item =>
                  Number(item.id)
              )
          );


        editPicContainer.innerHTML =
          allPic.map(item => {

            const checked =
              selectedIds.has(
                Number(item.id)
              )
                ? "checked"
                : "";


            return `
              <label
                style="
                  display:flex;
                  align-items:center;
                  gap:12px;
                  padding:12px;
                  border:1px solid #e5e7eb;
                  border-radius:10px;
                  margin-bottom:8px;
                  cursor:pointer;
                "
              >

                <input
                  type="checkbox"
                  name="editPic"
                  value="${item.id}"
                  ${checked}
                  style="
                    width:auto;
                    min-height:auto;
                  "
                >

                <div>

                  <strong>
                    ${item.nama || "-"}
                  </strong>

                  <div class="label">
                    ${item.jabatan || "-"}
                  </div>

                </div>

              </label>
            `;

          }).join("");


        editPicModal.classList.add(
          "show"
        );


      } catch (error) {

        console.error(
          "ERROR LOAD PIC:",
          error
        );

        alert(error.message);

      }

    }
  );

}


if (batalEditPic) {

  batalEditPic.addEventListener(
    "click",
    () => {

      editPicModal.classList.remove(
        "show"
      );

    }
  );

}



// ======================================================
// EDIT KLIEN
// ======================================================

const editKlienButton =
  document.getElementById(
    "editKlienButton"
  );

const editKlienModal =
  document.getElementById(
    "editKlienModal"
  );

const editKlienId =
  document.getElementById(
    "editKlienId"
  );

const batalEditKlien =
  document.getElementById(
    "batalEditKlien"
  );


if (editKlienButton) {

  editKlienButton.addEventListener(
    "click",
    async () => {

      try {

        const response =
          await fetch(
            "/api/proyek/klien"
          );

        const masterKlien =
          await response.json();


        if (!response.ok) {

          throw new Error(
            masterKlien.error ||
            "Gagal mengambil klien"
          );

        }


        editKlienId.innerHTML = `
          <option value="">
            Pilih Klien
          </option>

          ${masterKlien.map(item => `
            <option value="${item.id}">
              ${item.perusahaan_klien}
            </option>
          `).join("")}
        `;


        const klien =
          detailData.klien;


        if (klien) {

          editKlienId.value =
            klien.klien_id || "";


          document.getElementById(
            "editNilaiSubmitKlien"
          ).value =
            klien.nilai_submit ?? "";


          document.getElementById(
            "editNilaiNego1Klien"
          ).value =
            klien.nilai_nego_1 ?? "";


          document.getElementById(
            "editNilaiNego2Klien"
          ).value =
            klien.nilai_nego_2 ?? "";


          document.getElementById(
            "editNilaiNego3Klien"
          ).value =
            klien.nilai_nego_3 ?? "";


          document.getElementById(
            "editTanggalMulaiKlien"
          ).value =
            tanggalInput(
              klien.tanggal_mulai
            );


          document.getElementById(
            "editTanggalAkhirKlien"
          ).value =
            tanggalInput(
              klien.tanggal_akhir
            );


          document.getElementById(
            "editStatusPengadaanKlien"
          ).value =
            klien.status_pengadaan || "";


          document.getElementById(
            "editStatusTeknisKlien"
          ).value =
            klien.status_teknis || "";

        }


        editKlienModal.classList.add(
          "show"
        );


      } catch (error) {

        console.error(
          "ERROR LOAD KLIEN:",
          error
        );

        alert(error.message);

      }

    }
  );

}


if (batalEditKlien) {

  batalEditKlien.addEventListener(
    "click",
    () => {

      editKlienModal.classList.remove(
        "show"
      );

    }
  );

}



// ======================================================
// KELOLA PARTNER
// ======================================================

const editPartnerButton =
  document.getElementById(
    "editPartnerButton"
  );

const editPartnerModal =
  document.getElementById(
    "editPartnerModal"
  );

const editPartnerContainer =
  document.getElementById(
    "editPartnerContainer"
  );

const batalEditPartner =
  document.getElementById(
    "batalEditPartner"
  );


// ======================================================
// EDIT PARTNER
// ======================================================

let masterPartnerEdit = [];


if (editPartnerButton) {

  editPartnerButton.addEventListener(
    "click",
    async () => {

      try {

        const response =
          await fetch(
            "/api/proyek/partner"
          );


        masterPartnerEdit =
          await response.json();


        if (!response.ok) {

          throw new Error(
            masterPartnerEdit.error ||
            "Gagal mengambil master partner"
          );

        }


        const partners =
          detailData.partners || [];


        if (
          partners.length === 0
        ) {

          editPartnerContainer.innerHTML = `
            <div class="empty">
              Proyek belum memiliki partner.
            </div>
          `;


          editPartnerModal.classList.add(
            "show"
          );


          return;

        }


        editPartnerContainer.innerHTML = `

          <form id="editPartnerForm">

            ${partners.map(
              (item, index) => `
              
              <div
                class="card"
                data-edit-partner="${item.proyek_partner_id}"
              >

                <div
                  style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    margin-bottom:16px;
                  "
                >

                  <strong>
                    Partner ${index + 1}
                  </strong>

                  <span class="badge badge-info">
                    ${item.nama_partner || "-"}
                  </span>

                </div>


                <input
                  type="hidden"
                  class="edit-proyek-partner-id"
                  value="${item.proyek_partner_id}"
                >


                <div class="form-group">

                  <label>
                    Partner
                  </label>

                  <select
                    class="edit-partner-id"
                    required
                  >

                    ${masterPartnerEdit.map(
                      partner => `

                        <option
                          value="${partner.id}"

                          ${
                            Number(partner.id) ===
                            Number(item.partner_id)
                              ? "selected"
                              : ""
                          }
                        >

                          ${partner.nama_partner}

                        </option>

                      `
                    ).join("")}

                  </select>

                </div>


                <div class="form-grid">

                  <div class="form-group">

                    <label>
                      Nilai Submit
                    </label>

                    <input
                      type="number"
                      class="edit-partner-submit"
                      value="${item.nilai_submit ?? ""}"
                    >

                  </div>


                  <div class="form-group">

                    <label>
                      Nilai Nego 1
                    </label>

                    <input
                      type="number"
                      class="edit-partner-nego1"
                      value="${item.nilai_nego_1 ?? ""}"
                    >

                  </div>


                  <div class="form-group">

                    <label>
                      Nilai Nego 2
                    </label>

                    <input
                      type="number"
                      class="edit-partner-nego2"
                      value="${item.nilai_nego_2 ?? ""}"
                    >

                  </div>


                  <div class="form-group">

                    <label>
                      Nilai Nego 3
                    </label>

                    <input
                      type="number"
                      class="edit-partner-nego3"
                      value="${item.nilai_nego_3 ?? ""}"
                    >

                  </div>

                </div>


                <div class="form-grid">

                  <div class="form-group">

                    <label>
                      Tanggal Mulai
                    </label>

                    <input
                      type="date"
                      class="edit-partner-mulai"
                      value="${tanggalInput(item.tanggal_mulai)}"
                    >

                  </div>


                  <div class="form-group">

                    <label>
                      Tanggal Akhir
                    </label>

                    <input
                      type="date"
                      class="edit-partner-akhir"
                      value="${tanggalInput(item.tanggal_akhir)}"
                    >

                  </div>

                </div>


                <div class="form-grid">

                  <div class="form-group">

                    <label>
                      Status Pengadaan
                    </label>

                    <input
                      type="text"
                      class="edit-partner-pengadaan"
                      value="${item.status_pengadaan || ""}"
                    >

                  </div>


                  <div class="form-group">

                    <label>
                      Status Teknis
                    </label>

                    <input
                      type="text"
                      class="edit-partner-teknis"
                      value="${item.status_teknis || ""}"
                    >

                  </div>

                </div>

              </div>

            `
            ).join("")}


            <div class="modal-actions">

              <button
                type="button"
                class="btn btn-secondary"
                onclick="
                  document
                    .getElementById('editPartnerModal')
                    .classList.remove('show')
                "
              >
                Batal
              </button>


              <button
                type="submit"
                class="btn btn-primary"
              >
                Simpan Partner
              </button>

            </div>

          </form>

        `;


        editPartnerModal.classList.add(
          "show"
        );


        // ================================================
        // SAVE PARTNER
        // ================================================

        const form =
          document.getElementById(
            "editPartnerForm"
          );


        form.addEventListener(
          "submit",
          async event => {

            event.preventDefault();


            const cards =
              document.querySelectorAll(
                "[data-edit-partner]"
              );


            const partnerPayload =
              Array.from(cards)
                .map(card => {


                  const numberOrNull =
                    selector => {

                      const value =
                        card.querySelector(
                          selector
                        ).value;

                      return value === ""
                        ? null
                        : Number(value);

                    };


                  return {

                    proyek_partner_id:
                      Number(
                        card.querySelector(
                          ".edit-proyek-partner-id"
                        ).value
                      ),


                    partner_id:
                      Number(
                        card.querySelector(
                          ".edit-partner-id"
                        ).value
                      ),


                    nilai_submit:
                      numberOrNull(
                        ".edit-partner-submit"
                      ),


                    nilai_nego_1:
                      numberOrNull(
                        ".edit-partner-nego1"
                      ),


                    nilai_nego_2:
                      numberOrNull(
                        ".edit-partner-nego2"
                      ),


                    nilai_nego_3:
                      numberOrNull(
                        ".edit-partner-nego3"
                      ),


                    tanggal_mulai:
                      card.querySelector(
                        ".edit-partner-mulai"
                      ).value || null,


                    tanggal_akhir:
                      card.querySelector(
                        ".edit-partner-akhir"
                      ).value || null,


                    status_pengadaan:
                      card.querySelector(
                        ".edit-partner-pengadaan"
                      ).value.trim() || null,


                    status_teknis:
                      card.querySelector(
                        ".edit-partner-teknis"
                      ).value.trim() || null

                  };

                });


            try {

              const saveResponse =
                await fetch(
                  `/api/proyek/${proyekId}/partners`,
                  {

                    method: "PUT",

                    headers: {
                      "Content-Type":
                        "application/json"
                    },

                    body:
                      JSON.stringify({
                        partners:
                          partnerPayload
                      })

                  }
                );


              const result =
                await saveResponse.json();


              if (!saveResponse.ok) {

                throw new Error(
                  result.error ||
                  "Gagal memperbarui partner"
                );

              }


              editPartnerModal
                .classList.remove(
                  "show"
                );


              await loadDetail();


            } catch (error) {

              console.error(
                "ERROR UPDATE PARTNER:",
                error
              );

              alert(
                error.message
              );

            }

          }
        );


      } catch (error) {

        console.error(
          "ERROR LOAD PARTNER:",
          error
        );

        alert(
          error.message
        );

      }

    }
  );

}


if (batalEditPartner) {

  batalEditPartner.addEventListener(
    "click",
    () => {

      editPartnerModal.classList.remove(
        "show"
      );

    }
  );

}



// ======================================================
// TUTUP MODAL KETIKA KLIK AREA GELAP
// ======================================================

[
  editProyekModal,
  editPicModal,
  editKlienModal,
  editPartnerModal
].forEach(modal => {

  if (!modal) return;


  modal.addEventListener(
    "click",
    event => {

      if (event.target === modal) {

        modal.classList.remove(
          "show"
        );

      }

    }
  );

});

// ======================================================
// SIMPAN EDIT PROYEK
// ======================================================

if (editProyekForm) {

  editProyekForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const payload = {

  kategori_produk_id:
    Number(
      document.getElementById(
        "editKategoriProyek"
      ).value
    ),

  nama_proyek:
    document.getElementById(
      "editNamaProyek"
    ).value.trim(),

  jenis_proyek:
    document.getElementById(
      "editJenisProyek"
    ).value,

  sub_jenis_proyek:
    document.getElementById(
      "editSubJenisProyek"
    ).value || null,

  status_final:
    document.getElementById(
      "editStatusFinal"
    ).value,

  deskripsi:
    document.getElementById(
      "editDeskripsi"
    ).value.trim()

};


      try {

        const response =
          await fetch(
            `/api/proyek/${proyekId}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(payload)
            }
          );


        const result =
          await response.json();


        if (!response.ok) {

          throw new Error(
            result.error ||
            "Gagal mengubah proyek"
          );

        }


        editProyekModal.classList.remove(
          "show"
        );


        await loadDetail();


      } catch (error) {

        console.error(
          "ERROR UPDATE PROYEK:",
          error
        );

        alert(error.message);

      }

    }
  );

}

// ======================================================
// SIMPAN PIC PROYEK
// ======================================================

const editPicForm =
  document.getElementById(
    "editPicForm"
  );


if (editPicForm) {

  editPicForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const picIds =
        Array.from(
          document.querySelectorAll(
            'input[name="editPic"]:checked'
          )
        )
        .map(
          item =>
            Number(item.value)
        );


      try {

        const response =
          await fetch(
            `/api/proyek/${proyekId}/pic`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  pic_ids: picIds
                })
            }
          );


        const result =
          await response.json();


        if (!response.ok) {

          throw new Error(
            result.error ||
            "Gagal memperbarui PIC"
          );

        }


        editPicModal.classList.remove(
          "show"
        );


        await loadDetail();


      } catch (error) {

        console.error(
          "ERROR UPDATE PIC:",
          error
        );

        alert(error.message);

      }

    }
  );

}
// ======================================================
// SIMPAN EDIT KLIEN
// ======================================================

const editKlienForm =
  document.getElementById(
    "editKlienForm"
  );


function angkaAtauNull(id) {

  const value =
    document.getElementById(id).value;

  if (
    value === "" ||
    value === null
  ) {
    return null;
  }

  return Number(value);

}


if (editKlienForm) {

  editKlienForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const payload = {

        klien_id:
          editKlienId.value
            ? Number(
                editKlienId.value
              )
            : null,


        nilai_submit:
          angkaAtauNull(
            "editNilaiSubmitKlien"
          ),


        nilai_nego_1:
          angkaAtauNull(
            "editNilaiNego1Klien"
          ),


        nilai_nego_2:
          angkaAtauNull(
            "editNilaiNego2Klien"
          ),


        nilai_nego_3:
          angkaAtauNull(
            "editNilaiNego3Klien"
          ),


        tanggal_mulai:
          document.getElementById(
            "editTanggalMulaiKlien"
          ).value || null,


        tanggal_akhir:
          document.getElementById(
            "editTanggalAkhirKlien"
          ).value || null,


        status_pengadaan:
          document.getElementById(
            "editStatusPengadaanKlien"
          ).value.trim() || null,


        status_teknis:
          document.getElementById(
            "editStatusTeknisKlien"
          ).value.trim() || null

      };


      if (!payload.klien_id) {

        alert(
          "Silakan pilih klien."
        );

        return;

      }


      try {

        const response =
          await fetch(
            `/api/proyek/${proyekId}/klien`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(payload)
            }
          );


        const result =
          await response.json();


        if (!response.ok) {

          throw new Error(
            result.error ||
            "Gagal memperbarui klien"
          );

        }


        editKlienModal.classList.remove(
          "show"
        );


        await loadDetail();


      } catch (error) {

        console.error(
          "ERROR UPDATE KLIEN:",
          error
        );

        alert(error.message);

      }

    }
  );

}

// ======================================================
// FORMAT TANGGAL TASK
// ======================================================

function formatTaskDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


function formatTaskDateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


// ======================================================
// LOAD TASK LIST DETAIL PROYEK
// ======================================================

async function loadDetailProjectTask() {

  const tbody =
    document.getElementById(
      "detailProjectTaskBody"
    );

  if (!tbody) {
    return;
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  const proyekId =
    params.get("id");

  if (!proyekId) {

    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          ID proyek tidak ditemukan.
        </td>
      </tr>
    `;

    return;
  }

  try {

    const response =
      await fetch(
        `/api/proyek/${proyekId}/task-list`
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gagal mengambil task"
      );

    }

    if (data.length === 0) {

      tbody.innerHTML = `
        <tr>
          <td
            colspan="9"
            style="
              text-align:center;
              padding:30px;
              color:#64748b;
            "
          >
            Belum ada task pada proyek ini.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      data.map(
        item => {

          const statusClass =
            String(
              item.status || ""
            )
              .toLowerCase()
              .replaceAll(
                " ",
                "-"
              );

          return `
            <tr>

              <td>
                <strong>
                  ${item.nama_pic || "-"}
                </strong>
              </td>

              <td>
                <strong>
                  ${item.task || "-"}
                </strong>
              </td>

              <td>
                <div
                  class="detail-task-note"
                  title="${item.catatan || ""}"
                >
                  ${item.catatan || "-"}
                </div>
              </td>

              <td>
                ${
                  item.link
                    ? `
                      <a
                        href="${item.link}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="detail-task-link"
                      >
                        ↗
                      </a>
                    `
                    : "-"
                }
              </td>

              <td>
                <span
                  class="
                    detail-task-status
                    detail-task-status-${statusClass}
                  "
                >
                  ${item.status || "-"}
                </span>
              </td>

              <td>
                ${formatTaskDate(
                  item.tanggal_mulai
                )}
              </td>

              <td>
                ${formatTaskDate(
                  item.target_date
                )}
              </td>

              <td>
                ${formatTaskDate(
                  item.tanggal_selesai
                )}
              </td>

              <td>
                ${formatTaskDateTime(
                  item.created_at
                )}
              </td>

            </tr>
          `;

        }
      )
      .join("");

  } catch (error) {

    console.error(
      "ERROR LOAD TASK DETAIL:",
      error
    );

    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          Gagal mengambil task.
        </td>
      </tr>
    `;

  }

}

loadDetailProjectTask();

// ======================================================
// START
// ======================================================

loadDetail();