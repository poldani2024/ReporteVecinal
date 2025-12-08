const map = L.map("map").setView([-32.95, -60.65], 14); // Rosario aprox

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

let reportes = JSON.parse(localStorage.getItem("reportesBarrio")) || [];
let markerTemp;

// mostrar reportes guardados
reportes.forEach((r) => {
  L.marker([r.lat, r.lng]).addTo(map)
    .bindPopup(`<b>${r.tipo}</b><br>${r.descripcion}`);
});

map.on("click", (e) => {
  const { lat, lng } = e.latlng;

  // verificar duplicados (radio ~50 m)
  const existeCerca = reportes.find(
    (r) => distance(lat, lng, r.lat, r.lng) < 0.05
  );

  if (existeCerca) {
    alert(
      `⚠️ Ya existe un reporte cercano: ${existeCerca.tipo}.\nPodés sumarte o crear uno nuevo.`
    );
  }

  if (markerTemp) map.removeLayer(markerTemp);
  markerTemp = L.marker([lat, lng]).addTo(map);

  mostrarFormulario(lat, lng);
});

function mostrarFormulario(lat, lng) {
  const form = document.getElementById("report-form");
  form.classList.remove("hidden");

  form.onsubmit = (ev) => {
    ev.preventDefault();

    const tipo = document.getElementById("tipo").value;
    const descripcion = document.getElementById("descripcion").value;

    const nuevo = { tipo, descripcion, lat, lng, fecha: new Date() };
    reportes.push(nuevo);
    localStorage.setItem("reportesBarrio", JSON.stringify(reportes));

    L.marker([lat, lng]).addTo(map)
      .bindPopup(`<b>${tipo}</b><br>${descripcion}`);

    form.reset();
    form.classList.add("hidden");
    alert("✅ Reporte guardado.");
  };
}

// distancia en km
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
