
btnSendStep1.addEventListener('click', async () => {
  const detalle = prompt('Detalle del reclamo (Municipalidad – Paso 1):', d.descripcion || '');
  if (!detalle) return;

  try {
    const resp = await fetch('https://us-central1-reportevecinal.cloudfunctions.net/enviarPaso1Muni', {
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
      throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body)}`);
    }

    const data = await resp.json();
    alert(data.ok ? 'Paso 1 ejecutado correctamente.' : `Fallo: ${data.error || ''}`);
  } catch (e) {
    console.error(e);
    alert('Error en Paso 1: ' + (e?.message || ''));
  }
});
