/* ======================================================
   PORTOPRO — SUMMARY PROYEK

   - Kolom klien dan partner terpisah.
   - Setiap partner tambahan memiliki 10 kolom sendiri.
   - Dokumen mencakup klien dan seluruh partner.
   - Tasklist selalu di kolom terakhir.
   - Nama proyek dapat diklik.
   - Excel tanpa Rp.
   - Lebar konten mengikuti sidebar.
====================================================== */

(() => {
  "use strict";

  const $ = id =>
    document.getElementById(id);

  const state = {
    rows: [],
    filtered: [],
    columns: [],
    page: 1,
    loading: false,
    error: ""
  };

  // ======================================================
  // KOLOM UTAMA PROYEK
  // ======================================================

  const BASE_COLUMNS = [
    ["nama", "Nama Proyek"],
    ["pic", "PIC"],
    ["jenisProyek", "Jenis Proyek"],
    ["subProyek", "Sub Proyek"],
    ["kategori", "Kategori"],
    ["mulai", "Tanggal Mulai", "date"],
    ["akhir", "Tanggal Selesai", "date"],
    ["final", "Status Final"],
    ["rfqTor", "RFQ/TOR"],
    ["sph", "SPH"],
    ["spk", "SPK/PKS"],
    ["bast", "BAST"]
  ];

  // ======================================================
  // KOLOM KLIEN DAN SETIAP PARTNER
  // ======================================================

  const PARTY_COLUMNS = [
    ["nama", "Nama"],
    ["pengadaan", "Status Pengadaan"],
    ["media", "Media Pengadaan"],
    ["pembayaran", "Status Pembayaran"],
    ["statusKontrak", "Status Kontrak"],
    ["kontrak", "Nominal Kontrak", "money"],
    ["terminTotal", "Nominal Termin", "money"],
    ["sisa", "Nominal belum ada Termin", "money"],
    ["dibayar", "Nominal Dibayar", "money"],
    ["jumlahTermin", "Jumlah Termin", "number"]
  ];

  // ======================================================
  // UTILITAS
  // ======================================================

  const fmt =
    new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 2
    });

  const norm = value =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const arr = value =>
    Array.isArray(value)
      ? value
      : [];

  const unique = values => [
    ...new Set(
      values
        .map(value =>
          String(value ?? "").trim()
        )
        .filter(Boolean)
    )
  ];

  const sum = values =>
    values.reduce(
      (total, value) =>
        total +
        Math.round(
          (value ?? 0) * 100
        ),
      0
    ) / 100;

  const round = value =>
    Math.round(
      (value + Number.EPSILON) * 100
    ) / 100;

  const rupiah = value =>
    `Rp ${fmt.format(value)}`;

  function number(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return 0;
    }

    const result =
      Number(value);

    if (
      !Number.isFinite(result)
    ) {
      throw new Error(
        `Nominal API tidak valid: ${
          String(value).slice(0, 40)
        }`
      );
    }

    return result;
  }

  function collection(payload) {
    if (
      Array.isArray(payload)
    ) {
      return payload;
    }

    const keys = [
      "data",
      "proyek",
      "pendapatan",
      "task_list",
      "tasks"
    ];

    for (const key of keys) {
      if (
        Array.isArray(
          payload?.[key]
        )
      ) {
        return payload[key];
      }
    }

    throw new Error(
      "Format daftar dari API tidak sesuai."
    );
  }

  // ======================================================
  // TANGGAL
  // ======================================================

  function dateOnly(value) {
    const text =
      String(value ?? "")
        .match(
          /^\d{4}-\d{2}-\d{2}/
        )?.[0];

    if (!text) {
      return "";
    }

    const date =
      new Date(
        `${text}T00:00:00Z`
      );

    if (
      !Number.isFinite(
        date.getTime()
      )
    ) {
      return "";
    }

    return date
      .toISOString()
      .slice(0, 10) === text
        ? text
        : "";
  }

  function todayJakarta() {
    const parts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).formatToParts(
        new Date()
      );

    return [
      "year",
      "month",
      "day"
    ].map(
      key =>
        parts.find(
          part =>
            part.type === key
        ).value
    ).join("-");
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      }
    ).format(
      new Date(
        `${value}T00:00:00Z`
      )
    );
  }

  function contractStatus(
    final,
    start,
    end,
    today = todayJakarta()
  ) {
    if (
      [
        "done",
        "selesai"
      ].includes(
        norm(final)
      )
    ) {
      return "Selesai";
    }

    if (!end) {
      return "Belum Ditentukan";
    }

    if (
      start &&
      start > today
    ) {
      return "Belum Mulai";
    }

    return end < today
      ? "Berakhir"
      : "Berjalan";
  }

  // ======================================================
  // FETCH API
  // ======================================================

  async function fetchJSON(url) {
    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        30000
      );

    try {
      const response =
        await fetch(
          url,
          {
            credentials:
              "same-origin",

            cache:
              "no-store",

            signal:
              controller.signal,

            headers: {
              Accept:
                "application/json"
            }
          }
        );

      if (
        response.status === 401
      ) {
        throw new Error(
          "Sesi berakhir. Silakan login kembali."
        );
      }

      if (
        !response.ok
      ) {
        throw new Error(
          `Gagal memuat ${url} ` +
          `(HTTP ${response.status}).`
        );
      }

      const data =
        await response.json();

      if (
        data?.success === false ||
        data?.error
      ) {
        throw new Error(
          data.error ||
          data.message ||
          "API gagal."
        );
      }

      return data;

    } catch (error) {
      if (
        error.name === "AbortError"
      ) {
        throw new Error(
          `Waktu pemuatan ${url} habis. ` +
          "Klik Muat ulang."
        );
      }

      throw error;

    } finally {
      clearTimeout(timer);
    }
  }

  // ======================================================
  // NILAI KONTRAK
  // ======================================================

  function rawContract(entity) {
    const keys = [
      "nilai_nego_3",
      "nilai_nego_2",
      "nilai_nego_1",
      "nilai_submit"
    ];

    for (const key of keys) {
      const value =
        number(
          entity?.[key]
        );

      if (
        value !== 0
      ) {
        return value;
      }
    }

    return 0;
  }

  // ======================================================
  // NORMALISASI TERMIN
  // ======================================================

  function normalizeTerms(
    terms,
    base,
    source
  ) {
    return terms.map(
      term => {
        const explicit =
          term.nominal ??
          term.nilai_pendapatan ??
          term.nilai_termin;

        const hasNominal =
          explicit !== null &&
          explicit !== undefined &&
          explicit !== "";

        const nominal =
          hasNominal
            ? number(explicit)
            : round(
                base *
                number(
                  term.persentase
                ) /
                100
              );

        return {
          ...term,

          nominal,

          sumber:
            source,

          status_pembayaran:
            String(
              term.status_pembayaran ||
              ""
            ).trim() ||
            "Belum Dibayar"
        };
      }
    );
  }

  function paymentStatus(terms) {
    if (
      !terms.length
    ) {
      return "Belum Ada Termin";
    }

    return terms.map(
      (term, index) => {
        const name =
          String(
            term.nama_termin ||
            ""
          ).trim() ||

          String(
            term.deskripsi ||
            ""
          ).trim() ||

          `Termin ${index + 1}`;

        return (
          `${name} ` +
          `${term.status_pembayaran}`
        );
      }
    ).join("\n");
  }

  // ======================================================
  // NORMALISASI KLIEN / SATU PARTNER
  // ======================================================

  function normalizeParty(
    entity,
    name,
    final,
    source,
    override = null
  ) {
    const raw =
      rawContract(entity);

    const terms =
      override
        ? override.terms
        : normalizeTerms(
            arr(
              entity?.termin
            ),
            raw,
            source
          );

    const contract =
      override
        ? override.contract
        : raw ||
          sum(
            terms.map(
              term =>
                term.nominal
            )
          );

    const total =
      sum(
        terms.map(
          term =>
            term.nominal
        )
      );

    const start =
      dateOnly(
        entity?.tanggal_mulai
      );

    const end =
      dateOnly(
        entity?.tanggal_akhir
      );

    return {
      nama:
        name || "",

      pengadaan:
        entity?.status_pengadaan ||
        "Belum Diisi",

      media:
        entity?.media_pengadaan ||
        "Belum Diisi",

      pembayaran:
        paymentStatus(terms),

      statusKontrak:
        contractStatus(
          entity?.status_final ||
          final,
          start,
          end
        ),

      kontrak:
        contract,

      terminTotal:
        total,

      sisa:
        round(
          Math.max(
            contract - total,
            0
          )
        ),

      dibayar:
        sum(
          terms
            .filter(
              term =>
                norm(
                  term.status_pembayaran
                ) ===
                "sudah dibayar"
            )
            .map(
              term =>
                term.nominal
            )
        ),

      jumlahTermin:
        terms.length,

      terms,

      warning:
        total > contract
          ? (
              `${name || source}: ` +
              "total termin melebihi nominal kontrak."
            )
          : ""
    };
  }

  // ======================================================
  // DOKUMEN KLIEN DAN PARTNER
  // ======================================================

  function documentText(
    docs,
    type
  ) {
    const regex = {
      rfqTor:
        /\brfq\b|\btor\b|request\s+for\s+quotation|terms?\s+of\s+reference|kerangka\s+acuan\s+kerja/,

      sph:
        /\bsph\b|surat\s+penawaran/,

      spk:
        /\bspk\b|\bpks\b|surat\s+perintah\s+kerja|perjanjian\s+kerja\s*sama/,

      bast:
        /\bbast\b|berita\s+acara\s+serah\s+terima/
    }[type];

    return unique(
      docs
        .filter(
          doc =>
            regex.test(
              norm(
                doc.nama_dokumen
              )
            )
        )
        .map(
          doc =>
            `${doc.relasi}: ${
              doc.nomor_dokumen ||
              doc.nama_dokumen ||
              "Dokumen"
            }`
        )
    ).join("\n");
  }

  // ======================================================
  // NORMALISASI PROYEK
  // ======================================================

  function normalizeProject(
    list,
    detail,
    tasks,
    rentals,
    rentalTerms
  ) {
    if (
      !detail?.proyek ||
      !Array.isArray(
        detail.pic
      ) ||
      !Array.isArray(
        detail.partners
      )
    ) {
      throw new Error(
        "Response detail proyek tidak lengkap."
      );
    }

    const proyek = {
      ...list,
      ...detail.proyek
    };

    const client =
      detail.klien;

    if (
      client &&
      (
        !Array.isArray(
          client.termin
        ) ||
        !Array.isArray(
          client.dokumen
        )
      )
    ) {
      throw new Error(
        "Response termin/dokumen klien tidak lengkap."
      );
    }

    const invalidPartner =
      detail.partners.some(
        partner =>
          !Array.isArray(
            partner.termin
          ) ||
          !Array.isArray(
            partner.dokumen
          )
      );

    if (
      invalidPartner
    ) {
      throw new Error(
        "Response termin/dokumen partner tidak lengkap."
      );
    }

    // Urutan partner mengikuti API detail proyek.
    const partners =
      detail.partners.map(
        (partner, index) =>
          normalizeParty(
            partner,
            partner.nama_partner,
            proyek.status_final,
            `PARTNER ${index + 1}`
          )
      );

    // ================================================
    // DATA SEWA UNTUK SISI KLIEN
    // ================================================

    const rental =
      rentals.filter(
        item =>
          String(
            item.proyek_id
          ) ===
          String(
            proyek.id
          )
      );

    let override = null;

    if (
      rental.length
    ) {
      const ids =
        new Set(
          rental.map(
            item =>
              String(item.id)
          )
        );

      const seen =
        new Set();

      const selected =
        rentalTerms.filter(
          term => {
            if (
              !ids.has(
                String(
                  term.proyek_sewa_id
                )
              )
            ) {
              return false;
            }

            if (
              term.termin_id === null ||
              term.termin_id === undefined
            ) {
              throw new Error(
                "ID termin sewa tidak tersedia."
              );
            }

            const key =
              String(
                term.termin_id
              );

            if (
              seen.has(key)
            ) {
              return false;
            }

            seen.add(key);

            return true;
          }
        );

      const contract =
        sum(
          rental.map(
            item =>
              number(
                item.total_nilai
              )
          )
        );

      override = {
        contract,

        terms:
          normalizeTerms(
            selected,
            contract,
            "SEWA"
          )
      };
    }

    // ================================================
    // KLIEN
    // ================================================

    const clientName =
      client?.perusahaan_klien ||
      list.nama_klien ||
      unique(
        rental.map(
          item =>
            item.nama_klien
        )
      ).join("; ");

    const clientEntity =
      client
        ? {
            ...client,

            media_pengadaan:
              client.media_pengadaan ||
              proyek.media_pengadaan ||
              list.media_pengadaan
          }
        : {
            ...list,
            termin: [],
            dokumen: []
          };

    const hasClient =
      client ||
      override ||
      list.proyek_klien_id ||
      list.klien_id;

    const clientParty =
      hasClient
        ? normalizeParty(
            clientEntity,
            clientName,
            proyek.status_final,
            "KLIEN",
            override
          )
        : null;

    // ================================================
    // GABUNG DOKUMEN KLIEN DAN SELURUH PARTNER
    // ================================================

    const docs = [
      ...arr(
        client?.dokumen
      ).map(
        doc => ({
          ...doc,

          relasi:
            "Klien" +
            (
              clientName
                ? ` — ${clientName}`
                : ""
            )
        })
      ),

      ...detail.partners.flatMap(
        (partner, index) =>
          partner.dokumen.map(
            doc => ({
              ...doc,

              relasi:
                `Partner ${index + 1}` +
                (
                  partner.nama_partner
                    ? ` — ${partner.nama_partner}`
                    : ""
                )
            })
          )
      )
    ];
    const kategoriList =
  unique([
    ...arr(
      proyek.nama_kategori_produk_list
    ),

    ...arr(
      proyek.kategori_produk_list
    ),

    ...arr(
      list.kategori_produk_list
    )
  ]);


    const pics =
      unique(
        detail.pic.map(
          person =>
            person.nama
        )
      );

    return {
      id:
        proyek.id,

      nama:
        proyek.nama_proyek ||
        `Proyek #${proyek.id}`,

     pic:
  pics.join("\n"),

pics,

    jenisProyek:
      proyek.jenis_proyek ||
      list.jenis_proyek ||
      "",

    subProyek:
      proyek.sub_jenis_proyek ||
      list.sub_jenis_proyek ||
      "",

    kategori:
      kategoriList.length
        ? kategoriList.join("\n")
        : (
            proyek.nama_kategori_produk ||
            list.nama_kategori_produk ||
            ""
          ),

      mulai:
        dateOnly(
          client?.tanggal_mulai ??
          list.tanggal_mulai
        ),

      akhir:
        dateOnly(
          client?.tanggal_akhir ??
          list.tanggal_akhir
        ),

      final:
        proyek.status_final ||
        "Belum Diisi",

      rfqTor:
        documentText(
          docs,
          "rfqTor"
        ),

      sph:
        documentText(
          docs,
          "sph"
        ),

      spk:
        documentText(
          docs,
          "spk"
        ),

      bast:
        documentText(
          docs,
          "bast"
        ),

      client:
        clientParty,

      partners,

      tasks,

      tasksText:
        tasks.map(
          task =>
            (
              task.parent_task_id
                ? "↳ "
                : ""
            ) +
            (
              task.task ||
              "Tanpa nama"
            ) +
            ` [${
              task.status ||
              "Belum diisi"
            }]` +
            (
              task.nama_pic
                ? ` — ${task.nama_pic}`
                : ""
            )
        ).join("\n"),

      warnings:
        [
          clientParty,
          ...partners
        ]
          .filter(Boolean)
          .map(
            party =>
              party.warning
          )
          .filter(Boolean)
    };
  }

  // ======================================================
  // KOLOM DINAMIS
  //
  // 9 proyek + 10 klien + 10 per partner + 1 Tasklist
  //
  // 1 partner  = 30 kolom
  // 2 partner  = 40 kolom
  // 3 partner  = 50 kolom
  // ======================================================

  function buildColumns() {
    const columns =
      BASE_COLUMNS.map(
        ([
          key,
          label,
          type
        ]) => ({
          key,
          label,
          type
        })
      );

    function addParty(
      owner,
      index,
      suffix
    ) {
      PARTY_COLUMNS.forEach(
        ([
          field,
          title,
          type
        ]) => {

          columns.push({
            key:
              `${owner}_${index}_${field}`,

            label:
              `${title} ${suffix}`,

            type,

            owner,

            index,

            field
          });

        }
      );
    }

    // Kolom klien.
    addParty(
      "client",
      0,
      "Klien"
    );

    // Minimal tampil satu kelompok partner.
    // Jumlahnya mengikuti partner terbanyak
    // dari seluruh proyek yang dimuat.
    const maxPartners =
      state.rows.reduce(
        (max, row) =>
          Math.max(
            max,
            row.partners?.length ||
            0
          ),
        1
      );

    for (
      let index = 0;
      index < maxPartners;
      index++
    ) {
      addParty(
        "partner",
        index,

        index === 0
          ? "Partner"
          : `Partner ${index + 1}`
      );
    }

    // Tasklist selalu paling akhir.
    columns.push({
      key:
        "tasksText",

      label:
        "Tasklist"
    });

    if (
      columns.length > 16384
    ) {
      throw new Error(
        "Jumlah kolom melebihi batas Excel."
      );
    }

    state.columns =
      columns;

    const heads =
      columns.map(
        column => {
          const th =
            document.createElement(
              "th"
            );

          th.scope =
            "col";

          th.textContent =
            column.label;

          if (
            [
              "money",
              "number"
            ].includes(
              column.type
            )
          ) {
            th.className =
              "sm-num";
          }

          return th;
        }
      );

    $("smHead")
      .replaceChildren(
        ...heads
      );
  }

  function partyFor(
    row,
    column
  ) {
    return column.owner === "client"
      ? row.client
      : row.partners?.[
          column.index
        ];
  }

  function cellValue(
    row,
    column
  ) {
    if (
      column.owner
    ) {
      return partyFor(
        row,
        column
      )?.[
        column.field
      ] ?? "";
    }

    return row[
      column.key
    ] ?? "";
  }

  // ======================================================
  // PESAN STATUS
  // ======================================================

  function message(
    text,
    error = false
  ) {
    $("smMessage").textContent =
      text;

    $("smMessage").hidden =
      !text;

    $("smMessage").dataset.error =
      String(error);
  }

  // ======================================================
  // LOAD DATA
  // ======================================================

  async function load() {
    if (
      state.loading
    ) {
      return;
    }

    state.loading = true;
    state.error = "";
    state.rows = [];
    state.filtered = [];
    state.page = 1;

    $("smReload").disabled =
      true;

    $("smExport").disabled =
      true;

    buildColumns();

    render();

    message(
      "Memuat daftar proyek…"
    );

    try {
      const list =
        collection(
          await fetchJSON(
            "/api/proyek"
          )
        );

      const invalidId =
        list.some(
          item =>
            item.id === null ||
            item.id === undefined
        );

      if (
        invalidId
      ) {
        throw new Error(
          "ID proyek tidak tersedia."
        );
      }

      let rentals = [];
      let rentalTerms = [];

      if (
        list.length
      ) {
        const result =
          await Promise.allSettled([
            fetchJSON(
              "/api/proyek-sewa"
            ),

            fetchJSON(
              "/api/pendapatan/sewa/detail"
            )
          ]);

        for (
          const item of result
        ) {
          if (
            item.status ===
            "rejected"
          ) {
            throw item.reason;
          }
        }

        const allowed =
          new Set(
            list.map(
              item =>
                String(item.id)
            )
          );

        rentals =
          collection(
            result[0].value
          ).filter(
            item =>
              allowed.has(
                String(
                  item.proyek_id
                )
              )
          );

        rentalTerms =
          collection(
            result[1].value
          ).filter(
            item =>
              allowed.has(
                String(
                  item.proyek_id
                )
              )
          );
      }

      let cursor = 0;
      let done = 0;

      const errors = [];

      async function worker() {
        while (
          cursor < list.length
        ) {
          const proyek =
            list[cursor++];

          try {
            const id =
              encodeURIComponent(
                proyek.id
              );

            const result =
              await Promise.allSettled([
                fetchJSON(
                  `/api/proyek/${id}/detail`
                ),

                fetchJSON(
                  `/api/proyek/${id}/task-list`
                )
              ]);

            for (
              const item of result
            ) {
              if (
                item.status ===
                "rejected"
              ) {
                throw item.reason;
              }
            }

            state.rows.push(
              normalizeProject(
                proyek,
                result[0].value,

                collection(
                  result[1].value
                ),

                rentals,
                rentalTerms
              )
            );

          } catch (error) {
            const text =
              `${
                proyek.nama_proyek ||
                proyek.id
              }: ${error.message}`;

            errors.push(
              text
            );

            state.rows.push({
              id:
                proyek.id,

              nama:
                proyek.nama_proyek ||
                `Proyek #${proyek.id}`,

              pics:
                [],

              partners:
                [],

              error:
                text
            });
          }

          done++;

          message(
            `Memuat detail ${done} ` +
            `dari ${list.length} proyek…`
          );
        }
      }

      await Promise.all(
        Array.from(
          {
            length:
              Math.min(
                4,
                list.length
              )
          },
          worker
        )
      );

      state.rows.sort(
        (first, second) =>
          first.nama.localeCompare(
            second.nama,
            "id"
          )
      );

      state.error =
        errors.length
          ? (
              `${errors.length} proyek belum lengkap. ` +
              "Klik Muat ulang sebelum ekspor.\n" +
              errors
                .slice(0, 5)
                .join("\n")
            )
          : "";

      buildColumns();

      populateFilters();

      const warnings =
        state.rows.flatMap(
          row =>
            row.warnings || []
        );

      message(
        state.error ||
        (
          warnings.length
            ? warnings
                .slice(0, 5)
                .join("\n")
            : ""
        ),

        !!state.error ||
        !!warnings.length
      );

    } catch (error) {
      state.error =
        error.message;

      message(
        state.error,
        true
      );

    } finally {
      state.loading =
        false;

      $("smReload").disabled =
        false;

      applyFilters();
    }
  }

  // ======================================================
  // FILTER
  // ======================================================

  function populateFilters() {
    const filters = [
      [
        "smPIC",
        row => row.pics,
        "Semua PIC"
      ],

      [
        "smPengadaan",
        row =>
          row.client?.pengadaan,
        "Semua pengadaan klien"
      ],

      [
        "smKontrak",
        row =>
          row.client?.statusKontrak,
        "Semua kontrak klien"
      ],

      [
        "smFinal",
        row => row.final,
        "Semua status"
      ],

      [
        "smKlien",
        row =>
          row.client?.nama,
        "Semua klien"
      ]
    ];

    filters.forEach(
      ([
        id,
        get,
        placeholder
      ]) => {
        const element =
          $(id);

        const previous =
          element.value;

        const values =
          unique(
            state.rows
              .filter(
                row =>
                  !row.error
              )
              .flatMap(
                row =>
                  get(row) || []
              )
          ).sort(
            (first, second) =>
              first.localeCompare(
                second,
                "id"
              )
          );

        element.replaceChildren(
          new Option(
            placeholder,
            ""
          ),

          ...values.map(
            value =>
              new Option(
                value,
                value
              )
          )
        );

        element.value =
          values.includes(
            previous
          )
            ? previous
            : "";
      }
    );
  }

  function applyFilters() {
    const query =
      norm(
        $("smSearch").value
      );

    state.filtered =
      state.rows.filter(
        row => {
          const text =
            state.columns.map(
              column =>
                cellValue(
                  row,
                  column
                )
            ).join(" ");

          return (
            (
              !query ||
              norm(text).includes(
                query
              )
            ) &&

            (
              !$("smPIC").value ||
              row.pics.includes(
                $("smPIC").value
              )
            ) &&

            (
              !$("smPengadaan").value ||
              row.client?.pengadaan ===
                $("smPengadaan").value
            ) &&

            (
              !$("smKontrak").value ||
              row.client?.statusKontrak ===
                $("smKontrak").value
            ) &&

            (
              !$("smFinal").value ||
              row.final ===
                $("smFinal").value
            ) &&

            (
              !$("smKlien").value ||
              row.client?.nama ===
                $("smKlien").value
            )
          );
        }
      );

    render();
  }

  // ======================================================
  // LINK DETAIL PROYEK
  // ======================================================

  function projectLink(row) {
    const link =
      document.createElement(
        "a"
      );

    link.href =
      "/detail-proyek.html?id=" +
      encodeURIComponent(
        row.id
      );

    link.textContent =
      row.nama;

    link.title =
      "Buka detail proyek";

    link.style.cssText = [
      "color:#4f46bb",
      "font-weight:700",
      "text-decoration:underline",
      "text-underline-offset:3px"
    ].join(";");

    return link;
  }

  // ======================================================
  // RENDER TABEL TANPA CARD
  // ======================================================

  function render() {
    const rows =
      state.filtered;

    const valid =
      rows.filter(
        row =>
          !row.error
      );

    const size =
      Number(
        $("smPageSize").value
      );

    const pages =
      Math.max(
        1,
        Math.ceil(
          rows.length / size
        )
      );

    state.page =
      Math.min(
        state.page,
        pages
      );

    const body =
      $("smBody");

    body.replaceChildren();

    const visibleRows =
      rows.slice(
        (state.page - 1) * size,
        state.page * size
      );

    visibleRows.forEach(
      row => {
        const tr =
          document.createElement(
            "tr"
          );

        if (
          row.error
        ) {
          const name =
            document.createElement(
              "td"
            );

          const error =
            document.createElement(
              "td"
            );

          name.append(
            projectLink(row)
          );

          error.colSpan =
            state.columns.length - 1;

          error.textContent =
            row.error;

          error.className =
            "sm-bad";

          tr.append(
            name,
            error
          );

        } else {
          state.columns.forEach(
            column => {
              const td =
                document.createElement(
                  "td"
                );

              const value =
                cellValue(
                  row,
                  column
                );

              if (
                column.key === "nama"
              ) {
                td.append(
                  projectLink(row)
                );

              } else if (
                [
                  "money",
                  "number"
                ].includes(
                  column.type
                )
              ) {
                td.className =
                  "sm-num" +
                  (
                    value < 0
                      ? " sm-bad"
                      : ""
                  );

                td.textContent =
                  value === ""
                    ? "—"
                    : column.type === "money"
                      ? rupiah(value)
                      : fmt.format(value);

                const party =
                  partyFor(
                    row,
                    column
                  );

                if (
                  column.field === "terminTotal" &&
                  party?.warning
                ) {
                  td.title =
                    party.warning;

                  td.classList.add(
                    "sm-bad"
                  );
                }

              } else if (
                column.type === "date"
              ) {
                td.className =
                  "sm-date";

                td.textContent =
                  formatDate(value);

              } else if (
                column.key === "tasksText" &&
                row.tasks.length
              ) {
                const details =
                  document.createElement(
                    "details"
                  );

                const summary =
                  document.createElement(
                    "summary"
                  );

                const content =
                  document.createElement(
                    "div"
                  );

                const completed =
                  row.tasks.filter(
                    task =>
                      [
                        "done",
                        "selesai"
                      ].includes(
                        norm(task.status)
                      )
                  ).length;

                summary.textContent =
                  `${completed}/` +
                  `${row.tasks.length} ` +
                  "task selesai";

                content.textContent =
                  value;

                details.append(
                  summary,
                  content
                );

                td.append(
                  details
                );

              } else {
                td.textContent =
                  value || "—";
              }

              tr.append(td);
            }
          );
        }

        body.append(tr);
      }
    );

    // ================================================
    // TABEL KOSONG
    // ================================================

    if (
      !rows.length
    ) {
      const tr =
        document.createElement(
          "tr"
        );

      const td =
        document.createElement(
          "td"
        );

      td.colSpan =
        state.columns.length;

      td.className =
        "sm-empty";

      td.textContent =
        state.loading
          ? "Memuat data proyek…"
          : state.error
            ? "Data belum lengkap. Lihat pesan di atas."
            : "Tidak ada proyek sesuai filter.";

      tr.append(td);

      body.append(tr);
    }

    // ================================================
    // TOTAL SETIAP KOLOM NOMINAL
    // ================================================

    const foot =
      document.createElement(
        "tr"
      );

    state.columns.forEach(
      (column, index) => {
        const td =
          document.createElement(
            "td"
          );

        if (
          index === 0
        ) {
          td.textContent =
            state.error
              ? "TOTAL BELUM LENGKAP"
              : "TOTAL HASIL FILTER";

        } else if (
          [
            "money",
            "number"
          ].includes(
            column.type
          )
        ) {
          const total =
            sum(
              valid
                .map(
                  row =>
                    cellValue(
                      row,
                      column
                    )
                )
                .filter(
                  value =>
                    typeof value === "number"
                )
            );

          td.className =
            "sm-num";

          td.textContent =
            state.error ||
            state.loading
              ? "—"
              : column.type === "money"
                ? rupiah(total)
                : fmt.format(total);
        }

        foot.append(td);
      }
    );

    $("smFoot")
      .replaceChildren(
        foot
      );

    // ================================================
    // PAGINATION DAN INFORMASI
    // ================================================

    $("smResult").textContent =
      `${rows.length} dari ` +
      `${state.rows.length} proyek · ` +
      `${state.columns.length} kolom · ` +
      "Geser tabel untuk melihat seluruh partner";

    $("smPage").textContent =
      `${state.page} / ${pages}`;

    $("smPrev").disabled =
      state.loading ||
      state.page <= 1;

    $("smNext").disabled =
      state.loading ||
      state.page >= pages;

    $("smExport").disabled =
      state.loading ||
      !!state.error ||
      !valid.length;
  }

  // ======================================================
  // UTILITAS XML EXCEL
  // ======================================================

  const xml = value =>
    String(value ?? "")
      .replace(
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,
        ""
      )
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  function colName(index) {
    let name = "";

    for (
      let n = index + 1;
      n;
      n = Math.floor(
        (n - 1) / 26
      )
    ) {
      name =
        String.fromCharCode(
          65 +
          (n - 1) % 26
        ) +
        name;
    }

    return name;
  }

  // ======================================================
  // WORKSHEET EXCEL
  // ======================================================

  function sheetXML(sheet) {
    if (
      sheet.rows.length + 1 >
      1048576
    ) {
      throw new Error(
        "Jumlah baris melebihi batas Excel."
      );
    }

    const last =
      colName(
        sheet.headers.length - 1
      ) +
      (sheet.rows.length + 1);

    function rowXML(
      row,
      index
    ) {
      const cells =
        row.map(
          (value, column) => {
            const ref =
              colName(column) +
              (index + 1);

            // Nominal disimpan sebagai angka.
            if (
              index > 0 &&
              typeof value === "number" &&
              Number.isFinite(value)
            ) {
              const style =
                sheet.money?.includes(
                  column
                )
                  ? 2
                  : 3;

              return (
                `<c r="${ref}" s="${style}">` +
                `<v>${value}</v>` +
                "</c>"
              );
            }

            // Tanggal disimpan sebagai tanggal Excel.
            if (
              index > 0 &&
              value &&
              sheet.dates?.includes(
                column
              ) &&
              dateOnly(value)
            ) {
              const serial =
                Math.round(
                  (
                    Date.parse(
                      `${value}T00:00:00Z`
                    ) -
                    Date.UTC(
                      1899,
                      11,
                      30
                    )
                  ) /
                  86400000
                );

              return (
                `<c r="${ref}" s="4">` +
                `<v>${serial}</v>` +
                "</c>"
              );
            }

            const text =
              String(
                value ?? ""
              );

            if (
              text.length > 32767
            ) {
              throw new Error(
                `Isi sel ${sheet.name}!${ref} ` +
                "melebihi 32.767 karakter. " +
                "Kurangi filter sebelum ekspor."
              );
            }

            const style =
              index === 0
                ? 1
                : 0;

            return (
              `<c r="${ref}" ` +
              `t="inlineStr" s="${style}">` +
              "<is>" +
              '<t xml:space="preserve">' +
              xml(text) +
              "</t>" +
              "</is>" +
              "</c>"
            );
          }
        ).join("");

      return (
        `<row r="${index + 1}"` +
        (
          index === 0
            ? ' ht="30" customHeight="1"'
            : ""
        ) +
        ">" +
        cells +
        "</row>"
      );
    }

    const widths =
      sheet.headers.map(
        (_, index) => {
          const width =
            index === 0
              ? 48
              : sheet.money?.includes(
                  index
                )
                ? 24
                : 28;

          return (
            `<col min="${index + 1}" ` +
            `max="${index + 1}" ` +
            `width="${width}" ` +
            'customWidth="1"/>'
          );
        }
      ).join("");

    const rows = [
      sheet.headers,
      ...sheet.rows
    ].map(
      rowXML
    ).join("");

    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +

      `<dimension ref="A1:${last}"/>` +

      "<sheetViews>" +
      '<sheetView workbookViewId="0">' +
      '<pane xSplit="1" ySplit="1" ' +
      'topLeftCell="B2" activePane="bottomRight" ' +
      'state="frozen"/>' +
      "</sheetView>" +
      "</sheetViews>" +

      '<sheetFormatPr defaultRowHeight="30"/>' +

      `<cols>${widths}</cols>` +

      `<sheetData>${rows}</sheetData>` +

      `<autoFilter ref="A1:${last}"/>` +

      "</worksheet>"
    );
  }

  // ======================================================
  // CRC32
  // ======================================================

  const CRC_TABLE =
    Array.from(
      {
        length: 256
      },
      (_, value) => {
        let result =
          value;

        for (
          let index = 0;
          index < 8;
          index++
        ) {
          result =
            result & 1
              ? (
                  0xedb88320 ^
                  (result >>> 1)
                )
              : result >>> 1;
        }

        return result >>> 0;
      }
    );

  function crc32(bytes) {
    let crc =
      0xffffffff;

    for (
      const byte of bytes
    ) {
      crc =
        CRC_TABLE[
          (crc ^ byte) & 255
        ] ^
        (crc >>> 8);
    }

    return (
      crc ^ 0xffffffff
    ) >>> 0;
  }

  // ======================================================
  // ZIP UNTUK XLSX
  // ======================================================

  function zip(files) {
    const encoder =
      new TextEncoder();

    const chunks = [];
    const directories = [];

    let offset = 0;

    for (
      const [
        name,
        content
      ] of files
    ) {
      const filename =
        encoder.encode(name);

      const data =
        encoder.encode(content);

      const crc =
        crc32(data);

      const header =
        new Uint8Array(
          30 + filename.length
        );

      const headerView =
        new DataView(
          header.buffer
        );

      headerView.setUint32(
        0,
        0x04034b50,
        true
      );

      headerView.setUint16(
        4,
        20,
        true
      );

      headerView.setUint16(
        6,
        0x800,
        true
      );

      headerView.setUint16(
        12,
        33,
        true
      );

      headerView.setUint32(
        14,
        crc,
        true
      );

      headerView.setUint32(
        18,
        data.length,
        true
      );

      headerView.setUint32(
        22,
        data.length,
        true
      );

      headerView.setUint16(
        26,
        filename.length,
        true
      );

      header.set(
        filename,
        30
      );

      const directory =
        new Uint8Array(
          46 + filename.length
        );

      const directoryView =
        new DataView(
          directory.buffer
        );

      directoryView.setUint32(
        0,
        0x02014b50,
        true
      );

      directoryView.setUint16(
        4,
        20,
        true
      );

      directoryView.setUint16(
        6,
        20,
        true
      );

      directoryView.setUint16(
        8,
        0x800,
        true
      );

      directoryView.setUint16(
        14,
        33,
        true
      );

      directoryView.setUint32(
        16,
        crc,
        true
      );

      directoryView.setUint32(
        20,
        data.length,
        true
      );

      directoryView.setUint32(
        24,
        data.length,
        true
      );

      directoryView.setUint16(
        28,
        filename.length,
        true
      );

      directoryView.setUint32(
        42,
        offset,
        true
      );

      directory.set(
        filename,
        46
      );

      chunks.push(
        header,
        data
      );

      directories.push(
        directory
      );

      offset +=
        header.length +
        data.length;
    }

    const end =
      new Uint8Array(22);

    const endView =
      new DataView(
        end.buffer
      );

    const directorySize =
      directories.reduce(
        (total, directory) =>
          total +
          directory.length,
        0
      );

    endView.setUint32(
      0,
      0x06054b50,
      true
    );

    endView.setUint16(
      8,
      files.length,
      true
    );

    endView.setUint16(
      10,
      files.length,
      true
    );

    endView.setUint32(
      12,
      directorySize,
      true
    );

    endView.setUint32(
      16,
      offset,
      true
    );

    return new Blob(
      [
        ...chunks,
        ...directories,
        end
      ],
      {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    );
  }

  // ======================================================
  // WORKBOOK EXCEL
  // ======================================================

  function workbook(sheets) {
    const styles = `
<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">

  <numFmts count="2">
    <numFmt
      numFmtId="164"
      formatCode="#,##0.00;[Red]-#,##0.00"
    />
    <numFmt
      numFmtId="165"
      formatCode="dd mmm yyyy"
    />
  </numFmts>

  <fonts count="2">
    <font>
      <sz val="11"/>
      <name val="Calibri"/>
    </font>
    <font>
      <b/>
      <color rgb="FFFFFFFF"/>
      <sz val="11"/>
      <name val="Calibri"/>
    </font>
  </fonts>

  <fills count="3">
    <fill>
      <patternFill patternType="none"/>
    </fill>
    <fill>
      <patternFill patternType="gray125"/>
    </fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF29265F"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>

  <borders count="1">
    <border/>
  </borders>

  <cellStyleXfs count="1">
    <xf/>
  </cellStyleXfs>

  <cellXfs count="5">
    <xf xfId="0" applyAlignment="1">
      <alignment vertical="top" wrapText="1"/>
    </xf>

    <xf
      xfId="0"
      fontId="1"
      fillId="2"
      applyFont="1"
      applyFill="1"
      applyAlignment="1"
    >
      <alignment vertical="center" wrapText="1"/>
    </xf>

    <xf
      xfId="0"
      numFmtId="164"
      applyNumberFormat="1"
      applyAlignment="1"
    >
      <alignment vertical="top" horizontal="right"/>
    </xf>

    <xf
      xfId="0"
      numFmtId="0"
      applyAlignment="1"
    >
      <alignment vertical="top" horizontal="right"/>
    </xf>

    <xf
      xfId="0"
      numFmtId="165"
      applyNumberFormat="1"
      applyAlignment="1"
    >
      <alignment vertical="top"/>
    </xf>
  </cellXfs>

  <cellStyles count="1">
    <cellStyle
      name="Normal"
      xfId="0"
      builtinId="0"
    />
  </cellStyles>

</styleSheet>
`.trim();

    const contentTypeSheets =
      sheets.map(
        (_, index) =>
          (
            `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ` +
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
          )
      ).join("");

    const workbookSheets =
      sheets.map(
        (sheet, index) =>
          (
            `<sheet name="${xml(sheet.name)}" ` +
            `sheetId="${index + 1}" ` +
            `r:id="rId${index + 1}"/>`
          )
      ).join("");

    const relationships =
      sheets.map(
        (_, index) =>
          (
            `<Relationship Id="rId${index + 1}" ` +
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
            `Target="worksheets/sheet${index + 1}.xml"/>`
          )
      ).join("");

    const files = [
      [
        "[Content_Types].xml",

        '<?xml version="1.0"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        contentTypeSheets +
        "</Types>"
      ],

      [
        "_rels/.rels",

        '<?xml version="1.0"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" ' +
        'Target="xl/workbook.xml"/>' +
        "</Relationships>"
      ],

      [
        "xl/workbook.xml",

        '<?xml version="1.0"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        "<sheets>" +
        workbookSheets +
        "</sheets>" +
        "</workbook>"
      ],

      [
        "xl/_rels/workbook.xml.rels",

        '<?xml version="1.0"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        relationships +
        '<Relationship Id="styles" ' +
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" ' +
        'Target="styles.xml"/>' +
        "</Relationships>"
      ],

      [
        "xl/styles.xml",
        styles
      ],

      ...sheets.map(
        (sheet, index) => [
          `xl/worksheets/sheet${index + 1}.xml`,
          sheetXML(sheet)
        ]
      )
    ];

    return zip(files);
  }

  // ======================================================
  // DOWNLOAD EXCEL
  // ======================================================

  function exportExcel() {
    if (
      state.loading ||
      state.error ||
      !state.filtered.length
    ) {
      return;
    }

    try {
      const rows =
        state.filtered;

      const columns =
        state.columns;

      const summary =
        rows.map(
          row =>
            columns.map(
              column =>
                cellValue(
                  row,
                  column
                )
            )
        );

      // Total seluruh hasil filter.
      summary.push(
        columns.map(
          (column, index) => {
            if (
              index === 0
            ) {
              return "TOTAL HASIL FILTER";
            }

            if (
              [
                "money",
                "number"
              ].includes(
                column.type
              )
            ) {
              return sum(
                rows
                  .map(
                    row =>
                      cellValue(
                        row,
                        column
                      )
                  )
                  .filter(
                    value =>
                      typeof value === "number"
                  )
              );
            }

            return "";
          }
        )
      );

      // Indeks format mengikuti kolom dinamis.
      const indices = type =>
        columns.flatMap(
          (column, index) =>
            column.type === type
              ? [index]
              : []
        );

      // ================================================
      // TERMIN KLIEN DAN SELURUH PARTNER
      // ================================================

      const terminRows =
        rows.flatMap(
          row => {
            const parties = [
              ...(
                row.client
                  ? [
                      {
                        party:
                          row.client,

                        label:
                          "Klien"
                      }
                    ]
                  : []
              ),

              ...row.partners.map(
                (party, index) => ({
                  party,

                  label:
                    `Partner ${index + 1}`
                })
              )
            ];

            return parties.flatMap(
              ({
                party,
                label
              }) =>
                party.terms.map(
                  (term, index) => [
                    row.nama,

                    label,

                    party.nama,

                    term.sumber,

                    term.nama_termin ||
                    term.deskripsi ||
                    `Termin ${index + 1}`,

                    term.nominal,

                    term.status_pembayaran,

                    dateOnly(
                      term.tanggal_tagihan
                    ),

                    dateOnly(
                      term.tanggal_jatuh_tempo
                    ),

                    dateOnly(
                      term.tanggal_bayar
                    ),

                    term.syarat_pembayaran ||
                    ""
                  ]
                )
            );
          }
        );

      // ================================================
      // KETENTUAN LAPORAN
      // ================================================

      const notes = [
        [
          "Diekspor",

          new Date().toLocaleString(
            "id-ID",
            {
              timeZone:
                "Asia/Jakarta"
            }
          ) +
          " WIB"
        ],

        [
          "Jumlah proyek",
          rows.length
        ],

        [
          "Jumlah kolom",
          columns.length
        ],

        ...[
          "smSearch",
          "smPIC",
          "smPengadaan",
          "smKontrak",
          "smFinal",
          "smKlien"
        ].map(
          id => [
            $(id)
              .previousElementSibling
              ?.textContent ||
            id,

            $(id).value ||
            "Semua"
          ]
        ),

        [
          "Urutan",

          "Nama Proyek, PIC, tanggal, Status Final, dokumen, " +
          "klien, kelompok partner, Tasklist. Tidak ada kolom Margin."
        ],

        [
          "Partner",

          "Setiap partner mendapat 10 kolom sendiri. " +
          "Partner kedua memakai akhiran 2, berikutnya 3, dst. " +
          "Urutan mengikuti API detail proyek."
        ],

        [
          "Jumlah kelompok",

          "Mengikuti jumlah partner terbanyak pada seluruh proyek yang dimuat. " +
          "Tetap konsisten ketika filter berubah. " +
          "Sel partner yang tidak ada dibiarkan kosong."
        ],

        [
          "Kontrak",

          "Dihitung per pihak: nego terakhir bukan 0 → submit → " +
          "jumlah nominal termin pihak tersebut. " +
          "Sewa memakai total_nilai untuk sisi klien."
        ],

        [
          "Belum ada Termin",

          "Maksimum (kontrak pihak tersebut − " +
          "total nominal termin pihak tersebut, 0)."
        ],

        [
          "Dibayar",

          "Hanya nominal termin pihak tersebut " +
          "dengan status Sudah Dibayar."
        ],

        [
          "Status Pembayaran",

          "Nama/deskripsi setiap termin diikuti " +
          "status pembayaran, satu termin per baris."
        ],

        [
          "Status Kontrak",

          "Tanggal kontrak masing-masing pihak. " +
          "Status Final Done/Selesai → Selesai. " +
          "Acuan tanggal Asia/Jakarta."
        ],

        [
          "Dokumen",

          "RFQ/TOR, SPH, SPK/PKS, BAST berisi dokumen " +
          "klien dan seluruh partner beserta label pemiliknya."
        ],

        [
          "Media Pengadaan",

          "Membaca media_pengadaan masing-masing klien/partner dari API; " +
          "jika belum tersedia, tampil Belum Diisi."
        ],

        [
          "Format nominal",

          "Angka Excel tanpa Rp. " +
          "Tampilan halaman tetap memakai Rp."
        ],

        ...rows.flatMap(
          row =>
            row.warnings.map(
              text => [
                row.nama,
                text
              ]
            )
        )
      ];

      // ================================================
      // BUAT FILE EXCEL
      // ================================================

      const blob =
        workbook([
          {
            name:
              "Summary",

            headers:
              columns.map(
                column =>
                  column.label
              ),

            rows:
              summary,

            money:
              indices("money"),

            dates:
              indices("date")
          },

          {
            name:
              "Termin",

            headers: [
              "Nama Proyek",
              "Pihak",
              "Nama Klien / Partner",
              "Sumber",
              "Nama Termin",
              "Nominal",
              "Status Pembayaran",
              "Tanggal Tagihan",
              "Jatuh Tempo",
              "Tanggal Bayar",
              "Syarat Pembayaran"
            ],

            rows:
              terminRows,

            money: [
              5
            ],

            dates: [
              7,
              8,
              9
            ]
          },

          {
            name:
              "Tasklist",

            headers: [
              "Nama Proyek",
              "ID Task",
              "ID Parent Task",
              "Task",
              "PIC",
              "Status",
              "Tanggal Mulai",
              "Target Date",
              "Tanggal Selesai",
              "Tindak Lanjut",
              "Catatan",
              "Link"
            ],

            dates: [
              6,
              7,
              8,
              9
            ],

            rows:
              rows.flatMap(
                row =>
                  row.tasks.map(
                    task => [
                      row.nama,

                      task.id,

                      task.parent_task_id ||
                      "",

                      task.task ||
                      "",

                      task.nama_pic ||
                      "",

                      task.status ||
                      "",

                      dateOnly(
                        task.tanggal_mulai
                      ),

                      dateOnly(
                        task.target_date
                      ),

                      dateOnly(
                        task.tanggal_selesai
                      ),

                      dateOnly(
                        task.tanggal_tindak_lanjut
                      ),

                      task.catatan ||
                      "",

                      task.link ||
                      ""
                    ]
                  )
              )
          },

          {
            name:
              "Ketentuan",

            headers: [
              "Keterangan",
              "Nilai / Ketentuan"
            ],

            rows:
              notes
          }
        ]);

      const url =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        url;

      link.download =
        `Summary-Proyek-${todayJakarta()}.xlsx`;

      document.body.append(
        link
      );

      link.click();

      link.remove();

      setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        10000
      );

    } catch (error) {
      message(
        "Excel belum dapat diunduh: " +
        error.message,
        true
      );
    }
  }

  // ======================================================
  // UKURAN SUMMARY MENGIKUTI SIDEBAR
  // ======================================================

  function initSummarySidebarResize() {
    const container =
      $("sidebarContainer");

    if (
      !container ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }

    let observed = null;
    let frame = null;

    function update() {
      frame = null;

      const sidebar =
        container.querySelector(
          ".sidebar"
        );

      if (!sidebar) {
        return;
      }

      const style =
        getComputedStyle(
          sidebar
        );

      const hidden =
        style.display === "none" ||
        style.visibility === "hidden";

      const isMobile =
        matchMedia(
          "(max-width: 768px)"
        ).matches;

      const width =
        isMobile || hidden
          ? 0
          : Math.max(
              0,
              Math.min(
                innerWidth,
                sidebar
                  .getBoundingClientRect()
                  .right
              )
            );

      document.body.style.setProperty(
        "--summary-sidebar-width",
        `${width}px`
      );
    }

    function schedule() {
      if (
        frame === null
      ) {
        frame =
          requestAnimationFrame(
            update
          );
      }
    }

    const resize =
      new ResizeObserver(
        schedule
      );

    function observe() {
      const sidebar =
        container.querySelector(
          ".sidebar"
        );

      if (
        sidebar !== observed
      ) {
        resize.disconnect();

        observed =
          sidebar;

        if (sidebar) {
          resize.observe(
            sidebar
          );
        }
      }

      schedule();
    }

    const containerObserver =
      new MutationObserver(
        observe
      );

    containerObserver.observe(
      container,
      {
        childList: true,
        subtree: true,
        attributes: true,

        attributeFilter: [
          "class",
          "style"
        ]
      }
    );

    const bodyObserver =
      new MutationObserver(
        schedule
      );

    bodyObserver.observe(
      document.body,
      {
        attributes: true,

        attributeFilter: [
          "class"
        ]
      }
    );

    window.addEventListener(
      "resize",
      schedule
    );

    container.addEventListener(
      "transitionend",
      schedule
    );

    observe();
  }

  // ======================================================
  // INISIALISASI
  // ======================================================

  function init() {
    if (
      !$("summaryApp")
    ) {
      return;
    }

    buildColumns();

    initSummarySidebarResize();

    const filterLabels = {
      smPengadaan:
        "STATUS PENGADAAN KLIEN",

      smKontrak:
        "STATUS KONTRAK KLIEN",

      smKlien:
        "NAMA KLIEN"
    };

    Object.entries(
      filterLabels
    ).forEach(
      ([id, label]) => {
        const element =
          $("smFilters")
            .querySelector(
              `label[for="${id}"]`
            );

        if (element) {
          element.textContent =
            label;
        }
      }
    );

    $("smFilters")
      .addEventListener(
        "submit",
        event =>
          event.preventDefault()
      );

    [
      "input",
      "change"
    ].forEach(
      event =>
        $("smFilters")
          .addEventListener(
            event,
            () => {
              state.page = 1;
              applyFilters();
            }
          )
    );

    $("smReset")
      .addEventListener(
        "click",
        () => {
          $("smFilters")
            .reset();

          state.page = 1;

          applyFilters();
        }
      );

    $("smPageSize")
      .addEventListener(
        "change",
        () => {
          state.page = 1;
          render();
        }
      );

    $("smPrev")
      .addEventListener(
        "click",
        () => {
          state.page =
            Math.max(
              1,
              state.page - 1
            );

          render();
        }
      );

    $("smNext")
      .addEventListener(
        "click",
        () => {
          state.page++;
          render();
        }
      );

    $("smReload")
      .addEventListener(
        "click",
        load
      );

    $("smExport")
      .addEventListener(
        "click",
        exportExcel
      );

    load();
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true
      }
    );

  } else {
    init();
  }

})();