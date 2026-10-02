// ======================================================
// FILTER DARI URL DASHBOARD
// ======================================================

const timelineUrlParams =
  new URLSearchParams(
    window.location.search
  );

const bulanUrl =
  Number(
    timelineUrlParams.get(
      "bulan"
    )
  );

const statusUrl =
  String(
    timelineUrlParams.get(
      "status"
    ) || ""
  )
    .trim()
    .toLowerCase();

const modeUrl =
  String(
    timelineUrlParams.get(
      "mode"
    ) || ""
  )
    .trim()
    .toLowerCase();

const searchUrl =
  String(
    timelineUrlParams.get(
      "search"
    ) || ""
  ).trim();


// ======================================================
// STATE
// ======================================================

let timelinePage = 1;

let timelineTotalPages = 1;

let timelineSearchValue =
  searchUrl;

let timelineBulan =
  [1, 3, 6].includes(
    bulanUrl
  )
    ? String(bulanUrl)
    : "";

let timelineStatus =
  statusUrl === "expired"
    ? "expired"
    : "";

let timelineMode =
  modeUrl ===
  "contract-overview"
    ? "contract-overview"
    : "";

const timelineLimit = 25;


// ======================================================
// ELEMENT
// ======================================================

const timelineGroupedContainer =
  document.getElementById(
    "timelineGroupedContainer"
  );

const timelineSearchElement =
  document.getElementById(
    "timelineSearch"
  );

const filterBerakhirElement =
  document.getElementById(
    "filterBerakhir"
  );

const resetTimelineFilterElement =
  document.getElementById(
    "resetTimelineFilter"
  );

const timelinePaginationElement =
  document.getElementById(
    "timelinePagination"
  );

const timelinePaginationInfoElement =
  document.getElementById(
    "timelinePaginationInfo"
  );

const timelinePaginationButtonsElement =
  document.getElementById(
    "timelinePaginationButtons"
  );


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {
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


// ======================================================
// TANGGAL INPUT
// ======================================================

function tanggalInput(value) {
  if (!value) {
    return "";
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
    return text;
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

  return [
    date.getFullYear(),

    String(
      date.getMonth() + 1
    ).padStart(2, "0"),

    String(
      date.getDate()
    ).padStart(2, "0")
  ].join("-");
}


// ======================================================
// FORMAT TANGGAL
// ======================================================

function formatTanggal(value) {
  const tanggal =
    tanggalInput(value);

  if (!tanggal) {
    return "-";
  }

  const [
    tahun,
    bulan,
    hari
  ] = tanggal
    .split("-")
    .map(Number);

  const date =
    new Date(
      tahun,
      bulan - 1,
      hari
    );

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
      month: "long",
      year: "numeric"
    }
  ).format(date);
}


// ======================================================
// TANGGAL HARI INI JAKARTA
// ======================================================

function tanggalHariIniJakarta() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Jakarta",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit"
      }
    ).formatToParts(
      new Date()
    );

  const hasil = {};

  parts.forEach(part => {
    hasil[part.type] =
      part.value;
  });

  return [
    hasil.year,
    hasil.month,
    hasil.day
  ].join("-");
}


// ======================================================
// SELISIH HARI
// ======================================================

function selisihHari(
  tanggalAwal,
  tanggalAkhir
) {
  if (
    !tanggalAwal ||
    !tanggalAkhir
  ) {
    return null;
  }

  const awalBagian =
    tanggalAwal
      .split("-")
      .map(Number);

  const akhirBagian =
    tanggalAkhir
      .split("-")
      .map(Number);

  if (
    awalBagian.length !== 3 ||
    akhirBagian.length !== 3
  ) {
    return null;
  }

  const awal =
    Date.UTC(
      awalBagian[0],
      awalBagian[1] - 1,
      awalBagian[2]
    );

  const akhir =
    Date.UTC(
      akhirBagian[0],
      akhirBagian[1] - 1,
      akhirBagian[2]
    );

  if (
    !Number.isFinite(awal) ||
    !Number.isFinite(akhir)
  ) {
    return null;
  }

  return Math.round(
    (
      akhir -
      awal
    ) /
    86400000
  );
}


// ======================================================
// NORMALISASI KATEGORI
// ======================================================

function getTimelineKategori(item) {
  const sumberKategori =
    item.kategori ??
    item.nama_kategori_produk_list ??
    item.nama_kategori_produk ??
    item.kategori_proyek ??
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

  } else if (
    sumberKategori &&
    typeof sumberKategori ===
      "object"
  ) {
    kategoriList = [
      String(
        sumberKategori
          ?.nama_kategori_produk ||
        sumberKategori?.nama ||
        ""
      ).trim()
    ];

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
    kategoriList.filter(Boolean);

  return kategoriList.length > 0
    ? kategoriList.join(", ")
    : "Tanpa Kategori";
}


// ======================================================
// INFORMASI PROYEK
// ======================================================

function getTimelineProject(item) {
  const adalahProyekSewa =
    String(
      item.sumber_timeline || ""
    )
      .trim()
      .toLowerCase() ===
      "sewa";

  /*
   * Proyek biasa:
   * tampilkan nama proyek.
   *
   * Proyek sewa:
   * tampilkan nomor PR.
   */

  const namaProyek =
    adalahProyekSewa
      ? (
          String(
            item.nomor_pr || ""
          ).trim() ||
          "PR Belum Diisi"
        )
      : (
          String(
            item.nama_proyek || ""
          ).trim() ||
          "-"
        );

  /*
   * Proyek sewa menuju detail
   * proyek sewa.
   *
   * Proyek biasa menuju detail
   * proyek reguler.
   */

  let detailUrl = "#";

  if (
    adalahProyekSewa &&
    Number(
      item.proyek_sewa_id
    ) > 0
  ) {
    detailUrl =
      `/proyek-sewa-detail.html?id=${encodeURIComponent(
        item.proyek_sewa_id
      )}`;

  } else if (
    !adalahProyekSewa &&
    Number(
      item.proyek_id
    ) > 0
  ) {
    detailUrl =
      `/detail-proyek.html?id=${encodeURIComponent(
        item.proyek_id
      )}`;
  }

  return {
    namaProyek,
    detailUrl,
    adalahProyekSewa
  };
}


// ======================================================
// INFORMASI JENIS PROYEK
// ======================================================

function getTimelineJenis(item) {
  const jenisProyek =
    String(
      item.jenis_proyek || ""
    ).trim() || "-";

  const subJenisProyek =
    String(
      item.sub_jenis_proyek || ""
    ).trim();

  return {
    jenisProyek,
    subJenisProyek
  };
}


// ======================================================
// INFORMASI BERAKHIR
// ======================================================

function getTimelineExpiry(
  item,
  hariIni
) {
  const tanggalAkhir =
    tanggalInput(
      item.tanggal_akhir
    );

  const statusFinal =
    String(
      item.status_final || ""
    )
      .trim()
      .toLowerCase();

  /*
   * Jika proyek sudah Done,
   * tampilkan status selesai
   * berwarna biru.
   */

  if (
    statusFinal === "done" ||
    statusFinal === "selesai"
  ) {
    return {
      text:
        "Kontrak telah selesai",

      className:
        "expiry-finished"
    };
  }

  const sisaHari =
    selisihHari(
      hariIni,
      tanggalAkhir
    );

  if (sisaHari === null) {
    return {
      text: "-",

      className:
        "expiry-neutral"
    };
  }

  if (sisaHari < 0) {
    return {
      text:
        "Telah berakhir",

      className:
        "expiry-expired"
    };
  }

  if (sisaHari === 0) {
    return {
      text:
        "Berakhir hari ini",

      className:
        "expiry-warning"
    };
  }

  if (sisaHari <= 90) {
    return {
      text:
        `${sisaHari} hari lagi`,

      className:
        "expiry-warning"
    };
  }

  return {
    text:
      `${sisaHari} hari lagi`,

    className:
      "expiry-safe"
  };
}


// ======================================================
// SINKRONKAN FILTER KE URL
// ======================================================

function updateTimelineUrl() {
  const params =
    new URLSearchParams();

  if (timelineSearchValue) {
    params.set(
      "search",
      timelineSearchValue
    );
  }

  if (timelineBulan) {
    params.set(
      "bulan",
      timelineBulan
    );
  }

  if (timelineStatus) {
    params.set(
      "status",
      timelineStatus
    );
  }

  if (timelineMode) {
    params.set(
      "mode",
      timelineMode
    );
  }

  const query =
    params.toString();

  const urlBaru =
    query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;

  window.history.replaceState(
    {},
    "",
    urlBaru
  );
}

// ======================================================
// INFORMASI FILTER AKTIF
// ======================================================

function renderTimelineFilterInfo(
  totalData
) {
  let banner =
    document.getElementById(
      "timelineFilterInfo"
    );

  const filterAktif = [];

  if (timelineBulan) {
    filterAktif.push(
      `Jatuh tempo dalam ${timelineBulan} bulan`
    );
  }

  if (
    timelineStatus ===
    "expired"
  ) {
    filterAktif.push(
      "Sudah jatuh tempo"
    );
  }

  if (
    timelineMode ===
    "contract-overview"
  ) {
    filterAktif.push(
      "Status Final Aktif"
    );
  }

  if (timelineSearchValue) {
    filterAktif.push(
      `Pencarian: ${timelineSearchValue}`
    );
  }

  if (
    filterAktif.length === 0
  ) {
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
      "timelineFilterInfo";

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

    if (
      timelineGroupedContainer
        ?.parentElement
    ) {
      timelineGroupedContainer
        .parentElement
        .insertBefore(
          banner,
          timelineGroupedContainer
        );
    }
  }

  banner.innerHTML = `
    <span>
      Filter aktif:
      ${escapeHtml(
        filterAktif.join(" • ")
      )}
      —
      ${Number(
        totalData || 0
      ).toLocaleString(
        "id-ID"
      )}
      data ditemukan
    </span>

    <a
      href="/timeline.html"
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
// LOAD DATA
// ======================================================

// ======================================================
// LOAD DATA TIMELINE
// ======================================================

async function loadTimelinePage() {
  if (!timelineGroupedContainer) {
    console.error(
      "Element #timelineGroupedContainer tidak ditemukan."
    );

    return;
  }

  timelineGroupedContainer
    .innerHTML = `
      <div class="empty-state">
        Memuat Timeline...
      </div>
    `;

  if (
    timelinePaginationElement
  ) {
    timelinePaginationElement
      .style.display =
        "none";
  }

  try {
    const query =
      new URLSearchParams({
        page:
          String(
            timelinePage
          ),

        limit:
          String(
            timelineLimit
          )
      });

    if (timelineSearchValue) {
      query.set(
        "search",
        timelineSearchValue
      );
    }

    if (timelineBulan) {
      query.set(
        "bulan",
        timelineBulan
      );
    }

    if (timelineStatus) {
      query.set(
        "status",
        timelineStatus
      );
    }

    if (timelineMode) {
      query.set(
        "mode",
        timelineMode
      );
    }

    const response =
      await fetch(
        `/api/timeline?${query.toString()}`,
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
        "Gagal mengambil Timeline"
      );
    }

    const data =
      Array.isArray(
        result.data
      )
        ? result.data
        : [];

    timelinePage =
      Math.max(
        Number(
          result.pagination
            ?.page || 1
        ),
        1
      );

    timelineTotalPages =
      Math.max(
        Number(
          result.pagination
            ?.total_pages || 1
        ),
        1
      );

    const totalData =
      Number(
        result.pagination
          ?.total_data || 0
      );

    renderTimelineTable(
      data
    );

    renderTimelinePagination(
      {
        page:
          timelinePage,

        limit:
          Number(
            result.pagination
              ?.limit ||
            timelineLimit
          ),

        total_data:
          totalData,

        total_pages:
          timelineTotalPages
      }
    );

    renderTimelineFilterInfo(
      totalData
    );

    updateTimelineUrl();

  } catch (error) {
    console.error(
      "ERROR LOAD TIMELINE:",
      error
    );

    timelineGroupedContainer
      .innerHTML = `
        <div class="empty-state">
          ${escapeHtml(
            error.message
          )}
        </div>
      `;

    if (
      timelinePaginationElement
    ) {
      timelinePaginationElement
        .style.display =
          "none";
    }
  }
}

// ======================================================
// RENDER TABLE
// ======================================================

function renderTimelineTable(data) {
  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    timelineGroupedContainer.innerHTML = `
      <div class="empty-state">
        Tidak ada Timeline yang ditemukan.
      </div>
    `;

    return;
  }

  const hariIni =
    tanggalHariIniJakarta();

  timelineGroupedContainer.innerHTML = `
    <section class="contract-table-card">

      <div class="contract-table-header">
        <div>
          <h2>Daftar Timeline</h2>

          <p>
            Informasi periode kontrak,
            lisensi, dan proyek sewa.
          </p>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="contract-table">

          <thead>
            <tr>
              <th>Proyek</th>
              <th>Deskripsi</th>
              <th>Jenis Proyek</th>
              <th>Tanggal Mulai</th>
              <th>Tanggal Akhir</th>
              <th>Berakhir Pada</th>
            </tr>
          </thead>

          <tbody>
            ${data
              .map(item =>
                renderTimelineRow(
                  item,
                  hariIni
                )
              )
              .join("")}
          </tbody>

        </table>
      </div>

    </section>
  `;
}


// ======================================================
// RENDER ROW
// ======================================================

function renderTimelineRow(
  item,
  hariIni
) {
  const project =
    getTimelineProject(item);

  const jenis =
    getTimelineJenis(item);

  const kategori =
    getTimelineKategori(item);

  const expiry =
    getTimelineExpiry(
      item,
      hariIni
    );

  /*
   * Proyek reguler:
   * ambil dari deskripsi Timeline.
   *
   * Proyek sewa:
   * ambil dari nama cabang.
   */
  const deskripsi =
    project.adalahProyekSewa
      ? (
          String(
            item.nama_cabang || ""
          ).trim() ||
          "-"
        )
      : (
          String(
            item.deskripsi || ""
          ).trim() ||
          "-"
        );


  const projectLink =
    project.detailUrl === "#"
      ? `
        <span class="project-link">
          ${escapeHtml(
            project.namaProyek
          )}
        </span>
      `
      : `
        <a
          href="${escapeHtml(
            project.detailUrl
          )}"
          class="project-link"
        >
          ${escapeHtml(
            project.namaProyek
          )}
        </a>
      `;

  return `
    <tr>

      <td class="project-column">
        ${projectLink}

        <div class="project-category">
          ${escapeHtml(
            kategori
          )}
        </div>
      </td>

      <td class="description-column">
        ${escapeHtml(
          deskripsi
        )}
      </td>

      <td class="project-type">
        <div class="project-type-main">
          ${escapeHtml(
            jenis.jenisProyek
          )}
        </div>

        ${
          jenis.subJenisProyek
            ? `
              <div class="project-type-sub">
                ${escapeHtml(
                  jenis.subJenisProyek
                )}
              </div>
            `
            : ""
        }
      </td>

      <td class="date-column">
        ${formatTanggal(
          item.tanggal_mulai
        )}
      </td>

      <td class="date-column">
        ${formatTanggal(
          item.tanggal_akhir
        )}
      </td>

      <td class="expiry-column">
        <span
          class="expiry-status ${expiry.className}"
        >
          ${escapeHtml(
            expiry.text
          )}
        </span>
      </td>

    </tr>
  `;
}


// ======================================================
// PAGINATION
// ======================================================

function renderTimelinePagination(
  pagination = {}
) {
  if (
    !timelinePaginationElement ||
    !timelinePaginationInfoElement ||
    !timelinePaginationButtonsElement
  ) {
    return;
  }

  const totalData =
    Number(
      pagination.total_data || 0
    );

  if (totalData === 0) {
    timelinePaginationElement
      .style.display =
        "none";

    return;
  }

  const page =
    Number(
      pagination.page || 1
    );

  const limit =
    Number(
      pagination.limit ||
      timelineLimit
    );

  timelineTotalPages =
    Math.max(
      Number(
        pagination.total_pages ||
        1
      ),
      1
    );

  timelinePaginationElement
    .style.display =
      "flex";

  const mulai =
    (
      page - 1
    ) * limit + 1;

  const akhir =
    Math.min(
      page * limit,
      totalData
    );

  timelinePaginationInfoElement
    .textContent =
      `Menampilkan ${mulai}-${akhir} dari ${totalData} Timeline`;

  const awalPage =
    Math.max(
      1,
      page - 2
    );

  const akhirPage =
    Math.min(
      timelineTotalPages,
      page + 2
    );

  let html = `
    <button
      type="button"
      class="page-button"
      data-page="${page - 1}"
      ${page <= 1 ? "disabled" : ""}
      aria-label="Halaman sebelumnya"
    >
      ‹
    </button>
  `;

  if (awalPage > 1) {
    html += `
      <button
        type="button"
        class="page-button"
        data-page="1"
      >
        1
      </button>
    `;

    if (awalPage > 2) {
      html += `
        <button
          type="button"
          class="page-button"
          disabled
        >
          ...
        </button>
      `;
    }
  }

  for (
    let nomor = awalPage;
    nomor <= akhirPage;
    nomor += 1
  ) {
    html += `
      <button
        type="button"
        class="
          page-button
          ${nomor === page ? "active" : ""}
        "
        data-page="${nomor}"
      >
        ${nomor}
      </button>
    `;
  }

  if (
    akhirPage <
    timelineTotalPages
  ) {
    if (
      akhirPage <
      timelineTotalPages - 1
    ) {
      html += `
        <button
          type="button"
          class="page-button"
          disabled
        >
          ...
        </button>
      `;
    }

    html += `
      <button
        type="button"
        class="page-button"
        data-page="${timelineTotalPages}"
      >
        ${timelineTotalPages}
      </button>
    `;
  }

  html += `
    <button
      type="button"
      class="page-button"
      data-page="${page + 1}"
      ${
        page >= timelineTotalPages
          ? "disabled"
          : ""
      }
      aria-label="Halaman berikutnya"
    >
      ›
    </button>
  `;

  timelinePaginationButtonsElement
    .innerHTML =
      html;
}


// ======================================================
// EVENT PAGINATION
// ======================================================

timelinePaginationButtonsElement
  ?.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "[data-page]"
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
        page < 1 ||
        page > timelineTotalPages ||
        page === timelinePage
      ) {
        return;
      }

      timelinePage = page;

      loadTimelinePage();

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  );


// ======================================================
// FILTER PENCARIAN
// ======================================================

let timelineSearchTimer =
  null;

timelineSearchElement
  ?.addEventListener(
    "input",
    event => {
      clearTimeout(
        timelineSearchTimer
      );

      timelineSearchTimer =
        setTimeout(
          () => {
            timelineSearchValue =
              String(
                event.target
                  .value || ""
              ).trim();

            timelinePage = 1;

            updateTimelineUrl();

            loadTimelinePage();
          },
          400
        );
    }
  );

// ======================================================
// FILTER BERAKHIR
// ======================================================

filterBerakhirElement
  ?.addEventListener(
    "change",
    event => {
      const value =
        String(
          event.target.value ||
          ""
        )
          .trim()
          .toLowerCase();

      if (
        value === "expired"
      ) {
        timelineStatus =
          "expired";

        timelineBulan =
          "";

      } else {
        timelineStatus =
          "";

        timelineBulan =
          [
            "1",
            "3",
            "6"
          ].includes(value)
            ? value
            : "";
      }

      timelinePage = 1;

      updateTimelineUrl();

      loadTimelinePage();
    }
  );


// ======================================================
// RESET FILTER
// ======================================================

resetTimelineFilterElement
  ?.addEventListener(
    "click",
    () => {
      if (
        timelineSearchElement
      ) {
        timelineSearchElement
          .value = "";
      }

      if (
        filterBerakhirElement
      ) {
        filterBerakhirElement
          .value = "";
      }

      timelineSearchValue =
        "";

      timelineBulan =
        "";

      timelineStatus =
        "";

      timelineMode =
        "";

      timelinePage =
        1;

      const banner =
        document.getElementById(
          "timelineFilterInfo"
        );

      if (banner) {
        banner.remove();
      }

      updateTimelineUrl();

      loadTimelinePage();
    }
  );// ======================================================
// INITIAL FILTER
// ======================================================

function initializeTimelineFilter() {
  if (
    timelineSearchElement
  ) {
    timelineSearchElement
      .value =
        timelineSearchValue;
  }

  if (
    filterBerakhirElement
  ) {
    if (
      timelineStatus ===
      "expired"
    ) {
      filterBerakhirElement
        .value =
          "expired";

    } else if (
      timelineBulan
    ) {
      filterBerakhirElement
        .value =
          timelineBulan;

    } else {
      filterBerakhirElement
        .value =
          "";
    }
  }
}


// ======================================================
// START
// ======================================================

initializeTimelineFilter();

loadTimelinePage();