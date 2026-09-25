(() => {
  'use strict';

  const byId = id => document.getElementById(id);

  const form = byId('produkForm');
  const sub = byId('subJenisProyek');
  const item = byId('itemProduk');
  const deskripsi = byId('deskripsi');
  const jual = byId('hargaJual');
  const beli = byId('hargaBeli');
  const margin = byId('margin');
  const rows = byId('produkRows');
  const message = byId('message');
  const search = byId('searchProduk');
  const filter = byId('filterSub');
  const save = byId('saveButton');
  const pageSize = byId('pageSize');
  const pageButtons = byId('pageButtons');

  const base = '/api/master-produk-sewa';

  let data = [];
  let subOptions = [];
  let editingId = null;
  let canManage = false;
  let ready = false;
  let busy = false;
  let currentPage = 1;

  const format = value =>
    String(value).replace(
      /\B(?=(\d{3})+(?!\d))/g,
      '.'
    );

  const rupiah = value =>
    'Rp ' + format(value);

  const hitungMargin = (
    hargaJual,
    hargaBeli
  ) => (
    BigInt(hargaJual) -
    BigInt(hargaBeli)
  ).toString();

  function updateMargin() {
    const hargaJual = jual.value.replace(
      /\./g,
      ''
    );

    const hargaBeli = beli.value.replace(
      /\./g,
      ''
    );

    const jualValid =
      /^(0|[1-9]\d{0,17})$/.test(
        hargaJual
      );

    const beliValid =
      /^(0|[1-9]\d{0,17})$/.test(
        hargaBeli
      );

    margin.value =
      jualValid && beliValid
        ? format(
            hitungMargin(
              hargaJual,
              hargaBeli
            )
          )
        : '—';
  }

  function notify(
    text,
    tone = 'error'
  ) {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = !text;
  }

  function controls() {
    byId('formFields').disabled =
      busy ||
      !ready ||
      !canManage ||
      !subOptions.length;

    byId('reloadButton').disabled =
      busy;

    pageSize.disabled = busy;

    rows
      .querySelectorAll('button')
      .forEach(button => {
        button.disabled = busy;
      });

    pageButtons
      .querySelectorAll('button')
      .forEach(button => {
        button.disabled =
          busy ||
          button.dataset.current ===
            'true' ||
          button.dataset.boundary ===
            'true';
      });
  }

  async function api(
    path,
    options = {}
  ) {
    const response = await fetch(
      path,
      {
        credentials: 'same-origin',
        cache: 'no-store',
        ...options
      }
    );

    if (response.status === 401) {
      window.location.href =
        '/login.html';

      throw new Error(
        'Sesi berakhir. Silakan login kembali.'
      );
    }

    const contentType =
      response.headers.get(
        'content-type'
      ) || '';

    if (
      !contentType.includes(
        'application/json'
      )
    ) {
      throw new Error(
        'API belum tersedia. Pastikan route Master Produk Sewa sudah dipasang di server.'
      );
    }

    const result =
      await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Permintaan gagal. Silakan coba lagi.'
      );
    }

    return result;
  }

  function formatInput(input) {
    input.setCustomValidity('');

    const raw = input.value;

    if (/[^\d.]/.test(raw)) {
      input.setCustomValidity(
        'Gunakan rupiah bulat tanpa minus atau koma desimal.'
      );

      return;
    }

    const cursor =
      input.selectionStart ??
      raw.length;

    const digitsBefore = raw
      .slice(0, cursor)
      .replace(/\./g, '')
      .length;

    const digits = raw
      .replace(/\./g, '')
      .replace(/^0+(?=\d)/, '');

    if (digits.length > 18) {
      input.setCustomValidity(
        'Harga maksimal 18 digit.'
      );

      return;
    }

    input.value = format(digits);

    let position = 0;
    let seen = 0;

    while (
      position < input.value.length &&
      seen < digitsBefore
    ) {
      if (
        /\d/.test(
          input.value[position]
        )
      ) {
        seen++;
      }

      position++;
    }

    input.setSelectionRange(
      position,
      position
    );
  }

  [jual, beli].forEach(input => {
    input.addEventListener(
      'input',
      () => {
        formatInput(input);
        updateMargin();
      }
    );
  });

  item.addEventListener(
    'input',
    () => {
      item.setCustomValidity('');
    }
  );

  function fillSelect(
    element,
    values,
    placeholder
  ) {
    const old = element.value;

    element.replaceChildren(
      new Option(
        placeholder,
        ''
      )
    );

    for (const value of values) {
      element.add(
        new Option(
          value.name,
          String(value.id)
        )
      );
    }

    const valueMasihTersedia =
      values.some(value =>
        String(value.id) === old
      );

    if (valueMasihTersedia) {
      element.value = old;
    }
  }

  function resetForm() {
    editingId = null;

    form.reset();

    [item, jual, beli].forEach(
      input => {
        input.setCustomValidity('');
      }
    );

    updateMargin();

    byId('jenisProyek').value =
      'Sewa';

    byId('formTitle').textContent =
      'Tambah Produk';

    save.textContent =
      'Simpan Produk';

    byId('cancelButton').hidden =
      true;
  }

  function renderPagination(
    filteredCount,
    totalPages,
    perPage
  ) {
    const first = filteredCount
      ? (
          currentPage - 1
        ) * perPage + 1
      : 0;

    const last = Math.min(
      currentPage * perPage,
      filteredCount
    );

    byId('pageInfo').textContent =
      `Menampilkan ${first}–${last} dari ${filteredCount} produk`;

    pageButtons.replaceChildren();

    if (totalPages <= 1) {
      return;
    }

    function addButton(
      label,
      target,
      current = false
    ) {
      const button =
        document.createElement(
          'button'
        );

      button.type = 'button';
      button.textContent = label;
      button.dataset.page =
        String(target);

      if (current) {
        button.dataset.current =
          'true';

        button.setAttribute(
          'aria-current',
          'page'
        );
      }

      if (busy || current) {
        button.disabled = true;
      }

      pageButtons.append(button);
    }

    addButton(
      '‹',
      currentPage - 1
    );

    pageButtons
      .firstElementChild
      .setAttribute(
        'aria-label',
        'Halaman sebelumnya'
      );

    if (currentPage === 1) {
      pageButtons
        .firstElementChild
        .dataset.boundary =
          'true';
    }

    let previous = 0;

    for (
      let number = 1;
      number <= totalPages;
      number++
    ) {
      if (
        number !== 1 &&
        number !== totalPages &&
        Math.abs(
          number - currentPage
        ) > 2
      ) {
        continue;
      }

      if (
        number - previous > 1
      ) {
        const ellipsis =
          document.createElement(
            'span'
          );

        ellipsis.textContent = '…';

        ellipsis.setAttribute(
          'aria-hidden',
          'true'
        );

        pageButtons.append(
          ellipsis
        );
      }

      addButton(
        String(number),
        number,
        number === currentPage
      );

      previous = number;
    }

    addButton(
      '›',
      currentPage + 1
    );

    pageButtons
      .lastElementChild
      .setAttribute(
        'aria-label',
        'Halaman berikutnya'
      );

    if (
      currentPage === totalPages
    ) {
      pageButtons
        .lastElementChild
        .dataset.boundary =
          'true';
    }

    controls();
  }

  function render() {
    const available = new Map(
      subOptions.map(value => [
        String(value.id),
        value.name
      ])
    );

    data.forEach(value => {
      available.set(
        String(
          value.sub_jenis_proyek_id
        ),
        value.sub_jenis_proyek
      );
    });

    fillSelect(
      filter,
      [...available].map(
        ([id, name]) => ({
          id,
          name
        })
      ),
      'Semua Sub Jenis'
    );

    const term = search.value
      .trim()
      .toLocaleLowerCase(
        'id-ID'
      );

    const displayed = data
      .filter(value => {
        const namaProduk =
          value.item_produk
            .toLocaleLowerCase(
              'id-ID'
            );

        const deskripsiProduk =
          (value.deskripsi || '')
            .toLocaleLowerCase(
              'id-ID'
            );

        const cocokPencarian =
          namaProduk.includes(term) ||
          deskripsiProduk.includes(
            term
          );

        const cocokSubJenis =
          !filter.value ||
          String(
            value
              .sub_jenis_proyek_id
          ) === filter.value;

        return (
          cocokPencarian &&
          cocokSubJenis
        );
      })
      .sort((a, b) =>
        a.item_produk.localeCompare(
          b.item_produk,
          'id'
        )
      );

    const perPage =
      Number(pageSize.value) ||
      10;

    const totalPages = Math.max(
      1,
      Math.ceil(
        displayed.length /
        perPage
      )
    );

    currentPage = Math.min(
      Math.max(
        1,
        currentPage
      ),
      totalPages
    );

    const start =
      (
        currentPage - 1
      ) * perPage;

    const visibleRows =
      displayed.slice(
        start,
        start + perPage
      );

    rows.replaceChildren();

    byId('actionHeader').hidden =
      !canManage;

    byId('count').textContent =
      `${displayed.length} dari ${data.length} produk`;

    if (!visibleRows.length) {
      const cell = rows
        .insertRow()
        .insertCell();

      cell.colSpan =
        canManage ? 9 : 8;

      cell.className = 'empty';

      cell.textContent =
        data.length
          ? 'Tidak ada produk yang sesuai pencarian.'
          : 'Belum ada produk sewa.';
    }

    visibleRows.forEach(
      (value, index) => {
        const tr =
          rows.insertRow();

        const marginProduk =
          hitungMargin(
            value
              .harga_jual_per_item,
            value
              .harga_beli_per_item
          );

        const values = [
          start + index + 1,
          value.jenis_proyek,
          value.sub_jenis_proyek,
          value.item_produk,
          value.deskripsi || '—',
          rupiah(
            value
              .harga_jual_per_item
          ),
          rupiah(marginProduk),
          rupiah(
            value
              .harga_beli_per_item
          )
        ];

        values.forEach(
          (text, col) => {
            const cell =
              tr.insertCell();

            cell.textContent =
              text;

            if (col === 3) {
              cell.className =
                'product-name';
            }

            if (col === 4) {
              cell.className =
                'description';
            }

            if (col > 4) {
              cell.className =
                'number';
            }
          }
        );

        if (canManage) {
          const actions =
            tr.insertCell();

          actions.className =
            'row-actions';

          const buttons = [
            [
              'Edit',
              'edit',
              'secondary'
            ],
            [
              'Hapus',
              'delete',
              'danger'
            ]
          ];

          for (
            const [
              title,
              action,
              style
            ] of buttons
          ) {
            const button =
              document.createElement(
                'button'
              );

            button.type =
              'button';

            button.textContent =
              title;

            button.className =
              style;

            button.dataset.id =
              value.id;

            button.dataset.action =
              action;

            button.setAttribute(
              'aria-label',
              `${title} ${value.item_produk}`
            );

            actions.append(
              button
            );
          }
        }
      }
    );

    renderPagination(
      displayed.length,
      totalPages,
      perPage
    );

    controls();
  }

  async function load() {
    if (busy) {
      return;
    }

    busy = true;

    controls();

    notify(
      'Memuat produk…',
      'info'
    );

    try {
      const [
        options,
        products
      ] = await Promise.all([
        api(`${base}/options`),
        api(base)
      ]);

      if (
        !Array.isArray(
          options.sub_jenis
        ) ||
        !Array.isArray(
          products
        )
      ) {
        throw new Error(
          'Format data dari server tidak sesuai.'
        );
      }

      data = products;

      subOptions =
        options.sub_jenis;

      canManage =
        options.can_manage ===
        true;

      fillSelect(
        sub,
        subOptions,
        'Pilih Sub Jenis Proyek'
      );

      byId('formCard').hidden =
        !canManage;

      byId('accessNote').hidden =
        canManage;

      ready = true;

      render();

      notify(
        subOptions.length
          ? ''
          : 'Belum ada sub jenis Sewa yang aktif. Tambahkan sub jenis di Master Jenis Proyek, lalu klik Muat Ulang.',
        'info'
      );
    } catch (error) {
      notify(error.message);

      if (!ready) {
        rows.replaceChildren();

        const cell = rows
          .insertRow()
          .insertCell();

        cell.colSpan = 9;

        cell.className =
          'empty';

        cell.textContent =
          'Data belum dapat dimuat. Klik Muat Ulang untuk mencoba lagi.';
      }
    } finally {
      busy = false;
      controls();
    }
  }

  byId('cancelButton')
    .addEventListener(
      'click',
      () => {
        resetForm();
        notify('');
      }
    );

  byId('reloadButton')
    .addEventListener(
      'click',
      load
    );

  search.addEventListener(
    'input',
    () => {
      currentPage = 1;
      render();
    }
  );

  filter.addEventListener(
    'change',
    () => {
      currentPage = 1;
      render();
    }
  );

  pageSize.addEventListener(
    'change',
    () => {
      currentPage = 1;
      render();
    }
  );

  pageButtons.addEventListener(
    'click',
    event => {
      const button =
        event.target.closest(
          'button[data-page]'
        );

      if (
        !button ||
        busy ||
        button.disabled
      ) {
        return;
      }

      currentPage = Number(
        button.dataset.page
      );

      render();

      byId('listTitle')
        .scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
    }
  );

  rows.addEventListener(
    'click',
    async event => {
      const button =
        event.target.closest(
          'button[data-action]'
        );

      if (
        !button ||
        busy ||
        !canManage
      ) {
        return;
      }

      const product = data.find(
        value =>
          String(value.id) ===
          button.dataset.id
      );

      if (!product) {
        return;
      }

      if (
        button.dataset.action ===
        'edit'
      ) {
        resetForm();

        editingId = String(
          product.id
        );

        sub.value = String(
          product
            .sub_jenis_proyek_id
        );

        item.value =
          product.item_produk;

        deskripsi.value =
          product.deskripsi ||
          '';

        jual.value = format(
          product
            .harga_jual_per_item
        );

        beli.value = format(
          product
            .harga_beli_per_item
        );

        updateMargin();

        byId(
          'formTitle'
        ).textContent =
          'Edit Produk';

        save.textContent =
          'Simpan Perubahan';

        byId(
          'cancelButton'
        ).hidden = false;

        notify(
          sub.value
            ? ''
            : 'Sub jenis produk ini sudah tidak aktif. Pilih sub jenis aktif sebelum menyimpan.',
          'info'
        );

        byId('formCard')
          .scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

        item.focus({
          preventScroll: true
        });

        return;
      }

      const yakinHapus =
        window.confirm(
          `Hapus produk "${product.item_produk}"?`
        );

      if (!yakinHapus) {
        return;
      }

      busy = true;

      controls();

      try {
        await api(
          `${base}/${product.id}`,
          {
            method: 'DELETE'
          }
        );

        data = data.filter(
          value =>
            String(value.id) !==
            String(product.id)
        );

        if (
          editingId ===
          String(product.id)
        ) {
          resetForm();
        }

        render();

        notify(
          'Produk berhasil dihapus.',
          'success'
        );
      } catch (error) {
        notify(error.message);
      } finally {
        busy = false;
        controls();
      }
    }
  );

  form.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      if (
        busy ||
        !ready ||
        !canManage
      ) {
        return;
      }

      item.setCustomValidity(
        item.value.trim()
          ? ''
          : 'Item/Produk wajib diisi.'
      );

      [jual, beli].forEach(
        formatInput
      );

      updateMargin();

      if (
        !form.reportValidity()
      ) {
        return;
      }

      const payload = {
        jenis_proyek:
          'Sewa',

        sub_jenis_proyek_id:
          sub.value,

        item_produk:
          item.value.trim(),

        deskripsi:
          deskripsi.value.trim(),

        harga_jual_per_item:
          jual.value.replace(
            /\./g,
            ''
          ),

        harga_beli_per_item:
          beli.value.replace(
            /\./g,
            ''
          )
      };

      const id = editingId;

      busy = true;

      controls();

      save.textContent =
        'Menyimpan…';

      try {
        const product =
          await api(
            id
              ? `${base}/${id}`
              : base,
            {
              method: id
                ? 'PUT'
                : 'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify(
                  payload
                )
            }
          );

        data = id
          ? data.map(value =>
              String(value.id) ===
              id
                ? product
                : value
            )
          : [
              ...data,
              product
            ];

        resetForm();

        render();

        notify(
          id
            ? 'Produk berhasil diperbarui.'
            : 'Produk berhasil ditambahkan.',
          'success'
        );
      } catch (error) {
        notify(error.message);
      } finally {
        busy = false;

        save.textContent =
          editingId
            ? 'Simpan Perubahan'
            : 'Simpan Produk';

        controls();
      }
    }
  );

  if (
    window.location.protocol ===
    'file:'
  ) {
    notify(
      'Buka halaman melalui aplikasi, misalnya http://localhost:3000/produk-sewa.html.'
    );
  } else {
    load();
  }
})();