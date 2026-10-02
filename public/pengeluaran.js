const searchPengeluaran =
  document.getElementById(
    "searchPengeluaran"
  );

const filterBulan =
  document.getElementById(
    "filterBulan"
  );

const filterTahun =
  document.getElementById(
    "filterTahun"
  );

const filterJenisProyek =
  document.getElementById(
    "filterJenisProyek"
  );

const filterStatusPembayaran =
  document.getElementById(
    "filterStatusPembayaran"
  );

const resetPengeluaranFilter =
  document.getElementById(
    "resetPengeluaranFilter"
  );

const refreshPengeluaran =
  document.getElementById(
    "refreshPengeluaran"
  );

const pengeluaranTableBody =
  document.getElementById(
    "pengeluaranTableBody"
  );

const pengeluaranPagination =
  document.getElementById(
    "pengeluaranPagination"
  );

const paginationInfo =
  document.getElementById(
    "paginationInfo"
  );

const jumlahDataPengeluaran =
  document.getElementById(
    "jumlahDataPengeluaran"
  );

const pengeluaranLoading =
  document.getElementById(
    "pengeluaranLoading"
  );

const pengeluaranError =
  document.getElementById(
    "pengeluaranError"
  );

const mobileMenuButton =
  document.getElementById(
    "mobileMenuButton"
  );

const sidebarBackdrop =
  document.getElementById(
    "sidebarBackdrop"
  );


const urlParams =
  new URLSearchParams(
    window.location.search
  );


const tahunSekarang =
  new Date().getFullYear();


const rowsPerPage = 15;


let semuaPengeluaran = [];

let dataTerfilter = [];

let currentPage = 1;

let searchTimer = null;


// =====================================================
// HELPER ANGKA
// =====================================================

function angka(value) {

  const result =
    Number(value);

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
      minimumFractionDigits: 0,
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
// NORMALISASI TANGGAL
// =====================================================

function tanggalInput(value) {

  if (!value) {
    return "";
  }

  const text =
    String(value).slice(
      0,
      10
    );

  return /^\d{4}-\d{2}-\d{2}$/.test(
    text
  )
    ? text
    : "";

}


// =====================================================
// FORMAT TANGGAL
// =====================================================

function formatTanggal(value) {

  const text =
    tanggalInput(value);

  if (!text) {
    return "-";
  }

  const [
    tahun,
    bulan,
    tanggal
  ] =
    text.split("-");

  return (
    `${tanggal}/${bulan}/${tahun}`
  );

}


// =====================================================
// NORMALISASI STATUS PEMBAYARAN
// =====================================================

function normalisasiStatus(
  value,
  tanggalBayar = null
) {

  const status =
    String(
      value || ""
    )
      .trim()
      .replace(
        /\s+/g,
        " "
      )
      .toLowerCase();


  if (
    [
      "dibayar",
      "sudah dibayar",
      "lunas",
      "paid"
    ].includes(status)
  ) {

    return "Sudah Dibayar";

  }


  if (
    [
      "proses",
      "diproses",
      "processing"
    ].includes(status)
  ) {

    return "Proses";

  }


  if (
    [
      "belum dibayar",
      "belum bayar",
      "unpaid"
    ].includes(status)
  ) {

    return "Belum Dibayar";

  }


  // Jika status kosong tetapi tanggal bayar ada,
  // otomatis dianggap sudah dibayar.

  return tanggalBayar
    ? "Sudah Dibayar"
    : "Belum Dibayar";

}


// =====================================================
// NORMALISASI JENIS PROYEK
// =====================================================

function normalisasiJenis(item) {

  const sumber =
    String(
      item.sumber ||
      item.sumber_pengeluaran ||
      ""
    )
      .trim()
      .toLowerCase();


  const jenis =
    String(
      item.jenis_proyek ||
      ""
    ).trim();


  if (
    sumber.includes("sewa") ||
    jenis
      .toLowerCase()
      .includes("sewa")
  ) {

    return "Sewa";

  }


  if (
    jenis
      .toLowerCase()
      .includes("transaksi")
  ) {

    return "Transaksi";

  }


  return (
    jenis ||
    "Reguler"
  );

}


// =====================================================
// NORMALISASI DATA DARI API
// =====================================================

function normalisasiItem(item) {

  const tanggalBayar =
    item.tanggal_bayar ||
    null;


  const status =
    normalisasiStatus(
      item.status_pembayaran,
      tanggalBayar
    );


  const jenis =
    normalisasiJenis(item);


  const sumberSewa =
    jenis === "Sewa";


  return {

    ...item,


    id:
      item.id ||
      item.termin_id ||
      item.pembayaran_id,


    proyek_id:
      item.proyek_id ||
      null,


    proyek_sewa_id:
      item.proyek_sewa_id ||
      null,


    nama_proyek:
      item.nama_proyek ||
      item.nomor_pr ||
      "-",


    nama_partner:
      item.nama_partner ||
      item.perusahaan_partner ||
      "-",


    jenis_proyek:
      jenis,


    sumber:
      sumberSewa
        ? "Proyek Sewa"
        : "Proyek",


    deskripsi:
      item.deskripsi ||
      item.nama_termin ||
      "-",


    nominal:
      angka(
        item.nilai_pengeluaran ??
        item.nominal ??
        0
      ),


    status_pembayaran:
      status,


    tanggal_bayar:
      tanggalBayar,


    /*
     * Status sudah dibayar memakai tanggal bayar.
     *
     * Status belum dibayar atau proses biasanya
     * belum memiliki tanggal bayar sehingga
     * menggunakan tanggal jatuh tempo atau
     * tanggal dibuat sebagai tanggal acuan.
     */

    tanggal_acuan:
      tanggalBayar ||
      item.tanggal_jatuh_tempo ||
      item.created_at ||
      null,


    syarat_pembayaran:
      item.syarat_pembayaran ||
      "-"

  };

}


// =====================================================
// AMBIL ARRAY DARI RESPONSE API
// =====================================================

function ambilArray(result) {

  if (
    Array.isArray(result)
  ) {

    return result;

  }


  if (
    Array.isArray(
      result?.pengeluaran
    )
  ) {

    return result.pengeluaran;

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
// LOADING
// =====================================================

function setLoading(value) {

  if (
    pengeluaranLoading
  ) {

    pengeluaranLoading.hidden =
      !value;

  }

}


// =====================================================
// ERROR
// =====================================================

function tampilkanError(
  message = ""
) {

  if (
    !pengeluaranError
  ) {

    return;

  }


  pengeluaranError.textContent =
    message;


  pengeluaranError.style.display =
    message
      ? "block"
      : "none";

}


// =====================================================
// ISI FILTER TAHUN
// =====================================================

function isiFilterTahun() {

  if (
    !filterTahun
  ) {

    return;

  }


  filterTahun.innerHTML =
    "";


  for (
    let tahun = tahunSekarang;

    tahun >= tahunSekarang - 6;

    tahun -= 1
  ) {

    const option =
      document.createElement(
        "option"
      );


    option.value =
      String(tahun);


    option.textContent =
      String(tahun);


    filterTahun.appendChild(
      option
    );

  }


  const tahunUrl =
    Number(
      urlParams.get("tahun")
    );


  filterTahun.value =
    Number.isInteger(
      tahunUrl
    ) &&
    tahunUrl >=
      tahunSekarang - 6 &&
    tahunUrl <=
      tahunSekarang

      ? String(tahunUrl)

      : String(
          tahunSekarang
        );

}


// =====================================================
// ISI FILTER DARI URL DASHBOARD
// =====================================================
function isiFilterDariUrl() {

  if (searchPengeluaran) {
    searchPengeluaran.value =
      String(
        urlParams.get("search") || ""
      );
  }


  if (filterBulan) {

    const bulan =
      Number(
        urlParams.get("bulan")
      );

    filterBulan.value =
      bulan >= 1 &&
      bulan <= 12
        ? String(bulan)
        : "";

  }


  if (filterJenisProyek) {

    const jenis =
      String(
        urlParams.get(
          "jenis_proyek"
        ) || ""
      ).trim();


    const tersedia =
      [
        ...filterJenisProyek.options
      ].some(
        option =>
          option.value === jenis
      );


    filterJenisProyek.value =
      tersedia
        ? jenis
        : "";

  }


  if (filterStatusPembayaran) {

    /*
     * Jika parameter status tidak ada,
     * default menggunakan Sudah Dibayar.
     */

    const statusUrl =
      urlParams.has(
        "status_pembayaran"
      )
        ? String(
            urlParams.get(
              "status_pembayaran"
            ) || ""
          ).trim()
        : "Sudah Dibayar";


    const statusNormal =
      statusUrl.toLowerCase();


    if (
      statusNormal === "" ||
      statusNormal === "semua" ||
      statusNormal === "semua status"
    ) {

      filterStatusPembayaran.value =
        "";

    } else if (
      [
        "selain dibayar",
        "belum dibayar dan proses"
      ].includes(statusNormal)
    ) {

      filterStatusPembayaran.value =
        "Selain Dibayar";

    } else if (
      [
        "dibayar",
        "sudah dibayar",
        "lunas",
        "paid"
      ].includes(statusNormal)
    ) {

      filterStatusPembayaran.value =
        "Sudah Dibayar";

    } else if (
      [
        "proses",
        "diproses",
        "processing"
      ].includes(statusNormal)
    ) {

      filterStatusPembayaran.value =
        "Proses";

    } else if (
      [
        "belum dibayar",
        "belum bayar",
        "unpaid"
      ].includes(statusNormal)
    ) {

      filterStatusPembayaran.value =
        "Belum Dibayar";

    } else {

      filterStatusPembayaran.value =
        "Sudah Dibayar";

    }

  }

}

// =====================================================
// LOAD DATA PENGELUARAN
// =====================================================

async function loadPengeluaran() {

  setLoading(true);

  tampilkanError("");


  try {

    const response =
      await fetch(
        "/api/pengeluaran/detail",
        {
          method: "GET",

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

      throw new Error(
        `API tidak mengembalikan JSON. Status ${response.status}`
      );

    }


    const result =
      await response.json();


    if (
      !response.ok
    ) {

      throw new Error(
        result.error ||
        "Gagal mengambil data pengeluaran"
      );

    }


    semuaPengeluaran =
      ambilArray(result)
        .map(
          normalisasiItem
        );


    applyFilter();

  } catch (error) {

    console.error(
      "ERROR LOAD PENGELUARAN:",
      error
    );


    tampilkanError(
      `Pengeluaran gagal dimuat: ${error.message}`
    );


    if (
      pengeluaranTableBody
    ) {

      pengeluaranTableBody.innerHTML =
        `
        <tr>
          <td
            colspan="9"
            class="empty-state"
          >
            ${escapeHtml(
              error.message
            )}
          </td>
        </tr>
        `;

    }

  } finally {

    setLoading(false);

  }

}


// =====================================================
// CEK PERIODE DATA
// =====================================================

function dataMasukPeriode(
  item,
  tahun,
  bulan = ""
) {

  const tanggal =
    tanggalInput(
      item.tanggal_acuan
    );


  if (
    !tanggal
  ) {

    return false;

  }


  const [
    tahunData,
    bulanData
  ] =
    tanggal
      .split("-")
      .map(Number);


  if (
    tahunData !==
    Number(tahun)
  ) {

    return false;

  }


  if (
    bulan &&
    bulanData !==
      Number(bulan)
  ) {

    return false;

  }


  return true;

}


// =====================================================
// UPDATE PARAMETER URL
// =====================================================

function updateUrl() {

  const params =
    new URLSearchParams();


  if (filterTahun?.value) {

    params.set(
      "tahun",
      filterTahun.value
    );

  }


  if (filterBulan?.value) {

    params.set(
      "bulan",
      filterBulan.value
    );

  }


  if (filterJenisProyek?.value) {

    params.set(
      "jenis_proyek",
      filterJenisProyek.value
    );

  }


  /*
   * Tetap simpan parameter Semua Status
   * agar ketika halaman di-refresh
   * tidak kembali ke Sudah Dibayar.
   */

  if (filterStatusPembayaran) {

    params.set(
      "status_pembayaran",

      filterStatusPembayaran.value ||
      "Semua Status"
    );

  }


  if (
    searchPengeluaran
      ?.value
      .trim()
  ) {

    params.set(
      "search",
      searchPengeluaran
        .value
        .trim()
    );

  }


  window.history.replaceState(
    {},
    "",
    `/pengeluaran.html?${params.toString()}`
  );

}

// =====================================================
// FILTER DATA
// =====================================================

function applyFilter() {

  const tahun =
    filterTahun?.value ||
    String(
      tahunSekarang
    );


  const bulan =
    filterBulan?.value ||
    "";


  const jenis =
    filterJenisProyek?.value ||
    "";


  /*
   * Jangan gunakan:
   *
   * filterStatusPembayaran?.value ||
   * "Sudah Dibayar"
   *
   * Karena nilai kosong merupakan
   * pilihan Semua Status.
   */

  const status =
    filterStatusPembayaran
      ? String(
          filterStatusPembayaran.value
        )
      : "Sudah Dibayar";


  const search =
    String(
      searchPengeluaran?.value ||
      ""
    )
      .trim()
      .toLowerCase();


  // ===============================================
  // FILTER PERIODE, JENIS, DAN PENCARIAN
  // ===============================================

  const dataPeriode =
    semuaPengeluaran.filter(
      item => {

        const cocokPeriode =
          dataMasukPeriode(
            item,
            tahun,
            bulan
          );


        const cocokJenis =
          !jenis ||

          item.jenis_proyek ===
            jenis ||

          item.jenis_proyek
            .startsWith(
              jenis
            );


        const textCari =
          [
            item.nama_proyek,
            item.nama_partner,
            item.jenis_proyek,
            item.deskripsi,
            item.syarat_pembayaran
          ]
            .join(" ")
            .toLowerCase();


        const cocokSearch =
          !search ||
          textCari.includes(
            search
          );


        return (
          cocokPeriode &&
          cocokJenis &&
          cocokSearch
        );

      }
    );


  // ===============================================
  // FILTER STATUS
  // ===============================================

  dataTerfilter =
    dataPeriode.filter(
      item => {

        /*
         * Nilai kosong berarti Semua Status.
         */

        if (
          status === "" ||
          status === "Semua Status"
        ) {

          return true;

        }


        /*
         * Selain Dibayar menampilkan:
         * - Belum Dibayar
         * - Proses
         */

        if (
          status ===
          "Selain Dibayar"
        ) {

          return (
            item.status_pembayaran ===
              "Belum Dibayar" ||

            item.status_pembayaran ===
              "Proses"
          );

        }


        return (
          item.status_pembayaran ===
          status
        );

      }
    );


  currentPage = 1;


  renderSummary(
    dataPeriode
  );


  renderTable();


  renderPagination();


  updateUrl();

}

// =====================================================
// RENDER SUMMARY
// =====================================================

function renderSummary(data) {

  const sudahDibayar =
    data.filter(
      item =>
        item.status_pembayaran ===
        "Sudah Dibayar"
    );


  const belumDibayar =
    data.filter(
      item =>
        item.status_pembayaran ===
        "Belum Dibayar"
    );


  const proses =
    data.filter(
      item =>
        item.status_pembayaran ===
        "Proses"
    );


  const total =
    list =>
      list.reduce(
        (
          jumlah,
          item
        ) =>
          jumlah +
          angka(
            item.nominal
          ),

        0
      );


  const totalPengeluaran =
    document.getElementById(
      "totalPengeluaran"
    );


  const totalBelumDibayar =
    document.getElementById(
      "totalBelumDibayar"
    );


  const totalProses =
    document.getElementById(
      "totalProses"
    );


  const terminDibayar =
    document.getElementById(
      "terminDibayar"
    );


  const terminBelumDibayar =
    document.getElementById(
      "terminBelumDibayar"
    );


  if (
    totalPengeluaran
  ) {

    totalPengeluaran.textContent =
      rupiah(
        total(
          sudahDibayar
        )
      );

  }


  if (
    totalBelumDibayar
  ) {

    totalBelumDibayar.textContent =
      rupiah(
        total(
          belumDibayar
        )
      );

  }


  if (
    totalProses
  ) {

    totalProses.textContent =
      rupiah(
        total(
          proses
        )
      );

  }


  if (
    terminDibayar
  ) {

    terminDibayar.textContent =
      sudahDibayar.length
        .toLocaleString(
          "id-ID"
        );

  }


  if (
    terminBelumDibayar
  ) {

    terminBelumDibayar.textContent =
      (
        belumDibayar.length +
        proses.length
      ).toLocaleString(
        "id-ID"
      );

  }

}


// =====================================================
// CLASS STATUS
// =====================================================

function statusClass(status) {

  if (
    status ===
    "Sudah Dibayar"
  ) {

    return "status-paid";

  }


  if (
    status ===
    "Proses"
  ) {

    return "status-process";

  }


  return "status-unpaid";

}


// =====================================================
// URL DETAIL PROYEK
// =====================================================

function projectUrl(item) {

  if (
    item.jenis_proyek ===
      "Sewa" &&

    angka(
      item.proyek_sewa_id
    ) > 0
  ) {

    return (
      `/proyek-sewa-detail.html?id=` +
      encodeURIComponent(
        item.proyek_sewa_id
      )
    );

  }


  if (
    angka(
      item.proyek_id
    ) > 0
  ) {

    return (
      `/detail-proyek.html?id=` +
      encodeURIComponent(
        item.proyek_id
      )
    );

  }


  return "";

}


// =====================================================
// RENDER TABLE
// =====================================================

function renderTable() {

  if (
    !pengeluaranTableBody
  ) {

    return;

  }


  if (
    dataTerfilter.length === 0
  ) {

    pengeluaranTableBody.innerHTML =
      `
      <tr>
        <td
          colspan="9"
          class="empty-state"
        >
          Tidak ada pengeluaran yang sesuai dengan filter.
        </td>
      </tr>
      `;


    if (
      jumlahDataPengeluaran
    ) {

      jumlahDataPengeluaran.textContent =
        "0 data";

    }


    return;

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


  pengeluaranTableBody.innerHTML =
    pageData
      .map(
        (
          item,
          index
        ) => {

          const url =
            projectUrl(item);


          const namaProyek =
            escapeHtml(
              item.nama_proyek
            );


          const proyekHtml =
            url

              ? `
                <a
                  class="project-link"
                  href="${url}"
                >
                  ${namaProyek}
                </a>
              `

              : `
                <span
                  class="project-link"
                >
                  ${namaProyek}
                </span>
              `;


          return `
            <tr>

              <td>
                ${
                  start +
                  index +
                  1
                }
              </td>

              <td>
                ${proyekHtml}

                <span
                  class="subtext"
                >
                  ${escapeHtml(
                    item.sumber
                  )}
                </span>
              </td>

              <td>
                ${escapeHtml(
                  item.nama_partner
                )}
              </td>

              <td>
                ${escapeHtml(
                  item.jenis_proyek
                )}
              </td>

              <td>
                ${escapeHtml(
                  item.deskripsi
                )}
              </td>

              <td class="amount">
                ${rupiah(
                  item.nominal
                )}
              </td>

              <td>
                <span
                  class="
                    status-badge
                    ${statusClass(
                      item.status_pembayaran
                    )}
                  "
                >
                  ${escapeHtml(
                    item.status_pembayaran
                  )}
                </span>
              </td>

              <td>
                ${formatTanggal(
                  item.tanggal_bayar
                )}
              </td>

              <td>
                ${escapeHtml(
                  item.syarat_pembayaran
                )}
              </td>

            </tr>
          `;

        }
      )
      .join("");


  if (
    jumlahDataPengeluaran
  ) {

    jumlahDataPengeluaran.textContent =
      `${dataTerfilter.length.toLocaleString(
        "id-ID"
      )} data`;

  }

}


// =====================================================
// RENDER PAGINATION
// =====================================================

function renderPagination() {

  if (
    !pengeluaranPagination ||
    !paginationInfo
  ) {

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
    dataTerfilter.length

      ? (
          currentPage - 1
        ) *
          rowsPerPage +
        1

      : 0;


  const end =
    Math.min(
      currentPage *
        rowsPerPage,

      dataTerfilter.length
    );


  paginationInfo.textContent =
    `Menampilkan ${start}–${end} dari ` +
    `${dataTerfilter.length.toLocaleString(
      "id-ID"
    )} data`;


  pengeluaranPagination.innerHTML =
    "";


  if (
    totalPages <= 1
  ) {

    return;

  }


  const buatTombol =
    (
      label,
      page,
      disabled = false,
      active = false
    ) => {

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


      if (
        active
      ) {

        button.classList.add(
          "active"
        );

      }


      button.addEventListener(
        "click",
        () => {

          if (
            disabled ||
            page ===
              currentPage
          ) {

            return;

          }


          currentPage =
            page;


          renderTable();


          renderPagination();


          document
            .querySelector(
              ".table-panel"
            )
            ?.scrollIntoView({
              behavior:
                "smooth",

              block:
                "start"
            });

        }
      );


      return button;

    };


  pengeluaranPagination
    .appendChild(
      buatTombol(
        "‹",
        currentPage - 1,
        currentPage === 1
      )
    );


  let awal =
    Math.max(
      1,
      currentPage - 2
    );


  let akhir =
    Math.min(
      totalPages,
      awal + 4
    );


  awal =
    Math.max(
      1,
      akhir - 4
    );


  for (
    let page = awal;

    page <= akhir;

    page += 1
  ) {

    pengeluaranPagination
      .appendChild(
        buatTombol(
          String(page),
          page,
          false,
          page ===
            currentPage
        )
      );

  }


  pengeluaranPagination
    .appendChild(
      buatTombol(
        "›",
        currentPage + 1,
        currentPage ===
          totalPages
      )
    );

}


// =====================================================
// RESET FILTER
// =====================================================

function resetFilter() {

  if (
    searchPengeluaran
  ) {

    searchPengeluaran.value =
      "";

  }


  if (
    filterBulan
  ) {

    filterBulan.value =
      "";

  }


  if (
    filterTahun
  ) {

    filterTahun.value =
      String(
        tahunSekarang
      );

  }


  if (
    filterJenisProyek
  ) {

    filterJenisProyek.value =
      "";

  }


  if (
    filterStatusPembayaran
  ) {

    filterStatusPembayaran.value =
      "Sudah Dibayar";

  }


  applyFilter();

}


// =====================================================
// EVENT PENCARIAN
// =====================================================

searchPengeluaran
  ?.addEventListener(
    "input",
    () => {

      clearTimeout(
        searchTimer
      );


      searchTimer =
        setTimeout(
          applyFilter,
          300
        );

    }
  );


// =====================================================
// EVENT FILTER
// =====================================================

filterBulan
  ?.addEventListener(
    "change",
    applyFilter
  );


filterTahun
  ?.addEventListener(
    "change",
    applyFilter
  );


filterJenisProyek
  ?.addEventListener(
    "change",
    applyFilter
  );


filterStatusPembayaran
  ?.addEventListener(
    "change",
    applyFilter
  );


// =====================================================
// EVENT RESET
// =====================================================

resetPengeluaranFilter
  ?.addEventListener(
    "click",
    resetFilter
  );


// =====================================================
// EVENT REFRESH
// =====================================================

refreshPengeluaran
  ?.addEventListener(
    "click",
    loadPengeluaran
  );


// =====================================================
// MOBILE SIDEBAR
// =====================================================

mobileMenuButton
  ?.addEventListener(
    "click",
    () => {

      document.body
        .classList
        .toggle(
          "sidebar-open"
        );

    }
  );


sidebarBackdrop
  ?.addEventListener(
    "click",
    () => {

      document.body
        .classList
        .remove(
          "sidebar-open"
        );

    }
  );


// =====================================================
// INISIALISASI
// =====================================================

isiFilterTahun();

isiFilterDariUrl();

loadPengeluaran();