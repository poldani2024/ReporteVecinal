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
// MAPA + BARRIO DELIMITADO
// --------------------------------------------

// Coordenadas del barrio exacto
const barrioCoords = [
  [-32.92495, -60.82344], // NW
  [-32.92500, -60.81702], // NE
  [-32.92963, -60.81705], // SE
  [-32.92957, -60.82345], // SW
  [-32.92495, -60.82344]  // Cerrar polígono
];

// Inicializar mapa CÉNTRICO en tu barrio
const map = L.map("map", {
  maxZoom: 19,
}).setView([-32.9272, -60.8202], 16);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

// Dibujar polígono del barrio
const barrioPolygon = L.polygon(barrioCoords, {
  color: "green",
  weight: 3,
  fillColor: "#00FF00",
  fillOpacity: 0.15
}).addTo(map);

// Ajustar vista exactamente al barrio
map.fitBounds(barrioPolygon.getBounds());

// SOMBREADO EXTERIOR CORRECTO
const world = [
  [90, -180],
  [90, 180],
  [-90, 180],
  [-90, -180]
];

L.polygon([world, barrioCoords], {
  color: "black",
  fillOpacity: 0.45,
  stroke: false
}).addTo(map);

let markerTemp = null;


// --------------------------------------------
// EVITAR REPORTES FUERA DEL BARRIO
// --------------------------------------------
function estaEnBarrio(lat, lng) {
  return leafletPip.pointInLayer([lng, lat], barrioPolygon).length > 0;
}


// --------------------------------------------
// CARGAR REPORTES
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
// CLICK EN MAPA
// --------------------------------------------
map.on("click", async (e) => {
  const { lat, lng } = e.latlng;

  if (!estaEnBarrio(lat, lng)) {
    alert("Solo podés reportar dentro del barrio.");
    return;
  }

  const direccion = await obtenerDireccion(lat, lng);
  document.getElementById("direccion").value = direccion;

  if (markerTemp) map.removeLayer(markerTemp);
  markerTemp = L.marker([lat, lng]).addTo(map);

  mostrarFormulario(lat, lng);
});


// --------------------------------------------
// UBICACIÓN ACTUAL
// --------------------------------------------
document.getElementById("btn-ubicacion").onclick = () => {
  if (!navigator.geolocation) {
    alert("GPS no soportado.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    if (!estaEnBarrio(lat, lng)) {
      alert("Tu ubicación actual está fuera del barrio.");
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
// FORMULARIO
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

    const tipo = document.getElementById("tipo").value;
    const descripcion = document.getElementById("descripcion").value;
    const direccion = document.getElementById("direccion").value;

    db.collection("reportes").add({
      tipo,
      descripcion,
      direccion,
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
