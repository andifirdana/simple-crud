"use strict";

// ======================================================
// STATE
// ======================================================

let daftarProyek = [];
let daftarTask = [];
let currentPage = 1;

const itemsPerPage = 15;

// ======================================================
// ELEMENT FORM
// ======================================================

const taskForm = document.getElementById("taskForm");
const taskFormCard = document.getElementById("taskFormCard");
const taskIdInput = document.getElementById("taskId");
const subTaskIdInput = document.getElementById("subTaskId");
const proyekInput = document.getElementById("proyekId");
const kategoriContainer = document.getElementById("kategoriContainer");
const targetDateInput = document.getElementById("targetDate");
const taskInput = document.getElementById("task");
const linkInput = document.getElementById("link");
const catatanEditor = document.getElementById("catatanEditor");
const needFollowUpInput = document.getElementById("needFollowUp");
const followUpFields = document.getElementById("followUpFields");
const subTaskInput = document.getElementById("subTask");
const tanggalTindakLanjutInput = document.getElementById(
  "tanggalTindakLanjut"
);
const statusInput = document.getElementById("status");
const simpanTaskButton = document.getElementById("simpanTaskButton");
const batalButton = document.getElementById("batalButton");
const formTitle = document.getElementById("formTitle");

// ======================================================
// ELEMENT DAFTAR
// ======================================================

const searchTaskInput = document.getElementById("searchTask");
const taskTableBody = document.getElementById("taskTableBody");
const pagination = document.getElementById("pagination");

// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ======================================================
// FORMAT TANGGAL
// ======================================================

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const tanggalString = String(value).substring(0, 10);
  const bagian = tanggalString.split("-");

  if (bagian.length !== 3) {
    return "-";
  }

  const tahun = Number(bagian[0]);
  const bulan = Number(bagian[1]);
  const tanggal = Number(bagian[2]);

  const date = new Date(tahun, bulan - 1, tanggal);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function tanggalInput(value) {
  if (!value) {
    return "";
  }

  return String(value).substring(0, 10);
}

// ======================================================
// FETCH JSON
// ======================================================

async function fetchJSON(url, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {})
  };

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers
  });

  const contentType =
    response.headers.get("content-type") || "";

  let result;

  if (contentType.includes("application/json")) {
    result = await response.json();
  } else {
    result = {
      error: await response.text()
    };
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
      `Permintaan gagal (${response.status})`
    );
  }

  return result;
}

// ======================================================
// NORMALISASI KATEGORI
// ======================================================

function normalisasiKategori(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item && typeof item === "object") {
          return (
            item.nama_kategori_produk ||
            item.nama ||
            item.kategori ||
            ""
          );
        }

        return String(item || "");
      })
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "object") {
    return normalisasiKategori(Object.values(value));
  }

  const text = String(value).trim();

  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);

    if (Array.isArray(parsed)) {
      return normalisasiKategori(parsed);
    }
  } catch (error) {
    // Value bukan JSON.
  }

  return text
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

// ======================================================
// KATEGORI PROYEK
// ======================================================

function kategoriProyek(proyek) {
  if (!proyek) {
    return [];
  }

  return normalisasiKategori(
    proyek.kategori_list ||
    proyek.kategori ||
    proyek.nama_kategori_produk_list ||
    proyek.nama_kategori_produk ||
    []
  );
}

function tampilkanKategori(kategori) {
  const daftar = normalisasiKategori(kategori);

  if (!daftar.length) {
    kategoriContainer.innerHTML = `
      <span class="category-placeholder">
        Kategori belum tersedia
      </span>
    `;

    return;
  }

  kategoriContainer.innerHTML = daftar
    .map(item => `
      <span class="category-chip">
        ${escapeHTML(item)}
      </span>
    `)
    .join("");
}

// ======================================================
// CARI PROYEK BERDASARKAN ID
// ======================================================

function getProyekById(id) {
  return daftarProyek.find(
    item => Number(item.id) === Number(id)
  );
}

// ======================================================
// NAMA SUBTASK OTOMATIS
// ======================================================

function namaSubTaskOtomatis(namaTask) {
  const namaDasar = String(namaTask || "")
    .replace(/^(tindak lanjut\s*)+/i, "")
    .trim();

  if (!namaDasar) {
    return "";
  }

  return `Tindak Lanjut ${namaDasar}`;
}

// ======================================================
// SANITASI CATATAN HTML
// ======================================================

function sanitasiCatatan(html) {
  const template = document.createElement("template");

  template.innerHTML = String(html || "");

  const allowedTags = new Set([
    "B",
    "STRONG",
    "I",
    "EM",
    "U",
    "BR",
    "DIV",
    "P"
  ]);

  function bersihkan(node) {
    [...node.childNodes].forEach(child => {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        return;
      }

      [...child.attributes].forEach(attribute => {
        child.removeAttribute(attribute.name);
      });

      bersihkan(child);
    });
  }

  bersihkan(template.content);

  return template.innerHTML.trim();
}

// ======================================================
// CATATAN HTML MENJADI TEXT
// ======================================================

function teksCatatan(html) {
  const element = document.createElement("div");

  element.innerHTML = sanitasiCatatan(html);

  return String(element.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function potongCatatan(html, maksimal = 200) {
  const text = teksCatatan(html);

  if (!text) {
    return "-";
  }

  if (text.length <= maksimal) {
    return text;
  }

  return text.substring(0, maksimal).trim() + "...";
}

// ======================================================
// RENDER CATATAN
// ======================================================

function renderCatatanTask(value) {
  const catatan = String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();

  if (!catatan) {
    return `
      <span class="task-list-note-empty">-</span>
    `;
  }

  const karakter = Array.from(catatan);
  const batasKarakter = 200;
  const catatanAman = escapeHTML(catatan);

  if (karakter.length <= batasKarakter) {
    return `
      <div class="task-list-note-text">
        ${catatanAman}
      </div>
    `;
  }

  const catatanRingkas = escapeHTML(
    karakter
      .slice(0, batasKarakter)
      .join("")
      .trimEnd()
  );

  return `
    <div class="task-list-note">

      <div
        class="task-list-note-text"
        data-task-list-note-short
      >${catatanRingkas}...</div>

      <div
        class="task-list-note-text"
        data-task-list-note-full
        hidden
      >${catatanAman}</div>

      <button
        type="button"
        class="task-list-note-button"
        aria-expanded="false"
        onclick="toggleCatatanTaskList(this)"
      >Lihat selengkapnya ↓</button>

    </div>
  `;
}

window.toggleCatatanTaskList = function (button) {
  const wrapper = button.closest(".task-list-note");

  if (!wrapper) {
    return;
  }

  const catatanRingkas = wrapper.querySelector(
    "[data-task-list-note-short]"
  );

  const catatanLengkap = wrapper.querySelector(
    "[data-task-list-note-full]"
  );

  if (!catatanRingkas || !catatanLengkap) {
    return;
  }

  const buka = catatanLengkap.hidden;

  catatanRingkas.hidden = buka;
  catatanLengkap.hidden = !buka;

  button.setAttribute("aria-expanded", String(buka));

  button.textContent = buka
    ? "Tampilkan lebih sedikit ↑"
    : "Lihat selengkapnya ↓";
};

// ======================================================
// NORMALISASI LINK
// ======================================================

function normalisasiLink(value) {
  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  return `https://${text}`;
}

// ======================================================
// CLASS STATUS
// ======================================================

function statusClass(status) {
  const key = String(status || "")
    .trim()
    .toLowerCase();

  if (key === "done") {
    return "status-done";
  }

  if (key === "on progress") {
    return "status-on-progress";
  }

  if (key === "need follow up") {
    return "status-follow-up";
  }

  return "status-not-started";
}

// ======================================================
// EDITOR CATATAN
// ======================================================

document
  .querySelectorAll("[data-editor-command]")
  .forEach(button => {
    button.addEventListener("click", () => {
      const command = button.dataset.editorCommand;

      catatanEditor.focus();

      document.execCommand(command, false, null);
    });
  });

// ======================================================
// LOAD PROYEK
// ======================================================

async function loadProyek() {
  const result = await fetchJSON("/api/task-list/proyek");

  daftarProyek = Array.isArray(result)
    ? result
    : (
        Array.isArray(result.data)
          ? result.data
          : []
      );

  proyekInput.innerHTML = `
    <option value="">Pilih proyek</option>

    ${daftarProyek.map(item => `
      <option value="${Number(item.id)}">
        ${escapeHTML(item.nama_proyek || "-")}
      </option>
    `).join("")}
  `;
}

// ======================================================
// EVENT PILIH PROYEK
// ======================================================

proyekInput.addEventListener("change", () => {
  const proyek = getProyekById(proyekInput.value);

  tampilkanKategori(
    proyek ? kategoriProyek(proyek) : []
  );
});

// ======================================================
// ATUR FOLLOW UP
// ======================================================

function aturFollowUp({
  isiSubTaskOtomatis = true,
  kosongkanJikaNonaktif = true
} = {}) {
  const aktif = needFollowUpInput.checked;

  followUpFields.classList.toggle("show", aktif);

  subTaskInput.required = aktif;
  tanggalTindakLanjutInput.required = aktif;
  tanggalTindakLanjutInput.disabled = !aktif;

  if (aktif) {
    statusInput.value = "Need Follow Up";

    if (
      isiSubTaskOtomatis &&
      !subTaskInput.value.trim()
    ) {
      subTaskInput.value = namaSubTaskOtomatis(
        taskInput.value
      );
    }

    return;
  }

  subTaskInput.required = false;
  tanggalTindakLanjutInput.required = false;

  if (kosongkanJikaNonaktif) {
    subTaskInput.value = "";
    tanggalTindakLanjutInput.value = "";
  }

  if (statusInput.value === "Need Follow Up") {
    statusInput.value = "On Progress";
  }
}

needFollowUpInput.addEventListener("change", () => {
  aturFollowUp();
});

taskInput.addEventListener("input", () => {
  if (!needFollowUpInput.checked) {
    return;
  }

  subTaskInput.value = namaSubTaskOtomatis(
    taskInput.value
  );
});

statusInput.addEventListener("change", () => {
  const status = statusInput.value;

  if (status === "Need Follow Up") {
    needFollowUpInput.checked = true;
    aturFollowUp();
    return;
  }

  if (status === "Done") {
    needFollowUpInput.checked = false;

    aturFollowUp({
      isiSubTaskOtomatis: false
    });
  }
});

// ======================================================
// LOAD TASK
// ======================================================

async function loadTask() {
  taskTableBody.innerHTML = `
    <tr>
      <td colspan="8" class="empty-state">
        Memuat task...
      </td>
    </tr>
  `;

  const result = await fetchJSON("/api/task-list");

  daftarTask = Array.isArray(result)
    ? result
    : (
        Array.isArray(result.data)
          ? result.data
          : []
      );

  currentPage = 1;

  renderTask();
}

// ======================================================
// AMBIL SUBTASK
// ======================================================

function getSubTask(parentId) {
  return daftarTask.find(
    item =>
      Number(item.parent_task_id) === Number(parentId)
  );
}

// ======================================================
// FILTER TASK
// ======================================================

function dataTaskTerfilter() {
  const search = String(searchTaskInput.value || "")
    .trim()
    .toLowerCase();

  const parentTasks = daftarTask.filter(
    item => !item.parent_task_id
  );

  if (!search) {
    return parentTasks;
  }

  return parentTasks.filter(item => {
    const proyek = getProyekById(item.proyek_id);
    const subTask = getSubTask(item.id);

    const kategori = normalisasiKategori(
      item.kategori ||
      item.kategori_list ||
      (proyek ? kategoriProyek(proyek) : [])
    ).join(" ");

    const gabungan = [
      item.nama_proyek,
      proyek?.nama_proyek,
      kategori,
      item.task,
      item.sub_task,
      subTask?.task,
      teksCatatan(item.catatan),
      item.status
    ]
      .join(" ")
      .toLowerCase();

    return gabungan.includes(search);
  });
}

// ======================================================
// RENDER TASK
// ======================================================

function renderTask() {
  const filtered = dataTaskTerfilter();

  const totalPages = Math.max(
    Math.ceil(filtered.length / itemsPerPage),
    1
  );

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;

  const pageItems = filtered.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  if (!pageItems.length) {
    taskTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          Belum ada task.
        </td>
      </tr>
    `;

    renderPagination(totalPages);
    return;
  }

  taskTableBody.innerHTML = pageItems
    .map(item => {
      const proyek = getProyekById(item.proyek_id);

      const kategori = normalisasiKategori(
        item.kategori ||
        item.kategori_list ||
        (proyek ? kategoriProyek(proyek) : [])
      );

      const subTask = getSubTask(item.id);

      const namaSubTask =
        subTask?.task ||
        item.sub_task ||
        "";

      const link = normalisasiLink(item.link);

      const needFollowUp =
        item.need_follow_up === true ||
        item.need_follow_up === "true" ||
        item.status === "Need Follow Up" ||
        Boolean(subTask);

      return `
        <tr>

          <td>
            <div class="project-name">
              ${escapeHTML(
                item.nama_proyek ||
                proyek?.nama_proyek ||
                "-"
              )}
            </div>

            <div class="category-text">
              ${escapeHTML(kategori.join(", ") || "-")}
            </div>
          </td>

          <td>
            <div class="task-name">
              ${escapeHTML(item.task || "-")}
            </div>

            ${
              namaSubTask
                ? `
                  <div class="task-sub-name">
                    ${escapeHTML(namaSubTask)}
                  </div>
                `
                : ""
            }
          </td>

          <td class="task-cell-pic">
            ${escapeHTML(
              item.nama_pic ||
              item.dibuat_oleh ||
              "-"
            )}
          </td>

          <td>
            ${escapeHTML(formatDate(item.target_date))}
          </td>

          <td class="catatan-cell">
            ${renderCatatanTask(item.catatan)}
          </td>

          <td>
            ${
              link
                ? `
                  <a
                    class="task-link"
                    href="${escapeHTML(link)}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Buka Link
                  </a>
                `
                : "-"
            }
          </td>

          <td>
            ${
              needFollowUp
                ? escapeHTML(
                    formatDate(
                      item.tanggal_tindak_lanjut ||
                      subTask?.target_date
                    )
                  )
                : "-"
            }
          </td>

          <td>
            <span
              class="status-badge ${statusClass(item.status)}"
            >
              ${escapeHTML(item.status || "Not Started")}
            </span>
          </td>

          <td>
            <div class="table-actions">

              <button
                type="button"
                class="btn-action btn-edit"
                data-edit-task="${Number(item.id)}"
              >
                Edit
              </button>

              <button
                type="button"
                class="btn-action btn-delete"
                data-delete-task="${Number(item.id)}"
              >
                Hapus
              </button>

            </div>
          </td>

        </tr>
      `;
    })
    .join("");

  renderPagination(totalPages);
}

// ======================================================
// EXPAND / COLLAPSE CATATAN
// ======================================================

taskTableBody.addEventListener("click", event => {
  const toggleButton = event.target.closest(
    "[data-toggle-note]"
  );

  if (!toggleButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const container = toggleButton.closest(
    "[data-note-container]"
  );

  if (!container) {
    return;
  }

  const shortNote = container.querySelector(
    "[data-note-short]"
  );

  const fullNote = container.querySelector(
    "[data-note-full]"
  );

  const sedangTerbuka =
    toggleButton.getAttribute("aria-expanded") === "true";

  shortNote.hidden = !sedangTerbuka;
  fullNote.hidden = sedangTerbuka;

  toggleButton.setAttribute(
    "aria-expanded",
    String(!sedangTerbuka)
  );

  toggleButton.textContent = sedangTerbuka
    ? "Lihat selengkapnya"
    : "Tampilkan lebih sedikit";
});

// ======================================================
// PAGINATION
// ======================================================

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = `
    <button
      type="button"
      class="page-button"
      data-page="${currentPage - 1}"
      ${currentPage === 1 ? "disabled" : ""}
    >
      ‹
    </button>
  `;

  for (let page = 1; page <= totalPages; page++) {
    html += `
      <button
        type="button"
        class="page-button ${
          page === currentPage ? "active" : ""
        }"
        data-page="${page}"
      >
        ${page}
      </button>
    `;
  }

  html += `
    <button
      type="button"
      class="page-button"
      data-page="${currentPage + 1}"
      ${currentPage === totalPages ? "disabled" : ""}
    >
      ›
    </button>
  `;

  pagination.innerHTML = html;
}

pagination.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");

  if (!button || button.disabled) {
    return;
  }

  currentPage = Number(button.dataset.page);

  renderTask();
});

// ======================================================
// SEARCH TASK
// ======================================================

searchTaskInput.addEventListener("input", () => {
  currentPage = 1;
  renderTask();
});

// ======================================================
// PAYLOAD TASK UTAMA
// ======================================================

function buatPayloadParent() {
  const status = needFollowUpInput.checked
    ? "Need Follow Up"
    : statusInput.value;

  return {
    proyek_id: Number(proyekInput.value),
    task: taskInput.value.trim(),
    catatan: sanitasiCatatan(catatanEditor.innerHTML) || null,
    link: normalisasiLink(linkInput.value),
    target_date: targetDateInput.value || null,
    status,
    need_follow_up: needFollowUpInput.checked,
    tanggal_tindak_lanjut: needFollowUpInput.checked
      ? (tanggalTindakLanjutInput.value || null)
      : null,
    parent_task_id: null
  };
}

// ======================================================
// PAYLOAD SUBTASK
// ======================================================

function buatPayloadSubTask(parentTaskId) {
  return {
    proyek_id: Number(proyekInput.value),
    task: subTaskInput.value.trim(),
    catatan: null,
    link: normalisasiLink(linkInput.value),
    target_date: tanggalTindakLanjutInput.value,
    status: "Not Started",
    need_follow_up: false,
    tanggal_tindak_lanjut: null,
    parent_task_id: Number(parentTaskId)
  };
}

// ======================================================
// VALIDASI FORM
// ======================================================

function validasiForm() {
  const proyekId = Number(proyekInput.value);

  if (
    !Number.isInteger(proyekId) ||
    proyekId <= 0
  ) {
    alert("Pilih Nama Proyek.");

    (
      document.getElementById("proyekSearchInput") ||
      proyekInput
    ).focus();

    return false;
  }

  if (!targetDateInput.value) {
    alert("Target Date wajib diisi.");
    targetDateInput.focus();
    return false;
  }

  if (!taskInput.value.trim()) {
    alert("Task Utama wajib diisi.");
    taskInput.focus();
    return false;
  }

  if (linkInput.value.trim()) {
    const link = normalisasiLink(linkInput.value);

    try {
      new URL(link);
    } catch (error) {
      alert("Format Link tidak valid.");
      linkInput.focus();
      return false;
    }
  }

  if (needFollowUpInput.checked) {
    if (!subTaskInput.value.trim()) {
      alert(
        "Sub Task wajib diisi jika Need Follow Up dipilih."
      );

      subTaskInput.focus();
      return false;
    }

    if (!tanggalTindakLanjutInput.value) {
      alert("Tanggal Tindak Lanjut wajib diisi.");
      tanggalTindakLanjutInput.focus();
      return false;
    }
  }

  return true;
}

// ======================================================
// SIMPAN TASK
// ======================================================

taskForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (!validasiForm()) {
    return;
  }

  const taskId = Number(taskIdInput.value);
  const subTaskId = Number(subTaskIdInput.value);

  const modeEdit =
    Number.isInteger(taskId) &&
    taskId > 0;

  simpanTaskButton.disabled = true;
  simpanTaskButton.textContent = "Menyimpan...";

  try {
    const payloadParent = buatPayloadParent();

    const parentResult = await fetchJSON(
      modeEdit
        ? `/api/task-list/${taskId}`
        : "/api/task-list",
      {
        method: modeEdit ? "PUT" : "POST",
        body: JSON.stringify(payloadParent)
      }
    );

    const parentSaved =
      parentResult.data ||
      parentResult;

    const parentId = Number(
      parentSaved.id ||
      taskId
    );

    if (
      !Number.isInteger(parentId) ||
      parentId <= 0
    ) {
      throw new Error(
        "ID Task Utama tidak ditemukan dari response API."
      );
    }

    if (needFollowUpInput.checked) {
      const payloadSubTask = buatPayloadSubTask(
        parentId
      );

      const editSubTask =
        Number.isInteger(subTaskId) &&
        subTaskId > 0;

      await fetchJSON(
        editSubTask
          ? `/api/task-list/${subTaskId}`
          : "/api/task-list",
        {
          method: editSubTask ? "PUT" : "POST",
          body: JSON.stringify(payloadSubTask)
        }
      );
    }

    alert(
      modeEdit
        ? "Task berhasil diperbarui."
        : "Task berhasil ditambahkan."
    );

    resetTaskForm();

    await loadTask();

  } catch (error) {
    console.error("ERROR SIMPAN TASK:", error);

    alert(error.message);

  } finally {
    simpanTaskButton.disabled = false;

    simpanTaskButton.textContent = modeEdit
      ? "Simpan Perubahan"
      : "Simpan Task";
  }
});

// ======================================================
// EDIT TASK
// ======================================================

window.editTask = function (id) {
  const item = daftarTask.find(
    task => Number(task.id) === Number(id)
  );

  if (!item) {
    alert("Task tidak ditemukan.");
    return;
  }

  const subTask = getSubTask(item.id);

  taskIdInput.value = item.id;
  subTaskIdInput.value = subTask?.id || "";
  proyekInput.value = item.proyek_id || "";

  // Sinkronkan nama pada kolom pencarian.
  proyekInput.dispatchEvent(
    new Event("change", { bubbles: true })
  );

  const proyek = getProyekById(item.proyek_id);

  tampilkanKategori(
    item.kategori ||
    item.kategori_list ||
    (proyek ? kategoriProyek(proyek) : [])
  );

  targetDateInput.value = tanggalInput(item.target_date);
  taskInput.value = item.task || "";
  linkInput.value = item.link || "";

  catatanEditor.innerHTML = sanitasiCatatan(
    item.catatan || ""
  );

  const needFollowUp =
    item.need_follow_up === true ||
    item.need_follow_up === "true" ||
    item.status === "Need Follow Up" ||
    Boolean(subTask);

  needFollowUpInput.checked = needFollowUp;

  subTaskInput.value =
    subTask?.task ||
    item.sub_task ||
    (
      needFollowUp
        ? namaSubTaskOtomatis(item.task)
        : ""
    );

  tanggalTindakLanjutInput.value = tanggalInput(
    item.tanggal_tindak_lanjut ||
    subTask?.target_date
  );

  statusInput.value = needFollowUp
    ? "Need Follow Up"
    : (item.status || "Not Started");

  aturFollowUp({
    isiSubTaskOtomatis: false,
    kosongkanJikaNonaktif: false
  });

  formTitle.textContent = "Edit Task";
  simpanTaskButton.textContent = "Simpan Perubahan";
  batalButton.hidden = false;

  taskFormCard.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
};

// ======================================================
// HAPUS TASK
// ======================================================

window.deleteTask = async function (id) {
  const item = daftarTask.find(
    task => Number(task.id) === Number(id)
  );

  if (!item) {
    alert("Task tidak ditemukan.");
    return;
  }

  const konfirmasi = confirm(
    `Apakah Anda yakin ingin menghapus Task "${item.task}"?`
  );

  if (!konfirmasi) {
    return;
  }

  try {
    await fetchJSON(
      `/api/task-list/${encodeURIComponent(id)}`,
      {
        method: "DELETE"
      }
    );

    alert("Task berhasil dihapus.");

    await loadTask();

  } catch (error) {
    console.error("ERROR HAPUS TASK:", error);

    alert(error.message);
  }
};

// ======================================================
// EVENT BUTTON TABLE
// ======================================================

taskTableBody.addEventListener("click", event => {
  const editButton = event.target.closest(
    "[data-edit-task]"
  );

  if (editButton) {
    window.editTask(editButton.dataset.editTask);
    return;
  }

  const deleteButton = event.target.closest(
    "[data-delete-task]"
  );

  if (deleteButton) {
    window.deleteTask(deleteButton.dataset.deleteTask);
  }
});

// ======================================================
// RESET FORM
// ======================================================

function resetTaskForm() {
  taskForm.reset();

  taskIdInput.value = "";
  subTaskIdInput.value = "";
  catatanEditor.innerHTML = "";

  kategoriContainer.innerHTML = `
    <span class="category-placeholder">
      Pilih proyek dahulu
    </span>
  `;

  needFollowUpInput.checked = false;
  subTaskInput.value = "";
  tanggalTindakLanjutInput.value = "";
  tanggalTindakLanjutInput.disabled = true;
  statusInput.value = "Not Started";

  aturFollowUp({
    isiSubTaskOtomatis: false
  });

  formTitle.textContent = "Tambah Task";
  simpanTaskButton.textContent = "Simpan Task";
  batalButton.hidden = true;
}

batalButton.addEventListener("click", () => {
  resetTaskForm();
});

// ======================================================
// INIT TASK
// ======================================================

async function init() {
  try {
    await loadProyek();
    await loadTask();

    const urlParams = new URLSearchParams(
      window.location.search
    );

    const taskIdFromUrl = Number(
      urlParams.get("task_id")
    );

    if (
      Number.isInteger(taskIdFromUrl) &&
      taskIdFromUrl > 0
    ) {
      window.editTask(taskIdFromUrl);
    }

  } catch (error) {
    console.error("ERROR INIT TASK LIST:", error);

    taskTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          ${escapeHTML(error.message)}
        </td>
      </tr>
    `;
  }
}

// ======================================================
// ELEMENT NOTIFIKASI
// ======================================================

const notificationButton = document.getElementById(
  "notificationButton"
);

const notificationBadge = document.getElementById(
  "notificationBadge"
);

const notificationDropdown = document.getElementById(
  "notificationDropdown"
);

const notificationList = document.getElementById(
  "notificationList"
);

const notificationSummary = document.getElementById(
  "notificationSummary"
);

const notificationRefresh = document.getElementById(
  "notificationRefresh"
);

let daftarNotifikasiTask = [];

// ======================================================
// FORMAT TANGGAL NOTIFIKASI
// ======================================================

function formatTanggalNotifikasi(value) {
  if (!value) {
    return "-";
  }

  const tanggalString = String(value).substring(0, 10);
  const bagian = tanggalString.split("-");

  if (bagian.length !== 3) {
    return "-";
  }

  const date = new Date(
    Number(bagian[0]),
    Number(bagian[1]) - 1,
    Number(bagian[2])
  );

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

// ======================================================
// RENDER NOTIFIKASI
// ======================================================

function renderNotifikasiTask() {
  const jumlahBelumDibaca = daftarNotifikasiTask.filter(
    item => !item.dibaca && !item.is_read
  ).length;

  notificationBadge.textContent =
    jumlahBelumDibaca > 99
      ? "99+"
      : String(jumlahBelumDibaca);

  notificationBadge.hidden = jumlahBelumDibaca === 0;

  notificationSummary.textContent =
    jumlahBelumDibaca > 0
      ? `${jumlahBelumDibaca} notifikasi belum dibaca`
      : "Tidak ada notifikasi baru";

  if (daftarNotifikasiTask.length === 0) {
    notificationList.innerHTML = `
      <div class="notification-empty">
        Belum ada task yang perlu ditindaklanjuti.
      </div>
    `;

    return;
  }

  notificationList.innerHTML = daftarNotifikasiTask
    .map(item => {
      const taskId = Number(
        item.task_id ||
        item.id
      );

      const notificationId = Number(
        item.notification_id ||
        item.notifikasi_id ||
        item.id
      );

      const belumDibaca =
        !item.dibaca &&
        !item.is_read;

      return `
        <button
          type="button"
          class="notification-item ${
            belumDibaca ? "unread" : ""
          }"
          data-notification-id="${notificationId}"
          data-notification-task-id="${taskId}"
        >

          <span class="notification-dot"></span>

          <span>

            <span class="notification-project">
              ${escapeHTML(item.nama_proyek || "Proyek")}
            </span>

            <span class="notification-title">
              ${escapeHTML(
                item.task ||
                item.nama_task ||
                "Task perlu ditindaklanjuti"
              )}
            </span>

            <span class="notification-message">
              Ada task yang perlu dilakukan update
              dan tindak lanjut.
            </span>

            <span class="notification-date">
              Tindak lanjut:
              ${escapeHTML(
                formatTanggalNotifikasi(
                  item.tanggal_tindak_lanjut
                )
              )}
            </span>

          </span>

        </button>
      `;
    })
    .join("");
}

// ======================================================
// LOAD NOTIFIKASI
// ======================================================

async function loadNotifikasiTask() {
  if (!notificationList) {
    return;
  }

  notificationList.innerHTML = `
    <div class="notification-empty">
      Memuat notifikasi...
    </div>
  `;

  try {
    const result = await fetchJSON(
      "/api/notifikasi/task"
    );

    daftarNotifikasiTask = Array.isArray(result)
      ? result
      : (
          Array.isArray(result.data)
            ? result.data
            : (
                Array.isArray(result.notifikasi)
                  ? result.notifikasi
                  : []
              )
        );

    renderNotifikasiTask();

  } catch (error) {
    console.error("ERROR LOAD NOTIFIKASI:", error);

    notificationList.innerHTML = `
      <div class="notification-empty">
        ${escapeHTML(error.message)}
      </div>
    `;

    notificationSummary.textContent =
      "Notifikasi gagal dimuat";
  }
}

// ======================================================
// BUKA / TUTUP NOTIFIKASI
// ======================================================

notificationButton?.addEventListener("click", event => {
  event.stopPropagation();

  const akanDibuka = notificationDropdown.hidden;

  notificationDropdown.hidden = !akanDibuka;

  notificationButton.classList.toggle(
    "active",
    akanDibuka
  );

  notificationButton.setAttribute(
    "aria-expanded",
    String(akanDibuka)
  );

  if (akanDibuka) {
    loadNotifikasiTask();
  }
});

// ======================================================
// REFRESH NOTIFIKASI
// ======================================================

notificationRefresh?.addEventListener("click", event => {
  event.stopPropagation();

  loadNotifikasiTask();
});

// ======================================================
// KLIK NOTIFIKASI
// ======================================================

notificationList?.addEventListener("click", async event => {
  const item = event.target.closest(
    "[data-notification-task-id]"
  );

  if (!item) {
    return;
  }

  const taskId = Number(
    item.dataset.notificationTaskId
  );

  const notificationId = Number(
    item.dataset.notificationId
  );

  if (
    Number.isInteger(notificationId) &&
    notificationId > 0
  ) {
    try {
      await fetchJSON(
        `/api/notifikasi/task/${notificationId}/baca`,
        {
          method: "PUT"
        }
      );

    } catch (error) {
      console.warn(
        "Gagal menandai notifikasi:",
        error
      );
    }
  }

  notificationDropdown.hidden = true;
  notificationButton.classList.remove("active");

  if (
    Number.isInteger(taskId) &&
    taskId > 0
  ) {
    const taskDitemukan = daftarTask.some(
      task => Number(task.id) === taskId
    );

    if (taskDitemukan) {
      window.editTask(taskId);
    } else {
      window.location.href =
        `/task.html?task_id=${encodeURIComponent(taskId)}`;
    }
  }
});

// ======================================================
// TUTUP NOTIFIKASI SAAT KLIK DI LUAR
// ======================================================

document.addEventListener("click", event => {
  const notificationContainer = document.getElementById(
    "taskNotification"
  );

  if (
    notificationContainer &&
    !notificationContainer.contains(event.target)
  ) {
    notificationDropdown.hidden = true;

    notificationButton?.classList.remove("active");

    notificationButton?.setAttribute(
      "aria-expanded",
      "false"
    );
  }
});

// ======================================================
// TUTUP NOTIFIKASI DENGAN ESCAPE
// ======================================================

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    notificationDropdown.hidden = true;

    notificationButton?.classList.remove("active");

    notificationButton?.setAttribute(
      "aria-expanded",
      "false"
    );
  }
});

// ======================================================
// PENCARIAN NAMA PROYEK
//
// Ketik nama -> hasil muncul -> klik hasil.
// Select #proyekId tetap menyimpan ID proyek.
// ======================================================

(() => {

  const placeholderText =
    /^pilih\s+(?:nama\s+)?proyek\s*\*?$/i;

  function pasangStyle() {
    if (document.getElementById("proyek-search-style")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "proyek-search-style";

    style.textContent = `
      .proyek-search {
        position: relative;
        width: 100%;
        min-width: 0;
      }

      .proyek-search-input {
        box-sizing: border-box;
        width: 100%;
        padding: 11px 13px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #fff;
        color: #172033;
        font: inherit;
      }

      .proyek-search-input:focus {
        outline: 2px solid #93c5fd;
        border-color: #2563eb;
      }

      .proyek-search-input:disabled {
        background: #f1f5f9;
        cursor: not-allowed;
      }

      .proyek-search-list {
        position: absolute;
        top: calc(100% + 5px);
        left: 0;
        right: 0;
        z-index: 1000;
        max-height: 280px;
        overflow-y: auto;
        border: 1px solid #dbe2ea;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 8px 24px rgba(15, 23, 42, .12);
      }

      .proyek-search-list[hidden] {
        display: none;
      }

      .proyek-search-option {
        display: block;
        box-sizing: border-box;
        width: 100%;
        padding: 11px 13px;
        border: 0;
        border-bottom: 1px solid #edf0f5;
        background: #fff;
        color: #172033;
        text-align: left;
        font: inherit;
        white-space: normal;
        overflow-wrap: anywhere;
        cursor: pointer;
      }

      .proyek-search-option:hover,
      .proyek-search-option[aria-selected="true"] {
        background: #eff6ff;
        color: #1d4ed8;
      }

      .proyek-search-message {
        padding: 11px 13px;
        color: #64748b;
        font: inherit;
      }
    `;

    document.head.appendChild(style);
  }

  function ubahSelect(select) {
    if (
      select.dataset.proyekSearchReady ||
      select.multiple
    ) {
      return;
    }

    select.dataset.proyekSearchReady = "true";

    pasangStyle();

    const wrapper = document.createElement("div");

    wrapper.className = "proyek-search";

    const input = document.createElement("input");

    input.type = "text";
    input.id = "proyekSearchInput";
    input.className = "proyek-search-input";
    input.placeholder = "Ketik nama proyek...";
    input.autocomplete = "off";
    input.required = select.required;
    input.disabled = select.disabled;

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-label", "Cari nama proyek");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");

    const list = document.createElement("div");

    list.id = "proyekSearchList";
    list.className = "proyek-search-list";
    list.setAttribute("role", "listbox");
    list.hidden = true;

    input.setAttribute("aria-controls", list.id);

    const labels = Array.from(select.labels || []);

    select.before(wrapper);
    wrapper.append(input, list, select);

    select.hidden = true;
    select.style.display = "none";
    select.required = false;

    for (const label of labels) {
      if (
        label.htmlFor === select.id &&
        select.id
      ) {
        label.htmlFor = input.id;
      }
    }

    let internalChange = false;
    let chosenLabel = "";
    let active = -1;
    let buttons = [];

    function validOption(option) {
      return (
        option &&
        option.value !== "" &&
        !option.disabled &&
        !option.parentElement?.disabled &&
        !placeholderText.test(
          option.textContent.trim()
        )
      );
    }

    function close() {
      list.hidden = true;

      input.setAttribute(
        "aria-expanded",
        "false"
      );

      input.removeAttribute(
        "aria-activedescendant"
      );

      active = -1;
    }

    function validate() {
      const option = select.options[
        select.selectedIndex
      ];

      const selected =
        validOption(option) &&
        input.value === option.textContent.trim();

      input.setCustomValidity(
        input.value && !selected
          ? "Klik salah satu proyek dari hasil pencarian."
          : ""
      );
    }

    function sync(force = false) {
      input.disabled = select.disabled;

      const option = select.options[
        select.selectedIndex
      ];

      if (validOption(option)) {
        chosenLabel = option.textContent.trim();
        input.value = chosenLabel;

      } else if (force || chosenLabel) {
        chosenLabel = "";
        input.value = "";
      }

      validate();
    }

    function dispatchChange() {
      internalChange = true;

      try {
        select.dispatchEvent(
          new Event("change", {
            bubbles: true
          })
        );
      } finally {
        internalChange = false;
      }
    }

    function choose(option) {
      select.value = option.value;

      chosenLabel = option.textContent.trim();
      input.value = chosenLabel;

      validate();
      close();

      // Menjalankan event lama untuk mengisi kategori.
      dispatchChange();

      sync();
    }

    function render() {
      list.replaceChildren();

      buttons = [];
      active = -1;

      input.removeAttribute(
        "aria-activedescendant"
      );

      const query = input.value
        .trim()
        .toLocaleLowerCase("id-ID");

      if (!query || input.disabled) {
        close();
        return;
      }

      const matches = Array.from(select.options)
        .filter(option => {
          return (
            validOption(option) &&
            option.textContent
              .trim()
              .toLocaleLowerCase("id-ID")
              .includes(query)
          );
        });

      for (
        const [index, option]
        of matches.slice(0, 50).entries()
      ) {
        const button = document.createElement("button");

        button.type = "button";
        button.tabIndex = -1;

        button.id = `${list.id}-option-${index}`;
        button.className = "proyek-search-option";

        button.setAttribute("role", "option");

        button.setAttribute(
          "aria-selected",
          "false"
        );

        button.textContent =
          option.textContent.trim();

        button.addEventListener(
          "mousedown",
          event => {
            event.preventDefault();
          }
        );

        button.addEventListener("click", () => {
          choose(option);
        });

        list.appendChild(button);
        buttons.push(button);
      }

      if (
        !matches.length ||
        matches.length > 50
      ) {
        const message = document.createElement("div");

        message.className = "proyek-search-message";

        message.textContent = matches.length
          ? "Menampilkan 50 hasil. Ketik nama lebih lengkap untuk mempersempit pencarian."
          : "Proyek tidak ditemukan.";

        list.appendChild(message);
      }

      list.hidden = false;

      input.setAttribute(
        "aria-expanded",
        "true"
      );
    }

    // ==================================================
    // SAAT NAMA PROYEK DIKETIK
    // ==================================================

    input.addEventListener("input", () => {
      const previousValue = select.value;

      const placeholder = Array.from(select.options)
        .findIndex(option => {
          return (
            option.value === "" ||
            placeholderText.test(
              option.textContent.trim()
            )
          );
        });

      // Nama baru harus dipilih lagi dari hasil.
      select.selectedIndex = placeholder;
      chosenLabel = "";

      validate();

      if (previousValue !== select.value) {
        dispatchChange();
      }

      render();
    });

    input.addEventListener("focus", render);

    input.addEventListener("blur", close);

    // ==================================================
    // PILIH DENGAN KEYBOARD
    // ==================================================

    input.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (
        event.key === "Enter" &&
        !list.hidden &&
        active >= 0
      ) {
        event.preventDefault();

        buttons[active].click();
        return;
      }

      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp"
      ) {
        return;
      }

      event.preventDefault();

      if (list.hidden) {
        render();
      }

      if (!buttons.length) {
        return;
      }

      active = event.key === "ArrowDown"
        ? (active + 1) % buttons.length
        : (
            active <= 0
              ? buttons.length - 1
              : active - 1
          );

      buttons.forEach((button, index) => {
        button.setAttribute(
          "aria-selected",
          String(index === active)
        );
      });

      input.setAttribute(
        "aria-activedescendant",
        buttons[active].id
      );

      buttons[active].scrollIntoView({
        block: "nearest"
      });
    });

    // ==================================================
    // SINKRONISASI SAAT EDIT TASK
    // ==================================================

    select.addEventListener("change", () => {
      if (!internalChange) {
        sync(true);
        close();
      }
    });

    // ==================================================
    // SINKRONISASI SAAT DATA PROYEK SELESAI DIMUAT
    // ==================================================

    new MutationObserver(() => {
      sync();

      if (
        document.activeElement === input &&
        !list.hidden
      ) {
        render();
      }

      if (input.disabled) {
        close();
      }
    }).observe(select, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "disabled",
        "selected",
        "value",
        "label"
      ]
    });

    // ==================================================
    // SINKRONISASI SAAT RESET FORM
    // ==================================================

    select.form?.addEventListener("reset", () => {
      setTimeout(() => {
        sync(true);
        close();
      }, 0);
    });

    sync(true);
  }

  function initPencarian() {
    const select = document.getElementById("proyekId");

    if (
      select &&
      select.tagName === "SELECT"
    ) {
      ubahSelect(select);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initPencarian,
      { once: true }
    );
  } else {
    initPencarian();
  }

})();

// ======================================================
// JALANKAN
// ======================================================

loadNotifikasiTask();
init();