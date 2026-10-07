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
// FILTER DARI DASHBOARD
// =====================================================

const proyekSewaUrlParams =
  new URLSearchParams(
    window.location.search
  );

const statusDoParameter =
  String(
    proyekSewaUrlParams.get(
      "status_do"
    ) || ""
  )
    .trim()
    .toLowerCase();

let statusDoDashboard = "";

if (
  [
    "belum",
    "belum-do",
    "belum_do"
  ].includes(statusDoParameter)
) {
  statusDoDashboard =
    "belum";
}

if (
  [
    "sudah",
    "sudah-do",
    "sudah_do"
  ].includes(statusDoParameter)
) {
  statusDoDashboard =
    "sudah";
}

const searchUrl =
  String(
    proyekSewaUrlParams.get(
      "search"
    ) || ""
  ).trim();

const jenisProdukUrl =
  String(
    proyekSewaUrlParams.get(
      "jenis_produk"
    ) || ""
  ).trim();

/*
 * Tahun tidak digunakan ketika filter berasal
 * dari kartu PR Belum DO atau PR Sudah DO.
 */
const tahunUrl =
  statusDoDashboard
    ? ""
    : String(
        proyekSewaUrlParams.get(
          "tahun"
        ) || ""
      ).trim();


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

  const text =
    String(value).slice(0, 10);

  if (
    /^\d{4}-\d{2}-\d{2}$/
      .test(text)
  ) {
    const [
      tahun,
      bulan,
      tanggal
    ] = text.split("-");

    return `${tanggal}/${bulan}/${tahun}`;
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
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Jakarta"
    }
  ).format(date);
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
// AMBIL ARRAY RESPONSE
// =====================================================

function ambilArray(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (
    Array.isArray(
      result?.data
    )
  ) {
    return result.data;
  }

  if (
    Array.isArray(
      result?.rows
    )
  ) {
    return result.rows;
  }

  return [];
}


// =====================================================
// NORMALISASI BOOLEAN
// =====================================================

function nilaiBoolean(value) {
  if (
    value === true ||
    value === 1 ||
    value === "1"
  ) {
    return true;
  }

  const text =
    String(value || "")
      .trim()
      .toLowerCase();

  return [
    "true",
    "ya",
    "yes",
    "sudah",
    "ada"
  ].includes(text);
}


// =====================================================
// AMBIL SELURUH ORDER DALAM SATU PR
// =====================================================

function getOrderProyekSewa(
  item
) {
  const semuaOrder = [];

  if (
    Array.isArray(
      item?.orders
    )
  ) {
    semuaOrder.push(
      ...item.orders
    );
  }

  const daftarProduk = [
    ...(
      Array.isArray(
        item?.produk_summary
      )
        ? item.produk_summary
        : []
    ),

    ...(
      Array.isArray(
        item?.produk
      )
        ? item.produk
        : []
    )
  ];

  daftarProduk.forEach(
    produk => {
      if (
        Array.isArray(
          produk?.orders
        )
      ) {
        semuaOrder.push(
          ...produk.orders
        );
      }
    }
  );

  return semuaOrder;
}


// =====================================================
// CEK PR SUDAH MEMILIKI MINIMAL SATU DO
// =====================================================

function proyekPunyaTanggalDo(
  item
) {
  /*
   * Jika API mengirim daftar Order,
   * jadikan seluruh Order sebagai sumber utama.
   */
  const semuaOrder =
    getOrderProyekSewa(item);

  if (semuaOrder.length > 0) {
    return semuaOrder.some(
      order =>
        String(
          order?.tanggal_do || ""
        ).trim() !== ""
    );
  }

  /*
   * Fallback jika API listing hanya mengirim
   * hasil agregasi jumlah DO.
   */
  const jumlahDo =
    angka(
      item?.jumlah_do ??
      item?.total_do ??
      0
    );

  if (jumlahDo > 0) {
    return true;
  }

  if (
    String(
      item?.tanggal_do ||
      item?.tanggal_do_terakhir ||
      ""
    ).trim() !== ""
  ) {
    return true;
  }

  if (
    item?.punya_tanggal_do !==
      undefined &&
    item?.punya_tanggal_do !==
      null
  ) {
    return nilaiBoolean(
      item.punya_tanggal_do
    );
  }

  if (
    item?.sudah_ada_do !==
      undefined &&
    item?.sudah_ada_do !==
      null
  ) {
    return nilaiBoolean(
      item.sudah_ada_do
    );
  }

  if (
    item?.ada_do !== undefined &&
    item?.ada_do !== null
  ) {
    return nilaiBoolean(
      item.ada_do
    );
  }

  return false;
}


// =====================================================
// JENIS PRODUK
// =====================================================

function getJenisProduk(item) {
  return (
    item?.jenis_produk ||
    item?.produk ||
    item?.item_produk ||
    "-"
  );
}


// =====================================================
// SINKRONKAN FILTER KE URL
// =====================================================

function updateProyekSewaUrl() {
  const params =
    new URLSearchParams();

  const search =
    String(
      searchProyekSewa
        ?.value || ""
    ).trim();

  const jenis =
    String(
      filterJenisProduk
        ?.value || ""
    ).trim();

  const tahun =
    String(
      filterTahun
        ?.value || ""
    ).trim();

  if (statusDoDashboard) {
    params.set(
      "status_do",
      statusDoDashboard
    );
  }

  if (search) {
    params.set(
      "search",
      search
    );
  }

  if (jenis) {
    params.set(
      "jenis_produk",
      jenis
    );
  }

  if (
    tahun &&
    !statusDoDashboard
  ) {
    params.set(
      "tahun",
      tahun
    );
  }

  const query =
    params.toString();

  window.history.replaceState(
    {},
    "",
    query
      ? `/proyek-sewa.html?${query}`
      : "/proyek-sewa.html"
  );
}


// =====================================================
// LOAD DATA
// =====================================================

async function loadProyekSewa() {
  if (!proyekSewaBody) {
    return;
  }

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

    /*
     * Selalu ambil seluruh PR.
     * Filter DO dilakukan pada applyFilter()
     * berdasarkan seluruh Order setiap PR.
     */
    const apiUrl =
      "/api/proyek-sewa";

    const response =
      await fetch(
        apiUrl,
        {
          headers: {
            Accept:
              "application/json"
          },

          credentials:
            "include",

          cache:
            "no-store"
        }
      );

    if (
      response.status === 401
    ) {
      window.location.href =
        "/login.html";

      return;
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
      const text =
        await response.text();

      throw new Error(
        text ||
        `Server menghasilkan status ${response.status}`
      );
    }

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil data proyek sewa."
      );
    }

    semuaProyekSewa =
      ambilArray(result);

    isiFilterJenisProduk();
    isiFilterTahun();
    initializeFilterValue();
    applyFilter();

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
// ISI FILTER JENIS PRODUK
// =====================================================

function isiFilterJenisProduk() {
  if (!filterJenisProduk) {
    return;
  }

  const nilaiSebelumnya =
    filterJenisProduk.value;

  const daftar = [
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
  ].sort(
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
    item => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        item;

      option.textContent =
        item;

      filterJenisProduk
        .appendChild(option);
    }
  );

  if (
    daftar.includes(
      nilaiSebelumnya
    )
  ) {
    filterJenisProduk.value =
      nilaiSebelumnya;
  }
}


// =====================================================
// ISI FILTER TAHUN
// =====================================================

function isiFilterTahun() {
  if (!filterTahun) {
    return;
  }

  const nilaiSebelumnya =
    filterTahun.value;

  const tahun = [
    ...new Set(
      semuaProyekSewa
        .flatMap(
          item => {
            const hasil = [];

            [
              item.tanggal_mulai,
              item.tanggal_akhir,
              item.created_at
            ].forEach(
              value => {
                if (value) {
                  hasil.push(
                    String(value)
                      .slice(0, 4)
                  );
                }
              }
            );

            return hasil;
          }
        )
        .filter(
          value =>
            /^\d{4}$/
              .test(value)
        )
    )
  ].sort(
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
    item => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        item;

      option.textContent =
        item;

      filterTahun
        .appendChild(option);
    }
  );

  if (
    tahun.includes(
      nilaiSebelumnya
    )
  ) {
    filterTahun.value =
      nilaiSebelumnya;
  }
}


// =====================================================
// INITIAL FILTER
// =====================================================

function initializeFilterValue() {
  if (searchProyekSewa) {
    searchProyekSewa.value =
      searchUrl;
  }

  if (filterJenisProduk) {
    const tersedia = [
      ...filterJenisProduk.options
    ].some(
      option =>
        option.value ===
        jenisProdukUrl
    );

    filterJenisProduk.value =
      tersedia
        ? jenisProdukUrl
        : "";
  }

  if (filterTahun) {
    /*
     * Filter tahun dikosongkan jika halaman
     * dibuka melalui kartu PR Dashboard.
     */
    if (statusDoDashboard) {
      filterTahun.value = "";
      filterTahun.disabled = true;
    } else {
      const tersedia = [
        ...filterTahun.options
      ].some(
        option =>
          option.value ===
          tahunUrl
      );

      filterTahun.value =
        tersedia
          ? tahunUrl
          : "";

      filterTahun.disabled =
        false;
    }
  }
}


// =====================================================
// FILTER DATA
// =====================================================

function applyFilter() {
  const keyword =
    String(
      searchProyekSewa
        ?.value || ""
    )
      .trim()
      .toLowerCase();

  const jenisProduk =
    String(
      filterJenisProduk
        ?.value || ""
    )
      .trim()
      .toLowerCase();

  const tahun =
    statusDoDashboard
      ? ""
      : String(
          filterTahun
            ?.value || ""
        ).trim();

  dataTerfilter =
    semuaProyekSewa.filter(
      item => {
        const textCari = [
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

        const produkItem =
          String(
            getJenisProduk(item)
          ).toLowerCase();

        const cocokProduk =
          !jenisProduk ||
          produkItem ===
            jenisProduk;

        let cocokTahun = true;

        if (tahun) {
          const daftarTahun = [
            item.tanggal_mulai,
            item.tanggal_akhir,
            item.created_at
          ]
            .filter(Boolean)
            .map(
              value =>
                String(value)
                  .slice(0, 4)
            );

          cocokTahun =
            daftarTahun.includes(
              tahun
            );
        }

        const punyaTanggalDo =
          proyekPunyaTanggalDo(
            item
          );

        let cocokStatusDo =
          true;

        /*
         * PR Belum DO:
         * tidak ada Order yang memiliki tanggal_do.
         */
        if (
          statusDoDashboard ===
          "belum"
        ) {
          cocokStatusDo =
            !punyaTanggalDo;
        }

        /*
         * PR Sudah Ada DO:
         * minimal satu Order memiliki tanggal_do.
         */
        if (
          statusDoDashboard ===
          "sudah"
        ) {
          cocokStatusDo =
            punyaTanggalDo;
        }

        return (
          cocokKeyword &&
          cocokProduk &&
          cocokTahun &&
          cocokStatusDo
        );
      }
    );

  currentPage = 1;

  renderTable();
  renderPagination();

  renderSummary(
    dataTerfilter
  );

  renderStatusDoFilter();
  updateProyekSewaUrl();
}


// =====================================================
// BANNER FILTER STATUS DO
// =====================================================

function renderStatusDoFilter() {
  let banner =
    document.getElementById(
      "statusDoFilterBanner"
    );

  if (!statusDoDashboard) {
    if (banner) {
      banner.remove();
    }

    return;
  }

  if (!banner) {
    banner =
      document.createElement(
        "div"
      );

    banner.id =
      "statusDoFilterBanner";

    banner.style.cssText = `
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
      margin-bottom:16px;
      padding:13px 16px;
      border:1px solid #c7d2fe;
      border-radius:12px;
      background:#eef2ff;
      color:#3730a3;
      font-size:12px;
      font-weight:700;
    `;

    const tableWrapper =
      proyekSewaBody
        ?.closest(
          ".table-wrapper"
        );

    if (
      tableWrapper?.parentElement
    ) {
      tableWrapper
        .parentElement
        .insertBefore(
          banner,
          tableWrapper
        );
    }
  }

  const statusText =
    statusDoDashboard ===
      "sudah"
      ? "PR Sudah Ada DO"
      : "PR Belum Ada DO";

  banner.innerHTML = `
    <span>
      Filter aktif:
      ${escapeHtml(
        statusText
      )}
      —
      ${dataTerfilter
        .length
        .toLocaleString(
          "id-ID"
        )}
      proyek ditemukan
    </span>

    <a
      href="/proyek-sewa.html"
      style="
        color:#4338ca;
        font-weight:800;
        text-decoration:none;
        white-space:nowrap;
      "
    >
      Hapus Filter
    </a>
  `;
}


// =====================================================
// SUMMARY PRODUK DAN ORDER
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
              item?.orders
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
                angka(
                  order?.quantity
                ),
              0
            );

          totalSemuaUnit +=
            totalProduk;

          const htmlOrder =
            orders
              .map(
                order => `
                  <div class="project-summary-order">
                    ${escapeHtml(
                      order?.nama_cabang ||
                      "-"
                    )}
                    ${angka(
                      order?.quantity
                    )}
                    Unit
                  </div>
                `
              )
              .join("");

          return `
            <div class="project-summary-item">
              <div class="project-summary-product">
                ${escapeHtml(
                  item?.item_produk ||
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

      <div class="project-summary-total">
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
          Belum ada data proyek sewa yang sesuai.
        </td>
      </tr>
    `;

    if (jumlahProyekSewa) {
      jumlahProyekSewa.textContent =
        "0 proyek";
    }

    return;
  }

  const totalPages =
    Math.max(
      Math.ceil(
        dataTerfilter.length /
        rowsPerPage
      ),
      1
    );

  if (
    currentPage >
    totalPages
  ) {
    currentPage =
      totalPages;
  }

  const start =
    (
      currentPage - 1
    ) *
    rowsPerPage;

  const pageData =
    dataTerfilter.slice(
      start,
      start +
      rowsPerPage
    );

  proyekSewaBody.innerHTML =
    pageData
      .map(
        (
          item,
          index
        ) => {
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
            getJenisProduk(item);

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
                    data-delete-proyek-sewa="${Number(
                      item.id
                    )}"
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
      `${dataTerfilter
        .length
        .toLocaleString(
          "id-ID"
        )} proyek`;
  }
}


// =====================================================
// SUMMARY
// =====================================================

function renderSummary(
  sumberData =
    semuaProyekSewa
) {
  const dataSummary =
    Array.isArray(
      sumberData
    )
      ? sumberData
      : [];

  const totalProyek =
    dataSummary.reduce(
      (
        total,
        item
      ) =>
        total +
        angka(
          item.total_nilai
        ),
      0
    );

  const totalBulanBerjalan =
    dataSummary.reduce(
      (
        total,
        item
      ) =>
        total +
        angka(
          item.nilai_bulan_berjalan
        ),
      0
    );

  const dibayar =
    dataSummary.reduce(
      (
        total,
        item
      ) =>
        total +
        angka(
          item.total_dibayar
        ),
      0
    );

  if (
    totalNilaiProyekSewa
  ) {
    totalNilaiProyekSewa
      .textContent =
        rupiah(totalProyek);
  }

  if (
    totalNilaiBulanBerjalan
  ) {
    totalNilaiBulanBerjalan
      .textContent =
        rupiah(
          totalBulanBerjalan
        );
  }

  if (totalNilaiDibayar) {
    totalNilaiDibayar
      .textContent =
        rupiah(dibayar);
  }

  if (bulanBerjalanLabel) {
    bulanBerjalanLabel
      .textContent =
        new Intl.DateTimeFormat(
          "id-ID",
          {
            month: "long",
            year: "numeric"
          }
        ).format(
          new Date()
        );
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

  if (totalPages <= 1) {
    return;
  }

  function buatTombol(
    label,
    page,
    disabled = false,
    active = false
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.textContent =
      label;

    button.disabled =
      disabled;

    if (active) {
      button.classList.add(
        "active"
      );
    }

    button.addEventListener(
      "click",
      () => {
        if (
          disabled ||
          page === currentPage
        ) {
          return;
        }

        currentPage =
          page;

        renderTable();
        renderPagination();

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    );

    return button;
  }

  pagination.appendChild(
    buatTombol(
      "‹",
      currentPage - 1,
      currentPage === 1
    )
  );

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
    page += 1
  ) {
    pagination.appendChild(
      buatTombol(
        String(page),
        page,
        false,
        page === currentPage
      )
    );
  }

  pagination.appendChild(
    buatTombol(
      "›",
      currentPage + 1,
      currentPage ===
        totalPages
    )
  );
}


// =====================================================
// HAPUS PROYEK SEWA
// =====================================================

async function hapusProyekSewa(
  id
) {

  const proyekSewaId =
    Number(id);


  if (
    !Number.isInteger(proyekSewaId) ||
    proyekSewaId <= 0
  ) {

    alert(
      "ID proyek sewa tidak valid."
    );

    return;
  }


  const yakin =
    window.confirm(
      "Apakah Anda yakin ingin menghapus proyek sewa ini?"
    );


  if (!yakin) {
    return;
  }


  try {

    const response =
      await fetch(
        `/api/proyek-sewa/${encodeURIComponent(proyekSewaId)}`,
        {
          method:
            "DELETE",

          headers: {
            "Accept":
              "application/json"
          }
        }
      );


    let result = {};


    try {

      result =
        await response.json();

    } catch (parseError) {

      result = {};

    }


    if (!response.ok) {

      throw new Error(
        result.error ||
        `Gagal menghapus proyek sewa. Status ${response.status}.`
      );

    }


    alert(
      result.message ||
      "Proyek sewa berhasil dihapus."
    );


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
}

window.hapusProyekSewa =
  hapusProyekSewa;


// =====================================================
// EVENT DELETE
// =====================================================

proyekSewaBody
  ?.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-delete-proyek-sewa]"
        );

      if (!button) {
        return;
      }

      hapusProyekSewa(
        button.dataset
          .deleteProyekSewa
      );
    }
  );


// =====================================================
// EVENT FILTER
// =====================================================

searchProyekSewa
  ?.addEventListener(
    "input",
    applyFilter
  );

filterJenisProduk
  ?.addEventListener(
    "change",
    applyFilter
  );

filterTahun
  ?.addEventListener(
    "change",
    applyFilter
  );

resetFilter
  ?.addEventListener(
    "click",
    () => {
      if (searchProyekSewa) {
        searchProyekSewa.value =
          "";
      }

      if (filterJenisProduk) {
        filterJenisProduk.value =
          "";
      }

      if (filterTahun) {
        filterTahun.value =
          "";

        filterTahun.disabled =
          false;
      }

      statusDoDashboard = "";

      const banner =
        document.getElementById(
          "statusDoFilterBanner"
        );

      if (banner) {
        banner.remove();
      }

      applyFilter();
    }
  );


// =====================================================
// START
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  loadProyekSewa
);