// =====================================================
// PROYEK SEWA LIST
// =====================================================

console.log("PROYEK SEWA JS LOADED");


// =====================================================
// GLOBAL
// =====================================================

let semuaProyekSewa = [];
let dataTerfilter = [];

let currentPage = 1;
const rowsPerPage = 10;


// =====================================================
// DOM
// =====================================================

const proyekSewaBody =
  document.getElementById(
    "proyekSewaBody"
  );

const jumlahProyekSewa =
  document.getElementById(
    "jumlahProyekSewa"
  );

const totalNilaiProyekSewa =
  document.getElementById(
    "totalNilaiProyekSewa"
  );

const totalNilaiBulanBerjalan =
  document.getElementById(
    "totalNilaiBulanBerjalan"
  );

const totalNilaiDibayar =
  document.getElementById(
    "totalNilaiDibayar"
  );

const bulanBerjalanLabel =
  document.getElementById(
    "bulanBerjalanLabel"
  );

const searchProyekSewa =
  document.getElementById(
    "searchProyekSewa"
  );

const filterJenisProduk =
  document.getElementById(
    "filterJenisProduk"
  );

const filterTahun =
  document.getElementById(
    "filterTahun"
  );

const resetFilter =
  document.getElementById(
    "resetFilter"
  );

const pagination =
  document.getElementById(
    "pagination"
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

  const hasil =
    Number(value);

  return Number.isFinite(hasil)
    ? hasil
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
      minimumFractionDigits: 0,
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

  /*
    Ambil YYYY-MM-DD langsung agar tidak terkena
    masalah timezone mundur 1 hari.
  */

  const tanggalString =
    String(value)
      .substring(0, 10);

  const bagian =
    tanggalString.split("-");

  if (
    bagian.length !== 3
  ) {
    return "-";
  }

  const [
    tahun,
    bulan,
    tanggal
  ] = bagian;

  return `${tanggal}/${bulan}/${tahun}`;

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
// NORMALISASI ARRAY
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
// LOAD DATA
// =====================================================

async function loadProyekSewa() {

  try {

    proyekSewaBody.innerHTML = `
      <tr>
        <td
          colspan="9"
          class="table-message"
        >
          Memuat data proyek sewa...
        </td>
      </tr>
    `;


    const response =
      await fetch(
        "/api/proyek-sewa",
        {
          credentials:
            "same-origin"
        }
      );


    if (
      response.status === 401
    ) {

      window.location.href =
        "/login.html";

      return;

    }


    const result =
      await response.json();


    if (
      !response.ok
    ) {

      throw new Error(
        result.error ||
        "Gagal mengambil data proyek sewa."
      );

    }


    semuaProyekSewa =
      ambilArray(result);


    console.log(
      "DATA PROYEK SEWA:",
      semuaProyekSewa
    );


    isiFilterJenisProduk();

    isiFilterTahun();

    applyFilter();

    renderSummary();


  } catch (error) {

    console.error(
      "ERROR LOAD PROYEK SEWA:",
      error
    );


    proyekSewaBody.innerHTML = `
      <tr>

        <td
          colspan="9"
          class="table-message"
        >
          ${escapeHtml(
            error.message
          )}
        </td>

      </tr>
    `;

  }

}


// =====================================================
// JENIS PRODUK DARI RESPONSE
// =====================================================

function getJenisProduk(item) {

  /*
    Backend nanti akan mengembalikan:
    jenis_produk

    Contoh:
    PC, Notebook, Smartphone
  */

  return (
    item.jenis_produk ||
    item.produk ||
    item.item_produk ||
    "-"
  );

}


// =====================================================
// ISI FILTER PRODUK
// =====================================================

function isiFilterJenisProduk() {

  if (!filterJenisProduk) {
    return;
  }


  const valueSebelumnya =
    filterJenisProduk.value;


  const daftar =
    [
      ...new Set(
        semuaProyekSewa
          .map(
            item =>
              getJenisProduk(item)
          )
          .filter(
            item =>
              item &&
              item !== "-"
          )
      )
    ]
      .sort(
        (a, b) =>
          a.localeCompare(
            b,
            "id"
          )
      );


  filterJenisProduk.innerHTML = `
    <option value="">
      Semua Jenis Produk
    </option>
  `;


  daftar.forEach(
    (item) => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        item;

      option.textContent =
        item;

      filterJenisProduk
        .appendChild(
          option
        );

    }
  );


  if (
    daftar.includes(
      valueSebelumnya
    )
  ) {

    filterJenisProduk.value =
      valueSebelumnya;

  }

}


// =====================================================
// ISI FILTER TAHUN
// =====================================================

function isiFilterTahun() {

  if (!filterTahun) {
    return;
  }


  const valueSebelumnya =
    filterTahun.value;


  const tahun =
    [
      ...new Set(
        semuaProyekSewa
          .flatMap(
            item => {

              const hasil = [];

              if (
                item.tanggal_mulai
              ) {

                hasil.push(
                  String(
                    item.tanggal_mulai
                  ).substring(
                    0,
                    4
                  )
                );

              }

              if (
                item.tanggal_akhir
              ) {

                hasil.push(
                  String(
                    item.tanggal_akhir
                  ).substring(
                    0,
                    4
                  )
                );

              }

              return hasil;

            }
          )
          .filter(Boolean)
      )
    ]
      .sort(
        (a, b) =>
          Number(b) -
          Number(a)
      );


  filterTahun.innerHTML = `
    <option value="">
      Semua Tahun
    </option>
  `;


  tahun.forEach(
    (item) => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        item;

      option.textContent =
        item;

      filterTahun.appendChild(
        option
      );

    }
  );


  if (
    tahun.includes(
      valueSebelumnya
    )
  ) {

    filterTahun.value =
      valueSebelumnya;

  }

}


// =====================================================
// FILTER
// =====================================================

function applyFilter() {

  const keyword =
    String(
      searchProyekSewa?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const jenisProduk =
    String(
      filterJenisProduk?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  const tahun =
    String(
      filterTahun?.value ||
      ""
    );


  dataTerfilter =
    semuaProyekSewa.filter(
      (item) => {

        // ===============================================
        // SEARCH
        // ===============================================

        const textCari =
          [
            item.nomor_pr,
            item.nomor_rujukan,
            item.nama_proyek,
            item.nama_klien,
            item.perusahaan_klien,
            getJenisProduk(item)
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        const cocokKeyword =
          !keyword ||
          textCari.includes(
            keyword
          );


        // ===============================================
        // PRODUK
        // ===============================================

        const produkItem =
          String(
            getJenisProduk(item)
          )
            .toLowerCase();


        const cocokProduk =
          !jenisProduk ||
          produkItem ===
            jenisProduk;


        // ===============================================
        // TAHUN
        // ===============================================

        let cocokTahun = true;


        if (tahun) {

          const tahunMulai =
            item.tanggal_mulai
              ? String(
                  item.tanggal_mulai
                ).substring(
                  0,
                  4
                )
              : "";


          const tahunAkhir =
            item.tanggal_akhir
              ? String(
                  item.tanggal_akhir
                ).substring(
                  0,
                  4
                )
              : "";


          cocokTahun =
            tahunMulai === tahun ||
            tahunAkhir === tahun;

        }


        return (
          cocokKeyword &&
          cocokProduk &&
          cocokTahun
        );

      }
    );


  currentPage = 1;


  renderTable();

  renderPagination();

}


// =====================================================
// SUMMARY PROYEK SEWA
// =====================================================

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


  const htmlProduk =
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
              ) =>
                total +
                Number(
                  order.quantity ||
                  0
                ),
              0
            );


          totalSemuaUnit +=
            totalProduk;


          const htmlOrder =
            orders
              .map(
                order => {

                  const namaCabang =
                    order.nama_cabang ||
                    "-";

                  const quantity =
                    Number(
                      order.quantity ||
                      0
                    );


                  return `
                    <div
                      class="project-summary-order"
                    >
                      ${escapeHtml(
                        namaCabang
                      )}
                      ${quantity} Unit
                    </div>
                  `;

                }
              )
              .join("");


          return `
            <div class="project-summary-item">

              <div
                class="project-summary-product"
              >
                ${escapeHtml(
                  item.item_produk ||
                  "-"
                )}
              </div>

              ${htmlOrder}

            </div>
          `;

        }
      )
      .join("");


  return `
    <div class="project-summary">

      ${htmlProduk}

      <div
        class="project-summary-total"
      >
        Total ${totalSemuaUnit} Unit
      </div>

    </div>
  `;

}
// =====================================================
// RENDER TABLE
// =====================================================

function renderTable() {

  if (!proyekSewaBody) {
    return;
  }


  if (
    dataTerfilter.length === 0
  ) {

    proyekSewaBody.innerHTML = `
      <tr>

        <td
          colspan="9"
          class="table-message"
        >
          Belum ada data proyek sewa.
        </td>

      </tr>
    `;


    if (jumlahProyekSewa) {

      jumlahProyekSewa.textContent =
        "0 proyek";

    }

    return;

  }


  const start =
    (currentPage - 1) *
    rowsPerPage;


  const end =
    start +
    rowsPerPage;


  const pageData =
    dataTerfilter.slice(
      start,
      end
    );


  proyekSewaBody.innerHTML =
    pageData
      .map(
        (item, index) => {

          const nomor =
            start +
            index +
            1;


          const nomorPr =
            item.nomor_pr ||
            "-";


          const nomorRujukan =
            item.nomor_rujukan ||
            item.nama_proyek ||
            "-";


          const jenisProduk =
            getJenisProduk(
              item
            );


          return `
            <tr>

              <td>
                ${nomor}
              </td>


              <td>

                <div class="project-name">

                  ${escapeHtml(
                    nomorPr
                  )}

                </div>

              </td>


              <td>

                ${escapeHtml(
                  nomorRujukan
                )}

              </td>


              <td>

                <span class="product-badge">

                  ${escapeHtml(
                    jenisProduk
                  )}

                </span>

              </td>


              <td class="currency">

                ${rupiah(
                  item.total_nilai_per_bulan
                )}

              </td>


              <td class="currency">

                ${rupiah(
                  item.total_nilai
                )}

              </td>

              <td>

                <div class="action-group">


                  <a
                    href="/proyek-sewa-detail.html?id=${encodeURIComponent(
                      item.id
                    )}"
                    class="action-button detail"
                  >
                    Detail
                  </a>

                  <button
                    type="button"
                    class="action-button delete"
                    onclick="hapusProyekSewa(${Number(
                      item.id
                    )})"
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


  if (jumlahProyekSewa) {

    jumlahProyekSewa.textContent =
      `${dataTerfilter.length} proyek`;

  }

}


// =====================================================
// SUMMARY
// =====================================================

function renderSummary() {

  let totalProyek = 0;

  let totalBulanBerjalan = 0;

  let totalDibayar = 0;


  const sekarang =
    new Date();


  const tahunSekarang =
    sekarang.getFullYear();


  const bulanSekarang =
    sekarang.getMonth() + 1;


  semuaProyekSewa.forEach(
    (item) => {

      // ===============================================
      // TOTAL SELURUH PROYEK
      // ===============================================

      totalProyek +=
        angka(
          item.total_nilai
        );


      // ===============================================
      // TOTAL DIBAYAR
      // ===============================================

      totalDibayar +=
        angka(
          item.total_dibayar
        );


      // ===============================================
      // BULAN BERJALAN
      //
      // Backend nanti mengembalikan nilai_bulan_berjalan
      // supaya perhitungan kontrak aktif lebih akurat.
      // ===============================================

      totalBulanBerjalan +=
        angka(
          item.nilai_bulan_berjalan
        );

    }
  );


  if (
    totalNilaiProyekSewa
  ) {

    totalNilaiProyekSewa.textContent =
      rupiah(
        totalProyek
      );

  }


  if (
    totalNilaiBulanBerjalan
  ) {

    totalNilaiBulanBerjalan.textContent =
      rupiah(
        totalBulanBerjalan
      );

  }


  if (
    totalNilaiDibayar
  ) {

    totalNilaiDibayar.textContent =
      rupiah(
        totalDibayar
      );

  }


  // ===============================================
  // LABEL BULAN
  // ===============================================

  if (
    bulanBerjalanLabel
  ) {

    const namaBulan =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          month: "long",
          year: "numeric"
        }
      ).format(
        new Date(
          tahunSekarang,
          bulanSekarang - 1,
          1
        )
      );


    bulanBerjalanLabel.textContent =
      namaBulan;

  }

}


// =====================================================
// PAGINATION
// =====================================================

function renderPagination() {

  if (!pagination) {
    return;
  }


  const totalPages =
    Math.ceil(
      dataTerfilter.length /
      rowsPerPage
    );


  pagination.innerHTML = "";


  if (
    totalPages <= 1
  ) {

    return;

  }


  // ===============================================
  // PREVIOUS
  // ===============================================

  const prev =
    document.createElement(
      "button"
    );


  prev.type =
    "button";


  prev.textContent =
    "‹";


  prev.disabled =
    currentPage === 1;


  prev.addEventListener(
    "click",
    () => {

      if (
        currentPage > 1
      ) {

        currentPage--;

        renderTable();

        renderPagination();

      }

    }
  );


  pagination.appendChild(
    prev
  );


  // ===============================================
  // PAGE NUMBER
  // ===============================================

  const maksimalTombol = 5;


  let startPage =
    Math.max(
      1,
      currentPage - 2
    );


  let endPage =
    Math.min(
      totalPages,
      startPage +
      maksimalTombol -
      1
    );


  if (
    endPage -
      startPage +
      1 <
    maksimalTombol
  ) {

    startPage =
      Math.max(
        1,
        endPage -
          maksimalTombol +
          1
      );

  }


  for (
    let page = startPage;
    page <= endPage;
    page++
  ) {

    const button =
      document.createElement(
        "button"
      );


    button.type =
      "button";


    button.textContent =
      page;


    if (
      page === currentPage
    ) {

      button.classList.add(
        "active"
      );

    }


    button.addEventListener(
      "click",
      () => {

        currentPage =
          page;

        renderTable();

        renderPagination();

      }
    );


    pagination.appendChild(
      button
    );

  }


  // ===============================================
  // NEXT
  // ===============================================

  const next =
    document.createElement(
      "button"
    );


  next.type =
    "button";


  next.textContent =
    "›";


  next.disabled =
    currentPage ===
    totalPages;


  next.addEventListener(
    "click",
    () => {

      if (
        currentPage <
        totalPages
      ) {

        currentPage++;

        renderTable();

        renderPagination();

      }

    }
  );


  pagination.appendChild(
    next
  );

}


// =====================================================
// HAPUS PROYEK SEWA
// =====================================================

window.hapusProyekSewa =
  async function (
    id
  ) {

    if (!id) {
      return;
    }


    const proyek =
      semuaProyekSewa.find(
        item =>
          Number(item.id) ===
          Number(id)
      );


    const nomorPr =
      proyek?.nomor_pr ||
      `ID ${id}`;


    const yakin =
      confirm(
        `Hapus Proyek Sewa ${nomorPr}?\n\n` +
        `Produk, order dan pembayaran di dalam proyek ini juga akan dihapus.`
      );


    if (!yakin) {
      return;
    }


    try {

      const response =
        await fetch(
          `/api/proyek-sewa/${encodeURIComponent(
            id
          )}`,
          {
            method:
              "DELETE",

            credentials:
              "same-origin"
          }
        );


      const result =
        await response
          .json()
          .catch(
            () => ({})
          );


      if (
        response.status === 401
      ) {

        window.location.href =
          "/login.html";

        return;

      }


      if (
        !response.ok
      ) {

        throw new Error(
          result.error ||
          "Gagal menghapus proyek sewa."
        );

      }


      await loadProyekSewa();


    } catch (error) {

      console.error(
        "ERROR DELETE PROYEK SEWA:",
        error
      );


      alert(
        error.message ||
        "Gagal menghapus proyek sewa."
      );

    }

  };


// =====================================================
// EVENT FILTER
// =====================================================

searchProyekSewa?.addEventListener(
  "input",
  () => {

    applyFilter();

  }
);


filterJenisProduk?.addEventListener(
  "change",
  () => {

    applyFilter();

  }
);


filterTahun?.addEventListener(
  "change",
  () => {

    applyFilter();

  }
);


resetFilter?.addEventListener(
  "click",
  () => {

    if (
      searchProyekSewa
    ) {

      searchProyekSewa.value =
        "";

    }


    if (
      filterJenisProduk
    ) {

      filterJenisProduk.value =
        "";

    }


    if (
      filterTahun
    ) {

      filterTahun.value =
        "";

    }


    applyFilter();

  }
);


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    loadProyekSewa();

  }
);