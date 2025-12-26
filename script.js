
// --------------------------------------------
// LOGIN GOOGLE
// --------------------------------------------
const btnLogin   = document.getElementById("btnLogin");
const btnLogout  = document.getElementById("btnLogout");
const userInfo   = document.getElementById("userInfo");
const linkAdmin  = document.getElementById("link-admin");

let currentUser      = null;
let currentUserRole  = "vecino";   // 🆕 rol del usuario (admin/vecino)
let editingDocId     = null;
let selectedLatLng   = null;
let markerTemp       = null;
const markersByDoc   = new Map();
let unsubReportes    = null;
let formReadOnly     = false;      // 🆕 flag: el formulario está en solo-lectura

btnLogin.onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => console.error(err));
};

btnLogout.onclick = () => auth.signOut();

auth.onAuthStateChanged(async (user) => {
  currentUser = user || null;
  currentUserRole = "vecino";

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
    currentUserRole = data.rol || "vecino";              // 🆕 guardamos el rol
    linkAdmin.classList.toggle("hidden", currentUserRole !== "admin");
  } else {
    userInfo.textContent = "";
    btnLogin.classList.remove("hidden");
    btnLogout.classList.add("hidden");
    linkAdmin.classList.add("hidden");
  }

  // Re-suscribir a "reportes" con el usuario/rol actual
  subscribeReportes();
});

// --------------------------------------------
// BARRIO — COORDENADAS EXACTAS
// --------------------------------------------
const barrioCoords = [
  [-32.894457508492049, -60.86895402183375],   // Castelli y Diaguitas
  [-32.895413196611888, -60.86354341082229],   // Castelli y San Sebastián
  [-32.906799262900090, -60.86634683607743],   // San Sebastián y Padre Oldani
  [-32.905812966717276, -60.871972911350176]   // Padre Oldani y Diaguitas
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
      (lat < (xj - xi) * (lng - yi) / (yj - yi + 1e-12) + xi);

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
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
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

// --------------------------------------------
// COLORES DE MARCADORES (violeta propio, azul resto)
// --------------------------------------------
const COLOR_MIO_BORDE  = "#7B1FA2";
const COLOR_MIO_FILL   = "#BA68C8";
const COLOR_OTRO_BORDE = "#1976D2";
const COLOR_OTRO_FILL  = "#64B5F6";

function makeCircleMarker(lat, lng, isMine) {
  return L.circleMarker([lat, lng], {
    radius: 10,
    color: isMine ? COLOR_MIO_BORDE : COLOR_OTRO_BORDE,
    weight: 2,
    fillColor: isMine ? COLOR_MIO_FILL : COLOR_OTRO_FILL,
    fillOpacity: 0.95
  });
}

// --------------------------------------------
// 🆕 Utilidad: enfocar el primer campo del formulario (y hacer scroll)
// --------------------------------------------
function focusFirstFormField() {
  const form = document.getElementById('report-form');
  if (form) {
    form.classList.remove('hidden');                       // asegurar visible
    const firstField =
      document.getElementById('tipo') ||                   // preferido
      form.querySelector('input, select, textarea');       // fallback

    // desplazar el formulario al inicio de la vista
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // pequeño delay por si hay re-render o scroll
    setTimeout(() => { firstField?.focus(); }, 60);
  }
}

// --------------------------------------------
// SUSCRIPCIÓN A "reportes"
// --------------------------------------------
function subscribeReportes() {
  // limpiar marcadores previos
  for (const [, mk] of markersByDoc) mk.remove();
  markersByDoc.clear();

  // desuscribir si hay previo
  if (typeof unsubReportes === "function") {
    unsubReportes();
    unsubReportes = null;
  }

  unsubReportes = db.collection("reportes")
    .orderBy("fecha", "desc")
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        const doc   = change.doc;
        const r     = doc.data();
        const docId = doc.id;

        if (change.type === "removed") {
          const mk = markersByDoc.get(docId);
          if (mk) { mk.remove(); markersByDoc.delete(docId); }
          return;
        }

        const lat = r.lat, lng = r.lng;
        if (typeof lat !== "number" || typeof lng !== "number") return;

        const isMine = currentUser && r.usuarioId === currentUser.uid;

        // reemplazar si existía
        if (markersByDoc.has(docId)) {
          markersByDoc.get(docId).remove();
          markersByDoc.delete(docId);
        }

        const marker = makeCircleMarker(lat, lng, isMine)
          .addTo(map)
          .bindPopup(`
            <b>${escapeHtml(r.tipo || "Sin tipo")}</b><br>
            ${escapeHtml(r.descripcion || "")}<br>
            ${escapeHtml(r.direccion || "")}<br>
            ${r.municipalNumber ? `<small>N° municipal: ${escapeHtml(r.municipalNumber)}</small><br>` : ""}
            <i>${escapeHtml(r.usuarioNombre || "")}</i>
          `);

        // Click en marcador:
        marker.on("click", async () => {
          // Autocompletar dirección (por si se quiere actualizar/ver)
          const direccion = await obtenerDireccion(lat, lng);
          document.getElementById("direccion").value = direccion;
          selectedLatLng = { lat, lng };
          colocarMarkerTemp(selectedLatLng);

          if (isMine) {
            // Mi reporte: edición habilitada
            abrirEdicion(docId, r, { readOnly: false });
          } else if (currentUserRole === "admin") {
            // Admin: puede editar reportes ajenos
            abrirEdicion(docId, r, { readOnly: false });
          } else {
            // Otro usuario y no admin: ver en solo-lectura
            abrirEdicion(docId, r, { readOnly: true });
          }

          focusFirstFormField(); // 🆕 al abrir edición, enfocar y mostrar detalle
        });

        markersByDoc.set(docId, marker);
      });
    });
}

// --------------------------------------------
// CLICK EN MAPA — NUEVO REPORTE (zona + dirección)
// (si el form está en solo-lectura por ver reporte ajeno, ignoramos el click)
// --------------------------------------------
map.on("click", async (e) => {
  if (formReadOnly && editingDocId) {
    // Estamos viendo reporte ajeno en solo-lectura; no permitir seleccionar nueva ubicación
    alert("Estás viendo un reporte en modo solo-lectura. No podés cambiar su ubicación.");
    return;
  }

  const p = e.latlng;

  if (!puntoEnPoligono(p.lat, p.lng, barrioPolygon)) {
    alert("Solo podés reportar dentro del barrio.");
    return;
  }

  selectedLatLng = p;

  const direccion = await obtenerDireccion(p.lat, p.lng);
  document.getElementById("direccion").value = direccion;

  colocarMarkerTemp(p);
  abrirAlta();                 // modo alta
  focusFirstFormField();       // 🆕 enfocar primer campo
});

// --------------------------------------------
// UBICACIÓN ACTUAL (GPS) — zona + dirección
// --------------------------------------------
document.getElementById("btn-ubicacion").onclick = () => {
  if (formReadOnly && editingDocId) {
    alert("Estás viendo un reporte en modo solo-lectura. No podés cambiar su ubicación.");
    return;
  }

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

    selectedLatLng = { lat, lng };

    map.setView([lat, lng], 17);
    colocarMarkerTemp(selectedLatLng);

    const direccion = await obtenerDireccion(lat, lng);
    document.getElementById("direccion").value = direccion;

    abrirAlta();
    focusFirstFormField();     // 🆕 enfocar primer campo
  }, () => alert("No se pudo obtener tu ubicación."), { enableHighAccuracy: true, timeout: 10000 });
};

// --------------------------------------------
// REVERSE GEOCODING (Nominatim)
// --------------------------------------------
async function obtenerDireccion(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1&accept-language=es`;
  try {
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.address) {
      const calle  = data.address.road || "";
      const altura = data.address.house_number || "";
      const barrio = data.address.suburb || "";
      const ciudad = data.address.city || data.address.town || data.address.village || "";
      const partes = [calle && `${calle} ${altura}`.trim(), barrio, ciudad].filter(Boolean);
      return partes.length ? partes.join(", ") : (data.display_name || "Dirección no disponible");
    }
    return data.display_name || "Dirección no disponible";
  } catch {
    return "Dirección no disponible";
  }
}

// --------------------------------------------
// MARCADOR TEMPORAL (selección)
// --------------------------------------------
function colocarMarkerTemp({ lat, lng }) {
  if (markerTemp) map.removeLayer(markerTemp);
  markerTemp = L.circleMarker([lat, lng], {
    radius: 10, color: "#555", weight: 2, fillColor: "#999", fillOpacity: 0.5
  }).addTo(map).bindPopup("Ubicación seleccionada para el reclamo").openPopup();
}

// --------------------------------------------
// FORMULARIO (alta y edición)
// --------------------------------------------
const form            = document.getElementById("report-form");
const campoTipo       = document.getElementById("tipo");
const campoDesc       = document.getElementById("descripcion");
const campoDir        = document.getElementById("direccion");
const campoMunicipal  = document.getElementById("nroMunicipalidad");
const btnCancelEdit   = document.getElementById("btnCancelEdit"); // si existe
const btnSubmit       = document.getElementById("btnSubmit");     // si existe
const formTitle       = document.getElementById("form-title");    // si existe

function setFormReadonly(ro) {
  formReadOnly = !!ro;

  // Deshabilitar/habilitar campos
  campoTipo.disabled      = formReadOnly;
  campoDesc.disabled      = formReadOnly;
  campoDir.disabled       = formReadOnly;
  if (campoMunicipal) campoMunicipal.disabled = formReadOnly;

  // Botón guardar
  if (btnSubmit) {
    btnSubmit.disabled  = formReadOnly;
    btnSubmit.textContent = formReadOnly ? "Guardar deshabilitado" : "Guardar reporte";
  }

  // Mostrar/ocultar “Cancelar edición”
  if (btnCancelEdit) {
    btnCancelEdit.classList.toggle("hidden", !editingDocId); // visible si estamos viendo/edita
  }

  // Título del form
  if (formTitle) {
    if (!editingDocId) {
      formTitle.textContent = "Nuevo reporte";
    } else {
      formTitle.textContent = formReadOnly ? "Ver reporte (solo lectura)" : "Editar mi reporte";
    }
  }
}

function abrirAlta() {
  editingDocId = null;
  form.classList.remove("hidden");
  setFormReadonly(false);
}

function abrirEdicion(docId, r, opts = { readOnly: false }) {
  editingDocId = docId;

  campoTipo.value      = r.tipo || "Otro";
  campoDesc.value      = r.descripcion || "";
  campoDir.value       = r.direccion || "";
  if (campoMunicipal)  campoMunicipal.value = r.municipalNumber || "";

  form.classList.remove("hidden");
  setFormReadonly(!!opts.readOnly);

  // centrar mapa en el reclamo
  if (typeof r.lat === "number" && typeof r.lng === "number") {
    map.setView([r.lat, r.lng], 17);
    colocarMarkerTemp({ lat: r.lat, lng: r.lng });
  }

  focusFirstFormField(); // 🆕 enfocar primer campo al abrir edición
}

// Submit (alta o edición)
form.onsubmit = async (ev) => {
  ev.preventDefault();

  if (!auth.currentUser) {
    alert("Debés iniciar sesión con Google.");
    return;
  }

  // Bloquear si estamos en solo-lectura (reporte ajeno y no admin)
  if (formReadOnly) {
    alert("No tenés permisos para editar este reporte.");
    return;
  }

  const tipo            = campoTipo.value;
  const descripcion     = campoDesc.value.trim();
  const direccion       = campoDir.value.trim();
  const municipalNumber = (campoMunicipal?.value || "").trim();

  if (!tipo || !descripcion) {
    alert("Completá al menos el tipo y la descripción.");
    return;
  }

  const latLng = selectedLatLng;
  const lat = latLng?.lat;
  const lng = latLng?.lng;

  try {
    if (!editingDocId) {
      // ALTA: validar zona
      if (typeof lat !== "number" || typeof lng !== "number") {
        alert('Seleccioná ubicación (click en el mapa o "📍 Usar mi ubicación").');
        return;
      }
      if (!puntoEnPoligono(lat, lng, barrioPolygon)) {
        alert("La ubicación está fuera de la zona permitida.");
        return;
      }

      await db.collection("reportes").add({
        tipo,
        descripcion,
        direccion,
        municipalNumber,
        lat,
        lng,
        estado: "Nuevo",
        usuarioId: auth.currentUser.uid,
        usuarioNombre: auth.currentUser.displayName,
        fecha: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert("Reporte guardado");
      form.reset();
      form.classList.add("hidden");
    } else {
      // EDICIÓN: si se cambió ubicación, validar zona
      const updateData = {
        tipo,
        descripcion,
        direccion,
        municipalNumber
      };

      if (typeof lat === "number" && typeof lng === "number") {
        if (!puntoEnPoligono(lat, lng, barrioPolygon)) {
          alert("La nueva ubicación está fuera de la zona permitida.");
          return;
        }
        updateData.lat = lat;
        updateData.lng = lng;
      }

      await db.collection("reportes").doc(editingDocId).update(updateData);
      alert("Reporte actualizado");
      editingDocId = null;
      form.reset();
      form.classList.add("hidden");
    }
  } catch (err) {
    console.error(err);
    if (err.code === "permission-denied") {
      alert("No tenés permisos para esta operación. Verificá que seas el dueño o admin.");
    } else {
      alert("Ocurrió un error guardando el reporte.");
    }
  }
};

// Cancelar edición (si existe)
if (btnCancelEdit) {
  btnCancelEdit.onclick = () => {
    editingDocId = null;
    form.reset();
    form.classList.add("hidden");
    setFormReadonly(false);
  };
}

// --------------------------------------------
// Utilidad: escapar HTML para popups (corregida)
// --------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
