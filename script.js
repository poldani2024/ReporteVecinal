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
    if (data.rol === "admin") {
      linkAdmin.classList.remove("hidden");
    } else {
      linkAdmin.classList.add("hidden");
    }

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

// Coordenadas del barrio exacto (Castelli, San Sebastián, P. Oldani, Diaguitas)
const barrioCoords = [
  [-32.92171, -60.82793], // Castelli & Diaguitas (NO)
  [-32.92174, -60.81721], // Castelli & San Sebastián (NE)
  [-32.93200, -60.81725], // Padre Oldani & San Sebastián (SE)
  [-32.93205, -60.82801], // Padre Oldani & Diaguitas (SO)
];

const map = L.map("map", {
  maxBounds: [  // no deja salir del barrio
    [-32.918, -60.833], // Norte-oeste extra
    [-32.936, -60.812]  // Sur-este extra
  ],
  maxBoundsViscosity: 1.0
}).setView([-32.926, -60.823], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

// Polígono del barrio
const poligono = L.polygon(barrioCoords, {
  color: "#2ecc71",
  fillColor: "#2ecc71",
  fillOpacity: 0.2
}).addTo(map);

// Área fuera del barrio (sombreado)
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
// CARGAR REPORTES EN TIEMPO REAL
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
// CLICK EN MAPA = NUEVO REPORTE
// --------------------------------------------
map.on("click", async (e) => {

  // Evita reportes fuera del barrio
  if (!leafletPip.pointInLayer([e.latlng.lng, e.latlng.lat], poligono).length) {
    alert("Solo podés reportar dentro del barrio.");
    return;
  }

  const { lat, lng } = e.latlng;

  const direccion = await obtenerDireccion(lat, lng);
  document.getElementById("direccion").value = direccion;

  if (markerTemp) map.removeLayer(markerTemp);
  markerTemp = L.marker([lat, lng]).addTo(map);

  mostrarFormulario(lat, lng);
});


// --------------------------------------------
// BOTÓN: UBICACIÓN ACTUAL
// --------------------------------------------
document.getElementById("btn-ubicacion").onclick = () => {
  if (!navigator.geolocation) {
    alert("GPS no soportado.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Evita reportar fuera del barrio
    if (!leafletPip.pointInLayer([lng, lat], poligono).length) {
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
