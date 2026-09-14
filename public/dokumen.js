const tableBody =
  document.getElementById(
    "dokumenTableBody"
  );

const searchInput =
  document.getElementById(
    "searchDokumen"
  );

const tambahButton =
  document.getElementById(
    "tambahDokumenButton"
  );

const modal =
  document.getElementById(
    "dokumenModal"
  );

const modalTitle =
  document.getElementById(
    "dokumenModalTitle"
  );

const form =
  document.getElementById(
    "dokumenForm"
  );

const dokumenIdInput =
  document.getElementById(
    "dokumenId"
  );

const flagInput =
  document.getElementById(
    "flag"
  );

const kodeInput =
  document.getElementById(
    "kode"
  );

const deskripsiInput =
  document.getElementById(
    "deskripsi"
  );

const batalButton =
  document.getElementById(
    "batalDokumenButton"
  );

const simpanButton =
  document.getElementById(
    "simpanDokumenButton"
  );


let masterDokumen = [];


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
// FORMAT TANGGAL
// ======================================================

function formatTanggal(value) {

  if (!value) {
    return "-";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "-";

  }


  return date.toLocaleString(
    "id-ID",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",

      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


// ======================================================
// BADGE FLAG
// ======================================================

function flagClass(flag) {

  const value =
    String(flag || "")
      .trim()
      .toLowerCase();


  if (
    value === "admin"
  ) {

    return "badge-admin";

  }


  if (
    value === "teknis"
  ) {

    return "badge-teknis";

  }


  if (
    value === "pembayaran"
  ) {

    return "badge-pembayaran";

  }


  return "";

}


// ======================================================
// LOAD DATA
// ======================================================

async function loadDokumen() {

  try {

    const response =
      await fetch(
        "/api/master-dokumen"
      );


    const result =
      await response.json();


    if (!response.ok) {

      if (
        response.status === 401
      ) {

        window.location.href =
          "/login.html";

        return;

      }


      throw new Error(
        result.error ||
        "Gagal mengambil master dokumen"
      );

    }


    masterDokumen =
      Array.isArray(result)
        ? result
        : [];


    renderDokumen(
      masterDokumen
    );


  } catch (error) {

    console.error(
      "ERROR LOAD MASTER DOKUMEN:",
      error
    );


    tableBody.innerHTML = `
      <tr>

        <td
          colspan="6"
          class="empty"
          style="color:#dc2626;"
        >
          ${escapeHtml(
            error.message
          )}
        </td>

      </tr>
    `;

  }

}


// ======================================================
// RENDER TABLE
// ======================================================

function renderDokumen(data) {

  if (
    !data ||
    data.length === 0
  ) {

    tableBody.innerHTML = `
      <tr>

        <td
          colspan="6"
          class="empty"
        >
          Belum ada master dokumen.
        </td>

      </tr>
    `;

    return;

  }


  tableBody.innerHTML =
    data
      .map(item => {

        return `
          <tr>

            <td>

              <span
                class="
                  badge
                  ${flagClass(
                    item.flag
                  )}
                "
              >
                ${escapeHtml(
                  item.flag
                )}
              </span>

            </td>


            <td>

              <strong>
                ${escapeHtml(
                  item.kode
                )}
              </strong>

            </td>


            <td>
              ${escapeHtml(
                item.deskripsi
              )}
            </td>


            <td>
              ${formatTanggal(
                item.created_at
              )}
            </td>


            <td>
              ${formatTanggal(
                item.updated_at
              )}
            </td>


            <td>

              <div class="aksi">

                <button
                  type="button"
                  class="btn btn-secondary"
                  onclick="
                    editDokumen(
                      ${item.id}
                    )
                  "
                >
                  Edit
                </button>


                <button
                  type="button"
                  class="btn btn-danger"
                  onclick="
                    hapusDokumen(
                      ${item.id}
                    )
                  "
                >
                  Hapus
                </button>

              </div>

            </td>

          </tr>
        `;

      })
      .join("");

}


// ======================================================
// SEARCH
// ======================================================

searchInput.addEventListener(
  "input",
  () => {

    const keyword =
      searchInput
        .value
        .trim()
        .toLowerCase();


    if (!keyword) {

      renderDokumen(
        masterDokumen
      );

      return;

    }


    const filtered =
      masterDokumen.filter(
        item => {

          const flag =
            String(
              item.flag || ""
            )
              .toLowerCase();

          const kode =
            String(
              item.kode || ""
            )
              .toLowerCase();

          const deskripsi =
            String(
              item.deskripsi || ""
            )
              .toLowerCase();


          return (
            flag.includes(
              keyword
            ) ||
            kode.includes(
              keyword
            ) ||
            deskripsi.includes(
              keyword
            )
          );

        }
      );


    renderDokumen(
      filtered
    );

  }
);


// ======================================================
// TAMBAH DOKUMEN
// ======================================================

tambahButton.addEventListener(
  "click",
  () => {

    form.reset();

    dokumenIdInput.value =
      "";

    modalTitle.textContent =
      "Tambah Dokumen";

    simpanButton.textContent =
      "Simpan";


    modal.classList.add(
      "show"
    );


    setTimeout(
      () => {

        flagInput.focus();

      },
      50
    );

  }
);


// ======================================================
// EDIT DOKUMEN
// ======================================================

function editDokumen(id) {

  const item =
    masterDokumen.find(
      row =>
        Number(row.id) ===
        Number(id)
    );


  if (!item) {

    alert(
      "Dokumen tidak ditemukan."
    );

    return;

  }


  dokumenIdInput.value =
    item.id;

  flagInput.value =
    item.flag || "";

  kodeInput.value =
    item.kode || "";

  deskripsiInput.value =
    item.deskripsi || "";


  modalTitle.textContent =
    "Edit Dokumen";

  simpanButton.textContent =
    "Simpan Perubahan";


  modal.classList.add(
    "show"
  );

}


// ======================================================
// TUTUP MODAL
// ======================================================

function closeModal() {

  modal.classList.remove(
    "show"
  );

  form.reset();

  dokumenIdInput.value =
    "";

}


batalButton.addEventListener(
  "click",
  closeModal
);


modal.addEventListener(
  "click",
  event => {

    if (
      event.target === modal
    ) {

      closeModal();

    }

  }
);


// ======================================================
// SIMPAN TAMBAH / EDIT
// ======================================================

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const id =
      dokumenIdInput.value;


    const payload = {

      flag:
        flagInput.value,

      kode:
        kodeInput
          .value
          .trim(),

      deskripsi:
        deskripsiInput
          .value
          .trim()

    };


    if (
      !payload.flag ||
      !payload.kode ||
      !payload.deskripsi
    ) {

      alert(
        "Flag, kode dan deskripsi wajib diisi."
      );

      return;

    }


    try {

      simpanButton.disabled =
        true;

      simpanButton.textContent =
        "Menyimpan...";


      const url =
        id
          ? `/api/master-dokumen/${id}`
          : "/api/master-dokumen";


      const method =
        id
          ? "PUT"
          : "POST";


      const response =
        await fetch(
          url,
          {
            method,

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                payload
              )
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Gagal menyimpan dokumen"
        );

      }


      closeModal();

      await loadDokumen();


    } catch (error) {

      console.error(
        "ERROR SAVE MASTER DOKUMEN:",
        error
      );


      alert(
        error.message
      );


    } finally {

      simpanButton.disabled =
        false;

      simpanButton.textContent =
        dokumenIdInput.value
          ? "Simpan Perubahan"
          : "Simpan";

    }

  }
);


// ======================================================
// DELETE
// ======================================================

async function hapusDokumen(id) {

  const item =
    masterDokumen.find(
      row =>
        Number(row.id) ===
        Number(id)
    );


  if (!item) {

    alert(
      "Dokumen tidak ditemukan."
    );

    return;

  }


  const konfirmasi =
    confirm(
      `Hapus dokumen ${item.kode} - ${item.deskripsi}?`
    );


  if (!konfirmasi) {
    return;
  }


  try {

    const response =
      await fetch(
        `/api/master-dokumen/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menghapus dokumen"
      );

    }


    await loadDokumen();


  } catch (error) {

    console.error(
      "ERROR DELETE MASTER DOKUMEN:",
      error
    );


    alert(
      error.message
    );

  }

}


// ======================================================
// START
// ======================================================

loadDokumen();