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
// LIMITES DEL BARRIO (La Estancia / Los Indios – Funes)
// --------------------------------------------
const limitesBarrio = L.latLngBounds(
  [-32.94263, -60.81419],   // Sur-Oeste (Padre Oldani + Castelli)
  [-32.8954455,-60.8661309]    // Norte-Este (Acequias del Aire + Las Heras)
);

const centroBarrio = [-32.93750, -60.80800];


// --------------------------------------------
// MAPA RESTRINGIDO AL BARRIO
// --------------------------------------------
const map = L.map("map", {
  maxBounds: limitesBarrio,    
  maxBoundsViscosity: 1.0,    
  minZoom: 15,
  maxZoom: 19
}).setView(centroBarrio, 16);

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

      // No mostrar reportes fuera del barrio
      if (!limitesBarrio.contains([r.lat, r.lng])) return;

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

  // Evitar clic fuera del barrio
  if (!limitesBarrio.contains([lat, lng])) {
    alert("Solo podés reportar dentro del barrio La Estancia / Los Indios.");
    return;
  }

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

    // Si está fuera del barrio → no permitir reportar
    if (!limitesBarrio.contains([lat, lng])) {
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
