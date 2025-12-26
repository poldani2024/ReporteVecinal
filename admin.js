
// admin.js

// Si tu firebase.js NO define auth/db, descomentá estas dos líneas:
// const auth = firebase.auth();
// const db   = firebase.firestore();

const tbody       = document.getElementById('tbody-reportes');
const adminUserEl = document.getElementById('adminUserInfo');

// Configuración: qué ve un vecino (si no es admin)
const SHOW_ONLY_OWN_FOR_VECINO = true; // true: sólo sus reportes; false: todos (recomendado true)
let unsub = null;

// Render de una fila
function renderRow(doc) {
  const d = doc.data();
  const tr = document.createElement('tr');

  const fechaStr = d.fecha?.toDate ? d.fecha.toDate().toLocaleString() : '-';
  const municipalStr = d.municipalNumber ? String(d.municipalNumber) : '';

  tr.innerHTML = `
    <td>${escapeHtml(d.tipo || '')}</td>
    <td>${escapeHtml(d.direccion || '')}</td>
    <td>${escapeHtml(d.descripcion || '')}</td>
    <td>${escapeHtml(d.usuarioNombre || '')}</td>
    <td>${escapeHtml(d.estado || 'Nuevo')}</td>
    <td>
      <button class="btn-link" data-id="${doc.id}" title="Editar en mapa">Editar en mapa</button>
    </td>
  `;

  // Acción: editar en mapa
  tr.querySelector('button[data-id]').addEventListener('click', () => {
    const url = new URL('index.html', window.location.href);
    url.searchParams.set('edit', doc.id);
    window.location.href = url.toString();
  });

  return tr;
}

// Suscripción en tiempo real a la colección "reportes"
function subscribeReportes({ onlyMine = false, uid = null }) {
  if (typeof unsub === 'function') {
    unsub();
    unsub = null;
  }
  tbody.innerHTML = '<tr><td colspan="6">Cargando…</td></tr>';

  let query = db.collection('reportes').orderBy('fecha', 'desc');

  if (onlyMine && uid) {
    query = db.collection('reportes')
      .where('usuarioId', '==', uid)
      .orderBy('fecha', 'desc');
  }

  unsub = query.onSnapshot((snap) => {
    tbody.innerHTML = '';
    if (snap.empty) {
      tbody.innerHTML = '<tr><td colspan="6">Sin reportes para mostrar.</td></tr>';
      return;
    }
    snap.forEach((doc) => {
      tbody.appendChild(renderRow(doc));
    });
  }, (err) => {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6">Error al cargar: ${escapeHtml(err.message || err.code || 'desconocido')}</td></tr>`;
    if (err.code === 'permission-denied') {
      tbody.innerHTML = `<tr><td colspan="6">Permiso denegado. Verificá tus reglas de Firestore y que estés autenticado.</td></tr>`;
    }
  });
}

// Autenticación y control de rol
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    adminUserEl.textContent = 'No autenticado. Iniciá sesión desde el mapa y luego ingresá al panel.';
    tbody.innerHTML = '<tr><td colspan="6">No autenticado</td></tr>';
    return;
  }

  adminUserEl.textContent = `Conectado como: ${user.displayName || user.email}`;

  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const rol = userDoc.exists ? (userDoc.data().rol || 'vecino') : 'vecino';

    if (rol === 'admin') {
      // Admin ve todos los reportes
      subscribeReportes({ onlyMine: false, uid: user.uid });
    } else {
      // Vecino: ver sus propios reportes (configurable)
      subscribeReportes({ onlyMine: SHOW_ONLY_OWN_FOR_VECINO, uid: user.uid });
    }
  } catch (e) {
    console.error('Error leyendo rol:', e);
    adminUserEl.textContent += ' (Error leyendo rol)';
    // Fallback: mostrar sólo los propios
    subscribeReportes({ onlyMine: true, uid: user.uid });
  }
});

// Utilidad para escapar HTML
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
