// =====================================================
// PROYEK SEWA DETAIL
// =====================================================


// =====================================================
// ID DARI URL
// =====================================================

const params =
  new URLSearchParams(
    window.location.search
  );


const proyekSewaId =
  params.get("id");


// =====================================================
// GLOBAL DATA
// =====================================================

let detailProyekSewa =
  null;


let masterKlien =
  [];


let masterProyek =
  [];


let masterProduk =
  [];


let masterCabang =
  [];


let modeEditProduk =
  false;


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


  let text =
    String(value)
      .trim()
      .replace(/[^\d,.-]/g, "");


  if (!text) {
    return 0;
  }


  // format Indonesia:
  // 1.000.000
  if (
    text.includes(".") &&
    !text.includes(",")
  ) {

    const parts =
      text.split(".");


    const semuaRibuan =
      parts
        .slice(1)
        .every(
          part =>
            part.length === 3
        );


    if (semuaRibuan) {

      text =
        parts.join("");

    }

  }


  // 1.000.000,50
  if (
    text.includes(",")
  ) {

    text =
      text
        .replace(/\./g, "")
        .replace(",", ".");

  }


  const result =
    Number(text);


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
// FORMAT TANGGAL
// =====================================================

function formatTanggal(value) {

  if (!value) {
    return "-";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }


  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  ).format(date);

}


// =====================================================
// FORMAT TANGGAL UNTUK INPUT
// =====================================================

function tanggalInput(value) {

  if (!value) {
    return "";
  }


  const text =
    String(value);


  // Kalau dari postgres sudah YYYY-MM-DD
  if (
    /^\d{4}-\d{2}-\d{2}/.test(text)
  ) {

    return text.substring(
      0,
      10
    );

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
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

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
      {
        credentials:
          "same-origin",

        ...options
      }
    );


  if (
    response.status === 401
  ) {

    window.location.href =
      "/login.html";

    throw new Error(
      "Belum login."
    );

  }


  const text =
    await response.text();


  let result = {};


  if (text) {

    try {

      result =
        JSON.parse(text);

    } catch (error) {

      console.error(
        "RESPONSE BUKAN JSON:",
        text
      );


      throw new Error(
        "Response server bukan JSON."
      );

    }

  }


  if (!response.ok) {

    throw new Error(
      result.error ||
      result.message ||
      "Terjadi kesalahan pada server."
    );

  }


  return result;

}


// =====================================================
// MODAL
// =====================================================

function bukaModal(id) {

  document
    .getElementById(id)
    ?.classList
    .add("show");

}


function tutupModal(id) {

  document
    .getElementById(id)
    ?.classList
    .remove("show");

}


// =====================================================
// CLOSE MODAL
// =====================================================

document.addEventListener(
  "click",
  event => {

    const closeButton =
      event.target.closest(
        "[data-close-modal]"
      );


    if (closeButton) {

      const id =
        closeButton.dataset
          .closeModal;


      tutupModal(id);

      return;

    }


    if (
      event.target.classList
        .contains(
          "modal-overlay"
        )
    ) {

      event.target
        .classList
        .remove("show");

    }

  }
);


// =====================================================
// LOAD MASTER
// =====================================================

async function loadMasterEdit() {

  const [
    klienResult,
    proyekResult,
    produkResult,
    cabangResult
  ] =
    await Promise.all([

      fetchJSON(
        "/api/proyek-sewa/master/klien"
      ),

      fetchJSON(
        "/api/proyek-sewa/master/proyek"
      ),

      fetchJSON(
        "/api/proyek-sewa/master/produk"
      ),

      fetchJSON(
        "/api/proyek-sewa/master/cabang"
      )

    ]);


  masterKlien =
    Array.isArray(
      klienResult
    )
      ? klienResult
      : [];


  masterProyek =
    Array.isArray(
      proyekResult
    )
      ? proyekResult
      : [];


  masterProduk =
    Array.isArray(
      produkResult
    )
      ? produkResult
      : [];


  masterCabang =
    Array.isArray(
      cabangResult
    )
      ? cabangResult
      : [];


  console.log(
    "MASTER PRODUK:",
    masterProduk
  );


  console.log(
    "MASTER CABANG:",
    masterCabang
  );

}


// =====================================================
// LOAD DETAIL
// =====================================================

async function loadDetail() {

  if (!proyekSewaId) {

    alert(
      "ID Proyek Sewa tidak ditemukan."
    );


    window.location.href =
      "/proyek-sewa.html";


    return;

  }


  try {

    const result =
      await fetchJSON(
        `/api/proyek-sewa/${encodeURIComponent(
          proyekSewaId
        )}/detail`
      );


    console.log(
      "DETAIL PROYEK SEWA:",
      result
    );


    detailProyekSewa =
      result;


    renderDetail(
      result
    );


  } catch (error) {

    console.error(
      "ERROR LOAD DETAIL:",
      error
    );


    alert(
      error.message
    );

  }

}


// =====================================================
// RENDER DETAIL
// =====================================================

function renderDetail(result) {

  const proyek =
    result?.proyek ||
    {};


  const produk =
    Array.isArray(
      result?.produk
    )
      ? result.produk
      : [];


  const pembayaran =
    Array.isArray(
      result?.pembayaran
    )
      ? result.pembayaran
      : [];


  // =============================================
  // HEADER
  // =============================================

  document.getElementById(
    "detailTitle"
  ).textContent =
    proyek.nomor_pr
      ? `Detail ${proyek.nomor_pr}`
      : "Detail Proyek Sewa";


  document.getElementById(
    "detailSubtitle"
  ).textContent =
    proyek.nama_klien ||
    proyek.perusahaan_klien ||
    "Detail proyek sewa";


  // =============================================
  // EDIT LINK
  // =============================================

  const btnEdit =
    document.getElementById(
      "btnEditProyekSewa"
    );


  if (btnEdit) {

    btnEdit.href =
      `/proyek-sewa-form.html?id=${encodeURIComponent(
        proyekSewaId
      )}`;

  }


  // =============================================
  // SUMMARY
  // =============================================

  const totalProyek =
    angka(
      proyek.total_nilai
    );


  const totalPerBulan =
    angka(
      proyek.total_nilai_per_bulan
    );


  const totalDibayar =
    pembayaran.reduce(
      (
        total,
        item
      ) =>
        total +
        angka(
          item.nominal
        ),
      0
    );


  const sisa =
    Math.max(
      0,
      totalProyek -
      totalDibayar
    );


  setText(
    "summaryPerBulan",
    rupiah(
      totalPerBulan
    )
  );


  setText(
    "summaryTotal",
    rupiah(
      totalProyek
    )
  );


  setText(
    "summaryDibayar",
    rupiah(
      totalDibayar
    )
  );


  setText(
    "summarySisa",
    rupiah(
      sisa
    )
  );


  // =============================================
  // INFORMASI
  // =============================================

  setText(
    "detailNomorPr",
    proyek.nomor_pr ||
    "-"
  );


  setText(
    "detailRujukan",
    proyek.nomor_rujukan ||
    "-"
  );


  setText(
    "detailKlien",
    proyek.nama_klien ||
    proyek.perusahaan_klien ||
    "-"
  );


  setText(
    "detailProyek",
    proyek.nama_proyek ||
    "-"
  );


  setText(
    "detailCreatedAt",
    formatTanggal(
      proyek.created_at
    )
  );


  setText(
    "detailUpdatedAt",
    formatTanggal(
      proyek.updated_at
    )
  );


  // =============================================
  // PRODUK
  // =============================================

  renderProduk(
  produk
);


renderTotalProduk();

  // =============================================
  // PEMBAYARAN
  // =============================================

  renderPembayaran(
    pembayaran,
    totalProyek
  );

}


// =====================================================
// SET TEXT
// =====================================================

function setText(
  id,
  value
) {

  const element =
    document.getElementById(
      id
    );


  if (element) {

    element.textContent =
      value;

  }

}


// =====================================================
// OPTION PRODUK
// =====================================================

function buatProdukOptions(
  selectedId = null
) {

  return `
    <option value="">
      Pilih Produk
    </option>

    ${masterProduk
      .map(
        item => {

          const selected =
            String(item.id) ===
            String(selectedId)
              ? "selected"
              : "";


          return `
            <option
              value="${item.id}"
              ${selected}
            >
              ${escapeHtml(
                item.item_produk ||
                "-"
              )}
            </option>
          `;

        }
      )
      .join("")}
  `;

}


// =====================================================
// OPTION CABANG
// =====================================================

function buatCabangOptions(
  selectedId = null
) {

  return `
    <option value="">
      Pilih Lokasi
    </option>

    ${masterCabang
      .map(
        item => {

          const selected =
            String(item.id) ===
            String(selectedId)
              ? "selected"
              : "";


          return `
            <option
              value="${item.id}"
              ${selected}
            >
              ${escapeHtml(
                item.nama_cabang ||
                item.nama ||
                item.cabang ||
                "-"
              )}
            </option>
          `;

        }
      )
      .join("")}
  `;

}


// =====================================================
// RENDER PRODUK
// =====================================================

function renderProduk(
  produk
) {

  const container =
    document.getElementById(
      "productEditContainer"
    );


  if (!container) {
    return;
  }


  if (
    !Array.isArray(produk) ||
    produk.length === 0
  ) {

    container.innerHTML = `
      <div class="message">
        Belum ada produk.
      </div>
    `;


    if (modeEditProduk) {

      hitungSemuaProduk();

    }


    return;

  }


  container.innerHTML =
    produk
      .map(
        (
          item,
          index
        ) =>
          buatProdukInline(
            item,
            index
          )
      )
      .join("");


  if (modeEditProduk) {

    container
      .querySelectorAll(
        ".inline-product-card"
      )
      .forEach(
        product => {

          hitungProdukInline(
            product,
            false
          );

        }
      );


    hitungSemuaProduk();

  }

}


// =====================================================
// PRODUK HTML
// =====================================================

function buatProdukInline(
  item = {},
  index = 0
) {

  const orders =
    Array.isArray(
      item.orders
    )
      ? item.orders
      : [];


  // ===================================================
  // MODE LIHAT
  // ===================================================

  if (!modeEditProduk) {

    return `
      <div
        class="inline-product-card"
        data-product-id="${item.id || ""}"
      >

        <div class="inline-product-header">

          <div class="inline-product-title">
            Produk ${index + 1}
          </div>

        </div>


        <div class="inline-product-body">


          <div class="inline-product-grid">


            <div class="inline-form-group">

              <label>
                Produk
              </label>

              <div class="inline-view-value">
                ${escapeHtml(
                  item.item_produk ||
                  "-"
                )}
              </div>

            </div>


            <div class="inline-form-group">

              <label>
                Harga / Item / Bulan
              </label>

              <div class="inline-view-value">
                ${rupiah(
                  item.harga_per_item
                )}
              </div>

            </div>


            <div class="inline-form-group">

              <label>
                Sub Jenis Proyek
              </label>

              <div class="inline-view-value">
                ${escapeHtml(
                  item.sub_jenis_proyek ||
                  "-"
                )}
              </div>

            </div>


            <div class="inline-form-group">

              <label>
                Durasi
              </label>

              <div class="inline-view-value">
                ${angka(
                  item.durasi_bulan
                )} Bulan
              </div>

            </div>


          </div>


          <div class="inline-order-section">


            <div class="inline-order-header">

              <h3>
                Order
              </h3>

            </div>


            <div class="inline-order-list">

              ${
                orders.length > 0

                  ? orders
                      .map(
                        order =>
                          buatOrderInlineView(
                            order
                          )
                      )
                      .join("")

                  : `
                    <div class="message">
                      Belum ada order.
                    </div>
                  `
              }

            </div>


          </div>


        </div>

      </div>
    `;

  }


  // ===================================================
  // MODE EDIT
  // ===================================================

 return `
  <div
    class="inline-product-card"

    data-product-id="${item.id || ""}"

    data-original-produk-id="${
      item.produk_id || ""
    }"

    data-original-harga="${
      angka(
        item.harga_per_item
      )
    }"
  >

      <div class="inline-product-header">

        <div class="inline-product-title">
          Produk ${index + 1}
        </div>


        <button
          type="button"
          class="btn btn-danger btnHapusProdukInline"
        >
          Hapus Produk
        </button>

      </div>


      <div class="inline-product-body">


        <div class="inline-product-grid">


          <div class="inline-form-group">

            <label>
              Produk
            </label>

            <select
              class="inline-control inlineProdukSelect"
              required
            >

              ${buatProdukOptions(
                item.produk_id
              )}

            </select>

          </div>


          <div class="inline-form-group">

            <label>
              Harga / Item / Bulan
            </label>

            <input
              type="text"
              class="inline-control inlineHargaItem"
              value="${rupiah(
                item.harga_per_item
              )}"
              readonly
            >

          </div>


          <div class="inline-form-group">

            <label>
              Sub Jenis Proyek
            </label>

            <input
              type="text"
              class="inline-control inlineSubJenis"
              value="${escapeHtml(
                item.sub_jenis_proyek ||
                ""
              )}"
              readonly
            >

          </div>


          <div class="inline-form-group">

            <label>
              Durasi
            </label>

            <input
              type="number"
              min="1"
              class="inline-control inlineDurasi"
              value="${Math.max(
                1,
                angka(
                  item.durasi_bulan
                )
              )}"
              required
            >

          </div>


        </div>


        <div class="inline-order-section">


          <div class="inline-order-header">

            <h3>
              Order
            </h3>


            <button
              type="button"
              class="btn btn-secondary btnTambahOrderInline"
            >
              + Tambah Order
            </button>

          </div>


          <div class="inline-order-list">

            ${orders
              .map(
                order =>
                  buatOrderInline(
                    order
                  )
              )
              .join("")}

          </div>


        </div>


      </div>

    </div>
  `;

}


// =====================================================
// ORDER MODE LIHAT
// =====================================================

function buatOrderInlineView(
  order = {}
) {

  return `
    <div class="inline-order-row">


      <div class="inline-form-group">

        <label>
          Lokasi
        </label>

        <div class="inline-view-value">
          ${escapeHtml(
            order.nama_cabang ||
            order.nama ||
            order.cabang ||
            "-"
          )}
        </div>

      </div>


      <div class="inline-form-group">

        <label>
          Quantity
        </label>

        <div class="inline-view-value">
          ${angka(
            order.quantity
          )}
        </div>

      </div>


      <div class="inline-form-group">

        <label>
          Harga / Bulan
        </label>

        <div class="inline-view-value">
          ${rupiah(
            order.harga_per_bulan
          )}
        </div>

      </div>


      <div class="inline-form-group">

        <label>
          Total Harga
        </label>

        <div class="inline-view-value">
          ${rupiah(
            order.total_harga
          )}
        </div>

      </div>


    </div>
  `;

}


// =====================================================
// ORDER MODE EDIT
// =====================================================

function buatOrderInline(
  order = {}
) {

  return `
    <div
      class="inline-order-row"
      data-order-id="${order.id || ""}"
      data-harga-per-bulan="${angka(
        order.harga_per_bulan
      )}"
      data-total-harga="${angka(
        order.total_harga
      )}"
    >


      <div class="inline-form-group">

        <label>
          Lokasi
        </label>

        <select
          class="inline-control inlineCabang"
          required
        >

          ${buatCabangOptions(
            order.cabang_id
          )}

        </select>

      </div>


      <div class="inline-form-group">

        <label>
          Quantity
        </label>

        <input
          type="number"
          min="1"
          class="inline-control inlineQuantity"
          value="${Math.max(
            1,
            angka(
              order.quantity
            )
          )}"
          required
        >

      </div>


      <div class="inline-form-group">

        <label>
          Harga / Bulan
        </label>

        <input
          type="text"
          class="inline-control inlineHargaBulan"
          value="${rupiah(
            order.harga_per_bulan
          )}"
          readonly
        >

      </div>


      <div class="inline-form-group">

        <label>
          Total Harga
        </label>

        <input
          type="text"
          class="inline-control inlineTotalHarga"
          value="${rupiah(
            order.total_harga
          )}"
          readonly
        >

      </div>


      <div class="inline-form-group">

        <label>
          &nbsp;
        </label>

        <button
          type="button"
          class="btn btn-danger btnHapusOrderInline"
        >
          Hapus
        </button>

      </div>


    </div>
  `;

}


// =====================================================
// HITUNG SATU PRODUK
// =====================================================

function hitungProdukInline(
  product,
  updateGrandTotal = true
) {

  if (!product) {
    return;
  }


  const produkSelect =
    product.querySelector(
      ".inlineProdukSelect"
    );


  const produkId =
    produkSelect?.value;


  const master =
    masterProduk.find(
      item =>
        String(item.id) ===
        String(produkId)
    );


  // =============================================
// TENTUKAN HARGA
// =============================================

const originalProdukId =
  product.dataset
    .originalProdukId;


const originalHarga =
  angka(
    product.dataset
      .originalHarga
  );


let hargaItem = 0;


// =============================================
// PRODUK EXISTING DAN TIDAK DIGANTI
// =============================================

if (
  product.dataset.productId &&
  String(produkId) ===
  String(originalProdukId)
) {

  hargaItem =
    originalHarga;

}


// =============================================
// PRODUK BARU / PRODUK DIGANTI
// =============================================

else {

  hargaItem =
    angka(
      master
        ?.harga_jual_per_item
    );

}


  const hargaInput =
    product.querySelector(
      ".inlineHargaItem"
    );


  if (hargaInput) {

    hargaInput.value =
      rupiah(
        hargaItem
      );

  }


  const subJenisInput =
    product.querySelector(
      ".inlineSubJenis"
    );


  if (subJenisInput) {

    subJenisInput.value =
      master
        ?.sub_jenis_proyek ||
      master
        ?.nama_sub_jenis_proyek ||
      "";

  }


  const durasiInput =
    product.querySelector(
      ".inlineDurasi"
    );


  const durasi =
    Math.max(
      1,
      angka(
        durasiInput?.value
      )
    );


  product
    .querySelectorAll(
      ".inline-order-row"
    )
    .forEach(
      order => {

        const quantityInput =
          order.querySelector(
            ".inlineQuantity"
          );


        const qty =
          Math.max(
            0,
            angka(
              quantityInput?.value
            )
          );


        const hargaPerBulan =
          qty *
          hargaItem;


        const totalHarga =
          hargaPerBulan *
          durasi;


        order.dataset
          .hargaPerBulan =
            hargaPerBulan;


        order.dataset
          .totalHarga =
            totalHarga;


        const hargaBulanInput =
          order.querySelector(
            ".inlineHargaBulan"
          );


        if (hargaBulanInput) {

          hargaBulanInput.value =
            rupiah(
              hargaPerBulan
            );

        }


        const totalHargaInput =
          order.querySelector(
            ".inlineTotalHarga"
          );


        if (totalHargaInput) {

          totalHargaInput.value =
            rupiah(
              totalHarga
            );

        }

      }
    );


  if (updateGrandTotal) {

    hitungSemuaProduk();

  }

}


// =====================================================
// HITUNG TOTAL SEMUA PRODUK
// =====================================================

function hitungSemuaProduk() {

  let totalPerBulan =
    0;


  let totalProyek =
    0;


  document
    .querySelectorAll(
      "#productEditContainer .inline-order-row"
    )
    .forEach(
      order => {

        totalPerBulan +=
          angka(
            order.dataset
              .hargaPerBulan
          );


        totalProyek +=
          angka(
            order.dataset
              .totalHarga
          );

      }
    );


  setText(
    "editTotalPerBulan",
    rupiah(
      totalPerBulan
    )
  );


  setText(
    "editTotalProyek",
    rupiah(
      totalProyek
    )
  );

}


// =====================================================
// UPDATE NOMOR PRODUK
// =====================================================

function updateNomorProduk() {

  document
    .querySelectorAll(
      "#productEditContainer .inline-product-card"
    )
    .forEach(
      (
        product,
        index
      ) => {

        const title =
          product.querySelector(
            ".inline-product-title"
          );


        if (title) {

          title.textContent =
            `Produk ${index + 1}`;

        }

      }
    );

}


// =====================================================
// MASUK MODE EDIT PRODUK
// =====================================================

document
  .getElementById(
    "btnBatalEditProduk"
  )
  ?.addEventListener(
    "click",
    () => {

      modeEditProduk =
        false;


// =====================================================
// AKTIFKAN MODE EDIT PRODUK & ORDER
// =====================================================

async function aktifkanEditProduk() {

  try {

    console.log(
      "KLIK EDIT PRODUK & ORDER"
    );


    // LOAD MASTER JIKA BELUM ADA
    if (
      masterProduk.length === 0 ||
      masterCabang.length === 0
    ) {

      await loadMasterEdit();

    }


    modeEditProduk =
      true;


    // =============================================
    // BUTTON
    // =============================================

    const btnEdit =
      document.getElementById(
        "btnEditProduk"
      );


    const btnTambah =
      document.getElementById(
        "btnTambahProduk"
      );


    const actions =
      document.getElementById(
        "produkEditActions"
      );


    if (btnEdit) {

      btnEdit.style.display =
        "none";

    }


    if (btnTambah) {

      btnTambah.style.display =
        "";

    }


    if (actions) {

      actions.style.display =
        "flex";

    }


    // =============================================
    // SUMMARY TETAP TAMPIL
    // =============================================

    const summary =
      document.getElementById(
        "produkEditSummary"
      );


    if (summary) {

      summary.style.display =
        "block";

    }


    // =============================================
    // RENDER ULANG MENJADI FORM EDIT
    // =============================================

    renderProduk(
      detailProyekSewa?.produk ||
      []
    );


    console.log(
      "MODE EDIT PRODUK:",
      modeEditProduk
    );


  } catch (error) {

    console.error(
      "ERROR AKTIFKAN EDIT PRODUK:",
      error
    );


    alert(
      error.message ||
      "Gagal membuka edit Produk & Order."
    );

  }

}

    }
  );



// =====================================================
// BATAL EDIT PRODUK
// =====================================================

document
  .getElementById(
    "btnBatalEditProduk"
  )
  ?.addEventListener(
    "click",
    () => {

      modeEditProduk =
        false;


      document.getElementById(
        "btnEditProduk"
      ).style.display =
        "";


      document.getElementById(
        "btnTambahProduk"
      ).style.display =
        "none";


      document.getElementById(
        "produkEditSummary"
      ).style.display =
        "none";


      document.getElementById(
        "produkEditActions"
      ).style.display =
        "none";


      renderProduk(
        detailProyekSewa
          ?.produk ||
        []
      );

    }
  );


// =====================================================
// TAMBAH PRODUK
// =====================================================

document
  .getElementById(
    "btnTambahProduk"
  )
  ?.addEventListener(
    "click",
    () => {

      if (!modeEditProduk) {
        return;
      }


      const container =
        document.getElementById(
          "productEditContainer"
        );


      if (!container) {
        return;
      }


      container
        .querySelector(
          ".message"
        )
        ?.remove();


      const jumlahProduk =
        container
          .querySelectorAll(
            ".inline-product-card"
          )
          .length;


      container
        .insertAdjacentHTML(
          "beforeend",
          buatProdukInline(
            {
              id: null,

              produk_id: null,

              harga_per_item: 0,

              sub_jenis_proyek: "",

              durasi_bulan: 1,

              orders: [
                {
                  id: null,

                  cabang_id: null,

                  quantity: 1,

                  harga_per_bulan: 0,

                  total_harga: 0
                }
              ]
            },
            jumlahProduk
          )
        );


      hitungSemuaProduk();

    }
  );


// =====================================================
// CLICK PRODUK & ORDER
// =====================================================

document
  .getElementById(
    "productEditContainer"
  )
  ?.addEventListener(
    "click",
    event => {

      if (!modeEditProduk) {
        return;
      }


      // =============================================
      // HAPUS PRODUK
      // =============================================

      const btnHapusProduk =
        event.target.closest(
          ".btnHapusProdukInline"
        );


      if (btnHapusProduk) {

        const product =
          btnHapusProduk.closest(
            ".inline-product-card"
          );


        const yakin =
          confirm(
            "Hapus produk ini beserta seluruh ordernya?"
          );


        if (!yakin) {
          return;
        }


        product?.remove();


        updateNomorProduk();

        hitungSemuaProduk();


        return;

      }


      // =============================================
      // TAMBAH ORDER
      // =============================================

      const btnTambahOrder =
        event.target.closest(
          ".btnTambahOrderInline"
        );


      if (btnTambahOrder) {

        const product =
          btnTambahOrder.closest(
            ".inline-product-card"
          );


        const list =
          product?.querySelector(
            ".inline-order-list"
          );


        if (!list) {
          return;
        }


        list.insertAdjacentHTML(
          "beforeend",
          buatOrderInline(
            {
              id: null,

              cabang_id: null,

              quantity: 1,

              harga_per_bulan: 0,

              total_harga: 0
            }
          )
        );


        hitungProdukInline(
          product
        );


        return;

      }


      // =============================================
      // HAPUS ORDER
      // =============================================

      const btnHapusOrder =
        event.target.closest(
          ".btnHapusOrderInline"
        );


      if (btnHapusOrder) {

        const product =
          btnHapusOrder.closest(
            ".inline-product-card"
          );


        const order =
          btnHapusOrder.closest(
            ".inline-order-row"
          );


        order?.remove();


        hitungProdukInline(
          product
        );

      }

    }
  );


// =====================================================
// CHANGE PRODUK
// =====================================================

document
  .getElementById(
    "productEditContainer"
  )
  ?.addEventListener(
    "change",
    event => {

      if (!modeEditProduk) {
        return;
      }


      if (
        !event.target.matches(
          ".inlineProdukSelect"
        )
      ) {
        return;
      }


      const product =
        event.target.closest(
          ".inline-product-card"
        );


      hitungProdukInline(
        product
      );

    }
  );


// =====================================================
// INPUT QUANTITY / DURASI
// =====================================================

document
  .getElementById(
    "productEditContainer"
  )
  ?.addEventListener(
    "input",
    event => {

      if (!modeEditProduk) {
        return;
      }


      if (
        !event.target.matches(
          ".inlineQuantity, .inlineDurasi"
        )
      ) {
        return;
      }


      const product =
        event.target.closest(
          ".inline-product-card"
        );


      hitungProdukInline(
        product
      );

    }
  );


// =====================================================
// BUILD PAYLOAD PRODUK
// =====================================================

function buildProdukOrderPayload() {

  return [
    ...document
      .querySelectorAll(
        "#productEditContainer .inline-product-card"
      )
  ]
    .map(
      product => {

        const produkId =
          Number(
            product
              .querySelector(
                ".inlineProdukSelect"
              )
              ?.value
          ) ||
          null;


        const durasi =
          angka(
            product
              .querySelector(
                ".inlineDurasi"
              )
              ?.value
          );


        const orders =
          [
            ...product
              .querySelectorAll(
                ".inline-order-row"
              )
          ]
            .map(
              order => ({

                id:
                  Number(
                    order.dataset
                      .orderId
                  ) ||
                  null,

                cabang_id:
                  Number(
                    order
                      .querySelector(
                        ".inlineCabang"
                      )
                      ?.value
                  ) ||
                  null,

                quantity:
                  angka(
                    order
                      .querySelector(
                        ".inlineQuantity"
                      )
                      ?.value
                  )

              })
            );


        return {

          id:
            Number(
              product.dataset
                .productId
            ) ||
            null,

          produk_id:
            produkId,

          durasi_bulan:
            durasi,

          orders

        };

      }
    );

}


// =====================================================
// SIMPAN PRODUK & ORDER
// =====================================================

document
  .getElementById(
    "btnSimpanProdukOrder"
  )
  ?.addEventListener(
    "click",
    async () => {

      const produk =
        buildProdukOrderPayload();


      if (
        produk.length === 0
      ) {

        alert(
          "Minimal harus ada 1 produk."
        );


        return;

      }


      for (
        const item
        of produk
      ) {

        if (!item.produk_id) {

          alert(
            "Semua produk harus dipilih."
          );


          return;

        }


        if (
          item.durasi_bulan <= 0
        ) {

          alert(
            "Durasi harus lebih dari 0 bulan."
          );


          return;

        }


        if (
          item.orders.length === 0
        ) {

          alert(
            "Setiap produk minimal memiliki 1 order."
          );


          return;

        }


        for (
          const order
          of item.orders
        ) {

          if (!order.cabang_id) {

            alert(
              "Semua lokasi order harus dipilih."
            );


            return;

          }


          if (
            order.quantity <= 0
          ) {

            alert(
              "Quantity harus lebih dari 0."
            );


            return;

          }

        }

      }


      const button =
        document.getElementById(
          "btnSimpanProdukOrder"
        );


      const textAwal =
        button.textContent;


      try {

        button.disabled =
          true;


        button.textContent =
          "Menyimpan...";


        await fetchJSON(
          `/api/proyek-sewa/${encodeURIComponent(
            proyekSewaId
          )}/produk`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                produk
              })
          }
        );


        alert(
          "Produk & Order berhasil disimpan."
        );


        // KEMBALI MODE LIHAT

        modeEditProduk =
          false;


        document.getElementById(
          "btnEditProduk"
        ).style.display =
          "";


        document.getElementById(
          "btnTambahProduk"
        ).style.display =
          "none";

        document.getElementById(
          "produkEditActions"
        ).style.display =
          "none";


        await loadDetail();


      } catch (error) {

        console.error(
          "ERROR SAVE PRODUK ORDER:",
          error
        );


        alert(
          error.message
        );


      } finally {

        button.disabled =
          false;


        button.textContent =
          textAwal;

      }

    }
  );


// =====================================================
// RENDER PEMBAYARAN
// =====================================================

function renderPembayaran(
  pembayaran,
  totalProyek
) {

  const tbody =
    document.getElementById(
      "paymentBody"
    );


  if (!tbody) {
    return;
  }


  const totalDibayar =
    pembayaran.reduce(
      (
        total,
        item
      ) =>
        total +
        angka(
          item.nominal
        ),
      0
    );


  const sisa =
    Math.max(
      0,
      angka(
        totalProyek
      ) -
      totalDibayar
    );


  if (
    pembayaran.length === 0
  ) {

    tbody.innerHTML = `
      <tr>
        <td
          colspan="4"
          class="message"
        >
          Belum ada pembayaran.
        </td>
      </tr>
    `;

  } else {

    tbody.innerHTML =
      pembayaran
        .map(
          (
            item,
            index
          ) => `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                ${escapeHtml(
                  item.deskripsi ||
                  "-"
                )}
              </td>

              <td class="currency">
                ${rupiah(
                  item.nominal
                )}
              </td>

              <td>
                ${formatTanggal(
                  item.tanggal_bayar
                )}
              </td>

            </tr>
          `
        )
        .join("");

  }


  setText(
    "paymentTotalProyek",
    rupiah(
      totalProyek
    )
  );


  setText(
    "paymentTotalDibayar",
    rupiah(
      totalDibayar
    )
  );


  setText(
    "paymentSisa",
    rupiah(
      sisa
    )
  );

}


// =====================================================
// EDIT INFORMASI
// =====================================================

document
  .getElementById(
    "btnEditInformasi"
  )
  ?.addEventListener(
    "click",
    async () => {

      try {

        if (
          masterKlien.length === 0 ||
          masterProyek.length === 0
        ) {

          await loadMasterEdit();

        }


        const proyek =
          detailProyekSewa
            ?.proyek ||
          {};


        // =============================================
        // KLIEN
        // =============================================

        const klienSelect =
          document.getElementById(
            "editKlienId"
          );


        klienSelect.innerHTML = `
          <option value="">
            Pilih Klien
          </option>

          ${masterKlien
            .map(
              item => `
                <option
                  value="${item.id}"
                  ${
                    String(item.id) ===
                    String(
                      proyek.klien_id
                    )
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(
                    item.perusahaan_klien ||
                    item.nama_klien ||
                    "-"
                  )}
                </option>
              `
            )
            .join("")}
        `;


        // =============================================
        // PROYEK
        // =============================================

        const proyekSelect =
          document.getElementById(
            "editProyekId"
          );


        proyekSelect.innerHTML = `
          <option value="">
            Tidak menggunakan proyek existing
          </option>

          ${masterProyek
            .map(
              item => `
                <option
                  value="${item.id}"
                  ${
                    String(item.id) ===
                    String(
                      proyek.proyek_id
                    )
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(
                    item.nama_proyek ||
                    "-"
                  )}
                </option>
              `
            )
            .join("")}
        `;


        document.getElementById(
          "editNomorPr"
        ).value =
          proyek.nomor_pr ||
          "";


        document.getElementById(
          "editNomorRujukan"
        ).value =
          proyek.nomor_rujukan ||
          "";


        bukaModal(
          "modalEditInformasi"
        );


      } catch (error) {

        console.error(
          "ERROR OPEN INFORMASI:",
          error
        );


        alert(
          error.message
        );

      }

    }
  );


// =====================================================
// SIMPAN INFORMASI
// =====================================================

document
  .getElementById(
    "formEditInformasi"
  )
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const nomorPr =
        document
          .getElementById(
            "editNomorPr"
          )
          .value
          .trim();


      const nomorRujukan =
        document
          .getElementById(
            "editNomorRujukan"
          )
          .value
          .trim();


      const proyekId =
        Number(
          document
            .getElementById(
              "editProyekId"
            )
            .value
        ) ||
        null;


      const klienId =
        Number(
          document
            .getElementById(
              "editKlienId"
            )
            .value
        ) ||
        null;


      if (!nomorPr) {

        alert(
          "Nomor PR wajib diisi."
        );

        return;

      }


      if (!klienId) {

        alert(
          "Klien wajib dipilih."
        );

        return;

      }


      if (
        !nomorRujukan &&
        !proyekId
      ) {

        alert(
          "Isi Nomor Rujukan atau pilih Proyek Existing."
        );

        return;

      }


      const button =
        document.getElementById(
          "btnSimpanInformasi"
        );


      const textAwal =
        button.textContent;


      try {

        button.disabled =
          true;


        button.textContent =
          "Menyimpan...";


        await fetchJSON(
          `/api/proyek-sewa/${encodeURIComponent(
            proyekSewaId
          )}/informasi`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                nomor_pr:
                  nomorPr,

                nomor_rujukan:
                  nomorRujukan ||
                  null,

                proyek_id:
                  proyekId,

                klien_id:
                  klienId
              })
          }
        );


        tutupModal(
          "modalEditInformasi"
        );


        alert(
          "Informasi proyek sewa berhasil diperbarui."
        );


        await loadDetail();


      } catch (error) {

        console.error(
          "ERROR SAVE INFORMASI:",
          error
        );


        alert(
          error.message
        );


      } finally {

        button.disabled =
          false;


        button.textContent =
          textAwal;

      }

    }
  );


// =====================================================
// HTML PEMBAYARAN EDIT
// =====================================================

function buatEditPembayaranHtml(
  item = {}
) {

  return `
    <div
      class="edit-payment-row"
      data-payment-id="${item.id || ""}"
    >


      <div class="modal-form-group">

        <label>
          Deskripsi
        </label>

        <input
          type="text"
          class="modal-form-control editPaymentDeskripsi"
          value="${escapeHtml(
            item.deskripsi ||
            ""
          )}"
          placeholder="Contoh: Pembayaran Januari"
        >

      </div>


      <div class="modal-form-group">

        <label>
          Nominal
        </label>

        <input
          type="number"
          min="0"
          class="modal-form-control editPaymentNominal"
          value="${angka(
            item.nominal
          )}"
          placeholder="0"
        >

      </div>


      <div class="modal-form-group">

        <label>
          Tanggal Bayar
        </label>

        <input
          type="date"
          class="modal-form-control editPaymentTanggal"
          value="${tanggalInput(
            item.tanggal_bayar
          )}"
        >

      </div>


      <div class="modal-form-group">

        <label>
          &nbsp;
        </label>

        <button
          type="button"
          class="btn btn-danger btnHapusPayment"
        >
          Hapus
        </button>

      </div>


    </div>
  `;

}


// =====================================================
// RENDER EDIT PEMBAYARAN
// =====================================================

function renderEditPembayaran() {

  const container =
    document.getElementById(
      "editPaymentContainer"
    );


  if (!container) {
    return;
  }


  const pembayaran =
    detailProyekSewa
      ?.pembayaran ||
    [];


  if (
    pembayaran.length === 0
  ) {

    container.innerHTML = `
      <div class="message">
        Belum ada pembayaran.
        Klik "+ Tambah Pembayaran".
      </div>
    `;


    return;

  }


  container.innerHTML =
    pembayaran
      .map(
        item =>
          buatEditPembayaranHtml(
            item
          )
      )
      .join("");

}


// =====================================================
// OPEN EDIT PEMBAYARAN
// =====================================================

document
  .getElementById(
    "btnEditPembayaran"
  )
  ?.addEventListener(
    "click",
    () => {

      renderEditPembayaran();


      bukaModal(
        "modalEditPembayaran"
      );

    }
  );


// =====================================================
// TAMBAH PEMBAYARAN
// =====================================================

document
  .getElementById(
    "btnModalTambahPembayaran"
  )
  ?.addEventListener(
    "click",
    () => {

      const container =
        document.getElementById(
          "editPaymentContainer"
        );


      if (!container) {
        return;
      }


      container
        .querySelector(
          ".message"
        )
        ?.remove();


      container
        .insertAdjacentHTML(
          "beforeend",
          buatEditPembayaranHtml()
        );

    }
  );


// =====================================================
// HAPUS PEMBAYARAN
// =====================================================

document
  .getElementById(
    "editPaymentContainer"
  )
  ?.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          ".btnHapusPayment"
        );


      if (!button) {
        return;
      }


      button
        .closest(
          ".edit-payment-row"
        )
        ?.remove();

    }
  );


// =====================================================
// BUILD PEMBAYARAN
// =====================================================

function buildPembayaranPayload() {

  return [
    ...document
      .querySelectorAll(
        "#editPaymentContainer .edit-payment-row"
      )
  ]
    .map(
      row => ({

        id:
          Number(
            row.dataset
              .paymentId
          ) ||
          null,

        deskripsi:
          row
            .querySelector(
              ".editPaymentDeskripsi"
            )
            ?.value
            ?.trim() ||
          "",

        nominal:
          angka(
            row
              .querySelector(
                ".editPaymentNominal"
              )
              ?.value
          ),

        tanggal_bayar:
          row
            .querySelector(
              ".editPaymentTanggal"
            )
            ?.value ||
          null

      })
    );

}


// =====================================================
// SIMPAN PEMBAYARAN
// =====================================================

document
  .getElementById(
    "formEditPembayaran"
  )
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const pembayaran =
        buildPembayaranPayload();


      for (
        const item
        of pembayaran
      ) {

        if (
          item.nominal < 0
        ) {

          alert(
            "Nominal pembayaran tidak boleh negatif."
          );


          return;

        }


        if (
          item.nominal > 0 &&
          !item.tanggal_bayar
        ) {

          alert(
            "Tanggal bayar wajib diisi jika nominal pembayaran diisi."
          );


          return;

        }

      }


      const button =
        document.getElementById(
          "btnSimpanPembayaran"
        );


      const textAwal =
        button.textContent;


      try {

        button.disabled =
          true;


        button.textContent =
          "Menyimpan...";


        await fetchJSON(
          `/api/proyek-sewa/${encodeURIComponent(
            proyekSewaId
          )}/pembayaran`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                pembayaran
              })
          }
        );


        tutupModal(
          "modalEditPembayaran"
        );


        alert(
          "Riwayat pembayaran berhasil disimpan."
        );


        await loadDetail();


      } catch (error) {

        console.error(
          "ERROR SAVE PEMBAYARAN:",
          error
        );


        alert(
          error.message
        );


      } finally {

        button.disabled =
          false;


        button.textContent =
          textAwal;

      }

    }
  );

// =====================================================
// TOTAL PRODUK - MODE VIEW
// =====================================================

function renderTotalProduk() {

  const produk =
    detailProyekSewa?.produk ||
    [];


  let totalPerBulan =
    0;


  let totalProyek =
    0;


  produk.forEach(
    item => {

      const orders =
        Array.isArray(
          item.orders
        )
          ? item.orders
          : [];


      orders.forEach(
        order => {

          totalPerBulan +=
            angka(
              order.harga_per_bulan
            );


          totalProyek +=
            angka(
              order.total_harga
            );

        }
      );

    }
  );


  setText(
    "editTotalPerBulan",
    rupiah(
      totalPerBulan
    )
  );


  setText(
    "editTotalProyek",
    rupiah(
      totalProyek
    )
  );

}

// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      // =============================================
      // EDIT PRODUK & ORDER
      // =============================================

      const btnEditProduk =
        document.getElementById(
          "btnEditProduk"
        );


      if (btnEditProduk) {

        btnEditProduk.addEventListener(
          "click",
          async () => {

            try {

              console.log(
                "KLIK EDIT PRODUK & ORDER"
              );


              // =====================================
              // LOAD MASTER PRODUK & CABANG
              // =====================================

              if (
                masterProduk.length === 0 ||
                masterCabang.length === 0
              ) {

                await loadMasterEdit();

              }


              // =====================================
              // AKTIFKAN MODE EDIT
              // =====================================

              modeEditProduk =
                true;


              console.log(
                "MODE EDIT:",
                modeEditProduk
              );


              // =====================================
              // SEMBUNYIKAN TOMBOL EDIT
              // =====================================

              btnEditProduk.style.display =
                "none";


              // =====================================
              // TAMPILKAN TAMBAH PRODUK
              // =====================================

              const btnTambahProduk =
                document.getElementById(
                  "btnTambahProduk"
                );


              if (btnTambahProduk) {

                btnTambahProduk.style.display =
                  "inline-flex";

              }


              // =====================================
              // SUMMARY TETAP TAMPIL
              // =====================================

              const summary =
                document.getElementById(
                  "produkEditSummary"
                );


              if (summary) {

                summary.style.display =
                  "block";

              }


              // =====================================
              // TAMPILKAN BATAL + SIMPAN
              // =====================================

              const actions =
                document.getElementById(
                  "produkEditActions"
                );


              if (actions) {

                actions.style.display =
                  "flex";

              }


              // =====================================
              // RENDER MENJADI FORM EDIT
              // =====================================

              renderProduk(
                detailProyekSewa?.produk ||
                []
              );


              // =====================================
              // HITUNG TOTAL
              // =====================================

              hitungSemuaProduk();


              console.log(
                "EDIT PRODUK & ORDER AKTIF"
              );


            } catch (error) {

              console.error(
                "ERROR EDIT PRODUK & ORDER:",
                error
              );


              alert(
                error.message ||
                "Gagal membuka edit Produk & Order."
              );

            }

          }
        );


        console.log(
          "BUTTON EDIT PRODUK SIAP"
        );


      } else {

        console.error(
          "BUTTON #btnEditProduk TIDAK DITEMUKAN"
        );

      }


      // =============================================
      // LOAD DETAIL
      // =============================================

      await loadDetail();


    } catch (error) {

      console.error(
        "ERROR INITIALIZE DETAIL:",
        error
      );

    }

  }
);