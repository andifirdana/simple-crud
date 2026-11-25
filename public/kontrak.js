document.addEventListener(
  "DOMContentLoaded",
  () => {
    // ================================================
    // ELEMENT
    // ================================================

    const searchInput =
      document.getElementById(
        "searchKontrak"
      );

    const filterJenis =
      document.getElementById(
        "filterJenis"
      );

    const filterStatus =
      document.getElementById(
        "filterStatus"
      );

    const resetFilter =
      document.getElementById(
        "resetFilter"
      );

    const tableBody =
      document.getElementById(
        "kontrakTableBody"
      );

    const totalKontrak =
      document.getElementById(
        "totalKontrak"
      );

    const totalKontrakAktif = document.getElementById("totalKontrakAktif");
    const totalKontrakSelesai = document.getElementById("totalKontrakSelesai");
    const totalKontrakBerakhir = document.getElementById("totalKontrakBerakhir");
    const totalKontrak90Hari = document.getElementById("totalKontrak90Hari");
    const totalKontrakBelumDitentukan = document.getElementById("totalKontrakBelumDitentukan");
    const formatJumlahKontrak = new Intl.NumberFormat("id-ID");
    const kartuStatus = document.querySelectorAll("[data-contract-status]");

    const tableSummary =
      document.getElementById(
        "tableSummary"
      );

    const paginationInfo =
      document.getElementById(
        "paginationInfo"
      );

    const pageInfo =
      document.getElementById(
        "pageInfo"
      );

    const prevPage =
      document.getElementById(
        "prevPage"
      );

    const nextPage =
      document.getElementById(
        "nextPage"
      );

    const noteModal = document.getElementById("contractNoteModal");
    const noteForm = document.getElementById("contractNoteForm");
    const noteStatus = document.getElementById("contractStatusInput");
    const noteInput = document.getElementById("contractNoteInput");
    const noteContext = document.getElementById("contractNoteContext");
    const noteError = document.getElementById("contractNoteError");
    const noteCancel = document.getElementById("contractNoteCancel");
    const noteSave = document.getElementById("contractNoteSave");
    const noteSuccessModal = document.getElementById("contractNoteSuccessModal");
    const uploadModal = document.getElementById("contractUploadModal");
    const uploadForm = document.getElementById("contractUploadForm");
    const uploadCategory = document.getElementById("contractUploadCategory");
    const uploadNumber = document.getElementById("contractUploadNumber");
    const uploadInput = document.getElementById("contractUploadFile");
    const uploadContext = document.getElementById("contractUploadContext");
    const uploadError = document.getElementById("contractUploadError");
    const uploadCancel = document.getElementById("contractUploadCancel");
    const uploadSave = document.getElementById("contractUploadSave");
    const uploadNotice = document.getElementById("contractUploadNotice");
    const workspace = document.getElementById("contractWorkspace");
    const documentsPanel = document.getElementById("contractDocumentsPanel");
    const documentsProject = document.getElementById("contractDocumentsProject");
    const documentsList = document.getElementById("contractDocumentsList");
    const documentsEmpty = document.getElementById("contractDocumentsEmpty");
    const documentsClose = document.getElementById("closeContractDocuments");
    const documentsUpload = document.getElementById("contractDocumentsUpload");
    const drawerMode = window.matchMedia("(max-width: 1199px)");
    const logModal = document.getElementById("contractLogModal");
    const logContext = document.getElementById("contractLogContext");
    const logMessage = document.getElementById("contractLogMessage");
    const logResults = document.getElementById("contractLogResults");
    const logBody = document.getElementById("contractLogBody");
    const formatWaktuLog = new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta"
    });
    let displayedContracts = [];
    let selectedDocumentContract = null;
    let editedContract = null;
    let noteTriggerIndex = 0;
    let noteSaving = false;
    let uploadContract = null;
    let uploadPending = false;
    let logRequestId = 0;

    // ================================================
    // STATE
    // ================================================

   // ================================================
// FILTER DARI URL DASHBOARD
// ================================================

const urlParams =
  new URLSearchParams(
    window.location.search
  );

const jenisUrl =
  String(
    urlParams.get("jenis") || ""
  ).trim();

const statusUrl =
  String(
    urlParams.get("status") || ""
  )
    .trim()
    .toLowerCase();

const periodeUrl =
  String(
    urlParams.get("periode") || ""
  )
    .trim()
    .toLowerCase();

const state = {
  page: 1,
  limit: 20,
  totalData: 0,
  totalPages: 1,
  search: "",

  jenis:
    [
      "Klien",
      "Partner"
    ].includes(jenisUrl)
      ? jenisUrl
      : "",

  status: [...filterStatus.options].some(option => option.value === statusUrl)
    ? statusUrl
    : "",

  periode:
    periodeUrl === "3-bulan"
      ? "3-bulan"
      : ""
};

/*
 * Munculkan filter URL di dropdown.
 */
filterJenis.value =
  state.jenis;

filterStatus.value =
  state.status;

    let searchTimer = null;
    let latestRequest = 0;

    // ================================================
    // FETCH JSON
    // ================================================

    async function fetchJSON(
      url,
      options = {}
    ) {
      const response =
        await fetch(
          url,
          {
            credentials:
              "same-origin",

            ...options
          }
        );

      const result =
        await response.json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
          "Terjadi kesalahan pada server."
        );
      }

      return result;
    }

    // ================================================
    // ESCAPE HTML
    // ================================================

    function escapeHTML(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll(
          "'",
          "&#039;"
        );
    }

    // ================================================
    // FORMAT TANGGAL
    // ================================================

    const formatTanggalKontrak = new Intl.DateTimeFormat("id-ID", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC"
    });

    function renderTanggal(value) {
      const iso = String(value ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
      const date = new Date(`${iso}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return "—";
      return `<time datetime="${iso}">${formatTanggalKontrak.format(date)}</time>`;
    }

    function getRelationBadge(jenis) {
      if (!jenis) return "";
      const color = jenis === "Partner" ? "relation-partner" : "relation-klien";
      return `<span class="relation-badge ${color}">${escapeHTML(jenis)}</span>`;
    }

    function getBerakhirBadge(item) {
      const hari = item.sisa_hari == null ? NaN : Number(item.sisa_hari);
      let label = "Belum ditentukan";
      let warna = "empty-badge";

      if (item.status_kontrak === "selesai") {
        label = "Kontrak selesai";
        warna = "completed-badge";
      } else if (item.status_kontrak === "berakhir") {
        label = "Sudah berakhir";
        warna = "expired-badge";
      } else if (hari === 0) {
        label = "Berakhir hari ini";
        warna = "today-badge";
      } else if (Number.isFinite(hari) && hari > 0) {
        label = `${hari} hari lagi`;
        warna = hari <= 90 ? "warning-badge" : "active-badge";
      }

      return `<span class="contract-time-badge ${warna}">${label}</span>`;
    }

    function renderStatusKontrak(kontrak) {
      const status = Array.isArray(kontrak.status_monitoring) ? kontrak.status_monitoring.join(", ") : "";
      const catatan = String(kontrak.catatan ?? "").trim();
      const waktu = kontrak.status_monitoring_waktu ? new Date(kontrak.status_monitoring_waktu) : null;
      const waktuTampil = waktu && Number.isFinite(waktu.getTime())
        ? `<time class="contract-status-time" datetime="${waktu.toISOString()}">${formatWaktuLog.format(waktu)} WIB</time>`
        : "";

      return `
        <strong class="contract-status-name">${escapeHTML(status || "—")}</strong>
        ${catatan ? `<span class="contract-status-note">${escapeHTML(catatan)}</span>` : ""}
        ${waktuTampil}
      `;
    }

    function dokumenKontrak(kontrak) {
      return Array.isArray(kontrak.dokumen_kontrak) ? kontrak.dokumen_kontrak : [];
    }

    function labelJumlahDokumen(kontrak) {
      return `${formatJumlahKontrak.format(dokumenKontrak(kontrak).length)} dokumen`;
    }

    function kontrakSama(a, b) {
      return Boolean(a && b && a.jenis_relasi === b.jenis_relasi && a.kontrak_id === b.kontrak_id);
    }

    function urlDokumenKontrak(kontrak) {
      const jenis = encodeURIComponent(kontrak.jenis_relasi.toLowerCase());
      return `/api/kontrak/${jenis}/${encodeURIComponent(kontrak.kontrak_id)}/dokumen`;
    }

    function perbaruiSorotanDokumen() {
      for (const tombol of tableBody.querySelectorAll("[data-contract-documents]")) {
        const kontrak = displayedContracts[Number(tombol.dataset.contractDocuments)];
        const aktif = kontrakSama(kontrak, selectedDocumentContract);
        tombol.setAttribute("aria-expanded", String(aktif));
        tombol.closest("tr").classList.toggle("is-document-selected", aktif);
      }
    }

    function renderPanelDokumen(kontrak) {
      documentsProject.textContent = kontrak.nama_proyek || "—";
      const dokumen = dokumenKontrak(kontrak);
      documentsEmpty.hidden = dokumen.length > 0;
      documentsList.hidden = dokumen.length === 0;
      documentsList.innerHTML = dokumen.map(file => {
        const judul = file.nama_file_asli || file.nama_dokumen || "Dokumen kontrak";
        const jenis = file.nama_dokumen !== judul ? file.nama_dokumen : "";
        const detail = [jenis, file.nomor_dokumen].filter(Boolean).join(" · ");
        const url = `${urlDokumenKontrak(kontrak)}/${encodeURIComponent(file.dokumen_id)}`;
        return `
          <li>
            <div>
              <strong class="contract-document-name">${escapeHTML(judul)}</strong>
              ${detail ? `<span class="contract-document-detail">${escapeHTML(detail)}</span>` : ""}
            </div>
            <a class="document-link" href="${url}" target="_blank" rel="noopener" aria-label="${escapeHTML(`Buka ${judul}`)}">Buka</a>
          </li>`;
      }).join("");
    }

    function tampilkanPanelDokumen() {
      workspace.classList.add("has-document-panel");
      if (drawerMode.matches) documentsPanel.showModal();
      else documentsPanel.show();
    }

    function bukaPanelDokumen(kontrak) {
      if (!kontrakSama(kontrak, selectedDocumentContract)) uploadNotice.hidden = true;
      selectedDocumentContract = kontrak;
      renderPanelDokumen(kontrak);
      perbaruiSorotanDokumen();
      if (!documentsPanel.open) tampilkanPanelDokumen();
      else documentsClose.focus();
    }

    function tutupPanelDokumen() {
      selectedDocumentContract = null;
      workspace.classList.remove("has-document-panel");
      uploadNotice.hidden = true;
      if (documentsPanel.open) documentsPanel.close();
      perbaruiSorotanDokumen();
    }

    documentsClose.addEventListener("click", tutupPanelDokumen);
    documentsPanel.addEventListener("close", () => {
      if (!documentsPanel.open && selectedDocumentContract) tutupPanelDokumen();
    });
    documentsPanel.addEventListener("click", event => {
      if (drawerMode.matches && event.target === documentsPanel) {
        const bounds = documentsPanel.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX >= bounds.right) tutupPanelDokumen();
      }
    });
    drawerMode.addEventListener("change", () => {
      if (!documentsPanel.open || !selectedDocumentContract) return;
      documentsPanel.close();
      tampilkanPanelDokumen();
    });
    documentsUpload.addEventListener("click", () => {
      if (selectedDocumentContract && !uploadPending) bukaUploadKontrak(selectedDocumentContract);
    });

    function renderTable(data, bisaBukaDetailProyek) {
      displayedContracts = Array.isArray(data) ? data : [];
      if (displayedContracts.length === 0) {
        tableBody.innerHTML = '<tr role="row"><td role="cell" colspan="6" class="table-message">Data kontrak tidak ditemukan.</td></tr>';
      } else {
        tableBody.innerHTML = displayedContracts.map((item, index) => {
          const namaProyek = escapeHTML(item.nama_proyek || "—");
          return `
            <tr role="row">
              <td role="cell">
                <div class="project-name">
                  ${bisaBukaDetailProyek && item.proyek_id
                    ? `<a class="project-detail-link" href="/detail-proyek.html?id=${encodeURIComponent(item.proyek_id)}">${namaProyek}</a>`
                    : namaProyek}
                </div>
                <div class="contract-relation">
                  <span class="relation-name">${escapeHTML(item.nama_relasi || "—")}</span>
                  ${getRelationBadge(item.jenis_relasi)}
                </div>
              </td>
              <td role="cell">
                <div class="contract-period">
                  <span>Mulai</span>${renderTanggal(item.tanggal_mulai)}
                  <span>Akhir</span>${renderTanggal(item.tanggal_akhir)}
                </div>
              </td>
              <td role="cell">${getBerakhirBadge(item)}</td>
              <td role="cell" data-contract-status-summary="${index}">${renderStatusKontrak(item)}</td>
              <td role="cell">
                <button type="button" class="note-button document-count-button" data-contract-documents="${index}" aria-controls="contractDocumentsPanel" aria-expanded="false">${labelJumlahDokumen(item)}</button>
              </td>
              <td role="cell">
                <div class="contract-status-actions">
                  <button type="button" class="note-button" data-edit-note="${index}">Tambah status</button>
                  <button type="button" class="note-button" data-contract-log="${index}">Log</button>
                </div>
              </td>
            </tr>`;
        }).join("");
      }

      if (selectedDocumentContract) {
        const kontrak = displayedContracts.find(item => kontrakSama(item, selectedDocumentContract));
        if (!kontrak) {
          tutupPanelDokumen();
        } else {
          selectedDocumentContract = kontrak;
          renderPanelDokumen(kontrak);
          perbaruiSorotanDokumen();
        }
      }
    }

    async function muatPilihanStatusKontrak(kontrak) {
      noteStatus.replaceChildren(new Option("Memuat status…", ""));
      noteStatus.disabled = true;
      noteSave.disabled = true;

      try {
        const pilihan = await fetchJSON("/api/proyek/status?flag=kontrak", { cache: "no-store" });
        if (editedContract !== kontrak || !noteModal.open) return;

        if (pilihan.length === 0) {
          noteStatus.replaceChildren(new Option("Status tidak tersedia", ""));
          noteError.textContent = "Belum ada status kontrak aktif di Master Status.";
          noteError.hidden = false;
          return;
        }

        noteStatus.replaceChildren(
          new Option("Pilih status", ""),
          ...pilihan.map(item => new Option(item.deskripsi, String(item.id)))
        );
        noteStatus.disabled = false;
        noteSave.disabled = false;
      } catch {
        if (editedContract !== kontrak || !noteModal.open) return;

        noteStatus.replaceChildren(new Option("Status tidak tersedia", ""));
        noteError.textContent = "Gagal memuat status kontrak.";
        noteError.hidden = false;
      }
    }

    function urlLogKontrak(kontrak) {
      const jenis = encodeURIComponent(kontrak.jenis_relasi.toLowerCase());
      const id = encodeURIComponent(kontrak.kontrak_id);
      return `/api/kontrak/${jenis}/${id}/status-log`;
    }

    function teksKonteksKontrak(item) {
      return `${item.nama_proyek || "-"} · ${item.jenis_relasi} · ${item.nama_relasi || "-"}`;
    }

    function bukaUploadKontrak(kontrak) {
      uploadContract = kontrak;
      uploadForm.reset();
      uploadContext.textContent = teksKonteksKontrak(kontrak);
      uploadError.hidden = true;
      uploadModal.showModal();
    }

    uploadCancel.addEventListener("click", () => uploadModal.close());
    uploadModal.addEventListener("cancel", event => {
      if (uploadPending) event.preventDefault();
    });
    uploadModal.addEventListener("close", () => { uploadContract = null; });

    uploadForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!uploadContract || uploadPending || !uploadForm.reportValidity()) return;

      const kontrak = uploadContract;
      const payload = new FormData(uploadForm);
      uploadError.hidden = true;
      uploadPending = true;
      uploadCategory.disabled = uploadNumber.disabled = uploadInput.disabled =
        uploadCancel.disabled = uploadSave.disabled = true;
      uploadSave.textContent = "Mengunggah…";

      try {
        const { data: dokumen } = await fetchJSON(urlDokumenKontrak(kontrak), {
          method: "POST",
          body: payload
        });

        if (!dokumen?.dokumen_id) {
          await loadKontrak();
        } else {
          const index = displayedContracts.findIndex(item => kontrakSama(item, kontrak));
          const kontrakTerbaru = displayedContracts[index] || kontrak;
          const list = dokumenKontrak(kontrakTerbaru);
          if (!list.some(item => String(item.dokumen_id) === String(dokumen.dokumen_id))) {
            kontrakTerbaru.dokumen_kontrak = [...list, dokumen];
          }
          const tombol = tableBody.querySelector(`[data-contract-documents="${index}"]`);
          if (tombol) tombol.textContent = labelJumlahDokumen(kontrakTerbaru);
          if (kontrakSama(selectedDocumentContract, kontrakTerbaru)) {
            selectedDocumentContract = kontrakTerbaru;
            renderPanelDokumen(kontrakTerbaru);
          }
        }

        uploadModal.close();
        if (kontrakSama(selectedDocumentContract, kontrak)) {
          uploadNotice.textContent = "Dokumen kontrak berhasil diunggah.";
          uploadNotice.hidden = false;
        }
      } catch (error) {
        uploadError.textContent = error.message || "Gagal mengunggah dokumen kontrak.";
        uploadError.hidden = false;
      } finally {
        uploadPending = false;
        uploadCategory.disabled = uploadNumber.disabled = uploadInput.disabled =
          uploadCancel.disabled = uploadSave.disabled = false;
        uploadSave.textContent = "Unggah";
      }
    });

    async function bukaLogKontrak(kontrak) {
      const requestId = ++logRequestId;
      logContext.textContent = teksKonteksKontrak(kontrak);
      logResults.hidden = true;
      logMessage.hidden = false;
      logMessage.textContent = "Memuat log kontrak…";
      logModal.showModal();

      try {
        const { data } = await fetchJSON(urlLogKontrak(kontrak), { cache: "no-store" });
        if (requestId !== logRequestId || !logModal.open) return;
        if (!data.length) {
          logMessage.textContent = "Belum ada log untuk kontrak ini.";
          return;
        }

        logBody.innerHTML = data.map(item => {
          const waktu = item.waktu ? new Date(item.waktu) : null;
          const waktuTampil = waktu && !Number.isNaN(waktu.getTime()) ? formatWaktuLog.format(waktu) : "—";
          return `<tr>
            <td>${escapeHTML(item.status.join(", ") || "—")}</td>
            <td>${escapeHTML(item.catatan || "—")}</td>
            <td>${escapeHTML(item.pic || "—")}</td>
            <td>${escapeHTML(waktuTampil)}</td>
          </tr>`;
        }).join("");
        logResults.hidden = false;
        logMessage.hidden = true;
      } catch (error) {
        if (requestId === logRequestId && logModal.open) {
          logMessage.textContent = error.message || "Gagal memuat log kontrak.";
        }
      }
    }

    tableBody.addEventListener("click", event => {
      const documentsButton = event.target.closest("[data-contract-documents]");
      if (documentsButton) {
        const kontrak = displayedContracts[Number(documentsButton.dataset.contractDocuments)];
        if (kontrak) bukaPanelDokumen(kontrak);
        return;
      }

      const logButton = event.target.closest("[data-contract-log]");
      if (logButton) {
        const kontrak = displayedContracts[Number(logButton.dataset.contractLog)];
        if (kontrak) bukaLogKontrak(kontrak);
        return;
      }

      const button = event.target.closest("[data-edit-note]");
      if (!button || noteSaving) return;
      const item = displayedContracts[Number(button.dataset.editNote)];
      if (!item) return;

      noteTriggerIndex = Number(button.dataset.editNote);
      editedContract = { ...item };
      noteContext.textContent = teksKonteksKontrak(item);
      noteInput.value = "";
      noteError.hidden = true;
      noteError.textContent = "";
      muatPilihanStatusKontrak(editedContract);
      noteModal.showModal();
    });

    noteCancel.addEventListener("click", () => {
      if (!noteSaving) noteModal.close();
    });

    noteModal.addEventListener("cancel", event => {
      if (noteSaving) event.preventDefault();
    });

    noteModal.addEventListener("close", () => {
      editedContract = null;
    });

    noteSuccessModal.addEventListener("close", () => {
      tableBody.querySelector(`[data-edit-note="${noteTriggerIndex}"]`)?.focus();
    });

    noteForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (noteSaving || noteStatus.disabled || !editedContract || !noteForm.reportValidity()) return;

      const statusDipilih = noteStatus.value;
      const contract = editedContract;
      noteSaving = true;
      noteInput.disabled = true;
      noteStatus.disabled = true;
      noteCancel.disabled = true;
      noteSave.disabled = true;
      noteSave.textContent = "Menyimpan…";
      noteError.hidden = true;

      try {
        const result = await fetchJSON(
          urlLogKontrak(contract),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              catatan: noteInput.value,
              status_ids: [statusDipilih],
              tanggal_mulai: contract.tanggal_mulai ?? null,
              tanggal_akhir: contract.tanggal_akhir ?? null
            })
          }
        );
        if (
          typeof result.catatan !== "string" ||
          !Array.isArray(result.status)
        ) {
          throw new Error("Respons penyimpanan status tidak valid. Muat ulang halaman untuk memeriksa hasilnya.");
        }

        const index = displayedContracts.findIndex(item => kontrakSama(item, contract));
        if (index >= 0) {
          const kontrak = displayedContracts[index];
          kontrak.status_monitoring = result.status;
          kontrak.status_monitoring_waktu = result.waktu;
          kontrak.catatan = result.catatan;
          const cell = tableBody.querySelector(`[data-contract-status-summary="${index}"]`);
          if (cell) cell.innerHTML = renderStatusKontrak(kontrak);
        }

        noteModal.close();
        noteSuccessModal.showModal();
      } catch (error) {
        noteError.textContent = error.message || "Gagal menyimpan status kontrak.";
        noteError.hidden = false;
      } finally {
        noteSaving = false;
        noteInput.disabled = false;
        noteStatus.disabled = false;
        noteCancel.disabled = false;
        noteSave.disabled = false;
        noteSave.textContent = "Simpan";
        if (noteModal.open) noteInput.focus();
      }
    });

    // ================================================
    // RENDER PAGINATION
    // ================================================

    function renderRingkasan(ringkasan = {}) {
      totalKontrak.textContent = formatJumlahKontrak.format(ringkasan.total_kontrak ?? 0);
      totalKontrakBerakhir.textContent = formatJumlahKontrak.format(ringkasan.sudah_berakhir ?? 0);
      totalKontrak90Hari.textContent = formatJumlahKontrak.format(ringkasan.akan_berakhir_90_hari ?? 0);
      totalKontrakBelumDitentukan.textContent = formatJumlahKontrak.format(ringkasan.belum_ditentukan ?? 0);
    }

    function aturKartuAktif() {
      kartuStatus.forEach(kartu => {
        const aktif = !state.periode && kartu.dataset.contractStatus === state.status;
        kartu.setAttribute("aria-pressed", String(aktif));
      });
    }

    function tampilkanJumlahAktifDanSelesai(ringkasan, jumlahSelesai) {
      totalKontrakSelesai.textContent = jumlahSelesai == null ? "—" : formatJumlahKontrak.format(jumlahSelesai);

      const [total, ...kategoriLain] = [
        ringkasan?.total_kontrak,
        jumlahSelesai,
        ringkasan?.sudah_berakhir,
        ringkasan?.akan_berakhir_90_hari,
        ringkasan?.belum_ditentukan
      ].map(jumlah => jumlah == null ? NaN : Number(jumlah));
      const aktif = total - kategoriLain.reduce((sum, jumlah) => sum + jumlah, 0);
      totalKontrakAktif.textContent = Number.isFinite(aktif) ? formatJumlahKontrak.format(aktif) : "—";
    }

    async function muatJumlahSelesai(params, request) {
      const query = new URLSearchParams({
        search: params.get("search"),
        jenis: params.get("jenis"),
        page: "1",
        limit: "1",
        status: "selesai"
      });
      try {
        const result = await fetchJSON(`/api/kontrak?${query}`);
        return result.pagination?.total_data;
      } catch (error) {
        if (request === latestRequest) console.error("ERROR GET JUMLAH KONTRAK SELESAI:", error);
        return null;
      }
    }

    function renderPagination() {
      const start =
        state.totalData === 0
          ? 0
          : (
              (
                state.page - 1
              ) *
              state.limit
            ) + 1;

      const end =
        Math.min(
          state.page *
          state.limit,
          state.totalData
        );

      tableSummary.textContent =
        `${state.totalData.toLocaleString(
          "id-ID"
        )} kontrak ditemukan`;

      paginationInfo.textContent =
        state.totalData > 0
          ? (
              `Menampilkan ` +
              `${start}-${end} ` +
              `dari ${state.totalData} data`
            )
          : "Menampilkan 0 data";

      pageInfo.textContent =
        `Halaman ${state.page} ` +
        `dari ${state.totalPages}`;

      prevPage.disabled =
        state.page <= 1;

      nextPage.disabled =
        state.page >=
        state.totalPages;
    }

    // ================================================
    // LOADING TABLE
    // ================================================

    function renderLoading() {
      tableBody.innerHTML = `
        <tr role="row">
          <td
            role="cell"
            colspan="6"
            class="table-message"
          >
            Memuat data kontrak...
          </td>
        </tr>
      `;
    }

    // ================================================
    // ERROR TABLE
    // ================================================

    function renderError(message) {
      tableBody.innerHTML = `
        <tr role="row">
          <td
            role="cell"
            colspan="6"
            class="table-message"
          >
            ${escapeHTML(message)}
          </td>
        </tr>
      `;
    }

    // ================================================
    // LOAD KONTRAK
    // ================================================

    async function loadKontrak() {
      const request = ++latestRequest;
      aturKartuAktif();
      renderLoading();
      totalKontrakAktif.textContent = "—";
      totalKontrakSelesai.textContent = "—";

      try {
        const params = new URLSearchParams({
          page: String(state.page),
          limit: String(state.limit),
          search: state.search,
          jenis: state.jenis,
          status: state.status,
          periode: state.periode
        });
        const hanyaKontrakSelesai = state.status === "selesai" && !state.periode;
        const permintaanSelesai = hanyaKontrakSelesai ? null : muatJumlahSelesai(params, request);
        const result =
          await fetchJSON(
            `/api/kontrak?${params.toString()}`
          );

        if (request !== latestRequest) return;

        state.totalData =
          Number(
            result.pagination
              ?.total_data || 0
          );

        state.totalPages =
          Math.max(
            Number(
              result.pagination
                ?.total_pages || 1
            ),
            1
          );

        /*
         * Kembali ke halaman terakhir
         * jika halaman saat ini melebihi total.
         */
        if (
          state.page >
          state.totalPages
        ) {
          state.page =
            state.totalPages;

          return loadKontrak();
        }

        renderTable(
          result.data || [],
          result.bisa_buka_detail_proyek !== false
        );

        renderRingkasan(result.ringkasan);
        renderPagination();

        const jumlahSelesai = hanyaKontrakSelesai ? result.pagination?.total_data : await permintaanSelesai;
        if (request === latestRequest) tampilkanJumlahAktifDanSelesai(result.ringkasan, jumlahSelesai);

      } catch (error) {
        if (request !== latestRequest) return;

        console.error(
          "ERROR LOAD KONTRAK:",
          error
        );

        displayedContracts = [];
        if (selectedDocumentContract) tutupPanelDokumen();
        renderError(
          error.message ||
          "Gagal memuat data kontrak."
        );

        renderRingkasan();

        tableSummary.textContent =
          "Gagal memuat data";

        paginationInfo.textContent =
          "Menampilkan 0 data";

        pageInfo.textContent =
          "Halaman 1 dari 1";

        prevPage.disabled = true;
        nextPage.disabled = true;
      }
    }

    // ================================================
    // SEARCH
    // ================================================

    searchInput.addEventListener(
      "input",
      () => {
        clearTimeout(
          searchTimer
        );

        searchTimer =
          setTimeout(
            () => {
              state.search =
                searchInput
                  .value
                  .trim();

              state.page = 1;

              loadKontrak();
            },
            350
          );
      }
    );

    // ================================================
    // FILTER JENIS
    // ================================================

    filterJenis.addEventListener(
      "change",
      () => {
        state.jenis =
          filterJenis.value;

        state.page = 1;

        loadKontrak();
      }
    );

    // ================================================
    // FILTER STATUS
    // ================================================

    function terapkanFilterStatus(status) {
      clearTimeout(searchTimer);
      state.search = searchInput.value.trim();
      state.status = status;
      state.periode = "";
      state.page = 1;
      filterStatus.value = status;
      loadKontrak();
    }

    filterStatus.addEventListener("change", () => terapkanFilterStatus(filterStatus.value));
    kartuStatus.forEach(kartu => {
      kartu.addEventListener("click", () => terapkanFilterStatus(kartu.dataset.contractStatus));
    });

    // ================================================
    // RESET FILTER
    // ================================================

    resetFilter.addEventListener(
      "click",
      () => {
        clearTimeout(
          searchTimer
        );
        searchInput.value = "";
        filterJenis.value = "";
        filterStatus.value = "";

        state.search = "";
        state.jenis = "";
        state.status = "";
        state.periode = "";
        state.page = 1;

        loadKontrak();
      }
    );

    // ================================================
    // PREVIOUS PAGE
    // ================================================

    prevPage.addEventListener(
      "click",
      () => {
        if (state.page <= 1) {
          return;
        }

        state.page -= 1;

        loadKontrak();
      }
    );

    // ================================================
    // NEXT PAGE
    // ================================================

    nextPage.addEventListener(
      "click",
      () => {
        if (
          state.page >=
          state.totalPages
        ) {
          return;
        }

        state.page += 1;

        loadKontrak();
      }
    );

    // ================================================
    // INITIAL LOAD
    // ================================================

    loadKontrak();
  }
);
