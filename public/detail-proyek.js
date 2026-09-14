const params =
  new URLSearchParams(window.location.search);

const proyekId =
  params.get("id");


let detailData = null;
let activePartnerTerminId = null;
let activePartnerId = null;
let activePartnerDokumenId = null;
let modeTerminKlien = null;
let editKategoriDipilih = [];



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

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  const hari =
    String(
      date.getDate()
    ).padStart(2, "0");

  const bulan =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const tahun =
    date.getFullYear();

  return `${hari}/${bulan}/${tahun}`;
}

function tanggalInput(value) {

  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const tahun =
    date.getFullYear();

  const bulan =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const hari =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${tahun}-${bulan}-${hari}`;
}

// =====================================================
// EDIT KATEGORI
// ======================================================
async function loadKategoriEdit() {

  const select =
    document.getElementById(
      "editKategoriSelect"
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

    select.innerHTML = `
      <option value="">
        Pilih Kategori
      </option>
    `;

    data.forEach(item => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        item.id;

      option.textContent =
        item.nama_kategori_produk;

      select.appendChild(
        option
      );

    });

  } catch (error) {

    console.error(
      "ERROR LOAD KATEGORI EDIT:",
      error
    );

  }

}

function renderEditKategori() {

  const container =
    document.getElementById(
      "editKategoriTerpilih"
    );

  container.innerHTML = "";

  editKategoriDipilih.forEach(
    kategori => {

      const chip =
        document.createElement(
          "div"
        );

      chip.style.display = "flex";
      chip.style.alignItems = "center";
      chip.style.gap = "6px";
      chip.style.padding = "6px 10px";
      chip.style.border = "1px solid #d1d5db";
      chip.style.borderRadius = "20px";

      chip.innerHTML = `
        <span>
          ${kategori.nama}
        </span>

        <button
          type="button"
          data-id="${kategori.id}"
          style="
            border:none;
            background:none;
            cursor:pointer;
            font-size:16px;
          "
        >
          ×
        </button>
      `;

      container.appendChild(
        chip
      );

    }
  );

}

document.getElementById(
  "tambahEditKategori"
).addEventListener(
  "click",
  () => {

    const select =
      document.getElementById(
        "editKategoriSelect"
      );

    const id =
      Number(select.value);

    if (!id) return;

    const nama =
      select.options[
        select.selectedIndex
      ].textContent;

    const sudahAda =
      editKategoriDipilih.some(
        item =>
          item.id === id
      );

    if (sudahAda) {
      return;
    }

    editKategoriDipilih.push({
      id,
      nama
    });

    renderEditKategori();

    select.value = "";

  }
);

document.getElementById(
  "editKategoriTerpilih"
).addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "button[data-id]"
      );

    if (!button) return;

    const id =
      Number(
        button.dataset.id
      );

    editKategoriDipilih =
      editKategoriDipilih.filter(
        item =>
          item.id !== id
      );

    renderEditKategori();

  }
);


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


    // Ambil mode termin klien sebelum render
    if (
      detailData?.klien?.proyek_klien_id
    ) {

      try {

        await loadModeTerminKlien();

      } catch (error) {

        console.error(
          "ERROR LOAD MODE TERMIN KLIEN:",
          error
        );

        modeTerminKlien = null;

      }

    }


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
  Array.isArray(proyek.nama_kategori_produk_list) &&
  proyek.nama_kategori_produk_list.length > 0
    ? proyek.nama_kategori_produk_list.join(", ")
    : (
        proyek.nama_kategori_produk ||
        "-"
      );


// ======================================================
// SUMMARY NILAI PROYEK
// ======================================================

const jenisProyek =
  detailData?.proyek?.jenis_proyek || "";


// ======================================================
// KHUSUS TRANSAKSI
// ======================================================

if (jenisProyek === "Transaksi") {

  // TOTAL TERMIN KLIEN
  const nilaiKlienTransaksi =
    (detailData?.klien?.termin || [])
      .reduce(
        (total, item) =>
          total + Number(item.nominal || 0),
        0
      );


  // TOTAL TERMIN SELURUH PARTNER
  const nilaiPartnerTransaksi =
    (detailData?.partners || [])
      .reduce(
        (totalPartner, partner) => {

          const totalTerminPartner =
            (partner.termin || [])
              .reduce(
                (total, item) =>
                  total + Number(item.nominal || 0),
                0
              );

          return (
            totalPartner +
            totalTerminPartner
          );

        },
        0
      );


  // MARGIN
  const marginTransaksi =
    nilaiKlienTransaksi -
    nilaiPartnerTransaksi;


  // MARGIN %
  const marginPersenTransaksi =
    nilaiKlienTransaksi > 0
      ? (
          marginTransaksi /
          nilaiKlienTransaksi
        ) * 100
      : 0;


  document.getElementById(
    "nilaiKlien"
  ).textContent =
    rupiah(nilaiKlienTransaksi);


  document.getElementById(
    "nilaiPartner"
  ).textContent =
    rupiah(nilaiPartnerTransaksi);


  document.getElementById(
    "margin"
  ).textContent =
    rupiah(marginTransaksi);


  document.getElementById(
    "marginPersen"
  ).textContent =
    `${marginPersenTransaksi.toFixed(2)}%`;

}


// ======================================================
// REGULER/SLA DAN SEWA
// ======================================================

else {

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

}

  

  // PROYEK

  const kategoriList =
  detailData.proyek.nama_kategori_produk_list;

document.getElementById(
  "kategoriInfoProyek"
).textContent =
  Array.isArray(proyek.nama_kategori_produk_list) &&
  proyek.nama_kategori_produk_list.length > 0
    ? proyek.nama_kategori_produk_list.join(", ")
    : (
        detailData.proyek.nama_kategori_produk ||
        "-"
      );

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
  renderTermin(klien);
  renderDokumen(klien);
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

  if (!container) return;

  if (!pic || pic.length === 0) {

    container.innerHTML = `
      <div class="empty">
        Belum ada PIC.
      </div>
    `;

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
          ${item.nama || "-"}
        </strong>

        ${
          item.inisial
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

  if (!container) return;

  if (!klien) {

    container.innerHTML = `
      <div class="empty">
        Belum ada klien.
      </div>
    `;

    return;
  }

  container.innerHTML = `

    <div class="grid">

      <div class="info">
        <div class="label">
          Perusahaan
        </div>

        <div class="value">
          ${klien.perusahaan_klien || "-"}
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
          ${rupiah(
            nilaiSubmitKlienTampil(klien)
          )}
        </div>
      </div>


      <div class="info">
        <div class="label">
          Nilai Final
        </div>

        <div class="value">
          ${rupiah(
            klien.nilai_final
          )}
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
// LOAD MODE TERMIN KLIEN
// ======================================================

async function loadModeTerminKlien() {

  const proyekKlienId =
    detailData?.klien?.proyek_klien_id;


  if (!proyekKlienId) {

    modeTerminKlien = null;

    throw new Error(
      "Data proyek klien tidak ditemukan."
    );

  }


  const response =
    await fetch(
      `/api/proyek/klien/${proyekKlienId}/termin-mode`
    );


  const data =
    await response.json();


  if (!response.ok) {

    throw new Error(
      data.error ||
      "Gagal mengambil mode termin klien"
    );

  }


  modeTerminKlien =
    data.mode_termin;


  console.log(
    "MODE TERMIN KLIEN:",
    data
  );


  return modeTerminKlien;
}


// ======================================================
// CEK MODE NOMINAL KLIEN
// ======================================================

function isTerminKlienNominal() {

  return (
    modeTerminKlien === "nominal"
  );

}

// ======================================================
// UPDATE TAMPILAN MODAL TERMIN
// ======================================================
function updateTerminModalMode(
  mode = null
) {

 const nominalMode =
  activePartnerId
    ? isTerminNominal()
    : isTerminKlienNominal();

  const persentaseGroup =
    document.getElementById(
      "persentaseTerminGroup"
    );

  const nominalGroup =
    document.getElementById(
      "nominalTerminGroup"
    );

  const persentaseInput =
    document.getElementById(
      "persentaseTermin"
    );

  const nominalInput =
    document.getElementById(
      "nominalTermin"
    );


  if (nominalMode) {

    if (persentaseGroup) {
      persentaseGroup.style.display =
        "none";
    }

    if (nominalGroup) {
      nominalGroup.style.display =
        "";
    }

    if (persentaseInput) {
      persentaseInput.required =
        false;
    }

    if (nominalInput) {
      nominalInput.required =
        true;
    }

  } else {

    if (persentaseGroup) {
      persentaseGroup.style.display =
        "";
    }

    if (nominalGroup) {
      nominalGroup.style.display =
        "none";
    }

    if (persentaseInput) {
      persentaseInput.required =
        true;
    }

    if (nominalInput) {
      nominalInput.required =
        false;
    }

  }

}

// ======================================================
// TOTAL NOMINAL TERMIN
// ======================================================

function totalNominalTermin(termin = []) {

  return termin.reduce(
    (total, item) =>
      total +
      Number(item.nominal || 0),
    0
  );

}


// ======================================================
// NILAI SUBMIT KLIEN
//
// TRANSAKSI:
// Nilai Submit = total seluruh termin
//
// Selain transaksi:
// Tetap menggunakan nilai_submit lama
// ======================================================

function nilaiSubmitKlienTampil(klien) {

  if (
    detailData?.proyek?.jenis_proyek ===
    "Transaksi"
  ) {

    const termin =
      klien?.termin || [];

    return termin.reduce(
      (total, item) =>
        total +
        Number(item.nominal || 0),
      0
    );

  }

  return Number(
    klien?.nilai_submit || 0
  );

}


// ======================================================
// RENDER TERMIN KLIEN
// ======================================================

function renderTermin(klien) {

  const tbody =
    document.getElementById(
      "terminTable"
    );


  if (!tbody) return;


  const nominalMode =
  activePartnerId
    ? isTerminNominal()
    : isTerminKlienNominal();


  // ===============================
  // BELUM ADA TERMIN
  // ===============================

  if (
    !klien ||
    !Array.isArray(klien.termin) ||
    klien.termin.length === 0
  ) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          Belum ada termin pembayaran.
        </td>
      </tr>
    `;


    const totalTermin =
      document.getElementById(
        "totalTermin"
      );


    if (totalTermin) {

      totalTermin.textContent =
        nominalMode
          ? rupiah(0)
          : "0%";

    }


    const progress =
      document.getElementById(
        "terminProgress"
      );


    if (progress) {
      progress.style.width = "0%";
    }


    return;
  }


  const nilaiFinal =
    Number(
      klien.nilai_final || 0
    );


  let totalPersen = 0;
  let totalNominal = 0;


  tbody.innerHTML =
    klien.termin
      .map(item => {

        let persen =
          Number(
            item.persentase || 0
          );


        let nominal =
          Number(
            item.nominal || 0
          );


        // ==========================
        // REGULER / SLA
        // ==========================

        if (!nominalMode) {

          nominal =
            nilaiFinal *
            persen /
            100;

        }


        totalPersen += persen;
        totalNominal += nominal;


        return `

          <tr>

            <td>
              ${item.nama_termin || "-"}
            </td>


            <td>
              ${
                nominalMode
                  ? "-"
                  : `${persen.toFixed(2)}%`
              }
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
                onclick="editTerminKlien(${item.id})"
              >
                Edit
              </button>


              <button
                class="btn-danger"
                onclick="hapusTermin(${item.id})"
              >
                Hapus
              </button>

            </td>

          </tr>

        `;

      })
      .join("");


  // ===============================
  // TOTAL
  // ===============================

  const totalTermin =
    document.getElementById(
      "totalTermin"
    );


  if (totalTermin) {

    totalTermin.textContent =
      nominalMode
        ? rupiah(totalNominal)
        : `${totalPersen.toFixed(2)}%`;

  }


  // ===============================
  // PROGRESS
  // ===============================

  let progressValue = 0;


  if (nominalMode) {

    if (nilaiFinal > 0) {

      progressValue =
        totalNominal /
        nilaiFinal *
        100;

    }

  } else {

    progressValue =
      totalPersen;

  }


  const progress =
    document.getElementById(
      "terminProgress"
    );


  if (progress) {

    progress.style.width =
      `${Math.min(
        progressValue,
        100
      )}%`;

  }

}


// ======================================================
// MODAL TERMIN
// ======================================================

const terminModal =
  document.getElementById(
    "terminModal"
  );


const tambahTerminButton =
  document.getElementById(
    "tambahTerminButton"
  );


if (tambahTerminButton) {

  tambahTerminButton.addEventListener(
    "click",
    () => {

      if (!detailData?.klien) {

        alert(
          "Proyek belum memiliki klien."
        );

        return;
      }

      activePartnerId = null;
      activePartnerTerminId = null;

      const form =
        document.getElementById(
          "terminForm"
        );

      if (form) {
        form.reset();
      }

      document.getElementById(
        "terminId"
      ).value = "";

      document.getElementById(
        "terminModalTitle"
      ).textContent =
        "Tambah Termin Klien";

      updateTerminModalMode();

      terminModal.classList.add(
        "show"
      );

    }
  );

}


// ======================================================
// BATAL TERMIN
// ======================================================

const batalTermin =
  document.getElementById(
    "batalTermin"
  );


if (batalTermin) {

  batalTermin.addEventListener(
    "click",
    () => {

      terminModal.classList.remove(
        "show"
      );


      activePartnerId = null;
      activePartnerTerminId = null;

    }
  );

}


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


   const nominalMode =
  activePartnerId
    ? isTerminNominal()
    : isTerminKlienNominal();


    const persenValue =
      Number(
        document.getElementById(
          "persentaseTermin"
        ).value || 0
      );


    const nominalValue =
      Number(
        document.getElementById(
          "nominalTermin"
        ).value || 0
      );


 const payload = {

  nama_termin:
    document.getElementById(
      "namaTermin"
    ).value.trim(),

  persentase:
    nominalMode
      ? null
      : persenValue,

  nominal:
    nominalMode
      ? nominalValue
      : null,

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


    // ======================================================
    // VALIDASI NAMA TERMIN
    // ======================================================

    if (!payload.nama_termin) {

      alert(
        "Nama termin wajib diisi."
      );

      document.getElementById(
        "namaTermin"
      ).focus();

      return;
    }


    // ======================================================
    // VALIDASI NILAI TERMIN
    // ======================================================

    if (nominalMode) {

      // SEWA / TRANSAKSI

      if (
        !payload.nominal ||
        payload.nominal <= 0
      ) {

        alert(
          "Nominal termin harus lebih dari Rp 0."
        );

        document.getElementById(
          "nominalTermin"
        ).focus();

        return;
      }

    } else {

      // REGULER / SLA

      if (
        !payload.persentase ||
        payload.persentase <= 0 ||
        payload.persentase > 100
      ) {

        alert(
          "Persentase harus lebih dari 0 dan maksimal 100."
        );

        document.getElementById(
          "persentaseTermin"
        ).focus();

        return;
      }

    }


    let url;
    let method;


    // ======================================================
    // TERMIN PARTNER
    // ======================================================

    if (activePartnerId) {

      if (activePartnerTerminId) {

        url =
          `/api/proyek/partner/termin/${activePartnerTerminId}`;

        method =
          "PUT";

      } else {

        url =
          `/api/proyek/partner/${activePartnerId}/termin`;

        method =
          "POST";

      }


    // ======================================================
    // TERMIN KLIEN - EDIT
    // ======================================================

    } else if (terminId) {

      url =
        `/api/proyek/klien/termin/${terminId}`;

      method =
        "PUT";


    // ======================================================
    // TERMIN KLIEN - TAMBAH
    // ======================================================

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

      method =
        "POST";

    }


    try {

      console.log(
        "SIMPAN TERMIN:",
        {
          url,
          method,
          payload,
          activePartnerId,
          activePartnerTerminId,
          jenisProyek:
            detailData?.proyek?.jenis_proyek
        }
      );

console.log("MODE TERMIN KLIEN:", modeTerminKlien);
console.log("NOMINAL MODE:", nominalMode);
console.log("PAYLOAD TERMIN:", payload);
console.log(
  "PAYLOAD TERMIN JSON:",
  JSON.stringify(
    payload,
    null,
    2
  )
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

      alert(
        error.message
      );

    }

  }
);

// ======================================================
// EDIT TERMIN KLIEN
// ======================================================

window.editTerminKlien =
 async function (id) {

    const termin =
      detailData?.klien?.termin?.find(
        item =>
          Number(item.id) ===
          Number(id)
      );


    if (!termin) {

      alert(
        "Termin klien tidak ditemukan."
      );

      return;

    }


    // Pastikan mode KLIEN
    activePartnerId = null;
    activePartnerTerminId = null;


    // ID TERMIN
    document.getElementById(
      "terminId"
    ).value =
      termin.id;


    // NAMA TERMIN
    document.getElementById(
      "namaTermin"
    ).value =
      termin.nama_termin || "";


    // Ambil mode termin KLIEN dari backend
try {

  const mode =
    await loadModeTerminKlien();

  updateTerminModalMode(
    mode
  );

} catch (error) {

  console.error(
    "ERROR MODE TERMIN KLIEN:",
    error
  );

  alert(
    error.message
  );

  return;

}


const nominalMode =
  isTerminKlienNominal();


    // REGULER / SLA
    document.getElementById(
      "persentaseTermin"
    ).value =
      nominalMode
        ? ""
        : (
            termin.persentase ??
            ""
          );


    // SEWA / TRANSAKSI
    document.getElementById(
      "nominalTermin"
    ).value =
      nominalMode
        ? (
            termin.nominal ??
            ""
          )
        : "";


    // STATUS PEMBAYARAN
    document.getElementById(
      "statusPembayaran"
    ).value =
      termin.status_pembayaran ||
      "Belum Dibayar";


    // JATUH TEMPO
    document.getElementById(
      "tanggalJatuhTempo"
    ).value =
      tanggalInput(
        termin.tanggal_jatuh_tempo
      );


    // TANGGAL BAYAR
    document.getElementById(
      "tanggalBayar"
    ).value =
      tanggalInput(
        termin.tanggal_bayar
      );


    // JUDUL MODAL
    document.getElementById(
      "terminModalTitle"
    ).textContent =
      "Edit Termin Klien";


    // BUKA MODAL
    terminModal.classList.add(
      "show"
    );

  };

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
// EDIT TERMIN PARTNER
// ======================================================

function editTerminPartner(id) {

  // Cari termin dari seluruh partner
  let terminDitemukan = null;
  let partnerDitemukan = null;

  const partners =
    detailData?.partners || [];


  for (const partner of partners) {

    const termin =
      (partner.termin || []).find(
        item =>
          Number(item.id) ===
          Number(id)
      );


    if (termin) {

      terminDitemukan =
        termin;

      partnerDitemukan =
        partner;

      break;

    }

  }


  if (
    !terminDitemukan ||
    !partnerDitemukan
  ) {

    alert(
      "Termin partner tidak ditemukan."
    );

    return;

  }


  // ======================================================
  // SET MODE PARTNER
  // ======================================================

  activePartnerId =
    Number(
      partnerDitemukan.proyek_partner_id
    );

  activePartnerTerminId =
    Number(
      terminDitemukan.id
    );


  // ID termin pada hidden input
  document.getElementById(
    "terminId"
  ).value =
    terminDitemukan.id;


  // ======================================================
  // ISI FORM
  // ======================================================

  document.getElementById(
    "namaTermin"
  ).value =
    terminDitemukan.nama_termin || "";


 const nominalMode =
  activePartnerId
    ? isTerminNominal()
    : isTerminKlienNominal();


  document.getElementById(
    "persentaseTermin"
  ).value =
    nominalMode
      ? ""
      : (
          terminDitemukan.persentase ??
          ""
        );


  document.getElementById(
    "nominalTermin"
  ).value =
    nominalMode
      ? (
          terminDitemukan.nominal ??
          ""
        )
      : "";


  document.getElementById(
    "statusPembayaran"
  ).value =
    terminDitemukan.status_pembayaran ||
    "";


  document.getElementById(
    "tanggalJatuhTempo"
  ).value =
    tanggalInput(
      terminDitemukan.tanggal_jatuh_tempo
    );


  document.getElementById(
    "tanggalBayar"
  ).value =
    tanggalInput(
      terminDitemukan.tanggal_bayar
    );


  // ======================================================
  // ATUR MODAL
  // ======================================================

  document.getElementById(
    "terminModalTitle"
  ).textContent =
    `Edit Termin Partner - ${
      partnerDitemukan.nama_partner || ""
    }`;


  updateTerminModalMode();


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
    document.getElementById(
      "partnerContainer"
    );

  if (
    !partners ||
    partners.length === 0
  ) {

    container.innerHTML = `
      <div class="empty">
        Belum ada partner.
      </div>
    `;

    return;
  }


  const nominalMode =
  activePartnerId
    ? isTerminNominal()
    : isTerminKlienNominal();


  container.innerHTML =
    partners.map(
      (item, index) => {

        const termin =
          Array.isArray(item.termin)
            ? item.termin
            : [];

        const dokumen =
          Array.isArray(item.dokumen)
            ? item.dokumen
            : [];

        const nilaiFinal =
          Number(
            item.nilai_final || 0
          );


        const totalTermin =
          termin.reduce(
            (total, t) => {

              if (nominalMode) {

                return (
                  total +
                  Number(
                    t.nominal || 0
                  )
                );

              }

              return (
                total +
                Number(
                  t.persentase || 0
                )
              );

            },
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
                    ${tanggal(
                      item.tanggal_mulai
                    )}
                  </div>

                </div>


                <div class="info">

                  <div class="label">
                    Tanggal Akhir
                  </div>

                  <div class="value">
                    ${tanggal(
                      item.tanggal_akhir
                    )}
                  </div>

                </div>


                <div class="info">

                  <div class="label">
                    Nilai Submit
                  </div>

                  <div class="value">
                 ${rupiah(
                    nilaiSubmitPartnerTampil(item)
                  )}
                  </div>

                </div>


                <div class="info">

                  <div class="label">
                    Nego 1
                  </div>

                  <div class="value">
                    ${rupiah(
                      item.nilai_nego_1
                    )}
                  </div>

                </div>


                <div class="info">

                  <div class="label">
                    Nego 2
                  </div>

                  <div class="value">
                    ${rupiah(
                      item.nilai_nego_2
                    )}
                  </div>

                </div>


                <div class="info">

                  <div class="label">
                    Nego 3
                  </div>

                  <div class="value">
                    ${rupiah(
                      item.nilai_nego_3
                    )}
                  </div>

                </div>


                <div class="info">

                  <div class="label">
                    Nilai Final
                  </div>

                  <div class="value">
                    ${rupiah(
                      nilaiFinal
                    )}
                  </div>

                </div>


                <div class="info">

                  <div class="label">
                    Status Pengadaan
                  </div>

                  <div class="value">
                    ${
                      item.status_pengadaan ||
                      "-"
                    }
                  </div>

                </div>


                <div class="info">

                  <div class="label">
                    Status Teknis
                  </div>

                  <div class="value">
                    ${
                      item.status_teknis ||
                      "-"
                    }
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
                    type="button"
                    class="btn-secondary"
                    onclick="tambahTerminPartner(${item.proyek_partner_id})"
                  >
                    + Tambah Termin
                  </button>

                </div>


                <div style="
                  margin-bottom:12px;
                  font-size:13px;
                ">

                  Total Termin:

                  <strong>
                    ${
                      nominalMode
                        ? rupiah(totalTermin)
                        : `${totalTermin.toFixed(2)}%`
                    }
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
                    type="button"
                    class="btn-secondary"
                    onclick="tambahDokumenPartner(${item.proyek_partner_id})"
                  >
                    + Tambah Dokumen
                  </button>

                </div>


                ${renderDokumenPartner(
                  dokumen
                )}

              </div>

            </div>

          </div>

        `;

      }
    ).join("");

}



// ======================================================
// TERMIN PARTNER
// ======================================================

function renderTerminPartner(
  termin,
  nilaiFinal
) {

  if (
    !termin ||
    termin.length === 0
  ) {

    return `
      <div class="empty">
        Belum ada termin partner.
      </div>
    `;

  }


 const nominalMode =
  activePartnerId
    ? isTerminNominal()
    : isTerminKlienNominal();


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
              Number(
                item.persentase || 0
              );


            const nominal =
              nominalMode
                ? Number(
                    item.nominal || 0
                  )
                : (
                    Number(
                      nilaiFinal || 0
                    ) *
                    persen /
                    100
                  );


            return `

              <tr>

                <td>
                  ${item.nama_termin || "-"}
                </td>


                <td>
                  ${
                    nominalMode
                      ? "-"
                      : `${persen.toFixed(2)}%`
                  }
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
                    type="button"
                    class="btn-secondary"
                    onclick="editTerminPartner(${item.id})"
                  >
                    Edit
                  </button>


                  <button
                    type="button"
                    class="btn-danger"
                    onclick="hapusTerminPartner(${item.id})"
                  >
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

// =========================================
// KATEGORI
// =========================================

await loadKategoriEdit();

editKategoriDipilih = [];

const kategoriIds =
  Array.isArray(
    detailData.proyek.kategori_produk_ids
  )
    ? detailData.proyek.kategori_produk_ids
        .map(Number)
    : [
        Number(
          detailData.proyek.kategori_produk_id
        )
      ];

const selectKategori =
  document.getElementById(
    "editKategoriSelect"
  );

kategoriIds.forEach(id => {

  if (!id) return;

  const option =
    Array.from(
      selectKategori.options
    ).find(
      item =>
        Number(item.value) === id
    );

  if (option) {

    editKategoriDipilih.push({
      id,
      nama:
        option.textContent.trim()
    });

  }

});

renderEditKategori();


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
// TOTAL TERMIN TRANSAKSI
// ======================================================

function getTotalTerminTransaksi() {

  if (
    detailData?.proyek?.jenis_proyek !==
    "Transaksi"
  ) {

    return null;

  }


  const termin =
    detailData?.klien?.termin || [];


  return termin.reduce(
    (total, item) => {

      return (
        total +
        Number(
          item.nominal || 0
        )
      );

    },
    0
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


let masterPartnerEdit = [];


// ======================================================
// BUAT OPTION MASTER PARTNER
// ======================================================

function partnerOptions(
  selectedId = ""
) {

  return `
    <option value="">
      Pilih Partner
    </option>

    ${masterPartnerEdit.map(
      partner => `
        <option
          value="${partner.id}"
          ${
            Number(partner.id) ===
            Number(selectedId)
              ? "selected"
              : ""
          }
        >
          ${partner.nama_partner}
        </option>
      `
    ).join("")}
  `;

}


// ======================================================
// BUAT CARD PARTNER
// ======================================================

function buatPartnerCard(
  item = {},
  index = 0
) {

  const proyekPartnerId =
    item.proyek_partner_id || "";

  return `

    <div
      class="card edit-partner-card"
      data-edit-partner="${proyekPartnerId}"
      style="
        margin-bottom:18px;
        border:1px solid #e5e7eb;
        border-radius:12px;
        padding:18px;
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          margin-bottom:16px;
        "
      >

        <strong class="partner-card-title">
          Partner ${index + 1}
        </strong>

        <button
          type="button"
          class="btn-danger"
          onclick="hapusPartnerCard(this)"
        >
          Hapus Partner
        </button>

      </div>


      <input
        type="hidden"
        class="edit-proyek-partner-id"
        value="${proyekPartnerId}"
      >


      <div class="form-group">

        <label>
          Partner
        </label>

        <select
          class="edit-partner-id"
          required
        >
          ${partnerOptions(
            item.partner_id
          )}
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
            Nego 1
          </label>

          <input
            type="number"
            class="edit-partner-nego1"
            value="${item.nilai_nego_1 ?? ""}"
          >

        </div>


        <div class="form-group">

          <label>
            Nego 2
          </label>

          <input
            type="number"
            class="edit-partner-nego2"
            value="${item.nilai_nego_2 ?? ""}"
          >

        </div>


        <div class="form-group">

          <label>
            Nego 3
          </label>

          <input
            type="number"
            class="edit-partner-nego3"
            value="${item.nilai_nego_3 ?? ""}"
          >

        </div>


        <div class="form-group">

          <label>
            Tanggal Mulai
          </label>

          <input
            type="date"
            class="edit-partner-mulai"
            value="${tanggalInput(
              item.tanggal_mulai
            )}"
          >

        </div>


        <div class="form-group">

          <label>
            Tanggal Akhir
          </label>

          <input
            type="date"
            class="edit-partner-akhir"
            value="${tanggalInput(
              item.tanggal_akhir
            )}"
          >

        </div>


        <div class="form-group">

          <label>
            Status Pengadaan
          </label>

          <input
            type="text"
            class="edit-partner-pengadaan"
            value="${item.status_pengadaan ?? ""}"
          >

        </div>


        <div class="form-group">

          <label>
            Status Teknis
          </label>

          <input
            type="text"
            class="edit-partner-teknis"
            value="${item.status_teknis ?? ""}"
          >

        </div>

      </div>

    </div>

  `;

}


// ======================================================
// UPDATE NOMOR PARTNER
// ======================================================

function updateNomorPartner() {

  const cards =
    editPartnerContainer
      .querySelectorAll(
        ".edit-partner-card"
      );

  cards.forEach(
    (card, index) => {

      const title =
        card.querySelector(
          ".partner-card-title"
        );

      if (title) {

        title.textContent =
          `Partner ${index + 1}`;

      }

    }
  );

}


// ======================================================
// TAMBAH PARTNER
// ======================================================

function tambahPartnerCard() {

  const list =
    document.getElementById(
      "editPartnerList"
    );

  if (!list) return;


  const index =
    list.querySelectorAll(
      ".edit-partner-card"
    ).length;


  list.insertAdjacentHTML(
    "beforeend",
    buatPartnerCard(
      {},
      index
    )
  );


  updateNomorPartner();

}


// ======================================================
// HAPUS PARTNER DARI FORM
// ======================================================

function hapusPartnerCard(
  button
) {

  const card =
    button.closest(
      ".edit-partner-card"
    );

  if (!card) return;


  const namaPartner =
    card.querySelector(
      ".edit-partner-id"
    );

  const nama =
    namaPartner &&
    namaPartner.options[
      namaPartner.selectedIndex
    ]
      ? namaPartner.options[
          namaPartner.selectedIndex
        ].text
      : "partner ini";


  const konfirmasi =
    confirm(
      `Hapus ${nama} dari proyek?`
    );


  if (!konfirmasi) return;


  card.remove();

  updateNomorPartner();

}


// ======================================================
// BUKA KELOLA PARTNER
// ======================================================

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


        editPartnerContainer.innerHTML = `

          <form id="editPartnerForm">

            <div id="editPartnerList">

              ${
                partners.length
                  ? partners.map(
                      (
                        item,
                        index
                      ) =>
                        buatPartnerCard(
                          item,
                          index
                        )
                    ).join("")
                  : `
                    <div
                      id="partnerKosongInfo"
                      class="empty"
                      style="
                        margin-bottom:16px;
                      "
                    >
                      Proyek belum memiliki partner.
                    </div>
                  `
              }

            </div>


            <div
              style="
                margin-top:16px;
                margin-bottom:24px;
              "
            >

              <button
                type="button"
                class="btn-secondary"
                id="tambahPartnerEditButton"
              >
                + Tambah Partner
              </button>

            </div>


            <div
              style="
                display:flex;
                justify-content:flex-end;
                gap:10px;
              "
            >

              <button
                type="button"
                class="btn-secondary"
                id="batalPartnerForm"
              >
                Batal
              </button>

              <button
                type="submit"
                class="btn-primary"
              >
                Simpan Perubahan
              </button>

            </div>

          </form>

        `;


        editPartnerModal.classList.add(
          "show"
        );


        // ===============================
        // TAMBAH PARTNER
        // ===============================

        document.getElementById(
          "tambahPartnerEditButton"
        ).addEventListener(
          "click",
          () => {

            const info =
              document.getElementById(
                "partnerKosongInfo"
              );

            if (info) {
              info.remove();
            }

            tambahPartnerCard();

          }
        );


        // ===============================
        // BATAL
        // ===============================

        document.getElementById(
          "batalPartnerForm"
        ).addEventListener(
          "click",
          () => {

            editPartnerModal
              .classList.remove(
                "show"
              );

          }
        );


        // ===============================
        // SIMPAN
        // ===============================

        document.getElementById(
          "editPartnerForm"
        ).addEventListener(
          "submit",
          async event => {

            event.preventDefault();


            const cards =
              editPartnerContainer
                .querySelectorAll(
                  ".edit-partner-card"
                );


            const partnerPayload =
              Array.from(cards)
                .map(card => {

                  function numberOrNull(
                    selector
                  ) {

                    const value =
                      card.querySelector(
                        selector
                      ).value;

                    return value === ""
                      ? null
                      : Number(value);

                  }


                  return {

                    proyek_partner_id:
                      card.querySelector(
                        ".edit-proyek-partner-id"
                      ).value
                        ? Number(
                            card.querySelector(
                              ".edit-proyek-partner-id"
                            ).value
                          )
                        : null,


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


            // ===============================
            // VALIDASI PARTNER
            // ===============================

            const partnerKosong =
              partnerPayload.some(
                item =>
                  !item.partner_id
              );


            if (partnerKosong) {

              alert(
                "Partner wajib dipilih."
              );

              return;

            }


            // ===============================
            // CEK DUPLIKAT PARTNER
            // ===============================

            const partnerIds =
              partnerPayload.map(
                item =>
                  item.partner_id
              );


            const uniqueIds =
              new Set(
                partnerIds
              );


            if (
              uniqueIds.size !==
              partnerIds.length
            ) {

              alert(
                "Partner yang sama tidak boleh ditambahkan dua kali."
              );

              return;

            }


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


// ======================================================
// BATAL KELOLA PARTNER
// ======================================================

if (batalEditPartner) {

  batalEditPartner.addEventListener(
    "click",
    () => {

      editPartnerModal
        .classList.remove(
          "show"
        );

    }
  );

}

// ======================================================
// NILAI SUBMIT PARTNER TAMPIL
// ======================================================

function nilaiSubmitPartnerTampil(partner) {

  // TRANSAKSI:
  // Nilai Submit Partner =
  // total nominal seluruh termin partner

  if (
    detailData?.proyek?.jenis_proyek ===
    "Transaksi"
  ) {

    const termin =
      partner?.termin || [];

    return termin.reduce(
      (total, item) => {

        return (
          total +
          Number(item.nominal || 0)
        );

      },
      0
    );

  }


  // REGULER / SLA / SEWA
  // tetap menggunakan nilai submit partner

  return Number(
    partner?.nilai_submit || 0
  );

}

// ======================================================
// TAMBAH TERMIN PARTNER
// ======================================================

function tambahTerminPartner(
  proyekPartnerId
) {

  console.log(
    "TAMBAH TERMIN PARTNER:",
    proyekPartnerId
  );

  // tandai bahwa termin yang sedang
  // dikelola adalah termin partner
  activePartnerId =
    Number(proyekPartnerId);

  activePartnerTerminId =
    null;


  // reset form
  const form =
    document.getElementById(
      "terminForm"
    );

  if (form) {
    form.reset();
  }


  // kosongkan ID termin
  const terminId =
    document.getElementById(
      "terminId"
    );

  if (terminId) {
    terminId.value = "";
  }


  // judul modal
  const title =
    document.getElementById(
      "terminModalTitle"
    );

  if (title) {
    title.textContent =
      "Tambah Termin Partner";
  }


  // sesuaikan:
  // Transaksi = nominal
  // Reguler/SLA & Sewa = persentase
  updateTerminModalMode();


  // buka modal
  const modal =
    document.getElementById(
      "terminModal"
    );

  if (!modal) {

    console.error(
      "terminModal tidak ditemukan"
    );

    return;

  }


  modal.classList.add(
    "show"
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
const editProyekForm =
  document.getElementById(
    "editProyekForm"
  );

if (editProyekForm) {

  editProyekForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();
      console.log(
        "SUBMIT EDIT PROYEK MASUK"
      );


      const payload = {

kategori_produk_ids:
  editKategoriDipilih.map(
    item => item.id
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
// TERMIN - MODE BERDASARKAN JENIS PROYEK
// ======================================================

function isTerminNominal() {

  const jenisProyek =
    String(
      detailData?.proyek?.jenis_proyek || ""
    )
      .trim()
      .toLowerCase();

  console.log(
    "JENIS PROYEK TERMIN:",
    jenisProyek
  );

  return (
    jenisProyek.includes("sewa") ||
    jenisProyek.includes("transaksi")
  );

}

// ======================================================
// START
// ======================================================

loadDetail();