(() => {
  "use strict";

  const API = "/api/status-proyek";

  const byId = id =>
    document.getElementById(id);

  const state = {
    rows: [],
    page: 1,
    pageSize: 10,
    query: "",
    editingId: null,
    deletingId: null,
    busy: false,
    loading: false,
    loadVersion: 0,
    loadError: false
  };

  const dateFormat =
    new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta"
    });

  // ==========================================
  // PESAN
  // ==========================================

  function showMessage(
    id,
    message,
    error = false
  ) {
    const element = byId(id);

    element.textContent = message;
    element.hidden = !message;

    element.classList.toggle(
      "error",
      error
    );
  }

  // ==========================================
  // REQUEST API
  // ==========================================

  async function request(
    url,
    options = {}
  ) {
    const response = await fetch(url, {
      ...options,

      credentials: "same-origin",

      headers: {
        Accept: "application/json",
        ...options.headers
      }
    });

    const isJson = (
      response.headers.get("content-type") || ""
    ).includes("application/json");

    const data = isJson
      ? await response.json()
      : null;

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          "Sesi berakhir. Silakan login kembali."
        );
      }

      throw new Error(
        data?.error ||
        data?.message ||
        `Permintaan gagal (HTTP ${response.status}). Periksa API status proyek.`
      );
    }

    if (
      !isJson &&
      response.status !== 204
    ) {
      throw new Error(
        "Respons API bukan JSON. Periksa endpoint atau sesi login."
      );
    }

    return data;
  }

  // ==========================================
  // FORMAT TANGGAL JAKARTA
  // ==========================================

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return dateFormat.format(date);
  }

  // ==========================================
  // BUAT CELL TABEL
  // ==========================================

  function cell(
    row,
    value,
    className
  ) {
    const td =
      document.createElement("td");

    td.textContent = value ?? "—";

    if (className) {
      td.className = className;
    }

    row.append(td);

    return td;
  }

  // ==========================================
  // RENDER TABEL
  // ==========================================

  function render() {
    const filtered = state.rows.filter(
      row =>
        [
          row.deskripsi,
          row.flag,
          row.status
        ].some(value =>
          String(value ?? "")
            .toLocaleLowerCase("id-ID")
            .includes(state.query)
        )
    );

    const pages = Math.max(
      1,
      Math.ceil(
        filtered.length / state.pageSize
      )
    );

    state.page = Math.min(
      state.page,
      pages
    );

    const offset =
      (state.page - 1) * state.pageSize;

    const tbody = byId("statusRows");

    tbody.replaceChildren();

    if (
      state.loading ||
      state.loadError ||
      !filtered.length
    ) {
      const row =
        document.createElement("tr");

      let message =
        "Tidak ada data status proyek.";

      if (state.loading) {
        message = "Memuat data…";
      } else if (state.loadError) {
        message =
          "Data belum berhasil dimuat. Klik Muat Ulang.";
      }

      const td = cell(
        row,
        message,
        "table-message"
      );

      td.colSpan = 7;

      tbody.append(row);
    } else {
      filtered
        .slice(
          offset,
          offset + state.pageSize
        )
        .forEach((item, index) => {
          const row =
            document.createElement("tr");

          cell(
            row,
            offset + index + 1
          );

          cell(
            row,
            item.deskripsi,
            "description"
          );

          cell(
            row,
            item.flag
          );

          const badge =
            document.createElement("span");

          badge.className = "badge";

          badge.textContent =
            item.status ?? "—";

          cell(row, "").append(badge);

          cell(
            row,
            formatDate(item.created_at)
          );

          cell(
            row,
            formatDate(item.updated_at)
          );

          const actions =
            document.createElement("div");

          actions.className =
            "row-actions";

          const buttons = [
            ["edit", "Edit"],
            ["delete", "Hapus"]
          ];

          for (
            const [action, label]
            of buttons
          ) {
            const button =
              document.createElement(
                "button"
              );

            button.type = "button";

            button.textContent = label;

            button.dataset.action =
              action;

            button.dataset.id =
              String(item.id);

            button.setAttribute(
              "aria-label",
              `${label} ${item.deskripsi}`
            );

            if (action === "delete") {
              button.className =
                "danger";
            }

            actions.append(button);
          }

          cell(row, "").append(actions);

          tbody.append(row);
        });
    }

    byId("pageInfo").textContent =
      `${state.page} / ${pages}`;

    byId("previousPage").disabled =
      state.loading ||
      state.page <= 1;

    byId("nextPage").disabled =
      state.loading ||
      state.page >= pages;

    if (state.loading) {
      byId("resultInfo").textContent =
        "Memuat data…";

      return;
    }

    if (state.loadError) {
      byId("resultInfo").textContent =
        "Gagal memuat data";

      return;
    }

    const start = filtered.length
      ? offset + 1
      : 0;

    const end = Math.min(
      offset + state.pageSize,
      filtered.length
    );

    byId("resultInfo").textContent =
      `${start}–${end} dari ${filtered.length} data`;
  }

  // ==========================================
  // LOAD DATA
  // ==========================================

  async function loadRows() {
    const version =
      ++state.loadVersion;

    state.loading = true;
    state.loadError = false;

    byId("reloadStatus").disabled =
      true;

    render();

    try {
      const result =
        await request(API);

      if (
        version !== state.loadVersion
      ) {
        return;
      }

      const rows =
        Array.isArray(result)
          ? result
          : result?.data;

      if (!Array.isArray(rows)) {
        throw new Error(
          "Format daftar status dari API tidak valid."
        );
      }

      state.rows = rows;
    } catch (error) {
      if (
        version !== state.loadVersion
      ) {
        return;
      }

      state.loadError = true;

      showMessage(
        "pageNotice",
        error.message,
        true
      );
    } finally {
      if (
        version === state.loadVersion
      ) {
        state.loading = false;

        byId("reloadStatus").disabled =
          false;

        render();
      }
    }
  }

  // ==========================================
  // STATUS PROSES SIMPAN / HAPUS
  // ==========================================

  function setBusy(value) {
    state.busy = value;

    document
      .querySelectorAll(
        [
          "#statusDialog button",
          "#deleteDialog button",
          "#statusForm input",
          "#statusForm select"
        ].join(", ")
      )
      .forEach(element => {
        element.disabled = value;
      });

    byId("saveStatus").textContent =
      value
        ? "Menyimpan…"
        : "Simpan";

    byId("confirmDelete").textContent =
      value
        ? "Menghapus…"
        : "Hapus";
  }

  // ==========================================
  // BUKA FORM TAMBAH / EDIT
  // ==========================================

  function openForm(item = null) {
    byId("statusForm").reset();

    state.editingId = item
      ? String(item.id)
      : null;

    byId(
      "statusDialogTitle"
    ).textContent = item
      ? "Edit Status"
      : "Tambah Status";

    for (
      const key of [
        "deskripsi",
        "flag",
        "status"
      ]
    ) {
      byId(key).value =
        item?.[key] ?? "";
    }

    showMessage(
      "formError",
      ""
    );

    byId("statusDialog").showModal();

    byId("deskripsi").focus();
  }

  // ==========================================
  // TAMBAH
  // ==========================================

  byId("addStatus")
    .addEventListener("click", () => {
      if (!state.busy) {
        openForm();
      }
    });

  // ==========================================
  // MUAT ULANG
  // ==========================================

  byId("reloadStatus")
    .addEventListener("click", () => {
      showMessage(
        "pageNotice",
        ""
      );

      loadRows();
    });

  // ==========================================
  // PENCARIAN
  // ==========================================

  byId("searchStatus")
    .addEventListener(
      "input",
      event => {
        state.query =
          event.target.value
            .trim()
            .toLocaleLowerCase("id-ID");

        state.page = 1;

        render();
      }
    );

  // ==========================================
  // JUMLAH DATA PER HALAMAN
  // ==========================================

  byId("pageSize")
    .addEventListener(
      "change",
      event => {
        state.pageSize =
          Number(event.target.value);

        state.page = 1;

        render();
      }
    );

  // ==========================================
  // PAGINATION
  // ==========================================

  byId("previousPage")
    .addEventListener("click", () => {
      state.page = Math.max(
        1,
        state.page - 1
      );

      render();
    });

  byId("nextPage")
    .addEventListener("click", () => {
      state.page += 1;

      render();
    });

  // ==========================================
  // TUTUP MODAL
  // ==========================================

  document
    .querySelectorAll(
      ".status-modal [data-close]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          if (state.busy) {
            return;
          }

          byId(
            button.dataset.close
          ).close();
        }
      );
    });

  document
    .querySelectorAll(
      "dialog.status-modal"
    )
    .forEach(dialog => {
      dialog.addEventListener(
        "cancel",
        event => {
          if (state.busy) {
            event.preventDefault();
          }
        }
      );
    });

  // ==========================================
  // EDIT / HAPUS PADA TABEL
  // ==========================================

  byId("statusRows")
    .addEventListener(
      "click",
      event => {
        const button =
          event.target.closest(
            "button[data-action]"
          );

        if (
          !button ||
          state.busy
        ) {
          return;
        }

        const item =
          state.rows.find(
            row =>
              String(row.id) ===
              button.dataset.id
          );

        if (!item) {
          return;
        }

        if (
          button.dataset.action ===
          "edit"
        ) {
          openForm(item);

          return;
        }

        state.deletingId =
          String(item.id);

        byId(
          "deleteDescription"
        ).textContent =
          item.deskripsi;

        showMessage(
          "deleteError",
          ""
        );

        byId(
          "deleteDialog"
        ).showModal();
      }
    );

  // ==========================================
  // SIMPAN TAMBAH / EDIT
  // ==========================================

  byId("statusForm")
    .addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        if (state.busy) {
          return;
        }

        const payload = {};

        for (
          const key of [
            "deskripsi",
            "flag",
            "status"
          ]
        ) {
          payload[key] =
            byId(key).value.trim();

          if (!payload[key]) {
            showMessage(
              "formError",
              "Deskripsi, flag, dan status wajib diisi.",
              true
            );

            byId(key).focus();

            return;
          }
        }

        showMessage(
          "formError",
          ""
        );

        setBusy(true);

        try {
          const editing =
            state.editingId !== null;

          const url = editing
            ? `${API}/${encodeURIComponent(
                state.editingId
              )}`
            : API;

          await request(url, {
            method: editing
              ? "PUT"
              : "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(payload)
          });

          byId(
            "statusDialog"
          ).close();

          showMessage(
            "pageNotice",
            editing
              ? "Status berhasil diperbarui."
              : "Status berhasil ditambahkan."
          );

          await loadRows();
        } catch (error) {
          showMessage(
            "formError",
            error.message,
            true
          );
        } finally {
          setBusy(false);
        }
      }
    );

  // ==========================================
  // KONFIRMASI HAPUS
  // ==========================================

  byId("confirmDelete")
    .addEventListener(
      "click",
      async () => {
        if (
          state.busy ||
          !state.deletingId
        ) {
          return;
        }

        setBusy(true);

        showMessage(
          "deleteError",
          ""
        );

        try {
          const url =
            `${API}/${encodeURIComponent(
              state.deletingId
            )}`;

          await request(url, {
            method: "DELETE"
          });

          byId(
            "deleteDialog"
          ).close();

          state.deletingId = null;

          showMessage(
            "pageNotice",
            "Status berhasil dihapus."
          );

          await loadRows();
        } catch (error) {
          showMessage(
            "deleteError",
            error.message,
            true
          );
        } finally {
          setBusy(false);
        }
      }
    );

  // ==========================================
  // SESUAIKAN KONTEN DENGAN LEBAR SIDEBAR
  // TERMASUK SAAT MINIMIZE / MAXIMIZE
  // ==========================================

  function initStatusSidebarResize() {
    const container =
      byId("sidebarContainer");

    if (!container) {
      return;
    }

    let observed = null;
    let frame = null;

    function update() {
      frame = null;

      const sidebar =
        container.querySelector(
          ".sidebar"
        );

      const mobile =
        window.matchMedia(
          "(max-width: 768px)"
        ).matches;

      let width = 0;

      if (
        sidebar &&
        !mobile
      ) {
        const style =
          getComputedStyle(sidebar);

        if (
          style.display !== "none" &&
          style.visibility !== "hidden"
        ) {
          width = Math.max(
            0,
            Math.min(
              window.innerWidth,
              sidebar
                .getBoundingClientRect()
                .right
            )
          );
        }
      }

      document.body.style.setProperty(
        "--status-sidebar-width",
        `${width}px`
      );
    }

    function schedule() {
      if (frame === null) {
        frame =
          requestAnimationFrame(update);
      }
    }

    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);

    function observe() {
      const sidebar =
        container.querySelector(
          ".sidebar"
        );

      if (sidebar !== observed) {
        resize?.disconnect();

        observed = sidebar;

        if (sidebar) {
          resize?.observe(sidebar);
        }
      }

      schedule();
    }

    new MutationObserver(observe)
      .observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style"
        ]
      });

    new MutationObserver(schedule)
      .observe(document.body, {
        attributes: true,
        attributeFilter: [
          "class"
        ]
      });

    window.addEventListener(
      "resize",
      schedule
    );

    container.addEventListener(
      "transitionend",
      schedule
    );

    observe();
  }

  // ==========================================
  // LOAD AWAL
  // ==========================================

  initStatusSidebarResize();

  loadRows();
})();