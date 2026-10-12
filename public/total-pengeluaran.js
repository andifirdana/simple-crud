document.addEventListener("DOMContentLoaded", () => {
  const filterTahun = document.getElementById(
    "filterTahunPengeluaran"
  );

  const status = document.getElementById(
    "statusPengeluaran"
  );

  const tbody = document.getElementById(
    "isiTabelPengeluaran"
  );

  if (!filterTahun || !status || !tbody) {
    console.error(
      "Elemen halaman Total Pengeluaran tidak ditemukan."
    );
    return;
  }

  const parameterHalaman = new URLSearchParams(
    window.location.search
  );

  const tahunSekarang = new Date().getFullYear();

  const tahunDariUrl = Number(
    parameterHalaman.get("tahun")
  );

  const tahunTerpilih =
    Number.isInteger(tahunDariUrl) &&
    tahunDariUrl >= 1 &&
    tahunDariUrl <= 9998
      ? tahunDariUrl
      : tahunSekarang;

  const daftarTahun = new Set();

  for (
    let tahun = tahunSekarang + 1;
    tahun >= 2020;
    tahun--
  ) {
    daftarTahun.add(tahun);
  }

  daftarTahun.add(tahunTerpilih);

  filterTahun.replaceChildren();

  [...daftarTahun]
    .sort((a, b) => b - a)
    .forEach(tahun => {
      filterTahun.add(
        new Option(
          String(tahun),
          String(tahun)
        )
      );
    });

  filterTahun.value = String(tahunTerpilih);

  const formatRupiah = nilai => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(Number(nilai) || 0);
  };

  function tampilkanPesan(pesan) {
    const baris = document.createElement("tr");
    const kolom = document.createElement("td");

    kolom.className = "message-cell";
    kolom.colSpan = 14;
    kolom.textContent = pesan;

    baris.append(kolom);
    tbody.replaceChildren(baris);
  }

  function buatBaris(
    nama,
    kunci,
    bulanan,
    total,
    adalahTotal = false
  ) {
    const baris = document.createElement("tr");

    if (adalahTotal) {
      baris.classList.add("total-row");
    }

    const namaProyek = document.createElement("th");
    namaProyek.scope = "row";
    namaProyek.textContent = nama;
    baris.append(namaProyek);

    for (let bulan = 1; bulan <= 12; bulan++) {
      const dataBulan = bulanan.find(
        item => Number(item.bulan) === bulan
      );

      const kolom = document.createElement("td");

      kolom.textContent = formatRupiah(
        dataBulan?.[kunci] ?? 0
      );

      baris.append(kolom);
    }

    const kolomTotal = document.createElement("td");
    kolomTotal.textContent = formatRupiah(total);

    baris.append(kolomTotal);

    return baris;
  }

  async function muatTotalPengeluaran() {
    const tahun = Number(filterTahun.value);

    status.classList.remove("error");
    status.textContent = "Memuat data...";

    tampilkanPesan("Memuat data...");

    const url = new URL(
      "/api/total-pengeluaran",
      window.location.origin
    );

    url.searchParams.set("tahun", String(tahun));

    // Jika admin membuka halaman dengan ?pic_id=3,
    // filter PIC ikut dikirim ke API.
    const picId = parameterHalaman.get("pic_id");

    if (picId) {
      url.searchParams.set("pic_id", picId);
    }

    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      const tipeRespons = response.headers.get(
        "content-type"
      ) || "";

      if (!tipeRespons.includes("application/json")) {
        throw new Error(
          `Respons server bukan JSON (HTTP ${response.status}).`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          `Permintaan gagal (HTTP ${response.status}).`
        );
      }

      if (!Array.isArray(data.bulanan)) {
        throw new Error(
          "Format data API tidak sesuai: bulanan tidak ditemukan."
        );
      }

      const bulanan = data.bulanan;
      const ringkasan = data.ringkasan || {};

      tbody.replaceChildren(
        buatBaris(
          "Reguler / SLA",
          "reguler",
          bulanan,
          ringkasan.reguler
        ),

        buatBaris(
          "Sewa",
          "sewa",
          bulanan,
          ringkasan.sewa
        ),

        buatBaris(
          "Transaksi",
          "transaksi",
          bulanan,
          ringkasan.transaksi
        ),

        buatBaris(
          "Total Pengeluaran",
          "total",
          bulanan,
          ringkasan.total,
          true
        )
      );

      const jumlah = Number(
        ringkasan.jumlah_pembayaran || 0
      );

      status.textContent = jumlah > 0
        ? `${jumlah} pembayaran pada tahun ${tahun}`
        : `Belum ada pembayaran pada tahun ${tahun}`;

      const urlHalaman = new URL(
        window.location.href
      );

      urlHalaman.searchParams.set(
        "tahun",
        String(tahun)
      );

      window.history.replaceState(
        null,
        "",
        urlHalaman
      );
    } catch (error) {
      console.error(
        "ERROR TOTAL PENGELUARAN:",
        error
      );

      status.classList.add("error");
      status.textContent = "Gagal memuat data";

      tampilkanPesan(
        `Gagal memuat data: ${error.message}`
      );
    }
  }

  filterTahun.addEventListener(
    "change",
    muatTotalPengeluaran
  );

  muatTotalPengeluaran();
});