// ======================================================
// TOTAL PROGNOSA
// ======================================================

let allPrognosa = [];


// ======================================================
// ELEMENT
// ======================================================

const filterTahun =
  document.getElementById(
    "filterTahun"
  );


const regulerRow =
  document.getElementById(
    "regulerRow"
  );


const sewaRow =
  document.getElementById(
    "sewaRow"
  );


const transaksiRow =
  document.getElementById(
    "transaksiRow"
  );


const totalReguler =
  document.getElementById(
    "totalReguler"
  );


const totalSewa =
  document.getElementById(
    "totalSewa"
  );


const totalTransaksi =
  document.getElementById(
    "totalTransaksi"
  );


// ======================================================
// FORMAT RUPIAH
// ======================================================

function formatRupiah(value) {

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }
  ).format(
    Number(value) || 0
  );

}


// ======================================================
// GET TAHUN
// ======================================================

function getTahun(value) {

  if (!value) {
    return null;
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }


  return date.getUTCFullYear();

}


// ======================================================
// GET BULAN
// ======================================================

function getBulan(value) {

  if (!value) {
    return null;
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }


  return date.getUTCMonth();

}


// ======================================================
// LOAD DATA
// ======================================================

async function loadPrognosa() {

  try {

    const response =
      await fetch(
        "/api/prognosa"
      );


    if (
      response.status === 401
    ) {

      window.location.href =
        "/login.html";

      return;

    }


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal mengambil data prognosa."
      );

    }


    allPrognosa =
      Array.isArray(
        result.prognosa
      )
        ? result.prognosa
        : [];


    loadFilterTahun();


  } catch (error) {

    console.error(
      "ERROR TOTAL PROGNOSA:",
      error
    );


    regulerRow.innerHTML =
      `<td colspan="13">Gagal mengambil data.</td>`;


    sewaRow.innerHTML =
      `<td colspan="13">Gagal mengambil data.</td>`;


    transaksiRow.innerHTML =
      `<td colspan="13">Gagal mengambil data.</td>`;

  }

}


// ======================================================
// FILTER TAHUN
// ======================================================

function loadFilterTahun() {

  const tahunList =
    [
      ...new Set(

        allPrognosa

          .map(
            item =>
              getTahun(
                item.tanggal_prognosa
              )
          )

          .filter(Boolean)

      )
    ];


  tahunList.sort(
    (a, b) =>
      a - b
  );


  filterTahun.innerHTML = `
    <option value="">
      Pilih Tahun
    </option>
  `;


  tahunList.forEach(
    tahun => {

      const option =
        document.createElement(
          "option"
        );


      option.value =
        tahun;


      option.textContent =
        tahun;


      filterTahun.appendChild(
        option
      );

    }
  );


  if (
    tahunList.length > 0
  ) {

    filterTahun.value =
      tahunList[0];


    renderTotalPrognosa(
      tahunList[0]
    );

  } else {

    renderTotalPrognosa(
      null
    );

  }

}


// ======================================================
// NORMALISASI JENIS PROYEK
// ======================================================

function getJenisProyek(item) {

  const jenis =
    String(
      item.jenis_proyek || ""
    )
      .trim()
      .toLowerCase();


  if (
    jenis.includes("reguler")
  ) {

    return "reguler";

  }


  if (
    jenis.includes("sewa")
  ) {

    return "sewa";

  }


  if (
    jenis.includes("transaksi")
  ) {

    return "transaksi";

  }


  return "";

}


// ======================================================
// HITUNG BULANAN
// ======================================================

function hitungBulanan(
  data,
  jenis
) {

  const bulanan =
    Array(12).fill(0);


  data.forEach(
    item => {

      if (
        getJenisProyek(item) !==
        jenis
      ) {

        return;

      }


      const bulan =
        getBulan(
          item.tanggal_prognosa
        );


      if (
        bulan === null
      ) {

        return;

      }


      bulanan[bulan] +=
        Number(
          item.nilai_termin
        ) || 0;

    }
  );


  return bulanan;

}


// ======================================================
// RENDER SATU ROW
// ======================================================

function renderRow(
  element,
  values
) {

  const total =
    values.reduce(
      (sum, value) =>
        sum + value,
      0
    );


  element.innerHTML =

    values
      .map(
        value => `
          <td>
            ${formatRupiah(value)}
          </td>
        `
      )
      .join("")

    +

    `
      <td>
        ${formatRupiah(total)}
      </td>
    `;


  return total;

}


// ======================================================
// RENDER TOTAL PROGNOSA
// ======================================================

function renderTotalPrognosa(
  tahun
) {

  if (!tahun) {

    const kosong =
      Array(12).fill(0);


    renderRow(
      regulerRow,
      kosong
    );


    renderRow(
      sewaRow,
      kosong
    );


    renderRow(
      transaksiRow,
      kosong
    );


    totalReguler.textContent =
      formatRupiah(0);


    totalSewa.textContent =
      formatRupiah(0);


    totalTransaksi.textContent =
      formatRupiah(0);


    return;

  }


  const selectedYear =
    Number(tahun);


  const dataTahun =
    allPrognosa.filter(
      item =>
        getTahun(
          item.tanggal_prognosa
        ) === selectedYear
    );


  // REGULER

  const reguler =
    hitungBulanan(
      dataTahun,
      "reguler"
    );


  // SEWA

  const sewa =
    hitungBulanan(
      dataTahun,
      "sewa"
    );


  // TRANSAKSI

  const transaksi =
    hitungBulanan(
      dataTahun,
      "transaksi"
    );


  // RENDER

  const nilaiReguler =
    renderRow(
      regulerRow,
      reguler
    );


  const nilaiSewa =
    renderRow(
      sewaRow,
      sewa
    );


  const nilaiTransaksi =
    renderRow(
      transaksiRow,
      transaksi
    );


  totalReguler.textContent =
    formatRupiah(
      nilaiReguler
    );


  totalSewa.textContent =
    formatRupiah(
      nilaiSewa
    );


  totalTransaksi.textContent =
    formatRupiah(
      nilaiTransaksi
    );

}


// ======================================================
// EVENT
// ======================================================

filterTahun.addEventListener(
  "change",
  () => {

    renderTotalPrognosa(
      filterTahun.value
    );

  }
);


// ======================================================
// START
// ======================================================

loadPrognosa();