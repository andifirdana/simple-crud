// ======================================================
// PORTOPRO - PROYEK TIMELINE
// ======================================================

(function () {

  "use strict";


  // ====================================================
  // HELPER
  // ====================================================

  function $(id) {
    return document.getElementById(id);
  }


  function esc(value) {

    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  }


  // ====================================================
  // PARAMETER
  // ====================================================

  const params =
    new URLSearchParams(
      window.location.search
    );


  const proyekId =
    params.get("id");


  const endpoint =
    `/api/proyek/${encodeURIComponent(
      proyekId || ""
    )}/proyek-timeline`;


  // ====================================================
  // STATE
  // ====================================================

  let timelineData = {
    schemaVersion: 1,
    reportDate: "",
    modules: []
  };


  /*
    all    = Target + Actual
    target = Target saja
    actual = Actual saja
  */

  let activeFilter =
    "all";


  // ====================================================
  // MESSAGE
  // ====================================================

  function showMessage(
    text,
    kind = ""
  ) {

    const element =
      $("timelineMessage");


    if (!element) {
      return;
    }


    element.textContent =
      text || "";


    element.className =
      "timeline-message";


    if (kind) {

      element.classList.add(
        kind
      );

    }


    element.hidden =
      !text;

  }


  // ====================================================
  // FETCH JSON
  // ====================================================

  async function jsonRequest() {

    const response =
      await fetch(
        endpoint,
        {
          method: "GET",

          credentials:
            "same-origin",

          cache:
            "no-store",

          headers: {
            Accept:
              "application/json"
          }
        }
      );


    // ==================================================
    // SESSION HABIS
    // ==================================================

    if (
      response.status === 401
    ) {

      window.location.href =
        "/login.html";

      throw new Error(
        "Sesi berakhir. Silakan login kembali."
      );

    }


    // ==================================================
    // PASTIKAN JSON
    // ==================================================

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
        "API proyek-timeline tidak mengembalikan JSON."
      );

    }


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal mengambil timeline proyek."
      );

    }


    return result;

  }


  // ====================================================
  // PARSE DATE
  // ====================================================

  function parseDate(value) {

    if (!value) {
      return null;
    }


    /*
      Mendukung:
      2026-09-25

      dan apabila API masih mengirim:
      2026-09-25T00:00:00.000Z
    */

    const text =
      String(value)
        .trim()
        .slice(0, 10);


    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        text
      )
    ) {

      return null;

    }


    const [
      year,
      month,
      day
    ] =
      text
        .split("-")
        .map(Number);


    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      );


    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {

      return null;

    }


    return date;

  }


  // ====================================================
  // FORMAT DATE
  // ====================================================

  function formatDate(value) {

    const date =
      value instanceof Date
        ? value
        : parseDate(value);


    if (!date) {
      return "-";
    }


    return new Intl.DateTimeFormat(
      "id-ID",
      {
        day:
          "2-digit",

        month:
          "short",

        year:
          "numeric",

        timeZone:
          "UTC"
      }
    ).format(date);

  }


  // ====================================================
  // START OF WEEK
  // SENIN
  // ====================================================

  function startOfWeek(date) {

    const result =
      new Date(date);


    const day =
      result.getUTCDay();


    const offset =
      day === 0
        ? 6
        : day - 1;


    result.setUTCDate(
      result.getUTCDate() -
      offset
    );


    result.setUTCHours(
      0,
      0,
      0,
      0
    );


    return result;

  }


  // ====================================================
  // END OF WEEK
  // MINGGU
  // ====================================================

  function endOfWeek(date) {

    const result =
      new Date(date);


    result.setUTCDate(
      result.getUTCDate() + 6
    );


    result.setUTCHours(
      23,
      59,
      59,
      999
    );


    return result;

  }


  // ====================================================
  // TAMBAH HARI
  // ====================================================

  function addDays(
    date,
    days
  ) {

    const result =
      new Date(date);


    result.setUTCDate(
      result.getUTCDate() +
      days
    );


    return result;

  }


  // ====================================================
  // SEMUA ITEM
  // ====================================================

  function getAllItems() {

    if (
      !timelineData ||
      !Array.isArray(
        timelineData.modules
      )
    ) {

      return [];

    }


    return timelineData.modules
      .flatMap(
        group => {

          const items =
            Array.isArray(
              group.items
            )
              ? group.items
              : [];


          return items.map(
            item => ({
              ...item,

              groupId:
                group.id,

              groupNo:
                group.no,

              groupName:
                group.module
            })
          );

        }
      );

  }


  // ====================================================
  // RANGE TIMELINE
  // ====================================================

  function getTimelineRange() {

    const items =
      getAllItems();


    const dates =
      [];


    items.forEach(
      item => {

        [
          item.targetStart,
          item.targetEnd,
          item.actualStart,
          item.actualEnd
        ].forEach(
          value => {

            const date =
              parseDate(value);


            if (date) {

              dates.push(
                date
              );

            }

          }
        );

      }
    );


    if (
      dates.length === 0
    ) {

      return null;

    }


    const timestamps =
      dates.map(
        date =>
          date.getTime()
      );


    const minDate =
      new Date(
        Math.min(
          ...timestamps
        )
      );


    const maxDate =
      new Date(
        Math.max(
          ...timestamps
        )
      );


    const firstWeek =
      startOfWeek(
        minDate
      );


    const lastWeek =
      startOfWeek(
        maxDate
      );


    const weeks =
      [];


    let cursor =
      new Date(
        firstWeek
      );


    while (
      cursor.getTime() <=
      lastWeek.getTime()
    ) {

      const weekStart =
        new Date(
          cursor
        );


      weeks.push({

        start:
          weekStart,

        end:
          endOfWeek(
            weekStart
          )

      });


      cursor =
        addDays(
          cursor,
          7
        );

    }


    return {
      start:
        firstWeek,

      end:
        endOfWeek(
          lastWeek
        ),

      weeks
    };

  }


  // ====================================================
  // GROUP HEADER BULAN
  // ====================================================

  function createMonthGroups(
    weeks
  ) {

    const groups =
      [];


    weeks.forEach(
      week => {

        const year =
          week.start
            .getUTCFullYear();


        const month =
          week.start
            .getUTCMonth();


        const key =
          `${year}-${month}`;


        const label =
          new Intl.DateTimeFormat(
            "id-ID",
            {
              month:
                "long",

              year:
                "numeric",

              timeZone:
                "UTC"
            }
          ).format(
            week.start
          );


        const last =
          groups[
            groups.length - 1
          ];


        if (
          last &&
          last.key === key
        ) {

          last.count += 1;

        } else {

          groups.push({
            key,
            label,
            count: 1
          });

        }

      }
    );


    return groups;

  }


  // ====================================================
  // RENDER HEADER
  // ====================================================

  function renderHeader(
    weeks
  ) {

    const head =
      $("ganttHead");


    if (!head) {
      return;
    }


    const monthGroups =
      createMonthGroups(
        weeks
      );


    const monthHtml =
      monthGroups
        .map(
          month => `

            <th
              colspan="${month.count}"
              class="gantt-month"
            >
              ${esc(
                month.label
              )}
            </th>

          `
        )
        .join("");


    const weekHtml =
      weeks
        .map(
          (week, index) => `

            <th
              class="gantt-week"
              title="${esc(
                `${formatDate(
                  week.start
                )} - ${formatDate(
                  week.end
                )}`
              )}"
            >
              W${index + 1}
            </th>

          `
        )
        .join("");


    head.innerHTML = `

      <tr>

        <th
          rowspan="2"
          class="gantt-name"
        >
          Rincian Pekerjaan
        </th>

        ${monthHtml}

      </tr>


      <tr>

        ${weekHtml}

      </tr>

    `;

  }


  // ====================================================
  // CEK RANGE DENGAN MINGGU
  // ====================================================

  function isOverlap(
    start,
    end,
    week
  ) {

    if (
      !start ||
      !end ||
      !week
    ) {

      return false;

    }


    return (
      start.getTime() <=
        week.end.getTime() &&

      end.getTime() >=
        week.start.getTime()
    );

  }


  // ====================================================
  // START / END CLASS
  // ====================================================

  function getTrackClass(
    start,
    end,
    week
  ) {

    const classes =
      [];


    if (
      start &&
      start.getTime() >=
        week.start.getTime() &&

      start.getTime() <=
        week.end.getTime()
    ) {

      classes.push(
        "start"
      );

    }


    if (
      end &&
      end.getTime() >=
        week.start.getTime() &&

      end.getTime() <=
        week.end.getTime()
    ) {

      classes.push(
        "end"
      );

    }


    return classes.join(
      " "
    );

  }


  // ====================================================
  // BUAT CELL
  // ====================================================

  function createCell(
    item,
    week
  ) {

    const targetStart =
      parseDate(
        item.targetStart
      );


    const targetEnd =
      parseDate(
        item.targetEnd
      );


    const actualStart =
      parseDate(
        item.actualStart
      );


    const actualEnd =
      parseDate(
        item.actualEnd
      );


    let html =
      "";


    // ==================================================
    // TARGET
    // GARIS ATAS
    // ==================================================

    if (
      activeFilter !== "actual" &&
      isOverlap(
        targetStart,
        targetEnd,
        week
      )
    ) {

      html += `

        <span
          class="
            gantt-track
            target
            ${getTrackClass(
              targetStart,
              targetEnd,
              week
            )}
          "
          title="${esc(
            `Target: ${formatDate(
              item.targetStart
            )} - ${formatDate(
              item.targetEnd
            )}`
          )}"
        ></span>

      `;

    }


    // ==================================================
    // ACTUAL
    // GARIS BAWAH
    // ==================================================

    if (
      activeFilter !== "target" &&
      isOverlap(
        actualStart,
        actualEnd,
        week
      )
    ) {

      html += `

        <span
          class="
            gantt-track
            actual
            ${getTrackClass(
              actualStart,
              actualEnd,
              week
            )}
          "
          title="${esc(
            `Actual: ${formatDate(
              item.actualStart
            )} - ${formatDate(
              item.actualEnd
            )}`
          )}"
        ></span>

      `;

    }


    return `

      <td class="gantt-cell">

        ${html}

      </td>

    `;

  }


  // ====================================================
  // RENDER EMPTY
  // ====================================================

  function renderEmpty(
    message
  ) {

    const head =
      $("ganttHead");


    const body =
      $("ganttBody");


    if (head) {

      head.innerHTML =
        "";

    }


    if (body) {

      body.innerHTML = `

        <tr>

          <td class="gantt-empty">

            ${esc(message)}

          </td>

        </tr>

      `;

    }

  }


  // ====================================================
  // RENDER GANTT
  // ====================================================

  function renderGantt() {

    const head =
      $("ganttHead");


    const body =
      $("ganttBody");


    if (
      !head ||
      !body
    ) {

      console.error(
        "ganttHead atau ganttBody tidak ditemukan."
      );

      return;

    }


    if (
      !timelineData ||
      !Array.isArray(
        timelineData.modules
      ) ||
      timelineData.modules.length === 0
    ) {

      renderEmpty(
        "Belum ada data progress."
      );

      return;

    }


    const range =
      getTimelineRange();


    if (
      !range ||
      range.weeks.length === 0
    ) {

      renderEmpty(
        "Belum ada tanggal Target atau Actual."
      );

      return;

    }


    renderHeader(
      range.weeks
    );


    let html =
      "";


    timelineData.modules
      .forEach(
        group => {

          const items =
            Array.isArray(
              group.items
            )
              ? group.items
              : [];


          // ============================================
          // MODUL UTAMA
          // ============================================

          html += `

            <tr class="gantt-module">

              <td class="gantt-name">

                <strong>
                  ${esc(
                    group.no ?? ""
                  )}
                </strong>

                ${
                  group.no
                    ? "."
                    : ""
                }

                ${esc(
                  group.module ||
                  "Modul"
                )}

              </td>

              ${
                range.weeks
                  .map(
                    () => `
                      <td
                        class="gantt-cell"
                      ></td>
                    `
                  )
                  .join("")
              }

            </tr>

          `;


          // ============================================
          // ITEM / SUBMODUL
          // ============================================

          items.forEach(
            (item, index) => {

              const nomor =
                group.no
                  ? `${group.no}.${index + 1}`
                  : `${index + 1}`;


              html += `

                <tr>

                  <td class="gantt-name">

                    <strong>
                      ${esc(
                        nomor
                      )}
                    </strong>

                    &nbsp;

                    ${esc(
                      item.module ||
                      item.nama ||
                      "-"
                    )}

                  </td>

                  ${
                    range.weeks
                      .map(
                        week =>
                          createCell(
                            item,
                            week
                          )
                      )
                      .join("")
                  }

                </tr>

              `;

            }
          );

        }
      );


    body.innerHTML =
      html;

  }


  // ====================================================
  // UPDATE FILTER BUTTON
  // ====================================================

  function updateFilterButtons() {

    const actualButton =
      $("filterActual");


    const targetButton =
      $("filterTarget");


    const resetButton =
      $("filterReset");


    [
      actualButton,
      targetButton,
      resetButton
    ].forEach(
      button => {

        if (button) {

          button.classList.remove(
            "filter-active"
          );

        }

      }
    );


    if (
      activeFilter === "actual"
    ) {

      actualButton
        ?.classList.add(
          "filter-active"
        );

    } else if (
      activeFilter === "target"
    ) {

      targetButton
        ?.classList.add(
          "filter-active"
        );

    } else {

      resetButton
        ?.classList.add(
          "filter-active"
        );

    }

  }


  // ====================================================
  // SET FILTER
  // ====================================================

  function setFilter(
    filter
  ) {

    if (
      ![
        "all",
        "actual",
        "target"
      ].includes(filter)
    ) {

      filter =
        "all";

    }


    activeFilter =
      filter;


    updateFilterButtons();


    renderGantt();

  }


  // ====================================================
  // BIND FILTER
  // ====================================================

  function bindFilterEvents() {

    const actualButton =
      $("filterActual");


    const targetButton =
      $("filterTarget");


    const resetButton =
      $("filterReset");


    if (actualButton) {

      actualButton.addEventListener(
        "click",
        () => {

          setFilter(
            "actual"
          );

        }
      );

    }


    if (targetButton) {

      targetButton.addEventListener(
        "click",
        () => {

          setFilter(
            "target"
          );

        }
      );

    }


    if (resetButton) {

      resetButton.addEventListener(
        "click",
        () => {

          setFilter(
            "all"
          );

        }
      );

    }

  }


  // ====================================================
  // LINK NAVIGASI
  // ====================================================

  function setupNavigation() {

    const backToProgress =
      $("backToProgress");


    const backToProject =
      $("backToProject");


    if (backToProgress) {

      backToProgress.href =
        `/update-progress.html?id=${encodeURIComponent(
          proyekId
        )}`;

    }


    if (backToProject) {

      backToProject.href =
        `/detail-proyek.html?id=${encodeURIComponent(
          proyekId
        )}`;

    }

  }


  // ====================================================
  // RENDER INFORMASI PROYEK
  // ====================================================

  function renderProjectInfo(
    proyek
  ) {

    if (!proyek) {
      return;
    }


    const namaElement =
      $("timelineNamaProyek");


    const instansiElement =
      $("timelineInstansi");


    if (namaElement) {

      namaElement.textContent =
        proyek.nama_proyek ||
        "-";

    }


    if (instansiElement) {

  instansiElement.textContent =
    proyek.klien_id
      ? `Klien ID: ${proyek.klien_id}`
      : "-";

}


    if (
      proyek.nama_proyek
    ) {

      document.title =
        `Timeline ${proyek.nama_proyek} - Portopro`;

    }

  }


  // ====================================================
  // NORMALISASI RESPONSE API
  // ====================================================

  function normalizeTimelineData(
    result
  ) {

    if (
      result?.data &&
      Array.isArray(
        result.data.modules
      )
    ) {

      return result.data;

    }


    /*
      Cadangan apabila API nanti
      langsung mengembalikan modules.
    */

    if (
      Array.isArray(
        result?.modules
      )
    ) {

      return {
        schemaVersion:
          result.schemaVersion || 1,

        reportDate:
          result.reportDate || "",

        modules:
          result.modules
      };

    }


    return {
      schemaVersion: 1,
      reportDate: "",
      modules: []
    };

  }


  // ====================================================
  // INITIALIZE
  // ====================================================

  async function initialize() {

    try {

      // ================================================
      // VALIDASI ID
      // ================================================

      if (
        !proyekId ||
        !/^\d+$/.test(
          proyekId
        ) ||
        Number(proyekId) <= 0
      ) {

        throw new Error(
          "ID proyek tidak valid."
        );

      }


      // ================================================
      // NAVIGASI
      // ================================================

      setupNavigation();


      // ================================================
      // EVENT
      // ================================================

      bindFilterEvents();


      // ================================================
      // DEFAULT FILTER
      // ================================================

      activeFilter =
        "all";


      updateFilterButtons();


      // ================================================
      // LOADING
      // ================================================

      showMessage(
        "Memuat timeline proyek..."
      );


      // ================================================
      // GET API
      // ================================================

      const result =
        await jsonRequest();


      console.log(
        "PROYEK TIMELINE:",
        result
      );


      // ================================================
      // PROJECT INFO
      // ================================================

      renderProjectInfo(
        result.proyek
      );


      // ================================================
      // TIMELINE DATA
      // ================================================

      timelineData =
        normalizeTimelineData(
          result
        );


      // ================================================
      // RENDER
      // ================================================

      renderGantt();


      // ================================================
      // SELESAI
      // ================================================

      showMessage(
        ""
      );


    } catch (error) {

      console.error(
        "ERROR PROYEK TIMELINE:",
        error
      );


      showMessage(
        error.message ||
        "Terjadi kesalahan saat memuat timeline.",
        "error"
      );


      renderEmpty(
        "Timeline tidak dapat ditampilkan."
      );

    }

  }


  // ====================================================
  // START
  // ====================================================

  /*
    PENTING:

    Jangan bind addEventListener sebelum
    HTML selesai dibuat.

    Ini yang mencegah error:
    Cannot read properties of null
    (reading 'addEventListener')
  */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );

  } else {

    initialize();

  }


})();