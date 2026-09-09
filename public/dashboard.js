// ======================================================
// DASHBOARD
// ======================================================

let dashboardData = null;


// ======================================================
// FORMAT RUPIAH
// ======================================================

function formatRupiah(value) {

  const number = Number(value) || 0;

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

  if (!value) return "-";

  const date = new Date(value);

  if (isNaN(date.getTime())) {
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

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// ======================================================
// LOAD DASHBOARD
// ======================================================

async function loadDashboard() {

  try {

    const response =
      await fetch("/api/dashboard");

    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal mengambil dashboard"
      );

    }


    console.log(
      "DATA DASHBOARD:",
      result
    );


    dashboardData = result;


    renderFilterOptions();

    applyFilters();

    renderKontrakKlien(
      result.kontrak_klien_jatuh_tempo || []
    );

    renderKontrakPartner(
      result.kontrak_partner_jatuh_tempo || []
    );


  } catch (error) {

    console.error(
      "ERROR FETCH DASHBOARD:",
      error
    );

  }

}


// ======================================================
// FILTER OPTIONS
// ======================================================

function renderFilterOptions() {

  if (!dashboardData) return;


  const proyek =
    dashboardData.proyek || [];


  // ====================================================
  // FILTER TAHUN
  // ====================================================

  const tahunSet =
    new Set();


  proyek.forEach(item => {

    if (item.tanggal_mulai) {

      const tahun =
        new Date(
          item.tanggal_mulai
        ).getFullYear();

      if (!isNaN(tahun)) {
        tahunSet.add(tahun);
      }

    }


    if (item.tanggal_akhir) {

      const tahun =
        new Date(
          item.tanggal_akhir
        ).getFullYear();

      if (!isNaN(tahun)) {
        tahunSet.add(tahun);
      }

    }

  });


  const filterTahun =
    document.getElementById(
      "filterTahun"
    );


  if (filterTahun) {

    const tahunList =
      Array.from(tahunSet)
        .sort((a, b) => b - a);


    filterTahun.innerHTML = `
      <option value="">
        Semua Tahun
      </option>

      ${tahunList.map(tahun => `
        <option value="${tahun}">
          ${tahun}
        </option>
      `).join("")}
    `;

  }


  // ====================================================
  // FILTER PIC
  // ====================================================

  const picMap =
    new Map();


  proyek.forEach(item => {

    const picList =
      Array.isArray(item.pic)
        ? item.pic
        : [];


    picList.forEach(pic => {

      if (
        pic.id !== undefined &&
        pic.nama_pic
      ) {

        picMap.set(
          String(pic.id),
          pic.nama_pic
        );

      }

    });

  });


  const filterPic =
    document.getElementById(
      "filterPic"
    );


  if (filterPic) {

    const picList =
      Array.from(
        picMap.entries()
      ).sort(
        (a, b) =>
          a[1].localeCompare(
            b[1],
            "id"
          )
      );


    filterPic.innerHTML = `
      <option value="">
        Semua PIC
      </option>

      ${picList.map(
        ([id, nama]) => `
          <option value="${id}">
            ${escapeHtml(nama)}
          </option>
        `
      ).join("")}
    `;

  }

}


// ======================================================
// APPLY FILTER
// ======================================================

function applyFilters() {

  if (!dashboardData) return;


  const searchElement =
    document.getElementById(
      "searchProyek"
    );

  const bulanElement =
    document.getElementById(
      "filterBulan"
    );

  const tahunElement =
    document.getElementById(
      "filterTahun"
    );

  const picElement =
    document.getElementById(
      "filterPic"
    );


  const search =
    searchElement
      ? searchElement.value
          .trim()
          .toLowerCase()
      : "";


  const bulan =
    bulanElement
      ? bulanElement.value
      : "";


  const tahun =
    tahunElement
      ? tahunElement.value
      : "";


  const picId =
    picElement
      ? picElement.value
      : "";


  const proyek =
    dashboardData.proyek || [];


  const filtered =
    proyek.filter(item => {


      // ==================================================
      // SEARCH
      // ==================================================

      if (search) {

        const namaProyek =
          String(
            item.nama_proyek || ""
          ).toLowerCase();


        const namaKlien =
          String(
            item.nama_klien || ""
          ).toLowerCase();


        if (
          !namaProyek.includes(search) &&
          !namaKlien.includes(search)
        ) {

          return false;

        }

      }


      // ==================================================
      // FILTER PIC
      // ==================================================

      if (picId) {

        const picIds =
          Array.isArray(item.pic)
            ? item.pic.map(
                pic =>
                  String(pic.id)
              )
            : [];


        if (
          !picIds.includes(
            String(picId)
          )
        ) {

          return false;

        }

      }


      // ==================================================
      // FILTER TANGGAL
      // ==================================================

      if (bulan || tahun) {

        if (
          !item.tanggal_mulai ||
          !item.tanggal_akhir
        ) {

          return false;

        }


        const mulai =
          new Date(
            item.tanggal_mulai
          );


        const akhir =
          new Date(
            item.tanggal_akhir
          );


        let periodeMulai;
        let periodeAkhir;


        // Bulan + Tahun
        if (bulan && tahun) {

          periodeMulai =
            new Date(
              Number(tahun),
              Number(bulan) - 1,
              1
            );


          periodeAkhir =
            new Date(
              Number(tahun),
              Number(bulan),
              0,
              23,
              59,
              59
            );

        }


        // Hanya Tahun
        else if (tahun) {

          periodeMulai =
            new Date(
              Number(tahun),
              0,
              1
            );


          periodeAkhir =
            new Date(
              Number(tahun),
              11,
              31,
              23,
              59,
              59
            );

        }


        // Hanya Bulan
        else {

          const tahunSekarang =
            new Date().getFullYear();


          periodeMulai =
            new Date(
              tahunSekarang,
              Number(bulan) - 1,
              1
            );


          periodeAkhir =
            new Date(
              tahunSekarang,
              Number(bulan),
              0,
              23,
              59,
              59
            );

        }


        // Cek overlap kontrak
        if (
          mulai > periodeAkhir ||
          akhir < periodeMulai
        ) {

          return false;

        }

      }


      return true;

    });


  renderProjectTable(filtered);

  renderKpi(filtered);

}


// ======================================================
// RENDER KPI
// ======================================================

function renderKpi(proyek) {

  let totalNilaiProyek = 0;

  let nilaiTertagihKlien = 0;

  let nilaiBelumTertagihKlien = 0;

  let nilaiTerbayarPartner = 0;

  let nilaiBelumTerbayarPartner = 0;


  proyek.forEach(item => {

    totalNilaiProyek +=
      Number(
        item.nilai_proyek
      ) || 0;


    nilaiTertagihKlien +=
      Number(
        item.nilai_tertagih_klien
      ) || 0;


    nilaiBelumTertagihKlien +=
      Number(
        item.nilai_belum_tertagih_klien
      ) || 0;


    nilaiTerbayarPartner +=
      Number(
        item.nilai_terbayar_partner
      ) || 0;


    nilaiBelumTerbayarPartner +=
      Number(
        item.nilai_belum_terbayar_partner
      ) || 0;

  });


  setText(
    "totalProyek",
    proyek.length
  );


  setText(
    "totalNilaiProyek",
    formatRupiah(
      totalNilaiProyek
    )
  );


  setText(
    "nilaiTertagihKlien",
    formatRupiah(
      nilaiTertagihKlien
    )
  );


  setText(
    "nilaiBelumTertagihKlien",
    formatRupiah(
      nilaiBelumTertagihKlien
    )
  );


  setText(
    "nilaiTerbayarPartner",
    formatRupiah(
      nilaiTerbayarPartner
    )
  );


  setText(
    "nilaiBelumTerbayarPartner",
    formatRupiah(
      nilaiBelumTerbayarPartner
    )
  );

}


// ======================================================
// HELPER SET TEXT
// ======================================================

function setText(id, value) {

  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }

}


// ======================================================
// RENDER PROJECT TABLE
// ======================================================

function renderProjectTable(proyek) {

  const tbody =
    document.getElementById(
      "projectTableBody"
    );


  if (!tbody) {
    return;
  }


  if (!proyek.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          Tidak ada proyek.
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML =
    proyek.map(
      (item, index) => {


        const picNama =
          Array.isArray(item.pic)
            ? item.pic
                .map(
                  pic =>
                    pic.nama_pic
                )
                .filter(Boolean)
                .join(", ")
            : "-";


        return `
          <tr>

            <td>
              ${index + 1}
            </td>

            <td>

              <a
                href="/detail-proyek.html?id=${item.id}"
                class="project-link"
              >
                ${escapeHtml(
                  item.nama_proyek || "-"
                )}
              </a>

            </td>

            <td>
              ${escapeHtml(
                item.nama_klien || "-"
              )}
            </td>

            <td>
              ${escapeHtml(
                picNama || "-"
              )}
            </td>

            <td>
              ${formatTanggal(
                item.tanggal_mulai
              )}
            </td>

            <td>
              ${formatTanggal(
                item.tanggal_akhir
              )}
            </td>

            <td>
              ${formatRupiah(
                item.nilai_proyek
              )}
            </td>

          </tr>
        `;

      }
    ).join("");

}


// ======================================================
// KONTRAK KLIEN
// ======================================================

function renderKontrakKlien(data) {

  const tbody =
    document.getElementById(
      "kontrakKlienBody"
    );


  if (!tbody) return;


  if (!data.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          Tidak ada kontrak klien
          yang akan jatuh tempo
          dalam 3 bulan.
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML =
    data.map(item => `

      <tr>

        <td>
          <a
            href="/detail-proyek.html?id=${item.proyek_id}"
            class="project-link"
          >
            ${escapeHtml(
              item.nama_proyek || "-"
            )}
          </a>
        </td>

        <td>
          ${escapeHtml(
            item.nama_klien || "-"
          )}
        </td>

        <td>
          ${formatTanggal(
            item.tanggal_akhir
          )}
        </td>

        <td>
          ${renderSisaWaktu(
            item.sisa_hari
          )}
        </td>

        <td>
          ${formatRupiah(
            item.nilai_final
          )}
        </td>

      </tr>

    `).join("");

}


// ======================================================
// KONTRAK PARTNER
// ======================================================

function renderKontrakPartner(data) {

  const tbody =
    document.getElementById(
      "kontrakPartnerBody"
    );


  if (!tbody) return;


  if (!data.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          Tidak ada kontrak partner
          yang akan jatuh tempo
          dalam 3 bulan.
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML =
    data.map(item => `

      <tr>

        <td>
          <a
            href="/detail-proyek.html?id=${item.proyek_id}"
            class="project-link"
          >
            ${escapeHtml(
              item.nama_proyek || "-"
            )}
          </a>
        </td>

        <td>
          ${escapeHtml(
            item.nama_partner || "-"
          )}
        </td>

        <td>
          ${formatTanggal(
            item.tanggal_akhir
          )}
        </td>

        <td>
          ${renderSisaWaktu(
            item.sisa_hari
          )}
        </td>

        <td>
          ${formatRupiah(
            item.nilai_final
          )}
        </td>

      </tr>

    `).join("");

}


// ======================================================
// SISA WAKTU
// ======================================================

function renderSisaWaktu(value) {

  const hari =
    Number(value);


  if (isNaN(hari)) {
    return "-";
  }


  if (hari === 0) {

    return `
      <span class="badge badge-danger">
        Hari ini
      </span>
    `;

  }


  if (hari < 0) {

    return `
      <span class="badge badge-danger">
        Sudah berakhir
      </span>
    `;

  }


  return `
    <span class="badge badge-warning">
      ${hari} hari lagi
    </span>
  `;

}


// ======================================================
// EVENT FILTER
// ======================================================

const searchProyek =
  document.getElementById(
    "searchProyek"
  );


if (searchProyek) {

  searchProyek.addEventListener(
    "input",
    applyFilters
  );

}


const filterBulan =
  document.getElementById(
    "filterBulan"
  );


if (filterBulan) {

  filterBulan.addEventListener(
    "change",
    applyFilters
  );

}


const filterTahun =
  document.getElementById(
    "filterTahun"
  );


if (filterTahun) {

  filterTahun.addEventListener(
    "change",
    applyFilters
  );

}


const filterPic =
  document.getElementById(
    "filterPic"
  );


if (filterPic) {

  filterPic.addEventListener(
    "change",
    applyFilters
  );

}


// ======================================================
// RESET FILTER
// ======================================================

const resetFilter =
  document.getElementById(
    "resetFilter"
  );


if (resetFilter) {

  resetFilter.addEventListener(
    "click",
    () => {

      if (searchProyek) {
        searchProyek.value = "";
      }

      if (filterBulan) {
        filterBulan.value = "";
      }

      if (filterTahun) {
        filterTahun.value = "";
      }

      if (filterPic) {
        filterPic.value = "";
      }

      applyFilters();

    }
  );

}
async function loadCurrentUser() {

  try {

    const response = await fetch("/api/me");

    if (!response.ok) {
      window.location.replace("/login.html");
      return;
    }

    const result = await response.json();

    document.getElementById("userNama").textContent =
      result.user.nama || "User";

    document.getElementById("userRole").textContent =
      result.user.role || "PIC";

  } catch (error) {

    console.error("ERROR USER:", error);

  }

}

loadCurrentUser();

const logoutButton =
  document.getElementById(
    "logoutButton"
  );

if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    async () => {

      try {

        const response =
          await fetch(
            "/api/logout",
            {
              method: "POST"
            }
          );

        const result =
          await response.json();


        if (!response.ok) {

          throw new Error(
            result.error ||
            "Logout gagal"
          );

        }


        // Logout berhasil
        // kembali ke login

        window.location.replace(
          "/login.html"
        );


      } catch (error) {

        console.error(
          "ERROR LOGOUT:",
          error
        );

        alert(
          error.message
        );

      }

    }
  );

}


// ======================================================
// START
// ======================================================

loadDashboard();