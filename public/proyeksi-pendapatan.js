"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const filters = $("projectionFilters");
  const year = $("projectionYear");
  const projectType = $("projectionType");
  const search = $("projectionSearch");
  const exportButton = $("projectionExport");
  const exportStatus = $("projectionExportStatus");
  const table = $("projectionRows");
  const holdTable = $("projectionHoldRows");
  const holdButton = $("projectionHoldSelected");
  const restoreButton = $("projectionRestoreSelected");
  const holdStatus = $("projectionHoldStatus");
  const restoreStatus = $("projectionRestoreStatus");
  const detail = $("projectionDetail");
  const editor = $("projectionEditor");
  const editorForm = $("projectionEditorForm");
  const nameInput = $("projectionNameInput");
  const increaseInput = $("projectionIncreaseInput");
  const editorSave = $("projectionEditorSave");
  const editorCancel = $("projectionEditorCancel");
  const editorError = $("projectionEditorError");
  const months = [...document.querySelectorAll(".projection-table thead th")]
    .slice(4, -2).map(header => header.textContent.trim());
  const mainTable = $("projectionMainTable");
  $("projectionHoldTable").prepend(mainTable.querySelector("colgroup").cloneNode(true), mainTable.tHead.cloneNode(true));
  const rupiah = new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 2
  });
  const count = new Intl.NumberFormat("id-ID");
  const percentage = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 6 });
  const initialQuery = new URLSearchParams(window.location.search);
  const memorySettings = new Map();
  let storagePrefix;
  let activeReport;
  let activeQuery;
  let activeSettings = [];
  let reportRequest;
  let timer;
  let editingProject;
  let saving = false;
  let exporting = false;
  let movingHold = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function filterParams() {
    const params = new URLSearchParams();
    if (year.value) params.set("tahun", year.value);
    if (projectType.value) params.set("jenis_proyek", projectType.value);
    if (search.value.trim()) params.set("search", search.value.trim());
    return params;
  }

  function settingsFor(reportYear) {
    const key = String(reportYear);
    if (memorySettings.has(key)) return memorySettings.get(key);
    if (storagePrefix) {
      try {
        const rows = JSON.parse(localStorage.getItem(`${storagePrefix}:${key}`));
        if (Array.isArray(rows)) return rows;
      } catch {}
    }
    return [];
  }

  function storeSettings(reportYear, settings) {
    const key = String(reportYear);
    memorySettings.set(key, settings);
    if (storagePrefix) {
      try {
        localStorage.setItem(`${storagePrefix}:${key}`, JSON.stringify(settings));
      } catch {}
    }
  }

  function updateSettings(projectIds, changes) {
    const settings = new Map(activeSettings.map(item => [String(item.proyek_id), item]));
    for (const id of projectIds) {
      const updated = {
        proyek_id: id, nama_proyek_proyeksi: "", persentase_kenaikan: 0, hold: false,
        ...settings.get(id), ...changes
      };
      if (updated.nama_proyek_proyeksi || updated.persentase_kenaikan || updated.hold) settings.set(id, updated);
      else settings.delete(id);
    }
    return [...settings.values()];
  }

  async function request(url, { signal, penyesuaian = [] } = {}) {
    const options = { cache: "no-store", signal };
    if (penyesuaian.length) {
      options.method = "POST";
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify({ penyesuaian });
    }
    const response = await fetch(url, options);
    if (response.status === 401) window.location.replace("/login.html");
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Permintaan proyeksi pendapatan gagal.");
    }
    return response;
  }

  function selectedProjects(tbody) {
    return [...tbody.querySelectorAll("input[data-select-project]:checked")].map(input => input.value);
  }

  function syncActions() {
    const busy = movingHold || exporting || !activeReport;
    exportButton.disabled = busy || !activeReport.rows.length;
    holdButton.disabled = busy || selectedProjects(table).length === 0;
    restoreButton.disabled = busy || selectedProjects(holdTable).length === 0;
  }

  function showTableMessage(tbody, message) {
    tbody.innerHTML = `<tr><td class="projection-empty" colspan="18" role="status">${escapeHtml(message)}</td></tr>`;
  }

  function renderReport(report) {
    year.replaceChildren(...report.tahun_tersedia.map(value => new Option(String(value), String(value))));
    year.value = String(report.tahun);
    year.disabled = movingHold;

    const selectedType = projectType.value;
    const types = report.jenis_proyek_tersedia.map(type => new Option(type, type.toLocaleLowerCase("id-ID")));
    if (selectedType && !types.some(option => option.value === selectedType)) {
      types.push(new Option(selectedType, selectedType));
    }
    projectType.replaceChildren(new Option("Semua Jenis Proyek", ""), ...types);
    projectType.value = selectedType;
    projectType.disabled = movingHold;

    $("projectionTotal").textContent = rupiah.format(report.ringkasan.total);
    $("projectionCount").textContent = count.format(report.ringkasan.jumlah_proyek);
    $("projectionPeriod").textContent = report.ringkasan.periode;
    renderRows(table, report.rows, report.tahun, "Tidak ada proyeksi yang sesuai dengan filter.");
    renderRows(holdTable, report.hold_rows, report.tahun, "Tidak ada proyek Hold yang sesuai dengan filter.");
  }

  function renderRows(tbody, rows, reportYear, emptyMessage) {
    const grid = tbody.closest("table");
    if (rows.length === 0) {
      grid.style.removeProperty("--projection-amount-content");
      showTableMessage(tbody, emptyMessage);
      return;
    }

    tbody.innerHTML = rows.map((project, index) => {
      const projectedName = escapeHtml(project.nama_proyek_proyeksi);
      const detailLink = project.proyek_id
        ? `<a class="btn-detail" href="/detail-proyek.html?id=${encodeURIComponent(project.proyek_id)}" aria-label="Detail proyek asal untuk ${projectedName}">Detail</a>`
        : "";
      const cells = project.bulan.map((cell, month) => {
        if (!cell) return '<td class="projection-dash">—</td>';
        const names = [...new Set(cell.termin.map(termin => termin.nama).filter(Boolean))].join(" · ");
        const nominal = rupiah.format(cell.nominal);
        const accessibleName = escapeHtml(`${project.nama_proyek_proyeksi}, ${months[month]} ${reportYear}, ${nominal}`);
        return `<td><button type="button" class="projection-month" data-project="${index}" data-month="${month}"
          aria-haspopup="dialog" aria-controls="projectionDetail" aria-label="${accessibleName}">
          <strong class="projection-amount">${nominal}</strong>${names ? `<small title="${escapeHtml(names)}">${escapeHtml(names)}</small>` : ""}
        </button></td>`;
      }).join("");
      return `<tr><td class="projection-check-cell">
          <input type="checkbox" data-select-project value="${escapeHtml(project.proyek_id)}" aria-label="Pilih ${projectedName}">
        </td>
        <th scope="row" class="projection-projected-cell"><span class="projection-projected-name" title="${projectedName}">${projectedName}</span></th>
        <td>${escapeHtml(project.jenis_proyek)}</td>
        <td>${percentage.format(project.persentase_kenaikan)}%</td>
        ${cells}<td><span class="projection-amount">${rupiah.format(project.total)}</span></td>
        <td><div class="table-actions">
          <button type="button" class="btn-edit-projection" data-edit-project="${index}" aria-label="Edit proyeksi ${projectedName}">Edit</button>
          ${detailLink}
        </div></td></tr>`;
    }).join("");

    let widest = 0;
    for (const amount of tbody.querySelectorAll(".projection-amount")) {
      widest = Math.max(widest, amount.getBoundingClientRect().width);
    }
    grid.style.setProperty("--projection-amount-content", `${Math.ceil(widest)}px`);
  }

  function setReport(report, params, settings) {
    if (detail.open) detail.close();
    renderReport(report);
    params.set("tahun", report.tahun);
    activeQuery = params;
    activeReport = report;
    activeSettings = settings;
    syncActions();
  }

  async function loadReport() {
    const params = filterParams();
    const requestId = new AbortController();
    reportRequest = requestId;
    try {
      let settings = settingsFor(params.get("tahun"));
      const getReport = async () => (await request(`/api/proyeksi-pendapatan?${params}`, {
        signal: requestId.signal, penyesuaian: settings
      })).json();
      let report = await getReport();
      if (requestId.signal.aborted) return;
      if (!storagePrefix && report.pengguna_id) {
        storagePrefix = `bisboard:proyeksi-pendapatan:${report.pengguna_id}`;
        settings = settingsFor(report.tahun);
        if (settings.length) {
          params.set("tahun", report.tahun);
          report = await getReport();
        }
      }
      if (!requestId.signal.aborted) setReport(report, params, settings);
    } catch (error) {
      if (!requestId.signal.aborted) {
        showTableMessage(table, error.message);
        showTableMessage(holdTable, "Proyek Hold belum dapat dimuat.");
      }
    }
  }

  function updateFilters(delay = 0) {
    if (movingHold) return;
    clearTimeout(timer);
    reportRequest?.abort();
    activeReport = null;
    if (detail.open) detail.close();
    exportStatus.hidden = true;
    holdStatus.hidden = true;
    restoreStatus.hidden = true;
    for (const id of ["projectionTotal", "projectionCount", "projectionPeriod"]) $(id).textContent = "—";
    syncActions();
    showTableMessage(table, "Memuat data proyeksi…");
    showTableMessage(holdTable, "Memuat proyek Hold…");
    if (delay) timer = setTimeout(loadReport, delay);
    else loadReport();
  }

  function tampilkanPerkiraan() {
    const persen = Number(increaseInput.value || 0);
    const hasil = editingProject.total_awal * (1 + persen / 100);
    $("projectionEditorResult").value = increaseInput.validity.valid && Number.isFinite(hasil)
      ? rupiah.format(hasil)
      : "—";
  }

  function bukaEditor(project) {
    editingProject = project;
    nameInput.placeholder = project.nama_proyek;
    nameInput.value = project.nama_proyek_proyeksi;
    increaseInput.value = String(project.persentase_kenaikan);
    editorError.hidden = true;
    $("projectionEditorContext").textContent = `${project.nama_proyek} · ${activeReport.tahun}`;
    $("projectionEditorBase").textContent = rupiah.format(project.total_awal);
    tampilkanPerkiraan();
    editor.showModal();
  }

  function clickRow(event, rows) {
    if (!rows || movingHold) return;
    const edit = event.target.closest("[data-edit-project]");
    if (edit) {
      const project = rows[Number(edit.dataset.editProject)];
      if (project) bukaEditor(project);
      return;
    }
    const button = event.target.closest(".projection-month");
    if (!button) return;
    const index = Number(button.dataset.month);
    const project = rows[Number(button.dataset.project)];
    const month = project?.bulan[index];
    if (!month) return;

    $("projectionDetailContext").textContent = `${project.nama_proyek_proyeksi} · ${months[index]} ${activeReport.tahun}`;
    $("projectionDetailTotal").textContent = rupiah.format(month.nominal);
    $("projectionDetailRows").innerHTML = month.termin.map(termin => `
      <tr><td>${escapeHtml(termin.tanggal.split("-").reverse().join("/"))}</td>
        <td>${escapeHtml(termin.nama || "—")}</td><td>${rupiah.format(termin.nominal_awal)}</td>
        <td>${rupiah.format(termin.nominal)}</td></tr>`).join("");
    if (!detail.open) {
      button.focus({ preventScroll: true });
      detail.showModal();
    }
  }

  table.addEventListener("click", event => clickRow(event, activeReport?.rows));
  holdTable.addEventListener("click", event => clickRow(event, activeReport?.hold_rows));
  table.addEventListener("change", syncActions);
  holdTable.addEventListener("change", syncActions);

  async function applySettings(settings) {
    const params = activeQuery;
    const response = await request(`/api/proyeksi-pendapatan?${params}`, { penyesuaian: settings });
    const report = await response.json();
    storeSettings(report.tahun, settings);
    setReport(report, params, settings);
  }

  async function moveProjects(tbody, hold, status) {
    if (!activeReport || movingHold || exporting) return;
    const projects = selectedProjects(tbody);
    if (projects.length === 0) return;

    const settings = updateSettings(projects, { hold });
    movingHold = true;
    year.disabled = true;
    projectType.disabled = true;
    search.disabled = true;
    holdStatus.hidden = true;
    restoreStatus.hidden = true;
    status.classList.remove("is-error");
    status.textContent = "Memindahkan proyek…";
    status.hidden = false;
    syncActions();
    try {
      await applySettings(settings);
      status.textContent = hold
        ? `${projects.length} proyek dipindahkan ke Hold.`
        : `${projects.length} proyek dikembalikan ke proyeksi.`;
    } catch (error) {
      status.classList.add("is-error");
      status.textContent = error.message;
    } finally {
      movingHold = false;
      year.disabled = false;
      projectType.disabled = false;
      search.disabled = false;
      syncActions();
    }
  }

  holdButton.addEventListener("click", () => moveProjects(table, true, holdStatus));
  restoreButton.addEventListener("click", () => moveProjects(holdTable, false, restoreStatus));

  increaseInput.addEventListener("input", tampilkanPerkiraan);
  editorCancel.addEventListener("click", () => editor.close());
  editor.addEventListener("cancel", event => { if (saving) event.preventDefault(); });
  editorForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving || !editingProject || !activeReport || !editorForm.reportValidity()) return;

    const projectId = String(editingProject.proyek_id);
    const nama = nameInput.value.trim();
    const alias = nama === editingProject.nama_proyek ? "" : nama;
    const persen = Number(increaseInput.value || 0);
    const settings = updateSettings([projectId], { nama_proyek_proyeksi: alias, persentase_kenaikan: persen });

    saving = true;
    for (const control of [editorSave, editorCancel, nameInput, increaseInput]) control.disabled = true;
    editorError.hidden = true;
    try {
      await applySettings(settings);
      editor.close();
      search.focus();
    } catch (error) {
      editorError.textContent = error.message;
      editorError.hidden = false;
    } finally {
      saving = false;
      for (const control of [editorSave, editorCancel, nameInput, increaseInput]) control.disabled = false;
    }
  });

  exportButton.addEventListener("click", async () => {
    if (exporting || movingHold || !activeReport?.rows.length) return;
    const filename = `proyeksi-pendapatan-${activeReport.tahun}.xlsx`;
    const params = activeQuery;
    exporting = true;
    syncActions();
    exportStatus.hidden = true;
    exportButton.textContent = "Menyiapkan Excel…";
    try {
      const response = await request(`/api/proyeksi-pendapatan/export?${params}`, { penyesuaian: activeSettings });
      if (!response.headers.get("Content-Type")?.includes("spreadsheetml.sheet")) {
        throw new Error("File Excel belum tersedia.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      exportStatus.textContent = error.message;
      exportStatus.hidden = false;
    } finally {
      exporting = false;
      exportButton.textContent = "Ekspor Excel";
      syncActions();
    }
  });

  filters.addEventListener("submit", event => {
    event.preventDefault();
    updateFilters();
  });
  year.addEventListener("change", () => updateFilters());
  projectType.addEventListener("change", () => updateFilters());
  search.addEventListener("input", () => updateFilters(200));

  const initialYear = initialQuery.get("tahun");
  if (/^[1-9]\d{3}$/.test(initialYear || "")) year.add(new Option(initialYear, initialYear, true, true));
  const initialType = initialQuery.get("jenis_proyek")?.trim();
  if (initialType) projectType.add(new Option(initialType, initialType.toLocaleLowerCase("id-ID"), true, true));
  search.value = (initialQuery.get("search") || "").slice(0, 150);
  updateFilters();
})();
