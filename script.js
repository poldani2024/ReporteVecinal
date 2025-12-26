
// --- Estado global ---
let currentUser = null;
let map = null;
let selectedLatLng = null;       // se setea con click en mapa o "📍 Usar mi ubicación"
let tempMarker = null;
let markersByDoc = new Map();    // docId -> marker
let editingDocId = null;         // docId en edición
let unsubReports = null;         // desuscribir snapshot

// Colores de marcadores
const COLOR_MIO_BORDE = '#7B1FA2';   // Violeta borde (tus reclamos)
const COLOR_MIO_FILL  = '#BA68C8';   // Violeta fill
const COLOR_OTRO_BORDE = '#1976D2';  // Azul borde (de otros)
const COLOR_OTRO_FILL  = '#64B5F6';  // Azul fill

// --- ZONA PERMITIDA ---
// Reemplazá este polígono por el que usabas antes (formato [ [lat, lng], ... ]).
// Si queda vacío, se permite todo y aparece un aviso informativo.
const ALLOWED_ZONE_POLYGON = [
  // EJEMPLO (NO ES TU POLÍGONO REAL): cuatro puntos formando un rectángulo de demo
  // [-32.94, -60.98],
  // [-32.94, -60.84],
  // [-32.84, -60.84],
  // [-32.84, -60.98],
];

// Dibuja el polígono en el mapa (si está definido)
function drawAllowedZone() {
  if (ALLOWED_ZONE_POLYGON.length >= 3) {
    L.polygon(ALLOWED_ZONE_POLYGON, {
      color: '#4CAF50',
      weight: 2,
      fillColor: '#A5D6A7',
      fillOpacity: 0.15
    }).addTo(map).bindPopup('Zona habilitada por la vecinal');
  }
}

// Utilidad: punto en polígono (ray casting)
function isPointInPolygon(latlng, polygonLatLngs) {
  if (!polygonLatLngs || polygonLatLngs.length < 3) return true; // sin polígono => permitido
  const x = latlng.lat, y = latlng.lng;
  let inside = false;
  for (let i = 0, j = polygonLatLngs.length - 1; i < polygonLatLngs.length; j = i++) {
    const xi = polygonLatLngs[i][0], yi = polygonLatLngs[i][1];
    const xj = polygonLatLngs[j][0], yj = polygonLatLngs[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / (yj - yi + 0.0000001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Mostrar/ocultar mensaje de zona
function setZoneWarning(visible) {
  document.getElementById('zone-warning').classList.toggle('hidden', !visible);
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
  initAuthUI();
  initMap();
  initFormHandlers();
  initLocationButton();

  // Si viene docId por query (desde admin), abrir edición
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('edit');
  if (editId) {
    window.__pendingEditId = editId;
  }
});

// --- Auth ---
function initAuthUI() {
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const userInfo = document.getElementById('userInfo');
  const linkAdmin = document.getElementById('link-admin');

  btnLogin.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
  });

  btnLogout.addEventListener('click', async () => {
    await firebase.auth().signOut();
  });

  firebase.auth().onAuthStateChanged((user) => {
    currentUser = user || null;
    btnLogin.classList.toggle('hidden', !!user);
    btnLogout.classList.toggle('hidden', !user);
    userInfo.textContent = user ? (user.displayName || user.email) : '';
    linkAdmin.classList.toggle('hidden', !user); // mostrar admin si logueado

    // Suscribir a reclamos (todos pueden ver)
    subscribeReports();
  });
}

// --- Leaflet ---
function initMap() {
  map = L.map('map').setView([-32.9, -60.9], 12); // Centro aproximado
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  drawAllowedZone();

  // Click en mapa: seleccionar ubicación + autocompletar dirección + control de zona
  map.on('click', async (ev) => {
    const latlng = ev.latlng;
    const inside = isPointInPolygon(latlng, ALLOWED_ZONE_POLYGON);
    setZoneWarning(!inside);

    if (!inside) {
      // fuera de zona -> no setear selección
      if (tempMarker) tempMarker.remove();
      tempMarker = null;
      return;
    }

    selectedLatLng = latlng;
    placeTempMarker(latlng);
    await fillAddressFromLatLng(latlng); // autocompletar dirección
    showForm(); // mostrar formulario si está logueado
  });
}

function placeTempMarker(latlng) {
  if (tempMarker) tempMarker.remove();
  tempMarker = L.circleMarker(latlng, {
    radius: 10, color: '#555', weight: 2, fillColor: '#999', fillOpacity: 0.5
  }).addTo(map).bindPopup('Ubicación seleccionada para el reclamo').openPopup();
}

// --- Botón de ubicación ---
function initLocationButton() {
  const btnUbicacion = document.getElementById('btn-ubicacion');
  btnUbicacion.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const inside = isPointInPolygon(latlng, ALLOWED_ZONE_POLYGON);
        setZoneWarning(!inside);
        if (!inside) {
          alert('Tu ubicación está fuera de la zona permitida.');
          return;
        }

        selectedLatLng = latlng;
        map.setView([latlng.lat, latlng.lng], 16);
        placeTempMarker(latlng);
        await fillAddressFromLatLng(latlng); // autocompletar dirección
        showForm();
      },
      () => alert('No se pudo obtener tu ubicación.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// --- Geocodificación inversa (llenar Dirección) ---
async function fillAddressFromLatLng(latlng) {
  try {
    // Nominatim (OSM) — respuesta en español
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latlng.lat}&lon=${latlng.lng}&accept-language=es&zoom=18`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Geocoder fuera de servicio');
    const data = await res.json();
    const address = data.display_name || '';
    document.getElementById('direccion').value = address;
  } catch (e) {
    console.warn('Reverse geocoding falló:', e);
    // Fallback: ponemos lat/lng
    document.getElementById('direccion').value = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
  }
}

// --- Suscripción a la colección de reclamos ---
function subscribeReports() {
  const db = firebase.firestore();

  // Desuscribir previo si existe
  if (typeof unsubReports === 'function') {
    unsubReports();
  }

  unsubReports = db.collection('reclamos')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snap) => {
      snap.docChanges().forEach((change) => {
        const doc = change.doc;
        const data = doc.data();
        const docId = doc.id;

        if (change.type === 'removed') {
          const mk = markersByDoc.get(docId);
          if (mk) { mk.remove(); markersByDoc.delete(docId); }
          return;
        }

        const lat = data.lat, lng = data.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') return;

        const isMine = currentUser && data.userId === currentUser.uid;

        // remover marker previo si existe
        if (markersByDoc.has(docId)) {
          markersByDoc.get(docId).remove();
          markersByDoc.delete(docId);
        }

        const marker = makeCircleMarker(lat, lng, isMine)
          .addTo(map)
          .bindPopup(popupHtml(data));

        // Si es mío, al click habilita edición + centra + autocompleta dirección
        if (isMine) {
          marker.on('click', async () => {
            fillFormForEdit(docId, data);
            selectedLatLng = { lat, lng };
            await fillAddressFromLatLng(selectedLatLng);
          });
        }

        markersByDoc.set(docId, marker);

        // Si venimos desde admin con ?edit=docId, abrir cuando aparece
        if (window.__pendingEditId && window.__pendingEditId === docId) {
          fillFormForEdit(docId, data);
          selectedLatLng = { lat, lng };
          fillAddressFromLatLng(selectedLatLng);
          window.__pendingEditId = null;
        }
      });
    });
}

function makeCircleMarker(lat, lng, isMine) {
  return L.circleMarker([lat, lng], {
    radius: 10,
    color: isMine ? COLOR_MIO_BORDE : COLOR_OTRO_BORDE,
    weight: 2,
    fillColor: isMine ? COLOR_MIO_FILL : COLOR_OTRO_FILL,
    fillOpacity: 0.95
  });
}

function popupHtml(data) {
  return `
    <strong>${escapeHtml(data.tipo || 'Sin tipo')}</strong><br>
    ${escapeHtml(data.descripcion || '')}<br>
    <small>${escapeHtml(data.direccion || '')}</small><br>
    ${data.municipalNumber ? `<small>N° municipal: ${escapeHtml(data.municipalNumber)}</small>` : ''}
  `;
}

// --- Formulario ---
function initFormHandlers() {
  const form = document.getElementById('report-form');
  const btnCancelEdit = document.getElementById('btnCancelEdit');

  form.addEventListener('submit', onSubmitReport);
  btnCancelEdit.addEventListener('click', () => {
    resetEditState();
    form.reset();
    document.getElementById('form-title').textContent = 'Nuevo reporte';
  });
}

function showForm() {
  if (!currentUser) {
    alert('Necesitás iniciar sesión para crear o editar reportes.');
    return;
  }
  document.getElementById('report-form').classList.remove('hidden');
}

function fillFormForEdit(docId, data) {
  document.getElementById('tipo').value = data.tipo || 'Otro';
  document.getElementById('descripcion').value = data.descripcion || '';
  document.getElementById('direccion').value = data.direccion || '';
  document.getElementById('nroMunicipalidad').value = data.municipalNumber || '';

  document.getElementById('report-form').classList.remove('hidden');
  const btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.textContent = 'Actualizar reporte';
  document.getElementById('btnCancelEdit').classList.remove('hidden');
  document.getElementById('form-title').textContent = 'Editar mi reporte';

  editingDocId = docId;

  // centrar mapa en el reclamo
  if (typeof map !== 'undefined' && typeof data.lat === 'number' && typeof data.lng === 'number') {
    map.setView([data.lat, data.lng], 17);
    placeTempMarker({ lat: data.lat, lng: data.lng });
  }
}

function resetEditState() {
  editingDocId = null;
  document.getElementById('btnSubmit').textContent = 'Guardar reporte';
  document.getElementById('btnCancelEdit').classList.add('hidden');
}

// Alta/edición
async function onSubmitReport(ev) {
  ev.preventDefault();

  const tipo = document.getElementById('tipo').value;
  const descripcion = document.getElementById('descripcion').value.trim();
  const direccion = document.getElementById('direccion').value.trim();
  const municipalNumber = document.getElementById('nroMunicipalidad').value.trim();

  if (!currentUser) {
    alert('Necesitás iniciar sesión para guardar o editar tus reportes.');
    return;
  }
  if (!tipo || !descripcion) {
    alert('Completá al menos el tipo y la descripción.');
    return;
  }

  const db = firebase.firestore();

  try {
    if (!editingDocId) {
      // ALTA: requiere coordenadas dentro de la zona
      if (!selectedLatLng || typeof selectedLatLng.lat !== 'number' || typeof selectedLatLng.lng !== 'number') {
        alert('Seleccioná ubicación (click en el mapa o "📍 Usar mi ubicación").');
        return;
      }
      const inside = isPointInPolygon(selectedLatLng, ALLOWED_ZONE_POLYGON);
      if (!inside) {
        alert('La ubicación está fuera de la zona permitida.');
        return;
      }

      const payload = {
        tipo,
        descripcion,
        direccion: direccion || '',
        municipalNumber: municipalNumber || '',
        lat: selectedLatLng.lat,
        lng: selectedLatLng.lng,
        userId: currentUser.uid,
        userName: currentUser.displayName || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection('reclamos').add(payload);
      alert('¡Reporte guardado!');
      document.getElementById('report-form').reset();
      setZoneWarning(false);
    } else {
      // EDICIÓN: campos textuales + (opcional) nueva ubicación si está dentro de la zona
      const updateData = {
        tipo,
        descripcion,
        direccion: direccion || '',
        municipalNumber: municipalNumber || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (selectedLatLng && typeof selectedLatLng.lat === 'number' && typeof selectedLatLng.lng === 'number') {
        const inside = isPointInPolygon(selectedLatLng, ALLOWED_ZONE_POLYGON);
        if (!inside) {
          alert('La nueva ubicación está fuera de la zona permitida.');
          return;
        }
        updateData.lat = selectedLatLng.lat;
        updateData.lng = selectedLatLng.lng;
      }

      await db.collection('reclamos').doc(editingDocId).update(updateData);
      alert('¡Reporte actualizado!');
      resetEditState();
      document.getElementById('report-form').reset();
      setZoneWarning(false);
    }
  } catch (err) {
    console.error(err);
    alert('Ocurrió un error guardando el reporte.');
  }
}

// --- Utilidades ---
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
