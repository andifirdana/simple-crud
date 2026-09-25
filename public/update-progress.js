// ======================================================
// PERHITUNGAN DAN VALIDASI PROGRESS
// Semua helper sudah termasuk dalam file ini.
// ======================================================

(function (root, factory) {
  if (
    typeof module === "object" &&
    module.exports
  ) {
    module.exports = factory();
  } else {
    root.PortoproProgress = factory();
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,

  function () {
    "use strict";

    const DAY = 86400000;

    // ==================================================
    // VALIDASI DAN KONVERSI TANGGAL
    // ==================================================

    function dateNumber(value) {
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
      ) {
        return null;
      }

      const [year, month, day] =
        value.split("-").map(Number);

      if (
        year < 1000 ||
        year > 9999
      ) {
        return null;
      }

      const time =
        Date.UTC(
          year,
          month - 1,
          day
        );

      const date =
        new Date(time);

      const valid =
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day;

      return valid
        ? time
        : null;
    }

    function difference(start, end) {
      const first =
        dateNumber(start);

      const last =
        dateNumber(end);

      if (
        first === null ||
        last === null
      ) {
        return null;
      }

      return (
        last - first
      ) / DAY;
    }

    function duration(start, end) {
      const days = difference(start, end);

      return days === null || days < 0
        ? null
        : days + 1;
    }

    function dateError(start, end) {
      if (
        start &&
        dateNumber(start) === null
      ) {
        return "Tanggal mulai tidak valid.";
      }

      if (
        end &&
        dateNumber(end) === null
      ) {
        return "Tanggal akhir tidak valid.";
      }

      if (
        end &&
        !start
      ) {
        return "Isi tanggal mulai sebelum tanggal akhir.";
      }

      if (
        start &&
        end &&
        difference(start, end) < 0
      ) {
        return "Tanggal akhir tidak boleh sebelum tanggal mulai.";
      }

      return "";
    }

    // ==================================================
    // STATUS BERDASARKAN TANGGAL AKTUAL
    // ==================================================

    function rowStatus(row) {
      const error =
        dateError(
          row.actualStart,
          row.actualEnd
        );

      if (error) {
        return "Tanggal tidak valid";
      }

      if (
        !row.actualStart &&
        !row.actualEnd
      ) {
        return "Not Yet";
      }

      if (
        row.actualStart &&
        !row.actualEnd
      ) {
        return "In Progress";
      }

      return "Done";
    }

    // ==================================================
    // HITUNG DURASI, BOBOT, DAN PERINGATAN
    // ==================================================

    function calculate(documentData) {
      const modules =
        (documentData.modules || [])
          .map(group => ({
            ...group,

            items:
              group.items.map(
                (item, index) => {
                  const targetDuration =
                    duration(
                      item.targetStart,
                      item.targetEnd
                    );

                  const actualDuration =
                    duration(
                      item.actualStart,
                      item.actualEnd
                    );

                  const delayDays =
                    Math.max(
                      0,

                      difference(
                        item.targetStart,
                        item.actualStart
                      ) ?? 0
                    );

                  const excessDays =
                    targetDuration !== null &&
                    actualDuration !== null

                      ? Math.max(
                          0,
                          actualDuration -
                          targetDuration
                        )

                      : 0;

                  const notices = [];

                  if (delayDays > 0) {
                    notices.push(
                      `Keterlambatan mulai pekerjaan ${delayDays} hari.`
                    );
                  }

                  if (excessDays > 0) {
                    notices.push(
                      `Kelebihan durasi pekerjaan ${excessDays} hari.`
                    );
                  }

                  return {
                    ...item,

                    subNo:
                      `${group.no || "?"}.${index + 1}`,

                    status:
                      rowStatus(item),

                    targetDuration,
                    actualDuration,
                    delayDays,
                    excessDays,
                    notices
                  };
                }
              )
          }));

      const items =
        modules.flatMap(
          group => group.items
        );

      const totalTargetDuration =
        items.reduce(
          (sum, row) =>
            sum +
            (row.targetDuration ?? 0),
          0
        );

      const totalActualDuration =
        items.reduce(
          (sum, row) =>
            sum +
            (row.actualDuration ?? 0),
          0
        );

      items.forEach(row => {
        row.targetWeight =
          totalTargetDuration > 0

            ? (
                (row.targetDuration ?? 0) /
                totalTargetDuration
              ) * 100

            : 0;

        row.actualWeight =
          totalActualDuration > 0

            ? (
                (row.actualDuration ?? 0) /
                totalActualDuration
              ) * 100

            : 0;

        row.progressWeight =
        row.status === "Done"
          ? row.targetWeight
          : 0;

      });

      return {
        ...documentData,

        modules,

        summary: {
          moduleCount:
            modules.length,

          itemCount:
            items.length,

          completedCount:
            items.filter(
              row =>
                row.status === "Done"
            ).length,

          totalTargetDuration,
          totalActualDuration,

          totalTargetWeight:
            totalTargetDuration > 0
              ? 100
              : 0,

          totalActualWeight:
            totalActualDuration > 0
              ? 100
              : 0,
          
          totalProgress: items.reduce(
            (sum, row) => sum + row.progressWeight,
            0
          )
        }
      };
    }

    // ==================================================
    // VALIDASI SEBELUM SIMPAN
    // ==================================================

    function validateDocument(input) {
      function fail(message) {
        throw new Error(message);
      }

      if (
        !input ||
        typeof input !== "object"
      ) {
        fail("Data progress tidak valid.");
      }

      if (
        dateNumber(input.reportDate) === null
      ) {
        fail(
          "Tanggal laporan wajib diisi dengan tanggal yang valid."
        );
      }

      if (
        !Array.isArray(input.modules) ||
        input.modules.length > 100
      ) {
        fail(
          "Maksimal 100 modul utama."
        );
      }

      const usedIds =
        new Set();

      const usedNumbers =
        new Set();

      let rowCount = 0;

      function text(
        value,
        label,
        max,
        required = false
      ) {
        if (
          typeof value !== "string"
        ) {
          fail(
            `${label} harus berupa teks.`
          );
        }

        const result =
          value.trim();

        if (
          required &&
          !result
        ) {
          fail(
            `${label} wajib diisi.`
          );
        }

        if (
          result.length > max
        ) {
          fail(
            `${label} maksimal ${max} karakter.`
          );
        }

        return result;
      }

      function identity(value) {
        if (
          typeof value !== "string" ||
          !/^[a-zA-Z0-9_-]{1,64}$/.test(value) ||
          usedIds.has(value)
        ) {
          fail(
            "Identitas modul tidak valid atau duplikat."
          );
        }

        usedIds.add(value);

        return value;
      }

      const modules =
        input.modules.map(group => {
          if (
            !group ||
            typeof group !== "object"
          ) {
            fail(
              "Modul utama tidak valid."
            );
          }

          if (
            !Number.isSafeInteger(group.no) ||
            group.no < 1 ||
            usedNumbers.has(group.no)
          ) {
            fail(
              "No modul utama harus bilangan bulat positif dan tidak boleh sama."
            );
          }

          usedNumbers.add(
            group.no
          );

          if (
            !Array.isArray(group.items) ||
            group.items.length === 0
          ) {
            fail(
              `Modul ${group.no} perlu minimal satu submodul.`
            );
          }

          rowCount +=
            group.items.length;

          if (
            rowCount > 1000
          ) {
            fail(
              "Maksimal 1.000 submodul dalam satu proyek."
            );
          }

          return {
            id:
              identity(group.id),

            no:
              group.no,

            module:
              text(
                group.module,
                `Nama modul ${group.no}`,
                300,
                true
              ),

            items:
              group.items.map(
                (item, index) => {
                  const label =
                    `Submodul ${group.no}.${index + 1}`;

                  if (
                    !item ||
                    typeof item !== "object"
                  ) {
                    fail(
                      `${label} tidak valid.`
                    );
                  }

                  if (
                    ![
                      "klien",
                      "mtm"
                    ].includes(item.pic)
                  ) {
                    fail(
                      `${label}: pilih PIC Klien atau MTM.`
                    );
                  }

                  const row = {
                    id:
                      identity(item.id),

                    module:
                      text(
                        item.module,
                        `${label}: nama pekerjaan`,
                        300,
                        true
                      ),

                    pic:
                      item.pic,

                    notes:
                      text(
                        item.notes ?? "",
                        `${label}: catatan`,
                        2000
                      )
                  };

                  const dateFields = [
                    "targetStart",
                    "targetEnd",
                    "actualStart",
                    "actualEnd"
                  ];

                  for (
                    const name
                    of dateFields
                  ) {
                    const value =
                      item[name] ?? "";

                    if (
                      typeof value !== "string" ||
                      (
                        value &&
                        dateNumber(value) === null
                      )
                    ) {
                      fail(
                        `${label}: tanggal tidak valid.`
                      );
                    }

                    row[name] =
                      value;
                  }

                  const targetError =
                    dateError(
                      row.targetStart,
                      row.targetEnd
                    );

                  const actualError =
                    dateError(
                      row.actualStart,
                      row.actualEnd
                    );

                  if (targetError) {
                    fail(
                      `${label} — Target: ${targetError}`
                    );
                  }

                  if (actualError) {
                    fail(
                      `${label} — Aktual: ${actualError}`
                    );
                  }

                  return row;
                }
              )
          };
        });

      return {
        schemaVersion: 1,
        reportDate: input.reportDate,
        modules
      };
    }

    // ==================================================
    // TANGGAL HARI INI WIB
    // ==================================================

    function todayJakarta() {
      const parts =
        new Intl.DateTimeFormat(
          "en-GB",
          {
            timeZone: "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
          }
        ).formatToParts(
          new Date()
        );

      const get =
        type =>
          parts.find(
            part =>
              part.type === type
          ).value;

      return (
        `${get("year")}-` +
        `${get("month")}-` +
        `${get("day")}`
      );
    }

    return {
      dateNumber,
      difference,
      duration,
      dateError,
      rowStatus,
      calculate,
      validateDocument,
      todayJakarta
    };
  }
);


// ======================================================
// HALAMAN UPDATE PROGRESS
// ======================================================

(function () {
  "use strict";

  const Core =
    window.PortoproProgress;

  const $ =
    id =>
      document.getElementById(id);

  const form =
    $("progressForm");

  const fields =
    $("progressFields");

  const body =
    $("progressRows");

  if (
    !form ||
    !Core
  ) {
    return;
  }

  // ====================================================
  // DATA DAN ENDPOINT
  // ====================================================

  const id =
    new URLSearchParams(
      location.search
    ).get("id");

  const endpoint =
    `/api/proyek/${encodeURIComponent(
      id || ""
    )}/progress-modul`;

  let documentData = {
    schemaVersion: 1,
    reportDate: Core.todayJakarta(),
    modules: []
  };

  let picOptions = [];
  let version = 0;
  let draftKey = "";
  let dirty = false;
  let busy = false;

  // ====================================================
  // FORMAT DAN HELPER
  // ====================================================

  function percent(value) {
    return (
      new Intl.NumberFormat(
        "id-ID",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      ).format(value) + "%"
    );
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uid() {
    return (
      globalThis.crypto?.randomUUID?.() ||

      (
        `row-${Date.now().toString(36)}-` +
        Math.random()
          .toString(36)
          .slice(2)
      )
    );
  }

  function showMessage(
    text,
    kind = ""
  ) {
    const element =
      $("progressMessage");

    element.textContent =
      text;

    element.className =
      `progress-message ${kind}`;

    element.hidden =
      !text;
  }

  function markChanged() {
    dirty = true;

    $("saveState").textContent =
      "Ada perubahan yang belum disimpan ke server.";
  }

  // ====================================================
  // DATA MODUL DAN SUBMODUL BARU
  // ====================================================

  function emptyItem() {
    return {
      id: uid(),
      module: "",
      pic: "",
      targetStart: "",
      targetEnd: "",
      actualStart: "",
      actualEnd: "",
      notes: ""
    };
  }

  function newModule() {
    const next =
      documentData.modules.reduce(
        (max, group) =>
          Math.max(
            max,
            Number(group.no) || 0
          ),
        0
      ) + 1;

    return {
      id: uid(),
      no: next,
      module: "",
      items: [
        emptyItem()
      ]
    };
  }

  // ====================================================
  // HARI LAPORAN
  // ====================================================

  function setDay() {
    const time =
      Core.dateNumber(
        $("reportDate").value
      );

    $("reportDay").textContent =
      time === null

        ? "-"

        : new Intl.DateTimeFormat(
            "id-ID",
            {
              weekday: "long",
              timeZone: "UTC"
            }
          ).format(
            new Date(time)
          );
  }

  // ====================================================
  // INPUT TANGGAL DALAM TABEL
  // ====================================================

  function dateInput(
    item,
    field,
    label
  ) {
    return `
      <td>
        <input
          type="date"
          data-field="${field}"
          value="${esc(item[field])}"
          aria-label="${label}"
        >
      </td>
    `;
  }

  // ====================================================
  // RENDER MODUL DAN SUBMODUL
  // ====================================================

  function renderRows() {
    body.innerHTML =
      documentData.modules
        .map(group => `
          <tr
            class="module-row"
            data-group-id="${esc(group.id)}"
          >
            <td>
              <input
                type="number"
                min="1"
                step="1"
                data-field="no"
                value="${esc(group.no)}"
                aria-label="No modul utama"
                required
              >
            </td>

            <td class="sub-number">
              —
            </td>

            <td colspan="13">
              <div class="progress-module-tools">
                <input
                  type="text"
                  data-field="module"
                  value="${esc(group.module)}"
                  placeholder="Nama modul utama"
                  aria-label="Nama modul utama"
                  maxlength="300"
                  required
                >

                <button
                  type="button"
                  class="progress-button secondary"
                  data-action="add-item"
                >
                  + Tambah Submodul
                </button>
              </div>
            </td>

            <td class="progress-actions">
              <button
                type="button"
                class="progress-button danger"
                data-action="remove-module"
              >
                Hapus
              </button>
            </td>
          </tr>

          ${
            group.items.map(item => `
              <tr data-item-id="${esc(item.id)}">
                <td></td>

                <td
                  class="sub-number"
                  data-output="subNo"
                ></td>

                <td>
                  <textarea
                    data-field="module"
                    aria-label="Nama submodul"
                    placeholder="Nama submodul / pekerjaan"
                    maxlength="300"
                    required
                  >${esc(item.module)}</textarea>
                </td>

                <td>
                  <select
                    data-field="pic"
                    aria-label="PIC submodul"
                    required
                  >
                    <option value="">
                      Pilih PIC
                    </option>

                    ${
                      picOptions.map(option => `
                        <option
                          value="${esc(option.value)}"
                          ${
                            option.value === item.pic
                              ? "selected"
                              : ""
                          }
                        >
                          ${esc(option.label)}
                        </option>
                      `).join("")
                    }
                  </select>
                </td>

                <td>
                  <span
                    class="progress-status"
                    data-output="status"
                  ></span>
                </td>

                ${
                  dateInput(
                    item,
                    "targetStart",
                    "Tanggal mulai target"
                  )
                }

                ${
                  dateInput(
                    item,
                    "targetEnd",
                    "Tanggal akhir target"
                  )
                }

                <td
                  class="computed"
                  data-output="targetDuration"
                ></td>

                <td
                  class="computed"
                  data-output="targetWeight"
                ></td>

                ${
                  dateInput(
                    item,
                    "actualStart",
                    "Tanggal mulai aktual"
                  )
                }

                ${
                  dateInput(
                    item,
                    "actualEnd",
                    "Tanggal akhir aktual"
                  )
                }

                <td
                  class="computed"
                  data-output="actualDuration"
                ></td>

                <td
                  class="computed"
                  data-output="actualWeight"
                ></td>

                <td class="computed" data-output="progressWeight"></td>

                <td>
                  <textarea
                    data-field="notes"
                    aria-label="Catatan submodul"
                    placeholder="Catatan yang bisa diedit"
                    maxlength="2000"
                  >${esc(item.notes)}</textarea>

                  <div
                    class="progress-notices"
                    data-output="notices"
                  ></div>
                </td>

                <td class="progress-actions">
                  <button
                    type="button"
                    class="progress-button danger"
                    data-action="remove-item"
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            `).join("")
          }
        `)
        .join("") ||

      `
        <tr>
          <td
            colspan="15"
            class="progress-empty"
          >
            Belum ada modul.
            Klik + Tambah Modul Utama.
          </td>
        </tr>
      `;

    recalculate();
  }



  // ====================================================
  // HITUNG ULANG DAN PERBARUI TAMPILAN
  // ====================================================

  function recalculate() {
    const computed =
      Core.calculate(
        documentData
      );
    
    const values =
      new Map(
        computed.modules
          .flatMap(
            group => group.items
          )
          .map(item => [
            item.id,
            item
          ])
      );

    body
      .querySelectorAll(
        "[data-item-id]"
      )
      .forEach(row => {
        const item =
          values.get(
            row.dataset.itemId
          );

        const textFields = [
          "subNo",
          "targetDuration",
          "actualDuration"
        ];

        for (
          const name
          of textFields
        ) {
          row.querySelector(
            `[data-output="${name}"]`
          ).textContent =
            item[name] ?? "-";
        }

        for (const name of [
            "targetWeight",
            "actualWeight",
            "progressWeight"
          ]) {
            row.querySelector(
              `[data-output="${name}"]`
            ).textContent = percent(item[name]);
          }

        const status =
          row.querySelector(
            '[data-output="status"]'
          );

        const statusClasses = {
          "Not Yet":
            "not-yet",

          "In Progress":
            "in-progress",

          "Done":
            "done"
        };

        status.textContent =
          item.status;

        status.className =
          "progress-status " +
          (
            statusClasses[item.status] ||
            "invalid"
          );

        const targetError =
          Core.dateError(
            item.targetStart,
            item.targetEnd
          );

        const actualError =
          Core.dateError(
            item.actualStart,
            item.actualEnd
          );

        row.querySelector(
          '[data-field="targetEnd"]'
        ).setCustomValidity(
          targetError
        );

        row.querySelector(
          '[data-field="actualEnd"]'
        ).setCustomValidity(
          actualError
        );

        const notices =
          item.notices
            .map(note =>
              `<p>${esc(note)}</p>`
            )
            .join("");

        row.querySelector(
          '[data-output="notices"]'
        ).innerHTML =
          notices +

          (
            targetError
              ? `
                <p class="date-error">
                  Target: ${esc(targetError)}
                </p>
              `
              : ""
          ) +

          (
            actualError
              ? `
                <p class="date-error">
                  Aktual: ${esc(actualError)}
                </p>
              `
              : ""
          );
      });

    const summary =
      computed.summary;

    $("totalTargetDuration").textContent =
      `${summary.totalTargetDuration} hari`;

    $("totalActualDuration").textContent =
      `${summary.totalActualDuration} hari`;

    $("totalTargetWeight").textContent =
      `Bobot ${percent(
        summary.totalTargetWeight
      )}`;

    $("totalActual").textContent =
      `Bobot ${percent(
        summary.totalActualWeight
      )}`;

    $("completedItems").textContent =
      `${summary.completedCount} / ${summary.itemCount}`;
    $("totalProgress").textContent =
      percent(summary.totalProgress);

    $("footerProgressWeight").textContent =
      percent(summary.totalProgress);

    $("footerTargetDuration").textContent =
      summary.totalTargetDuration;

    $("footerActualDuration").textContent =
      summary.totalActualDuration;

    $("footerTargetWeight").textContent =
      percent(
        summary.totalTargetWeight
      );

    $("footerActualWeight").textContent =
      percent(
        summary.totalActualWeight
      );
  }

  // ====================================================
  // PERUBAHAN INPUT TABEL
  // ====================================================

  function updateField(event) {
    const field =
      event.target.dataset.field;

    const row =
      event.target.closest("tr");

    if (
      !field ||
      !row
    ) {
      return;
    }

    let data;

    if (
      row.dataset.groupId
    ) {
      data =
        documentData.modules.find(
          group =>
            group.id ===
            row.dataset.groupId
        );

    } else {
      data =
        documentData.modules
          .flatMap(
            group => group.items
          )
          .find(
            item =>
              item.id ===
              row.dataset.itemId
          );
    }

    if (!data) {
      return;
    }

    if (field === "no") {
      data[field] =
        event.target.value === ""
          ? ""
          : Number(
              event.target.value
            );

    } else {
      data[field] =
        event.target.value;
    }

    markChanged();

    recalculate();
  }

  body.addEventListener(
    "input",
    updateField
  );

  body.addEventListener(
    "change",
    updateField
  );

  // ====================================================
  // TAMBAH DAN HAPUS SUBMODUL / MODUL
  // ====================================================

  body.addEventListener(
    "click",
    event => {
      const button =
        event.target.closest(
          "button[data-action]"
        );

      if (
        !button ||
        busy
      ) {
        return;
      }

      const row =
        button.closest("tr");

      const group =
        documentData.modules.find(
          value =>
            value.id ===
              row.dataset.groupId ||

            value.items.some(
              item =>
                item.id ===
                row.dataset.itemId
            )
        );

      if (!group) {
        return;
      }

      const action =
        button.dataset.action;

      if (
        action === "add-item"
      ) {
        group.items.push(
          emptyItem()
        );
      }

      if (
        action === "remove-module"
      ) {
        const confirmed =
          confirm(
            `Hapus modul ${group.no} beserta ${group.items.length} submodulnya? Perubahan berlaku setelah Simpan Progress.`
          );

        if (!confirmed) {
          return;
        }

        documentData.modules =
          documentData.modules.filter(
            value =>
              value.id !== group.id
          );
      }

      if (
        action === "remove-item"
      ) {
        const confirmed =
          confirm(
            "Hapus submodul ini? Perubahan berlaku setelah Simpan Progress."
          );

        if (!confirmed) {
          return;
        }

        group.items =
          group.items.filter(
            item =>
              item.id !==
              row.dataset.itemId
          );
      }

      markChanged();

      renderRows();
    }
  );

  $("addModule").addEventListener(
    "click",
    () => {
      documentData.modules.push(
        newModule()
      );

      markChanged();

      renderRows();
    }
  );

  $("reportDate").addEventListener(
    "input",
    () => {
      documentData.reportDate =
        $("reportDate").value;

      setDay();

      markChanged();
    }
  );

  // ====================================================
  // REQUEST JSON
  // ====================================================

  async function jsonRequest(
    options
  ) {
    const response =
      await fetch(
        endpoint,
        {
          credentials:
            "same-origin",

          cache:
            "no-store",

          ...options,

          headers: {
            Accept:
              "application/json",

            ...(
              options?.headers ||
              {}
            )
          }
        }
      );

    if (
      response.status === 401
    ) {
      location.assign(
        "/login.html"
      );

      throw new Error(
        "Sesi berakhir. Silakan login kembali."
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
      throw new Error(
        "Endpoint progress-modul belum mengembalikan JSON. Periksa pemasangan progress-routes.js."
      );
    }

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal memproses progress."
      );
    }

    return result;
  }

  // ====================================================
  // BACA DAN TAMPILKAN INFORMASI DRAFT
  // ====================================================

  function readDraft() {
    try {
      if (!draftKey) {
        return null;
      }

      return JSON.parse(
        localStorage.getItem(
          draftKey
        ) || "null"
      );

    } catch {
      return null;
    }
  }

  function showDraft() {
    const draft =
      readDraft();

    $("draftNotice").hidden =
      !draft;

    if (!draft) {
      return;
    }

    const stale =
      draft.version !== version;

    $("draftText").textContent =
      stale

        ? "Draft berasal dari versi server yang berbeda. Unduh draft untuk membandingkannya dengan data terbaru."

        : "Ada draft tersimpan di perangkat ini. Pulihkan untuk melanjutkan perubahan.";

    $("restoreDraft").disabled =
      stale;
  }

  // ====================================================
  // MASUKKAN DATA SERVER / DRAFT KE FORM
  // ====================================================

  function applyDocument(data) {
    documentData = {
      schemaVersion: 1,

      reportDate:
        data.reportDate,

      modules:
        data.modules.map(group => ({
          id:
            group.id,

          no:
            group.no,

          module:
            group.module,

          items:
            group.items.map(item => ({
              id:
                item.id,

              module:
                item.module,

              pic:
                item.pic,

              targetStart:
                item.targetStart || "",

              targetEnd:
                item.targetEnd || "",

              actualStart:
                item.actualStart || "",

              actualEnd:
                item.actualEnd || "",

              notes:
                item.notes || ""
            }))
        }))
    };

    $("reportDate").value =
      documentData.reportDate;

    setDay();

    renderRows();
  }

  // ====================================================
  // SIMPAN DRAFT
  // ====================================================

  $("saveDraft").addEventListener(
    "click",
    () => {
      try {
        localStorage.setItem(
          draftKey,

          JSON.stringify({
            version,

            data:
              documentData,

            savedAt:
              new Date().toISOString()
          })
        );

        showDraft();

        showMessage(
          "Draft tersimpan di perangkat ini. Klik Simpan Progress untuk memperbarui detail proyek.",
          "success"
        );

      } catch {
        showMessage(
          "Draft tidak dapat disimpan di browser ini.",
          "error"
        );
      }
    }
  );

  // ====================================================
  // PULIHKAN DRAFT
  // ====================================================

  $("restoreDraft").addEventListener(
    "click",
    () => {
      const draft =
        readDraft();

      if (
        !draft ||
        draft.version !== version
      ) {
        return;
      }

      if (
        dirty &&
        !confirm(
          "Ganti perubahan yang sedang tampil dengan draft?"
        )
      ) {
        return;
      }

      try {
        applyDocument(
          draft.data
        );

        markChanged();

        showMessage(
          "Draft dipulihkan. Klik Simpan Progress untuk menyimpannya ke server."
        );

      } catch {
        showMessage(
          "Draft tidak dapat dibaca. Unduh draft untuk memeriksa isinya.",
          "error"
        );
      }
    }
  );

  // ====================================================
  // UNDUH DRAFT
  // ====================================================

  $("downloadDraft").addEventListener(
    "click",
    () => {
      const draft =
        readDraft();

      if (!draft) {
        return;
      }

      const blob =
        new Blob(
          [
            JSON.stringify(
              draft,
              null,
              2
            )
          ],
          {
            type:
              "application/json"
          }
        );

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        `progress-draft-${id}.json`;

      link.click();

      setTimeout(
        () => {
          URL.revokeObjectURL(
            url
          );
        },
        1000
      );
    }
  );

  // ====================================================
  // HAPUS DRAFT
  // ====================================================

  $("discardDraft").addEventListener(
    "click",
    () => {
      const confirmed =
        confirm(
          "Hapus draft lokal? Data progress di server tetap tersedia."
        );

      if (!confirmed) {
        return;
      }

      try {
        localStorage.removeItem(
          draftKey
        );

        showDraft();

      } catch {
        showMessage(
          "Draft tidak dapat dihapus dari browser ini.",
          "error"
        );
      }
    }
  );

  // ====================================================
  // SIMPAN PROGRESS KE SERVER
  // ====================================================

  form.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      if (busy) {
        return;
      }

      try {
        recalculate();

        if (
          !form.reportValidity()
        ) {
          return;
        }

        const payload =
          Core.validateDocument(
            documentData
          );

        busy = true;

        fields.disabled =
          true;

        $("submitReport").textContent =
          "Menyimpan...";

        const result =
          await jsonRequest({
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                ...payload,
                version
              })
          });

        version =
          result.version;

        applyDocument(
          result.data
        );

        dirty = false;

        $("saveState").textContent =
          "Semua perubahan sudah tersimpan di server.";

        try {
          localStorage.removeItem(
            draftKey
          );

          localStorage.setItem(
            `portopro-progress-saved:${id}`,
            String(
              Date.now()
            )
          );

        } catch {
          // Data utama sudah tersimpan di server.
        }

        showDraft();

        showMessage(
          result.message,
          "success"
        );

      } catch (error) {
        showMessage(
          error.message,
          "error"
        );

      } finally {
        busy = false;

        fields.disabled =
          false;

        $("submitReport").textContent =
          "Simpan Progress";
      }
    }
  );

  // ====================================================
  // CETAK LAPORAN
  // ====================================================

  function preparePrint() {
    document
      .querySelectorAll(
        ".progress-print-value"
      )
      .forEach(element => {
        element.remove();
      });

    fields
      .querySelectorAll(
        "input, select, textarea"
      )
      .forEach(input => {
        const span =
          document.createElement(
            "span"
          );

        span.className =
          "progress-print-value";

        let text =
          input.tagName === "SELECT"

            ? input.selectedOptions[0]
                ?.textContent

            : input.value;

        if (
          input.type === "date" &&
          input.value
        ) {
          text =
            input.value
              .split("-")
              .reverse()
              .join("/");
        }

        span.textContent =
          text || "-";

        input.after(
          span
        );
      });
  }

  window.addEventListener(
    "beforeprint",
    preparePrint
  );

  $("printReport").addEventListener(
    "click",
    () => {
      preparePrint();

      window.print();
    }
  );

  // ====================================================
  // INGATKAN JIKA ADA PERUBAHAN BELUM DISIMPAN
  // ====================================================

  window.addEventListener(
    "beforeunload",
    event => {
      if (dirty) {
        event.preventDefault();

        event.returnValue =
          "";
      }
    }
  );

  // ====================================================
  // LOAD DATA AWAL
  // ====================================================

  async function initialize() {
    fields.disabled =
      true;

    $("retryProgress").hidden =
      true;

    showMessage(
      "Memuat progress proyek..."
    );

    try {
      if (
        !id ||
        !/^\d+$/.test(id) ||
        Number(id) <= 0
      ) {
        throw new Error(
          "ID proyek tidak valid. Buka halaman ini dari Detail Proyek."
        );
      }

      const result =
        await jsonRequest();

      version =
        result.version;

      picOptions =
        result.pic_options;

      draftKey =
        `portopro-progress-modul-draft:${result.user_id}:${id}`;

      $("timelineNamaProyek").textContent =
        result.proyek.nama_proyek;

      $("namaInstansi").textContent =
        result.proyek.nama_klien;

      $("backToProject").href =
        `/detail-proyek.html?id=${encodeURIComponent(
          id
        )}`;

        const timelineButton =
          $("timelineButton");

        if (timelineButton) {

          timelineButton.href =
            `/proyek-timeline.html?id=${encodeURIComponent(
              id
            )}`;

        }

      document.title =
        `Progress ${result.proyek.nama_proyek} - Portopro`;

      if (result.data) {
        applyDocument(
          result.data
        );

      } else {
        documentData = {
          schemaVersion: 1,

          reportDate:
            Core.todayJakarta(),

          modules: []
        };

        documentData.modules.push(
          newModule()
        );

        applyDocument(
          documentData
        );
      }

      dirty = false;

      fields.disabled =
        false;

      showDraft();

      $("saveState").textContent =
        result.data

          ? "Data tersimpan sudah dimuat."

          : "Belum ada progress tersimpan.";

      showMessage(
        result.data

          ? ""

          : "Isi modul utama, submodul, PIC, dan tanggal pekerjaan."
      );

    } catch (error) {
      showMessage(
        error.message,
        "error"
      );

      $("retryProgress").hidden =
        false;
    }
  }

  $("retryProgress").addEventListener(
    "click",
    initialize
  );

  // ====================================================
  // START
  // ====================================================

  initialize();

})();