
/**
 * admin.js — Panel de administración de Reportes
 * v2025-12-26-ESM
 */

console.log('[admin.js] v2025-12-26-ESM');

// --- Firebase ---
try {
  window.auth = window.auth || firebase.auth();
  window.db   = window.db   || firebase.firestore();
  console.log('🔥 Firebase cargado correctamente');
} catch (e) {
  console.error('No se encontró Firebase. Incluí firebase.js antes de admin.js', e);
}

// --- URLs de Cloud Functions (llamadas desde GitHub Pages) ---
const FN_URL_STEP1 = 'https://us-central1-reportevecinal.cloudfunctions.net/enviarPaso1Muni';
const FN_URL_FULL  = 'https://us-central1-reportevecinal.cloudfunctions.net/enviarAMuni';

// --- DOM ---
const tbody        = document.getElementById('tbody-reportes');
const adminUserEl  = document.getElementById('adminUserInfo');
const btnExportCsv = document.getElementById('btnExportCsv');

let unsub = null;
let currentUser = null;
let currentRole = 'vecino';
let cacheRowsForExport = [];

const SHOW_ONLY_OWN_FOR_VECINO = true;
const ORDER_BY_FECHA = true;

// --- Utilidades ---
function formatDate(d) { return d.toLocaleDateString('es-AR'); }
function formatTime(d) { return d.toLocaleTimeString('es-AR', { hour12: false }); }
function formatFileTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// --- Render de fila ---
function renderRow(doc) {
  const d = doc.data();
  const fechaRegDate = d.fecha?.toDate ? d.fecha.toDate() : null;
  const fechaModDate = d.updatedAt?.toDate ? d.updatedAt.toDate() : null;

  const fechaReg = fechaRegDate ? formatDate(fechaRegDate) : '–';
  const horaReg  = fechaRegDate ? formatTime(fechaRegDate) : '–';
  const fechaMod = fechaModDate ? formatDate(fechaModDate) : '–';
  const horaMod  = fechaModDate ? formatTime(fechaModDate) : '–';

  const tr = document.createElement('tr');

  const tdTipo      = document.createElement('td');
  const tdDir       = document.createElement('td');
  const tdDesc      = document.createElement('td');
  const tdVecino    = document.createElement('td');
  const tdEstado    = document.createElement('td');
  const tdMunicipal = document.createElement('td');
  const tdFReg      = document.createElement('td');
  const tdHReg      = document.createElement('td');
  const tdFMod      = document.createElement('td');
  const tdHMod      = document.createElement('td');
  const tdAcc       = document.createElement('td');

  tdTipo.textContent      = d.tipo || '';
  tdDir.textContent       = d.direccion || '';
  tdDesc.textContent      = d.descripcion || '';
  tdVecino.textContent    = d.usuarioNombre || '';
  tdEstado.textContent    = d.estado || 'Nuevo';
  tdMunicipal.textContent = d.municipalNumber || '';
  tdFReg.textContent      = fechaReg;
  tdHReg.textContent      = horaReg;
  tdFMod.textContent      = fechaMod;
  tdHMod.textContent      = horaMod;

  

  // --- Eliminar ---
  const btnDel = document.createElement('button');
  btnDel.className = 'btn-danger';
  btnDel.textContent = 'Eliminar';
  btnDel.title = 'Eliminar reporte';
  const isOwner   = currentUser && d.usuarioId === currentUser.uid;
  const canDelete = isOwner || currentRole === 'admin';
  if (!canDelete) { btnDel.disabled = true; btnDel.title = 'No tenés permisos para eliminar este reporte'; }
  btnDel.addEventListener('click', async () => {
    if (!canDelete) return alert('No tenés permisos (dueño/admin).');
    if (!confirm('¿Seguro que querés eliminar este reporte?\nEsta acción no se puede deshacer.')) return;
    try {
      await db.collection('reportes').doc(doc.id).delete();
    } catch (err) {
      console.error(err);
      alert(err.code === 'permission-denied'
        ? 'Permiso denegado (reglas).'
        : 'Error al eliminar.');
    }
  });

  // Acciones
  tdAcc.appendChild(btnSendStep1);
  tdAcc.appendChild(document.createTextNode(' '));
  tdAcc.appendChild(btnSendFull);
  tdAcc.appendChild(document.createTextNode(' '));
  tdAcc.appendChild(btnDel);

  tr.appendChild(tdTipo);
  tr.appendChild(tdDir);
  tr.appendChild(tdDesc);
  tr.appendChild(tdVecino);
  tr.appendChild(tdEstado);
  tr.appendChild(tdMunicipal);
  tr.appendChild(tdFReg);
  tr.appendChild(tdHReg);
  tr.appendChild(tdFMod);
  tr.appendChild(tdHMod);
  tr.appendChild(tdAcc);

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
    horaModificacion: horaMod
  });

  return tr;
}

// --- Suscripción en tiempo real ---
function subscribeReportes({ onlyMine = false, uid = null }) {
  if (!tbody) return;

  if (typeof unsub === 'function') { unsub(); unsub = null; }
  tbody.innerHTML = '<tr><td colspan="11">Cargando…</td></tr>';
  cacheRowsForExport = [];

  let query = db.collection('reportes');
  if (ORDER_BY_FECHA) query = query.orderBy('fecha', 'desc');

  if (onlyMine && uid) {
    query = db.collection('reportes').where('usuarioId', '==', uid);
    if (ORDER_BY_FECHA) query = query.orderBy('fecha', 'desc'); // puede requerir índice compuesto
  }

  unsub = query.onSnapshot(
    (snap) => {
      tbody.innerHTML = '';
      cacheRowsForExport = [];
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="11">Sin reportes para mostrar.</td></tr>';
        return;
      }
      snap.forEach(doc => {
        try { tbody.appendChild(renderRow(doc)); }
        catch (e) { console.error('[renderRow] error:', e); }
      });
    },
    (err) => {
      console.error('[onSnapshot] error:', err);
      const msg = (err && (err.message || err.code)) || 'desconocido';
      tbody.innerHTML = `<tr><td colspan="11">Error al cargar: ${msg}</td></tr>`;
    }
  );
}

// --- Auth + roles ---
firebase.auth().onAuthStateChanged(async (user) => {
  currentUser = user || null;

  if (!user) {
    if (adminUserEl) adminUserEl.textContent = 'No autenticado. Iniciá sesión desde el mapa y luego ingresá al panel.';
    if (tbody) tbody.innerHTML = '<tr><td colspan="11">No autenticado</td></tr>';
    return;
  }

  if (adminUserEl) adminUserEl.textContent = `Conectado como: ${user.displayName || user.email}`;

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    currentRole = userDoc.exists ? (userDoc.data().rol || 'vecino') : 'vecino';

    if (currentRole === 'admin') {
      subscribeReportes({ onlyMine: false, uid: user.uid });
    } else {
      subscribeReportes({ onlyMine: SHOW_ONLY_OWN_FOR_VECINO, uid: user.uid });
    }
  } catch (e) {
    console.error('Error leyendo rol:', e);
    subscribeReportes({ onlyMine: true, uid: user.uid });
  }
});

// --- Export CSV ---
btnExportCsv?.addEventListener('click', () => {
  if (!cacheRowsForExport.length) {
    alert('No hay datos para exportar.');
    return;
  }

  const headers = [
    'Tipo','Dirección','Descripción','Vecino','Estado',
    'N° municipal','Fecha registro','Hora registro',
    'Fecha modificación','Hora modificación'
  ];
  const lines = [ headers.join(',') ];

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
