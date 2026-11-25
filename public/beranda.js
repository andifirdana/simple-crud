"use strict";

(() => {
  const bulan = document.getElementById("dashboardMonth");
  const formatBulan = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    timeZone: "UTC"
  });

  for (let nomor = 1; nomor <= 12; nomor += 1) {
    const nama = formatBulan.format(new Date(Date.UTC(2000, nomor - 1, 1)));
    bulan.add(new Option(nama, String(nomor)));
  }

  const pilihan = new URLSearchParams(window.location.search).get("bulan");
  if ([...bulan.options].some(option => option.value === pilihan)) {
    bulan.value = pilihan;
  }
})();
