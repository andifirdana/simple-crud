function pasangStylePagination() {
  const styleId = "shared-pagination-style";

  // Pasang sekali meskipun pagination dirender berulang.
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement("style");

  style.id = styleId;

  style.textContent = `
    .app-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;

      margin-top: 16px;
      padding: 18px 20px;

      border-top: 1px solid #e5eaf2;
      border-radius: 0 0 14px 14px;

      background: #ffffff;

      box-sizing: border-box;
    }

    .app-pagination .project-pagination-info {
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
    }

    .app-pagination .project-pagination-controls {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }

    .app-pagination .project-pagination-label {
      margin-right: 4px;

      color: #475569;
      font-size: 12px;
      font-weight: 700;

      white-space: nowrap;
    }

    .app-pagination .project-pagination-select {
      width: 64px;
      min-width: 64px;
      height: 40px;

      margin: 0;
      padding: 0 8px;

      border: 1px solid #cbd5e1;
      border-radius: 9px;

      background: #ffffff;
      color: #1e293b;

      font-family: inherit;
      font-size: 14px;

      box-sizing: border-box;
      cursor: pointer;
    }

    .app-pagination .project-pagination-pages {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .app-pagination .project-page-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;

      flex: 0 0 auto;

      width: auto;
      min-width: 38px;
      height: 40px;

      margin: 0;
      padding: 0 10px;

      border: 1px solid #e2e8f0;
      border-radius: 9px;

      background: #eef2f6;
      color: #334155;

      font-family: inherit;
      font-size: 13px;
      font-weight: 700;

      box-shadow: none;
      box-sizing: border-box;

      cursor: pointer;

      transition:
        background 0.2s ease,
        border-color 0.2s ease;
    }

    .app-pagination .project-page-button:hover:not(:disabled) {
      border-color: #a5b4fc;
      background: #e0e7ff;
    }

    .app-pagination .project-page-button.is-active,
    .app-pagination .project-page-button.is-active:hover {
      border-color: #a5b4fc;
      background: #a5b4fc;
      color: #ffffff;
    }

    .app-pagination .project-page-button:disabled {
      border-color: #f1f5f9;
      background: #f8fafc;
      color: #b0b8c5;

      cursor: not-allowed;
    }

    .app-pagination .project-page-button:focus-visible,
    .app-pagination .project-pagination-select:focus-visible {
      outline: 2px solid #6366f1;
      outline-offset: 2px;
    }

    .app-pagination .project-page-dots {
      padding: 0 3px;

      color: #94a3b8;
      font-size: 14px;
    }

    @media (max-width: 700px) {
      .app-pagination {
        align-items: flex-start;
        flex-direction: column;

        padding: 16px;
      }

      .app-pagination .project-pagination-controls {
        width: 100%;
      }
    }
  `;

  document.head.append(style);
}

function createPagination({
  containerId,
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange,
  onItemsPerPageChange,
  itemLabel = "data",
  pageSizeOptions = [10, 15, 25, 50, 100]
}) {
  const container =
    document.getElementById(containerId);

  if (!container) {
    return;
  }
pasangStylePagination();

container.classList.add("app-pagination");

  const totalInput = Number(totalItems);

  const total = Number.isFinite(totalInput)
    ? Math.max(0, Math.trunc(totalInput))
    : 0;

  const sizeInput = Number(itemsPerPage);

  const size =
    Number.isFinite(sizeInput) && sizeInput >= 1
      ? Math.trunc(sizeInput)
      : 10;

  const totalPages = Math.max(
    1,
    Math.ceil(total / size)
  );

  const pageInput = Number(currentPage);

  const page = Math.min(
    Math.max(
      Number.isFinite(pageInput)
        ? Math.trunc(pageInput)
        : 1,
      1
    ),
    totalPages
  );

  const start = total === 0
    ? 0
    : (page - 1) * size + 1;

  const end = Math.min(
    page * size,
    total
  );

  container.replaceChildren();

  // ====================================================
  // INFORMASI JUMLAH DATA
  // ====================================================

  const info = document.createElement("div");

  info.className =
    "project-pagination-info";

  info.textContent =
    `Menampilkan ${start.toLocaleString("id-ID")}–` +
    `${end.toLocaleString("id-ID")} dari ` +
    `${total.toLocaleString("id-ID")} ${itemLabel}`;

  // ====================================================
  // KONTROL PAGINATION
  // ====================================================

  const controls =
    document.createElement("div");

  controls.className =
    "project-pagination-controls";

  // Dropdown ditampilkan jika callback tersedia.
  if (
    typeof onItemsPerPageChange === "function"
  ) {
    const selectId =
      `${containerId}PerPage`;

    const label =
      document.createElement("label");

    label.className =
      "project-pagination-label";

    label.htmlFor = selectId;

    label.textContent =
      `${itemLabel.charAt(0).toUpperCase()}` +
      `${itemLabel.slice(1)} per halaman`;

    const select =
      document.createElement("select");

    select.id = selectId;

    select.className =
      "project-pagination-select";

    const sizes = [
      ...new Set(
        [...pageSizeOptions, size]
          .map(Number)
          .filter(value =>
            Number.isInteger(value) &&
            value > 0
          )
      )
    ].sort((a, b) => a - b);

    sizes.forEach(value => {
      const option =
        document.createElement("option");

      option.value = String(value);

      option.textContent = String(value);

      option.selected = value === size;

      select.append(option);
    });

    select.addEventListener(
      "change",
      () => {
        const selected =
          Number(select.value);

        if (
          selected !== size &&
          sizes.includes(selected)
        ) {
          onItemsPerPageChange(selected);
        }
      }
    );

    controls.append(label, select);
  }

  // ====================================================
  // TOMBOL HALAMAN
  // ====================================================

  const navigation =
    document.createElement("nav");

  navigation.className =
    "project-pagination-pages";

  navigation.setAttribute(
    "aria-label",
    `Pagination ${itemLabel}`
  );

  function makeButton({
    text,
    targetPage,
    label,
    active = false,
    disabled = false
  }) {
    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "project-page-button";

    button.textContent = String(text);

    button.disabled =
      disabled ||
      typeof onPageChange !== "function";

    button.setAttribute(
      "aria-label",
      label
    );

    if (active) {
      button.classList.add("is-active");

      button.setAttribute(
        "aria-current",
        "page"
      );
    }

    button.addEventListener(
      "click",
      () => {
        if (
          !button.disabled &&
          targetPage !== page &&
          targetPage >= 1 &&
          targetPage <= totalPages
        ) {
          onPageChange(targetPage);
        }
      }
    );

    return button;
  }

  // PREVIOUS
  navigation.append(
    makeButton({
      text: "‹",
      targetPage: page - 1,
      label: "Halaman sebelumnya",
      disabled: page === 1
    })
  );

  // NOMOR HALAMAN
  const pages = [
    ...new Set([
      1,
      page - 1,
      page,
      page + 1,
      totalPages
    ])
  ]
    .filter(value =>
      value >= 1 &&
      value <= totalPages
    )
    .sort((a, b) => a - b);

  function appendPage(value) {
    navigation.append(
      makeButton({
        text: value,
        targetPage: value,
        label: `Halaman ${value}`,
        active: value === page
      })
    );
  }

  pages.forEach((value, index) => {
    if (index > 0) {
      const previous = pages[index - 1];

      const gap = value - previous;

      if (gap === 2) {
        appendPage(previous + 1);

      } else if (gap > 2) {
        const dots =
          document.createElement("span");

        dots.className =
          "project-page-dots";

        dots.textContent = "…";

        dots.setAttribute(
          "aria-hidden",
          "true"
        );

        navigation.append(dots);
      }
    }

    appendPage(value);
  });

  // NEXT
  navigation.append(
    makeButton({
      text: "›",
      targetPage: page + 1,
      label: "Halaman berikutnya",
      disabled: page === totalPages
    })
  );

  controls.append(navigation);

  container.append(info, controls);
}