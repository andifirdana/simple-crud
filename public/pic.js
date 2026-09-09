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


let allPIC = [];
let editId = null;


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
        <td colspan="10"
            style="text-align:center;padding:30px">
          Data PIC belum tersedia
        </td>
      </tr>
    `;

    return;

  }


  data.forEach(pic => {

    const row =
      document.createElement("tr");


    row.innerHTML = `

      <td>${pic.id}</td>

      <td>
        <strong>
          ${pic.nama}
        </strong>
      </td>

      <td>${pic.nik}</td>

      <td>${pic.inisial || "-"}</td>

      <td>${pic.jabatan}</td>

      <td>${pic.email || "-"}</td>

      <td>${pic.no_hp || "-"}</td>

      <td>
        ${formatTanggal(pic.created_at)}
      </td>

      <td>
        ${formatTanggal(pic.updated_at)}
      </td>

      <td>

        <button
          class="btn-edit"
          onclick="editPIC(${pic.id})"
        >
          Edit
        </button>

        <button
          class="btn-delete"
          onclick="deletePIC(${pic.id})"
        >
          Hapus
        </button>

      </td>

    `;


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


loadPIC();