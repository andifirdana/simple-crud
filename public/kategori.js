const form =
  document.getElementById("kategoriForm");

const table =
  document.getElementById("kategoriTable");

const picList =
  document.getElementById("picList");

const searchInput =
  document.getElementById("searchInput");

const submitButton =
  document.getElementById("submitButton");

const cancelButton =
  document.getElementById("cancelButton");

const formTitle =
  document.getElementById("formTitle");


let allKategori = [];
let allPIC = [];
let editId = null;


// ========================================
// FORMAT RUPIAH
// ========================================

function rupiah(value) {

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(value || 0);

}


// ========================================
// TANGGAL
// ========================================

function tanggal(value) {

  if (!value) return "-";

  return new Date(value)
    .toLocaleString("id-ID");

}


// ========================================
// LOAD PIC
// ========================================

async function loadPIC() {

  const response =
    await fetch("/api/pic");

  allPIC =
    await response.json();


  picList.innerHTML = "";


  allPIC.forEach(pic => {

    const div =
      document.createElement("div");

    div.className =
      "pic-option";


    div.innerHTML = `

      <label>

        <input
          type="checkbox"
          name="pic"
          value="${pic.id}"
        >

        ${pic.nama}
        — ${pic.jabatan}

      </label>

    `;


    picList.appendChild(div);

  });

}


// ========================================
// LOAD KATEGORI
// ========================================

async function loadKategori() {

  const response =
    await fetch(
      "/api/kategori-produk"
    );


  allKategori =
    await response.json();


  applySearch();

}


// ========================================
// RENDER
// ========================================

function tampilkan(data) {

  table.innerHTML = "";


  data.forEach(item => {

    const row =
      document.createElement("tr");


    const namaPIC =
      item.pic
        ? item.pic
            .map(p => p.nama)
            .join(", ")
        : "-";


    const statusClass =
      item.status === "Aktif"
        ? "aktif"
        : "nonaktif";


    row.innerHTML = `

      <td>${item.id}</td>

      <td>
        <strong>
          ${item.nama_kategori_produk}
        </strong>
      </td>

      <td>
        ${rupiah(item.total_nilai)}
      </td>

      <td>
        ${namaPIC}
      </td>

      <td>
        <span
          class="status ${statusClass}"
        >
          ${item.status}
        </span>
      </td>

      <td>
        ${tanggal(item.created_at)}
      </td>

      <td>
        ${tanggal(item.updated_at)}
      </td>

      <td>

        <button
          class="btn-edit"
          onclick="editKategori(${item.id})"
        >
          Edit
        </button>

        <button
          class="btn-delete"
          onclick="deleteKategori(${item.id})"
        >
          Hapus
        </button>

      </td>

    `;


    table.appendChild(row);

  });

}


// ========================================
// SAVE
// ========================================

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const pic_ids =
      Array.from(
        document.querySelectorAll(
          'input[name="pic"]:checked'
        )
      )
      .map(item =>
        Number(item.value)
      );


    const payload = {

      nama_kategori_produk:
        document
          .getElementById(
            "nama_kategori_produk"
          )
          .value
          .trim(),

      total_nilai:
        Number(
          document
            .getElementById(
              "total_nilai"
            )
            .value
        ),

      status:
        document
          .getElementById("status")
          .value,

      pic_ids

    };


    let url =
      "/api/kategori-produk";

    let method =
      "POST";


    if (editId !== null) {

      url =
        `/api/kategori-produk/${editId}`;

      method =
        "PUT";

    }


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

      alert(result.error);

      return;

    }


    alert(
      editId
        ? "Kategori berhasil diubah"
        : "Kategori berhasil ditambahkan"
    );


    resetForm();

    await loadKategori();

  }
);


// ========================================
// EDIT
// ========================================

function editKategori(id) {

  const item =
    allKategori.find(
      x =>
        Number(x.id) === Number(id)
    );


  if (!item) return;


  editId = item.id;


  document.getElementById(
    "nama_kategori_produk"
  ).value =
    item.nama_kategori_produk;


  document.getElementById(
    "total_nilai"
  ).value =
    item.total_nilai;


  document.getElementById(
    "status"
  ).value =
    item.status;


  document
    .querySelectorAll(
      'input[name="pic"]'
    )
    .forEach(cb => {

      cb.checked =
        item.pic.some(
          p =>
            Number(p.id) ===
            Number(cb.value)
        );

    });


  submitButton.textContent =
    "Simpan Perubahan";

  cancelButton.style.display =
    "inline-block";

  formTitle.textContent =
    "Edit Kategori Produk";


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


// ========================================
// DELETE
// ========================================

async function deleteKategori(id) {

  if (
    !confirm(
      "Yakin ingin menghapus kategori?"
    )
  ) return;


  const response =
    await fetch(
      `/api/kategori-produk/${id}`,
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


  await loadKategori();

}


// ========================================
// RESET
// ========================================

function resetForm() {

  form.reset();

  editId = null;


  document
    .querySelectorAll(
      'input[name="pic"]'
    )
    .forEach(
      cb =>
        cb.checked = false
    );


  submitButton.textContent =
    "+ Simpan Kategori";

  cancelButton.style.display =
    "none";

  formTitle.textContent =
    "Tambah Kategori Produk";

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
    allKategori.filter(item =>

      String(
        item.nama_kategori_produk
      )
        .toLowerCase()
        .includes(keyword)

      ||

      String(item.status)
        .toLowerCase()
        .includes(keyword)

      ||

      item.pic.some(pic =>
        String(pic.nama)
          .toLowerCase()
          .includes(keyword)
      )

    );


  tampilkan(hasil);

}


searchInput.addEventListener(
  "input",
  applySearch
);


// ========================================
// START
// ========================================

async function start() {

  await loadPIC();

  await loadKategori();

}


start();