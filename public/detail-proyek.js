const params =
  new URLSearchParams(window.location.search);

const proyekId =
  params.get("id");


let detailData = null;
let activePartnerTerminId = null;
let activePartnerId = null;
let activePartnerDokumenId = null;
let modeTerminKlien = null;
let editKategoriDipilih = [];
let activePartnerDokumenUploadId =
  null;



// ======================================================
// FORMAT
// ======================================================

function rupiah(value) {

  const number =
    Number(value || 0);

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }
  ).format(number);

}

function angka(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const hasil =
    Number(value);

  return Number.isFinite(hasil)
    ? hasil
    : 0;
}

function tanggal(value) {

  if (!value) return "-";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  const hari =
    String(
      date.getDate()
    ).padStart(2, "0");

  const bulan =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const tahun =
    date.getFullYear();

  return `${hari}/${bulan}/${tahun}`;
}

function tanggalInput(value) {

  if (!value) return "";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const tahun =
    date.getFullYear();

  const bulan =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const hari =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${tahun}-${bulan}-${hari}`;
}

// ======================================================
// FORMAT LAST UPDATE
// Contoh: Senin, 19 Januari 2026 14:30
// ======================================================

function formatLastUpdate(value) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }


  const namaHari = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu"
  ];


  const namaBulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember"
  ];


  const hari =
    namaHari[
      date.getDay()
    ];


  const tanggal =
    String(
      date.getDate()
    ).padStart(2, "0");


  const bulan =
    namaBulan[
      date.getMonth()
    ];


  const tahun =
    date.getFullYear();


  const jam =
    String(
      date.getHours()
    ).padStart(2, "0");


  const menit =
    String(
      date.getMinutes()
    ).padStart(2, "0");


  return (
    `${hari}, ${tanggal} ` +
    `${bulan} ${tahun} ` +
    `${jam}:${menit}`
  );
}
// ======================================================
// ESCAPE HTML
// Mencegah teks dari API dianggap sebagai tag HTML
// ======================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ======================================================
// FORMAT INPUT NOMINAL
// ======================================================

function ambilAngkaNominal(value) {
  return String(value ?? "")
    .replace(/[^\d]/g, "");
}


function formatInputNominal(value) {
  const angka =
    ambilAngkaNominal(value);

  if (!angka) {
    return "";
  }

  const number =
    Number(angka);

  return Number.isFinite(number)
    ? new Intl.NumberFormat(
        "id-ID",
        {
          maximumFractionDigits: 0
        }
      ).format(number)
    : "";
}


function nominalOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const angka =
    ambilAngkaNominal(value);

  if (!angka) {
    return null;
  }

  const number =
    Number(angka);

  return Number.isFinite(number)
    ? number
    : null;
}


// ======================================================
// CEK INPUT YANG MERUPAKAN NOMINAL
// ======================================================

function isInputNominal(element) {
  if (
    !element ||
    element.tagName !== "INPUT"
  ) {
    return false;
  }

  return element.matches(`
    #editNilaiSubmitKlien,
    #editNilaiNego1Klien,
    #editNilaiNego2Klien,
    #editNilaiNego3Klien,
    #nominalTermin,
    .edit-partner-submit,
    .edit-partner-nego1,
    .edit-partner-nego2,
    .edit-partner-nego3
  `);
}


// ======================================================
// ISI DAN FORMAT INPUT NOMINAL
// ======================================================

function setNilaiNominal(
  inputOrId,
  value
) {
  const input =
    typeof inputOrId === "string"
      ? document.getElementById(
          inputOrId
        )
      : inputOrId;

  if (!input) {
    return;
  }

  input.type =
    "text";

  input.inputMode =
    "numeric";

  input.autocomplete =
    "off";

  input.classList.add(
    "input-rupiah"
  );

  input.value =
    formatInputNominal(value);
}


// ======================================================
// FORMAT OTOMATIS SAAT DIKETIK
// ======================================================

document.addEventListener(
  "focusin",
  event => {
    const input =
      event.target;

    if (!isInputNominal(input)) {
      return;
    }

    input.type =
      "text";

    input.inputMode =
      "numeric";

    input.autocomplete =
      "off";
  }
);


document.addEventListener(
  "input",
  event => {
    const input =
      event.target;

    if (!isInputNominal(input)) {
      return;
    }

    input.value =
      formatInputNominal(
        input.value
      );

    const posisiAkhir =
      input.value.length;

    if (
      typeof input.setSelectionRange ===
      "function"
    ) {
      input.setSelectionRange(
        posisiAkhir,
        posisiAkhir
      );
    }
  }
);
// =====================================================
// EDIT KATEGORI
// ======================================================
async function loadKategoriEdit() {

  const select =
    document.getElementById(
      "editKategoriSelect"
    );

  try {

    const response =
      await fetch(
        "/api/proyek/kategori"
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Gagal mengambil kategori"
      );
    }

    select.innerHTML = `
      <option value="">
        Pilih Kategori
      </option>
    `;

    data.forEach(item => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        item.id;

      option.textContent =
        item.nama_kategori_produk;

      select.appendChild(
        option
      );

    });

  } catch (error) {

    console.error(
      "ERROR LOAD KATEGORI EDIT:",
      error
    );

  }

}

function renderEditKategori() {

  const container =
    document.getElementById(
      "editKategoriTerpilih"
    );

  container.innerHTML = "";

  editKategoriDipilih.forEach(
    kategori => {

      const chip =
        document.createElement(
          "div"
        );

      chip.style.display = "flex";
      chip.style.alignItems = "center";
      chip.style.gap = "6px";
      chip.style.padding = "6px 10px";
      chip.style.border = "1px solid #d1d5db";
      chip.style.borderRadius = "20px";

      chip.innerHTML = `
        <span>
          ${kategori.nama}
        </span>

        <button
          type="button"
          data-id="${kategori.id}"
          style="
            border:none;
            background:none;
            cursor:pointer;
            font-size:16px;
          "
        >
          ×
        </button>
      `;

      container.appendChild(
        chip
      );

    }
  );

}

document.getElementById(
  "tambahEditKategori"
    ).addEventListener(
  "click",
  () => {

    const select =
      document.getElementById(
        "editKategoriSelect"
      );

    const id =
      Number(select.value);

    if (!id) return;

    const nama =
      select.options[
        select.selectedIndex
      ].textContent;

    const sudahAda =
      editKategoriDipilih.some(
        item =>
          item.id === id
      );

    if (sudahAda) {
      return;
    }

    editKategoriDipilih.push({
      id,
      nama
    });

    renderEditKategori();

    select.value = "";

  }
);

document.getElementById(
  "editKategoriTerpilih"
).addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "button[data-id]"
      );

    if (!button) return;

    const id =
      Number(
        button.dataset.id
      );

    editKategoriDipilih =
      editKategoriDipilih.filter(
        item =>
          item.id !== id
      );

    renderEditKategori();

  }
);

// ======================================================
// LOAD LAST UPDATE PROYEK
// ======================================================

async function loadLastUpdate() {
  const element =
    document.getElementById(
      "projectLastUpdate"
    );


  if (!element) {
    return;
  }


  try {
    const response =
      await fetch(
        `/api/proyek/${proyekId}/last-update`,
        {
          headers: {
            Accept:
              "application/json"
          },

          cache:
            "no-store"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil last update."
      );
    }


    element.textContent =
      `Terakhir diperbarui: ${
        formatLastUpdate(
          result.last_update
        )
      }`;

  } catch (error) {
    console.error(
      "ERROR LOAD LAST UPDATE:",
      error
    );


    element.textContent =
      "Terakhir diperbarui: -";
  }
}
// ======================================================
// LOAD DETAIL PROYEK
// ======================================================

async function loadDetail() {
const proyekId =
  new URLSearchParams(
    window.location.search
  ).get("id");

  try {
    if (!proyekId) {
      throw new Error(
        "ID proyek tidak ditemukan pada URL"
      );
    }

    const response =
      await fetch(
        `/api/proyek/${proyekId}/detail`
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil detail proyek"
      );
    }

    // Simpan seluruh response
    detailData =
      result;

await loadTotalProgressProyek(
  proyekId
);

    // Render seluruh detail
    renderDetail();
    updateProgressReportLink();
    await loadLastUpdate();

  } catch (error) {
    console.error(
      "ERROR DETAIL:",
      error
    );

    const container =
      document.getElementById(
        "detailContainer"
      );

    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          Gagal mengambil detail proyek:
          ${error.message}
        </div>
      `;
    }
  }
}

// ======================================================
// RENDER
// ======================================================

function renderDetail() {

  const proyek =
  detailData?.proyek || {};

const pic =
  Array.isArray(detailData?.pic)
    ? detailData.pic
    : [];

const klien =
  detailData?.klien || null;

const partners =
  Array.isArray(
    detailData?.partners
  )
    ? detailData.partners.filter(
        Boolean
      )
    : [];

const summary =
  detailData?.summary || {};


  // HEADER

  document.getElementById(
    "judulProyek"
  ).textContent =
    proyek.nama_proyek;



document.getElementById(
  "kategoriProyek"
).textContent =
  Array.isArray(proyek.nama_kategori_produk_list) &&
  proyek.nama_kategori_produk_list.length > 0
    ? proyek.nama_kategori_produk_list.join(", ")
    : (
        proyek.nama_kategori_produk ||
        "-"
      );


// ======================================================
// SUMMARY NILAI DAN PEMBAYARAN
// ======================================================

const jenisProyek =
  String(
    detailData?.proyek?.jenis_proyek ||
    ""
  )
    .trim()
    .toLowerCase();


const terminKlien =
  Array.isArray(klien?.termin)
    ? klien.termin
    : [];


const daftarPartner =
  Array.isArray(partners)
    ? partners
    : [];


// ======================================================
// CEK STATUS SUDAH DIBAYAR
// ======================================================

function statusSudahDibayar(status) {
  const statusNormal =
    String(status || "")
      .trim()
      .toLowerCase();

  return (
    statusNormal === "dibayar" ||
    statusNormal === "sudah dibayar" ||
    statusNormal === "lunas" ||
    statusNormal === "paid"
  );
}


// ======================================================
// HITUNG NILAI NOMINAL TERMIN
// ======================================================

function hitungNominalTermin(
  termin,
  nilaiAcuan
) {
  const nominal =
    angka(termin?.nominal);

  // Jika nominal termin tersedia,
  // gunakan nominal langsung
  if (nominal > 0) {
    return nominal;
  }

  const persentase =
    angka(termin?.persentase);

  // Jika nominal kosong tetapi persentase tersedia,
  // hitung dari nilai final
  if (
    persentase > 0 &&
    nilaiAcuan > 0
  ) {
    return (
      nilaiAcuan *
      persentase /
      100
    );
  }

  return 0;
}


// ======================================================
// NILAI FINAL KLIEN
// ======================================================

const nilaiKlienDariData =
  angka(summary?.nilai_klien) ||
  angka(summary?.nilai_final_klien) ||
  nilaiTerakhir(klien);


// Untuk proyek Transaksi,
// nilai klien bisa berasal dari total termin
const totalSeluruhTerminKlien =
  terminKlien.reduce(
    (total, item) => {
      return (
        total +
        angka(item.nominal)
      );
    },
    0
  );


const nilaiKlien =
  jenisProyek === "transaksi" &&
  totalSeluruhTerminKlien > 0
    ? totalSeluruhTerminKlien
    : nilaiKlienDariData;


// ======================================================
// NILAI FINAL PARTNER
// ======================================================

const nilaiPartnerDariData =
  daftarPartner.reduce(
    (total, partner) => {
      return (
        total +
        nilaiTerakhir(partner)
      );
    },
    0
  );


const totalSeluruhTerminPartner =
  daftarPartner.reduce(
    (totalPartner, partner) => {
      const terminPartner =
        Array.isArray(partner.termin)
          ? partner.termin
          : [];

      const totalTermin =
        terminPartner.reduce(
          (subtotal, item) => {
            return (
              subtotal +
              angka(item.nominal)
            );
          },
          0
        );

      return (
        totalPartner +
        totalTermin
      );
    },
    0
  );


const nilaiPartner =
  jenisProyek === "transaksi" &&
  totalSeluruhTerminPartner > 0
    ? totalSeluruhTerminPartner
    : (
        angka(
          summary?.nilai_partner
        ) ||
        angka(
          summary?.nilai_final_partner
        ) ||
        nilaiPartnerDariData
      );


// ======================================================
// DIBAYAR KLIEN
// ======================================================

const dibayarKlien =
  terminKlien
    .filter(item =>
      statusSudahDibayar(
        item.status_pembayaran
      )
    )
    .reduce(
      (total, item) => {
        return (
          total +
          hitungNominalTermin(
            item,
            nilaiKlien
          )
        );
      },
      0
    );


// ======================================================
// BELUM DIBAYAR KLIEN
// ======================================================

const belumDibayarKlien =
  Math.max(
    nilaiKlien -
    dibayarKlien,
    0
  );


// ======================================================
// DIBAYAR PARTNER
// ======================================================

const dibayarPartner =
  daftarPartner.reduce(
    (totalPartner, partner) => {
      const nilaiFinalPartner =
        nilaiTerakhir(partner);

      const terminPartner =
        Array.isArray(partner.termin)
          ? partner.termin
          : [];

      const terminSudahDibayar =
        terminPartner
          .filter(item =>
            statusSudahDibayar(
              item.status_pembayaran
            )
          )
          .reduce(
            (subtotal, item) => {
              return (
                subtotal +
                hitungNominalTermin(
                  item,
                  nilaiFinalPartner
                )
              );
            },
            0
          );

      return (
        totalPartner +
        terminSudahDibayar
      );
    },
    0
  );


// ======================================================
// BELUM DIBAYAR PARTNER
// ======================================================

const belumDibayarPartner =
  Math.max(
    nilaiPartner -
    dibayarPartner,
    0
  );


// ======================================================
// MARGIN
// ======================================================

const marginNominal =
  nilaiKlien -
  nilaiPartner;


const marginPersenNilai =
  nilaiKlien > 0
    ? (
        marginNominal /
        nilaiKlien
      ) * 100
    : 0;


// ======================================================
// TAMPILKAN KE CARD
// ======================================================

const ringkasanNilai = {
  nilaiKlien:
    rupiah(nilaiKlien),

  nilaiPartner:
    rupiah(nilaiPartner),

  margin:
    rupiah(marginNominal),

  marginPersen:
    `${marginPersenNilai.toFixed(2)}%`,

  dibayarKlien:
    rupiah(dibayarKlien),

  belumDibayarKlien:
    rupiah(belumDibayarKlien),

  dibayarPartner:
    rupiah(dibayarPartner),

  belumDibayarPartner:
    rupiah(belumDibayarPartner)
};


Object.entries(
  ringkasanNilai
).forEach(
  ([id, value]) => {
    const element =
      document.getElementById(id);

    if (element) {
      element.textContent =
        value;
    }
  }
);


console.log(
  "RINGKASAN PEMBAYARAN:",
  {
    nilaiKlien,
    dibayarKlien,
    belumDibayarKlien,

    nilaiPartner,
    dibayarPartner,
    belumDibayarPartner,

    marginNominal,
    marginPersenNilai,

    terminKlien,
    daftarPartner
  }
);
  

  // PROYEK

  const kategoriList =
  detailData.proyek.nama_kategori_produk_list;

document.getElementById(
  "kategoriInfoProyek"
).textContent =
  Array.isArray(proyek.nama_kategori_produk_list) &&
  proyek.nama_kategori_produk_list.length > 0
    ? proyek.nama_kategori_produk_list.join(", ")
    : (
        detailData.proyek.nama_kategori_produk ||
        "-"
      );

  document.getElementById(
    "jenisProyek"
  ).textContent =
    proyek.jenis_proyek || "-";


  document.getElementById(
    "subJenisProyek"
  ).textContent =
    proyek.sub_jenis_proyek || "-";


  document.getElementById(
    "statusFinal"
  ).textContent =
    proyek.status_final || "-";


  document.getElementById(
    "deskripsi"
  ).textContent =
    proyek.deskripsi || "-";


  // PIC

  renderPIC(pic);


  // KLIEN

  renderKlien(klien);
  renderTermin(klien);
  renderDokumen(klien);
  renderPartner(partners);

}

// ======================================================
// PIC
// ======================================================

function renderPIC(pic) {

  const container =
    document.getElementById(
      "picContainer"
    );

  if (!container) return;

  if (!pic || pic.length === 0) {

    container.innerHTML = `
      <div class="empty">
        Belum ada PIC.
      </div>
    `;

    return;
  }

  container.innerHTML =
    pic.map(item => `

      <div style="
        margin-bottom:8px;
        padding:10px;
        background:#f9fafb;
        border-radius:8px;
      ">

        <strong>
          ${item.nama || "-"}
        </strong>

        ${
          item.inisial
            ? `(${item.inisial})`
            : ""
        }

        <div class="label">
          ${item.jabatan || "-"}
        </div>

      </div>

    `).join("");

}

// ======================================================
// KLIEN
// ======================================================
function nilaiTerakhir(data) {
  // Menangani null, undefined,
  // atau data yang bukan object
  if (
    !data ||
    typeof data !== "object"
  ) {
    return 0;
  }

  const kandidat = [
    data.nilai_final,
    data.nilai_final_klien,
    data.nilai_final_partner,
    data.nilai_nego_3,
    data.nilai_nego_2,
    data.nilai_nego_1,
    data.nilai_submit
  ];

  for (const value of kandidat) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }

    const nominal =
      Number(value);

    if (
      Number.isFinite(nominal) &&
      nominal > 0
    ) {
      return nominal;
    }
  }

  return 0;
}

function selisihTanggal(mulai, akhir) {
  if (!mulai || !akhir) {
    return "-";
  }

  const start = new Date(mulai);
  const end = new Date(akhir);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end < start
  ) {
    return "-";
  }

  let tahun =
    end.getUTCFullYear() -
    start.getUTCFullYear();

  let bulan =
    end.getUTCMonth() -
    start.getUTCMonth();

  let hari =
    end.getUTCDate() -
    start.getUTCDate();

  if (hari < 0) {
    bulan -= 1;

    hari += new Date(
      Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth(),
        0
      )
    ).getUTCDate();
  }

  if (bulan < 0) {
    tahun -= 1;
    bulan += 12;
  }

  const hasil = [];

  // Tidak ditampilkan jika 0
  if (tahun > 0) {
    hasil.push(
      `${tahun} tahun`
    );
  }

  // Tidak ditampilkan jika 0
  if (bulan > 0) {
    hasil.push(
      `${bulan} bulan`
    );
  }

  // Hari tetap ditampilkan jika tahun dan bulan 0
  if (
    hari > 0 ||
    hasil.length === 0
  ) {
    hasil.push(
      `${hari} hari`
    );
  }

  return hasil.join(" ");
}

function berakhirDalam(tanggalAkhir) {
  if (!tanggalAkhir) {
    return {
      text: "-",
      className: "contract-expiry-warning"
    };
  }

  const sekarang = new Date();

  const hariIni = new Date(
    Date.UTC(
      sekarang.getFullYear(),
      sekarang.getMonth(),
      sekarang.getDate()
    )
  );

  const akhirAsli =
    new Date(tanggalAkhir);

  if (
    Number.isNaN(
      akhirAsli.getTime()
    )
  ) {
    return {
      text: "-",
      className: "contract-expiry-warning"
    };
  }

  const akhir = new Date(
    Date.UTC(
      akhirAsli.getUTCFullYear(),
      akhirAsli.getUTCMonth(),
      akhirAsli.getUTCDate()
    )
  );

  const selisihHari =
    Math.ceil(
      (
        akhir.getTime() -
        hariIni.getTime()
      ) /
      (
        1000 *
        60 *
        60 *
        24
      )
    );

  if (selisihHari < 0) {
    return {
      text: "Kontrak telah berakhir",
      className:
        "contract-expiry-expired"
    };
  }

  const text =
    selisihTanggal(
      hariIni,
      akhir
    );

  return {
    text,

    // Kurang dari 3 bulan atau 90 hari = kuning
    className:
      selisihHari < 90
        ? "contract-expiry-warning"
        : "contract-expiry-safe"
  };
}

function renderKlien(klien) {
  const container =
    document.getElementById("klienInfo");

  if (!container) {
    return;
  }

  if (!klien) {
    container.innerHTML = `
      <div class="empty">
        Belum ada klien.
      </div>
    `;

    return;
  }

  const nilaiSubmit =
    Number(
      nilaiSubmitKlienTampil(klien) || 0
    );

  const nilaiFinal =
    nilaiTerakhir(klien);

  const bisnisPerformance =
    nilaiSubmit > 0
      ? (
          (
            nilaiSubmit -
            nilaiFinal
          ) /
          nilaiSubmit
        ) * 100
      : 0;

  const informasiBerakhir =
  berakhirDalam(
    klien.tanggal_akhir
  );

  
 container.innerHTML = `

  <div
    class="
      contract-expiry
      ${informasiBerakhir.className}
    "
  >

    <div class="contract-expiry-label">
      Berakhir Dalam
    </div>

    <div class="contract-expiry-value">
      ${informasiBerakhir.text}
    </div>

  </div>

  <div class="grid">

      <div class="info">
        <div class="label">
          Tanggal Mulai
        </div>

        <div class="value">
          ${tanggal(klien.tanggal_mulai)}
        </div>
      </div>

      <div class="info">
        <div class="label">
          Tanggal Akhir
        </div>

        <div class="value">
          ${tanggal(klien.tanggal_akhir)}
        </div>
      </div>

      <div class="info">
        <div class="label">
          Durasi
        </div>

        <div class="value">
          ${selisihTanggal(
            klien.tanggal_mulai,
            klien.tanggal_akhir
          )}
        </div>
      </div>

      <div class="info">
        <div class="label">
          Model Pembayaran
        </div>

        <div class="value">
          ${
            klien.model_pembayaran ||
            klien.metode_pembayaran ||
            "-"
          }
        </div>
      </div>

      <div class="info">
        <div class="label">
          Nilai Submit
        </div>

        <div class="value">
          ${rupiah(nilaiSubmit)}
        </div>
      </div>

      <div class="info">
        <div class="label">
          Nilai Final
        </div>

        <div class="value">
          ${rupiah(nilaiFinal)}
        </div>
      </div>

      <div class="info">
        <div class="label">
          Bisnis Performance
        </div>

        <div class="value">
          ${bisnisPerformance.toFixed(2)}%
        </div>
      </div>

      <div class="info">
        <div class="label">
          Status Pengadaan
        </div>

        <div class="value">
          ${klien.status_pengadaan || "-"}
        </div>
      </div>

      <div class="info">
        <div class="label">
          Status Teknis
        </div>

        <div class="value">
          ${klien.status_teknis || "-"}
        </div>
      </div>

    </div>
  `;
}

// ======================================================
// FLOW PERSENTASE DAN NOMINAL TERMIN
// ======================================================

let inputTerminTerakhir =
  null;


// ======================================================
// AMBIL NILAI FINAL ASLI
// Tidak menggunakan total termin.
// ======================================================

function ambilNilaiFinal(data) {
  if (!data) return 0;

  const daftarNilai = [
    data.nilai_nego_3,
    data.nilai_nego_2,
    data.nilai_nego_1,
    data.nilai_submit
  ];

  for (
    const nilai of daftarNilai
  ) {
    const angka =
      Number(nilai || 0);

    if (angka > 0) {
      return angka;
    }
  }

  return 0;
}


// ======================================================
// AMBIL DATA KLIEN ATAU PARTNER AKTIF
// ======================================================

function getDataTerminAktif() {
  if (activePartnerId) {
    return (
      detailData?.partners || []
    ).find(item =>
      Number(
        item.proyek_partner_id
      ) ===
      Number(activePartnerId)
    ) || null;
  }

  return detailData?.klien || null;
}

// ======================================================
// NILAI FINAL TERMIN AKTIF
// ======================================================

function getNilaiFinalTerminAktif() {
  return ambilNilaiFinal(
    getDataTerminAktif()
  );
}


// ======================================================
// ATUR INPUT PERSENTASE DAN NOMINAL
// ======================================================

function aturInputTermin() {
  const persentaseGroup =
    document.getElementById(
      "persentaseTerminGroup"
    );

  const nominalGroup =
    document.getElementById(
      "nominalTerminGroup"
    );

  const persentaseInput =
    document.getElementById(
      "persentaseTermin"
    );

  const nominalInput =
    document.getElementById(
      "nominalTermin"
    );

  const nilaiFinal =
    getNilaiFinalTerminAktif();


  // Selalu munculkan kedua input
  if (persentaseGroup) {
    persentaseGroup.style.display =
      "";
  }

  if (nominalGroup) {
    nominalGroup.style.display =
      "";
  }

  if (!persentaseInput) return;
  if (!nominalInput) return;


  nominalInput.disabled =
    false;

  nominalInput.required =
    true;


  // Nilai final tersedia
  if (nilaiFinal > 0) {
    persentaseInput.disabled =
      false;

    persentaseInput.required =
      true;

    persentaseInput.placeholder =
      "Isi persentase";

    nominalInput.placeholder =
      "Isi nominal";

  } else {
    // Nilai final belum ada:
    // hanya nominal yang dapat diisi
    persentaseInput.disabled =
      true;

    persentaseInput.required =
      false;

    persentaseInput.value =
      "";

    persentaseInput.placeholder =
      "Otomatis";

    nominalInput.placeholder =
      "Isi nominal termin";
  }
}


// ======================================================
// PERHITUNGAN OTOMATIS INPUT
// ======================================================

const persentaseTerminInput =
  document.getElementById(
    "persentaseTermin"
  );

const nominalTerminInput =
  document.getElementById(
    "nominalTermin"
  );


if (
  persentaseTerminInput &&
  nominalTerminInput
) {
  // Persentase → Nominal
  persentaseTerminInput.addEventListener(
    "input",
    () => {
      const nilaiFinal =
        getNilaiFinalTerminAktif();

      if (nilaiFinal <= 0) {
        persentaseTerminInput.value =
          "";

        return;
      }

      inputTerminTerakhir =
        "persentase";

      const persentase =
        Number(
          persentaseTerminInput.value ||
          0
        );

      if (
        !Number.isFinite(
          persentase
        ) ||
        persentase <= 0
      ) {
        nominalTerminInput.value =
          "";

        return;
      }

      const nominal =
        nilaiFinal *
        persentase /
        100;

      setNilaiNominal(
        nominalTerminInput,
        Math.round(nominal)
      );
    }
  );


  // Nominal → Persentase
  nominalTerminInput.addEventListener(
    "input",
    () => {
      inputTerminTerakhir =
        "nominal";

      const nilaiFinal =
        getNilaiFinalTerminAktif();

      const nominal =
      nominalOrNull(
        nominalTerminInput.value
      ) || 0;

      if (
        nilaiFinal <= 0 ||
        !Number.isFinite(nominal) ||
        nominal <= 0
      ) {
        persentaseTerminInput.value =
          "";

        return;
      }

      const persentase =
        nominal /
        nilaiFinal *
        100;

      persentaseTerminInput.value =
        persentase.toFixed(2);
    }
  );
}

// ======================================================
// TOTAL NOMINAL TERMIN
// ======================================================

function totalNominalTermin(termin = []) {

  return termin.reduce(
    (total, item) =>
      total +
      Number(item.nominal || 0),
    0
  );

}


// ======================================================
// NILAI SUBMIT KLIEN
//
// TRANSAKSI:
// Nilai Submit = total seluruh termin
//
// Selain transaksi:
// Tetap menggunakan nilai_submit lama
// ======================================================

function nilaiSubmitKlienTampil(klien) {

  if (
    detailData?.proyek?.jenis_proyek ===
    "Transaksi"
  ) {

    const termin =
      klien?.termin || [];

    return termin.reduce(
      (total, item) =>
        total +
        Number(item.nominal || 0),
      0
    );

  }

  return Number(
    klien?.nilai_submit || 0
  );

}


// ======================================================
// RENDER TERMIN KLIEN
// ======================================================

function renderTermin(klien) {
  const tbody =
    document.getElementById(
      "terminTable"
    );

  if (!tbody) return;


  const termin =
    Array.isArray(klien?.termin)
      ? klien.termin
      : [];


  if (termin.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          Belum ada termin pembayaran.
        </td>
      </tr>
    `;

    const totalTermin =
      document.getElementById(
        "totalTermin"
      );

    if (totalTermin) {
      totalTermin.textContent =
        "0.00%";
    }

    return;
  }


  // Nilai final dari submit/nego
  const nilaiFinalAsli =
    ambilNilaiFinal(klien);


  // Total nominal seluruh termin
  const totalNominal =
    termin.reduce(
      (total, item) =>
        total +
        Number(
          item.nominal || 0
        ),
      0
    );


  /*
   * Jika nilai final asli tidak ada,
   * nilai final = total nominal termin.
   */
  const nilaiFinalEfektif =
    nilaiFinalAsli > 0
      ? nilaiFinalAsli
      : totalNominal;


  let totalPersentase =
    0;


  tbody.innerHTML =
    termin.map(item => {
      let nominal =
        Number(
          item.nominal || 0
        );

      let persentase =
        Number(
          item.persentase || 0
        );


      // Jika nominal belum dikirim API
      if (
        nominal <= 0 &&
        persentase > 0 &&
        nilaiFinalEfektif > 0
      ) {
        nominal =
          nilaiFinalEfektif *
          persentase /
          100;
      }


      // Jika persentase belum dikirim API
      if (
        persentase <= 0 &&
        nominal > 0 &&
        nilaiFinalEfektif > 0
      ) {
        persentase =
          nominal /
          nilaiFinalEfektif *
          100;
      }


      totalPersentase +=
        persentase;


      return `
        <tr>

          <td>
            ${item.nama_termin || "-"}
          </td>

          <td>
            ${persentase.toFixed(2)}%
          </td>

          <td>
            ${rupiah(nominal)}
          </td>

          <td>
            ${item.status_pembayaran || "-"}
          </td>

          <td>
            ${tanggal(
              item.tanggal_jatuh_tempo
            )}
          </td>

          <td>
            ${tanggal(
              item.tanggal_bayar
            )}
          </td>

          <td>
            ${item.syarat_pembayaran || "-"}
          </td>

          <td>

            <button
              type="button"
              class="btn-secondary"
              onclick="editTerminKlien(${item.id})"
            >
              Edit
            </button>

            <button
              type="button"
              class="btn-danger"
              onclick="hapusTermin(${item.id})"
            >
              Hapus
            </button>

          </td>

        </tr>
      `;
    }).join("");


  const totalTermin =
    document.getElementById(
      "totalTermin"
    );

  if (totalTermin) {
    totalTermin.textContent =
      `${totalPersentase.toFixed(2)}%`;
  }
  }



// ======================================================
// MODAL TERMIN
// ======================================================

const terminModal =
  document.getElementById(
    "terminModal"
  );


const tambahTerminButton =
  document.getElementById(
    "tambahTerminButton"
  );


if (tambahTerminButton) {

  tambahTerminButton.addEventListener(
    "click",
    () => {

      if (
        !detailData?.klien ||
        !detailData.klien.proyek_klien_id
      ) {

        alert(
          "Proyek belum memiliki klien."
        );

        return;
      }

      activePartnerId = null;
      activePartnerTerminId = null;

      const form =
        document.getElementById(
          "terminForm"
        );

      if (form) {
        form.reset();
      }

      document.getElementById(
        "terminId"
      ).value = "";

      document.getElementById(
        "terminModalTitle"
      ).textContent =
        "Tambah Termin Klien";

      inputTerminTerakhir =
        null;
      aturInputTermin();

      terminModal.classList.add(
        "show"
      );

    }
  );

}


// ======================================================
// BATAL TERMIN
// ======================================================

const batalTermin =
  document.getElementById(
    "batalTermin"
  );

  if (batalTermin) {

    batalTermin.addEventListener(
      "click",
      () => {

        terminModal.classList.remove(
          "show"
        );


        activePartnerId = null;
        activePartnerTerminId = null;

      }
    );

  }


// ======================================================
// SAVE TERMIN
// ======================================================

document.getElementById(
  "terminForm"
).addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const terminId =
      document.getElementById(
        "terminId"
      ).value;
const nilaiFinal =
  getNilaiFinalTerminAktif();

const persentaseInput =
  document.getElementById(
    "persentaseTermin"
  );

const nominalInput =
  document.getElementById(
    "nominalTermin"
  );

const persenValue =
  persentaseInput.value === ""
    ? null
    : Number(
        persentaseInput.value
      );

const nominalValue =
  nominalOrNull(
    nominalInput.value
  );


const payload = {
  nama_termin:
    document.getElementById(
      "namaTermin"
    ).value.trim(),

  persentase:
    nilaiFinal > 0
      ? persenValue
      : null,

  nominal:
    nominalValue,

  input_terakhir:
    nilaiFinal > 0
      ? (
          inputTerminTerakhir ||
          "persentase"
        )
      : "nominal",

  status_pembayaran:
    document.getElementById(
      "statusPembayaran"
    ).value ||
    "Belum Dibayar",

  tanggal_jatuh_tempo:
    document.getElementById(
      "tanggalJatuhTempo"
    ).value || null,

  tanggal_bayar:
    document.getElementById(
      "tanggalBayar"
    ).value || null,

  syarat_pembayaran:
    document.getElementById(
      "syaratPembayaran"
    ).value.trim() || null
};


console.log(
  "PAYLOAD TERMIN:",
  payload
);


if (!payload.nama_termin) {
  alert(
    "Nama termin wajib diisi."
  );

  document.getElementById(
    "namaTermin"
  ).focus();

  return;
}


if (
  payload.nominal === null ||
  !Number.isFinite(
    payload.nominal
  ) ||
  payload.nominal <= 0
) {
  alert(
    "Nominal termin harus lebih dari Rp 0."
  );

  nominalInput.focus();

  return;
}


if (
  nilaiFinal > 0 &&
  (
    payload.persentase === null ||
    !Number.isFinite(
      payload.persentase
    ) ||
    payload.persentase <= 0 ||
    payload.persentase > 100
  )
) {
  alert(
    "Persentase harus lebih dari 0 dan maksimal 100%."
  );

  persentaseInput.focus();

  return;
}

    let url;
    let method;


    // ======================================================
    // TERMIN PARTNER
    // ======================================================

    if (activePartnerId) {

      if (activePartnerTerminId) {

        url =
          `/api/proyek/partner/termin/${activePartnerTerminId}`;

        method =
          "PUT";

      } else {

        url =
          `/api/proyek/partner/${activePartnerId}/termin`;

        method =
          "POST";

      }


    // ======================================================
    // TERMIN KLIEN - EDIT
    // ======================================================

    } else if (terminId) {

      url =
        `/api/proyek/klien/termin/${terminId}`;

      method =
        "PUT";


    // ======================================================
    // TERMIN KLIEN - TAMBAH
    // ======================================================

    } else {

      if (
        !detailData.klien ||
        !detailData.klien.proyek_klien_id
      ) {

        alert(
          "Data proyek klien tidak ditemukan."
        );

        return;
      }


      url =
        `/api/proyek/klien/${detailData.klien.proyek_klien_id}/termin`;

      method =
        "POST";

    }


    try {

      console.log(
        "SIMPAN TERMIN:",
        {
          url,
          method,
          payload,
          activePartnerId,
          activePartnerTerminId,
          jenisProyek:
            detailData?.proyek?.jenis_proyek
        }
      );

console.log("PAYLOAD TERMIN:", payload);
console.log(
  "PAYLOAD TERMIN JSON:",
  JSON.stringify(
    payload,
    null,
    2
  )
);

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

        throw new Error(
          result.error ||
          "Gagal menyimpan termin"
        );

      }


      terminModal.classList.remove(
        "show"
      );


      // reset mode partner
      activePartnerId = null;
      activePartnerTerminId = null;


      await loadDetail();


    } catch (error) {

      console.error(
        "ERROR SIMPAN TERMIN:",
        error
      );

      alert(
        error.message
      );

    }

  }
);

// ======================================================
// EDIT TERMIN KLIEN
// ======================================================

window.editTerminKlien =
  function (id) {
    const termin =
      detailData?.klien?.termin?.find(
        item =>
          Number(item.id) ===
          Number(id)
      );

    if (!termin) {
      alert(
        "Termin klien tidak ditemukan."
      );

      return;
    }


    activePartnerId =
      null;

    activePartnerTerminId =
      null;

    inputTerminTerakhir =
      ambilNilaiFinal(
        detailData?.klien
      ) > 0
        ? "persentase"
        : "nominal";


    document.getElementById(
      "terminId"
    ).value =
      termin.id;


    document.getElementById(
      "namaTermin"
    ).value =
      termin.nama_termin || "";


    aturInputTermin();


    document.getElementById(
      "persentaseTermin"
    ).value =
      termin.persentase ?? "";


    setNilaiNominal(
      "nominalTermin",
      termin.nominal
    );


    document.getElementById(
      "statusPembayaran"
    ).value =
      termin.status_pembayaran ||
      "Belum Dibayar";


    document.getElementById(
      "tanggalJatuhTempo"
    ).value =
      tanggalInput(
        termin.tanggal_jatuh_tempo
      );


    document.getElementById(
      "tanggalBayar"
    ).value =
      tanggalInput(
        termin.tanggal_bayar
      );


    document.getElementById(
      "syaratPembayaran"
    ).value =
      termin.syarat_pembayaran ||
      "";


    document.getElementById(
      "terminModalTitle"
    ).textContent =
      "Edit Termin Klien";


    terminModal.classList.add(
      "show"
    );
  };

// ======================================================
// HAPUS TERMIN PARTNER
// ======================================================

async function hapusTerminPartner(id) {

  const konfirmasi =
    confirm(
      "Hapus termin partner ini?"
    );


  if (!konfirmasi) return;


  try {

    const response =
      await fetch(
        `/api/proyek/partner/termin/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menghapus termin partner"
      );

    }


    await loadDetail();


  } catch (error) {

    console.error(
      "ERROR HAPUS TERMIN PARTNER:",
      error
    );

    alert(error.message);

  }

}


// ======================================================
// TIMELINE PROYEK
// ======================================================

let timelineData = [];

const timelineModal =
  document.getElementById(
    "timelineModal"
  );

const timelineForm =
  document.getElementById(
    "timelineForm"
  );


// ======================================================
// HITUNG SELISIH HARI
// ======================================================

function selisihHariTimeline(
  tanggalAwal,
  tanggalAkhir
) {
  if (
    !tanggalAwal ||
    !tanggalAkhir
  ) {
    return null;
  }

  const awal =
    new Date(
      `${tanggalAwal}T00:00:00`
    );

  const akhir =
    new Date(
      `${tanggalAkhir}T00:00:00`
    );

  if (
    Number.isNaN(awal.getTime()) ||
    Number.isNaN(akhir.getTime())
  ) {
    return null;
  }

  return Math.ceil(
    (
      akhir.getTime() -
      awal.getTime()
    ) /
    86400000
  );
}


// ======================================================
// DURASI DAN BERAKHIR DALAM
// ======================================================

function updatePerhitunganTimeline() {
  const mulai =
    document.getElementById(
      "timelineTanggalMulai"
    ).value;

  const akhir =
    document.getElementById(
      "timelineTanggalAkhir"
    ).value;

  const durasiElement =
    document.getElementById(
      "timelineDurasi"
    );

  const berakhirElement =
    document.getElementById(
      "timelineBerakhirDalam"
    );

  const durasi =
    selisihHariTimeline(
      mulai,
      akhir
    );

  durasiElement.value =
    durasi !== null &&
    durasi >= 0
      ? `${durasi} hari`
      : "-";

  if (!akhir) {
    berakhirElement.value = "-";
    return;
  }

  const hariIni =
    new Date();

  const hariIniString = [
    hariIni.getFullYear(),
    String(
      hariIni.getMonth() + 1
    ).padStart(2, "0"),
    String(
      hariIni.getDate()
    ).padStart(2, "0")
  ].join("-");

  const sisaHari =
    selisihHariTimeline(
      hariIniString,
      akhir
    );

  if (sisaHari === null) {
    berakhirElement.value = "-";
  } else if (sisaHari < 0) {
    berakhirElement.value =
      `Berakhir ${Math.abs(sisaHari)} hari lalu`;
  } else if (sisaHari === 0) {
    berakhirElement.value =
      "Berakhir hari ini";
  } else {
    berakhirElement.value =
      `${sisaHari} hari lagi`;
  }
}


[
  "timelineTanggalMulai",
  "timelineTanggalAkhir"
].forEach(id => {
  document.getElementById(id)
    ?.addEventListener(
      "change",
      updatePerhitunganTimeline
    );
});


// ======================================================
// LOAD TIMELINE
// ======================================================

async function loadTimeline() {
  try {
    const response =
      await fetch(
        `/api/proyek/${proyekId}/timeline`
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal mengambil Timeline"
      );
    }

    timelineData =
      Array.isArray(result)
        ? result
        : [];

    renderTimeline();

  } catch (error) {
    console.error(
      "ERROR LOAD TIMELINE:",
      error
    );
  }
}


// ======================================================
// RENDER TIMELINE
// ======================================================

function renderTimeline() {
  const container =
    document.getElementById(
      "timelineContainer"
    );

  if (!container) {
    return;
  }

  if (
    !Array.isArray(timelineData) ||
    timelineData.length === 0
  ) {
    container.style.display =
      "none";

    container.innerHTML = "";

    return;
  }

  container.style.display =
    "block";

  const sekarang =
    new Date();

  const hariIni = [
    sekarang.getFullYear(),

    String(
      sekarang.getMonth() + 1
    ).padStart(2, "0"),

    String(
      sekarang.getDate()
    ).padStart(2, "0")
  ].join("-");


  // ====================================================
  // URUTKAN BERDASARKAN TANGGAL AKHIR PALING DEKAT
  // TANGGAL KOSONG DITEMPATKAN PALING BAWAH
  // ====================================================

  const timelineTerurut =
    [...timelineData].sort(
      (itemPertama, itemKedua) => {
        const tanggalPertama =
          tanggalInput(
            itemPertama.tanggal_akhir
          );

        const tanggalKedua =
          tanggalInput(
            itemKedua.tanggal_akhir
          );


        if (
          !tanggalPertama &&
          !tanggalKedua
        ) {
          return 0;
        }

        if (!tanggalPertama) {
          return 1;
        }

        if (!tanggalKedua) {
          return -1;
        }


        return (
          new Date(
            `${tanggalPertama}T00:00:00`
          ).getTime()
          -
          new Date(
            `${tanggalKedua}T00:00:00`
          ).getTime()
        );
      }
    );


  container.innerHTML = `
    <div class="table-wrapper">

      <table class="timeline-table">

        <thead>
          <tr>
            <th style="width: 60px;">
              No
            </th>

            <th>Deskripsi</th>
            <th>Tanggal Mulai</th>
            <th>Tanggal Akhir</th>
            <th>Durasi</th>
            <th>Berakhir Dalam</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>

        <tbody>

          ${timelineTerurut
            .map((item, index) => {
              const tanggalMulai =
                tanggalInput(
                  item.tanggal_mulai
                );

              const tanggalAkhir =
                tanggalInput(
                  item.tanggal_akhir
                );

              const durasi =
                selisihHariTimeline(
                  tanggalMulai,
                  tanggalAkhir
                );

              const sisaHari =
                selisihHariTimeline(
                  hariIni,
                  tanggalAkhir
                );

              const status =
                String(
                  item.status ||
                  "Aktif"
                ).trim();

              const statusClass =
                status
                  .toLowerCase()
                  .replaceAll(
                    " ",
                    "-"
                  );

              let durasiTampil =
                "-";

              let berakhirDalam =
                "-";

              let berakhirClass =
                "";

              if (
                durasi !== null &&
                durasi >= 0
              ) {
                durasiTampil =
                  `${durasi} hari`;
              }

              if (sisaHari !== null) {
                if (sisaHari < 0) {
                  berakhirDalam =
                    `Berakhir ${Math.abs(
                      sisaHari
                    )} hari lalu`;

                  berakhirClass =
                    "timeline-expired";

                } else if (
                  sisaHari === 0
                ) {
                  berakhirDalam =
                    "Berakhir hari ini";

                  berakhirClass =
                    "timeline-ending";

                } else {
                  berakhirDalam =
                    `${sisaHari} hari lagi`;

                  berakhirClass =
                    sisaHari <= 90
                      ? "timeline-ending"
                      : "timeline-safe";
                }
              }

              return `
                <tr>

                  <td class="timeline-number">
                    ${index + 1}
                  </td>

                  <td class="timeline-description-cell">
                    ${escapeHtml(
                      item.deskripsi ||
                      "-"
                    )}
                  </td>

                  <td>
                    ${tanggal(
                      item.tanggal_mulai
                    )}
                  </td>

                  <td>
                    ${tanggal(
                      item.tanggal_akhir
                    )}
                  </td>

                  <td>
                    ${durasiTampil}
                  </td>

                  <td>
                    <span
                      class="
                        timeline-expiry-text
                        ${berakhirClass}
                      "
                    >
                      ${berakhirDalam}
                    </span>
                  </td>

                  <td>
                    <span
                      class="
                        timeline-status
                        timeline-status-${statusClass}
                      "
                    >
                      ${escapeHtml(status)}
                    </span>
                  </td>

                  <td>
                    <div class="action-buttons">

                      <button
                        type="button"
                        class="btn btn-secondary"
                        onclick="
                          editTimeline(
                            ${Number(item.id)}
                          )
                        "
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        class="btn btn-danger"
                        onclick="
                          hapusTimeline(
                            ${Number(item.id)}
                          )
                        "
                      >
                        Hapus
                      </button>

                    </div>
                  </td>

                </tr>
              `;
            })
            .join("")}

        </tbody>

      </table>

    </div>
  `;
}

// ======================================================
// BUKA TAMBAH TIMELINE
// ======================================================

document.getElementById(
  "tambahTimelineButton"
)?.addEventListener(
  "click",
  () => {
    timelineForm.reset();

    document.getElementById(
      "timelineId"
    ).value = "";

    document.getElementById(
      "timelineModalTitle"
    ).textContent =
      "Tambah Timeline";

    updatePerhitunganTimeline();

    timelineModal.classList.add(
      "show"
    );
  }
);


// ======================================================
// EDIT TIMELINE
// ======================================================

function editTimeline(id) {
  const item =
    timelineData.find(
      timeline =>
        Number(timeline.id) ===
        Number(id)
    );

  if (!item) {
    alert(
      "Timeline tidak ditemukan"
    );

    return;
  }

  document.getElementById(
    "timelineId"
  ).value =
    item.id;

  document.getElementById(
    "timelineDeskripsi"
  ).value =
    item.deskripsi || "";

  document.getElementById(
    "timelineTanggalMulai"
  ).value =
    tanggalInput(
      item.tanggal_mulai
    );

  document.getElementById(
    "timelineTanggalAkhir"
  ).value =
    tanggalInput(
      item.tanggal_akhir
    );

  document.getElementById(
    "timelineStatus"
  ).value =
    item.status || "Aktif";

  document.getElementById(
    "timelineModalTitle"
  ).textContent =
    "Edit Timeline";

  updatePerhitunganTimeline();

  timelineModal.classList.add(
    "show"
  );
}


// ======================================================
// SIMPAN TIMELINE
// ======================================================

timelineForm?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const timelineId =
      document.getElementById(
        "timelineId"
      ).value;

    const payload = {
      deskripsi:
        document.getElementById(
          "timelineDeskripsi"
        ).value.trim(),

      tanggal_mulai:
        document.getElementById(
          "timelineTanggalMulai"
        ).value,

      tanggal_akhir:
        document.getElementById(
          "timelineTanggalAkhir"
        ).value,

      status:
        document.getElementById(
          "timelineStatus"
        ).value
    };

    if (
      payload.tanggal_akhir <
      payload.tanggal_mulai
    ) {
      alert(
        "Tanggal akhir tidak boleh sebelum tanggal mulai"
      );

      return;
    }

    const url =
      timelineId
        ? `/api/proyek/timeline/${timelineId}`
        : `/api/proyek/${proyekId}/timeline`;

    const method =
      timelineId
        ? "PUT"
        : "POST";

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
        throw new Error(
          result.error ||
          "Gagal menyimpan Timeline"
        );
      }

      timelineModal.classList.remove(
        "show"
      );

      await loadTimeline();

    } catch (error) {
      console.error(
        "ERROR SIMPAN TIMELINE:",
        error
      );

      alert(error.message);
    }
  }
);


// ======================================================
// HAPUS TIMELINE
// ======================================================

async function hapusTimeline(id) {
  if (
    !confirm(
      "Hapus Timeline ini?"
    )
  ) {
    return;
  }

  try {
    const response =
      await fetch(
        `/api/proyek/timeline/${id}`,
        {
          method: "DELETE"
        }
      );

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        "Gagal menghapus Timeline"
      );
    }

    await loadTimeline();

  } catch (error) {
    alert(error.message);
  }
}


// ======================================================
// TUTUP MODAL TIMELINE
// ======================================================

document.getElementById(
  "batalTimeline"
)?.addEventListener(
  "click",
  () => {
    timelineModal.classList.remove(
      "show"
    );
  }
);

// ======================================================
// SELECT DOK FROM MASTER DOKUMEN
// ======================================================
async function loadMasterDokumen() {
  const select =
    document.getElementById(
      "namaDokumen"
    );

  if (!select) {
    return;
  }

  select.innerHTML = `
    <option value="">
      Memuat dokumen...
    </option>
  `;

  select.disabled = true;

  try {
    const response =
      await fetch(
        "/api/master-dokumen"
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Gagal mengambil master dokumen"
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(
        "Format master dokumen tidak valid"
      );
    }

    select.innerHTML = `
      <option value="">
        Pilih Kode Dokumen
      </option>
    `;

    data.forEach(item => {
  const kode =
    String(
      item.kode_dokumen ||
      item.kode ||
      item.name ||
      ""
    ).trim();

  const deskripsi =
    String(
      item.deskripsi ||
      item.nama_dokumen ||
      item.nama ||
      ""
    ).trim();

  if (!kode) {
    return;
  }

  const option =
    document.createElement(
      "option"
    );

  // Yang dikirim dan disimpan ke database
  option.value =
    kode;

  // Yang ditampilkan pada dropdown
  option.textContent =
    deskripsi
      ? `${kode} - ${deskripsi}`
      : kode;

  option.dataset.id =
    item.id || "";

  option.dataset.deskripsi =
    deskripsi;

  select.appendChild(
    option
  );
});

  } catch (error) {
    console.error(
      "ERROR MASTER DOKUMEN:",
      error
    );

    select.innerHTML = `
      <option value="">
        Gagal memuat dokumen
      </option>
    `;

    alert(error.message);

  } finally {
    select.disabled = false;
  }
}

// ======================================================
// DOKUMEN PARTNER
// ======================================================

function renderDokumenPartner(
  dokumen = []
) {
  if (
    !Array.isArray(dokumen) ||
    dokumen.length === 0
  ) {
    return `
      <div class="empty">
        Belum ada dokumen partner.
      </div>
    `;
  }

  return dokumen
    .map(item => {
      const checked =
        item.is_checked === true;

      const ukuranFile =
        Number(
          item.ukuran_file || 0
        );

      const ukuranTampil =
        ukuranFile >=
        1024 * 1024
          ? `${(
              ukuranFile /
              (1024 * 1024)
            ).toFixed(2)} MB`
          : ukuranFile > 0
            ? `${(
                ukuranFile / 1024
              ).toFixed(1)} KB`
            : "";

      const informasiFile =
        item.path_file
          ? `
            <div style="
              margin-top:10px;
              color:#64748b;
              font-size:13px;
            ">
              📎
              ${
                escapeHtml(
                  item.nama_file_asli ||
                  "Dokumen"
                )
              }

              ${
                ukuranTampil
                  ? ` • ${ukuranTampil}`
                  : ""
              }
            </div>
          `
          : `
            <div style="
              margin-top:10px;
              color:#94a3b8;
              font-size:13px;
            ">
              Belum ada file
            </div>
          `;

      const tombolFile =
        item.path_file
          ? `
            <a
              href="${escapeHtml(
                item.path_file
              )}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-file btn-lihat-file"
            >
              Lihat
            </a>

            <a
              href="${escapeHtml(
                item.path_file
              )}"
              download
              class="btn-file btn-unduh-file"
            >
              Unduh
            </a>
          `
          : "";

      return `
        <div class="dokumen-item">

          <div class="dokumen-info">

            <input
              type="checkbox"
              class="dokumen-check"
              ${checked ? "checked" : ""}
              onchange="
                toggleDokumenPartner(
                  ${Number(item.id)},
                  this.checked
                )
              "
            >

            <div class="dokumen-detail">

              <strong>
                ${
                  escapeHtml(
                    item.nama_dokumen ||
                    "-"
                  )
                }
              </strong>

              <div class="label">
                No. Dokumen:
                ${
                  escapeHtml(
                    item.nomor_dokumen ||
                    "-"
                  )
                }
              </div>

              <div class="label">
                ${
                  checked
                    ? `Selesai • ${
                        formatTanggalWaktu(
                          item.checked_at
                        )
                      }`
                    : "Belum selesai"
                }
              </div>

              ${informasiFile}

            </div>

          </div>

          <div class="dokumen-action">

            ${tombolFile}

            <button
              type="button"
              class="btn-danger"
              onclick="
                hapusDokumenPartner(
                  ${Number(item.id)}
                )
              "
            >
              Hapus
            </button>

          </div>

        </div>
      `;
    })
    .join("");
}

async function tambahDokumenPartner(
  proyekPartnerId
) {
  if (!proyekPartnerId) {
    alert(
      "ID partner proyek tidak ditemukan."
    );

    return;
  }

  activePartnerDokumenUploadId =
    Number(proyekPartnerId);

  document.getElementById(
    "dokumenForm"
  )?.reset();

  await loadMasterDokumen();

  const title =
    document.getElementById(
      "dokumenModalTitle"
    );

  if (title) {
    title.textContent =
      "Tambah Dokumen Partner";
  }

  dokumenModal.classList.add(
    "show"
  );
}

async function toggleDokumenPartner(
  id,
  checked
) {

  try {

    const response =
      await fetch(
        `/api/proyek/partner/dokumen/${id}/check`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              is_checked: checked
            })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal memperbarui dokumen partner"
      );

    }


    await loadDetail();


  } catch (error) {

    console.error(
      "ERROR CHECK DOKUMEN PARTNER:",
      error
    );

    alert(error.message);

    await loadDetail();

  }

}


async function hapusDokumenPartner(id) {

  const konfirmasi =
    confirm(
      "Hapus dokumen partner ini?"
    );


  if (!konfirmasi) return;


  try {

    const response =
      await fetch(
        `/api/proyek/partner/dokumen/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menghapus dokumen partner"
      );

    }


    await loadDetail();


  } catch (error) {

    console.error(
      "ERROR HAPUS DOKUMEN PARTNER:",
      error
    );

    alert(error.message);

  }

}

// ======================================================
// EDIT TERMIN PARTNER
// ======================================================

function editTerminPartner(id) {
  let terminDitemukan = null;
  let partnerDitemukan = null;

  const partners =
    detailData?.partners || [];

  // Cari termin dari seluruh partner
  for (const partner of partners) {
    const termin =
      (partner.termin || []).find(
        item =>
          Number(item.id) ===
          Number(id)
      );

    if (termin) {
      terminDitemukan =
        termin;

      partnerDitemukan =
        partner;

      break;
    }
  }

  if (
    !terminDitemukan ||
    !partnerDitemukan
  ) {
    alert(
      "Termin partner tidak ditemukan."
    );

    return;
  }

  // Tentukan partner dan termin aktif
  activePartnerId =
    Number(
      partnerDitemukan
        .proyek_partner_id
    );

  activePartnerTerminId =
    Number(
      terminDitemukan.id
    );

  // Tentukan input yang memiliki data
  if (
    Number(
      terminDitemukan.persentase
    ) > 0
  ) {
    inputTerminTerakhir =
      "persentase";
  } else {
    inputTerminTerakhir =
      "nominal";
  }

  // Hidden ID
  document.getElementById(
    "terminId"
  ).value =
    terminDitemukan.id;

  // Nama termin
  document.getElementById(
    "namaTermin"
  ).value =
    terminDitemukan.nama_termin ||
    "";

  // Atur kondisi input terlebih dahulu
  aturInputTermin();

  // Persentase
  document.getElementById(
    "persentaseTermin"
  ).value =
    terminDitemukan.persentase ??
    "";

  // Nominal
    setNilaiNominal(
      "nominalTermin",
      terminDitemukan.nominal
    );

  // Status pembayaran
  document.getElementById(
    "statusPembayaran"
  ).value =
    terminDitemukan
      .status_pembayaran ||
    "Belum Dibayar";

  // Tanggal jatuh tempo
  document.getElementById(
    "tanggalJatuhTempo"
  ).value =
    tanggalInput(
      terminDitemukan
        .tanggal_jatuh_tempo
    );

  // Tanggal bayar
  document.getElementById(
    "tanggalBayar"
  ).value =
    tanggalInput(
      terminDitemukan
        .tanggal_bayar
    );

  // Syarat pembayaran
  document.getElementById(
    "syaratPembayaran"
  ).value =
    terminDitemukan
      .syarat_pembayaran ||
    "";

  // Judul modal
  document.getElementById(
    "terminModalTitle"
  ).textContent =
    `Edit Termin Partner - ${
      partnerDitemukan.nama_partner ||
      ""
    }`;

  // Buka modal
  terminModal.classList.add(
    "show"
  );
}

// ======================================================
// DELETE TERMIN
// ======================================================

async function hapusTermin(id) {

  const konfirmasi =
    confirm(
      "Hapus termin ini?"
    );


  if (!konfirmasi) return;


  try {

    const response =
      await fetch(
        `/api/proyek/klien/termin/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menghapus termin"
      );

    }


    await loadDetail();


  } catch (error) {

    alert(error.message);

  }

}

// ======================================================
// DOKUMEN
// ======================================================

function renderDokumen(klien) {
  const container =
    document.getElementById(
      "dokumenContainer"
    );

  if (!container) return;

  const daftarDokumen =
    Array.isArray(klien?.dokumen)
      ? klien.dokumen
      : [];

  if (
    daftarDokumen.length === 0
  ) {
    container.innerHTML = `
      <div class="empty">
        Belum ada dokumen.
      </div>
    `;

    return;
  }

  container.innerHTML =
    daftarDokumen
      .map(item => {
        const checked =
          item.is_checked === true;

        const ukuranFile =
          Number(
            item.ukuran_file || 0
          );

        const ukuranTampil =
          ukuranFile >=
          1024 * 1024
            ? `${(
                ukuranFile /
                (1024 * 1024)
              ).toFixed(2)} MB`
            : ukuranFile > 0
              ? `${(
                  ukuranFile / 1024
                ).toFixed(1)} KB`
              : "";

        const informasiFile =
          item.path_file
            ? `
              <div style="
                margin-top:10px;
                color:#64748b;
                font-size:13px;
              ">
                📎
                ${item.nama_file_asli || "Dokumen"}
                ${
                  ukuranTampil
                    ? ` • ${ukuranTampil}`
                    : ""
                }
              </div>
            `
            : `
              <div style="
                margin-top:10px;
                color:#94a3b8;
                font-size:13px;
              ">
                Belum ada file
              </div>
            `;

        const tombolFile =
          item.path_file
            ? `
              <a
                href="${item.path_file}"
                target="_blank"
                rel="noopener noreferrer"
                class="btn-file btn-lihat-file"
              >
                Lihat
              </a>

              <a
                href="${item.path_file}"
                download
                class="btn-file btn-unduh-file"
              >
                Unduh
              </a>
            `
            : "";

        return `
          <div class="dokumen-item">
            <div class="dokumen-info">
              <input
                type="checkbox"
                class="dokumen-check"
                ${checked ? "checked" : ""}
                onchange="
                  toggleDokumen(
                    ${item.id},
                    this.checked
                  )
                "
              >

              <div class="dokumen-detail">
                <strong>
                  ${item.nama_dokumen}
                </strong>

                <div class="label">
                  No. Dokumen:
                  ${item.nomor_dokumen || "-"}
                </div>

                <div class="label">
                  ${
                    checked
                      ? `Selesai • ${
                          formatTanggalWaktu(
                            item.checked_at
                          )
                        }`
                      : "Belum selesai"
                  }
                </div>

                ${informasiFile}
              </div>
            </div>

            <div class="dokumen-action">
              ${tombolFile}

              <button
                type="button"
                class="btn-danger"
                onclick="
                  hapusDokumen(
                    ${item.id}
                  )
                "
              >
                Hapus
              </button>
            </div>
          </div>
        `;
      })
      .join("");
}

// ======================================================
// DOKUMEN KLIEN
// ======================================================

const dokumenModal =
  document.getElementById(
    "dokumenModal"
  );
// ======================================================
// BUKA MODAL DOKUMEN
// ======================================================
const tambahDokumenButton =
  document.getElementById(
    "tambahDokumenButton"
  );

if (tambahDokumenButton) {
  tambahDokumenButton.addEventListener(
    "click",
    async () => {
      if (!detailData?.klien) {
        alert(
          "Proyek belum memiliki klien."
        );

        return;
      }

      activePartnerDokumenUploadId =
        null;

      document.getElementById(
        "dokumenForm"
      )?.reset();

      await loadMasterDokumen();

      document.getElementById(
        "dokumenModalTitle"
      ).textContent =
        "Tambah Dokumen Klien";

      dokumenModal.classList.add(
        "show"
      );
    }
  );
}

// ======================================================
// TUTUP MODAL DOKUMEN
// ======================================================
const batalDokumen =
  document.getElementById(
    "batalDokumen"
  );

if (batalDokumen) {
  batalDokumen.addEventListener(
    "click",
    () => {
      dokumenModal.classList.remove(
        "show"
      );

      document.getElementById(
        "dokumenForm"
      )?.reset();

      activePartnerDokumenUploadId =
        null;
    }
  );
}
// ======================================================
// SIMPAN DOKUMEN
// ======================================================
const dokumenForm =
  document.getElementById(
    "dokumenForm"
  );

if (dokumenForm) {
  dokumenForm.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      const namaDokumen =
        document.getElementById(
          "namaDokumen"
        ).value.trim();

      const nomorDokumen =
        document.getElementById(
          "nomorDokumen"
        ).value.trim();

      const fileInput =
        document.getElementById(
          "fileDokumen"
        );

      const fileDokumen =
        fileInput?.files?.[0];

      if (!namaDokumen) {
        alert(
          "Nama dokumen wajib diisi."
        );

        document.getElementById(
          "namaDokumen"
        ).focus();

        return;
      }

      if (
          fileDokumen &&
          fileDokumen.size >
          10 * 1024 * 1024
        ) {
        alert(
          "Ukuran file maksimal 10 MB."
        );

        return;
      }

      const formData =
        new FormData();

      formData.append(
        "nama_dokumen",
        namaDokumen
      );

      formData.append(
        "nomor_dokumen",
        nomorDokumen
      );

      if (fileDokumen) {
        formData.append(
          "file_dokumen",
          fileDokumen
        );
      }

      // Tentukan endpoint berdasarkan mode modal
      const isDokumenPartner =
        activePartnerDokumenUploadId !==
        null;

      let url;

      if (isDokumenPartner) {
        url =
          `/api/proyek/partner/${activePartnerDokumenUploadId}/dokumen`;
      } else {
        const proyekKlienId =
          detailData?.klien
            ?.proyek_klien_id;

        if (!proyekKlienId) {
          alert(
            "Data proyek klien tidak ditemukan."
          );

          return;
        }

        url =
          `/api/proyek/klien/${proyekKlienId}/dokumen`;
      }

      const tombolSimpan =
        dokumenForm.querySelector(
          'button[type="submit"]'
        );

      try {
        if (tombolSimpan) {
          tombolSimpan.disabled =
            true;

          tombolSimpan.textContent =
            "Mengunggah...";
        }

        const response =
          await fetch(
            url,
            {
              method: "POST",
              body: formData
            }
          );

        const contentType =
          response.headers.get(
            "content-type"
          ) || "";

        const result =
          contentType.includes(
            "application/json"
          )
            ? await response.json()
            : {
                error:
                  await response.text()
              };

        if (!response.ok) {
          throw new Error(
            result.error ||
            "Gagal mengunggah dokumen"
          );
        }

        dokumenModal.classList.remove(
          "show"
        );

        dokumenForm.reset();

        activePartnerDokumenUploadId =
          null;

        await loadDetail();

      } catch (error) {
        console.error(
          "ERROR UPLOAD DOKUMEN:",
          error
        );

        alert(error.message);

      } finally {
        if (tombolSimpan) {
          tombolSimpan.disabled =
            false;

          tombolSimpan.textContent =
            "Simpan";
        }
      }
    }
  );
}

// ======================================================
// CHECK / UNCHECK
// ======================================================

async function toggleDokumen(
  id,
  checked
) {

  try {

    const response =
      await fetch(
        `/api/proyek/klien/dokumen/${id}/check`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              is_checked:
                checked
            })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal memperbarui dokumen"
      );

    }


    await loadDetail();


  } catch (error) {

    alert(error.message);

    await loadDetail();

  }

}


// ======================================================
// HAPUS DOKUMEN
// ======================================================

async function hapusDokumen(id) {

  const konfirmasi =
    confirm(
      "Hapus dokumen ini?"
    );


  if (!konfirmasi) return;


  try {

    const response =
      await fetch(
        `/api/proyek/klien/dokumen/${id}`,
        {
          method: "DELETE"
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      throw new Error(
        result.error ||
        "Gagal menghapus dokumen"
      );

    }


    await loadDetail();


  } catch (error) {

    alert(error.message);

  }

}

// FORMAT WAKTU CHECKLIST
function formatTanggalWaktu(value) {

  if (!value) return "-";


  return new Date(value)
    .toLocaleString(
      "id-ID",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );

}

// ======================================================
// PARTNER
// ======================================================

function renderPartner(partners) {
  const container =
    document.getElementById(
      "partnerContainer"
    );

  if (!container) {
    return;
  }

  if (
    !Array.isArray(partners) ||
    partners.length === 0
  ) {
    container.innerHTML = `
      <div class="empty">
        Belum ada partner.
      </div>
    `;

    return;
  }

  container.innerHTML =
    partners
      .map((item, index) => {
        const nilaiSubmitPartner =
          Number(
            item.nilai_submit || 0
          );

        const nilaiFinalPartner =
          nilaiTerakhir(item);

        const bisnisPerformance =
          nilaiSubmitPartner > 0
            ? (
                (
                  nilaiSubmitPartner -
                  nilaiFinalPartner
                ) /
                nilaiSubmitPartner
              ) * 100
            : 0;

        const informasiBerakhir =
          berakhirDalam(
            item.tanggal_akhir
          );
        
        const terminHtml =
          renderTerminPartner(
            item.termin || [],
            nilaiFinalPartner
          );

        return `
          <div class="partner-detail-card">
            <div class="partner-detail-header">
              <div>
                <div class="partner-name">
                  ${
                    item.nama_partner ||
                    item.inisial ||
                    "-"
                  }
                </div>
              </div>
            </div>

            <div
              class="
                contract-expiry
                ${informasiBerakhir.className}
              "
            >
              <div class="contract-expiry-label">
                Berakhir Dalam
              </div>

              <div class="contract-expiry-value">
                ${informasiBerakhir.text}
              </div>
            </div>

            <div class="grid">
              <div class="info">
                <div class="label">
                  Tanggal Mulai
                </div>

                <div class="value">
                  ${
                    tanggal(
                      item.tanggal_mulai
                    )
                  }
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Tanggal Akhir
                </div>

                <div class="value">
                  ${
                    tanggal(
                      item.tanggal_akhir
                    )
                  }
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Durasi
                </div>

                <div class="value">
                  ${
                    selisihTanggal(
                      item.tanggal_mulai,
                      item.tanggal_akhir
                    )
                  }
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Model Pembayaran
                </div>

                <div class="value">
                  ${
                    item.model_pembayaran ||
                    item.metode_pembayaran ||
                    "-"
                  }
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Nilai Submit
                </div>

                <div class="value">
                  ${
                    rupiah(
                      nilaiSubmitPartner
                    )
                  }
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Nilai Final
                </div>

                <div class="value">
                  ${
                    rupiah(
                      nilaiFinalPartner
                    )
                  }
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Bisnis Performance
                </div>

                <div class="value">
                  ${
                    bisnisPerformance
                      .toFixed(2)
                  }%
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Status Pengadaan
                </div>

                <div class="value">
                  ${
                    item.status_pengadaan ||
                    "-"
                  }
                </div>
              </div>

              <div class="info">
                <div class="label">
                  Status Teknis
                </div>

                <div class="value">
                  ${
                    item.status_teknis ||
                    "-"
                  }
                </div>
              </div>
            </div>

            <div class="partner-sub-section">
              <div class="partner-sub-header">
                <div>
                  <div class="partner-sub-title">
                    Termin Pembayaran
                  </div>

                  <div class="partner-sub-description">
                    Termin pembayaran partner
                  </div>
                </div>

                <button
                  type="button"
                  class="btn btn-secondary"
                  onclick="
                    tambahTerminPartner(
                      ${item.proyek_partner_id}
                    )
                  "
                >
                  + Tambah Termin
                </button>
              </div>

              ${terminHtml}
            </div>

            <div class="partner-sub-section">
              <div class="partner-sub-header">
                <div>
                  <div class="partner-sub-title">
                    Dokumen Partner
                  </div>

                  <div class="partner-sub-description">
                    Dokumen kontrak dan administrasi partner
                  </div>
                </div>

                <button
                  type="button"
                  class="btn btn-secondary"
                  onclick="
                    tambahDokumenPartner(
                      ${item.proyek_partner_id}
                    )
                  "
                >
                  + Tambah Dokumen
                </button>
              </div>

              ${
                renderDokumenPartner(
                  item.dokumen || []
                )
              }
            </div>
          </div>
        `;
      })
      .join("");
}

// ======================================================
// TERMIN PARTNER
// ======================================================

function renderTerminPartner(
  termin = [],
  nilaiFinal = 0
) {
  if (!Array.isArray(termin) || termin.length === 0) {
    return `
      <div class="empty-state">
        Belum ada termin pembayaran partner.
      </div>
    `;
  }

  const finalValue =
    Number(nilaiFinal) || 0;

  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Termin</th>
            <th>Persentase</th>
            <th>Nominal</th>
            <th>Status</th>
            <th>Jatuh Tempo</th>
            <th>Tanggal Bayar</th>
            <th>Syarat Pembayaran</th>
            <th>Aksi</th>
          </tr>
        </thead>

        <tbody>
          ${termin.map(item => {
            let persentase =
              Number(item.persentase);

            let nominal =
              Number(item.nominal);

            if (
              (!Number.isFinite(nominal) ||
                nominal <= 0) &&
              Number.isFinite(persentase) &&
              persentase > 0 &&
              finalValue > 0
            ) {
              nominal =
                finalValue *
                persentase /
                100;
            }

            if (
              (!Number.isFinite(persentase) ||
                persentase <= 0) &&
              Number.isFinite(nominal) &&
              nominal > 0 &&
              finalValue > 0
            ) {
              persentase =
                nominal /
                finalValue *
                100;
            }

            const status =
              item.status_pembayaran ||
              "Belum Dibayar";

            const statusClass =
              status === "Dibayar"
                ? "status-dibayar"
                : status === "Proses"
                ? "status-proses"
                : "status-belum-dibayar";

            return `
              <tr>
                <td>
                  ${escapeHtml(
                    item.nama_termin || "-"
                  )}
                </td>

                <td>
                  ${
                    Number.isFinite(persentase) &&
                    persentase > 0
                      ? `${persentase.toFixed(2)}%`
                      : "-"
                  }
                </td>

                <td>
                  ${
                    Number.isFinite(nominal) &&
                    nominal > 0
                      ? rupiah(nominal)
                      : "Rp 0"
                  }
                </td>

                <td>
                  <span class="status-badge ${statusClass}">
                    ${escapeHtml(status)}
                  </span>
                </td>

                <td>
                  ${
                    item.tanggal_jatuh_tempo
                      ? tanggal(
                      item.tanggal_jatuh_tempo
                    )
                      : "-"
                  }
                </td>

                <td>
                  ${
                    item.tanggal_bayar
                      ? tanggal(
                          item.tanggal_bayar
                        )
                      : "-"
                  }
                </td>

                <td>
                  ${escapeHtml(
                    item.syarat_pembayaran ||
                    "-"
                  )}
                </td>

                <td>
                  <div class="action-buttons">
                    <button
                      type="button"
                      class="btn btn-secondary"
                      onclick="editTerminPartner(${Number(
                        item.id
                      )})"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      class="btn btn-danger"
                      onclick="hapusTerminPartner(${Number(
                        item.id
                      )})"
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
  return html;
}

// ======================================================
// EDIT INFORMASI PROYEK
// ======================================================

// ======================================================
// HELPER SELECT OPTION BERDASARKAN ID ATAU NAMA
// ======================================================
function pilihOption(selectElement, id, nama) {
  if (!selectElement) return false;

  const nilaiId =
    id !== null &&
    id !== undefined
      ? String(id)
      : "";

  const nilaiNama =
    String(nama || "")
      .trim()
      .toLowerCase();

  const optionDitemukan =
    Array.from(selectElement.options).find(option => {
      const optionValue =
        String(option.value || "").trim();

      const optionText =
        String(option.textContent || "")
          .trim()
          .toLowerCase();

      return (
        (nilaiId && optionValue === nilaiId) ||
        (nilaiNama && optionText === nilaiNama)
      );
    });

  if (!optionDitemukan) {
    selectElement.value = "";
    return false;
  }

  selectElement.value =
    optionDitemukan.value;

  return true;
}
// ======================================================
// LOAD JENIS PROYEK AKTIF
// ======================================================
async function loadJenisProyekEdit() {
  const select =
    document.getElementById(
      "editJenisProyek"
    );

  select.innerHTML = `
    <option value="">
      Pilih Jenis Proyek
    </option>
  `;

  const response =
    await fetch(
      "/api/proyek/jenis"
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Gagal mengambil jenis proyek"
    );
  }

  data.forEach(item => {
    const option =
      document.createElement("option");

    option.value = item.id;
    option.textContent =
      item.name ||
      item.nama ||
      item.jenis_proyek;

    select.appendChild(option);
  });
}

// ======================================================
// LOAD SUB JENIS PROYEK AKTIF
// ======================================================
async function loadSubJenisProyekEdit(
  jenisId
) {
  const select =
    document.getElementById(
      "editSubJenisProyek"
    );

  select.innerHTML = `
    <option value="">
      Pilih Sub Jenis Proyek
    </option>
  `;

  if (!jenisId) return;

  const response =
    await fetch(
      `/api/proyek/sub-jenis?jenis_id=${encodeURIComponent(
        jenisId
      )}`
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Gagal mengambil sub jenis proyek"
    );
  }

  data.forEach(item => {
    const option =
      document.createElement("option");

    option.value = item.id;
    option.textContent =
      item.name ||
      item.nama ||
      item.sub_jenis_proyek;

    select.appendChild(option);
  });
}

// ======================================================
// LOAD STATUS FINAL AKTIF
// ======================================================
async function loadStatusFinalEdit() {
  const select =
    document.getElementById(
      "editStatusFinal"
    );

  select.innerHTML = `
    <option value="">
      Pilih Status
    </option>
  `;

  const response =
    await fetch(
      "/api/proyek/status?flag=final"
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Gagal mengambil status final"
    );
  }

  data.forEach(item => {
    const option =
      document.createElement("option");

    /*
     * Jika kolom proyek masih menyimpan nama status,
     * option.value akan memakai deskripsi.
     *
     * Jika PUT API sudah memakai status_final_id,
     * ubah menjadi: option.value = item.id;
     */
    option.value =
      item.deskripsi ||
      item.name ||
      item.nama;

    option.dataset.id = item.id;

    option.textContent =
      item.deskripsi ||
      item.name ||
      item.nama;

    select.appendChild(option);
  });
}

// ======================================================
// EVENT PERUBAHAN JENIS PROYEK
// ======================================================
const editJenisProyek =
  document.getElementById(
    "editJenisProyek"
  );

editJenisProyek.addEventListener(
  "change",
  async function () {
    try {
      await loadSubJenisProyekEdit(
        this.value
      );
    } catch (error) {
      console.error(
        "ERROR LOAD SUB JENIS:",
        error
      );
    }
  }
);

// ======================================================
// BUKA MODAL EDIT INFORMASI PROYEK
// ======================================================
const editProyekButton =
  document.getElementById(
    "editProyekButton"
  );

editProyekButton.addEventListener(
  "click",
  async () => {
    const proyek =
      detailData?.proyek;

    if (!proyek) {
      alert(
        "Data proyek belum tersedia"
      );
      return;
    }

    try {
      // ================================================
      // FIELD BIASA
      // ================================================
      document.getElementById(
        "editNamaProyek"
      ).value =
        proyek.nama_proyek || "";

      document.getElementById(
        "editDeskripsi"
      ).value =
        proyek.deskripsi || "";


      // ================================================
      // KATEGORI
      // ================================================
      await loadKategoriEdit();

      editKategoriDipilih = [];

      let kategoriIds = [];

      if (
        Array.isArray(
          proyek.kategori_produk_ids
        )
      ) {
        kategoriIds =
          proyek.kategori_produk_ids
            .map(Number)
            .filter(Boolean);
      } else if (
        proyek.kategori_produk_id
      ) {
        kategoriIds = [
          Number(
            proyek.kategori_produk_id
          )
        ];
      }

      const selectKategori =
        document.getElementById(
          "editKategoriSelect"
        );

      kategoriIds.forEach(id => {
        const option =
          Array.from(
            selectKategori.options
          ).find(item =>
            Number(item.value) === id
          );

        if (!option) return;

        editKategoriDipilih.push({
          id,
          nama:
            option.textContent.trim()
        });
      });

      renderEditKategori();


      // ================================================
      // LOAD JENIS DAN STATUS TERLEBIH DAHULU
      // ================================================
      await Promise.all([
        loadJenisProyekEdit(),
        loadStatusFinalEdit()
      ]);


      // ================================================
      // PILIH JENIS PROYEK
      // ================================================
      const selectJenis =
        document.getElementById(
          "editJenisProyek"
        );

      pilihOption(
        selectJenis,
        proyek.jenis_proyek_id,
        proyek.jenis_proyek
      );

      const jenisIdTerpilih =
        selectJenis.value;


      // ================================================
      // LOAD DAN PILIH SUB JENIS
      // ================================================
      await loadSubJenisProyekEdit(
        jenisIdTerpilih
      );

      const selectSubJenis =
        document.getElementById(
          "editSubJenisProyek"
        );

      pilihOption(
        selectSubJenis,
        proyek.sub_jenis_proyek_id,
        proyek.sub_jenis_proyek
      );


      // ================================================
      // PILIH STATUS FINAL
      // ================================================
      const selectStatus =
        document.getElementById(
          "editStatusFinal"
        );

      pilihOption(
        selectStatus,
        proyek.status_final_id,
        proyek.status_final
      );


      // ================================================
      // BUKA MODAL SETELAH SEMUA NILAI SELESAI
      // ================================================
      document.getElementById(
        "editProyekModal"
      ).classList.add("show");

    } catch (error) {
      console.error(
        "ERROR BUKA EDIT PROYEK:",
        error
      );

      alert(
        `Gagal membuka edit proyek: ${error.message}`
      );
    }
  }
);

// ======================================================
// TOTAL TERMIN TRANSAKSI
// ======================================================

function getTotalTerminTransaksi() {

  if (
    detailData?.proyek?.jenis_proyek !==
    "Transaksi"
  ) {

    return null;

  }


  const termin =
    detailData?.klien?.termin || [];


  return termin.reduce(
    (total, item) => {

      return (
        total +
        Number(
          item.nominal || 0
        )
      );

    },
    0
  );

}

// ======================================================
// EDIT PIC
// ======================================================

const editPicButton =
  document.getElementById("editPicButton");

const editPicModal =
  document.getElementById("editPicModal");

const editPicContainer =
  document.getElementById(
    "editPicContainer"
  );

const batalEditPic =
  document.getElementById(
    "batalEditPic"
  );


if (editPicButton) {

  editPicButton.addEventListener(
    "click",
    async () => {

      try {

        const response =
          await fetch("/api/pic");

        const allPic =
          await response.json();


        if (!response.ok) {

          throw new Error(
            allPic.error ||
            "Gagal mengambil PIC"
          );

        }


        const selectedIds =
          new Set(
            (detailData.pic || [])
              .map(
                item =>
                  Number(item.id)
              )
          );


        editPicContainer.innerHTML =
          allPic.map(item => {

            const checked =
              selectedIds.has(
                Number(item.id)
              )
                ? "checked"
                : "";


            return `
              <label
                style="
                  display:flex;
                  align-items:center;
                  gap:12px;
                  padding:12px;
                  border:1px solid #e5e7eb;
                  border-radius:10px;
                  margin-bottom:8px;
                  cursor:pointer;
                "
              >

                <input
                  type="checkbox"
                  name="editPic"
                  value="${item.id}"
                  ${checked}
                  style="
                    width:auto;
                    min-height:auto;
                  "
                >

                <div>

                  <strong>
                    ${item.nama || "-"}
                  </strong>

                  <div class="label">
                    ${item.jabatan || "-"}
                  </div>

                </div>

              </label>
            `;

          }).join("");


        editPicModal.classList.add(
          "show"
        );


      } catch (error) {

        console.error(
          "ERROR LOAD PIC:",
          error
        );

        alert(error.message);

      }

    }
  );

}


if (batalEditPic) {

  batalEditPic.addEventListener(
    "click",
    () => {

      editPicModal.classList.remove(
        "show"
      );

    }
  );

}


// ======================================================
// EDIT KLIEN
// ======================================================

const editKlienButton =
  document.getElementById(
    "editKlienButton"
  );

const editKlienModal =
  document.getElementById(
    "editKlienModal"
  );

const editKlienId =
  document.getElementById(
    "editKlienId"
  );

const batalEditKlien =
  document.getElementById(
    "batalEditKlien"
  );


// ======================================================
// PILIH OPTION BERDASARKAN ID ATAU DESKRIPSI
// ======================================================

function pilihStatusEdit(
  select,
  statusId,
  statusNama
) {
  if (!select) return false;

  const targetId =
    statusId !== null &&
    statusId !== undefined
      ? String(statusId).trim()
      : "";

  const targetNama =
    String(statusNama || "")
      .trim()
      .toLowerCase();

  const optionDitemukan =
    Array.from(
      select.options
    ).find(option => {
      const optionId =
        String(
          option.dataset.id || ""
        ).trim();

      const optionValue =
        String(option.value || "")
          .trim()
          .toLowerCase();

      const optionText =
        String(
          option.textContent || ""
        )
          .trim()
          .toLowerCase();

      return (
        (
          targetId &&
          optionId === targetId
        ) ||
        (
          targetNama &&
          (
            optionValue === targetNama ||
            optionText === targetNama
          )
        )
      );
    });

  if (optionDitemukan) {
    select.value =
      optionDitemukan.value;

    return true;
  }

  /*
   * Jika status tersimpan tetapi tidak ada
   * di master status aktif, tampilkan tetap.
   */
  if (statusNama) {
    const optionLama =
      document.createElement(
        "option"
      );

    optionLama.value =
      String(statusNama).trim();

    optionLama.textContent =
      `${String(statusNama).trim()} (Tidak Aktif)`;

    optionLama.dataset.legacy =
      "true";

    select.appendChild(
      optionLama
    );

    select.value =
      optionLama.value;

    return true;
  }

  select.value = "";

  return false;
}

// ======================================================
// PILIH OPTION BIASA BERDASARKAN VALUE ATAU TEXT
// ======================================================

function pilihSelectBerdasarkanNama(
  select,
  nilai
) {
  if (!select) return false;

  const target =
    String(nilai || "")
      .trim()
      .toLowerCase();

  if (!target) {
    select.value = "";
    return false;
  }

  const optionDitemukan =
    Array.from(
      select.options
    ).find(option => {
      const optionValue =
        String(option.value || "")
          .trim()
          .toLowerCase();

      const optionText =
        String(
          option.textContent || ""
        )
          .trim()
          .toLowerCase();

      return (
        optionValue === target ||
        optionText === target
      );
    });

  if (optionDitemukan) {
    select.value =
      optionDitemukan.value;

    return true;
  }

  select.value = "";

  return false;
}


// ======================================================
// LOAD STATUS PENGADAAN DAN STATUS TEKNIS
// ======================================================

async function loadStatusEditKlien() {
  const statusPengadaanSelect =
    document.getElementById(
      "editStatusPengadaanKlien"
    );

  const statusTeknisSelect =
    document.getElementById(
      "editStatusTeknisKlien"
    );

  if (
    !statusPengadaanSelect ||
    !statusTeknisSelect
  ) {
    throw new Error(
      "Dropdown status klien tidak ditemukan"
    );
  }

  statusPengadaanSelect.innerHTML = `
    <option value="">
      Memuat status...
    </option>
  `;

  statusTeknisSelect.innerHTML = `
    <option value="">
      Memuat status...
    </option>
  `;

  const response =
    await fetch(
      "/api/proyek/status"
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Gagal mengambil status proyek"
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "Format data status tidak valid"
    );
  }


  // ====================================================
  // FILTER STATUS PENGADAAN
  // ====================================================

  const statusPengadaan =
    data.filter(item =>
      String(item.flag || "")
        .trim()
        .toLowerCase() ===
      "pengadaan"
    );


  // ====================================================
  // FILTER STATUS TEKNIS
  // ====================================================

  const statusTeknis =
    data.filter(item =>
      String(item.flag || "")
        .trim()
        .toLowerCase() ===
      "teknis"
    );


  // ====================================================
  // ISI STATUS PENGADAAN
  // ====================================================

  statusPengadaanSelect.innerHTML = `
    <option value="">
      Pilih Status Pengadaan
    </option>
  `;

  statusPengadaan.forEach(item => {
    const deskripsi =
      String(
        item.deskripsi || ""
      ).trim();

    if (!deskripsi) return;

    const option =
      document.createElement(
        "option"
      );

    option.value =
      deskripsi;

    option.textContent =
      deskripsi;

    option.dataset.id =
      item.id;

    statusPengadaanSelect.appendChild(
      option
    );
  });


  // ====================================================
  // ISI STATUS TEKNIS
  // ====================================================

  statusTeknisSelect.innerHTML = `
    <option value="">
      Pilih Status Teknis
    </option>
  `;

  statusTeknis.forEach(item => {
    const deskripsi =
      String(
        item.deskripsi || ""
      ).trim();

    if (!deskripsi) return;

    const option =
      document.createElement(
        "option"
      );

    option.value =
      deskripsi;

    option.textContent =
      deskripsi;

    option.dataset.id =
      item.id;

    statusTeknisSelect.appendChild(
      option
    );
  });


  console.log(
    "MASTER STATUS EDIT KLIEN:",
    {
      pengadaan:
        statusPengadaan,

      teknis:
        statusTeknis
    }
  );
}

// ======================================================
// LOAD MASTER KLIEN
// ======================================================

async function loadMasterKlienEdit() {
  const response =
    await fetch(
      "/api/proyek/klien"
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data.error ||
      "Gagal mengambil master klien"
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      "Format data master klien tidak valid"
    );
  }

  editKlienId.innerHTML = `
    <option value="">
      Pilih Klien
    </option>
  `;

  data.forEach(item => {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      item.id;

    option.textContent =
      item.perusahaan_klien;

    editKlienId.appendChild(
      option
    );
  });
}

// ======================================================
// BUKA MODAL TAMBAH / EDIT KLIEN
// ======================================================

if (editKlienButton) {
  editKlienButton.addEventListener(
    "click",
    async () => {
      try {
        /*
         * Jika proyek belum memiliki klien,
         * gunakan object kosong agar modal
         * tetap dapat dibuka.
         */
        const klien =
          detailData?.klien || {};

        const modeTambahKlien =
          !detailData?.klien;


        // ==============================================
        // UBAH JUDUL MODAL
        // ==============================================

        const judulModal =
          editKlienModal?.querySelector(
            ".modal-header h3"
          );

        if (judulModal) {
          judulModal.textContent =
            modeTambahKlien
              ? "Tambah Data Klien"
              : "Edit Data Klien";
        }


        // ==============================================
        // UBAH TEKS TOMBOL UTAMA
        // ==============================================

        const tombolSimpan =
          editKlienForm?.querySelector(
            'button[type="submit"]'
          );

        if (tombolSimpan) {
          tombolSimpan.textContent =
            modeTambahKlien
              ? "Tambah Klien"
              : "Simpan Perubahan";
        }


        // ==============================================
        // LOAD MASTER KLIEN DAN STATUS
        // ==============================================

        await Promise.all([
          loadMasterKlienEdit(),
          loadStatusEditKlien()
        ]);


        // ==============================================
        // ISI DROPDOWN KLIEN
        // ==============================================

        if (editKlienId) {
          editKlienId.value =
            String(
              klien.klien_id || ""
            );
        }


        // ==============================================
        // ISI NILAI SUBMIT DAN NEGO
        // ==============================================

      setNilaiNominal(
        "editNilaiSubmitKlien",
        klien.nilai_submit
      );

      setNilaiNominal(
        "editNilaiNego1Klien",
        klien.nilai_nego_1
      );

      setNilaiNominal(
        "editNilaiNego2Klien",
        klien.nilai_nego_2
      );

      setNilaiNominal(
        "editNilaiNego3Klien",
        klien.nilai_nego_3
      );


        // ==============================================
        // ISI TANGGAL
        // ==============================================

        document.getElementById(
          "editTanggalMulaiKlien"
        ).value =
          tanggalInput(
            klien.tanggal_mulai
          );

        document.getElementById(
          "editTanggalAkhirKlien"
        ).value =
          tanggalInput(
            klien.tanggal_akhir
          );


        // ==============================================
        // MODEL PEMBAYARAN
        // ==============================================

        const modelPembayaranSelect =
          document.getElementById(
            "editModelPembayaranKlien"
          );

        if (modeTambahKlien) {
          modelPembayaranSelect.value =
            "";
        } else {
          pilihSelectBerdasarkanNama(
            modelPembayaranSelect,

            klien.model_pembayaran ||
            klien.metode_pembayaran
          );
        }


        // ==============================================
        // STATUS PENGADAAN
        // ==============================================

        const statusPengadaanSelect =
          document.getElementById(
            "editStatusPengadaanKlien"
          );

        if (modeTambahKlien) {
          statusPengadaanSelect.value =
            "";
        } else {
          pilihStatusEdit(
            statusPengadaanSelect,

            klien.status_pengadaan_id ||
            null,

            klien.status_pengadaan
          );
        }


        // ==============================================
        // STATUS TEKNIS
        // ==============================================

        const statusTeknisSelect =
          document.getElementById(
            "editStatusTeknisKlien"
          );

        if (modeTambahKlien) {
          statusTeknisSelect.value =
            "";
        } else {
          pilihStatusEdit(
            statusTeknisSelect,

            klien.status_teknis_id ||
            null,

            klien.status_teknis
          );
        }


        // ==============================================
        // SIMPAN MODE PADA FORM
        // ==============================================

        if (editKlienForm) {
          editKlienForm.dataset.mode =
            modeTambahKlien
              ? "tambah"
              : "edit";
        }


        // ==============================================
        // DEBUG
        // ==============================================

        console.log(
          "BUKA MODAL KLIEN:",
          {
            mode:
              modeTambahKlien
                ? "tambah"
                : "edit",

            proyek_id:
              proyekId,

            proyek_klien_id:
              klien.proyek_klien_id ||
              null,

            klien_id:
              klien.klien_id ||
              null
          }
        );


        // ==============================================
        // BUKA MODAL
        // ==============================================

        if (!editKlienModal) {
          throw new Error(
            "Modal edit klien tidak ditemukan"
          );
        }

        editKlienModal.classList.add(
          "show"
        );

      } catch (error) {
        console.error(
          "ERROR LOAD EDIT KLIEN:",
          error
        );

        alert(
          `Gagal membuka data klien: ${error.message}`
        );
      }
    }
  );
}
// ======================================================
// TOMBOL BATAL EDIT KLIEN
// ======================================================

if (batalEditKlien) {
  batalEditKlien.addEventListener(
    "click",
    () => {
      editKlienModal.classList.remove(
        "show"
      );
    }
  );
}

// ======================================================
// KELOLA PARTNER
// ======================================================

const editPartnerButton =
  document.getElementById(
    "editPartnerButton"
  );

const editPartnerModal =
  document.getElementById(
    "editPartnerModal"
  );

const editPartnerContainer =
  document.getElementById(
    "editPartnerContainer"
  );

const batalEditPartner =
  document.getElementById(
    "batalEditPartner"
  );


let masterPartnerEdit = [];


let masterStatusPartnerEdit = [];


// ======================================================
// OPTION STATUS PARTNER
// ======================================================

function statusPartnerOptions(
  flag,
  selectedValue = ""
) {
  const selected =
    String(selectedValue || "")
      .trim()
      .toLowerCase();

  const daftarStatus =
    masterStatusPartnerEdit.filter(
      item =>
        String(item.flag || "")
          .trim()
          .toLowerCase() ===
        String(flag || "")
          .trim()
          .toLowerCase()
    );

  return `
    <option value="">
      Pilih Status
    </option>

    ${daftarStatus
      .map(item => {
        const deskripsi =
          item.deskripsi ||
          item.nama ||
          item.name ||
          "";

        const isSelected =
          String(deskripsi)
            .trim()
            .toLowerCase() ===
          selected;

        return `
          <option
            value="${deskripsi}"
            data-id="${item.id}"
            ${
              isSelected
                ? "selected"
                : ""
            }
          >
            ${deskripsi}
          </option>
        `;
      })
      .join("")}
  `;
}


// ======================================================
// OPTION MODEL PEMBAYARAN
// ======================================================

function modelPembayaranPartnerOptions(
  selectedValue = ""
) {
  const selected =
    String(selectedValue || "")
      .trim()
      .toLowerCase();

  const daftar = [
    "Tahunan",
    "Bulanan",
    "Termin",
    "One Time Charge"
  ];

  return `
    <option value="">
      Pilih Model Pembayaran
    </option>

    ${daftar
      .map(item => `
        <option
          value="${item}"
          ${
            item.toLowerCase() ===
            selected
              ? "selected"
              : ""
          }
        >
          ${item}
        </option>
      `)
      .join("")}
  `;
}
// ======================================================
// BUAT OPTION MASTER PARTNER
// ======================================================

function partnerOptions(
  selectedId = ""
) {

  return `
    <option value="">
      Pilih Partner
    </option>

    ${masterPartnerEdit.map(
      partner => `
        <option
          value="${partner.id}"
          ${
            Number(partner.id) ===
            Number(selectedId)
              ? "selected"
              : ""
          }
        >
          ${partner.nama_partner}
        </option>
      `
    ).join("")}
  `;

}

// ======================================================
// BUAT CARD PARTNER
// ======================================================

function buatPartnerCard(
  item = {},
  index = 0
) {
  const proyekPartnerId =
    item.proyek_partner_id || "";

  return `
    <div
      class="card edit-partner-card"
      data-edit-partner="${proyekPartnerId}"
      style="
        margin-bottom:18px;
        border:1px solid #e5e7eb;
        border-radius:16px;
        padding:24px;
      "
    >
      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          margin-bottom:24px;
        "
      >
        <strong class="partner-card-title">
          Partner ${index + 1}
        </strong>

        <button
          type="button"
          class="btn-danger"
          onclick="hapusPartnerCard(this)"
        >
          Hapus Partner
        </button>
      </div>

      <input
        type="hidden"
        class="edit-proyek-partner-id"
        value="${proyekPartnerId}"
      >

      <div class="form-group">
        <label>
          Partner
        </label>

        <select
          class="edit-partner-id"
          required
        >
          ${
            partnerOptions(
              item.partner_id
            )
          }
        </select>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label>
            Nilai Submit
          </label>

          <input
            type="text"
            inputmode="numeric"
            class="edit-partner-submit input-rupiah"
            value="${formatInputNominal(
              item.nilai_submit
            )}"
            autocomplete="off"
          >
        </div>

        <div class="form-group">
          <label>
            Nilai Nego 1
          </label>

          <input
            type="text"
            inputmode="numeric"
            class="edit-partner-nego1 input-rupiah"
            value="${formatInputNominal(
              item.nilai_nego_1
            )}"
            autocomplete="off"
          >
        </div>

        <div class="form-group">
          <label>
            Nilai Nego 2
          </label>

          <input
            type="text"
            inputmode="numeric"
            class="edit-partner-nego2 input-rupiah"
            value="${formatInputNominal(
              item.nilai_nego_2
            )}"
            autocomplete="off"
          >
        </div>

        <div class="form-group">
          <label>
            Nilai Nego 3
          </label>

          <input
            type="text"
            inputmode="numeric"
            class="edit-partner-nego3 input-rupiah"
            value="${formatInputNominal(
              item.nilai_nego_3
            )}"
            autocomplete="off"
          >
        </div>

        <div class="form-group">
          <label>
            Tanggal Mulai
          </label>

          <input
            type="date"
            class="edit-partner-mulai"
            value="${
              tanggalInput(
                item.tanggal_mulai
              )
            }"
          >
        </div>

        <div class="form-group">
          <label>
            Tanggal Akhir
          </label>

          <input
            type="date"
            class="edit-partner-akhir"
            value="${
              tanggalInput(
                item.tanggal_akhir
              )
            }"
          >
        </div>

        <div
          class="form-group"
          style="grid-column:1 / -1;"
        >
          <label>
            Model Pembayaran
          </label>

          <select
            class="edit-partner-model-pembayaran"
          >
            ${
              modelPembayaranPartnerOptions(
                item.model_pembayaran ||
                item.metode_pembayaran
              )
            }
          </select>
        </div>

        <div class="form-group">
          <label>
            Status Pengadaan
          </label>

          <select
            class="edit-partner-pengadaan"
          >
            ${
              statusPartnerOptions(
                "pengadaan",
                item.status_pengadaan
              )
            }
          </select>
        </div>

        <div class="form-group">
          <label>
            Status Teknis
          </label>

          <select
            class="edit-partner-teknis"
          >
            ${
              statusPartnerOptions(
                "teknis",
                item.status_teknis
              )
            }
          </select>
        </div>
      </div>
    </div>
  `;
}


// ======================================================
// UPDATE NOMOR PARTNER
// ======================================================

function updateNomorPartner() {

  const cards =
    editPartnerContainer
      .querySelectorAll(
        ".edit-partner-card"
      );

  cards.forEach(
    (card, index) => {

      const title =
        card.querySelector(
          ".partner-card-title"
        );

      if (title) {

        title.textContent =
          `Partner ${index + 1}`;

      }

    }
  );

}


// ======================================================
// TAMBAH PARTNER
// ======================================================

function tambahPartnerCard() {

  const list =
    document.getElementById(
      "editPartnerList"
    );

  if (!list) return;


  const index =
    list.querySelectorAll(
      ".edit-partner-card"
    ).length;


  list.insertAdjacentHTML(
    "beforeend",
    buatPartnerCard(
      {},
      index
    )
  );


  updateNomorPartner();

}

// ======================================================
// HAPUS PARTNER DARI FORM
// ======================================================

function hapusPartnerCard(
  button
) {

  const card =
    button.closest(
      ".edit-partner-card"
    );

  if (!card) return;


  const namaPartner =
    card.querySelector(
      ".edit-partner-id"
    );

  const nama =
    namaPartner &&
    namaPartner.options[
      namaPartner.selectedIndex
    ]
      ? namaPartner.options[
          namaPartner.selectedIndex
        ].text
      : "partner ini";


  const konfirmasi =
    confirm(
      `Hapus ${nama} dari proyek?`
    );


  if (!konfirmasi) return;


  card.remove();

  updateNomorPartner();

}

// ======================================================
// BUKA KELOLA PARTNER
// ======================================================

if (editPartnerButton) {

  editPartnerButton.addEventListener(
    "click",
    async () => {

      try {

        const [
          responsePartner,
          responseStatus
        ] = await Promise.all([
          fetch("/api/proyek/partner"),
          fetch("/api/proyek/status")
        ]);

        const dataPartner =
          await responsePartner.json();

        const dataStatus =
          await responseStatus.json();

        if (!responsePartner.ok) {
          throw new Error(
            dataPartner.error ||
            "Gagal mengambil master partner"
          );
        }

        if (!responseStatus.ok) {
          throw new Error(
            dataStatus.error ||
            "Gagal mengambil status proyek"
          );
        }

        masterPartnerEdit =
          Array.isArray(dataPartner)
            ? dataPartner
            : [];

        masterStatusPartnerEdit =
          Array.isArray(dataStatus)
            ? dataStatus
            : [];

        const partners =
          detailData.partners || [];


        editPartnerContainer.innerHTML = `

          <form id="editPartnerForm">

            <div id="editPartnerList">

              ${
                partners.length
                  ? partners.map(
                      (
                        item,
                        index
                      ) =>
                        buatPartnerCard(
                          item,
                          index
                        )
                    ).join("")
                  : `
                    <div
                      id="partnerKosongInfo"
                      class="empty"
                      style="
                        margin-bottom:16px;
                      "
                    >
                      Proyek belum memiliki partner.
                    </div>
                  `
              }

            </div>


            <div
              style="
                margin-top:16px;
                margin-bottom:24px;
              "
            >

              <button
                type="button"
                class="btn-secondary"
                id="tambahPartnerEditButton"
              >
                + Tambah Partner
              </button>

            </div>


            <div
              style="
                display:flex;
                justify-content:flex-end;
                gap:10px;
              "
            >

              <button
                type="button"
                class="btn-secondary"
                id="batalPartnerForm"
              >
                Batal
              </button>

              <button
                type="submit"
                class="btn-primary"
              >
                Simpan Perubahan
              </button>

            </div>

          </form>

        `;


        editPartnerModal.classList.add(
          "show"
        );


        // ===============================
        // TAMBAH PARTNER
        // ===============================

        document.getElementById(
          "tambahPartnerEditButton"
        ).addEventListener(
          "click",
          () => {

            const info =
              document.getElementById(
                "partnerKosongInfo"
              );

            if (info) {
              info.remove();
            }

            tambahPartnerCard();

          }
        );


        // ===============================
        // BATAL
        // ===============================

        document.getElementById(
          "batalPartnerForm"
        ).addEventListener(
          "click",
          () => {

            editPartnerModal
              .classList.remove(
                "show"
              );

          }
        );


        // ===============================
        // SIMPAN
        // ===============================

        document.getElementById(
          "editPartnerForm"
        ).addEventListener(
          "submit",
          async event => {

            event.preventDefault();


            const cards =
              editPartnerContainer
                .querySelectorAll(
                  ".edit-partner-card"
                );


            const partnerPayload =
              Array.from(cards)
                .map(card => {

                  function numberOrNull(
                selector
              ) {
                const input =
                  card.querySelector(
                    selector
                  );

                if (!input) {
                  return null;
                }

                return nominalOrNull(
                  input.value
                );
              }


                  return {

                    proyek_partner_id:
                      card.querySelector(
                        ".edit-proyek-partner-id"
                      ).value
                        ? Number(
                            card.querySelector(
                              ".edit-proyek-partner-id"
                            ).value
                          )
                        : null,


                    partner_id:
                      Number(
                        card.querySelector(
                          ".edit-partner-id"
                        ).value
                      ),


                    nilai_submit:
                      numberOrNull(
                        ".edit-partner-submit"
                      ),


                    nilai_nego_1:
                      numberOrNull(
                        ".edit-partner-nego1"
                      ),


                    nilai_nego_2:
                      numberOrNull(
                        ".edit-partner-nego2"
                      ),


                    nilai_nego_3:
                      numberOrNull(
                        ".edit-partner-nego3"
                      ),


                    tanggal_mulai:
                      card.querySelector(
                        ".edit-partner-mulai"
                      ).value || null,


                    tanggal_akhir:
                      card.querySelector(
                        ".edit-partner-akhir"
                      ).value || null,

                    model_pembayaran:
                      card.querySelector(
                        ".edit-partner-model-pembayaran"
                      ).value || null,

                    status_pengadaan:
                      card.querySelector(
                        ".edit-partner-pengadaan"
                      ).value.trim() || null,


                    status_teknis:
                      card.querySelector(
                        ".edit-partner-teknis"
                      ).value.trim() || null

                  };

                });


            // ===============================
            // VALIDASI PARTNER
            // ===============================

            const partnerKosong =
              partnerPayload.some(
                item =>
                  !item.partner_id
              );


            if (partnerKosong) {

              alert(
                "Partner wajib dipilih."
              );

              return;

            }


            // ===============================
            // CEK DUPLIKAT PARTNER
            // ===============================

            const partnerIds =
              partnerPayload.map(
                item =>
                  item.partner_id
              );


            const uniqueIds =
              new Set(
                partnerIds
              );


            if (
              uniqueIds.size !==
              partnerIds.length
            ) {

              alert(
                "Partner yang sama tidak boleh ditambahkan dua kali."
              );

              return;

            }


            try {

              const saveResponse =
                await fetch(
                  `/api/proyek/${proyekId}/partners`,
                  {

                    method: "PUT",

                    headers: {
                      "Content-Type":
                        "application/json"
                    },

                    body:
                      JSON.stringify({
                        partners:
                          partnerPayload
                      })

                  }
                );


              const result =
                await saveResponse.json();


              if (!saveResponse.ok) {

                throw new Error(
                  result.error ||
                  "Gagal memperbarui partner"
                );

              }


              editPartnerModal
                .classList.remove(
                  "show"
                );


              await loadDetail();


            } catch (error) {

              console.error(
                "ERROR UPDATE PARTNER:",
                error
              );

              alert(
                error.message
              );

            }

          }
        );


      } catch (error) {

        console.error(
          "ERROR LOAD PARTNER:",
          error
        );

        alert(
          error.message
        );

      }

    }
  );

}


// ======================================================
// BATAL KELOLA PARTNER
// ======================================================

if (batalEditPartner) {

  batalEditPartner.addEventListener(
    "click",
    () => {

      editPartnerModal
        .classList.remove(
          "show"
        );

    }
  );

}

// ======================================================
// NILAI SUBMIT PARTNER TAMPIL
// ======================================================

function nilaiSubmitPartnerTampil(partner) {

  // TRANSAKSI:
  // Nilai Submit Partner =
  // total nominal seluruh termin partner

  if (
    detailData?.proyek?.jenis_proyek ===
    "Transaksi"
  ) {

    const termin =
      partner?.termin || [];

    return termin.reduce(
      (total, item) => {

        return (
          total +
          Number(item.nominal || 0)
        );

      },
      0
    );

  }


  // REGULER / SLA / SEWA
  // tetap menggunakan nilai submit partner

  return Number(
    partner?.nilai_submit || 0
  );

}

// ======================================================
// TAMBAH TERMIN PARTNER
// ======================================================

function tambahTerminPartner(
  proyekPartnerId
) {

  console.log(
    "TAMBAH TERMIN PARTNER:",
    proyekPartnerId
  );

  // tandai bahwa termin yang sedang
  // dikelola adalah termin partner
  activePartnerId =
    Number(proyekPartnerId);

  activePartnerTerminId =
    null;


  // reset form
  const form =
    document.getElementById(
      "terminForm"
    );

  if (form) {
    form.reset();
  }


  // kosongkan ID termin
  const terminId =
    document.getElementById(
      "terminId"
    );

  if (terminId) {
    terminId.value = "";
  }


  // judul modal
  const title =
    document.getElementById(
      "terminModalTitle"
    );

  if (title) {
    title.textContent =
      "Tambah Termin Partner";
  }

aturInputTermin();


  // buka modal
  const modal =
    document.getElementById(
      "terminModal"
    );

  if (!modal) {

    console.error(
      "terminModal tidak ditemukan"
    );

    return;

  }


  modal.classList.add(
    "show"
  );

}
// ======================================================
// TUTUP MODAL KETIKA KLIK AREA GELAP
// ======================================================

[
  editProyekModal,
  editPicModal,
  editKlienModal,
  editPartnerModal
].forEach(modal => {

  if (!modal) return;


  modal.addEventListener(
    "click",
    event => {

      if (event.target === modal) {

        modal.classList.remove(
          "show"
        );

      }

    }
  );

});

// ======================================================
// SIMPAN EDIT PROYEK
// ======================================================
const editProyekForm =
  document.getElementById(
    "editProyekForm"
  );

if (editProyekForm) {
  editProyekForm.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      // Ambil elemen dropdown
      const jenisSelect =
        document.getElementById(
          "editJenisProyek"
        );

      const subJenisSelect =
        document.getElementById(
          "editSubJenisProyek"
        );

      const statusSelect =
        document.getElementById(
          "editStatusFinal"
        );

      // Validasi
      if (
        editKategoriDipilih.length === 0
      ) {
        alert(
          "Minimal satu kategori harus dipilih"
        );
        return;
      }

      if (!jenisSelect.value) {
        alert(
          "Jenis proyek wajib dipilih"
        );
        return;
      }

      if (
        !document
          .getElementById(
            "editNamaProyek"
          )
          .value.trim()
      ) {
        alert(
          "Nama proyek wajib diisi"
        );
        return;
      }

      // Susun data yang dikirim ke server
      const payload = {
        kategori_produk_ids:
          editKategoriDipilih.map(
            item => item.id
          ),

        nama_proyek:
          document.getElementById(
            "editNamaProyek"
          ).value.trim(),

        jenis_proyek_id:
          jenisSelect.value
            ? Number(
                jenisSelect.value
              )
            : null,

        jenis_proyek:
          jenisSelect
            .selectedOptions[0]
            ?.textContent
            .trim() || null,

        sub_jenis_proyek_id:
          subJenisSelect.value
            ? Number(
                subJenisSelect.value
              )
            : null,

        sub_jenis_proyek:
          subJenisSelect.value
            ? subJenisSelect
                .selectedOptions[0]
                ?.textContent
                .trim()
            : null,

        status_final_id:
          statusSelect
            .selectedOptions[0]
            ?.dataset.id
            ? Number(
                statusSelect
                  .selectedOptions[0]
                  .dataset.id
              )
            : null,

        status_final:
          statusSelect.value || null,

        deskripsi:
          document.getElementById(
            "editDeskripsi"
          ).value.trim()
      };

      console.log(
        "PAYLOAD EDIT PROYEK:",
        payload
      );

      const tombolSimpan =
        editProyekForm.querySelector(
          'button[type="submit"]'
        );

      try {
        if (tombolSimpan) {
          tombolSimpan.disabled = true;
          tombolSimpan.textContent =
            "Menyimpan...";
        }

        const response =
          await fetch(
            `/api/proyek/${proyekId}`,
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

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
            "Gagal memperbarui proyek"
          );
        }

        alert(
          result.message ||
          "Proyek berhasil diperbarui"
        );

        document
          .getElementById(
            "editProyekModal"
          )
          .classList.remove("show");

        // Muat ulang detail proyek
        await loadDetail();

      } catch (error) {
        console.error(
          "ERROR UPDATE PROYEK:",
          error
        );

        alert(
          `Gagal menyimpan perubahan: ${error.message}`
        );

      } finally {
        if (tombolSimpan) {
          tombolSimpan.disabled = false;
          tombolSimpan.textContent =
            "Simpan Perubahan";
        }
      }
    }
  );
}

// ======================================================
// SIMPAN PIC PROYEK
// ======================================================

const editPicForm =
  document.getElementById(
    "editPicForm"
  );


if (editPicForm) {

  editPicForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const picIds =
        Array.from(
          document.querySelectorAll(
            'input[name="editPic"]:checked'
          )
        )
        .map(
          item =>
            Number(item.value)
        );


      try {

        const response =
          await fetch(
            `/api/proyek/${proyekId}/pic`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({
                  pic_ids: picIds
                })
            }
          );


        const result =
          await response.json();


        if (!response.ok) {

          throw new Error(
            result.error ||
            "Gagal memperbarui PIC"
          );

        }


        editPicModal.classList.remove(
          "show"
        );


        await loadDetail();


      } catch (error) {

        console.error(
          "ERROR UPDATE PIC:",
          error
        );

        alert(error.message);

      }

    }
  );

}
// ======================================================
// SIMPAN EDIT KLIEN
// ======================================================

const editKlienForm =
  document.getElementById(
    "editKlienForm"
  );


function angkaAtauNull(id) {
  const element =
    document.getElementById(id);

  if (!element) {
    return null;
  }

  return nominalOrNull(
    element.value
  );
}


if (editKlienForm) {

  editKlienForm.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      const payload = {
  klien_id:
    editKlienId.value
      ? Number(editKlienId.value)
      : null,

  nilai_submit:
    angkaAtauNull(
      "editNilaiSubmitKlien"
    ),

  nilai_nego_1:
    angkaAtauNull(
      "editNilaiNego1Klien"
    ),

  nilai_nego_2:
    angkaAtauNull(
      "editNilaiNego2Klien"
    ),

  nilai_nego_3:
    angkaAtauNull(
      "editNilaiNego3Klien"
    ),

  tanggal_mulai:
    document.getElementById(
      "editTanggalMulaiKlien"
    ).value || null,

  tanggal_akhir:
    document.getElementById(
      "editTanggalAkhirKlien"
    ).value || null,

  model_pembayaran:
    document.getElementById(
      "editModelPembayaranKlien"
    ).value || null,

  status_pengadaan:
    document.getElementById(
      "editStatusPengadaanKlien"
    ).value || null,

  status_teknis:
    document.getElementById(
      "editStatusTeknisKlien"
    ).value || null
};

console.log(
  "PAYLOAD EDIT KLIEN:",
  payload
);


      if (!payload.klien_id) {

        alert(
          "Silakan pilih klien."
        );

        return;

      }


      try {

        const response =
          await fetch(
            `/api/proyek/${proyekId}/klien`,
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


        const result =
          await response.json();


        if (!response.ok) {

          throw new Error(
            result.error ||
            "Gagal memperbarui klien"
          );

        }


        editKlienModal.classList.remove(
          "show"
        );


        await loadDetail();


      } catch (error) {

        console.error(
          "ERROR UPDATE KLIEN:",
          error
        );

        alert(error.message);

      }

    }
  );

}

// ======================================================
// FORMAT TANGGAL TASK
// ======================================================

function formatTaskDate(value) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}


function formatTaskDateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}


// ======================================================
// LOAD TASK LIST DETAIL PROYEK
// ======================================================

async function loadDetailProjectTask() {

  const tbody =
    document.getElementById(
      "detailProjectTaskBody"
    );

  if (!tbody) {
    return;
  }

  const params =
    new URLSearchParams(
      window.location.search
    );

  const proyekId =
    params.get("id");

  if (!proyekId) {

    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          ID proyek tidak ditemukan.
        </td>
      </tr>
    `;

    return;
  }

  try {

    const response =
      await fetch(
        `/api/proyek/${proyekId}/task-list`
      );

    const data =
      await response.json();

    if (!response.ok) {

      throw new Error(
        data.error ||
        "Gagal mengambil task"
      );

    }

    if (data.length === 0) {

      tbody.innerHTML = `
        <tr>
          <td
            colspan="9"
            style="
              text-align:center;
              padding:30px;
              color:#64748b;
            "
          >
            Belum ada task pada proyek ini.
          </td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML =
      data.map(
        item => {

          const statusClass =
            String(
              item.status || ""
            )
              .toLowerCase()
              .replaceAll(
                " ",
                "-"
              );

          return `
            <tr>

              <td>
                <strong>
                  ${item.nama_pic || "-"}
                </strong>
              </td>

              <td>
                <strong>
                  ${item.task || "-"}
                </strong>
              </td>

              <td>
                <div
                  class="detail-task-note"
                  title="${item.catatan || ""}"
                >
                  ${item.catatan || "-"}
                </div>
              </td>

              <td>
                ${
                  item.link
                    ? `
                      <a
                        href="${item.link}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="detail-task-link"
                      >
                        ↗
                      </a>
                    `
                    : "-"
                }
              </td>

              <td>
                <span
                  class="
                    detail-task-status
                    detail-task-status-${statusClass}
                  "
                >
                  ${item.status || "-"}
                </span>
              </td>

              <td>
                ${formatTaskDate(
                  item.tanggal_mulai
                )}
              </td>

              <td>
                ${formatTaskDate(
                  item.target_date
                )}
              </td>

              <td>
                ${formatTaskDate(
                  item.tanggal_selesai
                )}
              </td>

              <td>
                ${formatTaskDateTime(
                  item.created_at
                )}
              </td>

            </tr>
          `;

        }
      )
      .join("");

  } catch (error) {

    console.error(
      "ERROR LOAD TASK DETAIL:",
      error
    );

    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          Gagal mengambil task.
        </td>
      </tr>
    `;

  }

}

loadDetailProjectTask();
// ======================================================
// TERMIN - MODE BERDASARKAN JENIS PROYEK
// ======================================================

function isTerminNominal() {

  const jenisProyek =
    String(
      detailData?.proyek?.jenis_proyek || ""
    )
      .trim()
      .toLowerCase();

  console.log(
    "JENIS PROYEK TERMIN:",
    jenisProyek
  );

  return (
    jenisProyek.includes("sewa") ||
    jenisProyek.includes("transaksi")
  );

}


// ======================================================
// MODAL RINGKASAN PEMBAYARAN
// ======================================================

const pembayaranModal =
  document.getElementById(
    "pembayaranModal"
  );

const bukaPembayaranButton =
  document.getElementById(
    "bukaPembayaranButton"
  );

const tutupPembayaranButton =
  document.getElementById(
    "tutupPembayaranButton"
  );

const tutupPembayaranButtonBawah =
  document.getElementById(
    "tutupPembayaranButtonBawah"
  );


function bukaModalPembayaran() {
  if (!pembayaranModal) {
    return;
  }

  pembayaranModal.classList.add(
    "show"
  );

  document.body.style.overflow =
    "hidden";
}


function tutupModalPembayaran() {
  if (!pembayaranModal) {
    return;
  }

  pembayaranModal.classList.remove(
    "show"
  );

  document.body.style.overflow = "";
}


if (bukaPembayaranButton) {
  bukaPembayaranButton.addEventListener(
    "click",
    bukaModalPembayaran
  );
}


if (tutupPembayaranButton) {
  tutupPembayaranButton.addEventListener(
    "click",
    tutupModalPembayaran
  );
}


if (tutupPembayaranButtonBawah) {
  tutupPembayaranButtonBawah
    .addEventListener(
      "click",
      tutupModalPembayaran
    );
}


if (pembayaranModal) {
  pembayaranModal.addEventListener(
    "click",
    event => {
      if (
        event.target ===
        pembayaranModal
      ) {
        tutupModalPembayaran();
      }
    }
  );
}

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key === "Escape" &&
      pembayaranModal
        ?.classList
        .contains("show")
    ) {
      tutupModalPembayaran();
    }
  }
);

// ======================================================
// LINK UPDATE PROGRESS SESUAI PROYEK
// ======================================================

function updateProgressReportLink() {
  const link =
    document.getElementById(
      "progressReportLink"
    );

  if (!link) {
    return;
  }

  if (!proyekId) {
    link.href =
      "/proyek.html";

    return;
  }

  link.href =
    `/update-progress.html?id=${encodeURIComponent(
      proyekId
    )}`;
}

// ======================================================
// LOAD TOTAL PROGRESS DARI UPDATE PROGRESS
// ======================================================

async function loadTotalProgressProyek(proyekId) {

  const totalElement =
    document.getElementById(
      "totalProgressProyek"
    );

  const progressBar =
    document.getElementById(
      "progressBarProyek"
    );

  const infoElement =
    document.getElementById(
      "progressReportInfo"
    );

  const link =
    document.getElementById(
      "progressReportLink"
    );


  // Link menuju Update Progress
  if (link) {

    link.href =
      `/update-progress.html?id=${encodeURIComponent(
        proyekId
      )}`;

  }


  try {

    const response =
      await fetch(
        `/api/proyek/${encodeURIComponent(
          proyekId
        )}/progress-modul`,
        {
          credentials:
            "same-origin",

          cache:
            "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "Gagal mengambil progress proyek"
      );

    }


    const result =
      await response.json();

    console.log(
  "=== DATA PROGRESS DETAIL ===",
  result
);

console.log(
  "=== RESULT.DATA ===",
  result.data
);

console.log(
  "=== MODULES ===",
  result.data?.modules
);

console.log(
  "PROGRESS PROYEK 170:",
  result
);


    // ==============================================
    // BELUM ADA DATA PROGRESS
    // ==============================================

    if (
      !result.data ||
      !Array.isArray(
        result.data.modules
      )
    ) {

      if (totalElement) {

        totalElement.textContent =
          "0.00%";

      }


      if (progressBar) {

        progressBar.style.width =
          "0%";

      }


      if (infoElement) {

        infoElement.textContent =
          "Belum ada progress proyek.";

      }


      return;

    }


    // ==============================================
    // AMBIL SEMUA SUBMODUL
    // ==============================================

    const items =
      result.data.modules.flatMap(
        module =>
          Array.isArray(module.items)
            ? module.items
            : []
      );


    // ==============================================
    // HITUNG TOTAL DURASI TARGET
    // Sama seperti update-progress.js
    // ==============================================

    const hitungDurasi =
      (start, end) => {

        if (
          !start ||
          !end
        ) {

          return 0;

        }


        const startDate =
          new Date(
            `${start}T00:00:00Z`
          );

        const endDate =
          new Date(
            `${end}T00:00:00Z`
          );


        const selisih =
          Math.floor(
            (
              endDate -
              startDate
            ) /
            86400000
          );


        return selisih >= 0
          ? selisih + 1
          : 0;

      };


    const totalTargetDuration =
      items.reduce(
        (total, item) => {

          return (
            total +
            hitungDurasi(
              item.targetStart,
              item.targetEnd
            )
          );

        },
        0
      );


    // ==============================================
    // HITUNG TOTAL PROGRESS
    // DONE = BOBOT TARGET
    // ==============================================

    let totalProgress = 0;


    items.forEach(
      item => {

        const targetDuration =
          hitungDurasi(
            item.targetStart,
            item.targetEnd
          );


        const targetWeight =
          totalTargetDuration > 0

            ? (
                targetDuration /
                totalTargetDuration
              ) * 100

            : 0;


        const status =
          item.actualStart &&
          item.actualEnd

            ? "Done"

            : item.actualStart

              ? "In Progress"

              : "Not Yet";


        if (
          status === "Done"
        ) {

          totalProgress +=
            targetWeight;

        }

      }
    );


    // Batasi 0 - 100
    totalProgress =
      Math.max(
        0,
        Math.min(
          100,
          totalProgress
        )
      );


    const progressText =
      new Intl.NumberFormat(
        "id-ID",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      ).format(
        totalProgress
      ) + "%";


    // ==============================================
    // TAMPILKAN
    // ==============================================

    if (totalElement) {

      totalElement.textContent =
        progressText;

    }


    if (progressBar) {

      progressBar.style.width =
        `${totalProgress}%`;

    }


    if (infoElement) {

      const selesai =
        items.filter(
          item =>
            item.actualStart &&
            item.actualEnd
        ).length;


      infoElement.textContent =
        `${selesai} dari ${items.length} pekerjaan selesai. Klik untuk membuka laporan progress.`;

    }


  } catch (error) {

    console.error(
      "ERROR LOAD TOTAL PROGRESS:",
      error
    );


    if (totalElement) {

      totalElement.textContent =
        "0.00%";

    }


    if (progressBar) {

      progressBar.style.width =
        "0%";

    }


    if (infoElement) {

      infoElement.textContent =
        "Progress belum dapat dimuat.";

    }

  }

}
// ======================================================
// START
// ======================================================

loadDetail();
loadTimeline();