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
// =====================================================

async function loadMasterProyek() {

  const result =
    await fetchJSON(
      "/api/proyek-sewa/master/proyek"
    );


  masterProyek =
    Array.isArray(result)
      ? result
      : [];


  if (!proyekId) {
    return;
  }


  proyekId.innerHTML =
    `
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
        item.id;


      option.textContent =
        item.nama_proyek ||
        `Proyek ${item.id}`;


      proyekId.appendChild(
        option
      );

    }
  );

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
// OPTION PRODUK
// =====================================================

function isiProdukSelect(
  select,
  selectedId = null
) {

  if (!select) {
    return;
  }


  select.innerHTML =
    `
      <option value="">
        Pilih Produk
      </option>
    `;


  masterProduk.forEach(
    item => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        item.id;


      option.textContent =
        item.item_produk ||
        item.nama_produk ||
        `Produk ${item.id}`;


      if (
        String(item.id) ===
        String(selectedId)
      ) {

        option.selected =
          true;

      }


      select.appendChild(
        option
      );

    }
  );

}


// =====================================================
// OPTION CABANG
// =====================================================

function isiCabangSelect(
  select,
  selectedId = null
) {

  if (!select) {
    return;
  }


  select.innerHTML =
    `
      <option value="">
        Pilih Lokasi / Cabang
      </option>
    `;


  masterCabang.forEach(
    item => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        item.id;


      option.textContent =
        item.nama_cabang ||
        item.nama ||
        item.cabang ||
        `Cabang ${item.id}`;


      if (
        String(item.id) ===
        String(selectedId)
      ) {

        option.selected =
          true;

      }


      select.appendChild(
        option
      );

    }
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


  if (data) {

    paymentItem.dataset.paymentId =
      data.id ||
      "";


    const deskripsi =
      paymentItem.querySelector(
        ".deskripsiPembayaran"
      );


    const nominal =
      paymentItem.querySelector(
        ".nominalPembayaran"
      );


    const tanggalBayar =
      paymentItem.querySelector(
        ".tanggalBayar"
      );


    if (deskripsi) {

      deskripsi.value =
        data.deskripsi ||
        "";

    }


    if (nominal) {

      nominal.value =
        rupiah(
          data.nominal
        );

    }


    if (tanggalBayar) {

      tanggalBayar.value =
        tanggalInput(
          data.tanggal_bayar
        );

    }

  }


  // ===============================================
  // FORMAT NOMINAL
  // ===============================================

  const nominalInput =
    paymentItem.querySelector(
      ".nominalPembayaran"
    );


  nominalInput
    ?.addEventListener(
      "input",
      event => {

        const value =
          angka(
            event.target.value
          );


        event.target.value =
          value
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


  const paymentItems =
    [
      ...paymentContainer
        .querySelectorAll(
          ".payment-item"
        )
    ];


  paymentItems.forEach(
    item => {

      const deskripsi =
        item.querySelector(
          ".deskripsiPembayaran"
        )?.value?.trim() ||
        "";


      const nominal =
        angka(
          item.querySelector(
            ".nominalPembayaran"
          )?.value
        );


      const tanggalBayar =
        item.querySelector(
          ".tanggalBayar"
        )?.value ||
        null;


      // Abaikan pembayaran benar-benar kosong.

      if (
        !deskripsi &&
        nominal === 0 &&
        !tanggalBayar
      ) {

        return;

      }


      result.push({

        id:
          item.dataset.paymentId ||
          null,

        deskripsi:
          deskripsi,

        nominal:
          nominal,

        tanggal_bayar:
          tanggalBayar

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
          proyekId?.value
            ? Number(
                proyekId.value
              )
            : null,

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

proyekId
  ?.addEventListener(
    "change",
    () => {

      const selected =
        masterProyek.find(
          item =>
            String(item.id) ===
            String(proyekId.value)
        );


      if (
        selected?.klien_id &&
        klienId
      ) {

        klienId.value =
          selected.klien_id;

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