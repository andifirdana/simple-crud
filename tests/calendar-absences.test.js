'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const registerCalendar = require('../calendar-api');

function absenceRequests(pool) {
  const routes = new Map();
  let requireLogin;
  const app = {
    use(path, handler) { if (path === '/api/calendar') requireLogin = handler; },
    get() {},
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    put() {},
    delete(path, handler) { routes.set(`DELETE ${path}`, handler); }
  };
  registerCalendar(app, pool, { enqueueAgenda() {} });

  return async function request(route, user, { params = {}, body = {} } = {}) {
    const req = { params, session: { user }, body };
    const result = { status: 200 };
    const res = {
      setHeader() {},
      status(code) { result.status = code; return res; },
      json(data) { result.data = data; return res; }
    };
    let pending;
    requireLogin(req, res, () => { pending = routes.get(route)(req, res); });
    await pending;
    return result;
  };
}

test('pengajuan kalender hanya bisa dihapus oleh PIC pengaju', async () => {
  const records = new Map([['11', '7'], ['12', '8']]);
  const calls = [];
  const request = absenceRequests({
    async query(sql, values) {
      calls.push(values);
      assert.match(sql, /DELETE FROM public\.calendar_pic_absences\s+WHERE id = \$1 AND pic_id = \$2/);
      const [id, picId] = values;
      if (records.get(id) !== picId) return { rows: [] };
      records.delete(id);
      return { rows: [{ id }] };
    }
  });
  const remove = (id, user, body) => request('DELETE /api/calendar/absences/:id', user, { params: { id }, body });

  assert.equal((await remove('11', null)).status, 401);
  assert.equal((await remove('11', {})).status, 401);
  assert.equal((await remove('x', { id: 7 })).status, 400);
  assert.deepEqual(calls, []);

  assert.equal((await remove('11', { id: 8, role: 'Admin' }, { pic_id: 7 })).status, 404);
  assert.equal(records.get('11'), '7');
  assert.deepEqual(calls[0], ['11', '8']);

  assert.deepEqual(await remove('11', { id: 7 }), { status: 200, data: { id: '11' } });
  assert.equal((await remove('11', { id: 7 })).status, 404);
  assert.equal(records.get('12'), '8');
});

test('jenis pengajuan berbeda tetap bentrok untuk PIC dan tanggal yang sama', async () => {
  const requests = [];
  const transactions = [];
  const request = absenceRequests({
    async connect() {
      const queries = [];
      transactions.push(queries);
      return {
        async query(sql, values) {
          queries.push(sql.trim());
          if (sql.includes('FOR NO KEY UPDATE')) {
            assert.deepEqual(queries.slice(0, 1), ['BEGIN ISOLATION LEVEL READ COMMITTED']);
            return { rows: [{ nama: `PIC ${values[0]}` }] };
          }
          if (sql.includes('FROM public.calendar_pic_absences')) {
            assert.match(queries[1], /FOR NO KEY UPDATE/);
            assert.match(sql, /pic_id = \$1 AND tanggal_mulai <= \$3::date AND tanggal_akhir >= \$2::date/);
            const [picId, start, end] = values;
            const overlap = requests.find(row => row.pic_id === picId && row.start_date <= end && row.end_date >= start);
            const date = overlap && (start > overlap.start_date ? start : overlap.start_date).split('-').reverse().join('/');
            return { rows: overlap ? [{ date }] : [] };
          }
          if (sql.includes('INSERT INTO public.calendar_pic_absences')) {
            const [picId, name, type, start, end] = values;
            const absence = { pic_id: picId, pic_name: name, type, start_date: start, end_date: end };
            requests.push(absence);
            return { rows: [absence] };
          }
          return { rows: [] };
        },
        release() { queries.push('released'); }
      };
    }
  });
  const submit = (id, type, start, end = start) => request('POST /api/calendar/absences', { id }, {
    body: { type, start_date: start, end_date: end }
  });

  assert.equal((await submit(7, 'cuti', '2026-11-26', '2026-11-28')).status, 201);
  const sameDate = await submit(7, 'sakit', '2026-11-27');
  assert.equal(sameDate.status, 409);
  assert.match(sameDate.data.error, /27\/11\/2026/);
  const sharedEnd = await submit(7, 'izin', '2026-11-28', '2026-11-30');
  assert.equal(sharedEnd.status, 409);
  assert.match(sharedEnd.data.error, /28\/11\/2026/);
  assert.equal((await submit(7, 'sakit', '2026-11-29')).status, 201);
  assert.equal((await submit(8, 'izin', '2026-11-27')).status, 201);
  assert.equal(requests.length, 3);
  assert.deepEqual(transactions.map(queries => queries.slice(-2)), [
    ['COMMIT', 'released'], ['ROLLBACK', 'released'], ['ROLLBACK', 'released'],
    ['COMMIT', 'released'], ['COMMIT', 'released']
  ]);
});
