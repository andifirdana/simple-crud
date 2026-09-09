async function loadSidebar() {

  const sidebarMenu = document.getElementById('sidebarMenu');

  if (!sidebarMenu) {
    return;
  }

  try {

    const response = await fetch('/api/menu');

    if (!response.ok) {
      throw new Error('Gagal mengambil menu');
    }

    const menus = await response.json();

    sidebarMenu.innerHTML = '';

    const groupedMenus = {};

    menus.forEach(menu => {

      const groupName = menu.group_menu || 'Menu';

      if (!groupedMenus[groupName]) {
        groupedMenus[groupName] = [];
      }

      groupedMenus[groupName].push(menu);

    });


    Object.entries(groupedMenus).forEach(([groupName, items]) => {

      // Judul group
      const title = document.createElement('div');

      title.className = 'menu-title';

      title.textContent = groupName;

      sidebarMenu.appendChild(title);


      // Menu
      items.forEach(menu => {

        const link = document.createElement('a');

        link.href = menu.url || '#';

        link.textContent = menu.nama_menu;

        // Tandai menu aktif berdasarkan URL
        if (
          window.location.pathname === menu.url
        ) {
          link.classList.add('active');
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


document.addEventListener(
  'DOMContentLoaded',
  loadSidebar
);