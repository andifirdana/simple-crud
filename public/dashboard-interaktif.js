/*
 * Dashboard Interaktif — halaman baru, tidak mengubah dashboard lama.
 * Letakkan file ini dan dashboard-interaktif.html dalam direktori public yang sama.
 * Semua permintaan memakai session cookie dan API pada origin aplikasi saat ini.
 * Tidak memerlukan CDN, pustaka grafik, ataupun endpoint baru.
 *
 * API sumber:
 * GET /api/me, /api/menu, /api/pic, /api/notifikasi/task
 * GET /api/dashboard/project?tahun=&jenis_proyek=&pic_id=
 * GET /api/dashboard/financial?tahun=&jenis_proyek=&pic_id=
 * GET /api/dashboard/contract?tahun=
 * GET /api/dashboard/business?tahun=
 * GET /api/timeline?page=1&limit=1&mode=contract-overview&bulan=3
 * GET /api/timeline?page=1&limit=1&mode=contract-overview&status=expired
 *
 * Kontrak dan business memakai cakupan semua proyek yang dapat diakses user.
 * API yang tersedia belum menerapkan filter jenis/PIC pada kedua bagian itu.
 * total_semua_proyek berasal dari server, yaitu akumulasi kategori overview.
 */

(() => {
  "use strict";

  // ======================================================
  // KONFIGURASI API DAN HALAMAN
  // ======================================================

  const API = Object.freeze({
    me: "/api/me",
    menu: "/api/menu",
    pic: "/api/pic",
    project: "/api/dashboard/project",
    financial: "/api/dashboard/financial",
    contract: "/api/dashboard/contract",
    business: "/api/dashboard/business",
    timeline: "/api/timeline",
    notifications: "/api/notifikasi/task"
  });

  const PAGES = Object.freeze({
    login: "/login.html",
    projects: "/proyek.html",
    income: "/pendapatan.html",
    expense: "/pengeluaran.html",
    contract: "/kontrak.html",
    timeline: "/timeline.html",
    notUpdated: "/proyek-belum-update.html",
    projectDetail: "/detail-proyek.html"
  });

  const $ = id => document.getElementById(id);

  const number = value =>
    Number.isFinite(Number(value))
      ? Number(value)
      : 0;

  const esc = value =>
    String(value ?? "").replace(
      /[&<>"']/g,
      char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char])
    );

  const money = value =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(number(value));

  const compact = value => {
    const amount = number(value);
    const abs = Math.abs(amount);

    const unit =
      abs >= 1e12
        ? [1e12, "T"]
        : abs >= 1e9
          ? [1e9, "M"]
          : abs >= 1e6
            ? [1e6, "jt"]
            : null;

    return unit
      ? `Rp ${new Intl.NumberFormat("id-ID", {
          maximumFractionDigits: 2
        }).format(amount / unit[0])} ${unit[1]}`
      : money(amount);
  };

  const percent = value =>
    `${new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 1
    }).format(number(value))}%`;

  const count = value =>
    number(value).toLocaleString("id-ID");

  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ];

  const colors = {
    reguler: "#2674ba",
    sewa: "#9872c3",
    transaksi: "#96bf5c",
    dibayar: "#2674ba"
  };

  const seriesLabels = {
    reguler: "Reguler",
    sewa: "Sewa",
    transaksi: "Transaksi",
    dibayar: "Dibayar partner"
  };

  const stages = [
    {
      key: "pipeline",
      label: "Pipeline",
      detail: "pipeline"
    },
    {
      key: "submit_penawaran",
      label: "Submit Penawaran",
      detail: "proposal"
    },
    {
      key: "submit_pengadaan",
      label: "Proses Pengadaan",
      detail: "procurement"
    },
    {
      key: "kontrak",
      label: "Proses Kontrak",
      detail: "contract-process"
    },
    {
      key: "proyek_aktif",
      label: "Proyek Aktif",
      detail: "active"
    },
    {
      key: "proyek_done",
      label: "Proyek Selesai",
      detail: "done"
    },
    {
      key: "proyek_terlambat",
      label: "Proyek Terlambat",
      detail: "late"
    }
  ];

  const financeCards = [
    [
      "reguler_dibayar",
      "Pendapatan reguler",
      "recognized-reguler",
      "Pendapatan diakui"
    ],
    [
      "sewa_dibayar",
      "Pendapatan sewa",
      "recognized-sewa",
      "Pendapatan diakui"
    ],
    [
      "transaksi_dibayar",
      "Pendapatan transaksi",
      "recognized-transaksi",
      "Pendapatan diakui"
    ],
    [
      "sudah_dibayar_klien",
      "Sudah dibayar klien",
      "paid-client",
      "Pembayaran termin klien"
    ],
    [
      "hutang_partner",
      "Belum dibayar partner",
      "unpaid-partner",
      "Kewajiban pembayaran partner"
    ],
    [
      "dibayar_partner",
      "Sudah dibayar partner",
      "paid-partner",
      "Pembayaran termin partner"
    ]
  ];

  const state = {
    user: null,
    fullAccess: false,
    filter: null,
    appliedFilter: null,
    data: {},
    mode: "income",
    month: 0,
    visible: new Set([
      "reguler",
      "sewa",
      "transaksi"
    ]),
    controller: null,
    requestId: 0,
    animationFrames: new Map(),
    notifications: []
  };

  let authenticating = false;

  const reducedMotion = () =>
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

  // ======================================================
  // TANGGAL DAN WAKTU
  // ======================================================

  function jakartaPeriod() {
    const parts = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "numeric",
        hour: "numeric",
        hourCycle: "h23"
      }
    ).formatToParts(new Date());

    const part = type =>
      number(
        parts.find(
          item => item.type === type
        )?.value
      );

    return {
      year: part("year"),
      month: part("month"),
      hour: part("hour")
    };
  }

  function dateLabel(value) {
    if (!value) {
      return "Tanggal belum ditentukan";
    }

    const raw = String(value);

    const date = new Date(
      /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T00:00:00+07:00`
        : raw
    );

    if (Number.isNaN(date.getTime())) {
      return "Tanggal belum ditentukan";
    }

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta"
      }
    ).format(date);
  }

  // ======================================================
  // FETCH JSON
  // ======================================================

  async function fetchJSON(
    path,
    { signal } = {}
  ) {
    const response = await fetch(
      path,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        credentials: "include",
        cache: "no-store",
        signal
      }
    );

    if (response.status === 401) {
      if (!authenticating) {
        authenticating = true;

        window.location.assign(
          PAGES.login
        );
      }

      throw new Error(
        "Sesi login berakhir. Silakan masuk kembali."
      );
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (!contentType.includes("json")) {
      throw new Error(
        `Respons API tidak sesuai (HTTP ${response.status}).`
      );
    }

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        String(
          data?.error ||
          data?.message ||
          `Gagal memuat data (HTTP ${response.status}).`
        )
      );
    }

    return data;
  }

  function asArray(response) {
    if (Array.isArray(response)) {
      return response;
    }

    for (
      const key of [
        "data",
        "rows",
        "pic",
        "result"
      ]
    ) {
      if (
        Array.isArray(
          response?.[key]
        )
      ) {
        return response[key];
      }
    }

    throw new Error(
      "Format daftar dari API tidak sesuai."
    );
  }

  // ======================================================
  // FORMAT DAN ANIMASI ANGKA
  // ======================================================

  function hasValue(object, key) {
    return (
      object != null &&
      Object.prototype.hasOwnProperty.call(
        object,
        key
      ) &&
      object[key] != null &&
      Number.isFinite(
        Number(object[key])
      )
    );
  }

  function valueText(
    object,
    key,
    format = count
  ) {
    return hasValue(object, key)
      ? format(object[key])
      : "—";
  }

  function numericText(
    id,
    object,
    key,
    format = count
  ) {
    const el = $(id);

    const previous =
      number(
        el.dataset.previous
      );

    const frame =
      state.animationFrames.get(id);

    if (frame) {
      cancelAnimationFrame(frame);
    }

    state.animationFrames.delete(id);

    if (!hasValue(object, key)) {
      el.textContent = "—";

      delete el.dataset.previous;

      el.removeAttribute("title");

      return;
    }

    const target =
      number(object[key]);

    el.dataset.previous =
      String(target);

    el.title =
      format === compact ||
      format === money
        ? money(target)
        : format(target);

    if (
      reducedMotion() ||
      previous === target
    ) {
      el.textContent =
        format(target);

      return;
    }

    const start =
      performance.now();

    const tick = now => {
      const progress =
        Math.min(
          1,
          (now - start) / 520
        );

      const current =
        previous +
        (target - previous) *
        (
          1 -
          Math.pow(
            1 - progress,
            3
          )
        );

      el.textContent =
        format(
          format === count
            ? Math.round(current)
            : current
        );

      if (progress < 1) {
        state.animationFrames.set(
          id,
          requestAnimationFrame(tick)
        );
      } else {
        state.animationFrames.delete(id);
      }
    };

    state.animationFrames.set(
      id,
      requestAnimationFrame(tick)
    );
  }

  // ======================================================
  // FILTER
  // ======================================================

  function filters() {
    return {
      tahun:
        $("diYear").value,

      jenis_proyek:
        $("diType").value,

      pic_id:
        $("diPic").value
    };
  }

  function filterQuery(
    filter,
    includePIC = true
  ) {
    const query =
      new URLSearchParams({
        tahun:
          String(filter.tahun)
      });

    if (
      includePIC &&
      filter.jenis_proyek
    ) {
      query.set(
        "jenis_proyek",
        filter.jenis_proyek
      );
    }

    if (
      includePIC &&
      filter.pic_id
    ) {
      query.set(
        "pic_id",
        filter.pic_id
      );
    }

    return query;
  }

  function link(path, query) {
    return (
      `${path}` +
      (
        query.size
          ? `?${query}`
          : ""
      )
    );
  }

  // ======================================================
  // TAUTAN RINCIAN
  // ======================================================

  function detailURL(
    detail,
    extra = {}
  ) {
    const filter =
      state.appliedFilter ||
      filters();

    const query =
      filterQuery(filter);

    let path =
      PAGES.projects;

    switch (detail) {
      case "total":
        query.set(
          "dashboard_group",
          "total-project"
        );
        break;

      case "pipeline":
        query.set(
          "status_final",
          "Aktif"
        );
        query.set(
          "status_pengadaan",
          "Pipeline"
        );
        break;

      case "proposal":
        query.set(
          "status_final",
          "Aktif"
        );
        query.set(
          "status_pengadaan",
          "Submit Penawaran"
        );
        break;

      case "procurement":
        query.set(
          "status_final",
          "Aktif"
        );
        query.set(
          "dashboard_group",
          "proses-pengadaan"
        );
        break;

      case "contract-process":
        query.set(
          "status_final",
          "Aktif"
        );
        query.set(
          "status_pengadaan",
          "Kontrak"
        );
        break;

      case "active":
        query.set(
          "status_final",
          "Aktif"
        );
        query.set(
          "status_pengadaan",
          "Done"
        );
        query.set(
          "periode_kontrak",
          "tahun"
        );
        break;

      case "done":
        query.set(
          "status_final",
          "Done"
        );
        query.set(
          "periode_kontrak",
          "tahun"
        );
        break;

      case "late":
        query.set(
          "status_final",
          "Aktif"
        );
        query.set(
          "status_pengadaan",
          "Done"
        );
        query.set(
          "tanggal_akhir",
          "expired"
        );
        query.set(
          "status_teknis_exclude",
          "done,selesai"
        );
        query.set(
          "kontrak",
          "proyek-terlambat"
        );
        break;

      case "recognized":
      case "recognized-reguler":
      case "recognized-sewa":
      case "recognized-transaksi":
        path = PAGES.income;

        query.set(
          "status_pembayaran",
          "Pendapatan Diakui"
        );

        if (
          detail !== "recognized"
        ) {
          const jenis = {
            "recognized-reguler":
              "Reguler/SLA",

            "recognized-sewa":
              "Sewa",

            "recognized-transaksi":
              "Transaksi"
          };

          query.set(
            "jenis_proyek",
            jenis[detail]
          );
        }
        break;

      case "unpaid-client":
        path = PAGES.income;

        query.set(
          "status_pembayaran",
          "Selain Dibayar"
        );
        break;

      case "paid-client":
        path = PAGES.income;

        query.set(
          "status_pembayaran",
          "Sudah Dibayar"
        );
        break;

      case "unpaid-partner":
        path = PAGES.expense;

        query.set(
          "status_pembayaran",
          "Selain Dibayar"
        );
        break;

      case "paid-partner":
        path = PAGES.expense;

        query.set(
          "status_pembayaran",
          "Sudah Dibayar"
        );
        break;

      case "not-updated":
        path = PAGES.notUpdated;

        clearReportFilters(query);

        query.set(
          "update",
          "belum-update"
        );
        break;

      case "client-soon":
      case "partner-soon":
      case "client-expired":
      case "partner-expired":
        path = PAGES.contract;

        clearReportFilters(query);

        query.set(
          "jenis",
          detail.startsWith("client")
            ? "Klien"
            : "Partner"
        );

        query.set(
          "status",
          detail.endsWith("soon")
            ? "berjalan"
            : "berakhir"
        );

        if (
          detail.endsWith("soon")
        ) {
          query.set(
            "periode",
            "3-bulan"
          );
        }
        break;

      case "timeline-soon":
      case "timeline-expired":
        path = PAGES.timeline;

        clearReportFilters(query);

        query.set(
          "mode",
          "contract-overview"
        );

        if (
          detail.endsWith("soon")
        ) {
          query.set(
            "bulan",
            "3"
          );
        } else {
          query.set(
            "status",
            "expired"
          );
        }
        break;

      default:
        return PAGES.projects;
    }

    for (
      const [key, value]
      of Object.entries(extra)
    ) {
      if (
        value != null &&
        value !== ""
      ) {
        query.set(
          key,
          String(value)
        );
      }
    }

    return link(path, query);
  }

  function clearReportFilters(query) {
    for (
      const key of [
        "tahun",
        "jenis_proyek",
        "pic_id"
      ]
    ) {
      query.delete(key);
    }
  }

  function updateLinks() {
    document
      .querySelectorAll(
        "[data-detail]"
      )
      .forEach(el => {
        const source =
          el.dataset.source;

        const available =
          !source ||
          state.data[source] != null;

        if (available) {
          el.href =
            detailURL(
              el.dataset.detail,

              el.id === "diChartDetail"
                ? chartDetailFilters()
                : {}
            );

          el.removeAttribute(
            "aria-disabled"
          );

          el.removeAttribute(
            "tabindex"
          );
        } else {
          el.removeAttribute(
            "href"
          );

          el.setAttribute(
            "aria-disabled",
            "true"
          );

          el.setAttribute(
            "tabindex",
            "-1"
          );
        }
      });

    $("diHeroProjectLink").href =
      detailURL("total");
  }

  // ======================================================
  // PESAN DAN KETERANGAN FILTER
  // ======================================================

  function showErrors(messages) {
    const el =
      $("diErrors");

    el.replaceChildren(
      ...messages.map(message => {
        const p =
          document.createElement("p");

        p.textContent =
          message;

        return p;
      })
    );

    el.hidden =
      !messages.length;
  }

  function updateFilterCaption(filter) {
    const pic =
      [...$("diPic").options]
        .find(
          option =>
            option.value ===
            filter.pic_id
        )
        ?.textContent ||
      "Semua PIC";

    $("diFilterCaption").textContent =
      `${filter.tahun} • ` +
      `${filter.jenis_proyek || "Semua jenis proyek"} • ` +
      `${pic}`;

    $("diFooterPeriod").textContent =
      `Periode Januari–Desember ${filter.tahun} • Asia/Jakarta`;
  }

  // ======================================================
  // LOAD DASHBOARD
  // ======================================================

  async function loadDashboard() {
    state.controller?.abort();

    const controller =
      new AbortController();

    state.controller =
      controller;

    const requestId =
      ++state.requestId;

    const filter =
      filters();

    state.filter =
      filter;

    $("diLoading").hidden =
      false;

    $("diRefresh").disabled =
      true;

    $("diMain").setAttribute(
      "aria-busy",
      "true"
    );

    const names = [
      "project",
      "financial",
      "contract",
      "business"
    ];

    const responses =
      await Promise.allSettled(
        names.map(name =>
          fetchJSON(
            `${API[name]}?${filterQuery(
              filter,

              name === "project" ||
              name === "financial"
            )}`,
            {
              signal:
                controller.signal
            }
          )
        )
      );

    if (
      requestId !==
        state.requestId ||
      controller.signal.aborted
    ) {
      return;
    }

    const data = {};
    const errors = [];

    const responseKeys = {
      project:
        "project_overview",

      financial:
        "financial_overview",

      contract:
        "contract_overview",

      business:
        "business_performance"
    };

    const responseLabels = {
      project:
        "Proyek",

      financial:
        "Keuangan",

      contract:
        "Kontrak",

      business:
        "Performa bisnis"
    };

    names.forEach(
      (name, index) => {
        const response =
          responses[index];

        const key =
          responseKeys[name];

        if (
          response.status ===
            "fulfilled" &&
          response.value?.[key] &&
          typeof response.value[key] ===
            "object" &&
          !Array.isArray(
            response.value[key]
          )
        ) {
          data[name] =
            response.value;
        } else {
          data[name] =
            null;

          const message =
            response.status ===
              "rejected"
              ? response.reason.message
              : "Format respons API tidak sesuai.";

          errors.push(
            `${responseLabels[name]} belum tersedia: ${message}`
          );
        }
      }
    );

    if (authenticating) {
      return;
    }

    state.data =
      data;

    state.appliedFilter = {
      ...filter
    };

    const enforcedPIC =
      data.project?.filter?.pic_id ??
      data.financial?.filter?.pic_id;

    if (
      !state.fullAccess &&
      enforcedPIC
    ) {
      state.appliedFilter.pic_id =
        String(enforcedPIC);

      ensurePICOption(
        String(enforcedPIC),

        state.user?.nama ||
        state.user?.nama_pic ||
        "PIC saya"
      );

      $("diPic").value =
        String(enforcedPIC);
    }

    renderProject();
    renderFinance();
    renderContract();
    renderBusiness();
    updateLinks();

    updateFilterCaption(
      state.appliedFilter
    );

    const sourceTime =
      data.project?.generated_at ||
      data.financial?.generated_at;

    const date =
      sourceTime
        ? new Date(sourceTime)
        : new Date();

    const successful =
      names.filter(
        name => data[name]
      );

    const updatedTime =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta"
        }
      ).format(
        Number.isNaN(
          date.getTime()
        )
          ? new Date()
          : date
      );

    $("diUpdated").textContent =
      successful.length
        ? (
            successful.length <
            names.length
              ? "Sebagian data • "
              : ""
          ) +
          `Diperbarui ${updatedTime} WIB`
        : "Data belum berhasil dimuat";

    showErrors(errors);

    $("diLoading").hidden =
      true;

    $("diRefresh").disabled =
      false;

    $("diMain").removeAttribute(
      "aria-busy"
    );

    const url =
      new URL(
        window.location.href
      );

    for (
      const [key, value]
      of Object.entries(
        state.appliedFilter
      )
    ) {
      if (value) {
        url.searchParams.set(
          key,
          value
        );
      } else {
        url.searchParams.delete(key);
      }
    }

    window.history.replaceState(
      {},
      "",
      url
    );

    if (data.contract) {
      loadTimelineCounts(
        requestId,
        controller.signal
      );
    }
  }

  // ======================================================
  // PROJECT OVERVIEW
  // ======================================================

  function renderProject() {
    const p =
      state.data.project
        ?.project_overview;

    numericText(
      "diTotalProjects",
      p,
      "total_semua_proyek"
    );

    numericText(
      "diActive",
      p,
      "total_proyek_aktif"
    );

    $("diActiveValue").textContent =
      hasValue(
        p,
        "nilai_proyek_aktif"
      )
        ? `${compact(
            p.nilai_proyek_aktif
          )} • nilai proyek aktif`
        : "Nilai proyek belum tersedia";

    $("diStages").innerHTML =
      stages
        .map(stage => `
          <a
            class="di-stage"
            data-source="project"
            data-detail="${stage.detail}"
          >
            <span class="di-stage-label">
              ${stage.label}
            </span>

            <strong class="di-stage-number">
              ${valueText(
                p,
                `total_${stage.key}`
              )}
            </strong>

            <span
              class="di-stage-money"
              title="${esc(
                valueText(
                  p,
                  `nilai_${stage.key}`,
                  money
                )
              )}"
            >
              ${valueText(
                p,
                `nilai_${stage.key}`,
                compact
              )}
            </span>

            <div class="di-stage-bar"></div>
          </a>
        `)
        .join("");
  }

  // ======================================================
  // FINANCIAL OVERVIEW
  // ======================================================

  function renderFinance() {
    const f =
      state.data.financial
        ?.financial_overview;

    const incomeKeys = [
      "reguler_dibayar",
      "sewa_dibayar",
      "transaksi_dibayar"
    ];

    const total =
      f &&
      incomeKeys.every(
        key => hasValue(f, key)
      )
        ? {
            total:
              incomeKeys.reduce(
                (sum, key) =>
                  sum +
                  number(f[key]),
                0
              )
          }
        : null;

    numericText(
      "diRevenue",
      total,
      "total",
      compact
    );

    numericText(
      "diUnpaid",
      f,
      "piutang_klien",
      compact
    );

    numericText(
      "diKpiPercent",
      f,
      "persentase_kpi",
      percent
    );

    numericText(
      "diKpiTarget",
      f,
      "kpi",
      compact
    );

    numericText(
      "diKpiActual",
      f,
      "realisasi_kpi",
      compact
    );

    const ring =
      $("diKpiRing");

    const ratio =
      hasValue(
        f,
        "persentase_kpi"
      )
        ? number(
            f.persentase_kpi
          )
        : 0;

    ring.style.setProperty(
      "--progress",

      `${Math.max(
        0,
        Math.min(
          100,
          ratio
        )
      )}%`
    );

    ring.setAttribute(
      "aria-label",

      f
        ? `Realisasi KPI ${valueText(
            f,
            "persentase_kpi",
            percent
          )}`
        : "KPI belum tersedia"
    );

    $("diKpiCaption").textContent =
      !f
        ? "Data KPI belum tersedia."
        : hasValue(f, "kpi") &&
          number(f.kpi) === 0
          ? "Target KPI pada filter laporan ini belum ditetapkan."
          : ratio >= 100
            ? "Realisasi telah mencapai target KPI pada filter laporan ini."
            : "Target dan realisasi mengikuti tahun, jenis proyek, dan PIC yang dipilih.";

    $("diFinanceCards").innerHTML =
      financeCards
        .map(
          (
            [
              key,
              label,
              detail,
              note
            ]
          ) => `
            <a
              class="di-finance-card"
              data-detail="${detail}"
              data-source="financial"
            >
              <span>${label}</span>

              <strong
                title="${esc(
                  valueText(
                    f,
                    key,
                    money
                  )
                )}"
              >
                ${valueText(
                  f,
                  key,
                  compact
                )}
              </strong>

              <small>${note} ↗</small>
            </a>
          `
        )
        .join("");

    $("diExport").disabled =
      !state.data.financial ||
      !Array.isArray(
        state.data.financial
          .income_monthly
      ) ||
      !Array.isArray(
        state.data.financial
          .partner_monthly
      );

    renderChart();
    renderMonthlyTable();
  }

  // ======================================================
  // BUSINESS PERFORMANCE
  // ======================================================

  function renderBusiness() {
    const b =
      state.data.business
        ?.business_performance;

    numericText(
      "diMargin",
      b,
      "margin_rata_rata",
      percent
    );

    numericText(
      "diNotUpdated",
      b,
      "proyek_belum_update"
    );
  }

  // ======================================================
  // CONTRACT OVERVIEW
  // ======================================================

  function renderContract() {
    const c =
      state.data.contract
        ?.contract_overview;

    const groups = [
      [
        "Kontrak Klien",
        "kontrak_klien_akan_jatuh_tempo",
        "client-soon",
        "kontrak_klien_jatuh_tempo",
        "client-expired"
      ],
      [
        "Kontrak Partner",
        "kontrak_partner_akan_jatuh_tempo",
        "partner-soon",
        "kontrak_partner_jatuh_tempo",
        "partner-expired"
      ],
      [
        "Lisensi & Sewa",
        "lisensi_sewa_akan_jatuh_tempo",
        "timeline-soon",
        "lisensi_sewa_jatuh_tempo",
        "timeline-expired"
      ]
    ];

    $("diContractCards").innerHTML =
      groups
        .map(
          (
            [
              label,
              soon,
              soonDetail,
              expired,
              expiredDetail
            ]
          ) => `
            <article class="di-panel">
              <div class="di-contract-title">
                <svg class="icon">
                  <use href="#di-calendar"/>
                </svg>

                ${label}
              </div>

              <a
                class="di-contract-row"
                data-detail="${soonDetail}"
                data-source="contract"
              >
                <span>
                  Berakhir ≤ 3 bulan
                </span>

                <span class="di-contract-row-right">
                  <strong id="di-${soon}">
                    ${valueText(c, soon)}
                  </strong>

                  <svg class="icon">
                    <use href="#di-arrow"/>
                  </svg>
                </span>
              </a>

              <a
                class="di-contract-row expired"
                data-detail="${expiredDetail}"
                data-source="contract"
              >
                <span>
                  Telah berakhir
                </span>

                <span class="di-contract-row-right">
                  <strong id="di-${expired}">
                    ${valueText(c, expired)}
                  </strong>

                  <svg class="icon">
                    <use href="#di-arrow"/>
                  </svg>
                </span>
              </a>
            </article>
          `
        )
        .join("");
  }

  async function loadTimelineCounts(
    requestId,
    signal
  ) {
    const totals =
      await Promise.allSettled(
        [
          "bulan=3",
          "status=expired"
        ].map(query =>
          fetchJSON(
            `${API.timeline}?page=1&limit=1&mode=contract-overview&${query}`,
            { signal }
          )
        )
      );

    if (
      requestId !==
        state.requestId ||
      signal.aborted
    ) {
      return;
    }

    for (
      let index = 0;
      index < totals.length;
      index++
    ) {
      const result =
        totals[index];

      const key =
        index === 0
          ? "lisensi_sewa_akan_jatuh_tempo"
          : "lisensi_sewa_jatuh_tempo";

      if (
        result.status ===
          "fulfilled" &&
        hasValue(
          result.value.pagination,
          "total_data"
        )
      ) {
        const total =
          number(
            result.value
              .pagination
              .total_data
          );

        state.data.contract
          .contract_overview[key] =
            total;

        $(`di-${key}`).textContent =
          count(total);
      }

      // Jika listing gagal, angka dashboard/contract tetap dipakai.
    }
  }

  // ======================================================
  // DATA GRAFIK BULANAN
  // ======================================================

  function monthlyRows() {
    const financial =
      state.data.financial;

    if (!financial) {
      return null;
    }

    const rows =
      state.mode === "income"
        ? financial.income_monthly
        : financial.partner_monthly;

    if (!Array.isArray(rows)) {
      return null;
    }

    return months.map(
      (_, index) => {
        const source =
          rows.find(
            row =>
              number(row.bulan) ===
              index + 1
          );

        return source
          ? {
              ...source,
              bulan: index + 1
            }
          : null;
      }
    );
  }

  function chartKeys() {
    return state.mode === "income"
      ? [...state.visible]
      : ["dibayar"];
  }

  function chartDetailFilters(
    month = state.month
  ) {
    const extra =
      month
        ? {
            bulan: month
          }
        : {};

    const filter =
      state.appliedFilter ||
      filters();

    if (
      state.mode === "income" &&
      !filter.jenis_proyek &&
      state.visible.size === 1
    ) {
      const jenis = {
        reguler: "Reguler/SLA",
        sewa: "Sewa",
        transaksi: "Transaksi"
      };

      extra.jenis_proyek =
        jenis[
          [...state.visible][0]
        ];
    }

    return extra;
  }

  function rowTotal(
    row,
    keys = chartKeys()
  ) {
    return (
      row &&
      keys.every(
        key => hasValue(row, key)
      )
    )
      ? keys.reduce(
          (sum, key) =>
            sum +
            number(row[key]),
          0
        )
      : null;
  }

  // ======================================================
  // RENDER GRAFIK SVG
  // ======================================================

  function renderChart() {
    const isIncome =
      state.mode === "income";

    const rows =
      monthlyRows();

    const keys =
      chartKeys();

    $("diChartTitle").textContent =
      isIncome
        ? "Tren pendapatan"
        : "Tren pengeluaran partner";

    $("diChartSubtitle").textContent =
      isIncome
        ? "Pendapatan diakui per bulan"
        : "Pembayaran partner per bulan";

    document
      .querySelectorAll(
        "[data-chart-mode]"
      )
      .forEach(button => {
        button.setAttribute(
          "aria-pressed",

          String(
            button.dataset
              .chartMode ===
            state.mode
          )
        );
      });

    $("diChartTooltip").hidden =
      true;

    const selectedRows =
      rows
        ? state.month
          ? [
              rows[
                state.month - 1
              ]
            ]
          : rows
        : [];

    const totals =
      selectedRows.map(
        row => rowTotal(row)
      );

    const total =
      selectedRows.length &&
      totals.every(
        value => value != null
      )
        ? totals.reduce(
            (sum, value) =>
              sum + value,
            0
          )
        : null;

    $("diChartHeadline").textContent =
      total == null
        ? "—"
        : compact(total);

    $("diChartHeadline").title =
      total == null
        ? "Data belum tersedia"
        : money(total);

    const filterYear =
      (
        state.appliedFilter ||
        filters()
      ).tahun;

    $("diChartNote").textContent =
      `${
        state.month
          ? months[
              state.month - 1
            ]
          : "Januari–Desember"
      } ${filterYear} • ${
        isIncome
          ? "pendapatan diakui"
          : "sudah dibayar partner"
      }`;

    const legendKeys =
      isIncome
        ? [
            "reguler",
            "sewa",
            "transaksi"
          ]
        : ["dibayar"];

    $("diChartLegend").innerHTML =
      legendKeys
        .map(key => `
          <button
            type="button"
            data-series="${key}"
            aria-pressed="${
              !isIncome ||
              state.visible.has(key)
            }"
            ${isIncome ? "" : "disabled"}
          >
            <i
              style="background:${colors[key]}"
            ></i>

            ${seriesLabels[key]}
          </button>
        `)
        .join("");

    const detail =
      isIncome
        ? "recognized"
        : "paid-partner";

    $("diChartDetail").dataset.detail =
      detail;

    $("diChartDetail").innerHTML = `
      ${
        isIncome
          ? "Buka rincian pendapatan"
          : "Buka rincian pengeluaran"
      }

      <svg class="icon">
        <use href="#di-arrow"/>
      </svg>
    `;

    if (state.data.financial) {
      $("diChartDetail").href =
        detailURL(
          detail,
          chartDetailFilters()
        );
    } else {
      $("diChartDetail")
        .removeAttribute("href");
    }

    const svg =
      $("diChart");

    if (
      !rows ||
      !rows.some(Boolean)
    ) {
      svg.innerHTML = `
        <text
          x="325"
          y="110"
          text-anchor="middle"
        >
          Data grafik belum tersedia
        </text>
      `;

      return;
    }

    const left = 52;
    const right = 625;
    const top = 20;
    const bottom = 190;

    const raw =
      rows.flatMap(row =>
        keys.map(key =>
          hasValue(row, key)
            ? number(row[key])
            : 0
        )
      );

    const actualMax =
      Math.max(
        0,
        ...raw
      );

    const actualMin =
      Math.min(
        0,
        ...raw
      );

    const nice = value => {
      if (value <= 0) {
        return 1;
      }

      const power =
        Math.pow(
          10,
          Math.floor(
            Math.log10(value)
          )
        );

      const scaled =
        value / power;

      const rounded =
        scaled <= 1
          ? 1
          : scaled <= 2
            ? 2
            : scaled <= 5
              ? 5
              : 10;

      return rounded * power;
    };

    const maximum =
      actualMax
        ? nice(
            actualMax * 1.08
          )
        : actualMin
          ? 0
          : 1;

    const minimum =
      actualMin
        ? -nice(
            Math.abs(
              actualMin
            ) * 1.08
          )
        : 0;

    const x = index =>
      left +
      index *
      (right - left) / 11;

    const y = value =>
      bottom -
      (
        (
          number(value) -
          minimum
        ) /
        (
          maximum -
          minimum
        )
      ) *
      (
        bottom -
        top
      );

    let content = `
      <title>
        Grafik bulanan. Pilih bulan untuk membuka rincian.
      </title>
    `;

    for (
      let tick = 0;
      tick <= 4;
      tick++
    ) {
      const value =
        minimum +
        tick *
        (
          maximum -
          minimum
        ) / 4;

      const position =
        y(value);

      const label =
        value === 0
          ? "0"
          : compact(value)
              .replace(
                /^Rp\s*/,
                ""
              );

      content += `
        <line
          x1="${left}"
          x2="${right}"
          y1="${position}"
          y2="${position}"
          stroke="#e9eef5"
          stroke-dasharray="3 4"
        />

        <text
          x="${left - 9}"
          y="${position + 3}"
          text-anchor="end"
        >
          ${label}
        </text>
      `;
    }

    if (state.month) {
      content += `
        <rect
          x="${
            x(state.month - 1) - 20
          }"
          y="${top}"
          width="40"
          height="${bottom - top}"
          rx="7"
          fill="#1263b408"
        />
      `;
    }

    if (isIncome) {
      keys.forEach(key => {
        const segments = [];

        let current = [];

        rows.forEach(
          (row, index) => {
            if (
              hasValue(row, key)
            ) {
              current.push([
                x(index),
                y(row[key])
              ]);
            } else if (
              current.length
            ) {
              segments.push(
                current
              );

              current = [];
            }
          }
        );

        if (current.length) {
          segments.push(current);
        }

        segments.forEach(points => {
          const path =
            points
              .map(
                (
                  [px, py],
                  index
                ) =>
                  `${
                    index
                      ? "L"
                      : "M"
                  }${px.toFixed(2)},${py.toFixed(2)}`
              )
              .join(" ");

          content += `
            <path
              d="${path}"
              fill="none"
              stroke="${colors[key]}"
              stroke-width="2.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          `;

          points.forEach(
            ([px, py]) => {
              content += `
                <circle
                  cx="${px}"
                  cy="${py}"
                  r="3.2"
                  fill="white"
                  stroke="${colors[key]}"
                  stroke-width="1.8"
                />
              `;
            }
          );
        });
      });
    } else {
      rows.forEach(
        (row, index) => {
          if (
            !hasValue(
              row,
              "dibayar"
            )
          ) {
            return;
          }

          const value =
            number(
              row.dibayar
            );

          const base =
            y(0);

          const height =
            Math.max(
              1,
              Math.abs(
                y(value) -
                base
              )
            );

          content += `
            <rect
              x="${x(index) - 12}"
              y="${
                Math.min(
                  y(value),
                  base
                )
              }"
              width="24"
              height="${height}"
              rx="4"
              fill="${
                state.month ===
                  index + 1
                  ? "#7858b6"
                  : "#90b5da"
              }"
            />
          `;
        }
      );
    }

    rows.forEach(
      (row, index) => {
        const amount =
          rowTotal(row);

        const label =
          `${months[index]} ${filterYear}, ` +
          `${
            amount == null
              ? "data tidak tersedia"
              : money(amount)
          }. Buka rincian.`;

        if (amount != null) {
          const href =
            detailURL(
              detail,

              chartDetailFilters(
                index + 1
              )
            );

          content += `
            <a
              class="di-month-hit"
              data-month="${index + 1}"
              href="${esc(href)}"
              aria-label="${esc(label)}"
            >
              <rect
                x="${x(index) - 21}"
                y="${top - 5}"
                width="42"
                height="${
                  bottom -
                  top +
                  34
                }"
                rx="6"
                fill="transparent"
              />

              <title>
                ${esc(label)}
              </title>
            </a>
          `;
        }

        content += `
          <text
            x="${x(index)}"
            y="216"
            text-anchor="middle"
            ${
              state.month ===
                index + 1
                ? 'style="fill:#1263b4;font-weight:700"'
                : ""
            }
          >
            ${
              months[index]
                .slice(0, 3)
            }
          </text>
        `;
      }
    );

    svg.innerHTML =
      content;
  }

  // ======================================================
  // TOOLTIP GRAFIK
  // ======================================================

  function showChartTooltip(month) {
    const rows =
      monthlyRows();

    const row =
      rows?.[month - 1];

    if (!row) {
      return;
    }

    const tooltip =
      $("diChartTooltip");

    tooltip.innerHTML = `
      <strong>
        ${months[month - 1]}

        ${
          (
            state.appliedFilter ||
            filters()
          ).tahun
        }
      </strong>

      ${
        chartKeys()
          .map(key => `
            <div>
              ${seriesLabels[key]}:

              ${
                valueText(
                  row,
                  key,
                  money
                )
              }
            </div>
          `)
          .join("")
      }

      <div
        style="opacity:.6;margin-top:4px"
      >
        Klik untuk membuka rincian
      </div>
    `;

    tooltip.hidden =
      false;
  }

  // ======================================================
  // TABEL BULANAN
  // ======================================================

  function renderMonthlyTable() {
    const financial =
      state.data.financial;

    $("diMonthlyTable").innerHTML =
      financial
        ? months
            .map(
              (label, index) => {
                const income =
                  financial
                    .income_monthly
                    ?.find?.(
                      row =>
                        number(
                          row.bulan
                        ) ===
                        index + 1
                    );

                const expense =
                  financial
                    .partner_monthly
                    ?.find?.(
                      row =>
                        number(
                          row.bulan
                        ) ===
                        index + 1
                    );

                const href =
                  detailURL(
                    "recognized",
                    {
                      bulan:
                        index + 1
                    }
                  );

                return `
                  <tr>
                    <td>
                      <a href="${esc(href)}">
                        ${label}
                      </a>
                    </td>

                    <td>
                      ${valueText(
                        income,
                        "reguler",
                        money
                      )}
                    </td>

                    <td>
                      ${valueText(
                        income,
                        "sewa",
                        money
                      )}
                    </td>

                    <td>
                      ${valueText(
                        income,
                        "transaksi",
                        money
                      )}
                    </td>

                    <td>
                      ${valueText(
                        expense,
                        "dibayar",
                        money
                      )}
                    </td>
                  </tr>
                `;
              }
            )
            .join("")
        : `
          <tr>
            <td colspan="5">
              Data keuangan belum tersedia.
            </td>
          </tr>
        `;
  }

  // ======================================================
  // EXPORT CSV
  // ======================================================

  function exportCSV() {
    const financial =
      state.data.financial;

    if (!financial) {
      return;
    }

    const filter =
      state.appliedFilter ||
      filters();

    const rows = [
      [
        "Tahun",
        "Bulan",
        "Reguler",
        "Sewa",
        "Transaksi",
        "Pengeluaran Partner",
        "Jenis Proyek",
        "PIC ID"
      ]
    ];

    months.forEach(
      (label, index) => {
        const income =
          financial
            .income_monthly
            ?.find(
              row =>
                number(
                  row.bulan
                ) ===
                index + 1
            );

        const expense =
          financial
            .partner_monthly
            ?.find(
              row =>
                number(
                  row.bulan
                ) ===
                index + 1
            );

        const incomeValues =
          [
            "reguler",
            "sewa",
            "transaksi"
          ].map(key =>
            hasValue(
              income,
              key
            )
              ? number(
                  income[key]
                )
              : ""
          );

        rows.push([
          filter.tahun,
          label,
          ...incomeValues,

          hasValue(
            expense,
            "dibayar"
          )
            ? number(
                expense.dibayar
              )
            : "",

          filter.jenis_proyek ||
            "Semua",

          filter.pic_id ||
            "Semua"
        ]);
      }
    );

    const csvCell = value => {
      const raw =
        typeof value === "number"
          ? String(value)
          : String(value).replace(
              /^[=+\-@\t\r]/,
              "'$&"
            );

      return (
        `"${raw.replaceAll(
          '"',
          '""'
        )}"`
      );
    };

    const blob =
      new Blob(
        [
          "\uFEFF",

          rows
            .map(row =>
              row
                .map(csvCell)
                .join(";")
            )
            .join("\r\n")
        ],
        {
          type:
            "text/csv;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href =
      url;

    a.download =
      `laporan-dashboard-${filter.tahun}.csv`;

    document.body.appendChild(a);

    a.click();

    a.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(url),
      1000
    );
  }

  // ======================================================
  // FILTER PIC
  // ======================================================

  function ensurePICOption(
    id,
    label
  ) {
    if (
      !id ||
      [...$("diPic").options]
        .some(
          option =>
            option.value === id
        )
    ) {
      return;
    }

    $("diPic").add(
      new Option(
        label,
        id
      )
    );
  }

  async function loadPIC() {
    try {
      const rows =
        asArray(
          await fetchJSON(
            API.pic
          )
        );

      rows.sort(
        (a, b) =>
          String(
            a.nama ||
            a.nama_pic ||
            a.inisial ||
            ""
          ).localeCompare(
            String(
              b.nama ||
              b.nama_pic ||
              b.inisial ||
              ""
            ),
            "id"
          )
      );

      rows.forEach(row => {
        const id =
          String(
            row.id ??
            row.pic_id ??
            ""
          );

        if (
          /^[1-9]\d*$/.test(id)
        ) {
          const label =
            String(
              row.nama ||
              row.nama_pic ||
              row.inisial ||
              `PIC ${id}`
            );

          const existing =
            [
              ...$("diPic")
                .options
            ].find(
              option =>
                option.value === id
            );

          if (existing) {
            existing.textContent =
              label;
          } else {
            ensurePICOption(
              id,
              label
            );
          }
        }
      });

      if (
        state.appliedFilter
      ) {
        updateFilterCaption(
          state.appliedFilter
        );
      }
    } catch {
      $("diPic").title =
        "Daftar PIC belum tersedia. Gunakan Perbarui untuk mencoba memuat kembali.";
    }
  }

  // ======================================================
  // MENU SIDEBAR
  // ======================================================

  function safeMenuURL(value) {
    if (
      !value ||
      String(value).trim() === "#"
    ) {
      return null;
    }

    try {
      const url =
        new URL(
          value,
          window.location.origin
        );

      return (
        url.origin ===
          window.location.origin &&
        [
          "http:",
          "https:"
        ].includes(
          url.protocol
        )
      )
        ? `${url.pathname}${url.search}${url.hash}`
        : null;
    } catch {
      return null;
    }
  }

  async function loadMenu() {
    try {
      const rows =
        asArray(
          await fetchJSON(
            API.menu
          )
        );

      const seen =
        new Set();

      const links =
        rows.filter(row => {
          const path =
            safeMenuURL(
              row.url
            );

          if (
            !path ||
            seen.has(path)
          ) {
            return false;
          }

          seen.add(path);

          return true;
        });

      $("diMenuLinks").innerHTML =
        links
          .map(row => {
            const icon =
              /pendapatan|pengeluaran|keuangan/i.test(
                row.nama_menu
              )
                ? "di-wallet"
                : /task/i.test(
                    row.nama_menu
                  )
                  ? "di-check"
                  : /kontrak|timeline/i.test(
                      row.nama_menu
                    )
                    ? "di-calendar"
                    : "di-folder";

            return `
              <a
                class="di-nav-link"
                href="${esc(
                  safeMenuURL(
                    row.url
                  )
                )}"
              >
                <svg class="icon">
                  <use href="#${icon}"/>
                </svg>

                ${esc(
                  row.nama_menu ||
                  "Menu"
                )}
              </a>
            `;
          })
          .join("");
    } catch {
      $("diMenuLinks").textContent =
        "";
    }
  }

  // ======================================================
  // NOTIFIKASI
  // ======================================================

  async function loadNotifications() {
    try {
      const response =
        await fetchJSON(
          API.notifications
        );

      const rows =
        asArray(response);

      state.notifications =
        rows;

      const unread =
        hasValue(
          response,
          "jumlah_belum_dibaca"
        )
          ? number(
              response
                .jumlah_belum_dibaca
            )
          : rows.filter(
              row =>
                !row.sudah_dibaca
            ).length;

      $("diNotificationCount").hidden =
        !unread;

      $("diNotificationCount").textContent =
        unread > 99
          ? "99+"
          : String(unread);

      $("diOpenNotifications")
        .setAttribute(
          "aria-label",
          `Buka notifikasi task, ${unread} belum dibaca`
        );

      $("diNotificationList").innerHTML =
        rows.length
          ? rows
              .map(row => {
                const id =
                  Number(
                    row.proyek_id
                  );

                const url =
                  Number.isInteger(id) &&
                  id > 0
                    ? `${PAGES.projectDetail}?id=${id}`
                    : null;

                const tag =
                  url
                    ? "a"
                    : "div";

                const tanggal =
                  row.tanggal_notifikasi ||
                  row.tanggal_tindak_lanjut ||
                  row.target_date;

                return `
                  <${tag}
                    ${
                      url
                        ? `href="${esc(url)}"`
                        : ""
                    }
                    class="di-notification-item"
                  >
                    <strong>
                      ${esc(
                        row.task ||
                        "Task proyek"
                      )}
                    </strong>

                    <p>
                      ${esc(
                        row.nama_proyek ||
                        "Proyek"
                      )}

                      •

                      ${esc(
                        row.status ||
                        ""
                      )}
                    </p>

                    <small>
                      ${
                        row.sudah_dibaca
                          ? ""
                          : "● "
                      }

                      ${esc(
                        dateLabel(
                          tanggal
                        )
                      )}
                    </small>
                  </${tag}>
                `;
              })
              .join("")
          : `
            <div class="di-empty">
              Tidak ada task atau tindak lanjut yang perlu diperhatikan.
            </div>
          `;
    } catch {
      $("diNotificationList").innerHTML = `
        <div class="di-empty">
          Notifikasi belum tersedia. Tutup dan buka kembali untuk mencoba lagi.
        </div>
      `;
    }
  }

  // ======================================================
  // INISIALISASI FILTER
  // ======================================================

  function initFilters() {
    const period =
      jakartaPeriod();

    const params =
      new URLSearchParams(
        window.location.search
      );

    const requested =
      Number(
        params.get("tahun")
      );

    const year =
      Number.isInteger(
        requested
      ) &&
      requested >= 2020 &&
      requested <= 2100
        ? requested
        : period.year;

    const years =
      new Set([year]);

    for (
      let value =
        period.year + 1;

      value >= 2020;

      value--
    ) {
      years.add(value);
    }

    [...years]
      .sort(
        (a, b) => b - a
      )
      .forEach(value => {
        $("diYear").add(
          new Option(
            String(value),
            String(value)
          )
        );
      });

    $("diYear").value =
      String(year);

    const type =
      params.get(
        "jenis_proyek"
      ) || "";

    if (
      type &&
      type.length < 120 &&
      ![
        ...$("diType").options
      ].some(
        option =>
          option.value === type
      )
    ) {
      $("diType").add(
        new Option(
          type,
          type
        )
      );
    }

    $("diType").value =
      type;

    const pic =
      state.fullAccess
        ? params.get(
            "pic_id"
          ) || ""
        : String(
            state.user?.id ||
            ""
          );

    if (
      /^[1-9]\d*$/.test(pic)
    ) {
      ensurePICOption(
        pic,

        state.fullAccess
          ? `PIC ${pic}`
          : state.user.nama ||
            state.user.nama_pic ||
            "PIC saya"
      );

      $("diPic").value =
        pic;
    }

    if (
      !state.fullAccess
    ) {
      $("diPic").disabled =
        true;
    }

    months.forEach(
      (month, index) => {
        $("diChartMonth").add(
          new Option(
            month,
            String(index + 1)
          )
        );
      }
    );

    $("diToday").textContent =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Jakarta"
        }
      ).format(
        new Date()
      );
  }

  // ======================================================
  // SIDEBAR MOBILE
  // ======================================================

  function sidebar(open) {
    $("diSidebar").classList.toggle(
      "open",
      open
    );

    $("diOverlay").hidden =
      !open;

    $("diOpenSidebar")
      .setAttribute(
        "aria-expanded",
        String(open)
      );

    if (open) {
      $("diSidebar").inert =
        false;

      $("diCloseSidebar").focus();
    } else if (
      window.innerWidth <= 760
    ) {
      $("diSidebar").inert =
        true;

      $("diOpenSidebar").focus();
    }
  }

  // ======================================================
  // EVENT LISTENERS
  // ======================================================

  function bindEvents() {
    $("diFilterForm")
      .addEventListener(
        "submit",
        event => {
          event.preventDefault();

          loadDashboard();
          loadNotifications();
          loadPIC();
        }
      );

    [
      "diYear",
      "diType",
      "diPic"
    ].forEach(id => {
      $(id).addEventListener(
        "change",
        () => loadDashboard()
      );
    });

    $("diReset")
      .addEventListener(
        "click",
        () => {
          $("diYear").value =
            String(
              jakartaPeriod().year
            );

          $("diType").value =
            "";

          $("diPic").value =
            state.fullAccess
              ? ""
              : String(
                  state.user?.id ||
                  ""
                );

          state.month =
            0;

          $("diChartMonth").value =
            "0";

          loadDashboard();
        }
      );

    $("diExport")
      .addEventListener(
        "click",
        exportCSV
      );

    $("diChartMonth")
      .addEventListener(
        "change",
        event => {
          state.month =
            Number(
              event.target.value
            );

          renderChart();
        }
      );

    document
      .querySelectorAll(
        "[data-chart-mode]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            state.mode =
              button.dataset
                .chartMode;

            renderChart();
          }
        );
      });

    $("diChartLegend")
      .addEventListener(
        "click",
        event => {
          const button =
            event.target.closest(
              "[data-series]"
            );

          if (
            !button ||
            state.mode !== "income"
          ) {
            return;
          }

          const key =
            button.dataset.series;

          if (
            state.visible.has(key)
          ) {
            if (
              state.visible.size === 1
            ) {
              return;
            }

            state.visible.delete(key);
          } else {
            state.visible.add(key);
          }

          renderChart();
        }
      );

    $("diChart")
      .addEventListener(
        "pointerover",
        event => {
          const el =
            event.target.closest(
              "[data-month]"
            );

          if (el) {
            showChartTooltip(
              Number(
                el.dataset.month
              )
            );
          }
        }
      );

    $("diChart")
      .addEventListener(
        "pointerleave",
        () => {
          $("diChartTooltip").hidden =
            true;
        }
      );

    $("diChart")
      .addEventListener(
        "focusin",
        event => {
          const el =
            event.target.closest(
              "[data-month]"
            );

          if (el) {
            showChartTooltip(
              Number(
                el.dataset.month
              )
            );
          }
        }
      );

    $("diChart")
      .addEventListener(
        "focusout",
        () => {
          $("diChartTooltip").hidden =
            true;
        }
      );

    document
      .addEventListener(
        "click",
        event => {
          if (
            event.target.closest(
              '[aria-disabled="true"]'
            )
          ) {
            event.preventDefault();
          }
        }
      );

    $("diOpenNotifications")
      .addEventListener(
        "click",
        () => {
          $("diNotifications")
            .showModal();

          loadNotifications();
        }
      );

    $("diCloseNotifications")
      .addEventListener(
        "click",
        () => {
          $("diNotifications")
            .close();
        }
      );

    $("diNotifications")
      .addEventListener(
        "click",
        event => {
          if (
            event.target !==
            $("diNotifications")
          ) {
            return;
          }

          const bounds =
            $("diNotifications")
              .getBoundingClientRect();

          const outside =
            event.clientX <
              bounds.left ||
            event.clientX >
              bounds.right ||
            event.clientY <
              bounds.top ||
            event.clientY >
              bounds.bottom;

          if (outside) {
            $("diNotifications")
              .close();
          }
        }
      );

    $("diOpenSidebar")
      .addEventListener(
        "click",
        () => sidebar(true)
      );

    $("diCloseSidebar")
      .addEventListener(
        "click",
        () => sidebar(false)
      );

    $("diOverlay")
      .addEventListener(
        "click",
        () => sidebar(false)
      );

    $("diSidebar")
      .addEventListener(
        "click",
        event => {
          if (
            event.target.closest("a") &&
            window.innerWidth <= 760
          ) {
            sidebar(false);
          }
        }
      );

    document
      .addEventListener(
        "keydown",
        event => {
          if (
            !$("diSidebar")
              .classList
              .contains("open")
          ) {
            return;
          }

          if (
            event.key === "Escape"
          ) {
            sidebar(false);
          }

          if (
            event.key === "Tab"
          ) {
            const items = [
              ...$("diSidebar")
                .querySelectorAll(
                  "a[href],button"
                )
            ].filter(
              el =>
                el.getClientRects()
                  .length
            );

            const first =
              items[0];

            const last =
              items[
                items.length - 1
              ];

            if (
              event.shiftKey &&
              document.activeElement ===
                first
            ) {
              event.preventDefault();

              last.focus();
            } else if (
              !event.shiftKey &&
              document.activeElement ===
                last
            ) {
              event.preventDefault();

              first.focus();
            }
          }
        }
      );

    window
      .addEventListener(
        "resize",
        () => {
          if (
            window.innerWidth > 760
          ) {
            $("diSidebar").inert =
              false;

            $("diSidebar")
              .classList
              .remove("open");

            $("diOverlay").hidden =
              true;

            $("diOpenSidebar")
              .setAttribute(
                "aria-expanded",
                "false"
              );
          } else {
            $("diSidebar").inert =
              !$("diSidebar")
                .classList
                .contains("open");
          }
        }
      );

    if (
      window.innerWidth <= 760
    ) {
      $("diSidebar").inert =
        true;
    }
  }

  // ======================================================
  // INISIALISASI DASHBOARD
  // ======================================================

  async function init() {
    try {
      if (
        window.location.protocol ===
        "file:"
      ) {
        throw new Error(
          "Buka halaman ini melalui server aplikasi yang sudah login, misalnya http://localhost:3000/dashboard-interaktif.html."
        );
      }

      const response =
        await fetchJSON(
          API.me
        );

      if (
        !response.user ||
        !response.loggedIn
      ) {
        throw new Error(
          "Data pengguna belum tersedia. Silakan login kembali."
        );
      }

      state.user =
        response.user;

      const role =
        String(
          state.user.role ||
          ""
        )
          .trim()
          .toLowerCase();

      const position =
        String(
          state.user.jabatan ||
          state.user.nama_jabatan ||
          ""
        )
          .toLowerCase();

      state.fullAccess =
        role === "admin" ||
        [
          "kabag",
          "kepala bagian",
          "kadiv",
          "kepala divisi"
        ].some(
          value =>
            position.includes(value)
        );

      const name =
        String(
          state.user.nama ||
          state.user.nama_pic ||
          state.user.name ||
          state.user.username ||
          "Pengguna"
        );

      $("diUserName").textContent =
        name;

      $("diUserRole").textContent =
        state.user.jabatan ||
        state.user.nama_jabatan ||
        state.user.role ||
        "Project Management";

      $("diAvatar").textContent =
        name
          .split(/\s+/)
          .slice(0, 2)
          .map(
            word => word[0]
          )
          .join("")
          .toUpperCase();

      const hour =
        jakartaPeriod().hour;

      const greeting =
        hour < 11
          ? "pagi"
          : hour < 15
            ? "siang"
            : hour < 18
              ? "sore"
              : "malam";

      $("diGreeting").textContent =
        `Selamat ${greeting}, ${
          name.split(/\s+/)[0]
        }. Pantau progres proyek, pencapaian bisnis, dan prioritas tim dalam satu tempat.`;

      initFilters();

      bindEvents();

      await Promise.allSettled([
        loadPIC(),
        loadMenu(),
        loadNotifications(),
        loadDashboard()
      ]);
    } catch (error) {
      $("diLoading").hidden =
        true;

      showErrors([
        error.message
      ]);

      $("diUpdated").textContent =
        "Dashboard belum dimuat";

      $("diNotificationList").innerHTML = `
        <div class="di-empty">
          Masuk melalui aplikasi untuk memuat notifikasi.
        </div>
      `;
    }
  }

  init();
})();

/* ======================================================
   ANIMASI MELAYANG, KURSOR, DAN SCROLL
====================================================== */

(() => {
  "use strict";

  function startFlyingMotion() {
    const hero =
      document.querySelector(".di-hero");

    const art =
      hero?.querySelector(".di-hero-art");

    if (
      !hero ||
      !art ||
      hero.dataset.flyingReady
    ) {
      return;
    }

    hero.dataset.flyingReady = "true";

    const style =
      document.createElement("style");

    style.textContent = `
      /* Gerakan mengikuti kursor dan scroll */
      .di-hero .di-hero-art {
        transform: translate3d(
          var(--di-mouse-x, 0px),
          calc(
            var(--di-mouse-y, 0px) +
            var(--di-scroll-y, 0px)
          ),
          0
        );

        transition:
          transform .55s
          cubic-bezier(.2, .75, .3, 1);
      }

      /* Seluruh ilustrasi ikut melayang */
      .di-hero .di-hero-art > svg {
        animation:
          di-fly-scene 7s
          ease-in-out infinite;

        transform-origin: center;
        overflow: visible;
      }

      .di-hero .di-float,
      .di-hero .di-float-slow {
        transform-box: fill-box;
        transform-origin: center;
      }

      /* Kartu kiri */
      .di-hero .di-float {
        animation:
          di-fly-card-a 4.8s
          ease-in-out infinite;
      }

      /* Kartu kanan */
      .di-hero .di-float-slow {
        animation:
          di-fly-card-b 5.8s
          ease-in-out infinite;
      }

      /* Partikel dekoratif */
      .di-air-dot {
        position: absolute;
        z-index: -1;

        border-radius: 50%;
        background: #d5eca8;
        opacity: .35;

        pointer-events: none;

        animation:
          di-fly-dot
          var(--di-duration, 6s)
          ease-in-out
          var(--di-delay, 0s)
          infinite;
      }

      @keyframes di-fly-scene {
        0%, 100% {
          transform:
            translateY(5px)
            rotate(-1deg);
        }

        50% {
          transform:
            translateY(-10px)
            rotate(1deg);
        }
      }

      @keyframes di-fly-card-a {
        0%, 100% {
          transform:
            translate(0, 5px)
            rotate(-3deg);
        }

        50% {
          transform:
            translate(9px, -19px)
            rotate(3deg);
        }
      }

      @keyframes di-fly-card-b {
        0%, 100% {
          transform:
            translate(0, -13px)
            rotate(3deg);
        }

        50% {
          transform:
            translate(-9px, 6px)
            rotate(-4deg);
        }
      }

      @keyframes di-fly-dot {
        0%, 100% {
          transform: translate(0, 9px);
          opacity: .2;
        }

        50% {
          transform: translate(8px, -23px);
          opacity: .6;
        }
      }

      /* Hentikan sementara ketika banner tidak terlihat */
      .di-hero.di-motion-paused .di-hero-art > svg,
      .di-hero.di-motion-paused .di-float,
      .di-hero.di-motion-paused .di-float-slow,
      .di-hero.di-motion-paused .di-air-dot {
        animation-play-state: paused;
      }

      /* Tetap tampil pada layar ponsel kecil */
      @media (max-width: 420px) {
        .di-hero {
          padding-bottom: 165px;
        }

        .di-hero .di-hero-art {
          display: grid;
          position: absolute;

          width: 225px;
          height: 140px;

          right: 8px;
          bottom: 10px;
        }
      }

      /* Mengikuti pengaturan kurangi gerakan perangkat */
      @media (prefers-reduced-motion: reduce) {
        .di-hero .di-hero-art {
          transform: none !important;
        }

        .di-hero .di-hero-art > svg,
        .di-hero .di-float,
        .di-hero .di-float-slow,
        .di-hero .di-air-dot {
          animation: none !important;
        }
      }

      @media print {
        .di-hero {
          padding-bottom: 32px;
        }

        .di-hero .di-hero-art,
        .di-hero .di-air-dot {
          display: none !important;
        }
      }
    `;

    document.head.appendChild(style);

    // ==================================================
    // PARTIKEL MELAYANG
    // ==================================================

    for (
      let index = 0;
      index < 8;
      index++
    ) {
      const dot =
        document.createElement("span");

      dot.className = "di-air-dot";

      dot.setAttribute(
        "aria-hidden",
        "true"
      );

      const size =
        4 + (index % 3) * 3;

      dot.style.cssText = `
        width: ${size}px;
        height: ${size}px;

        left: ${
          56 + (index % 4) * 11
        }%;

        top: ${
          15 +
          Math.floor(index / 4) * 59 +
          (index % 3) * 5
        }%;

        --di-duration: ${
          5 + index % 4
        }s;

        --di-delay: -${
          index * .7
        }s;
      `;

      hero.appendChild(dot);
    }

    const motion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      );

    const mouse =
      window.matchMedia(
        "(hover: hover) and (pointer: fine)"
      );

    // ==================================================
    // GERAKAN MENGIKUTI KURSOR
    // ==================================================

    hero.addEventListener(
      "pointermove",
      event => {
        if (
          motion.matches ||
          !mouse.matches
        ) {
          return;
        }

        const box =
          hero.getBoundingClientRect();

        const x =
          (
            event.clientX -
            box.left
          ) / box.width - .5;

        const y =
          (
            event.clientY -
            box.top
          ) / box.height - .5;

        art.style.setProperty(
          "--di-mouse-x",
          `${x * 30}px`
        );

        art.style.setProperty(
          "--di-mouse-y",
          `${y * 20}px`
        );
      }
    );

    hero.addEventListener(
      "pointerleave",
      () => {
        art.style.setProperty(
          "--di-mouse-x",
          "0px"
        );

        art.style.setProperty(
          "--di-mouse-y",
          "0px"
        );
      }
    );

    // ==================================================
    // GERAKAN SAAT SCROLL
    // ==================================================

    let scrollFrame = 0;

    function updateScroll() {
      scrollFrame = 0;

      if (motion.matches) {
        return;
      }

      const box =
        hero.getBoundingClientRect();

      if (
        box.bottom < 0 ||
        box.top > window.innerHeight
      ) {
        return;
      }

      const progress =
        Math.max(
          0,
          Math.min(
            1,
            -box.top / box.height
          )
        );

      art.style.setProperty(
        "--di-scroll-y",
        `${progress * -32}px`
      );
    }

    window.addEventListener(
      "scroll",
      () => {
        if (
          !scrollFrame &&
          !motion.matches
        ) {
          scrollFrame =
            requestAnimationFrame(
              updateScroll
            );
        }
      },
      {
        passive: true
      }
    );

    // ==================================================
    // JEDA ANIMASI SAAT BANNER DI LUAR LAYAR
    // ==================================================

    if (
      "IntersectionObserver" in window
    ) {
      const observer =
        new IntersectionObserver(
          entries => {
            hero.classList.toggle(
              "di-motion-paused",
              !entries[0].isIntersecting
            );
          },
          {
            threshold: 0
          }
        );

      observer.observe(hero);
    }

    updateScroll();
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      startFlyingMotion,
      {
        once: true
      }
    );
  } else {
    startFlyingMotion();
  }
})();