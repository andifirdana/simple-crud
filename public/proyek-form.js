const form = document.getElementById("proyekForm");

const kategoriSelect =
  document.getElementById("kategori_produk_id");

const jenisSelect =
  document.getElementById("jenis_proyek");

const subJenisGroup =
  document.getElementById("subJenisGroup");

const subJenisSelect =
  document.getElementById("sub_jenis_proyek");

const klienSelect =
  document.getElementById("klien_id");

const picContainer =
  document.getElementById("picContainer");

const partnerContainer =
  document.getElementById("partnerContainer");

const addPartnerButton =
  document.getElementById("addPartnerButton");

const saveButton =
  document.getElementById("saveButton");


let masterPartner = [];


// ======================================================
// LOAD MASTER DATA
// ======================================================

async function loadMaster() {

  try {

    const [
      kategoriResponse,
      klienResponse,
      partnerResponse
    ] = await Promise.all([
      fetch("/api/proyek/kategori"),
      fetch("/api/proyek/klien"),
      fetch("/api/proyek/partner")
    ]);


    if (
      !kategoriResponse.ok ||
      !klienResponse.ok ||
      !partnerResponse.ok
    ) {
      throw new Error(
        "Gagal mengambil master data"
      );
    }


    const kategori =
      await kategoriResponse.json();

    const klien =
      await klienResponse.json();

    masterPartner =
      await partnerResponse.json();


    // ================================
    // KATEGORI
    // ================================

    kategori.forEach(item => {

      const option =
        document.createElement("option");

      option.value = item.id;

      option.textContent =
        item.nama_kategori_produk;

      kategoriSelect.appendChild(option);

    });


    // ================================
    // KLIEN
    // ================================

    klien.forEach(item => {

      const option =
        document.createElement("option");

      option.value = item.id;

      option.textContent = item.inisial
  ? `${item.perusahaan_klien} (${item.inisial})`
  : item.perusahaan_klien;

      klienSelect.appendChild(option);

    });


  } catch (error) {

    console.error(
      "ERROR LOAD MASTER:",
      error
    );

    alert(
      "Gagal mengambil master data proyek."
    );

  }

}


// ======================================================
// JENIS PROYEK
// ======================================================

jenisSelect.addEventListener(
  "change",
  () => {

    if (
      jenisSelect.value === "Reguler/SLA"
    ) {

      subJenisGroup.classList.remove(
        "hidden"
      );

    } else {

      subJenisGroup.classList.add(
        "hidden"
      );

      subJenisSelect.value = "";

    }

  }
);


// ======================================================
// PIC BERDASARKAN KATEGORI
// ======================================================

kategoriSelect.addEventListener(
  "change",
  async () => {

    const kategoriId =
      kategoriSelect.value;

    picContainer.innerHTML = "";


    if (!kategoriId) {

      picContainer.textContent =
        "Pilih kategori terlebih dahulu.";

      return;

    }


    try {

      const response =
        await fetch(
          `/api/proyek/kategori/${kategoriId}/pic`
        );

      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.error ||
          "Gagal mengambil PIC"
        );

      }


      if (data.length === 0) {

        picContainer.innerHTML = `
          <span style="color:#b45309">
            Belum ada PIC pada kategori ini.
          </span>
        `;

        return;

      }


      data.forEach(pic => {

        const item =
          document.createElement("label");

        item.className =
          "pic-item";

        item.innerHTML = `
          <input
            type="checkbox"
            name="pic"
            value="${pic.id}"
            checked
          >

          <span>
            <strong>${escapeHtml(pic.nama)}</strong>
            — ${escapeHtml(pic.jabatan)}
          </span>
        `;

        picContainer.appendChild(item);

      });


    } catch (error) {

      console.error(
        "ERROR LOAD PIC:",
        error
      );

      picContainer.innerHTML = `
        <span style="color:#dc2626">
          Gagal mengambil data PIC.
        </span>
      `;

    }

  }
);


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// ======================================================
// UPDATE NOMOR PARTNER
// ======================================================

function updatePartnerNumbers() {

  const cards =
    partnerContainer.querySelectorAll(
      ".partner-card"
    );

  cards.forEach((card, index) => {

    const title =
      card.querySelector(
        ".partner-title"
      );

    if (title) {

      title.textContent =
        `Partner ${index + 1}`;

    }

  });

}


// ======================================================
// CEK PARTNER DUPLIKAT
// ======================================================

function checkDuplicatePartner() {

  const selects =
    partnerContainer.querySelectorAll(
      ".partner_id"
    );

  const selectedValues = [];


  selects.forEach(select => {

    if (select.value) {

      selectedValues.push(
        select.value
      );

    }

  });


  const duplicates =
    selectedValues.filter(
      (value, index, array) =>
        array.indexOf(value) !== index
    );


  return duplicates.length > 0;

}


// ======================================================
// TAMBAH PARTNER
// ======================================================

function addPartner() {

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "partner-card";


  let options = `
    <option value="">
      Pilih Partner
    </option>
  `;


  masterPartner.forEach(item => {

    options += `
      <option value="${item.id}">
        ${escapeHtml(item.nama_partner)}
      </option>
    `;

  });


  wrapper.innerHTML = `

    <div class="partner-header">

      <h3 class="partner-title">
        Partner
      </h3>

      <button
        type="button"
        class="btn btn-danger removePartner"
      >
        Hapus Partner
      </button>

    </div>


    <div class="form-grid">


      <div class="form-group">

        <label>Partner *</label>

        <select
          class="partner_id"
          required
        >
          ${options}
        </select>

      </div>


      <div class="form-group">

        <label>Tanggal Mulai</label>

        <input
          type="date"
          class="partner_tanggal_mulai"
        >

      </div>


      <div class="form-group">

        <label>Tanggal Akhir</label>

        <input
          type="date"
          class="partner_tanggal_akhir"
        >

      </div>


      <div class="form-group">

        <label>Nilai Submit</label>

        <input
          type="number"
          min="0"
          class="partner_nilai_submit"
          placeholder="0"
        >

      </div>


      <div class="form-group">

        <label>Nego 1</label>

        <input
          type="number"
          min="0"
          class="partner_nego_1"
          placeholder="0"
        >

      </div>


      <div class="form-group">

        <label>Nego 2</label>

        <input
          type="number"
          min="0"
          class="partner_nego_2"
          placeholder="0"
        >

      </div>


      <div class="form-group">

        <label>Nego 3</label>

        <input
          type="number"
          min="0"
          class="partner_nego_3"
          placeholder="0"
        >

      </div>


      <div class="form-group">

        <label>Status Pengadaan</label>

        <select
          class="partner_status_pengadaan"
        >

          <option value="">
            Pilih Status
          </option>

          <option value="Pipeline">
            Pipeline
          </option>

          <option value="Submit Penawaran">
            Submit Penawaran
          </option>

          <option value="Submit Pengadaan">
            Submit Pengadaan
          </option>

          <option value="Kontrak">
            Kontrak
          </option>

          <option value="Aktif">
            Aktif
          </option>

        </select>

      </div>


      <div class="form-group">

        <label>Status Teknis</label>

        <select
          class="partner_status_teknis"
        >

          <option value="">
            Pilih Status
          </option>

          <option value="Gather Requirement">
            Gather Requirement
          </option>

          <option value="Development">
            Development
          </option>

          <option value="Testing">
            Testing
          </option>

          <option value="Done">
            Done
          </option>

          <option value="Bug Fixing">
            Bug Fixing
          </option>

        </select>

      </div>


    </div>

  `;


  // ================================
  // HAPUS PARTNER
  // ================================

  wrapper
    .querySelector(".removePartner")
    .addEventListener(
      "click",
      () => {

        wrapper.remove();

        updatePartnerNumbers();

      }
    );


  // ================================
  // VALIDASI DUPLIKAT SAAT DIPILIH
  // ================================

  const partnerSelect =
    wrapper.querySelector(
      ".partner_id"
    );


  partnerSelect.addEventListener(
    "change",
    () => {

      if (
        !partnerSelect.value
      ) {
        return;
      }


      const allSelects =
        Array.from(
          partnerContainer.querySelectorAll(
            ".partner_id"
          )
        );


      const samePartner =
        allSelects.filter(
          select =>
            select.value ===
            partnerSelect.value
        );


      if (
        samePartner.length > 1
      ) {

        alert(
          "Partner tersebut sudah dipilih. Pilih partner lain."
        );

        partnerSelect.value = "";

      }

    }
  );


  partnerContainer.appendChild(
    wrapper
  );


  updatePartnerNumbers();

}


// ======================================================
// BUTTON TAMBAH PARTNER
// ======================================================

addPartnerButton.addEventListener(
  "click",
  addPartner
);


// ======================================================
// HELPER NUMBER
// ======================================================

function numberOrNull(value) {

  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isNaN(number)
    ? null
    : number;

}


// ======================================================
// AMBIL DATA PARTNER
// ======================================================

function getPartners() {

  const result = [];

  const cards =
    document.querySelectorAll(
      ".partner-card"
    );


  cards.forEach(card => {

    const partnerId =
      card.querySelector(
        ".partner_id"
      ).value;


    if (!partnerId) {
      return;
    }


    result.push({

      partner_id:
        Number(partnerId),

      nilai_submit:
        numberOrNull(
          card.querySelector(
            ".partner_nilai_submit"
          ).value
        ) ?? 0,

      nilai_nego_1:
        numberOrNull(
          card.querySelector(
            ".partner_nego_1"
          ).value
        ),

      nilai_nego_2:
        numberOrNull(
          card.querySelector(
            ".partner_nego_2"
          ).value
        ),

      nilai_nego_3:
        numberOrNull(
          card.querySelector(
            ".partner_nego_3"
          ).value
        ),

      tanggal_mulai:
        card.querySelector(
          ".partner_tanggal_mulai"
        ).value || null,

      tanggal_akhir:
        card.querySelector(
          ".partner_tanggal_akhir"
        ).value || null,

      status_pengadaan:
        card.querySelector(
          ".partner_status_pengadaan"
        ).value || null,

      status_teknis:
        card.querySelector(
          ".partner_status_teknis"
        ).value || null

    });

  });


  return result;

}


// ======================================================
// VALIDASI PARTNER
// ======================================================

function validatePartners() {

  const cards =
    Array.from(
      partnerContainer.querySelectorAll(
        ".partner-card"
      )
    );


  for (
    let index = 0;
    index < cards.length;
    index++
  ) {

    const card =
      cards[index];

    const partnerId =
      card.querySelector(
        ".partner_id"
      ).value;


    if (!partnerId) {

      alert(
        `Partner ${index + 1} belum dipilih.`
      );

      card
        .querySelector(".partner_id")
        .focus();

      return false;

    }


    const tanggalMulai =
      card.querySelector(
        ".partner_tanggal_mulai"
      ).value;

    const tanggalAkhir =
      card.querySelector(
        ".partner_tanggal_akhir"
      ).value;


    if (
      tanggalMulai &&
      tanggalAkhir &&
      tanggalAkhir < tanggalMulai
    ) {

      alert(
        `Tanggal akhir Partner ${index + 1} tidak boleh sebelum tanggal mulai.`
      );

      card
        .querySelector(
          ".partner_tanggal_akhir"
        )
        .focus();

      return false;

    }

  }


  if (
    checkDuplicatePartner()
  ) {

    alert(
      "Terdapat partner yang dipilih lebih dari satu kali."
    );

    return false;

  }


  return true;

}


// ======================================================
// VALIDASI KLIEN
// ======================================================

function validateKlien() {

  const tanggalMulai =
    document.getElementById(
      "tanggal_mulai_klien"
    ).value;

  const tanggalAkhir =
    document.getElementById(
      "tanggal_akhir_klien"
    ).value;


  if (
    tanggalMulai &&
    tanggalAkhir &&
    tanggalAkhir < tanggalMulai
  ) {

    alert(
      "Tanggal akhir klien tidak boleh sebelum tanggal mulai."
    );

    document
      .getElementById(
        "tanggal_akhir_klien"
      )
      .focus();

    return false;

  }


  return true;

}


// ======================================================
// SIMPAN PROYEK
// ======================================================

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    // ================================
    // VALIDASI
    // ================================

    if (
      !kategoriSelect.value
    ) {

      alert(
        "Kategori proyek wajib dipilih."
      );

      kategoriSelect.focus();

      return;

    }


    if (
      !jenisSelect.value
    ) {

      alert(
        "Jenis proyek wajib dipilih."
      );

      jenisSelect.focus();

      return;

    }


    const namaProyek =
      document
        .getElementById(
          "nama_proyek"
        )
        .value
        .trim();


    if (!namaProyek) {

      alert(
        "Nama proyek wajib diisi."
      );

      document
        .getElementById(
          "nama_proyek"
        )
        .focus();

      return;

    }


    if (
      !validateKlien()
    ) {
      return;
    }


    if (
      !validatePartners()
    ) {
      return;
    }


    // ================================
    // PIC
    // ================================

    const picIds =
      Array.from(
        document.querySelectorAll(
          'input[name="pic"]:checked'
        )
      )
        .map(item =>
          Number(item.value)
        );


    // ================================
    // HELPER VALUE
    // ================================

    const valueOrNull = id => {

      const value =
        document
          .getElementById(id)
          .value;

      return numberOrNull(value);

    };


    // ================================
    // PAYLOAD
    // ================================

    const payload = {

      kategori_produk_id:
        Number(
          kategoriSelect.value
        ),

      jenis_proyek:
        jenisSelect.value,

      sub_jenis_proyek:
        subJenisSelect.value ||
        null,

      nama_proyek:
        namaProyek,

      deskripsi:
        document
          .getElementById(
            "deskripsi"
          )
          .value
          .trim() || null,

      status_final:
        document
          .getElementById(
            "status_final"
          )
          .value,

      pic_ids:
        picIds,


      // ==============================
      // KLIEN
      // ==============================

      klien_id:
        klienSelect.value
          ? Number(
              klienSelect.value
            )
          : null,

      nilai_submit_klien:
        valueOrNull(
          "nilai_submit_klien"
        ),

      nilai_nego_1_klien:
        valueOrNull(
          "nilai_nego_1_klien"
        ),

      nilai_nego_2_klien:
        valueOrNull(
          "nilai_nego_2_klien"
        ),

      nilai_nego_3_klien:
        valueOrNull(
          "nilai_nego_3_klien"
        ),

      tanggal_mulai_klien:
        document
          .getElementById(
            "tanggal_mulai_klien"
          )
          .value || null,

      tanggal_akhir_klien:
        document
          .getElementById(
            "tanggal_akhir_klien"
          )
          .value || null,

      status_pengadaan_klien:
        document
          .getElementById(
            "status_pengadaan_klien"
          )
          .value || null,

      status_teknis_klien:
        document
          .getElementById(
            "status_teknis_klien"
          )
          .value || null,


      // ==============================
      // MULTI PARTNER
      // ==============================

      partners:
        getPartners()

    };


    console.log(
      "PAYLOAD PROYEK:",
      payload
    );


    // ================================
    // SIMPAN KE SERVER
    // ================================

    try {

      saveButton.disabled =
        true;

      saveButton.textContent =
        "Menyimpan...";


      const response =
        await fetch(
          "/api/proyek",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                payload
              )
          }
        );


      const contentType =
        response.headers.get(
          "content-type"
        );


      if (
        !contentType ||
        !contentType.includes(
          "application/json"
        )
      ) {

        const text =
          await response.text();

        throw new Error(
          `Server bukan JSON (${response.status}): ${text}`
        );

      }


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Gagal menyimpan proyek"
        );

      }


      console.log(
        "HASIL SIMPAN:",
        result
      );


      alert(
        "Proyek berhasil disimpan."
      );


      window.location.href =
        "/proyek.html";


    } catch (error) {

      console.error(
        "ERROR SAVE PROYEK:",
        error
      );


      alert(
        "Gagal menyimpan proyek:\n" +
        error.message
      );


    } finally {

      saveButton.disabled =
        false;

      saveButton.textContent =
        "Simpan Proyek";

    }

  }
);


// ======================================================
// START
// ======================================================

loadMaster();