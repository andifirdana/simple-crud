// ======================================================
// STATE
// ======================================================

let currentPage = 1;
let totalPages = 1;
let searchValue = "";

const pageLimit = 15;


// ======================================================
// ELEMENT
// ======================================================

const proyekTable =
  document.getElementById(
    "proyekTable"
  );

const searchProyek =
  document.getElementById(
    "searchProyek"
  );

const periodeBerjalan =
  document.getElementById(
    "periodeBerjalan"
  );

const totalProyek =
  document.getElementById(
    "totalProyek"
  );

const pagination =
  document.getElementById(
    "pagination"
  );

const paginationInfo =
  document.getElementById(
    "paginationInfo"
  );

const paginationButtons =
  document.getElementById(
    "paginationButtons"
  );


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


// ======================================================
// PARSE TANGGAL
// Menghindari tanggal bergeser karena timezone
// ======================================================

function parseTanggal(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value);


  if (
    /^\d{4}-\d{2}-\d{2}$/.test(text)
  ) {
    const [
      tahun,
      bulan,
      tanggal
    ] = text
      .split("-")
      .map(Number);

    return new Date(
      tahun,
      bulan - 1,
      tanggal
    );
  }


  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date;
}


// ======================================================
// FORMAT TANGGAL
// ======================================================

function formatTanggal(value) {
  const date =
    parseTanggal(value);

  if (!date) {
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
// FORMAT TANGGAL DAN JAM
// ======================================================

function formatTanggalWaktu(value) {
  if (!value) {
    return "Belum pernah";
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

  const bagian =
    new Intl.DateTimeFormat(
      "id-ID",
      {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone:
          "Asia/Jakarta"
      }
    ).formatToParts(date);


  const getPart =
    type =>
      bagian.find(
        item =>
          item.type === type
      )?.value || "";


  return (
    `${getPart("weekday")}, ` +
    `${getPart("day")} ` +
    `${getPart("month")} ` +
    `${getPart("year")} ` +
    `${getPart("hour")}:` +
    `${getPart("minute")}`
  );
}


// ======================================================
// FORMAT PERIODE
// ======================================================

function formatPeriode(
  tanggalMulai,
  tanggalAkhir
) {
  if (
    !tanggalMulai ||
    !tanggalAkhir
  ) {
    return "-";
  }

  return (
    `${formatTanggal(tanggalMulai)} - ` +
    `${formatTanggal(tanggalAkhir)}`
  );
}


// ======================================================
// STATUS CLASS
// ======================================================

function statusClass(value) {
  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    status === "done" ||
    status === "selesai"
  ) {
    return "badge-done";
  }

  if (
    status === "cancel" ||
    status === "batal"
  ) {
    return "badge-cancel";
  }

  return "badge-active";
}


// ======================================================
// LOAD DATA
// ======================================================

async function loadProyek() {
  proyekTable.innerHTML = `
    <tr>
      <td
        colspan="9"
        class="empty-state"
      >
        Memuat data proyek...
      </td>
    </tr>
  `;


  try {
    const query =
      new URLSearchParams({
        page:
          String(currentPage),

        limit:
          String(pageLimit),

        search:
          searchValue
      });


    const response =
      await fetch(
        `/api/proyek-belum-update?${query}`,
        {
          headers: {
            Accept:
              "application/json"
          },

          cache:
            "no-store"
        }
      );


    if (response.status === 401) {
      window.location.href =
        "/login.html";

      return;
    }


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil data proyek."
      );
    }


    currentPage =
      Number(
        result.pagination?.page ||
        1
      );


    totalPages =
      Math.max(
        Number(
          result.pagination
            ?.total_pages ||
          1
        ),
        1
      );


    const totalData =
      Number(
        result.pagination
          ?.total_data ||
        0
      );


    totalProyek.textContent =
      totalData;


    periodeBerjalan.textContent =
      formatPeriode(
        result.periode
          ?.tanggal_mulai,

        result.periode
          ?.tanggal_akhir
      );


    renderTable(
      result.data || []
    );


    renderPagination(
      result.pagination || {}
    );

  } catch (error) {
    console.error(
      "ERROR LOAD PROYEK BELUM UPDATE:",
      error
    );


    proyekTable.innerHTML = `
      <tr>
        <td
          colspan="9"
          class="empty-state"
        >
          Gagal mengambil data:
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;


    pagination.style.display =
      "none";
  }
}


// ======================================================
// RENDER TABLE
// ======================================================

function renderTable(data) {
  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    proyekTable.innerHTML = `
      <tr>
        <td
          colspan="9"
          class="empty-state"
        >
          Semua proyek sudah diperbarui
          pada periode berjalan.
        </td>
      </tr>
    `;

    return;
  }


  const startNumber =
    (
      currentPage - 1
    ) *
    pageLimit;


  proyekTable.innerHTML =
    data.map(
      (item, index) => {
        const categories =
          Array.isArray(
            item
              .nama_kategori_produk_list
          )
            ? item
                .nama_kategori_produk_list
            : [];


        const kategoriText =
          categories.length > 0
            ? categories.join(", ")
            : (
                item
                  .nama_kategori_produk ||
                "-"
              );


        const picList =
          Array.isArray(
            item.nama_pic_list
          )
            ? item.nama_pic_list
            : [];


        const picText =
          picList.length > 0
            ? picList.join(", ")
            : (
                item.nama_pic ||
                "-"
              );


        const jenis =
          item.sub_jenis_proyek
            ? (
                `${item.jenis_proyek || "-"} / ` +
                `${item.sub_jenis_proyek}`
              )
            : (
                item.jenis_proyek ||
                "-"
              );


        const status =
          item.status_final ||
          "-";


        const jumlahHari =
          Number(
            item
              .tidak_diupdate_selama_hari ||
            0
          );


        return `
          <tr>

            <td>
              ${startNumber + index + 1}
            </td>

            <td>
              <a
                href="/detail-proyek.html?id=${encodeURIComponent(
                  item.proyek_id
                )}"
                class="project-link project-name"
              >
                ${escapeHtml(
                  item.nama_proyek ||
                  "-"
                )}
              </a>
            </td>

            <td>
              ${escapeHtml(
                kategoriText
              )}
            </td>

            <td>
              ${escapeHtml(jenis)}
            </td>

            <td>
              ${escapeHtml(picText)}
            </td>

            <td>
              <span
                class="
                  badge
                  ${statusClass(status)}
                "
              >
                ${escapeHtml(status)}
              </span>
            </td>

            <td>
              ${formatTanggalWaktu(
                item.last_update
              )}
            </td>

            <td>
              <span class="late-duration">
                ${
                  jumlahHari > 0
                    ? `${jumlahHari} hari`
                    : "Belum pernah"
                }
              </span>
            </td>

            <td>
              <a
                href="/detail-proyek.html?id=${encodeURIComponent(
                  item.proyek_id
                )}"
                class="project-link"
              >
                Detail
              </a>
            </td>

          </tr>
        `;
      }
    ).join("");
}


// ======================================================
// PAGINATION
// ======================================================

function renderPagination(data) {
  const totalData =
    Number(
      data.total_data || 0
    );

  const page =
    Number(
      data.page || 1
    );

  const limit =
    Number(
      data.limit ||
      pageLimit
    );


  if (
    totalData <= limit
  ) {
    pagination.style.display =
      "none";

    return;
  }


  pagination.style.display =
    "flex";


  const mulai =
    (page - 1) *
    limit + 1;


  const akhir =
    Math.min(
      page * limit,
      totalData
    );


  paginationInfo.textContent =
    `Menampilkan ${mulai}-${akhir} dari ${totalData} proyek`;


  const buttons = [];


  buttons.push(`
    <button
      type="button"
      class="page-button"
      data-page="${page - 1}"
      ${page <= 1 ? "disabled" : ""}
    >
      ‹
    </button>
  `);


  const pageStart =
    Math.max(
      1,
      page - 2
    );


  const pageEnd =
    Math.min(
      totalPages,
      page + 2
    );


  for (
    let nomor = pageStart;
    nomor <= pageEnd;
    nomor += 1
  ) {
    buttons.push(`
      <button
        type="button"
        class="
          page-button
          ${
            nomor === page
              ? "active"
              : ""
          }
        "
        data-page="${nomor}"
      >
        ${nomor}
      </button>
    `);
  }


  buttons.push(`
    <button
      type="button"
      class="page-button"
      data-page="${page + 1}"
      ${
        page >= totalPages
          ? "disabled"
          : ""
      }
    >
      ›
    </button>
  `);


  paginationButtons.innerHTML =
    buttons.join("");
}


// ======================================================
// EVENT PAGINATION
// ======================================================

paginationButtons.addEventListener(
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
      page < 1 ||
      page > totalPages
    ) {
      return;
    }


    currentPage = page;

    loadProyek();


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }
);


// ======================================================
// SEARCH
// ======================================================

let searchTimer = null;


searchProyek.addEventListener(
  "input",
  event => {
    clearTimeout(
      searchTimer
    );


    searchTimer =
      setTimeout(
        () => {
          searchValue =
            event.target.value
              .trim();

          currentPage = 1;

          loadProyek();
        },
        400
      );
  }
);


// ======================================================
// START
// ======================================================

loadProyek();