const form = document.getElementById("partnerForm");
const partnerTable = document.getElementById("partnerTable");

const searchInput = document.getElementById("searchInput");
const submitButton = document.getElementById("submitButton");
const cancelEdit = document.getElementById("cancelEdit");
const formTitle = document.getElementById("formTitle");

let allPartners = [];
let editId = null;

let currentPage = 1;

const itemsPerPage = 10;


function renderKategoriPagination(
  data
) {

  const start =
    (currentPage - 1) *
    itemsPerPage;

  const end =
    start +
    itemsPerPage;


  const pageData =
    data.slice(
      start,
      end
    );


  tampilkanPartner(pageData);


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

        applySearch();

      }

  });

}



// =========================
// FORMAT TANGGAL
// =========================
function formatTanggal(tanggal) {

  if (!tanggal) {
    return "-";
  }

  return new Date(tanggal).toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

}


// =========================
// NORMALISASI NOMOR HP
// =========================
function formatNoHP(nomor) {

  if (!nomor) {
    return "";
  }

  let hasil = nomor.trim();

  // hapus spasi, -, (, )
  hasil = hasil.replace(/[\s\-()]/g, "");

  // +62812 menjadi 62812
  if (hasil.startsWith("+62")) {
    hasil = hasil.substring(1);
  }

  // 0812 menjadi 62812
  if (hasil.startsWith("0")) {
    hasil = "62" + hasil.substring(1);
  }

  return hasil;
}


// =========================
// LOAD DATA PARTNER
// =========================
async function loadPartners() {

  try {

    const response = await fetch("/api/partner");

    const result = await response.json();

    if (!response.ok) {

      console.error(
        "Gagal mengambil partner:",
        result
      );

      return;
    }

    allPartners = result;

    applySearch();

  } catch (error) {

    console.error(
      "ERROR LOAD PARTNER:",
      error
    );

  }

}


// ========================================


// =========================
// TAMPILKAN DATA
// =========================
function tampilkanPartner(partners) {

  partnerTable.innerHTML = "";


  // DATA KOSONG
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


  partners.forEach((partner) => {

    const row =
      document.createElement("tr");


    let statusClass =
      "status-aktif";


    if (partner.status === "Nonaktif") {

      statusClass =
        "status-nonaktif";

    }


    row.innerHTML = `
      <td>${partner.id}</td>

      <td>
        <strong>
          ${partner.nama_partner || "-"}
        </strong>
      </td>

      <td>
        ${partner.inisial || "-"}
      </td>

      <td>
        ${partner.jenis_partner || "-"}
      </td>

      <td>
        ${partner.nama_pic || "-"}
      </td>

      <td>
        ${partner.no_pic || "-"}
      </td>

      <td>
        ${partner.email_pic || "-"}
      </td>

      <td>
        <span class="status ${statusClass}">
          ${partner.status || "-"}
        </span>
      </td>

      <td>
        ${formatTanggal(partner.created_at)}
      </td>

      <td>
        ${formatTanggal(partner.updated_at)}
      </td>

      <td>

        <button
          class="btn-edit"
          onclick="editPartner(${partner.id})"
        >
          Edit
        </button>

        <button
          class="btn-delete"
          onclick="deletePartner(${partner.id})"
        >
          Hapus
        </button>

      </td>
    `;


    partnerTable.appendChild(row);

  });

}


// =========================
// TAMBAH / UPDATE
// =========================
form.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const nama_partner =
      document
        .getElementById("nama_partner")
        .value
        .trim();


    const inisial =
      document
        .getElementById("inisial")
        .value
        .trim();


    const jenis_partner =
      document
        .getElementById("jenis_partner")
        .value;


    const nama_pic =
      document
        .getElementById("nama_pic")
        .value
        .trim();


    let no_pic =
      document
        .getElementById("no_pic")
        .value;


    no_pic =
      formatNoHP(no_pic);


    const email_pic =
      document
        .getElementById("email_pic")
        .value
        .trim();


    const alamat =
      document
        .getElementById("alamat")
        .value
        .trim();


    const status =
      document
        .getElementById("status")
        .value;


    const payload = {

      nama_partner,
      inisial,
      jenis_partner,
      nama_pic,
      no_pic,
      email_pic,
      alamat,
      status

    };


    try {

      let response;


      // =====================
      // MODE EDIT
      // =====================
      if (editId !== null) {

        response = await fetch(
          `/api/partner/${editId}`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(payload)
          }
        );

      }


      // =====================
      // MODE TAMBAH
      // =====================
      else {

        response = await fetch(
          "/api/partner",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(payload)
          }
        );

      }


      const result =
        await response.json();


      if (!response.ok) {

        alert(
          "Gagal menyimpan: " +
          result.error
        );

        return;
      }


      if (editId !== null) {

        alert(
          "Data partner berhasil diubah"
        );

      } else {

        alert(
          "Data partner berhasil ditambahkan"
        );

      }


      resetForm();

      await loadPartners();


    } catch (error) {

      console.error(
        "ERROR SAVE PARTNER:",
        error
      );

    }

  }
);


// =========================
// EDIT PARTNER
// =========================
function editPartner(id) {

  const partner =
    allPartners.find(
      item =>
        Number(item.id) === Number(id)
    );


  if (!partner) {

    alert(
      "Data partner tidak ditemukan"
    );

    return;
  }


  editId = partner.id;


  document.getElementById(
    "nama_partner"
  ).value =
    partner.nama_partner || "";


  document.getElementById(
    "inisial"
  ).value =
    partner.inisial || "";


  document.getElementById(
    "jenis_partner"
  ).value =
    partner.jenis_partner || "";


  document.getElementById(
    "nama_pic"
  ).value =
    partner.nama_pic || "";


  document.getElementById(
    "no_pic"
  ).value =
    partner.no_pic || "";


  document.getElementById(
    "email_pic"
  ).value =
    partner.email_pic || "";


  document.getElementById(
    "alamat"
  ).value =
    partner.alamat || "";


  document.getElementById(
    "status"
  ).value =
    partner.status || "Aktif";


  submitButton.textContent =
    "Simpan Perubahan";


  cancelEdit.style.display =
    "inline-block";


  formTitle.textContent =
    "Edit Partner";


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// =========================
// BATAL EDIT
// =========================
cancelEdit.addEventListener(
  "click",
  () => {

    resetForm();

  }
);


// =========================
// RESET FORM
// =========================
function resetForm() {

  form.reset();

  editId = null;


  document.getElementById(
    "status"
  ).value = "Aktif";


  submitButton.textContent =
    "+ Simpan Partner";


  cancelEdit.style.display =
    "none";


  formTitle.textContent =
    "Tambah Partner";

}


// =========================
// DELETE PARTNER
// =========================
async function deletePartner(id) {

  const partner =
    allPartners.find(
      item =>
        Number(item.id) === Number(id)
    );


  const nama =
    partner
      ? partner.nama_partner
      : "partner ini";


  const yakin =
    confirm(
      `Yakin ingin menghapus ${nama}?`
    );


  if (!yakin) {
    return;
  }


  try {

    const response =
      await fetch(
        `/api/partner/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      alert(
        "Gagal menghapus: " +
        result.error
      );

      return;
    }


    alert(
      "Data partner berhasil dihapus"
    );


    await loadPartners();


  } catch (error) {

    console.error(
      "ERROR DELETE PARTNER:",
      error
    );

  }

}


// =========================
// SEARCH
// =========================
function applySearch() {

  const keyword =
    searchInput
      .value
      .toLowerCase()
      .trim();


  const hasil =
    allPartners.filter(
      (partner) => {

        return (

          String(
            partner.nama_partner || ""
          )
            .toLowerCase()
            .includes(keyword)

          ||

          String(
            partner.inisial || ""
          )
            .toLowerCase()
            .includes(keyword)

          ||

          String(
            partner.jenis_partner || ""
          )
            .toLowerCase()
            .includes(keyword)

          ||

          String(
            partner.nama_pic || ""
          )
            .toLowerCase()
            .includes(keyword)

          ||

          String(
            partner.no_pic || ""
          )
            .toLowerCase()
            .includes(keyword)

          ||

          String(
            partner.email_pic || ""
          )
            .toLowerCase()
            .includes(keyword)

          ||

          String(
            partner.status || ""
          )
            .toLowerCase()
            .includes(keyword)

        );

      }
    );


  renderKategoriPagination(
    hasil
  );

}


// =========================
// SEARCH REALTIME
// =========================
searchInput.addEventListener(
  "input",
  applySearch
);

// ========================================
// START
// ========================================

async function start() {

  await loadPartners();

}


start();