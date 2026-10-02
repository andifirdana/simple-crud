"use strict";

// ======================================================
// DATA, PAGINATION, DAN PARAMETER DASHBOARD
// ======================================================

let allProyek = [];
let currentPage = 1;

const itemsPerPage = 15;

const proyekUrlParams =
  new URLSearchParams(
    window.location.search
  );

const urlDashboardGroup =
  String(
    proyekUrlParams.get(
      "dashboard_group"
    ) || ""
  )
    .trim()
    .toLowerCase();

const urlStatusPengadaan =
  String(
    proyekUrlParams.get(
      "status_pengadaan"
    ) || ""
  ).trim();

const urlStatusFinal =
  String(
    proyekUrlParams.get(
      "status_final"
    ) || ""
  ).trim();

const urlJenisProyek =
  String(
    proyekUrlParams.get(
      "jenis_proyek"
    ) || ""
  ).trim();

const urlPicIdInput =
  Number(
    proyekUrlParams.get(
      "pic_id"
    )
  );

const urlPicId =
  Number.isInteger(
    urlPicIdInput
  ) &&
  urlPicIdInput > 0
    ? urlPicIdInput
    : null;

const urlTahunInput =
  Number(
    proyekUrlParams.get(
      "tahun"
    )
  );

const urlTahun =
  Number.isInteger(
    urlTahunInput
  ) &&
  urlTahunInput >= 2020 &&
  urlTahunInput <= 2100
    ? urlTahunInput
    : new Date().getFullYear();

const urlPeriodeKontrak =
  String(
    proyekUrlParams.get(
      "periode_kontrak"
    ) || ""
  )
    .trim()
    .toLowerCase();

const urlTanggalAkhir =
  String(
    proyekUrlParams.get(
      "tanggal_akhir"
    ) || ""
  )
    .trim()
    .toLowerCase();

const urlKontrak =
  String(
    proyekUrlParams.get(
      "kontrak"
    ) || ""
  )
    .trim()
    .toLowerCase();

const urlProyekTerlambat =
  String(
    proyekUrlParams.get(
      "terlambat"
    ) || ""
  ).trim();

const urlStatusTeknisExclude =
  String(
    proyekUrlParams.get(
      "status_teknis_exclude"
    ) || ""
  )
    .split(",")
    .map(value =>
      value
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);


// ======================================================
// ELEMENT HTML
// ======================================================

const proyekTable =
  document.getElementById(
    "proyekTable"
  );

const searchInput =
  document.getElementById(
    "searchInput"
  );

const kategoriFilter =
  document.getElementById(
    "kategoriFilter"
  );

const jenisFilter =
  document.getElementById(
    "jenisFilter"
  );

const klienFilter =
  document.getElementById(
    "klienFilter"
  );

const partnerFilter =
  document.getElementById(
    "partnerFilter"
  );

const paginationContainer =
  document.getElementById(
    "pagination"
  );


// ======================================================
// HELPER FORMAT
// ======================================================

function escapeHTML(value) {
  return String(value ?? "")
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


function formatRupiah(value) {
  const number =
    Number(value) || 0;

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(number);
}


function formatTanggal(value) {
  if (!value) {
    return "-";
  }

  const text =
    String(value).slice(
      0,
      10
    );

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
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


function normalisasiFilter(value) {
  return String(value || "")
    .trim()
    .replace(
      /\s+/g,
      " "
    )
    .toLowerCase();
}


// ======================================================
// HELPER DATA PROYEK
// ======================================================

function dapatkanNamaPic(item) {
  const namaPic =
    String(
      item?.nama_pic || ""
    ).trim();

  if (namaPic) {
    return namaPic;
  }

  if (
    Array.isArray(
      item?.nama_pic_list
    ) &&
    item.nama_pic_list.length > 0
  ) {
    return item.nama_pic_list
      .map(nama =>
        String(
          nama || ""
        ).trim()
      )
      .filter(Boolean)
      .join(", ");
  }

  return "Belum ditentukan";
}


function dapatkanPicIds(item) {
  const sumber =
    item?.pic_ids ??
    item?.pic_id ??
    [];

  if (Array.isArray(sumber)) {
    return sumber
      .map(Number)
      .filter(value =>
        Number.isInteger(value) &&
        value > 0
      );
  }

  return String(sumber || "")
    .replace(
      /[{}[\]]/g,
      ""
    )
    .split(",")
    .map(value =>
      Number(
        String(value).trim()
      )
    )
    .filter(value =>
      Number.isInteger(value) &&
      value > 0
    );
}


function listValue(
  item,
  arrayKey,
  textKey
) {
  if (
    Array.isArray(
      item?.[arrayKey]
    )
  ) {
    return item[arrayKey]
      .map(value =>
        String(
          value || ""
        ).trim()
      )
      .filter(Boolean);
  }

  return String(
    item?.[textKey] || ""
  )
    .split(",")
    .map(value =>
      value.trim()
    )
    .filter(Boolean);
}


function finalValue(
  item,
  prefix
) {
  const directValue =
    item?.[
      `nilai_final_${prefix}`
    ];

  if (
    directValue !== null &&
    directValue !== undefined &&
    directValue !== ""
  ) {
    const number =
      Number(directValue);

    if (
      Number.isFinite(number)
    ) {
      return number;
    }
  }

  const nilaiKeys = [
    `nilai_nego_3_${prefix}`,
    `nilai_nego_2_${prefix}`,
    `nilai_nego_1_${prefix}`,
    `nilai_submit_${prefix}`
  ];

  for (
    const key
    of nilaiKeys
  ) {
    const value =
      Number(item?.[key]);

    if (
      Number.isFinite(value) &&
      value > 0
    ) {
      return value;
    }
  }

  return 0;
}


function projectValue(item) {
  const finalKlien =
    finalValue(
      item,
      "klien"
    );

  if (finalKlien > 0) {
    return finalKlien;
  }

  return Number(
    item?.nilai_proyek
  ) || 0;
}


function partnerValue(item) {
  const directValue =
    item?.nilai_final_partner ??
    item?.nilai_partner;

  const number =
    Number(directValue);

  return Number.isFinite(number)
    ? number
    : 0;
}


function getKategoriProyek(item) {
  const sumberKategori =
    item?.nama_kategori_produk_list ??
    item?.kategori ??
    item?.nama_kategori_produk ??
    item?.kategori_proyek ??
    [];

  let kategoriList = [];

  if (
    Array.isArray(
      sumberKategori
    )
  ) {
    kategoriList =
      sumberKategori.map(
        kategori => {
          if (
            typeof kategori ===
            "string"
          ) {
            return kategori.trim();
          }

          return String(
            kategori
              ?.nama_kategori_produk ||
            kategori?.nama ||
            ""
          ).trim();
        }
      );

  } else {
    kategoriList =
      String(
        sumberKategori || ""
      )
        .split(",")
        .map(kategori =>
          kategori.trim()
        );
  }

  kategoriList =
    kategoriList.filter(
      Boolean
    );

  return kategoriList.length > 0
    ? kategoriList.join(", ")
    : "Tanpa Kategori";
}


function getStatusPengadaan(item) {
  return String(
    item?.status_pengadaan ??
    item?.status_pengadaan_klien ??
    item?.klien_status_pengadaan ??
    ""
  ).trim();
}


function getStatusTeknis(item) {
  return String(
    item?.status_teknis ??
    item?.status_teknis_klien ??
    item?.klien_status_teknis ??
    ""
  ).trim();
}


function getTanggalMulaiKlien(
  item
) {
  return (
    item?.tanggal_mulai_klien ??
    item?.tanggal_mulai_kontrak ??
    item?.klien_tanggal_mulai ??
    item?.tanggal_mulai ??
    null
  );
}


function getTanggalAkhirKlien(
  item
) {
  return (
    item?.tanggal_akhir_klien ??
    item?.tanggal_akhir_kontrak ??
    item?.klien_tanggal_akhir ??
    item?.tanggal_akhir ??
    item?.end_date ??
    null
  );
}


// ======================================================
// HELPER TANGGAL DAN KONTRAK
// ======================================================

function tanggalLokal(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value).slice(
      0,
      10
    );

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {
    const [
      tahun,
      bulan,
      tanggal
    ] = text
      .split("-")
      .map(Number);

    const hasil =
      new Date(
        tahun,
        bulan - 1,
        tanggal
      );

    hasil.setHours(
      0,
      0,
      0,
      0
    );

    return hasil;
  }

  const hasil =
    new Date(value);

  if (
    Number.isNaN(
      hasil.getTime()
    )
  ) {
    return null;
  }

  hasil.setHours(
    0,
    0,
    0,
    0
  );

  return hasil;
}


function isKontrakMasukTahun(
  item,
  tahun
) {
  const tanggalMulai =
    tanggalLokal(
      getTanggalMulaiKlien(
        item
      )
    );

  const tanggalAkhir =
    tanggalLokal(
      getTanggalAkhirKlien(
        item
      )
    );

  if (
    !tanggalMulai ||
    !tanggalAkhir
  ) {
    return false;
  }

  const awalTahun =
    new Date(
      tahun,
      0,
      1
    );

  const awalTahunBerikutnya =
    new Date(
      tahun + 1,
      0,
      1
    );

  return (
    tanggalMulai <
      awalTahunBerikutnya &&

    tanggalAkhir >=
      awalTahun
  );
}


function isTanggalAkhirExpired(
  item
) {
  const tanggalAkhir =
    tanggalLokal(
      getTanggalAkhirKlien(
        item
      )
    );

  if (!tanggalAkhir) {
    return false;
  }

  const hariIni =
    new Date();

  hariIni.setHours(
    0,
    0,
    0,
    0
  );

  return (
    tanggalAkhir <
    hariIni
  );
}


// ======================================================
// KETENTUAN PROJECT OVERVIEW
// ======================================================

function isProyekTerlambat(
  item
) {
  const statusFinal =
    normalisasiFilter(
      item?.status_final
    );

  const statusPengadaan =
    normalisasiFilter(
      getStatusPengadaan(
        item
      )
    );

  const statusTeknis =
    normalisasiFilter(
      getStatusTeknis(
        item
      )
    );

  return (
    statusFinal ===
      "aktif" &&

    statusPengadaan ===
      "done" &&

    isTanggalAkhirExpired(
      item
    ) &&

    ![
      "done",
      "selesai"
    ].includes(
      statusTeknis
    )
  );
}


function isProsesPengadaan(
  item
) {
  const statusFinal =
    normalisasiFilter(
      item?.status_final
    );

  const statusPengadaan =
    normalisasiFilter(
      getStatusPengadaan(
        item
      )
    );

  return (
    statusFinal ===
      "aktif" &&

    (
      (
        statusPengadaan.includes(
          "submit"
        ) &&

        statusPengadaan.includes(
          "pengadaan"
        )
      ) ||

      statusPengadaan.includes(
        "negosiasi"
      ) ||

      statusPengadaan.includes(
        "nego"
      )
    )
  );
}


function isTotalProjectOverview(
  item
) {
  const statusFinal =
    normalisasiFilter(
      item?.status_final
    );

  const statusPengadaan =
    normalisasiFilter(
      getStatusPengadaan(
        item
      )
    );

  const pipeline =
    statusFinal === "aktif" &&

    statusPengadaan.includes(
      "pipeline"
    );

  const submitPenawaran =
    statusFinal === "aktif" &&

    statusPengadaan.includes(
      "submit penawaran"
    );

  const prosesPengadaan =
    isProsesPengadaan(
      item
    );

  const prosesKontrak =
    statusFinal === "aktif" &&

    (
      (
        statusPengadaan.includes(
          "proses"
        ) &&

        statusPengadaan.includes(
          "kontrak"
        )
      ) ||

      statusPengadaan ===
        "kontrak"
    );

  const proyekAktif =
    statusFinal === "aktif" &&

    statusPengadaan ===
      "done" &&

    isKontrakMasukTahun(
      item,
      urlTahun
    );

  const proyekSelesai =
    [
      "done",
      "selesai"
    ].includes(
      statusFinal
    ) &&

    isKontrakMasukTahun(
      item,
      urlTahun
    );

  const proyekTerlambat =
    isProyekTerlambat(
      item
    );

  return (
    pipeline ||
    submitPenawaran ||
    prosesPengadaan ||
    prosesKontrak ||
    proyekAktif ||
    proyekSelesai ||
    proyekTerlambat
  );
}


function filterTerlambatDariUrl() {
  return (
    urlProyekTerlambat ===
      "1" ||

    urlKontrak ===
      "proyek-terlambat"
  );
}


// ======================================================
// FILTER DROPDOWN
// ======================================================

function populateFilter(
  select,
  values,
  placeholder
) {
  if (!select) {
    return;
  }

  const previousValue =
    select.value;

  const uniqueValues = [
    ...new Set(
      values
        .map(value =>
          String(
            value || ""
          ).trim()
        )
        .filter(Boolean)
    )
  ].sort(
    (first, second) =>
      first.localeCompare(
        second,
        "id"
      )
  );

  select.replaceChildren(
    new Option(
      placeholder,
      ""
    )
  );

  uniqueValues.forEach(
    value => {
      select.add(
        new Option(
          value,
          value
        )
      );
    }
  );

  const previousStillExists =
    uniqueValues.some(
      value =>
        value === previousValue
    );

  select.value =
    previousStillExists
      ? previousValue
      : "";
}


function buildFilters() {
  populateFilter(
    kategoriFilter,

    allProyek.flatMap(
      item =>
        listValue(
          item,
          "nama_kategori_produk_list",
          "nama_kategori_produk"
        )
    ),

    "Semua Kategori"
  );

  populateFilter(
    jenisFilter,

    allProyek.map(
      item =>
        item?.jenis_proyek
    ),

    "Semua Jenis Proyek"
  );

  populateFilter(
    klienFilter,

    allProyek.map(
      item =>
        item?.perusahaan_klien
    ),

    "Semua Klien"
  );

  populateFilter(
    partnerFilter,

    allProyek.flatMap(
      item =>
        listValue(
          item,
          "nama_partner_list",
          "nama_partner"
        )
    ),

    "Semua Partner"
  );
}


function terapkanFilterUrlKeForm() {
  if (
    !jenisFilter ||
    !urlJenisProyek
  ) {
    return;
  }

  const jenisNormal =
    normalisasiFilter(
      urlJenisProyek
    );

  const optionCocok = [
    ...jenisFilter.options
  ].find(
    option =>
      normalisasiFilter(
        option.value
      ) === jenisNormal
  );

  if (optionCocok) {
    jenisFilter.value =
      optionCocok.value;
  }
}


// ======================================================
// FILTER DATA
// ======================================================

function applyFilter() {
  const search =
    String(
      searchInput?.value || ""
    )
      .trim()
      .toLowerCase();

  const selectedKategori =
    kategoriFilter?.value || "";

  const selectedJenis =
    jenisFilter?.value || "";

  const selectedKlien =
    klienFilter?.value || "";

  const selectedPartner =
    partnerFilter?.value || "";

  const statusPengadaanUrl =
    normalisasiFilter(
      urlStatusPengadaan
    );

  const statusFinalUrl =
    normalisasiFilter(
      urlStatusFinal
    );

  const filtered =
    allProyek.filter(
      item => {
        const namaProyek =
          String(
            item?.nama_proyek || ""
          );

        const perusahaanKlien =
          String(
            item?.perusahaan_klien ||
            ""
          );

        const categories =
          listValue(
            item,
            "nama_kategori_produk_list",
            "nama_kategori_produk"
          );

        const partners =
          listValue(
            item,
            "nama_partner_list",
            "nama_partner"
          );

        const statusPengadaan =
          normalisasiFilter(
            getStatusPengadaan(
              item
            )
          );

        const statusFinal =
          normalisasiFilter(
            item?.status_final
          );

        const statusTeknis =
          normalisasiFilter(
            getStatusTeknis(
              item
            )
          );

        const itemPicIds =
          dapatkanPicIds(
            item
          );

        const searchText = [
          namaProyek,
          perusahaanKlien,
          categories.join(" "),
          partners.join(" "),
          dapatkanNamaPic(item),
          statusPengadaan,
          statusTeknis,
          statusFinal
        ]
          .join(" ")
          .toLowerCase();

        const matchSearch =
          !search ||

          searchText.includes(
            search
          );

        const matchKategori =
          !selectedKategori ||

          categories.includes(
            selectedKategori
          );

        const matchJenis =
          !selectedJenis ||

          normalisasiFilter(
            item?.jenis_proyek
          ) ===
          normalisasiFilter(
            selectedJenis
          );

        const matchKlien =
          !selectedKlien ||

          perusahaanKlien ===
            selectedKlien;

        const matchPartner =
          !selectedPartner ||

          partners.includes(
            selectedPartner
          );

        /*
         * API juga menerima pic_id.
         * Pemeriksaan ini digunakan jika
         * API mengirim pic_ids pada baris.
         */
        const matchPic =
          urlPicId === null ||

          itemPicIds.length === 0 ||

          itemPicIds.includes(
            urlPicId
          );

        const matchStatusPengadaan =
          !statusPengadaanUrl ||

          statusPengadaan.includes(
            statusPengadaanUrl
          );

        const matchStatusFinal =
          !statusFinalUrl ||

          statusFinal ===
            statusFinalUrl;

        const matchPeriodeKontrak =
          urlPeriodeKontrak !==
            "tahun" ||

          isKontrakMasukTahun(
            item,
            urlTahun
          );

        const matchTanggalAkhir =
          urlTanggalAkhir !==
            "expired" ||

          isTanggalAkhirExpired(
            item
          );

        const matchStatusTeknis =
          urlStatusTeknisExclude
            .length === 0 ||

          !urlStatusTeknisExclude
            .includes(
              statusTeknis
            );

        const matchTerlambat =
          !filterTerlambatDariUrl() ||

          isProyekTerlambat(
            item
          );

        let matchDashboardGroup =
          true;

        if (
          urlDashboardGroup ===
          "total-project"
        ) {
          matchDashboardGroup =
            isTotalProjectOverview(
              item
            );

        } else if (
          urlDashboardGroup ===
          "proses-pengadaan"
        ) {
          matchDashboardGroup =
            isProsesPengadaan(
              item
            );
        }

        return (
          matchSearch &&
          matchKategori &&
          matchJenis &&
          matchKlien &&
          matchPartner &&
          matchPic &&
          matchStatusPengadaan &&
          matchStatusFinal &&
          matchPeriodeKontrak &&
          matchTanggalAkhir &&
          matchStatusTeknis &&
          matchTerlambat &&
          matchDashboardGroup
        );
      }
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
        itemsPerPage
      )
    );

  currentPage =
    Math.min(
      Math.max(
        currentPage,
        1
      ),
      totalPages
    );

  const startIndex =
    (
      currentPage - 1
    ) *
    itemsPerPage;

  const pageData =
    filtered.slice(
      startIndex,
      startIndex +
      itemsPerPage
    );

  renderTable(
    pageData
  );

  renderPagination(
    filtered.length
  );

  showActiveDashboardFilter(
    filtered.length
  );
}


// ======================================================
// BANNER FILTER DASHBOARD
// ======================================================

function showActiveDashboardFilter(
  totalData
) {
  let banner =
    document.getElementById(
      "dashboardFilterBanner"
    );

  const activeText = [];

  if (
    urlDashboardGroup ===
    "total-project"
  ) {
    activeText.push(
      "Gabungan Seluruh Card Project Overview"
    );

    activeText.push(
      `Tahun Laporan: ${urlTahun}`
    );
  }

  if (
    urlDashboardGroup ===
    "proses-pengadaan"
  ) {
    activeText.push(
      "Proses Pengadaan: Submit Pengadaan dan Negosiasi"
    );
  }

  if (urlJenisProyek) {
    activeText.push(
      `Jenis Proyek: ${urlJenisProyek}`
    );
  }

  if (urlPicId !== null) {
    const proyekPic =
      allProyek.find(
        item =>
          dapatkanPicIds(item)
            .includes(urlPicId)
      );

    const namaPic =
      proyekPic
        ? dapatkanNamaPic(
            proyekPic
          )
        : "";

    activeText.push(
      namaPic &&
      namaPic !==
        "Belum ditentukan"
        ? `PIC: ${namaPic}`
        : `PIC ID: ${urlPicId}`
    );
  }

  if (urlStatusPengadaan) {
    activeText.push(
      `Status Pengadaan: ${urlStatusPengadaan}`
    );
  }

  if (urlStatusFinal) {
    activeText.push(
      `Status Final: ${urlStatusFinal}`
    );
  }

  if (
    urlPeriodeKontrak ===
    "tahun"
  ) {
    activeText.push(
      `Periode Kontrak: ${urlTahun}`
    );
  }

  if (
    urlTanggalAkhir ===
    "expired"
  ) {
    activeText.push(
      "Tanggal Akhir: Telah Berakhir"
    );
  }

  if (
    urlStatusTeknisExclude
      .length > 0
  ) {
    activeText.push(
      `Status Teknis selain: ${urlStatusTeknisExclude.join(
        ", "
      )}`
    );
  }

  if (
    filterTerlambatDariUrl()
  ) {
    activeText.push(
      "Proyek Terlambat"
    );
  }

  if (
    activeText.length === 0
  ) {
    banner?.remove();
    return;
  }

  if (!banner) {
    banner =
      document.createElement(
        "div"
      );

    banner.id =
      "dashboardFilterBanner";

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
      proyekTable?.closest(
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

  banner.innerHTML = `
    <span>
      Filter aktif:
      ${escapeHTML(
        activeText.join(" • ")
      )}
      —
      ${Number(
        totalData || 0
      ).toLocaleString(
        "id-ID"
      )}
      proyek ditemukan
    </span>

    <a
      href="/proyek.html"
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


// ======================================================
// RENDER TABEL
// ======================================================

function renderTable(data) {
  if (!proyekTable) {
    return;
  }

  if (!data.length) {
    proyekTable.innerHTML = `
      <tr>
        <td
          colspan="12"
          class="empty-state"
        >
          Belum ada proyek yang sesuai.
        </td>
      </tr>
    `;

    return;
  }

  proyekTable.innerHTML =
    data
      .map(item => {
        const kategoriText =
          getKategoriProyek(
            item
          );

        const partners =
          listValue(
            item,
            "nama_partner_list",
            "nama_partner"
          );

        const partnerText =
          partners.length
            ? partners
                .map(escapeHTML)
                .join(", ")
            : "-";

        const nilaiProyek =
          projectValue(item);

        const nilaiPartner =
          partnerValue(item);

        const marginNominal =
          nilaiProyek -
          nilaiPartner;

        const marginPersen =
          nilaiProyek > 0
            ? (
                marginNominal /
                nilaiProyek
              ) * 100
            : 0;

        const status =
          item?.status_final ||
          "-";

        const statusKey =
          normalisasiFilter(
            status
          );

        let statusClass =
          "badge-aktif";

        if (
          [
            "done",
            "selesai"
          ].includes(
            statusKey
          )
        ) {
          statusClass =
            "badge-done";

        } else if (
          [
            "cancel",
            "batal"
          ].includes(
            statusKey
          )
        ) {
          statusClass =
            "badge-cancel";
        }

        const jenisUtama =
          escapeHTML(
            item?.jenis_proyek ||
            "-"
          );

        const jenisText =
          item?.sub_jenis_proyek
            ? `
              ${jenisUtama}

              <div class="sub-text">
                ${escapeHTML(
                  item.sub_jenis_proyek
                )}
              </div>
            `
            : jenisUtama;

        const endDate =
          getTanggalAkhirKlien(
            item
          );

        return `
          <tr>
            <td class="proyek-info-cell">
              <div class="proyek-main-name">
                ${escapeHTML(
                  item?.nama_proyek ||
                  "-"
                )}
              </div>

              <div class="proyek-category-name">
                ${escapeHTML(
                  kategoriText
                )}
              </div>
            </td>

            <td>
              ${jenisText}
            </td>

            <td>
              ${escapeHTML(
                dapatkanNamaPic(
                  item
                )
              )}
            </td>

            <td>
              ${escapeHTML(
                item
                  ?.perusahaan_klien ||
                "-"
              )}
            </td>

            <td>
              ${partnerText}
            </td>

            <td class="money">
              ${formatRupiah(
                nilaiProyek
              )}
            </td>

            <td class="money">
              ${formatRupiah(
                nilaiPartner
              )}
            </td>

            <td class="money">
              ${formatRupiah(
                marginNominal
              )}
            </td>

            <td class="money">
              ${marginPersen
                .toFixed(2)}%
            </td>

            <td>
              ${formatTanggal(
                endDate
              )}
            </td>

            <td>
              <span
                class="
                  badge
                  ${statusClass}
                "
              >
                ${escapeHTML(
                  status
                )}
              </span>
            </td>

            <td>
              <div class="table-actions">
                <a
                  class="btn-detail"
                  href="/detail-proyek.html?id=${encodeURIComponent(
                    item?.id
                  )}"
                >
                  Detail
                </a>

                <button
                  type="button"
                  class="btn-delete-project"
                  data-delete-project
                  data-project-id="${Number(
                    item?.id
                  )}"
                  data-project-name="${escapeHTML(
                    item?.nama_proyek ||
                    "Proyek"
                  )}"
                >
                  Hapus
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
}


// ======================================================
// PAGINATION
// ======================================================

function renderPagination(
  totalItems
) {
  if (!paginationContainer) {
    return;
  }

  const totalPages =
    Math.ceil(
      totalItems /
      itemsPerPage
    );

  if (totalPages <= 1) {
    paginationContainer.innerHTML =
      "";

    return;
  }

  paginationContainer.innerHTML =
    Array.from(
      {
        length: totalPages
      },
      (_, index) =>
        index + 1
    )
      .map(
        page => `
          <button
            type="button"
            class="
              pagination-button
              ${
                page === currentPage
                  ? "active"
                  : ""
              }
            "
            data-page="${page}"
          >
            ${page}
          </button>
        `
      )
      .join("");
}


paginationContainer
  ?.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-page]"
        );

      if (!button) {
        return;
      }

      currentPage =
        Number(
          button.dataset.page
        ) || 1;

      applyFilter();
    }
  );


// ======================================================
// LOAD DATA PROYEK
// ======================================================

async function loadProyek() {
  if (!proyekTable) {
    return;
  }

  try {
    proyekTable.innerHTML = `
      <tr>
        <td
          colspan="12"
          class="empty-state"
        >
          Memuat proyek...
        </td>
      </tr>
    `;

    const apiParams =
      new URLSearchParams();

    if (urlJenisProyek) {
      apiParams.set(
        "jenis_proyek",
        urlJenisProyek
      );
    }

    if (urlPicId !== null) {
      apiParams.set(
        "pic_id",
        String(urlPicId)
      );
    }

    const apiQuery =
      apiParams.toString();

    const apiUrl =
      apiQuery
        ? `/api/proyek-listing?${apiQuery}`
        : "/api/proyek-listing";

    const response =
      await fetch(
        apiUrl,
        {
          headers: {
            Accept:
              "application/json"
          },

          credentials:
            "same-origin",

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
        `Server tidak mengembalikan JSON: ${text}`
      );
    }

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil proyek"
      );
    }

    allProyek =
      Array.isArray(result)
        ? result
        : Array.isArray(
            result?.data
          )
          ? result.data
          : [];

    buildFilters();

    terapkanFilterUrlKeForm();

    applyFilter();

  } catch (error) {
    console.error(
      "ERROR LOAD PROYEK:",
      error
    );

    proyekTable.innerHTML = `
      <tr>
        <td
          colspan="12"
          class="empty-state"
        >
          Gagal mengambil data proyek:
          ${escapeHTML(
            error.message
          )}
        </td>
      </tr>
    `;
  }
}


// ======================================================
// EVENT FILTER
// ======================================================

[
  searchInput,
  kategoriFilter,
  jenisFilter,
  klienFilter,
  partnerFilter
]
  .filter(Boolean)
  .forEach(element => {
    const eventName =
      element === searchInput
        ? "input"
        : "change";

    element.addEventListener(
      eventName,
      () => {
        currentPage = 1;
        applyFilter();
      }
    );
  });


// ======================================================
// HAPUS PROYEK
// ======================================================

proyekTable
  ?.addEventListener(
    "click",
    async event => {
      const deleteButton =
        event.target.closest(
          "[data-delete-project]"
        );

      if (!deleteButton) {
        return;
      }

      const proyekId =
        Number(
          deleteButton
            .dataset
            .projectId
        );

      const namaProyek =
        deleteButton
          .dataset
          .projectName ||
        "Proyek";

      if (
        !Number.isInteger(
          proyekId
        ) ||
        proyekId <= 0
      ) {
        window.alert(
          "ID proyek tidak valid."
        );

        return;
      }

      const konfirmasi =
        window.confirm(
          `Apakah Anda yakin ingin menghapus proyek "${namaProyek}"?\n\n` +
          "Data proyek dan seluruh data terkait dapat ikut terhapus."
        );

      if (!konfirmasi) {
        return;
      }

      const verifikasi =
        window.prompt(
          `Ketik HAPUS untuk menghapus proyek "${namaProyek}".`
        );

      if (
        String(
          verifikasi || ""
        )
          .trim()
          .toUpperCase() !==
        "HAPUS"
      ) {
        window.alert(
          "Penghapusan proyek dibatalkan."
        );

        return;
      }

      const textSebelumnya =
        deleteButton.textContent;

      deleteButton.disabled =
        true;

      deleteButton.textContent =
        "Menghapus...";

      try {
        const response =
          await fetch(
            `/api/proyek/${encodeURIComponent(
              proyekId
            )}`,
            {
              method: "DELETE",

              headers: {
                Accept:
                  "application/json"
              },

              credentials:
                "same-origin"
            }
          );

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

          throw new Error(
            responseText ||
            `Server menghasilkan status ${response.status}`
          );
        }

        const result =
          await response.json();

        if (!response.ok) {
          let pesanError =
            result.error ||
            "Gagal menghapus proyek.";

          if (
            result.constraint
          ) {
            pesanError +=
              `\n\nConstraint: ${result.constraint}`;
          }

          if (result.detail) {
            pesanError +=
              `\n${result.detail}`;
          }

          throw new Error(
            pesanError
          );
        }

        window.alert(
          result.message ||
          "Proyek berhasil dihapus."
        );

        currentPage = 1;

        await loadProyek();

      } catch (error) {
        console.error(
          "ERROR HAPUS PROYEK:",
          error
        );

        window.alert(
          `Gagal menghapus proyek:\n${error.message}`
        );

        deleteButton.disabled =
          false;

        deleteButton.textContent =
          textSebelumnya;
      }
    }
  );


// ======================================================
// START
// ======================================================

loadProyek();