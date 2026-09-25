const $ = id =>
  document.getElementById(id);

function getInputValue(
  ...ids
) {
  for (const id of ids) {
    const element =
      document.getElementById(id);

    if (element) {
      return element.value;
    }
  }

  return "";
}

const form =
  $("proyekForm");

const kategoriSelect =
  $("kategori_produk_id");

const kategoriTerpilih =
  $("kategoriTerpilih");

const jenisSelect =
  $("jenis_proyek");

const subJenisSelect =
  $("sub_jenis_proyek");

const subJenisGroup =
  $("subJenisGroup");

const klienSelect =
  $("klien_id");

const picContainer =
  $("picContainer");

const partnerContainer =
  $("partnerContainer");

const saveButton =
  $("saveButton");


let masterPartner = [];

let selectedKategori =
  new Map();

let statusOptions = {
  pengadaan: [],
  teknis: [],
  administrasi: [],
  final: []
};


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// =====================================================
// FETCH JSON
// =====================================================

async function getJson(url) {

  const response =
    await fetch(url);

  const data =
    await response
      .json()
      .catch(() => ({}));


  if (!response.ok) {

    throw new Error(
      data.error ||
      `Gagal mengambil ${url}`
    );

  }


  return data;

}


// =====================================================
// ISI DROPDOWN
// =====================================================

function fillSelect(
  select,
  rows,
  valueKey,
  labelKey,
  placeholder
) {

  select.innerHTML = `
    <option value="">
      ${escapeHtml(placeholder)}
    </option>
  `;


  rows.forEach(row => {

    const option =
      document.createElement(
        "option"
      );


    option.value =
      row[valueKey];

    option.textContent =
      row[labelKey];


    if (row.id != null) {

      option.dataset.id =
        row.id;

    }


    select.appendChild(
      option
    );

  });

}


// =====================================================
// OPTION STATUS
// =====================================================

function statusHtml(flag) {

  return `
    <option value="">
      Pilih Status
    </option>
  ` +

  statusOptions[flag]
    .map(row => `

      <option
        value="${escapeHtml(row.deskripsi)}"
        data-id="${row.id}"
      >
        ${escapeHtml(row.deskripsi)}
      </option>

    `)
    .join("");

}


// =====================================================
// LOAD MASTER DATA
// =====================================================

async function loadMaster() {

  try {

    const [
      kategori,
      jenis,
      klien,
      partner,
      statuses
    ] = await Promise.all([

      getJson(
        "/api/proyek/kategori"
      ),

      getJson(
        "/api/proyek/jenis"
      ),

      getJson(
        "/api/proyek/klien"
      ),

      getJson(
        "/api/proyek/partner"
      ),

      getJson(
        "/api/proyek/status"
      )

    ]);


    // ===============================================
    // KATEGORI AKTIF
    // ===============================================

    fillSelect(
      kategoriSelect,
      kategori,
      "id",
      "nama_kategori_produk",
      "Pilih Kategori"
    );


    // ===============================================
    // JENIS PROYEK AKTIF
    // ===============================================

    fillSelect(
      jenisSelect,
      jenis,
      "id",
      "name",
      "Pilih Jenis"
    );


    // ===============================================
    // KLIEN
    // ===============================================

    fillSelect(
      klienSelect,
      klien,
      "id",
      "perusahaan_klien",
      "Pilih Klien"
    );


    // ===============================================
    // PARTNER
    // ===============================================

    masterPartner =
      partner;


    // ===============================================
    // KELOMPOKKAN STATUS BERDASARKAN FLAG
    // ===============================================

    Object
      .keys(statusOptions)
      .forEach(flag => {

        statusOptions[flag] =
          statuses.filter(row =>

            String(
              row.flag
            ).toLowerCase() === flag

          );

      });


    $("status_pengadaan_klien")
      .innerHTML =
        statusHtml(
          "pengadaan"
        );


    $("status_teknis_klien")
      .innerHTML =
        statusHtml(
          "teknis"
        );


    $("status_administrasi_klien")
      .innerHTML =
        statusHtml(
          "administrasi"
        );


    $("status_final")
      .innerHTML =
        statusHtml("final")
          .replace(
            "Pilih Status",
            "Pilih Status Final"
          );


  } catch (error) {

    console.error(
      "ERROR LOAD MASTER:",
      error
    );


    alert(
      "Gagal mengambil master data proyek:\n" +
      error.message
    );

  }

}


// =====================================================
// TAMBAH KATEGORI
// =====================================================

$("tambahKategori")
  .addEventListener(
    "click",
    async () => {

      const option =
        kategoriSelect
          .selectedOptions[0];


      if (!option?.value) {

        alert(
          "Pilih kategori terlebih dahulu."
        );

        return;

      }


      selectedKategori.set(

        String(option.value),

        option
          .textContent
          .trim()

      );


      kategoriSelect.value =
        "";


      renderKategori();

      await loadPic();

    }
  );


// =====================================================
// TAMPILKAN KATEGORI TERPILIH
// =====================================================

function renderKategori() {

  kategoriTerpilih.innerHTML =
    "";


  selectedKategori.forEach(
    (label, id) => {

      const chip =
        document.createElement(
          "span"
        );


      chip.className =
        "category-chip";


      chip.innerHTML = `

        ${escapeHtml(label)}

        <button
          type="button"
          aria-label="Hapus kategori"
        >
          &times;
        </button>

      `;


      chip
        .querySelector("button")
        .addEventListener(
          "click",
          async () => {

            selectedKategori.delete(
              id
            );

            renderKategori();

            await loadPic();

          }
        );


      kategoriTerpilih
        .appendChild(chip);

    }
  );

}


// =====================================================
// LOAD PIC BERDASARKAN KATEGORI
// =====================================================

async function loadPic() {

  picContainer.innerHTML =
    "";


  if (!selectedKategori.size) {

    picContainer.textContent =
      "Pilih kategori terlebih dahulu.";

    return;

  }


  try {

    const groups =
      await Promise.all(

        [
          ...selectedKategori.keys()
        ].map(id =>

          getJson(
            `/api/proyek/kategori/${id}/pic`
          )

        )

      );


    const unique =
      new Map(

        groups
          .flat()
          .map(pic => [

            String(pic.id),

            pic

          ])

      );


    if (!unique.size) {

      picContainer.textContent =
        "Belum ada PIC pada kategori yang dipilih.";

      return;

    }


    unique.forEach(pic => {

      const label =
        document.createElement(
          "label"
        );


      label.className =
        "pic-item";


      label.innerHTML = `

        <input
          type="checkbox"
          name="pic_ids"
          value="${pic.id}"
        >

        <span>

          ${escapeHtml(pic.nama)}

          ${
            pic.jabatan
              ? ` - ${escapeHtml(pic.jabatan)}`
              : ""
          }

        </span>

      `;


      picContainer.appendChild(
        label
      );

    });


  } catch (error) {

    picContainer.textContent =
      "Gagal mengambil PIC.";


    console.error(
      "ERROR LOAD PIC:",
      error
    );

  }

}


// =====================================================
// SUB JENIS BERDASARKAN JENIS
// =====================================================

jenisSelect.addEventListener(
  "change",
  async () => {

    subJenisSelect.innerHTML = `
      <option value="">
        Pilih Sub Jenis
      </option>
    `;


    subJenisGroup.classList.add(
      "hidden"
    );


    if (!jenisSelect.value) {

      return;

    }


    try {

      const rows =
        await getJson(

          "/api/proyek/sub-jenis" +
          `?jenis_id=${encodeURIComponent(
            jenisSelect.value
          )}`

        );


      if (rows.length) {

        fillSelect(

          subJenisSelect,

          rows,

          "id",

          "name",

          "Pilih Sub Jenis"

        );


        subJenisGroup
          .classList
          .remove(
            "hidden"
          );

      }


    } catch (error) {

      console.error(
        "ERROR LOAD SUB JENIS:",
        error
      );


      alert(
        error.message
      );

    }

  }
);


// =====================================================
// TAMBAH NEGO KLIEN
// =====================================================

let negoKlienTerlihat =
  0;


$("tambahNegoKlien")
  .addEventListener(
    "click",
    () => {

      if (
        negoKlienTerlihat >= 3
      ) {

        return;

      }


      negoKlienTerlihat +=
        1;


      const field =
        document.querySelector(

          `.nego-klien-field[data-nego-index="${negoKlienTerlihat}"]`

        );


      if (field) {

        field.classList.remove(
          "hidden"
        );

      }


      if (
        negoKlienTerlihat === 3
      ) {

        $("tambahNegoKlien")
          .disabled =
            true;

      }

    }
  );


// =====================================================
// HITUNG DURASI BULAN DAN HARI
// =====================================================

function calculateDuration(
  startValue,
  endValue
) {

  if (
    !startValue ||
    !endValue
  ) {

    return {
      months: null,
      days: null
    };

  }


  const start =
    new Date(
      `${startValue}T00:00:00`
    );


  const end =
    new Date(
      `${endValue}T00:00:00`
    );


  if (end < start) {

    return {
      months: null,
      days: null
    };

  }


  let months =

    (
      end.getFullYear() -
      start.getFullYear()
    ) * 12 +

    end.getMonth() -

    start.getMonth();


  const anchor =
    new Date(start);


  anchor.setMonth(

    anchor.getMonth() +
    months

  );


  if (anchor > end) {

    months -= 1;


    anchor.setTime(
      start.getTime()
    );


    anchor.setMonth(

      anchor.getMonth() +
      months

    );

  }


  const days =
    Math.round(

      (
        end -
        anchor
      ) /

      86400000

    );


  return {
    months,
    days
  };

}


// =====================================================
// DURASI KLIEN
// =====================================================

function updateClientDuration() {

  const duration =
    calculateDuration(

      $("tanggal_mulai_klien")
        .value,

      $("tanggal_akhir_klien")
        .value

    );


  $("jumlah_bulan_klien")
    .value =
      duration.months ?? "";


  $("jumlah_hari_klien")
    .value =
      duration.days ?? "";

}


$("tanggal_mulai_klien")
  .addEventListener(
    "change",
    updateClientDuration
  );


$("tanggal_akhir_klien")
  .addEventListener(
    "change",
    updateClientDuration
  );


// =====================================================
// OPTION PARTNER
// =====================================================

function partnerOptions() {

  return `

    <option value="">
      Pilih Partner
    </option>

  ` +

  masterPartner
    .map(row => `

      <option value="${row.id}">
        ${escapeHtml(row.nama_partner)}
      </option>

    `)
    .join("");

}


// =====================================================
// UPDATE NOMOR PARTNER
// =====================================================

function updatePartnerNumbers() {
  if (!partnerContainer) {
    return;
  }

  const partnerCards = [
    ...partnerContainer.querySelectorAll(
      ".partner-card"
    )
  ];

  partnerCards.forEach(
    (card, index) => {
      const title =
        card.querySelector(
          ".partner-title"
        );

      if (title) {
        title.textContent =
          `Partner ${index + 1}`;
      }

      card.dataset.partnerIndex =
        String(index);
    }
  );
}

// =====================================================
// TAMBAH PARTNER
// =====================================================

function addPartner() {

  const card =
    document.createElement(
      "div"
    );


  card.className =
    "partner-card";


  // Menyimpan jumlah kolom nego
  // yang sudah ditampilkan.
  card.dataset.negoTerlihat =
    "0";


  card.innerHTML = `

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


      <!-- PARTNER -->

      <div class="form-group">

        <label>
          Partner *
        </label>

        <select
          class="partner_id"
          required
        >
          ${partnerOptions()}
        </select>

      </div>


      <!-- TANGGAL MULAI -->

      <div class="form-group">

        <label>
          Tanggal Mulai
        </label>

        <input
          type="date"
          class="partner_tanggal_mulai"
        >

      </div>


      <!-- TANGGAL AKHIR -->

      <div class="form-group">

        <label>
          Tanggal Akhir
        </label>

        <input
          type="date"
          class="partner_tanggal_akhir"
        >

      </div>


      <!-- MODEL PEMBAYARAN -->

      <div class="form-group">

        <label>
          Model Pembayaran
        </label>

        <select class="partner_model_pembayaran">

          <option value="">
            Pilih Model Pembayaran
          </option>

          <option value="Tahunan">
            Tahunan
          </option>

          <option value="Bulanan">
            Bulanan
          </option>

          <option value="Termin">
            Termin
          </option>

          <option value="One Time Charge">
            One Time Charge
          </option>

        </select>

      </div>


      <!-- DURASI BULAN -->

      <div class="form-group">

        <label>
          Durasi Bulan
        </label>

        <input
          type="number"
          class="partner_jumlah_bulan"
          readonly
          placeholder="Otomatis"
        >

      </div>


      <!-- SISA HARI -->

      <div class="form-group">

        <label>
          Sisa Hari
        </label>

        <input
          type="number"
          class="partner_jumlah_hari"
          readonly
          placeholder="Otomatis"
        >

      </div>


      <!-- NILAI SUBMIT -->

      <div class="form-group">

        <label>
          Nilai Submit (Rp)
        </label>

        <input
          type="number"
          min="0"
          step="1"
          class="partner_nilai_submit"
          placeholder="0"
        >

      </div>


      <!-- TOMBOL TAMBAH NEGO -->

      <div class="form-group">

        <label>
          Negosiasi
        </label>

        <button
          type="button"
          class="btn btn-secondary tambahNegoPartner"
        >
          + Tambah Nego
        </button>

      </div>


      <!--
        Spacer supaya susunan grid tetap rapi
        karena menggunakan tiga kolom.
      -->

      <div
        class="form-group partner-nego-spacer"
        aria-hidden="true"
      ></div>


      <!-- NEGO 1 -->

      <div
        class="
          form-group
          hidden
          partner-nego-field
        "
        data-nego-index="1"
      >

        <label>
          Nego 1 (Rp)
        </label>

        <input
          type="number"
          min="0"
          step="1"
          class="partner_nego_1"
          placeholder="0"
        >

      </div>


      <!-- NEGO 2 -->

      <div
        class="
          form-group
          hidden
          partner-nego-field
        "
        data-nego-index="2"
      >

        <label>
          Nego 2 (Rp)
        </label>

        <input
          type="number"
          min="0"
          step="1"
          class="partner_nego_2"
          placeholder="0"
        >

      </div>


      <!-- NEGO 3 -->

      <div
        class="
          form-group
          hidden
          partner-nego-field
        "
        data-nego-index="3"
      >

        <label>
          Nego 3 (Rp)
        </label>

        <input
          type="number"
          min="0"
          step="1"
          class="partner_nego_3"
          placeholder="0"
        >

      </div>


      <!-- STATUS PENGADAAN -->

      <div class="form-group">

        <label>
          Status Pengadaan
        </label>

        <select
          class="partner_status_pengadaan"
        >
          ${statusHtml("pengadaan")}
        </select>

      </div>


      <!-- STATUS TEKNIS -->

      <div class="form-group">

        <label>
          Status Teknis
        </label>

        <select
          class="partner_status_teknis"
        >
          ${statusHtml("teknis")}
        </select>

      </div>


      <!-- STATUS ADMINISTRASI -->

      <div class="form-group">

        <label>
          Status Administrasi
        </label>

        <select
          class="partner_status_administrasi"
        >
          ${statusHtml("administrasi")}
        </select>

      </div>


    </div>

  `;


  // ===================================================
  // MASUKKAN CARD KE CONTAINER
  // ===================================================

  partnerContainer.appendChild(
    card
  );


  // ===================================================
  // ELEMENT DALAM CARD PARTNER
  // ===================================================

  const partnerSelect =
    card.querySelector(
      ".partner_id"
    );


  const tanggalMulai =
    card.querySelector(
      ".partner_tanggal_mulai"
    );


  const tanggalAkhir =
    card.querySelector(
      ".partner_tanggal_akhir"
    );


  const jumlahBulan =
    card.querySelector(
      ".partner_jumlah_bulan"
    );


  const jumlahHari =
    card.querySelector(
      ".partner_jumlah_hari"
    );


  const tambahNegoButton =
    card.querySelector(
      ".tambahNegoPartner"
    );


  const removeButton =
    card.querySelector(
      ".removePartner"
    );


  // ===================================================
  // HITUNG DURASI PARTNER
  // ===================================================

  const updateDuration =
    () => {

      const duration =
        calculateDuration(
          tanggalMulai.value,
          tanggalAkhir.value
        );


      jumlahBulan.value =
        duration.months ?? "";


      jumlahHari.value =
        duration.days ?? "";

    };


  tanggalMulai.addEventListener(
    "change",
    updateDuration
  );


  tanggalAkhir.addEventListener(
    "change",
    updateDuration
  );


  // ===================================================
  // TAMBAH NEGO PARTNER
  // ===================================================

  tambahNegoButton.addEventListener(
    "click",
    () => {

      let negoTerlihat =
        Number(
          card.dataset.negoTerlihat ||
          0
        );


      if (
        negoTerlihat >= 3
      ) {

        return;

      }


      negoTerlihat +=
        1;


      const negoField =
        card.querySelector(

          `.partner-nego-field[data-nego-index="${negoTerlihat}"]`

        );


      if (negoField) {

        negoField.classList.remove(
          "hidden"
        );


        const negoInput =
          negoField.querySelector(
            "input"
          );


        if (negoInput) {

          negoInput.focus();

        }

      }


      card.dataset.negoTerlihat =
        String(
          negoTerlihat
        );


      // Setelah Nego 3 muncul,
      // tombol dinonaktifkan.
      if (
        negoTerlihat >= 3
      ) {

        tambahNegoButton.disabled =
          true;


        tambahNegoButton.textContent =
          "Maksimal 3 Nego";

      }

    }
  );


  // ===================================================
  // CEK PARTNER DUPLIKAT SAAT DIPILIH
  // ===================================================

  partnerSelect.addEventListener(
    "change",
    () => {

      if (!partnerSelect.value) {
        return;
      }


      const pilihanPartner =
        [

          ...partnerContainer.querySelectorAll(
            ".partner_id"
          )

        ].filter(
          select =>
            select.value ===
            partnerSelect.value
        );


      if (
        pilihanPartner.length > 1
      ) {

        alert(
          "Partner tersebut sudah dipilih. Pilih partner lain."
        );


        partnerSelect.value =
          "";

      }

    }
  );


  // ===================================================
  // HAPUS PARTNER
  // ===================================================

  removeButton.addEventListener(
    "click",
    () => {

      card.remove();

      updatePartnerNumbers();

    }
  );


  // ===================================================
  // PERBARUI NOMOR PARTNER
  // ===================================================

  updatePartnerNumbers();

}


$("addPartnerButton")
  .addEventListener(
    "click",
    addPartner
  );


// =====================================================
// KONVERSI ANGKA
// =====================================================

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


// =====================================================
// AMBIL DATA PARTNER
// =====================================================

function getPartners() {

  return [

    ...document.querySelectorAll(
      ".partner-card"
    )

  ]

    .filter(card =>

      card.querySelector(
        ".partner_id"
      ).value

    )

    .map(card => ({

      partner_id:
        Number(

          card.querySelector(
            ".partner_id"
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

      model_pembayaran:

        card.querySelector(
          ".partner_model_pembayaran"
        ).value || null,

      jumlah_bulan:

        numberOrNull(

          card.querySelector(
            ".partner_jumlah_bulan"
          ).value

        ),

      jumlah_hari:

        numberOrNull(

          card.querySelector(
            ".partner_jumlah_hari"
          ).value

        ),

      nilai_submit:

  nominalOrNull(

    card.querySelector(
      ".partner_nilai_submit"
    )?.value

  ) ?? 0,


nilai_nego_1:

  nominalOrNull(

    card.querySelector(
      ".partner_nego_1"
    )?.value

  ),


nilai_nego_2:

  nominalOrNull(

    card.querySelector(
      ".partner_nego_2"
    )?.value

  ),


nilai_nego_3:

  nominalOrNull(

    card.querySelector(
      ".partner_nego_3"
    )?.value

  ),

      status_pengadaan:

        card.querySelector(
          ".partner_status_pengadaan"
        ).value || null,

      status_teknis:

        card.querySelector(
          ".partner_status_teknis"
        ).value || null,

      status_administrasi:

        card.querySelector(
          ".partner_status_administrasi"
        ).value || null

    }));

}


// =====================================================
// VALIDASI TANGGAL
// =====================================================

function validateDates(
  label,
  start,
  end
) {

  if (
    start &&
    end &&
    end < start
  ) {

    alert(
      `Tanggal akhir ${label} tidak boleh sebelum tanggal mulai.`
    );

    return false;

  }


  return true;

}

// ======================================================
// FORMAT NOMINAL RUPIAH
// Berlaku untuk klien dan partner
// ======================================================

function ambilAngkaNominal(value) {
  return String(value ?? "")
    .replace(/[^\d]/g, "");
}


function formatNominalRupiah(value) {
  const angka =
    ambilAngkaNominal(value);

  if (!angka) {
    return "";
  }

  return new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits: 0
    }
  ).format(
    Number(angka)
  );
}


function parseNominalRupiah(value) {
  const angka =
    ambilAngkaNominal(value);

  if (!angka) {
    return 0;
  }

  const hasil =
    Number(angka);

  return Number.isFinite(hasil)
    ? hasil
    : 0;
}

function nominalOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const angka =
    parseNominalRupiah(value);

  return Number.isFinite(angka)
    ? angka
    : null;
}

// ======================================================
// DETEKSI INPUT NOMINAL
// ======================================================

function adalahInputNominal(element) {
  if (
    !element ||
    element.tagName !== "INPUT"
  ) {
    return false;
  }

  const identitas = [
    element.id,
    element.name,
    element.className,
    element.dataset?.field
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replaceAll("-", "_");


  return (
    element.classList.contains(
      "input-rupiah"
    ) ||
    identitas.includes(
      "nilai_submit"
    ) ||
    identitas.includes(
      "nilaisubmit"
    ) ||
    identitas.includes(
      "nilai_nego"
    ) ||
    identitas.includes(
      "nilainego"
    ) ||
    identitas.includes(
      "nego_1"
    ) ||
    identitas.includes(
      "nego_2"
    ) ||
    identitas.includes(
      "nego_3"
    ) ||
    identitas.includes(
      "nego1"
    ) ||
    identitas.includes(
      "nego2"
    ) ||
    identitas.includes(
      "nego3"
    )
  );
}


// ======================================================
// SIAPKAN SATU INPUT
// ======================================================

function siapkanInputNominal(input) {
  if (
    !adalahInputNominal(input)
  ) {
    return;
  }

  /*
    Input number tidak bisa menampilkan tanda titik.
    Karena itu otomatis diubah menjadi text.
  */

  input.type =
    "text";

  input.inputMode =
    "numeric";

  input.autocomplete =
    "off";

  input.classList.add(
    "input-rupiah"
  );

  if (input.value) {
    input.value =
      formatNominalRupiah(
        input.value
      );
  }
}


// ======================================================
// SIAPKAN SEMUA INPUT YANG SUDAH ADA
// ======================================================

function siapkanSemuaInputNominal(
  root = document
) {
  const inputs =
    root.querySelectorAll
      ? root.querySelectorAll("input")
      : [];

  inputs.forEach(
    siapkanInputNominal
  );
}


// ======================================================
// FORMAT SAAT DIKETIK
// ======================================================

document.addEventListener(
  "input",
  event => {
    const input =
      event.target;

    if (
      !adalahInputNominal(input)
    ) {
      return;
    }

    /*
      Pastikan tetap text agar separator titik
      tidak dihapus browser.
    */

    input.type =
      "text";

    input.inputMode =
      "numeric";

    input.value =
      formatNominalRupiah(
        input.value
      );

    /*
      Cursor ditempatkan kembali di akhir.
    */

    const posisiAkhir =
      input.value.length;

    input.setSelectionRange(
      posisiAkhir,
      posisiAkhir
    );
  }
);


// ======================================================
// FORMAT SAAT INPUT MENDAPAT FOKUS
// ======================================================

document.addEventListener(
  "focusin",
  event => {
    const input =
      event.target;

    if (
      !adalahInputNominal(input)
    ) {
      return;
    }

    siapkanInputNominal(
      input
    );
  }
);


// ======================================================
// DETEKSI INPUT NEGO/PARTNER YANG DIBUAT DINAMIS
// ======================================================

const nominalObserver =
  new MutationObserver(
    mutations => {
      mutations.forEach(
        mutation => {
          mutation.addedNodes.forEach(
            node => {
              if (
                node.nodeType !==
                Node.ELEMENT_NODE
              ) {
                return;
              }

              if (
                node.matches?.("input")
              ) {
                siapkanInputNominal(
                  node
                );
              }

              siapkanSemuaInputNominal(
                node
              );
            }
          );
        }
      );
    }
  );


nominalObserver.observe(
  document.body,
  {
    childList: true,
    subtree: true
  }
);


// ======================================================
// JALANKAN SAAT HALAMAN DIMUAT
// ======================================================

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      siapkanSemuaInputNominal();
    }
  );

} else {
  siapkanSemuaInputNominal();
}

// =====================================================
// SIMPAN PROYEK
// =====================================================

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    // ===============================================
    // VALIDASI KATEGORI
    // ===============================================

    if (!selectedKategori.size) {

      alert(
        "Kategori proyek wajib dipilih lalu klik + Tambah."
      );

      return;

    }


    // ===============================================
    // VALIDASI JENIS
    // ===============================================

    if (!jenisSelect.value) {

      alert(
        "Jenis proyek wajib dipilih."
      );

      jenisSelect.focus();

      return;

    }


    // ===============================================
    // VALIDASI NAMA PROYEK
    // ===============================================

    const namaProyek =
      $("nama_proyek")
        .value
        .trim();


    if (!namaProyek) {

      alert(
        "Nama proyek wajib diisi."
      );

      $("nama_proyek").focus();

      return;

    }


    // ===============================================
    // VALIDASI TANGGAL KLIEN
    // ===============================================

    if (
      !validateDates(

        "klien",

        $("tanggal_mulai_klien")
          .value,

        $("tanggal_akhir_klien")
          .value

      )
    ) {

      return;

    }


    // ===============================================
    // VALIDASI PARTNER
    // ===============================================

    const partnerCards = [

      ...document.querySelectorAll(
        ".partner-card"
      )

    ];


    for (
      let index = 0;
      index < partnerCards.length;
      index++
    ) {

      const card =
        partnerCards[index];


      const partnerId =
        card.querySelector(
          ".partner_id"
        ).value;


      if (!partnerId) {

        alert(
          `Partner ${index + 1} belum dipilih.`
        );

        return;

      }


      const validDate =
        validateDates(

          `Partner ${index + 1}`,

          card.querySelector(
            ".partner_tanggal_mulai"
          ).value,

          card.querySelector(
            ".partner_tanggal_akhir"
          ).value

        );


      if (!validDate) {

        return;

      }

    }


    // ===============================================
    // CEK PARTNER DUPLIKAT
    // ===============================================

    const partnerIds =
      [

        ...document.querySelectorAll(
          ".partner_id"
        )

      ]

        .map(item =>
          item.value
        )

        .filter(Boolean);


    if (
      new Set(partnerIds).size !==
      partnerIds.length
    ) {

      alert(
        "Partner tidak boleh dipilih lebih dari satu kali."
      );

      return;

    }


    // ===============================================
    // DATA STATUS YANG DIPILIH
    // ===============================================

    const statusFinalOption =
      $("status_final")
        .selectedOptions[0];


    // ===============================================
    // PAYLOAD
    // ===============================================

    const payload = {

      kategori_produk_ids:

        [
          ...selectedKategori.keys()
        ].map(Number),


      jenis_proyek:

        jenisSelect
          .selectedOptions[0]
          ?.textContent
          ?.trim() || null,


      jenis_proyek_id:

        numberOrNull(
          jenisSelect.value
        ),


      sub_jenis_proyek:

        subJenisSelect.value

          ? subJenisSelect
              .selectedOptions[0]
              ?.textContent
              ?.trim()

          : null,


      sub_jenis_proyek_id:

        numberOrNull(
          subJenisSelect.value
        ),


      nama_proyek:

        namaProyek,


      deskripsi:

        $("deskripsi")
          .value
          .trim() || null,


      status_final:

        $("status_final")
          .value || null,


      status_final_id:

        numberOrNull(
          statusFinalOption
            ?.dataset
            ?.id
        ),


      pic_ids:

        [

          ...document.querySelectorAll(
            'input[name="pic_ids"]:checked'
          )

        ].map(item =>
          Number(item.value)
        ),


      // =============================================
      // KLIEN
      // =============================================

      klien_id:

        numberOrNull(
          klienSelect.value
        ),


// =============================================
// NILAI KLIEN
// =============================================

nilai_submit_klien:
  nominalOrNull(
    getInputValue(
      "nilaiSubmitKlien",
      "nilai_submit_klien"
    )
  ) ?? 0,


nilai_nego_1_klien:
  nominalOrNull(
    getInputValue(
      "nilaiNego1Klien",
      "nilai_nego_1_klien"
    )
  ),


nilai_nego_2_klien:
  nominalOrNull(
    getInputValue(
      "nilaiNego2Klien",
      "nilai_nego_2_klien"
    )
  ),


nilai_nego_3_klien:
  nominalOrNull(
    getInputValue(
      "nilaiNego3Klien",
      "nilai_nego_3_klien"
    )
  ),


      tanggal_mulai_klien:

        $("tanggal_mulai_klien")
          .value || null,


      tanggal_akhir_klien:

        $("tanggal_akhir_klien")
          .value || null,


      model_pembayaran_klien:

        $("model_pembayaran_klien")
          .value || null,


      jumlah_bulan_klien:

        numberOrNull(
          $("jumlah_bulan_klien")
            .value
        ),


      jumlah_hari_klien:

        numberOrNull(
          $("jumlah_hari_klien")
            .value
        ),


      status_pengadaan_klien:

        $("status_pengadaan_klien")
          .value || null,


      status_teknis_klien:

        $("status_teknis_klien")
          .value || null,


      status_administrasi_klien:

        $("status_administrasi_klien")
          .value || null,


      // =============================================
      // PARTNER
      // =============================================

      partners:

        getPartners()

    };


    console.log(
      "PAYLOAD PROYEK:",
      payload
    );


    // ===============================================
    // KIRIM KE SERVER
    // ===============================================

    try {

      saveButton.disabled =
        true;


      saveButton.textContent =
        "Menyimpan...";

console.log(
  "CEK NILAI KLIEN:",
  {
    input_asli:
      getInputValue(
        "nilaiSubmitKlien",
        "nilai_submit_klien"
      ),

    nilai_submit_klien:
      payload.nilai_submit_klien,

    nilai_nego_1_klien:
      payload.nilai_nego_1_klien,

    nilai_nego_2_klien:
      payload.nilai_nego_2_klien,

    nilai_nego_3_klien:
      payload.nilai_nego_3_klien
  }
);

      const response =
        await fetch(

          "/api/proyek",

          {

            method:
              "POST",

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


      const result =
        await response
          .json()
          .catch(() => ({}));


      if (!response.ok) {

        throw new Error(

          result.error ||
          "Gagal menyimpan proyek"

        );

      }


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



// =====================================================
// MULAI LOAD DATA
// =====================================================

loadMaster();