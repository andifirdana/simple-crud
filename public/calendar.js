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

  function todayKey() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const part = name =>
      parts.find(item => item.type === name).value;

    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function minutes(value) {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  function timeText(value) {
    return (
      `${String(Math.floor(value / 60)).padStart(2, '0')}:` +
      `${String(value % 60).padStart(2, '0')}`
    );
  }

  function utcKey(date) {
    return date.toISOString().split('T')[0];
  }

  function weekDays(value) {
    const date = new Date(`${value}T12:00:00Z`);
    const offset = date.getUTCDay();

    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(date);
      day.setUTCDate(date.getUTCDate() - offset + index);

      return {
        key: utcKey(day),
        day: day.getUTCDate(),
        weekday: index
      };
    });
  }

  function calendarRange() {
    const days = weekDays($('view-date').value);

    return {
      from: days[0].key < '1000-01-01'
        ? '1000-01-01'
        : days[0].key,
      to: days[6].key.length > 10
        ? '9999-12-31'
        : days[6].key
    };
  }

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

      return ['http:', 'https:'].includes(url.protocol)
        ? url.href
        : null;
    } catch {
      return null;
    }
  }

  function picColor(pic) {
    const key = pic.id || `legacy:${pic.name}`;
    let hash = 0;

    for (const letter of key) {
      hash = (
        Math.imul(hash, 31) +
        letter.charCodeAt(0)
      ) >>> 0;
    }

    const palette = [
      { border: '#ffcc33', background: '#fff0b2', own: '#896000' },
      { border: '#ff6fae', background: '#ffc8e0', own: '#9d245d' },
      { border: '#ff9f1c', background: '#ffdaad', own: '#9a4e00' },
      { border: '#2ec4b6', background: '#b9f0e9', own: '#08796f' },
      { border: '#1a7fd1', background: '#bfdefb', own: '#14588f' },
      { border: '#835af3', background: '#ddd1ff', own: '#5435a5' },
      { border: '#ff625f', background: '#ffc9c5', own: '#a32f31' },
      { border: '#91c925', background: '#e5f6b0', own: '#567a0c' },
      { border: '#df57cb', background: '#f7cff0', own: '#903179' },
      { border: '#00a9cb', background: '#bdeef8', own: '#006b86' }
    ];

    return palette[hash % palette.length];
  }

  async function api(path = '', options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        ...options.headers,
        ...(options.body
          ? { 'Content-Type': 'application/json' }
          : {})
      }
    });

    const result = await response.json().catch(() => null);

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

  function notify(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      $('toast').hidden = true;
    }, 4500);
  }

  function fillSelect(id, rows, placeholder, selected = '') {
    const select = $(id);

    select.replaceChildren(new Option(placeholder, ''));

    for (const row of rows) {
      select.add(new Option(row.name, String(row.id)));
    }

    select.value = selected;
  }

  function filterRows(rows, field, name) {
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
        first.name.localeCompare(second.name, 'id')
    );
  }

  function refreshFilters() {
    const pics = new Map(
      master.pics.map(row => [row.id, row])
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

    fillSelect(
      'project-filter',
      filterRows(master.projects, 'project_id', 'project'),
      'Semua proyek',
      $('project-filter').value
    );
  }

  function findPicConflicts(rows) {
    const groups = new Map();
    const conflicts = new Map();

    for (const event of rows) {
      const start = minutes(event.time);
      const end = minutes(event.end_time);

      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start
      ) {
        continue;
      }

      const seen = new Set();

      for (const pic of event.pics || []) {
        const picId = pic.id == null
          ? `legacy:${String(pic.name || '')
              .trim()
              .toLocaleLowerCase('id')}`
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

        const key = `${event.date}\u0000${picId}`;

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

    for (const group of groups.values()) {
      group.sort(
        (first, second) =>
          first.start - second.start ||
          first.end - second.end
      );

      let active = [];

      for (const current of group) {
        active = active.filter(
          previous => previous.end > current.start
        );

        for (const previous of active) {
          if (
            String(previous.event.id) ===
            String(current.event.id)
          ) {
            continue;
          }

          const date = current.event.date;

          if (!conflicts.has(date)) {
            conflicts.set(date, {
              pics: new Map(),
              details: []
            });
          }

          const conflict = conflicts.get(date);

          conflict.pics.set(
            current.picId,
            current.pic.name
          );

          const overlap =
            `${timeText(Math.max(
              previous.start,
              current.start
            ))}–${timeText(Math.min(
              previous.end,
              current.end
            ))}`;

          conflict.details.push(
            `${current.pic.name} · ${overlap}: ` +
            `${previous.event.agenda} ↔ ${current.event.agenda}`
          );
        }

        active.push(current);
      }
    }

    return conflicts;
  }

  function conflictAlert(conflict) {
    if (!conflict) return '';

    const names = [...conflict.pics.values()].join(', ');

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
            .map(detail => `<li>${escapeHtml(detail)}</li>`)
            .join('')}
        </ul>

        <p class="conflict-note">
          Termasuk agenda di luar filter.
        </p>
      </details>
    `;
  }

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
          String(first.id).localeCompare(String(second.id))
      );

    const result = [];

    let group = [];
    let groupEnd = -1;
    let groupIndex = 0;

    function finishGroup() {
      const columnEnds = [];

      for (const event of group) {
        let column = columnEnds.findIndex(
          end => end <= event.start
        );

        if (column === -1) {
          column = columnEnds.length;
        }

        columnEnds[column] = event.end;
        event.column = column;
      }

      for (const event of group) {
        result.push({
          ...event,
          columns: columnEnds.length,
          group: groupIndex
        });
      }

      group = [];
      groupIndex++;
    }

    for (const event of sorted) {
      if (group.length && event.start >= groupEnd) {
        finishGroup();
      }

      if (!group.length) {
        groupEnd = event.end;
      } else {
        groupEnd = Math.max(groupEnd, event.end);
      }

      group.push(event);
    }

    finishGroup();

    return result;
  }

  function eventCard(event) {
    const colors = event.pics.map(picColor);

    const color =
      colors[0] ||
      picColor({ name: 'Belum ada PIC' });

    const myPic =
      master.current_pic_id == null
        ? null
        : event.pics.find(
            pic =>
              pic.id != null &&
              String(pic.id) ===
                String(master.current_pic_id)
          );

    const myColor = myPic
      ? picColor(myPic)
      : null;

    const stripe = colors.length > 1
      ? `linear-gradient(
          to bottom,
          ${colors.map(
            (item, index) =>
              `${item.border} ` +
              `${index / colors.length * 100}% ` +
              `${(index + 1) / colors.length * 100}%`
          ).join(',')}
        )`
      : color.border;

    const cardBackground = colors.length > 1
      ? `linear-gradient(
          135deg,
          ${colors.map(
            (item, index) =>
              `${item.background} ` +
              `${index / (colors.length - 1) * 100}%`
          ).join(',')}
        )`
      : color.background;

    const badges = event.pics
      .map(pic => {
        const badgeColor = picColor(pic);

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

    const width = 100 / event.columns;

    const top =
      event.start / 60 * HOUR_HEIGHT;

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

  function render() {
    const pic = $('pic-filter').value;
    const project = $('project-filter').value;

    const query = $('search')
      .value
      .trim()
      .toLocaleLowerCase('id');

    const range = calendarRange();

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
          (
            event.project_id ||
            `legacy:${event.project}`
          ) === project
        ) &&
        (
          !query ||
          [
            event.agenda,
            event.pic,
            event.project,
            event.meeting,
            event.notes
          ].some(value =>
            String(value || '')
              .toLocaleLowerCase('id')
              .includes(query)
          )
        )
    );

    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    $('date-title').textContent =
      formatter.formatRange(
        new Date(`${range.from}T12:00:00Z`),
        new Date(`${range.to}T12:00:00Z`)
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
      for (const eventPic of event.pics) {
        legend.set(
          eventPic.id ||
            `legacy:${eventPic.name}`,
          eventPic
        );
      }
    }

    $('legend').innerHTML =
      [...legend.values()]
        .map(eventPic => `
          <span>
            <i
              class="swatch"
              style="--pic-color:${picColor(eventPic).border}"
            ></i>
            ${escapeHtml(eventPic.name)}
          </span>
        `)
        .join('');

    renderWeek(visible);
  }

  function renderWeek(visible) {
    const today = todayKey();
    const days = weekDays($('view-date').value);
    const conflicts = findPicConflicts(events);

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
            event => event.date === day.key
          )
        )
    );

    const widths = layouts.map(
      layout =>
        Math.max(
          180,
          ...layout.map(event => event.columns * 145)
        )
    );

    $('week-board').style.setProperty(
      '--week-cols',
      `64px ${widths
        .map(width => `minmax(${width}px,1fr)`)
        .join(' ')}`
    );

    $('week-board').style.minWidth =
      `${
        64 +
        widths.reduce(
          (total, width) => total + width,
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

          const conflict = conflicts.get(day.key);

          return `
            <div
              class="week-day-head
                ${day.key === today ? ' current' : ''}
                ${day.weekday === 0 || day.weekday === 6
                  ? ' weekend'
                  : ''}
                ${conflict ? ' has-conflict' : ''}"
            >
              <span>${names[day.weekday]}</span>

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
        <div class="hours" aria-hidden="true">
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
                style="top:${hour * HOUR_HEIGHT}px"
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
                ${day.key === today ? ' today-track' : ''}
                ${index === 0 || index === 6
                  ? ' weekend-track'
                  : ''}"
              data-column-date="${escapeHtml(day.key)}"
              aria-label="Agenda ${escapeHtml(day.key)}"
            >
              ${slots}
              ${layouts[index].map(eventCard).join('')}
            </section>
          `;
        })
        .join('');

    updateCurrentTime();
  }

  function updateCurrentTime() {
    document.querySelector('#now-line')?.remove();

    const today = todayKey();

    const track = [
      ...document.querySelectorAll('[data-column-date]')
    ].find(
      node => node.dataset.columnDate === today
    );

    if (!track) return;

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());

    const part = type =>
      Number(
        parts.find(item => item.type === type).value
      );

    const line = document.createElement('div');

    line.id = 'now-line';
    line.className = 'now-line';
    line.setAttribute('aria-hidden', 'true');

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

  async function loadDay({ scroll = false } = {}) {
    const number = ++requestNumber;
    const range = calendarRange();

    loadError = '';
    events = [];

    render();
    $('status').textContent = 'Memuat agenda…';

    try {
      const rows = await api(
        `?from=${encodeURIComponent(range.from)}` +
        `&to=${encodeURIComponent(range.to)}`
      );

      if (number !== requestNumber) return;

      if (!Array.isArray(rows)) {
        throw new Error('Format daftar agenda tidak valid.');
      }

      events = rows;
      refreshFilters();
      render();

      if (scroll) {
        $('calendar-scroll').scrollTop =
          8 * HOUR_HEIGHT;
      }
    } catch (error) {
      if (number !== requestNumber) return;

      loadError = error.message;
      render();
      notify(error.message);
    }
  }

  async function reload(options = {}) {
    if (saving) return;

    ready = false;

    try {
      master = await api('/options');

      if (
        !Array.isArray(master.pics) ||
        !Array.isArray(master.projects)
      ) {
        throw new Error('Respons master tidak valid.');
      }

      ready = true;

      await loadDay(options);
    } catch (error) {
      loadError = error.message;
      render();
      notify(error.message);
    }
  }

  function updateMeetingLabel() {
    const online =
      $('meeting-type').value === 'online';

    $('meeting-label').textContent =
      online
        ? 'Link meeting *'
        : 'Lokasi meeting *';

    $('meeting').placeholder =
      online
        ? 'https://meet.google.com/…'
        : 'Ruang meeting / alamat';
  }

  function toggleProjectField() {
    const noProject =
      $('no-project').checked;

    $('project').setCustomValidity('');

    $('project').required =
      !noProject;

    $('project').disabled =
      saving || noProject;

    $('project-required').hidden =
      noProject;

    if (noProject) {
      $('project').value = '';
    }
  }

  function openView(event) {
    if (!event || saving) return;

    viewedEventId = String(event.id);
    $('view-title').textContent = event.agenda;

    $('view-date-info').textContent =
      new Intl.DateTimeFormat('id-ID', {
        timeZone: 'UTC',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(
        new Date(`${event.date}T12:00:00Z`)
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

    const pics = $('view-pics');
    pics.replaceChildren();

    for (const pic of event.pics || []) {
      const badge = document.createElement('span');
      const color = picColor(pic);

      badge.className = 'pic-badge';

      badge.style.setProperty(
        '--pic-color',
        color.border
      );

      badge.style.setProperty(
        '--pic-bg',
        color.background
      );

      badge.textContent = pic.name;
      pics.append(badge);
    }

    if (!event.pics?.length) {
      pics.textContent = '—';
    }

    const meeting = $('view-meeting');
    meeting.replaceChildren();

    const link = safeLink(event.meeting);

    if (link) {
      const anchor = document.createElement('a');

      anchor.href = link;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = event.meeting;

      meeting.append(anchor);
    } else {
      meeting.textContent = event.meeting || '—';
    }

    $('view-dialog').showModal();
  }

  function closeView() {
    if ($('view-dialog').open) {
      $('view-dialog').close();
    }

    viewedEventId = null;
  }

  function openForm(
    event = null,
    hour = 9,
    date = $('view-date').value
  ) {
    if (!ready || saving) return;

    $('agenda-form').reset();
    $('form-error').hidden = true;

    $('event-id').value = event?.id || '';
    $('dialog-title').textContent =
      event ? 'Edit agenda' : 'Tambah agenda';

    $('delete').hidden = !event;
    $('date').value = event?.date || date;

    $('time').value =
      event?.time ||
      timeText(hour * 60);

    $('end-time').value =
      event?.end_time ||
      timeText((hour + 1) * 60);

    for (const field of ['agenda', 'meeting', 'notes']) {
      $(field).value = event?.[field] || '';
    }

    const selected = new Set(
      event?.pic_ids || []
    );

    $('pic-options').replaceChildren();

    for (const pic of master.pics) {
      const label = document.createElement('label');
      const check = document.createElement('input');

      check.type = 'checkbox';
      check.name = 'pic_ids';
      check.value = pic.id;
      check.checked = selected.has(pic.id);

      label.append(
        check,
        document.createTextNode(pic.name)
      );

      $('pic-options').append(label);
    }

    updatePicCount();

    fillSelect(
      'project',
      master.projects,
      'Pilih proyek aktif',
      event?.project_id || ''
    );

    if (
      event?.project_id &&
      !master.projects.some(
        row => String(row.id) === event.project_id
      )
    ) {
      $('project').add(
        new Option(
          `${event.project} (proyek lama)`,
          event.project_id
        )
      );

      $('project').value = event.project_id;
    }

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

    for (const control of $('agenda-form').elements) {
      control.disabled = value;
    }

    toggleProjectField();
  }

  function formError(message) {
    $('form-error').textContent = message;
    $('form-error').hidden = false;
  }

  function selectedPicIds() {
    return [
      ...document.querySelectorAll(
        '#pic-options input:checked'
      )
    ].map(input => input.value);
  }

  function updatePicCount() {
    $('pic-selected').textContent =
      `${selectedPicIds().length} PIC dipilih`;
  }

  async function saveAgenda(event) {
    event.preventDefault();

    if (saving) return;

    toggleProjectField();

    for (const field of [
      'agenda',
      'meeting',
      'notes',
      'end-time'
    ]) {
      $(field).value = $(field).value.trim();
    }

    if (
      !$('agenda').value ||
      !$('meeting').value
    ) {
      return formError(
        'Agenda dan link/lokasi wajib diisi.'
      );
    }

    if (!$('agenda-form').reportValidity()) {
      return;
    }

    if (!selectedPicIds().length) {
      return formError(
        'Pilih minimal satu PIC dari Master PIC.'
      );
    }

    if (
      minutes($('end-time').value) <=
      minutes($('time').value)
    ) {
      return formError(
        'Jam selesai harus setelah jam mulai.'
      );
    }

    if (
      $('meeting-type').value === 'online' &&
      !safeLink($('meeting').value)
    ) {
      return formError(
        'Link meeting harus diawali http:// atau https://.'
      );
    }

    const id = $('event-id').value;

    const body = {
      agenda: $('agenda').value,
      date: $('date').value,
      time: $('time').value,
      end_time: $('end-time').value,
      pic_ids: selectedPicIds(),
      no_project: $('no-project').checked,
      project_id: $('no-project').checked
        ? null
        : $('project').value,
      type: $('meeting-type').value,
      meeting: $('meeting').value,
      notes: $('notes').value
    };

    setSaving(true);

    let saved;

    try {
      saved = await api(
        id ? `/${encodeURIComponent(id)}` : '',
        {
          method: id ? 'PUT' : 'POST',
          body: JSON.stringify(body)
        }
      );
    } catch (error) {
      formError(error.message);
      return;
    } finally {
      setSaving(false);
    }

    $('dialog').close();
    $('view-date').value = saved.date;

    $('search').value = '';
    $('pic-filter').value = '';
    $('project-filter').value = '';

    notify('Agenda berhasil disimpan.');
    await loadDay();
  }

  async function deleteAgenda() {
    if (saving || !confirm('Hapus agenda ini?')) {
      return;
    }

    const id = $('event-id').value;
    setSaving(true);

    try {
      await api(
        `/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
    } catch (error) {
      formError(error.message);
      return;
    } finally {
      setSaving(false);
    }

    $('dialog').close();
    notify('Agenda berhasil dihapus.');
    await loadDay();
  }

  function shiftWeek(amount) {
    const date = new Date(
      `${$('view-date').value}T12:00:00Z`
    );

    date.setUTCDate(
      date.getUTCDate() + amount * 7
    );

    const key = utcKey(date);

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

  $('view-date').value = todayKey();

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
      $('view-date').value = todayKey();
      loadDay({ scroll: true });
    }
  );

  $('view-date').addEventListener(
    'change',
    () => {
      if ($('view-date').reportValidity()) {
        loadDay({ scroll: true });
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
          String(row.id) === viewedEventId
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

  $('pic-options').addEventListener(
    'change',
    updatePicCount
  );

  $('pic-search').addEventListener(
    'input',
    () => {
      const query = $('pic-search')
        .value
        .trim()
        .toLocaleLowerCase('id');

      for (const label of $('pic-options').children) {
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
      const card = event.target.closest(
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

      const date = event.target.closest(
        '[data-new-date]'
      );

      if (date) {
        return openForm(
          null,
          9,
          date.dataset.newDate
        );
      }

      const slot = event.target.closest(
        '[data-hour]'
      );

      if (slot) {
        openForm(
          null,
          Number(slot.dataset.hour),
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

      const card = event.target.closest(
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

  for (const id of [
    'pic-filter',
    'project-filter'
  ]) {
    $(id).addEventListener(
      'change',
      render
    );
  }

  $('search').addEventListener(
    'input',
    render
  );

  render();
  reload({ scroll: true });

  setInterval(
    updateCurrentTime,
    60000
  );
})();