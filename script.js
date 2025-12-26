
// script.js
// Estado global
let currentUser = null;
let map = null;
let selectedLatLng = null;       // se setea con "📍 Usar mi ubicación" o al hacer click en el mapa
let markersByDoc = new Map();    // docId -> marker
let editingDocId = null;         // docId en edición (si corresponde)
let unsubReports = null;         // desuscribir snapshot cuando haga falta

// Colores de marcadores
const COLOR_MIO_BORDE = '#7B1FA2';   // Violeta borde
const COLOR_MIO_FILL  = '#BA68C8';   // Violeta fill
const COLOR_OTRO_BORDE = '#1976D2';  // Azul borde
const COLOR_OTRO_FILL  = '#64B5F6';  // Azul fill

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
    // Esperamos a que cargue la suscripción y luego abrimos cuando llegue ese doc
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

    // Suscribir a reclamos cuando hay usuario (o igual, todos pueden ver)
    subscribeReports();
  });
}

// --- Leaflet ---
function initMap() {
  map = L.map('map').setView([-32.9, -60.9], 12); // centro aproximado de zona Rosario/Roldán
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Permitir seleccionar punto con click (opcional)
  map.on('click', (ev) => {
    selectedLatLng = ev.latlng;
    showForm(); // muestra el formulario si el user está logueado
    placeTempMarker(ev.latlng);
  });
}

let tempMarker = null;
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
      (pos) => {
        const { latitude, longitude } = pos.coords;
        selectedLatLng = { lat: latitude, lng: longitude };
        map.setView([latitude, longitude], 16);
        placeTempMarker(selectedLatLng);
        showForm();
      },
      () => alert('No se pudo obtener tu ubicación.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
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
      // Actualizar markers según cambios
      snap.docChanges().forEach((change) => {
        const doc = change.doc;
        const data = doc.data();
        const docId = doc.id;

        if (change.type === 'removed') {
          const mk = markersByDoc.get(docId);
          if (mk) { mk.remove(); markersByDoc.delete(docId); }
          return;
        }

        // Alta o modificación
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

        // Si es mío, al click habilita edición
        if (isMine) {
          marker.on('click', () => fillFormForEdit(docId, data));
        }

        markersByDoc.set(docId, marker);

        // Si venimos desde admin con ?edit=docId, abrir cuando aparece
        if (window.__pendingEditId && window.__pendingEditId === docId) {
          fillFormForEdit(docId, data);
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

  editingDocId = docId;

  // centrar mapa en el reclamo
  if (typeof map !== 'undefined' && typeof data.lat === 'number' && typeof data.lng === 'number') {
    map.setView([data.lat, data.lng], 17);
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
      // ALTA: requiere coordenadas
      if (!selectedLatLng || typeof selectedLatLng.lat !== 'number' || typeof selectedLatLng.lng !== 'number') {
        alert('Seleccioná ubicación (click en el mapa o "📍 Usar mi ubicación").');
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
    } else {
      // EDICIÓN: actualiza campos textuales y, si el usuario marcó una nueva ubicación, actualiza lat/lng
      const updateData = {
        tipo,
        descripcion,
        direccion: direccion || '',
        municipalNumber: municipalNumber || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (selectedLatLng && typeof selectedLatLng.lat === 'number' && typeof selectedLatLng.lng === 'number') {
        updateData.lat = selectedLatLng.lat;
        updateData.lng = selectedLatLng.lng;
      }

      await db.collection('reclamos').doc(editingDocId).update(updateData);
      alert('¡Reporte actualizado!');
      resetEditState();
      document.getElementById('report-form').reset();
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
