// ======================================================
// PARTNER PROYEK
// ======================================================

let currentPage = 1;

let totalPages = 1;

let searchValue = "";

const pageLimit = 10;


// ======================================================
// ELEMENT
// ======================================================

const partnerList =
  document.getElementById(
    "partnerList"
  );

const partnerSearch =
  document.getElementById(
    "partnerSearch"
  );

const pagination =
  document.getElementById(
    "partnerPagination"
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
// NUMBER
// ======================================================

function angka(value) {
  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}


// ======================================================
// FORMAT RUPIAH
// ======================================================

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


// ======================================================
// PARSE TANGGAL
// ======================================================

function parseTanggal(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value);

  const dateOnly =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (dateOnly) {
    const result =
      new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3])
      );

    return Number.isNaN(
      result.getTime()
    )
      ? null
      : result;
  }

  const result =
    new Date(value);

  return Number.isNaN(
    result.getTime()
  )
    ? null
    : result;
}


// ======================================================
// FORMAT TANGGAL
// ======================================================

function tanggal(value) {
  const date =
    parseTanggal(value);

  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);
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


// ======================================================
// NORMALISASI STATUS
// ======================================================

function normalisasiStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


// ======================================================
// JANGKA WAKTU
// ======================================================

function hitungJangkaWaktu(
  tanggalMulai,
  tanggalAkhir
) {
  const mulai =
    parseTanggal(
      tanggalMulai
    );

  const akhir =
    parseTanggal(
      tanggalAkhir
    );

  if (
    !mulai ||
    !akhir ||
    akhir < mulai
  ) {
    return "-";
  }

  const selisihHari =
    Math.floor(
      (
        akhir.getTime() -
        mulai.getTime()
      ) /
      86400000
    ) + 1;

  if (selisihHari < 30) {
    return `${selisihHari} hari`;
  }

  const bulan =
    Math.floor(
      selisihHari / 30
    );

  const sisaHari =
    selisihHari % 30;

  if (bulan < 12) {
    return sisaHari > 0
      ? `${bulan} bulan ${sisaHari} hari`
      : `${bulan} bulan`;
  }

  const tahun =
    Math.floor(
      bulan / 12
    );

  const sisaBulan =
    bulan % 12;

  return sisaBulan > 0
    ? `${tahun} tahun ${sisaBulan} bulan`
    : `${tahun} tahun`;
}


// ======================================================
// NILAI PROYEK
// ======================================================

function nilaiProyek(item) {
  return angka(
    item.nilai_proyek ??
    item.nilai_partner ??
    item.nilai_final_partner
  );
}


// ======================================================
// SUDAH DIBAYAR
// ======================================================

function nilaiSudahDibayar(item) {
  return angka(
    item.sudah_dibayar ??
    item.total_dibayar ??
    item.dibayar_partner
  );
}


// ======================================================
// GABUNGKAN PROYEK PARTNER
// ======================================================

function getSemuaProyek(partner) {
  /*
    Mendukung dua format API:

    1. partner.proyek berisi seluruh proyek.

    2. API memisahkan:
       partner.proyek_aktif
       partner.proyek_selesai
       partner.proyek_cancel
  */

  if (
    Array.isArray(
      partner.proyek
    )
  ) {
    return partner.proyek;
  }

  const active =
    Array.isArray(
      partner.proyek_aktif
    )
      ? partner.proyek_aktif
      : [];

  const done =
    Array.isArray(
      partner.proyek_selesai
    )
      ? partner.proyek_selesai
      : Array.isArray(
          partner.proyek_done
        )
        ? partner.proyek_done
        : [];

  const cancel =
    Array.isArray(
      partner.proyek_cancel
    )
      ? partner.proyek_cancel
      : [];

  return [
    ...active,
    ...done,
    ...cancel
  ];
}


// ======================================================
// KELOMPOKKAN PROYEK
// ======================================================

function kelompokkanProyek(partner) {
  const semuaProyek =
    getSemuaProyek(partner);

  const proyekAktif = [];

  const proyekDone = [];

  const proyekCancel = [];

  semuaProyek.forEach(item => {
    const status =
      normalisasiStatus(
        item.status_final
      );

    if (
      status === "done" ||
      status === "selesai"
    ) {
      proyekDone.push(item);

    } else if (
      status === "cancel" ||
      status === "batal"
    ) {
      proyekCancel.push(item);

    } else {
      /*
        Data lama dari endpoint proyek aktif
        belum mempunyai status_final.

        Jika status kosong, sementara
        dimasukkan sebagai Aktif.
      */

      proyekAktif.push(item);
    }
  });

  return {
    semuaProyek,
    proyekAktif,
    proyekDone,
    proyekCancel
  };
}


// ======================================================
// HITUNG SUMMARY STATUS
// ======================================================

function hitungSummaryStatus(proyek) {
  return {
    total:
      proyek.length,

    nilai:
      proyek.reduce(
        (total, item) =>
          total +
          nilaiProyek(item),
        0
      )
  };
}


// ======================================================
// LOAD PARTNER
// ======================================================

async function loadPartner() {
  if (!partnerList) {
    console.error(
      "Element #partnerList tidak ditemukan."
    );

    return;
  }

  partnerList.innerHTML = `
    <div class="empty-state">
      Memuat data partner...
    </div>
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
        `/api/partner-proyek-aktif?${query.toString()}`,
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
        `Server tidak mengembalikan JSON. Status ${response.status}`
      );
    }

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil data partner."
      );
    }

    renderPartner(
      Array.isArray(result.data)
        ? result.data
        : []
    );

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

    renderPagination(
      result.pagination
    );

  } catch (error) {
    console.error(
      "ERROR LOAD PARTNER:",
      error
    );

    partnerList.innerHTML = `
      <div class="empty-state">
        Gagal mengambil data partner:
        ${escapeHtml(error.message)}
      </div>
    `;

    if (pagination) {
      pagination.style.display =
        "none";
    }
  }
}


// ======================================================
// RENDER SUMMARY STATUS
// ======================================================

function renderStatusSummary(
  className,
  label,
  summary
) {
  return `
    <div
      class="
        status-summary-card
        ${className}
      "
    >

      <div class="status-summary-label">

        <span class="status-summary-dot"></span>

        ${escapeHtml(label)}

      </div>

      <strong class="status-summary-count">
        ${summary.total}
      </strong>

      <span class="status-summary-value-label">
        Nilai Proyek
      </span>

      <strong class="status-summary-value">
        ${rupiah(summary.nilai)}
      </strong>

    </div>
  `;
}


// ======================================================
// STATUS BADGE
// ======================================================

function statusBadge(status) {
  const normalized =
    normalisasiStatus(status);

  let className =
    "active";

  let label =
    status || "Aktif";

  if (
    normalized === "done" ||
    normalized === "selesai"
  ) {
    className =
      "done";

    label =
      "Done";

  } else if (
    normalized === "cancel" ||
    normalized === "batal"
  ) {
    className =
      "cancel";

    label =
      "Cancel";
  }

  return `
    <span
      class="
        status-badge
        ${className}
      "
    >
      ${escapeHtml(label)}
    </span>
  `;
}


// ======================================================
// RENDER TABLE ROW
// ======================================================

function renderProjectRows(
  proyek,
  emptyMessage
) {
  if (
    !Array.isArray(proyek) ||
    proyek.length === 0
  ) {
    return `
      <tr>

        <td
          colspan="6"
          class="table-empty"
        >
          ${escapeHtml(emptyMessage)}
        </td>

      </tr>
    `;
  }

  return proyek.map(item => {
    const proyekId =
      Number(
        item.proyek_id ??
        item.id
      );

    return `
      <tr>

        <td>

          ${
            Number.isInteger(
              proyekId
            ) &&
            proyekId > 0
              ? `
                <a
                  href="/detail-proyek.html?id=${encodeURIComponent(
                    proyekId
                  )}"
                  class="
                    project-link
                    project-name
                  "
                >
                  ${escapeHtml(
                    item.nama_proyek ||
                    "-"
                  )}
                </a>
              `
              : `
                <span class="project-name">
                  ${escapeHtml(
                    item.nama_proyek ||
                    "-"
                  )}
                </span>
              `
          }

        </td>

        <td class="money-value">
          ${rupiah(
            nilaiProyek(item)
          )}
        </td>

        <td>
          ${tanggal(
            item.tanggal_mulai
          )}
        </td>

        <td>
          ${tanggal(
            item.tanggal_akhir
          )}
        </td>

        <td>
          ${hitungJangkaWaktu(
            item.tanggal_mulai,
            item.tanggal_akhir
          )}
        </td>

        <td>
          ${statusBadge(
            item.status_final
          )}
        </td>

      </tr>
    `;
  }).join("");
}


// ======================================================
// RENDER PROJECT SECTION
// ======================================================

function renderProjectSection({
  className,
  title,
  projects,
  emptyMessage
}) {
  return `
    <section
      class="
        project-status-section
        ${className}
      "
    >

      <div class="project-section-header">

        <h3 class="project-section-title">
          ${escapeHtml(title)}
        </h3>

        <span class="project-count-badge">
          ${projects.length} proyek
        </span>

      </div>


      <div class="table-wrapper">

        <table>

          <thead>

            <tr>

              <th>Nama Proyek</th>

              <th>Nilai Proyek</th>

              <th>Tanggal Mulai</th>

              <th>Tanggal Akhir</th>

              <th>Jangka Waktu</th>

              <th>Status</th>

            </tr>

          </thead>


          <tbody>

            ${renderProjectRows(
              projects,
              emptyMessage
            )}

          </tbody>

        </table>

      </div>

    </section>
  `;
}


// ======================================================
// RENDER PARTNER
// ======================================================

function renderPartner(data) {
  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    partnerList.innerHTML = `
      <div class="empty-state">
        Tidak ada partner yang ditemukan.
      </div>
    `;

    return;
  }

  partnerList.innerHTML =
    data.map(partner => {
      const {
        semuaProyek,
        proyekAktif,
        proyekDone,
        proyekCancel
      } =
        kelompokkanProyek(partner);

      const activeSummary =
        hitungSummaryStatus(
          proyekAktif
        );

      const doneSummary =
        hitungSummaryStatus(
          proyekDone
        );

      const cancelSummary =
        hitungSummaryStatus(
          proyekCancel
        );

      const totalNilaiProyek =
        semuaProyek.reduce(
          (total, item) =>
            total +
            nilaiProyek(item),
          0
        );

      const totalSudahDibayar =
        partner.sudah_dibayar !==
          null &&
        partner.sudah_dibayar !==
          undefined
          ? angka(
              partner.sudah_dibayar
            )
          : semuaProyek.reduce(
              (total, item) =>
                total +
                nilaiSudahDibayar(item),
              0
            );

      const totalSisa =
        partner.sisa !== null &&
        partner.sisa !== undefined
          ? angka(
              partner.sisa
            )
          : Math.max(
              totalNilaiProyek -
              totalSudahDibayar,
              0
            );

      return `
        <article class="partner-card">


          <!-- PARTNER HEADER -->

          <div class="partner-card-header">

            <div>

              <div class="partner-name">
                ${escapeHtml(
                  partner.nama_partner ||
                  "-"
                )}
              </div>

              <div class="partner-code">
                ${escapeHtml(
                  partner.inisial ||
                  ""
                )}
              </div>

            </div>


            <div class="project-total-badge">
              ${semuaProyek.length}
              Total Proyek
            </div>

          </div>


          <!-- STATUS SUMMARY -->

          <div class="partner-status-summary">

            ${renderStatusSummary(
              "active",
              "Total Proyek Aktif",
              activeSummary
            )}

            ${renderStatusSummary(
              "done",
              "Total Proyek Selesai",
              doneSummary
            )}

            ${renderStatusSummary(
              "cancel",
              "Total Proyek Cancel",
              cancelSummary
            )}

          </div>


          <!-- FINANCE SUMMARY -->

          <div class="partner-summary">

            <div class="summary-item">

              <div class="summary-label">
                Total Semua Proyek
              </div>

              <div class="summary-value">
                ${semuaProyek.length}
              </div>

            </div>


            <div class="summary-item">

              <div class="summary-label">
                Total Nilai Proyek
              </div>

              <div class="summary-value">
                ${rupiah(
                  totalNilaiProyek
                )}
              </div>

            </div>


            <div class="summary-item paid">

              <div class="summary-label">
                Sudah Dibayar
              </div>

              <div class="summary-value">
                ${rupiah(
                  totalSudahDibayar
                )}
              </div>

            </div>


            <div class="summary-item remaining">

              <div class="summary-label">
                Sisa
              </div>

              <div class="summary-value">
                ${rupiah(
                  totalSisa
                )}
              </div>

            </div>

          </div>


          <!-- PROYEK AKTIF -->

          ${renderProjectSection({
            className:
              "active",

            title:
              "Daftar Proyek Aktif",

            projects:
              proyekAktif,

            emptyMessage:
              "Tidak ada proyek aktif."
          })}


          <!-- PROYEK SELESAI -->

          ${renderProjectSection({
            className:
              "done",

            title:
              "Daftar Proyek Selesai",

            projects:
              proyekDone,

            emptyMessage:
              "Tidak ada proyek selesai."
          })}


          <!-- PROYEK CANCEL -->

          ${renderProjectSection({
            className:
              "cancel",

            title:
              "Daftar Proyek Cancel",

            projects:
              proyekCancel,

            emptyMessage:
              "Tidak ada proyek cancel."
          })}


        </article>
      `;
    }).join("");
}


// ======================================================
// PAGINATION
// ======================================================

function renderPagination(data = {}) {
  if (
    !pagination ||
    !paginationInfo ||
    !paginationButtons
  ) {
    return;
  }

  const totalData =
    angka(
      data.total_data
    );

  const page =
    Math.max(
      angka(data.page) || 1,
      1
    );

  const limit =
    Math.max(
      angka(data.limit) ||
      pageLimit,
      1
    );

  totalPages =
    Math.max(
      angka(
        data.total_pages
      ) || 1,
      1
    );

  if (totalData === 0) {
    pagination.style.display =
      "none";

    return;
  }

  pagination.style.display =
    "flex";

  const start =
    (
      page - 1
    ) *
    limit +
    1;

  const end =
    Math.min(
      page * limit,
      totalData
    );

  paginationInfo.textContent =
    `Menampilkan ${start}-${end} dari ${totalData} partner`;

  let html = `
    <button
      type="button"
      class="page-button"
      data-page="${page - 1}"
      ${page <= 1 ? "disabled" : ""}
    >
      ‹
    </button>
  `;

  const firstPage =
    Math.max(
      1,
      page - 2
    );

  const lastPage =
    Math.min(
      totalPages,
      page + 2
    );

  for (
    let number = firstPage;
    number <= lastPage;
    number += 1
  ) {
    html += `
      <button
        type="button"
        class="
          page-button
          ${
            number === page
              ? "active"
              : ""
          }
        "
        data-page="${number}"
      >
        ${number}
      </button>
    `;
  }

  html += `
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
  `;

  paginationButtons.innerHTML =
    html;

  paginationButtons
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          if (button.disabled) {
            return;
          }

          ubahHalaman(
            Number(
              button.dataset.page
            )
          );
        }
      );
    });
}


// ======================================================
// UBAH HALAMAN
// ======================================================

function ubahHalaman(page) {
  if (
    page < 1 ||
    page > totalPages
  ) {
    return;
  }

  currentPage =
    page;

  loadPartner();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ======================================================
// SEARCH
// ======================================================

let searchTimer = null;

if (partnerSearch) {
  partnerSearch.addEventListener(
    "input",
    event => {
      clearTimeout(
        searchTimer
      );

      searchTimer =
        setTimeout(
          () => {
            searchValue =
              event.target
                .value
                .trim();

            currentPage = 1;

            loadPartner();
          },
          400
        );
    }
  );
}


// ======================================================
// START
// ======================================================

loadPartner();