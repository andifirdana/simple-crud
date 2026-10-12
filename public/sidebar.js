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

    sidebarMenu.replaceChildren();

    const groupedMenus = new Map();

    menus.forEach(menu => {

      const groupName =
        menu.group_menu || "Menu";

      if (!groupedMenus.has(groupName)) {
        groupedMenus.set(groupName, []);
      }

      groupedMenus.get(groupName).push(menu);

    });

    groupedMenus.forEach((items, groupName) => {

      const title =
        document.createElement("div");

      title.className = "menu-title";
      title.textContent = groupName;

      sidebarMenu.appendChild(title);

      items.forEach(menu => {

        const link =
          document.createElement("a");

        link.href = menu.url || "#";
        link.textContent = menu.nama_menu;

        const menuPath = new URL(
          link.href,
          window.location.origin
        ).pathname;

        if (
          window.location.pathname === menuPath
        ) {

          link.classList.add("active");

          link.setAttribute(
            "aria-current",
            "page"
          );

        }

        sidebarMenu.appendChild(link);

      });

    });

  } catch (error) {

    console.error(error);

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