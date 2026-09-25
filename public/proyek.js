// ======================================================
// DATA DAN PAGINATION
// ======================================================

let allProyek = [];

let currentPage = 1;

const itemsPerPage = 15;


// ======================================================
// FILTER DARI URL DASHBOARD
// ======================================================

const proyekUrlParams =
  new URLSearchParams(
    window.location.search
  );

const urlStatusPengadaan =
  proyekUrlParams.get(
    "status_pengadaan"
  ) || "";

const urlStatusFinal =
  proyekUrlParams.get(
    "status_final"
  ) || "";

const urlProyekTerlambat =
  proyekUrlParams.get(
    "terlambat"
  ) || "";
  

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


// ======================================================
// ESCAPE HTML
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


// ======================================================
// FORMAT RUPIAH
// ======================================================

function formatRupiah(value) {

  const number =
    Number(value) || 0;


  return new Intl.NumberFormat(
    "id-ID",
    {
      style:
        "currency",

      currency:
        "IDR",

      maximumFractionDigits:
        0
    }
  ).format(
    number
  );

}


// ======================================================
// FORMAT TANGGAL
// ======================================================

function formatTanggal(value) {
  if (!value) {
    return "-";
  }

  const text = String(value);

  // Jika database mengirim format DATE: 2026-11-30
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [tahun, bulan, tanggal] = text.split("-");

    return `${tanggal}/${bulan}/${tahun}`;
  }

  // Jika database mengirim timestamp UTC
  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jakarta"
  }).format(date);
}


// ======================================================
// KONVERSI DATA LIST
// KATEGORI DAN PARTNER
// ======================================================

function listValue(
  item,
  arrayKey,
  textKey
) {

  if (
    Array.isArray(
      item[arrayKey]
    )
  ) {

    return item[arrayKey]
      .filter(Boolean);

  }


  return String(
    item[textKey] || ""
  )
    .split(",")
    .map(value =>
      value.trim()
    )
    .filter(Boolean);

}


// ======================================================
// NILAI FINAL
// MENGAMBIL NEGO TERAKHIR
// ======================================================

function finalValue(
  item,
  prefix
) {

  const directValue =
    item[
      `nilai_final_${prefix}`
    ];


  if (
    directValue !== null &&
    directValue !== undefined &&
    directValue !== ""
  ) {

    const number =
      Number(
        directValue
      );


    if (
      Number.isFinite(
        number
      )
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
      Number(
        item[key]
      );


    if (
      Number.isFinite(value) &&
      value > 0
    ) {

      return value;

    }

  }


  return 0;

}


// ======================================================
// NILAI PROYEK / KLIEN
// ======================================================

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
    item.nilai_proyek
  ) || 0;

}


// ======================================================
// TOTAL NILAI PARTNER
// ======================================================

function partnerValue(item) {

  const directValue =

    item.nilai_final_partner ??

    item.nilai_partner;


  const number =
    Number(
      directValue
    );


  return Number.isFinite(
    number
  )
    ? number
    : 0;

}


// ======================================================
// ISI FILTER DROPDOWN
// ======================================================

function populateFilter(
  select,
  values,
  placeholder
) {

  const previousValue =
    select.value;


  const uniqueValues =
    [
      ...new Set(

        values
          .filter(Boolean)

      )
    ]
      .sort(
        (first, second) =>

          String(first)
            .localeCompare(
              String(second),
              "id"
            )

      );


  select.innerHTML = `

    <option value="">
      ${escapeHTML(placeholder)}
    </option>

  `;


  uniqueValues.forEach(
    value => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        value;


      option.textContent =
        value;


      select.appendChild(
        option
      );

    }
  );


  select.value =
    previousValue;

}


// ======================================================
// BANGUN SEMUA FILTER
// ======================================================

function buildFilters() {

  // Kategori
  const kategoriList =
    allProyek.flatMap(
      item =>

        listValue(
          item,
          "nama_kategori_produk_list",
          "nama_kategori_produk"
        )

    );


  populateFilter(
    kategoriFilter,
    kategoriList,
    "Semua Kategori"
  );


  // Jenis proyek
  const jenisList =
    allProyek.map(
      item =>
        item.jenis_proyek
    );


  populateFilter(
    jenisFilter,
    jenisList,
    "Semua Jenis Proyek"
  );


  // Klien
  const klienList =
    allProyek.map(
      item =>
        item.perusahaan_klien
    );


  populateFilter(
    klienFilter,
    klienList,
    "Semua Klien"
  );


  // Partner
  const partnerList =
    allProyek.flatMap(
      item =>

        listValue(
          item,
          "nama_partner_list",
          "nama_partner"
        )

    );


  populateFilter(
    partnerFilter,
    partnerList,
    "Semua Partner"
  );

}


// ======================================================
// AMBIL STATUS PENGADAAN
// ======================================================

function getStatusPengadaan(item) {
  return String(
    item.status_pengadaan ??
    item.status_pengadaan_klien ??
    item.klien_status_pengadaan ??
    ""
  ).trim();
}


// ======================================================
// AMBIL STATUS TEKNIS
// ======================================================

function getStatusTeknis(item) {
  return String(
    item.status_teknis ??
    item.status_teknis_klien ??
    item.klien_status_teknis ??
    ""
  ).trim();
}


// ======================================================
// CEK PROYEK TERLAMBAT
// ======================================================

function isProyekTerlambat(item) {
  const tanggalAkhir =
    item.tanggal_akhir_klien ??
    item.tanggal_akhir ??
    item.end_date;

  if (!tanggalAkhir) {
    return false;
  }

  const endDate =
    new Date(tanggalAkhir);

  if (
    Number.isNaN(
      endDate.getTime()
    )
  ) {
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

  endDate.setHours(
    0,
    0,
    0,
    0
  );

  const statusTeknis =
    getStatusTeknis(item)
      .toLowerCase();

  return (
    endDate < hariIni &&
    ![
      "done",
      "selesai"
    ].includes(statusTeknis)
  );
}

// ======================================================
// FILTER DATA
// ======================================================
function applyFilter() {
  const search =
    searchInput
      .value
      .trim()
      .toLowerCase();

  const selectedKategori =
    kategoriFilter.value;

  const selectedJenis =
    jenisFilter.value;

  const selectedKlien =
    klienFilter.value;

  const selectedPartner =
    partnerFilter.value;


  const filtered =
    allProyek.filter(item => {
      const namaProyek =
        String(
          item.nama_proyek || ""
        ).toLowerCase();

      const perusahaanKlien =
        String(
          item.perusahaan_klien ||
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
        getStatusPengadaan(item);

      const statusFinal =
        String(
          item.status_final || ""
        ).trim();


      const searchText = [
        namaProyek,
        perusahaanKlien,
        categories.join(" "),
        partners.join(" "),
        statusPengadaan,
        statusFinal
      ]
        .join(" ")
        .toLowerCase();


      const matchSearch =
        !search ||
        searchText.includes(search);


      const matchKategori =
        !selectedKategori ||
        categories.includes(
          selectedKategori
        );


      const matchJenis =
        !selectedJenis ||
        item.jenis_proyek ===
          selectedJenis;


      const matchKlien =
        !selectedKlien ||
        perusahaanKlien ===
          selectedKlien;


      const matchPartner =
        !selectedPartner ||
        partners.includes(
          selectedPartner
        );


      const matchStatusPengadaan =
        !urlStatusPengadaan ||
        statusPengadaan
          .toLowerCase() ===
        urlStatusPengadaan
          .trim()
          .toLowerCase();


      const matchStatusFinal =
        !urlStatusFinal ||
        statusFinal
          .toLowerCase() ===
        urlStatusFinal
          .trim()
          .toLowerCase();


      const matchTerlambat =
        urlProyekTerlambat !== "1" ||
        isProyekTerlambat(item);


      return (
        matchSearch &&
        matchKategori &&
        matchJenis &&
        matchKlien &&
        matchPartner &&
        matchStatusPengadaan &&
        matchStatusFinal &&
        matchTerlambat
      );
    });


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
        itemsPerPage
      )
    );


  if (
    currentPage >
    totalPages
  ) {
    currentPage =
      totalPages;
  }


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

function showActiveDashboardFilter(
  totalData
) {
  let banner =
    document.getElementById(
      "dashboardFilterBanner"
    );

  const activeText = [];

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

  if (urlProyekTerlambat === "1") {
    activeText.push(
      "Proyek Terlambat"
    );
  }


  if (activeText.length === 0) {
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
      "dashboardFilterBanner";

    banner.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
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

    const table =
      proyekTable.closest(
        ".table-wrapper"
      );

    if (table) {
      table.parentElement.insertBefore(
        banner,
        table
      );
    }
  }


  banner.innerHTML = `
    <span>
      Filter aktif:
      ${escapeHTML(
        activeText.join(" • ")
      )}
      — ${totalData} proyek ditemukan
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
// RENDER TABLE
// ======================================================

function renderTable(data) {

  if (
    data.length === 0
  ) {

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

    data.map(
      item => {

        // ==============================================
        // KATEGORI
        // ==============================================

        const categories =
          listValue(
            item,
            "nama_kategori_produk_list",
            "nama_kategori_produk"
          );


        const kategoriText =

          categories.length > 0

            ? categories
                .map(
                  value =>
                    escapeHTML(value)
                )
                .join(", ")

            : "-";


        // ==============================================
        // PARTNER
        // ==============================================

        const partners =
          listValue(
            item,
            "nama_partner_list",
            "nama_partner"
          );


        const partnerText =

          partners.length > 0

            ? partners
                .map(
                  value =>
                    escapeHTML(value)
                )
                .join(", ")

            : "-";


        // ==============================================
        // NILAI DAN MARGIN
        // ==============================================

        const nilaiProyek =
          projectValue(
            item
          );


        const nilaiPartner =
          partnerValue(
            item
          );


        const marginNominal =

          nilaiProyek -

          nilaiPartner;


        /*
          Margin persen dihitung dari nilai klien:

          Margin / Nilai Proyek × 100%
        */

        const marginPersen =

          nilaiProyek > 0

            ? (
                marginNominal /
                nilaiProyek
              ) * 100

            : 0;


        // ==============================================
        // STATUS
        // ==============================================

        const status =
          item.status_final ||
          "-";


        const statusKey =
          String(status)
            .trim()
            .toLowerCase();


        let statusClass =
          "badge-aktif";


        if (
          statusKey === "done" ||
          statusKey === "selesai"
        ) {

          statusClass =
            "badge-done";

        } else if (
          statusKey === "cancel" ||
          statusKey === "batal"
        ) {

          statusClass =
            "badge-cancel";

        }


        // ==============================================
        // JENIS DAN SUBJENIS
        // ==============================================

        const jenisUtama =
          escapeHTML(
            item.jenis_proyek ||
            "-"
          );


        const jenisText =

          item.sub_jenis_proyek

            ? `

                ${jenisUtama}

                <div class="sub-text">

                  ${escapeHTML(
                    item.sub_jenis_proyek
                  )}

                </div>

              `

            : jenisUtama;


        // ==============================================
        // END DATE KLIEN
        // ==============================================

        const endDate =

          item.tanggal_akhir_klien ||

          item.end_date;


        // ==============================================
        // RETURN ROW
        // ==============================================

        return `

          <tr>


            <!-- NAMA PROYEK -->

            <td>

              <div class="project-name">

                ${escapeHTML(
                  item.nama_proyek ||
                  "-"
                )}

              </div>

            </td>


            <!-- KATEGORI -->

            <td>
              ${kategoriText}
            </td>


            <!-- JENIS -->

            <td>
              ${jenisText}
            </td>


            <!-- KLIEN -->

            <td>

              ${escapeHTML(
                item.perusahaan_klien ||
                "-"
              )}

            </td>


            <!-- NILAI PROYEK -->

            <td class="money">

              ${formatRupiah(
                nilaiProyek
              )}

            </td>


            <!-- END DATE -->

            <td>

              ${formatTanggal(
                endDate
              )}

            </td>


            <!-- PARTNER -->

            <td>
              ${partnerText}
            </td>


            <!-- NILAI PARTNER -->

            <td class="money">

              ${formatRupiah(
                nilaiPartner
              )}

            </td>


            <!-- MARGIN NOMINAL -->

            <td class="money">

              ${formatRupiah(
                marginNominal
              )}

            </td>


            <!-- MARGIN PERSEN -->

            <td class="money">

              ${marginPersen
                .toFixed(2)}%

            </td>


            <!-- STATUS -->

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


            <!-- DETAIL -->

            <td>

          <div class="table-actions">

            <a
              class="btn-detail"
              href="/detail-proyek.html?id=${encodeURIComponent(
                item.id
              )}"
            >
              Detail
            </a>

            <button
              type="button"
              class="btn-delete-project"
              data-delete-project
              data-project-id="${Number(
                item.id
              )}"
              data-project-name="${escapeHTML(
                item.nama_proyek || "Proyek"
              )}"
            >
              Hapus
            </button>

          </div>

        </td>


          </tr>

        `;

      }
    ).join("");

}


// ======================================================
// RENDER PAGINATION
// ======================================================

function renderPagination(
  totalItems
) {

  const container =
    document.getElementById(
      "pagination"
    );


  if (!container) {

    return;

  }


  const totalPages =
    Math.ceil(
      totalItems /
      itemsPerPage
    );


  if (
    totalPages <= 1
  ) {

    container.innerHTML =
      "";

    return;

  }


  container.innerHTML =

    Array.from(
      {
        length:
          totalPages
      },

      (
        value,
        index
      ) =>
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


  container
    .querySelectorAll(
      "[data-page]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            currentPage =
              Number(
                button.dataset.page
              );


            applyFilter();

          }
        );

      }
    );

}


// ======================================================
// LOAD PROYEK DARI SERVER
// ======================================================

async function loadProyek() {

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


    const response =
      await fetch(
        "/api/proyek-listing"
      );


    const contentType =
      response.headers.get(
        "content-type"
      );


    if (
      !contentType ||
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


    /*
      Mendukung dua bentuk response:

      1. Langsung array:
         [ {...}, {...} ]

      2. Object dengan data:
         { data: [ {...}, {...} ] }
    */

    allProyek =

      Array.isArray(result)

        ? result

        : Array.isArray(result.data)

          ? result.data

          : [];


    buildFilters();

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
// EVENT SEARCH
// ======================================================

searchInput.addEventListener(
  "input",
  () => {

    currentPage =
      1;


    applyFilter();

  }
);


// ======================================================
// EVENT FILTER KATEGORI
// ======================================================

kategoriFilter.addEventListener(
  "change",
  () => {

    currentPage =
      1;


    applyFilter();

  }
);


// ======================================================
// EVENT FILTER JENIS
// ======================================================

jenisFilter.addEventListener(
  "change",
  () => {

    currentPage =
      1;


    applyFilter();

  }
);


// ======================================================
// EVENT FILTER KLIEN
// ======================================================

klienFilter.addEventListener(
  "change",
  () => {

    currentPage =
      1;


    applyFilter();

  }
);


// ======================================================
// EVENT FILTER PARTNER
// ======================================================

partnerFilter.addEventListener(
  "change",
  () => {

    currentPage =
      1;


    applyFilter();

  }
);

// ======================================================
// HAPUS PROYEK
// ======================================================

proyekTable.addEventListener(
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
      alert(
        "ID proyek tidak valid."
      );

      return;
    }


    // ================================================
    // KONFIRMASI PERTAMA
    // ================================================

    const konfirmasi =
      window.confirm(
        `Apakah Anda yakin ingin menghapus proyek "${namaProyek}"?\n\nData proyek dan seluruh data terkait dapat ikut terhapus.`
      );

    if (!konfirmasi) {
      return;
    }


    // ================================================
    // KONFIRMASI KEDUA
    // ================================================

    const verifikasi =
      window.prompt(
        `Ketik HAPUS untuk menghapus proyek "${namaProyek}".`
      );

    if (
      String(verifikasi || "")
        .trim()
        .toUpperCase() !==
      "HAPUS"
    ) {
      alert(
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
            method:
              "DELETE",

            headers: {
              Accept:
                "application/json"
            }
          }
        );


      const contentType =
        response.headers.get(
          "content-type"
        ) || "";


      let result = {};


      if (
        contentType.includes(
          "application/json"
        )
      ) {
        result =
          await response.json();

      } else {
        const responseText =
          await response.text();

        throw new Error(
          responseText ||
          `Server menghasilkan status ${response.status}`
        );
      }


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


        throw new Error(
          pesanError
        );
      }


      alert(
        result.message ||
        "Proyek berhasil dihapus."
      );


      // Ambil ulang data listing dari server
      currentPage = 1;

      await loadProyek();

    } catch (error) {
      console.error(
        "ERROR HAPUS PROYEK:",
        error
      );


      alert(
        "Gagal menghapus proyek:\n" +
        error.message
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