// ========================================
// ELEMENT
// ========================================

const form = document.getElementById("partnerForm");
const partnerTable = document.getElementById("partnerTable");
const searchInput = document.getElementById("searchInput");
const submitButton = document.getElementById("submitButton");
const cancelEdit = document.getElementById("cancelEdit");
const formTitle = document.getElementById("formTitle");

const picList = document.getElementById("picList");
const addPicButton = document.getElementById("addPic");
const initialInput = document.getElementById("inisial");

const partnerModal = document.getElementById("partnerModal");
const openModalButton =
  document.getElementById("openPartnerModal");
const closeModalButton =
  document.getElementById("closePartnerModal");

const partnerFields = [
  "nama_partner",
  "inisial",
  "jenis_partner",
  "alamat",
  "status"
];

let allPartners = [];
let editId = null;
let currentPage = 1;
let picSequence = 0;
let saving = false;

const itemsPerPage = 10;

// ========================================
// HELPER
// ========================================

function escapeHtml(value) {
  const characters = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value ?? "").replace(
    /[&<>"']/g,
    character => characters[character]
  );
}

function formatTanggal(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNoHP(value) {
  let number = String(value ?? "")
    .trim()
    .replace(/[\s\-()]/g, "");

  if (number.startsWith("+62")) {
    number = number.substring(1);
  }

  if (number.startsWith("0")) {
    number = "62" + number.substring(1);
  }

  return number;
}

async function request(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  let result = null;

  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("Respons API bukan JSON yang valid.");
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.error ||
      `Permintaan gagal (${response.status}).`
    );
  }

  return result;
}

// ========================================
// MODAL
// ========================================

function showPartnerModal() {
  if (!partnerModal.open) {
    partnerModal.showModal();
  }

  partnerModal.scrollTop = 0;
  document.getElementById("nama_partner").focus();
}

function hidePartnerModal() {
  if (partnerModal.open) {
    partnerModal.close();
  }
}

function cancelPartnerForm() {
  if (saving) return;

  resetForm();
}

openModalButton.addEventListener("click", () => {
  if (saving) return;

  resetForm();
  showPartnerModal();
});

closeModalButton.addEventListener(
  "click",
  cancelPartnerForm
);

cancelEdit.addEventListener(
  "click",
  cancelPartnerForm
);

// Escape menutup modal, kecuali saat menyimpan.
partnerModal.addEventListener("cancel", event => {
  event.preventDefault();
  cancelPartnerForm();
});

// Klik backdrop menutup modal.
partnerModal.addEventListener("click", event => {
  if (saving || event.target !== partnerModal) return;

  const rect = partnerModal.getBoundingClientRect();

  const outside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;

  if (outside) {
    cancelPartnerForm();
  }
});

// ========================================
// INISIAL OTOMATIS KAPITAL
// ========================================

initialInput.addEventListener("input", event => {
  const input = event.target;

  const start = input.selectionStart;
  const end = input.selectionEnd;

  input.value = input.value.toUpperCase();
  input.setSelectionRange(start, end);
});

// ========================================
// MULTI PIC
// ========================================

function getPics(partner) {
  if (Array.isArray(partner.pics)) {
    return partner.pics;
  }

  // Kompatibilitas data lama.
  if (
    partner.nama_pic ||
    partner.no_pic ||
    partner.email_pic
  ) {
    return [{
      nama_pic: partner.nama_pic || "",
      no_pic: partner.no_pic || "",
      email_pic: partner.email_pic || ""
    }];
  }

  return [];
}

function renumberPics() {
  [...picList.children].forEach((row, index) => {
    row.querySelector("legend").textContent =
      `PIC ${index + 1}`;
  });
}

function addPic(pic = {}, focus = false) {
  const key = ++picSequence;

  const row = document.createElement("fieldset");
  row.className = "pic-row";

  row.innerHTML = `
    <legend></legend>

    <div class="pic-fields">
      <div class="form-group">
        <label for="pic-name-${key}">
          Nama PIC
        </label>

        <input
          type="text"
          id="pic-name-${key}"
          data-field="nama_pic"
          placeholder="Nama PIC"
          value="${escapeHtml(pic.nama_pic)}"
        >
      </div>

      <div class="form-group">
        <label for="pic-phone-${key}">
          No. PIC
        </label>

        <input
          type="tel"
          id="pic-phone-${key}"
          data-field="no_pic"
          placeholder="081234567890"
          maxlength="20"
          value="${escapeHtml(pic.no_pic)}"
        >
      </div>

      <div class="form-group">
        <label for="pic-email-${key}">
          Email PIC
        </label>

        <input
          type="email"
          id="pic-email-${key}"
          data-field="email_pic"
          placeholder="pic@partner.com"
          value="${escapeHtml(pic.email_pic)}"
        >
      </div>

      <button type="button" class="remove-pic">
        Hapus PIC
      </button>
    </div>
  `;

  row.querySelector(".remove-pic")
    .addEventListener("click", () => {
      if (saving) return;

      row.remove();
      renumberPics();
      addPicButton.focus();
    });

  // Bersihkan pesan validasi setelah baris diubah.
  row.addEventListener("input", () => {
    row.querySelector('[data-field="nama_pic"]')
      .setCustomValidity("");
  });

  picList.appendChild(row);
  renumberPics();

  if (focus) {
    row.querySelector("input").focus();
  }
}

addPicButton.addEventListener("click", () => {
  if (!saving) {
    addPic({}, true);
  }
});

function readPics() {
  const pics = [];

  for (const row of picList.children) {
    const nameInput = row.querySelector(
      '[data-field="nama_pic"]'
    );

    const phoneInput = row.querySelector(
      '[data-field="no_pic"]'
    );

    const emailInput = row.querySelector(
      '[data-field="email_pic"]'
    );

    const pic = {
      nama_pic: nameInput.value.trim(),
      no_pic: formatNoHP(phoneInput.value),
      email_pic: emailInput.value.trim()
    };

    if (
      !pic.nama_pic &&
      !pic.no_pic &&
      !pic.email_pic
    ) {
      continue;
    }

    if (!pic.nama_pic) {
      nameInput.setCustomValidity(
        "Isi nama PIC untuk kontak ini."
      );

      nameInput.reportValidity();
      return null;
    }

    pics.push(pic);
  }

  return pics;
}

// ========================================
// LOAD DATA
// ========================================

async function loadPartners() {
  const result = await request("/api/partner");

  if (!Array.isArray(result)) {
    throw new Error(
      "GET /api/partner harus mengembalikan array partner."
    );
  }

  allPartners = result;
  applySearch();
}

// ========================================
// PAGINATION
// ========================================

function renderKategoriPagination(data) {
  const totalPages = Math.max(
    1,
    Math.ceil(data.length / itemsPerPage)
  );

  currentPage = Math.max(
    1,
    Math.min(currentPage, totalPages)
  );

  const start = (currentPage - 1) * itemsPerPage;

  tampilkanPartner(
    data.slice(start, start + itemsPerPage)
  );

  createPagination({
    containerId: "pagination",
    currentPage,
    totalItems: data.length,
    itemsPerPage,

    onPageChange: page => {
      currentPage = page;
      applySearch();
    }
  });
}

// ========================================
// TAMPILKAN TABEL
// ========================================

function tampilkanPartner(partners) {
  partnerTable.replaceChildren();

  if (partners.length === 0) {
    partnerTable.innerHTML = `
      <tr>
        <td colspan="11" class="empty-data">
          Data partner tidak ditemukan
        </td>
      </tr>
    `;

    return;
  }

  partners.forEach((partner, index) => {
    const nomorUrut =
      (currentPage - 1) * itemsPerPage + index + 1;
    const pics = getPics(partner);

    const picColumn = field => {
      if (!pics.length) return "-";

      return pics.map((pic, index) => `
        <span class="pic-cell">
          ${index + 1}.
          ${escapeHtml(pic[field] || "-")}
        </span>
      `).join("");
    };

    const statusClass =
      partner.status === "Nonaktif"
        ? "status-nonaktif"
        : "status-aktif";

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${nomorUrut}</td>

      <td>
        <strong>
          ${escapeHtml(partner.nama_partner || "-")}
        </strong>
      </td>

      <td>
        ${escapeHtml(
          String(partner.inisial || "-").toUpperCase()
        )}
      </td>

      <td>
        ${escapeHtml(partner.jenis_partner || "-")}
      </td>

      <td>${picColumn("nama_pic")}</td>
      <td>${picColumn("no_pic")}</td>
      <td>${picColumn("email_pic")}</td>

      <td>
        <span class="status ${statusClass}">
          ${escapeHtml(partner.status || "-")}
        </span>
      </td>

      <td>
        ${escapeHtml(formatTanggal(partner.created_at))}
      </td>

      <td>
        ${escapeHtml(formatTanggal(partner.updated_at))}
      </td>

      <td>
        <button type="button" class="btn-edit">
          Edit
        </button>

        <button type="button" class="btn-delete">
          Hapus
        </button>
      </td>
    `;

    row.querySelector(".btn-edit")
      .addEventListener("click", () => {
        if (!saving) editPartner(partner.id);
      });

    row.querySelector(".btn-delete")
      .addEventListener("click", () => {
        if (!saving) deletePartner(partner.id);
      });

    partnerTable.appendChild(row);
  });
}

// ========================================
// PENCARIAN
// ========================================

function applySearch() {
  const keyword = searchInput.value
    .trim()
    .toLowerCase();

  const hasil = allPartners.filter(partner => {
    const values = [
      partner.nama_partner,
      partner.inisial,
      partner.jenis_partner,
      partner.status,

      ...getPics(partner).flatMap(pic => [
        pic.nama_pic,
        pic.no_pic,
        pic.email_pic
      ])
    ];

    return values.some(value => {
      return String(value ?? "")
        .toLowerCase()
        .includes(keyword);
    });
  });

  renderKategoriPagination(hasil);
}

searchInput.addEventListener("input", () => {
  currentPage = 1;
  applySearch();
});

// ========================================
// RESET FORM
// ========================================

function resetForm() {
  form.reset();
  editId = null;

  document.getElementById("status").value = "Aktif";

  picList.replaceChildren();
  addPic();

  submitButton.textContent = "+ Simpan Partner";
  formTitle.textContent = "Tambah Partner";

  hidePartnerModal();
}

// ========================================
// EDIT PARTNER
// ========================================

function editPartner(id) {
  const partner = allPartners.find(
    item => String(item.id) === String(id)
  );

  if (!partner) {
    alert("Data partner tidak ditemukan.");
    return;
  }

  // Bersihkan isian dan validasi sebelumnya.
  resetForm();

  editId = partner.id;

  partnerFields.forEach(field => {
    document.getElementById(field).value =
      partner[field] ||
      (field === "status" ? "Aktif" : "");
  });

  initialInput.value = initialInput.value.toUpperCase();

  picList.replaceChildren();

  getPics(partner).forEach(pic => {
    addPic(pic);
  });

  submitButton.textContent = "Simpan Perubahan";
  formTitle.textContent = "Edit Partner";

  showPartnerModal();
}

// ========================================
// VERIFIKASI DAFTAR PIC
// ========================================

function picSignature(pics) {
  const contacts = pics.map(pic => [
    String(pic.nama_pic || "").trim(),
    formatNoHP(pic.no_pic),
    String(pic.email_pic || "").trim().toLowerCase()
  ]);

  contacts.sort((a, b) => {
    return JSON.stringify(a).localeCompare(
      JSON.stringify(b)
    );
  });

  return JSON.stringify(contacts);
}

// ========================================
// SIMPAN / UPDATE
// ========================================

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (saving) return;

  const pics = readPics();

  if (pics === null) return;

  const payload = {};

  partnerFields.forEach(field => {
    payload[field] = document
      .getElementById(field)
      .value
      .trim();
  });

  payload.inisial = payload.inisial.toUpperCase();
  payload.pics = pics;

  if (!payload.nama_partner) {
    alert("Nama partner wajib diisi.");
    document.getElementById("nama_partner").focus();
    return;
  }

  const wasEdit = editId !== null;

  saving = true;

  const previousDisabled = [
    ...form.elements,
    closeModalButton
  ].map(element => [element, element.disabled]);

  previousDisabled.forEach(([element]) => {
    element.disabled = true;
  });

  submitButton.textContent = "Menyimpan...";

  try {
    const url = wasEdit
      ? `/api/partner/${encodeURIComponent(editId)}`
      : "/api/partner";

    const result = await request(url, {
      method: wasEdit ? "PUT" : "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    });

    const savedId = wasEdit
      ? editId
      : result?.id;

    if (savedId == null) {
      alert(
        "API merespons sukses tetapi tidak mengembalikan " +
        "id partner. Periksa daftar sebelum menyimpan " +
        "ulang agar tidak membuat duplikat."
      );

      await loadPartners();
      return;
    }

    // Jika verifikasi gagal, simpan ulang menggunakan PUT.
    editId = savedId;
    formTitle.textContent = "Edit Partner";

    await loadPartners();

    const savedPartner = allPartners.find(
      item => String(item.id) === String(savedId)
    );

    const verified =
      savedPartner &&
      Array.isArray(savedPartner.pics) &&
      picSignature(savedPartner.pics) ===
        picSignature(pics);

    if (!verified) {
      alert(
        "Daftar PIC belum terverifikasi. Pastikan API " +
        "menyimpan dan mengembalikan seluruh array pics. " +
        "Isian form dipertahankan."
      );

      return;
    }

    resetForm();

    alert(
      wasEdit
        ? "Data partner dan PIC berhasil diubah."
        : "Data partner dan PIC berhasil ditambahkan."
    );
  } catch (error) {
    alert(
      "Penyimpanan/verifikasi belum selesai: " +
      error.message +
      " Periksa daftar sebelum mencoba kembali."
    );
  } finally {
    saving = false;

    previousDisabled.forEach(([element, disabled]) => {
      element.disabled = disabled;
    });

    submitButton.textContent = editId !== null
      ? "Simpan Perubahan"
      : "+ Simpan Partner";
  }
});

// ========================================
// HAPUS PARTNER
// ========================================

async function deletePartner(id) {
  const partner = allPartners.find(
    item => String(item.id) === String(id)
  );

  const nama = partner?.nama_partner || "partner ini";

  const yakin = confirm(
    `Yakin ingin menghapus ${nama} beserta seluruh PIC-nya?`
  );

  if (!yakin) return;

  try {
    await request(
      `/api/partner/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );

    if (String(editId) === String(id)) {
      resetForm();
    }

    await loadPartners();

    alert("Data partner berhasil dihapus.");
  } catch (error) {
    alert(
      "Gagal menghapus/memuat ulang: " + error.message
    );
  }
}
// ========================================
// SESUAIKAN KONTEN DENGAN LEBAR SIDEBAR
// ========================================

function setupPartnerSidebarLayout() {
  const container =
    document.getElementById("sidebarContainer");

  if (!container) return;

  let activeSidebar = null;
  let frame = null;

  const resizeObserver = new ResizeObserver(() => {
    scheduleUpdate();
  });

  function getSidebarElement() {
    return (
      container.querySelector(
        "#sidebar, .sidebar, aside, nav"
      ) ||
      container.firstElementChild ||
      container
    );
  }

  function updateLayout() {
    frame = null;

    const sidebar = getSidebarElement();

    // Sidebar bisa dimuat belakangan oleh sidebar.js.
    if (sidebar !== activeSidebar) {
      if (activeSidebar) {
        resizeObserver.unobserve(activeSidebar);
      }

      activeSidebar = sidebar;
      resizeObserver.observe(activeSidebar);
    }

    let occupiedWidth = 0;

    if (window.innerWidth > 768) {
      const rect = sidebar.getBoundingClientRect();
      const style = getComputedStyle(sidebar);

      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0;

      if (visible) {
        // Mengikuti sisi kanan sidebar, termasuk
        // bila sidebar digeser menggunakan transform.
        occupiedWidth = Math.max(
          0,
          Math.min(rect.right, window.innerWidth)
        );
      }
    }

    document.documentElement.style.setProperty(
      "--partner-sidebar-width",
      `${Math.round(occupiedWidth)}px`
    );
  }

  function scheduleUpdate() {
    if (frame !== null) return;

    frame = requestAnimationFrame(updateLayout);
  }

  // Pantau sidebar yang dimuat atau diubah.
  const mutationObserver = new MutationObserver(() => {
    scheduleUpdate();
  });

  mutationObserver.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden"]
  });

  // Beberapa implementasi menyimpan status minimize
  // pada body atau pembungkus aplikasi.
  const layoutObserver = new MutationObserver(() => {
    scheduleUpdate();
  });

  const layout = document.querySelector(".app-layout");

  [document.documentElement, document.body, layout]
    .filter(Boolean)
    .forEach(element => {
      layoutObserver.observe(element, {
        attributes: true,
        attributeFilter: ["class", "style"]
      });
    });

  // Perbarui lagi setelah animasi sidebar selesai.
  container.addEventListener(
    "transitionend",
    scheduleUpdate
  );

  window.addEventListener("resize", scheduleUpdate);

  scheduleUpdate();
}

setupPartnerSidebarLayout();

// ========================================
// START
// ========================================

resetForm();

loadPartners().catch(error => {
  partnerTable.innerHTML = `
    <tr>
      <td colspan="11" class="empty-data">
        Gagal memuat data partner.
        Muat ulang halaman untuk mencoba lagi.
      </td>
    </tr>
  `;

  alert(error.message);
});