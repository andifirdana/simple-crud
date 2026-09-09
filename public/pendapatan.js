const filterTahun =
  document.getElementById("filterTahun");


// ======================================================
// FORMAT RUPIAH
// ======================================================

function rupiah(value) {

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(Number(value || 0));

}


// ======================================================
// FILTER TAHUN
// ======================================================

function loadTahun() {

  const tahunSekarang =
    new Date().getFullYear();

  filterTahun.innerHTML = "";

  for (
    let tahun = tahunSekarang;
    tahun >= 2025;
    tahun--
  ) {

    const option =
      document.createElement("option");

    option.value = tahun;
    option.textContent = tahun;

    filterTahun.appendChild(option);

  }

}


// ======================================================
// RENDER
// ======================================================

function renderJenis(
  rowId,
  values
) {

  console.log(
    "RENDER:",
    rowId,
    values
  );


  const row =
    document.getElementById(rowId);


  if (!row) {

    console.error(
      "ROW TIDAK DITEMUKAN:",
      rowId
    );

    return;

  }


  const bulan =
    Array.from(
      { length: 12 },
      (_, index) =>
        Number(values?.[index] || 0)
    );


  const total =
    bulan.reduce(
      (sum, value) =>
        sum + value,
      0
    );


  row.innerHTML =
    bulan
      .map(value => `
        <td>
          ${rupiah(value)}
        </td>
      `)
      .join("")
    +
    `
      <td class="total-value">
        ${rupiah(total)}
      </td>
    `;

}


// ======================================================
// LOAD API
// ======================================================

async function loadPendapatan() {

  try {

    const tahun =
      filterTahun.value;


    console.log(
      "TAHUN:",
      tahun
    );


    const response =
      await fetch(
        `/api/pendapatan?tahun=${tahun}`
      );


    const data =
      await response.json();


    console.log(
      "DATA DARI API:",
      data
    );


    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gagal mengambil pendapatan"
      );

    }


    renderJenis(
      "regulerRow",
      data.reguler
    );

    renderJenis(
      "sewaRow",
      data.sewa
    );

    renderJenis(
      "transaksiRow",
      data.transaksi
    );


  } catch (error) {

    console.error(
      "ERROR LOAD PENDAPATAN:",
      error
    );

  }

}


// ======================================================
// FILTER CHANGE
// ======================================================

filterTahun.addEventListener(
  "change",
  loadPendapatan
);


// ======================================================
// START
// ======================================================

loadTahun();

loadPendapatan();