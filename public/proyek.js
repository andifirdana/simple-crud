// ======================================================
// GLOBAL DATA
// ======================================================

let allProyek = [];

let currentPage = 1;

const itemsPerPage = 10;


// ======================================================
// ELEMENT
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


const statusFilter =
  document.getElementById(
    "statusFilter"
  );


// ======================================================
// FORMAT RUPIAH
// ======================================================

function formatRupiah(value) {

  const number =
    Number(value || 0);


  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(number);

}


// ======================================================
// FORMAT TANGGAL
// ======================================================

function formatTanggal(value) {

  if (!value) {
    return "-";
  }


  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  ).format(
    new Date(value)
  );

}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHTML(value) {

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


// ======================================================
// AMBIL LIST KATEGORI
// ======================================================

function getKategoriList(item) {

  if (
    Array.isArray(
      item.nama_kategori_produk_list
    ) &&
    item.nama_kategori_produk_list
      .length > 0
  ) {

    return item
      .nama_kategori_produk_list
      .filter(Boolean);

  }


  if (
    item.nama_kategori_produk
  ) {

    return [
      item.nama_kategori_produk
    ];

  }


  return [];

}


// ======================================================
// LOAD PROYEK
// ======================================================

async function loadProyek() {

  try {

    const response =
      await fetch(
        "/api/proyek"
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
        `Server bukan JSON: ${text}`
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


    allProyek =
      Array.isArray(result)
        ? result
        : [];


    buildKategoriFilter();


    updateSummary();


    currentPage = 1;


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

          Gagal mengambil data proyek.

        </td>

      </tr>

    `;

  }

}


// ======================================================
// BUILD FILTER KATEGORI
// ======================================================

function buildKategoriFilter() {

  const currentValue =
    kategoriFilter.value;


  const kategori =
    [
      ...new Set(

        allProyek.flatMap(
          item =>
            getKategoriList(item)
        )

      )
    ]
      .filter(Boolean)
      .sort(
        (a, b) =>
          String(a)
            .localeCompare(
              String(b),
              "id"
            )
      );


  kategoriFilter.innerHTML = `

    <option value="">
      Semua Kategori
    </option>

  `;


  kategori.forEach(
    item => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        item;


      option.textContent =
        item;


      kategoriFilter.appendChild(
        option
      );

    }
  );


  if (
    kategori.includes(
      currentValue
    )
  ) {

    kategoriFilter.value =
      currentValue;

  }

}


// ======================================================
// SUMMARY
// ======================================================

function updateSummary() {

  const total =
    allProyek.length;


  const aktif =
    allProyek.filter(
      item =>
        item.status_final ===
        "Aktif"
    ).length;


  const done =
    allProyek.filter(
      item =>
        item.status_final ===
        "Done"
    ).length;


  const totalNilai =
    allProyek.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.nilai_final_klien ||
          0
        ),
      0
    );


  const totalProyekElement =
    document.getElementById(
      "totalProyek"
    );


  const totalAktifElement =
    document.getElementById(
      "totalAktif"
    );


  const totalDoneElement =
    document.getElementById(
      "totalDone"
    );


  const totalNilaiElement =
    document.getElementById(
      "totalNilai"
    );


  if (totalProyekElement) {

    totalProyekElement.textContent =
      total;

  }


  if (totalAktifElement) {

    totalAktifElement.textContent =
      aktif;

  }


  if (totalDoneElement) {

    totalDoneElement.textContent =
      done;

  }


  if (totalNilaiElement) {

    totalNilaiElement.textContent =
      formatRupiah(
        totalNilai
      );

  }

}


// ======================================================
// PAGINATION
// ======================================================

function renderProyekPagination(
  data
) {

  const totalPages =
    Math.ceil(
      data.length /
      itemsPerPage
    );


  if (
    totalPages === 0
  ) {

    currentPage = 1;

  }


  if (
    totalPages > 0 &&
    currentPage > totalPages
  ) {

    currentPage =
      totalPages;

  }


  const start =
    (
      currentPage - 1
    ) *
    itemsPerPage;


  const end =
    start +
    itemsPerPage;


  const pageData =
    data.slice(
      start,
      end
    );


  renderTable(
    pageData
  );


  createPagination({

    containerId:
      "pagination",

    currentPage,

    totalItems:
      data.length,

    itemsPerPage,

    onPageChange:
      page => {

        currentPage =
          page;


        applyFilter();

      }

  });

}


// ======================================================
// FILTER
// ======================================================

function applyFilter() {

  const search =
    searchInput
      .value
      .trim()
      .toLowerCase();


  const kategori =
    kategoriFilter.value;


  const jenis =
    jenisFilter.value;


  const status =
    statusFilter.value;


  const filtered =
    allProyek.filter(
      item => {

        const kategoriList =
          getKategoriList(
            item
          );


        const kategoriText =
          kategoriList
            .join(" ");


        const text = `

          ${item.nama_proyek || ""}

          ${item.perusahaan_klien || ""}

          ${kategoriText}

          ${item.jenis_proyek || ""}

          ${item.sub_jenis_proyek || ""}

          ${item.nama_partner || ""}

          ${item.status_final || ""}

        `.toLowerCase();


        const matchSearch =
          !search ||
          text.includes(
            search
          );


        const matchKategori =
          !kategori ||
          kategoriList.includes(
            kategori
          );


        const matchJenis =
          !jenis ||
          item.jenis_proyek ===
            jenis;


        const matchStatus =
          !status ||
          item.status_final ===
            status;


        return (
          matchSearch &&
          matchKategori &&
          matchJenis &&
          matchStatus
        );

      }
    );


  renderProyekPagination(
    filtered
  );

}


// ======================================================
// RENDER TABLE
// ======================================================

function renderTable(data) {

  proyekTable.innerHTML =
    "";


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


  data.forEach(
    item => {

      const row =
        document.createElement(
          "tr"
        );


      const statusClass =
        item.status_final ===
        "Done"
          ? "badge-done"

          : item.status_final ===
            "Cancel"
            ? "badge-cancel"

            : "badge-aktif";


      const jenisText =
        item.sub_jenis_proyek
          ? `

              ${escapeHTML(
                item.jenis_proyek ||
                "-"
              )}

              <div
                class="sub-text"
              >

                ${escapeHTML(
                  item.sub_jenis_proyek
                )}

              </div>

            `

          : escapeHTML(
              item.jenis_proyek ||
              "-"
            );


      const kategoriList =
        getKategoriList(
          item
        );


      const kategoriText =
        kategoriList.length > 0
          ? kategoriList
              .map(
                escapeHTML
              )
              .join(", ")
          : "-";


      row.innerHTML = `

        <td>

          ${escapeHTML(
            item.id
          )}

        </td>


        <td>

          <div
            class="project-name"
          >

            ${escapeHTML(
              item.nama_proyek ||
              "-"
            )}

          </div>

        </td>


        <td>

          ${kategoriText}

        </td>


        <td>

          ${jenisText}

        </td>


        <td>

          ${escapeHTML(
            item.perusahaan_klien ||
            "-"
          )}

        </td>


        <td
          class="money"
        >

          ${formatRupiah(
            item.nilai_final_klien
          )}

        </td>


        <td>

          ${escapeHTML(
            item.nama_partner ||
            "-"
          )}

        </td>


        <td
          class="money"
        >

          ${formatRupiah(
            item.nilai_partner ||
            0
          )}

        </td>


        <td
          class="money"
        >

          ${formatRupiah(
            item.margin ||
            0
          )}

        </td>


        <td>

          <span
            class="
              badge
              ${statusClass}
            "
          >

            ${escapeHTML(
              item.status_final ||
              "-"
            )}

          </span>

        </td>


        <td>

          ${formatTanggal(
            item.created_at
          )}

        </td>


        <td>

          <div
            class="action-buttons"
          >

            <a
              class="
                btn
                btn-secondary
              "
              href="/detail-proyek.html?id=${encodeURIComponent(
                item.id
              )}"
            >

              Detail

            </a>

          </div>

        </td>

      `;


      proyekTable.appendChild(
        row
      );

    }
  );

}


// ======================================================
// RESET PAGE + FILTER
// ======================================================

function resetPageAndFilter() {

  currentPage = 1;


  applyFilter();

}


// ======================================================
// EVENT FILTER
// ======================================================

searchInput.addEventListener(
  "input",
  resetPageAndFilter
);


kategoriFilter.addEventListener(
  "change",
  resetPageAndFilter
);


jenisFilter.addEventListener(
  "change",
  resetPageAndFilter
);


statusFilter.addEventListener(
  "change",
  resetPageAndFilter
);


// ======================================================
// LOAD PROJECT TASK
// ======================================================

async function loadProjectTask() {

  const projectTaskBody =
    document.getElementById(
      "projectTaskBody"
    );


  if (!projectTaskBody) {

    return;

  }


  const params =
    new URLSearchParams(
      window.location.search
    );


  const proyekId =
    params.get("id");


  if (!proyekId) {

    projectTaskBody.innerHTML = `

      <tr>

        <td colspan="8">

          Proyek tidak ditemukan.

        </td>

      </tr>

    `;


    return;

  }


  try {

    const response =
      await fetch(
        `/api/proyek/${proyekId}/task-list`
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gagal mengambil task"
      );

    }


    if (
      data.length === 0
    ) {

      projectTaskBody.innerHTML = `

        <tr>

          <td
            colspan="8"
            style="
              text-align:center;
              padding:30px;
              color:#64748b;
            "
          >

            Belum ada task pada proyek ini.

          </td>

        </tr>

      `;


      return;

    }


    projectTaskBody.innerHTML =
      data.map(
        item => {

          const statusClass =
            String(
              item.status ||
              ""
            )
              .toLowerCase()
              .replaceAll(
                " ",
                "-"
              );


          return `

            <tr>

              <td>

                <div
                  class="task-pic-name"
                >

                  ${escapeHTML(
                    item.nama_pic ||
                    "-"
                  )}

                </div>

              </td>


              <td>

                <strong>

                  ${escapeHTML(
                    item.task ||
                    "-"
                  )}

                </strong>

              </td>


              <td>

                <div
                  class="task-note-preview"
                  title="${escapeHTML(
                    item.catatan ||
                    ""
                  )}"
                >

                  ${escapeHTML(
                    item.catatan ||
                    "-"
                  )}

                </div>

              </td>


              <td>

                <span
                  class="
                    task-status
                    task-status-${escapeHTML(
                      statusClass
                    )}
                  "
                >

                  ${escapeHTML(
                    item.status ||
                    "-"
                  )}

                </span>

              </td>


              <td>

                ${formatProjectTaskDate(
                  item.tanggal_mulai
                )}

              </td>


              <td>

                ${formatProjectTaskDate(
                  item.target_date
                )}

              </td>


              <td>

                ${formatProjectTaskDate(
                  item.tanggal_selesai
                )}

              </td>


              <td>

                ${formatProjectTaskDateTime(
                  item.created_at
                )}

              </td>

            </tr>

          `;

        }
      )
      .join("");


  } catch (error) {

    console.error(
      "ERROR LOAD PROJECT TASK:",
      error
    );


    projectTaskBody.innerHTML = `

      <tr>

        <td colspan="8">

          Gagal mengambil task.

        </td>

      </tr>

    `;

  }

}


// ======================================================
// FORMAT PROJECT TASK DATE
// ======================================================

function formatProjectTaskDate(
  value
) {

  if (!value) {

    return "-";

  }


  return new Date(
    value
  )
    .toLocaleDateString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }
    );

}


// ======================================================
// FORMAT PROJECT TASK DATE TIME
// ======================================================

function formatProjectTaskDateTime(
  value
) {

  if (!value) {

    return "-";

  }


  return new Date(
    value
  )
    .toLocaleString(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    );

}


// ======================================================
// LOGOUT
// ======================================================

async function logout() {

  try {

    const response =
      await fetch(
        "/api/logout",
        {
          method: "POST"
        }
      );


    if (!response.ok) {

      const result =
        await response.json();


      throw new Error(
        result.error ||
        "Gagal logout"
      );

    }


    window.location.href =
      "/login.html";


  } catch (error) {

    console.error(
      "ERROR LOGOUT:",
      error
    );


    alert(
      "Gagal logout"
    );

  }

}


// ======================================================
// START
// ======================================================

loadProyek();