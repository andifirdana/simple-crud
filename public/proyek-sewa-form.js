// =====================================================
// PROYEK SEWA FORM
// TAMBAH + EDIT
// =====================================================


// =====================================================
// GLOBAL
// =====================================================

const params =
  new URLSearchParams(
    window.location.search
  );

const proyekSewaId =
  params.get("id");

const isEdit =
  Boolean(proyekSewaId);


let masterKlien = [];
let masterProyek = [];
let masterProduk = [];
let masterCabang = [];

let productCounter = 0;


// =====================================================
// ELEMENT
// =====================================================

const form =
  document.getElementById(
    "proyekSewaForm"
  );

const nomorPr =
  document.getElementById(
    "nomorPr"
  );

const tanggalPr =
  document.getElementById(
    "tanggalPr"
  );

const nomorRujukan =
  document.getElementById(
    "nomorRujukan"
  );

const klienId =
  document.getElementById(
    "klienId"
  );

const proyekId =
  document.getElementById(
    "proyekId"
  );

const productContainer =
  document.getElementById(
    "productContainer"
  );

const paymentContainer =
  document.getElementById(
    "paymentContainer"
  );

const productTemplate =
  document.getElementById(
    "productTemplate"
  );

const orderTemplate =
  document.getElementById(
    "orderTemplate"
  );

const paymentTemplate =
  document.getElementById(
    "paymentTemplate"
  );

const btnTambahProduk =
  document.getElementById(
    "btnTambahProduk"
  );

const btnTambahPembayaran =
  document.getElementById(
    "btnTambahPembayaran"
  );

const btnSimpan =
  document.getElementById(
    "btnSimpanProyekSewa"
  );

const proyekPartnerId =
  document.getElementById(
    "proyekPartnerId"
  );
// =====================================================
// HELPER ANGKA
// =====================================================

function angka(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;

  }


  if (
    typeof value === "number"
  ) {

    return Number.isFinite(value)
      ? value
      : 0;

  }


  const cleaned =
    String(value)
      .replace(/[^\d-]/g, "");


  const result =
    Number(cleaned);


  return Number.isFinite(result)
    ? result
    : 0;

}


// =====================================================
// FORMAT RUPIAH
// =====================================================

function rupiah(value) {

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(
    angka(value)
  );

}

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


// =====================================================
// FORMAT DATE UNTUK INPUT
// =====================================================

function tanggalInput(value) {

  if (!value) {
    return "";
  }


  if (
    typeof value === "string"
  ) {

    const match =
      value.match(
        /^\d{4}-\d{2}-\d{2}/
      );


    if (match) {
      return match[0];
    }

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${year}-${month}-${day}`;

}


// =====================================================
// FETCH JSON
// =====================================================

async function fetchJSON(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      options
    );


  const contentType =
    response.headers.get(
      "content-type"
    ) || "";


  let result;


  if (
    contentType.includes(
      "application/json"
    )
  ) {

    result =
      await response.json();

  } else {

    const text =
      await response.text();


    throw new Error(
      text ||
      `HTTP ${response.status}`
    );

  }


  if (!response.ok) {

    throw new Error(
      result.error ||
      `HTTP ${response.status}`
    );

  }


  return result;

}


// =====================================================
// HITUNG END DATE
//
// Tanggal DO + Durasi Bulan
// =====================================================

function hitungEndDate(
  tanggalDO,
  durasiBulan
) {

  if (
    !tanggalDO ||
    !durasiBulan
  ) {

    return "";

  }


  const parts =
    String(tanggalDO)
      .split("-")
      .map(Number);


  if (
    parts.length !== 3
  ) {

    return "";

  }


  const [
    year,
    month,
    day
  ] = parts;


  if (
    !year ||
    !month ||
    !day
  ) {

    return "";

  }


  const result =
    new Date(
      year,
      month - 1,
      1
    );


  result.setMonth(
    result.getMonth() +
    Number(durasiBulan)
  );


  const lastDay =
    new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0
    ).getDate();


  result.setDate(
    Math.min(
      day,
      lastDay
    )
  );


  const yyyy =
    result.getFullYear();

  const mm =
    String(
      result.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const dd =
    String(
      result.getDate()
    ).padStart(
      2,
      "0"
    );


  return `${yyyy}-${mm}-${dd}`;

}


// =====================================================
// UPDATE RUJUKAN KONTRAK
//
// Menggabungkan seluruh No Req Klien:
// REQ-001, REQ-002, REQ-003
// =====================================================

function updateRujukanKontrak() {

  if (!nomorRujukan) {
    return;
  }


  const values =
    [
      ...document.querySelectorAll(
        ".noReqKlien"
      )
    ]
      .map(
        input =>
          String(
            input.value || ""
          ).trim()
      )
      .filter(Boolean);


  const unique =
    [
      ...new Set(values)
    ];


  nomorRujukan.value =
    unique.join(", ");

}

// =====================================================
// DROPDOWN BISA DIKETIK DAN DIPILIH
// =====================================================

let sewaSearchCounter = 0;

function buatSelectBisaDicari(
  select,
  placeholder
) {
  if (
    !select ||
    select.dataset.sewaSearchReady === "true"
  ) {
    return;
  }

  select.dataset.sewaSearchReady = "true";

  const uid =
    `sewa-search-${++sewaSearchCounter}`;

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "sewa-search-select";

  const input =
    document.createElement("input");

  input.type = "text";

  input.className =
    "sewa-search-input";

  input.id =
    select.id || `${uid}-input`;

  if (select.id) {
    select.id = `${uid}-select`;
  }

  input.placeholder = placeholder;
  input.autocomplete = "off";
  input.required = true;
  input.disabled = select.disabled;

  input.setAttribute(
    "role",
    "combobox"
  );

  input.setAttribute(
    "aria-label",
    placeholder
  );

  input.setAttribute(
    "aria-autocomplete",
    "list"
  );

  input.setAttribute(
    "aria-expanded",
    "false"
  );

  input.setAttribute(
    "aria-controls",
    `${uid}-list`
  );

  const list =
    document.createElement("div");

  list.id = `${uid}-list`;

  list.className =
    "sewa-search-options";

  list.setAttribute(
    "role",
    "listbox"
  );

  list.hidden = true;

  // Select lama tetap menyimpan ID
  // untuk perhitungan harga dan payload.

  select.required = false;
  select.hidden = true;

  select.classList.add(
    "sewa-search-original"
  );

  select.before(wrapper);

  wrapper.append(
    input,
    select,
    list
  );

  let filtered = [];
  let activeIndex = -1;

  function ambilOptions() {
    return [...select.options].filter(
      option =>
        option.value &&
        !option.disabled
    );
  }

  function validasi() {
    input.setCustomValidity(
      select.value
        ? ""
        : "Pilih salah satu pilihan dari daftar."
    );
  }

  function tutup() {
    list.hidden = true;

    input.setAttribute(
      "aria-expanded",
      "false"
    );

    input.removeAttribute(
      "aria-activedescendant"
    );

    activeIndex = -1;
  }

  function tandaiAktif() {
    const items = [
      ...list.querySelectorAll(
        ".sewa-search-option"
      )
    ];

    items.forEach(
      (item, index) => {
        const active =
          index === activeIndex;

        item.classList.toggle(
          "is-active",
          active
        );

        item.setAttribute(
          "aria-selected",
          String(active)
        );

        if (active) {
          input.setAttribute(
            "aria-activedescendant",
            item.id
          );

          item.scrollIntoView({
            block: "nearest"
          });
        }
      }
    );

    if (activeIndex < 0) {
      input.removeAttribute(
        "aria-activedescendant"
      );
    }
  }

  function pilih(option) {
    if (!option) {
      return;
    }

    select.value =
      option.value;

    input.value =
      option.textContent.trim();

    validasi();
    tutup();

    select.dispatchEvent(
      new Event(
        "change",
        { bubbles: true }
      )
    );
  }

  function tampilkan(query = "") {
    const kata =
      query
        .trim()
        .toLocaleLowerCase("id-ID");

    filtered =
      ambilOptions().filter(
        option =>
          option.textContent
            .toLocaleLowerCase("id-ID")
            .includes(kata)
      );

    list.replaceChildren();

    activeIndex = -1;

    if (filtered.length === 0) {
      const empty =
        document.createElement("div");

      empty.className =
        "sewa-search-empty";

      empty.textContent =
        "Data tidak ditemukan";

      list.appendChild(empty);
    }

    filtered.forEach(
      (option, index) => {
        const item =
          document.createElement("button");

        item.type = "button";
        item.tabIndex = -1;

        item.id =
          `${uid}-option-${index}`;

        item.className =
          "sewa-search-option";

        item.setAttribute(
          "role",
          "option"
        );

        item.setAttribute(
          "aria-selected",
          "false"
        );

        item.textContent =
          option.textContent.trim();

        item.addEventListener(
          "mousedown",
          event => {
            event.preventDefault();
          }
        );

        item.addEventListener(
          "click",
          () => {
            pilih(option);
          }
        );

        list.appendChild(item);
      }
    );

    list.hidden = false;

    input.setAttribute(
      "aria-expanded",
      "true"
    );

    input.removeAttribute(
      "aria-activedescendant"
    );
  }

  // Tampilkan pilihan existing saat edit.

  const selected =
    select.selectedOptions[0];

  input.value =
    selected?.value
      ? selected.textContent.trim()
      : "";

  validasi();

  input.addEventListener(
    "focus",
    () => {
      tampilkan(
        select.value
          ? ""
          : input.value
      );
    }
  );

  input.addEventListener(
    "input",
    () => {
      const sebelumnya =
        select.value;

      // Hapus ID lama saat pengguna mengetik
      // agar tidak tersimpan pilihan yang salah.

      select.value = "";

      validasi();

      if (sebelumnya) {
        select.dispatchEvent(
          new Event(
            "change",
            { bubbles: true }
          )
        );
      }

      tampilkan(input.value);
    }
  );

  input.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        if (!list.hidden) {
          event.preventDefault();
          event.stopPropagation();

          tutup();
        }

        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();

        if (list.hidden) {
          tampilkan(
            select.value
              ? ""
              : input.value
          );
        }

        if (filtered.length === 0) {
          return;
        }

        if (event.key === "ArrowDown") {
          activeIndex =
            (activeIndex + 1) %
            filtered.length;
        } else {
          activeIndex =
            activeIndex <= 0
              ? filtered.length - 1
              : activeIndex - 1;
        }

        tandaiAktif();

        return;
      }

      if (
        event.key === "Enter" &&
        !list.hidden
      ) {
        event.preventDefault();

        if (activeIndex >= 0) {
          pilih(
            filtered[activeIndex]
          );
        } else if (
          filtered.length === 1
        ) {
          pilih(filtered[0]);
        }
      }
    }
  );

  wrapper.addEventListener(
    "focusout",
    event => {
      if (
        !wrapper.contains(
          event.relatedTarget
        )
      ) {
        tutup();
      }
    }
  );

  select.addEventListener(
    "change",
    () => {
      const option =
        select.selectedOptions[0];

      if (option?.value) {
        input.value =
          option.textContent.trim();
      }

      validasi();
    }
  );
}

// =====================================================
// LOAD MASTER KLIEN
// =====================================================

async function loadMasterKlien() {

  const result =
    await fetchJSON(
      "/api/proyek-sewa/master/klien"
    );


  masterKlien =
    Array.isArray(result)
      ? result
      : [];


  if (!klienId) {
    return;
  }


  klienId.innerHTML =
    `
      <option value="">
        Pilih Klien
      </option>
    `;


  masterKlien.forEach(
    item => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        item.id;


      option.textContent =
        item.perusahaan_klien ||
        item.nama_klien ||
        item.nama ||
        `Klien ${item.id}`;


      klienId.appendChild(
        option
      );

    }
  );

}



// =====================================================
// LOAD MASTER PROYEK
// HANYA JENIS PROYEK SEWA
// =====================================================

async function loadMasterProyek() {
  try {
    const result =
      await fetchJSON(
        "/api/proyek-sewa/master/proyek"
      );

    const dataProyek =
      Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : [];

    /*
     * Filter ulang di frontend sebagai pengamanan.
     * Dropdown hanya boleh berisi proyek Sewa.
     */

    masterProyek =
      dataProyek.filter(
        item =>
          String(
            item.jenis_proyek || ""
          )
            .trim()
            .toLowerCase() ===
          "sewa"
      );

    if (!proyekId) {
      return;
    }

    proyekId.innerHTML = `
      <option value="">
        Pilih Nama Proyek
      </option>
    `;

    masterProyek.forEach(
      item => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          String(item.id);

        option.textContent =
          item.nama_proyek ||
          `Proyek ${item.id}`;

        /*
         * Simpan informasi klien pada option
         * untuk kebutuhan pemilihan otomatis.
         */

        option.dataset.klienId =
          item.klien_id || "";

        proyekId.appendChild(
          option
        );
      }
    );

    /*
     * Jika tidak ada proyek Sewa.
     */

    if (
      masterProyek.length === 0
    ) {
      const optionKosong =
        document.createElement(
          "option"
        );

      optionKosong.value = "";
      optionKosong.disabled = true;

      optionKosong.textContent =
        "Tidak ada proyek dengan jenis Sewa";

      proyekId.appendChild(
        optionKosong
      );
    }

  } catch (error) {
    console.error(
      "ERROR LOAD MASTER PROYEK SEWA:",
      error
    );

    masterProyek = [];

    if (proyekId) {
      proyekId.innerHTML = `
        <option value="">
          Gagal memuat proyek Sewa
        </option>
      `;
    }
  }
}


// =====================================================
// LOAD MASTER PRODUK
// =====================================================

async function loadMasterProduk() {

  const result =
    await fetchJSON(
      "/api/proyek-sewa/master/produk"
    );


  masterProduk =
    Array.isArray(result)
      ? result
      : [];

}


// =====================================================
// LOAD MASTER CABANG
// =====================================================

async function loadMasterCabang() {

  const result =
    await fetchJSON(
      "/api/proyek-sewa/master/cabang"
    );


  masterCabang =
    Array.isArray(result)
      ? result
      : [];

}

// =====================================================
// LOAD PARTNER
// =====================================================

async function loadPartnerProyekSewa(
  selectedId = null
) {
  if (!proyekPartnerId) {
    return;
  }

  const selectedProyekId =
    Number(proyekId?.value);

  if (
    !Number.isInteger(
      selectedProyekId
    ) ||
    selectedProyekId <= 0
  ) {
    proyekPartnerId.innerHTML = `
      <option value="">
        Pilih proyek terlebih dahulu
      </option>
    `;

    proyekPartnerId.disabled =
      true;

    proyekPartnerId.required =
      false;

    return;
  }

  proyekPartnerId.innerHTML = `
    <option value="">
      Memuat partner...
    </option>
  `;

  proyekPartnerId.disabled =
    true;

  const partners =
    await fetchJSON(
      `/api/proyek-sewa/master/proyek/${selectedProyekId}/partners`
    );

  proyekPartnerId.innerHTML = "";

  if (
    !Array.isArray(partners) ||
    partners.length === 0
  ) {
    proyekPartnerId.innerHTML = `
      <option value="">
        Kontrak belum memiliki partner
      </option>
    `;

    proyekPartnerId.disabled =
      true;

    proyekPartnerId.required =
      false;

    return;
  }

  proyekPartnerId.appendChild(
    new Option(
      "Pilih Partner",
      ""
    )
  );

  partners.forEach(item => {
    proyekPartnerId.appendChild(
      new Option(
        item.nama_partner || "-",
        String(
          item.proyek_partner_id
        )
      )
    );
  });

  proyekPartnerId.disabled =
    false;

  proyekPartnerId.required =
    partners.length > 1;

  if (selectedId) {
    proyekPartnerId.value =
      String(selectedId);

  } else if (
    partners.length === 1
  ) {
    proyekPartnerId.value =
      String(
        partners[0]
          .proyek_partner_id
      );
  }
}

// =====================================================
// OPTION PRODUK
// =====================================================

function isiProdukSelect(
  select,
  selectedId = null
) {
  if (!select) {
    return;
  }

  select.replaceChildren(
    new Option(
      "Pilih Produk",
      ""
    )
  );

  masterProduk.forEach(
    item => {
      const option =
        new Option(
          item.item_produk ||
          item.nama_produk ||
          `Produk ${item.id}`,
          String(item.id)
        );

      if (
        String(item.id) ===
        String(selectedId)
      ) {
        option.selected = true;
      }

      select.appendChild(option);
    }
  );

  buatSelectBisaDicari(
    select,
    "Ketik atau pilih produk"
  );
}


// =====================================================
// OPTION LOKASI / CABANG
// =====================================================

function isiCabangSelect(
  select,
  selectedId = null
) {
  if (!select) {
    return;
  }

  select.replaceChildren(
    new Option(
      "Pilih Lokasi / Cabang",
      ""
    )
  );

  masterCabang.forEach(
    item => {
      const option =
        new Option(
          item.nama_cabang ||
          item.nama ||
          item.cabang ||
          `Cabang ${item.id}`,
          String(item.id)
        );

      if (
        String(item.id) ===
        String(selectedId)
      ) {
        option.selected = true;
      }

      select.appendChild(option);
    }
  );

  buatSelectBisaDicari(
    select,
    "Ketik atau pilih lokasi / cabang"
  );
}

// =====================================================
// CARI MASTER PRODUK
// =====================================================

function getMasterProduk(
  produkId
) {

  return masterProduk.find(
    item =>
      String(item.id) ===
      String(produkId)
  ) || null;

}


// =====================================================
// HARGA PRODUK
//
// TAMBAH:
// harga dari master.
//
// EDIT PRODUK YANG SAMA:
// harga kontrak awal.
//
// EDIT DAN GANTI PRODUK:
// harga master produk baru.
// =====================================================

function getHargaProduk(
  productItem
) {

  if (!productItem) {
    return 0;
  }


  const select =
    productItem.querySelector(
      ".produkSelect"
    );


  const produkId =
    select?.value;


  if (!produkId) {
    return 0;
  }


  const master =
    getMasterProduk(
      produkId
    );


  const originalRowId =
    productItem.dataset.productId;

  const originalProdukId =
    productItem.dataset.originalProdukId;

  const originalHarga =
    angka(
      productItem.dataset.originalHarga
    );


  // ===============================================
  // EDIT + PRODUK TIDAK DIGANTI
  // ===============================================

  if (
    originalRowId &&
    String(produkId) ===
      String(originalProdukId)
  ) {

    return originalHarga;

  }


  // ===============================================
  // PRODUK BARU / PRODUK DIGANTI
  // ===============================================

  return angka(
    master?.harga_jual_per_item
  );

}


// =====================================================
// UPDATE INFORMASI PRODUK
// =====================================================

function updateInformasiProduk(
  productItem
) {

  if (!productItem) {
    return;
  }


  const select =
    productItem.querySelector(
      ".produkSelect"
    );


  const produkId =
    select?.value;


  const master =
    getMasterProduk(
      produkId
    );


  const harga =
    getHargaProduk(
      productItem
    );


  const hargaInput =
    productItem.querySelector(
      ".hargaProduk"
    );


  const jenisInput =
    productItem.querySelector(
      ".jenisProyek"
    );


  const subJenisInput =
    productItem.querySelector(
      ".subJenisProyek"
    );


  if (hargaInput) {

    hargaInput.value =
      rupiah(harga);

  }


  if (jenisInput) {

    jenisInput.value =
      master?.jenis_proyek ||
      "Sewa";

  }


  if (subJenisInput) {

    subJenisInput.value =
      master?.sub_jenis_proyek ||
      "-";

  }

}


// =====================================================
// UPDATE END DATE SATU ORDER
// =====================================================

function updateEndDateOrder(
  orderItem
) {

  if (!orderItem) {
    return;
  }


  const productItem =
    orderItem.closest(
      ".product-item"
    );


  if (!productItem) {
    return;
  }


  const tanggalDO =
    orderItem.querySelector(
      ".tanggalDO"
    )?.value || "";


  const durasi =
    angka(
      productItem.querySelector(
        ".durasiProduk"
      )?.value
    );


  const endDate =
    orderItem.querySelector(
      ".endDate"
    );


  if (!endDate) {
    return;
  }


  endDate.value =
    hitungEndDate(
      tanggalDO,
      durasi
    );

}

// =====================================================
// HITUNG SATU ORDER
// =====================================================

function hitungOrder(
  orderItem
) {

  if (!orderItem) {
    return;
  }


  const productItem =
    orderItem.closest(
      ".product-item"
    );


  if (!productItem) {
    return;
  }


  const hargaItem =
    getHargaProduk(
      productItem
    );


  const quantity =
    angka(
      orderItem.querySelector(
        ".quantityOrder"
      )?.value
    );


  const durasi =
    angka(
      productItem.querySelector(
        ".durasiProduk"
      )?.value
    );


  const hargaPerBulan =
    hargaItem *
    quantity;


  const totalHarga =
    hargaPerBulan *
    durasi;


  const hargaPerBulanInput =
    orderItem.querySelector(
      ".hargaPerBulan"
    );


  const totalHargaInput =
    orderItem.querySelector(
      ".totalHargaOrder"
    );


  if (hargaPerBulanInput) {

    hargaPerBulanInput.value =
      rupiah(
        hargaPerBulan
      );

    hargaPerBulanInput.dataset.value =
      String(
        hargaPerBulan
      );

  }


  if (totalHargaInput) {

    totalHargaInput.value =
      rupiah(
        totalHarga
      );

    totalHargaInput.dataset.value =
      String(
        totalHarga
      );

  }


  updateEndDateOrder(
    orderItem
  );

}

// =====================================================
// HITUNG SATU PRODUK
// =====================================================

function hitungProduk(
  productItem
) {

  if (!productItem) {
    return;
  }


  updateInformasiProduk(
    productItem
  );


  productItem
    .querySelectorAll(
      ".order-item"
    )
    .forEach(
      orderItem => {

        hitungOrder(
          orderItem
        );

      }
    );


  hitungTotalProyek();

}

// =====================================================
// HITUNG TOTAL PROYEK
// =====================================================

function hitungTotalProyek() {

  let totalPerBulan = 0;
  let totalProyek = 0;


  document
    .querySelectorAll(
      ".order-item"
    )
    .forEach(
      orderItem => {

        totalPerBulan +=
          angka(
            orderItem
              .querySelector(
                ".hargaPerBulan"
              )
              ?.dataset.value
          );


        totalProyek +=
          angka(
            orderItem
              .querySelector(
                ".totalHargaOrder"
              )
              ?.dataset.value
          );

      }
    );


  const totalBulananEl =
    document.getElementById(
      "totalNilaiPerBulan"
    );


  const grandTotalEl =
    document.getElementById(
      "grandTotalProyek"
    );


  if (totalBulananEl) {

    totalBulananEl.textContent =
      rupiah(
        totalPerBulan
      );

  }


  if (grandTotalEl) {

    grandTotalEl.textContent =
      rupiah(
        totalProyek
      );

  }

}

// =====================================================
// UPDATE NOMOR / JUDUL PRODUK
// =====================================================

function updateJudulProduk() {

  const products =
    [
      ...productContainer
        .querySelectorAll(
          ".product-item"
        )
    ];


  products.forEach(
    (
      item,
      index
    ) => {

      item.dataset.productIndex =
        String(index);


      const title =
        item.querySelector(
          ".product-title"
        );


      if (title) {

        title.textContent =
          `Produk ${index + 1}`;

      }

    }
  );

}

// =====================================================
// TAMBAH ORDER
// =====================================================

function tambahOrder(
  productItem,
  data = null
) {

  if (
    !productItem ||
    !orderTemplate
  ) {

    return null;

  }


  const fragment =
    orderTemplate
      .content
      .cloneNode(true);


  const orderItem =
    fragment.querySelector(
      ".order-item"
    );


  const lokasi =
    orderItem.querySelector(
      ".lokasiSelect"
    );


  isiCabangSelect(
    lokasi,
    data?.cabang_id
  );


  // ===============================================
  // DATA EDIT
  // ===============================================

  if (data) {

    orderItem.dataset.orderId =
      data.id || "";


    const qty =
      orderItem.querySelector(
        ".quantityOrder"
      );


    if (qty) {

      qty.value =
        data.quantity ||
        1;

    }


    const noReq =
      orderItem.querySelector(
        ".noReqKlien"
      );


    if (noReq) {

      noReq.value =
        data.no_req_klien ||
        "";

    }


    const tanggalReq =
      orderItem.querySelector(
        ".tanggalReqKlien"
      );


    if (tanggalReq) {

      tanggalReq.value =
        tanggalInput(
          data.tanggal_req_klien
        );

    }


    const tanggalDO =
      orderItem.querySelector(
        ".tanggalDO"
      );


    if (tanggalDO) {

      tanggalDO.value =
        tanggalInput(
          data.tanggal_do
        );

    }


    const noDO =
      orderItem.querySelector(
        ".noDO"
      );


    if (noDO) {

      noDO.value =
        data.no_do ||
        "";

    }


    const endDate =
      orderItem.querySelector(
        ".endDate"
      );


    if (endDate) {

      endDate.value =
        tanggalInput(
          data.end_date
        );

    }

  }


  // ===============================================
  // EVENT QTY
  // ===============================================

  orderItem
    .querySelector(
      ".quantityOrder"
    )
    ?.addEventListener(
      "input",
      () => {

        hitungOrder(
          orderItem
        );

        hitungTotalProyek();

      }
    );


  // ===============================================
  // NO REQ KLIEN
  // ===============================================

  orderItem
    .querySelector(
      ".noReqKlien"
    )
    ?.addEventListener(
      "input",
      () => {

        updateRujukanKontrak();

      }
    );


  // ===============================================
  // TANGGAL DO
  // ===============================================

  orderItem
    .querySelector(
      ".tanggalDO"
    )
    ?.addEventListener(
      "change",
      () => {

        updateEndDateOrder(
          orderItem
        );

      }
    );


  // ===============================================
  // HAPUS ORDER
  // ===============================================

  orderItem
    .querySelector(
      ".btnHapusOrder"
    )
    ?.addEventListener(
      "click",
      () => {

        const orderContainer =
          productItem.querySelector(
            ".order-container"
          );


        const jumlahOrder =
          orderContainer
            ?.querySelectorAll(
              ".order-item"
            )
            .length || 0;


        if (
          jumlahOrder <= 1
        ) {

          alert(
            "Minimal harus ada 1 Order pada setiap Produk."
          );

          return;

        }


        orderItem.remove();


        updateRujukanKontrak();

        hitungProduk(
          productItem
        );

      }
    );


  const container =
    productItem.querySelector(
      ".order-container"
    );


  container.appendChild(
    fragment
  );


  hitungOrder(
    orderItem
  );


  updateRujukanKontrak();


  return orderItem;

}

// =====================================================
// TAMBAH PRODUK
// =====================================================

function tambahProduk(
  data = null
) {

  if (
    !productTemplate ||
    !productContainer
  ) {

    return null;

  }


  const fragment =
    productTemplate
      .content
      .cloneNode(true);


  const productItem =
    fragment.querySelector(
      ".product-item"
    );


  productCounter++;


  // ===============================================
  // SIMPAN IDENTITAS PRODUK LAMA
  //
  // Digunakan supaya harga kontrak existing
  // tidak berubah mengikuti harga master.
  // ===============================================

  productItem.dataset.productId =
    data?.id ||
    "";

  productItem.dataset.originalProdukId =
    data?.produk_id ||
    "";

  productItem.dataset.originalHarga =
    angka(
      data?.harga_per_item
    );


  const produkSelect =
    productItem.querySelector(
      ".produkSelect"
    );


  isiProdukSelect(
    produkSelect,
    data?.produk_id
  );


  const durasi =
    productItem.querySelector(
      ".durasiProduk"
    );


  if (
    durasi &&
    data
  ) {

    durasi.value =
      data.durasi_bulan ||
      "";

  }


  // ===============================================
  // GANTI PRODUK
  // ===============================================

  produkSelect
    ?.addEventListener(
      "change",
      () => {

        hitungProduk(
          productItem
        );

      }
    );


  // ===============================================
  // GANTI DURASI
  // ===============================================

  durasi
    ?.addEventListener(
      "input",
      () => {

        hitungProduk(
          productItem
        );

      }
    );


  // ===============================================
  // TAMBAH ORDER
  // ===============================================

  productItem
    .querySelector(
      ".btnTambahOrder"
    )
    ?.addEventListener(
      "click",
      () => {

        tambahOrder(
          productItem
        );


        hitungProduk(
          productItem
        );

      }
    );


  // ===============================================
  // HAPUS PRODUK
  // ===============================================

  productItem
    .querySelector(
      ".btnHapusProduk"
    )
    ?.addEventListener(
      "click",
      () => {

        const jumlahProduk =
          productContainer
            .querySelectorAll(
              ".product-item"
            )
            .length;


        if (
          jumlahProduk <= 1
        ) {

          alert(
            "Minimal harus ada 1 Produk."
          );

          return;

        }


        productItem.remove();


        updateJudulProduk();

        updateRujukanKontrak();

        hitungTotalProyek();

      }
    );


  productContainer.appendChild(
    fragment
  );


  updateJudulProduk();


  // ===============================================
  // ORDER EDIT / ORDER BARU
  // ===============================================

  if (
    data &&
    Array.isArray(
      data.orders
    ) &&
    data.orders.length
  ) {

    data.orders.forEach(
      order => {

        tambahOrder(
          productItem,
          order
        );

      }
    );

  } else {

    tambahOrder(
      productItem
    );

  }


  updateInformasiProduk(
    productItem
  );


  hitungProduk(
    productItem
  );


  return productItem;

}
// =====================================================
// NORMALISASI STATUS PEMBAYARAN
// =====================================================

function normalisasiStatusPembayaranSewa(
  value
) {
  const status =
    String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  if (
    status === "sudah dibayar" ||
    status === "dibayar" ||
    status === "lunas" ||
    status === "paid"
  ) {
    return "Sudah Dibayar";
  }

  if (
    status === "proses" ||
    status === "diproses" ||
    status === "processing"
  ) {
    return "Proses";
  }

  return "Belum Dibayar";
}

// =====================================================
// TAMBAH PEMBAYARAN
// =====================================================

function tambahPembayaran(
  data = null
) {
  if (
    !paymentTemplate ||
    !paymentContainer
  ) {
    return null;
  }

  const fragment =
    paymentTemplate
      .content
      .cloneNode(true);

  const paymentItem =
    fragment.querySelector(
      ".payment-item"
    );

  if (!paymentItem) {
    return null;
  }

  paymentItem.dataset.paymentId =
    data?.id || "";

  // ===============================================
  // ELEMENT
  // ===============================================

  const deskripsiInput =
    paymentItem.querySelector(
      ".deskripsiPembayaran"
    );

  const nominalInput =
    paymentItem.querySelector(
      ".nominalPembayaran"
    );

  const statusInput =
    paymentItem.querySelector(
      ".statusPembayaran"
    );

  const tanggalBayarInput =
    paymentItem.querySelector(
      ".tanggalBayar"
    );

  const syaratInput =
    paymentItem.querySelector(
      ".syaratPembayaran"
    );

  // ===============================================
  // ISI DATA
  // ===============================================

  if (deskripsiInput) {
    deskripsiInput.value =
      data?.deskripsi || "";
  }

  if (nominalInput) {
    const nominal =
      angka(
        data?.nominal
      );

    nominalInput.value =
      nominal > 0
        ? rupiah(nominal)
        : "";
  }

  if (statusInput) {
    statusInput.value =
      normalisasiStatusPembayaranSewa(
        data?.status_pembayaran
      );
  }

  if (tanggalBayarInput) {
    tanggalBayarInput.value =
      tanggalInput(
        data?.tanggal_bayar
      );
  }

  if (syaratInput) {
    syaratInput.value =
      data?.syarat_pembayaran ||
      "";
  }

  // ===============================================
  // ATUR TANGGAL BAYAR BERDASARKAN STATUS
  // ===============================================

  function aturTanggalBayar() {
    if (
      !statusInput ||
      !tanggalBayarInput
    ) {
      return;
    }

    const sudahDibayar =
      statusInput.value ===
      "Sudah Dibayar";

    tanggalBayarInput.required =
      sudahDibayar;

    tanggalBayarInput.classList.toggle(
      "required-payment-date",
      sudahDibayar
    );
  }

  statusInput
    ?.addEventListener(
      "change",
      aturTanggalBayar
    );

  aturTanggalBayar();

  // ===============================================
  // FORMAT NOMINAL
  // ===============================================

  nominalInput
    ?.addEventListener(
      "input",
      event => {
        const value =
          angka(
            event.target.value
          );

        event.target.value =
          value > 0
            ? rupiah(value)
            : "";
      }
    );

  // ===============================================
  // HAPUS PEMBAYARAN
  // ===============================================

  paymentItem
    .querySelector(
      ".btnHapusPembayaran"
    )
    ?.addEventListener(
      "click",
      () => {
        const yakin =
          window.confirm(
            "Hapus data pembayaran ini?"
          );

        if (!yakin) {
          return;
        }

        paymentItem.remove();
      }
    );

  paymentContainer.appendChild(
    fragment
  );

  return paymentItem;
}

// =====================================================
// LOAD DATA EDIT
// =====================================================

async function loadDataEdit() {

  if (!isEdit) {
    return;
  }


  const result =
    await fetchJSON(
      `/api/proyek-sewa/${encodeURIComponent(
        proyekSewaId
      )}/detail`
    );


  const proyek =
    result.proyek ||
    {};


  const produk =
    Array.isArray(
      result.produk
    )
      ? result.produk
      : [];


  const pembayaran =
    Array.isArray(
      result.pembayaran
    )
      ? result.pembayaran
      : [];


  // ===============================================
  // HEADER
  // ===============================================

  if (nomorPr) {

    nomorPr.value =
      proyek.nomor_pr ||
      "";

  }


  if (tanggalPr) {

    tanggalPr.value =
      tanggalInput(
        proyek.tanggal_pr
      );

  }


  if (klienId) {

    klienId.value =
      proyek.klien_id ||
      "";

  }


if (proyekId) {

  proyekId.value =
    proyek.proyek_id ||
    "";

  await loadPartnerProyekSewa(
    proyek.proyek_partner_id
  );

}

  if (nomorRujukan) {

    nomorRujukan.value =
      proyek.nomor_rujukan ||
      "";

  }


  // ===============================================
  // PRODUK
  // ===============================================

  productContainer.innerHTML =
    "";


  if (produk.length) {

    produk.forEach(
      item => {

        tambahProduk(
          item
        );

      }
    );

  } else {

    tambahProduk();

  }


  // ===============================================
  // PEMBAYARAN
  // ===============================================

  paymentContainer.innerHTML =
    "";


  pembayaran.forEach(
    item => {

      tambahPembayaran(
        item
      );

    }
  );


  // ===============================================
  // RUJUKAN KONTRAK
  //
  // Kalau order sudah memiliki No Req Klien,
  // generate ulang dari order.
  //
  // Kalau data lama belum memiliki no_req_klien,
  // nomor_rujukan existing tetap dipertahankan.
  // ===============================================

  const punyaNoReq =
    [
      ...document.querySelectorAll(
        ".noReqKlien"
      )
    ].some(
      input =>
        String(
          input.value || ""
        ).trim()
    );


  if (punyaNoReq) {

    updateRujukanKontrak();

  }


  hitungTotalProyek();


  // ===============================================
  // UBAH JUDUL
  // ===============================================

  const pageTitle =
    document.getElementById(
      "pageTitle"
    );


  if (pageTitle) {

    pageTitle.textContent =
      "Edit Proyek Sewa";

  }


  if (btnSimpan) {

    btnSimpan.textContent =
      "Simpan Perubahan";

  }

}

// =====================================================
// BUILD PAYLOAD PRODUK
// =====================================================

function buildProdukPayload() {

  const result = [];


  const products =
    [
      ...productContainer
        .querySelectorAll(
          ".product-item"
        )
    ];


  products.forEach(
    (
      productItem,
      productIndex
    ) => {

      const produkId =
        Number(
          productItem.querySelector(
            ".produkSelect"
          )?.value
        );


      const durasiBulan =
        Number(
          productItem.querySelector(
            ".durasiProduk"
          )?.value
        );


      if (
        !Number.isInteger(
          produkId
        ) ||
        produkId <= 0
      ) {

        throw new Error(
          `Produk ${productIndex + 1} belum dipilih.`
        );

      }


      if (
        !Number.isFinite(
          durasiBulan
        ) ||
        durasiBulan <= 0
      ) {

        throw new Error(
          `Durasi Produk ${productIndex + 1} belum valid.`
        );

      }


      const orders = [];


      const orderItems =
        [
          ...productItem
            .querySelectorAll(
              ".order-item"
            )
        ];


      if (
        orderItems.length === 0
      ) {

        throw new Error(
          `Produk ${productIndex + 1} minimal memiliki 1 Order.`
        );

      }


      orderItems.forEach(
        (
          orderItem,
          orderIndex
        ) => {

          const cabangId =
            Number(
              orderItem.querySelector(
                ".lokasiSelect"
              )?.value
            );


          const quantity =
            Number(
              orderItem.querySelector(
                ".quantityOrder"
              )?.value
            );


          if (
            !Number.isInteger(
              cabangId
            ) ||
            cabangId <= 0
          ) {

            throw new Error(
              `Lokasi Order ${orderIndex + 1} pada Produk ${productIndex + 1} belum dipilih.`
            );

          }


          if (
            !Number.isFinite(
              quantity
            ) ||
            quantity <= 0
          ) {

            throw new Error(
              `Quantity Order ${orderIndex + 1} pada Produk ${productIndex + 1} tidak valid.`
            );

          }


          const tanggalDO =
            orderItem.querySelector(
              ".tanggalDO"
            )?.value ||
            null;


          // Hitung ulang agar end_date tidak
          // bergantung pada value readonly frontend.

          const endDate =
            tanggalDO
              ? hitungEndDate(
                  tanggalDO,
                  durasiBulan
                )
              : null;


          orders.push({

            id:
              orderItem.dataset.orderId ||
              null,

            cabang_id:
              cabangId,

            quantity:
              quantity,

            no_req_klien:
              orderItem.querySelector(
                ".noReqKlien"
              )?.value?.trim() ||
              null,

            tanggal_req_klien:
              orderItem.querySelector(
                ".tanggalReqKlien"
              )?.value ||
              null,

            tanggal_do:
              tanggalDO,

            no_do:
              orderItem.querySelector(
                ".noDO"
              )?.value?.trim() ||
              null,

            end_date:
              endDate

          });

        }
      );


      result.push({

        // Penting untuk backend menentukan
        // harga kontrak existing.

        id:
          productItem.dataset.productId ||
          null,

        produk_id:
          produkId,

        durasi_bulan:
          durasiBulan,

        orders:
          orders

      });

    }
  );


  return result;

}

// =====================================================
// BUILD PEMBAYARAN
// =====================================================

function buildPembayaranPayload() {
  const result = [];

  if (!paymentContainer) {
    return result;
  }

  const paymentItems = [
    ...paymentContainer
      .querySelectorAll(
        ".payment-item"
      )
  ];

  paymentItems.forEach(
    (
      item,
      index
    ) => {
      const id =
        Number(
          item.dataset
            .paymentId
        ) || null;

      const deskripsi =
        item
          .querySelector(
            ".deskripsiPembayaran"
          )
          ?.value
          ?.trim() || "";

      const nominal =
        angka(
          item
            .querySelector(
              ".nominalPembayaran"
            )
            ?.value
        );

      const statusPembayaran =
        normalisasiStatusPembayaranSewa(
          item
            .querySelector(
              ".statusPembayaran"
            )
            ?.value
        );

      const tanggalBayar =
        item
          .querySelector(
            ".tanggalBayar"
          )
          ?.value ||
        null;

      const syaratPembayaran =
        item
          .querySelector(
            ".syaratPembayaran"
          )
          ?.value
          ?.trim() || "";

      // =============================================
      // ABAIKAN BARIS BARU YANG KOSONG
      // =============================================

      if (
        id === null &&
        !deskripsi &&
        nominal === 0 &&
        !tanggalBayar &&
        !syaratPembayaran
      ) {
        return;
      }

      // =============================================
      // VALIDASI
      // =============================================

      if (!deskripsi) {
        throw new Error(
          `Deskripsi pembayaran ke-${
            index + 1
          } wajib diisi.`
        );
      }

      if (
        !Number.isFinite(
          nominal
        ) ||
        nominal < 0
      ) {
        throw new Error(
          `Nominal pembayaran ke-${
            index + 1
          } tidak valid.`
        );
      }

      const statusValid = [
        "Belum Dibayar",
        "Proses",
        "Sudah Dibayar"
      ];

      if (
        !statusValid.includes(
          statusPembayaran
        )
      ) {
        throw new Error(
          `Status pembayaran ke-${
            index + 1
          } tidak valid.`
        );
      }

      if (
        statusPembayaran ===
          "Sudah Dibayar" &&
        !tanggalBayar
      ) {
        throw new Error(
          `Tanggal bayar pembayaran ke-${
            index + 1
          } wajib diisi karena statusnya Sudah Dibayar.`
        );
      }

      result.push({
        id:
          id,

        deskripsi:
          deskripsi,

        nominal:
          nominal,

        status_pembayaran:
          statusPembayaran,

        tanggal_bayar:
          tanggalBayar,

        syarat_pembayaran:
          syaratPembayaran ||
          null
      });
    }
  );

  return result;
}

// =====================================================
// BUILD RUJUKAN DARI PAYLOAD PRODUK
//
// Jangan hanya percaya input readonly.
// =====================================================

function buildRujukanKontrak(
  produk
) {

  const noReq = [];


  produk.forEach(
    item => {

      (
        item.orders ||
        []
      ).forEach(
        order => {

          const value =
            String(
              order.no_req_klien ||
              ""
            ).trim();


          if (value) {

            noReq.push(
              value
            );

          }

        }
      );

    }
  );


  return [
    ...new Set(noReq)
  ].join(", ");

}

// =====================================================
// SIMPAN TAMBAH
// =====================================================

async function simpanTambah(
  payload
) {

  return fetchJSON(
    "/api/proyek-sewa",
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

}

// =====================================================
// SIMPAN EDIT
//
// Menggunakan API PUT yang sudah kita buat:
// 1. informasi
// 2. produk
// 3. pembayaran
// =====================================================

async function simpanEdit(
  payload
) {

  // ===============================================
  // INFORMASI
  // ===============================================

  await fetchJSON(
    `/api/proyek-sewa/${encodeURIComponent(
      proyekSewaId
    )}/informasi`,
    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
  JSON.stringify({

    nomor_pr:
      payload.nomor_pr,

    tanggal_pr:
      payload.tanggal_pr,

    nomor_rujukan:
      payload.nomor_rujukan,

    proyek_id:
      payload.proyek_id,

    proyek_partner_id:
      payload.proyek_partner_id,

    klien_id:
      payload.klien_id

  })
    }
  );


  // ===============================================
  // PRODUK & ORDER
  // ===============================================

  await fetchJSON(
    `/api/proyek-sewa/${encodeURIComponent(
      proyekSewaId
    )}/produk`,
    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify({
          produk:
            payload.produk
        })
    }
  );


  // ===============================================
  // PEMBAYARAN
  // ===============================================

  await fetchJSON(
    `/api/proyek-sewa/${encodeURIComponent(
      proyekSewaId
    )}/pembayaran`,
    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json"
      },

      body:
        JSON.stringify({
          pembayaran:
            payload.pembayaran
        })
    }
  );


  return {
    success: true
  };

}


// =====================================================
// SUBMIT
// =====================================================

form?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    try {

      // =============================================
      // VALIDASI HEADER
      // =============================================

      const nomorPrValue =
        nomorPr?.value?.trim() ||
        "";


      const klienValue =
        Number(
          klienId?.value
        );


      if (!nomorPrValue) {

        throw new Error(
          "Nomor PR wajib diisi."
        );

      }


      if (
        !Number.isInteger(
          klienValue
        ) ||
        klienValue <= 0
      ) {

        throw new Error(
          "Klien wajib dipilih."
        );

      }


      // =============================================
      // PRODUK
      // =============================================

      const produk =
        buildProdukPayload();


      if (
        produk.length === 0
      ) {

        throw new Error(
          "Minimal harus ada 1 Produk."
        );

      }


      // =============================================
      // RUJUKAN KONTRAK
      // =============================================

      const rujukan =
        buildRujukanKontrak(
          produk
        );


      if (nomorRujukan) {

        nomorRujukan.value =
          rujukan;

      }


      // =============================================
      // PEMBAYARAN
      // =============================================

      const pembayaran =
        buildPembayaranPayload();

const proyekValue =
  proyekId?.value
    ? Number(proyekId.value)
    : null;

const proyekPartnerValue =
  proyekPartnerId?.value
    ? Number(
        proyekPartnerId.value
      )
    : null;

if (
  proyekValue &&
  proyekPartnerId?.required &&
  !proyekPartnerValue
) {
  alert(
    "Partner proyek wajib dipilih."
  );

  proyekPartnerId.focus();

  return;
}
      // =============================================
      // PAYLOAD
      // =============================================

      const payload = {

  nomor_pr:
    nomorPrValue,

  tanggal_pr:
    tanggalPr?.value ||
    null,

  nomor_rujukan:
    rujukan ||
    null,

  proyek_id:
    proyekValue,

  proyek_partner_id:
    proyekPartnerValue,

  klien_id:
    klienValue,

  produk:
    produk,

  pembayaran:
    pembayaran

};
      console.log(
        "PAYLOAD PROYEK SEWA:",
        payload
      );


      // =============================================
      // BUTTON LOADING
      // =============================================

      const originalText =
        btnSimpan?.textContent;


      if (btnSimpan) {

        btnSimpan.disabled =
          true;

        btnSimpan.textContent =
          isEdit
            ? "Menyimpan Perubahan..."
            : "Menyimpan...";

      }


      try {

        if (isEdit) {

          await simpanEdit(
            payload
          );

        } else {

          await simpanTambah(
            payload
          );

        }


        alert(
          isEdit
            ? "Proyek Sewa berhasil diperbarui."
            : "Proyek Sewa berhasil ditambahkan."
        );


        window.location.href =
          "/proyek-sewa.html";


      } finally {

        if (btnSimpan) {

          btnSimpan.disabled =
            false;

          btnSimpan.textContent =
            originalText;

        }

      }


    } catch (error) {

      console.error(
        "ERROR SAVE PROYEK SEWA:",
        error
      );


      alert(
        error.message ||
        "Gagal menyimpan Proyek Sewa."
      );

    }

  }
);

// =====================================================
// BUTTON TAMBAH PRODUK
// =====================================================

btnTambahProduk
  ?.addEventListener(
    "click",
    () => {

      tambahProduk();

    }
  );


// =====================================================
// BUTTON TAMBAH PEMBAYARAN
// =====================================================

btnTambahPembayaran
  ?.addEventListener(
    "click",
    () => {

      tambahPembayaran();

    }
  );


// =====================================================
// PROYEK EXISTING -> KLIEN
//
// Kalau master proyek mengembalikan klien_id,
// pilih klien secara otomatis.
// =====================================================

// =====================================================
// PROYEK EXISTING -> KLIEN DAN PARTNER
// =====================================================

proyekId
  ?.addEventListener(
    "change",
    async () => {

      const selected =
        masterProyek.find(
          item =>
            String(item.id) ===
            String(proyekId.value)
        );

      // Klien otomatis mengikuti proyek
      if (
        selected?.klien_id &&
        klienId
      ) {
        klienId.value =
          selected.klien_id;
      }

      try {

        // Partner mengikuti proyek/kontrak
        await loadPartnerProyekSewa();

      } catch (error) {

        console.error(
          "ERROR LOAD PARTNER PROYEK:",
          error
        );

        alert(error.message);

      }

    }
  );



// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      // =============================================
      // LOAD SEMUA MASTER
      // =============================================

      await Promise.all([
        loadMasterKlien(),
        loadMasterProyek(),
        loadMasterProduk(),
        loadMasterCabang()
      ]);


      // =============================================
      // EDIT
      // =============================================

      if (isEdit) {

        await loadDataEdit();

      }

      // =============================================
      // TAMBAH
      // =============================================

      else {

        tambahProduk();

      }


      console.log(
        isEdit
          ? "FORM EDIT PROYEK SEWA SIAP"
          : "FORM TAMBAH PROYEK SEWA SIAP"
      );


    } catch (error) {

      console.error(
        "ERROR INITIALIZE PROYEK SEWA:",
        error
      );


      alert(
        error.message ||
        "Gagal memuat form Proyek Sewa."
      );

    }

  }
);