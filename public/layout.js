async function loadSidebarLayout() {
  const container = document.getElementById('sidebarContainer');

  if (!container) return;

  try {
    const response = await fetch('/sidebar.html');

    if (!response.ok) {
      throw new Error('Gagal memuat sidebar');
    }

    const html = await response.text();

    container.innerHTML = html;
    await loadCurrentUser();
    await loadSidebarMenu();

      // Aktifkan logout
    setupLogout();

  } catch (error) {
    console.error('Sidebar error:', error);
  }
}


async function loadSidebarMenu() {
  const sidebarMenu = document.getElementById('sidebarMenu');

  if (!sidebarMenu) return;

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

      const title = document.createElement('div');
      title.className = 'menu-title';
      title.textContent = groupName;

      sidebarMenu.appendChild(title);


      items.forEach(menu => {

        const link = document.createElement('a');

        link.href = menu.url || '#';
        link.textContent = menu.nama_menu;

        if (window.location.pathname === menu.url) {
          link.classList.add('active');
        }

        sidebarMenu.appendChild(link);
      });

    });

  } catch (error) {
    console.error('Menu error:', error);
  }
}


async function loadCurrentUser() {

  try {

    const response = await fetch('/api/me');

    if (response.status === 401) {
      window.location.href = '/login.html';
      return;
    }

    if (!response.ok) {
      throw new Error(
        'Gagal mengambil data user'
      );
    }

    const user = await response.json();

    document.getElementById(
      'userNama'
    ).textContent = user.user.nama;

    document.getElementById(
      'userRole'
    ).textContent = user.user.role;


  } catch (error) {

    console.error(
      'User error:',
      error
    );

  }
}

function setupLogout() {

  const button =
    document.getElementById('logoutButton');

  if (!button) return;

  button.addEventListener(
    'click',
    async () => {

      await fetch('/api/logout', {
        method: 'POST'
      });

      window.location.href =
        '/login.html';

    }
  );
}

document.addEventListener(
  'DOMContentLoaded',
  loadSidebarLayout
);