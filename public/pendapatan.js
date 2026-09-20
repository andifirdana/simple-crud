// ======================================================
// PENDAPATAN
// GROUP:
// JENIS -> SUB JENIS -> KATEGORI -> TERMIN DIBAYAR
// ======================================================

let allPendapatan = [];
let filteredPendapatan = [];
let currentPagePendapatan = 1;

const itemsPerPagePendapatan = 20;


// ======================================================
// ELEMENT
// Sesuai ID pada pendapatan.html
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

const filterJenisPendapatan =
  document.getElementById(
    "filterJenisPendapatan"
  );

const filterStatusPengadaanPendapatan =
  document.getElementById(
    "filterStatusPengadaanPendapatan"
  );

const filterStatusTeknisPendapatan =
  document.getElementById(
    "filterStatusTeknisPendapatan"
  );

const resetPendapatanFilter =
  document.getElementById(
    "resetPendapatanFilter"
  );

const totalPendapatan =
  document.getElementById(
    "totalPendapatan"
  );

const jumlahProyekPendapatan =
  document.getElementById(
    "jumlahProyekPendapatan"
  );

const jumlahTerminDibayar =
  document.getElementById(
    "jumlahTerminDibayar"
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


function getTahun(value) {
  if (!value) {
    return null;
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


// ======================================================
// NORMALISASI DATA
// Agar tetap berjalan jika nama field API sedikit berbeda
// ======================================================

function getTanggalPendapatan(item) {
  return (
    item.tanggal_pendapatan ||
    item.tanggal_bayar ||
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


function statusSudahDibayar(item) {
  const status =
    String(
      item.status_pembayaran || ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  return (
    Boolean(item.tanggal_bayar) ||
    status === "dibayar" ||
    status === "sudah dibayar" ||
    status === "lunas" ||
    status === "paid"
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


// ======================================================
// LOAD PENDAPATAN
// ======================================================

async function loadPendapatan() {
  if (!pendapatanGroup) {
    console.error(
      "Element #pendapatanGroup tidak ditemukan."
    );

    return;
  }

  try {
    pendapatanGroup.innerHTML = `
      <div class="empty-state">
        Memuat data pendapatan...
      </div>
    `;

    const response =
      await fetch(
        "/api/pendapatan/detail",
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
      const responseText =
        await response.text();

      console.error(
        "RESPONSE BUKAN JSON:",
        responseText
      );

      throw new Error(
        `Endpoint /api/pendapatan/detail tidak ditemukan atau tidak mengembalikan JSON. Status: ${response.status}`
      );
    }

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil data pendapatan."
      );
    }

    allPendapatan =
      Array.isArray(
        result.pendapatan
      )
        ? result.pendapatan
        : [];

    loadPendapatanFilters();

    currentPagePendapatan = 1;

    applyPendapatanFilter();

  } catch (error) {
    console.error(
      "ERROR LOAD PENDAPATAN:",
      error
    );

    pendapatanGroup.innerHTML = `
      <div class="empty-state">
        Gagal mengambil data pendapatan:
        ${escapeHtml(error.message)}
      </div>
    `;

    if (pendapatanPagination) {
      pendapatanPagination.style.display =
        "none";
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

  if (
    Array.from(element.options)
      .some(
        option =>
          option.value ===
          previousValue
      )
  ) {
    element.value =
      previousValue;
  }
}


// ======================================================
// FILTER OPTIONS
// ======================================================

function loadPendapatanFilters() {
  const daftarTahun =
    [
      ...new Set(
        allPendapatan
          .map(item =>
            getTahun(
              getTanggalPendapatan(item)
            )
          )
          .filter(Boolean)
      )
    ].sort(
      (a, b) => b - a
    );

  isiSelectPendapatan(
    filterTahunPendapatan,
    daftarTahun,
    "Semua Tahun"
  );


  const daftarJenis =
    [
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


  const daftarPengadaan =
    [
      ...new Set(
        allPendapatan
          .map(item =>
            item.status_pengadaan
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
    filterStatusPengadaanPendapatan,
    daftarPengadaan,
    "Semua Status Pengadaan"
  );


  const daftarTeknis =
    [
      ...new Set(
        allPendapatan
          .map(item =>
            item.status_teknis
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
    filterStatusTeknisPendapatan,
    daftarTeknis,
    "Semua Status Teknis"
  );
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

  const tahun =
    filterTahunPendapatan?.value ||
    "";

  const jenis =
    filterJenisPendapatan?.value ||
    "";

  const pengadaan =
    filterStatusPengadaanPendapatan
      ?.value || "";

  const teknis =
    filterStatusTeknisPendapatan
      ?.value || "";

  filteredPendapatan =
    allPendapatan.filter(item => {
      const searchableText =
        [
          item.nama_proyek,
          item.nama_klien,
          item.jenis_proyek,
          item.sub_jenis_proyek,
          getKategoriPendapatan(item),
          item.nama_termin,
          item.status_pembayaran,
          item.status_pengadaan,
          item.status_teknis
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

      const itemTahun =
        getTahun(
          getTanggalPendapatan(item)
        );

      const matchSearch =
        !keyword ||
        searchableText.includes(
          keyword
        );

      const matchTahun =
        !tahun ||
        String(itemTahun) ===
          String(tahun);

      const matchJenis =
        !jenis ||
        String(
          item.jenis_proyek || ""
        ) === String(jenis);

      const matchPengadaan =
        !pengadaan ||
        String(
          item.status_pengadaan || ""
        ) === String(pengadaan);

      const matchTeknis =
        !teknis ||
        String(
          item.status_teknis || ""
        ) === String(teknis);

      return (
        matchSearch &&
        matchTahun &&
        matchJenis &&
        matchPengadaan &&
        matchTeknis
      );
    });

  /*
   * Urutkan berdasarkan tanggal pembayaran terbaru.
   */
  filteredPendapatan.sort(
    (a, b) => {
      const tanggalA =
        new Date(
          getTanggalPendapatan(a) || 0
        ).getTime();

      const tanggalB =
        new Date(
          getTanggalPendapatan(b) || 0
        ).getTime();

      return tanggalB - tanggalA;
    }
  );

  if (resetPage) {
    currentPagePendapatan = 1;
  }

  updatePendapatanSummary(
    filteredPendapatan
  );

  renderPendapatanPage();
}


// ======================================================
// SUMMARY
// ======================================================

function updatePendapatanSummary(data) {
  const total =
    data.reduce(
      (sum, item) =>
        sum +
        getNilaiPendapatan(item),
      0
    );

  const proyekIds =
    new Set(
      data
        .map(item =>
          Number(item.proyek_id)
        )
        .filter(Number.isFinite)
    );

  if (totalPendapatan) {
    totalPendapatan.textContent =
      formatRupiah(total);
  }

  if (jumlahProyekPendapatan) {
    jumlahProyekPendapatan.textContent =
      proyekIds.size;
  }

  if (jumlahTerminDibayar) {
    jumlahTerminDibayar.textContent =
      data.length;
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


// ======================================================
// RENDER TABLE
// ======================================================

function renderPendapatanTable(data) {
  return `
    <div class="table-wrapper">

      <table class="prognosa-table">

        <thead>
          <tr>
            <th>Proyek</th>
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
              const persentase =
                item.persentase !== null &&
                item.persentase !== undefined &&
                Number.isFinite(
                  Number(item.persentase)
                )
                  ? `${Number(
                      item.persentase
                    ).toFixed(2)}%`
                  : "-";

              const proyekId =
                Number(item.proyek_id);

              const detailLink =
                Number.isInteger(proyekId) &&
                proyekId > 0
                  ? `/detail-proyek.html?id=${proyekId}`
                  : "#";

              return `
                <tr>

                  <td class="proyek-name">
                    ${
                      proyekId > 0
                        ? `
                          <a
                            href="${detailLink}"
                            class="project-link"
                          >
                            ${escapeHtml(
                              item.nama_proyek ||
                              "-"
                            )}
                          </a>
                        `
                        : escapeHtml(
                            item.nama_proyek ||
                            "-"
                          )
                    }
                  </td>

                  <td>
                    ${escapeHtml(
                      item.nama_klien ||
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
                      getTanggalPendapatan(
                        item
                      )
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
                      proyekId > 0
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
// PAGINATION
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
    searchPendapatan.value = "";
  }

  if (filterTahunPendapatan) {
    filterTahunPendapatan.value =
      "";
  }

  if (filterJenisPendapatan) {
    filterJenisPendapatan.value =
      "";
  }

  if (
    filterStatusPengadaanPendapatan
  ) {
    filterStatusPengadaanPendapatan
      .value = "";
  }

  if (filterStatusTeknisPendapatan) {
    filterStatusTeknisPendapatan
      .value = "";
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


if (filterJenisPendapatan) {
  filterJenisPendapatan.addEventListener(
    "change",
    () => applyPendapatanFilter()
  );
}


if (
  filterStatusPengadaanPendapatan
) {
  filterStatusPengadaanPendapatan
    .addEventListener(
      "change",
      () => applyPendapatanFilter()
    );
}


if (filterStatusTeknisPendapatan) {
  filterStatusTeknisPendapatan
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