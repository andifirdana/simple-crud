// ======================================================
// PENDAPATAN
// GROUP:
// JENIS -> SUB JENIS -> KATEGORI -> TERMIN
// ======================================================

let allPendapatan = [];
let filteredPendapatan = [];
let currentPagePendapatan = 1;

const tampilPendapatanBulanan = document.body.hasAttribute("data-pendapatan-bulanan");
const itemsPerPagePendapatan = tampilPendapatanBulanan ? 100 : 20;
const tombolUnduhPendapatan = document.getElementById("pendapatanExport");
let mengunduhPendapatan = false;
const statusDefaultPendapatan = tampilPendapatanBulanan ? "" : "Sudah Dibayar";
let barisPendapatanBulanan = [];

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

const filterRentangPendapatan = tampilPendapatanBulanan ? {
  bulan_awal: document.getElementById("filterBulanAwalPendapatan"),
  tahun_awal: document.getElementById("filterTahunAwalPendapatan"),
  bulan_akhir: document.getElementById("filterBulanAkhirPendapatan"),
  tahun_akhir: document.getElementById("filterTahunAkhirPendapatan")
} : null;

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
  const tanggalTagihan =
    item?.tanggal_tagihan ||
    item?.tanggal_jatuh_tempo ||
    null;

  const tanggalBayar =
    item?.tanggal_bayar ||
    null;

  // Sudah dibayar: gunakan tanggal bayar.
  // Jika tanggal bayar kosong, gunakan tanggal tagihan.
  if (statusSudahDibayar(item)) {
    return tanggalBayar || tanggalTagihan;
  }

  // Belum dibayar / proses: gunakan tanggal tagihan.
  return tanggalTagihan || tanggalBayar;
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

  if (filterRentangPendapatan) {
    for (const [key, select] of Object.entries(filterRentangPendapatan)) {
      if (select.value || key.startsWith("tahun_")) params.set(key, select.value);
    }
  }

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
  const halaman = window.location.pathname;

  window.history.replaceState(
    {},
    "",
    query
      ? `${halaman}?${query}`
      : halaman
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

async function loadPendapatan({ pertahankanFilter = false } = {}) {
  if (tombolUnduhPendapatan) tombolUnduhPendapatan.disabled = true;
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

    if (!pertahankanFilter) setFilterPendapatanDariUrl();

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

function loadFilterBulanPendapatan(select = filterBulanPendapatan, tanpaBulan = "Semua Bulan") {
  if (!select) return;
  const dipilih = select.value;
  select.replaceChildren(new Option(tanpaBulan, ""),
    ...namaBulanPendapatan.map((nama, index) => new Option(nama, String(index + 1)))
  );
  select.value = dipilih;
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
        .filter(Number.isInteger)
    ])
  ].sort((a, b) => b - a);

  isiSelectPendapatan(
    filterTahunPendapatan,
    daftarTahun,
    "Semua Tahun"
  );

  loadFilterBulanPendapatan();
  if (filterRentangPendapatan) {
    loadFilterBulanPendapatan(filterRentangPendapatan.bulan_awal, "Awal tahun");
    loadFilterBulanPendapatan(filterRentangPendapatan.bulan_akhir, "Akhir tahun");
    isiSelectPendapatan(filterRentangPendapatan.tahun_awal, daftarTahun, "Tanpa batas awal");
    isiSelectPendapatan(filterRentangPendapatan.tahun_akhir, daftarTahun, "Tanpa batas akhir");
  }

  const daftarJenis = [
    ...new Set(
      allPendapatan
        .map(item => item.jenis_proyek)
        .filter(Boolean)
    )
  ].sort((a, b) =>
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
      "Pendapatan Diakui",
      "Sudah Dibayar",
      "Selain Dibayar",
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


function setRentangPendapatanDariUrl(params = pendapatanUrlParams) {
  const tahunDefault = String(new Date().getFullYear());
  for (const batas of ["awal", "akhir"]) {
    const tahun = filterRentangPendapatan[`tahun_${batas}`];
    const bulan = filterRentangPendapatan[`bulan_${batas}`];
    const tahunUrl = params.get(`tahun_${batas}`) ?? params.get("tahun") ?? tahunDefault;
    const bulanUrl = params.get(`bulan_${batas}`) ?? params.get("bulan") ?? "";
    tahun.value = [...tahun.options].some(option => option.value === tahunUrl) ? tahunUrl : tahunDefault;
    bulan.value = [...bulan.options].some(option => option.value === bulanUrl) ? bulanUrl : "";
  }
}

function bacaRentangPendapatan() {
  const { tahun_awal, bulan_awal, tahun_akhir, bulan_akhir } = filterRentangPendapatan;
  bulan_awal.disabled = !tahun_awal.value;
  bulan_akhir.disabled = !tahun_akhir.value;
  if (bulan_awal.disabled) bulan_awal.value = "";
  if (bulan_akhir.disabled) bulan_akhir.value = "";

  return {
    awal: tahun_awal.value ? Number(tahun_awal.value) * 100 + Number(bulan_awal.value || 1) : -Infinity,
    akhir: tahun_akhir.value ? Number(tahun_akhir.value) * 100 + Number(bulan_akhir.value || 12) : Infinity
  };
}

function setFilterPendapatanDariUrl() {
  if (filterRentangPendapatan) setRentangPendapatanDariUrl();
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
      : statusDefaultPendapatan;


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
        statusDefaultPendapatan;
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
  const rentang = filterRentangPendapatan ? bacaRentangPendapatan() : null;
  const rentangTerbalik = Boolean(rentang && rentang.awal > rentang.akhir);
  if (rentang) document.getElementById("pendapatanRentangError").hidden = !rentangTerbalik;

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
    rentangTerbalik ? [] : allPendapatan.filter(
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
            tampilPendapatanBulanan && isPendapatanSewa(item) ? item.no_req_klien : null,
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
        const periode = itemTahun * 100 + itemBulan;
        const matchRentang = !rentang || (
          (!Number.isFinite(rentang.awal) && !Number.isFinite(rentang.akhir)) ||
          (itemTahun != null && itemBulan >= 1 && itemBulan <= 12 && periode >= rentang.awal && periode <= rentang.akhir)
        );

        return (
          matchSearch &&
          matchTahun &&
          matchBulan &&
          matchRentang &&
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

  if (tampilPendapatanBulanan) {
    const tampil = new Set(filteredPendapatan.map(item => getTahun(getTanggalPendapatan(item))));
    const tersembunyi = [...new Set(dataSummary.map(item => getTahun(getTanggalPendapatan(item))))]
      .filter(tahun => tahun != null && !tampil.has(tahun)).sort((a, b) => a - b);
    const info = document.getElementById("pendapatanStatusInfo");
    info.hidden = tersembunyi.length === 0;
    info.textContent = tersembunyi.length
      ? `Filter Status Pembayaran menyembunyikan data tahun ${tersembunyi.join(", ")}. Pilih Semua Status Pembayaran untuk melihatnya.`
      : "";
  }

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

function getPendapatanProjectLink(item) {
  const sewa = isPendapatanSewa(item);
  const id = Number(sewa ? item.proyek_sewa_id : item.proyek_id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const halaman = sewa ? "proyek-sewa-detail.html" : "detail-proyek.html";
  return `/${halaman}?id=${encodeURIComponent(id)}`;
}

function formatPersentasePendapatan(value) {
  const angka = Number(value);
  if (value == null || value === "" || !Number.isFinite(angka)) return "—";
  return `${angka.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}

function getDeskripsiPendapatan(item) {
  return isPendapatanSewa(item) ? item.deskripsi || item.nama_termin : item.nama_termin || item.deskripsi;
}

function kelasStatusPembayaranPendapatan(status) {
  if (status === "Sudah Dibayar") return "sudah-dibayar";
  if (status === "Proses") return "proses";
  return "belum-dibayar";
}

const formatBulanPendapatan = new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" });
const namaBulanPendapatan = Array.from({ length: 12 }, (_, index) =>
  formatBulanPendapatan.format(new Date(Date.UTC(2000, index, 1)))
);

function kelompokkanPendapatanBulanan(data) {
  const grup = new Map();
  for (const item of data) {
    const tanggal = getTanggalPendapatan(item);
    const nomorBulan = getBulan(tanggal);
    const tahun = nomorBulan >= 1 && nomorBulan <= 12 ? getTahun(tanggal) : null;
    const sewa = isPendapatanSewa(item);
    const proyek = sewa ? item.proyek_sewa_id : item.proyek_id;
    const klien = item.proyek_klien_id ?? item.klien_id ?? item.nama_klien ?? item.perusahaan_klien;
    const key = JSON.stringify([sewa, proyek ?? item.nomor_pr ?? item.nama_proyek, klien]);
    if (!grup.has(key)) {
      grup.set(key, { item, perTahun: new Map(), tanpaTanggal: null, sudahDibayar: 0, outstanding: 0 });
    }

    const row = grup.get(key);
    const nilai = getNilaiPendapatan(item);
    if (getStatusPembayaranPendapatan(item) === "Sudah Dibayar") row.sudahDibayar += nilai;
    else row.outstanding += nilai;
    let sel;
    if (tahun == null) {
      sel = row.tanpaTanggal ??= { nilai: 0, termin: [] };
    } else {
      if (!row.perTahun.has(tahun)) row.perTahun.set(tahun, { bulan: Array(12).fill(null), total: 0 });
      const rekap = row.perTahun.get(tahun);
      sel = rekap.bulan[nomorBulan - 1] ??= { nilai: 0, termin: [] };
      rekap.total += nilai;
    }
    sel.nilai += nilai;
    sel.termin.push(item);
  }
  return [...grup.values()];
}

function pilihTahunPendapatanBulanan(rows) {
  const tersedia = [...new Set(rows.flatMap(row => [...row.perTahun.keys()]))].sort((a, b) => a - b);
  const batasAwal = Number(filterRentangPendapatan.tahun_awal.value);
  const batasAkhir = Number(filterRentangPendapatan.tahun_akhir.value);
  const awal = batasAwal || tersedia[0] || batasAkhir;
  const akhir = batasAkhir || tersedia.at(-1) || batasAwal;
  return awal && akhir >= awal ? Array.from({ length: akhir - awal + 1 }, (_, index) => awal + index) : [];
}

function getKeteranganProyekPendapatan(item) {
  if (!isPendapatanSewa(item)) return getKategoriPendapatan(item);
  return item.nomor_pr && item.nama_proyek && item.nomor_pr !== item.nama_proyek ? `PR ${item.nomor_pr}` : "";
}

function getNilaiKontrakBulanan({ item, perTahun }) {
  const nilai = item.nilai_kontrak ?? item.total_nilai ?? item.nilai_proyek;
  const nilaiNol = String(nilai ?? "").trim() !== "" && Number(nilai) === 0;
  return nilaiNol && perTahun.size
    ? [...perTahun.values()].reduce((total, rekap) => total + rekap.total, 0)
    : nilai;
}

function susunExcelPendapatan(data) {
  const proyek = kelompokkanPendapatanBulanan(data);
  const tahunTampil = pilihTahunPendapatanBulanan(proyek);
  const adaTanpaTanggal = proyek.some(row => row.tanpaTanggal);
  const header = ["No", "Proyek", "Kategori / No PR", "Jenis Proyek", "Nilai Kontrak",
    "Total Sudah Dibayar", "Total Outstanding", "Total Termin"];
  for (const tahun of tahunTampil) {
    header.push(...namaBulanPendapatan.map(bulan => `${bulan} ${tahun}`), `Total ${tahun}`);
  }
  if (adaTanpaTanggal) header.push("Tanpa Tanggal");

  const bulanan = [header];
  const rincian = [[
    "Proyek", "Kategori / No PR", "Jenis Proyek", "No Req Klien", "Periode", "Termin/Deskripsi",
    "Nilai", "Persentase (%)", "Status", "Tanggal Tagihan", "Tanggal Dibayar", "Syarat Pembayaran"
  ]];
  const angkaExcel = nilai => nilai != null && String(nilai).trim() && Number.isFinite(Number(nilai)) ? Number(nilai) : null;
  const tanggalExcel = nilai => nilai ? String(nilai).slice(0, 10) : "";

  for (const [index, row] of proyek.entries()) {
    const { item, perTahun, tanpaTanggal, sudahDibayar, outstanding } = row;
    const identitas = [item.nama_proyek || item.nomor_pr || "—", getKeteranganProyekPendapatan(item), item.jenis_proyek ?? ""];
    const nilai = [index + 1, ...identitas, angkaExcel(getNilaiKontrakBulanan(row)), sudahDibayar, outstanding, sudahDibayar + outstanding];
    const tambahRincian = (sel, periode) => {
      for (const termin of sel?.termin ?? []) {
        rincian.push([...identitas, termin.no_req_klien ?? "", periode, getDeskripsiPendapatan(termin) || "",
          getNilaiPendapatan(termin), angkaExcel(termin.persentase), getStatusPembayaranPendapatan(termin),
          tanggalExcel(isPendapatanSewa(termin) ? termin.tanggal_tagihan : termin.tanggal_jatuh_tempo),
          tanggalExcel(termin.tanggal_bayar), termin.syarat_pembayaran ?? ""]);
      }
    };
    for (const tahun of tahunTampil) {
      const rekap = perTahun.get(tahun);
      for (const [bulan, nama] of namaBulanPendapatan.entries()) {
        const sel = rekap?.bulan[bulan];
        nilai.push(sel?.nilai ?? null);
        tambahRincian(sel, `${nama} ${tahun}`);
      }
      nilai.push(rekap?.total ?? null);
    }
    if (adaTanpaTanggal) {
      nilai.push(tanpaTanggal?.nilai ?? null);
      tambahRincian(tanpaTanggal, "Tanpa Tanggal");
    }
    bulanan.push(nilai);
  }
  return { bulanan, rincian };
}

function renderPendapatanBulanan(data, startIndex, tahunTampil, adaTanpaTanggal) {
  const cellNominal = (nilai, kelas = "") =>
    `<td class="amount${kelas ? ` ${kelas}` : ""}">${nilai == null ? "—" : formatRupiah(nilai)}</td>`;
  const rowSpan = tahunTampil.length ? 'rowspan="2"' : "";
  const cellBulanan = (sel, index, bulan, nama, tahun) => {
    if (!sel) return cellNominal(null);

    const namaBulan = namaBulanPendapatan[bulan];
    const nominal = formatRupiah(sel.nilai);
    const rincian = sel.termin.map(item => ({
      nama: String(getDeskripsiPendapatan(item) || "").trim(),
      status: getStatusPembayaranPendapatan(item)
    }));
    const status = [...new Set(rincian.map(item => item.status))];
    const kelas = status.length === 1 ? ` ${kelasStatusPembayaranPendapatan(status[0])}` : "";
    const termin = namaBulan ? rincian.filter(item => item.nama) : [];
    const namaTermin = [...new Set(termin.map(item => item.nama))].join(" · ");
    const labelTermin = [...new Set(termin.map(item =>
      `<span class="${kelasStatusPembayaranPendapatan(item.status)}" title="${escapeHtml(item.status)}">${escapeHtml(item.nama)}</span>`
    ))].join(" · ");
    const periode = namaBulan ? `${namaBulan} ${tahun}` : "Tanpa Tanggal";
    const label = [nama, periode, nominal, status.join(" / "), namaTermin].filter(Boolean).join(", ");

    return `<td class="amount"><button type="button" class="projection-month${kelas}" data-rincian-pendapatan="${index}"
        data-bulan="${bulan}" data-tahun="${tahun ?? ""}" aria-haspopup="dialog" aria-controls="pendapatanDetail"
        aria-label="${escapeHtml(`Rincian ${label}`)}"><strong>${nominal}</strong>${labelTermin ? `<small title="${escapeHtml(namaTermin)}">${labelTermin}</small>` : ""}</button></td>`;
  };

  return `
    <div class="pendapatan-table-wrap" role="region" aria-label="Tabel pendapatan bulanan" tabindex="0">
      <table class="pendapatan-table pendapatan-table-bulanan">
        <colgroup span="7"></colgroup>
        ${tahunTampil.map(() => '<colgroup span="13"></colgroup>').join("")}
        ${adaTanpaTanggal ? '<colgroup span="1"></colgroup>' : ""}
        <thead><tr>
          <th scope="col" ${rowSpan}>No</th><th scope="col" ${rowSpan}>Proyek</th>
          <th scope="col" ${rowSpan}>Jenis Proyek</th><th scope="col" ${rowSpan}>Nilai Kontrak</th>
          <th scope="col" class="pendapatan-total pendapatan-total-paid" ${rowSpan}>Total Sudah Dibayar</th>
          <th scope="col" class="pendapatan-total pendapatan-total-outstanding" ${rowSpan}>Total Outstanding</th>
          <th scope="col" class="pendapatan-total" ${rowSpan}>Total Termin</th>
          ${tahunTampil.map(tahun => `<th scope="colgroup" colspan="13" class="pendapatan-year-head">${tahun}</th>`).join("")}
          ${adaTanpaTanggal ? `<th scope="col" ${rowSpan}>Tanpa Tanggal</th>` : ""}
        </tr>${tahunTampil.length ? `<tr class="pendapatan-month-head">
          ${tahunTampil.map(tahun => namaBulanPendapatan.map(nama => `<th scope="col">${nama}</th>`).join("") +
            `<th scope="col" class="pendapatan-year-total">Total ${tahun}</th>`).join("")}
        </tr>` : ""}</thead>
        <tbody>${data.map((row, index) => {
          const { item, perTahun, tanpaTanggal, sudahDibayar, outstanding } = row;
          const link = getPendapatanProjectLink(item);
          const nama = item.nama_proyek || item.nomor_pr || "—";
          const keterangan = getKeteranganProyekPendapatan(item);
          const subtext = keterangan ? `<span class="pendapatan-subtext">${escapeHtml(keterangan)}</span>` : "";
          const nilaiKontrak = getNilaiKontrakBulanan(row);
          return `<tr>
            <td>${startIndex + index + 1}</td>
            <td>${link ? `<a href="${link}" class="pendapatan-project-link">${escapeHtml(nama)}</a>` : escapeHtml(nama)}${subtext}</td>
            <td>${escapeHtml(item.jenis_proyek || "—")}</td>
            <td class="amount"><span class="pendapatan-contract-value">${nilaiKontrak == null ? "—" : formatRupiah(nilaiKontrak)}</span></td>
            ${cellNominal(sudahDibayar, "pendapatan-total pendapatan-total-paid")}
            ${cellNominal(outstanding, "pendapatan-total pendapatan-total-outstanding")}
            ${cellNominal(sudahDibayar + outstanding, "pendapatan-total")}
            ${tahunTampil.map(tahun => {
              const rekap = perTahun.get(tahun);
              const bulanan = namaBulanPendapatan.map((_, nomor) => cellBulanan(rekap?.bulan[nomor], index, nomor, nama, tahun));
              return `${bulanan.join("")}<td class="amount pendapatan-year-total">${rekap ? formatRupiah(rekap.total) : "—"}</td>`;
            }).join("")}
            ${adaTanpaTanggal ? cellBulanan(tanpaTanggal, index, "tanpa-tanggal", nama) : ""}
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  `;
}

tombolUnduhPendapatan?.addEventListener("click", async () => {
  if (mengunduhPendapatan || !filteredPendapatan.length) return;
  const pesan = document.getElementById("pendapatanExportError");
  pesan.hidden = true;
  mengunduhPendapatan = tombolUnduhPendapatan.disabled = true;
  tombolUnduhPendapatan.textContent = "Menyiapkan Excel…";
  try {
    const response = await fetch("/api/pendapatan/bulanan/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(susunExcelPendapatan(filteredPendapatan))
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "Gagal menyiapkan file Excel.");
    }
    if (!response.headers.get("Content-Type")?.includes("spreadsheetml.sheet")) {
      throw new Error("File Excel belum tersedia.");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "pendapatan-2.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    pesan.textContent = error.message;
    pesan.hidden = false;
  } finally {
    mengunduhPendapatan = false;
    tombolUnduhPendapatan.textContent = "Unduh Excel";
    tombolUnduhPendapatan.disabled = !filteredPendapatan.length;
  }
});

if (tampilPendapatanBulanan) {
  const modal = document.getElementById("pendapatanDetail");
  const detailTable = document.getElementById("pendapatanDetailTable");
  const detailRows = document.getElementById("pendapatanDetailRows");
  const editForm = document.getElementById("pendapatanDetailEdit");
  const editError = document.getElementById("pendapatanEditError");
  const notice = document.getElementById("pendapatanEditNotice");
  const tutup = document.getElementById("pendapatanDetailClose");
  let terminDetail = [];
  let editTermin;
  let tombolEdit;
  let nilaiAwal;
  let inputTerakhir = "";
  let menyimpanTermin = false;

  function tampilkanTabelRincian() {
    editTermin = null;
    editForm.hidden = true;
    detailTable.hidden = false;
  }

  pendapatanGroup.addEventListener("click", event => {
    const tombol = event.target.closest("[data-rincian-pendapatan]");
    if (!tombol) return;
    const row = barisPendapatanBulanan[Number(tombol.dataset.rincianPendapatan)];
    const bulan = tombol.dataset.bulan;
    const tahun = Number(tombol.dataset.tahun);
    const sel = bulan === "tanpa-tanggal" ? row?.tanpaTanggal : row?.perTahun.get(tahun)?.bulan[Number(bulan)];
    if (!sel) return;

    tampilkanTabelRincian();
    const { item } = row;
    const periode = bulan === "tanpa-tanggal" ? "Tanpa Tanggal" : `${namaBulanPendapatan[bulan]} ${tahun}`;
    document.getElementById("pendapatanDetailContext").textContent = [
      item.nama_proyek || item.nomor_pr || "—", item.nama_klien || item.perusahaan_klien, periode
    ].filter(Boolean).join(" · ");
    document.getElementById("pendapatanDetailTotal").textContent = formatRupiah(sel.nilai);
    terminDetail = sel.termin;
    detailRows.innerHTML = terminDetail.map((termin, index) => {
      const sewa = isPendapatanSewa(termin);
      const tagihan = sewa ? termin.tanggal_tagihan : termin.tanggal_jatuh_tempo;
      const status = getStatusPembayaranPendapatan(termin);
      const deskripsi = escapeHtml(getDeskripsiPendapatan(termin) || "—");
      const editor = termin.bisa_edit_syarat_pembayaran === true && termin.termin_id && termin.proyek_id
        ? `<button type="button" class="projection-edit" data-edit-termin="${index}" aria-label="Edit ${deskripsi}">Edit</button>`
        : "";
      return `<tr role="row">
        <td role="cell" data-label="Termin/Deskripsi"><span>${deskripsi}</span></td>
        <td role="cell" data-label="Nilai"><span>${formatRupiah(getNilaiPendapatan(termin))}</span></td>
        <td role="cell" data-label="Persentase"><span>${formatPersentasePendapatan(termin.persentase)}</span></td>
        <td role="cell" data-label="Status"><span class="pendapatan-status ${kelasStatusPembayaranPendapatan(status)}">${escapeHtml(status)}</span></td>
        <td role="cell" data-label="Tanggal Tagihan"><span>${formatTanggal(tagihan)}</span></td>
        <td role="cell" data-label="Tanggal Dibayar"><span>${formatTanggal(termin.tanggal_bayar)}</span></td>
        <td role="cell" data-label="Syarat Pembayaran"><span>${escapeHtml(termin.syarat_pembayaran || "—")}</span></td>
        <td role="cell" data-label="Aksi">${editor}</td>
      </tr>`;
    }).join("");

    if (!modal.open) {
      tombol.focus({ preventScroll: true });
      modal.showModal();
    }
  });

  modal.addEventListener("cancel", event => {
    if (menyimpanTermin) event.preventDefault();
  });

  detailRows.addEventListener("click", event => {
    const tombol = event.target.closest("[data-edit-termin]");
    if (!tombol || menyimpanTermin) return;
    const termin = terminDetail[Number(tombol.dataset.editTermin)];
    if (!termin?.bisa_edit_syarat_pembayaran) return;

    editTermin = termin;
    tombolEdit = tombol;
    inputTerakhir = "";
    const bidang = editForm.elements;
    bidang.nama_termin.value = getDeskripsiPendapatan(termin) || "";
    bidang.nominal.value = String(Number(getNilaiPendapatan(termin).toFixed(2)));
    bidang.persentase.value = termin.persentase == null ? "" : String(Number(Number(termin.persentase).toFixed(6)));
    nilaiAwal = { nominal: bidang.nominal.value, persentase: bidang.persentase.value };
    bidang.status_pembayaran.value = getStatusPembayaranPendapatan(termin);
    bidang.tanggal_jatuh_tempo.value = String((isPendapatanSewa(termin) ? termin.tanggal_tagihan : termin.tanggal_jatuh_tempo) ?? "").slice(0, 10);
    bidang.tanggal_bayar.value = String(termin.tanggal_bayar ?? "").slice(0, 10);
    bidang.syarat_pembayaran.value = termin.syarat_pembayaran ?? "";
    editError.hidden = true;
    detailTable.hidden = true;
    editForm.hidden = false;
    editForm.scrollTop = 0;
    bidang.nama_termin.focus();
  });

  editForm.addEventListener("input", event => {
    if (["nominal", "persentase"].includes(event.target.name)) inputTerakhir = event.target.name;
  });

  document.getElementById("pendapatanEditCancel").addEventListener("click", () => {
    tampilkanTabelRincian();
    tombolEdit?.focus();
  });

  editForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!editTermin || menyimpanTermin) return;
    const payload = Object.fromEntries(new FormData(editForm));
    const berubah = ["nominal", "persentase"].filter(key => payload[key] !== nilaiAwal[key]);
    payload.input_terakhir = berubah.length === 2 ? inputTerakhir : berubah[0] ?? "";
    payload.tanggal_jatuh_tempo = payload.tanggal_jatuh_tempo || null;
    payload.tanggal_bayar = payload.tanggal_bayar || null;
    const sumber = isPendapatanSewa(editTermin) ? "sewa" : "reguler";
    const proyekId = encodeURIComponent(editTermin.proyek_id);
    const terminId = encodeURIComponent(editTermin.termin_id);
    menyimpanTermin = tutup.disabled = true;
    for (const control of editForm.elements) control.disabled = true;
    editError.hidden = true;
    notice.hidden = true;
    try {
      const response = await fetch(`/api/pendapatan/proyek/${proyekId}/${sumber}/${terminId}/termin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.data) throw new Error(result?.error || "Gagal menyimpan termin pembayaran.");
      modal.close();
      await loadPendapatan({ pertahankanFilter: true });
      notice.textContent = "Termin pembayaran tersimpan.";
      notice.hidden = false;
    } catch (error) {
      editError.textContent = error.message;
      editError.hidden = false;
    } finally {
      menyimpanTermin = tutup.disabled = false;
      for (const control of editForm.elements) control.disabled = false;
    }
  });
}

// ======================================================
// RENDER TABLE
// STRUKTUR TABEL TETAP
// ======================================================
// ======================================================
// RENDER TABEL PENDAPATAN
// ======================================================
function renderPendapatanTable(
  data,
  startIndex = 0
) {
  return `
    <div class="pendapatan-table-wrap" role="region" aria-label="Tabel termin pendapatan" tabindex="0">
      <table class="pendapatan-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Proyek</th>
            <th>Klien</th>
            <th>Jenis Proyek</th>
            <th>Periode Kontrak</th>
            <th>Nilai Kontrak</th>
            <th>Deskripsi/Termin</th>
            <th>Persentase</th>
            <th>Nominal</th>
            <th>Status</th>
            <th>Tanggal Tagihan</th>
            <th>Tanggal Bayar</th>
            <th>Syarat Pembayaran</th>
          </tr>
        </thead>

        <tbody>
          ${data.map((item, index) => {
            const sewa =
              isPendapatanSewa(item);

            const detailLink = getPendapatanProjectLink(item);

            const namaProyek =
              item.nama_proyek ||
              item.nomor_pr ||
              "-";

            const periodeMulai =
              item.tanggal_mulai_kontrak ||
              item.tanggal_mulai ||
              null;

            const periodeAkhir =
              item.tanggal_akhir_kontrak ||
              item.tanggal_akhir ||
              null;

            const periodeKontrak =
              periodeMulai || periodeAkhir
                ? `${formatTanggal(periodeMulai)} – ${formatTanggal(periodeAkhir)}`
                : "-";

            const nilaiKontrak =
              item.nilai_kontrak ??
              item.total_nilai ??
              item.nilai_proyek ??
              null;

            const deskripsi =
              sewa
                ? (
                    item.deskripsi ||
                    item.nama_termin ||
                    "-"
                  )
                : (
                    item.nama_termin ||
                    item.deskripsi ||
                    "-"
                  );

            const angkaPersentase =
              Number(item.persentase);

            const persentase =
              item.persentase !== null &&
              item.persentase !== undefined &&
              item.persentase !== "" &&
              Number.isFinite(angkaPersentase)
                ? `${angkaPersentase.toLocaleString(
                    "id-ID",
                    {
                      maximumFractionDigits: 2
                    }
                  )}%`
                : "-";

            // Reguler/SLA: jatuh tempo.
            // Sewa: tanggal tagihan.
            const tanggalTagihan =
              sewa
                ? item.tanggal_tagihan
                : item.tanggal_jatuh_tempo;

            const status =
              getStatusPembayaranPendapatan(
                item
              );

            const kelasStatus =
              status === "Sudah Dibayar"
                ? "sudah-dibayar"
                : status === "Proses"
                  ? "proses"
                  : "belum-dibayar";

            return `
              <tr>
                <td class="nomor">
                  ${startIndex + index + 1}
                </td>

                <td class="proyek-cell">
                  ${
                    detailLink
                      ? `
                        <a
                          href="${detailLink}"
                          class="pendapatan-project-link"
                        >
                          ${escapeHtml(namaProyek)}
                        </a>
                      `
                      : escapeHtml(namaProyek)
                  }

                  ${
                    sewa && item.nomor_pr &&
                    item.nomor_pr !== namaProyek
                      ? `
                        <span class="pendapatan-subtext">
                          PR ${escapeHtml(item.nomor_pr)}
                        </span>
                      `
                      : ""
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
                  ${escapeHtml(
                    item.jenis_proyek ||
                    "-"
                  )}
                </td>

                <td class="periode-cell">
                  ${periodeKontrak}
                </td>

                <td class="amount">
                  ${
                    nilaiKontrak === null
                      ? "-"
                      : formatRupiah(nilaiKontrak)
                  }
                </td>

                <td class="deskripsi-cell">
                  ${escapeHtml(deskripsi)}
                </td>

                <td class="persentase-cell">
                  ${persentase}
                </td>

                <td class="amount">
                  ${formatRupiah(
                    getNilaiPendapatan(item)
                  )}
                </td>

                <td>
                  <span class="pendapatan-status ${kelasStatus}">
                    ${escapeHtml(status)}
                  </span>
                </td>

                <td>
                ${formatTanggal(
                  isPendapatanSewa(item)
                    ? item.tanggal_tagihan
                    : item.tanggal_jatuh_tempo
                )}
              </td>

                <td class="tanggal-cell">
                  ${formatTanggal(item.tanggal_bayar)}
                </td>

                <td class="syarat-cell">
                  ${escapeHtml(
                    item.syarat_pembayaran ||
                    "-"
                  )}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ======================================================
// TAMPILKAN DAFTAR TANPA GROUPING
// ======================================================
function renderPendapatanGrouping(
  data,
  startIndex = 0,
  tahunTampil = [],
  adaTanpaTanggal = false
) {
  if (!pendapatanGroup) {
    return;
  }

  if (!Array.isArray(data) || data.length === 0) {
    pendapatanGroup.innerHTML = `
      <div class="empty-state">
        Tidak ada pendapatan sesuai filter.
      </div>
    `;
    return;
  }

  pendapatanGroup.innerHTML = tampilPendapatanBulanan
    ? renderPendapatanBulanan(data, startIndex, tahunTampil, adaTanpaTanggal)
    : renderPendapatanTable(data, startIndex);
}

// ======================================================
// RENDER PAGE
// ======================================================

function renderPendapatanPage() {
  if (tombolUnduhPendapatan) tombolUnduhPendapatan.disabled = mengunduhPendapatan || !filteredPendapatan.length;
  const rows = tampilPendapatanBulanan ? kelompokkanPendapatanBulanan(filteredPendapatan) : filteredPendapatan;
  const totalItems =
    rows.length;

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
    rows.slice(
      startIndex,
      endIndex
    );
  if (tampilPendapatanBulanan) {
    barisPendapatanBulanan = pageData;
    const modal = document.getElementById("pendapatanDetail");
    if (modal.open) modal.close();
  }

  renderPendapatanGrouping(
    pageData,
    startIndex,
    tampilPendapatanBulanan ? pilihTahunPendapatanBulanan(rows) : [],
    tampilPendapatanBulanan && rows.some(row => row.tanpaTanggal != null)
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
    }-${endIndex} dari ${totalItems} ${tampilPendapatanBulanan ? "baris" : "termin"}`;

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

  if (filterRentangPendapatan) {
    setRentangPendapatanDariUrl(new URLSearchParams());
    setDefaultPendapatanFilter();
  } else {
    setFilterPendapatanDariUrl();
  }

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

if (filterRentangPendapatan) {
  for (const select of Object.values(filterRentangPendapatan)) {
    select.addEventListener("change", () => applyPendapatanFilter());
  }
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

(() => {
  function initPosisiPendapatan() {
    if (!document.querySelector(".pendapatan-page")) return;

    let sidebarTerpantau = null;

    const pengamatUkuran =
      new ResizeObserver(
        perbaruiPosisi
      );

    function cariSidebar() {
      return document.querySelector(
        "#sidebarContainer aside, " +
        "#sidebarContainer .sidebar, " +
        "#sidebarContainer .app-sidebar, " +
        "aside.sidebar, " +
        "#sidebar"
      );
    }

    function perbaruiPosisi() {
      const sidebar =
        cariSidebar();

      if (!sidebar) {
        return;
      }

      if (
        sidebarTerpantau !==
        sidebar
      ) {
        if (
          sidebarTerpantau
        ) {
          pengamatUkuran.unobserve(
            sidebarTerpantau
          );
        }

        sidebarTerpantau =
          sidebar;

        pengamatUkuran.observe(
          sidebar
        );
      }

      const posisi =
        sidebar.getBoundingClientRect();

      const lebarSidebar =
        Math.max(
          0,
          Math.min(
            posisi.right,
            window.innerWidth
          ) -
          Math.max(
            posisi.left,
            0
          )
        );

      document.documentElement.style
        .setProperty(
          "--lebar-sidebar-pendapatan",
          `${Math.round(lebarSidebar)}px`
        );
    }

    const pengamatSidebar =
      new MutationObserver(() => {
        requestAnimationFrame(
          perbaruiPosisi
        );
      });

    pengamatSidebar.observe(
      document.body,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style"
        ]
      }
    );

    window.addEventListener(
      "resize",
      perbaruiPosisi
    );

    document.addEventListener(
      "transitionend",
      perbaruiPosisi
    );

    perbaruiPosisi();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initPosisiPendapatan,
      { once: true }
    );
  } else {
    initPosisiPendapatan();
  }
})();
