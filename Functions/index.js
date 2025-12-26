
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import FormData from 'form-data';
import * as cheerio from 'cheerio';

/**
 * Inicialización Firebase Admin (usa credenciales del proyecto)
 */
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Config del formulario de la municipalidad (AJUSTAR si cambia)
 */
const FORM_URL   = 'https://www.municipalidad.com/rold/reclamos'; // GET donde está el form
const ACTION_URL = 'https://www.municipalidad.com/rold/reclamos'; // POST (action del form)

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

/**
 * Seguridad: verificar ID token y rol admin (users/{uid}.rol == "admin")
 */
async function assertAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new functions.https.HttpsError('unauthenticated', 'Falta token');

  const idToken = m[1];
  const decoded = await admin.auth().verifyIdToken(idToken);
  const uid = decoded.uid;

  const userDoc = await db.collection('users').doc(uid).get();
  const rol = userDoc.exists ? (userDoc.data().rol || 'vecino') : 'vecino';
  if (rol !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Solo admin puede enviar a municipalidad.');
  }
}

/**
 * Extraer hidden inputs (CSRF/tokens) desde el HTML del form
 */
function getHiddenInputs(html) {
  const $ = cheerio.load(html);
  const out = {};
  $('form input[type=hidden]').each((_, el) => {
    const name  = $(el).attr('name');
    const value = $(el).attr('value') || '';
    if (name) out[name] = value;
  });
  return out;
}

/**
 * Parsear número de reclamo desde HTML o Location
 */
function parseMunicipalNumber(postRes) {
  let nroMunicipal = null;

  // a) HTML
  const html = typeof postRes.data === 'string' ? postRes.data : '';
  let m = html.match(/N[úu]mero\s+de\s+reclamo:\s*(\d+)/i);
  if (m) return m[1];

  // b) Texto bruto del body
  const $$ = cheerio.load(html);
  const text = $$('body').text();
  const m2 = text.match(/reclamo\s*#?\s*(\d{4,})/i);
  if (m2) return m2[1];

  // c) Cabecera Location (si redirige)
  const loc = postRes.headers?.location || '';
  const m3 = String(loc).match(/(\d{4,})/);
  if (m3) return m3[1];

  return nroMunicipal;
}

/**
 * Función HTTP: POST directo al form de la municipalidad
 * /api/enviar-a-muni?docId=...
 */
export const enviarAMuni = functions
  .runWith({ memory: '512MB', timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    try {
      if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Método no permitido' });
      }

      // Seguridad (solo admin)
      await assertAdmin(req);

      const docId = String(req.query.docId || '').trim();
      if (!docId) return res.status(400).json({ ok: false, error: 'docId requerido' });

      const snap = await db.collection('reportes').doc(docId).get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: 'Reporte no encontrado' });
      const r = snap.data();

      // Preparar cliente con cookies
      const jar = new CookieJar();
      const client = wrapper(axios.create({ jar, withCredentials: true, headers: DEFAULT_HEADERS }));

      // 1) GET inicial: tokens/cookies
      const getRes = await client.get(FORM_URL, { validateStatus: s => s < 500 });
      const hidden = getHiddenInputs(getRes.data);

      // 2) Armar el form (AJUSTAR names exactos según el sitio)
      const form = new FormData();
      form.append('tipo', r.tipo || '');               // <select name="tipo">
      form.append('motivo', 'Otros');                  // si el sitio lo pide; ajustar o quitar
      form.append('descripcion', r.descripcion || ''); // <textarea name="descripcion">
      form.append('direccion', r.direccion || '');     // <input name="direccion">
      if (r.barrio) form.append('barrio', r.barrio);

      if (typeof r.lat === 'number') form.append('lat', String(r.lat));
      if (typeof r.lng === 'number') form.append('lng', String(r.lng));

      // Añadir hidden tokens (CSRF, etc.)
      Object.entries(hidden).forEach(([k, v]) => form.append(k, v));

      // 3) POST
      const postRes = await client.post(ACTION_URL, form, {
        headers: form.getHeaders(),
        maxRedirects: 0,
        validateStatus: s => s >= 200 && s < 400
      });

      // 4) Parsear número
      const nroMunicipal = parseMunicipalNumber(postRes);
      if (!nroMunicipal) {
        return res.status(502).json({ ok: false, error: 'No se obtuvo número municipal' });
      }

      // 5) Guardar en Firestore
      await db.collection('reportes').doc(docId).update({
        municipalNumber: String(nroMunicipal),
        municipalSentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({ ok: true, nroMunicipal });
    } catch (err) {
      console.error('[enviarAMuni]', err);
      const msg = err?.message || 'Error interno';
      const code = err?.code === 'permission-denied' ? 403 :
                   err?.code === 'unauthenticated'   ? 401 : 500;
      return res.status(code).json({ ok: false, error: msg });
    }
  });
