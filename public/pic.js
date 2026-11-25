const form =
  document.getElementById("picForm");

const picTable =
  document.getElementById("picTable");

const searchInput =
  document.getElementById("searchInput");

const submitButton =
  document.getElementById("submitButton");

const cancelButton =
  document.getElementById("cancelButton");

const formTitle =
  document.getElementById("formTitle");

const roleSelect = document.getElementById("role");

let allPIC = [];
let editId = null;
let canManageRoles = false;

function isAdminRole(role) {
  return ["admin", "administrator"].includes(String(role || "").trim().toLowerCase());
}

function loadRoleOptions() {
  const selectedRole = roleSelect.value;
  const roles = new Set(allPIC.map(pic => pic.role).filter(role => role?.trim()));
  const normalizedRoles = new Set([...roles].map(role => role.trim().toLowerCase()));

  for (const role of ["PIC", "admin", "Legal"]) {
    if (!normalizedRoles.has(role.toLowerCase())) roles.add(role);
  }

  roleSelect.options.length = 1;
  for (const role of [...roles].sort((a, b) => a.localeCompare(b, "id"))) {
    roleSelect.add(new Option(role, role));
  }
  roleSelect.value = roles.has(selectedRole) ? selectedRole : "";
}


// ========================================
// FORMAT TANGGAL
// ========================================

function formatTanggal(tanggal) {

  if (!tanggal) return "-";

  return new Date(tanggal)
    .toLocaleString("id-ID");

}


// ========================================
// LOAD PIC
// ========================================

async function loadPIC() {

  try {

    const response =
      await fetch("/api/pic");

    const result =
      await response.json();

    if (!response.ok) {

      console.error(result);

      return;

    }

    allPIC = result;

    loadRoleOptions();
    applySearch();

  } catch (error) {

    console.error(
      "ERROR LOAD PIC:",
      error
    );

  }

}


// ========================================
// RENDER
// ========================================

function tampilkanPIC(data) {

  picTable.innerHTML = "";


  if (data.length === 0) {

    picTable.innerHTML = `
      <tr>
        <td colspan="11"
            style="text-align:center;padding:30px">
          Data PIC belum tersedia
        </td>
      </tr>
    `;

    return;

  }


  data.forEach(pic => {

    const row = document.createElement("tr");
    row.insertCell().textContent = pic.id;

    const name = document.createElement("strong");
    name.textContent = pic.nama;
    row.insertCell().appendChild(name);

    for (const value of [
      pic.nik, pic.inisial, pic.jabatan, pic.role?.trim(), pic.email, pic.no_hp,
      formatTanggal(pic.created_at), formatTanggal(pic.updated_at)
    ]) {
      row.insertCell().textContent = value || "-";
    }

    const actions = row.insertCell();
    if (canManageRoles || !isAdminRole(pic.role)) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "btn-edit";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => editPIC(pic.id));

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn-delete";
      deleteButton.textContent = "Hapus";
      deleteButton.addEventListener("click", () => deletePIC(pic.id));

      actions.append(editButton, document.createTextNode(" "), deleteButton);
    }

    picTable.appendChild(row);

  });

}


// ========================================
// SAVE / UPDATE
// ========================================

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const payload = {

      nama:
        document
          .getElementById("nama")
          .value
          .trim(),

      nik:
        document
          .getElementById("nik")
          .value
          .trim(),

      inisial:
        document
          .getElementById("inisial")
          .value
          .trim(),

      jabatan:
        document
          .getElementById("jabatan")
          .value,

      email:
        document
          .getElementById("email")
          .value
          .trim(),

      no_hp:
        document
          .getElementById("no_hp")
          .value
          .trim()

    };

    const currentRole = allPIC.find(pic => pic.id === editId)?.role;
    if (canManageRoles && roleSelect.value && roleSelect.value !== currentRole) {
      payload.role = roleSelect.value;
    }

    let url =
      "/api/pic";

    let method =
      "POST";


    if (editId !== null) {

      url =
        `/api/pic/${editId}`;

      method =
        "PUT";

    }


    try {

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
              JSON.stringify(payload)
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        alert(
          "Gagal menyimpan: " +
          result.error
        );

        return;

      }


      alert(
        editId
          ? "PIC berhasil diubah"
          : "PIC berhasil ditambahkan"
      );


      resetForm();

      await loadPIC();


    } catch (error) {

      console.error(
        "ERROR SAVE PIC:",
        error
      );

    }

  }
);


// ========================================
// EDIT
// ========================================

function editPIC(id) {

  const pic =
    allPIC.find(
      item =>
        Number(item.id) === Number(id)
    );


  if (!pic) return;


  editId = pic.id;


  document.getElementById("nama").value =
    pic.nama || "";

  document.getElementById("nik").value =
    pic.nik || "";

  document.getElementById("inisial").value =
    pic.inisial || "";

  document.getElementById("jabatan").value =
    pic.jabatan || "";

  roleSelect.options[0].textContent = "Pertahankan role saat ini";
  roleSelect.value = pic.role?.trim() ? pic.role : "";

  document.getElementById("email").value =
    pic.email || "";

  document.getElementById("no_hp").value =
    pic.no_hp || "";


  submitButton.textContent =
    "Simpan Perubahan";

  cancelButton.style.display =
    "inline-block";

  formTitle.textContent =
    "Edit PIC";


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// ========================================
// DELETE
// ========================================

async function deletePIC(id) {

  if (
    !confirm(
      "Yakin ingin menghapus PIC ini?"
    )
  ) return;


  const response =
    await fetch(
      `/api/pic/${id}`,
      {
        method: "DELETE"
      }
    );


  const result =
    await response.json();


  if (!response.ok) {

    alert(result.error);

    return;

  }


  await loadPIC();

}


// ========================================
// RESET
// ========================================

function resetForm() {

  form.reset();
  roleSelect.options[0].textContent = "Default sistem";

  editId = null;

  submitButton.textContent =
    "+ Simpan PIC";

  cancelButton.style.display =
    "none";

  formTitle.textContent =
    "Tambah PIC";

}


cancelButton.addEventListener(
  "click",
  resetForm
);


// ========================================
// SEARCH
// ========================================

function applySearch() {

  const keyword =
    searchInput.value
      .toLowerCase()
      .trim();


  const hasil =
    allPIC.filter(pic => {

      return (

        String(pic.nama || "")
          .toLowerCase()
          .includes(keyword)

        ||

        String(pic.nik || "")
          .toLowerCase()
          .includes(keyword)

        ||

        String(pic.inisial || "")
          .toLowerCase()
          .includes(keyword)

        ||

        String(pic.jabatan || "")
          .toLowerCase()
          .includes(keyword)

        ||

        String(pic.role || "")
          .toLowerCase()
          .includes(keyword)

        ||

        String(pic.email || "")
          .toLowerCase()
          .includes(keyword)

      );

    });


  tampilkanPIC(hasil);

}


searchInput.addEventListener(
  "input",
  applySearch
);


async function initPIC() {
  try {
    const response = await fetch("/api/me");
    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }
    if (response.ok) {
      const { user } = await response.json();
      canManageRoles = isAdminRole(user?.role);
      roleSelect.disabled = !canManageRoles;
    }
  } catch (error) {
    console.error("ERROR LOAD PIC PERMISSIONS:", error);
  }

  await loadPIC();
}

initPIC();
