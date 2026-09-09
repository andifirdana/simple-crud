const form = document.getElementById("dataForm");
const dataTable = document.getElementById("dataTable");
const searchInput =
  document.getElementById("searchInput");

const importButton =
  document.getElementById("importButton");

const exportButton =
  document.getElementById("exportButton");

const importFile =
  document.getElementById("importFile");

const downloadTemplateButton =
  document.getElementById("downloadTemplateButton");

let allUsers = [];

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

// =====================================================
// ESCAPE CSV
// =====================================================
function escapeCSV(value) {

  if (value === null || value === undefined) {
    return "";
  }

  let text = String(value);

  // escape tanda kutip
  text = text.replace(/"/g, '""');

  return `"${text}"`;
}


// =====================================================
// DOWNLOAD FILE CSV
// =====================================================
function downloadCSV(content, filename) {

  const blob = new Blob(
    ["\uFEFF" + content],
    {
      type: "text/csv;charset=utf-8;"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download = filename;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}


// =====================================================
// DOWNLOAD TEMPLATE IMPORT
// =====================================================
downloadTemplateButton.addEventListener(
  "click",
  () => {

    const template = [
      [
        "perusahaan_klien",
        "inisial",
        "nama_pic",
        "no_pic",
        "email_pic"
      ],

      [
        "PT Contoh Indonesia",
        "PCI",
        "Budi Santoso",
        "081234567890",
        "budi@contoh.com"
      ],

      [
        "PT Teknologi Maju",
        "PTM",
        "Siti Aminah",
        "081298765432",
        "siti@contoh.com"
      ]
    ];

    const csv =
      template
        .map(row =>
          row
            .map(escapeCSV)
            .join(",")
        )
        .join("\n");

    downloadCSV(
      csv,
      "template_import_klien.csv"
    );

  }
);


// =====================================================
// EXPORT DATA
// =====================================================
exportButton.addEventListener(
  "click",
  () => {

    if (allUsers.length === 0) {

      alert(
        "Belum ada data yang dapat diekspor"
      );

      return;
    }


    const rows = [

      [
        "id",
        "perusahaan_klien",
        "inisial",
        "nama_pic",
        "no_pic",
        "email_pic",
        "created_at",
        "updated_at"
      ]

    ];


    allUsers.forEach(user => {

      rows.push([
        user.id,
        user.perusahaan_klien,
        user.inisial,
        user.nama_pic,
        user.no_pic,
        user.email_pic,
        user.created_at,
        user.updated_at
      ]);

    });


    const csv =
      rows
        .map(row =>
          row
            .map(escapeCSV)
            .join(",")
        )
        .join("\n");


    const tanggal =
      new Date()
        .toISOString()
        .slice(0, 10);


    downloadCSV(
      csv,
      `master_klien_${tanggal}.csv`
    );

  }
);


// =====================================================
// BUKA FILE IMPORT
// =====================================================
importButton.addEventListener(
  "click",
  () => {

    importFile.click();

  }
);


// =====================================================
// PARSE CSV
// =====================================================
function parseCSV(text) {

  const rows = [];

  let row = [];
  let field = "";
  let insideQuotes = false;


  for (let i = 0; i < text.length; i++) {

    const char = text[i];

    const next =
      text[i + 1];


    if (char === '"') {

      if (
        insideQuotes &&
        next === '"'
      ) {

        field += '"';

        i++;

      } else {

        insideQuotes =
          !insideQuotes;

      }

    }

    else if (
      char === "," &&
      !insideQuotes
    ) {

      row.push(field.trim());

      field = "";

    }

    else if (
      (char === "\n" ||
       char === "\r") &&
      !insideQuotes
    ) {

      if (
        char === "\r" &&
        next === "\n"
      ) {
        i++;
      }


      row.push(field.trim());

      field = "";


      if (
        row.some(item =>
          item !== ""
        )
      ) {

        rows.push(row);

      }

      row = [];

    }

    else {

      field += char;

    }

  }


  if (
    field !== "" ||
    row.length > 0
  ) {

    row.push(field.trim());

    rows.push(row);

  }


  return rows;
}


// =====================================================
// IMPORT CSV
// =====================================================
importFile.addEventListener(
  "change",
  async (event) => {

    const file =
      event.target.files[0];


    if (!file) {
      return;
    }


    try {

      const text =
        await file.text();


      const rows =
        parseCSV(text);


      if (rows.length < 2) {

        alert(
          "File CSV tidak memiliki data"
        );

        importFile.value = "";

        return;
      }


      // Header
      const headers =
        rows[0].map(header =>
          header
            .replace(/^\uFEFF/, "")
            .trim()
            .toLowerCase()
        );


      const requiredHeaders = [
        "perusahaan_klien",
        "inisial",
        "nama_pic",
        "no_pic",
        "email_pic"
      ];


      const headerValid =
        requiredHeaders.every(
          header =>
            headers.includes(header)
        );


      if (!headerValid) {

        alert(
          "Format CSV tidak sesuai.\n\n" +
          "Gunakan tombol Download Template."
        );

        importFile.value = "";

        return;
      }


      const dataImport = [];


      for (
        let i = 1;
        i < rows.length;
        i++
      ) {

        const row = rows[i];


        const item = {};


        headers.forEach(
          (header, index) => {

            item[header] =
              row[index] || "";

          }
        );


        // Baris tanpa perusahaan tidak dimasukkan
        if (
          !item.perusahaan_klien.trim()
        ) {

          continue;

        }


        dataImport.push({

          perusahaan_klien:
            item.perusahaan_klien.trim(),

          inisial:
            item.inisial.trim(),

          nama_pic:
            item.nama_pic.trim(),

          no_pic:
            item.no_pic.trim(),

          email_pic:
            item.email_pic.trim()

        });

      }


      if (
        dataImport.length === 0
      ) {

        alert(
          "Tidak ada data yang dapat diimport"
        );

        importFile.value = "";

        return;
      }


      const yakin =
        confirm(
          `Import ${dataImport.length} data klien?`
        );


      if (!yakin) {

        importFile.value = "";

        return;
      }


      const response =
        await fetch(
          "/api/data/import",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                data: dataImport
              })
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        alert(
          "Gagal import: " +
          result.error
        );

        return;
      }


      alert(
        `${result.total} data klien berhasil diimport`
      );


      await loadUsers();


    } catch (error) {

      console.error(
        "ERROR IMPORT:",
        error
      );


      alert(
        "Terjadi kesalahan saat membaca file"
      );

    } finally {

      // supaya file yang sama bisa dipilih ulang
      importFile.value = "";

    }

  }
);