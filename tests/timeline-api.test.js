"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const register = require("../timeline-api");
const { listTimeline, TIMELINE_SQL } = require("../timeline-data");
const { Readable } = require("node:stream");

test("listing stays available on databases without the timeline upload columns", async () => {
  const calls = [];
  const query = { search: "Router", jenis_proyek: "Sewa", page: "2", limit: "10" };
  const db = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) {
        throw Object.assign(new Error("column timeline.timeline_version does not exist"), { code: "42703" });
      }
      return { rows: [{ id: 11, dapat_diubah: false, versi: null, total_data: 11 }] };
    }
  };

  const result = await listTimeline(db, query, { isAdmin: false, id: 2 });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].params, calls[0].params);
  assert.doesNotMatch(calls[1].sql, /timeline_version|imported_by|jenis_proyek_upload/);
  assert.match(calls[1].sql, /FROM public.proyek_pic akses_pic/);
  assert.match(calls[1].sql, /FALSE\s+AS dapat_diubah/);
  assert.deepEqual(result.data, [{ id: 11, dapat_diubah: false, versi: null }]);
  assert.equal(result.capabilities.upload, false);
  assert.equal(result.pagination.total_pages, 2);
});

test("listing does not hide unrelated database errors behind the legacy fallback", async () => {
  let calls = 0;
  const failure = Object.assign(new Error("column timeline.tanggal_akhir does not exist"), { code: "42703" });
  const db = { async query() { calls++; throw failure; } };

  await assert.rejects(() => listTimeline(db, {}, { isAdmin: false, id: 2 }), failure);
  assert.equal(calls, 1);
});

const uploadRow = changes => ({
  baris: 2, deskripsi: "Lisensi router", tanggal_mulai: "2026-01-01",
  tanggal_akhir: "2026-12-31", status: "Aktif", jenis_proyek: "Lisensi", ...changes
});

function fixture({ rows = [], uploadRows = [uploadRow()], failLog = false, total = null } = {}) {
  const routes = new Map();
  const projects = [
    { id: 10, nama_proyek: "Proyek A", jenis_proyek: "Pengadaan", members: [2] },
    { id: 20, nama_proyek: "Proyek B", jenis_proyek: "Sewa", members: [3] }
  ];
  let committed = structuredClone(rows);
  let pending;
  const queries = [], excelCalls = [];
  let released = 0;
  async function query(sql, params = []) {
    queries.push({ sql, params });
    if (sql === "BEGIN") { pending = structuredClone(committed); return { rows: [] }; }
    if (sql === "COMMIT") { committed = pending; pending = undefined; return { rows: [] }; }
    if (sql === "ROLLBACK") { pending = undefined; return { rows: [] }; }
    if (sql.includes("WITH tanggal_acuan")) {
      return { rows: [{ id: 1, timeline_key: "proyek-1", proyek_id: 10, nama_proyek: "Proyek A", total_data: total ?? 1 }] };
    }
    if (sql.includes("FROM public.proyek p")) {
      return { rows: projects.filter(p => params[0] || p.members.includes(params[1])).map(({ members, ...p }) => p) };
    }
    if (sql.includes("FROM public.proyek_timeline t")) {
      const row = (pending || committed).find(row => Number(row.id) === params[0]);
      const allowed = row && (params[1] || (row.proyek_id == null && row.imported_by === params[2]) ||
        projects.some(p => p.id === row.proyek_id && p.members.includes(params[2])));
      return { rows: allowed ? [{ ...row, versi: String(row.timeline_version || 0) }] : [] };
    }
    if (sql.includes("INSERT INTO public.proyek_timeline")) {
      if (pending.some(row => row.import_fingerprint === params[7])) return { rows: [] };
      const id = pending.length + 1;
      pending.push({ id, proyek_id: params[0], deskripsi: params[1], tanggal_mulai: params[2], tanggal_akhir: params[3],
        status: params[4], jenis_proyek_upload: params[5], imported_by: params[6], import_fingerprint: params[7], timeline_version: 0 });
      return { rows: [{ id }] };
    }
    if (sql.includes("UPDATE public.proyek_timeline SET")) {
      const row = pending.find(row => row.id === params[0]);
      Object.assign(row, { proyek_id: params[1], deskripsi: params[2], tanggal_mulai: params[3], tanggal_akhir: params[4],
        status: params[5], jenis_proyek_upload: params[6], timeline_version: (row.timeline_version || 0) + 1 });
      return { rows: [{ id: row.id, versi: String(row.timeline_version) }] };
    }
    if (sql.includes("INSERT INTO public.activity_log")) {
      if (failLog) throw new Error("Simulasi log gagal");
      return { rows: [] };
    }
    throw new Error(`Query uji belum ditangani: ${sql}`);
  }
  const pool = { query, async connect() { return { query, release() { released++; } }; } };
  const app = Object.fromEntries(["get", "post", "put"].map(method => [method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers)]));
  register(app, pool, { async runExcel(mode, input) {
    excelCalls.push({ mode, input });
    return mode === "import" ? uploadRows : Buffer.from("PK-test-xlsx");
  } });
  async function request(method, path, overrides = {}) {
    let finish;
    const completed = new Promise(resolve => { finish = resolve; });
    const { rawRequest, ...requestOverrides } = overrides;
    const req = Object.assign(rawRequest || {}, { session: { user: { id: 2, nama: "PIC Uji", role: "PIC" } }, query: {}, params: {}, body: {}, headers: {},
      file: { originalname: "template.xlsx", buffer: Buffer.from("PK-test") } }, requestOverrides);
    const res = { code: 200, headers: {}, status(code) { this.code = code; return this; },
      setHeader(name, value) { this.headers[name] = value; }, json(body) { this.body = body; finish(); return this; },
      send(body) { this.body = body; finish(); return this; } };
    const handlers = routes.get(`${method} ${path}`);
    assert.ok(handlers, path);
    let index = 0;
    async function next() { const handler = handlers[index++]; if (handler) return handler(req, res, next); }
    await next();
    await completed;
    return res;
  }
  return { request, queries, excelCalls, pool, get rows() { return committed; }, get released() { return released; } };
}

test("all routes require login before file parsing or queries", async () => {
  const f = fixture();
  for (const [method, path] of [["get", "/api/timeline"], ["get", "/api/timeline/projects"],
    ["get", "/api/timeline/template"], ["get", "/api/timeline/export"],
    ["post", "/api/timeline/import"], ["put", "/api/timeline/:id"]]) {
    assert.equal((await f.request(method, path, { session: {} })).code, 401);
  }
  assert.equal(f.queries.length, 0);
  assert.equal(f.excelCalls.length, 0);
});

test("unassigned imports are persisted with owner and duplicate rows are skipped", async () => {
  const f = fixture({ uploadRows: [uploadRow(), uploadRow()] });
  let response = await f.request("post", "/api/timeline/import");
  assert.equal(response.code, 201);
  assert.deepEqual(response.body, { imported: 1, unassigned: 1, skipped: 1 });
  assert.equal(f.rows[0].proyek_id, null);
  assert.equal(f.rows[0].imported_by, 2);
  response = await f.request("post", "/api/timeline/import");
  assert.equal(response.body.imported, 0);
  assert.equal(f.rows.length, 1);
});

test("assignment during import uses accessible ID or exact project name", async () => {
  for (const row of [uploadRow({ proyek_id: "10" }), uploadRow({ nama_proyek: "Proyek A" })]) {
    const f = fixture({ uploadRows: [row] });
    const response = await f.request("post", "/api/timeline/import");
    assert.equal(response.code, 201);
    assert.equal(f.rows[0].proyek_id, 10);
    assert.equal(f.rows[0].jenis_proyek_upload, "Pengadaan");
  }
});

test("multipart upload is parsed in memory and oversized files are rejected before Excel processing", async () => {
  for (const size of [32, 10 * 1024 * 1024 + 1]) {
    const boundary = "TimelineExcelTestBoundary";
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="template.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`),
      Buffer.alloc(size), Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const f = fixture();
    const response = await f.request("post", "/api/timeline/import", {
      rawRequest: Readable.from([body]), file: undefined,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(body.length) }
    });
    if (size === 32) {
      assert.equal(response.code, 201);
      assert.equal(f.excelCalls[0].input.length, 32);
    } else {
      assert.equal(response.code, 400);
      assert.equal(f.excelCalls.length, 0);
      assert.equal(f.rows.length, 0);
    }
  }
});

test("invalid rows cause atomic rejection before inserts", async () => {
  for (const invalid of [
    { proyek_id: "20" }, { proyek_id: true }, { proyek_id: [10] }, { proyek_id: "10", nama_proyek: "Proyek B" },
    { tanggal_mulai: "2026-02-30" }, { tanggal_akhir: "2025-01-01" },
    { status: "Unknown" }, { id_timeline: "proyek-9" }, { sumber_timeline: "Sewa" }
  ]) {
    const f = fixture({ uploadRows: [uploadRow(), uploadRow({ baris: 3, ...invalid })] });
    const response = await f.request("post", "/api/timeline/import");
    assert.equal(response.code, 400, JSON.stringify(invalid));
    assert.match(response.body.error, /Baris 3:/);
    assert.equal(f.rows.length, 0);
    assert.ok(f.queries.some(q => q.sql === "ROLLBACK"));
    assert.ok(!f.queries.some(q => q.sql.includes("INSERT INTO public.proyek_timeline")));
    assert.equal(f.released, 1);
  }
});

test("template is a real XLSX attachment with only accessible project choices", async () => {
  const f = fixture();
  const response = await f.request("get", "/api/timeline/template");
  assert.equal(response.code, 200);
  assert.match(response.headers["Content-Type"], /spreadsheetml.sheet/);
  assert.match(response.headers["Content-Disposition"], /template-timeline.xlsx/);
  assert.deepEqual(f.excelCalls[0].input.projects.map(p => p.id), [10]);
  assert.equal(f.excelCalls[0].input.rows.length, 0);
});

test("export includes all filtered rows rather than current page", async () => {
  const f = fixture();
  const response = await f.request("get", "/api/timeline/export", {
    query: { page: "5", limit: "25", jenis_proyek: "Sewa", bulan: "3", unassigned: "1" }
  });
  assert.equal(response.code, 200);
  const query = f.queries.find(q => q.sql.includes("WITH tanggal_acuan"));
  assert.deepEqual(query.params.slice(1), [3, 10001, 0, "", false, false, 2, "Sewa", true]);
  assert.equal(f.excelCalls[0].input.rows[0].id_timeline, "proyek-1");
  const large = fixture({ total: 10001 });
  assert.equal((await large.request("get", "/api/timeline/export")).code, 422);
  assert.equal(large.excelCalls.length, 0);
});

const unassigned = { id: 1, proyek_id: null, imported_by: 2, timeline_version: 0, deskripsi: "Lama" };
const editBody = { deskripsi: "Baru", tanggal_mulai: "2026-01-01", tanggal_akhir: "2026-12-31", status: "Selesai", proyek_id: 10, versi: "0" };

test("owner can edit and assign an uploaded timeline", async () => {
  const f = fixture({ rows: [unassigned] });
  const response = await f.request("put", "/api/timeline/:id", { params: { id: "1" }, body: editBody });
  assert.equal(response.code, 200);
  assert.equal(f.rows[0].proyek_id, 10);
  assert.equal(f.rows[0].deskripsi, "Baru");
  assert.equal(f.rows[0].status, "Selesai");
  assert.equal(response.body.versi, "1");
});

test("other users cannot see/edit unassigned records; forbidden target and stale edits are rejected", async () => {
  for (const [rows, body, session, expected] of [
    [[unassigned], editBody, { user: { id: 3, role: "PIC" } }, 404],
    [[unassigned], { ...editBody, proyek_id: 20 }, undefined, 400],
    [[{ ...unassigned, timeline_version: 1 }], editBody, undefined, 409]
  ]) {
    const f = fixture({ rows });
    const response = await f.request("put", "/api/timeline/:id", { params: { id: "1" }, body, ...(session ? { session } : {}) });
    assert.equal(response.code, expected);
    assert.equal(f.rows[0].proyek_id, null);
  }
});

test("admin can assign records belonging to another uploader", async () => {
  const f = fixture({ rows: [unassigned] });
  const response = await f.request("put", "/api/timeline/:id", {
    params: { id: "1" }, body: { ...editBody, proyek_id: 20 }, session: { user: { id: 1, role: "Admin" } }
  });
  assert.equal(response.code, 200);
  assert.equal(f.rows[0].proyek_id, 20);
});

test("audit failure rolls back upload and edit", async t => {
  t.mock.method(console, "error", () => {});
  let f = fixture({ failLog: true });
  assert.equal((await f.request("post", "/api/timeline/import")).code, 500);
  assert.equal(f.rows.length, 0);
  f = fixture({ failLog: true, rows: [unassigned] });
  assert.equal((await f.request("put", "/api/timeline/:id", { params: { id: "1" }, body: editBody })).code, 500);
  assert.equal(f.rows[0].proyek_id, null);
});

test("listing and export share scoped SQL including unassigned ownership", async () => {
  const f = fixture();
  await listTimeline(f.pool, { unassigned: "1", jenis_proyek: "Lisensi" }, { id: 2, isAdmin: false });
  assert.match(TIMELINE_SQL, /LEFT JOIN public.proyek proyek/);
  assert.match(TIMELINE_SQL, /timeline.proyek_id IS NULL AND timeline.imported_by = \$8/);
  assert.match(TIMELINE_SQL, /\$10::boolean = FALSE OR timeline.proyek_id IS NULL/);
  assert.match(TIMELINE_SQL, /sewa_order.quantity/);
  assert.match(TIMELINE_SQL, /sewa_order.no_req_klien/);
  assert.deepEqual(f.queries[0].params.slice(5), [false, false, 2, "Lisensi", true]);
});
