// Inicializamos el mapa (si el GPS funciona, se re-centrará después)
const map = L.map("map").setView([-32.95, -60.65], 14);

// Cargar mosaicos de OpenStreetMap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

// Intentar centrar mapa según GPS del usuario
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      map.setView([lat, lng], 16);

      L.marker([lat, lng])
        .addTo(map)
        .bindPopup("📍 Estás acá")
        .openPopup();
    },
    () => {
      console.log("No se pudo usar GPS.");
    }
  );
}

// Recuperar reportes guardados
let reportes = JSON.parse(localStorage.getItem("reportesBarrio")) || [];
let markerTemp = null;

// Dibujar reportes existentes
reportes.forEach((r) => {
  L.marker([r.lat, r.lng])
    .addTo(map)
    .bindPopup(`<b>${r.tipo}</b><br>${r.descripcion}<br>${r.direccion}`);
});

// ----------------------
// CLICK EN MAPA → reporte manual
// ----------------------
map.on("click", async (e) => {
  const { lat, lng } = e.latlng;

  // Convertir coordenadas → dirección
  const direccion = await obtenerDireccion(lat, lng);
  document.getElementById("direccion").value = direccion;

  // Verificar duplicados
  const existeCerca = reportes.find(
    (r) => distance(lat, lng, r.lat, r.lng) < 0.05
  );

  if (existeCerca) {
    alert(`⚠️ Ya existe un reporte cercano: ${existeCerca.tipo}`);
  }

  // Colocar marcador temporal
  if (markerTemp) map.removeLayer(markerTemp);
  markerTemp = L.marker([lat, lng]).addTo(map);

  mostrarFormulario(lat, lng);
});

// ----------------------
// BOTÓN: “Reportar desde donde estoy”
// ----------------------
document.getElementById("btn-ubicacion").onclick = () => {
  if (!navigator.geolocation) {
    alert("Tu dispositivo no permite obtener tu ubicación.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Centrar mapa
    map.setView([lat, lng], 17);

    // Marcar punto
    if (markerTemp) map.removeLayer(markerTemp);
    markerTemp = L.marker([lat, lng]).addTo(map);

    // Obtener dirección
    const direccion = await obtenerDireccion(lat, lng);
    document.getElementById("direccion").value = direccion;

    mostrarFormulario(lat, lng);
  });
};

// ----------------------
// Obtener dirección (reverse geocoding)
// ----------------------
async function obtenerDireccion(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "ReporteVecinal/1.0" }
    });
    const data = await resp.json();
    return data.display_name || "Dirección no encontrada";
  } catch {
    return "No se pudo obtener dirección";
  }
}

// ----------------------
// Mostrar Formulario
// ----------------------
function mostrarFormulario(lat, lng) {
  const form = document.getElementById("report-form");
  form.classList.remove("hidden");

  form.onsubmit = (ev) => {
    ev.preventDefault();

    const tipo = document.getElementById("tipo").value;
    const descripcion = document.getElementById("descripcion").value;
    const direccion = document.getElementById("direccion").value;

    const nuevo = { tipo, descripcion, direccion, lat, lng, fecha: new Date() };
    reportes.push(nuevo);

    localStorage.setItem("reportesBarrio", JSON.stringify(reportes));

    L.marker([lat, lng])
      .addTo(map)
      .bindPopup(`<b>${tipo}</b><br>${descripcion}<br>${direccion}`);

    form.reset();
    form.classList.add("hidden");

    alert("✅ Reporte guardado.");
  };
}

// ----------------------
// Distancia entre puntos
// ----------------------
function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}
