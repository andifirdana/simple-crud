/* global timelineDisplayedData, loadTimelinePage, resetTimelineFilters */
"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const template = $("timelineDownloadTemplate");
  const download = $("timelineDownloadData");
  const openUpload = $("timelineUploadButton");
  const uploadModal = $("timelineUploadModal");
  const uploadForm = $("timelineUploadForm");
  const uploadFile = $("timelineUploadFile");
  const uploadError = $("timelineUploadError");
  const uploadCancel = $("timelineUploadCancel");
  const uploadSubmit = $("timelineUploadSubmit");
  const editModal = $("timelineEditModal");
  const editForm = $("timelineEditForm");
  const projectInput = $("timelineAssignProject");
  const projectOptions = $("timelineProjectOptions");
  const jenisInput = $("timelineEditJenis");
  const description = $("timelineEditDeskripsi");
  const startInput = $("timelineEditMulai");
  const endInput = $("timelineEditAkhir");
  const statusInput = $("timelineEditStatus");
  const editError = $("timelineEditError");
  const editCancel = $("timelineEditCancel");
  const editSubmit = $("timelineEditSubmit");
  const feedback = $("timelineFeedbackModal");
  let busy = false;
  let projects = [];
  let editedItem = null;
  let editRequest = 0;

  if (!template || !download || !openUpload) return;

  function message(title, text) {
    $("timelineFeedbackTitle").textContent = title;
    $("timelineFeedbackMessage").textContent = text;
    if (!feedback.open) feedback.showModal();
  }

  function setBusy(value) {
    busy = value;
    for (const button of [template, download, openUpload]) button.disabled = value;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options });
    if (response.status === 401) {
      throw new Error("Sesi berakhir. Silakan login kembali.");
    }
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || `Permintaan gagal (${response.status}).`);
    }
    return response;
  }

  async function downloadExcel(url, filename) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await request(url);
      if (!(response.headers.get("content-type") || "").includes("spreadsheetml.sheet")) {
        throw new Error("Server belum mengembalikan file Excel yang valid.");
      }
      const fileUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    } catch (error) { message("Unduhan gagal", error.message); }
    finally { setBusy(false); }
  }

  template.addEventListener("click", () => downloadExcel("/api/timeline/template", "template-timeline.xlsx"));
  download.addEventListener("click", () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("page");
    params.delete("limit");
    downloadExcel(`/api/timeline/export?${params}`, "data-timeline.xlsx");
  });

  openUpload.addEventListener("click", () => {
    if (busy) return;
    uploadForm.reset();
    uploadError.hidden = true;
    uploadModal.showModal();
  });
  uploadCancel.addEventListener("click", () => { if (!busy) uploadModal.close(); });
  uploadModal.addEventListener("cancel", event => { if (busy) event.preventDefault(); });

  uploadForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || !uploadForm.reportValidity()) return;
    const file = uploadFile.files[0];
    if (!file || !/\.xlsx$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      uploadError.textContent = "Pilih satu file .xlsx maksimal 10 MB.";
      uploadError.hidden = false;
      return;
    }
    uploadError.hidden = true;
    setBusy(true);
    uploadFile.disabled = uploadCancel.disabled = uploadSubmit.disabled = true;
    uploadSubmit.textContent = "Mengupload…";
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await request("/api/timeline/import", { method: "POST", body });
      const result = await response.json();
      if (!Number.isInteger(result.imported) || !Number.isInteger(result.skipped) || !Number.isInteger(result.unassigned)) {
        throw new Error("Hasil upload belum dapat dipastikan. Muat ulang halaman sebelum mencoba kembali.");
      }
      uploadModal.close();
      await resetTimelineFilters({ unassigned: result.unassigned > 0 });
      message("Upload selesai", `${result.imported} data berhasil ditambahkan.\n${result.unassigned} data belum di-assign.\n${result.skipped} baris yang sama dilewati.`);
    } catch (error) {
      uploadError.textContent = error.message;
      uploadError.hidden = false;
    } finally {
      setBusy(false);
      uploadFile.disabled = uploadCancel.disabled = uploadSubmit.disabled = false;
      uploadSubmit.textContent = "Upload";
    }
  });

  const projectLabel = project => `${project.nama_proyek} (#${project.id})`;
  const selectedProject = () => projects.find(project => projectLabel(project) === projectInput.value.trim());
  function updateJenis() {
    const project = selectedProject();
    jenisInput.readOnly = Boolean(project);
    if (project) jenisInput.value = project.jenis_proyek || "";
  }
  projectInput.addEventListener("input", updateJenis);
  editCancel.addEventListener("click", () => { if (!busy) editModal.close(); });
  editModal.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  editModal.addEventListener("close", () => { editRequest++; editedItem = null; });

  $("timelineGroupedContainer").addEventListener("click", async event => {
    const button = event.target.closest("[data-edit-timeline]");
    if (!button || busy) return;
    const item = timelineDisplayedData.find(row => row.timeline_key === button.dataset.editTimeline);
    if (!item?.dapat_diubah || item.sumber_timeline === "Sewa") return;
    const requestId = ++editRequest;
    editedItem = { ...item };
    projects = [];
    projectOptions.replaceChildren();
    editError.hidden = true;
    projectInput.value = "";
    jenisInput.value = item.jenis_proyek || "";
    jenisInput.readOnly = false;
    description.value = item.deskripsi || "";
    startInput.value = String(item.tanggal_mulai || "").slice(0, 10);
    endInput.value = String(item.tanggal_akhir || "").slice(0, 10);
    statusInput.value = item.status || "Aktif";
    projectInput.disabled = editSubmit.disabled = true;
    editModal.showModal();
    try {
      const response = await request("/api/timeline/projects");
      const result = await response.json();
      if (requestId !== editRequest || !editModal.open) return;
      if (!Array.isArray(result)) throw new Error("Pilihan proyek tidak valid.");
      projects = result;
      projects.forEach(project => projectOptions.appendChild(new Option(projectLabel(project), projectLabel(project))));
      const project = projects.find(row => String(row.id) === String(item.proyek_id));
      if (item.proyek_id != null && !project) throw new Error("Akses proyek telah berubah. Muat ulang halaman sebelum mengedit.");
      projectInput.value = project ? projectLabel(project) : "";
      updateJenis();
      projectInput.disabled = editSubmit.disabled = false;
      projectInput.focus();
    } catch (error) {
      if (requestId !== editRequest) return;
      editError.textContent = error.message;
      editError.hidden = false;
    }
  });

  editForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy || editSubmit.disabled || !editedItem || !editForm.reportValidity()) return;
    const project = selectedProject();
    if (projectInput.value.trim() && !project) {
      editError.textContent = "Pilih proyek dari daftar, atau kosongkan kolom Proyek.";
      editError.hidden = false;
      projectInput.focus();
      return;
    }
    if (endInput.value < startInput.value) {
      editError.textContent = "Tanggal akhir tidak boleh sebelum tanggal mulai.";
      editError.hidden = false;
      return;
    }
    const item = editedItem;
    const fields = [...editForm.elements];
    const disabled = fields.map(field => field.disabled);
    fields.forEach(field => { field.disabled = true; });
    setBusy(true);
    editError.hidden = true;
    editSubmit.textContent = "Menyimpan…";
    try {
      await request(`/api/timeline/${encodeURIComponent(item.id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proyek_id: project ? project.id : null, jenis_proyek: jenisInput.value,
          deskripsi: description.value, tanggal_mulai: startInput.value,
          tanggal_akhir: endInput.value, status: statusInput.value, versi: item.versi
        })
      });
      editModal.close();
      await loadTimelinePage();
      message("Berhasil", "Timeline dan assignment proyek berhasil disimpan.");
    } catch (error) {
      editError.textContent = error.message;
      editError.hidden = false;
    } finally {
      setBusy(false);
      fields.forEach((field, index) => { field.disabled = disabled[index]; });
      editSubmit.textContent = "Simpan";
    }
  });
})();
