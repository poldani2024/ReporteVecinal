// --------------------------------------------
// LOGIN GOOGLE
// --------------------------------------------
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const userInfo = document.getElementById("userInfo");
const linkAdmin = document.getElementById("link-admin");

btnLogin.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => console.error(err));
};

btnLogout.onclick = () => auth.signOut();

auth.onAuthStateChanged(async (user) => {
  if (user) {
    userInfo.textContent = `Conectado como: ${user.displayName}`;
    btnLogin.classList.add("hidden");
    btnLogout.classList.remove("hidden");

    const userRef = db.collection("users").doc(user.uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      await userRef.set({
        nombre: user.displayName,
        email: user.email,
        rol: "vecino",
        creado: new Date()
      });
    }

    const data = (await userRef.get()).data();
    linkAdmin.classList.toggle("hidden", data.rol !== "admin");

  } else {
    userInfo.textContent = "";
    btnLogin.classList.remove("hidden");
    btnLogout.classList.add("hidden");
    linkAdmin.classList.add("hidden");
  }
});


// --------------------------------------------
// BARRIO — COORDENADAS EXACTAS
// --------------------------------------------
const barrioCoords = [
  [-32.894457508492049, -60.86895402183375],   // Castelli y Diaguitas
  [-32.895413196611888, -60.86354341082229],  // Castelli y San Sebastián
  [-32.906799262900090, -60.86634683607743],  // San Sebastián y Padre Oldani
  [-32.905812966717276, -60.871972911350176]  // Padre Oldani y Diaguitas
];

// --------------------------------------------
// FUNCIÓN PUNTO-EN-POLÍGONO (Ray Casting)
// --------------------------------------------
function puntoEnPoligono(lat, lng, poligono) {
  let dentro = false;
  const pts = poligono.getLatLngs()[0];

  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].lat, yi = pts[i].lng;
    const xj = pts[j].lat, yj = pts[j].lng;

    const intersecta = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);

    if (intersecta) dentro = !dentro;
  }

  return dentro;
}


// --------------------------------------------
// MAPA CONFIGURADO
// --------------------------------------------
const barrioPolygon = L.polygon(barrioCoords, {
  color: "green",
  weight: 3,
  fillColor: "#00FF00",
  fillOpacity: 0.15
});

const map = L.map("map", {
  maxBounds: barrioPolygon.getBounds().pad(0.3),
  maxBoundsViscosity: 1.0
}).setView(barrioPolygon.getBounds().getCenter(), 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

barrioPolygon.addTo(map);

// Sombreado fuera del barrio
const world = [
  [90, -180],
  [90, 180],
  [-90, 180],
  [-90, -180]
];
L.polygon([world, barrioCoords], {
  color: "black",
  fillOpacity: 0.5,
  stroke: false
}).addTo(map);

let markerTemp = null;


// --------------------------------------------
// REPORTES EN TIEMPO REAL
// --------------------------------------------
db.collection("reportes").orderBy("fecha", "desc").onSnapshot(snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === "added") {
      const r = change.doc.data();

      L.marker([r.lat, r.lng]).addTo(map)
        .bindPopup(`
          <b>${r.tipo}</b><br>
          ${r.descripcion}<br>
          ${r.direccion}<br>
          <i>${r.usuarioNombre}</i>
        `);
    }
  });
});


// --------------------------------------------
// CLICK EN MAPA — NUEVO REPORTE
// --------------------------------------------
map.on("click", async (e) => {
  const p = e.latlng;

  // VALIDACIÓN REAL: ¿está dentro del barrio?
  if (!puntoEnPoligono(p.lat, p.lng, barrioPolygon)) {
    alert("Solo podés reportar dentro del barrio.");
    return;
  }

  const direccion = await obtenerDireccion(p.lat, p.lng);
  document.getElementById("direccion").value = direccion;

  if (markerTemp) map.removeLayer(markerTemp);
  markerTemp = L.marker([p.lat, p.lng]).addTo(map);

  mostrarFormulario(p.lat, p.lng);
});


// --------------------------------------------
// UBICACIÓN ACTUAL (GPS)
// --------------------------------------------
document.getElementById("btn-ubicacion").onclick = () => {
  if (!navigator.geolocation) {
    alert("GPS no soportado.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    if (!puntoEnPoligono(lat, lng, barrioPolygon)) {
      alert("Tu ubicación está fuera del barrio.");
      return;
    }

    map.setView([lat, lng], 17);

    if (markerTemp) map.removeLayer(markerTemp);
    markerTemp = L.marker([lat, lng]).addTo(map);

    const direccion = await obtenerDireccion(lat, lng);
    document.getElementById("direccion").value = direccion;

    mostrarFormulario(lat, lng);
  });
};


// --------------------------------------------
// REVERSE GEOCODING
// --------------------------------------------
async function obtenerDireccion(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1&accept-language=es`;

  try {
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.address) {
      const calle = data.address.road || "";
      const altura = data.address.house_number || "";
      const barrio = data.address.suburb || "";
      const ciudad = data.address.city || data.address.town || "";
      return `${calle} ${altura}, ${barrio}, ${ciudad}`;
    }

    return data.display_name || "Dirección no disponible";

  } catch {
    return "Dirección no disponible";
  }
}


// --------------------------------------------
// FORMULARIO DE REPORTE
// --------------------------------------------
function mostrarFormulario(lat, lng) {
  const form = document.getElementById("report-form");
  form.classList.remove("hidden");

  form.onsubmit = (ev) => {
    ev.preventDefault();

    if (!auth.currentUser) {
      alert("Debés iniciar sesión con Google.");
      return;
    }

    db.collection("reportes").add({
      tipo: document.getElementById("tipo").value,
      descripcion: document.getElementById("descripcion").value,
      direccion: document.getElementById("direccion").value,
      lat,
      lng,
      estado: "Nuevo",
      usuarioId: auth.currentUser.uid,
      usuarioNombre: auth.currentUser.displayName,
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });

    form.reset();
    form.classList.add("hidden");
    alert("Reporte guardado");
  };
}
