const form = document.getElementById("dataForm");
const dataTable = document.getElementById("dataTable");

let editId = null;


// =========================
// FORMAT TANGGAL
// =========================
function formatTanggal(tanggal) {
  if (!tanggal) return "-";

  return new Date(tanggal).toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


// =========================
// TAMPILKAN DATA
// =========================
async function loadUsers() {
  try {
    const response = await fetch("/api/data");

    if (!response.ok) {
      throw new Error("Gagal mengambil data");
    }

    const users = await response.json();

    console.log("DATA:", users);

    dataTable.innerHTML = "";

    users.forEach((user) => {

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${user.id}</td>
        <td>${user.perusahaan_klien || ""}</td>
        <td>${user.inisial || ""}</td>
        <td>${user.nama_pic || ""}</td>
        <td>${user.no_pic || ""}</td>
        <td>${user.email_pic || ""}</td>
        <td>${formatTanggal(user.created_at)}</td>
        <td>${formatTanggal(user.updated_at)}</td>

        <td>
          <button
            onclick="editUser(${user.id})"
            style="
              background:#eef2ff;
              color:#4338ca;
              margin-right:6px;
            "
          >
            Edit
          </button>

          <button onclick="deleteUser(${user.id})">
            Hapus
          </button>
        </td>
      `;

      dataTable.appendChild(row);
    });

  } catch (error) {
    console.error("ERROR LOAD DATA:", error);
  }
}


// =========================
// SIMPAN / UPDATE
// =========================
form.addEventListener("submit", async (event) => {

  event.preventDefault();

  const perusahaan_klien =
    document.getElementById("perusahaan_klien").value;

  const inisial =
    document.getElementById("inisial").value;

  const nama_pic =
    document.getElementById("nama_pic").value;

  const no_pic =
    document.getElementById("no_pic").value;

  const email_pic =
    document.getElementById("email_pic").value;


  const payload = {
    perusahaan_klien,
    inisial,
    nama_pic,
    no_pic,
    email_pic
  };


  try {

    let response;


    // =========================
    // MODE EDIT
    // =========================
    if (editId !== null) {

      response = await fetch(
        `/api/data/${editId}`,
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

    }


    // =========================
    // MODE TAMBAH
    // =========================
    else {

      response = await fetch(
        "/api/data",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify(payload)
        }
      );

    }


    const result = await response.json();

    console.log("RESPONSE SERVER:", result);


    if (!response.ok) {

      alert(
        "Gagal menyimpan: " +
        result.error
      );

      return;
    }


    if (editId !== null) {

      alert("Data berhasil diubah");

    } else {

      alert("Data berhasil disimpan");

    }


    resetForm();

    await loadUsers();


  } catch (error) {

    console.error(
      "ERROR FETCH:",
      error
    );

  }

});


// =========================
// EDIT DATA
// =========================
async function editUser(id) {

  try {

    const response =
      await fetch("/api/data");


    const users =
      await response.json();


    const user =
      users.find(
        item =>
          Number(item.id) === Number(id)
      );


    if (!user) {

      alert("Data tidak ditemukan");

      return;
    }


    editId = user.id;


    document.getElementById(
      "perusahaan_klien"
    ).value =
      user.perusahaan_klien || "";


    document.getElementById(
      "inisial"
    ).value =
      user.inisial || "";


    document.getElementById(
      "nama_pic"
    ).value =
      user.nama_pic || "";


    document.getElementById(
      "no_pic"
    ).value =
      user.no_pic || "";


    document.getElementById(
      "email_pic"
    ).value =
      user.email_pic || "";


    const tombolSimpan =
      form.querySelector(
        'button[type="submit"]'
      );


    tombolSimpan.textContent =
      "Simpan Perubahan";


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });


  } catch (error) {

    console.error(
      "ERROR EDIT:",
      error
    );

  }

}


// =========================
// RESET FORM
// =========================
function resetForm() {

  form.reset();

  editId = null;


  const tombolSimpan =
    form.querySelector(
      'button[type="submit"]'
    );


  tombolSimpan.textContent =
    "+ Simpan Data";

}


// =========================
// HAPUS DATA
// =========================
async function deleteUser(id) {

  const yakin = confirm(
    "Yakin ingin menghapus data ini?"
  );


  if (!yakin) {
    return;
  }


  try {

    const response =
      await fetch(
        `/api/data/${id}`,
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
      "Data berhasil dihapus"
    );


    await loadUsers();


  } catch (error) {

    console.error(
      "ERROR DELETE:",
      error
    );

  }

}


// =========================
// LOAD AWAL
// =========================
loadUsers();