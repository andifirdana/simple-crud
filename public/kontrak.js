document.addEventListener(
  "DOMContentLoaded",
  () => {
    // ================================================
    // ELEMENT
    // ================================================

    const searchInput =
      document.getElementById(
        "searchKontrak"
      );

    const filterJenis =
      document.getElementById(
        "filterJenis"
      );

    const filterStatus =
      document.getElementById(
        "filterStatus"
      );

    const resetFilter =
      document.getElementById(
        "resetFilter"
      );

    const tableBody =
      document.getElementById(
        "kontrakTableBody"
      );

    const totalKontrak =
      document.getElementById(
        "totalKontrak"
      );

    const tableSummary =
      document.getElementById(
        "tableSummary"
      );

    const paginationInfo =
      document.getElementById(
        "paginationInfo"
      );

    const pageInfo =
      document.getElementById(
        "pageInfo"
      );

    const prevPage =
      document.getElementById(
        "prevPage"
      );

    const nextPage =
      document.getElementById(
        "nextPage"
      );

    // ================================================
    // STATE
    // ================================================

   // ================================================
// FILTER DARI URL DASHBOARD
// ================================================

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const jenisUrl =
  String(
    urlParams.get("jenis") || ""
  ).trim();

const statusUrl =
  String(
    urlParams.get("status") || ""
  )
    .trim()
    .toLowerCase();

const periodeUrl =
  String(
    urlParams.get("periode") || ""
  )
    .trim()
    .toLowerCase();

const state = {
  page: 1,
  limit: 20,
  totalData: 0,
  totalPages: 1,
  search: "",

  jenis:
    [
      "Klien",
      "Partner"
    ].includes(jenisUrl)
      ? jenisUrl
      : "",

  status:
    [
      "berjalan",
      "berakhir",
      "selesai"
    ].includes(statusUrl)
      ? statusUrl
      : "",

  periode:
    periodeUrl === "3-bulan"
      ? "3-bulan"
      : ""
};

/*
 * Munculkan filter URL di dropdown.
 */
filterJenis.value =
  state.jenis;

filterStatus.value =
  state.status;

    let searchTimer = null;

    // ================================================
    // FETCH JSON
    // ================================================

    async function fetchJSON(
      url,
      options = {}
    ) {
      const response =
        await fetch(
          url,
          {
            credentials:
              "same-origin",

            ...options
          }
        );

      const result =
        await response.json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Terjadi kesalahan pada server."
        );
      }

      return result;
    }

    // ================================================
    // ESCAPE HTML
    // ================================================

    function escapeHTML(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll(
          "'",
          "&#039;"
        );
    }

    // ================================================
    // FORMAT TANGGAL
    // ================================================

    function formatTanggal(value) {
      if (!value) {
        return "-";
      }

      const tanggal =
        String(value).slice(
          0,
          10
        );

      const date =
        new Date(
          `${tanggal}T00:00:00`
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

    // ================================================
    // BADGE JENIS RELASI
    // ================================================

    function getRelationBadge(jenis) {
      const nilai =
        String(jenis || "");

      const className =
        nilai.toLowerCase() ===
        "partner"
          ? "relation-partner"
          : "relation-klien";

      return `
        <span
          class="relation-badge ${className}"
        >
          ${escapeHTML(
            nilai || "-"
          )}
        </span>
      `;
    }

    // ================================================
    // BADGE BERAKHIR PADA
    // ================================================

    function getBerakhirBadge(item) {
      /*
       * Status Final Done/Selesai
       * diprioritaskan dari tanggal akhir.
       */
      if (
        item.status_kontrak ===
        "selesai"
      ) {
        return `
          <span class="completed-badge">
            Kontrak Telah Selesai
          </span>
        `;
      }

      /*
       * Tanggal akhir belum diisi.
       */
      if (!item.tanggal_akhir) {
        return `
          <span class="empty-badge">
            Belum ditentukan
          </span>
        `;
      }

      const sisaHari =
        item.sisa_hari === null ||
        item.sisa_hari === undefined
          ? null
          : Number(
              item.sisa_hari
            );

      /*
       * Tanggal akhir sudah lewat.
       */
      if (
        item.status_kontrak ===
        "berakhir"
      ) {
        return `
          <span class="expired-badge">
            Telah Berakhir
          </span>
        `;
      }

      /*
       * Berakhir hari ini.
       */
      if (sisaHari === 0) {
        return `
          <span class="today-badge">
            Berakhir Hari Ini
          </span>
        `;
      }

      /*
       * Berakhir maksimal 90 hari lagi.
       */
      if (
        Number.isFinite(
          sisaHari
        ) &&
        sisaHari > 0 &&
        sisaHari <= 90
      ) {
        return `
          <span class="warning-badge">
            ${sisaHari} hari lagi
          </span>
        `;
      }

      /*
       * Masih lebih dari 90 hari.
       */
      if (
        Number.isFinite(
          sisaHari
        ) &&
        sisaHari > 90
      ) {
        return `
          <span class="active-badge">
            ${sisaHari} hari lagi
          </span>
        `;
      }

      return `
        <span class="empty-badge">
          -
        </span>
      `;
    }

    // ================================================
    // RENDER TABLE
    // ================================================

    function renderTable(data) {
      if (
        !Array.isArray(data) ||
        data.length === 0
      ) {
        tableBody.innerHTML = `
          <tr>
            <td
              colspan="6"
              class="table-message"
            >
              Data kontrak tidak ditemukan.
            </td>
          </tr>
        `;

        return;
      }

      tableBody.innerHTML =
        data.map(item => {
          return `
            <tr>
              <td>
                <div class="project-name">
                  ${escapeHTML(
                    item.nama_proyek ||
                    "-"
                  )}
                </div>
              </td>

              <td>
                ${getRelationBadge(
                  item.jenis_relasi
                )}
              </td>

              <td>
                <div class="relation-name">
                  ${escapeHTML(
                    item.nama_relasi ||
                    "-"
                  )}
                </div>
              </td>

              <td>
                <span class="date-text">
                  ${formatTanggal(
                    item.tanggal_mulai
                  )}
                </span>
              </td>

              <td>
                <span class="date-text">
                  ${formatTanggal(
                    item.tanggal_akhir
                  )}
                </span>
              </td>

              <td>
                ${getBerakhirBadge(
                  item
                )}
              </td>
            </tr>
          `;
        }).join("");
    }

    // ================================================
    // RENDER PAGINATION
    // ================================================

    function renderPagination() {
      const start =
        state.totalData === 0
          ? 0
          : (
              (
                state.page - 1
              ) *
              state.limit
            ) + 1;

      const end =
        Math.min(
          state.page *
          state.limit,
          state.totalData
        );

      totalKontrak.textContent =
        state.totalData.toLocaleString(
          "id-ID"
        );

      tableSummary.textContent =
        `${state.totalData.toLocaleString(
          "id-ID"
        )} kontrak ditemukan`;

      paginationInfo.textContent =
        state.totalData > 0
          ? (
              `Menampilkan ` +
              `${start}-${end} ` +
              `dari ${state.totalData} data`
            )
          : "Menampilkan 0 data";

      pageInfo.textContent =
        `Halaman ${state.page} ` +
        `dari ${state.totalPages}`;

      prevPage.disabled =
        state.page <= 1;

      nextPage.disabled =
        state.page >=
        state.totalPages;
    }

    // ================================================
    // LOADING TABLE
    // ================================================

    function renderLoading() {
      tableBody.innerHTML = `
        <tr>
          <td
            colspan="6"
            class="table-message"
          >
            Memuat data kontrak...
          </td>
        </tr>
      `;
    }

    // ================================================
    // ERROR TABLE
    // ================================================

    function renderError(message) {
      tableBody.innerHTML = `
        <tr>
          <td
            colspan="6"
            class="table-message"
          >
            ${escapeHTML(message)}
          </td>
        </tr>
      `;
    }

    // ================================================
    // LOAD KONTRAK
    // ================================================

    async function loadKontrak() {
      renderLoading();

      try {
       const params =
  new URLSearchParams({
    page:
      String(state.page),

    limit:
      String(state.limit),

    search:
      state.search,

    jenis:
      state.jenis,

    status:
      state.status,

    periode:
      state.periode
  });
        const result =
          await fetchJSON(
            `/api/kontrak?${params.toString()}`
          );

        state.totalData =
          Number(
            result.pagination
              ?.total_data || 0
          );

        state.totalPages =
          Math.max(
            Number(
              result.pagination
                ?.total_pages || 1
            ),
            1
          );

        /*
         * Kembali ke halaman terakhir
         * jika halaman saat ini melebihi total.
         */
        if (
          state.page >
          state.totalPages
        ) {
          state.page =
            state.totalPages;

          return loadKontrak();
        }

        renderTable(
          result.data || []
        );

        renderPagination();

      } catch (error) {
        console.error(
          "ERROR LOAD KONTRAK:",
          error
        );

        renderError(
          error.message ||
          "Gagal memuat data kontrak."
        );

        totalKontrak.textContent =
          "0";

        tableSummary.textContent =
          "Gagal memuat data";

        paginationInfo.textContent =
          "Menampilkan 0 data";

        pageInfo.textContent =
          "Halaman 1 dari 1";

        prevPage.disabled = true;
        nextPage.disabled = true;
      }
    }

    // ================================================
    // SEARCH
    // ================================================

    searchInput.addEventListener(
      "input",
      () => {
        clearTimeout(
          searchTimer
        );

        searchTimer =
          setTimeout(
            () => {
              state.search =
                searchInput
                  .value
                  .trim();

              state.page = 1;

              loadKontrak();
            },
            350
          );
      }
    );

    // ================================================
    // FILTER JENIS
    // ================================================

    filterJenis.addEventListener(
      "change",
      () => {
        state.jenis =
          filterJenis.value;

        state.page = 1;

        loadKontrak();
      }
    );

    // ================================================
    // FILTER STATUS
    // ================================================

    filterStatus.addEventListener(
      "change",
      () => {
        state.status =
          filterStatus.value;

        state.page = 1;

        loadKontrak();
      }
    );

    // ================================================
    // RESET FILTER
    // ================================================

    resetFilter.addEventListener(
      "click",
      () => {
        clearTimeout(
          searchTimer
        );
        searchInput.value = "";
        filterJenis.value = "";
        filterStatus.value = "";

        state.search = "";
        state.jenis = "";
        state.status = "";
        state.periode = "";
        state.page = 1;

        loadKontrak();
      }
    );

    // ================================================
    // PREVIOUS PAGE
    // ================================================

    prevPage.addEventListener(
      "click",
      () => {
        if (state.page <= 1) {
          return;
        }

        state.page -= 1;

        loadKontrak();
      }
    );

    // ================================================
    // NEXT PAGE
    // ================================================

    nextPage.addEventListener(
      "click",
      () => {
        if (
          state.page >=
          state.totalPages
        ) {
          return;
        }

        state.page += 1;

        loadKontrak();
      }
    );

    // ================================================
    // INITIAL LOAD
    // ================================================

    loadKontrak();
  }
);