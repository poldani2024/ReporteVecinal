
/**
 * admin.js — Panel de administración de Reportes
 * - Autenticación con Google
 * - Lectura de rol desde /users/{uid}
 * - Suscripción en tiempo real a /reportes (admin: todos; vecino: propios)
 * - Eliminar reportes (dueño o admin; requiere reglas de Firestore acordes)
 * - Exportar a Excel (CSV)
 */

// Si firebase.js no expuso auth/db por algún motivo
try {
  window.auth = window.auth || firebase.auth();
  window.db   = window.db   || firebase.firestore();
  console.log('🔥 Firebase cargado correctamente');
} catch (e) {
  console.error('No se encontró Firebase. Asegurate de incluir firebase.js antes de admin.js');
}

// Referencias a elementos del DOM
const tbody         = document.getElementById('tbody-reportes');
const adminUserEl   = document.getElementById('adminUserInfo');
const btnExportCsv  = document.getElementById('btnExportCsv');

// Estado
let unsub = null;
let currentUser = null;
let currentRole = 'vecino';
let cacheRowsForExport = []; // datos para exportación CSV

const SHOW_ONLY_OWN_FOR_VECINO = true; // vecinos ven sólo sus propios reportes

// Utilidades
function formatDate(d) { return d.toLocaleDateString('es-AR'); }
function formatTime(d) { return d.toLocaleTimeString('es-AR', { hour12: false }); }
function formatFileTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}
function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Render de fila seguro (textContent)
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

  const btnDel = document.createElement('button');
  btnDel.className = 'btn-danger';
  btnDel.title = 'Eliminar reporte';
  btnDel.textContent = 'Eliminar';

  const isOwner   = currentUser && d.usuarioId === currentUser.uid;
  const canDelete = isOwner || currentRole === 'admin';


// ... dentro de renderRow(doc)
const btnSend = document.createElement('button');
btnSend.className = 'btn-primary';
btnSend.title = 'Genera el reclamo automáticamente en el sitio oficial';
btnSend.textContent = 'Enviar a Municipalidad';

btnSend.addEventListener('click', async () => {
  const seguro = confirm('¿Enviar este reporte a la Municipalidad?');
  if (!seguro) return;

  try {
    // ID token para autorización (solo admin)
    const user = firebase.auth().currentUser;
    const idToken = user ? await user.getIdToken() : null;

    const resp = await fetch(`/api/enviar-a-muni?docId=${encodeURIComponent(doc.id)}`, {
      method: 'POST',
      headers: {
        'Authorization': idToken ? `Bearer ${idToken}` : ''
      }
    });
    const data = await resp.json();
    if (data.ok && data.nroMunicipal) {
      alert(`Enviado. N° municipal: ${data.nroMunicipal}`);
    } else {
      alert(`No se pudo obtener el número municipal. ${data.error || ''}`);
    }
  } catch (e) {
    console.error(e);
    alert('Error al enviar a municipalidad');
  }
});

tdAcc.appendChild(btnSend);


  
  if (!canDelete) {
    btnDel.disabled = true;
    btnDel.title = 'No tenés permisos para eliminar este reporte';
  }

  btnDel.addEventListener('click', async () => {
    if (!canDelete) {
      alert('No tenés permisos para eliminar este reporte. Debés ser el dueño o administrador.');
      return;
    }
    const confirmado = confirm('¿Seguro que querés eliminar este reporte?\nEsta acción no se puede deshacer.');
    if (!confirmado) return;

    try {
      await db.collection('reportes').doc(doc.id).delete();
      // onSnapshot lo removerá de la tabla automáticamente
    } catch (err) {
      console.error(err);
      alert(err.code === 'permission-denied'
        ? 'Permiso denegado. Reglas de Firestore: sólo dueño o admin pueden borrar.'
        : 'Ocurrió un error al eliminar el reporte.'
      );
    }
  });

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

// Suscripción en tiempo real
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
    tbody.innerHTML = `<tr><td colspan="11">Error al cargar: ${err.message || err.code || 'desconocido'}</td></tr>`;
    if (err.code === 'permission-denied') {
      tbody.innerHTML = `<tr><td colspan="11">Permiso denegado. Verificá reglas de Firestore y autenticación.</td></tr>`;
    }
  });
}

// Autenticación + rol
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
      subscribeReportes({ onlyMine: false, uid: user.uid });
    } else {
      subscribeReportes({ onlyMine: SHOW_ONLY_OWN_FOR_VECINO, uid: user.uid });
    }
  } catch (e) {
    console.error('Error leyendo rol:', e);
    adminUserEl.textContent += ' (Error leyendo rol)';
    subscribeReportes({ onlyMine: true, uid: user.uid });
  }
});

// Exportar a CSV
btnExportCsv.addEventListener('click', () => {
  if (!cacheRowsForExport.length) {
    alert('No hay datos para exportar.');
    return;
  }

  const headers = [
    'Tipo','Dirección','Descripción','Vecino','Estado',
    'N° municipal','Fecha registro','Hora registro',
    'Fecha modificación','Hora modificación'
  ];
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
