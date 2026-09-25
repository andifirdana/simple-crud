// ======================================================
// DASHBOARD PORTOPRO
// Endpoint: GET /api/dashboard
// ======================================================

let dashboardData = null;


// ======================================================
// ELEMENT HELPER
// ======================================================

function getElement(id) {
  return document.getElementById(id);
}


// ======================================================
// NUMBER HELPER
// ======================================================

function angka(value) {
  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}


// ======================================================
// NORMALISASI TEXT
// ======================================================

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}


// ======================================================
// FORMAT RUPIAH
// ======================================================

function formatRupiah(value) {
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
// PARSE TANGGAL LOKAL
// ======================================================

function parseTanggal(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value);

  const dateOnlyMatch =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (dateOnlyMatch) {
    const date =
      new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
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
      month: "short",
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
// EMPTY TABLE
// ======================================================

function emptyTable(
  colspan,
  message
) {
  return `
    <tr>
      <td
        colspan="${colspan}"
        class="empty-state"
      >
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
}


// ======================================================
// STATUS SUDAH DIBAYAR
// ======================================================

function statusSudahDibayar(status) {
  return [
    "dibayar",
    "sudah dibayar",
    "lunas",
    "paid"
  ].includes(
    normalizeText(status)
  );
}


// ======================================================
// PROJECT LINK
// ======================================================

function projectLink(item) {
  const proyekId =
    Number(
      item.proyek_id ??
      item.id
    );

  const namaProyek =
    escapeHtml(
      item.nama_proyek || "-"
    );

  if (
    !Number.isInteger(proyekId) ||
    proyekId <= 0
  ) {
    return namaProyek;
  }

  return `
    <a
      class="project-link"
      href="/detail-proyek.html?id=${encodeURIComponent(
        proyekId
      )}"
    >
      ${namaProyek}
    </a>
  `;
}


// ======================================================
// NORMALISASI RESPONSE
// ======================================================

function normalizeDashboardResponse(
  result
) {
  return {
    projects:
      Array.isArray(result.projects)
        ? result.projects
        : [],

    revenue:
      Array.isArray(result.revenue)
        ? result.revenue
        : [],

    forecast:
      Array.isArray(result.forecast)
        ? result.forecast
        : [],

    termins:
      Array.isArray(result.termins)
        ? result.termins
        : [],

    timelines:
      Array.isArray(result.timelines)
        ? result.timelines
        : [],

    partnerContracts:
      Array.isArray(
        result.partner_contracts
      )
        ? result.partner_contracts
        : []
  };
}


// ======================================================
// LOAD DASHBOARD
// ======================================================

async function loadDashboard() {
  try {
    const response =
      await fetch(
        "/api/dashboard",
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
        "Gagal memuat dashboard."
      );
    }

    dashboardData =
      normalizeDashboardResponse(
        result
      );

    buildDashboardFilters();

    renderDashboard();

    const lastUpdate =
      getElement("lastUpdate");

    if (lastUpdate) {
      lastUpdate.textContent =
        `Diperbarui ${new Date()
          .toLocaleString(
            "id-ID"
          )}`;
    }

  } catch (error) {
    console.error(
      "ERROR LOAD DASHBOARD:",
      error
    );

    const lastUpdate =
      getElement("lastUpdate");

    if (lastUpdate) {
      lastUpdate.textContent =
        `Gagal memuat data: ${error.message}`;
    }

    showDashboardError(
      error.message
    );
  }
}


// ======================================================
// ERROR DISPLAY
// ======================================================

function showDashboardError(message) {
  const tableConfigs = [
    [
      "highestProjectTable",
      7
    ],
    [
      "lateProjectTable",
      6
    ],
    [
      "clientContractTable",
      5
    ],
    [
      "partnerContractTable",
      5
    ]
  ];

  tableConfigs.forEach(
    ([
      id,
      colspan
    ]) => {
      const element =
        getElement(id);

      if (element) {
        element.innerHTML =
          emptyTable(
            colspan,
            `Gagal memuat data: ${message}`
          );
      }
    }
  );

  const chartIds = [
    "revenueChart",
    "partnerPaymentChart"
  ];

  chartIds.forEach(id => {
    const element =
      getElement(id);

    if (element) {
      element.innerHTML = `
        <div class="empty-state">
          ${escapeHtml(message)}
        </div>
      `;
    }
  });
}


// ======================================================
// ARRAY VALUE
// ======================================================

function getArrayValue(
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
      .filter(Boolean)
      .map(String);
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
// UNIQUE VALUE
// ======================================================

function uniqueValues(values) {
  return [
    ...new Set(
      values
        .filter(Boolean)
        .map(String)
    )
  ].sort(
    (first, second) =>
      first.localeCompare(
        second,
        "id"
      )
  );
}


// ======================================================
// ISI SELECT FILTER
// ======================================================

function fillSelect(
  id,
  values,
  defaultLabel
) {
  const select =
    getElement(id);

  if (!select) {
    return;
  }

  const previousValue =
    select.value;

  select.innerHTML = "";

  const defaultOption =
    document.createElement(
      "option"
    );

  defaultOption.value = "";

  defaultOption.textContent =
    defaultLabel;

  select.appendChild(
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

    select.appendChild(
      option
    );
  });

  if (
    [
      ...select.options
    ].some(
      option =>
        option.value ===
        previousValue
    )
  ) {
    select.value =
      previousValue;
  }
}


// ======================================================
// BUILD FILTER
// ======================================================

function buildDashboardFilters() {
  if (!dashboardData) {
    return;
  }

  const projects =
    dashboardData.projects;

  const years =
    uniqueValues(
      projects
        .flatMap(item => [
          item.tanggal_mulai,
          item.tanggal_akhir,
          item.created_at
        ])
        .map(parseTanggal)
        .filter(Boolean)
        .map(date =>
          date.getFullYear()
        )
    ).sort(
      (first, second) =>
        Number(second) -
        Number(first)
    );

  const jenis =
    uniqueValues(
      projects.map(
        item =>
          item.jenis_proyek
      )
    );

  const kategori =
    uniqueValues(
      projects.flatMap(item =>
        getArrayValue(
          item,
          "kategori_list",
          "kategori"
        )
      )
    );

  const pics =
    uniqueValues(
      projects.flatMap(item =>
        getArrayValue(
          item,
          "nama_pic_list",
          "nama_pic"
        )
      )
    );

  const statusFinal =
    uniqueValues(
      projects.map(
        item =>
          item.status_final
      )
    );

  fillSelect(
    "filterTahun",
    years,
    "Semua Tahun"
  );

  fillSelect(
    "filterJenis",
    jenis,
    "Semua Jenis"
  );

  fillSelect(
    "filterKategori",
    kategori,
    "Semua Kategori"
  );

  fillSelect(
    "filterPic",
    pics,
    "Semua PIC"
  );

  fillSelect(
    "filterStatus",
    statusFinal,
    "Semua Status"
  );
}


// ======================================================
// PROJECT MATCH FILTER
// ======================================================

function projectMatchesFilter(project) {
  const search =
    normalizeText(
      getElement(
        "dashboardSearch"
      )?.value
    );

  const selectedYear =
    getElement(
      "filterTahun"
    )?.value || "";

  const selectedType =
    getElement(
      "filterJenis"
    )?.value || "";

  const selectedCategory =
    getElement(
      "filterKategori"
    )?.value || "";

  const selectedPic =
    getElement(
      "filterPic"
    )?.value || "";

  const selectedStatus =
    getElement(
      "filterStatus"
    )?.value || "";

  const categories =
    getArrayValue(
      project,
      "kategori_list",
      "kategori"
    );

  const pics =
    getArrayValue(
      project,
      "nama_pic_list",
      "nama_pic"
    );

  const searchText =
    normalizeText([
      project.nama_proyek,
      project.nama_klien,
      project.nama_partner,
      project.kategori,
      categories.join(" "),
      project.nama_pic,
      pics.join(" "),
      project.jenis_proyek,
      project.sub_jenis_proyek,
      project.status_pengadaan,
      project.status_final
    ].join(" "));

  const projectYears = [
    project.tanggal_mulai,
    project.tanggal_akhir,
    project.created_at
  ]
    .map(parseTanggal)
    .filter(Boolean)
    .map(date =>
      String(
        date.getFullYear()
      )
    );

  return (
    (
      !search ||
      searchText.includes(search)
    ) &&
    (
      !selectedYear ||
      projectYears.includes(
        selectedYear
      )
    ) &&
    (
      !selectedType ||
      project.jenis_proyek ===
        selectedType
    ) &&
    (
      !selectedCategory ||
      categories.includes(
        selectedCategory
      )
    ) &&
    (
      !selectedPic ||
      pics.includes(
        selectedPic
      )
    ) &&
    (
      !selectedStatus ||
      project.status_final ===
        selectedStatus
    )
  );
}


// ======================================================
// FILTER RELATED DATA
// ======================================================

function filterRelatedData(
  data,
  projectIds
) {
  return data.filter(item => {
    if (
      item.proyek_id === null ||
      item.proyek_id === undefined
    ) {
      return true;
    }

    return projectIds.has(
      Number(item.proyek_id)
    );
  });
}


// ======================================================
// SUMMARY BERDASARKAN STATUS PENGADAAN
// ======================================================

function getProcurementSummary(
  projects,
  status
) {
  const normalizedStatus =
    normalizeText(status);

  const filtered =
    projects.filter(item =>
      normalizeText(
        item.status_pengadaan
      ) === normalizedStatus
    );

  return {
    total:
      filtered.length,

    nilai:
      filtered.reduce(
        (sum, item) =>
          sum +
          angka(item.nilai_klien),
        0
      )
  };
}


// ======================================================
// SET SUMMARY CARD
// ======================================================

function setSummaryCard(
  totalId,
  valueId,
  summary
) {
  const totalElement =
    getElement(totalId);

  const valueElement =
    getElement(valueId);

  if (totalElement) {
    totalElement.textContent =
      summary.total;
  }

  if (valueElement) {
    valueElement.textContent =
      formatRupiah(
        summary.nilai
      );
  }
}


// ======================================================
// RENDER SUMMARY
// ======================================================

function renderSummary(
  projects,
  termins
) {
  setSummaryCard(
    "totalPipeline",
    "nilaiPipeline",
    getProcurementSummary(
      projects,
      "Pipeline"
    )
  );

  setSummaryCard(
    "totalSubmitPenawaran",
    "nilaiSubmitPenawaran",
    getProcurementSummary(
      projects,
      "Submit Penawaran"
    )
  );

  setSummaryCard(
    "totalSubmitPengadaan",
    "nilaiSubmitPengadaan",
    getProcurementSummary(
      projects,
      "Submit Pengadaan"
    )
  );

  setSummaryCard(
    "totalKontrak",
    "nilaiKontrak",
    getProcurementSummary(
      projects,
      "Kontrak"
    )
  );

  const activeProjects =
    projects.filter(item =>
      normalizeText(
        item.status_final
      ) === "aktif"
    );

  setSummaryCard(
    "totalProyekAktif",
    "nilaiProyekAktif",
    {
      total:
        activeProjects.length,

      nilai:
        activeProjects.reduce(
          (sum, item) =>
            sum +
            angka(item.nilai_klien),
          0
        )
    }
  );

  const clientTerms =
    termins.filter(item =>
      normalizeText(
        item.pihak
      ) === "klien"
    );

  const partnerTerms =
    termins.filter(item =>
      normalizeText(
        item.pihak
      ) === "partner"
    );

  const paidClient =
    clientTerms
      .filter(item =>
        statusSudahDibayar(
          item.status_pembayaran
        )
      )
      .reduce(
        (sum, item) =>
          sum +
          angka(item.nominal),
        0
      );

  const unpaidClient =
    clientTerms
      .filter(item =>
        !statusSudahDibayar(
          item.status_pembayaran
        )
      )
      .reduce(
        (sum, item) =>
          sum +
          angka(item.nominal),
        0
      );

  const paidPartner =
    partnerTerms
      .filter(item =>
        statusSudahDibayar(
          item.status_pembayaran
        )
      )
      .reduce(
        (sum, item) =>
          sum +
          angka(item.nominal),
        0
      );

  const unpaidPartner =
    partnerTerms
      .filter(item =>
        !statusSudahDibayar(
          item.status_pembayaran
        )
      )
      .reduce(
        (sum, item) =>
          sum +
          angka(item.nominal),
        0
      );

  if (getElement("piutangKlien")) {
    getElement(
      "piutangKlien"
    ).textContent =
      formatRupiah(
        unpaidClient
      );
  }

  if (getElement("dibayarKlien")) {
    getElement(
      "dibayarKlien"
    ).textContent =
      formatRupiah(
        paidClient
      );
  }

  if (getElement("hutangPartner")) {
    getElement(
      "hutangPartner"
    ).textContent =
      formatRupiah(
        unpaidPartner
      );
  }

  if (getElement("dibayarPartner")) {
    getElement(
      "dibayarPartner"
    ).textContent =
      formatRupiah(
        paidPartner
      );
  }

  const lateProjects =
    getLateProjects(
      projects
    );

  if (
    getElement(
      "totalProyekTerlambat"
    )
  ) {
    getElement(
      "totalProyekTerlambat"
    ).textContent =
      lateProjects.length;
  }
}


// ======================================================
// PROYEK TERLAMBAT
// ======================================================

function getLateProjects(projects) {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return projects
    .filter(item => {
      const endDate =
        parseTanggal(
          item.tanggal_akhir
        );

      if (!endDate) {
        return false;
      }

      endDate.setHours(
        0,
        0,
        0,
        0
      );

      const technicalStatus =
        normalizeText(
          item.status_teknis
        );

      return (
        endDate < today &&
        ![
          "done",
          "selesai"
        ].includes(
          technicalStatus
        )
      );
    })
    .map(item => {
      const endDate =
        parseTanggal(
          item.tanggal_akhir
        );

      endDate.setHours(
        0,
        0,
        0,
        0
      );

      const lateDays =
        Math.floor(
          (
            today.getTime() -
            endDate.getTime()
          ) /
          86400000
        );

      return {
        ...item,

        lateDays
      };
    })
    .sort(
      (first, second) =>
        second.lateDays -
        first.lateDays
    );
}


// ======================================================
// TAHUN GRAFIK
// ======================================================

function getSelectedChartYear() {
  const selectedYear =
    Number(
      getElement(
        "filterTahun"
      )?.value
    );

  return selectedYear ||
    new Date().getFullYear();
}


// ======================================================
// PENDAPATAN BULAN BERJALAN
// ======================================================

function renderCurrentMonthIncome(
  revenue
) {
  const now =
    new Date();

  const currentYear =
    now.getFullYear();

  const currentMonth =
    now.getMonth() + 1;

  const previousDate =
    new Date(
      currentYear,
      now.getMonth() - 1,
      1
    );

  const previousYear =
    previousDate.getFullYear();

  const previousMonth =
    previousDate.getMonth() + 1;

  const currentValue =
    revenue
      .filter(item =>
        angka(item.tahun) ===
          currentYear &&
        angka(item.bulan) ===
          currentMonth
      )
      .reduce(
        (sum, item) =>
          sum +
          angka(
            item.nilai ??
            item.total
          ),
        0
      );

  const previousValue =
    revenue
      .filter(item =>
        angka(item.tahun) ===
          previousYear &&
        angka(item.bulan) ===
          previousMonth
      )
      .reduce(
        (sum, item) =>
          sum +
          angka(
            item.nilai ??
            item.total
          ),
        0
      );

  const incomeElement =
    getElement(
      "pendapatanBulanIni"
    );

  if (incomeElement) {
    incomeElement.textContent =
      formatRupiah(
        currentValue
      );
  }

  const comparison =
    getElement(
      "pendapatanComparison"
    );

  if (!comparison) {
    return;
  }

  comparison.classList.remove(
    "up",
    "down",
    "same"
  );

  if (
    currentValue >
    previousValue
  ) {
    const increase =
      previousValue > 0
        ? (
            (
              currentValue -
              previousValue
            ) /
            previousValue
          ) * 100
        : 100;

    comparison.classList.add(
      "up"
    );

    comparison.textContent =
      `▲ Naik ${increase.toFixed(2)}% dari bulan sebelumnya`;

  } else if (
    currentValue <
    previousValue
  ) {
    const decrease =
      previousValue > 0
        ? (
            (
              previousValue -
              currentValue
            ) /
            previousValue
          ) * 100
        : 0;

    comparison.classList.add(
      "down"
    );

    comparison.textContent =
      `▼ Turun ${decrease.toFixed(2)}% dari bulan sebelumnya`;

  } else {
    comparison.classList.add(
      "same"
    );

    comparison.textContent =
      "● Sama dengan bulan sebelumnya";
  }
}


// ======================================================
// CHART CONFIG
// ======================================================

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des"
];


// ======================================================
// RENDER BAR CHART
// ======================================================

function renderBarChart(
  containerId,
  data,
  isPartner = false
) {
  const container =
    getElement(containerId);

  if (!container) {
    return;
  }

  const values =
    Array(12).fill(0);

  data.forEach(item => {
    const monthIndex =
      angka(item.bulan) - 1;

    if (
      monthIndex >= 0 &&
      monthIndex < 12
    ) {
      values[monthIndex] +=
        angka(
          item.nilai ??
          item.total
        );
    }
  });

  const maximumValue =
    Math.max(
      ...values,
      1
    );

  container.innerHTML =
    values.map(
      (
        value,
        index
      ) => {
        const height =
          value > 0
            ? Math.max(
                (
                  value /
                  maximumValue
                ) * 100,
                3
              )
            : 0;

        return `
          <div class="chart-month">

            <div class="chart-bar-wrapper">

              <div
                class="
                  chart-bar
                  ${
                    isPartner
                      ? "partner"
                      : ""
                  }
                "
                style="
                  height:${height}%;
                "
                title="${
                  monthNames[index]
                }: ${formatRupiah(value)}"
              ></div>

            </div>

            <span class="chart-label">
              ${monthNames[index]}
            </span>

          </div>
        `;
      }
    ).join("");
}


// ======================================================
// PEMBAYARAN PARTNER BULANAN
// ======================================================

function buildPartnerMonthlyData(
  termins,
  year
) {
  const values =
    Array(12).fill(0);

  termins
    .filter(item =>
      normalizeText(
        item.pihak
      ) === "partner" &&
      statusSudahDibayar(
        item.status_pembayaran
      ) &&
      item.tanggal_bayar
    )
    .forEach(item => {
      const paymentDate =
        parseTanggal(
          item.tanggal_bayar
        );

      if (
        !paymentDate ||
        paymentDate.getFullYear() !==
          year
      ) {
        return;
      }

      const monthIndex =
        paymentDate.getMonth();

      values[monthIndex] +=
        angka(item.nominal);
    });

  return values.map(
    (
      value,
      index
    ) => ({
      tahun:
        year,

      bulan:
        index + 1,

      nilai:
        value
    })
  );
}


// ======================================================
// PROYEK NILAI TERTINGGI
// ======================================================

function renderHighestProjects(projects) {
  const tbody =
    getElement(
      "highestProjectTable"
    );

  if (!tbody) {
    return;
  }

  const rows =
    [...projects]
      .sort(
        (first, second) =>
          angka(
            second.nilai_klien
          ) -
          angka(
            first.nilai_klien
          )
      )
      .slice(0, 5);

  if (rows.length === 0) {
    tbody.innerHTML =
      emptyTable(
        7,
        "Belum ada data proyek."
      );

    return;
  }

  tbody.innerHTML =
    rows.map(
      (
        item,
        index
      ) => `
        <tr>

          <td>
            ${index + 1}
          </td>

          <td>
            ${projectLink(item)}
          </td>

          <td>
            ${escapeHtml(
              item.nama_klien ||
              "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              item.status_pengadaan ||
              "-"
            )}
          </td>

          <td>
            ${escapeHtml(
              item.status_final ||
              "-"
            )}
          </td>

          <td class="money">
            ${formatRupiah(
              item.nilai_klien
            )}
          </td>

          <td>
            <a
              class="project-link"
              href="/detail-proyek.html?id=${encodeURIComponent(
                item.proyek_id
              )}"
            >
              Detail
            </a>
          </td>

        </tr>
      `
    ).join("");
}


// ======================================================
// RENDER PROYEK TERLAMBAT
// ======================================================

function renderLateProjects(projects) {
  const tbody =
    getElement(
      "lateProjectTable"
    );

  if (!tbody) {
    return;
  }

  const rows =
    getLateProjects(
      projects
    ).slice(
      0,
      10
    );

  if (rows.length === 0) {
    tbody.innerHTML =
      emptyTable(
        6,
        "Tidak ada proyek terlambat."
      );

    return;
  }

  tbody.innerHTML =
    rows.map(item => `
      <tr>

        <td>
          ${projectLink(item)}
        </td>

        <td>
          ${escapeHtml(
            item.nama_klien ||
            "-"
          )}
        </td>

        <td>
          ${formatTanggal(
            item.tanggal_akhir
          )}
        </td>

        <td>
          ${escapeHtml(
            item.status_teknis ||
            "-"
          )}
        </td>

        <td class="days-late">
          ${item.lateDays} hari
        </td>

        <td>
          <a
            class="project-link"
            href="/detail-proyek.html?id=${encodeURIComponent(
              item.proyek_id
            )}"
          >
            Detail
          </a>
        </td>

      </tr>
    `).join("");
}


// ======================================================
// KONTRAK KLIEN JATUH TEMPO
// ======================================================

function renderClientContracts(projects) {
  const tbody =
    getElement(
      "clientContractTable"
    );

  if (!tbody) {
    return;
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const threeMonthsLater =
    new Date(today);

  threeMonthsLater.setMonth(
    threeMonthsLater.getMonth() + 3
  );

  const rows =
    projects
      .filter(item => {
        const endDate =
          parseTanggal(
            item.tanggal_akhir
          );

        if (!endDate) {
          return false;
        }

        endDate.setHours(
          0,
          0,
          0,
          0
        );

        return (
          endDate >= today &&
          endDate <=
            threeMonthsLater
        );
      })
      .map(item => {
        const endDate =
          parseTanggal(
            item.tanggal_akhir
          );

        endDate.setHours(
          0,
          0,
          0,
          0
        );

        return {
          ...item,

          remainingDays:
            Math.ceil(
              (
                endDate.getTime() -
                today.getTime()
              ) /
              86400000
            )
        };
      })
      .sort(
        (first, second) =>
          first.remainingDays -
          second.remainingDays
      )
      .slice(0, 5);

  if (rows.length === 0) {
    tbody.innerHTML =
      emptyTable(
        5,
        "Tidak ada kontrak klien yang segera berakhir."
      );

    return;
  }

  tbody.innerHTML =
    rows.map(item => `
      <tr>

        <td>
          ${projectLink(item)}
        </td>

        <td>
          ${escapeHtml(
            item.nama_klien ||
            "-"
          )}
        </td>

        <td>
          ${formatTanggal(
            item.tanggal_akhir
          )}
        </td>

        <td>
          ${item.remainingDays} hari
        </td>

        <td>
          <a
            class="project-link"
            href="/detail-proyek.html?id=${encodeURIComponent(
              item.proyek_id
            )}"
          >
            Detail
          </a>
        </td>

      </tr>
    `).join("");
}


// ======================================================
// KONTRAK PARTNER JATUH TEMPO
// ======================================================

function renderPartnerContracts(data) {
  const tbody =
    getElement(
      "partnerContractTable"
    );

  if (!tbody) {
    return;
  }

  const rows =
    data
      .filter(item =>
        Number.isFinite(
          angka(item.sisa_hari)
        ) &&
        angka(item.sisa_hari) >= 0 &&
        angka(item.sisa_hari) <= 92
      )
      .sort(
        (first, second) =>
          angka(
            first.sisa_hari
          ) -
          angka(
            second.sisa_hari
          )
      )
      .slice(0, 5);

  if (rows.length === 0) {
    tbody.innerHTML =
      emptyTable(
        5,
        "Tidak ada kontrak partner yang segera berakhir."
      );

    return;
  }

  tbody.innerHTML =
    rows.map(item => `
      <tr>

        <td>
          ${projectLink(item)}
        </td>

        <td>
          ${escapeHtml(
            item.nama_partner ||
            "-"
          )}
        </td>

        <td>
          ${formatTanggal(
            item.tanggal_akhir
          )}
        </td>

        <td>
          ${angka(
            item.sisa_hari
          )} hari
        </td>

        <td>
          <a
            class="project-link"
            href="/detail-proyek.html?id=${encodeURIComponent(
              item.proyek_id
            )}"
          >
            Detail
          </a>
        </td>

      </tr>
    `).join("");
}


// ======================================================
// RENDER SEMUA DASHBOARD
// ======================================================

function renderDashboard() {
  if (!dashboardData) {
    return;
  }

  const projects =
    dashboardData.projects.filter(
      projectMatchesFilter
    );

  const projectIds =
    new Set(
      projects.map(item =>
        Number(
          item.proyek_id
        )
      )
    );

  const termins =
    filterRelatedData(
      dashboardData.termins,
      projectIds
    );

  const partnerContracts =
    filterRelatedData(
      dashboardData.partnerContracts,
      projectIds
    );

  const chartYear =
    getSelectedChartYear();

  const annualRevenue =
    dashboardData.revenue.filter(
      item =>
        angka(item.tahun) ===
          chartYear
    );

  const annualPartnerPayments =
    buildPartnerMonthlyData(
      termins,
      chartYear
    );

  renderSummary(
    projects,
    termins
  );

  renderCurrentMonthIncome(
    dashboardData.revenue
  );

  renderBarChart(
    "revenueChart",
    annualRevenue,
    false
  );

  renderBarChart(
    "partnerPaymentChart",
    annualPartnerPayments,
    true
  );

  renderHighestProjects(
    projects
  );

  renderLateProjects(
    projects
  );

  renderClientContracts(
    projects
  );

  renderPartnerContracts(
    partnerContracts
  );
}


// ======================================================
// BUKA FILTER PROYEK
// ======================================================

function openProjectFilter(
  type,
  value
) {
  const params =
    new URLSearchParams();

  params.set(
    type,
    value
  );

  window.location.href =
    `/proyek.html?${params.toString()}`;
}


// ======================================================
// CLICK CARD STATUS PENGADAAN
// ======================================================

document
  .querySelectorAll(
    "[data-status-pengadaan]"
  )
  .forEach(card => {
    const openCard = () => {
      openProjectFilter(
        "status_pengadaan",
        card.dataset
          .statusPengadaan
      );
    };

    card.addEventListener(
      "click",
      openCard
    );

    card.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();

          openCard();
        }
      }
    );
  });


// ======================================================
// CLICK CARD STATUS FINAL
// ======================================================

document
  .querySelectorAll(
    "[data-status-final]"
  )
  .forEach(card => {
    const openCard = () => {
      openProjectFilter(
        "status_final",
        card.dataset
          .statusFinal
      );
    };

    card.addEventListener(
      "click",
      openCard
    );

    card.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();

          openCard();
        }
      }
    );
  });


// ======================================================
// CLICK PROYEK TERLAMBAT
// ======================================================

const lateProjectCard =
  getElement(
    "lateProjectCard"
  );

if (lateProjectCard) {
  const scrollToLateProjects =
    () => {
      getElement(
        "lateProjectSection"
      )?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    };

  lateProjectCard.addEventListener(
    "click",
    scrollToLateProjects
  );

  lateProjectCard.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        scrollToLateProjects();
      }
    }
  );
}


// ======================================================
// FILTER EVENTS
// ======================================================

const dashboardSearch =
  getElement(
    "dashboardSearch"
  );

if (dashboardSearch) {
  dashboardSearch.addEventListener(
    "input",
    renderDashboard
  );
}


[
  "filterTahun",
  "filterJenis",
  "filterKategori",
  "filterPic",
  "filterStatus"
].forEach(id => {
  const element =
    getElement(id);

  if (element) {
    element.addEventListener(
      "change",
      renderDashboard
    );
  }
});


// ======================================================
// RESET FILTER
// ======================================================

const resetDashboardFilter =
  getElement(
    "resetDashboardFilter"
  );

if (resetDashboardFilter) {
  resetDashboardFilter.addEventListener(
    "click",
    () => {
      [
        "dashboardSearch",
        "filterTahun",
        "filterJenis",
        "filterKategori",
        "filterPic",
        "filterStatus"
      ].forEach(id => {
        const element =
          getElement(id);

        if (element) {
          element.value = "";
        }
      });

      renderDashboard();
    }
  );
}


// ======================================================
// START
// ======================================================

loadDashboard();