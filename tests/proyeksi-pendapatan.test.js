"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { spawnSync } = require("node:child_process");
const register = require("../proyeksi-pendapatan-api");

function fixture() {
  const routes = new Map();
  const user = { id: 7, role: "PIC" };
  const termin = [
    { proyek_id: 5, nama_proyek: "Sewa Router", jenis_proyek: "Sewa", tanggal_proyeksi: "2027-01-31", nilai_termin: "110.25", nama_termin: "Termin 1" },
    { proyek_id: 5, nama_proyek: "Sewa Router", jenis_proyek: "Sewa", tanggal_proyeksi: "2027-01-28", nilai_termin: "200.00", nama_termin: "Termin 2" },
    { proyek_id: 5, nama_proyek: "Sewa Router", jenis_proyek: "Sewa", tanggal_proyeksi: "2027-09-10", nilai_termin: "50", nama_termin: "" },
    { proyek_id: 6, nama_proyek: "Paket Jaringan", jenis_proyek: "Pengadaan", tanggal_proyeksi: "2027-12-31", nilai_termin: "900", nama_termin: "Termin 1" },
    { proyek_id: 6, nama_proyek: "Paket Jaringan", jenis_proyek: "Pengadaan", tanggal_proyeksi: "2026-01-01", nilai_termin: "300", nama_termin: "Termin 3" }
  ];
  function wajibLogin(req, res, next) {
    if (!req.session?.user) return res.status(401).json({ error: "Belum login" });
    next();
  }
  const app = {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers); },
    post(path, ...handlers) { routes.set(`POST ${path}`, handlers); }
  };
  register(app, wajibLogin, async login => {
    assert.equal(login, user);
    return termin;
  });

  return async (path, query, login = user, penyesuaian) => {
    const method = penyesuaian === undefined ? "GET" : "POST";
    const [auth, handler] = routes.get(`${method} ${path}`);
    const req = { session: { user: login }, query, body: { penyesuaian } };
    const result = { status: 200 };
    const res = {
      setHeader() {},
      status(code) { result.status = code; return res; },
      json(body) { result.json = body; return res; },
      attachment(filename) { result.filename = filename; return res; },
      send(file) { result.file = file; return res; }
    };
    let pending;
    auth(req, res, () => { pending = handler(req, res); });
    await pending;
    return result;
  };
}

test("proyeksi mengelompokkan termin per proyek dan bulan sesuai filter", async () => {
  const request = fixture();
  const path = "/api/proyeksi-pendapatan";
  const filtered = await request(path, { tahun: "2027", search: " ROUTER " });
  assert.deepEqual(filtered.json.ringkasan, { total: 360.25, jumlah_proyek: 1, periode: "Januari–September 2027" });
  const [project] = filtered.json.rows;
  assert.equal(project.proyek_id, 5);
  assert.equal(project.nama_proyek_proyeksi, project.nama_proyek);
  assert.equal(project.persentase_kenaikan, 0);
  assert.equal(project.total, 360.25);
  assert.equal(project.bulan.length, 12);
  assert.equal(project.bulan[0].nominal, 310.25);
  assert.deepEqual(project.bulan[0].termin.map(item => item.nama), ["Termin 2", "Termin 1"]);
  assert.equal(project.bulan[1], null);
  assert.equal(project.bulan[8].termin[0].nama, "");
  const full = await request(path, { tahun: "2027" });
  assert.deepEqual(full.json.ringkasan, { total: 1260.25, jumlah_proyek: 2, periode: "Januari–Desember 2027" });
  assert.equal((await request(path, { tahun: "2026" })).json.ringkasan.total, 300);
  assert.equal((await request(path, { tahun: "2027", search: "tidak ada" })).json.rows.length, 0);
  assert.equal((await request(path, { tahun: "202" })).status, 400);
  assert.equal((await request(path, {}, null)).status, 401);
  assert.equal((await request(`${path}/export`, {}, null)).status, 401);
});

test("filter jenis proyek mengikuti tahun dan pencarian serta menyaring tabel Hold", async () => {
  const request = fixture();
  const path = "/api/proyeksi-pendapatan";
  const query = { tahun: "2027", jenis_proyek: " SEWA ", search: "router" };
  const { json: report } = await request(path, query);
  assert.deepEqual(report.jenis_proyek_tersedia, ["Pengadaan", "Sewa"]);
  assert.deepEqual(report.rows.map(project => project.proyek_id), [5]);
  assert.deepEqual(report.ringkasan, { total: 360.25, jumlah_proyek: 1, periode: "Januari–September 2027" });

  const { json: empty } = await request(path, { ...query, tahun: "2026" });
  assert.deepEqual(empty.rows, []);
  assert.deepEqual(empty.jenis_proyek_tersedia, report.jenis_proyek_tersedia);
  assert.deepEqual((await request(path, { ...query, search: "jaringan" })).json.rows, []);

  const hold = [{ proyek_id: "5", nama_proyek_proyeksi: "", persentase_kenaikan: 0, hold: true }];
  const { json: held } = await request(path, query, undefined, hold);
  assert.deepEqual(held.hold_rows.map(project => project.proyek_id), [5]);
  assert.deepEqual(held.ringkasan, { total: 0, jumlah_proyek: 0, periode: "2027" });
  const { json: otherType } = await request(path, { tahun: "2027", jenis_proyek: "pengadaan" }, undefined, hold);
  assert.deepEqual(otherType.rows.map(project => project.proyek_id), [6]);
  assert.deepEqual(otherType.hold_rows, []);
});

test("kenaikan memakai nominal awal dan pencarian juga cocok dengan nama proyeksi", async () => {
  const request = fixture();
  const path = "/api/proyeksi-pendapatan";
  const adjustment = [{ proyek_id: "5", nama_proyek_proyeksi: "Kontrak Lanjutan", persentase_kenaikan: 5 }];
  const pertama = await request(path, { tahun: "2027", search: "lanjutan" }, undefined, adjustment);
  const kedua = await request(path, { tahun: "2027" }, undefined, adjustment);
  const [project] = pertama.json.rows;
  assert.equal(project.nama_proyek, "Sewa Router");
  assert.equal(project.nama_proyek_proyeksi, "Kontrak Lanjutan");
  assert.equal(project.total_awal, 360.25);
  assert.ok(Math.abs(project.total - 378.2625) < 1e-8);
  assert.equal(pertama.json.ringkasan.total, project.total);
  assert.equal(kedua.json.rows.find(item => item.proyek_id === 5).total, project.total);
  assert.equal(project.bulan[0].termin[0].nominal_awal, 200);
  assert.equal(project.bulan[0].termin[0].nominal, 210);
  assert.equal((await request(path, {}, undefined, [{ ...adjustment[0], persentase_kenaikan: -5 }])).status, 400);
  assert.equal((await request(path, {}, null, adjustment)).status, 401);
});

test("Hold memisahkan proyek dari total, jumlah proyek, dan periode", async () => {
  const request = fixture();
  const path = "/api/proyeksi-pendapatan";
  const hold = { proyek_id: "5", nama_proyek_proyeksi: "Sewa Lanjutan", persentase_kenaikan: 5, hold: true };
  const laporan = (await request(path, { tahun: "2027" }, undefined, [hold])).json;
  assert.deepEqual(laporan.rows.map(project => project.proyek_id), [6]);
  assert.deepEqual(laporan.ringkasan, { total: 900, jumlah_proyek: 1, periode: "Desember 2027" });
  assert.equal(laporan.hold_rows[0].nama_proyek_proyeksi, "Sewa Lanjutan");
  assert.equal(laporan.hold_rows[0].persentase_kenaikan, 5);
  const filtered = (await request(path, { tahun: "2027", search: "sewa lanjutan" }, undefined, [hold])).json;
  assert.deepEqual(filtered.ringkasan, { total: 0, jumlah_proyek: 0, periode: "2027" });
  assert.equal(filtered.hold_rows.length, 1);

  const kembali = (await request(path, { tahun: "2027", search: "sewa lanjutan" }, undefined, [{ ...hold, hold: false }])).json;
  assert.equal(kembali.hold_rows.length, 0);
  assert.equal(kembali.rows[0].total, laporan.hold_rows[0].total);
  assert.equal((await request(path, { tahun: "2027" }, undefined, [{ ...hold, hold: "true" }])).status, 400);
});

test("ekspor memuat jenis proyek yang dipilih dengan rincian nominal awal", async () => {
  const result = await fixture()("/api/proyeksi-pendapatan/export", { tahun: "2027", jenis_proyek: "sewa" }, undefined,
    [{ proyek_id: "5", nama_proyek_proyeksi: "Kontrak Lanjutan", persentase_kenaikan: 5 }]);
  assert.equal(result.status, 200);
  assert.equal(result.filename, "proyeksi-pendapatan-2027.xlsx");
  const check = spawnSync(process.env.TIMELINE_PYTHON_BIN || "python3", ["-c", `
import io, sys, zipfile, xml.etree.ElementTree as ET
ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as book:
    monthly = ET.fromstring(book.read('xl/worksheets/sheet1.xml'))
    values = {cell.attrib['r']: cell for cell in monthly.iter(ns + 'c')}
    assert values['C2'].findtext(ns + 'is/' + ns + 't') == 'Kontrak Lanjutan'
    assert values['D2'].findtext(ns + 'v') == '5'
    assert abs(float(values['E2'].findtext(ns + 'v')) - 325.7625) < 1e-8
    assert values['F2'].find(ns + 'v') is None
    assert abs(float(values['Q3'].findtext(ns + 'v')) - 378.2625) < 1e-8
    assert b'Paket Jaringan' not in book.read('xl/worksheets/sheet1.xml')
    details = book.read('xl/worksheets/sheet2.xml')
    assert b'Termin 1' in details and b'Termin 2' in details
    assert b'Paket Jaringan' not in details
    detail_values = {cell.attrib['r']: cell for cell in ET.fromstring(details).iter(ns + 'c')}
    assert detail_values['G2'].findtext(ns + 'v') == '200'
    assert detail_values['H2'].findtext(ns + 'v') == '210'
`], { input: result.file });
  assert.equal(check.status, 0, check.stderr.toString());
});
