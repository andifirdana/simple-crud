'use strict';

const crypto = require('node:crypto');

const CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.events.owned';

const TIME_ZONE = 'Asia/Jakarta';

module.exports = function registerGoogleCalendar(
  app,
  pool,
  options = {}
) {
  const google =
    options.google ||
    require('googleapis').google;

  const env =
    options.config ||
    process.env;

  // ======================================================
  // VALIDASI KONFIGURASI
  // ======================================================

  for (
    const key of [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REDIRECT_URI',
      'GOOGLE_DIVISION_EMAIL',
      'GOOGLE_TOKEN_KEY'
    ]
  ) {
    if (!String(env[key] || '').trim()) {
      throw new Error(
        `Lengkapi ${key} pada .env`
      );
    }
  }

  const divisionEmail = String(
    env.GOOGLE_DIVISION_EMAIL
  )
    .trim()
    .toLowerCase();

  const tokenKey = Buffer.from(
    env.GOOGLE_TOKEN_KEY,
    'base64'
  );

  if (tokenKey.length !== 32) {
    throw new Error(
      'GOOGLE_TOKEN_KEY harus base64 dari 32 byte.'
    );
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      divisionEmail
    )
  ) {
    throw new Error(
      'GOOGLE_DIVISION_EMAIL tidak valid.'
    );
  }
  // ======================================================
  // PEMERIKSAAN KONEKSI GOOGLE
  // ======================================================

  let healthCache = null;
  let healthFlight = null;
  let healthGeneration = 0;

  function invalidateHealth() {
    healthCache = null;

    healthGeneration++;
  }

  function requiresReauth(error) {
    const body =
      error?.response?.data;

    const reason =
      typeof body?.error === 'string'
        ? body.error
        : body?.error?.status;

    const reasons =
      body?.error?.errors ||
      error?.errors ||
      [];

    return (
      [
        'invalid_grant',
        'invalid_token',
        'UNAUTHENTICATED'
      ].includes(reason) ||

      /invalid_grant|invalid_token|invalid_rapt/i.test(
        String(error?.message || '')
      ) ||

      httpCode(error) === 401 ||

      (
        httpCode(error) === 403 &&
        reasons.some(
          item =>
            item.reason ===
            'insufficientPermissions'
        )
      )
    );
  }

  function healthMessage(state) {
    return {
      connected:
        'Akun Google divisi terhubung dan izin Calendar aktif.',

      not_connected:
        'Akun Google divisi belum dihubungkan.',

      reauth_required:
        'Izin akun Google berakhir atau dicabut. Hubungkan ulang akun divisi.',

      unavailable:
        'Koneksi Google belum dapat diperiksa. Coba Periksa status kembali.'
    }[state];
  }

  async function checkHealth(
    force = false
  ) {
    const result = await pool.query(
      `
        SELECT
          email,
          refresh_token_ciphertext

        FROM public.portopro_google_account

        WHERE id = 1
      `
    );

    const account =
      result.rows[0];

    const base = {
      division_email:
        divisionEmail,

      connected_email:
        account?.email || null,

      checked_at:
        new Date().toISOString()
    };

    if (
      !account ||
      account.email !== divisionEmail
    ) {
      return {
        ...base,

        status:
          'not_connected',

        connected:
          false,

        needs_reauth:
          false,

        message:
          healthMessage(
            'not_connected'
          )
      };
    }

    const key = crypto
      .createHash('sha256')
      .update(
        account.refresh_token_ciphertext
      )
      .digest('hex');

    const age =
      healthCache
        ? Date.now() - healthCache.at
        : Infinity;

    if (
      healthCache?.key === key &&
      age < (
        force
          ? 5000
          : 30000
      )
    ) {
      return healthCache.value;
    }

    if (
      healthFlight?.key === key &&
      healthFlight.generation ===
        healthGeneration
    ) {
      return healthFlight.promise;
    }

    const generation =
      healthGeneration;

    const flight = {
      key,
      generation
    };

    flight.promise = (async () => {
      let status =
        'connected';

      let errorCode =
        null;

      let timeout;

      try {
        let refresh;

        try {
          refresh = decrypt(
            account.refresh_token_ciphertext
          );

        } catch {
          throw fail(
            401,
            'Token tersimpan tidak dapat dibaca; hubungkan ulang akun divisi.'
          );
        }

        const auth =
          newOAuth();

        auth.setCredentials({
          refresh_token:
            refresh
        });

        const calendar =
          google.calendar({
            version: 'v3',
            auth
          });

        await Promise.race([
          calendar.events.list(
            {
              calendarId:
                'primary',

              maxResults:
                1,

              fields:
                'kind'
            },
            {
              timeout:
                8000
            }
          ),

          new Promise(
            (resolve, reject) => {
              timeout = setTimeout(
                () => reject(
                  Object.assign(
                    new Error(
                      'Status Google timeout'
                    ),
                    {
                      code:
                        'GOOGLE_STATUS_TIMEOUT'
                    }
                  )
                ),
                12000
              );
            }
          )
        ]);

      } catch (error) {
        status =
          requiresReauth(error) ||
          error.status === 401
            ? 'reauth_required'
            : 'unavailable';

        errorCode =
          status === 'reauth_required'
            ? 'REAUTH_REQUIRED'
            : 'CHECK_UNAVAILABLE';

      } finally {
        clearTimeout(timeout);
      }

      const value = {
        ...base,

        checked_at:
          new Date().toISOString(),

        status,

        connected:
          status === 'connected',

        needs_reauth:
          status === 'reauth_required',

        message:
          healthMessage(status),

        error_code:
          errorCode
      };

      if (
        generation ===
        healthGeneration
      ) {
        healthCache = {
          key,

          at:
            Date.now(),

          value
        };
      }

      return value;

    })().finally(() => {
      if (
        healthFlight ===
        flight
      ) {
        healthFlight =
          null;
      }
    });

    healthFlight =
      flight;

    return flight.promise;
  }

  // ======================================================
  // FORMAT STATUS UNDANGAN
  // ======================================================

  function serializeJob(
    id,
    job
  ) {
    const pending =
      job &&
      BigInt(job.revision) >
      BigInt(job.applied_revision);

    const status =
      !job
        ? 'not_queued'
        : pending
          ? 'pending'
          : job.action === 'delete'
            ? 'deleted'
            : 'synced';

    const delivery =
      !job
        ? 'not_queued'
        : pending
          ? (
              job.last_error
                ? 'failed'
                : 'pending'
            )
          : (
              job.action === 'delete'
                ? 'cancelled'
                : 'sent'
            );

    return {
      agenda_id:
        String(id),

      status,

      delivery_status:
        delivery,

      attempts:
        Number(
          job?.attempts || 0
        ),

      last_error:
        pending
          ? job.last_error || null
          : null,

      synced_at:
        job?.synced_at || null,

      sent_at:
        delivery === 'sent'
          ? job.synced_at || null
          : null,

      next_attempt_at:
        pending
          ? job.next_attempt_at || null
          : null
    };
  }
  // ======================================================
  // HELPER ERROR
  // ======================================================

  function fail(status, message) {
    return Object.assign(
      new Error(message),
      { status }
    );
  }

  function httpCode(error) {
    return Number(
      error?.response?.status ||
      error?.code ||
      0
    );
  }

  // ======================================================
  // OAUTH GOOGLE
  // ======================================================

  function newOAuth() {
    return new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );
  }

  // ======================================================
  // ENKRIPSI TOKEN
  // ======================================================

  function encrypt(text) {
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      tokenKey,
      iv
    );

    const body = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);

    return [
      iv,
      cipher.getAuthTag(),
      body
    ]
      .map(
        part => part.toString('base64')
      )
      .join('.');
  }

  function decrypt(text) {
    const parts = String(text)
      .split('.')
      .map(
        part => Buffer.from(part, 'base64')
      );

    if (parts.length !== 3) {
      throw new Error(
        'Format token Google tidak valid.'
      );
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      tokenKey,
      parts[0]
    );

    decipher.setAuthTag(parts[1]);

    return Buffer.concat([
      decipher.update(parts[2]),
      decipher.final()
    ]).toString('utf8');
  }

  // ======================================================
  // MIDDLEWARE LOGIN DAN ADMIN
  // ======================================================

  function loggedIn(req, res, next) {
    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    if (!req.session?.user) {
      return res.status(401).json({
        error: 'Belum login'
      });
    }

    return next();
  }

  function admin(req, res, next) {
    const role = String(
      req.session.user.role || ''
    )
      .trim()
      .toLowerCase();

    if (role !== 'admin') {
      return res.status(403).json({
        error:
          'Hanya Admin yang dapat menghubungkan akun divisi.'
      });
    }

    return next();
  }

  function saveSession(req) {
    return new Promise(
      (resolve, reject) => {
        req.session.save(error => {
          if (error) {
            reject(error);

          } else {
            resolve();
          }
        });
      }
    );
  }

  function route(handler) {
    return (req, res) =>
      Promise.resolve()
        .then(
          () => handler(req, res)
        )
        .catch(error => {
          console.error(
            'Google Calendar route gagal:',
            error.code ||
            error.status ||
            'unknown'
          );

          const message = error.status
            ? error.message
            : 'Koneksi Google gagal. Periksa konfigurasi, izin Calendar, lalu hubungkan ulang.';

          return res
            .status(error.status || 500)
            .json({
              error: message
            });
        });
  }

  app.use(
    '/api/google-calendar',
    loggedIn
  );

  // ======================================================
  // MULAI HUBUNGKAN AKUN GOOGLE DIVISI
  // ======================================================

  app.get(
    '/api/google-calendar/connect',
    admin,
    route(async (req, res) => {
      const state = crypto
        .randomBytes(32)
        .toString('hex');

      req.session.googleCalendarOAuth = {
        state,

        userId:
          String(req.session.user.id),

        expiresAt:
          Date.now() + 10 * 60 * 1000
      };

      await saveSession(req);

      const url = newOAuth().generateAuthUrl({
        access_type: 'offline',

        prompt: 'consent select_account',

        scope: [
          'openid',
          'email',
          CALENDAR_SCOPE
        ],

        state,

        login_hint: divisionEmail,

        include_granted_scopes: true
      });

      return res.redirect(url);
    })
  );

  // ======================================================
  // CALLBACK GOOGLE
  // ======================================================

  app.get(
    '/api/google-calendar/callback',
    admin,
    route(async (req, res) => {
      const saved =
        req.session.googleCalendarOAuth;

      const supplied =
        typeof req.query.state === 'string'
          ? req.query.state
          : '';

      const a = Buffer.from(
        saved?.state || ''
      );

      const b = Buffer.from(supplied);

      if (
        !saved ||
        saved.expiresAt < Date.now() ||
        saved.userId !==
          String(req.session.user.id) ||
        a.length !== b.length ||
        !crypto.timingSafeEqual(a, b)
      ) {
        throw fail(
          400,
          'Sesi penghubungan berakhir. Buka kembali /api/google-calendar/connect.'
        );
      }

      delete req.session.googleCalendarOAuth;

      await saveSession(req);

      if (
        req.query.error ||
        typeof req.query.code !== 'string'
      ) {
        throw fail(
          400,
          'Izin Google dibatalkan atau kode otorisasi tidak tersedia.'
        );
      }

      const auth = newOAuth();

      const { tokens } = await auth.getToken(
        req.query.code
      );

      const grantedScopes = String(
        tokens.scope || ''
      ).split(/\s+/);

      if (
        !tokens.id_token ||
        !grantedScopes.includes(CALENDAR_SCOPE)
      ) {
        throw fail(
          400,
          'Berikan izin identitas email dan Google Calendar saat menghubungkan akun.'
        );
      }

      const ticket = await auth.verifyIdToken({
        idToken: tokens.id_token,

        audience:
          env.GOOGLE_CLIENT_ID
      });

      const identity =
        ticket.getPayload();

      if (
        identity?.email_verified !== true ||
        String(identity.email)
          .toLowerCase() !== divisionEmail
      ) {
        throw fail(
          400,
          'Akun Google harus sama dengan GOOGLE_DIVISION_EMAIL pada .env.'
        );
      }

      const existing = await pool.query(
        `
          SELECT
            google_sub,
            refresh_token_ciphertext

          FROM public.portopro_google_account

          WHERE id = 1
        `
      );

      let refresh =
        tokens.refresh_token;

      if (
        !refresh &&
        existing.rows[0]?.google_sub ===
          identity.sub
      ) {
        refresh = decrypt(
          existing.rows[0]
            .refresh_token_ciphertext
        );
      }

      if (!refresh) {
        throw fail(
          400,
          'Refresh token belum diberikan. Hubungkan ulang dan setujui izin.'
        );
      }

      await pool.query(
        `
          INSERT INTO public.portopro_google_account (
            id,
            email,
            google_sub,
            refresh_token_ciphertext
          )

          VALUES (
            1,
            $1,
            $2,
            $3
          )

          ON CONFLICT (id)

          DO UPDATE SET
            email = EXCLUDED.email,

            google_sub =
              EXCLUDED.google_sub,

            refresh_token_ciphertext =
              EXCLUDED.refresh_token_ciphertext,

            updated_at = NOW()
        `,
        [
          divisionEmail,
          identity.sub,
          encrypt(refresh)
        ]
      );

      await pool.query(
        `
          UPDATE public.portopro_google_jobs

          SET next_attempt_at = NOW()

          WHERE revision > applied_revision
        `
      );
      
      invalidateHealth();
      kick();

      return res
        .type('html')
        .send(`
          <!DOCTYPE html>
          <html lang="id">
          <head>
            <meta charset="UTF-8">
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            >
            <title>Google Calendar Terhubung</title>
          </head>
          <body>
            <h2>
              Google Calendar divisi berhasil dihubungkan.
            </h2>

            <p>
              Agenda baru dan antrean yang menunggu akan
              dikirim bersama undangan PIC dan pembuatnya.
            </p>

            <p>
              Tutup tab ini, kembali ke halaman kalender
              PORTOPRO, lalu klik Periksa status.
            </p>
          </body>
          </html>
        `);
    })
  );

  // ======================================================
  // STATUS KONEKSI AKUN DIVISI
  // ======================================================

    app.get(
    '/api/google-calendar/status',

    route(async (req, res) => {
      const result =
        await checkHealth(
          req.query?.refresh === '1'
        );

      return res.json(result);
    })
  );

    app.get(
    '/api/google-calendar/agenda-statuses',

    route(async (req, res) => {
      if (
        typeof req.query?.ids !==
        'string'
      ) {
        throw fail(
          400,
          'Daftar ID agenda tidak valid.'
        );
      }

      const ids = [
        ...new Set(
          req.query.ids
            .split(',')
            .filter(Boolean)
        )
      ];

      if (
        !ids.length ||
        ids.length > 500 ||
        ids.some(
          id =>
            !/^[1-9]\d{0,18}$/.test(id) ||
            BigInt(id) >
              9223372036854775807n
        )
      ) {
        throw fail(
          400,
          'Pilih maksimal 500 ID agenda yang valid.'
        );
      }

      const result =
        await pool.query(
          `
            SELECT
              agenda_id::text AS agenda_id,
              action,
              revision,
              applied_revision,
              attempts,
              last_error,
              synced_at,
              next_attempt_at

            FROM public.portopro_google_jobs

            WHERE agenda_id = ANY(
              $1::bigint[]
            )
          `,
          [ids]
        );

      const jobs =
        new Map(
          result.rows.map(
            job => [
              String(
                job.agenda_id
              ),
              job
            ]
          )
        );

      return res.json({
        checked_at:
          new Date().toISOString(),

        jobs:
          ids.map(
            id =>
              serializeJob(
                id,
                jobs.get(id)
              )
          )
      });
    })
  );

  // ======================================================
  // STATUS SINKRONISASI SATU AGENDA
  // ======================================================

  app.get(
    '/api/google-calendar/agenda/:id/status',

    route(async (req, res) => {
      const id = String(
        req.params.id || ''
      );

      if (
        !/^[1-9]\d{0,18}$/.test(id) ||
        BigInt(id) >
          9223372036854775807n
      ) {
        throw fail(
          400,
          'ID agenda tidak valid.'
        );
      }

      const result =
        await pool.query(
          `
            SELECT
              action,
              revision,
              applied_revision,
              attempts,
              last_error,
              synced_at,
              next_attempt_at

            FROM public.portopro_google_jobs

            WHERE agenda_id = $1
          `,
          [id]
        );

      return res.json(
        serializeJob(
          id,
          result.rows[0]
        )
      );
    })
  );

  // ======================================================
  // FORMAT WAKTU GOOGLE
  // ======================================================

  function googleTime(date, time) {
    const stamp = time === '24:00'
      ? (
          new Date(
            `${date}T00:00:00+07:00`
          ).getTime() +
          86400000
        )
      : new Date(
          `${date}T${time}:00+07:00`
        ).getTime();

    if (!Number.isFinite(stamp)) {
      throw fail(
        400,
        'Tanggal/jam agenda untuk Google tidak valid.'
      );
    }

    return {
      dateTime:
        new Date(stamp).toISOString(),

      timeZone:
        TIME_ZONE
    };
  }

  // ======================================================
  // MASUKKAN AGENDA KE ANTREAN
  // Dipanggil dari transaksi calendarSave sebelum COMMIT.
  // ======================================================

  async function enqueueAgenda(
    client,
    agendaId
  ) {
    const source = await client.query(
      `
        SELECT
          a.id::text AS id,
          a.agenda,

          TO_CHAR(
            a.tanggal,
            'YYYY-MM-DD'
          ) AS date,

          SUBSTRING(
            a.jam_mulai::text
            FROM 1 FOR 5
          ) AS time,

          SUBSTRING(
            a.jam_selesai::text
            FROM 1 FOR 5
          ) AS end_time,

          a.link_lokasi,
          a.catatan,
          a.nama_proyek,

          a.created_by::text AS creator_id,

          pembuat.id::text AS creator_pic_id,
          pembuat.nama AS creator_name

        FROM public.calendar_agenda a

        LEFT JOIN public.pic pembuat
          ON pembuat.id::text =
             a.created_by::text

        WHERE a.id = $1
      `,
      [agendaId]
    );

    const event = source.rows[0];

    if (!event?.creator_pic_id) {
      throw fail(
        400,
        'Pembuat agenda harus memiliki ID yang sesuai dengan master PIC.'
      );
    }

    // Penerima: PIC yang dipilih + pembuat awal agenda.
    const recipients = await client.query(
      `
        SELECT
          p.id::text AS id,
          p.nama,
          p.email

        FROM public.pic p

        WHERE
          p.id::text = $2

          OR EXISTS (
            SELECT 1

            FROM public.calendar_agenda_pic ap

            WHERE ap.agenda_id = $1
              AND ap.pic_id = p.id
          )

        ORDER BY p.id
      `,
      [
        agendaId,
        event.creator_pic_id
      ]
    );

    const missing = recipients.rows.filter(
      pic =>
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          String(pic.email || '').trim()
        )
    );

    if (missing.length) {
      throw fail(
        400,
        'Lengkapi email master PIC: ' +
        missing
          .map(
            pic => pic.nama
          )
          .join(', ')
      );
    }

    const emails = new Map();

    for (const pic of recipients.rows) {
      const email = String(pic.email)
        .trim()
        .toLowerCase();

      // Akun divisi sudah tercakup sebagai penyelenggara.
      if (email !== divisionEmail) {
        emails.set(
          email,
          {
            email,
            displayName: pic.nama
          }
        );
      }
    }

    const payload = {
      summary:
        event.agenda,

      location:
        event.link_lokasi || '',

      description: [
        `Proyek: ${event.nama_proyek || 'Belum ada proyek'}`,
        `Dibuat oleh: ${event.creator_name}`,
        event.catatan || ''
      ].join('\n'),

      start: googleTime(
        event.date,
        event.time
      ),

      end: googleTime(
        event.date,
        event.end_time
      ),

      attendees: [
        ...emails.values()
      ],

      extendedProperties: {
        private: {
          portopro_agenda_id:
            event.id
        }
      }
    };

    await client.query(
      `
        INSERT INTO public.portopro_google_jobs (
          agenda_id,
          google_event_id,
          action,
          payload
        )

        VALUES (
          $1,
          $2,
          'upsert',
          $3::jsonb
        )

        ON CONFLICT (agenda_id)

        DO UPDATE SET
          action = 'upsert',

          payload =
            EXCLUDED.payload,

          revision =
            portopro_google_jobs.revision + 1,

          attempts = 0,
          next_attempt_at = NOW(),
          last_error = NULL,
          updated_at = NOW()
      `,
      [
        agendaId,

        'portopro' +
          crypto
            .randomBytes(16)
            .toString('hex'),

        JSON.stringify(payload)
      ]
    );
  }

  // ======================================================
  // ANTREKAN PEMBATALAN ACARA GOOGLE
  // ======================================================

  async function enqueueDelete(
    client,
    agendaId
  ) {
    await client.query(
      `
        UPDATE public.portopro_google_jobs

        SET
          action = 'delete',

          payload = '{}'::jsonb,

          revision = revision + 1,

          attempts = 0,
          next_attempt_at = NOW(),
          last_error = NULL,
          updated_at = NOW()

        WHERE agenda_id = $1
      `,
      [agendaId]
    );
  }

  // ======================================================
  // CLIENT GOOGLE CALENDAR AKUN DIVISI
  // ======================================================

  async function divisionCalendar() {
    const result = await pool.query(
      `
        SELECT
          email,
          refresh_token_ciphertext

        FROM public.portopro_google_account

        WHERE id = 1
      `
    );

    if (
      result.rows[0]?.email !==
      divisionEmail
    ) {
      throw fail(
        409,
        'Hubungkan Google Calendar divisi terlebih dahulu.'
      );
    }

    const auth = newOAuth();

    auth.setCredentials({
      refresh_token: decrypt(
        result.rows[0]
          .refresh_token_ciphertext
      )
    });

    return google.calendar({
      version: 'v3',
      auth
    });
  }

  // ======================================================
  // KIRIM SATU ANTREAN KE GOOGLE
  // ======================================================

  async function sendJob(
    calendar,
    job
  ) {
    const base = {
      calendarId: 'primary',

      eventId:
        job.google_event_id
    };

    const requestOptions = {
      timeout: 30000
    };

    // Pembatalan acara.
    if (job.action === 'delete') {
      try {
        await calendar.events.delete(
          {
            ...base,
            sendUpdates: 'all'
          },
          requestOptions
        );

      } catch (error) {
        if (
          ![404, 410].includes(
            httpCode(error)
          )
        ) {
          throw error;
        }
      }

      return;
    }

    const payload =
      typeof job.payload === 'string'
        ? JSON.parse(job.payload)
        : job.payload;

    let existing;

    try {
      const response =
        await calendar.events.get(
          base,
          requestOptions
        );

      existing = response.data;

    } catch (error) {
      if (httpCode(error) !== 404) {
        throw error;
      }
    }

    // Buat acara bila belum tersedia.
    if (!existing) {
      try {
        await calendar.events.insert(
          {
            calendarId: 'primary',

            sendUpdates: 'all',

            requestBody: {
              ...payload,

              id:
                job.google_event_id
            }
          },
          requestOptions
        );

        return;

      } catch (error) {
        if (httpCode(error) !== 409) {
          throw error;
        }

        // Acara mungkin sudah dibuat oleh percobaan sebelumnya.
        const response =
          await calendar.events.get(
            base,
            requestOptions
          );

        existing = response.data;
      }
    }

    if (
      existing.extendedProperties
        ?.private
        ?.portopro_agenda_id !==
      String(job.agenda_id)
    ) {
      throw fail(
        409,
        'ID acara Google tidak cocok dengan agenda PORTOPRO.'
      );
    }

    // Pertahankan jawaban peserta yang masih terdaftar.
    const previous = new Map(
      (existing.attendees || []).map(
        person => [
          String(person.email || '')
            .toLowerCase(),

          person
        ]
      )
    );

    const attendees =
      payload.attendees.map(person => {
        const old = previous.get(
          person.email
        );

        return old?.responseStatus
          ? {
              ...person,

              responseStatus:
                old.responseStatus
            }
          : person;
      });

    await calendar.events.patch(
      {
        ...base,

        sendUpdates: 'all',

        requestBody: {
          ...payload,

          attendees,

          status: 'confirmed',

          extendedProperties: {
            ...existing.extendedProperties,

            private: {
              ...existing.extendedProperties
                ?.private,

              ...payload.extendedProperties
                .private
            }
          }
        }
      },
      requestOptions
    );
  }

  // ======================================================
  // WORKER ANTREAN
  // ======================================================

  let running = false;
  let stopped = false;

  async function processPending() {
    if (running || stopped) {
      return;
    }

    running = true;

    try {
      for (
        let count = 0;
        count < 10;
        count++
      ) {
        const lockToken =
          crypto.randomUUID();

        const claimed = await pool.query(
          `
            UPDATE public.portopro_google_jobs job

            SET
              lock_token = $1::uuid,

              locked_until =
                NOW() + INTERVAL '5 minutes'

            WHERE job.agenda_id = (
              SELECT agenda_id

              FROM public.portopro_google_jobs

              WHERE
                revision > applied_revision

                AND next_attempt_at <= NOW()

                AND (
                  locked_until IS NULL
                  OR locked_until < NOW()
                )

              ORDER BY
                next_attempt_at,
                agenda_id

              LIMIT 1

              FOR UPDATE SKIP LOCKED
            )

            RETURNING job.*
          `,
          [lockToken]
        );

        const job = claimed.rows[0];

        if (!job) {
          break;
        }

        try {
          const calendar =
            await divisionCalendar();

          await sendJob(
            calendar,
            job
          );

          await pool.query(
            `
              UPDATE public.portopro_google_jobs

              SET
                applied_revision = $1,

                attempts = 0,
                last_error = NULL,

                locked_until = NULL,
                lock_token = NULL,

                synced_at = NOW(),
                updated_at = NOW()

              WHERE agenda_id = $2
                AND lock_token = $3::uuid
            `,
            [
              job.revision,
              job.agenda_id,
              lockToken
            ]
          );

        } catch (error) {
                    const code =
            httpCode(error);

          const reauth =
            requiresReauth(error);

          if (reauth) {
            invalidateHealth();
          }

          const message =
            reauth
              ? healthMessage(
                  'reauth_required'
                )
              : error.status
                ? error.message
                : (
                    [401, 403].includes(code)
                      ? 'Periksa izin Calendar dan hubungkan ulang akun divisi.'
                      : 'Sinkronisasi Google gagal; antrean akan dicoba ulang.'
                  );

          const delay = Math.min(
            3600,

            15 * 2 ** Math.min(
              Number(job.attempts || 0),
              8
            )
          );

          await pool.query(
            `
              UPDATE public.portopro_google_jobs

              SET
                attempts = attempts + 1,

                last_error = $1,

                next_attempt_at =
                  NOW() +
                  (
                    $2::integer *
                    INTERVAL '1 second'
                  ),

                locked_until = NULL,
                lock_token = NULL,

                updated_at = NOW()

              WHERE agenda_id = $3
                AND lock_token = $4::uuid
            `,
            [
              message,
              delay,
              job.agenda_id,
              lockToken
            ]
          );

          console.error(
            'Google Calendar job gagal:',

            job.agenda_id,

            code ||
            error.status ||
            'unknown'
          );
        }
      }

    } finally {
      running = false;
    }
  }

  // function kick() {
  //   if (stopped) {
  //     return;
  //   }

  //   setImmediate(() => {
  //     processPending().catch(error => {
  //       console.error(
  //         'Google Calendar worker gagal:',
  //         error.code || 'unknown'
  //       );
  //     });
  //   });
  // }

  function kick() {
    if (stopped) {
      return;
    }
  
    setImmediate(async () => {
      try {
        await processPending();
  
      } catch (error) {
        console.error(
          'DETAIL ERROR GOOGLE CALENDAR:',
          {
            code: error.code,
            message: error.message,
            detail: error.detail,
            schema: error.schema,
            table: error.table
          }
        );
  
        try {
          const result = await pool.query(`
            SELECT
              current_database() AS database,
  
              inet_server_addr()::text AS host,
  
              inet_server_port() AS port,
  
              to_regclass(
                'public.portopro_google_account'
              ) AS akun_google,
  
              to_regclass(
                'public.portopro_google_jobs'
              ) AS antrean_google
          `);
  
          console.error(
            'KONEKSI DATABASE WORKER:',
            result.rows[0]
          );
  
        } catch (checkError) {
          console.error(
            'GAGAL CEK DATABASE WORKER:',
            checkError.message
          );
        }
      }
    });
  }

  const timer =
    options.autoStart === false
      ? null
      : setInterval(
          kick,
          5000
        );

  if (timer) {
    timer.unref();

    kick();
  }

  return {
    enqueueAgenda,
    enqueueDelete,
    kick,
    processPending,

    stop() {
      stopped = true;

      if (timer) {
        clearInterval(timer);
      }
    }
  };
};