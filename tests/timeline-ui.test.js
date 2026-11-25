"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { runExcel } = require("../timeline-excel");

const flush = () => new Promise(setImmediate);

function ui() {
  const elements = {};
  const downloads = [], calls = [];
  let failSave = false;
  let row = { id: 1, timeline_key: "proyek-1", sumber_timeline: "Proyek", dapat_diubah: true,
    versi: "0", proyek_id: null, nama_proyek: "Belum di-assign", jenis_proyek: "Lisensi",
    deskripsi: "Lisensi router", tanggal_mulai: "2026-01-01", tanggal_akhir: "2026-12-31", status: "Aktif" };

  class Element {
    constructor(id = "") { Object.assign(this, { id, value: "", textContent: "", innerHTML: "", children: [],
      listeners: {}, style: {}, hidden: false, disabled: false, open: false, checked: false, files: [], elements: [] });
      this.parentElement = { insertBefore(child) { elements[child.id] = child; } };
    }
    get options() { return this.children; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    async emit(type, event = {}) { for (const fn of this.listeners[type] || []) await fn({ target: this, preventDefault() {}, ...event }); }
    add(child) { this.children.push(child); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    showModal() { this.open = true; }
    close() { this.open = false; void this.emit("close"); }
    focus() { this.focused = true; }
    remove() { delete elements[this.id]; }
    reset() { this.elements.forEach(field => { field.value = ""; }); }
    reportValidity() { return true; }
    click() { if (this.download) downloads.push(this.download); else void this.emit("click"); }
  }
  const html = fs.readFileSync(path.join(__dirname, "../public/timeline.html"), "utf8");
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) elements[id] = new Element(id);
  const formFields = ["timelineAssignProject", "timelineEditJenis", "timelineEditDeskripsi", "timelineEditMulai",
    "timelineEditAkhir", "timelineEditStatus", "timelineEditCancel", "timelineEditSubmit"];
  elements.timelineEditForm.elements = formFields.map(id => elements[id]);
  elements.timelineUploadForm.elements = [elements.timelineUploadFile];
  const win = { location: { pathname: "/timeline.html", search: "" }, history: {
    replaceState(a, b, value) { win.location.search = new URL(value, "https://example.test").search; }
  }, scrollTo() {} };
  const Url = class extends URL {};
  Url.createObjectURL = () => "blob:test";
  Url.revokeObjectURL = () => {};
  const context = {
    document: { getElementById: id => elements[id] || null, createElement: () => new Element(), body: new Element() },
    window: win, URL: Url, URLSearchParams, Intl, Date, console,
    Option: function (text, value) { this.textContent = text; this.value = value; },
    FormData: class { append(key, value) { this[key] = value; } },
    setTimeout(fn, delay) { if (delay === 1000) return 0; return setTimeout(fn, delay); }, clearTimeout,
    fetch: async (url, options = {}) => {
      calls.push({ url, options });
      let body, ok = true, status = 200, type = "application/json";
      if (url === "/api/proyek/jenis") body = [{ name: "Lisensi" }, { name: "Pengadaan" }];
      else if (url === "/api/timeline/projects") body = [{ id: 10, nama_proyek: "Proyek A", jenis_proyek: "Pengadaan" }];
      else if (url === "/api/timeline/import") body = { imported: 1, unassigned: 1, skipped: 0 };
      else if (url === "/api/timeline/1") {
        if (failSave) { ok = false; status = 409; body = { error: "Timeline telah berubah." }; }
        else {
          const payload = JSON.parse(options.body);
          row = { ...row, ...payload, versi: "1", nama_proyek: "Proyek A" };
          body = { id: 1, versi: "1" };
        }
      } else if (url.startsWith("/api/timeline/template") || url.startsWith("/api/timeline/export")) {
        type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else if (url.startsWith("/api/timeline?")) {
        body = { data: [row], pagination: { page: 1, limit: 25, total_data: 1, total_pages: 1 } };
      } else throw new Error(`Unexpected request ${url}`);
      return { ok, status, headers: { get: () => type }, json: async () => body, blob: async () => Buffer.from("PK-test") };
    }
  };
  vm.createContext(context);
  for (const file of ["timeline.js", "timeline-tools.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../public", file), "utf8"), context);
  }
  async function openEdit() {
    await elements.timelineGroupedContainer.emit("click", {
      target: { closest: () => ({ dataset: { editTimeline: "proyek-1" } }) }
    });
  }
  return { elements, calls, downloads, win, context, openEdit, fail() { failSave = true; } };
}

test("template and export downloads are real file actions and preserve filters", async () => {
  const f = ui();
  await flush();
  await f.elements.timelineDownloadTemplate.emit("click");
  assert.deepEqual(f.downloads, ["template-timeline.xlsx"]);
  f.elements.filterJenisProyek.value = "Lisensi";
  await f.elements.filterJenisProyek.emit("change");
  await flush();
  await f.elements.timelineDownloadData.emit("click");
  await flush();
  assert.ok(f.downloads.includes("data-timeline.xlsx"));
  const request = f.calls.find(call => call.url.startsWith("/api/timeline/export"));
  assert.equal(new URL(request.url, "https://example.test").searchParams.get("jenis_proyek"), "Lisensi");
});

test("upload rejects wrong file then opens unassigned results after success", async () => {
  const f = ui();
  await flush();
  await f.elements.timelineUploadButton.emit("click");
  assert.equal(f.elements.timelineUploadModal.open, true);
  f.elements.timelineUploadFile.files = [{ name: "bad.csv", size: 10 }];
  await f.elements.timelineUploadForm.emit("submit");
  assert.equal(f.elements.timelineUploadError.hidden, false);
  assert.ok(!f.calls.some(call => call.url === "/api/timeline/import"));
  f.elements.timelineUploadFile.files = [{ name: "template.xlsx", size: 1024 }];
  await f.elements.timelineUploadForm.emit("submit");
  assert.equal(f.elements.timelineUploadModal.open, false);
  assert.equal(f.elements.timelineUnassignedOnly.checked, true);
  assert.match(f.win.location.search, /unassigned=1/);
  assert.equal(f.elements.timelineFeedbackModal.open, true);
  assert.match(f.elements.timelineFeedbackMessage.textContent, /1 data berhasil ditambahkan/);
});

test("uploaded rows remain visible and can be assigned through searchable choices", async () => {
  const f = ui();
  await flush();
  assert.match(f.elements.timelineGroupedContainer.innerHTML, /Belum di-assign/);
  assert.match(f.elements.timelineGroupedContainer.innerHTML, /Edit \/ Assign/);
  await f.openEdit();
  assert.equal(f.elements.timelineEditModal.open, true);
  assert.equal(f.elements.timelineEditSubmit.disabled, false);
  f.elements.timelineAssignProject.value = "Proyek A (#10)";
  await f.elements.timelineAssignProject.emit("input");
  assert.equal(f.elements.timelineEditJenis.value, "Pengadaan");
  assert.equal(f.elements.timelineEditJenis.readOnly, true);
  await f.elements.timelineEditForm.emit("submit");
  const saved = f.calls.find(call => call.url === "/api/timeline/1");
  assert.equal(JSON.parse(saved.options.body).proyek_id, 10);
  assert.equal(JSON.parse(saved.options.body).versi, "0");
  assert.equal(f.elements.timelineEditModal.open, false);
  assert.match(f.elements.timelineGroupedContainer.innerHTML, /Proyek A/);
});

test("unknown project and stale edit keep form contents without false success", async () => {
  const f = ui();
  await flush();
  await f.openEdit();
  f.elements.timelineAssignProject.value = "Nama tidak ada";
  await f.elements.timelineEditForm.emit("submit");
  assert.ok(!f.calls.some(call => call.url === "/api/timeline/1"));
  f.elements.timelineAssignProject.value = "Proyek A (#10)";
  f.elements.timelineEditDeskripsi.value = "Jangan hilangkan isian";
  f.fail();
  await f.elements.timelineEditForm.emit("submit");
  assert.equal(f.elements.timelineEditModal.open, true);
  assert.equal(f.elements.timelineEditDeskripsi.value, "Jangan hilangkan isian");
  assert.equal(f.elements.timelineEditError.textContent, "Timeline telah berubah.");
  assert.equal(f.elements.timelineEditSubmit.disabled, false);
  assert.equal(f.elements.timelineFeedbackModal.open, false);
});

test("Node/Python bridge produces and reads actual XLSX bytes", async () => {
  const file = await runExcel("export", { rows: [{ deskripsi: "Uji integrasi", tanggal_mulai: "2026-01-01", tanggal_akhir: "2026-12-31" }] });
  assert.equal(file.subarray(0, 2).toString(), "PK");
  const records = await runExcel("import", file);
  assert.equal(records[0].deskripsi, "Uji integrasi");
  assert.equal(records[0].tanggal_akhir, "2026-12-31");
  await assert.rejects(runExcel("import", Buffer.from("not an xlsx")), /File Excel/);
});
