// ======================================================
// PENDAPATAN
// GROUP:
// JENIS -> SUB JENIS -> KATEGORI -> TERMIN
// ======================================================

let allPendapatan = [];
let filteredPendapatan = [];
let currentPagePendapatan = 1;

const itemsPerPagePendapatan = 20;

// ======================================================
// ELEMENT
// ======================================================

const pendapatanGroup =
  document.getElementById(
    "pendapatanGroup"
  );

const searchPendapatan =
  document.getElementById(
    "searchPendapatan"
  );

const filterTahunPendapatan =
  document.getElementById(
    "filterTahunPendapatan"
  );

const filterBulanPendapatan =
  document.getElementById(
    "filterBulanPendapatan"
  );

const filterJenisPendapatan =
  document.getElementById(
    "filterJenisPendapatan"
  );

const filterStatusPembayaranPendapatan =
  document.getElementById(
    "filterStatusPembayaranPendapatan"
  );

const resetPendapatanFilter =
  document.getElementById(
    "resetPendapatanFilter"
  );

const totalPendapatan =
  document.getElementById(
    "totalPendapatan"
  );

const totalBelumDibayar =
  document.getElementById(
    "totalBelumDibayar"
  );

const totalProses =
  document.getElementById(
    "totalProses"
  );

const jumlahTerminDibayar =
  document.getElementById(
    "jumlahTerminDibayar"
  );

const jumlahTerminBelumDibayar =
  document.getElementById(
    "jumlahTerminBelumDibayar"
  );

const pendapatanPagination =
  document.getElementById(
    "pendapatanPagination"
  );

const pendapatanPaginationInfo =
  document.getElementById(
    "pendapatanPaginationInfo"
  );

const pendapatanPaginationButtons =
  document.getElementById(
    "pendapatanPaginationButtons"
  );

const pendapatanUrlParams =
  new URLSearchParams(
  window.location.search
  );

const picIdPendapatan =
  String(
    pendapatanUrlParams.get(
      "pic_id"
    ) || ""
  ).trim();

// ======================================================
// FORMAT
// ======================================================

function formatRupiah(value) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }
  ).format(
    Number(value) || 0
  );
}

function formatTanggal(value) {
  if (!value) {
    return "-";
  }

  const text =
    String(value).trim();

  /*
   * Mengambil YYYY-MM-DD secara langsung
   * untuk menghindari tanggal mundur
   * akibat perbedaan zona waktu.
   */

  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (match) {
    const tahun =
      Number(match[1]);

    const bulan =
      Number(match[2]);

    const hari =
      Number(match[3]);

    const date =
      new Date(
        Date.UTC(
          tahun,
          bulan - 1,
          hari
        )
      );

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      }
    ).format(date);
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
      year: "numeric",
      timeZone: "UTC"
    }
  ).format(date);
}

// ======================================================
// TAHUN DAN BULAN
// ======================================================

function getTahun(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (match) {
    return Number(match[1]);
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.getUTCFullYear();
}

function getBulan(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (match) {
    return Number(match[2]);
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return (
    date.getUTCMonth() + 1
  );
}

// ======================================================
// NORMALISASI DATA
// ======================================================

function getTanggalPendapatan(item) {
  const jenis =
    String(
      item?.jenis_proyek || ""
    )
      .trim()
      .toLowerCase();

  const sumber =
    String(
      item?.sumber_pendapatan || ""
    )
      .trim()
      .toLowerCase();

  const proyekSewa =
    jenis.includes("sewa") ||
    sumber.includes("sewa");

  /*
   * Proyek:
   * 1. Tanggal bayar
   * 2. Tanggal jatuh tempo
   *
   * Proyek Sewa:
   * 1. Tanggal bayar
   * 2. Tanggal DO
   */

  if (proyekSewa) {
    return (
      item?.tanggal_bayar ||
      item?.tanggal_do ||
      item?.created_at ||
      null
    );
  }

  return (
    item?.tanggal_bayar ||
    item?.tanggal_jatuh_tempo ||
    item?.created_at ||
    null
  );
}

function getKategoriPendapatan(item) {
  return (
    item.kategori_pendapatan ||
    item.kategori_proyek ||
    item.nama_kategori_produk ||
    "Tanpa Kategori"
  );
}

function getNilaiPendapatan(item) {
  return Number(
    item.nilai_pendapatan ??
    item.nilai_termin ??
    item.nominal ??
    0
  ) || 0;
}

function normalisasiStatusPembayaran(
  item
) {

  return String(
    item?.status_pembayaran || ""
  )
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

}

function statusSudahDibayar(item) {

  const status =
    normalisasiStatusPembayaran(
      item
    );

  const statusDibayar = [
    "dibayar",
    "sudah dibayar",
    "lunas",
    "paid"
  ];

  if (
    statusDibayar.includes(status)
  ) {
    return true;
  }

  /*
   * Jika status sudah menyatakan belum dibayar
   * atau proses, tanggal bayar tidak boleh
   * mengubahnya otomatis menjadi dibayar.
   */

  const statusBelumDibayar = [
    "belum dibayar",
    "belum bayar",
    "unpaid"
  ];

  if (
    statusBelumDibayar.includes(status) ||
    status.includes("proses") ||
    status === "processing"
  ) {
    return false;
  }

  return Boolean(
    item?.tanggal_bayar
  );

}

function getStatusPembayaranPendapatan(
  item
) {

  const status =
    normalisasiStatusPembayaran(
      item
    );

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
    status.includes("proses") ||
    status === "processing"
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

  return item?.tanggal_bayar
    ? "Sudah Dibayar"
    : "Belum Dibayar";

}
function pendapatanDiakui(item) {
  const jenis =
    String(
      item?.jenis_proyek || ""
    )
      .trim()
      .toLowerCase();

  const sumber =
    String(
      item?.sumber_pendapatan || ""
    )
      .trim()
      .toLowerCase();

  const proyekSewa =
    jenis.includes("sewa") ||
    sumber.includes("sewa");

  /*
   * Semua jenis proyek diakui jika:
   * status sudah dibayar atau ada tanggal bayar.
   */

  if (
    statusSudahDibayar(item) ||
    Boolean(item?.tanggal_bayar)
  ) {
    return true;
  }

  /*
   * Proyek Sewa diakui jika sudah ada DO.
   */

  if (proyekSewa) {
    return Boolean(
      item?.tanggal_do
    );
  }

  /*
   * Proyek Reguler/Transaksi diakui
   * jika sudah ada tanggal jatuh tempo.
   */

  return Boolean(
    item?.tanggal_jatuh_tempo
  );
}
function getKategoriPendapatan(item) {

  const sumber =
    String(
      item?.sumber_pendapatan || ""
    )
      .trim()
      .toUpperCase();

  /*
   * Pada Sewa, posisi kategori digantikan
   * oleh proyek yang sudah dipilih.
   */

  if (sumber === "SEWA") {

    return (
      item.nama_proyek ||
      "Proyek Sewa"
    );

  }

  return (
    item.kategori_pendapatan ||
    item.kategori_proyek ||
    item.nama_kategori_produk ||
    "Tanpa Kategori"
  );

}

// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateUrlPendapatan() {
  const params =
    new URLSearchParams();

  if (
    filterTahunPendapatan?.value
  ) {
    params.set(
      "tahun",
      filterTahunPendapatan.value
    );
  }

  if (
    filterBulanPendapatan?.value
  ) {
    params.set(
      "bulan",
      filterBulanPendapatan.value
    );
  }

  if (
    filterJenisPendapatan?.value
  ) {
    params.set(
      "jenis_proyek",
      filterJenisPendapatan.value
    );
  }

  if (
    filterStatusPembayaranPendapatan
  ) {
    params.set(
      "status_pembayaran",

      filterStatusPembayaranPendapatan
        .value ||
      "Semua Status"
    );
  }

  if (
    searchPendapatan
      ?.value
      .trim()
  ) {
    params.set(
      "search",
      searchPendapatan
        .value
        .trim()
    );
  }

  /*
   * PIC dari Dashboard tetap dipertahankan,
   * meskipun tidak ditampilkan sebagai
   * filter di halaman Pendapatan.
   */

  if (picIdPendapatan) {
    params.set(
      "pic_id",
      picIdPendapatan
    );
  }

  const query =
    params.toString();

  window.history.replaceState(
    {},
    "",
    query
      ? `/pendapatan.html?${query}`
      : "/pendapatan.html"
  );
}
// ======================================================
// LOAD PENDAPATAN
// ======================================================

async function fetchSumberPendapatan(
  url
) {

  const response =
    await fetch(
      url,
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

  if (response.status === 401) {

    window.location.href =
      "/login.html";

    throw new Error(
      "Belum login"
    );

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

    const responseText =
      await response.text();

    console.error(
      `RESPONSE BUKAN JSON ${url}:`,
      responseText
    );

    throw new Error(
      `${url} tidak mengembalikan JSON. ` +
      `Status: ${response.status}`
    );

  }

  const result =
    await response.json();

  if (!response.ok) {

    throw new Error(
      result.error ||
      `Gagal mengambil data dari ${url}`
    );

  }

  if (
    Array.isArray(
      result.pendapatan
    )
  ) {
    return result.pendapatan;
  }

  if (
    Array.isArray(result.data)
  ) {
    return result.data;
  }

  if (Array.isArray(result)) {
    return result;
  }

  return [];

}

// ======================================================
// LOAD SEMUA DATA PENDAPATAN
// ======================================================

async function loadPendapatan() {
  if (pendapatanGroup) {
    pendapatanGroup.innerHTML = `
      <div class="empty-state">
        Memuat data pendapatan...
      </div>
    `;
  }

  try {
    const apiParams =
      new URLSearchParams();

    if (picIdPendapatan) {
      apiParams.set(
        "pic_id",
        picIdPendapatan
      );
    }

    const apiQuery =
      apiParams.toString();

    const urlPendapatanProyek =
      apiQuery
        ? `/api/pendapatan/detail?${apiQuery}`
        : "/api/pendapatan/detail";

    const urlPendapatanSewa =
      apiQuery
        ? `/api/pendapatan/sewa/detail?${apiQuery}`
        : "/api/pendapatan/sewa/detail";

    const [
      hasilProyek,
      hasilSewa
    ] = await Promise.allSettled([
      fetchSumberPendapatan(
        urlPendapatanProyek
      ),

      fetchSumberPendapatan(
        urlPendapatanSewa
      )
    ]);

    if (
      hasilProyek.status ===
      "rejected"
    ) {
      console.error(
        "ERROR PENDAPATAN PROYEK:",
        hasilProyek.reason
      );
    }

    if (
      hasilSewa.status ===
      "rejected"
    ) {
      console.error(
        "ERROR PENDAPATAN SEWA:",
        hasilSewa.reason
      );
    }

    if (
      hasilProyek.status ===
        "rejected" &&
      hasilSewa.status ===
        "rejected"
    ) {
      throw new Error(
        "API pendapatan proyek dan sewa gagal dimuat."
      );
    }

    const pendapatanProyek =
      hasilProyek.status ===
      "fulfilled"
        ? hasilProyek.value
        : [];

    const pendapatanSewa =
      hasilSewa.status ===
      "fulfilled"
        ? hasilSewa.value
        : [];

    allPendapatan = [
      ...pendapatanProyek.map(
        item => ({
          ...item,

          sumber_pendapatan:
            item.sumber_pendapatan ||
            "PROYEK"
        })
      ),

      ...pendapatanSewa.map(
        item => ({
          ...item,

          sumber_pendapatan:
            "SEWA",

          jenis_proyek:
            item.jenis_proyek ||
            "Sewa"
        })
      )
    ];

    console.log(
      "PENDAPATAN PROYEK:",
      pendapatanProyek
    );

    console.log(
      "PENDAPATAN SEWA:",
      pendapatanSewa
    );

    console.log(
      "SEMUA PENDAPATAN:",
      allPendapatan
    );

    loadPendapatanFilters();

    setFilterPendapatanDariUrl();

    currentPagePendapatan = 1;

    applyPendapatanFilter();

  } catch (error) {
    console.error(
      "ERROR LOAD PENDAPATAN:",
      error
    );

    allPendapatan = [];
    filteredPendapatan = [];

    if (pendapatanGroup) {
      pendapatanGroup.innerHTML = `
        <div class="empty-state error-state">
          Gagal mengambil data pendapatan:
          ${escapeHtml(error.message)}
        </div>
      `;
    }
  }
}
// ======================================================
// ISI SELECT
// ======================================================

function isiSelectPendapatan(
  element,
  values,
  defaultText
) {
  if (!element) {
    return;
  }

  const previousValue =
    element.value;

  element.innerHTML = "";

  const defaultOption =
    document.createElement(
      "option"
    );

  defaultOption.value = "";

  defaultOption.textContent =
    defaultText;

  element.appendChild(
    defaultOption
  );

  values.forEach(value => {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(value);

    option.textContent =
      String(value);

    element.appendChild(
      option
    );
  });

  const previousValueExists =
    Array.from(
      element.options
    ).some(
      option =>
        option.value ===
        previousValue
    );

  if (previousValueExists) {
    element.value =
      previousValue;
  }
}

// ======================================================
// ISI FILTER BULAN
// ======================================================

function loadFilterBulanPendapatan() {
  if (!filterBulanPendapatan) {
    return;
  }

  const previousValue =
    filterBulanPendapatan.value;

  const daftarBulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ];

  filterBulanPendapatan.innerHTML = `
    <option value="">
      Semua Bulan
    </option>
  `;

  daftarBulan.forEach(
    (namaBulan, index) => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        String(index + 1);

      option.textContent =
        namaBulan;

      filterBulanPendapatan.appendChild(
        option
      );
    }
  );

  if (
    previousValue &&
    Array.from(
      filterBulanPendapatan.options
    ).some(
      option =>
        option.value ===
        previousValue
    )
  ) {
    filterBulanPendapatan.value =
      previousValue;
  }
}

// ======================================================
// FILTER OPTIONS
// ======================================================

function loadPendapatanFilters() {
  const tahunBerjalan =
    new Date().getFullYear();

  const daftarTahun = [
    ...new Set([
      tahunBerjalan,

      ...allPendapatan
        .map(item =>
          getTahun(
            getTanggalPendapatan(item)
          )
        )
        .filter(value =>
          Number.isInteger(value)
        )
    ])
  ].sort(
    (a, b) => b - a
  );

  isiSelectPendapatan(
  filterStatusPembayaranPendapatan,
  [
    "Pendapatan Diakui",
    "Sudah Dibayar",
    "Selain Dibayar",
    "Belum Dibayar",
    "Proses"
  ],
  "Semua Status Pembayaran"
);

  loadFilterBulanPendapatan();

  const daftarJenis = [
    ...new Set(
      allPendapatan
        .map(item =>
          item.jenis_proyek
        )
        .filter(Boolean)
    )
  ].sort(
    (a, b) =>
      String(a).localeCompare(
        String(b),
        "id"
      )
  );

  isiSelectPendapatan(
    filterJenisPendapatan,
    daftarJenis,
    "Semua Jenis Proyek"
  );

  isiSelectPendapatan(
    filterStatusPembayaranPendapatan,
    [
      "Sudah Dibayar",
      "Belum Dibayar",
      "Proses"
    ],
    "Semua Status Pembayaran"
  );
}

function normalisasiStatusFilterPendapatan(
  value
) {
  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    status === "" ||
    status === "semua" ||
    status === "semua status" ||
    status ===
      "semua status pembayaran"
  ) {
    return "";
  }

  if (
    [
      "pendapatan diakui",
      "diakui",
      "recognized"
    ].includes(status)
  ) {
    return "Pendapatan Diakui";
  }

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
      "selain dibayar",
      "belum dibayar dan proses"
    ].includes(status)
  ) {
    return "Selain Dibayar";
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

  return "";
}


function setFilterPendapatanDariUrl() {
  const tahunBerjalan =
    String(
      new Date().getFullYear()
    );

  const tahunUrl =
    String(
      pendapatanUrlParams.get(
        "tahun"
      ) || tahunBerjalan
    );

  const bulanUrl =
    String(
      pendapatanUrlParams.get(
        "bulan"
      ) || ""
    );

  const jenisUrl =
    String(
      pendapatanUrlParams.get(
        "jenis_proyek"
      ) || ""
    ).trim();

  const statusUrl =
    pendapatanUrlParams.has(
      "status_pembayaran"
    )
      ? normalisasiStatusFilterPendapatan(
          pendapatanUrlParams.get(
            "status_pembayaran"
          )
        )
      : "Sudah Dibayar";


  if (filterTahunPendapatan) {
    const tersedia =
      Array.from(
        filterTahunPendapatan.options
      ).some(
        option =>
          option.value === tahunUrl
      );

    filterTahunPendapatan.value =
      tersedia
        ? tahunUrl
        : tahunBerjalan;
  }


  if (filterBulanPendapatan) {
    const tersedia =
      Array.from(
        filterBulanPendapatan.options
      ).some(
        option =>
          option.value === bulanUrl
      );

    filterBulanPendapatan.value =
      tersedia
        ? bulanUrl
        : "";
  }


  if (filterJenisPendapatan) {
    const tersedia =
      Array.from(
        filterJenisPendapatan.options
      ).some(
        option =>
          String(
            option.value
          ).toLowerCase() ===
          jenisUrl.toLowerCase()
      );

    if (tersedia) {
      const option =
        Array.from(
          filterJenisPendapatan.options
        ).find(
          item =>
            String(
              item.value
            ).toLowerCase() ===
            jenisUrl.toLowerCase()
        );

      filterJenisPendapatan.value =
        option?.value || "";
    } else {
      filterJenisPendapatan.value =
        "";
    }
  }


  if (
    filterStatusPembayaranPendapatan
  ) {
    filterStatusPembayaranPendapatan
      .value =
        statusUrl;
  }


  if (searchPendapatan) {
    searchPendapatan.value =
      String(
        pendapatanUrlParams.get(
          "search"
        ) || ""
      );
  }
}
// ======================================================
// DEFAULT FILTER
// ======================================================

function setDefaultPendapatanFilter() {
  const tahunBerjalan =
    String(
      new Date().getFullYear()
    );

  if (filterTahunPendapatan) {
    const tahunTersedia =
      Array.from(
        filterTahunPendapatan.options
      ).some(
        option =>
          option.value ===
          tahunBerjalan
      );

    filterTahunPendapatan.value =
      tahunTersedia
        ? tahunBerjalan
        : "";
  }

  if (filterBulanPendapatan) {
    filterBulanPendapatan.value =
      "";
  }

  if (filterJenisPendapatan) {
    filterJenisPendapatan.value =
      "";
  }

  if (
    filterStatusPembayaranPendapatan
  ) {
    filterStatusPembayaranPendapatan
      .value =
        "Sudah Dibayar";
  }
}

// ======================================================
// APPLY FILTER
// ======================================================

function applyPendapatanFilter(
  resetPage = true
) {
  const keyword =
    String(
      searchPendapatan?.value || ""
    )
      .trim()
      .toLowerCase();

  const tahunDipilih =
    String(
      filterTahunPendapatan
        ?.value || ""
    );

  const bulanDipilih =
    String(
      filterBulanPendapatan
        ?.value || ""
    );

  const jenisDipilih =
    String(
      filterJenisPendapatan
        ?.value || ""
    );

  const statusPembayaranDipilih =
    String(
      filterStatusPembayaranPendapatan
        ?.value || ""
    );

  /*
   * Data summary mengikuti:
   * - Pencarian
   * - Bulan
   * - Tahun
   * - Jenis proyek
   *
   * Filter status pembayaran tidak membatasi
   * kartu summary agar semua nilai status
   * tetap dapat ditampilkan.
   */

  const dataSummary =
    allPendapatan.filter(
      item => {
        const tanggalPendapatan =
          getTanggalPendapatan(
            item
          );

        const itemTahun =
          getTahun(
            tanggalPendapatan
          );

        const itemBulan =
          getBulan(
            tanggalPendapatan
          );

        const searchableText =
          [
            item.nama_proyek,
            item.nama_klien,
            item.perusahaan_klien,
            item.jenis_proyek,
            item.sub_jenis_proyek,

            getKategoriPendapatan(
              item
            ),

            item.nama_termin,
            item.status_pembayaran,
            item.status_pengadaan,
            item.status_teknis
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        const matchSearch =
          !keyword ||
          searchableText.includes(
            keyword
          );

        const matchTahun =
          !tahunDipilih ||
          Number(itemTahun) ===
            Number(tahunDipilih);

        const matchBulan =
          !bulanDipilih ||
          Number(itemBulan) ===
            Number(bulanDipilih);

        const matchJenis =
          !jenisDipilih ||
          String(
            item.jenis_proyek ||
            ""
          ) ===
            jenisDipilih;

        return (
          matchSearch &&
          matchTahun &&
          matchBulan &&
          matchJenis
        );
      }
    );

  /*
   * Filter status pembayaran digunakan
   * untuk listing tabel.
   */

  filteredPendapatan =
  dataSummary.filter(
    item => {
      if (
        !statusPembayaranDipilih ||
        statusPembayaranDipilih ===
          "Semua Status"
      ) {
        return true;
      }

      if (
        statusPembayaranDipilih ===
        "Pendapatan Diakui"
      ) {
        return pendapatanDiakui(
          item
        );
      }

      if (
        statusPembayaranDipilih ===
        "Selain Dibayar"
      ) {
        return (
          getStatusPembayaranPendapatan(
            item
          ) === "Belum Dibayar" ||

          getStatusPembayaranPendapatan(
            item
          ) === "Proses"
        );
      }

      return (
        getStatusPembayaranPendapatan(
          item
        ) ===
        statusPembayaranDipilih
      );
    }
  );

  // ====================================================
  // URUTKAN TANGGAL TERBARU
  // ====================================================

  filteredPendapatan.sort(
    (a, b) => {
      const tanggalA =
        new Date(
          getTanggalPendapatan(a) ||
          0
        ).getTime();

      const tanggalB =
        new Date(
          getTanggalPendapatan(b) ||
          0
        ).getTime();

      return (
        tanggalB -
        tanggalA
      );
    }
  );

  if (resetPage) {
    currentPagePendapatan = 1;
  }

  updatePendapatanSummary(
    dataSummary
  );

  renderPendapatanPage();
  updateUrlPendapatan();
}


// ======================================================
// SUMMARY
// ======================================================

function updatePendapatanSummary(data) {
  const terminDibayar =
    data.filter(
      item =>
        getStatusPembayaranPendapatan(
          item
        ) ===
          "Sudah Dibayar"
    );

  const terminBelumDibayar =
    data.filter(
      item =>
        getStatusPembayaranPendapatan(
          item
        ) ===
          "Belum Dibayar"
    );

  const terminProses =
    data.filter(
      item =>
        getStatusPembayaranPendapatan(
          item
        ) ===
          "Proses"
    );

  /*
   * Total Pendapatan hanya menghitung
   * termin yang sudah dibayar.
   */

 const total =
  data
    .filter(
      item =>
        pendapatanDiakui(item)
    )
    .reduce(
      (sum, item) =>
        sum +
        getNilaiPendapatan(item),

      0
    );

  const totalBelum =
    terminBelumDibayar.reduce(
      (sum, item) =>
        sum +
        getNilaiPendapatan(item),
      0
    );

  const totalSedangProses =
    terminProses.reduce(
      (sum, item) =>
        sum +
        getNilaiPendapatan(item),
      0
    );

  if (totalPendapatan) {
    totalPendapatan.textContent =
      formatRupiah(total);
  }

  if (totalBelumDibayar) {
    totalBelumDibayar.textContent =
      formatRupiah(totalBelum);
  }

  if (totalProses) {
    totalProses.textContent =
      formatRupiah(
        totalSedangProses
      );
  }

  if (jumlahTerminDibayar) {
    jumlahTerminDibayar.textContent =
      terminDibayar.length;
  }

  if (jumlahTerminBelumDibayar) {
    jumlahTerminBelumDibayar
      .textContent =
        terminBelumDibayar.length;
  }
}

// ======================================================
// GROUP DATA
// ======================================================

function groupPendapatanData(data) {
  const result = {};

  data.forEach(item => {
    const jenis =
      item.jenis_proyek ||
      "Tanpa Jenis Proyek";

    const subJenis =
      item.sub_jenis_proyek ||
      "Tanpa Sub Jenis";

    const kategori =
      getKategoriPendapatan(item);

    if (!result[jenis]) {
      result[jenis] = {};
    }

    if (!result[jenis][subJenis]) {
      result[jenis][subJenis] = {};
    }

    if (
      !result[jenis]
        [subJenis]
        [kategori]
    ) {
      result[jenis]
        [subJenis]
        [kategori] = [];
    }

    result[jenis]
      [subJenis]
      [kategori]
      .push(item);
  });

  return result;
}

// ======================================================
// TOTAL GROUP
// ======================================================

function sumPendapatan(data) {
  return data.reduce(
    (sum, item) =>
      sum +
      getNilaiPendapatan(item),
    0
  );
}

function flattenPendapatanSubJenis(
  kategoriData
) {
  return Object
    .values(kategoriData)
    .flat();
}

function flattenPendapatanJenis(
  subJenisData
) {
  return Object
    .values(subJenisData)
    .flatMap(
      kategoriData =>
        Object
          .values(kategoriData)
          .flat()
    );
}

function isPendapatanSewa(item) {

  const sumber =
    String(
      item?.sumber_pendapatan || ""
    )
      .trim()
      .toUpperCase();

  const jenis =
    String(
      item?.jenis_proyek || ""
    )
      .trim()
      .toLowerCase();

  return (
    sumber === "SEWA" ||
    jenis === "sewa"
  );

}

// ======================================================
// RENDER TABLE
// STRUKTUR TABEL TETAP
// ======================================================

function renderPendapatanTable(data) {

  const tabelSewa =
    data.length > 0 &&
    data.every(
      item =>
        isPendapatanSewa(item)
    );

  const judulKolomPertama =
    tabelSewa
      ? "Nomor PR"
      : "Proyek";

  return `
    <div class="table-wrapper">

      <table class="prognosa-table">

        <thead>

          <tr>

            <th>
              ${escapeHtml(
                judulKolomPertama
              )}
            </th>

            <th>Klien</th>

            <th>Periode Kontrak</th>

            <th>Nilai Kontrak</th>

            <th>Status Pengadaan</th>

            <th>Status Teknis</th>

            <th>Termin</th>

            <th>Persentase</th>

            <th>Jatuh Tempo</th>

            <th>Tanggal Bayar</th>

            <th>Nilai Pendapatan</th>

            <th>Aksi</th>

          </tr>

        </thead>


        <tbody>

          ${
            data.map(item => {

              const pendapatanSewa =
                isPendapatanSewa(
                  item
                );

              /*
               * Reguler/Transaksi:
               * menampilkan nama proyek.
               *
               * Sewa:
               * menampilkan nomor PR.
               */

              const namaKolomPertama =
                pendapatanSewa
                  ? (
                      item.nomor_pr ||
                      "-"
                    )
                  : (
                      item.nama_proyek ||
                      "-"
                    );

              const nilaiPersentase =
                Number(
                  item.persentase
                );

              const persentase =
                item.persentase !== null &&
                item.persentase !== undefined &&
                Number.isFinite(
                  nilaiPersentase
                )
                  ? `${nilaiPersentase.toFixed(2)}%`
                  : "-";

              const detailId =
                pendapatanSewa
                  ? Number(
                      item.proyek_sewa_id
                    )
                  : Number(
                      item.proyek_id
                    );

              const proyekValid =
                Number.isInteger(
                  detailId
                ) &&
                detailId > 0;

              const detailLink =
                proyekValid
                  ? pendapatanSewa
                    ? `/proyek-sewa-detail.html?id=${encodeURIComponent(
                        detailId
                      )}`
                    : `/detail-proyek.html?id=${encodeURIComponent(
                        detailId
                      )}`
                  : "#";

              return `
                <tr>

                  <td class="proyek-name">

                    ${
                      proyekValid
                        ? `
                          <a
                            href="${detailLink}"
                            class="project-link"
                          >
                            ${escapeHtml(
                              namaKolomPertama
                            )}
                          </a>
                        `
                        : escapeHtml(
                            namaKolomPertama
                          )
                    }

                  </td>


                  <td>

                    ${escapeHtml(
                      item.nama_klien ||
                      item.perusahaan_klien ||
                      "-"
                    )}

                  </td>


                  <td>

                    ${formatTanggal(
                      item.tanggal_mulai_kontrak
                    )}

                    -

                    ${formatTanggal(
                      item.tanggal_akhir_kontrak
                    )}

                  </td>


                  <td class="nilai">

                    ${formatRupiah(
                      item.nilai_kontrak
                    )}

                  </td>


                  <td>

                    <span class="badge">

                      ${escapeHtml(
                        item.status_pengadaan ||
                        "-"
                      )}

                    </span>

                  </td>


                  <td>

                    <span class="badge">

                      ${escapeHtml(
                        item.status_teknis ||
                        "-"
                      )}

                    </span>

                  </td>


                  <td>

                    ${escapeHtml(
                      item.nama_termin ||
                      "-"
                    )}

                  </td>


                  <td>
                    ${persentase}
                  </td>


                  <td>

                    ${formatTanggal(
                      item.tanggal_jatuh_tempo
                    )}

                  </td>


                  <td>

                    ${formatTanggal(
                      item.tanggal_bayar
                    )}

                  </td>


                  <td class="nilai">

                    ${formatRupiah(
                      getNilaiPendapatan(
                        item
                      )
                    )}

                  </td>


                  <td>

                    ${
                      proyekValid
                        ? `
                          <a
                            href="${detailLink}"
                            class="detail-button"
                          >
                            Detail
                          </a>
                        `
                        : "-"
                    }

                  </td>

                </tr>
              `;

            }).join("")
          }

        </tbody>

      </table>

    </div>
  `;

}
// ======================================================
// RENDER GROUPING
// ======================================================

function renderPendapatanGrouping(data) {
  if (!pendapatanGroup) {
    return;
  }

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    pendapatanGroup.innerHTML = `
      <div class="empty-state">
        Tidak ada pendapatan sesuai filter.
      </div>
    `;

    return;
  }

  const grouped =
    groupPendapatanData(data);

  let html = "";

  Object.entries(grouped)
    .forEach(
      ([
        jenis,
        subJenisData
      ]) => {
        const jenisRows =
          flattenPendapatanJenis(
            subJenisData
          );

        html += `
          <section class="jenis-group">
            <div class="jenis-header">
              <div class="jenis-title">
                ${escapeHtml(jenis)}
              </div>

              <div class="jenis-total">
                ${formatRupiah(
                  sumPendapatan(
                    jenisRows
                  )
                )}
              </div>
            </div>
        `;

        Object.entries(
          subJenisData
        ).forEach(
          ([
            subJenis,
            kategoriData
          ]) => {
            const subJenisRows =
              flattenPendapatanSubJenis(
                kategoriData
              );

            html += `
              <div class="subjenis-group">
                <div class="subjenis-header">
                  <div class="subjenis-title">
                    ${escapeHtml(
                      subJenis
                    )}
                  </div>

                  <div class="subjenis-total">
                    ${formatRupiah(
                      sumPendapatan(
                        subJenisRows
                      )
                    )}
                  </div>
                </div>
            `;

            Object.entries(
              kategoriData
            ).forEach(
              ([
                kategori,
                rows
              ]) => {
                html += `
                  <div class="kategori-group">
                    <div class="kategori-header">
                      <div class="kategori-title">
                        ${escapeHtml(
                          kategori
                        )}
                      </div>

                      <div class="kategori-total">
                        ${formatRupiah(
                          sumPendapatan(
                            rows
                          )
                        )}
                      </div>
                    </div>

                    ${
                      renderPendapatanTable(
                        rows
                      )
                    }
                  </div>
                `;
              }
            );

            html += `
              </div>
            `;
          }
        );

        html += `
          </section>
        `;
      }
    );

  pendapatanGroup.innerHTML =
    html;
}

// ======================================================
// RENDER PAGE
// ======================================================

function renderPendapatanPage() {
  const totalItems =
    filteredPendapatan.length;

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalItems /
        itemsPerPagePendapatan
      )
    );

  if (
    currentPagePendapatan >
    totalPages
  ) {
    currentPagePendapatan =
      totalPages;
  }

  const startIndex =
    (
      currentPagePendapatan - 1
    ) *
    itemsPerPagePendapatan;

  const endIndex =
    startIndex +
    itemsPerPagePendapatan;

  const pageData =
    filteredPendapatan.slice(
      startIndex,
      endIndex
    );

  renderPendapatanGrouping(
    pageData
  );

  renderPendapatanPagination(
    totalItems,
    totalPages,
    startIndex,
    Math.min(
      endIndex,
      totalItems
    )
  );
}

// ======================================================
// PAGINATION
// ======================================================

function renderPendapatanPagination(
  totalItems,
  totalPages,
  startIndex,
  endIndex
) {
  if (
    !pendapatanPagination ||
    !pendapatanPaginationInfo ||
    !pendapatanPaginationButtons
  ) {
    return;
  }

  if (
    totalItems <=
    itemsPerPagePendapatan
  ) {
    pendapatanPagination.style.display =
      "none";

    pendapatanPaginationButtons.innerHTML =
      "";

    return;
  }

  pendapatanPagination.style.display =
    "flex";

  pendapatanPaginationInfo.textContent =
    `Menampilkan ${
      startIndex + 1
    }-${endIndex} dari ${totalItems} termin`;

  const tombol = [];

  tombol.push(`
    <button
      type="button"
      class="page-button"
      data-page="${
        currentPagePendapatan - 1
      }"
      ${
        currentPagePendapatan === 1
          ? "disabled"
          : ""
      }
    >
      ‹
    </button>
  `);

  const pageStart =
    Math.max(
      1,
      currentPagePendapatan - 2
    );

  const pageEnd =
    Math.min(
      totalPages,
      currentPagePendapatan + 2
    );

  if (pageStart > 1) {
    tombol.push(`
      <button
        type="button"
        class="page-button"
        data-page="1"
      >
        1
      </button>
    `);

    if (pageStart > 2) {
      tombol.push(`
        <button
          type="button"
          class="page-button"
          disabled
        >
          ...
        </button>
      `);
    }
  }

  for (
    let page = pageStart;
    page <= pageEnd;
    page += 1
  ) {
    tombol.push(`
      <button
        type="button"
        class="
          page-button
          ${
            page ===
            currentPagePendapatan
              ? "active"
              : ""
          }
        "
        data-page="${page}"
      >
        ${page}
      </button>
    `);
  }

  if (pageEnd < totalPages) {
    if (
      pageEnd <
      totalPages - 1
    ) {
      tombol.push(`
        <button
          type="button"
          class="page-button"
          disabled
        >
          ...
        </button>
      `);
    }

    tombol.push(`
      <button
        type="button"
        class="page-button"
        data-page="${totalPages}"
      >
        ${totalPages}
      </button>
    `);
  }

  tombol.push(`
    <button
      type="button"
      class="page-button"
      data-page="${
        currentPagePendapatan + 1
      }"
      ${
        currentPagePendapatan ===
        totalPages
          ? "disabled"
          : ""
      }
    >
      ›
    </button>
  `);

  pendapatanPaginationButtons.innerHTML =
    tombol.join("");
}

// ======================================================
// EVENT PAGINATION
// ======================================================

if (pendapatanPaginationButtons) {
  pendapatanPaginationButtons
    .addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "button[data-page]"
          );

        if (
          !button ||
          button.disabled
        ) {
          return;
        }

        const page =
          Number(
            button.dataset.page
          );

        if (
          !Number.isInteger(page) ||
          page <= 0
        ) {
          return;
        }

        currentPagePendapatan =
          page;

        renderPendapatanPage();

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    );
}

// ======================================================
// RESET FILTER
// ======================================================

function resetFilterPendapatan() {
  if (searchPendapatan) {
    searchPendapatan.value =
      "";
  }

  /*
   * Reset kembali ke:
   * Tahun berjalan
   * Status Sudah Dibayar
   */

  setFilterPendapatanDariUrl();

  currentPagePendapatan = 1;

  applyPendapatanFilter();
}

// ======================================================
// EVENTS
// ======================================================

if (searchPendapatan) {
  searchPendapatan.addEventListener(
    "input",
    () => applyPendapatanFilter()
  );
}

if (filterTahunPendapatan) {
  filterTahunPendapatan.addEventListener(
    "change",
    () => applyPendapatanFilter()
  );
}

if (filterBulanPendapatan) {
  filterBulanPendapatan
    .addEventListener(
      "change",
      () => {
        currentPagePendapatan = 1;

        applyPendapatanFilter();
      }
    );
}

if (filterJenisPendapatan) {
  filterJenisPendapatan.addEventListener(
    "change",
    () => applyPendapatanFilter()
  );
}

if (
  filterStatusPembayaranPendapatan
) {
  filterStatusPembayaranPendapatan
    .addEventListener(
      "change",
      () => applyPendapatanFilter()
    );
}

if (resetPendapatanFilter) {
  resetPendapatanFilter.addEventListener(
    "click",
    resetFilterPendapatan
  );
}

// ======================================================
// START
// ======================================================

loadPendapatan();