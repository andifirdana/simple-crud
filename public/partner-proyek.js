let currentPage = 1;
let totalPages = 1;
let searchValue = "";

const pageLimit = 10;

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


// ======================================================
// FORMAT
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
    Number(value || 0)
  );
}


function tanggal(value) {
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


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ======================================================
// JANGKA WAKTU
// ======================================================

function hitungJangkaWaktu(
  tanggalMulai,
  tanggalAkhir
) {
  if (
    !tanggalMulai ||
    !tanggalAkhir
  ) {
    return "-";
  }

  const mulai =
    new Date(tanggalMulai);

  const akhir =
    new Date(tanggalAkhir);

  if (
    Number.isNaN(mulai.getTime()) ||
    Number.isNaN(akhir.getTime()) ||
    akhir < mulai
  ) {
    return "-";
  }

  const selisihHari =
    Math.ceil(
      (
        akhir.getTime() -
        mulai.getTime()
      ) /
      86400000
    );

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
// LOAD PARTNER
// ======================================================

async function loadPartner() {
  partnerList.innerHTML = `
    <div class="empty-state">
      Memuat data Partner...
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
        `/api/partner-proyek-aktif?${query}`
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil data Partner"
      );
    }

    renderPartner(
      result.data || []
    );

    currentPage =
      Number(
        result.pagination?.page ||
        1
      );

    totalPages =
      Number(
        result.pagination
          ?.total_pages ||
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
        Gagal mengambil data Partner:
        ${escapeHtml(error.message)}
      </div>
    `;
  }
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
        Tidak ada Partner dengan proyek aktif.
      </div>
    `;

    return;
  }

  partnerList.innerHTML =
    data.map(partner => {
      const proyek =
        Array.isArray(partner.proyek)
          ? partner.proyek
          : [];

      return `
        <article class="partner-card">

          <div class="partner-card-header">

            <div>
              <div class="partner-name">
                ${
                  escapeHtml(
                    partner.nama_partner ||
                    "-"
                  )
                }
              </div>

              <div class="partner-code">
                ${
                  escapeHtml(
                    partner.inisial ||
                    ""
                  )
                }
              </div>
            </div>

            <div class="project-total-badge">
              ${Number(
                partner.total_proyek || 0
              )} Proyek Aktif
            </div>

          </div>

          <div class="partner-summary">

            <div class="summary-item">
              <div class="summary-label">
                Total Proyek
              </div>

              <div class="summary-value">
                ${Number(
                  partner.total_proyek || 0
                )}
              </div>
            </div>

            <div class="summary-item">
              <div class="summary-label">
                Nilai Proyek
              </div>

              <div class="summary-value">
                ${rupiah(
                  partner.nilai_proyek
                )}
              </div>
            </div>

            <div class="summary-item paid">
              <div class="summary-label">
                Sudah Dibayar
              </div>

              <div class="summary-value">
                ${rupiah(
                  partner.sudah_dibayar
                )}
              </div>
            </div>

            <div class="summary-item remaining">
              <div class="summary-label">
                Sisa
              </div>

              <div class="summary-value">
                ${rupiah(
                  partner.sisa
                )}
              </div>
            </div>

          </div>

          <div class="project-section">

            <div class="project-section-title">
              Daftar Proyek Aktif
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
                  </tr>
                </thead>

                <tbody>

                  ${proyek.map(item => `
                    <tr>

                      <td>
                        <a
                          href="/detail-proyek.html?id=${Number(
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
                        ${rupiah(
                          item.nilai_proyek
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

                    </tr>
                  `).join("")}

                </tbody>

              </table>

            </div>

          </div>

        </article>
      `;
    }).join("");
}


// ======================================================
// PAGINATION
// ======================================================

function renderPagination(data = {}) {
  const totalData =
    Number(data.total_data || 0);

  const page =
    Number(data.page || 1);

  const limit =
    Number(data.limit || pageLimit);

  totalPages =
    Math.max(
      Number(data.total_pages || 1),
      1
    );

  if (totalData === 0) {
    pagination.style.display =
      "none";

    return;
  }

  pagination.style.display =
    "flex";

  const mulai =
    (page - 1) * limit + 1;

  const akhir =
    Math.min(
      page * limit,
      totalData
    );

  document.getElementById(
    "paginationInfo"
  ).textContent =
    `Menampilkan ${mulai}-${akhir} dari ${totalData} Partner`;

  const buttons =
    document.getElementById(
      "paginationButtons"
    );

  let html = `
    <button
      type="button"
      class="page-button"
      ${page <= 1 ? "disabled" : ""}
      onclick="ubahHalaman(${page - 1})"
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
      totalPages,
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
        onclick="ubahHalaman(${nomor})"
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
        page >= totalPages
          ? "disabled"
          : ""
      }
      onclick="ubahHalaman(${page + 1})"
    >
      ›
    </button>
  `;

  buttons.innerHTML = html;
}


function ubahHalaman(page) {
  if (
    page < 1 ||
    page > totalPages
  ) {
    return;
  }

  currentPage = page;

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

partnerSearch.addEventListener(
  "input",
  event => {
    clearTimeout(searchTimer);

    searchTimer =
      setTimeout(
        () => {
          searchValue =
            event.target.value.trim();

          currentPage = 1;

          loadPartner();
        },
        400
      );
  }
);


// ======================================================
// START
// ======================================================

loadPartner();