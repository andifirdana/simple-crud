// ======================================================
// MASTER KPI
// CRUD:
// TAMBAH, EDIT, HAPUS
// ======================================================

let allKpi = [];


// ======================================================
// ELEMENT
// ======================================================

const kpiForm =
  document.getElementById(
    "kpiForm"
  );


const kpiId =
  document.getElementById(
    "kpiId"
  );


const jenisProyekId =
  document.getElementById(
    "jenisProyekId"
  );


const nilaiKpi =
  document.getElementById(
    "nilaiKpi"
  );


const tahunKpi =
  document.getElementById(
    "tahunKpi"
  );


const kpiTable =
  document.getElementById(
    "kpiTable"
  );


const formTitle =
  document.getElementById(
    "formTitle"
  );


const saveKpiButton =
  document.getElementById(
    "saveKpiButton"
  );


const cancelEditButton =
  document.getElementById(
    "cancelEditButton"
  );


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
// AMBIL RESPONSE JSON
// ======================================================

async function ambilResponseJson(
  response
) {
  const contentType =
    response.headers.get(
      "content-type"
    ) || "";


  if (
    contentType.includes(
      "application/json"
    )
  ) {
    return response.json();
  }


  const text =
    await response.text();


  return {
    error:
      text ||
      `Server menghasilkan status ${response.status}`
  };
}


// ======================================================
// FORMAT NOMINAL
// ======================================================

function ambilAngka(value) {
  return String(value ?? "")
    .replace(/[^\d]/g, "");
}


function formatNominal(value) {
  const angka =
    ambilAngka(value);


  if (!angka) {
    return "";
  }


  const number =
    Number(angka);


  if (!Number.isFinite(number)) {
    return "";
  }


  return new Intl.NumberFormat(
    "id-ID",
    {
      maximumFractionDigits: 0
    }
  ).format(number);
}


function parseNominal(value) {
  const angka =
    ambilAngka(value);


  if (!angka) {
    return 0;
  }


  const number =
    Number(angka);


  return Number.isFinite(number)
    ? number
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
    Number(value) || 0
  );
}


// ======================================================
// FORMAT INPUT NILAI KPI
// ======================================================

if (nilaiKpi) {
  nilaiKpi.addEventListener(
    "input",
    () => {
      nilaiKpi.value =
        formatNominal(
          nilaiKpi.value
        );


      const posisiAkhir =
        nilaiKpi.value.length;


      if (
        typeof nilaiKpi
          .setSelectionRange ===
        "function"
      ) {
        nilaiKpi.setSelectionRange(
          posisiAkhir,
          posisiAkhir
        );
      }
    }
  );
}


// ======================================================
// LOAD JENIS PROYEK
// ======================================================

async function loadJenisProyek() {
  if (!jenisProyekId) {
    return;
  }


  try {
    jenisProyekId.innerHTML = `
      <option value="">
        Memuat Jenis Proyek...
      </option>
    `;


    const response =
      await fetch(
        "/api/proyek/jenis",
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


    const result =
      await ambilResponseJson(
        response
      );


    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil jenis proyek."
      );
    }


    const rows =
      Array.isArray(result)
        ? result
        : Array.isArray(result.data)
          ? result.data
          : [];


    jenisProyekId.innerHTML = `
      <option value="">
        Pilih Jenis Proyek
      </option>

      ${rows.map(item => `
        <option value="${Number(item.id)}">
          ${escapeHtml(
            item.name ||
            item.nama_jenis_proyek ||
            item.jenis_proyek ||
            "-"
          )}
        </option>
      `).join("")}
    `;

  } catch (error) {
    console.error(
      "ERROR LOAD JENIS PROYEK:",
      error
    );


    jenisProyekId.innerHTML = `
      <option value="">
        Gagal mengambil Jenis Proyek
      </option>
    `;


    alert(
      error.message
    );
  }
}


// ======================================================
// LOAD MASTER KPI
// ======================================================

async function loadKpi() {
  if (!kpiTable) {
    return;
  }


  kpiTable.innerHTML = `
    <tr>
      <td
        colspan="5"
        class="empty-state"
      >
        Memuat Master KPI...
      </td>
    </tr>
  `;


  try {
    const response =
      await fetch(
        "/api/master-kpi",
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


    const result =
      await ambilResponseJson(
        response
      );


    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil Master KPI."
      );
    }


    allKpi =
      Array.isArray(result)
        ? result
        : Array.isArray(result.data)
          ? result.data
          : [];


    renderKpi();

  } catch (error) {
    console.error(
      "ERROR LOAD MASTER KPI:",
      error
    );


    kpiTable.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="empty-state"
        >
          Gagal mengambil Master KPI:
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}


// ======================================================
// RENDER MASTER KPI
// ======================================================

// ======================================================
// AMBIL NAMA JENIS PROYEK
// ======================================================

function getNamaJenisProyek(
  jenisId
) {
  const option =
    Array.from(
      jenisProyekId.options
    ).find(
      item =>
        Number(item.value) ===
        Number(jenisId)
    );


  return option
    ?.textContent
    ?.trim() ||
    `Jenis Proyek #${jenisId}`;
}

function renderKpi() {
  if (!kpiTable) {
    return;
  }


  if (
    !Array.isArray(allKpi) ||
    allKpi.length === 0
  ) {
    kpiTable.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="empty-state"
        >
          Belum ada Master KPI.
        </td>
      </tr>
    `;

    return;
  }


  kpiTable.innerHTML =
    allKpi.map(
      (item, index) => `
        <tr>

          <td>
            ${index + 1}
          </td>

          <td>
            <div class="jenis-name">
              ${escapeHtml(
                getNamaJenisProyek(
                    item.jenis_proyek_id
                )
                )}
            </div>
          </td>

          <td>
            <div class="nilai-kpi">
              ${formatRupiah(
                item.nilai_kpi
              )}
            </div>
          </td>

          <td>
            <span class="year-badge">
              ${escapeHtml(
                item.tahun ||
                "-"
              )}
            </span>
          </td>

          <td>
            <div class="table-actions">

              <button
                type="button"
                class="
                  btn
                  btn-secondary
                "
                data-edit-kpi="${Number(
                  item.id
                )}"
              >
                Edit
              </button>

              <button
                type="button"
                class="
                  btn
                  btn-danger
                "
                data-delete-kpi="${Number(
                  item.id
                )}"
              >
                Hapus
              </button>

            </div>
          </td>

        </tr>
      `
    ).join("");
}


// ======================================================
// RESET FORM
// ======================================================

function resetFormKpi() {
  if (kpiForm) {
    kpiForm.reset();
  }


  if (kpiId) {
    kpiId.value = "";
  }


  if (formTitle) {
    formTitle.textContent =
      "Tambah KPI";
  }


  if (saveKpiButton) {
    saveKpiButton.textContent =
      "Simpan KPI";
  }


  if (cancelEditButton) {
    cancelEditButton.style.display =
      "none";
  }


  /*
   * Isi tahun otomatis dengan tahun berjalan.
   */
  if (tahunKpi) {
    tahunKpi.value =
      new Date()
        .getFullYear();
  }
}


// ======================================================
// EDIT KPI
// ======================================================

function editKpi(id) {
  const item =
    allKpi.find(
      row =>
        Number(row.id) ===
        Number(id)
    );


  if (!item) {
    alert(
      "Data KPI tidak ditemukan."
    );

    return;
  }


  kpiId.value =
    String(item.id);


  jenisProyekId.value =
    String(
      item.jenis_proyek_id
    );


  nilaiKpi.value =
    formatNominal(
      item.nilai_kpi
    );


  tahunKpi.value =
    item.tahun;


  formTitle.textContent =
    "Edit KPI";


  saveKpiButton.textContent =
    "Simpan Perubahan";


  cancelEditButton.style.display =
    "inline-flex";


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  jenisProyekId.focus();
}


// ======================================================
// HAPUS KPI
// ======================================================

async function hapusKpi(id) {
  const item =
    allKpi.find(
      row =>
        Number(row.id) ===
        Number(id)
    );


  if (!item) {
    alert(
      "Data KPI tidak ditemukan."
    );

    return;
  }


  const jenisProyek =
    item.jenis_proyek ||
    item.nama_jenis_proyek ||
    "Jenis Proyek";


  const konfirmasi =
    window.confirm(
      `Hapus KPI ${jenisProyek} tahun ${item.tahun}?\n\nData yang sudah dihapus tidak dapat dikembalikan.`
    );


  if (!konfirmasi) {
    return;
  }


  try {
    const response =
      await fetch(
        `/api/master-kpi/${encodeURIComponent(
          id
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


    if (response.status === 401) {
      window.location.href =
        "/login.html";

      return;
    }


    const result =
      await ambilResponseJson(
        response
      );


    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal menghapus KPI."
      );
    }


    alert(
      result.message ||
      "KPI berhasil dihapus."
    );


    /*
     * Jika KPI yang sedang diedit dihapus,
     * reset form.
     */
    if (
      Number(kpiId.value) ===
      Number(id)
    ) {
      resetFormKpi();
    }


    await loadKpi();

  } catch (error) {
    console.error(
      "ERROR HAPUS KPI:",
      error
    );


    alert(
      error.message
    );
  }
}


// ======================================================
// EVENT TABEL
// ======================================================

if (kpiTable) {
  kpiTable.addEventListener(
    "click",
    event => {
      const editButton =
        event.target.closest(
          "[data-edit-kpi]"
        );


      if (editButton) {
        const id =
          Number(
            editButton.dataset
              .editKpi
          );


        if (
          Number.isInteger(id) &&
          id > 0
        ) {
          editKpi(id);
        }


        return;
      }


      const deleteButton =
        event.target.closest(
          "[data-delete-kpi]"
        );


      if (deleteButton) {
        const id =
          Number(
            deleteButton.dataset
              .deleteKpi
          );


        if (
          Number.isInteger(id) &&
          id > 0
        ) {
          hapusKpi(id);
        }
      }
    }
  );
}


// ======================================================
// BATAL EDIT
// ======================================================

if (cancelEditButton) {
  cancelEditButton.addEventListener(
    "click",
    resetFormKpi
  );
}


// ======================================================
// SIMPAN KPI
// ======================================================

if (kpiForm) {
  kpiForm.addEventListener(
    "submit",
    async event => {
      event.preventDefault();


      const id =
        Number(
          kpiId.value
        );


      const isEdit =
        Number.isInteger(id) &&
        id > 0;


      const payload = {
        jenis_proyek_id:
          Number(
            jenisProyekId.value
          ),

        nilai_kpi:
          parseNominal(
            nilaiKpi.value
          ),

        tahun:
          Number(
            tahunKpi.value
          )
      };


      // ================================================
      // VALIDASI
      // ================================================

      if (
        !Number.isInteger(
          payload.jenis_proyek_id
        ) ||
        payload.jenis_proyek_id <= 0
      ) {
        alert(
          "Jenis proyek wajib dipilih."
        );


        jenisProyekId.focus();

        return;
      }


      if (
        !Number.isFinite(
          payload.nilai_kpi
        ) ||
        payload.nilai_kpi <= 0
      ) {
        alert(
          "Nilai KPI harus lebih dari Rp 0."
        );


        nilaiKpi.focus();

        return;
      }


      if (
        !Number.isInteger(
          payload.tahun
        ) ||
        payload.tahun < 2000 ||
        payload.tahun > 2100
      ) {
        alert(
          "Tahun KPI harus antara 2000 sampai 2100."
        );


        tahunKpi.focus();

        return;
      }


      try {
        saveKpiButton.disabled =
          true;


        saveKpiButton.textContent =
          "Menyimpan...";


        const url =
          isEdit
            ? `/api/master-kpi/${encodeURIComponent(
                id
              )}`
            : "/api/master-kpi";


        const method =
          isEdit
            ? "PUT"
            : "POST";


        console.log(
          "SIMPAN MASTER KPI:",
          {
            url,
            method,
            payload
          }
        );


        const response =
          await fetch(
            url,
            {
              method,

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json"
              },

              body:
                JSON.stringify(
                  payload
                )
            }
          );


        if (response.status === 401) {
          window.location.href =
            "/login.html";

          return;
        }


        const result =
          await ambilResponseJson(
            response
          );


        if (!response.ok) {
          throw new Error(
            result.error ||
            "Gagal menyimpan KPI."
          );
        }


        alert(
          result.message ||
          (
            isEdit
              ? "KPI berhasil diperbarui."
              : "KPI berhasil ditambahkan."
          )
        );


        resetFormKpi();

        await loadKpi();

      } catch (error) {
        console.error(
          "ERROR SIMPAN MASTER KPI:",
          error
        );


        alert(
          error.message
        );

      } finally {
        saveKpiButton.disabled =
          false;


        saveKpiButton.textContent =
          kpiId.value
            ? "Simpan Perubahan"
            : "Simpan KPI";
      }
    }
  );
}


// ======================================================
// START
// ======================================================

async function startMasterKpi() {
  resetFormKpi();

await loadJenisProyek();
await loadKpi();
}


startMasterKpi();