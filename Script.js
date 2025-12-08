// Crear mapa
const map = L.map("map").setView([-32.95, -60.65], 14); // Rosario aprox

// Cargar mapa base
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
}).addTo(map);

// Cargar reportes desde localStorage
let reportes = JSON.parse(localStorage.getItem("reportesBarrio")) || [];
let markerTemp;

// Dibujar reportes existentes
reportes.forEach((r) => {
  L.marker([r.lat, r.lng])
    .addTo(map)
    .bindPopup(`<b>${r.tipo}</b><br>${r.descripcion}`);
});

// Evento: clic en el mapa
map.on("click", (e) => {
  const { lat, lng } = e.latlng;

  // Buscar reportes cercanos (< 50 metros)
  const existeCerca = reportes.find(
    (r) => distance(lat, lng, r.lat, r.lng) < 0.05
  );

  if (existeCerca) {
    alert(
      `⚠️ Ya existe un reporte cercano: ${existeCerca.tipo}.\nPodés sumarte o crear uno nuevo.`
    );
  }

  // Quitar marcador previo temporal
  if (markerTemp) map.removeLayer(markerTemp);

  // Colocar marcador temporal
  markerTemp = L.marker([lat, lng]).addTo(map);

  // Mostrar formulario
  mostrarFormulario(lat, lng);
});

// Función para abrir el formulario
function mostrarFormulario(lat, lng) {
  const form = document.getElementById("report-form");
  form.classList.remove("hidden");

  form.onsubmit = (ev) => {
    ev.preventDefault();

    const tipo = document.getElementById("tipo").value;
    const descripcion = document.getElementById("descripcion").value;

    const nuevo = {
      tipo,
      descripcion,
      lat,
      lng,
      fecha: new Date(),
    };

    // Guardar en memoria del navegador
    reportes.push(nuevo);
    localStorage.setItem("reportesBarrio", JSON.stringify(reportes));

    // Dibujar en el mapa
    L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`<b>${tipo}</b><br>${descripcion}`);

    form.reset();
    form.classList.add("hidden");

    alert("✅ Reporte guardado.");
  };
}

// Distancia entre dos coordenadas (en km)
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // devuelve kilómetros
}
