// =====================================================
// PROYEK SEWA FORM
// =====================================================

console.log("PROYEK SEWA FORM JS LOADED");


// =====================================================
// GLOBAL DATA
// =====================================================

let masterKlien = [];
let masterProyek = [];
let masterProdukSewa = [];
let masterCabang = [];

let productCounter = 0;


// =====================================================
// DOM
// =====================================================

const form =
  document.getElementById(
    "proyekSewaForm"
  );

const klienSelect =
  document.getElementById(
    "klienId"
  );

const proyekSelect =
  document.getElementById(
    "proyekId"
  );

const nomorRujukanInput =
  document.getElementById(
    "nomorRujukan"
  );

const productContainer =
  document.getElementById(
    "productContainer"
  );

const paymentContainer =
  document.getElementById(
    "paymentContainer"
  );

const btnTambahProduk =
  document.getElementById(
    "btnTambahProduk"
  );

const btnTambahPembayaran =
  document.getElementById(
    "btnTambahPembayaran"
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

const totalNilaiPerBulanEl =
  document.getElementById(
    "totalNilaiPerBulan"
  );

const grandTotalProyekEl =
  document.getElementById(
    "grandTotalProyek"
  );


// =====================================================
// HELPER
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
    return value;
  }

  const hasil =
    Number(
      String(value)
        .replace(/[^\d.-]/g, "")
    );

  return Number.isFinite(hasil)
    ? hasil
    : 0;

}


function rupiah(value) {

  const number =
    angka(value);

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }
  ).format(number);

}


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


async function fetchJSON(url) {

  const response =
    await fetch(
      url,
      {
        credentials:
          "same-origin"
      }
    );

  let data = null;

  try {

    data =
      await response.json();

  } catch {

    data = null;

  }

  if (
    response.status === 401
  ) {

    window.location.href =
      "/login.html";

    throw new Error(
      "Belum login"
    );

  }

  if (
    !response.ok
  ) {

    throw new Error(
      data?.error ||
      `HTTP ${response.status}`
    );

  }

  return data;

}


// =====================================================
// NORMALISASI RESPONSE API
// =====================================================

function ambilArray(result) {

  if (
    Array.isArray(result)
  ) {
    return result;
  }

  if (
    Array.isArray(result?.data)
  ) {
    return result.data;
  }

  if (
    Array.isArray(result?.rows)
  ) {
    return result.rows;
  }

  return [];

}


// =====================================================
// LOAD MASTER KLIEN
// =====================================================

async function loadMasterKlien() {

  try {

    /*
      Endpoint yang akan kita gunakan:

      GET /api/proyek-sewa/master/klien
    */

    const result =
      await fetchJSON(
        "/api/proyek-sewa/master/klien"
      );

    masterKlien =
      ambilArray(result);

    renderMasterKlien();

  } catch (error) {

    console.error(
      "ERROR LOAD MASTER KLIEN:",
      error
    );

    klienSelect.innerHTML = `
      <option value="">
        Gagal memuat Klien
      </option>
    `;

  }

}


function renderMasterKlien() {

  klienSelect.innerHTML = `
    <option value="">
      Pilih Klien
    </option>
  `;

  masterKlien.forEach(
    (item) => {

      const id =
        item.id;

      const nama =
        item.perusahaan_klien ||
        item.nama_klien ||
        item.name ||
        "-";

      klienSelect.insertAdjacentHTML(
        "beforeend",
        `
          <option
            value="${id}"
          >
            ${escapeHtml(nama)}
          </option>
        `
      );

    }
  );

}


// =====================================================
// LOAD PROYEK EXISTING
// =====================================================

async function loadMasterProyek() {

  try {

    /*
      GET /api/proyek-sewa/master/proyek
    */

    const result =
      await fetchJSON(
        "/api/proyek-sewa/master/proyek"
      );

    masterProyek =
      ambilArray(result);

    renderMasterProyek();

  } catch (error) {

    console.error(
      "ERROR LOAD MASTER PROYEK:",
      error
    );

    proyekSelect.innerHTML = `
      <option value="">
        Gagal memuat proyek
      </option>
    `;

  }

}


function renderMasterProyek() {

  proyekSelect.innerHTML = `
    <option value="">
      Pilih Nama Proyek
    </option>
  `;

  masterProyek.forEach(
    (item) => {

      const nama =
        item.nama_proyek ||
        item.name ||
        `Proyek #${item.id}`;

      proyekSelect.insertAdjacentHTML(
        "beforeend",
        `
          <option
            value="${item.id}"
          >
            ${escapeHtml(nama)}
          </option>
        `
      );

    }
  );

}


// =====================================================
// LOAD MASTER PRODUK SEWA
// =====================================================

async function loadMasterProdukSewa() {

  try {

    /*
      GET /api/proyek-sewa/master/produk
    */

    const result =
      await fetchJSON(
        "/api/proyek-sewa/master/produk"
      );

    masterProdukSewa =
      ambilArray(result);

    console.log(
      "MASTER PRODUK SEWA:",
      masterProdukSewa
    );

    refreshSemuaProdukSelect();

  } catch (error) {

    console.error(
      "ERROR LOAD PRODUK SEWA:",
      error
    );

  }

}


// =====================================================
// LOAD MASTER CABANG
// =====================================================

async function loadMasterCabang() {

  try {

    /*
      GET /api/proyek-sewa/master/cabang
    */

    const result =
      await fetchJSON(
        "/api/proyek-sewa/master/cabang"
      );

    masterCabang =
      ambilArray(result);

    console.log(
      "MASTER CABANG:",
      masterCabang
    );

    refreshSemuaLokasiSelect();

  } catch (error) {

    console.error(
      "ERROR LOAD MASTER CABANG:",
      error
    );

  }

}


// =====================================================
// OPTION PRODUK
// =====================================================

function isiProdukSelect(
  select,
  selectedValue = ""
) {

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">
      Pilih Produk
    </option>
  `;

  masterProdukSewa.forEach(
    (item) => {

      const nama =
        item.item_produk ||
        item.nama_produk ||
        item.name ||
        "-";

      const option =
        document.createElement(
          "option"
        );

      option.value =
        item.id;

      option.textContent =
        nama;

      if (
        String(item.id) ===
        String(selectedValue)
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


function refreshSemuaProdukSelect() {

  document
    .querySelectorAll(
      ".produkSelect"
    )
    .forEach(
      (select) => {

        const value =
          select.value;

        isiProdukSelect(
          select,
          value
        );

      }
    );

}


// =====================================================
// OPTION CABANG
// =====================================================

function isiCabangSelect(
  select,
  selectedValue = ""
) {

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">
      Pilih Lokasi / Cabang
    </option>
  `;

  masterCabang.forEach(
    (item) => {

      const nama =
        item.nama_cabang ||
        item.nama ||
        item.name ||
        item.lokasi ||
        "-";

      const option =
        document.createElement(
          "option"
        );

      option.value =
        item.id;

      option.textContent =
        nama;

      if (
        String(item.id) ===
        String(selectedValue)
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


function refreshSemuaLokasiSelect() {

  document
    .querySelectorAll(
      ".lokasiSelect"
    )
    .forEach(
      (select) => {

        const value =
          select.value;

        isiCabangSelect(
          select,
          value
        );

      }
    );

}


// =====================================================
// TAMBAH PRODUK
// =====================================================

function tambahProduk() {

  if (!productTemplate) {

    console.error(
      "productTemplate tidak ditemukan"
    );

    return;

  }

  productCounter++;

  const fragment =
    productTemplate
      .content
      .cloneNode(true);

  const productItem =
    fragment.querySelector(
      ".product-item"
    );

  productItem.dataset.productIndex =
    productCounter;

  const title =
    productItem.querySelector(
      ".product-title"
    );

  title.textContent =
    `Produk ${productCounter}`;


  // PRODUK SELECT

  const produkSelect =
    productItem.querySelector(
      ".produkSelect"
    );

  isiProdukSelect(
    produkSelect
  );


  // EVENT PRODUK

  produkSelect.addEventListener(
    "change",
    () => {

      updateInformasiProduk(
        productItem
      );

    }
  );


  // EVENT DURASI

  const durasiInput =
    productItem.querySelector(
      ".durasiProduk"
    );

  durasiInput.addEventListener(
    "input",
    () => {

      hitungSemuaOrderProduk(
        productItem
      );

    }
  );


  // TAMBAH ORDER

  const btnOrder =
    productItem.querySelector(
      ".btnTambahOrder"
    );

  btnOrder.addEventListener(
    "click",
    () => {

      tambahOrder(
        productItem
      );

    }
  );


  // HAPUS PRODUK

  const btnHapus =
    productItem.querySelector(
      ".btnHapusProduk"
    );

  btnHapus.addEventListener(
    "click",
    () => {

      productItem.remove();

      updateNomorProduk();

      hitungTotalProyek();

    }
  );


  productContainer.appendChild(
    fragment
  );


  // otomatis 1 order

  tambahOrder(
    productItem
  );


  updateNomorProduk();

}


// =====================================================
// UPDATE NOMOR PRODUK
// =====================================================

function updateNomorProduk() {

  const products =
    [
      ...productContainer
        .querySelectorAll(
          ".product-item"
        )
    ];

  products.forEach(
    (item, index) => {

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
// CARI MASTER PRODUK
// =====================================================

function getProdukById(id) {

  return masterProdukSewa.find(
    (item) =>
      String(item.id) ===
      String(id)
  );

}


// =====================================================
// INFORMASI PRODUK
// =====================================================

function updateInformasiProduk(
  productItem
) {

  const select =
    productItem.querySelector(
      ".produkSelect"
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

  const produk =
    getProdukById(
      select.value
    );


  if (!produk) {

    hargaInput.value =
      rupiah(0);

    hargaInput.dataset.value =
      "0";

    jenisInput.value =
      "Sewa";

    subJenisInput.value =
      "-";

    hitungSemuaOrderProduk(
      productItem
    );

    return;

  }


  /*
    Menyesuaikan beberapa kemungkinan
    nama field master produk.
  */

  const harga =
    angka(
      produk.harga_jual_per_item ??
      produk.harga_jual ??
      produk.harga ??
      0
    );


  const jenis =
    produk.jenis_proyek ||
    produk.jenis_proyek_name ||
    "Sewa";


  const subJenis =
    produk.sub_jenis_proyek ||
    produk.sub_jenis_proyek_name ||
    produk.nama_sub_jenis ||
    "-";


  hargaInput.value =
    rupiah(harga);

  hargaInput.dataset.value =
    String(harga);

  jenisInput.value =
    jenis;

  subJenisInput.value =
    subJenis;


  hitungSemuaOrderProduk(
    productItem
  );

}


// =====================================================
// TAMBAH ORDER
// =====================================================

function tambahOrder(
  productItem
) {

  if (!orderTemplate) {

    console.error(
      "orderTemplate tidak ditemukan"
    );

    return;

  }

  const orderContainer =
    productItem.querySelector(
      ".order-container"
    );

  const fragment =
    orderTemplate
      .content
      .cloneNode(true);

  const orderItem =
    fragment.querySelector(
      ".order-item"
    );


  // CABANG

  const lokasiSelect =
    orderItem.querySelector(
      ".lokasiSelect"
    );

  isiCabangSelect(
    lokasiSelect
  );


  // QUANTITY

  const quantity =
    orderItem.querySelector(
      ".quantityOrder"
    );

  quantity.addEventListener(
    "input",
    () => {

      hitungOrder(
        productItem,
        orderItem
      );

    }
  );


  // HAPUS ORDER

  const btnHapus =
    orderItem.querySelector(
      ".btnHapusOrder"
    );

  btnHapus.addEventListener(
    "click",
    () => {

      orderItem.remove();

      hitungTotalProyek();

    }
  );


  orderContainer.appendChild(
    fragment
  );


  hitungOrder(
    productItem,
    orderItem
  );

}


// =====================================================
// HITUNG ORDER
// =====================================================

function hitungOrder(
  productItem,
  orderItem
) {

  const hargaProdukEl =
    productItem.querySelector(
      ".hargaProduk"
    );

  const durasiEl =
    productItem.querySelector(
      ".durasiProduk"
    );

  const quantityEl =
    orderItem.querySelector(
      ".quantityOrder"
    );

  const hargaPerBulanEl =
    orderItem.querySelector(
      ".hargaPerBulan"
    );

  const totalHargaEl =
    orderItem.querySelector(
      ".totalHargaOrder"
    );


  const hargaProduk =
    angka(
      hargaProdukEl?.dataset.value
    );

  const quantity =
    angka(
      quantityEl?.value
    );

  const durasi =
    angka(
      durasiEl?.value
    );


  // QTY x HARGA ITEM

  const hargaPerBulan =
    quantity *
    hargaProduk;


  // HARGA PER BULAN x DURASI

  const totalHarga =
    hargaPerBulan *
    durasi;


  hargaPerBulanEl.value =
    rupiah(
      hargaPerBulan
    );

  hargaPerBulanEl.dataset.value =
    String(
      hargaPerBulan
    );


  totalHargaEl.value =
    rupiah(
      totalHarga
    );

  totalHargaEl.dataset.value =
    String(
      totalHarga
    );


  hitungTotalProyek();

}


// =====================================================
// HITUNG SEMUA ORDER DALAM PRODUK
// =====================================================

function hitungSemuaOrderProduk(
  productItem
) {

  productItem
    .querySelectorAll(
      ".order-item"
    )
    .forEach(
      (orderItem) => {

        hitungOrder(
          productItem,
          orderItem
        );

      }
    );

}


// =====================================================
// HITUNG TOTAL PROYEK
// =====================================================

function hitungTotalProyek() {

  let totalPerBulan = 0;
  let grandTotal = 0;


  document
    .querySelectorAll(
      ".order-item"
    )
    .forEach(
      (orderItem) => {

        const hargaPerBulan =
          orderItem.querySelector(
            ".hargaPerBulan"
          );

        const totalHarga =
          orderItem.querySelector(
            ".totalHargaOrder"
          );


        totalPerBulan +=
          angka(
            hargaPerBulan?.dataset.value
          );


        grandTotal +=
          angka(
            totalHarga?.dataset.value
          );

      }
    );


  totalNilaiPerBulanEl.textContent =
    rupiah(
      totalPerBulan
    );


  grandTotalProyekEl.textContent =
    rupiah(
      grandTotal
    );


  totalNilaiPerBulanEl.dataset.value =
    String(
      totalPerBulan
    );


  grandTotalProyekEl.dataset.value =
    String(
      grandTotal
    );

}


// =====================================================
// TAMBAH PEMBAYARAN
// =====================================================

function tambahPembayaran() {

  if (!paymentTemplate) {

    console.error(
      "paymentTemplate tidak ditemukan"
    );

    return;

  }

  const fragment =
    paymentTemplate
      .content
      .cloneNode(true);

  const paymentItem =
    fragment.querySelector(
      ".payment-item"
    );

  const btnHapus =
    paymentItem.querySelector(
      ".btnHapusPembayaran"
    );


  btnHapus.addEventListener(
    "click",
    () => {

      paymentItem.remove();

    }
  );


  paymentContainer.appendChild(
    fragment
  );

}


// =====================================================
// PROYEK EXISTING
// =====================================================

proyekSelect?.addEventListener(
  "change",
  () => {

    const proyek =
      masterProyek.find(
        (item) =>
          String(item.id) ===
          String(proyekSelect.value)
      );


    if (!proyek) {
      return;
    }


    /*
      Jika endpoint nanti mengembalikan
      nomor rujukan proyek, otomatis isi.
    */

    if (
      proyek.nomor_rujukan
    ) {

      nomorRujukanInput.value =
        proyek.nomor_rujukan;

    }


    /*
      Kalau proyek punya klien_id,
      otomatis pilih klien.
    */

    if (
      proyek.klien_id
    ) {

      klienSelect.value =
        String(
          proyek.klien_id
        );

    }

  }
);


// =====================================================
// BUTTON
// =====================================================

btnTambahProduk?.addEventListener(
  "click",
  () => {

    tambahProduk();

  }
);


btnTambahPembayaran?.addEventListener(
  "click",
  () => {

    tambahPembayaran();

  }
);


// =====================================================
// BUILD PAYLOAD
// =====================================================

function buildPayload() {

  const produk = [];


  productContainer
    .querySelectorAll(
      ".product-item"
    )
    .forEach(
      (productItem) => {

        const produkId =
          productItem.querySelector(
            ".produkSelect"
          )?.value;


        const durasi =
          angka(
            productItem.querySelector(
              ".durasiProduk"
            )?.value
          );


        const harga =
          angka(
            productItem.querySelector(
              ".hargaProduk"
            )?.dataset.value
          );


        const jenisProyek =
          productItem.querySelector(
            ".jenisProyek"
          )?.value || "Sewa";


        const subJenisProyek =
          productItem.querySelector(
            ".subJenisProyek"
          )?.value || "";


        const orders = [];


        productItem
          .querySelectorAll(
            ".order-item"
          )
          .forEach(
            (orderItem) => {

              orders.push({

                cabang_id:
                  Number(
                    orderItem.querySelector(
                      ".lokasiSelect"
                    )?.value
                  ) || null,

                quantity:
                  angka(
                    orderItem.querySelector(
                      ".quantityOrder"
                    )?.value
                  ),

                harga_per_bulan:
                  angka(
                    orderItem.querySelector(
                      ".hargaPerBulan"
                    )?.dataset.value
                  ),

                total_harga:
                  angka(
                    orderItem.querySelector(
                      ".totalHargaOrder"
                    )?.dataset.value
                  )

              });

            }
          );


        produk.push({

          produk_id:
            Number(
              produkId
            ) || null,

          harga_per_item:
            harga,

          jenis_proyek:
            jenisProyek,

          sub_jenis_proyek:
            subJenisProyek,

          durasi_bulan:
            durasi,

          orders:
            orders

        });

      }
    );


  // PEMBAYARAN

  const pembayaran = [];


  paymentContainer
    .querySelectorAll(
      ".payment-item"
    )
    .forEach(
      (paymentItem) => {

        pembayaran.push({

          deskripsi:
            paymentItem.querySelector(
              ".deskripsiPembayaran"
            )?.value
              ?.trim() || "",

        

          tanggal_bayar:
            paymentItem.querySelector(
              ".tanggalBayar"
            )?.value || null

        });

      }
    );


  return {

    nomor_pr:
      document.getElementById(
        "nomorPr"
      )?.value
        ?.trim() || "",

    nomor_rujukan:
      nomorRujukanInput
        ?.value
        ?.trim() || "",

    proyek_id:
      Number(
        proyekSelect?.value
      ) || null,

    klien_id:
      Number(
        klienSelect?.value
      ) || null,

    total_nilai_per_bulan:
      angka(
        totalNilaiPerBulanEl
          ?.dataset.value
      ),

    total_nilai:
      angka(
        grandTotalProyekEl
          ?.dataset.value
      ),

    produk:
      produk,

    pembayaran:
      pembayaran

  };

}


// =====================================================
// VALIDASI SEBELUM SIMPAN
// =====================================================

function validasiPayload(
  payload
) {

  if (
    !payload.nomor_pr
  ) {

    alert(
      "Nomor PR wajib diisi."
    );

    return false;

  }


  if (
    !payload.klien_id
  ) {

    alert(
      "Klien wajib dipilih."
    );

    return false;

  }


  /*
    Salah satu:
    nomor rujukan manual
    ATAU proyek existing
  */

  if (
    !payload.nomor_rujukan &&
    !payload.proyek_id
  ) {

    alert(
      "Isi Rujukan Kontrak Nomor atau pilih Proyek yang sudah ada."
    );

    return false;

  }


  if (
    payload.produk.length === 0
  ) {

    alert(
      "Minimal tambahkan 1 produk."
    );

    return false;

  }


  for (
    let i = 0;
    i < payload.produk.length;
    i++
  ) {

    const item =
      payload.produk[i];


    if (
      !item.produk_id
    ) {

      alert(
        `Produk ${i + 1} belum dipilih.`
      );

      return false;

    }


    if (
      item.durasi_bulan <= 0
    ) {

      alert(
        `Durasi Produk ${i + 1} wajib lebih dari 0 bulan.`
      );

      return false;

    }


    if (
      item.orders.length === 0
    ) {

      alert(
        `Produk ${i + 1} belum memiliki order.`
      );

      return false;

    }


    for (
      let j = 0;
      j < item.orders.length;
      j++
    ) {

      const order =
        item.orders[j];


      if (
        !order.cabang_id
      ) {

        alert(
          `Lokasi Order ${j + 1} pada Produk ${i + 1} belum dipilih.`
        );

        return false;

      }


      if (
        order.quantity <= 0
      ) {

        alert(
          `Quantity Order ${j + 1} pada Produk ${i + 1} harus lebih dari 0.`
        );

        return false;

      }

    }

  }


  return true;

}


// =====================================================
// SUBMIT
// =====================================================

form?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const payload =
      buildPayload();


    console.log(
      "PAYLOAD PROYEK SEWA:",
      payload
    );


    if (
      !validasiPayload(
        payload
      )
    ) {

      return;

    }


    const btnSimpan =
      document.getElementById(
        "btnSimpanProyekSewa"
      );


    const textAwal =
      btnSimpan?.textContent;


    try {

      if (btnSimpan) {

        btnSimpan.disabled =
          true;

        btnSimpan.textContent =
          "Menyimpan...";

      }


      const response =
        await fetch(
          "/api/proyek-sewa",
          {
            method:
              "POST",

            credentials:
              "same-origin",

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
          .catch(
            () => ({})
          );


      if (
        !response.ok
      ) {

        throw new Error(
          result.error ||
          "Gagal menyimpan proyek sewa."
        );

      }


      alert(
        "Proyek sewa berhasil disimpan."
      );


      window.location.href =
        "/proyek-sewa.html";


    } catch (error) {

      console.error(
        "ERROR SAVE PROYEK SEWA:",
        error
      );


      alert(
        error.message ||
        "Gagal menyimpan proyek sewa."
      );


    } finally {

      if (btnSimpan) {

        btnSimpan.disabled =
          false;

        btnSimpan.textContent =
          textAwal ||
          "Simpan Proyek Sewa";

      }

    }

  }
);


// =====================================================
// INITIALIZE
// =====================================================

async function initialize() {

  console.log(
    "INITIALIZE PROYEK SEWA FORM"
  );


  /*
    Load seluruh master bersamaan.
  */

  await Promise.all([
    loadMasterKlien(),
    loadMasterProyek(),
    loadMasterProdukSewa(),
    loadMasterCabang()
  ]);


  /*
    Saat pertama dibuka:
    otomatis munculkan 1 Produk.
  */

  if (
    productContainer &&
    productContainer.children.length === 0
  ) {

    tambahProduk();

  }


  hitungTotalProyek();

}


// =====================================================
// START
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  initialize
);