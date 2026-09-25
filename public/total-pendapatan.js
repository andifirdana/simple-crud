document.addEventListener(
  "DOMContentLoaded",
  () => {

    const filterTahun =
      document.getElementById(
        "filterTahun"
      );


    // ======================================================
    // NAMA BULAN
    // ======================================================

    const namaBulan = [
      "januari",
      "februari",
      "maret",
      "april",
      "mei",
      "juni",
      "juli",
      "agustus",
      "september",
      "oktober",
      "november",
      "desember"
    ];


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
      ).format(
        Number(value || 0)
      );

    }


    // ======================================================
    // FILTER TAHUN
    // ======================================================

    function loadTahun() {

      if (!filterTahun) {

        console.error(
          "Element #filterTahun tidak ditemukan."
        );

        return;

      }


      const tahunSekarang =
        new Date().getFullYear();


      filterTahun.innerHTML = "";


      for (
        let tahun = tahunSekarang;
        tahun >= 2025;
        tahun--
      ) {

        const option =
          document.createElement(
            "option"
          );


        option.value = tahun;

        option.textContent = tahun;


        filterTahun.appendChild(
          option
        );

      }


      filterTahun.value =
        String(tahunSekarang);

    }


    // ======================================================
    // NORMALISASI DATA BULANAN
    // ======================================================

    function normalisasiBulanan(
      values
    ) {

      /*
        Mendukung format array:

        [
          1000000,
          2000000,
          ...
        ]
      */

      if (Array.isArray(values)) {

        return Array.from(
          { length: 12 },
          (_, index) =>
            Number(
              values[index] || 0
            )
        );

      }


      /*
        Mendukung format object:

        {
          januari: 1000000,
          februari: 2000000
        }
      */

      return namaBulan.map(
        bulan =>
          Number(
            values?.[bulan] || 0
          )
      );

    }


    // ======================================================
    // RENDER PER JENIS
    // ======================================================

    function renderJenis(
      rowId,
      label,
      values
    ) {

      const row =
        document.getElementById(
          rowId
        );


      if (!row) {

        console.error(
          "Row tidak ditemukan:",
          rowId
        );

        return;

      }


      const bulan =
        normalisasiBulanan(
          values
        );


      const total =
        bulan.reduce(
          (
            jumlah,
            nilai
          ) =>
            jumlah + nilai,
          0
        );


      row.innerHTML = `
        <td class="jenis-value">
          <strong>
            ${label}
          </strong>
        </td>

        ${bulan
          .map(
            value => `
              <td>
                ${rupiah(value)}
              </td>
            `
          )
          .join("")}

        <td class="total-value">
          ${rupiah(total)}
        </td>
      `;

    }


    // ======================================================
    // RENDER TOTAL
    // ======================================================

    function renderTotal(
      regulerValues,
      sewaValues,
      transaksiValues
    ) {

      const row =
        document.getElementById(
          "totalPendapatanRow"
        );


      if (!row) {

        console.error(
          "Row totalPendapatanRow tidak ditemukan."
        );

        return;

      }


      const reguler =
        normalisasiBulanan(
          regulerValues
        );


      const sewa =
        normalisasiBulanan(
          sewaValues
        );


      const transaksi =
        normalisasiBulanan(
          transaksiValues
        );


      const totalBulanan =
        Array.from(
          { length: 12 },
          (_, index) =>
            reguler[index] +
            sewa[index] +
            transaksi[index]
        );


      const totalTahunan =
        totalBulanan.reduce(
          (
            jumlah,
            nilai
          ) =>
            jumlah + nilai,
          0
        );


      row.innerHTML = `
        <td class="jenis-value">
          <strong>
            Total Pendapatan
          </strong>
        </td>

        ${totalBulanan
          .map(
            value => `
              <td>
                <strong>
                  ${rupiah(value)}
                </strong>
              </td>
            `
          )
          .join("")}

        <td class="total-value">
          <strong>
            ${rupiah(totalTahunan)}
          </strong>
        </td>
      `;

    }


    // ======================================================
    // LOADING
    // ======================================================

    function tampilkanLoading() {

      const rowIds = [
        "regulerRow",
        "sewaRow",
        "transaksiRow",
        "totalPendapatanRow"
      ];


      rowIds.forEach(
        rowId => {

          const row =
            document.getElementById(
              rowId
            );


          if (row) {

            row.innerHTML = `
              <td
                colspan="14"
                class="loading-cell"
              >
                Memuat data...
              </td>
            `;

          }

        }
      );

    }


    // ======================================================
    // ERROR
    // ======================================================

    function tampilkanError(
      message
    ) {

      const rowIds = [
        "regulerRow",
        "sewaRow",
        "transaksiRow",
        "totalPendapatanRow"
      ];


      rowIds.forEach(
        rowId => {

          const row =
            document.getElementById(
              rowId
            );


          if (row) {

            row.innerHTML = `
              <td
                colspan="14"
                class="error-cell"
              >
                ${message}
              </td>
            `;

          }

        }
      );

    }


    // ======================================================
    // LOAD PENDAPATAN
    // ======================================================

    async function loadPendapatan() {

      const pendapatanGroup =
        document.getElementById(
          "pendapatanGroup"
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


      const totalPendapatanRow =
        document.getElementById(
          "totalPendapatanRow"
        );


      if (
        !filterTahun ||
        !pendapatanGroup ||
        !regulerRow ||
        !sewaRow ||
        !transaksiRow ||
        !totalPendapatanRow
      ) {

        console.error(
          "Elemen tabel pendapatan tidak ditemukan."
        );

        return;

      }


      const tahun =
        filterTahun.value;


      if (!tahun) {

        tampilkanError(
          "Silakan pilih tahun."
        );

        return;

      }


      tampilkanLoading();


      try {

        const response =
          await fetch(
            `/api/pendapatan?tahun=${encodeURIComponent(
              tahun
            )}`
          );


        if (response.status === 401) {

          window.location.href =
            "/login.html";

          return;

        }


        if (!response.ok) {

          const errorResult =
            await response
              .json()
              .catch(
                () => ({})
              );


          throw new Error(
            errorResult.error ||
            `Gagal mengambil data (${response.status})`
          );

        }


        const data =
          await response.json();


        console.log(
          "DATA PENDAPATAN:",
          data
        );


        const reguler =
          data.reguler || [];


        const sewa =
          data.sewa || [];


        const transaksi =
          data.transaksi || [];


        renderJenis(
          "regulerRow",
          "Reguler/SLA",
          reguler
        );


        renderJenis(
          "sewaRow",
          "Sewa",
          sewa
        );


        renderJenis(
          "transaksiRow",
          "Transaksi",
          transaksi
        );


        renderTotal(
          reguler,
          sewa,
          transaksi
        );

      } catch (error) {

        console.error(
          "ERROR LOAD PENDAPATAN:",
          error
        );


        tampilkanError(
          error.message ||
          "Gagal memuat data pendapatan."
        );

      }

    }


    // ======================================================
    // FILTER CHANGE
    // ======================================================

    if (filterTahun) {

      filterTahun.addEventListener(
        "change",
        loadPendapatan
      );

    }


    // ======================================================
    // START
    // ======================================================

    loadTahun();

    loadPendapatan();

  }
);