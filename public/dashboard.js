"use strict";


// ======================================================
// ELEMEN UTAMA DASHBOARD
// ======================================================

const dashboardJenisProyek =
  document.getElementById(
    "dashboardJenisProyek"
  );

const dashboardPic =
  document.getElementById(
    "dashboardPic"
  );

const dashboardYear =
  document.getElementById(
    "dashboardYear"
  );

const refreshDashboard =
  document.getElementById(
    "refreshDashboard"
  );

const dashboardLoading =
  document.getElementById(
    "dashboardLoading"
  );

const dashboardError =
  document.getElementById(
    "dashboardError"
  );

const dashboardPeriod =
  document.getElementById(
    "dashboardPeriod"
  );

const lastUpdated =
  document.getElementById(
    "lastUpdated"
  );

  const notificationButton =
  document.getElementById(
    "notificationButton"
  );

const notificationBadge =
  document.getElementById(
    "notificationBadge"
  );

const notificationDropdown =
  document.getElementById(
    "notificationDropdown"
  );

const notificationList =
  document.getElementById(
    "notificationList"
  );


function escapeNotificationHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ======================================================
// FORMAT TANGGAL NOTIFIKASI
// ======================================================

function formatTanggalNotifikasi(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const text =
    String(value).trim();

  let tanggal = null;


  /*
   * Menangani format PostgreSQL:
   * 2026-10-05
   * 2026-10-05T00:00:00.000Z
   * 2026-10-05 00:00:00
   */

  const formatIso =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );


  if (formatIso) {

    const tahun =
      Number(formatIso[1]);

    const bulan =
      Number(formatIso[2]);

    const hari =
      Number(formatIso[3]);


    tanggal =
      new Date(
        tahun,
        bulan - 1,
        hari,
        12,
        0,
        0
      );


    /*
     * Pastikan tanggal benar-benar valid.
     */

    if (
      tanggal.getFullYear() !== tahun ||
      tanggal.getMonth() !==
        bulan - 1 ||
      tanggal.getDate() !== hari
    ) {
      return "-";
    }

  } else {

    tanggal =
      new Date(text);

  }


  if (
    !tanggal ||
    Number.isNaN(
      tanggal.getTime()
    )
  ) {
    console.warn(
      "Tanggal tindak lanjut tidak valid:",
      value
    );

    return "-";
  }


  try {

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }
    ).format(tanggal);

  } catch (error) {

    console.warn(
      "Gagal format tanggal notifikasi:",
      value,
      error
    );

    return "-";

  }
}

async function loadNotifikasiTask() {
  try {
    const response =
      await fetch(
        "/api/notifikasi/task",
        {
          credentials: "include",
          cache: "no-store"
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil notifikasi"
      );
    }

    const jumlah =
      Number(
        result.jumlah_belum_dibaca
      ) || 0;

    notificationBadge.textContent =
      jumlah > 99
        ? "99+"
        : String(jumlah);

    notificationBadge.hidden =
      jumlah === 0;

    const data =
      Array.isArray(result.data)
        ? result.data
        : [];

    if (data.length === 0) {
      notificationList.innerHTML = `
        <div class="notification-empty">
          Tidak ada task yang perlu
          ditindaklanjuti.
        </div>
      `;

      return;
    }

    notificationList.innerHTML =
      data.map(item => `
        <button
          type="button"
          class="notification-item ${
            item.sudah_dibaca
              ? ""
              : "is-unread"
          }"
          data-task-id="${Number(
            item.task_id
          )}"
        >
          <span class="notification-title">
            Ada Task yang perlu dilakukan Update
          </span>

          <span class="notification-task">
            ${escapeNotificationHtml(
              item.task
            )} — Tindak lanjut
          </span>

          <span class="notification-project">
            ${escapeNotificationHtml(
              item.nama_proyek
            )}
            ·
            ${escapeNotificationHtml(
              item.kategori
            )}
          </span>

          <span class="notification-date">
            ${formatTanggalNotifikasi(
              item.tanggal_tindak_lanjut
            )}
          </span>
        </button>
      `).join("");

  } catch (error) {
    console.error(
      "ERROR LOAD NOTIFIKASI:",
      error
    );

    notificationList.innerHTML = `
      <div class="notification-empty">
        ${escapeNotificationHtml(
          error.message
        )}
      </div>
    `;
  }
}


notificationButton?.addEventListener(
  "click",
  async event => {
    event.stopPropagation();

    notificationDropdown.hidden =
      !notificationDropdown.hidden;

    if (!notificationDropdown.hidden) {
      await loadNotifikasiTask();
    }
  }
);


notificationList?.addEventListener(
  "click",
  async event => {
    const item =
      event.target.closest(
        "[data-task-id]"
      );

    if (!item) {
      return;
    }

    const taskId =
      Number(item.dataset.taskId);

    try {
      await fetch(
        `/api/notifikasi/task/${taskId}/baca`,
        {
          method: "PUT",
          credentials: "include"
        }
      );
    } finally {
      window.location.href =
  `/task.html?task_id=${taskId}`;
    }
  }
);


document.addEventListener(
  "click",
  event => {
    if (
      !event.target.closest(
        ".notification-wrapper"
      )
    ) {
      notificationDropdown.hidden =
        true;
    }
  }
);


loadNotifikasiTask();

setInterval(
  loadNotifikasiTask,
  60000
);

const bulanSingkat = [
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

let currentDashboardData =
  null;

let timerFilterDashboard =
  null;

let resizeTimer =
  null;


// ======================================================
// HELPER UMUM
// ======================================================

function dapatkanPeriodeJakarta() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Jakarta",

        year:
          "numeric",

        month:
          "numeric"
      }
    ).formatToParts(
      new Date()
    );

  return {
    tahun:
      Number(
        parts.find(
          item =>
            item.type === "year"
        )?.value
      ),

    bulan:
      Number(
        parts.find(
          item =>
            item.type === "month"
        )?.value
      )
  };
}


function angka(value) {
  const result =
    Number(value);

  return Number.isFinite(result)
    ? result
    : 0;
}


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
    angka(value)
  );
}


function formatPersen(value) {
  return (
    `${angka(value).toLocaleString(
      "id-ID",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    )}%`
  );
}


function formatCompact(value) {
  const number =
    angka(value);

  if (
    Math.abs(number) >=
    1_000_000_000
  ) {
    return (
      `${(
        number /
        1_000_000_000
      ).toLocaleString(
        "id-ID",
        {
          maximumFractionDigits: 1
        }
      )} M`
    );
  }

  if (
    Math.abs(number) >=
    1_000_000
  ) {
    return (
      `${(
        number /
        1_000_000
      ).toLocaleString(
        "id-ID",
        {
          maximumFractionDigits: 1
        }
      )} Jt`
    );
  }

  if (
    Math.abs(number) >=
    1_000
  ) {
    return (
      `${(
        number /
        1_000
      ).toLocaleString(
        "id-ID",
        {
          maximumFractionDigits: 1
        }
      )} Rb`
    );
  }

  return number.toLocaleString(
    "id-ID"
  );
}


function setText(
  id,
  value
) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent =
      value;
  }
}


function setLoading(show) {
  if (!dashboardLoading) {
    return;
  }

  dashboardLoading.hidden =
    !show;
}


function showError(
  message = ""
) {
  if (!dashboardError) {
    return;
  }

  dashboardError.textContent =
    message;

  dashboardError.style.display =
    message
      ? "block"
      : "none";
}


// ======================================================
// FETCH JSON
// ======================================================

async function fetchJson(url) {
  const response =
    await fetch(
      url,
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
      `API tidak mengembalikan JSON. ` +
      `Status ${response.status}. ${text}`
    );
  }

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Gagal mengambil data dashboard"
    );
  }

  return data;
}


function ambilArrayDashboard(
  response
) {
  if (
    Array.isArray(response)
  ) {
    return response;
  }

  const kemungkinanData = [
    response?.data,
    response?.pic,
    response?.rows,
    response?.result
  ];

  return (
    kemungkinanData.find(
      value =>
        Array.isArray(value)
    ) || []
  );
}


// ======================================================
// FILTER DASHBOARD
// ======================================================

function isiPilihanTahun() {
  if (!dashboardYear) {
    return;
  }

  const periode =
    dapatkanPeriodeJakarta();

  const tahunBerjalan =
    periode.tahun;

  const parameterUrl =
    new URLSearchParams(
      window.location.search
    );

  const tahunUrl =
    Number(
      parameterUrl.get(
        "tahun"
      )
    );

  dashboardYear.innerHTML =
    "";

  for (
    let tahun = tahunBerjalan;
    tahun >= tahunBerjalan - 6;
    tahun -= 1
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      String(tahun);

    option.textContent =
      String(tahun);

    dashboardYear.appendChild(
      option
    );
  }

  const tahunValid =
    Number.isInteger(
      tahunUrl
    ) &&
    tahunUrl >=
      tahunBerjalan - 6 &&
    tahunUrl <=
      tahunBerjalan;

  dashboardYear.value =
    tahunValid
      ? String(tahunUrl)
      : String(tahunBerjalan);
}


function isiFilterJenisProyek() {
  if (
    !dashboardJenisProyek
  ) {
    return;
  }

  const parameterUrl =
    new URLSearchParams(
      window.location.search
    );

  const jenisUrl =
    String(
      parameterUrl.get(
        "jenis_proyek"
      ) || ""
    ).trim();

  const optionTersedia =
    [
      ...dashboardJenisProyek
        .options
    ].find(
      option =>
        String(option.value)
          .trim()
          .toLowerCase() ===
        jenisUrl.toLowerCase()
    );

  dashboardJenisProyek.value =
    optionTersedia
      ? optionTersedia.value
      : "";
}


async function isiFilterPic() {
  if (!dashboardPic) {
    return;
  }

  const parameterUrl =
    new URLSearchParams(
      window.location.search
    );

  const picUrl =
    String(
      parameterUrl.get(
        "pic_id"
      ) || ""
    ).trim();

  dashboardPic.innerHTML = `
    <option value="">
      Semua PIC
    </option>
  `;

  try {
    const response =
      await fetchJson(
        "/api/pic"
      );

    const daftarPic =
      ambilArrayDashboard(
        response
      );

    daftarPic
      .sort(
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
      )
      .forEach(item => {
        const id =
          item.id ??
          item.pic_id;

        if (!id) {
          return;
        }

        const nama =
          item.nama ??
          item.nama_pic ??
          item.inisial ??
          `PIC ${id}`;

        const option =
          document.createElement(
            "option"
          );

        option.value =
          String(id);

        option.textContent =
          String(nama);

        dashboardPic.appendChild(
          option
        );
      });

    const picTersedia =
      [
        ...dashboardPic.options
      ].some(
        option =>
          option.value ===
          picUrl
      );

    dashboardPic.value =
      picTersedia
        ? picUrl
        : "";

  } catch (error) {
    console.error(
      "ERROR LOAD FILTER PIC:",
      error
    );
  }
}


function ambilFilterDashboard() {
  const periode =
    dapatkanPeriodeJakarta();

  return {
    tahun:
      Number(
        dashboardYear?.value
      ) || periode.tahun,

    jenis_proyek:
      String(
        dashboardJenisProyek
          ?.value || ""
      ).trim(),

    pic_id:
      String(
        dashboardPic
          ?.value || ""
      ).trim()
  };
}


function buatQueryDashboard() {
  const filter =
    ambilFilterDashboard();

  const parameter =
    new URLSearchParams();

  parameter.set(
    "tahun",
    String(filter.tahun)
  );

  if (
    filter.jenis_proyek
  ) {
    parameter.set(
      "jenis_proyek",
      filter.jenis_proyek
    );
  }

  if (filter.pic_id) {
    parameter.set(
      "pic_id",
      filter.pic_id
    );
  }

  return {
    filter,
    query:
      parameter.toString()
  };
}


// ######################################################
// #                                                    #
// #                PROJECT OVERVIEW                    #
// #                                                    #
// ######################################################

function renderProjectOverview(
  data = {}
) {
  // Pipeline

  setText(
    "totalPipeline",
    angka(
      data.total_pipeline
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "nilaiPipeline",
    formatRupiah(
      data.nilai_pipeline
    )
  );

  // Submit Penawaran

  setText(
    "totalSubmitPenawaran",
    angka(
      data.total_submit_penawaran
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "nilaiSubmitPenawaran",
    formatRupiah(
      data.nilai_submit_penawaran
    )
  );

  // Submit Pengadaan

  setText(
    "totalSubmitPengadaan",
    angka(
      data.total_submit_pengadaan
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "nilaiSubmitPengadaan",
    formatRupiah(
      data.nilai_submit_pengadaan
    )
  );

  // Proses Kontrak

  setText(
    "totalKontrak",
    angka(
      data.total_kontrak
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "nilaiKontrak",
    formatRupiah(
      data.nilai_kontrak
    )
  );

  // Proyek Aktif

  setText(
    "totalProyekAktif",
    angka(
      data.total_proyek_aktif
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "nilaiProyekAktif",
    formatRupiah(
      data.nilai_proyek_aktif
    )
  );

  // Proyek Selesai

  setText(
    "totalProyekDone",
    angka(
      data.total_proyek_done
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "nilaiProyekDone",
    formatRupiah(
      data.nilai_proyek_done
    )
  );

  // Proyek Terlambat

  setText(
    "totalProyekTerlambat",
    angka(
      data.total_proyek_terlambat
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "nilaiProyekTerlambat",
    formatRupiah(
      data.nilai_proyek_terlambat
    )
  );

  // Total Proyek Tahun Laporan

  setText(
    "totalSemuaProyek",
    angka(
      data.total_semua_proyek
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "nilaiTotalProyek",
    formatRupiah(
      data.nilai_total_proyek
    )
  );
}


// ######################################################
// #                                                    #
// #               FINANCIAL OVERVIEW                   #
// #                                                    #
// ######################################################

function renderFinancialOverview(
  data = {}
) {
  setText(
    "nilaiKpi",
    formatRupiah(
      data.kpi
    )
  );

  setText(
    "realisasiKpi",
    formatRupiah(
      data.realisasi_kpi
    )
  );

  setText(
    "persentaseKpi",
    formatPersen(
      data.persentase_kpi
    )
  );

  setText(
    "regulerDibayar",
    formatRupiah(
      data.reguler_dibayar
    )
  );

  setText(
    "sewaDibayar",
    formatRupiah(
      data.sewa_dibayar
    )
  );

  setText(
    "transaksiDibayar",
    formatRupiah(
      data.transaksi_dibayar
    )
  );

  setText(
    "piutangKlien",
    formatRupiah(
      data.piutang_klien
    )
  );

  setText(
    "sudahDibayarKlien",
    formatRupiah(
      data.sudah_dibayar_klien
    )
  );

  setText(
    "hutangPartner",
    formatRupiah(
      data.hutang_partner
    )
  );

  setText(
    "dibayarPartner",
    formatRupiah(
      data.dibayar_partner
    )
  );

  setText(
    "pendapatanBulanBerjalan",
    formatRupiah(
      data.pendapatan_bulan_berjalan
    )
  );

  renderProgressKpi(data);
  renderTrendPendapatan(data);
}


function renderProgressKpi(
  data
) {
  const progress =
    document.getElementById(
      "kpiProgress"
    );

  if (!progress) {
    return;
  }

  const width =
    Math.max(
      0,
      Math.min(
        100,
        angka(
          data.persentase_kpi
        )
      )
    );

  requestAnimationFrame(
    () => {
      progress.style.width =
        `${width}%`;
    }
  );
}


function renderTrendPendapatan(
  data
) {
  const trend =
    document.getElementById(
      "monthlyTrend"
    );

  if (!trend) {
    return;
  }

  const current =
    angka(
      data.pendapatan_bulan_berjalan
    );

  const previous =
    angka(
      data.pendapatan_bulan_sebelumnya
    );

  let difference = 0;

  if (previous > 0) {
    difference =
      (
        (
          current -
          previous
        ) /
        previous
      ) * 100;

  } else if (current > 0) {
    difference =
      100;
  }

  trend.classList.remove(
    "up",
    "down",
    "flat"
  );

  if (current > previous) {
    trend.classList.add(
      "up"
    );

    trend.textContent =
      `↑ ${Math.abs(
        difference
      ).toLocaleString(
        "id-ID",
        {
          maximumFractionDigits: 1
        }
      )}% dari bulan sebelumnya`;

  } else if (
    current < previous
  ) {
    trend.classList.add(
      "down"
    );

    trend.textContent =
      `↓ ${Math.abs(
        difference
      ).toLocaleString(
        "id-ID",
        {
          maximumFractionDigits: 1
        }
      )}% dari bulan sebelumnya`;

  } else {
    trend.classList.add(
      "flat"
    );

    trend.textContent =
      "— Sama dengan bulan sebelumnya";
  }
}


// ======================================================
// CHART HELPER
// Masih bagian Financial Overview
// ======================================================

function siapkanCanvas(
  canvas
) {
  if (!canvas) {
    return null;
  }

  const parentWidth =
    canvas.parentElement
      ?.clientWidth || 800;

  const width =
    canvas.clientWidth ||
    parentWidth;

  const height =
    canvas.clientHeight ||
    300;

  const ratio =
    Math.min(
      window.devicePixelRatio ||
      1,
      2
    );

  canvas.width =
    width * ratio;

  canvas.height =
    height * ratio;

  canvas.style.width =
    `${width}px`;

  canvas.style.height =
    `${height}px`;

  const context =
    canvas.getContext("2d");

  context.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );

  context.clearRect(
    0,
    0,
    width,
    height
  );

  return {
    canvas,
    context,
    width,
    height
  };
}


function normalisasiBulanan(
  rows = []
) {
  return Array.from(
    {
      length: 12
    },
    (_, index) => {
      const bulan =
        index + 1;

      return (
        rows.find(
          item =>
            Number(
              item.bulan ??
              item.month
            ) === bulan
        ) || {
          bulan
        }
      );
    }
  );
}


function maksimumBagus(value) {
  const number =
    Math.max(
      angka(value),
      1
    );

  const power =
    Math.pow(
      10,
      Math.floor(
        Math.log10(number)
      )
    );

  return (
    Math.ceil(
      number / power
    ) * power
  );
}


function gambarGrafikPendapatan(
  rows = []
) {
  const canvas =
    document.getElementById(
      "incomeChart"
    );

  const prepared =
    siapkanCanvas(canvas);

  if (!prepared) {
    return;
  }

  const {
    context,
    width,
    height
  } = prepared;

  const data =
    normalisasiBulanan(rows);

  const series = [
    {
      key: "reguler",
      color: "#4f46e5"
    },
    {
      key: "sewa",
      color: "#0891b2"
    },
    {
      key: "transaksi",
      color: "#7c3aed"
    }
  ];

  const padding = {
    top: 24,
    right: 22,
    bottom: 42,
    left: 66
  };

  const chartWidth =
    width -
    padding.left -
    padding.right;

  const chartHeight =
    height -
    padding.top -
    padding.bottom;

  const semuaNilai =
    data.flatMap(
      row =>
        series.map(
          item =>
            angka(
              row[item.key]
            )
        )
    );

  const maxValue =
    maksimumBagus(
      Math.max(
        ...semuaNilai,
        0
      )
    );

  context.font =
    "11px Inter, Arial";

  // Garis horizontal

  for (
    let step = 0;
    step <= 4;
    step += 1
  ) {
    const y =
      padding.top +
      (
        chartHeight *
        step /
        4
      );

    const value =
      maxValue -
      (
        maxValue *
        step /
        4
      );

    context.strokeStyle =
      "#e2e8f0";

    context.lineWidth =
      1;

    context.beginPath();

    context.moveTo(
      padding.left,
      y
    );

    context.lineTo(
      width -
      padding.right,
      y
    );

    context.stroke();

    context.fillStyle =
      "#64748b";

    context.textAlign =
      "right";

    context.fillText(
      formatCompact(value),
      padding.left - 10,
      y + 4
    );
  }

  // Label bulan

  data.forEach(
    (_, index) => {
      const x =
        padding.left +
        (
          chartWidth *
          index /
          11
        );

      context.fillStyle =
        "#64748b";

      context.textAlign =
        "center";

      context.fillText(
        bulanSingkat[index],
        x,
        height - 12
      );
    }
  );

  // Garis series

  series.forEach(item => {
    context.beginPath();

    data.forEach(
      (row, index) => {
        const x =
          padding.left +
          (
            chartWidth *
            index /
            11
          );

        const value =
          angka(
            row[item.key]
          );

        const y =
          padding.top +
          chartHeight -
          (
            value /
            maxValue *
            chartHeight
          );

        if (index === 0) {
          context.moveTo(
            x,
            y
          );
        } else {
          context.lineTo(
            x,
            y
          );
        }
      }
    );

    context.strokeStyle =
      item.color;

    context.lineWidth =
      3;

    context.lineJoin =
      "round";

    context.lineCap =
      "round";

    context.stroke();

    data.forEach(
      (row, index) => {
        const x =
          padding.left +
          (
            chartWidth *
            index /
            11
          );

        const value =
          angka(
            row[item.key]
          );

        const y =
          padding.top +
          chartHeight -
          (
            value /
            maxValue *
            chartHeight
          );

        context.beginPath();

        context.arc(
          x,
          y,
          4,
          0,
          Math.PI * 2
        );

        context.fillStyle =
          "#ffffff";

        context.fill();

        context.strokeStyle =
          item.color;

        context.lineWidth =
          2;

        context.stroke();
      }
    );
  });
}


function gambarGrafikPartner(
  rows = []
) {
  const canvas =
    document.getElementById(
      "partnerChart"
    );

  const prepared =
    siapkanCanvas(canvas);

  if (!prepared) {
    return;
  }

  const {
    context,
    width,
    height
  } = prepared;

  const data =
    normalisasiBulanan(rows);

  const padding = {
    top: 24,
    right: 22,
    bottom: 42,
    left: 66
  };

  const chartWidth =
    width -
    padding.left -
    padding.right;

  const chartHeight =
    height -
    padding.top -
    padding.bottom;

  const maxValue =
    maksimumBagus(
      Math.max(
        ...data.map(
          row =>
            angka(
              row.dibayar
            )
        ),
        0
      )
    );

  context.font =
    "11px Inter, Arial";

  for (
    let step = 0;
    step <= 4;
    step += 1
  ) {
    const y =
      padding.top +
      (
        chartHeight *
        step /
        4
      );

    const value =
      maxValue -
      (
        maxValue *
        step /
        4
      );

    context.strokeStyle =
      "#e2e8f0";

    context.lineWidth =
      1;

    context.beginPath();

    context.moveTo(
      padding.left,
      y
    );

    context.lineTo(
      width -
      padding.right,
      y
    );

    context.stroke();

    context.fillStyle =
      "#64748b";

    context.textAlign =
      "right";

    context.fillText(
      formatCompact(value),
      padding.left - 10,
      y + 4
    );
  }

  const slot =
    chartWidth / 12;

  const barWidth =
    Math.min(
      34,
      slot * 0.6
    );

  data.forEach(
    (row, index) => {
      const value =
        angka(
          row.dibayar
        );

      const barHeight =
        value /
        maxValue *
        chartHeight;

      const x =
        padding.left +
        slot * index +
        (
          slot -
          barWidth
        ) / 2;

      const y =
        padding.top +
        chartHeight -
        barHeight;

      const gradient =
        context.createLinearGradient(
          0,
          y,
          0,
          padding.top +
          chartHeight
        );

      gradient.addColorStop(
        0,
        "#4f46e5"
      );

      gradient.addColorStop(
        1,
        "#818cf8"
      );

      context.fillStyle =
        gradient;

      context.beginPath();

      context.roundRect(
        x,
        y,
        barWidth,
        Math.max(
          barHeight,
          2
        ),
        6
      );

      context.fill();

      context.fillStyle =
        "#64748b";

      context.textAlign =
        "center";

      context.fillText(
        bulanSingkat[index],
        x +
        barWidth / 2,
        height - 12
      );
    }
  );
}


function renderCharts(data) {
  gambarGrafikPendapatan(
    Array.isArray(
      data.income_monthly
    )
      ? data.income_monthly
      : []
  );

  gambarGrafikPartner(
    Array.isArray(
      data.partner_monthly
    )
      ? data.partner_monthly
      : []
  );
}


// ######################################################
// #                                                    #
// #                CONTRACT OVERVIEW                   #
// #                                                    #
// ######################################################

function renderContractOverview(
  data = {}
) {
  setText(
    "kontrakKlienTigaBulan",
    angka(
      data
        .kontrak_klien_akan_jatuh_tempo
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "kontrakPartnerTigaBulan",
    angka(
      data
        .kontrak_partner_akan_jatuh_tempo
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "kontrakKlienExpired",
    angka(
      data
        .kontrak_klien_jatuh_tempo
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "kontrakPartnerExpired",
    angka(
      data
        .kontrak_partner_jatuh_tempo
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "lisensiSewaTigaBulan",
    angka(
      data
        .lisensi_sewa_akan_jatuh_tempo
    ).toLocaleString(
      "id-ID"
    )
  );

  setText(
    "lisensiSewaExpired",
    angka(
      data
        .lisensi_sewa_jatuh_tempo
    ).toLocaleString(
      "id-ID"
    )
  );
}


// ######################################################
// #                                                    #
// #               BUSINESS PERFORMANCE                 #
// #                                                    #
// ######################################################

function renderBusinessPerformance(
  data = {}
) {
  setText(
    "marginRataRata",
    formatPersen(
      data.margin_rata_rata
    )
  );

  setText(
    "proyekBelumUpdate",
    angka(
      data.proyek_belum_update
    ).toLocaleString(
      "id-ID"
    )
  );
}


// ======================================================
// RENDER SELURUH DASHBOARD
// ======================================================

function renderDashboard(data) {
  currentDashboardData =
    data;

  const tahun =
    angka(data.tahun) ||
    dapatkanPeriodeJakarta()
      .tahun;

  const jenisLabel =
    data.jenis_proyek ||
    "Semua Jenis Proyek";

  const picLabel =
    dashboardPic
      ?.selectedOptions?.[0]
      ?.textContent
      ?.trim() ||
    "Semua PIC";

  if (dashboardPeriod) {
    dashboardPeriod.textContent =
      `Periode Januari–Desember ${tahun} • ` +
      `${jenisLabel} • ${picLabel}`;
  }

  if (lastUpdated) {
    const generated =
      data.generated_at
        ? new Date(
            data.generated_at
          )
        : new Date();

    lastUpdated.textContent =
      `Diperbarui ${generated.toLocaleString(
        "id-ID",
        {
          dateStyle:
            "medium",

          timeStyle:
            "short",

          timeZone:
            "Asia/Jakarta"
        }
      )}`;
  }

  renderProjectOverview(
    data.project_overview ||
    {}
  );

  renderFinancialOverview(
    data.financial_overview ||
    {}
  );

  renderContractOverview(
    data.contract_overview ||
    {}
  );

  renderBusinessPerformance(
    data.business_performance ||
    {}
  );

  renderCharts(data);
}


// ======================================================
// TIMELINE SESUAI LISTING
// ======================================================

async function getTimelineTotal(
  filter = {}
) {
  const params =
    new URLSearchParams({
      page: "1",
      limit: "1"
    });

  if (filter.bulan) {
    params.set(
      "bulan",
      String(filter.bulan)
    );
  }

  if (filter.status) {
    params.set(
      "status",
      filter.status
    );
  }

  if (
    filter.jenis_proyek
  ) {
    params.set(
      "jenis_proyek",
      filter.jenis_proyek
    );
  }

  if (filter.pic_id) {
    params.set(
      "pic_id",
      filter.pic_id
    );
  }

  const result =
    await fetchJson(
      `/api/timeline?${params.toString()}`
    );

  return angka(
    result?.pagination
      ?.total_data ??
    result?.total_data ??
    result?.total ??
    (
      Array.isArray(
        result?.data
      )
        ? result.data.length
        : 0
    )
  );
}


// ======================================================
// LOAD EMPAT BAGIAN DASHBOARD
// ======================================================

async function ambilDashboardBagian(
  namaBagian,
  endpoint
) {
  try {
    return await fetchJson(
      endpoint
    );

  } catch (error) {
    throw new Error(
      `${namaBagian}: ${error.message}`
    );
  }
}


async function loadDashboard() {
  const {
    filter,
    query
  } = buatQueryDashboard();

  setLoading(true);
  showError("");

  try {
    const [
      projectData,
      financialData,
      contractData,
      businessData
    ] = await Promise.all([
      ambilDashboardBagian(
        "Project Overview",
        `/api/dashboard/project?${query}`
      ),

      ambilDashboardBagian(
        "Financial Overview",
        `/api/dashboard/financial?${query}`
      ),

      ambilDashboardBagian(
        "Contract Overview",
        `/api/dashboard/contract?${query}`
      ),

      ambilDashboardBagian(
        "Business Performance",
        `/api/dashboard/business?${query}`
      )
    ]);

    const data = {
      tahun:
        filter.tahun,

      jenis_proyek:
        filter.jenis_proyek,

      pic_id:
        filter.pic_id,

      generated_at:
        new Date().toISOString(),

      project_overview:
        projectData
          .project_overview ||
        {},

      financial_overview:
        financialData
          .financial_overview ||
        {},

      income_monthly:
        Array.isArray(
          financialData
            .income_monthly
        )
          ? financialData
              .income_monthly
          : [],

      partner_monthly:
        Array.isArray(
          financialData
            .partner_monthly
        )
          ? financialData
              .partner_monthly
          : [],

      contract_overview:
        contractData
          .contract_overview ||
        {},

      business_performance:
        businessData
          .business_performance ||
        {}
    };

    // Timeline mengikuti filter dashboard

    const [
      timelineTigaBulan,
      timelineExpired
    ] = await Promise.allSettled([
      getTimelineTotal({
        bulan: 3,

        jenis_proyek:
          filter.jenis_proyek,

        pic_id:
          filter.pic_id
      }),

      getTimelineTotal({
        status: "expired",

        jenis_proyek:
          filter.jenis_proyek,

        pic_id:
          filter.pic_id
      })
    ]);

    if (
      timelineTigaBulan.status ===
      "fulfilled"
    ) {
      data.contract_overview
        .lisensi_sewa_akan_jatuh_tempo =
          timelineTigaBulan.value;
    }

    if (
      timelineExpired.status ===
      "fulfilled"
    ) {
      data.contract_overview
        .lisensi_sewa_jatuh_tempo =
          timelineExpired.value;
    }

    renderDashboard(data);

    // Simpan filter ke URL dashboard

    const url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "tahun",
      String(filter.tahun)
    );

    if (
      filter.jenis_proyek
    ) {
      url.searchParams.set(
        "jenis_proyek",
        filter.jenis_proyek
      );
    } else {
      url.searchParams.delete(
        "jenis_proyek"
      );
    }

    if (filter.pic_id) {
      url.searchParams.set(
        "pic_id",
        filter.pic_id
      );
    } else {
      url.searchParams.delete(
        "pic_id"
      );
    }

    window.history.replaceState(
      {},
      "",
      url
    );

  } catch (error) {
    console.error(
      "ERROR LOAD DASHBOARD:",
      error
    );

    showError(
      `Dashboard gagal dimuat: ${error.message}`
    );

  } finally {
    setLoading(false);
  }
}


// ======================================================
// NAVIGASI CARD DASHBOARD
// ======================================================

function bukaDetailCard(card) {
  const periode =
    dapatkanPeriodeJakarta();

  const filterDashboard =
    ambilFilterDashboard();

  const route =
    String(
      card.dataset.route || ""
    )
      .trim()
      .toLowerCase();

  let path = "";

  const params =
    new URLSearchParams({
      tahun:
        String(
          filterDashboard.tahun
        )
    });

  // ====================================================
  // BAWA FILTER DASHBOARD
  // ====================================================

  if (
    filterDashboard.jenis_proyek
  ) {
    params.set(
      "jenis_proyek",
      filterDashboard.jenis_proyek
    );
  }

  if (filterDashboard.pic_id) {
    params.set(
      "pic_id",
      filterDashboard.pic_id
    );
  }

  // ====================================================
  // PROJECT OVERVIEW
  // ====================================================

  if (route === "project") {
    const contract =
      String(
        card.dataset.contract || ""
      )
        .trim()
        .toLowerCase();

    const filterKontrak = {
      "klien-3-bulan": {
        jenis: "Klien",
        status: "berjalan",
        periode: "3-bulan"
      },

      "partner-3-bulan": {
        jenis: "Partner",
        status: "berjalan",
        periode: "3-bulan"
      },

      "klien-expired": {
        jenis: "Klien",
        status: "berakhir",
        periode: ""
      },

      "partner-expired": {
        jenis: "Partner",
        status: "berakhir",
        periode: ""
      }
    };

    const filterKontrakAktif =
      filterKontrak[contract];

    // ==================================================
    // CONTRACT OVERVIEW
    // ==================================================

    if (filterKontrakAktif) {
      path =
        "/kontrak.html";

      params.delete(
        "tahun"
      );

      params.set(
        "jenis",
        filterKontrakAktif.jenis
      );

      params.set(
        "status",
        filterKontrakAktif.status
      );

      if (
        filterKontrakAktif.periode
      ) {
        params.set(
          "periode",
          filterKontrakAktif.periode
        );

      } else {
        params.delete(
          "periode"
        );
      }
    }

    // ==================================================
    // PROYEK TERLAMBAT
    // ==================================================

    else if (
      contract ===
      "proyek-terlambat"
    ) {
      path =
        "/proyek.html";

      params.set(
        "status_final",
        "Aktif"
      );

      params.set(
        "status_pengadaan",
        "Done"
      );

      params.set(
        "tanggal_akhir",
        "expired"
      );

      params.set(
        "status_teknis_exclude",
        "done,selesai"
      );

      params.set(
        "kontrak",
        "proyek-terlambat"
      );
    }

    // ==================================================
    // PROYEK BELUM UPDATE
    // ==================================================

    else if (
      card.dataset.update
    ) {
      path =
        "/proyek-belum-update.html";

      params.set(
        "update",
        card.dataset.update
      );
    }

    // ==================================================
    // CARD PROJECT OVERVIEW
    // ==================================================

    else {
      path =
        "/proyek.html";

      const adalahCardTotalProyek =
        Boolean(
          card.querySelector(
            "#totalSemuaProyek"
          )
        );

      const adalahCardProyekAktif =
        Boolean(
          card.querySelector(
            "#totalProyekAktif"
          )
        );

      const adalahCardProsesPengadaan =
        Boolean(
          card.querySelector(
            "#totalSubmitPengadaan"
          )
        );

      // ================================================
      // TOTAL PROYEK
      //
      // Gabungan seluruh card Project Overview.
      // ================================================

      if (
        adalahCardTotalProyek
      ) {
        params.set(
          "dashboard_group",
          "total-project"
        );

        params.delete(
          "status_final"
        );

        params.delete(
          "status_pengadaan"
        );

        params.delete(
          "periode_kontrak"
        );
      }

      // ================================================
      // PROYEK AKTIF
      // ================================================

      else if (
        adalahCardProyekAktif
      ) {
        params.set(
          "status_final",
          "Aktif"
        );

        params.set(
          "status_pengadaan",
          "Done"
        );

        params.set(
          "periode_kontrak",
          "tahun"
        );
      }

      // ================================================
      // PROSES PENGADAAN
      //
      // Submit Pengadaan dan Negosiasi.
      // ================================================

      else if (
        adalahCardProsesPengadaan
      ) {
        params.set(
          "status_final",
          "Aktif"
        );

        params.set(
          "dashboard_group",
          "proses-pengadaan"
        );

        params.delete(
          "status_pengadaan"
        );

        params.delete(
          "periode_kontrak"
        );
      }

      // ================================================
      // CARD PROJECT LAINNYA
      // ================================================

      else {
        if (
          card.dataset.statusFinal
        ) {
          params.set(
            "status_final",
            card.dataset.statusFinal
          );
        }

        if (
          card.dataset.statusPengadaan
        ) {
          params.set(
            "status_pengadaan",
            card.dataset.statusPengadaan
          );
        }

        if (
          card.dataset.periodeKontrak
        ) {
          params.set(
            "periode_kontrak",
            card.dataset.periodeKontrak
          );

        } else if (
          card.dataset.statusFinal &&
          !card.dataset.statusPengadaan
        ) {
          params.set(
            "periode_kontrak",
            "tahun"
          );
        }
      }
    }
  

  // ====================================================
  // FINANCIAL OVERVIEW — PENDAPATAN
  // ====================================================

  } else if (  
  route === "income"
) {
  path =
    "/pendapatan.html";

  if (card.dataset.jenis) {
    params.set(
      "jenis_proyek",
      card.dataset.jenis
    );
  }

  if (card.dataset.status) {
    params.set(
      "status_pembayaran",
      card.dataset.status
    );
  }

  /*
   * Pendapatan bulan berjalan
   * menggunakan pengakuan pendapatan,
   * bukan hanya status sudah dibayar.
   */

  if (
    card.dataset.currentMonth ===
    "true"
  ) {
    const periode =
      dapatkanPeriodeJakarta();

    params.set(
      "tahun",
      String(periode.tahun)
    );

    params.set(
      "bulan",
      String(periode.bulan)
    );

    params.set(
      "status_pembayaran",
      "Pendapatan Diakui"
    );
  }
  // ====================================================
  // FINANCIAL OVERVIEW — PENGELUARAN
  // ====================================================

  } else if (
  route === "expense"
) {
  path =
    "/pengeluaran.html";

  if (card.dataset.jenis) {
    params.set(
      "jenis_proyek",
      card.dataset.jenis
    );
  }

  if (card.dataset.status) {
    params.set(
      "status_pembayaran",
      card.dataset.status
    );
  }
}
  // ====================================================
  // CONTRACT OVERVIEW — TIMELINE
  // ====================================================

  else if (
    route === "timeline"
  ) {
    path =
      "/timeline.html";

    params.delete(
      "tahun"
    );


    if (
      card.dataset.timeline ===
      "3-bulan"
    ) {
      params.set(
        "bulan",
        "3"
      );
    }

    if (
      card.dataset.timeline ===
      "expired"
    ) {
      params.set(
        "status",
        "expired"
      );
    }
  }

  // ====================================================
  // GRAFIK PENDAPATAN
  // ====================================================

  else if (
    route === "total-income"
  ) {
    path =
      "/total-pendapatan.html";
  }

  // ====================================================
  // GRAFIK PENGELUARAN
  // ====================================================

  else if (
    route === "total-expense"
  ) {
    path =
      "/pengeluaran.html";
  }

  // ====================================================
  // REDIRECT
  // ====================================================

  if (path) {
    const query =
      params.toString();

    window.location.href =
      query
        ? `${path}?${query}`
        : path;
  }
}

// ======================================================
// KONFIGURASI CARD
// ======================================================
function aturDataCard(
  idNilai,
  data
) {
  const element =
    document.getElementById(
      idNilai
    );


  if (!element) {
    console.warn(
      `Elemen #${idNilai} tidak ditemukan`
    );

    return;
  }


  /*
   * Cari pembungkus card.
   * Selector dibuat lebih luas agar
   * cocok dengan seluruh desain card.
   */

  const card =
    element.closest(
      [
        "button",
        "a",
        "[role='button']",
        ".stat-card",
        ".metric-card",
        ".contract-card",
        ".overview-card",
        ".finance-card",
        ".financial-card",
        ".income-card",
        ".expense-card",
        ".month-card",
        ".chart-card",
        ".business-card",
        "[class*='card']"
      ].join(",")
    ) ||
    element.parentElement ||
    element;


  /*
   * Pasang dataset pada pembungkus card.
   */

  Object.entries(data)
    .forEach(
      ([key, value]) => {
        if (
          value !== null &&
          value !== undefined
        ) {
          card.dataset[key] =
            String(value);
        }
      }
    );


  /*
   * Pasang juga pada elemen angka sebagai
   * pengaman jika pembungkus card tidak
   * terdeteksi dengan benar.
   */

  Object.entries(data)
    .forEach(
      ([key, value]) => {
        if (
          value !== null &&
          value !== undefined
        ) {
          element.dataset[key] =
            String(value);
        }
      }
    );


  card.style.cursor =
    "pointer";


  if (
    card.tagName.toLowerCase() !==
      "button" &&
    card.tagName.toLowerCase() !==
      "a"
  ) {
    card.setAttribute(
      "role",
      "button"
    );

    card.setAttribute(
      "tabindex",
      "0"
    );
  }


  console.log(
    "CARD NAVIGASI TERPASANG:",
    idNilai,
    data,
    card
  );
}


function konfigurasiSemuaCard() {
  // ====================================================
  // PROJECT OVERVIEW
  // ====================================================

  aturDataCard(
    "totalPipeline",
    {
      route: "project",
      statusFinal: "Aktif",
      statusPengadaan: "Pipeline"
    }
  );


  aturDataCard(
    "totalSubmitPenawaran",
    {
      route: "project",
      statusFinal: "Aktif",
      statusPengadaan:
        "Submit Penawaran"
    }
  );


  aturDataCard(
    "totalSubmitPengadaan",
    {
      route: "project"
    }
  );


  aturDataCard(
    "totalKontrak",
    {
      route: "project",
      statusFinal: "Aktif",
      statusPengadaan:
        "Kontrak"
    }
  );


  aturDataCard(
    "totalProyekAktif",
    {
      route: "project"
    }
  );


  aturDataCard(
    "totalProyekDone",
    {
      route: "project",
      statusFinal: "Done",
      periodeKontrak: "tahun"
    }
  );


  aturDataCard(
    "totalProyekTerlambat",
    {
      route: "project",
      contract:
        "proyek-terlambat"
    }
  );


  aturDataCard(
    "totalSemuaProyek",
    {
      route: "project"
    }
  );


  // ====================================================
  // FINANCIAL OVERVIEW — PENDAPATAN
  // ====================================================

  aturDataCard(
    "pendapatanBulanBerjalan",
    {
      route: "income",
      status:
        "Pendapatan Diakui",
      currentMonth:
        "true"
    }
  );


  aturDataCard(
    "regulerDibayar",
    {
      route: "income",
      jenis:
        "Reguler/SLA",
      status:
        "Pendapatan Diakui"
    }
  );


  aturDataCard(
    "sewaDibayar",
    {
      route: "income",
      jenis:
        "Sewa",
      status:
        "Pendapatan Diakui"
    }
  );


  aturDataCard(
    "transaksiDibayar",
    {
      route: "income",
      jenis:
        "Transaksi",
      status:
        "Pendapatan Diakui"
    }
  );


  aturDataCard(
    "piutangKlien",
    {
      route: "income",
      status:
        "Selain Dibayar"
    }
  );


  aturDataCard(
    "sudahDibayarKlien",
    {
      route: "income",
      status:
        "Sudah Dibayar"
    }
  );


  // ====================================================
  // FINANCIAL OVERVIEW — PENGELUARAN
  // ====================================================

  aturDataCard(
    "hutangPartner",
    {
      route: "expense",
      status:
        "Selain Dibayar"
    }
  );


  aturDataCard(
    "dibayarPartner",
    {
      route: "expense",
      status:
        "Sudah Dibayar"
    }
  );


  // ====================================================
  // GRAFIK FINANCIAL OVERVIEW
  // ====================================================

  aturDataCard(
    "incomeChart",
    {
      route:
        "total-income"
    }
  );


  aturDataCard(
    "partnerChart",
    {
      route:
        "total-expense"
    }
  );


  // ====================================================
  // CONTRACT OVERVIEW
  // ====================================================

  aturDataCard(
    "kontrakKlienTigaBulan",
    {
      route: "project",
      contract:
        "klien-3-bulan"
    }
  );


  aturDataCard(
    "kontrakPartnerTigaBulan",
    {
      route: "project",
      contract:
        "partner-3-bulan"
    }
  );


  aturDataCard(
    "kontrakKlienExpired",
    {
      route: "project",
      contract:
        "klien-expired"
    }
  );


  aturDataCard(
    "kontrakPartnerExpired",
    {
      route: "project",
      contract:
        "partner-expired"
    }
  );


  aturDataCard(
    "lisensiSewaTigaBulan",
    {
      route: "timeline",
      timeline:
        "3-bulan"
    }
  );


  aturDataCard(
    "lisensiSewaExpired",
    {
      route: "timeline",
      timeline:
        "expired"
    }
  );


  // ====================================================
  // BUSINESS PERFORMANCE
  // ====================================================

  aturDataCard(
    "proyekBelumUpdate",
    {
      route: "project",
      update:
        "belum-update"
    }
  );
}

  // Bagian Financial Overview,
  // Contract Overview, Business Performance
  // yang sudah ada tetap dilanjutkan di bawah sini.

// ======================================================
// EVENT CARD
// ======================================================

document.addEventListener(
  "click",
  event => {
    const target =
      event.target instanceof Element
        ? event.target
        : null;


    if (!target) {
      return;
    }


    const card =
      target.closest(
        "[data-route]"
      );


    if (!card) {
      return;
    }


    /*
     * Variabel route sebelumnya belum dibuat.
     * Hal ini yang menyebabkan klik berhenti.
     */

    const route =
      String(
        card.dataset.route || ""
      )
        .trim()
        .toLowerCase();


    if (!route) {
      console.error(
        "Card tidak mempunyai route",
        card
      );

      return;
    }


    event.preventDefault();

    bukaDetailCard(card);
  }
);

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }


    const target =
      event.target instanceof Element
        ? event.target
        : null;


    if (!target) {
      return;
    }


    const card =
      target.closest(
        "[data-route]"
      );


    if (!card) {
      return;
    }


    const route =
      String(
        card.dataset.route || ""
      )
        .trim()
        .toLowerCase();


    if (!route) {
      return;
    }


    event.preventDefault();

    bukaDetailCard(card);
  }
);
// ======================================================
// EVENT FILTER
// ======================================================

function jalankanFilterDashboard() {
  window.clearTimeout(
    timerFilterDashboard
  );

  timerFilterDashboard =
    window.setTimeout(
      () => {
        loadDashboard();
      },
      150
    );
}


dashboardYear
  ?.addEventListener(
    "change",
    jalankanFilterDashboard
  );

dashboardJenisProyek
  ?.addEventListener(
    "change",
    jalankanFilterDashboard
  );

dashboardPic
  ?.addEventListener(
    "change",
    jalankanFilterDashboard
  );


// ======================================================
// RESET FILTER
// ======================================================

refreshDashboard
  ?.addEventListener(
    "click",
    () => {
      const periode =
        dapatkanPeriodeJakarta();

      if (dashboardYear) {
        dashboardYear.value =
          String(
            periode.tahun
          );
      }

      if (
        dashboardJenisProyek
      ) {
        dashboardJenisProyek.value =
          "";
      }

      if (dashboardPic) {
        dashboardPic.value =
          "";
      }

      loadDashboard();
    }
  );


// ======================================================
// RESIZE GRAFIK
// ======================================================

window.addEventListener(
  "resize",
  () => {
    window.clearTimeout(
      resizeTimer
    );

    resizeTimer =
      window.setTimeout(
        () => {
          if (
            currentDashboardData
          ) {
            renderCharts(
              currentDashboardData
            );
          }
        },
        160
      );
  }
);


// ======================================================
// INISIALISASI
// ======================================================

async function mulaiDashboard() {
  isiPilihanTahun();

  isiFilterJenisProyek();

  await isiFilterPic();

  konfigurasiSemuaCard();

  await loadDashboard();

  /*
   * Pasang kembali setelah dashboard
   * selesai dirender.
   */

  konfigurasiSemuaCard();
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    mulaiDashboard
  );

} else {
  mulaiDashboard();
}