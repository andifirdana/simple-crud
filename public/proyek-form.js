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
let picLogin = null;

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
      statuses,
      picSayaResult
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
      ),

      getJson(
        "/api/proyek/pic-saya"
      )
    ]);

    // ===============================================
    // SIMPAN PIC PENGGUNA LOGIN
    // ===============================================

    picLogin =
      picSayaResult?.pic ||
      null;

    console.log(
      "PIC PENGGUNA LOGIN:",
      picLogin
    );

    // ===============================================
    // KATEGORI
    // ===============================================

    fillSelect(
      kategoriSelect,
      kategori,
      "id",
      "nama_kategori_produk",
      "Pilih Kategori"
    );

    // ===============================================
    // JENIS PROYEK
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
      Array.isArray(partner)
        ? partner
        : [];

    // ===============================================
    // STATUS
    // ===============================================

    Object
      .keys(statusOptions)
      .forEach(flag => {
        statusOptions[flag] =
          statuses.filter(
            row =>
              String(
                row.flag || ""
              ).toLowerCase() ===
              flag
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

async function tambahKategoriDariSelect() {
  const option = kategoriSelect.selectedOptions[0];

  if (!option?.value) {
    alert(
      "Ketik nama kategori lalu klik hasil pencarian."
    );
    return;
  }

  const id = String(option.value);
  const label = option.textContent.trim();

  if (selectedKategori.has(id)) {
    kategoriSelect.value = "";
    return;
  }

  selectedKategori.set(id, label);

  kategoriSelect.value = "";

  renderKategori();

  await loadPic();
}

$("tambahKategori").addEventListener(
  "click",
  tambahKategoriDariSelect
);

// =====================================================
// PENCARIAN KATEGORI
// =====================================================

function initPencarianKategori() {
  if (
    !kategoriSelect ||
    document.getElementById("kategoriSearchInput")
  ) {
    return;
  }

  // ===================================================
  // BUAT INPUT DAN DAFTAR HASIL
  // ===================================================

  const wrapper = document.createElement("div");

  wrapper.className = "kategori-search";

  const input = document.createElement("input");

  input.id = "kategoriSearchInput";
  input.type = "text";
  input.className = "kategori-search-input";
  input.placeholder = "Ketik nama kategori...";
  input.autocomplete = "off";
  input.disabled = kategoriSelect.disabled;

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-label", "Cari kategori produk");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  const list = document.createElement("div");

  list.id = "kategoriSearchList";
  list.className = "kategori-search-list";
  list.hidden = true;

  list.setAttribute("role", "listbox");

  input.setAttribute("aria-controls", list.id);

  const labels = Array.from(
    kategoriSelect.labels || []
  );

  kategoriSelect.before(wrapper);

  wrapper.append(
    input,
    list,
    kategoriSelect
  );

  // Select lama tetap digunakan untuk menyimpan ID.
  kategoriSelect.hidden = true;
  kategoriSelect.style.display = "none";

  // Validasi kategori memakai selectedKategori.
  kategoriSelect.required = false;

  for (const label of labels) {
    if (label.htmlFor === kategoriSelect.id) {
      label.htmlFor = input.id;
    }
  }

  // Klik hasil langsung menambahkan kategori.
  const tambahButton = $("tambahKategori");

  tambahButton.hidden = true;
  tambahButton.style.display = "none";

  let buttons = [];
  let active = -1;
  let busy = false;

  // ===================================================
  // TUTUP HASIL PENCARIAN
  // ===================================================

  function close() {
    list.hidden = true;

    input.setAttribute(
      "aria-expanded",
      "false"
    );

    input.removeAttribute(
      "aria-activedescendant"
    );

    active = -1;
  }

  // ===================================================
  // PILIH KATEGORI
  // ===================================================

  async function choose(option) {
    if (
      busy ||
      selectedKategori.has(String(option.value))
    ) {
      return;
    }

    busy = true;
    input.disabled = true;

    kategoriSelect.value = option.value;

    close();

    try {
      await tambahKategoriDariSelect();

      input.value = "";

    } catch (error) {
      console.error(
        "ERROR TAMBAH KATEGORI:",
        error
      );

      alert(
        error.message ||
        "Gagal menambahkan kategori."
      );

    } finally {
      busy = false;

      input.disabled = kategoriSelect.disabled;

      if (!input.disabled) {
        input.focus();
      }
    }
  }

  // ===================================================
  // TAMPILKAN HASIL PENCARIAN
  // ===================================================

  function render() {
    list.replaceChildren();

    buttons = [];
    active = -1;

    input.removeAttribute(
      "aria-activedescendant"
    );

    const query = input.value
      .trim()
      .toLocaleLowerCase("id-ID");

    if (
      !query ||
      busy ||
      input.disabled
    ) {
      close();
      return;
    }

    const matches = Array.from(
      kategoriSelect.options
    ).filter(option => {
      return (
        option.value &&
        !option.disabled &&
        !option.parentElement?.disabled &&
        !selectedKategori.has(
          String(option.value)
        ) &&
        option.textContent
          .trim()
          .toLocaleLowerCase("id-ID")
          .includes(query)
      );
    });

    matches
      .slice(0, 50)
      .forEach((option, index) => {
        const button =
          document.createElement("button");

        button.type = "button";
        button.tabIndex = -1;

        button.id =
          `kategoriSearchOption-${index}`;

        button.className =
          "kategori-search-item";

        button.textContent =
          option.textContent.trim();

        button.setAttribute(
          "role",
          "option"
        );

        button.setAttribute(
          "aria-selected",
          "false"
        );

        button.addEventListener(
          "mousedown",
          event => {
            event.preventDefault();
          }
        );

        button.addEventListener(
          "click",
          () => choose(option)
        );

        list.appendChild(button);

        buttons.push(button);
      });

    if (
      !matches.length ||
      matches.length > 50
    ) {
      const message =
        document.createElement("div");

      message.className =
        "kategori-search-message";

      message.textContent = matches.length
        ? "Menampilkan 50 hasil. Ketik nama lebih lengkap."
        : "Kategori tidak ditemukan atau sudah ditambahkan.";

      list.appendChild(message);
    }

    list.hidden = false;

    input.setAttribute(
      "aria-expanded",
      "true"
    );
  }

  // ===================================================
  // EVENT INPUT
  // ===================================================

  input.addEventListener("input", render);

  input.addEventListener("focus", render);

  input.addEventListener("blur", close);

  // ===================================================
  // PILIH DENGAN KEYBOARD
  // ===================================================

  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      close();
      return;
    }

    if (
      event.key === "Enter" &&
      !list.hidden
    ) {
      event.preventDefault();

      if (active >= 0) {
        buttons[active].click();
      }

      return;
    }

    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp"
    ) {
      return;
    }

    event.preventDefault();

    if (list.hidden) {
      render();
    }

    if (!buttons.length) {
      return;
    }

    active = event.key === "ArrowDown"
      ? (active + 1) % buttons.length
      : (
          active <= 0
            ? buttons.length - 1
            : active - 1
        );

    buttons.forEach((button, index) => {
      button.setAttribute(
        "aria-selected",
        String(index === active)
      );
    });

    input.setAttribute(
      "aria-activedescendant",
      buttons[active].id
    );

    buttons[active].scrollIntoView({
      block: "nearest"
    });
  });

  // ===================================================
  // SINKRONISASI DATA KATEGORI
  // ===================================================

  const observer = new MutationObserver(() => {
    input.disabled =
      busy ||
      kategoriSelect.disabled;

    if (input.disabled) {
      close();

    } else if (
      document.activeElement === input &&
      !list.hidden
    ) {
      render();
    }
  });

  observer.observe(kategoriSelect, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "disabled",
      "value",
      "label"
    ]
  });

  // Kategori yang dihapus bisa dicari kembali.
  observer.observe(kategoriTerpilih, {
    childList: true
  });
}

initPencarianKategori();


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

// =====================================================
// LOAD PIC BERDASARKAN KATEGORI
// PIC LOGIN OTOMATIS TERPILIH
// =====================================================

async function loadPic() {

  // ===============================================
  // SIMPAN PIC YANG SUDAH DICENTANG
  // ===============================================

  const picSudahTerpilih =
    new Set(
      [
        ...document.querySelectorAll(
          'input[name="pic_ids"]:checked'
        )
      ].map(
        item =>
          String(item.value)
      )
    );

  picContainer.innerHTML =
    "";

  if (!selectedKategori.size) {
  alert(
    "Ketik nama kategori lalu klik salah satu hasil pencarian."
  );

  document.getElementById("kategoriSearchInput")?.focus();

  return;
}

  try {
    const groups =
      await Promise.all(
        [
          ...selectedKategori.keys()
        ].map(
          id =>
            getJson(
              `/api/proyek/kategori/${encodeURIComponent(
                id
              )}/pic`
            )
        )
      );

    // ===============================================
    // GABUNGKAN PIC SEMUA KATEGORI
    // ===============================================

    const unique =
      new Map();

    groups
      .flat()
      .forEach(pic => {
        if (
          pic?.id !== null &&
          pic?.id !== undefined
        ) {
          unique.set(
            String(pic.id),
            pic
          );
        }
      });

    // ===============================================
    // TAMBAHKAN PIC LOGIN
    // MESKIPUN BELUM TERHUBUNG KE KATEGORI
    // ===============================================

    if (
      picLogin?.id !== null &&
      picLogin?.id !== undefined
    ) {
      unique.set(
        String(picLogin.id),
        picLogin
      );
    }

    if (!unique.size) {
      picContainer.textContent =
        "Belum ada PIC pada kategori yang dipilih.";

      return;
    }

    // ===============================================
    // URUTKAN PIC
    // PIC LOGIN DITAMPILKAN PALING ATAS
    // ===============================================

    const daftarPic =
      [
        ...unique.values()
      ].sort(
        (a, b) => {
          const aLogin =
            String(a.id) ===
            String(picLogin?.id);

          const bLogin =
            String(b.id) ===
            String(picLogin?.id);

          if (
            aLogin &&
            !bLogin
          ) {
            return -1;
          }

          if (
            !aLogin &&
            bLogin
          ) {
            return 1;
          }

          return String(
            a.nama || ""
          ).localeCompare(
            String(
              b.nama || ""
            ),
            "id"
          );
        }
      );

    daftarPic.forEach(pic => {
      const picId =
        String(pic.id);

      const adalahPicLogin =
        picId ===
        String(picLogin?.id);

      /*
       * PIC login otomatis dicentang.
       * PIC pilihan sebelumnya tetap dipertahankan.
       */

      const checked =
        adalahPicLogin ||
        picSudahTerpilih.has(
          picId
        );

      const label =
        document.createElement(
          "label"
        );

      label.className =
        "pic-item";

      if (adalahPicLogin) {
        label.classList.add(
          "pic-item-current"
        );
      }

      label.innerHTML = `
        <input
          type="checkbox"
          name="pic_ids"
          value="${escapeHtml(picId)}"
          ${checked ? "checked" : ""}
        >

        <span>
          ${escapeHtml(
            pic.nama || "-"
          )}

          ${
            pic.jabatan
              ? ` - ${escapeHtml(
                  pic.jabatan
                )}`
              : ""
          }

          ${
            adalahPicLogin
              ? `
                <small class="pic-current-label">
                  PIC Anda
                </small>
              `
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

const proyekMasterDataReady = loadMaster();

// =====================================================
// PENCARIAN KLIEN DAN PARTNER
// =====================================================
(() => {
  const controls = new Map();
  let counter = 0;

  function enhance(select, kind) {
    if (!select || controls.has(select)) return;

    const id = `kpSearch-${++counter}`;

    const wrapper = document.createElement("div");
    wrapper.className = "kp-search";

    const input = document.createElement("input");
    input.id = `${id}-input`;
    input.type = "text";
    input.className = "kp-search-input";
    input.placeholder = `Ketik nama ${kind}...`;
    input.autocomplete = "off";
    input.required = select.required;
    input.disabled = select.disabled;

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-label", `Cari ${kind}`);
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", `${id}-list`);

    const list = document.createElement("div");
    list.id = `${id}-list`;
    list.className = "kp-search-list";
    list.setAttribute("role", "listbox");
    list.hidden = true;

    const labels = Array.from(select.labels || []);

    select.before(wrapper);
    wrapper.append(input, list, select);

    labels.forEach(label => {
      label.htmlFor = input.id;
    });

    // Select asli tetap menyimpan ID untuk payload.
    select.hidden = true;
    select.style.display = "none";
    select.required = false;

    let buttons = [];
    let active = -1;
    let editing = false;

    function close() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      active = -1;
    }

    function sync() {
      const option = select.selectedOptions[0];

      input.value = select.value && option
        ? option.textContent.trim()
        : "";

      input.disabled = select.disabled;
      input.setCustomValidity("");
      close();
    }

    function unavailable(option) {
      if (
        option.disabled ||
        option.parentElement?.disabled
      ) {
        return true;
      }

      if (kind !== "partner") return false;

      // Partner yang sudah dipilih di kartu lain
      // tidak ditampilkan lagi.
      return Array.from(
        document.querySelectorAll(
          "#partnerContainer .partner_id"
        )
      ).some(other =>
        other !== select &&
        other.value === option.value
      );
    }

    function render() {
      if (input.disabled) return close();

      list.replaceChildren();
      buttons = [];
      active = -1;

      input.removeAttribute("aria-activedescendant");

      const query = input.value.trim().toLowerCase();

      const matches = Array.from(select.options)
        .filter(option =>
          option.value &&
          !unavailable(option) &&
          option.textContent
            .toLowerCase()
            .includes(query)
        );

      matches.slice(0, 50).forEach((option, index) => {
        const button = document.createElement("button");

        button.type = "button";
        button.id = `${id}-option-${index}`;
        button.className = "kp-search-option";
        button.tabIndex = -1;
        button.textContent = option.textContent.trim();

        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", "false");

        button.addEventListener("mousedown", event => {
          event.preventDefault();
        });

        button.addEventListener("click", () => {
          if (unavailable(option)) return render();

          select.value = option.value;

          select.dispatchEvent(
            new Event("change", { bubbles: true })
          );

          sync();
          input.focus();
          close();
        });

        buttons.push(button);
        list.appendChild(button);
      });

      if (!matches.length || matches.length > 50) {
        const info = document.createElement("div");
        info.className = "kp-search-info";

        info.textContent = !matches.length
          ? `${
              kind === "klien" ? "Klien" : "Partner"
            } tidak ditemukan atau belum tersedia.`
          : "Ketik lebih lengkap untuk mempersempit hasil.";

        list.appendChild(info);
      }

      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    input.addEventListener("input", () => {
      const hadValue = Boolean(select.value);

      // Mengubah teks membatalkan pilihan sebelumnya.
      select.value = "";

      editing = true;

      if (hadValue) {
        select.dispatchEvent(
          new Event("change", { bubbles: true })
        );
      }

      editing = false;

      input.setCustomValidity(
        input.value.trim()
          ? `Klik salah satu hasil pencarian ${kind}.`
          : ""
      );

      render();
    });

    input.addEventListener("focus", render);
    input.addEventListener("click", render);
    input.addEventListener("blur", close);

    input.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        return close();
      }

      if (event.key === "Enter" && !list.hidden) {
        event.preventDefault();

        if (active >= 0) {
          buttons[active]?.click();
        }

        return;
      }

      if (
        !["ArrowDown", "ArrowUp"].includes(event.key)
      ) {
        return;
      }

      event.preventDefault();

      if (list.hidden) render();
      if (!buttons.length) return;

      active = active < 0
        ? (
            event.key === "ArrowDown"
              ? 0
              : buttons.length - 1
          )
        : (
            active +
            (event.key === "ArrowDown" ? 1 : -1) +
            buttons.length
          ) % buttons.length;

      buttons.forEach((button, index) => {
        button.setAttribute(
          "aria-selected",
          String(index === active)
        );
      });

      input.setAttribute(
        "aria-activedescendant",
        buttons[active].id
      );

      buttons[active].scrollIntoView({
        block: "nearest"
      });
    });

    // Sinkronkan setelah handler perubahan yang sudah ada,
    // termasuk pemeriksaan partner duplikat.
    select.addEventListener("change", () => {
      if (!editing) {
        queueMicrotask(sync);
      }
    });

    // Menangani pilihan yang dimuat secara asynchronous.
    const observer = new MutationObserver(() => {
      input.disabled = select.disabled;

      if (select.value) {
        sync();
      } else if (document.activeElement === input) {
        render();
      } else {
        close();
      }
    });

    observer.observe(select, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true
    });

    controls.set(select, { sync, observer });
    sync();
  }

  // ===================================================
  // KLIEN
  // ===================================================
  enhance(
    document.getElementById("klien_id"),
    "klien"
  );

  // ===================================================
  // PARTNER, TERMASUK KARTU BARU
  // ===================================================
  const container = document.getElementById(
    "partnerContainer"
  );

  function initPartners() {
    container
      ?.querySelectorAll("select.partner_id")
      .forEach(select => {
        enhance(select, "partner");
      });

    // Bersihkan observer kartu yang sudah dihapus.
    for (const [select, control] of controls) {
      if (!select.isConnected) {
        control.observer.disconnect();
        controls.delete(select);
      }
    }
  }

  initPartners();

  if (container) {
    new MutationObserver(initPartners).observe(
      container,
      {
        childList: true,
        subtree: true
      }
    );
  }

  // ===================================================
  // RESET FORM
  // ===================================================
  document
    .getElementById("proyekForm")
    ?.addEventListener("reset", () => {
      queueMicrotask(() => {
        controls.forEach(control => {
          control.sync();
        });
      });
    });
})();

// =====================================================
// TAMBAH KATEGORI, KLIEN, DAN PARTNER DARI FORM PROYEK
// =====================================================

(function initTambahMasterProyek() {
  if (
    document.getElementById(
      "proyekMasterModal"
    )
  ) {
    return;
  }

  // CSS menggunakan proyek.css yang dipanggil di HTML.

  // ===================================================
  // MODAL DI LUAR FORM PROYEK
  // ===================================================

  const modal =
    document.createElement("dialog");

  modal.id = "proyekMasterModal";
  modal.className = "pm-modal";

  modal.setAttribute(
    "aria-labelledby",
    "proyekMasterModalTitle"
  );

  modal.innerHTML = `
    <div class="pm-header">

      <h2 id="proyekMasterModalTitle"></h2>

      <button
        type="button"
        class="btn btn-secondary pm-close"
        aria-label="Tutup modal"
      >
        ✕
      </button>

    </div>

    <form class="pm-body">

      <fieldset class="pm-fields">
        <div class="pm-grid"></div>
      </fieldset>

      <p class="pm-message" role="alert"></p>

      <div class="pm-actions">

        <button
          type="button"
          class="btn btn-secondary pm-retry"
          hidden
        >
          Muat ulang pilihan
        </button>

        <button
          type="button"
          class="btn btn-secondary pm-close"
        >
          Batal
        </button>

        <button
          type="submit"
          class="btn btn-primary pm-save"
        >
          Simpan
        </button>

      </div>

    </form>
  `;

  document.body.appendChild(modal);

  const modalForm = modal.querySelector("form");
  const grid = modal.querySelector(".pm-grid");
  const fields = modal.querySelector("fieldset");
  const message = modal.querySelector(".pm-message");
  const save = modal.querySelector(".pm-save");
  const retry = modal.querySelector(".pm-retry");

  let currentKind;
  let targetSelect;
  let opener;

  let busy = false;
  let ready = false;
  let opening = 0;

  // ===================================================
  // FIELD MODAL
  // ===================================================

  function inputField(
    name,
    label,
    type = "text",
    required = false
  ) {
    return `
      <div class="form-group">

        <label for="pm-${name}">
          ${label}${required ? " *" : ""}
        </label>

        <input
          id="pm-${name}"
          name="${name}"
          type="${type}"
          ${required ? "required" : ""}
        >

      </div>
    `;
  }

  const statusField = `
    <div class="form-group">

      <label for="pm-status">
        Status
      </label>

      <select id="pm-status" name="status">

        <option value="Aktif">
          Aktif
        </option>

        <option value="Nonaktif">
          Nonaktif
        </option>

      </select>

    </div>
  `;

  function contactFields(kind) {
    return (
      inputField(
        "nama_pic",
        "Nama PIC"
      ) +

      inputField(
        "no_pic",
        kind === "klien"
          ? "No. Handphone"
          : "No. PIC",
        "tel"
      ) +

      inputField(
        "email_pic",
        "Email PIC",
        "email"
      )
    );
  }

  function value(name) {
    return String(
      modalForm.elements.namedItem(name)?.value || ""
    ).trim();
  }

  // ===================================================
  // TUTUP MODAL
  // ===================================================

  function close() {
    if (!busy) {
      modal.close();
    }
  }

  modal
    .querySelectorAll(".pm-close")
    .forEach(button => {
      button.addEventListener("click", close);
    });

  modal.addEventListener("cancel", event => {
    if (busy) {
      event.preventDefault();
    }
  });

  modal.addEventListener("close", () => {
    opening += 1;

    if (opener?.isConnected) {
      opener.focus();
    }
  });

  modal.addEventListener("click", event => {
    if (event.target !== modal) {
      return;
    }

    const rect = modal.getBoundingClientRect();

    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (outside) {
      close();
    }
  });

  // ===================================================
  // AMBIL PILIHAN PIC / JENIS PARTNER
  // ===================================================

  async function loadChoices() {
    const ticket = ++opening;
    const kind = currentKind;

    ready = false;

    fields.disabled = true;
    save.disabled = true;
    retry.hidden = true;

    message.textContent = "Memuat pilihan...";

    try {
      await proyekMasterDataReady;

      let rows = [];

      if (kind === "kategori") {
        rows = await getJson("/api/pic");
      } else if (kind === "partner") {
        rows = await getJson("/api/partner");
      }

      if (
        ticket !== opening ||
        !modal.open
      ) {
        return;
      }

      if (!Array.isArray(rows)) {
        throw new Error(
          "Format data pilihan tidak valid."
        );
      }

      // ===============================================
      // CHECKBOX PIC KATEGORI
      // ===============================================

      if (kind === "kategori") {
        const container =
          modal.querySelector(".pm-pics");

        container.replaceChildren();

        rows.forEach(row => {
          if (row.id == null) {
            return;
          }

          const label =
            document.createElement("label");

          const checkbox =
            document.createElement("input");

          checkbox.type = "checkbox";
          checkbox.name = "kategori_pic_ids";
          checkbox.value = String(row.id);

          label.append(
            checkbox,

            document.createTextNode(
              row.nama ||
              row.inisial ||
              String(row.id)
            )
          );

          container.appendChild(label);
        });

        if (!container.children.length) {
          container.textContent =
            "Belum ada data PIC.";
        }
      }

      // ===============================================
      // JENIS PARTNER DARI MASTER YANG TERSEDIA
      // ===============================================

      if (kind === "partner") {
        const select =
          modalForm.elements.namedItem(
            "jenis_partner"
          );

        const selected = select.value;

        const types = [
          ...new Set(
            rows
              .map(row =>
                String(
                  row.jenis_partner || ""
                ).trim()
              )
              .filter(Boolean)
          )
        ];

        select.replaceChildren(
          new Option(
            "Pilih jenis partner",
            ""
          )
        );

        types
          .sort((a, b) =>
            a.localeCompare(b, "id")
          )
          .forEach(type => {
            select.add(
              new Option(type, type)
            );
          });

        select.add(
          new Option(
            "Jenis lainnya...",
            "__pm_lainnya__"
          )
        );

        const selectedStillExists = [
          ...select.options
        ].some(option =>
          option.value === selected
        );

        if (selectedStillExists) {
          select.value = selected;
        }
      }

      ready = true;

      message.textContent = "";
      fields.disabled = false;
      save.disabled = false;

    } catch (error) {
      if (
        ticket !== opening ||
        !modal.open
      ) {
        return;
      }

      message.textContent =
        "Gagal memuat pilihan: " +
        error.message;

      retry.hidden = false;
    }
  }

  retry.addEventListener(
    "click",
    loadChoices
  );

  // ===================================================
  // BUKA MODAL
  // ===================================================

  function open(kind, select, button) {
    if (modal.open) {
      return;
    }

    currentKind = kind;
    targetSelect = select;
    opener = button;
    busy = false;

    const titles = {
      kategori: "Kategori Produk",
      klien: "Klien",
      partner: "Partner"
    };

    modal.querySelector("h2").textContent =
      "Tambah " + titles[kind];

    // ===============================================
    // MODAL KATEGORI
    // ===============================================

    if (kind === "kategori") {
      grid.innerHTML =
        inputField(
          "nama_kategori_produk",
          "Nama Kategori Produk",
          "text",
          true
        ) +

        statusField +

        `
          <div class="form-group pm-full">

            <label>
              Check PIC
            </label>

            <div class="pm-pics"></div>

          </div>
        `;
    }

    // ===============================================
    // MODAL KLIEN
    // ===============================================

    if (kind === "klien") {
      grid.innerHTML =
        inputField(
          "perusahaan_klien",
          "Perusahaan / Klien",
          "text",
          true
        ) +

        inputField(
          "inisial",
          "Inisial"
        ) +

        contactFields(kind);
    }

    // ===============================================
    // MODAL PARTNER
    // ===============================================

    if (kind === "partner") {
      grid.innerHTML =
        inputField(
          "nama_partner",
          "Nama Partner",
          "text",
          true
        ) +

        inputField(
          "inisial",
          "Inisial"
        ) +

        `
          <div class="form-group">

            <label for="pm-jenis_partner">
              Jenis Partner *
            </label>

            <select
              id="pm-jenis_partner"
              name="jenis_partner"
              required
            ></select>

          </div>
        ` +

        statusField +

        `
          <div
            class="form-group pm-full"
            hidden
          >

            <label for="pm-jenis_baru">
              Nama Jenis Partner *
            </label>

            <input
              id="pm-jenis_baru"
              name="jenis_baru"
              type="text"
              disabled
            >

          </div>
        ` +

        contactFields(kind) +

        `
          <div class="form-group pm-full">

            <label for="pm-alamat">
              Alamat
            </label>

            <textarea
              id="pm-alamat"
              name="alamat"
              rows="3"
            ></textarea>

          </div>
        `;

      modalForm.elements
        .namedItem("jenis_partner")
        .addEventListener("change", event => {
          const input =
            modalForm.elements.namedItem(
              "jenis_baru"
            );

          const other =
            event.target.value ===
            "__pm_lainnya__";

          input
            .closest(".form-group")
            .hidden = !other;

          input.disabled = !other;
          input.required = other;
        });
    }

    save.textContent = "Simpan";

    modal
      .querySelectorAll(".pm-close")
      .forEach(button => {
        button.disabled = false;
      });

    modal.showModal();

    loadChoices().then(() => {
      if (modal.open && ready) {
        grid.querySelector("input")?.focus();
      }
    });
  }

  // ===================================================
  // TAMBAH / PERBARUI OPTION TANPA RESET FORM
  // ===================================================

  function upsertOption(
    select,
    row,
    labelKey
  ) {
    let option = [
      ...select.options
    ].find(item =>
      item.value === String(row.id)
    );

    if (!option) {
      option = new Option();
      select.add(option);
    }

    option.value = String(row.id);
    option.textContent = row[labelKey];
  }

  // ===================================================
  // SIMPAN DATA MASTER
  // ===================================================

  modalForm.addEventListener(
    "submit",
    async event => {
      event.preventDefault();
      event.stopPropagation();

      if (
        busy ||
        !ready ||
        !modalForm.reportValidity()
      ) {
        return;
      }

      const kind = currentKind;

      let payload;

      // =============================================
      // PAYLOAD KATEGORI
      // =============================================

      if (kind === "kategori") {
        payload = {
          nama_kategori_produk:
            value("nama_kategori_produk"),

          status:
            value("status"),

          total_nilai: 0,

          pic_ids: [
            ...modal.querySelectorAll(
              '[name="kategori_pic_ids"]:checked'
            )
          ].map(input => input.value)
        };
      }

      // =============================================
      // PAYLOAD KLIEN
      // =============================================

      if (kind === "klien") {
        payload = {
          perusahaan_klien:
            value("perusahaan_klien"),

          inisial:
            value("inisial"),

          nama_pic:
            value("nama_pic"),

          no_pic:
            value("no_pic"),

          email_pic:
            value("email_pic")
        };
      }

      // =============================================
      // PAYLOAD PARTNER
      // =============================================

      if (kind === "partner") {
        payload = {
          nama_partner:
            value("nama_partner"),

          inisial:
            value("inisial"),

          jenis_partner:
            value("jenis_partner") ===
            "__pm_lainnya__"
              ? value("jenis_baru")
              : value("jenis_partner"),

          status:
            value("status"),

          nama_pic:
            value("nama_pic"),

          no_pic:
            value("no_pic"),

          email_pic:
            value("email_pic"),

          alamat:
            value("alamat")
        };
      }

      const nameKeys = {
        kategori: "nama_kategori_produk",
        klien: "perusahaan_klien",
        partner: "nama_partner"
      };

      const nameKey = nameKeys[kind];

      if (
        !payload[nameKey] ||
        (
          kind === "partner" &&
          !payload.jenis_partner
        )
      ) {
        message.textContent =
          "Isi nama dan pilihan wajib dengan benar.";

        return;
      }

      busy = true;

      fields.disabled = true;
      save.disabled = true;
      save.textContent = "Menyimpan...";

      message.textContent = "";

      modal
        .querySelectorAll(".pm-close")
        .forEach(button => {
          button.disabled = true;
        });

      let stored = false;

      try {
        const endpoints = {
          kategori: "/api/kategori-produk",
          klien: "/api/data",
          partner: "/api/partner"
        };

        const response = await fetch(
          endpoints[kind],
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(payload)
          }
        );

        stored = response.ok;

        const row = await response.json();

        if (!response.ok) {
          throw new Error(
            row.error ||
            row.message ||
            "Gagal menyimpan data."
          );
        }

        if (
          row?.id == null ||
          !row[nameKey]
        ) {
          throw new Error(
            "Respons API tidak memuat ID dan nama data baru."
          );
        }

        // ===========================================
        // DATA NONAKTIF DISIMPAN TANPA DIPILIH
        // ===========================================

        if (
          kind !== "klien" &&
          payload.status !== "Aktif"
        ) {
          busy = false;

          modal.close();

          alert(
            "Data berhasil disimpan dengan status Nonaktif. " +
            "Aktifkan data agar dapat dipilih pada proyek."
          );

          return;
        }

        // ===========================================
        // PILIH KATEGORI BARU
        // ===========================================

        if (kind === "kategori") {
          upsertOption(
            kategoriSelect,
            row,
            nameKey
          );

          kategoriSelect.value =
            String(row.id);

          await tambahKategoriDariSelect();
        }

        // ===========================================
        // PILIH KLIEN BARU
        // ===========================================

        if (kind === "klien") {
          upsertOption(
            klienSelect,
            row,
            nameKey
          );

          klienSelect.value =
            String(row.id);

          klienSelect.dispatchEvent(
            new Event(
              "change",
              { bubbles: true }
            )
          );
        }

        // ===========================================
        // PILIH PARTNER BARU
        // ===========================================

        if (kind === "partner") {
          const index =
            masterPartner.findIndex(item =>
              String(item.id) ===
              String(row.id)
            );

          if (index < 0) {
            masterPartner.push(row);
          } else {
            masterPartner[index] = row;
          }

          // Jika dibuka melalui tombol umum,
          // buat kartu partner baru.

          if (!targetSelect?.isConnected) {
            addPartner();

            targetSelect = [
              ...partnerContainer
                .querySelectorAll(
                  ".partner_id"
                )
            ].at(-1);
          }

          // Tambahkan option ke semua kartu.
          // Pilihan kartu lain tetap dipertahankan.

          partnerContainer
            .querySelectorAll(".partner_id")
            .forEach(select => {
              upsertOption(
                select,
                row,
                nameKey
              );
            });

          targetSelect.value =
            String(row.id);

          targetSelect.dispatchEvent(
            new Event(
              "change",
              { bubbles: true }
            )
          );
        }

        busy = false;

        modal.close();

      } catch (error) {
        message.textContent =
          (
            stored
              ? (
                  "Data sudah tersimpan, tetapi pilihan " +
                  "belum diperbarui. Muat ulang halaman " +
                  "setelah menyimpan isian proyek.\n"
                )
              : ""
          ) +
          error.message;

      } finally {
        busy = false;

        fields.disabled = false;

        // Mencegah POST ulang jika data
        // sudah tersimpan pada server.

        save.disabled = stored;

        save.textContent = stored
          ? "Sudah tersimpan"
          : "Simpan";

        modal
          .querySelectorAll(".pm-close")
          .forEach(button => {
            button.disabled = false;
          });
      }
    }
  );

  // ===================================================
  // TAMBAH TOMBOL
  // ===================================================

  function addButton(
    kind,
    anchor,
    select,
    text,
    id
  ) {
    if (
      !anchor ||
      (
        id &&
        document.getElementById(id)
      )
    ) {
      return;
    }

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "btn btn-secondary pm-add-button";

    if (id) {
      button.id = id;
    }

    button.textContent = text;

    button.addEventListener(
      "click",
      () => open(
        kind,
        select,
        button
      )
    );

    anchor.appendChild(button);
  }

  // Tombol di bawah pilihan kategori.

 // Tulisan bold tepat di bawah pencarian kategori.

addButton(
  "kategori",
  kategoriSelect.closest(".form-group"),
  kategoriSelect,
  "Belum ada? Tambah Kategori",
  "tambahMasterKategoriButton"
);

const tombolKategoriBaru =
  document.getElementById(
    "tambahMasterKategoriButton"
  );

const barisPencarianKategori =
  document.getElementById("kategoriSearchInput")
    ?.closest(".kategori-search")
    ?.parentElement;

if (
  tombolKategoriBaru &&
  barisPencarianKategori
) {
  barisPencarianKategori.after(
    tombolKategoriBaru
  );
}

  // Tombol di bawah pilihan klien.

addButton(
  "klien",
  klienSelect.closest(".form-group"),
  klienSelect,
  "Belum ada? Tambah Klien",
  "tambahMasterKlienButton"
);

const tombolKlienBaru =
  document.getElementById(
    "tambahMasterKlienButton"
  );

const pencarianKlien =
  klienSelect.closest(".kp-search");

if (
  tombolKlienBaru &&
  pencarianKlien
) {
  pencarianKlien.after(
    tombolKlienBaru
  );
}
  // Tombol umum pada bagian partner.

  addButton(
    "partner",
    $("addPartnerButton").parentElement,
    null,
    "Belum ada? Tambah Partner",
    "tambahMasterPartnerButton"
  );

  // ===================================================
  // TOMBOL PADA SETIAP KARTU PARTNER
  // ===================================================

  function addPartnerButtons() {
    partnerContainer
      .querySelectorAll(".partner_id")
      .forEach(select => {
        const group =
          select.closest(".form-group");

        if (
          group.querySelector(
            ".pm-add-button"
          )
        ) {
          return;
        }

        addButton(
          "partner",
          group,
          select,
          "Belum ada Partner"
        );
      });
  }

  addPartnerButtons();

  new MutationObserver(
    addPartnerButtons
  ).observe(
    partnerContainer,
    {
      childList: true,
      subtree: true
    }
  );

})();