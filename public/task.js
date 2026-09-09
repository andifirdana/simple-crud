let daftarTask = [];
let daftarProyek = [];

const taskTableBody =
  document.getElementById(
    "taskTableBody"
  );

const taskModal =
  document.getElementById(
    "taskModal"
  );

const taskForm =
  document.getElementById(
    "taskForm"
  );

const proyekSelect =
  document.getElementById(
    "proyekId"
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
// LOAD PROYEK
// ======================================================

async function loadProyek() {

  try {

    const response =
      await fetch(
        "/api/task-list/proyek"
      );

    if (!response.ok) {
      throw new Error(
        "Gagal mengambil proyek"
      );
    }

    daftarProyek =
      await response.json();


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

  }

}


// ======================================================
// KATEGORI OTOMATIS
// ======================================================

proyekSelect.addEventListener(
  "change",
  () => {

    const proyek =
      daftarProyek.find(
        item =>
          String(item.id) ===
          String(proyekSelect.value)
      );


    document.getElementById(
      "kategori"
    ).value =
      proyek?.kategori || "";

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

    if (!response.ok) {
      throw new Error(
        "Gagal mengambil task"
      );
    }

    daftarTask =
      await response.json();

    renderTask();


  } catch (error) {

    console.error(
      "ERROR LOAD TASK:",
      error
    );

    taskTableBody.innerHTML =
      `
      <tr>
        <td colspan="11">
          Gagal mengambil data task.
        </td>
      </tr>
      `;

  }

}


// ======================================================
// RENDER TASK
// ======================================================

function renderTask() {

  if (daftarTask.length === 0) {

    taskTableBody.innerHTML =
      `
      <tr>
        <td
          colspan="11"
          style="text-align:center;padding:40px;"
        >
          Belum ada task.
        </td>
      </tr>
      `;

    return;

  }


  taskTableBody.innerHTML =
    daftarTask.map(
      item => {

        const classStatus =
          item.status
            .toLowerCase()
            .replaceAll(" ", "-");


        return `
          <tr>

            <td>
              ${item.nama_proyek || "-"}
            </td>

            <td>
              ${item.kategori || "-"}
            </td>

            <td class="task-name">
              ${item.task}
            </td>

            <td class="catatan-cell">
              ${item.catatan || "-"}
            </td>

            <td>
              ${
                item.link
                  ? `
                    <a
                      href="${item.link}"
                      target="_blank"
                    >
                      Buka Link
                    </a>
                  `
                  : "-"
              }
            </td>

            <td>

            <select
                class="status-select status-${classStatus}"
                onchange="ubahStatusTask(${item.id}, this.value)"
            >

                <option
                value="Not Started"
                ${item.status === "Not Started" ? "selected" : ""}
                >
                Not Started
                </option>

                <option
                value="On Progress"
                ${item.status === "On Progress" ? "selected" : ""}
                >
                On Progress
                </option>

                <option
                value="Hold"
                ${item.status === "Hold" ? "selected" : ""}
                >
                Hold
                </option>

                <option
                value="Done"
                ${item.status === "Done" ? "selected" : ""}
                >
                Done
                </option>

            </select>

            </td>

            <td>
              ${formatDate(
                item.tanggal_mulai
              )}
            </td>

            <td>
              ${formatDate(
                item.target_date
              )}
            </td>

            <td>
              ${formatDate(
                item.tanggal_selesai
              )}
            </td>

            <td>
              ${item.dibuat_oleh || "-"}
            </td>

            <td>

              <div class="action-buttons">

                <button
                  class="btn-edit"
                  onclick="editTask(${item.id})"
                >
                  Edit
                </button>

                <button
                  class="btn-delete"
                  onclick="hapusTask(${item.id})"
                >
                  Hapus
                </button>

              </div>

            </td>

          </tr>
        `;

      }
    ).join("");

}

// ======================================================
// UPDATE STATUS LANGSUNG DARI TABLE
// ======================================================

window.ubahStatusTask =
  async function (id, statusBaru) {

    const item =
      daftarTask.find(
        task => task.id === id
      );

    if (!item) {
      alert("Task tidak ditemukan");
      return;
    }


    try {

      const response =
        await fetch(
          `/api/task-list/${id}`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({

              proyek_id:
                item.proyek_id,

              task:
                item.task,

              catatan:
                item.catatan || "",

              link:
                item.link || "",

              status:
                statusBaru,

              target_date:
                item.target_date
                  ? item.target_date.substring(0, 10)
                  : null

            })

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


      // Refresh data
      // termasuk tanggal selesai

      await loadTask();


    } catch (error) {

      console.error(
        "ERROR UPDATE STATUS:",
        error
      );

      alert(
        error.message
      );


      // kembalikan dropdown
      // ke status sebelumnya

      await loadTask();

    }

  };

// ======================================================
// TAMBAH TASK
// ======================================================

document.getElementById(
  "tambahTaskButton"
).addEventListener(
  "click",
  () => {

    taskForm.reset();

    document.getElementById(
      "taskId"
    ).value = "";

    document.getElementById(
      "modalTitle"
    ).textContent =
      "Tambah Task";

    document.getElementById(
      "statusGroup"
    ).style.display =
      "none";

    taskModal.classList.add(
      "active"
    );

  }
);


// ======================================================
// EDIT
// ======================================================

window.editTask =
  function (id) {

    const item =
      daftarTask.find(
        task =>
          task.id === id
      );

    if (!item) return;


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
          String(item.proyek_id)
      );


    document.getElementById(
      "kategori"
    ).value =
      proyek?.kategori || "";


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


    document.getElementById(
      "status"
    ).value =
      item.status;


    document.getElementById(
      "targetDate"
    ).value =
      item.target_date
        ? item.target_date.substring(
            0,
            10
          )
        : "";


    document.getElementById(
      "statusGroup"
    ).style.display =
      "block";


    document.getElementById(
      "modalTitle"
    ).textContent =
      "Edit Task";


    taskModal.classList.add(
      "active"
    );

  };


// ======================================================
// SIMPAN
// ======================================================

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

      target_date:
        document.getElementById(
          "targetDate"
        ).value

    };


    if (id) {

      body.status =
        document.getElementById(
          "status"
        ).value;

    }


    try {

      const response =
        await fetch(
          id
            ? `/api/task-list/${id}`
            : "/api/task-list",
          {
            method:
              id
                ? "PUT"
                : "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(body)
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        throw new Error(
          result.error ||
          "Gagal menyimpan task"
        );

      }


      taskModal.classList.remove(
        "active"
      );


      await loadTask();


    } catch (error) {

      alert(error.message);

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

    if (!konfirmasi) return;


    try {

      const response =
        await fetch(
          `/api/task-list/${id}`,
          {
            method: "DELETE"
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

      alert(error.message);

    }

  };


// ======================================================
// CLOSE MODAL
// ======================================================

document.getElementById(
  "batalButton"
).addEventListener(
  "click",
  () => {

    taskModal.classList.remove(
      "active"
    );

  }
);

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
// LOAD USER
// ======================================================

async function loadCurrentUser() {

  try {

    const response =
      await fetch("/api/me");

    console.log(
      "STATUS /api/me:",
      response.status
    );

    const data =
      await response.json();

    console.log(
      "DATA /api/me:",
      data
    );


    if (!response.ok) {

      window.location.href =
        "/login.html";

      return;
    }


    const userNama =
      document.getElementById(
        "userNama"
      );

    const userRole =
      document.getElementById(
        "userRole"
      );


    console.log(
      "ELEMENT NAMA:",
      userNama
    );

    console.log(
      "ELEMENT ROLE:",
      userRole
    );


    if (userNama) {

      userNama.textContent =
        data.nama ||
        data.name ||
        data.email ||
        "User";

    }


    if (userRole) {

      userRole.textContent =
        data.role ||
        "PIC";

    }


  } catch (error) {

    console.error(
      "ERROR LOAD USER:",
      error
    );

  }

}



// ======================================================
// INITIAL LOAD
// ======================================================

async function init() {

  await loadCurrentUser();

  await loadProyek();

  await loadTask();

}

init();