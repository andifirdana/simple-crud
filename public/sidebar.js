// ==================================================
// MINIMIZE / MAXIMIZE SIDEBAR
// ==================================================

function initSidebarToggle() {

  // Hindari memasang handler lebih dari sekali.
  if (
    document.documentElement.dataset.sidebarToggleReady === "true"
  ) {
    return;
  }

  document.documentElement.dataset.sidebarToggleReady = "true";

  function updateSidebar(collapsed) {

    document.body.classList.toggle(
      "sidebar-collapsed",
      collapsed
    );

    const button =
      document.getElementById("sidebarToggle");

    if (button) {

      button.textContent =
        collapsed ? "›" : "‹";

      const label =
        collapsed
          ? "Buka sidebar"
          : "Kecilkan sidebar";

      button.title = label;

      button.setAttribute("aria-label", label);

      button.setAttribute(
        "aria-expanded",
        String(!collapsed)
      );

    }

  }

  let collapsed = false;

  try {

    collapsed =
      localStorage.getItem("sidebarCollapsed") === "true";

  } catch {}

  updateSidebar(collapsed);

  document.addEventListener(
    "click",
    function (event) {

      if (!(event.target instanceof Element)) return;

      const button =
        event.target.closest("#sidebarToggle");

      if (!button) return;

      event.preventDefault();

      const nextCollapsed =
        !document.body.classList.contains(
          "sidebar-collapsed"
        );

      updateSidebar(nextCollapsed);

      try {

        localStorage.setItem(
          "sidebarCollapsed",
          String(nextCollapsed)
        );

      } catch {}

    },
    true
  );

}

// ==================================================
// LOAD MENU SIDEBAR
// ==================================================

async function loadSidebar() {

  const sidebarMenu =
    document.getElementById("sidebarMenu");

  if (!sidebarMenu) return;

  try {

    const response =
      await fetch("/api/menu");

    if (!response.ok) {
      throw new Error("Gagal mengambil menu");
    }

    const menus =
      await response.json();

    if (!Array.isArray(menus)) {
      throw new Error("Format menu tidak valid");
    }

    // ==============================================
    // KELOMPOKKAN BERDASARKAN group_menu DARI API
    // ==============================================

    const groupedMenus = new Map();

    menus.forEach(menu => {

      const groupName =
        String(menu.group_menu || "").trim() || "Menu";

      if (!groupedMenus.has(groupName)) {
        groupedMenus.set(groupName, []);
      }

      groupedMenus.get(groupName).push(menu);

    });

    const fragment =
      document.createDocumentFragment();

    const groups = [];

    let activeGroup = null;

    function normalizePath(path) {
      return path.replace(/\/+$/, "") || "/";
    }

    const currentPath =
      normalizePath(window.location.pathname);

    // ==============================================
    // BENTUK KELOMPOK MENU
    // ==============================================

    groupedMenus.forEach((items, groupName) => {

      const group =
        document.createElement("details");

      group.className = "sidebar-menu-group";

      const heading =
        document.createElement("summary");

      heading.className = "sidebar-group-heading";

      const title =
        document.createElement("span");

      title.textContent = groupName;

      heading.appendChild(title);

      const links =
        document.createElement("div");

      links.className = "sidebar-group-links";

      items.forEach(menu => {

        const link =
          document.createElement("a");

        const menuUrl =
          String(menu.url || "").trim();

        link.href = menuUrl || "#";

        link.textContent =
          menu.nama_menu || "Menu";

        // Tandai halaman aktif.
        if (menuUrl && !menuUrl.startsWith("#")) {

          try {

            const url = new URL(
              menuUrl,
              window.location.origin
            );

            const isActive =
              url.origin === window.location.origin &&
              normalizePath(url.pathname) === currentPath;

            if (isActive) {

              link.classList.add("active");

              link.setAttribute(
                "aria-current",
                "page"
              );

              group.classList.add(
                "has-active-menu"
              );

              activeGroup = group;

            }

          } catch {
            console.warn(
              "URL menu tidak valid:",
              menuUrl
            );
          }

        }

        links.appendChild(link);

      });

      group.append(heading, links);

      groups.push(group);

      fragment.appendChild(group);

    });

    sidebarMenu.replaceChildren(fragment);

    // ==============================================
    // HANYA SATU KELOMPOK TERBUKA
    // ==============================================

    groups.forEach(group => {

      group.addEventListener("toggle", () => {

        if (!group.open) return;

        groups.forEach(otherGroup => {

          if (otherGroup !== group) {
            otherGroup.open = false;
          }

        });

      });

    });

    // Buka kelompok halaman aktif.
    // Jika tidak ada, buka kelompok pertama.
    const initialGroup =
      activeGroup || groups[0];

    if (initialGroup) {
      initialGroup.open = true;
    }

  } catch (error) {

    console.error("ERROR LOAD SIDEBAR:", error);

    sidebarMenu.innerHTML = `
      <div class="menu-error">
        Menu gagal dimuat
      </div>
    `;

  }

}

function initSidebar() {

  initSidebarToggle();

  loadSidebar();

}

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    initSidebar,
    { once: true }
  );

} else {

  initSidebar();

}

// ==================================================
// INISIALISASI
// ==================================================

function initSidebar() {

  initSidebarToggle();

  loadSidebar();

}

if (document.readyState === "loading") {

  document.addEventListener(
    "DOMContentLoaded",
    initSidebar,
    { once: true }
  );

} else {

  initSidebar();

}
(() => {

  function initMenuGroups() {

    if (
      document.getElementById("portopro-menu-group-style")
    ) {
      return;
    }

    // ==============================================
    // STYLE KELOMPOK MENU
    // ==============================================

    const style =
      document.createElement("style");

    style.id = "portopro-menu-group-style";

    style.textContent = `
      .sidebar #sidebarMenu .pp-menu-group {
        display: block;
        margin: 0 0 8px;
        padding: 0;
        border: 0;
      }

      .sidebar #sidebarMenu .pp-menu-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;

        margin: 0;
        padding: 11px 12px;

        border-radius: 9px;
        background: rgba(255, 255, 255, 0.07);
        color: #ffffff;

        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.5;

        list-style: none;
        cursor: pointer;
      }

      .sidebar #sidebarMenu
      .pp-menu-heading::-webkit-details-marker {
        display: none;
      }

      .sidebar #sidebarMenu .pp-menu-heading::marker {
        content: "";
      }

      .sidebar #sidebarMenu .pp-menu-heading::after {
        content: "›";
        flex-shrink: 0;
        font-size: 21px;
        line-height: 1;
        transition: transform 0.2s ease;
      }

      .sidebar #sidebarMenu
      .pp-menu-group[open] > .pp-menu-heading::after {
        transform: rotate(90deg);
      }

      .sidebar #sidebarMenu .pp-menu-heading:hover {
        background: rgba(255, 255, 255, 0.13);
      }

      .sidebar #sidebarMenu .pp-menu-items {
        display: flex;
        flex-direction: column;
        gap: 3px;

        margin: 6px 0 10px 12px;
        padding-left: 9px;

        border-left: 1px solid rgba(255,255,255,0.18);
      }

      .sidebar #sidebarMenu
      .pp-menu-group:not([open]) > .pp-menu-items {
        display: none !important;
      }

      .sidebar #sidebarMenu .pp-menu-items > a {
        display: block;
        box-sizing: border-box;

        width: 100%;
        margin: 0;
        padding: 9px 11px;

        border-radius: 8px;
        background: transparent;
        color: #cbddec;

        font-family: inherit;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.5;

        text-decoration: none;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .sidebar #sidebarMenu .pp-menu-items > a:hover {
        background: rgba(255,255,255,0.08);
        color: #ffffff;
      }

      .sidebar #sidebarMenu .pp-menu-items > a.active {
        background: #ccddb0;
        color: #234530;
        font-weight: 700;
      }

      .sidebar #sidebarMenu .pp-menu-heading:focus-visible {
        outline: 2px solid #ccddb0;
        outline-offset: 2px;
      }
    `;

    document.head.appendChild(style);

    // ==============================================
    // UBAH JUDUL DAN LINK LAMA MENJADI KELOMPOK
    // ==============================================

    function groupExistingMenus() {

      const menu =
        document.getElementById("sidebarMenu");

      if (!menu) return;

      const children =
        Array.from(menu.children);

      // Hanya proses jika menu masih memakai struktur lama.
      const hasOldTitles =
        children.some(element =>
          element.classList.contains("menu-title")
        );

      if (!hasOldTitles) return;

      const fragment =
        document.createDocumentFragment();

      const groups = [];

      let currentItems = null;

      children.forEach(element => {

        if (
          element.classList.contains("menu-title")
        ) {

          const group =
            document.createElement("details");

          group.className = "pp-menu-group";

          const heading =
            document.createElement("summary");

          heading.className = "pp-menu-heading";

          const label =
            document.createElement("span");

          label.textContent =
            element.textContent.trim();

          heading.appendChild(label);

          currentItems =
            document.createElement("div");

          currentItems.className = "pp-menu-items";

          group.append(
            heading,
            currentItems
          );

          // Saat membuka kelompok, tutup kelompok lain.
          heading.addEventListener("click", () => {

            if (group.open) return;

            groups.forEach(other => {

              if (other !== group) {
                other.open = false;
              }

            });

          });

          groups.push(group);

          fragment.appendChild(group);

          return;
        }

        if (currentItems) {

          // Pindahkan link asli agar event yang ada tetap terjaga.
          currentItems.appendChild(element);

        } else {

          fragment.appendChild(element);

        }

      });

      menu.replaceChildren(fragment);

      const activeGroup =
        groups.find(group =>
          group.querySelector("a.active")
        );

      const initialGroup =
        activeGroup || groups[0];

      if (initialGroup) {
        initialGroup.open = true;
      }

    }

    // Pantau menu yang selesai dimuat melalui fetch.
    const observer =
      new MutationObserver(groupExistingMenus);

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    groupExistingMenus();

  }

  if (document.readyState === "loading") {

    document.addEventListener(
      "DOMContentLoaded",
      initMenuGroups,
      { once: true }
    );

  } else {

    initMenuGroups();

  }

})();