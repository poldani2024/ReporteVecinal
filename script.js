// Inicializar mapa en Rosario
const map = L.map("map").setView([-32.95, -60.65], 14);

// Cargar mosaicos de mapa (OpenStreetMap)
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

// Cargar reportes previos desde localStorage
let reportes = JSON.parse(localStorage.getItem("reportesBarrio")) || [];
let markerTemp;

// Dibujar marcadores existentes
reportes.forEach((r) => {
  L.marker([r.lat, r.lng])
    .addTo(map)
    .bindPopup(`<b>${r.tipo}</b><br>${r.descripcion}`);
});

// Manejar clic en el mapa
map.on("click", (e) => {
  const { lat, lng } = e.latlng;

  // Buscar reporte cercano (< 50 m)
  const existeCerca = reportes.find(
    (r) => distance(lat, lng, r.lat, r.lng) < 0.05
  );

  if (existeCerca) {
    alert(
      `⚠️ Ya existe un reporte cercano: ${existeCerca.tipo}.\nPodés sumarte o crear uno nuevo.`
    );
  }

  // Marcar punto temporal
  if (markerTemp) map.removeLayer(markerTemp);
  markerTemp = L.marker([lat, lng]).addTo(map);

  mostrarFormulario(lat, lng);
});

// Mostrar formulario
function mostrarFormulario(lat, lng) {
  const form = document.getElementById("report-form");
  form.classList.remove("hidden");

  form.onsubmit = (ev) => {
    ev.preventDefault();

    const tipo = document.getElementById("tipo").value;
    const descripcion = document.getElementById("descripcion").value;

    const nuevo = { tipo, descripcion, lat, lng, fecha: new Date() };
    reportes.push(nuevo);

    // Guardar
    localStorage.setItem("reportesBarrio", JSON.stringify(reportes));

    // Mostrar marcador
    L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`<b>${tipo}</b><br>${descripcion}`);

    form.reset();
    form.classList.add("hidden");

    alert("✅ Reporte guardado.");
  };
}

// Cálculo de distancia entre puntos (km)
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
