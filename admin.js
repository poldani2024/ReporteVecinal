
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

tdAcc.appendChild(btnSendStep1);
