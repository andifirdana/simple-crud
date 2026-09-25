// =====================================================
// ACTIVITY LOG
// =====================================================

let activityData = [];


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHtml(value) {

  return String(
    value ?? ""
  )
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


// =====================================================
// FORMAT TANGGAL
// =====================================================

function formatTanggalWaktu(value) {

  if (!value) {

    return {
      tanggal: "-",
      waktu: "-"
    };

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return {
      tanggal: "-",
      waktu: "-"
    };

  }


  const tanggal =
    new Intl.DateTimeFormat(
      "id-ID",
      {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      }
    ).format(date);


  const waktu =
    new Intl.DateTimeFormat(
      "id-ID",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(date);


  return {
    tanggal,
    waktu
  };

}


// =====================================================
// FORMAT NILAI
// =====================================================

function formatNilai(
  value,
  fieldName
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return "-";

  }


  // ===========================================
  // FORMAT FIELD TANGGAL
  // ===========================================

  const tanggalFields = [
    "tanggal_mulai",
    "tanggal_akhir",
    "target_date",
    "tanggal_bayar",
    "tanggal_jatuh_tempo"
  ];


  if (
    tanggalFields.includes(
      fieldName
    )
  ) {

    const date =
      new Date(value);


    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {

      return new Intl.DateTimeFormat(
        "id-ID",
        {
          day: "2-digit",
          month: "long",
          year: "numeric"
        }
      ).format(date);

    }

  }


  return String(value);

}


// =====================================================
// INITIAL PIC
// =====================================================

function getInitial(name) {

  if (!name) {
    return "?";
  }


  const words =
    String(name)
      .trim()
      .split(/\s+/);


  if (
    words.length === 1
  ) {

    return words[0]
      .substring(
        0,
        2
      )
      .toUpperCase();

  }


  return (
    words[0][0] +
    words[1][0]
  ).toUpperCase();

}


// =====================================================
// LOAD DATA
// =====================================================

async function loadActivityLog() {

  const container =
    document.getElementById(
      "activityList"
    );


  container.innerHTML =
    `
      <div class="loading">
        Memuat activity log...
      </div>
    `;


  try {

    const response =
      await fetch(
        "/api/activity-log?limit=500"
      );


    if (!response.ok) {

      const result =
        await response.json()
          .catch(
            () => ({})
          );


      throw new Error(
        result.error ||
        "Gagal mengambil Activity Log"
      );

    }


    activityData =
      await response.json();


    if (
      !Array.isArray(
        activityData
      )
    ) {

      activityData = [];

    }


    isiFilter();


    applyFilter();


  } catch (error) {

    console.error(
      "ERROR ACTIVITY LOG:",
      error
    );


    container.innerHTML =
      `
        <div class="empty-state">
          ${escapeHtml(
            error.message
          )}
        </div>
      `;

  }

}


// =====================================================
// ISI FILTER
// =====================================================

function isiFilter() {

  const picSelect =
    document.getElementById(
      "filterPic"
    );


  const modulSelect =
    document.getElementById(
      "filterModul"
    );


  const currentPic =
    picSelect.value;


  const currentModul =
    modulSelect.value;


  // ===================================================
  // PIC
  // ===================================================

  const picMap =
    new Map();


  activityData.forEach(
    item => {

      if (
        item.pic_id &&
        item.nama_pic
      ) {

        picMap.set(
          String(item.pic_id),
          item.nama_pic
        );

      }

    }
  );


  picSelect.innerHTML =
    `
      <option value="">
        Semua PIC
      </option>
    `;


  [
    ...picMap.entries()
  ]
    .sort(
      (a, b) =>
        String(a[1])
          .localeCompare(
            String(b[1]),
            "id"
          )
    )
    .forEach(
      ([id, nama]) => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          id;


        option.textContent =
          nama;


        picSelect.appendChild(
          option
        );

      }
    );


  picSelect.value =
    currentPic;


  // ===================================================
  // MODUL
  // ===================================================

  const modules =
    [
      ...new Set(
        activityData
          .map(
            item =>
              item.modul
          )
          .filter(Boolean)
      )
    ].sort();


  modulSelect.innerHTML =
    `
      <option value="">
        Semua Modul
      </option>
    `;


  modules.forEach(
    modul => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        modul;


      option.textContent =
        formatModul(modul);


      modulSelect.appendChild(
        option
      );

    }
  );


  modulSelect.value =
    currentModul;

}


// =====================================================
// FORMAT MODUL
// =====================================================

function formatModul(value) {

  if (!value) {
    return "-";
  }


  return String(value)
    .replaceAll(
      "_",
      " "
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );

}


// =====================================================
// FILTER
// =====================================================

function applyFilter() {

  const search =
    document
      .getElementById(
        "searchActivity"
      )
      .value
      .trim()
      .toLowerCase();


  const pic =
    document
      .getElementById(
        "filterPic"
      )
      .value;


  const modul =
    document
      .getElementById(
        "filterModul"
      )
      .value;


  const aktivitas =
    document
      .getElementById(
        "filterAktivitas"
      )
      .value;


  const tanggal =
    document
      .getElementById(
        "filterTanggal"
      )
      .value;


  const filtered =
    activityData.filter(
      item => {

        // =========================================
        // SEARCH
        // =========================================

        if (search) {

          const searchable =
            [
              item.nama_pic,
              item.deskripsi,
              item.entity_nama,
              item.modul,
              item.aktivitas,
              item.field_name,
              item.nilai_lama,
              item.nilai_baru
            ]
              .filter(
                value =>
                  value !== null &&
                  value !== undefined
              )
              .join(" ")
              .toLowerCase();


          if (
            !searchable.includes(
              search
            )
          ) {

            return false;

          }

        }


        // =========================================
        // PIC
        // =========================================

        if (
          pic &&
          String(item.pic_id) !==
            String(pic)
        ) {

          return false;

        }


        // =========================================
        // MODUL
        // =========================================

        if (
          modul &&
          item.modul !== modul
        ) {

          return false;

        }


        // =========================================
        // ACTIVITY
        // =========================================

        if (
          aktivitas &&
          item.aktivitas !==
            aktivitas
        ) {

          return false;

        }


        // =========================================
        // TANGGAL
        // =========================================

        if (tanggal) {

          if (!item.created_at) {

            return false;

          }


          const logDate =
            new Date(
              item.created_at
            );


          const year =
            logDate.getFullYear();


          const month =
            String(
              logDate.getMonth() + 1
            ).padStart(
              2,
              "0"
            );


          const day =
            String(
              logDate.getDate()
            ).padStart(
              2,
              "0"
            );


          const localDate =
            `${year}-${month}-${day}`;


          if (
            localDate !== tanggal
          ) {

            return false;

          }

        }


        return true;

      }
    );


  renderActivity(
    filtered
  );


  updateSummary(
    filtered
  );

}


// =====================================================
// SUMMARY
// =====================================================

function updateSummary(data) {

  document.getElementById(
    "totalActivity"
  ).textContent =
    data.length;


  // ===================================================
  // HARI INI
  // ===================================================

  const today =
    new Date();


  const todayString =
    [
      today.getFullYear(),

      String(
        today.getMonth() + 1
      ).padStart(
        2,
        "0"
      ),

      String(
        today.getDate()
      ).padStart(
        2,
        "0"
      )

    ].join("-");


  const totalToday =
    data.filter(
      item => {

        if (!item.created_at) {
          return false;
        }


        const date =
          new Date(
            item.created_at
          );


        const dateString =
          [
            date.getFullYear(),

            String(
              date.getMonth() + 1
            ).padStart(
              2,
              "0"
            ),

            String(
              date.getDate()
            ).padStart(
              2,
              "0"
            )

          ].join("-");


        return (
          dateString ===
          todayString
        );

      }
    ).length;


  document.getElementById(
    "activityToday"
  ).textContent =
    totalToday;


  // ===================================================
  // PIC
  // ===================================================

  const pic =
    new Set(
      data
        .map(
          item =>
            item.pic_id
        )
        .filter(Boolean)
    );


  document.getElementById(
    "totalPic"
  ).textContent =
    pic.size;


  // ===================================================
  // UPDATE
  // ===================================================

  const update =
    data.filter(
      item =>
        item.aktivitas ===
        "UPDATE"
    ).length;


  document.getElementById(
    "totalUpdate"
  ).textContent =
    update;


  document.getElementById(
    "activityCount"
  ).textContent =
    `${data.length} aktivitas`;

}


// =====================================================
// RENDER ACTIVITY
// =====================================================

function renderActivity(data) {

  const container =
    document.getElementById(
      "activityList"
    );


  if (
    !data.length
  ) {

    container.innerHTML =
      `
        <div class="empty-state">
          Belum ada activity log.
        </div>
      `;


    return;

  }


  container.innerHTML =
    data
      .map(
        item => {

          const date =
            formatTanggalWaktu(
              item.created_at
            );


          const oldValue =
            formatNilai(
              item.nilai_lama,
              item.field_name
            );


          const newValue =
            formatNilai(
              item.nilai_baru,
              item.field_name
            );


          const showChange =
            item.aktivitas ===
              "UPDATE" &&
            (
              item.nilai_lama !==
                null ||
              item.nilai_baru !==
                null
            );


          let badgeClass = "";


          if (
            item.aktivitas ===
            "CREATE"
          ) {

            badgeClass =
              "badge-create";

          }


          if (
            item.aktivitas ===
            "UPDATE"
          ) {

            badgeClass =
              "badge-update";

          }


          if (
            item.aktivitas ===
            "DELETE"
          ) {

            badgeClass =
              "badge-delete";

          }


          return `
            <div class="activity-item">

              <!-- AVATAR -->

              <div>

                <div class="activity-avatar">

                  ${escapeHtml(
                    getInitial(
                      item.nama_pic
                    )
                  )}

                </div>

              </div>


              <!-- CONTENT -->

              <div>

                <div class="activity-user">

                  ${escapeHtml(
                    item.nama_pic ||
                    "Unknown User"
                  )}

                </div>


                <div class="activity-description">

                  ${escapeHtml(
                    item.deskripsi ||
                    "-"
                  )}

                  ${
                    item.entity_nama
                      ? `
                        <span class="entity-name">
                          ${escapeHtml(
                            item.entity_nama
                          )}
                        </span>
                      `
                      : ""
                  }

                </div>


                <div class="activity-meta">

                  <span
                    class="badge ${badgeClass}"
                  >
                    ${escapeHtml(
                      item.aktivitas
                    )}
                  </span>


                  <span class="badge">

                    ${escapeHtml(
                      formatModul(
                        item.modul
                      )
                    )}

                  </span>


                  ${
                    item.field_name
                      ? `
                        <span class="badge">
                          ${escapeHtml(
                            item.field_name
                          )}
                        </span>
                      `
                      : ""
                  }

                </div>


                ${
                  showChange
                    ? `
                      <div class="change-box">

                        <div class="change-value">

                          <span class="change-label">
                            Semula
                          </span>

                          <span class="change-text">
                            ${escapeHtml(
                              oldValue
                            )}
                          </span>

                        </div>


                        <div class="change-arrow">
                          →
                        </div>


                        <div class="change-value">

                          <span class="change-label">
                            Menjadi
                          </span>

                          <span class="change-text">
                            ${escapeHtml(
                              newValue
                            )}
                          </span>

                        </div>

                      </div>
                    `
                    : ""
                }

              </div>


              <!-- DATE -->

              <div class="activity-date">

                <strong>
                  ${escapeHtml(
                    date.tanggal
                  )}
                </strong>

                ${escapeHtml(
                  date.waktu
                )}

              </div>

            </div>
          `;

        }
      )
      .join("");

}


// =====================================================
// EVENT FILTER
// =====================================================

document
  .getElementById(
    "searchActivity"
  )
  ?.addEventListener(
    "input",
    applyFilter
  );


document
  .getElementById(
    "filterPic"
  )
  ?.addEventListener(
    "change",
    applyFilter
  );


document
  .getElementById(
    "filterModul"
  )
  ?.addEventListener(
    "change",
    applyFilter
  );


document
  .getElementById(
    "filterAktivitas"
  )
  ?.addEventListener(
    "change",
    applyFilter
  );


document
  .getElementById(
    "filterTanggal"
  )
  ?.addEventListener(
    "change",
    applyFilter
  );


document
  .getElementById(
    "btnRefresh"
  )
  ?.addEventListener(
    "click",
    loadActivityLog
  );


// =====================================================
// INITIALIZE
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    loadActivityLog();

  }
);