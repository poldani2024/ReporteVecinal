
// admin.js — dentro de renderRow(doc) o en Acciones:
const btnSendStep1 = document.createElement('button');
btnSendStep1.className = 'btn-primary';
btnSendStep1.textContent = 'Municipalidad – Paso 1';
btnSendStep1.title = 'Seleccionar tipo/motivo, completar detalle y avanzar';

btnSendStep1.addEventListener('click', async () => {
  const detalle = prompt('Detalle del reclamo para la Municipalidad:', 'Calles de tierra con pozos y barro');
  if (!detalle) return;

  try {
    const FN_URL = 'https://us-central1-reportevecinal.cloudfunctions.net/enviarPaso1Muni';
    const resp = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ detalle })
    });

    const ct = resp.headers.get('content-type') || '';
    if (!resp.ok) {
      const body = ct.includes('application/json') ? await resp.json() : await resp.text();
      throw new Error(
        `HTTP ${resp.status} ${resp.statusText}: ${
          typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body)
        }`
      );
    }

    const data = await resp.json();
    alert(data.ok ? 'Paso 1 enviado correctamente.' : `Fallo: ${data.error || ''}`);
  } catch (e) {
    console.error(e);
    alert('Error al enviar a municipalidad: ' + (e?.message || ''));
  }
});

function renderRow(doc) {
  const d = doc.data();

  const fechaRegDate = d.fecha?.toDate ? d.fecha.toDate() : null;
  const fechaModDate = d.updatedAt?.toDate ? d.updatedAt.toDate() : null;

  const fechaReg = fechaRegDate ? formatDate(fechaRegDate) : '–';
  const horaReg  = fechaRegDate ? formatTime(fechaRegDate) : '–';
  const fechaMod = fechaModDate ? formatDate(fechaModDate) : '–';
  const horaMod  = fechaModDate ? formatTime(fechaModDate) : '–';

  const tr = document.createElement('tr');

  // ✅ Crear todas las celdas, incluida ACCIONES
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
  const tdAcc       = document.createElement('td');        // 👈 ¡ESTE!

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

  /* ---------- Botones de acción ---------- */

  // Paso 1 (Playwright)
  const btnSendStep1 = document.createElement('button');
  btnSendStep1.className = 'btn-primary';
  btnSendStep1.textContent = 'Municipalidad – Paso 1';
  btnSendStep1.title = 'Seleccionar “Mantenimiento de Calles de Tierra”, completar Detalles y Siguiente';
  btnSendStep1.addEventListener('click', async () => {
    const detalle = prompt('Detalle del reclamo (Municipalidad – Paso 1):', d.descripcion || '');
    if (!detalle) return;
    try {
      const FN_URL_STEP1 = 'https://us-central1-reportevecinal.cloudfunctions.net/enviarPaso1Muni'; // ⚠️ ajustá
      const resp = await fetch(FN_URL_STEP1, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ detalle })
      });
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        const body = ct.includes('application/json') ? await resp.json() : await resp.text();
        throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body)}`);
      }
      const data = await resp.json();
      alert(data.ok ? 'Paso 1 ejecutado correctamente.' : `Fallo: ${data.error || ''}`);
    } catch (e) {
      console.error(e);
      alert('Error en Paso 1: ' + (e?.message || ''));
    }
  });

  // Enviar completo (POST directo) — opcional
  const btnSendFull = document.createElement('button');
  btnSendFull.className = 'btn-secondary';
  btnSendFull.textContent = 'Enviar a Municipalidad (POST)';
  btnSendFull.title = 'Enviar formulario completo y guardar N° municipal';
  btnSendFull.addEventListener('click', async () => {
    const seguro = confirm('¿Enviar este reporte a la Municipalidad (POST directo)?');
    if (!seguro) return;
    try {
      const FN_URL_FULL = 'https://us-central1-reportevecinal.cloudfunctions.net/enviarAMuni'; // ⚠️ ajustá
      const user    = firebase.auth().currentUser;
      const idToken = user ? await user.getIdToken() : null;
      const url     = `${FN_URL_FULL}?docId=${encodeURIComponent(doc.id)}`;
      const resp    = await fetch(url, {
        method: 'POST',
        headers: { 'Accept': 'application/json', ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {}) }
      });
      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok) {
        const body = ct.includes('application/json') ? await resp.json() : await resp.text();
        throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body)}`);
      }
      const data = await resp.json();
      alert(data.ok && data.nroMunicipal ? `Enviado. N° municipal: ${data.nroMunicipal}` : `No se obtuvo N° municipal: ${data.error || ''}`);
    } catch (e) {
      console.error(e);
      alert('Error al enviar (POST): ' + (e?.message || ''));
    }
  });

  // Eliminar
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

  // ✅ Ahora sí: usar tdAcc
  tdAcc.appendChild(btnSendStep1);
  tdAcc.appendChild(document.createTextNode(' '));
  tdAcc.appendChild(btnSendFull);
  tdAcc.appendChild(document.createTextNode(' '));
  tdAcc.appendChild(btnDel);

  // Agregar todas las celdas a la fila
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

  // Cache para CSV
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

tdAcc.appendChild(btnSendStep1);
