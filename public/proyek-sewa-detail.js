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
// GLOBAL
// =====================================================

let detailProyekSewa = null;

let masterKlien = [];
let masterProyek = [];
let masterProduk = [];
let masterCabang = [];

let modeEditProduk = false;


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
// RUPIAH
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
// FORMAT ANGKA DENGAN SEPARATOR TITIK
// =====================================================

function formatAngkaTitik(
  value
) {
  const nilai =
    Math.max(
      0,
      Math.trunc(
        angka(value)
      )
    );

  return String(nilai)
    .replace(
      /\B(?=(\d{3})+(?!\d))/g,
      "."
    );
}
// =====================================================
// FORMAT TANGGAL
// AMAN TIMEZONE - TIDAK MUNDUR 1 HARI
// =====================================================

// =====================================================
// FORMAT TANGGAL
// FIX DATE + TIMESTAMP POSTGRES
// =====================================================

function formatTanggal(value) {

  if (!value) {
    return "-";
  }


  const tanggal =
    tanggalInput(value);


  if (!tanggal) {
    return "-";
  }


  const [
    year,
    month,
    day
  ] =
    tanggal
      .split("-")
      .map(Number);


  const namaBulan = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des"
  ];


  return `${
    String(day).padStart(
      2,
      "0"
    )
  } ${
    namaBulan[
      month - 1
    ]
  } ${
    year
  }`;

}


// =====================================================
// TANGGAL UNTUK INPUT TYPE DATE
// AMAN TIMEZONE - TIDAK MUNDUR 1 HARI
// =====================================================

// =====================================================
// TANGGAL UNTUK INPUT TYPE="DATE"
// FIX TIMEZONE POSTGRESQL
// =====================================================

function tanggalInput(value) {

  if (!value) {
    return "";
  }


  // ===============================================
  // JIKA DATE MURNI
  // contoh:
  // 2026-09-11
  // ===============================================

  const text =
    String(value);


  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {

    return text;

  }


  // ===============================================
  // JIKA TIMESTAMP DARI POSTGRES
  // contoh:
  // 2026-09-10T17:00:00.000Z
  //
  // Konversi ke waktu lokal Indonesia/browser
  // ===============================================

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

  /*
    Gunakan tanggal 1 dahulu agar
    31 Januari + 1 bulan
    tidak lompat ke bulan berikutnya.
  */

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

    const dokumen =
      Array.isArray(
        result?.dokumen
      )
        ? result.dokumen
        : [];
  // =================================================
  // HEADER
  // =================================================

  setText(
    "detailTitle",
    proyek.nomor_pr
      ? `Detail ${proyek.nomor_pr}`
      : "Detail Proyek Sewa"
  );

  setText(
    "detailSubtitle",
    proyek.nama_klien ||
    proyek.perusahaan_klien ||
    "Detail proyek sewa"
  );


  // =================================================
  // EDIT LINK
  // =================================================

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


  // =================================================
  // SUMMARY
  // =================================================

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


  // =================================================
  // INFORMASI
  // =================================================

  setText(
    "detailNomorPr",
    proyek.nomor_pr ||
    "-"
  );

  setText(
    "detailTanggalPr",
    formatTanggal(
      proyek.tanggal_pr
    )
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


  // =================================================
  // PRODUK
  // =================================================

  renderProduk(
    produk
  );

  renderTotalProduk();


  // =================================================
  // PEMBAYARAN
  // =================================================

  renderPembayaran(
    pembayaran,
    totalProyek
  );

  renderInformasiPartnerSewa(
  result?.partner || {}
);

renderPembayaranPartnerSewa(
  Array.isArray(
    result?.pembayaran_partner
  )
    ? result.pembayaran_partner
    : [],

  result?.partner || {}
);

renderDokumenSewa(
  Array.isArray(
    result?.dokumen
  )
    ? result.dokumen
    : []
);

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


  // =================================================
  // MODE LIHAT
  // =================================================

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


  // =================================================
  // MODE EDIT
  // =================================================

  return `
    <div
      class="inline-product-card"

      data-product-id="${
        item.id ||
        ""
      }"

      data-original-produk-id="${
        item.produk_id ||
        ""
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

            ${
              orders.length > 0

                ? orders
                    .map(
                      order =>
                        buatOrderInline(
                          order
                        )
                    )
                    .join("")

                : buatOrderInline()
            }

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


      <!-- ==============================
           BARIS 1
      =============================== -->


      <!-- LOKASI -->
      <div class="inline-form-group order-lokasi">

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


      <!-- QUANTITY -->
      <div class="inline-form-group order-quantity">

        <label>
          Quantity
        </label>

        <div class="inline-view-value">
          ${angka(
            order.quantity
          )}
        </div>

      </div>


      <!-- HARGA / BULAN -->
      <div class="inline-form-group order-harga-bulan">

        <label>
          Harga / Bulan
        </label>

        <div class="inline-view-value">
          ${rupiah(
            order.harga_per_bulan
          )}
        </div>

      </div>


      <!-- TOTAL HARGA -->
      <div class="inline-form-group order-total-harga">

        <label>
          Total Harga
        </label>

        <div class="inline-view-value">
          ${rupiah(
            order.total_harga
          )}
        </div>

      </div>



      <!-- ==============================
           BARIS 2
      =============================== -->


      <!-- NO REQ KLIEN -->
      <div class="inline-form-group order-no-req">

        <label>
          No Req Klien
        </label>

        <div class="inline-view-value">
          ${escapeHtml(
            order.no_req_klien ||
            "-"
          )}
        </div>

      </div>


      <!-- TANGGAL REQ KLIEN -->
      <div class="inline-form-group order-tanggal-req">

        <label>
          Tanggal Req Klien
        </label>

        <div class="inline-view-value">
          ${formatTanggal(
            order.tanggal_req_klien
          )}
        </div>

      </div>


      <!-- TANGGAL DO -->
      <div class="inline-form-group order-tanggal-do">

        <label>
          Tanggal DO
        </label>

        <div class="inline-view-value">
          ${formatTanggal(
            order.tanggal_do
          )}
        </div>

      </div>


      <!-- NO DO -->
      <div class="inline-form-group order-no-do">

        <label>
          No DO
        </label>

        <div class="inline-view-value">
          ${escapeHtml(
            order.no_do ||
            "-"
          )}
        </div>

      </div>


      <!-- END DATE -->
      <div class="inline-form-group order-end-date">

        <label>
          End Date
        </label>

        <div class="inline-view-value">
          ${formatTanggal(
            order.end_date
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


      <!-- ==============================
           BARIS 1
      =============================== -->


      <!-- LOKASI -->
      <div class="inline-form-group order-lokasi">

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


      <!-- QUANTITY -->
      <div class="inline-form-group order-quantity">

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
              order.quantity ||
              1
            )
          )}"

          required
        >

      </div>


      <!-- HARGA / BULAN -->
      <div class="inline-form-group order-harga-bulan">

        <label>
          Harga / Bulan
        </label>

        <input
          type="text"

          class="
            inline-control
            inlineHargaBulan
          "

          value="${rupiah(
            order.harga_per_bulan
          )}"

          readonly
        >

      </div>


      <!-- TOTAL HARGA -->
      <div class="inline-form-group order-total-harga">

        <label>
          Total Harga
        </label>

        <input
          type="text"

          class="
            inline-control
            inlineTotalHarga
          "

          value="${rupiah(
            order.total_harga
          )}"

          readonly
        >

      </div>



      <!-- ==============================
           BARIS 2
      =============================== -->


      <!-- NO REQ KLIEN -->
      <div class="inline-form-group order-no-req">

        <label>
          No Req Klien
        </label>

        <input
          type="text"

          class="
            inline-control
            inlineNoReqKlien
          "

          value="${escapeHtml(
            order.no_req_klien ||
            ""
          )}"

          placeholder="Opsional"
        >

      </div>


      <!-- TANGGAL REQ KLIEN -->
      <div class="inline-form-group order-tanggal-req">

        <label>
          Tanggal Req Klien
        </label>

        <input
          type="date"

          class="
            inline-control
            inlineTanggalReqKlien
          "

          value="${tanggalInput(
            order.tanggal_req_klien
          )}"
        >

      </div>


      <!-- TANGGAL DO -->
      <div class="inline-form-group order-tanggal-do">

        <label>
          Tanggal DO
        </label>

        <input
          type="date"

          class="
            inline-control
            inlineTanggalDO
          "

          value="${tanggalInput(
            order.tanggal_do
          )}"
        >

      </div>


      <!-- NO DO -->
      <div class="inline-form-group order-no-do">

        <label>
          No DO
        </label>

        <input
          type="text"

          class="
            inline-control
            inlineNoDO
          "

          value="${escapeHtml(
            order.no_do ||
            ""
          )}"

          placeholder="Opsional"
        >

      </div>


      <!-- END DATE -->
      <div class="inline-form-group order-end-date">

        <label>
          End Date
        </label>

        <input
          type="date"

          class="
            inline-control
            inlineEndDate
          "

          value="${tanggalInput(
            order.end_date
          )}"

          readonly
        >

      </div>


      <!-- HAPUS -->
      <div class="order-action">

        <button
          type="button"
          class="
            btn
            btn-danger
            btnHapusOrderInline
          "
        >
          Hapus Order
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


  // =================================================
  // HARGA KONTRAK
  // =================================================

  const originalProdukId =
    product.dataset
      .originalProdukId;

  const originalHarga =
    angka(
      product.dataset
        .originalHarga
    );

  let hargaItem = 0;


  /*
    Produk existing tidak diganti:
    gunakan harga kontrak lama.
  */

  if (
    product.dataset.productId &&
    String(produkId) ===
    String(originalProdukId)
  ) {

    hargaItem =
      originalHarga;

  } else {

    /*
      Produk baru / produk diganti:
      ambil harga master terbaru.
    */

    hargaItem =
      angka(
        master
          ?.harga_jual_per_item
      );

  }


  // =================================================
  // HARGA ITEM
  // =================================================

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


  // =================================================
  // SUB JENIS
  // =================================================

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


  // =================================================
  // DURASI
  // =================================================

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


  // =================================================
  // HITUNG SETIAP ORDER
  // =================================================

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


        // ===========================================
        // HARGA
        // ===========================================

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


        // ===========================================
        // END DATE
        // ===========================================

        const tanggalDO =
          order
            .querySelector(
              ".inlineTanggalDO"
            )
            ?.value ||
          "";

        const endDateInput =
          order.querySelector(
            ".inlineEndDate"
          );

        if (endDateInput) {

          endDateInput.value =
            hitungEndDate(
              tanggalDO,
              durasi
            );

        }

      }
    );


  if (updateGrandTotal) {

    hitungSemuaProduk();

  }

}


// =====================================================
// HITUNG SEMUA PRODUK
// =====================================================

function hitungSemuaProduk() {

  let totalPerBulan = 0;
  let totalProyek = 0;

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
// TOTAL PRODUK MODE VIEW
// =====================================================

function renderTotalProduk() {

  const produk =
    detailProyekSewa?.produk ||
    [];

  let totalPerBulan = 0;
  let totalProyek = 0;

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
// AKTIFKAN EDIT PRODUK
// =====================================================

async function aktifkanEditProduk() {

  try {

    if (
      masterProduk.length === 0 ||
      masterCabang.length === 0
    ) {

      await loadMasterEdit();

    }

    modeEditProduk =
      true;


    const btnEdit =
      document.getElementById(
        "btnEditProduk"
      );

    const btnTambah =
      document.getElementById(
        "btnTambahProduk"
      );

    const summary =
      document.getElementById(
        "produkEditSummary"
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
        "inline-flex";

    }

    if (summary) {

      summary.style.display =
        "block";

    }

    if (actions) {

      actions.style.display =
        "flex";

    }


    renderProduk(
      detailProyekSewa?.produk ||
      []
    );


    hitungSemuaProduk();


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


// =====================================================
// BUTTON EDIT PRODUK
// =====================================================

document
  .getElementById(
    "btnEditProduk"
  )
  ?.addEventListener(
    "click",
    aktifkanEditProduk
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


      const btnEdit =
        document.getElementById(
          "btnEditProduk"
        );

      const btnTambah =
        document.getElementById(
          "btnTambahProduk"
        );

      const summary =
        document.getElementById(
          "produkEditSummary"
        );

      const actions =
        document.getElementById(
          "produkEditActions"
        );


      if (btnEdit) {

        btnEdit.style.display =
          "";

      }

      if (btnTambah) {

        btnTambah.style.display =
          "none";

      }

      if (summary) {

        summary.style.display =
          "none";

      }

      if (actions) {

        actions.style.display =
          "none";

      }


      renderProduk(
        detailProyekSewa?.produk ||
        []
      );

      renderTotalProduk();

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

      container.insertAdjacentHTML(
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

                no_req_klien: null,

                tanggal_req_klien:
                  null,

                tanggal_do:
                  null,

                no_do:
                  null,

                end_date:
                  null,

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


      // =================================================
      // HAPUS PRODUK
      // =================================================

      const btnHapusProduk =
        event.target.closest(
          ".btnHapusProdukInline"
        );

      if (btnHapusProduk) {

        const container =
          document.getElementById(
            "productEditContainer"
          );

        const jumlahProduk =
          container
            ?.querySelectorAll(
              ".inline-product-card"
            )
            .length ||
          0;

        if (
          jumlahProduk <= 1
        ) {

          alert(
            "Minimal harus ada 1 produk."
          );

          return;

        }

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


      // =================================================
      // TAMBAH ORDER
      // =================================================

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
          buatOrderInline({
            id: null,

            cabang_id: null,

            quantity: 1,

            no_req_klien:
              null,

            tanggal_req_klien:
              null,

            tanggal_do:
              null,

            no_do:
              null,

            end_date:
              null,

            harga_per_bulan: 0,

            total_harga: 0
          })
        );

        hitungProdukInline(
          product
        );

        return;

      }


      // =================================================
      // HAPUS ORDER
      // =================================================

      const btnHapusOrder =
        event.target.closest(
          ".btnHapusOrderInline"
        );

      if (btnHapusOrder) {

        const product =
          btnHapusOrder.closest(
            ".inline-product-card"
          );

        const jumlahOrder =
          product
            ?.querySelectorAll(
              ".inline-order-row"
            )
            .length ||
          0;

        if (
          jumlahOrder <= 1
        ) {

          alert(
            "Setiap produk minimal harus memiliki 1 order."
          );

          return;

        }

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
// CHANGE PRODUK / TANGGAL DO
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
          ".inlineProdukSelect, .inlineTanggalDO"
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
// BUILD PAYLOAD PRODUK & ORDER
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
                  ),

                no_req_klien:
                  order
                    .querySelector(
                      ".inlineNoReqKlien"
                    )
                    ?.value
                    ?.trim() ||
                  null,

                tanggal_req_klien:
                  order
                    .querySelector(
                      ".inlineTanggalReqKlien"
                    )
                    ?.value ||
                  null,

                tanggal_do:
                  order
                    .querySelector(
                      ".inlineTanggalDO"
                    )
                    ?.value ||
                  null,

                no_do:
                  order
                    .querySelector(
                      ".inlineNoDO"
                    )
                    ?.value
                    ?.trim() ||
                  null,

                end_date:
                  order
                    .querySelector(
                      ".inlineEndDate"
                    )
                    ?.value ||
                  null

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


      // =================================================
      // VALIDASI
      // =================================================

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


      // =================================================
      // SAVE
      // =================================================

      const button =
        document.getElementById(
          "btnSimpanProdukOrder"
        );

      const textAwal =
        button?.textContent ||
        "Simpan Perubahan";

      try {

        if (button) {

          button.disabled =
            true;

          button.textContent =
            "Menyimpan...";

        }

        const result =
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

        console.log(
          "UPDATE PRODUK:",
          result
        );

        alert(
          "Produk & Order berhasil disimpan."
        );


        // =============================================
        // KEMBALI MODE VIEW
        // =============================================

        modeEditProduk =
          false;

        const btnEdit =
          document.getElementById(
            "btnEditProduk"
          );

        const btnTambah =
          document.getElementById(
            "btnTambahProduk"
          );

        const summary =
          document.getElementById(
            "produkEditSummary"
          );

        const actions =
          document.getElementById(
            "produkEditActions"
          );

        if (btnEdit) {

          btnEdit.style.display =
            "";

        }

        if (btnTambah) {

          btnTambah.style.display =
            "none";

        }

        if (summary) {

          summary.style.display =
            "none";

        }

        if (actions) {

          actions.style.display =
            "none";

        }

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

        if (button) {

          button.disabled =
            false;

          button.textContent =
            textAwal;

        }

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

  const dataPembayaran =
    Array.isArray(pembayaran)
      ? pembayaran
      : [];

  /*
   * Total Dibayar hanya menghitung pembayaran
   * dengan status Sudah Dibayar.
   */

  const totalDibayar =
    dataPembayaran
      .filter(
        item =>
          normalisasiStatusPembayaranSewa(
            item.status_pembayaran
          ) ===
          "Sudah Dibayar"
      )
      .reduce(
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
      angka(totalProyek) -
      totalDibayar
    );

  if (
    dataPembayaran.length === 0
  ) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="message"
        >
          Belum ada pembayaran.
        </td>
      </tr>
    `;

  } else {
    tbody.innerHTML =
      dataPembayaran
        .map(
          (
            item,
            index
          ) => {
            const status =
              normalisasiStatusPembayaranSewa(
                item.status_pembayaran
              );

            let statusClass =
              "payment-status-unpaid";

            if (
              status ===
              "Sudah Dibayar"
            ) {
              statusClass =
                "payment-status-paid";

            } else if (
              status === "Proses"
            ) {
              statusClass =
                "payment-status-process";
            }

            return `
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
                  <span
                    class="
                      payment-status
                      ${statusClass}
                    "
                  >
                    ${escapeHtml(
                      status
                    )}
                  </span>
                </td>

                <td>
                  ${
                    item.tanggal_bayar
                      ? formatTanggal(
                          item.tanggal_bayar
                        )
                      : "-"
                  }
                </td>

                <td>
                  ${escapeHtml(
                    item.syarat_pembayaran ||
                    "-"
                  )}
                </td>
              </tr>
            `;
          }
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

        if (klienSelect) {

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

        }


        // =============================================
        // PROYEK EXISTING
        // =============================================

        const proyekSelect =
          document.getElementById(
            "editProyekId"
          );

        if (proyekSelect) {

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

        }


        // =============================================
        // NOMOR PR
        // =============================================

        const nomorPrInput =
          document.getElementById(
            "editNomorPr"
          );

        if (nomorPrInput) {

          nomorPrInput.value =
            proyek.nomor_pr ||
            "";

        }


        // =============================================
        // TANGGAL PR
        // =============================================

        const tanggalPrInput =
          document.getElementById(
            "editTanggalPr"
          );

        if (tanggalPrInput) {

          tanggalPrInput.value =
            tanggalInput(
              proyek.tanggal_pr
            );

        }


        // =============================================
        // RUJUKAN READONLY
        // =============================================

        const rujukanInput =
          document.getElementById(
            "editNomorRujukan"
          );

        if (rujukanInput) {

          rujukanInput.value =
            proyek.nomor_rujukan ||
            "";

          rujukanInput.readOnly =
            true;

        }


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
          ?.value
          ?.trim() ||
        "";


      const tanggalPr =
        document
          .getElementById(
            "editTanggalPr"
          )
          ?.value ||
        null;


      const proyekId =
        Number(
          document
            .getElementById(
              "editProyekId"
            )
            ?.value
        ) ||
        null;


      const klienId =
        Number(
          document
            .getElementById(
              "editKlienId"
            )
            ?.value
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


      const button =
        document.getElementById(
          "btnSimpanInformasi"
        );

      const textAwal =
        button?.textContent ||
        "Simpan Perubahan";


      try {

        if (button) {

          button.disabled =
            true;

          button.textContent =
            "Menyimpan...";

        }


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

                tanggal_pr:
                  tanggalPr,

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

        if (button) {

          button.disabled =
            false;

          button.textContent =
            textAwal;

        }

      }

    }
  );


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
// HTML PEMBAYARAN EDIT
// =====================================================

function buatEditPembayaranHtml(
  item = {}
) {
  const statusPembayaran =
    normalisasiStatusPembayaranSewa(
      item.status_pembayaran
    );

  const belumDibayarSelected =
    statusPembayaran ===
      "Belum Dibayar"
      ? "selected"
      : "";

  const prosesSelected =
    statusPembayaran ===
      "Proses"
      ? "selected"
      : "";

  const sudahDibayarSelected =
    statusPembayaran ===
      "Sudah Dibayar"
      ? "selected"
      : "";

  const tanggalBayarWajib =
    statusPembayaran ===
      "Sudah Dibayar"
      ? "required"
      : "";

  return `
    <div
      class="edit-payment-row"
      data-payment-id="${
        item.id || ""
      }"
    >
      <!-- DESKRIPSI -->

      <div class="modal-form-group">
        <label>
          Deskripsi
          <span class="required">*</span>
        </label>

        <input
          type="text"
          class="
            modal-form-control
            editPaymentDeskripsi
          "
          value="${escapeHtml(
            item.deskripsi || ""
          )}"
          placeholder="Contoh: Pembayaran sewa Januari"
          required
        >
      </div>

      <!-- NOMINAL -->

      <div class="modal-form-group">
        <label>
          Nominal
          <span class="required">*</span>
        </label>
    <input
      type="text"
      inputmode="numeric"
      autocomplete="off"
      class="
        modal-form-control
        editPaymentNominal
      "
      value="${formatAngkaTitik(
        item.nominal
      )}"
      placeholder="0"
      required
    >
      </div>

      <!-- STATUS PEMBAYARAN -->

      <div class="modal-form-group">
        <label>
          Status Pembayaran
          <span class="required">*</span>
        </label>

        <select
          class="
            modal-form-control
            editPaymentStatus
          "
          required
        >
          <option
            value="Belum Dibayar"
            ${belumDibayarSelected}
          >
            Belum Dibayar
          </option>

          <option
            value="Proses"
            ${prosesSelected}
          >
            Proses
          </option>

          <option
            value="Sudah Dibayar"
            ${sudahDibayarSelected}
          >
            Sudah Dibayar
          </option>
        </select>
      </div>

      <!-- TANGGAL BAYAR -->

      <div class="modal-form-group">
        <label>
          Tanggal Bayar
        </label>

        <input
          type="date"
          class="
            modal-form-control
            editPaymentTanggal
          "
          value="${tanggalInput(
            item.tanggal_bayar
          )}"
          ${tanggalBayarWajib}
        >
      </div>

      <!-- SYARAT PEMBAYARAN -->

      <div class="modal-form-group">
        <label>
          Syarat Pembayaran
        </label>

        <textarea
          class="
            modal-form-control
            editPaymentSyarat
          "
          rows="2"
          placeholder="Masukkan syarat pembayaran"
        >${escapeHtml(
          item.syarat_pembayaran || ""
        )}</textarea>
      </div>

      <!-- AKSI -->

      <div class="modal-form-group">
        <label>
          &nbsp;
        </label>

        <button
          type="button"
          class="
            btn
            btn-danger
            btnHapusPayment
          "
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
    Array.isArray(
      detailProyekSewa
        ?.pembayaran
    )
      ? detailProyekSewa
          .pembayaran
      : [];

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
          buatEditPembayaranHtml({
            status_pembayaran:
              "Belum Dibayar"
          })
        );
        
    }
  );

// =====================================================
// HAPUS PEMBAYARAN DARI FORM
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

      const row =
        button.closest(
          ".edit-payment-row"
        );

      if (!row) {
        return;
      }

      const yakin =
        window.confirm(
          "Hapus data pembayaran ini?"
        );

      if (!yakin) {
        return;
      }

      row.remove();

      const container =
        document.getElementById(
          "editPaymentContainer"
        );

      if (
        container &&
        container.querySelectorAll(
          ".edit-payment-row"
        ).length === 0
      ) {
        container.innerHTML = `
          <div class="message">
            Belum ada pembayaran.
            Klik "+ Tambah Pembayaran".
          </div>
        `;
      }
    }
  );

// =====================================================
// STATUS PEMBAYARAN -> TANGGAL BAYAR
// =====================================================

document
  .getElementById(
    "editPaymentContainer"
  )
  ?.addEventListener(
    "change",
    event => {
      const statusInput =
        event.target.closest(
          ".editPaymentStatus"
        );

      if (!statusInput) {
        return;
      }

      const row =
        statusInput.closest(
          ".edit-payment-row"
        );

      const tanggalInput =
        row?.querySelector(
          ".editPaymentTanggal"
        );

      if (!tanggalInput) {
        return;
      }

      tanggalInput.required =
        statusInput.value ===
        "Sudah Dibayar";
    }
  );

// =====================================================
// SEPARATOR NOMINAL PEMBAYARAN
// =====================================================

document
  .getElementById(
    "editPaymentContainer"
  )
  ?.addEventListener(
    "input",
    event => {
      const input =
        event.target.closest(
          ".editPaymentNominal"
        );

      if (!input) {
        return;
      }

      const angkaMurni =
        String(input.value || "")
          .replace(/\D/g, "")
          .replace(
            /^0+(?=\d)/,
            ""
          );

      input.value =
        angkaMurni
          ? angkaMurni.replace(
              /\B(?=(\d{3})+(?!\d))/g,
              "."
            )
          : "";
    }
  );
// =====================================================
// BUILD PAYLOAD PEMBAYARAN
// =====================================================

function buildPembayaranPayload() {
  const rows = [
    ...document
      .querySelectorAll(
        "#editPaymentContainer .edit-payment-row"
      )
  ];

  return rows
    .map(
      row => {
        const id =
          Number(
            row.dataset
              .paymentId
          ) || null;

        const deskripsi =
          row
            .querySelector(
              ".editPaymentDeskripsi"
            )
            ?.value
            ?.trim() || "";

        const nominal =
          angka(
            row
              .querySelector(
                ".editPaymentNominal"
              )
              ?.value
          );

        const statusPembayaran =
          normalisasiStatusPembayaranSewa(
            row
              .querySelector(
                ".editPaymentStatus"
              )
              ?.value
          );

        const tanggalBayar =
          row
            .querySelector(
              ".editPaymentTanggal"
            )
            ?.value ||
          null;

        const syaratPembayaran =
          row
            .querySelector(
              ".editPaymentSyarat"
            )
            ?.value
            ?.trim() || "";

        return {
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
        };
      }
    )
    .filter(
      item =>
        item.id !== null ||
        Boolean(
          item.deskripsi
        ) ||
        item.nominal > 0 ||
        Boolean(
          item.tanggal_bayar
        ) ||
        Boolean(
          item.syarat_pembayaran
        )
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

      // =============================================
      // VALIDASI PEMBAYARAN
      // =============================================

      const statusValid = [
        "Belum Dibayar",
        "Proses",
        "Sudah Dibayar"
      ];

      for (
        let index = 0;
        index < pembayaran.length;
        index += 1
      ) {
        const item =
          pembayaran[index];

        // ===========================================
        // VALIDASI DESKRIPSI
        // ===========================================

        if (!item.deskripsi) {
          alert(
            `Deskripsi pembayaran ke-${
              index + 1
            } wajib diisi.`
          );

          return;
        }

        // ===========================================
        // VALIDASI NOMINAL
        // ===========================================

        if (
          !Number.isFinite(
            item.nominal
          ) ||
          item.nominal < 0
        ) {
          alert(
            `Nominal pembayaran ke-${
              index + 1
            } tidak valid.`
          );

          return;
        }

        // ===========================================
        // VALIDASI STATUS PEMBAYARAN
        // ===========================================

        if (
          !statusValid.includes(
            item.status_pembayaran
          )
        ) {
          alert(
            `Status pembayaran ke-${
              index + 1
            } tidak valid.`
          );

          return;
        }

        // ===========================================
        // VALIDASI TANGGAL BAYAR
        // ===========================================

        if (
          item.status_pembayaran ===
            "Sudah Dibayar" &&
          !item.tanggal_bayar
        ) {
          alert(
            `Tanggal bayar pembayaran ke-${
              index + 1
            } wajib diisi karena statusnya Sudah Dibayar.`
          );

          return;
        }
      }

      // =============================================
      // BUTTON LOADING
      // =============================================

      const button =
        document.getElementById(
          "btnSimpanPembayaran"
        );

      const textAwal =
        button?.textContent ||
        "Simpan Pembayaran";

      try {
        if (button) {
          button.disabled = true;

          button.textContent =
            "Menyimpan...";
        }

        // ===========================================
        // REQUEST SIMPAN
        // ===========================================

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
          "Data pembayaran berhasil disimpan."
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
        if (button) {
          button.disabled = false;

          button.textContent =
            textAwal;
        }
      }
    }
  );

function buatSummaryProyek(
  produkSummary
) {

  const produk =
    Array.isArray(
      produkSummary
    )
      ? produkSummary
      : [];


  if (
    produk.length === 0
  ) {

    return `
      <div class="project-summary">
        -
      </div>
    `;

  }


  let totalSemuaUnit = 0;


  const html =
    produk
      .map(
        item => {

          const orders =
            Array.isArray(
              item.orders
            )
              ? item.orders
              : [];


          const totalProduk =
            orders.reduce(
              (
                total,
                order
              ) => {

                return (
                  total +
                  Number(
                    order.quantity ||
                    0
                  )
                );

              },
              0
            );


          totalSemuaUnit +=
            totalProduk;


          return `
            <div
              class="project-summary-product"
            >
              ${escapeHtml(
                item.item_produk ||
                "-"
              )}
            </div>


            ${orders
              .map(
                order => `
                  <div
                    class="project-summary-order"
                  >
                    ${escapeHtml(
                      order.nama_cabang ||
                      "-"
                    )}

                    ${Number(
                      order.quantity ||
                      0
                    )}

                    Unit
                  </div>
                `
              )
              .join("")}
          `;

        }
      )
      .join("");


  return `
    <div class="project-summary">

      ${html}

      <div
        class="project-summary-total"
      >
        Total ${totalSemuaUnit} Unit
      </div>

    </div>
  `;

}

// =====================================================
// INFORMASI PARTNER SEWA
// =====================================================

function renderInformasiPartnerSewa(
  partner = {}
) {
  setText(
    "detailPartnerSewa",
    partner.nama_partner ||
    "Belum memilih partner"
  );

  setText(
    "detailNilaiPartnerSewa",
    rupiah(
      partner.nilai_final_partner ||
      0
    )
  );

  setText(
    "modalPartnerPaymentName",
    partner.nama_partner ||
    "Belum memilih partner"
  );

  const button =
    document.getElementById(
      "btnEditPembayaranPartner"
    );

  if (button) {
    button.disabled =
      !Number(
        partner.proyek_partner_id
      );
  }
}


// =====================================================
// RENDER PEMBAYARAN PARTNER
// =====================================================

function renderPembayaranPartnerSewa(
  pembayaran = [],
  partner = {}
) {
  const tbody =
    document.getElementById(
      "partnerPaymentBody"
    );

  if (!tbody) {
    return;
  }

  const data =
    Array.isArray(pembayaran)
      ? pembayaran
      : [];

  const totalPartner =
    angka(
      partner.nilai_final_partner
    );

  const totalDibayar =
    data
      .filter(
        item =>
          normalisasiStatusPembayaranSewa(
            item.status_pembayaran
          ) ===
          "Sudah Dibayar"
      )
      .reduce(
        (total, item) =>
          total +
          angka(item.nominal),
        0
      );

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="message"
        >
          Belum ada pembayaran partner.
        </td>
      </tr>
    `;

  } else {
    tbody.innerHTML =
      data
        .map((item, index) => {
          const status =
            normalisasiStatusPembayaranSewa(
              item.status_pembayaran
            );

          const statusClass =
            status === "Sudah Dibayar"
              ? "payment-status-paid"
              : status === "Proses"
                ? "payment-status-process"
                : "payment-status-unpaid";

          return `
            <tr>
              <td>${index + 1}</td>

              <td>
                ${escapeHtml(
                  item.deskripsi || "-"
                )}
              </td>

              <td class="currency">
                ${rupiah(item.nominal)}
              </td>

              <td>
                <span
                  class="
                    payment-status
                    ${statusClass}
                  "
                >
                  ${escapeHtml(status)}
                </span>
              </td>

              <td>
                ${
                  item.tanggal_bayar
                    ? formatTanggal(
                        item.tanggal_bayar
                      )
                    : "-"
                }
              </td>

              <td>
                ${escapeHtml(
                  item.syarat_pembayaran ||
                  "-"
                )}
              </td>
            </tr>
          `;
        })
        .join("");
  }

  setText(
    "partnerPaymentTotal",
    rupiah(totalPartner)
  );

  setText(
    "partnerPaymentDibayar",
    rupiah(totalDibayar)
  );

  setText(
    "partnerPaymentSisa",
    rupiah(
      Math.max(
        0,
        totalPartner -
        totalDibayar
      )
    )
  );
}


// =====================================================
// FORM BARIS PEMBAYARAN PARTNER
// =====================================================

function buatPembayaranPartnerHtml(
  item = {}
) {
  const status =
    normalisasiStatusPembayaranSewa(
      item.status_pembayaran
    );

  return `
    <div class="edit-payment-row partner-payment-row">

      <div class="modal-form-group">
        <label>
          Deskripsi
          <span class="required">*</span>
        </label>

        <input
          type="text"
          class="
            modal-form-control
            partnerPaymentDeskripsi
          "
          value="${escapeHtml(
            item.deskripsi || ""
          )}"
          placeholder="Contoh: Pembayaran Partner Januari"
          required
        >
      </div>

      <div class="modal-form-group">
        <label>
          Nominal
          <span class="required">*</span>
        </label>

        <input
          type="number"
          min="0"
          step="1"
          class="
            modal-form-control
            partnerPaymentNominal
          "
          value="${angka(
            item.nominal
          )}"
          required
        >
      </div>

      <div class="modal-form-group">
        <label>Status Pembayaran</label>

        <select
          class="
            modal-form-control
            partnerPaymentStatus
          "
          required
        >
          <option
            value="Belum Dibayar"
            ${
              status === "Belum Dibayar"
                ? "selected"
                : ""
            }
          >
            Belum Dibayar
          </option>

          <option
            value="Proses"
            ${
              status === "Proses"
                ? "selected"
                : ""
            }
          >
            Proses
          </option>

          <option
            value="Sudah Dibayar"
            ${
              status === "Sudah Dibayar"
                ? "selected"
                : ""
            }
          >
            Sudah Dibayar
          </option>
        </select>
      </div>

      <div class="modal-form-group">
        <label>Tanggal Bayar</label>

        <input
          type="date"
          class="
            modal-form-control
            partnerPaymentTanggal
          "
          value="${tanggalInput(
            item.tanggal_bayar
          )}"
          ${
            status === "Sudah Dibayar"
              ? "required"
              : ""
          }
        >
      </div>

      <div class="modal-form-group">
        <label>Syarat Pembayaran</label>

        <textarea
          class="
            modal-form-control
            partnerPaymentSyarat
          "
          rows="2"
        >${escapeHtml(
          item.syarat_pembayaran || ""
        )}</textarea>
      </div>

      <div class="modal-form-group">
        <label>&nbsp;</label>

        <button
          type="button"
          class="
            btn
            btn-danger
            btnHapusPartnerPayment
          "
        >
          Hapus
        </button>
      </div>

    </div>
  `;
}


// =====================================================
// BUKA PEMBAYARAN PARTNER
// =====================================================

document
  .getElementById(
    "btnEditPembayaranPartner"
  )
  ?.addEventListener(
    "click",
    () => {
      const container =
        document.getElementById(
          "partnerPaymentEditContainer"
        );

      const pembayaran =
        Array.isArray(
          detailProyekSewa
            ?.pembayaran_partner
        )
          ? detailProyekSewa
              .pembayaran_partner
          : [];

      container.innerHTML =
        pembayaran.length > 0
          ? pembayaran
              .map(
                buatPembayaranPartnerHtml
              )
              .join("")
          : `
            <div class="message">
              Belum ada pembayaran partner.
            </div>
          `;

      bukaModal(
        "modalPembayaranPartner"
      );
    }
  );


// =====================================================
// TAMBAH BARIS PEMBAYARAN PARTNER
// =====================================================

document
  .getElementById(
    "btnTambahPembayaranPartner"
  )
  ?.addEventListener(
    "click",
    () => {
      const container =
        document.getElementById(
          "partnerPaymentEditContainer"
        );

      container
        ?.querySelector(".message")
        ?.remove();

      container?.insertAdjacentHTML(
        "beforeend",

        buatPembayaranPartnerHtml({
          status_pembayaran:
            "Belum Dibayar"
        })
      );
    }
  );


document
  .getElementById(
    "partnerPaymentEditContainer"
  )
  ?.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          ".btnHapusPartnerPayment"
        );

      if (!button) {
        return;
      }

      button
        .closest(
          ".partner-payment-row"
        )
        ?.remove();
    }
  );


document
  .getElementById(
    "partnerPaymentEditContainer"
  )
  ?.addEventListener(
    "change",
    event => {
      if (
        !event.target.classList
          .contains(
            "partnerPaymentStatus"
          )
      ) {
        return;
      }

      const row =
        event.target.closest(
          ".partner-payment-row"
        );

      const tanggal =
        row?.querySelector(
          ".partnerPaymentTanggal"
        );

      if (!tanggal) {
        return;
      }

      tanggal.required =
        event.target.value ===
        "Sudah Dibayar";

      if (
        event.target.value !==
        "Sudah Dibayar"
      ) {
        tanggal.value = "";
      }
    }
  );


// =====================================================
// SIMPAN PEMBAYARAN PARTNER
// =====================================================

document
  .getElementById(
    "formPembayaranPartner"
  )
  ?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      const rows = [
        ...document
          .querySelectorAll(
            "#partnerPaymentEditContainer .partner-payment-row"
          )
      ];

      const pembayaran =
        rows.map(row => ({
          deskripsi:
            row
              .querySelector(
                ".partnerPaymentDeskripsi"
              )
              ?.value
              ?.trim() || "",

          nominal:
            angka(
              row
                .querySelector(
                  ".partnerPaymentNominal"
                )
                ?.value
            ),

          status_pembayaran:
            row
              .querySelector(
                ".partnerPaymentStatus"
              )
              ?.value ||
            "Belum Dibayar",

          tanggal_bayar:
            row
              .querySelector(
                ".partnerPaymentTanggal"
              )
              ?.value ||
            null,

          syarat_pembayaran:
            row
              .querySelector(
                ".partnerPaymentSyarat"
              )
              ?.value
              ?.trim() ||
            null
        }));

      const button =
        document.getElementById(
          "btnSimpanPembayaranPartner"
        );

      try {
        button.disabled = true;

        button.textContent =
          "Menyimpan...";

        await fetchJSON(
          `/api/proyek-sewa/${encodeURIComponent(
            proyekSewaId
          )}/pembayaran-partner`,
          {
            method: "PUT",

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
          "modalPembayaranPartner"
        );

        await loadDetail();

      } catch (error) {
        alert(error.message);

      } finally {
        button.disabled = false;

        button.textContent =
          "Simpan Pembayaran Partner";
      }
    }
  );

// =====================================================
// DOKUMEN PROYEK SEWA
// =====================================================

let dokumenSewaEditId = null;


// =====================================================
// FORMAT UKURAN FILE
// =====================================================

function formatUkuranFile(
  value
) {
  const ukuran =
    Number(value || 0);

  if (
    !Number.isFinite(ukuran) ||
    ukuran <= 0
  ) {
    return "";
  }

  if (ukuran < 1024) {
    return `${ukuran} B`;
  }

  if (
    ukuran <
    1024 * 1024
  ) {
    return `${
      (
        ukuran / 1024
      ).toFixed(1)
    } KB`;
  }

  return `${
    (
      ukuran /
      1024 /
      1024
    ).toFixed(1)
  } MB`;
}


// =====================================================
// LOAD MASTER DOKUMEN
// =====================================================

async function loadMasterDokumenSewa(
  selectedValue = ""
) {
  const select =
    document.getElementById(
      "namaDokumenSewa"
    );

  if (!select) {
    return;
  }

  select.disabled = true;

  select.innerHTML = `
    <option value="">
      Memuat dokumen...
    </option>
  `;

  try {
    const result =
      await fetchJSON(
        "/api/master-dokumen"
      );

    const data =
      Array.isArray(result)
        ? result
        : Array.isArray(
            result?.data
          )
          ? result.data
          : [];

    select.innerHTML = `
      <option value="">
        Pilih Dokumen
      </option>
    `;

    data.forEach(item => {
      const kode =
        String(
          item.kode_dokumen ||
          item.kode ||
          item.name ||
          item.nama_dokumen ||
          ""
        ).trim();

      const deskripsi =
        String(
          item.deskripsi ||
          item.nama_dokumen ||
          item.nama ||
          ""
        ).trim();

      const value =
        kode || deskripsi;

      if (!value) {
        return;
      }

      const option =
        document.createElement(
          "option"
        );

      option.value =
        value;

      option.textContent =
        kode && deskripsi
          ? `${kode} - ${deskripsi}`
          : value;

      select.appendChild(
        option
      );
    });

    // ==============================================
    // PILIH DATA LAMA SAAT EDIT
    // ==============================================

    if (selectedValue) {
      const nilaiLama =
        String(selectedValue)
          .trim()
          .toLowerCase();

      const optionCocok =
        Array.from(
          select.options
        ).find(option => {
          const value =
            String(
              option.value || ""
            )
              .trim()
              .toLowerCase();

          const text =
            String(
              option.textContent || ""
            )
              .trim()
              .toLowerCase();

          return (
            value === nilaiLama ||
            text === nilaiLama ||
            text.startsWith(
              `${nilaiLama} -`
            )
          );
        });

      if (optionCocok) {
        select.value =
          optionCocok.value;

      } else {
        /*
         * Jika data lama sudah tidak ada
         * di master, tetap munculkan supaya
         * dokumen masih dapat diedit.
         */

        const optionLama =
          document.createElement(
            "option"
          );

        optionLama.value =
          selectedValue;

        optionLama.textContent =
          `${selectedValue} (data lama)`;

        select.appendChild(
          optionLama
        );

        select.value =
          selectedValue;
      }
    }

  } catch (error) {
    console.error(
      "ERROR LOAD MASTER DOKUMEN SEWA:",
      error
    );

    select.innerHTML = `
      <option value="">
        Gagal memuat dokumen
      </option>
    `;

    throw error;

  } finally {
    select.disabled = false;
  }
}


// =====================================================
// RENDER DOKUMEN
// =====================================================

function renderDokumenSewa(
  dokumen = []
) {
  const tbody =
    document.getElementById(
      "dokumenSewaBody"
    );

  if (!tbody) {
    return;
  }

  const daftar =
    Array.isArray(dokumen)
      ? dokumen
      : [];

  if (daftar.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="message"
        >
          Belum ada dokumen proyek sewa.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    daftar
      .map(
        (
          item,
          index
        ) => {
          const id =
            Number(item.id);

          const memilikiFile =
            Boolean(
              String(
                item.path_file ||
                item.nama_file_simpan ||
                ""
              ).trim()
            );

          const ukuran =
            formatUkuranFile(
              item.ukuran_file
            );

          const urlFile =
            `/api/proyek-sewa/dokumen/` +
            `${encodeURIComponent(id)}/file`;

          return `
            <tr>

              <td>
                ${index + 1}
              </td>

              <td>
                <strong class="document-name">
                  ${escapeHtml(
                    item.nama_dokumen ||
                    "-"
                  )}
                </strong>
              </td>

              <td>
                ${escapeHtml(
                  item.nomor_dokumen ||
                  "-"
                )}
              </td>

              <td>
                ${
                  memilikiFile
                    ? `
                      <div class="document-file-info">

                        <span class="document-file-name">
                          ${escapeHtml(
                            item.nama_file_asli ||
                            item.nama_file_simpan ||
                            "Dokumen"
                          )}
                        </span>

                        ${
                          ukuran
                            ? `
                              <small>
                                ${escapeHtml(
                                  ukuran
                                )}
                              </small>
                            `
                            : ""
                        }

                      </div>
                    `
                    : `
                      <span class="document-no-file">
                        Belum ada file
                      </span>
                    `
                }
              </td>

              <td>
                <div class="document-actions">

                  ${
                    memilikiFile
                      ? `
                        <a
                          href="${urlFile}"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="
                            document-action-btn
                            document-action-view
                          "
                        >
                          Lihat
                        </a>

                        <a
                          href="${urlFile}?download=1"
                          class="
                            document-action-btn
                            document-action-download
                          "
                        >
                          Unduh
                        </a>
                      `
                      : ""
                  }

                  <button
                    type="button"
                    class="
                      document-action-btn
                      document-action-edit
                    "
                    data-edit-dokumen-sewa="${id}"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    class="
                      document-action-btn
                      document-action-delete
                    "
                    data-delete-dokumen-sewa="${id}"
                  >
                    Hapus
                  </button>

                </div>
              </td>

            </tr>
          `;
        }
      )
      .join("");
}


// =====================================================
// BUKA MODAL TAMBAH DOKUMEN
// =====================================================

async function bukaTambahDokumenSewa() {
  try {
    dokumenSewaEditId =
      null;

    const form =
      document.getElementById(
        "formDokumenSewa"
      );

    form?.reset();

    setText(
      "judulModalDokumenSewa",
      "Tambah Dokumen"
    );

    const fileLama =
      document.getElementById(
        "fileDokumenSewaLama"
      );

    if (fileLama) {
      fileLama.innerHTML = "";
    }

    const fileInput =
      document.getElementById(
        "fileDokumenSewa"
      );

    if (fileInput) {
      fileInput.value = "";
      fileInput.required = false;
    }

    await loadMasterDokumenSewa();

    bukaModal(
      "modalDokumenSewa"
    );

  } catch (error) {
    console.error(
      "ERROR BUKA TAMBAH DOKUMEN:",
      error
    );

    alert(
      error.message
    );
  }
}


// =====================================================
// BUKA MODAL EDIT DOKUMEN
// =====================================================

async function bukaEditDokumenSewa(
  id
) {
  try {
    const dokumenId =
      Number(id);

    const daftarDokumen =
      Array.isArray(
        detailProyekSewa?.dokumen
      )
        ? detailProyekSewa.dokumen
        : [];

    const dokumen =
      daftarDokumen.find(
        item =>
          Number(item.id) ===
          dokumenId
      );

    if (!dokumen) {
      throw new Error(
        "Data dokumen tidak ditemukan."
      );
    }

    dokumenSewaEditId =
      dokumenId;

    const form =
      document.getElementById(
        "formDokumenSewa"
      );

    form?.reset();

    setText(
      "judulModalDokumenSewa",
      "Edit Dokumen"
    );

    // Master harus selesai dimuat
    // sebelum menentukan pilihan lama.
    await loadMasterDokumenSewa(
      dokumen.nama_dokumen || ""
    );

    const nomorInput =
      document.getElementById(
        "nomorDokumenSewa"
      );

    if (nomorInput) {
      nomorInput.value =
        dokumen.nomor_dokumen ||
        "";
    }

    const fileInput =
      document.getElementById(
        "fileDokumenSewa"
      );

    if (fileInput) {
      fileInput.value = "";
      fileInput.required = false;
    }

    const fileLama =
      document.getElementById(
        "fileDokumenSewaLama"
      );

    if (fileLama) {
      const memilikiFile =
        Boolean(
          dokumen.path_file ||
          dokumen.nama_file_simpan
        );

      if (memilikiFile) {
        const urlFile =
          `/api/proyek-sewa/dokumen/` +
          `${encodeURIComponent(
            dokumenId
          )}/file`;

        fileLama.innerHTML = `
          <div
            style="
              margin-top: 10px;
              padding: 12px 14px;
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 9px;
            "
          >
            <div
              style="
                margin-bottom: 5px;
                color: #64748b;
                font-size: 11px;
              "
            >
              File saat ini
            </div>

            <strong>
              ${escapeHtml(
                dokumen.nama_file_asli ||
                dokumen.nama_file_simpan ||
                "Dokumen"
              )}
            </strong>

            <a
              href="${urlFile}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                margin-left: 8px;
                color: #4f46e5;
                font-weight: 700;
                text-decoration: none;
              "
            >
              Lihat
            </a>

            <div
              style="
                margin-top: 7px;
                color: #94a3b8;
                font-size: 11px;
              "
            >
              Kosongkan upload file jika tidak
              ingin mengganti file lama.
            </div>
          </div>
        `;

      } else {
        fileLama.innerHTML = `
          <div
            style="
              margin-top: 10px;
              color: #94a3b8;
              font-size: 11px;
            "
          >
            Dokumen ini belum memiliki file.
          </div>
        `;
      }
    }

    bukaModal(
      "modalDokumenSewa"
    );

  } catch (error) {
    console.error(
      "ERROR EDIT DOKUMEN SEWA:",
      error
    );

    alert(
      error.message
    );
  }
}


// =====================================================
// HAPUS DOKUMEN
// =====================================================

async function hapusDokumenSewa(
  id
) {
  const dokumenId =
    Number(id);

  if (
    !Number.isInteger(dokumenId) ||
    dokumenId <= 0
  ) {
    alert(
      "ID dokumen tidak valid."
    );

    return;
  }

  const konfirmasi =
    confirm(
      "Hapus dokumen proyek sewa ini?"
    );

  if (!konfirmasi) {
    return;
  }

  try {
    await fetchJSON(
      `/api/proyek-sewa/dokumen/${encodeURIComponent(
        dokumenId
      )}`,
      {
        method: "DELETE"
      }
    );

    await loadDetail();

  } catch (error) {
    console.error(
      "ERROR HAPUS DOKUMEN SEWA:",
      error
    );

    alert(
      error.message
    );
  }
}


// =====================================================
// EVENT TOMBOL DOKUMEN
// EVENT DELEGATION UNTUK TOMBOL DINAMIS
// =====================================================

document.addEventListener(
  "click",
  async event => {

    const tombolTambah =
      event.target.closest(
        "#btnTambahDokumenSewa"
      );

    if (tombolTambah) {
      event.preventDefault();

      await bukaTambahDokumenSewa();

      return;
    }

    const tombolEdit =
      event.target.closest(
        "[data-edit-dokumen-sewa]"
      );

    if (tombolEdit) {
      event.preventDefault();

      const id =
        tombolEdit.getAttribute(
          "data-edit-dokumen-sewa"
        );

      await bukaEditDokumenSewa(
        id
      );

      return;
    }

    const tombolHapus =
      event.target.closest(
        "[data-delete-dokumen-sewa]"
      );

    if (tombolHapus) {
      event.preventDefault();

      const id =
        tombolHapus.getAttribute(
          "data-delete-dokumen-sewa"
        );

      await hapusDokumenSewa(
        id
      );
    }
  }
);


// =====================================================
// SUBMIT TAMBAH / EDIT DOKUMEN
// =====================================================

const formDokumenSewa =
  document.getElementById(
    "formDokumenSewa"
  );

formDokumenSewa?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const namaDokumen =
      String(
        document.getElementById(
          "namaDokumenSewa"
        )?.value || ""
      ).trim();

    const nomorDokumen =
      String(
        document.getElementById(
          "nomorDokumenSewa"
        )?.value || ""
      ).trim();

    const fileInput =
      document.getElementById(
        "fileDokumenSewa"
      );

    if (!namaDokumen) {
      alert(
        "Pilih dokumen terlebih dahulu."
      );

      return;
    }

    const formData =
      new FormData();

    formData.append(
      "nama_dokumen",
      namaDokumen
    );

    formData.append(
      "nomor_dokumen",
      nomorDokumen
    );

    if (
      fileInput?.files?.[0]
    ) {
      formData.append(
        "file_dokumen",
        fileInput.files[0]
      );
    }

    const sedangEdit =
      Number.isInteger(
        dokumenSewaEditId
      ) &&
      dokumenSewaEditId > 0;

    const url =
      sedangEdit
        ? `/api/proyek-sewa/dokumen/${encodeURIComponent(
            dokumenSewaEditId
          )}`
        : `/api/proyek-sewa/${encodeURIComponent(
            proyekSewaId
          )}/dokumen`;

    const method =
      sedangEdit
        ? "PUT"
        : "POST";

    const button =
      document.getElementById(
        "btnSimpanDokumenSewa"
      );

    const textAwal =
      button?.textContent ||
      "Simpan Dokumen";

    try {
      if (button) {
        button.disabled = true;

        button.textContent =
          sedangEdit
            ? "Menyimpan Perubahan..."
            : "Menyimpan Dokumen...";
      }

      const result =
        await fetchJSON(
          url,
          {
            method,
            body: formData
          }
        );

      alert(
        result.message ||
        (
          sedangEdit
            ? "Dokumen berhasil diperbarui."
            : "Dokumen berhasil ditambahkan."
        )
      );

      tutupModal(
        "modalDokumenSewa"
      );

      dokumenSewaEditId =
        null;

      formDokumenSewa.reset();

      await loadDetail();

    } catch (error) {
      console.error(
        "ERROR SIMPAN DOKUMEN SEWA:",
        error
      );

      alert(
        error.message
      );

    } finally {
      if (button) {
        button.disabled = false;

        button.textContent =
          textAwal;
      }
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

      await loadDetail();

      console.log(
        "PROYEK SEWA DETAIL SIAP"
      );

    } catch (error) {

      console.error(
        "ERROR INITIALIZE DETAIL:",
        error
      );

    }

  }
);