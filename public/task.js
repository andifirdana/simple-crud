let daftarTask = [];
let daftarProyek = [];

const taskTableBody =
  document.getElementById(
    "taskTableBody"
  );

const taskForm =
  document.getElementById(
    "taskForm"
  );

const proyekSelect =
  document.getElementById(
    "proyekId"
  );

const adaDokumenInput =
  document.getElementById(
    "adaDokumen"
  );

const dokumenGroup =
  document.getElementById(
    "dokumenGroup"
  );

const masterDokumenInput =
  document.getElementById(
    "masterDokumenId"
  );

const urgentTaskInput =
  document.getElementById(
    "urgentTask"
  );

const nomorDokumenInput =
  document.getElementById(
    "nomorDokumen"
  );

let masterDokumen = [];

const adaPembayaranInput =
  document.getElementById(
    "adaPembayaran"
  );

const pembayaranGroup =
  document.getElementById(
    "pembayaranGroup"
  );

const jenisPembayaranInput =
  document.getElementById(
    "jenisPembayaran"
  );

const targetPembayaranInput =
  document.getElementById(
    "targetPembayaran"
  );

const namaTerminTaskInput =
  document.getElementById(
    "namaTerminTask"
  );

const persentaseTerminTaskInput =
  document.getElementById(
    "persentaseTerminTask"
  );

const nominalTerminTaskInput =
  document.getElementById(
    "nominalTerminTask"
  );

const statusPembayaranTaskInput =
  document.getElementById(
    "statusPembayaranTask"
  );

const jatuhTempoTerminTaskInput =
  document.getElementById(
    "jatuhTempoTerminTask"
  );

const tanggalBayarTerminTaskInput =
  document.getElementById(
    "tanggalBayarTerminTask"
  );

  urgentTaskInput.addEventListener(
  "change",
  () => {

    if (
      urgentTaskInput.checked
    ) {

      document.getElementById(
        "status"
      ).value =
        "Urgent";

    }

  }
);


// ======================================================
// FORMAT DATE
// ======================================================

function formatDate(value) {

  if (!value) return "-";

  const date =
    new Date(value);

  return date.toLocaleDateString(
    "id-ID"
  );

}

// ======================================================
// LOAD PROYEK DARI TABLE public.proyek
// ======================================================

async function loadProyek() {

  try {

    const response =
      await fetch(
        "/api/task-list/proyek"
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gagal mengambil proyek"
      );

    }

    daftarProyek =
      Array.isArray(data)
        ? data
        : [];

    console.log(
      "DAFTAR PROYEK:",
      daftarProyek
    );

    proyekSelect.innerHTML =
      `
      <option value="">
        Pilih Proyek
      </option>
      `;

    daftarProyek.forEach(
      proyek => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          proyek.id;

        option.textContent =
          proyek.nama_proyek;

        proyekSelect.appendChild(
          option
        );

      }
    );

  } catch (error) {

    console.error(
      "ERROR LOAD PROYEK:",
      error
    );

    proyekSelect.innerHTML =
      `
      <option value="">
        Gagal mengambil proyek
      </option>
      `;

  }

}


// ======================================================
// SAAT PROYEK DIPILIH
// ======================================================

proyekSelect.addEventListener(
  "change",
  async () => {

    const proyek =
      daftarProyek.find(
        item =>
          String(item.id) ===
          String(
            proyekSelect.value
          )
      );

    document.getElementById(
      "kategori"
    ).value =
      proyek?.kategori || "";

    if (
      adaPembayaranInput.checked
    ) {

      await loadTargetPembayaran();

    }

  }
);

// ======================================================
// LOAD TASK
// ======================================================

async function loadTask() {

  try {

    const response =
      await fetch(
        "/api/task-list"
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gagal mengambil task"
      );

    }


    daftarTask =
      Array.isArray(data)
        ? data
        : [];


    console.log(
      "DATA TASK:",
      daftarTask
    );


    renderTask();


  } catch (error) {

    console.error(
      "ERROR LOAD TASK:",
      error
    );


    taskTableBody.innerHTML =
      `
      <tr>
        <td colspan="13">
          Gagal mengambil data task.
        </td>
      </tr>
      `;

  }

}


// ======================================================
// LOAD MASTER DOKUMEN
// ======================================================

async function loadMasterDokumen() {

  try {

    const response =
      await fetch(
        "/api/master-dokumen"
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gagal mengambil master dokumen"
      );

    }


    masterDokumen =
      Array.isArray(data)
        ? data
        : [];


    masterDokumenInput.innerHTML =
      `
      <option value="">
        Pilih Dokumen
      </option>

      ${
        masterDokumen
          .map(
            item => `
              <option
                value="${item.id}"
              >
                ${item.kode} - ${item.deskripsi}
              </option>
            `
          )
          .join("")
      }
      `;


  } catch (error) {

    console.error(
      "ERROR LOAD MASTER DOKUMEN:",
      error
    );

  }

}


// ======================================================
// CHECKLIST DOKUMEN
// ======================================================

adaDokumenInput.addEventListener(
  "change",
  () => {

    if (
      adaDokumenInput.checked
    ) {

      dokumenGroup.style.display =
        "block";

    } else {

      dokumenGroup.style.display =
        "none";


      masterDokumenInput.value =
        "";


      nomorDokumenInput.value =
        "";

    }

  }
);


// ======================================================
// RENDER TASK
// ======================================================

function renderTask() {

  if (
    daftarTask.length === 0
  ) {

    taskTableBody.innerHTML =
      `
      <tr>
        <td
          colspan="13"
          style="
            text-align:center;
            padding:40px;
          "
        >
          Belum ada task.
        </td>
      </tr>
      `;

    return;

  }


  taskTableBody.innerHTML =
    daftarTask
      .map(
        item => {

          const classStatus =
            String(
              item.status ||
              "Not Started"
            )
              .toLowerCase()
              .replaceAll(
                " ",
                "-"
              );


          return `
            <tr>

              <td>
                ${
                  item.nama_proyek ||
                  "-"
                }
              </td>


              <td>
                ${
                  item.kategori ||
                  "-"
                }
              </td>


              <td class="task-name">
                ${
                  item.task ||
                  "-"
                }
              </td>


              <td class="catatan-cell">
                ${
                  item.catatan ||
                  "-"
                }
              </td>


              <td>

                ${
                  item.link
                    ? `
                      <a
                        href="${item.link}"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Buka Link
                      </a>
                    `
                    : "-"
                }

              </td>


              <!-- DOKUMEN -->

              <td>
                ${
                  item.kode_dokumen
                    ? item.kode_dokumen
                    : "-"
                }
              </td>


              <!-- NOMOR DOKUMEN -->

              <td>
                ${
                  item.nomor_dokumen
                    ? item.nomor_dokumen
                    : "-"
                }
              </td>


              <!-- STATUS -->

              <td>

                <select
                  class="
                    status-select
                    status-${classStatus}
                  "
                  onchange="
                    ubahStatusTask(
                      ${item.id},
                      this.value
                    )
                  "
                >

                  <option
                    value="Not Started"
                    ${
                      item.status ===
                      "Not Started"
                        ? "selected"
                        : ""
                    }
                  >
                    Not Started
                  </option>


                  <option
                    value="On Progress"
                    ${
                      item.status ===
                      "On Progress"
                        ? "selected"
                        : ""
                    }
                  >
                    On Progress
                  </option>


                  <option
                    value="Hold"
                    ${
                      item.status ===
                      "Hold"
                        ? "selected"
                        : ""
                    }
                  >
                    Hold
                  </option>


                  <option
                    value="Done"
                    ${
                      item.status ===
                      "Done"
                        ? "selected"
                        : ""
                    }
                  >
                    Done
                  </option>

                  <option
                  value="Urgent"
                  ${
                    item.status ===
                    "Urgent"
                      ? "selected"
                      : ""
                  }
                >
                  Urgent
                </option>

                </select>

              </td>


              <td>
                ${
                  formatDate(
                    item.tanggal_mulai
                  )
                }
              </td>


              <td>
                ${
                  formatDate(
                    item.target_date
                  )
                }
              </td>


              <td>
                ${
                  formatDate(
                    item.tanggal_selesai
                  )
                }
              </td>


              <td>
                ${
                  item.dibuat_oleh ||
                  "-"
                }
              </td>


              <td>

                <div
                  class="action-buttons"
                >

                  <button
                    type="button"
                    class="btn-edit"
                    onclick="
                      editTask(
                        ${item.id}
                      )
                    "
                  >
                    Edit
                  </button>


                  <button
                    type="button"
                    class="btn-delete"
                    onclick="
                      hapusTask(
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

        }
      )
      .join("");

}



// ======================================================
// UPDATE STATUS LANGSUNG DARI TABLE
// ======================================================

window.ubahStatusTask =
  async function (
    id,
    statusBaru
  ) {

    const item =
      daftarTask.find(
        task =>
          Number(task.id) ===
          Number(id)
      );


    if (!item) {

      alert(
        "Task tidak ditemukan"
      );

      return;

    }


    const body = {

      proyek_id:
        item.proyek_id,

      task:
        item.task,

      catatan:
        item.catatan || "",

      link:
        item.link || "",

      master_dokumen_id:
        item.master_dokumen_id ||
        null,

      nomor_dokumen:
        item.nomor_dokumen ||
        null,


 status: statusBaru,
    };


    console.log(
      "BODY UPDATE STATUS:",
      body
    );


    try {

      const response =
        await fetch(
          `/api/task-list/${id}`,
          {

            method:
              "PUT",

            headers: {

              "Content-Type":
                "application/json"

            },

            body:
              JSON.stringify(
                body
              )

          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Gagal mengubah status"
        );

      }


      await loadTask();


    } catch (error) {

      console.error(
        "ERROR UPDATE STATUS:",
        error
      );


      alert(
        error.message
      );


      await loadTask();

    }

  };

// ======================================================
// CHECKLIST PEMBAYARAN
// ======================================================
  adaPembayaranInput.addEventListener(
  "change",
  async () => {

    pembayaranGroup.style.display =
      adaPembayaranInput.checked
        ? "block"
        : "none";

    if (
      adaPembayaranInput.checked &&
      proyekSelect.value
    ) {

      await loadTargetPembayaran();

    }

  }
);

let dataPembayaranProyek =
  null;


async function loadTargetPembayaran() {

  const proyekId =
    proyekSelect.value;


  targetPembayaranInput.innerHTML =
    `
    <option value="">
      Memuat...
    </option>
    `;


  if (!proyekId) {

    targetPembayaranInput.innerHTML =
      `
      <option value="">
        Pilih proyek terlebih dahulu
      </option>
      `;

    return;
  }


  try {

    const response =
      await fetch(
        `/api/task-list/proyek/${proyekId}/pembayaran-target`
      );


    const data =
      await response.json();


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gagal mengambil pembayaran proyek"
      );

    }


    dataPembayaranProyek =
      data;


    updatePilihanTargetPembayaran();


    const jenisProyek =
      String(
        data.proyek?.jenis_proyek ||
        ""
      )
        .trim()
        .toLowerCase();


    const nominalMode =
      jenisProyek === "sewa" ||
      jenisProyek === "transaksi";


    document.getElementById(
      "terminPersentaseGroup"
    ).style.display =
      nominalMode
        ? "none"
        : "block";


    document.getElementById(
      "terminNominalGroup"
    ).style.display =
      nominalMode
        ? "block"
        : "none";


  } catch (error) {

    console.error(
      "ERROR LOAD PEMBAYARAN:",
      error
    );

    targetPembayaranInput.innerHTML =
      `
      <option value="">
        Gagal mengambil data
      </option>
      `;

  }

}

jenisPembayaranInput.addEventListener(
  "change",
  () => {

    updatePilihanTargetPembayaran();

  }
);


function updatePilihanTargetPembayaran() {

  const jenis =
    jenisPembayaranInput.value;


  targetPembayaranInput.innerHTML =
    `
    <option value="">
      Pilih
    </option>
    `;


  if (
    !dataPembayaranProyek
  ) {
    return;
  }


  if (
    jenis === "klien"
  ) {

    document.getElementById(
      "labelTargetPembayaran"
    ).textContent =
      "Klien";


    dataPembayaranProyek
      .klien
      .forEach(
        item => {

          const option =
            document.createElement(
              "option"
            );

          option.value =
            item.proyek_klien_id;

          option.textContent =
            item.nama;

          targetPembayaranInput
            .appendChild(option);

        }
      );

  }


  if (
    jenis === "partner"
  ) {

    document.getElementById(
      "labelTargetPembayaran"
    ).textContent =
      "Partner";


    dataPembayaranProyek
      .partner
      .forEach(
        item => {

          const option =
            document.createElement(
              "option"
            );

          option.value =
            item.proyek_partner_id;

          option.textContent =
            item.nama;

          targetPembayaranInput
            .appendChild(option);

        }
      );

  }

}

async function simpanPembayaranTask() {

  if (!adaPembayaranInput.checked) {
    return;
  }

  const jenis =
    jenisPembayaranInput.value;

  const targetId =
    targetPembayaranInput.value;


  // ======================================================
  // VALIDASI
  // ======================================================

  if (!jenis) {
    throw new Error(
      "Pilih Termin Klien atau Partner."
    );
  }

  if (!targetId) {
    throw new Error(
      "Pilih klien atau partner."
    );
  }

  if (
    !namaTerminTaskInput.value.trim()
  ) {
    throw new Error(
      "Nama termin wajib diisi."
    );
  }


  // ======================================================
  // CEK JENIS PROYEK
  // ======================================================

  const jenisProyek =
    String(
      dataPembayaranProyek
        ?.proyek
        ?.jenis_proyek || ""
    )
      .trim()
      .toLowerCase();


  const nominalMode =
    jenisProyek === "sewa" ||
    jenisProyek === "transaksi";


  // ======================================================
  // VALIDASI NILAI TERMIN
  // ======================================================

  if (nominalMode) {

    const nominal =
      Number(
        nominalTerminTaskInput.value
      );

    if (
      !nominal ||
      nominal <= 0
    ) {
      throw new Error(
        "Nominal termin harus lebih dari Rp 0."
      );
    }

  } else {

    const persentase =
      Number(
        persentaseTerminTaskInput.value
      );

    if (
      !persentase ||
      persentase <= 0 ||
      persentase > 100
    ) {
      throw new Error(
        "Persentase termin harus lebih dari 0 dan maksimal 100%."
      );
    }

  }


  // ======================================================
  // PAYLOAD
  // ======================================================

  const payload = {

    nama_termin:
      namaTerminTaskInput
        .value
        .trim(),

    persentase:
      nominalMode
        ? null
        : Number(
            persentaseTerminTaskInput.value
          ),

    nominal:
      nominalMode
        ? Number(
            nominalTerminTaskInput.value
          )
        : null,

    status_pembayaran:
      statusPembayaranTaskInput.value,

    tanggal_jatuh_tempo:
      jatuhTempoTerminTaskInput.value ||
      null,

    tanggal_bayar:
      tanggalBayarTerminTaskInput.value ||
      null

  };


  // ======================================================
  // URL
  // ======================================================

  const url =
    jenis === "klien"
      ? `/api/proyek/klien/${targetId}/termin`
      : `/api/proyek/partner/${targetId}/termin`;


  console.log(
    "===================================="
  );

  console.log(
    "SIMPAN TERMIN DARI TASK"
  );

  console.log(
    "TERMIN URL:",
    url
  );

  console.log(
    "TERMIN METHOD:",
    "POST"
  );

  console.log(
    "TERMIN PAYLOAD:",
    payload
  );


  // ======================================================
  // REQUEST
  // ======================================================

  const response =
    await fetch(
      url,
      {
        method: "POST",

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


  console.log(
    "TERMIN STATUS:",
    response.status
  );


  // ======================================================
  // RESPONSE
  // ======================================================

  const responseText =
    await response.text();


  console.log(
    "TERMIN RESPONSE:",
    responseText
  );

  console.log(
    "===================================="
  );


  let result = {};


  try {

    result =
      responseText
        ? JSON.parse(
            responseText
          )
        : {};

  } catch (error) {

    throw new Error(
      `Response termin bukan JSON. HTTP ${response.status} - ${url}`
    );

  }


  if (!response.ok) {

    throw new Error(
      result.error ||
      `Gagal menyimpan termin. HTTP ${response.status}`
    );

  }


  return result;

}

// ======================================================
// EDIT TASK
// ======================================================

window.editTask =
  function (id) {

    const item =
      daftarTask.find(
        task =>
          Number(task.id) ===
          Number(id)
      );


    if (!item) {

      alert(
        "Task tidak ditemukan"
      );

      return;

    }


    document.getElementById(
      "taskId"
    ).value =
      item.id;


    proyekSelect.value =
      item.proyek_id;


    const proyek =
      daftarProyek.find(
        p =>
          String(p.id) ===
          String(
            item.proyek_id
          )
      );


    document.getElementById(
      "kategori"
    ).value =
      proyek?.kategori ||
      item.kategori ||
      "";


    document.getElementById(
      "task"
    ).value =
      item.task || "";


    document.getElementById(
      "catatan"
    ).value =
      item.catatan || "";


    document.getElementById(
      "link"
    ).value =
      item.link || "";


// ======================================================
// DOKUMEN
// ======================================================

    if (
      item.master_dokumen_id
    ) {

      adaDokumenInput.checked =
        true;


      dokumenGroup.style.display =
        "block";


      masterDokumenInput.value =
        String(
          item.master_dokumen_id
        );


      nomorDokumenInput.value =
        item.nomor_dokumen ||
        "";

    } else {

      adaDokumenInput.checked =
        false;


      dokumenGroup.style.display =
        "none";


      masterDokumenInput.value =
        "";


      nomorDokumenInput.value =
        "";

    }


    document.getElementById(
      "status"
    ).value =
      item.status ||
      "Not Started";


    document.getElementById(
      "targetDate"
    ).value =
      item.target_date
        ? String(
            item.target_date
          ).substring(
            0,
            10
          )
        : "";


    document.getElementById(
      "statusGroup"
    ).style.display =
      "block";


    document.getElementById(
  "formTitle"
).textContent =
  "Edit Task";

document.getElementById(
  "simpanTaskButton"
).textContent =
  "Simpan Perubahan";

document.getElementById(
  "batalButton"
).style.display =
  "inline-block";

document.getElementById(
  "taskFormCard"
).scrollIntoView({
  behavior: "smooth",
  block: "start"
});

  };


// ======================================================
// SIMPAN TASK
// ======================================================

function resetTaskForm() {
  taskForm.reset();

  // reset ID task jika sedang mode edit
  const taskIdInput =
    document.getElementById("taskId");

  if (taskIdInput) {
    taskIdInput.value = "";
  }

  // reset tombol submit jika sebelumnya mode edit
  const submitButton =
    taskForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.textContent = "Simpan";
  }
}

taskForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const id =
      document.getElementById(
        "taskId"
      ).value;


    const body = {

      proyek_id:
        proyekSelect.value,

      task:
        document.getElementById(
          "task"
        ).value,

      catatan:
        document.getElementById(
          "catatan"
        ).value,

      link:
        document.getElementById(
          "link"
        ).value,

      master_dokumen_id:
        adaDokumenInput.checked
          ? masterDokumenInput.value ||
            null
          : null,

      nomor_dokumen:
        adaDokumenInput.checked
          ? nomorDokumenInput
              .value
              .trim() ||
            null
          : null,

      target_date:
        document.getElementById(
          "targetDate"
        ).value ||
        null

    };


    // ==================================================
    // VALIDASI PROJECT
    // ==================================================

    if (
      !body.proyek_id
    ) {

      alert(
        "Silakan pilih proyek."
      );

      return;

    }


    // ==================================================
    // VALIDASI TASK
    // ==================================================

    if (
      !String(
        body.task
      ).trim()
    ) {

      alert(
        "Task wajib diisi."
      );

      return;

    }


    // ==================================================
    // VALIDASI DOKUMEN
    // ==================================================

    if (
      adaDokumenInput.checked &&
      !masterDokumenInput.value
    ) {

      alert(
        "Silakan pilih kode dokumen."
      );

      return;

    }


    if (
      adaDokumenInput.checked &&
      !nomorDokumenInput
        .value
        .trim()
    ) {

      alert(
        "Nomor dokumen wajib diisi."
      );

      return;

    }


    // ==================================================
    // STATUS HANYA SAAT EDIT
    // ==================================================

    if (
  urgentTaskInput?.checked
) {

  body.status =
    "Urgent";

} else if (id) {

  body.status =
    document.getElementById(
      "status"
    ).value;

} else {

  body.status =
    "Not Started";

}

console.log(
  "URGENT CHECKED:",
  urgentTaskInput?.checked
);

console.log(
  "STATUS YANG DIKIRIM:",
  body.status
);

    // ==================================================
    // DEBUG
    // ==================================================

    console.log(
      "===================================="
    );

    console.log(
      id
        ? "EDIT TASK"
        : "TAMBAH TASK"
    );

    console.log(
      "BODY TASK YANG DIKIRIM:",
      body
    );

    console.log(
      "CHECKLIST DOKUMEN:",
      adaDokumenInput.checked
    );

    console.log(
      "MASTER DOKUMEN ID:",
      masterDokumenInput.value
    );

    console.log(
      "NOMOR DOKUMEN:",
      nomorDokumenInput.value
    );

    console.log(
      "===================================="
    );


    try {

      const url =
        id
          ? `/api/task-list/${id}`
          : "/api/task-list";


      const method =
        id
          ? "PUT"
          : "POST";


      console.log(
        "REQUEST:",
        method,
        url
      );


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
                body
              )

          }
        );


      console.log(
        "HTTP STATUS:",
        response.status
      );


      const result =
        await response.json();


      console.log(
        "RESPONSE API:",
        result
      );


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Gagal menyimpan task"
        );

      }
      if (
        adaPembayaranInput.checked
      ) {

        await simpanPembayaranTask();

      }

      resetTaskForm();

    await loadTask();


      console.log(
        "TASK BERHASIL DISIMPAN:",
        result
      );

      await loadTask();


    } catch (error) {

      console.error(
        "ERROR SAVE TASK:",
        error
      );


      alert(
        error.message
      );

    }

  }
);


// ======================================================
// DELETE
// ======================================================

window.hapusTask =
  async function (id) {

    const konfirmasi =
      confirm(
        "Yakin ingin menghapus task ini?"
      );


    if (!konfirmasi) {

      return;

    }


    try {

      const response =
        await fetch(
          `/api/task-list/${id}`,
          {

            method:
              "DELETE"

          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Gagal menghapus task"
        );

      }


      await loadTask();


    } catch (error) {

      console.error(
        "ERROR DELETE TASK:",
        error
      );


      alert(
        error.message
      );

    }

  };


// ======================================================
// CLOSE MODAL
// ======================================================

const batalButton =
  document.getElementById(
    "batalButton"
  );

if (batalButton) {

  batalButton.addEventListener(
    "click",
    () => {

      resetTaskForm();

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

          method:
            "POST"

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
// LOGOUT BUTTON
// ======================================================

const logoutButton =
  document.getElementById(
    "logoutButton"
  );


if (logoutButton) {

  logoutButton.addEventListener(
    "click",
    logout
  );

}


// ======================================================
// INITIAL LOAD
// ======================================================

async function init() {

  await loadProyek();

  await loadMasterDokumen();

  await loadTask();

}


init();