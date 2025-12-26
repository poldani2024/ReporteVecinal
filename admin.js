
// admin.js — dentro de renderRow(doc)
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
  <td>
    <button class="btn-danger" data-id="${doc.id}" title="Eliminar reporte">Eliminar</button>
  </td>
`;

// Acción: eliminar documento (dueño o admin según reglas)
tr.querySelector('button[data-id]').addEventListener('click', async (ev) => {
  const id = ev.currentTarget.getAttribute('data-id');

  const seguro = confirm(
    '¿Seguro que querés eliminar este reporte?\n' +
    'Esta acción no se puede deshacer.'
  );
  if (!seguro) return;

  try {
    await db.collection('reportes').doc(id).delete();
    // No hace falta remover la fila manualmente: onSnapshot actualizará la tabla.
  } catch (err) {
    console.error(err);
    if (err.code === 'permission-denied') {
      alert('No tenés permisos para eliminar este reporte. Debés ser el dueño o administrador.');
    } else {
      alert('Ocurrió un error al eliminar el reporte.');
    }
  }
});
