
// admin.js

const tbody         = document.getElementById('tbody-reportes');
const adminUserEl   = document.getElementById('adminUserInfo');
const btnExportCsv  = document.getElementById('btnExportCsv');

let unsub = null;
let currentUser = null;
let currentRole = 'vecino';
let cacheRowsForExport = []; // guardamos los datos para exportar

// Si firebase.js NO define auth/db, descomentá:
// const auth = firebase.auth();
// const db   = firebase.firestore();

// Render de una fila
function renderRow(doc) {
  const d = doc.data();

  const fechaRegDate = d.fecha?.toDate ? d.fecha.toDate() : null;
  const fechaModDate = d.updatedAt?.toDate ? d.updatedAt.toDate() : null;

  const fechaReg = fechaRegDate ? formatDate(fechaRegDate) : '–';
  const horaReg  = fechaRegDate ? formatTime(fechaRegDate) : '–';
  const fechaMod = fechaModDate ? formatDate(fechaModDate) : '–';
  const horaMod  = fechaModDate ? formatTime(fechaModDate) : '–';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${escapeHtml(d.tipo || '')}</td>
    <td>${escapeHtml(d.direccion || '')}</td>
    <td>${escapeHtml(d.descripcion || '')}</td>
    <td>${escapeHtml(d.usuarioNombre || '')}</td>
    <td>${escapeHtml(d.estado || 'Nuevo')}</td>
    <td>${escapeHtml(d.municipalNumber || '')}</td>
    <td>${fechaReg}</td>
    <td>${horaReg}</td>
    <td>${fechaMod}</td>
    <td>${horaMod}</td>
    <td><button class="btn-link" title="Editar en mapa">Editar en mapa</button></td>
  `;

  // Acción: editar en mapa
  tr.querySelector('.btn-link').addEventListener('click', () => {
    const url = new URL('index.html', window.location.href);
    url.searchParams.set('edit', doc.id);
    window.location.href = url.toString();
  });

  // Guardamos en cache para exportación
  cacheRowsForExport.push({
    tipo: d.tipo || '',
    direccion: d.direccion || '',
    descripcion: d.descripcion || '',
    vecino: d.usuarioNombre || '',
    estado: d.estado || 'Nuevo',
    nMunicipal: d.municipalNumber || '',
    fechaRegistro: fechaReg,
    horaRegistro: horaReg,
    fechaModificacion: fechaMod,
    horaModificacion: horaMod,
  });

  return tr;
}

// Suscripción en tiempo real a la colección "reportes"
function subscribeReportes({ onlyMine = false, uid = null }) {
  if (typeof unsub === 'function') {
    unsub();
    unsub = null;
  }
  tbody.innerHTML = '<tr><td colspan="11">Cargando…</td></tr>';
  cacheRowsForExport = [];

  let query = db.collection('reportes').orderBy('fecha', 'desc');

  if (onlyMine && uid) {
    query = db.collection('reportes')
      .where('usuarioId', '==', uid)
      .orderBy('fecha', 'desc');
  }

  unsub = query.onSnapshot((snap) => {
    tbody.innerHTML = '';
    cacheRowsForExport = [];

    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="11">Sin reportes para mostrar.</td></tr>';
      return;
    }

    snap.forEach((doc) => {
      tbody.appendChild(renderRow(doc));
    });
  }, (err) => {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="11">Error al cargar: ${escapeHtml(err.message || err.code || 'desconocido')}</td></tr>`;
    if (err.code === 'permission-denied') {
      tbody.innerHTML = `<tr><td colspan="11">Permiso denegado. Verificá reglas de Firestore y autenticación.</td></tr>`;
    }
  });
}

// Autenticación y rol
firebase.auth().onAuthStateChanged(async (user) => {
  currentUser = user || null;

  if (!user) {
    adminUserEl.textContent = 'No autenticado. Iniciá sesión desde el mapa y luego ingresá al panel.';
    tbody.innerHTML = '<tr><td colspan="11">No autenticado</td></tr>';
    return;
  }

  adminUserEl.textContent = `Conectado como: ${user.displayName || user.email}`;

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    currentRole = userDoc.exists ? (userDoc.data().rol || 'vecino') : 'vecino';

    if (currentRole === 'admin') {
      // Admin ve todos los reportes
      subscribeReportes({ onlyMine: false, uid: user.uid });
    } else {
      // Vecino: sólo los propios (configurable)
      subscribeReportes({ onlyMine: true, uid: user.uid });
    }
  } catch (e) {
    console.error('Error leyendo rol:', e);
    adminUserEl.textContent += ' (Error leyendo rol)';
    // Fallback: mostrar sólo los propios
    subscribeReportes({ onlyMine: true, uid: user.uid });
  }
});

// --- Exportar a CSV (Excel-friendly) ---
btnExportCsv.addEventListener('click', () => {
  if (!cacheRowsForExport.length) {
    alert('No hay datos para exportar.');
    return;
  }

  // Armamos encabezados
  const headers = [
    'Tipo','Dirección','Descripción','Vecino','Estado',
    'N° municipal','Fecha registro','Hora registro',
    'Fecha modificación','Hora modificación'
  ];

  // Generamos CSV (separador coma, Excel lo abre bien)
  const lines = [];
  lines.push(headers.join(','));

  cacheRowsForExport.forEach(row => {
    const vals = [
      row.tipo, row.direccion, row.descripcion, row.vecino, row.estado,
      row.nMunicipal, row.fechaRegistro, row.horaRegistro,
      row.fechaModificacion, row.horaModificacion
    ].map(csvEscape);
    lines.push(vals.join(','));
  });

  const csv = lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reportes_${formatFileTimestamp(new Date())}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// --- Utilidades ---
function formatDate(d) {
  // Rosario (Argentina) -> es-AR
  return d.toLocaleDateString('es-AR');
}

function formatTime(d) {
  return d.toLocaleTimeString('es-AR', { hour12: false });
}

function formatFileTimestamp(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  // Si contiene comillas, coma o salto de línea, envolver en comillas dobles y escapar comillas internas
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
