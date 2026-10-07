(() => {

  function initPendapatan() {

    const filterTahun =
      document.getElementById("filterTahun");

    const rowIds = [
      "regulerRow",
      "sewaRow",
      "transaksiRow",
      "totalPendapatanRow"
    ];

    if (
      !filterTahun ||
      rowIds.some(id => !document.getElementById(id))
    ) {
      console.error(
        "Filter tahun atau baris tabel pendapatan tidak ditemukan."
      );
      return;
    }

    const namaBulan = [
      "januari", "februari", "maret", "april",
      "mei", "juni", "juli", "agustus",
      "september", "oktober", "november", "desember"
    ];

    const formatRupiah = new Intl.NumberFormat(
      "id-ID",
      {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
      }
    );

    let controller = null;
    let requestId = 0;

    // ==================================================
    // FORMAT ANGKA DAN RUPIAH
    // ==================================================

    function angka(value) {
      const nilai = Number(value ?? 0);
      return Number.isFinite(nilai) ? nilai : 0;
    }

    function rupiah(value) {
      return formatRupiah.format(angka(value));
    }

    // ==================================================
    // NORMALISASI DATA MENJADI 12 BULAN
    // ==================================================

    function normalisasiBulanan(values) {
      return Array.from(
        { length: 12 },
        (_, index) => {

          const value = Array.isArray(values)
            ? values[index]
            : values?.[namaBulan[index]];

          return angka(value);

        }
      );
    }

    // ==================================================
    // FILTER TAHUN
    // ==================================================

    function loadTahun() {

      const tahunSekarang =
        new Date().getFullYear();

      filterTahun.replaceChildren();

      for (
        let tahun = tahunSekarang;
        tahun >= 2025;
        tahun--
      ) {
        const option =
          document.createElement("option");

        option.value = String(tahun);
        option.textContent = String(tahun);

        filterTahun.appendChild(option);
      }

      filterTahun.value = String(tahunSekarang);
    }

    // ==================================================
    // RENDER BARIS
    // 1 JENIS + 12 BULAN + 1 TOTAL
    // ==================================================

    function renderJenis(
      rowId,
      label,
      values,
      isTotal = false
    ) {

      const row =
        document.getElementById(rowId);

      const bulanan =
        normalisasiBulanan(values);

      const total = bulanan.reduce(
        (jumlah, nilai) => jumlah + nilai,
        0
      );

      row.innerHTML = `
        <td class="jenis-value">
          <strong>${label}</strong>
        </td>

        ${bulanan.map(value => `
          <td>
            ${
              isTotal
                ? `<strong>${rupiah(value)}</strong>`
                : rupiah(value)
            }
          </td>
        `).join("")}

        <td class="total-value">
          ${
            isTotal
              ? `<strong>${rupiah(total)}</strong>`
              : rupiah(total)
          }
        </td>
      `;
    }

    // ==================================================
    // RENDER PENDAPATAN DAN TOTAL
    // ==================================================

    function renderPendapatan(data) {

      const reguler =
        normalisasiBulanan(data.reguler);

      const sewa =
        normalisasiBulanan(data.sewa);

      const transaksi =
        normalisasiBulanan(data.transaksi);

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

      const totalBulanan = reguler.map(
        (nilai, index) =>
          nilai +
          sewa[index] +
          transaksi[index]
      );

      renderJenis(
        "totalPendapatanRow",
        "Total Pendapatan",
        totalBulanan,
        true
      );
    }

    // ==================================================
    // PESAN LOADING / ERROR
    // ==================================================

    function tampilkanPesan(message, className) {

      for (const rowId of rowIds) {

        const row =
          document.getElementById(rowId);

        const cell =
          document.createElement("td");

        cell.colSpan = 14;
        cell.className = className;
        cell.textContent = message;

        row.replaceChildren(cell);
      }
    }

    // ==================================================
    // AMBIL DATA DARI API
    // ==================================================

    async function loadPendapatan() {

      const id = ++requestId;

      // Batalkan permintaan lama saat tahun diganti.
      controller?.abort();
      controller = new AbortController();

      const signal = controller.signal;
      const tahun = filterTahun.value;

      if (!tahun) {
        tampilkanPesan(
          "Silakan pilih tahun.",
          "error-cell"
        );
        return;
      }

      tampilkanPesan(
        "Memuat data...",
        "loading-cell"
      );

      try {

        const response = await fetch(
          `/api/pendapatan?tahun=${encodeURIComponent(tahun)}`,
          {
            credentials: "same-origin",
            signal
          }
        );

        if (id !== requestId) return;

        if (response.status === 401) {
          window.location.href = "/login.html";
          return;
        }

        if (!response.ok) {

          const errorResult =
            await response.json().catch(() => ({}));

          throw new Error(
            errorResult.error ||
            `Gagal mengambil data (${response.status})`
          );
        }

        const data = await response.json();

        if (id !== requestId) return;

        if (
          !data ||
          typeof data !== "object" ||
          ["reguler", "sewa", "transaksi"].some(
            jenis => {
              const values = data[jenis];

              return (
                !values ||
                typeof values !== "object"
              );
            }
          )
        ) {
          throw new Error(
            "Format respons pendapatan tidak sesuai."
          );
        }

        renderPendapatan(data);

      } catch (error) {

        if (
          id !== requestId ||
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "ERROR LOAD PENDAPATAN:",
          error
        );

        tampilkanPesan(
          error.message ||
          "Gagal memuat data pendapatan.",
          "error-cell"
        );
      }
    }

    // ==================================================
    // MULAI
    // ==================================================

    filterTahun.addEventListener(
      "change",
      loadPendapatan
    );

    loadTahun();
    loadPendapatan();
  }

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initPendapatan,
      { once: true }
    );

  } else {

    initPendapatan();

  }

})();