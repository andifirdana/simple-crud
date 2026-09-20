let timelinePage = 1;
let timelineTotalPages = 1;
let timelineSearchValue = "";
let timelineBulan = "";

const timelineLimit = 10;

const timelineGroupedContainer =
  document.getElementById(
    "timelineGroupedContainer"
  );

// ======================================================
// FORMAT
// ======================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


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

  return date.toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  );
}


function tanggalInput(value) {
  if (!value) {
    return "";
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

  const awal =
    new Date(
      `${tanggalAwal}T00:00:00`
    );

  const akhir =
    new Date(
      `${tanggalAkhir}T00:00:00`
    );

  if (
    Number.isNaN(awal.getTime()) ||
    Number.isNaN(akhir.getTime())
  ) {
    return null;
  }

  return Math.ceil(
    (
      akhir.getTime() -
      awal.getTime()
    ) /
    86400000
  );
}


// ======================================================
// LOAD DATA
// ======================================================

async function loadTimelinePage() {
  timelineGroupedContainer.innerHTML = `
    <tr>
      <td
        colspan="11"
        class="empty-state"
      >
        Memuat Timeline...
      </td>
    </tr>
  `;

  try {
    const query =
      new URLSearchParams({
        page:
          String(timelinePage),

        limit:
          String(timelineLimit),

        search:
          timelineSearchValue,

        bulan:
          timelineBulan
      });

    const response =
      await fetch(
        `/api/timeline?${query}`
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil Timeline"
      );
    }

    renderTimelineTable(
      result.data || []
    );

    timelinePage =
      Number(
        result.pagination?.page ||
        1
      );

    timelineTotalPages =
      Number(
        result.pagination
          ?.total_pages ||
        1
      );

    renderTimelinePagination(
      result.pagination || {}
    );

  } catch (error) {
    console.error(
      "ERROR LOAD TIMELINE:",
      error
    );

   timelineGroupedContainer.innerHTML = `
  <div class="empty-state">
    ${escapeHtml(error.message)}
  </div>
`;
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

  // ====================================================
  // TANGGAL HARI INI
  // ====================================================

  const sekarang =
    new Date();

  const hariIni = [
    sekarang.getFullYear(),

    String(
      sekarang.getMonth() + 1
    ).padStart(2, "0"),

    String(
      sekarang.getDate()
    ).padStart(2, "0")
  ].join("-");


  // ====================================================
  // KELOMPOKKAN:
  // JENIS > SUB PROYEK > KATEGORI
  // ====================================================

  const grouped = {};

  data.forEach(item => {
    const jenis =
      String(
        item.jenis_proyek ||
        "Tanpa Jenis Proyek"
      ).trim();

    const subProyek =
      String(
        item.sub_jenis_proyek ||
        "Tanpa Sub Proyek"
      ).trim();

    const kategoriList =
      Array.isArray(item.kategori) &&
      item.kategori.length > 0
        ? item.kategori
        : ["Tanpa Kategori"];

    /*
     * Jika satu proyek memiliki beberapa kategori,
     * gabungkan sebagai satu nama kelompok.
     */
    const kategori =
      kategoriList
        .map(value =>
          String(value).trim()
        )
        .filter(Boolean)
        .join(", ") ||
      "Tanpa Kategori";

    if (!grouped[jenis]) {
      grouped[jenis] = {};
    }

    if (!grouped[jenis][subProyek]) {
      grouped[jenis][subProyek] = {};
    }

    if (
      !grouped[jenis][subProyek][kategori]
    ) {
      grouped[jenis][subProyek][kategori] =
        [];
    }

    grouped[jenis][subProyek][kategori]
      .push(item);
  });


  // ====================================================
  // RENDER KELOMPOK
  // ====================================================

  timelineGroupedContainer.innerHTML =
    Object.entries(grouped)
      .map(
        ([
          jenis,
          daftarSubProyek
        ]) => {
          const totalJenis =
            Object.values(
              daftarSubProyek
            ).reduce(
              (
                total,
                daftarKategori
              ) => {
                return (
                  total +
                  Object.values(
                    daftarKategori
                  ).reduce(
                    (
                      subtotal,
                      daftarTimeline
                    ) =>
                      subtotal +
                      daftarTimeline.length,
                    0
                  )
                );
              },
              0
            );

          return `
            <section class="timeline-type-group">

              <div class="timeline-type-header">

                <div>
                  ${escapeHtml(jenis)}
                </div>

                <div>
                  ${totalJenis} Timeline
                </div>

              </div>

              ${Object.entries(
                daftarSubProyek
              )
                .map(
                  ([
                    subProyek,
                    daftarKategori
                  ]) => {
                    const totalSub =
                      Object.values(
                        daftarKategori
                      ).reduce(
                        (
                          total,
                          daftarTimeline
                        ) =>
                          total +
                          daftarTimeline.length,
                        0
                      );

                    return `
                      <div class="timeline-sub-group">

                        <div class="timeline-sub-header">

                          <div>
                            ${escapeHtml(
                              subProyek
                            )}
                          </div>

                          <div>
                            ${totalSub} Timeline
                          </div>

                        </div>

                        <div class="timeline-category-list">

                          ${Object.entries(
                            daftarKategori
                          )
                            .map(
                              ([
                                kategori,
                                daftarTimeline
                              ]) =>
                                renderTimelineCategory(
                                  kategori,
                                  daftarTimeline,
                                  hariIni
                                )
                            )
                            .join("")}

                        </div>

                      </div>
                    `;
                  }
                )
                .join("")}

            </section>
          `;
        }
      )
      .join("");
}

function renderTimelineCategory(
  kategori,
  daftarTimeline,
  hariIni
) {
  return `
    <div class="timeline-category-card">

      <div class="timeline-category-header">

        <div>
          ${escapeHtml(kategori)}
        </div>

        <div>
          ${daftarTimeline.length}
          Timeline
        </div>

      </div>

      <div class="timeline-table-wrapper">

        <table class="timeline-detail-table">

          <thead>
            <tr>
              <th>Nama Proyek</th>
              <th>Deskripsi</th>
              <th>Tanggal Mulai</th>
              <th>Tanggal Akhir</th>
              <th>Durasi</th>
              <th>Berakhir Pada</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>

          <tbody>

            ${daftarTimeline
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

    </div>
  `;
}
function renderTimelineRow(
  item,
  hariIni
) {
  const tanggalMulai =
    tanggalInput(
      item.tanggal_mulai
    );

  const tanggalAkhir =
    tanggalInput(
      item.tanggal_akhir
    );

  const durasi =
    selisihHari(
      tanggalMulai,
      tanggalAkhir
    );

  const sisaHari =
    selisihHari(
      hariIni,
      tanggalAkhir
    );

  let berakhirPada = "-";
  let expiryClass = "";

  if (sisaHari !== null) {
    if (sisaHari < 0) {
      berakhirPada =
        `${Math.abs(
          sisaHari
        )} hari lalu`;

      expiryClass =
        "expiry-expired";

    } else if (sisaHari === 0) {
      berakhirPada =
        "Hari ini";

      expiryClass =
        "expiry-warning";

    } else {
      berakhirPada =
        `${sisaHari} hari lagi`;

      expiryClass =
        sisaHari <= 90
          ? "expiry-warning"
          : "expiry-safe";
    }
  }

  const status =
    String(
      item.status || "-"
    ).trim();

  const statusClass =
    status
      .toLowerCase()
      .replaceAll(
        " ",
        "-"
      );

  return `
    <tr>

      <td class="project-cell">

        <a
          href="/detail-proyek.html?id=${Number(
            item.proyek_id
          )}"
          class="project-link"
        >
          ${escapeHtml(
            item.nama_proyek ||
            "-"
          )}
        </a>

      </td>

      <td class="description-cell">
        ${escapeHtml(
          item.deskripsi ||
          "-"
        )}
      </td>

      <td>
        ${formatTanggal(
          item.tanggal_mulai
        )}
      </td>

      <td>
        ${formatTanggal(
          item.tanggal_akhir
        )}
      </td>

      <td>
        ${
          durasi !== null
            ? `${durasi} hari`
            : "-"
        }
      </td>

      <td>
        <span
          class="
            expiry-badge
            ${expiryClass}
          "
        >
          ${berakhirPada}
        </span>
      </td>

      <td>
        <span
          class="
            status-badge
            status-${statusClass}
          "
        >
          ${escapeHtml(status)}
        </span>
      </td>

      <td>
        <a
          href="/detail-proyek.html?id=${Number(
            item.proyek_id
          )}"
          class="detail-button"
        >
          Detail
        </a>
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
  const paginationElement =
    document.getElementById(
      "timelinePagination"
    );

  const totalData =
    Number(
      pagination.total_data || 0
    );

  if (totalData === 0) {
    paginationElement.style.display =
      "none";

    return;
  }

  const page =
    Number(pagination.page || 1);

  const limit =
    Number(
      pagination.limit ||
      timelineLimit
    );

  timelineTotalPages =
    Math.max(
      Number(
        pagination.total_pages || 1
      ),
      1
    );

  paginationElement.style.display =
    "flex";

  const mulai =
    (page - 1) * limit + 1;

  const akhir =
    Math.min(
      page * limit,
      totalData
    );

  document.getElementById(
    "timelinePaginationInfo"
  ).textContent =
    `Menampilkan ${mulai}-${akhir} dari ${totalData} Timeline`;

  const buttons =
    document.getElementById(
      "timelinePaginationButtons"
    );

  let html = `
    <button
      type="button"
      class="page-button"
      ${page <= 1 ? "disabled" : ""}
      onclick="
        ubahTimelinePage(
          ${page - 1}
        )
      "
    >
      ‹
    </button>
  `;

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
        onclick="
          ubahTimelinePage(${nomor})
        "
      >
        ${nomor}
      </button>
    `;
  }

  html += `
    <button
      type="button"
      class="page-button"
      ${
        page >= timelineTotalPages
          ? "disabled"
          : ""
      }
      onclick="
        ubahTimelinePage(
          ${page + 1}
        )
      "
    >
      ›
    </button>
  `;

  buttons.innerHTML = html;
}


function ubahTimelinePage(page) {
  if (
    page < 1 ||
    page > timelineTotalPages
  ) {
    return;
  }

  timelinePage = page;

  loadTimelinePage();
}


// ======================================================
// FILTER
// ======================================================

let timelineSearchTimer = null;

document.getElementById(
  "timelineSearch"
).addEventListener(
  "input",
  event => {
    clearTimeout(
      timelineSearchTimer
    );

    timelineSearchTimer =
      setTimeout(
        () => {
          timelineSearchValue =
            event.target.value.trim();

          timelinePage = 1;

          loadTimelinePage();
        },
        400
      );
  }
);


document.getElementById(
  "filterBerakhir"
).addEventListener(
  "change",
  event => {
    timelineBulan =
      event.target.value;

    timelinePage = 1;

    loadTimelinePage();
  }
);


document.getElementById(
  "resetTimelineFilter"
).addEventListener(
  "click",
  () => {
    document.getElementById(
      "timelineSearch"
    ).value = "";

    document.getElementById(
      "filterBerakhir"
    ).value = "";

    timelineSearchValue = "";
    timelineBulan = "";
    timelinePage = 1;

    loadTimelinePage();
  }
);


// ======================================================
// START
// ======================================================

loadTimelinePage();