// ======================================================
// PROGNOSA
// GROUP:
// JENIS -> SUB JENIS -> KATEGORI -> TERMIN
// ======================================================

let allPrognosa = [];


// ======================================================
// ELEMENT
// ======================================================

const prognosaGroup =
  document.getElementById(
    "prognosaGroup"
  );

const searchPrognosa =
  document.getElementById(
    "searchPrognosa"
  );

const filterTahun =
  document.getElementById(
    "filterTahun"
  );

const filterJenis =
  document.getElementById(
    "filterJenis"
  );

const filterStatusPengadaan =
  document.getElementById(
    "filterStatusPengadaan"
  );

const filterStatusTeknis =
  document.getElementById(
    "filterStatusTeknis"
  );

const totalPrognosa =
  document.getElementById(
    "totalPrognosa"
  );

const jumlahProyek =
  document.getElementById(
    "jumlahProyek"
  );

const jumlahTermin =
  document.getElementById(
    "jumlahTermin"
  );


// ======================================================
// FORMAT
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


function formatTanggal(value) {

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

  return new Intl.DateTimeFormat(
    "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }
  ).format(date);

}


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
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// ======================================================
// LOAD
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
        "Gagal mengambil prognosa."
      );

    }

    allPrognosa =
      Array.isArray(
        result.prognosa
      )
        ? result.prognosa
        : [];

    loadFilters();

    applyFilter();

  } catch (error) {

    console.error(
      "ERROR LOAD PROGNOSA:",
      error
    );

    prognosaGroup.innerHTML = `
      <div class="empty-state">
        Gagal mengambil data prognosa.
      </div>
    `;

  }

}


// ======================================================
// OPTION
// ======================================================

function isiSelect(
  element,
  values,
  defaultText
) {

  element.innerHTML = `
    <option value="">
      ${defaultText}
    </option>
  `;

  values.forEach(
    value => {

      const option =
        document.createElement(
          "option"
        );

      option.value =
        value;

      option.textContent =
        value;

      element.appendChild(
        option
      );

    }
  );

}


// ======================================================
// FILTER OPTIONS
// ======================================================

function loadFilters() {

  const tahun =
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
    ].sort(
      (a, b) =>
        a - b
    );


  isiSelect(
    filterTahun,
    tahun,
    "Semua Tahun"
  );


  const jenis =
    [
      ...new Set(
        allPrognosa
          .map(
            item =>
              item.jenis_proyek
          )
          .filter(Boolean)
      )
    ].sort();


  isiSelect(
    filterJenis,
    jenis,
    "Semua Jenis Proyek"
  );


  const pengadaan =
    [
      ...new Set(
        allPrognosa
          .map(
            item =>
              item.status_pengadaan
          )
          .filter(Boolean)
      )
    ].sort();


  isiSelect(
    filterStatusPengadaan,
    pengadaan,
    "Semua Status Pengadaan"
  );


  const teknis =
    [
      ...new Set(
        allPrognosa
          .map(
            item =>
              item.status_teknis
          )
          .filter(Boolean)
      )
    ].sort();


  isiSelect(
    filterStatusTeknis,
    teknis,
    "Semua Status Teknis"
  );

}


// ======================================================
// FILTER
// ======================================================

function applyFilter() {

  const keyword =
    searchPrognosa.value
      .trim()
      .toLowerCase();

  const tahun =
    filterTahun.value;

  const jenis =
    filterJenis.value;

  const pengadaan =
    filterStatusPengadaan.value;

  const teknis =
    filterStatusTeknis.value;


  const filtered =
    allPrognosa.filter(
      item => {

        const text = [
          item.nama_proyek,
          item.nama_klien,
          item.jenis_proyek,
          item.sub_jenis_proyek,
          item.kategori_prognosa,
          item.nama_termin,
          item.status_pengadaan,
          item.status_teknis
        ]
          .join(" ")
          .toLowerCase();


        const matchSearch =
          !keyword ||
          text.includes(keyword);


        const matchTahun =
          !tahun ||
          String(
            getTahun(
              item.tanggal_prognosa
            )
          ) === String(tahun);


        const matchJenis =
          !jenis ||
          item.jenis_proyek ===
            jenis;


        const matchPengadaan =
          !pengadaan ||
          item.status_pengadaan ===
            pengadaan;


        const matchTeknis =
          !teknis ||
          item.status_teknis ===
            teknis;


        return (
          matchSearch &&
          matchTahun &&
          matchJenis &&
          matchPengadaan &&
          matchTeknis
        );

      }
    );


  updateSummary(
    filtered
  );

  renderGrouping(
    filtered
  );

}


// ======================================================
// SUMMARY
// ======================================================

function updateSummary(data) {

  const total =
    data.reduce(
      (sum, item) =>
        sum +
        Number(
          item.nilai_termin || 0
        ),
      0
    );


  const proyek =
    new Set(
      data.map(
        item =>
          Number(
            item.proyek_id
          )
      )
    );


  totalPrognosa.textContent =
    formatRupiah(total);


  jumlahProyek.textContent =
    proyek.size;


  jumlahTermin.textContent =
    data.length;

}


// ======================================================
// GROUP DATA
// ======================================================

function groupData(data) {

  const result = {};


  data.forEach(
    item => {

      const jenis =
        item.jenis_proyek ||
        "Tanpa Jenis Proyek";


      const subJenis =
        item.sub_jenis_proyek ||
        "Tanpa Sub Jenis";


      const kategori =
        item.kategori_prognosa ||
        "Tanpa Kategori";


      if (!result[jenis]) {

        result[jenis] = {};

      }


      if (
        !result[jenis][subJenis]
      ) {

        result[jenis][subJenis] = {};

      }


      if (
        !result[jenis]
          [subJenis]
          [kategori]
      ) {

        result[jenis]
          [subJenis]
          [kategori] = [];

      }


      result[jenis]
        [subJenis]
        [kategori]
        .push(item);

    }
  );


  return result;

}


// ======================================================
// TOTAL
// ======================================================

function sumNilai(data) {

  return data.reduce(
    (sum, item) =>
      sum +
      Number(
        item.nilai_termin || 0
      ),
    0
  );

}


function flattenSubJenis(
  subJenisData
) {

  return Object
    .values(subJenisData)
    .flat();

}


function flattenJenis(
  jenisData
) {

  return Object
    .values(jenisData)
    .flatMap(
      kategoriData =>
        Object
          .values(kategoriData)
          .flat()
    );

}


// ======================================================
// RENDER TABLE
// ======================================================

function renderTable(data) {

  return `

    <div class="table-wrapper">

      <table class="prognosa-table">

        <thead>

          <tr>

            <th>
              Proyek
            </th>

            <th>
              Klien
            </th>

            <th>
              Periode Kontrak
            </th>

            <th>
              Nilai Kontrak
            </th>

            <th>
              Status Pengadaan
            </th>

            <th>
              Status Teknis
            </th>

            <th>
              Termin
            </th>

            <th>
              Persentase
            </th>

            <th>
              Jatuh Tempo
            </th>

            <th>
              Tanggal Prognosa
            </th>

            <th>
              Nilai Prognosa
            </th>

          </tr>

        </thead>


        <tbody>

          ${
            data.map(
              item => {

                const persen =
                  item.persentase !== null &&
                  item.persentase !== undefined

                    ? `${Number(
                        item.persentase
                      ).toFixed(2)}%`

                    : "-";


                return `

                  <tr>

                    <td class="proyek-name">

                      ${escapeHtml(
                        item.nama_proyek ||
                        "-"
                      )}

                    </td>


                    <td>

                      ${escapeHtml(
                        item.nama_klien ||
                        "-"
                      )}

                    </td>


                    <td>

                      ${formatTanggal(
                        item.tanggal_mulai_kontrak
                      )}

                      -

                      ${formatTanggal(
                        item.tanggal_akhir_kontrak
                      )}

                    </td>


                    <td class="nilai">

                      ${formatRupiah(
                        item.nilai_kontrak
                      )}

                    </td>


                    <td>

                      <span class="badge">

                        ${escapeHtml(
                          item.status_pengadaan ||
                          "-"
                        )}

                      </span>

                    </td>


                    <td>

                      <span class="badge">

                        ${escapeHtml(
                          item.status_teknis ||
                          "-"
                        )}

                      </span>

                    </td>


                    <td>

                      ${escapeHtml(
                        item.nama_termin ||
                        "-"
                      )}

                    </td>


                    <td>

                      ${persen}

                    </td>


                    <td>

                      ${formatTanggal(
                        item.tanggal_jatuh_tempo
                      )}

                    </td>


                    <td>

                      ${formatTanggal(
                        item.tanggal_prognosa
                      )}

                    </td>


                    <td class="nilai">

                      ${formatRupiah(
                        item.nilai_termin
                      )}

                    </td>

                  </tr>

                `;

              }
            ).join("")
          }

        </tbody>

      </table>

    </div>

  `;

}


// ======================================================
// RENDER GROUPING
// ======================================================

function renderGrouping(data) {

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {

    prognosaGroup.innerHTML = `

      <div class="empty-state">

        Tidak ada data prognosa
        sesuai filter.

      </div>

    `;

    return;

  }


  const grouped =
    groupData(data);


  let html = "";


  Object.entries(
    grouped
  ).forEach(
    ([
      jenis,
      subJenisData
    ]) => {


      const jenisRows =
        flattenJenis(
          subJenisData
        );


      const totalJenis =
        sumNilai(
          jenisRows
        );


      html += `

        <section class="jenis-group">


          <div class="jenis-header">

            <div class="jenis-title">

              ${escapeHtml(jenis)}

            </div>


            <div class="jenis-total">

              ${formatRupiah(
                totalJenis
              )}

            </div>

          </div>

      `;


      Object.entries(
        subJenisData
      ).forEach(
        ([
          subJenis,
          kategoriData
        ]) => {


          const subJenisRows =
            flattenSubJenis(
              kategoriData
            );


          const totalSubJenis =
            sumNilai(
              subJenisRows
            );


          html += `

            <div class="subjenis-group">


              <div class="subjenis-header">

                <div class="subjenis-title">

                  ${escapeHtml(
                    subJenis
                  )}

                </div>


                <div class="subjenis-total">

                  ${formatRupiah(
                    totalSubJenis
                  )}

                </div>

              </div>

          `;


          Object.entries(
            kategoriData
          ).forEach(
            ([
              kategori,
              rows
            ]) => {


              const totalKategori =
                sumNilai(rows);


              html += `

                <div class="kategori-group">


                  <div class="kategori-header">

                    <div class="kategori-title">

                      ${escapeHtml(
                        kategori
                      )}

                    </div>


                    <div class="kategori-total">

                      ${formatRupiah(
                        totalKategori
                      )}

                    </div>

                  </div>


                  ${renderTable(rows)}


                </div>

              `;

            }
          );


          html += `

            </div>

          `;

        }
      );


      html += `

        </section>

      `;

    }
  );


  prognosaGroup.innerHTML =
    html;

}


// ======================================================
// EVENTS
// ======================================================

searchPrognosa.addEventListener(
  "input",
  applyFilter
);


filterTahun.addEventListener(
  "change",
  applyFilter
);


filterJenis.addEventListener(
  "change",
  applyFilter
);


filterStatusPengadaan.addEventListener(
  "change",
  applyFilter
);


filterStatusTeknis.addEventListener(
  "change",
  applyFilter
);


// ======================================================
// START
// ======================================================

loadPrognosa();