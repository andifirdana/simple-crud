'use strict';

(() => {
  const $ = id => document.getElementById(id);

  const API = '/api/calendar';
  const HOUR_HEIGHT = 96;

  let events = [];

  let master = {
    pics: [],
    projects: [],
    current_pic_id: null
  };

  let ready = false;
  let saving = false;
  let requestNumber = 0;
  let toastTimer;
  let loadError = '';
  let viewedEventId = null;

  // ======================================================
  // TANGGAL DAN WAKTU
  // ======================================================

  function todayKey() {
    const parts = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    ).formatToParts(new Date());

    const part = name =>
      parts.find(
        item => item.type === name
      ).value;

    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function minutes(value) {
    const [hour, minute] = value
      .split(':')
      .map(Number);

    return hour * 60 + minute;
  }

  function timeText(value) {
    return (
      `${String(
        Math.floor(value / 60)
      ).padStart(2, '0')}:` +
      `${String(
        value % 60
      ).padStart(2, '0')}`
    );
  }

  function utcKey(date) {
    return date
      .toISOString()
      .split('T')[0];
  }

  function weekDays(value) {
    const date = new Date(
      `${value}T12:00:00Z`
    );

    const offset = date.getUTCDay();

    return Array.from(
      { length: 7 },
      (_, index) => {
        const day = new Date(date);

        day.setUTCDate(
          date.getUTCDate() - offset + index
        );

        return {
          key: utcKey(day),
          day: day.getUTCDate(),
          weekday: index
        };
      }
    );
  }

  function calendarRange() {
    const days = weekDays(
      $('view-date').value
    );

    return {
      from:
        days[0].key < '1000-01-01'
          ? '1000-01-01'
          : days[0].key,

      to:
        days[6].key.length > 10
          ? '9999-12-31'
          : days[6].key
    };
  }

  // ======================================================
  // HELPER TAMPILAN
  // ======================================================

  function escapeHtml(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]
    );
  }

  function safeLink(value) {
    try {
      const url = new URL(value);

      return ['http:', 'https:'].includes(
        url.protocol
      )
        ? url.href
        : null;

    } catch {
      return null;
    }
  }

  function picColor(pic) {
    const key =
      pic.id || `legacy:${pic.name}`;

    let hash = 0;

    for (const letter of key) {
      hash = (
        Math.imul(hash, 31) +
        letter.charCodeAt(0)
      ) >>> 0;
    }

    const palette = [
      {
        border: '#ffcc33',
        background: '#fff0b2',
        own: '#896000'
      },
      {
        border: '#ff6fae',
        background: '#ffc8e0',
        own: '#9d245d'
      },
      {
        border: '#ff9f1c',
        background: '#ffdaad',
        own: '#9a4e00'
      },
      {
        border: '#2ec4b6',
        background: '#b9f0e9',
        own: '#08796f'
      },
      {
        border: '#1a7fd1',
        background: '#bfdefb',
        own: '#14588f'
      },
      {
        border: '#835af3',
        background: '#ddd1ff',
        own: '#5435a5'
      },
      {
        border: '#ff625f',
        background: '#ffc9c5',
        own: '#a32f31'
      },
      {
        border: '#91c925',
        background: '#e5f6b0',
        own: '#567a0c'
      },
      {
        border: '#df57cb',
        background: '#f7cff0',
        own: '#903179'
      },
      {
        border: '#00a9cb',
        background: '#bdeef8',
        own: '#006b86'
      }
    ];

    return palette[
      hash % palette.length
    ];
  }

  function notify(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      $('toast').hidden = true;
    }, 4500);
  }

  // ======================================================
  // API
  // ======================================================

  async function api(
    path = '',
    options = {}
  ) {
    const response = await fetch(
      `${API}${path}`,
      {
        credentials: 'same-origin',
        cache: 'no-store',

        ...options,

        headers: {
          ...options.headers,

          ...(options.body
            ? {
                'Content-Type':
                  'application/json'
              }
            : {})
        }
      }
    );

    const result = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? 'Sesi berakhir. Silakan login kembali.'
          : result?.error ||
            `Permintaan gagal (${response.status}). Periksa API kalender.`
      );
    }

    if (result === null) {
      throw new Error(
        'Respons API bukan JSON. Periksa pemasangan route kalender.'
      );
    }

    return result;
  }

    // ======================================================
  // STATUS AKUN GOOGLE DAN PENGIRIMAN UNDANGAN
  // ======================================================

  let googleJobs = new Map();

  let googleJobsRequest = 0;
  let googleJobsFlight = null;
  let googleJobsCheckedAt = null;
  let googleJobsError = '';

  let googleAccountRequest = 0;
  let googleAccountFlight = null;
  let googleAccountCheckedAt = 0;

  let googleMonitorTimer = null;

  function setGoogleText(id, value) {
    const node = $(id);

    if (
      node &&
      node.textContent !== value
    ) {
      node.textContent = value;
    }
  }

  function googleTimestamp(value) {
    const date = new Date(
      value || ''
    );

    if (
      Number.isNaN(date.getTime())
    ) {
      return '';
    }

    return new Intl.DateTimeFormat(
      'id-ID',
      {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      }
    ).format(date) + ' WIB';
  }

  async function googleJSON(path) {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      const response = await fetch(
        '/api/google-calendar' + path,
        {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,

          headers: {
            Accept: 'application/json'
          }
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (
        !response.ok ||
        !data
      ) {
        const message =
          response.status === 401
            ? 'Sesi PORTOPRO berakhir. Silakan login kembali ke PORTOPRO.'
            : response.status === 404
              ? 'Informasi Google Calendar belum tersedia. Hubungi Admin.'
              : data?.error ||
                'Status Google Calendar belum dapat diperiksa.';

        throw Object.assign(
          new Error(message),
          {
            status: response.status
          }
        );
      }

      return data;

    } catch (error) {
      if (
        error.name === 'AbortError'
      ) {
        throw new Error(
          'Pemeriksaan Google melewati batas waktu. Coba kembali.'
        );
      }

      throw error;

    } finally {
      clearTimeout(timeout);
    }
  }

  function googleDeliveryState(id) {
    const job = googleJobs.get(
      String(id)
    );

    const delivery =
      job?.delivery_status ||
      (
        job?.status === 'synced'
          ? 'sent'
          : job?.status === 'deleted'
            ? 'cancelled'
            : job?.status === 'pending'
              ? (
                  job.last_error
                    ? 'failed'
                    : 'pending'
                )
              : job?.status
      );

    const states = {
      pending: {
        label: 'Pending',
        className: 'pending',

        message:
          'Undangan masih dalam antrean. Status berubah setelah diproses Google Calendar.'
      },

      sent: {
        label: 'Sent',
        className: 'sent',

        message:
          'Google Calendar telah memproses pengiriman undangan untuk versi agenda ini.'
      },

      failed: {
        label: 'Failed',
        className: 'failed',

        message:
          (
            job?.last_error ||
            'Pengiriman belum berhasil.'
          ) +
          ' Antrean akan dicoba ulang otomatis.'
      },

      cancelled: {
        label: 'Dibatalkan',
        className: 'cancelled',

        message:
          'Pembatalan acara Google telah diproses.'
      },

      not_queued: {
        label: 'Belum diantrekan',
        className: 'unknown',

        message:
          'Agenda belum masuk antrean Google. Buka Edit lalu Simpan untuk mengirim agenda ini.'
      }
    };

    return {
      ...(
        states[delivery] || {
          label:
            'Belum terkonfirmasi',

          className:
            'unknown',

          message:
            'Status pengiriman agenda belum terkonfirmasi.'
        }
      ),

      delivery:
        delivery || 'unknown',

      job
    };
  }

  function googleDeliveryBadge(id) {
    const state =
      googleDeliveryState(id);

    return `
      <span
        class="google-pill google-delivery ${state.className}"
        data-google-delivery-id="${escapeHtml(id)}"
        title="${escapeHtml(state.message)}"
      >
        ${state.label}
      </span>
    `;
  }

  function updateGoogleDetails() {
    const node =
      $('view-google-state');

    if (
      !node ||
      !viewedEventId
    ) {
      return;
    }

    const state =
      googleDeliveryState(
        viewedEventId
      );

    node.className =
      'google-pill ' +
      state.className;

    if (
      node.textContent !==
      state.label
    ) {
      node.textContent =
        state.label;
    }

    setGoogleText(
      'view-google-message',
      state.message
    );

    const sent = googleTimestamp(
      state.job?.sent_at ||
      (
        state.delivery === 'sent'
          ? state.job?.synced_at
          : null
      )
    );

    const next = googleTimestamp(
      state.job?.next_attempt_at
    );

    setGoogleText(
      'view-google-time',

      state.delivery === 'sent' && sent
        ? 'Diproses Google: ' + sent
        : (
            ['pending', 'failed'].includes(
              state.delivery
            ) && next
              ? 'Jadwal percobaan berikutnya: ' + next
              : ''
          )
    );
  }

  function renderGoogleDelivery() {
    const counts = {
      pending: 0,
      sent: 0,
      failed: 0,
      other: 0
    };

    const seen = new Set();

    for (
      const node of
      document.querySelectorAll(
        '[data-google-delivery-id]'
      )
    ) {
      const id =
        node.dataset.googleDeliveryId;

      const state =
        googleDeliveryState(id);

      node.className =
        'google-pill google-delivery ' +
        state.className;

      if (
        node.textContent !==
        state.label
      ) {
        node.textContent =
          state.label;
      }

      node.title =
        state.message;

      if (!seen.has(id)) {
        seen.add(id);

        const group =
          ['pending', 'sent', 'failed']
            .includes(state.delivery)
              ? state.delivery
              : 'other';

        counts[group]++;
      }
    }

    setGoogleText(
      'google-count-pending',
      'Pending: ' + counts.pending
    );

    setGoogleText(
      'google-count-sent',
      'Sent: ' + counts.sent
    );

    setGoogleText(
      'google-count-failed',
      'Failed: ' + counts.failed
    );

    setGoogleText(
      'google-count-other',
      'Belum terkonfirmasi: ' +
      counts.other
    );

    const notice =
      $('google-jobs-message');

    if (notice) {
      const previous =
        googleTimestamp(
          googleJobsCheckedAt
        );

      const message =
        googleJobsError
          ? (
              googleJobsError +
              (
                previous
                  ? ' Status terakhir: ' + previous
                  : ''
              )
            )
          : '';

      if (
        notice.textContent !==
        message
      ) {
        notice.textContent =
          message;
      }

      notice.hidden =
        !message;
    }

    updateGoogleDetails();
  }

  function refreshGoogleJobs(
    force = false
  ) {
    const ids = [
      ...new Set(
        events.map(
          event =>
            String(event.id)
        )
      )
    ];

    const key =
      ids.join(',');

    if (
      googleJobsFlight?.key === key &&
      !force
    ) {
      return googleJobsFlight.promise;
    }

    const request =
      ++googleJobsRequest;

    const flight = {
      key
    };

    flight.promise = (async () => {
      await Promise.resolve();

      try {
        const next =
          new Map();

        let checkedAt =
          null;

        for (
          let offset = 0;
          offset < ids.length;
          offset += 500
        ) {
          const batch =
            ids.slice(
              offset,
              offset + 500
            );

          const result =
            await googleJSON(
              '/agenda-statuses?ids=' +
              encodeURIComponent(
                batch.join(',')
              )
            );

          if (
            !Array.isArray(result.jobs)
          ) {
            throw new Error(
              'Format status undangan tidak valid.'
            );
          }

          for (
            const job of result.jobs
          ) {
            next.set(
              String(job.agenda_id),
              job
            );
          }

          if (
            batch.some(
              id => !next.has(id)
            )
          ) {
            throw new Error(
              'Status sebagian agenda belum tersedia.'
            );
          }

          checkedAt =
            result.checked_at;
        }

        const currentKey = [
          ...new Set(
            events.map(
              event =>
                String(event.id)
            )
          )
        ].join(',');

        if (
          request !== googleJobsRequest ||
          key !== currentKey
        ) {
          return;
        }

        googleJobs =
          next;

        googleJobsCheckedAt =
          checkedAt ||
          new Date().toISOString();

        googleJobsError =
          '';

      } catch (error) {
        if (
          request !==
          googleJobsRequest
        ) {
          return;
        }

        googleJobsError =
          error.message;

      } finally {
        if (
          request ===
          googleJobsRequest
        ) {
          renderGoogleDelivery();
        }

        if (
          googleJobsFlight ===
          flight
        ) {
          googleJobsFlight =
            null;
        }
      }
    })();

    googleJobsFlight =
      flight;

    return flight.promise;
  }

  function refreshGoogleAccount(
    force = false
  ) {
    if (!$('google-panel')) {
      return Promise.resolve();
    }

    if (
      googleAccountFlight &&
      !force
    ) {
      return googleAccountFlight;
    }

    const request =
      ++googleAccountRequest;

    const pending = (async () => {
      await Promise.resolve();

      try {
        const meResponse =
          await fetch(
            '/api/me',
            {
              credentials:
                'same-origin',

              cache:
                'no-store'
            }
          );

        if (!meResponse.ok) {
          throw new Error(
            meResponse.status === 401
              ? 'Sesi PORTOPRO berakhir. Silakan login kembali ke PORTOPRO.'
              : 'Data akun PORTOPRO belum dapat diperiksa.'
          );
        }

        const me =
          await meResponse.json();

        const admin =
          String(
            me.user?.role || ''
          )
            .trim()
            .toLowerCase() === 'admin';

        const account =
          await googleJSON(
            '/status' +
            (
              force
                ? '?refresh=1'
                : ''
            )
          );

        if (
          request !==
          googleAccountRequest
        ) {
          return;
        }

        const state =
          account.status ||
          (
            account.connected
              ? 'connected'
              : 'not_connected'
          );

        const labels = {
          connected:
            'Terhubung',

          not_connected:
            'Belum terhubung',

          reauth_required:
            'Perlu login ulang',

          unavailable:
            'Belum dapat diperiksa'
        };

        const badge =
          $('google-account-state');

        badge.className =
          'google-pill ' +
          (
            labels[state]
              ? state
              : 'unavailable'
          );

        setGoogleText(
          'google-account-state',
          labels[state] ||
          labels.unavailable
        );

        setGoogleText(
          'google-account-email',

          (
            account.connected_email ||
            account.division_email ||
            'Akun divisi'
          ) +
          (
            account.connected_email &&
            account.division_email &&
            account.connected_email !==
              account.division_email
                ? (
                    ' • Akun divisi yang dipilih: ' +
                    account.division_email
                  )
                : ''
          )
        );

        setGoogleText(
          'google-account-message',

          (account.message || '') +
          (
            !admin &&
            [
              'not_connected',
              'reauth_required'
            ].includes(state)
              ? ' Hubungi Admin untuk menghubungkan akun divisi.'
              : ''
          )
        );

        const checked =
          googleTimestamp(
            account.checked_at
          );

        setGoogleText(
          'google-account-checked',

          checked
            ? 'Diperiksa: ' + checked
            : ''
        );

        const connect =
          $('google-connect');

        connect.hidden =
          !admin;

        connect.textContent =
          state === 'reauth_required'
            ? 'Login ulang Google'
            : account.connected_email
              ? 'Hubungkan ulang akun'
              : 'Hubungkan akun';

      } catch (error) {
        if (
          request !==
          googleAccountRequest
        ) {
          return;
        }

        $('google-account-state')
          .className =
            'google-pill unavailable';

        setGoogleText(
          'google-account-state',
          'Belum dapat diperiksa'
        );

        setGoogleText(
          'google-account-message',
          error.message
        );

        $('google-connect').hidden =
          true;

      } finally {
        if (
          request ===
          googleAccountRequest
        ) {
          googleAccountCheckedAt =
            Date.now();
        }

        if (
          googleAccountFlight ===
          pending
        ) {
          googleAccountFlight =
            null;
        }
      }
    })();

    googleAccountFlight =
      pending;

    return pending;
  }

  function startGooglePolling() {
    if (
      googleMonitorTimer ||
      !$('google-panel')
    ) {
      return;
    }

    refreshGoogleAccount(true);
    refreshGoogleJobs(true);

    googleMonitorTimer =
      setInterval(
        () => {
          if (document.hidden) {
            return;
          }

          refreshGoogleJobs();

          if (
            Date.now() -
            googleAccountCheckedAt >=
            60000
          ) {
            refreshGoogleAccount();
          }
        },
        10000
      );
  }

  function initGoogleMonitoring() {
    if (!$('google-panel')) {
      return;
    }

    $('google-refresh')
      .addEventListener(
        'click',
        async () => {
          $('google-refresh')
            .disabled = true;

          try {
            await Promise.all([
              refreshGoogleAccount(true),
              refreshGoogleJobs(true)
            ]);

          } finally {
            $('google-refresh')
              .disabled = false;
          }
        }
      );

    const resume = () => {
      if (!document.hidden) {
        startGooglePolling();

        refreshGoogleAccount(true);
        refreshGoogleJobs(true);
      }
    };

    window.addEventListener(
      'focus',
      resume
    );

    window.addEventListener(
      'pageshow',
      startGooglePolling
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          resume();
        }
      }
    );

    window.addEventListener(
      'pagehide',
      () => {
        clearInterval(
          googleMonitorTimer
        );

        googleMonitorTimer =
          null;

        googleJobsRequest++;
        googleAccountRequest++;
      }
    );

    startGooglePolling();
  }

  // ======================================================
  // FILTER
  // ======================================================

  function fillSelect(
    id,
    rows,
    placeholder,
    selected = ''
  ) {
    const select = $(id);

    select.replaceChildren(
      new Option(
        placeholder,
        ''
      )
    );

    for (const row of rows) {
      select.add(
        new Option(
          row.name,
          String(row.id)
        )
      );
    }

    select.value = selected;
  }

  function filterRows(
    rows,
    field,
    name
  ) {
    const merged = new Map(
      rows.map(row => [
        String(row.id),
        {
          id: String(row.id),
          name: row.name
        }
      ])
    );

    for (const event of events) {
      const key =
        event[field] ||
        `legacy:${event[name]}`;

      if (!merged.has(key)) {
        merged.set(key, {
          id: key,
          name: event[name]
        });
      }
    }

    return [...merged.values()].sort(
      (first, second) =>
        first.name.localeCompare(
          second.name,
          'id'
        )
    );
  }

  function refreshFilters() {
  const pics = new Map(
    master.pics.map(
      row => [row.id, row]
    )
  );

  for (const event of events) {
    for (const pic of event.pics) {
      const key =
        pic.id ||
        `legacy:${pic.name}`;

      pics.set(key, {
        id: key,
        name: pic.name
      });
    }
  }

  fillSelect(
    'pic-filter',
    [...pics.values()],
    'Semua PIC',
    $('pic-filter').value
  );
}

  // ======================================================
  // DETEKSI BENTROK PIC
  // ======================================================

  function findPicConflicts(rows) {
    const groups = new Map();
    const conflicts = new Map();

    for (const event of rows) {
      const start = minutes(
        event.time
      );

      const end = minutes(
        event.end_time
      );

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
      ) {
        continue;
      }

      const seen = new Set();

      for (
        const pic of event.pics || []
      ) {
        const picId =
          pic.id == null
            ? (
                `legacy:${String(pic.name || '')
                  .trim()
                  .toLocaleLowerCase('id')}`
              )
            : `id:${pic.id}`;

        if (
          seen.has(picId) ||
          (
            pic.id == null &&
            !String(pic.name || '').trim()
          )
        ) {
          continue;
        }

        seen.add(picId);

        const key =
          `${event.date}\u0000${picId}`;

        if (!groups.has(key)) {
          groups.set(key, []);
        }

        groups.get(key).push({
          event,
          pic,
          picId,
          start,
          end
        });
      }
    }

    for (
      const group of groups.values()
    ) {
      group.sort(
        (first, second) =>
          first.start - second.start ||
          first.end - second.end
      );

      let active = [];

      for (const current of group) {
        active = active.filter(
          previous =>
            previous.end >
            current.start
        );

        for (
          const previous of active
        ) {
          if (
            String(previous.event.id) ===
            String(current.event.id)
          ) {
            continue;
          }

          const date =
            current.event.date;

          if (!conflicts.has(date)) {
            conflicts.set(date, {
              pics: new Map(),
              details: []
            });
          }

          const conflict =
            conflicts.get(date);

          conflict.pics.set(
            current.picId,
            current.pic.name
          );

          const overlap =
            `${timeText(
              Math.max(
                previous.start,
                current.start
              )
            )}–${timeText(
              Math.min(
                previous.end,
                current.end
              )
            )}`;

          conflict.details.push(
            `${current.pic.name} · ${overlap}: ` +
            `${previous.event.agenda} ↔ ` +
            current.event.agenda
          );
        }

        active.push(current);
      }
    }

    return conflicts;
  }

  function conflictAlert(conflict) {
    if (!conflict) {
      return '';
    }

    const names = [
      ...conflict.pics.values()
    ].join(', ');

    return `
      <details class="day-conflict">
        <summary
          aria-label="${escapeHtml(
            `Lihat bentrok jadwal PIC: ${names}`
          )}"
        >
          ⚠ ${conflict.pics.size} PIC bentrok
        </summary>

        <p class="conflict-names">
          ${escapeHtml(names)}
        </p>

        <ul class="conflict-details">
          ${conflict.details
            .map(
              detail =>
                `<li>${escapeHtml(detail)}</li>`
            )
            .join('')}
        </ul>

        <p class="conflict-note">
          Termasuk agenda di luar filter.
        </p>
      </details>
    `;
  }

  // ======================================================
  // PENEMPATAN AGENDA YANG BERTUMPUK
  // ======================================================

  function layoutEvents(rows) {
    const sorted = rows
      .map(event => ({
        ...event,
        start: minutes(event.time),
        end: minutes(event.end_time)
      }))
      .sort(
        (first, second) =>
          first.start - second.start ||
          first.end - second.end ||
          first.id.localeCompare(
            second.id
          )
      );

    const result = [];

    let group = [];
    let groupEnd = -1;
    let groupIndex = 0;

    function finishGroup() {
      const columnEnds = [];

      for (const event of group) {
        let column =
          columnEnds.findIndex(
            end =>
              end <= event.start
          );

        if (column === -1) {
          column = columnEnds.length;
        }

        columnEnds[column] =
          event.end;

        event.column = column;
      }

      for (const event of group) {
        result.push({
          ...event,

          columns:
            columnEnds.length,

          group:
            groupIndex
        });
      }

      group = [];

      groupIndex++;
    }

    for (const event of sorted) {
      if (
        group.length &&
        event.start >= groupEnd
      ) {
        finishGroup();
      }

      if (!group.length) {
        groupEnd = event.end;

      } else {
        groupEnd = Math.max(
          groupEnd,
          event.end
        );
      }

      group.push(event);
    }

    finishGroup();

    return result;
  }

  // ======================================================
  // KARTU AGENDA
  // ======================================================

  function eventCard(event) {
    const colors =
      event.pics.map(picColor);

    const color =
      colors[0] ||
      picColor({
        name: 'Belum ada PIC'
      });

    const myPic =
      master.current_pic_id == null
        ? null
        : event.pics.find(
            pic =>
              pic.id != null &&
              String(pic.id) ===
                String(
                  master.current_pic_id
                )
          );

    const myColor =
      myPic
        ? picColor(myPic)
        : null;

    const stripe =
      colors.length > 1
        ? `linear-gradient(
            to bottom,
            ${colors
              .map(
                (item, index) =>
                  `${item.border} ` +
                  `${index / colors.length * 100}% ` +
                  `${(index + 1) / colors.length * 100}%`
              )
              .join(',')}
          )`
        : color.border;

    const cardBackground =
      colors.length > 1
        ? `linear-gradient(
            135deg,
            ${colors
              .map(
                (item, index) =>
                  `${item.background} ` +
                  `${index / (colors.length - 1) * 100}%`
              )
              .join(',')}
          )`
        : color.background;

    const badges = event.pics
      .map(pic => {
        const badgeColor =
          picColor(pic);

        return `
          <span
            class="pic-badge"
            style="
              --pic-color:${badgeColor.border};
              --pic-bg:${badgeColor.background}
            "
          >
            ${escapeHtml(pic.name)}
          </span>
        `;
      })
      .join('');

    const width =
      100 / event.columns;

    const top =
      event.start /
      60 *
      HOUR_HEIGHT;

    const height =
      (event.end - event.start) /
      60 *
      HOUR_HEIGHT;

    const position =
      `top:${top}px;` +
      `height:${height}px;` +
      `left:calc(${event.column * width}% + 3px);` +
      `width:calc(${width}% - 6px);`;

    return `
      <article
        class="event${myPic ? ' own-event' : ''}"
        role="button"
        tabindex="0"
        data-event-id="${escapeHtml(event.id)}"
        style="
          ${position}
          --pic-color:${color.border};
          --pic-bg:${cardBackground};
          --pic-stripe:${stripe};
          ${myColor
            ? `--own-color:${myColor.own};`
            : ''}
        "
        aria-label="${escapeHtml(
          `Lihat detail agenda ${event.agenda}, ` +
          `${event.time}–${event.end_time}, ` +
          `${event.pic}` +
          (myPic ? ', agenda saya' : '')
        )}"
      >
        <div class="event-time">
          ${escapeHtml(event.time)}–${escapeHtml(event.end_time)} WIB
        </div>

                ${googleDeliveryBadge(event.id)}

        <h3 class="event-title">
          ${escapeHtml(event.agenda)}
        </h3>

        <div
          class="event-pics"
          aria-label="PIC: ${escapeHtml(event.pic)}"
        >
          ${badges}
        </div>

        <p>
          <strong>Link/Lokasi:</strong>
          ${escapeHtml(event.meeting || '—')}
        </p>

        <p>
          <strong>Proyek:</strong>
          ${escapeHtml(
            event.project || 'Belum ada proyek'
          )}
        </p>

        <p class="notes">
          <strong>Catatan:</strong>
          ${escapeHtml(event.notes || '—')}
        </p>
      </article>
    `;
  }

  // ======================================================
  // RENDER KALENDER
  // ======================================================

  function render() {
    const pic =
      $('pic-filter').value;

    const project = projectText(
      $('project-filter').value
    );

    const query = $('search')
      .value
      .trim()
      .toLocaleLowerCase('id');

    const range =
      calendarRange();

    const visible = events.filter(
      event =>
        event.date >= range.from &&
        event.date <= range.to &&
        (
          !pic ||
          event.pics.some(
            row =>
              (
                row.id ||
                `legacy:${row.name}`
              ) === pic
          )
        ) &&
       (
          !project ||
          projectText(event.project).includes(project)
        )&&
        (
          !query ||
          [
            event.agenda,
            event.pic,
            event.project,
            event.meeting,
            event.notes
          ].some(
            value =>
              String(value || '')
                .toLocaleLowerCase('id')
                .includes(query)
          )
        )
    );

    const formatter =
      new Intl.DateTimeFormat(
        'id-ID',
        {
          timeZone: 'UTC',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }
      );

    $('date-title').textContent =
      formatter.formatRange(
        new Date(
          `${range.from}T12:00:00Z`
        ),
        new Date(
          `${range.to}T12:00:00Z`
        )
      );

    $('status').textContent =
      loadError ||
      (
        `${visible.length} agenda` +
        (
          query || pic || project
            ? ' sesuai filter'
            : ''
        ) +
        ' minggu ini · WIB'
      );

    const legend = new Map();

    for (const event of visible) {
      for (
        const eventPic of event.pics
      ) {
        legend.set(
          eventPic.id ||
            `legacy:${eventPic.name}`,

          eventPic
        );
      }
    }

    $('legend').innerHTML =
      [...legend.values()]
        .map(
          eventPic => `
            <span>
              <i
                class="swatch"
                style="
                  --pic-color:${picColor(eventPic).border}
                "
              ></i>

              ${escapeHtml(eventPic.name)}
            </span>
          `
        )
        .join('');

    renderWeek(visible);
  }

  function renderWeek(visible) {
    const today =
      todayKey();

    const days =
      weekDays(
        $('view-date').value
      );

    const conflicts =
      findPicConflicts(events);

    const names = [
      'Minggu',
      'Senin',
      'Selasa',
      'Rabu',
      'Kamis',
      'Jumat',
      'Sabtu'
    ];

    const layouts = days.map(
      day =>
        layoutEvents(
          visible.filter(
            event =>
              event.date === day.key
          )
        )
    );

    const widths = layouts.map(
      layout =>
        Math.max(
          180,

          ...layout.map(
            event =>
              event.columns * 145
          )
        )
    );

    $('week-board').style.setProperty(
      '--week-cols',

      `64px ${widths
        .map(
          width =>
            `minmax(${width}px,1fr)`
        )
        .join(' ')}`
    );

    $('week-board').style.minWidth =
      `${
        64 +
        widths.reduce(
          (total, width) =>
            total + width,
          0
        )
      }px`;

    $('week-head').innerHTML =
      '<div class="zone-label">WIB<br>GMT+7</div>' +
      days
        .map(day => {
          const valid =
            day.key.length === 10 &&
            day.key >= '1000-01-01';

          const conflict =
            conflicts.get(day.key);

          return `
            <div
              class="week-day-head
                ${day.key === today
                  ? ' current'
                  : ''}
                ${day.weekday === 0 ||
                  day.weekday === 6
                  ? ' weekend'
                  : ''}
                ${conflict
                  ? ' has-conflict'
                  : ''}"
            >
              <span>
                ${names[day.weekday]}
              </span>

              <button
                class="date-number"
                data-new-date="${escapeHtml(day.key)}"
                ${!valid ? 'disabled' : ''}
                aria-label="Tambah agenda ${escapeHtml(day.key)}"
              >
                ${day.day}
              </button>

              ${conflictAlert(conflict)}
            </div>
          `;
        })
        .join('');

    const hours = Array.from(
      { length: 24 },

      (_, hour) => `
        <div class="hour-label">
          ${String(hour).padStart(2, '0')}:00
        </div>
      `
    ).join('');

    $('week-columns').innerHTML =
      `
        <div
          class="hours"
          aria-hidden="true"
        >
          ${hours}
        </div>
      ` +
      days
        .map((day, index) => {
          const valid =
            day.key.length === 10 &&
            day.key >= '1000-01-01';

          const slots = Array.from(
            { length: 24 },

            (_, hour) => `
              <button
                class="slot"
                style="
                  top:${hour * HOUR_HEIGHT}px
                "
                data-hour="${hour}"
                data-date="${escapeHtml(day.key)}"
                ${!valid ? 'disabled' : ''}
                aria-label="Tambah agenda ${escapeHtml(day.key)} ${String(hour).padStart(2, '0')}:00"
              >
                <span>＋</span>
              </button>
            `
          ).join('');

          return `
            <section
              class="track
                ${day.key === today
                  ? ' today-track'
                  : ''}
                ${index === 0 ||
                  index === 6
                  ? ' weekend-track'
                  : ''}"
              data-column-date="${escapeHtml(day.key)}"
              aria-label="Agenda ${escapeHtml(day.key)}"
            >
              ${slots}

              ${layouts[index]
                .map(eventCard)
                .join('')}
            </section>
          `;
        })
        .join('');

    updateCurrentTime();
    renderGoogleDelivery();
  }

  function updateCurrentTime() {
    document
      .querySelector('#now-line')
      ?.remove();

    const today =
      todayKey();

    const track = [
      ...document.querySelectorAll(
        '[data-column-date]'
      )
    ].find(
      node =>
        node.dataset.columnDate === today
    );

    if (!track) {
      return;
    }

    const parts =
      new Intl.DateTimeFormat(
        'en-GB',
        {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23'
        }
      ).formatToParts(new Date());

    const part = type =>
      Number(
        parts.find(
          item =>
            item.type === type
        ).value
      );

    const line =
      document.createElement('div');

    line.id = 'now-line';
    line.className = 'now-line';

    line.setAttribute(
      'aria-hidden',
      'true'
    );

    line.style.top =
      `${
        (
          part('hour') * 60 +
          part('minute')
        ) /
        60 *
        HOUR_HEIGHT
      }px`;

    track.append(line);
  }

  // ======================================================
  // LOAD DATA
  // ======================================================

  async function loadDay({
    scroll = false
  } = {}) {
    const number =
      ++requestNumber;

    const range =
      calendarRange();

    loadError = '';
    events = [];

    render();

    $('status').textContent =
      'Memuat agenda…';

    try {
      const rows = await api(
        `?from=${encodeURIComponent(range.from)}` +
        `&to=${encodeURIComponent(range.to)}`
      );

      if (
        number !== requestNumber
      ) {
        return;
      }

      if (!Array.isArray(rows)) {
        throw new Error(
          'Format daftar agenda tidak valid.'
        );
      }

      events = rows;
      refreshGoogleJobs(true);

      refreshFilters();
      render();

      if (scroll) {
        $('calendar-scroll').scrollTop =
          8 * HOUR_HEIGHT;
      }

    } catch (error) {
      if (
        number !== requestNumber
      ) {
        return;
      }

      loadError =
        error.message;

      render();

      notify(error.message);
    }
  }

  async function reload(
    options = {}
  ) {
    if (saving) {
      return;
    }

    ready = false;

    try {
      master = await api(
        '/options'
      );

      if (
        !Array.isArray(master.pics) ||
        !Array.isArray(master.projects)
      ) {
        throw new Error(
          'Respons master tidak valid.'
        );
      }

      ready = true;

      await loadDay(options);

    } catch (error) {
      loadError =
        error.message;

      render();

      notify(error.message);
    }
  }

  // ======================================================
  // FORM MEETING
  // ======================================================

  function updateMeetingLabel() {
    const online =
      $('meeting-type').value ===
      'online';

    $('meeting-label').textContent =
      online
        ? 'Link meeting *'
        : 'Lokasi meeting *';

    $('meeting').placeholder =
      online
        ? 'https://meet.google.com/…'
        : 'Ruang meeting / alamat';
  }

  // ======================================================
  // PILIHAN PROYEK
  // ======================================================

  function toggleProjectField() {
    const noProject =
      $('no-project').checked;

    $('project').setCustomValidity('');

    $('project').required =
      !noProject;

    $('project').disabled =
      saving || noProject;

    $('project-search').disabled =
      saving || noProject;

    $('project-required').hidden =
      noProject;

    if (noProject) {
      $('project').value = '';

      $('project-search').value = '';
    }
  }

  function closeProjectOptions() {
    $('project-options').hidden = true;

    $('project-search').setAttribute(
      'aria-expanded',
      'false'
    );
  }

 function projectText(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('id');
}

function searchProjects() {
  if (
    $('project-search').disabled
  ) {
    return;
  }

  const query = projectText(
    $('project-search').value
  );

  const candidates = [
    ...master.projects
  ];

  const old = events.find(
    row =>
      String(row.id) ===
      $('event-id').value
  );

  // Proyek lama tetap tersedia ketika mengedit agenda.
  if (
    old?.project_id &&
    !candidates.some(
      row =>
        String(row.id) ===
        String(old.project_id)
    )
  ) {
    candidates.unshift({
      id: old.project_id,
      name: old.project,
      legacy: true
    });
  }

  // Nama lengkap yang cocok dengan satu proyek
  // langsung dipilih tanpa perlu membuka daftar.
  const exact = candidates.filter(
    row =>
      projectText(row.name) === query
  );

  if (
    query &&
    exact.length === 1
  ) {
    $('project').value =
      String(exact[0].id);

    $('project-search')
      .setCustomValidity('');

    closeProjectOptions();

    return;
  }

  // Jangan menampilkan seluruh daftar saat kolom kosong.
  if (query.length < 2) {
    closeProjectOptions();

    return;
  }

  const matches = candidates.filter(
    row =>
      projectText(row.name)
        .includes(query)
  );

  const rows =
    matches.slice(0, 10);

  $('project-options').innerHTML =
    rows.length
      ? (
          rows.map(
            row => `
              <button
                type="button"
                role="option"
                data-project-id="${escapeHtml(row.id)}"
              >
                ${escapeHtml(row.name)}
                ${row.legacy ? ' (proyek lama)' : ''}
              </button>
            `
          ).join('') +

          (
            matches.length > 10
              ? `
                  <p>
                    Ketik nama lebih lengkap
                    untuk mempersempit hasil.
                  </p>
                `
              : ''
          )
        )
      : '<p>Tidak ada proyek yang cocok.</p>';

  const input =
    $('project-search')
      .getBoundingClientRect();

  const list =
    $('project-options');

  list.style.left =
    `${input.left}px`;

  list.style.top =
    `${input.bottom + 5}px`;

  list.style.width =
    `${input.width}px`;

  list.hidden = false;

  $('project-search').setAttribute(
    'aria-expanded',
    'true'
  );
}
  // ======================================================
  // MODAL DETAIL
  // ======================================================

  function openView(event) {
    if (!event || saving) {
      return;
    }

    viewedEventId =
      String(event.id);

    $('view-title').textContent =
      event.agenda;

    $('view-date-info').textContent =
      new Intl.DateTimeFormat(
        'id-ID',
        {
          timeZone: 'UTC',
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }
      ).format(
        new Date(
          `${event.date}T12:00:00Z`
        )
      );

    $('view-time-info').textContent =
      `${event.time}–${event.end_time} WIB`;

    $('view-project').textContent =
      event.no_project
        ? 'Belum ada proyek'
        : event.project || '—';

    $('view-type').textContent =
      event.type === 'online'
        ? 'Online'
        : 'Di lokasi';

    $('view-notes').textContent =
      event.notes || '—';

    const pics =
      $('view-pics');

    pics.replaceChildren();

    for (
      const pic of event.pics || []
    ) {
      const badge =
        document.createElement('span');

      const color =
        picColor(pic);

      badge.className =
        'pic-badge';

      badge.style.setProperty(
        '--pic-color',
        color.border
      );

      badge.style.setProperty(
        '--pic-bg',
        color.background
      );

      badge.textContent =
        pic.name;

      pics.append(badge);
    }

    if (!event.pics?.length) {
      pics.textContent = '—';
    }

    const meeting =
      $('view-meeting');

    meeting.replaceChildren();

    const link =
      safeLink(event.meeting);

    if (link) {
      const anchor =
        document.createElement('a');

      anchor.href = link;

      anchor.target = '_blank';

      anchor.rel =
        'noopener noreferrer';

      anchor.textContent =
        event.meeting;

      meeting.append(anchor);

    } else {
      meeting.textContent =
        event.meeting || '—';
    }

    $('view-dialog').showModal();
    updateGoogleDetails();
  }

  function closeView() {
    if (
      $('view-dialog').open
    ) {
      $('view-dialog').close();
    }

    viewedEventId = null;
  }

  // ======================================================
  // MODAL TAMBAH / EDIT
  // ======================================================

  function openForm(
    event = null,
    hour = 9,
    date = $('view-date').value
  ) {
    if (!ready || saving) {
      return;
    }

    $('agenda-form').reset();

    $('form-error').hidden = true;

    $('event-id').value =
      event?.id || '';

    $('dialog-title').textContent =
      event
        ? 'Edit agenda'
        : 'Tambah agenda';

    $('delete').hidden =
      !event;

    $('date').value =
      event?.date || date;

    $('repeat-fieldset').hidden =
      Boolean(event);

    $('repeat-enabled').checked =
      false;

    $('repeat-settings').hidden =
      true;

    $('repeat-end').value = '';

    $('repeat-end').required = false;

    for (
      const checkbox of
      document.querySelectorAll(
        'input[name="repeat-day"]'
      )
    ) {
      checkbox.checked = false;
    }

    $('time').value =
      event?.time ||
      timeText(hour * 60);

    $('end-time').value =
      event?.end_time ||
      timeText(
        (hour + 1) * 60
      );

    for (
      const field of [
        'agenda',
        'meeting',
        'notes'
      ]
    ) {
      $(field).value =
        event?.[field] || '';
    }

    const selected =
      new Set(
        event?.pic_ids || []
      );

    $('pic-options')
      .replaceChildren();

    for (
      const pic of master.pics
    ) {
      const label =
        document.createElement('label');

      const check =
        document.createElement('input');

      check.type = 'checkbox';

      check.name = 'pic_ids';

      check.value = pic.id;

      check.checked =
        selected.has(pic.id);

      label.append(
        check,

        document.createTextNode(
          pic.name
        )
      );

      $('pic-options').append(
        label
      );
    }

    updatePicCount();

    $('project-search').value =
      event?.project || '';

    $('project').value =
      event?.project_id || '';

    closeProjectOptions();

    $('no-project').checked =
      event?.no_project === true;

    toggleProjectField();

    $('meeting-type').value =
      event?.type || 'online';

    updateMeetingLabel();

    $('dialog').showModal();

    $('agenda').focus();
  }

  function closeForm() {
    if (!saving) {
      $('dialog').close();
    }
  }

  function setSaving(value) {
    saving = value;

    for (
      const control of
      $('agenda-form').elements
    ) {
      control.disabled = value;
    }

    toggleProjectField();
  }

  function formError(message) {
    $('form-error').textContent =
      message;

    $('form-error').hidden =
      false;
  }

  function selectedPicIds() {
    return [
      ...document.querySelectorAll(
        '#pic-options input:checked'
      )
    ].map(
      input =>
        input.value
    );
  }

  function updatePicCount() {
    $('pic-selected').textContent =
      `${selectedPicIds().length} PIC dipilih`;
  }

  // ======================================================
  // SIMPAN AGENDA
  // ======================================================

  async function saveAgenda(event) {
  event.preventDefault();

  if (saving) {
    return;
  }

  toggleProjectField();

  $('form-error').hidden = true;

  for (
    const field of [
      'agenda',
      'meeting',
      'notes',
      'end-time'
    ]
  ) {
    $(field).value =
      $(field).value.trim();
  }

  if (
    !$('agenda').value ||
    !$('meeting').value
  ) {
    return formError(
      'Agenda dan link/lokasi wajib diisi.'
    );
  }

  if (
    !$('agenda-form').reportValidity()
  ) {
    return;
  }

  const picIds =
    selectedPicIds();

  if (!picIds.length) {
    return formError(
      'Pilih minimal satu PIC dari Master PIC.'
    );
  }

  if (
    minutes(
      $('end-time').value
    ) <=
    minutes(
      $('time').value
    )
  ) {
    return formError(
      'Jam selesai harus setelah jam mulai.'
    );
  }

  if (
    $('meeting-type').value === 'online' &&
    !safeLink(
      $('meeting').value
    )
  ) {
    return formError(
      'Link meeting harus diawali http:// atau https://.'
    );
  }

  // ======================================================
  // VALIDASI PROYEK YANG DIKETIK
  // ======================================================

  const noProject =
    $('no-project').checked;

  if (!noProject) {
    $('project-search').value =
      $('project-search').value.trim();

    // Cocokkan nama lengkap jika proyek belum terpilih.
    if (!$('project').value) {
      searchProjects();
    }

    if (!$('project').value) {
      $('project-search').focus();

      return formError(
        'Ketik nama proyek lengkap atau pilih salah satu hasil pencarian.'
      );
    }
  }

  const id =
    $('event-id').value;

  const body = {
    agenda:
      $('agenda').value,

    date:
      $('date').value,

    time:
      $('time').value,

    end_time:
      $('end-time').value,

    pic_ids:
      picIds,

    no_project:
      noProject,

    project_id:
      noProject
        ? null
        : $('project').value,

    type:
      $('meeting-type').value,

    meeting:
      $('meeting').value,

    notes:
      $('notes').value
  };

  // ======================================================
  // PERULANGAN AGENDA
  // ======================================================

  if (
    !id &&
    $('repeat-enabled').checked
  ) {
    const weekdays = [
      ...document.querySelectorAll(
        'input[name="repeat-day"]:checked'
      )
    ].map(
      input =>
        Number(input.value)
    );

    if (!weekdays.length) {
      return formError(
        'Pilih minimal satu hari perulangan.'
      );
    }

    if (
      !$('repeat-end').value ||
      $('repeat-end').value <
      $('date').value
    ) {
      return formError(
        'Tanggal akhir perulangan harus sama atau setelah tanggal mulai.'
      );
    }

    body.repeat = {
      start_date:
        $('date').value,

      end_date:
        $('repeat-end').value,

      weekdays
    };
  }

  // ======================================================
  // KIRIM KE SERVER
  // ======================================================

  setSaving(true);

  let saved;

  try {
    saved = await api(
      id
        ? `/${encodeURIComponent(id)}`
        : '',

      {
        method:
          id
            ? 'PUT'
            : 'POST',

        body:
          JSON.stringify(body)
      }
    );

  } catch (error) {
    formError(
      error.message
    );

    return;

  } finally {
    setSaving(false);
  }

  // ======================================================
  // PERBARUI TAMPILAN
  // ======================================================

  $('dialog').close();

  $('view-date').value =
    saved.date;

  $('search').value = '';

  $('pic-filter').value = '';

  $('project-filter').value = '';

  googleJobs.delete(
    String(saved.id)
  );

  googleJobsRequest++;

  notify(
    (
      saved.created_count > 1
        ? `${saved.created_count} agenda berulang berhasil disimpan.`
        : 'Agenda berhasil disimpan.'
    ) +
    (
      saved.google_status === 'pending'
        ? ' Undangan Google berstatus Pending.'
        : ''
    )
  );

  await loadDay();
}

  // ======================================================
  // HAPUS AGENDA
  // ======================================================

  async function deleteAgenda() {
    if (
      saving ||
      !confirm(
        'Hapus agenda ini?'
      )
    ) {
      return;
    }

    const id =
      $('event-id').value;

    setSaving(true);

    try {
      await api(
        `/${encodeURIComponent(id)}`,

        {
          method: 'DELETE'
        }
      );

    } catch (error) {
      formError(
        error.message
      );

      return;

    } finally {
      setSaving(false);
    }

    $('dialog').close();

    notify(
      'Agenda berhasil dihapus.'
    );

    await loadDay();
  }

  // ======================================================
  // NAVIGASI MINGGU
  // ======================================================

  function shiftWeek(amount) {
    const date = new Date(
      `${$('view-date').value}T12:00:00Z`
    );

    date.setUTCDate(
      date.getUTCDate() +
      amount * 7
    );

    const key =
      utcKey(date);

    if (
      key.length !== 10 ||
      key < '1000-01-01'
    ) {
      return;
    }

    $('view-date').value = key;

    loadDay({
      scroll: true
    });
  }

  // ======================================================
  // EVENT LISTENERS
  // ======================================================

  $('view-date').value =
    todayKey();

  $('prev').addEventListener(
    'click',
    () => shiftWeek(-1)
  );

  $('next').addEventListener(
    'click',
    () => shiftWeek(1)
  );

  $('today').addEventListener(
    'click',
    () => {
      $('view-date').value =
        todayKey();

      loadDay({
        scroll: true
      });
    }
  );

  $('view-date').addEventListener(
    'change',
    () => {
      if (
        $('view-date').reportValidity()
      ) {
        loadDay({
          scroll: true
        });
      }
    }
  );

  $('repeat-enabled').addEventListener(
    'change',
    () => {
      const aktif =
        $('repeat-enabled').checked;

      $('repeat-settings').hidden =
        !aktif;

      $('repeat-end').required =
        aktif;

      if (
        aktif &&
        !$('repeat-end').value
      ) {
        $('repeat-end').value =
          $('date').value;
      }
    }
  );

  $('reload').addEventListener(
    'click',
    () => reload()
  );

  $('close').addEventListener(
    'click',
    closeForm
  );

  $('cancel').addEventListener(
    'click',
    closeForm
  );

  $('view-close').addEventListener(
    'click',
    closeView
  );

  $('view-cancel').addEventListener(
    'click',
    closeView
  );

  $('view-dialog').addEventListener(
    'close',
    () => {
      viewedEventId = null;
    }
  );

  $('view-edit').addEventListener(
    'click',
    () => {
      const event = events.find(
        row =>
          String(row.id) ===
          viewedEventId
      );

      closeView();

      if (event) {
        openForm(event);
      }
    }
  );

  $('delete').addEventListener(
    'click',
    deleteAgenda
  );

  $('agenda-form').addEventListener(
    'submit',
    saveAgenda
  );

  $('dialog').addEventListener(
    'cancel',
    event => {
      if (saving) {
        event.preventDefault();
      }
    }
  );

  $('meeting-type').addEventListener(
    'change',
    updateMeetingLabel
  );

  $('no-project').addEventListener(
    'change',
    toggleProjectField
  );

  $('no-project').addEventListener(
    'input',
    toggleProjectField
  );

  $('project-search').addEventListener(
    'input',
    () => {
      $('project').value = '';

      $('project-search')
        .setCustomValidity('');

      searchProjects();
    }
  );

  $('project-options').addEventListener(
    'click',
    event => {
      const option =
        event.target.closest(
          '[data-project-id]'
        );

      if (!option) {
        return;
      }

      $('project').value =
        option.dataset.projectId;

      $('project-search').value =
        option.textContent.trim();

      $('project-search')
        .setCustomValidity('');

      closeProjectOptions();
    }
  );

  $('pic-options').addEventListener(
    'change',
    updatePicCount
  );

  $('pic-search').addEventListener(
    'input',
    () => {
      const query =
        $('pic-search')
          .value
          .trim()
          .toLocaleLowerCase('id');

      for (
        const label of
        $('pic-options').children
      ) {
        label.hidden =
          !label.textContent
            .toLocaleLowerCase('id')
            .includes(query);
      }
    }
  );

  $('week-board').addEventListener(
    'click',
    event => {
      const card =
        event.target.closest(
          '[data-event-id]'
        );

      if (card) {
        return openView(
          events.find(
            row =>
              String(row.id) ===
              card.dataset.eventId
          )
        );
      }

      const date =
        event.target.closest(
          '[data-new-date]'
        );

      if (date) {
        return openForm(
          null,
          9,
          date.dataset.newDate
        );
      }

      const slot =
        event.target.closest(
          '[data-hour]'
        );

      if (slot) {
        openForm(
          null,

          Number(
            slot.dataset.hour
          ),

          slot.dataset.date
        );
      }
    }
  );

  $('week-board').addEventListener(
    'keydown',
    event => {
      if (
        event.key !== 'Enter' &&
        event.key !== ' '
      ) {
        return;
      }

      const card =
        event.target.closest(
          '[data-event-id]'
        );

      if (
        !card ||
        event.target !== card
      ) {
        return;
      }

      event.preventDefault();

      openView(
        events.find(
          row =>
            String(row.id) ===
            card.dataset.eventId
        )
      );
    }
  );

  $('pic-filter').addEventListener(
  'change',
  render
);

$('project-filter').addEventListener(
  'input',
  render
);

  $('search').addEventListener(
    'input',
    render
  );

  // ======================================================
  // INISIALISASI
  // ======================================================

  initGoogleMonitoring();
  render();

  reload({
    scroll: true
  });

  setInterval(
    updateCurrentTime,
    60000
  );
})();