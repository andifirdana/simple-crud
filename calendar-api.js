'use strict';

module.exports = function registerCalendarApi(
  app,
  pool
) {
  const calendarFields = `
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

    a.proyek_id::text AS project_id,

    (
      a.proyek_id IS NULL
      AND a.nama_proyek =
        'Belum ada proyek'
    ) AS no_project,

    COALESCE(
      p.nama_proyek,
      a.nama_proyek
    ) AS project,

    a.jenis_meeting AS type,
    a.link_lokasi AS meeting,
    COALESCE(
      a.catatan,
      ''
    ) AS notes,

    COALESCE(
      (
        SELECT JSON_AGG(
          JSON_BUILD_OBJECT(
            'id',
            mp.id::text,
            'name',
            mp.nama
          )
          ORDER BY mp.id
        )
        FROM public.calendar_agenda_pic ap
        JOIN public.pic mp
          ON mp.id = ap.pic_id
        WHERE ap.agenda_id = a.id
      ),
      '[]'::json
    ) AS pics,

    a.nama_pic AS legacy_pic,
    a.created_by,
    a.created_at,
    a.updated_at
  `;

  function calendarRequireLogin(
    req,
    res,
    next
  ) {
    if (
      !req.session?.user
    ) {
      return res.status(401).json({
        error: 'Belum login'
      });
    }

    next();
  }

  app.use(
    '/api/calendar',
    calendarRequireLogin
  );

  function calendarValidId(
    value
  ) {
    return (
      typeof value === 'string' &&
      /^[1-9]\d{0,18}$/.test(
        value
      ) &&
      BigInt(value) <=
        9223372036854775807n
    );
  }

  function calendarValidDate(
    value
  ) {
    if (
      typeof value !== 'string' ||
      !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(
        value
      )
    ) {
      return false;
    }

    const date =
      new Date(
        `${value}T00:00:00Z`
      );

    return (
      !Number.isNaN(
        date.getTime()
      ) &&
      date.toISOString()
        .slice(0, 10) ===
        value
    );
  }

  function calendarValidTime(
    value,
    end = false
  ) {
    return (
      typeof value === 'string' &&
      (
        /^([01]\d|2[0-3]):[0-5]\d$/.test(
          value
        ) ||
        (
          end &&
          value === '24:00'
        )
      )
    );
  }

  function calendarCurrentPicId(
    user,
    pics
  ) {
    const linkedId =
      user?.pic_id ??
      user?.picId ??
      user?.pic?.id;

    if (
      linkedId != null
    ) {
      return (
        pics.find(
          pic =>
            pic.id ===
            String(linkedId)
        )?.id ?? null
      );
    }

    const names = [
      user?.nama,
      user?.nama_lengkap,
      user?.name,
      user?.full_name,
      user?.username
    ]
      .filter(
        value =>
          typeof value ===
            'string' &&
          value.trim()
      )
      .map(
        value =>
          value.trim()
            .toLocaleLowerCase(
              'id'
            )
      );

    const matches =
      pics.filter(
        pic =>
          names.includes(
            pic.name
              .trim()
              .toLocaleLowerCase(
                'id'
              )
          )
      );

    if (
      matches.length === 1
    ) {
      return matches[0].id;
    }

    if (
      matches.length > 1
    ) {
      return null;
    }

    // Pada Portopro, session.user.id
    // juga dipakai sebagai ID PIC.
    return (
      pics.find(
        pic =>
          pic.id ===
          String(
            user?.id ?? ''
          )
      )?.id ?? null
    );
  }

  function calendarError(
    status,
    message
  ) {
    const error =
      new Error(message);

    error.status =
      status;

    return error;
  }

  function calendarSerialize(
    row
  ) {
    const pics =
      row.pics.length
        ? row.pics
        : [
          {
            id: null,
            name: row.legacy_pic
          }
        ];

    const {
      legacy_pic,
      ...event
    } = row;

    return {
      ...event,

      pics,

      pic_ids:
        pics
          .filter(
            pic =>
              pic.id
          )
          .map(
            pic =>
              pic.id
          ),

      pic:
        pics
          .map(
            pic =>
              pic.name
          )
          .join(', ')
    };
  }

  function calendarHandleError(
    res,
    error
  ) {
    if (
      error.status
    ) {
      return res
        .status(error.status)
        .json({
          error:
            error.message
        });
    }

    console.error(
      'API calendar:',
      error
    );

    if (
      error.code === '23503'
    ) {
      return res
        .status(409)
        .json({
          error:
            'PIC atau proyek berubah. Muat ulang pilihan master.'
        });
    }

    return res
      .status(500)
      .json({
        error:
          'Gagal memproses agenda'
      });
  }

  function calendarValidateBody(
    body
  ) {
    const data = {};

    for (
      const key of [
        'agenda',
        'date',
        'time',
        'end_time',
        'project_id',
        'type',
        'meeting',
        'notes'
      ]
    ) {
      data[key] =
        typeof body?.[key] ===
          'string'
          ? body[key].trim()
          : '';
    }

    for (
      const [
        key,
        label,
        max
      ] of [
        [
          'agenda',
          'Agenda',
          150
        ],
        [
          'meeting',
          'Link/lokasi',
          400
        ]
      ]
    ) {
      if (
        !data[key] ||
        data[key].length > max
      ) {
        throw calendarError(
          400,
          `${label} wajib diisi, maksimal ${max} karakter`
        );
      }
    }

    if (
      data.notes.length > 5000
    ) {
      throw calendarError(
        400,
        'Catatan maksimal 5000 karakter'
      );
    }

    if (
      !calendarValidDate(
        data.date
      )
    ) {
      throw calendarError(
        400,
        'Tanggal tidak valid'
      );
    }

    if (
      !calendarValidTime(
        data.time
      ) ||
      !calendarValidTime(
        data.end_time,
        true
      ) ||
      data.end_time <=
        data.time
    ) {
      throw calendarError(
        400,
        'Jam selesai harus setelah jam mulai pada hari yang sama (HH:mm)'
      );
    }

    if (
      ![
        'online',
        'office'
      ].includes(
        data.type
      )
    ) {
      throw calendarError(
        400,
        'Jenis meeting tidak valid'
      );
    }

    if (
      data.type === 'online'
    ) {
      let url;

      try {
        url =
          new URL(
            data.meeting
          );
      } catch {
        throw calendarError(
          400,
          'Link meeting tidak valid'
        );
      }

      if (
        ![
          'http:',
          'https:'
        ].includes(
          url.protocol
        )
      ) {
        throw calendarError(
          400,
          'Link meeting harus http:// atau https://'
        );
      }
    }

    if (
      body?.no_project !==
        undefined &&
      typeof body.no_project !==
        'boolean'
    ) {
      throw calendarError(
        400,
        'no_project harus bernilai true atau false'
      );
    }

    data.no_project =
      body?.no_project ===
      true;

    if (
      data.no_project
    ) {
      data.project_id =
        null;
    } else if (
      !calendarValidId(
        data.project_id
      )
    ) {
      throw calendarError(
        400,
        'Pilih proyek dari master atau centang Belum ada proyek'
      );
    }

    if (
      !Array.isArray(
        body?.pic_ids
      ) ||
      !body.pic_ids.length ||
      !body.pic_ids.every(
        calendarValidId
      )
    ) {
      throw calendarError(
        400,
        'pic_ids harus berisi minimal satu ID PIC (string) yang valid'
      );
    }

    data.pic_ids = [
      ...new Set(
        body.pic_ids
      )
    ].sort(
      (first, second) =>
        BigInt(first) <
        BigInt(second)
          ? -1
          : BigInt(first) >
              BigInt(second)
            ? 1
            : 0
    );

    return data;
  }

  async function calendarGetEvent(
    client,
    id
  ) {
    const result =
      await client.query(
        `
          SELECT ${calendarFields}
          FROM public.calendar_agenda a
          LEFT JOIN public.proyek p
            ON p.id = a.proyek_id
          WHERE a.id = $1
        `,
        [id]
      );

    return result.rows.length
      ? calendarSerialize(
        result.rows[0]
      )
      : null;
  }

  // Daftarkan sebelum /api/calendar/:id.
  app.get(
    '/api/calendar/options',
    async (req, res) => {
      try {
        const [
          pics,
          projects
        ] = await Promise.all(
          [
            pool.query(
              `
                SELECT
                  id::text AS id,
                  nama AS name
                FROM public.pic
                ORDER BY nama, id
              `
            ),

            pool.query(
              `
                SELECT
                  id::text AS id,
                  nama_proyek AS name
                FROM public.proyek
                WHERE LOWER(
                  BTRIM(
                    status_final
                  )
                ) = 'aktif'
                ORDER BY
                  nama_proyek,
                  id
              `
            )
          ]
        );

        res.json({
          pics:
            pics.rows,

          projects:
            projects.rows,

          current_pic_id:
            calendarCurrentPicId(
              req.session.user,
              pics.rows
            )
        });
      } catch (error) {
        calendarHandleError(
          res,
          error
        );
      }
    }
  );

  app.get(
    '/api/calendar',
    async (req, res) => {
      try {
        for (
          const key of [
            'from',
            'to',
            'pic_id',
            'project_id',
            'search'
          ]
        ) {
          if (
            req.query[key] !==
              undefined &&
            typeof req.query[key] !==
              'string'
          ) {
            throw calendarError(
              400,
              `Parameter ${key} tidak valid`
            );
          }
        }

        const from =
          req.query.from || '';

        const to =
          req.query.to || '';

        if (
          (
            from &&
            !calendarValidDate(from)
          ) ||
          (
            to &&
            !calendarValidDate(to)
          ) ||
          (
            from &&
            to &&
            from > to
          )
        ) {
          throw calendarError(
            400,
            'Rentang tanggal tidak valid'
          );
        }

        const conditions = [];
        const values = [];

        const add = (
          sql,
          value
        ) => {
          values.push(value);

          conditions.push(
            sql.replaceAll(
              '?',
              `$${values.length}`
            )
          );
        };

        if (from) {
          add(
            'a.tanggal >= ?::date',
            from
          );
        }

        if (to) {
          add(
            'a.tanggal <= ?::date',
            to
          );
        }

        if (
          req.query.pic_id
        ) {
          if (
            !calendarValidId(
              req.query.pic_id
            )
          ) {
            throw calendarError(
              400,
              'ID PIC tidak valid'
            );
          }

          add(
            `
              EXISTS(
                SELECT 1
                FROM public.calendar_agenda_pic ap
                WHERE ap.agenda_id = a.id
                  AND ap.pic_id = ?
              )
            `,
            req.query.pic_id
          );
        }

        if (
          req.query.project_id
        ) {
          if (
            !calendarValidId(
              req.query.project_id
            )
          ) {
            throw calendarError(
              400,
              'ID proyek tidak valid'
            );
          }

          add(
            'a.proyek_id = ?',
            req.query.project_id
          );
        }

        if (
          req.query.search?.trim()
        ) {
          add(
            `
              STRPOS(
                LOWER(
                  CONCAT_WS(
                    ' ',
                    a.agenda,
                    a.catatan,
                    a.link_lokasi,
                    COALESCE(
                      p.nama_proyek,
                      a.nama_proyek
                    ),
                    a.nama_pic,
                    (
                      SELECT STRING_AGG(
                        mp.nama,
                        ' '
                      )
                      FROM public.calendar_agenda_pic ap
                      JOIN public.pic mp
                        ON mp.id = ap.pic_id
                      WHERE ap.agenda_id = a.id
                    )
                  )
                ),
                LOWER(?::text)
              ) > 0
            `,
            req.query.search.trim()
          );
        }

        const result =
          await pool.query(
            `
              SELECT ${calendarFields}
              FROM public.calendar_agenda a
              LEFT JOIN public.proyek p
                ON p.id = a.proyek_id

              ${
                conditions.length
                  ? `WHERE ${conditions.join(
                    ' AND '
                  )}`
                  : ''
              }

              ORDER BY
                a.tanggal,
                a.jam_mulai,
                a.id
            `,
            values
          );

        res.json(
          result.rows.map(
            calendarSerialize
          )
        );
      } catch (error) {
        calendarHandleError(
          res,
          error
        );
      }
    }
  );

  app.get(
    '/api/calendar/:id',
    async (req, res) => {
      try {
        if (
          !calendarValidId(
            req.params.id
          )
        ) {
          throw calendarError(
            400,
            'ID agenda tidak valid'
          );
        }

        const event =
          await calendarGetEvent(
            pool,
            req.params.id
          );

        if (!event) {
          throw calendarError(
            404,
            'Agenda tidak ditemukan'
          );
        }

        res.json(event);
      } catch (error) {
        calendarHandleError(
          res,
          error
        );
      }
    }
  );

  async function calendarSave(
    req,
    res,
    isUpdate
  ) {
    let client;

    try {
      const id =
        req.params.id;

      if (
        isUpdate &&
        !calendarValidId(id)
      ) {
        throw calendarError(
          400,
          'ID agenda tidak valid'
        );
      }

      const data =
        calendarValidateBody(
          req.body
        );

      client =
        await pool.connect();

      await client.query(
        'BEGIN'
      );

      let old;

      if (
        isUpdate
      ) {
        const existing =
          await client.query(
            `
              SELECT
                proyek_id::text AS project_id
              FROM public.calendar_agenda
              WHERE id = $1
              FOR UPDATE
            `,
            [id]
          );

        old =
          existing.rows[0];

        if (!old) {
          throw calendarError(
            404,
            'Agenda tidak ditemukan'
          );
        }
      }

      const pics =
        await client.query(
          `
            SELECT
              id::text AS id,
              nama
            FROM public.pic
            WHERE id = ANY(
              $1::bigint[]
            )
            ORDER BY id
            FOR SHARE
          `,
          [
            data.pic_ids
          ]
        );

      if (
        pics.rows.length !==
        data.pic_ids.length
      ) {
        throw calendarError(
          400,
          'Salah satu PIC tidak ditemukan di master'
        );
      }

      let projectName =
        'Belum ada proyek';

      if (
        !data.no_project
      ) {
        const project =
          await client.query(
            `
              SELECT
                nama_proyek,
                status_final
              FROM public.proyek
              WHERE id = $1
              FOR SHARE
            `,
            [
              data.project_id
            ]
          );

        if (
          !project.rows.length
        ) {
          throw calendarError(
            400,
            'Proyek tidak ditemukan'
          );
        }

        if (
          String(
            project.rows[0]
              .status_final || ''
          )
            .trim()
            .toLowerCase() !==
              'aktif' &&
          old?.project_id !==
            data.project_id
        ) {
          throw calendarError(
            400,
            'Pilih proyek dengan Status Final Aktif'
          );
        }

        projectName =
          project.rows[0]
            .nama_proyek;
      }

      const names =
        pics.rows
          .map(
            pic =>
              pic.nama
          )
          .join(', ');

      const values = [
        data.agenda,
        data.date,
        data.time,
        data.end_time,
        data.pic_ids[0],
        data.project_id,
        names,
        projectName,
        data.type,
        data.meeting,
        data.notes
      ];

      let result;

      if (
        isUpdate
      ) {
        result =
          await client.query(
            `
              UPDATE public.calendar_agenda
              SET
                agenda = $1,
                tanggal = $2::date,
                jam_mulai = $3::time,
                jam_selesai = $4::time,
                pic_id = $5,
                proyek_id = $6,
                nama_pic = $7,
                nama_proyek = $8,
                jenis_meeting = $9,
                link_lokasi = $10,
                catatan = $11,
                updated_at = NOW()
              WHERE id = $12
              RETURNING id::text AS id
            `,
            [
              ...values,
              id
            ]
          );
      } else {
        const user =
          req.session.user;

        const identity =
          user.id ??
          user.username ??
          user.nama ??
          user.name ??
          null;

        result =
          await client.query(
            `
              INSERT INTO public.calendar_agenda
              (
                agenda,
                tanggal,
                jam_mulai,
                jam_selesai,
                pic_id,
                proyek_id,
                nama_pic,
                nama_proyek,
                jenis_meeting,
                link_lokasi,
                catatan,
                created_by
              )
              VALUES
              (
                $1,
                $2::date,
                $3::time,
                $4::time,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12
              )
              RETURNING id::text AS id
            `,
            [
              ...values,
              identity === null
                ? null
                : String(identity)
            ]
          );
      }

      const eventId =
        result.rows[0].id;

      await client.query(
        `
          DELETE FROM public.calendar_agenda_pic
          WHERE agenda_id = $1
        `,
        [eventId]
      );

      await client.query(
        `
          INSERT INTO public.calendar_agenda_pic
          (
            agenda_id,
            pic_id
          )
          SELECT
            $1,
            pic
          FROM UNNEST(
            $2::bigint[]
          ) AS selected(pic)
        `,
        [
          eventId,
          data.pic_ids
        ]
      );

      const event =
        await calendarGetEvent(
          client,
          eventId
        );

      await client.query(
        'COMMIT'
      );

      res
        .status(
          isUpdate
            ? 200
            : 201
        )
        .json(event);
    } catch (error) {
      if (client) {
        await client
          .query(
            'ROLLBACK'
          )
          .catch(
            () => {}
          );
      }

      calendarHandleError(
        res,
        error
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  app.post(
    '/api/calendar',
    (
      req,
      res
    ) =>
      calendarSave(
        req,
        res,
        false
      )
  );

  app.put(
    '/api/calendar/:id',
    (
      req,
      res
    ) =>
      calendarSave(
        req,
        res,
        true
      )
  );

  app.delete(
    '/api/calendar/:id',
    async (req, res) => {
      try {
        if (
          !calendarValidId(
            req.params.id
          )
        ) {
          throw calendarError(
            400,
            'ID agenda tidak valid'
          );
        }

        const result =
          await pool.query(
            `
              DELETE
              FROM public.calendar_agenda
              WHERE id = $1
              RETURNING id::text AS id
            `,
            [
              req.params.id
            ]
          );

        if (
          !result.rows.length
        ) {
          throw calendarError(
            404,
            'Agenda tidak ditemukan'
          );
        }

        res.json({
          success: true,
          id:
            result.rows[0].id
        });
      } catch (error) {
        calendarHandleError(
          res,
          error
        );
      }
    }
  );
};