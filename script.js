// --------------------------------------------
// LOGIN GOOGLE
// --------------------------------------------
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const userInfo = document.getElementById("userInfo");

btnLogin.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
};

btnLogout.onclick = () => auth.signOut();

auth.onAuthStateChanged(user => {
  if (user) {
    userInfo.textContent = "Sesión iniciada: " + user.displayName;
    btnLogin.classList.add("hidden");
    btnLogout.classList.remove("hidden");
  } else {
    userInfo.textContent = "";
    btnLogin.classList.remove("hidden");
    btnLogout.classList.add("hidden");
  }
});

// --------------------------------------------
// MAPA
// --------------------------------------------
const map = L.map("map").setView([-32.95, -60.65], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19
}).addTo(map);

let markerTemp = null;

// --------------------------------------------
// CARGAR REPORTES EN TIEMPO REAL
// --------------------------------------------
db.collection("reportes").onSnapshot(snapshot => {
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
