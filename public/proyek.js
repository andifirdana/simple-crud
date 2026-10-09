 "use strict";

// ======================================================
// HELPER FILTER DASHBOARD DAN PROYEK
// ======================================================

const proyekFilterHelpers = (function () {
  const text = value =>
    String(value ?? "").trim();

  const normalisasiFilter = value =>
    text(value)
      .replace(/\s+/g, " ")
      .toLowerCase();

  const positif = value => {
    const number = Number(value);

    return Number.isInteger(number) && number > 0
      ? number
      : null;
  };

  const parameterKeys = [
    "search",
    "kategori",
    "jenis_proyek",
    "klien",
    "partner",
    "status_final",
    "pic_id",
    "dashboard_group",
    "status_pengadaan",
    "tahun",
    "periode_kontrak",
    "tanggal_akhir",
    "status_teknis_exclude",
    "terlambat",
    "kontrak"
  ];

  function normalize(filters = {}) {
    const tahun = Number(filters.tahun);

    const excludes =
      Array.isArray(filters.status_teknis_exclude)
        ? filters.status_teknis_exclude
        : text(filters.status_teknis_exclude).split(",");

    return {
      search: text(filters.search),

      kategori: text(filters.kategori),

      jenis_proyek: text(filters.jenis_proyek),

      klien: text(filters.klien),

      partner: text(filters.partner),

      status_final: text(filters.status_final),

      pic_id: positif(filters.pic_id),

      dashboard_group:
        normalisasiFilter(filters.dashboard_group),

      status_pengadaan:
        text(filters.status_pengadaan),

      tahun:
        Number.isInteger(tahun) &&
        tahun >= 2020 &&
        tahun <= 2100
          ? tahun
          : new Date().getFullYear(),

      periode_kontrak:
        normalisasiFilter(filters.periode_kontrak),

      tanggal_akhir:
        normalisasiFilter(filters.tanggal_akhir),

      status_teknis_exclude: [
        ...new Set(
          excludes
            .map(normalisasiFilter)
            .filter(Boolean)
        )
      ],

      terlambat:
        filters.terlambat === true ||
        String(filters.terlambat) === "1" ||
        normalisasiFilter(filters.kontrak) ===
          "proyek-terlambat"
    };
  }

  function fromUrl(query = "") {
    const params =
      query instanceof URLSearchParams
        ? query
        : new URLSearchParams(query);

    return normalize(
      Object.fromEntries(params.entries())
    );
  }

  function toSearchParams(filters = {}) {
    const state = normalize(filters);

    const params = new URLSearchParams();

    for (const key of parameterKeys) {
      if (
        key === "tahun" ||
        key === "kontrak"
      ) {
        continue;
      }

      const value = state[key];

      if (key === "terlambat") {
        if (value) {
          params.set(key, "1");
        }

      } else if (Array.isArray(value)) {
        if (value.length > 0) {
          params.set(
            key,
            value.join(",")
          );
        }

      } else if (
        value !== "" &&
        value !== null &&
        value !== undefined
      ) {
        params.set(
          key,
          String(value)
        );
      }
    }

    if (
      state.dashboard_group === "total-project" ||
      state.periode_kontrak === "tahun"
    ) {
      params.set(
        "tahun",
        String(state.tahun)
      );
    }

    return params;
  }

  function getPicIds(item) {
    const source =
      item?.pic_ids ??
      item?.pic_id ??
      [];

    const ids =
      Array.isArray(source)
        ? source
        : text(source)
            .replace(/[{}\[\]"]/g, "")
            .split(",");

    const listed =
      Array.isArray(item?.pic_list)
        ? item.pic_list.map(pic => pic?.id)
        : [];

    return [
      ...new Set(
        [...ids, ...listed]
          .map(positif)
          .filter(id => id !== null)
      )
    ];
  }

  function listValue(
    item,
    arrayKey,
    textKey
  ) {
    const source = item?.[arrayKey];

    const values =
      Array.isArray(source) && source.length > 0
        ? source
        : text(item?.[textKey]).split(",");

    return values
      .map(text)
      .filter(Boolean);
  }

  function getCategories(item) {
    const source =
      item?.nama_kategori_produk_list ??
      item?.kategori ??
      item?.nama_kategori_produk ??
      item?.kategori_proyek ??
      [];

    const values =
      Array.isArray(source)
        ? source
        : text(source).split(",");

    return values
      .map(value => {
        if (
          typeof value === "object" &&
          value !== null
        ) {
          return text(
            value.nama_kategori_produk ??
            value.nama
          );
        }

        return text(value);
      })
      .filter(Boolean);
  }

  function getPicName(item) {
    const names = listValue(
      item,
      "nama_pic_list",
      "nama_pic"
    );

    if (names.length > 0) {
      return names.join(", ");
    }

    const picList =
      Array.isArray(item?.pic_list)
        ? item.pic_list
        : [];

    return (
      picList
        .map(pic => text(pic?.nama))
        .filter(Boolean)
        .join(", ") ||
      "Belum ditentukan"
    );
  }

  function getStatusPengadaan(item) {
    return text(
      item?.status_pengadaan ??
      item?.status_pengadaan_klien ??
      item?.klien_status_pengadaan
    );
  }

  function getStatusTeknis(item) {
    return text(
      item?.status_teknis ??
      item?.status_teknis_klien ??
      item?.klien_status_teknis
    );
  }

  function getTanggalMulaiKlien(item) {
    return (
      item?.tanggal_mulai_klien ??
      item?.tanggal_mulai_kontrak ??
      item?.klien_tanggal_mulai ??
      item?.tanggal_mulai ??
      null
    );
  }

  function getTanggalAkhirKlien(item) {
    return (
      item?.tanggal_akhir_klien ??
      item?.tanggal_akhir_kontrak ??
      item?.klien_tanggal_akhir ??
      item?.tanggal_akhir ??
      item?.end_date ??
      null
    );
  }

  function tanggalLokal(value) {
    if (!value) {
      return null;
    }

    const input =
      String(value).slice(0, 10);

    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [
        year,
        month,
        day
      ] = input
        .split("-")
        .map(Number);

      const date = new Date(
        year,
        month - 1,
        day
      );

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }

      return date;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setHours(0, 0, 0, 0);

    return date;
  }

  function isKontrakMasukTahun(
    item,
    tahun
  ) {
    const start = tanggalLokal(
      getTanggalMulaiKlien(item)
    );

    const end = tanggalLokal(
      getTanggalAkhirKlien(item)
    );

    return Boolean(
      start &&
      end &&
      start <= end &&
      start < new Date(tahun + 1, 0, 1) &&
      end >= new Date(tahun, 0, 1)
    );
  }

  function isTanggalAkhirExpired(
    item,
    today = new Date()
  ) {
    const end = tanggalLokal(
      getTanggalAkhirKlien(item)
    );

    const day = tanggalLokal(today);

    return Boolean(
      end &&
      day &&
      end < day
    );
  }

  function isProyekTerlambat(
    item,
    today = new Date()
  ) {
    const statusFinal =
      normalisasiFilter(item?.status_final);

    const statusPengadaan =
      normalisasiFilter(
        getStatusPengadaan(item)
      );

    const statusTeknis =
      normalisasiFilter(
        getStatusTeknis(item)
      );

    return (
      statusFinal === "aktif" &&
      statusPengadaan === "done" &&
      isTanggalAkhirExpired(item, today) &&
      !["done", "selesai"].includes(statusTeknis)
    );
  }

  function isProsesPengadaan(item) {
    const statusFinal =
      normalisasiFilter(item?.status_final);

    const statusPengadaan =
      normalisasiFilter(
        getStatusPengadaan(item)
      );

    return (
      statusFinal === "aktif" &&
      (
        (
          statusPengadaan.includes("submit") &&
          statusPengadaan.includes("pengadaan")
        ) ||
        statusPengadaan.includes("nego")
      )
    );
  }

  function isTotalProjectOverview(
    item,
    tahun,
    today = new Date()
  ) {
    const statusFinal =
      normalisasiFilter(item?.status_final);

    const statusPengadaan =
      normalisasiFilter(
        getStatusPengadaan(item)
      );

    const pipeline =
      statusFinal === "aktif" &&
      statusPengadaan.includes("pipeline");

    const submitPenawaran =
      statusFinal === "aktif" &&
      statusPengadaan.includes("submit penawaran");

    const prosesPengadaan =
      isProsesPengadaan(item);

    const prosesKontrak =
      statusFinal === "aktif" &&
      (
        (
          statusPengadaan.includes("proses") &&
          statusPengadaan.includes("kontrak")
        ) ||
        statusPengadaan === "kontrak"
      );

    const proyekAktif =
      statusFinal === "aktif" &&
      statusPengadaan === "done" &&
      isKontrakMasukTahun(item, tahun);

    const proyekSelesai =
      ["done", "selesai"].includes(statusFinal) &&
      isKontrakMasukTahun(item, tahun);

    const proyekTerlambat =
      isProyekTerlambat(item, today);

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

  function resolvePicLabel(data, id) {
    for (const item of data) {
      const picList =
        Array.isArray(item?.pic_list)
          ? item.pic_list
          : [];

      const selected =
        picList.find(pic =>
          positif(pic?.id) === id
        );

      if (text(selected?.nama)) {
        return text(selected.nama);
      }

      const ids = getPicIds(item);

      const index = ids.indexOf(id);

      const names = listValue(
        item,
        "nama_pic_list",
        "nama_pic"
      );

      if (
        index >= 0 &&
        names.length === ids.length &&
        names[index]
      ) {
        return names[index];
      }
    }

    return `ID ${id}`;
  }

  function describe(
    filters,
    source = []
  ) {
    const f = normalize(filters);

    const labels = [];

    if (
      f.dashboard_group === "total-project"
    ) {
      labels.push(
        "Gabungan Seluruh Card Project Overview",
        `Tahun Laporan: ${f.tahun}`
      );
    }

    if (
      f.dashboard_group === "proses-pengadaan"
    ) {
      labels.push(
        "Proses Pengadaan: Submit Pengadaan dan Negosiasi"
      );
    }

    if (f.search) {
      labels.push(
        `Pencarian: ${f.search}`
      );
    }

    if (f.kategori) {
      labels.push(
        `Kategori: ${f.kategori}`
      );
    }

    if (f.jenis_proyek) {
      labels.push(
        `Jenis Proyek: ${f.jenis_proyek}`
      );
    }

    if (f.klien) {
      labels.push(
        `Klien: ${f.klien}`
      );
    }

    if (f.partner) {
      labels.push(
        `Partner: ${f.partner}`
      );
    }

    if (f.status_final) {
      labels.push(
        `Status Final: ${f.status_final}`
      );
    }

    if (f.pic_id !== null) {
      labels.push(
        `PIC: ${resolvePicLabel(source, f.pic_id)}`
      );
    }

    if (f.status_pengadaan) {
      labels.push(
        `Status Pengadaan: ${f.status_pengadaan}`
      );
    }

    if (
      f.periode_kontrak === "tahun"
    ) {
      labels.push(
        `Periode Kontrak: ${f.tahun}`
      );
    }

    if (
      f.tanggal_akhir === "expired"
    ) {
      labels.push(
        "Tanggal Akhir: Telah Berakhir"
      );
    }

    if (
      f.status_teknis_exclude.length > 0
    ) {
      labels.push(
        `Status Teknis selain: ${
          f.status_teknis_exclude.join(", ")
        }`
      );
    }

    if (f.terlambat) {
      labels.push(
        "Proyek Terlambat"
      );
    }

    return labels;
  }

  function filterData(
    source = [],
    filters = {},
    options = {}
  ) {
    const f = normalize(filters);

    const rows =
      Array.isArray(source)
        ? source
        : [];

    const today =
      options.today ?? new Date();

    const same = (
      value,
      expected
    ) =>
      !expected ||
      normalisasiFilter(value) ===
        normalisasiFilter(expected);

    const has = (
      values,
      expected
    ) =>
      !expected ||
      values.some(value =>
        same(value, expected)
      );

    const data = rows.filter(item => {
      const categories =
        getCategories(item);

      const partners = listValue(
        item,
        "nama_partner_list",
        "nama_partner"
      );

      const statusPengadaan =
        normalisasiFilter(
          getStatusPengadaan(item)
        );

      const statusTeknis =
        normalisasiFilter(
          getStatusTeknis(item)
        );

      const searchText =
        normalisasiFilter(
          [
            item?.nama_proyek,
            item?.perusahaan_klien,
            categories.join(" "),
            partners.join(" "),
            getPicName(item),
            statusPengadaan,
            statusTeknis,
            item?.status_final
          ].join(" ")
        );

      if (
        f.search &&
        !searchText.includes(
          normalisasiFilter(f.search)
        )
      ) {
        return false;
      }

      if (
        !has(categories, f.kategori) ||
        !has(partners, f.partner)
      ) {
        return false;
      }

      if (
        !same(item?.jenis_proyek, f.jenis_proyek) ||
        !same(item?.perusahaan_klien, f.klien) ||
        !same(item?.status_final, f.status_final)
      ) {
        return false;
      }

      if (
        f.pic_id !== null &&
        !getPicIds(item).includes(f.pic_id)
      ) {
        return false;
      }

      if (
        f.status_pengadaan &&
        !statusPengadaan.includes(
          normalisasiFilter(f.status_pengadaan)
        )
      ) {
        return false;
      }

      if (
        f.periode_kontrak === "tahun" &&
        !isKontrakMasukTahun(item, f.tahun)
      ) {
        return false;
      }

      if (
        f.tanggal_akhir === "expired" &&
        !isTanggalAkhirExpired(item, today)
      ) {
        return false;
      }

      if (
        f.status_teknis_exclude.includes(
          statusTeknis
        )
      ) {
        return false;
      }

      if (
        f.terlambat &&
        !isProyekTerlambat(item, today)
      ) {
        return false;
      }

      if (
        f.dashboard_group === "total-project" &&
        !isTotalProjectOverview(
          item,
          f.tahun,
          today
        )
      ) {
        return false;
      }

      if (
        f.dashboard_group === "proses-pengadaan" &&
        !isProsesPengadaan(item)
      ) {
        return false;
      }

      return true;
    });

    return {
      data,
      total: data.length,
      filters: f,
      activeText: describe(f, rows)
    };
  }

  function showBanner(
    result,
    options = {}
  ) {
    const doc =
      options.document ??
      globalThis.document;

    if (!doc) {
      return null;
    }

    const id =
      options.id ??
      "dashboardFilterBanner";

    let banner =
      doc.getElementById(id);

    if (
      result.activeText.length === 0
    ) {
      banner?.remove();

      return null;
    }

    if (!banner) {
      banner =
        doc.createElement("div");

      banner.id = id;

      banner.className =
        "dashboard-filter-banner";

      const before =
        options.before;

      const container =
        options.container ??
        before?.parentElement;

      if (!container) {
        return null;
      }

      container.insertBefore(
        banner,
        before ?? null
      );
    }

    banner.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
      padding: 13px 16px;
      border: 1px solid #c7d2fe;
      border-radius: 12px;
      background: #eef2ff;
      color: #3730a3;
      font-size: 12px;
      font-weight: 700;
    `;

    const label =
      doc.createElement("span");

    label.textContent =
      `Filter aktif: ${
        result.activeText.join(" • ")
      } — ${
        result.total.toLocaleString("id-ID")
      } proyek ditemukan`;

    const reset =
      doc.createElement("button");

    reset.type = "button";

    reset.className =
      "dashboard-filter-reset";

    reset.textContent =
      "Hapus Filter";

    reset.style.cssText = `
      border: 0;
      padding: 0;
      background: transparent;
      color: #4338ca;
      font: inherit;
      font-weight: 800;
      white-space: nowrap;
      cursor: pointer;
    `;

    reset.addEventListener(
      "click",
      () => options.onReset?.()
    );

    reset.hidden =
      typeof options.onReset !== "function";

    banner.replaceChildren(
      label,
      reset
    );

    return banner;
  }

  return Object.freeze({
    normalize,
    fromUrl,
    toSearchParams,
    parameterKeys,
    applyFilter: filterData,
    describe,
    showActiveDashboardFilter: showBanner,
    normalisasiFilter,
    getPicIds,
    getPicName,
    getCategories,
    listValue,
    getStatusPengadaan,
    getStatusTeknis,
    getTanggalMulaiKlien,
    getTanggalAkhirKlien,
    tanggalLokal,
    isKontrakMasukTahun,
    isTanggalAkhirExpired,
    isProyekTerlambat,
    isProsesPengadaan,
    isTotalProjectOverview
  });
})();

// ======================================================
// DATA DAN PAGINATION
// ======================================================

let allProyek = [];

let currentPage = 1;

let filtersInitialized = false;

let itemsPerPage = 25;

let dashboardFilters =
  proyekFilterHelpers.fromUrl(
    window.location.search
  );

// ======================================================
// ELEMENT HTML
// ======================================================

const proyekTable =
  document.getElementById("proyekTable");

const searchInput =
  document.getElementById("searchInput");

const kategoriFilter =
  document.getElementById("kategoriFilter");

const jenisFilter =
  document.getElementById("jenisFilter");

const klienFilter =
  document.getElementById("klienFilter");

const partnerFilter =
  document.getElementById("partnerFilter");

const statusFilter =
  document.getElementById("statusFilter");

const picFilter =
  document.getElementById("picFilter");

const paginationContainer =
  document.getElementById("pagination");

// ======================================================
// HELPER FORMAT
// ======================================================

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatRupiah(value) {
  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
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
    String(value).slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [
      tahun,
      bulan,
      tanggal
    ] = text.split("-");

    return `${tanggal}/${bulan}/${tahun}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
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
  return proyekFilterHelpers
    .normalisasiFilter(value);
}

// ======================================================
// HELPER DATA PROYEK
// ======================================================

function dapatkanNamaPic(item) {
  return proyekFilterHelpers
    .getPicName(item);
}

function dapatkanPicIds(item) {
  return proyekFilterHelpers
    .getPicIds(item);
}

function listValue(
  item,
  arrayKey,
  textKey
) {
  return proyekFilterHelpers.listValue(
    item,
    arrayKey,
    textKey
  );
}

function finalValue(
  item,
  prefix
) {
  const directValue =
    item?.[`nilai_final_${prefix}`];

  if (
    directValue !== null &&
    directValue !== undefined &&
    directValue !== ""
  ) {
    const number =
      Number(directValue);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  const nilaiKeys = [
    `nilai_nego_3_${prefix}`,
    `nilai_nego_2_${prefix}`,
    `nilai_nego_1_${prefix}`,
    `nilai_submit_${prefix}`
  ];

  for (const key of nilaiKeys) {
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
    finalValue(item, "klien");

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
  const kategoriList =
    proyekFilterHelpers.getCategories(item);

  return kategoriList.length > 0
    ? kategoriList.join(", ")
    : "Tanpa Kategori";
}

function getTanggalAkhirKlien(item) {
  return proyekFilterHelpers
    .getTanggalAkhirKlien(item);
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
          String(value || "").trim()
        )
        .filter(Boolean)
    )
  ].sort((first, second) =>
    first.localeCompare(second, "id")
  );

  select.replaceChildren(
    new Option(placeholder, "")
  );

  uniqueValues.forEach(value => {
    select.add(
      new Option(value, value)
    );
  });

  select.value =
    uniqueValues.includes(previousValue)
      ? previousValue
      : "";
}

// ======================================================
// FILTER PIC
// ======================================================

function populatePicFilter() {
  if (!picFilter) {
    return;
  }

  const previousValue =
    picFilter.value;

  const daftarPic =
    new Map();

  allProyek.forEach(item => {
    const picList =
      Array.isArray(item?.pic_list)
        ? item.pic_list
        : [];

    picList.forEach(pic => {
      const id =
        Number(pic?.id);

      const nama =
        String(pic?.nama || "").trim();

      if (
        Number.isInteger(id) &&
        id > 0 &&
        nama
      ) {
        daftarPic.set(
          String(id),
          nama
        );
      }
    });

    if (picList.length === 0) {
      const picIds =
        dapatkanPicIds(item);

      const namaPicList =
        listValue(
          item,
          "nama_pic_list",
          "nama_pic"
        );

      picIds.forEach((id, index) => {
        const nama =
          String(
            namaPicList[index] ||
            `PIC ${id}`
          ).trim();

        daftarPic.set(
          String(id),
          nama
        );
      });
    }
  });

  const options =
    [...daftarPic.entries()]
      .sort((first, second) =>
        first[1].localeCompare(
          second[1],
          "id"
        )
      );

  picFilter.replaceChildren(
    new Option("Semua PIC", "")
  );

  options.forEach(([id, nama]) => {
    picFilter.add(
      new Option(nama, id)
    );
  });

  if (
    options.some(([id]) =>
      id === previousValue
    )
  ) {
    picFilter.value =
      previousValue;

  } else if (
    dashboardFilters.pic_id !== null &&
    options.some(([id]) =>
      Number(id) === dashboardFilters.pic_id
    )
  ) {
    picFilter.value =
      String(dashboardFilters.pic_id);

  } else {
    picFilter.value = "";
  }
}

// ======================================================
// BANGUN FILTER
// ======================================================

function buildFilters() {
  populateFilter(
    kategoriFilter,
    allProyek.flatMap(item =>
      proyekFilterHelpers.getCategories(item)
    ),
    "Semua Kategori"
  );

  populateFilter(
    jenisFilter,
    allProyek.map(item =>
      item?.jenis_proyek
    ),
    "Semua Jenis Proyek"
  );

  populateFilter(
    klienFilter,
    allProyek.map(item =>
      item?.perusahaan_klien
    ),
    "Semua Klien"
  );

  populateFilter(
    partnerFilter,
    allProyek.flatMap(item =>
      listValue(
        item,
        "nama_partner_list",
        "nama_partner"
      )
    ),
    "Semua Partner"
  );

  populateFilter(
    statusFilter,
    allProyek.map(item =>
      item?.status_final
    ),
    "Semua Status"
  );

  populatePicFilter();
}

// ======================================================
// TERAPKAN FILTER DASHBOARD KE FORM
// ======================================================

function terapkanFilterUrlKeForm() {
  if (searchInput) {
    searchInput.value =
      dashboardFilters.search;
  }

  const mapping = [
    [
      kategoriFilter,
      dashboardFilters.kategori
    ],
    [
      jenisFilter,
      dashboardFilters.jenis_proyek
    ],
    [
      klienFilter,
      dashboardFilters.klien
    ],
    [
      partnerFilter,
      dashboardFilters.partner
    ],
    [
      statusFilter,
      dashboardFilters.status_final
    ],
    [
      picFilter,
      dashboardFilters.pic_id === null
        ? ""
        : String(dashboardFilters.pic_id)
    ]
  ];

  mapping.forEach(([select, value]) => {
    if (!select) {
      return;
    }

    const found =
      [...select.options].find(option =>
        normalisasiFilter(option.value) ===
        normalisasiFilter(value)
      );

    if (!found && value) {
      select.add(
        new Option(
          select === picFilter
            ? `PIC ID ${value}`
            : value,
          value
        )
      );
    }

    select.value =
      found ? found.value : value;
  });
}

// ======================================================
// FILTER AKTIF: DASHBOARD + DROPDOWN
// ======================================================

function getActiveProyekFilters() {
  return proyekFilterHelpers.normalize({
    ...dashboardFilters,

    search:
      searchInput?.value ??
      dashboardFilters.search,

    kategori:
      kategoriFilter?.value ??
      dashboardFilters.kategori,

    jenis_proyek:
      jenisFilter?.value ??
      dashboardFilters.jenis_proyek,

    klien:
      klienFilter?.value ??
      dashboardFilters.klien,

    partner:
      partnerFilter?.value ??
      dashboardFilters.partner,

    status_final:
      statusFilter?.value ??
      dashboardFilters.status_final,

    pic_id:
      picFilter?.value ??
      dashboardFilters.pic_id
  });
}

// ======================================================
// RESET FILTER
// ======================================================

function resetProyekFilters() {
  dashboardFilters =
    proyekFilterHelpers.normalize({});

  [
    searchInput,
    kategoriFilter,
    jenisFilter,
    klienFilter,
    partnerFilter,
    statusFilter,
    picFilter
  ]
    .filter(Boolean)
    .forEach(element => {
      element.value = "";
    });

  const url =
    new URL(window.location.href);

  proyekFilterHelpers.parameterKeys
    .forEach(key => {
      url.searchParams.delete(key);
    });

  window.history.replaceState(
    null,
    "",
    url.pathname + url.search + url.hash
  );

  currentPage = 1;

  applyFilter();
}

// ======================================================
// APPLY FILTER
// ======================================================

function applyFilter() {
  const result =
    proyekFilterHelpers.applyFilter(
      allProyek,
      getActiveProyekFilters()
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        result.total / itemsPerPage
      )
    );

  currentPage =
    Math.min(
      Math.max(currentPage, 1),
      totalPages
    );

  const startIndex =
    (currentPage - 1) * itemsPerPage;

  const pageData =
    result.data.slice(
      startIndex,
      startIndex + itemsPerPage
    );

  renderTable(pageData);

  renderPagination(result.total);

  showActiveDashboardFilter(result);

  return result;
}

// ======================================================
// BANNER FILTER AKTIF
// ======================================================

function showActiveDashboardFilter(result) {
  const wrapper =
    proyekTable?.closest(
      ".table-wrapper, .table-wrap"
    ) ??
    proyekTable?.parentElement;

  return proyekFilterHelpers
    .showActiveDashboardFilter(
      result,
      {
        before: wrapper,

        container:
          wrapper?.parentElement,

        onReset:
          resetProyekFilters
      }
    );
}

// ======================================================
// RENDER TABEL
// ======================================================

function renderTable(data) {
  if (!proyekTable) {
    return;
  }

  if (data.length === 0) {
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
          getKategoriProyek(item);

        const partners =
          listValue(
            item,
            "nama_partner_list",
            "nama_partner"
          );

        const partnerText =
          partners.length > 0
            ? partners
                .map(escapeHTML)
                .join(", ")
            : "-";

        const nilaiProyek =
          projectValue(item);

        const nilaiPartner =
          partnerValue(item);

        const marginNominal =
          nilaiProyek - nilaiPartner;

        const marginPersen =
          nilaiProyek > 0
            ? (
                marginNominal /
                nilaiProyek
              ) * 100
            : 0;

        const status =
          item?.status_final || "-";

        const statusKey =
          normalisasiFilter(status);

        let statusClass =
          "badge-aktif";

        if (
          ["done", "selesai"].includes(statusKey)
        ) {
          statusClass = "badge-done";

        } else if (
          ["cancel", "batal"].includes(statusKey)
        ) {
          statusClass = "badge-cancel";
        }

        const jenisUtama =
          escapeHTML(
            item?.jenis_proyek || "-"
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
          getTanggalAkhirKlien(item);

        return `
          <tr>
            <td class="proyek-info-cell">
              <div class="proyek-main-name">
                ${escapeHTML(
                  item?.nama_proyek || "-"
                )}
              </div>

              <div class="proyek-category-name">
                ${escapeHTML(kategoriText)}
              </div>
            </td>

            <td>
              ${jenisText}
            </td>

            <td>
              ${escapeHTML(
                dapatkanNamaPic(item)
              )}
            </td>

            <td>
              ${escapeHTML(
                item?.perusahaan_klien || "-"
              )}
            </td>

            <td>
              ${partnerText}
            </td>

            <td class="money">
              ${formatRupiah(nilaiProyek)}
            </td>

            <td class="money">
              ${formatRupiah(nilaiPartner)}
            </td>

            <td class="money">
              ${formatRupiah(marginNominal)}
            </td>

            <td class="money">
              ${marginPersen.toFixed(2)}%
            </td>

            <td>
              ${formatTanggal(endDate)}
            </td>

            <td>
              <span class="badge ${statusClass}">
                ${escapeHTML(status)}
              </span>
            </td>

            <td>
              <div class="table-actions">
                <a
                  class="btn-detail"
                  href="/detail-proyek.html?id=${
                    encodeURIComponent(item?.id)
                  }"
                >
                  Detail
                </a>

                <button
                  type="button"
                  class="btn-project-log"
                  data-project-log
                  data-project-id="${
                    Number(item?.id)
                  }"
                  data-project-name="${
                    escapeHTML(
                      item?.nama_proyek ||
                      "Proyek"
                    )
                  }"
                >
                  Log
                </button>

                <button
                  type="button"
                  class="btn-delete-project"
                  data-delete-project
                  data-project-id="${
                    Number(item?.id)
                  }"
                  data-project-name="${
                    escapeHTML(
                      item?.nama_proyek ||
                      "Proyek"
                    )
                  }"
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

function renderPagination(totalItems) {
  createPagination({
    containerId: "pagination",
    currentPage,
    totalItems,
    itemsPerPage,

    itemLabel: "proyek",

    onPageChange: page => {
      currentPage = page;

      applyFilter();
    },

    onItemsPerPageChange: size => {
      itemsPerPage = size;

      currentPage = 1;

      applyFilter();
    }
  });
}

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

    if (filtersInitialized) {
      dashboardFilters =
        getActiveProyekFilters();
    }

    const response = await fetch(
      "/api/proyek-listing",
      {
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    if (response.status === 401) {
      window.location.href =
        "/login.html";

      return;
    }

    const contentType =
      response.headers.get("content-type") ||
      "";

    if (
      !contentType.includes("application/json")
    ) {
      const responseText =
        await response.text();

      throw new Error(
        `Server tidak mengembalikan JSON: ${
          responseText
        }`
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
        : Array.isArray(result?.data)
          ? result.data
          : [];

    buildFilters();

    terapkanFilterUrlKeForm();

    filtersInitialized = true;

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
          ${escapeHTML(error.message)}
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
  partnerFilter,
  statusFilter,
  picFilter
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
// ACTIVITY LOG PROYEK
// ======================================================

const activityLogModal =
  document.getElementById(
    "activityLogModal"
  );

const activityLogProjectName =
  document.getElementById(
    "activityLogProjectName"
  );

const activityLogLoading =
  document.getElementById(
    "activityLogLoading"
  );

const activityLogEmpty =
  document.getElementById(
    "activityLogEmpty"
  );

const activityLogList =
  document.getElementById(
    "activityLogList"
  );

const activityLogTotal =
  document.getElementById(
    "activityLogTotal"
  );

function formatTanggalLog(value) {
  if (!value) {
    return "-";
  }

  const tanggal =
    new Date(value);

  if (
    Number.isNaN(tanggal.getTime())
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(tanggal);
}

function namaPenggunaLog(item) {
  const nama =
    item.dibuat_oleh ||
    item.nama_user ||
    item.user_nama ||
    item.user_name ||
    item.nama_pic ||
    item.username ||
    item.email;

  return String(
    nama || "Sistem"
  ).trim();
}

function tutupActivityLog() {
  if (!activityLogModal) {
    return;
  }

  activityLogModal.classList.remove(
    "is-open"
  );

  activityLogModal.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "activity-modal-open"
  );
}

function bukaModalActivityLog() {
  if (!activityLogModal) {
    return;
  }

  activityLogModal.classList.add(
    "is-open"
  );

  activityLogModal.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "activity-modal-open"
  );
}

function renderActivityLog(items) {
  if (!activityLogList) {
    return;
  }

  activityLogTotal.textContent =
    `${items.length} aktivitas`;

  if (items.length === 0) {
    activityLogEmpty.hidden = false;

    activityLogList.innerHTML = "";

    return;
  }

  activityLogEmpty.hidden = true;

  activityLogList.innerHTML =
    items
      .map(item => {
        const nilaiLama =
          item.nilai_lama ?? "";

        const nilaiBaru =
          item.nilai_baru ?? "";

        const adaPerubahanNilai =
          String(nilaiLama).trim() ||
          String(nilaiBaru).trim();

        return `
          <article class="activity-log-item">
            <span class="activity-log-dot"></span>

            <div class="activity-log-card">
              <div class="activity-log-top">
                <p class="activity-log-description">
                  ${escapeHTML(
                    item.deskripsi ||
                    "Aktivitas proyek"
                  )}
                </p>

                <time class="activity-log-date">
                  ${escapeHTML(
                    formatTanggalLog(
                      item.created_at
                    )
                  )}
                </time>
              </div>

              <div class="activity-log-meta">
                <span class="activity-log-chip">
                  ${escapeHTML(
                    item.aktivitas ||
                    "AKTIVITAS"
                  )}
                </span>

                <span class="activity-log-chip">
                  ${escapeHTML(
                    item.modul ||
                    "PROYEK"
                  )}
                </span>

                ${
                  item.field_name
                    ? `
                      <span class="activity-log-chip">
                        ${escapeHTML(
                          item.field_name
                        )}
                      </span>
                    `
                    : ""
                }
              </div>

              <div class="activity-log-user">
                Oleh:
                ${escapeHTML(
                  namaPenggunaLog(item)
                )}
              </div>

              ${
                adaPerubahanNilai
                  ? `
                    <div class="activity-log-change">
                      <div class="activity-log-value">
                        ${escapeHTML(
                          String(
                            nilaiLama || "-"
                          )
                        )}
                      </div>

                      <div class="activity-log-arrow">
                        →
                      </div>

                      <div class="activity-log-value">
                        ${escapeHTML(
                          String(
                            nilaiBaru || "-"
                          )
                        )}
                      </div>
                    </div>
                  `
                  : ""
              }
            </div>
          </article>
        `;
      })
      .join("");
}

async function loadActivityLogProyek(
  proyekId,
  namaProyek
) {
  if (
    !Number.isInteger(proyekId) ||
    proyekId <= 0
  ) {
    window.alert(
      "ID proyek tidak valid."
    );

    return;
  }

  activityLogProjectName.textContent =
    namaProyek || "Proyek";

  activityLogLoading.hidden = false;

  activityLogEmpty.hidden = true;

  activityLogList.innerHTML = "";

  activityLogTotal.textContent =
    "Memuat...";

  bukaModalActivityLog();

  try {
    const response = await fetch(
      `/api/proyek/${
        encodeURIComponent(proyekId)
      }/activity-log`,
      {
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin"
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil activity log"
      );
    }

    activityLogProjectName.textContent =
      result.proyek?.nama_proyek ||
      namaProyek ||
      "Proyek";

    renderActivityLog(
      Array.isArray(result.data)
        ? result.data
        : []
    );

  } catch (error) {
    console.error(
      "ERROR LOAD ACTIVITY LOG:",
      error
    );

    activityLogEmpty.hidden = false;

    activityLogEmpty.textContent =
      error.message;

    activityLogTotal.textContent =
      "Gagal dimuat";

  } finally {
    activityLogLoading.hidden = true;
  }
}

// ======================================================
// KLIK TOMBOL LOG
// ======================================================

proyekTable?.addEventListener(
  "click",
  event => {
    const logButton =
      event.target.closest(
        "[data-project-log]"
      );

    if (!logButton) {
      return;
    }

    const proyekId =
      Number(
        logButton.dataset.projectId
      );

    const namaProyek =
      logButton.dataset.projectName ||
      "Proyek";

    loadActivityLogProyek(
      proyekId,
      namaProyek
    );
  }
);

// ======================================================
// TUTUP MODAL LOG
// ======================================================

document
  .querySelectorAll(
    "[data-close-activity-log]"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      tutupActivityLog
    );
  });

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Escape" &&
      activityLogModal
        ?.classList
        .contains("is-open")
    ) {
      tutupActivityLog();
    }
  }
);

// ======================================================
// HAPUS PROYEK
// ======================================================

proyekTable?.addEventListener(
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
        deleteButton.dataset.projectId
      );

    const namaProyek =
      deleteButton.dataset.projectName ||
      "Proyek";

    if (
      !Number.isInteger(proyekId) ||
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
      String(verifikasi || "")
        .trim()
        .toUpperCase() !== "HAPUS"
    ) {
      window.alert(
        "Penghapusan proyek dibatalkan."
      );

      return;
    }

    const textSebelumnya =
      deleteButton.textContent;

    deleteButton.disabled = true;

    deleteButton.textContent =
      "Menghapus...";

    try {
      const response = await fetch(
        `/api/proyek/${
          encodeURIComponent(proyekId)
        }`,
        {
          method: "DELETE",

          headers: {
            Accept: "application/json"
          },

          credentials: "same-origin"
        }
      );

      const contentType =
        response.headers.get("content-type") ||
        "";

      if (
        !contentType.includes("application/json")
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

        if (result.constraint) {
          pesanError +=
            `\n\nConstraint: ${result.constraint}`;
        }

        if (result.detail) {
          pesanError +=
            `\n${result.detail}`;
        }

        throw new Error(pesanError);
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

      deleteButton.disabled = false;

      deleteButton.textContent =
        textSebelumnya;
    }
  }
);

// ======================================================
// START
// ======================================================

loadProyek();