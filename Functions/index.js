
// functions/index.js (ESM)
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { chromium } from 'playwright';            // Chromium es más portátil en Cloud Functions
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import FormData from 'form-data';
import * as cheerio from 'cheerio';

if (!admin.apps.length) {
  admin.initializeApp();
}

// --- CORS: permitimos tu GitHub Pages y (opcional) Firebase Hosting ---
const ALLOWED_ORIGINS = new Set([
  'https://poldani2024.github.io',
  'https://reportevecinal.web.app',
  'https://reportevecinal.firebaseapp.com'
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin'); // evita respuestas cacheadas con origen incorrecto
  } else {
    // Durante pruebas, podés habilitar todo (no recomendado en producción):
    // res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// --------------------------------------------------------------------
// A) Playwright: Paso 1 — seleccionar motivo, llenar Detalles y Siguiente
// --------------------------------------------------------------------
export const enviarPaso1Muni = functions
  .runWith({ memory: '1GiB', timeoutSeconds: 120 })
  .https.onRequest(async (req, res) => {
    // CORS siempre
    setCorsHeaders(req, res);

    // Preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    try {
      const { detalle } = typeof req.body === 'object' ? req.body : {};
      if (!detalle || typeof detalle !== 'string') {
        return res.status(400).json({ ok: false, error: 'Falta "detalle" (string)' });
      }

      // Lanzar Chromium headless
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 414, height: 896 }, // iPhone aprox
      });
      const page = await context.newPage();

      // Navegar al form
      await page.goto('https://www.municipalidad.com/rold/reclamos', { waitUntil: 'networkidle' });

      // Click en “Mantenimiento de Calles”
      await page.getByRole('button', { name: /Mantenimiento de Calles/i }).click();

      // Click en “Mantenimiento de Calles de Tierra”
      await page.getByText(/Mantenimiento de Calles de Tierra/i, { exact: true }).click();

      // Completar “Detalles” (placeholder típico)
      await page.getByPlaceholder(/Ingrese más detalles/i).fill(detalle);

      // Click en “Siguiente”
      await page.getByRole('button', { name: /Siguiente/i }).click();

      await browser.close();

      setCorsHeaders(req, res);
      return res.status(200).json({ ok: true, paso: 'tipo/motivo/detalle/siguiente' });
    } catch (err) {
      console.error('[enviarPaso1Muni] error:', err);
      setCorsHeaders(req, res);
      return res.status(500).json({ ok: false, error: err?.message || 'Error interno' });
    }
  });

// --------------------------------------------------------------------
// B) POST directo (opcional) — ajustar NAMES del formulario real
// --------------------------------------------------------------------
const FORM_URL   = 'https://www.municipalidad.com/rold/reclamos'; // GET (página con el form)
const ACTION_URL = 'https://www.municipalidad.com/rold/reclamos'; // POST (action del form)
const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
};

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

function parseMunicipalNumber(postRes) {
  let nroMunicipal = null;
  const html = typeof postRes.data === 'string' ? postRes.data : '';

  let m = html.match(/N[úu]mero\s+de\s+reclamo:\s*(\d+)/i);
  if (m) return m[1];

  const $$ = cheerio.load(html);
  const text = $$('body').text();
  const m2 = text.match(/reclamo\s*#?\s*(\d{4,})/i);
  if (m2) return m2[1];

  const loc = postRes.headers?.location || '';
  const m3 = String(loc).match(/(\d{4,})/);
  if (m3) return m3[1];

  return nroMunicipal;
}

export const enviarAMuni = functions
  .runWith({ memory: '512MB', timeoutSeconds: 60 })
  .https.onRequest(async (req, res) => {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    try {
      // Recibimos docId por query: ?docId=...
      const docId = String(req.query.docId || '').trim();
      if (!docId) return res.status(400).json({ ok: false, error: 'docId requerido' });

      // Leemos el documento en Firestore
      const snap = await admin.firestore().collection('reportes').doc(docId).get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: 'Reporte no encontrado' });
      const r = snap.data();

      // Cliente con cookies para GET + POST
      const jar = new CookieJar();
      const client = wrapper(axios.create({ jar, withCredentials: true, headers: DEFAULT_HEADERS }));

      // GET inicial (tokens/hidden)
      const getRes = await client.get(FORM_URL, { validateStatus: s => s < 500 });
      const hidden = getHiddenInputs(getRes.data);

      // Armar formulario — **AJUSTAR names EXACTOS del sitio**
      const form = new FormData();
      form.append('tipo', r.tipo || '');                 // <select name="tipo">
      form.append('motivo', 'Otros');                    // si el sitio lo pide; ajustar/quitar
      form.append('descripcion', r.descripcion || '');   // <textarea name="descripcion">
      form.append('direccion', r.direccion || '');       // <input name="direccion">
      if (r.barrio) form.append('barrio', r.barrio);
      if (typeof r.lat === 'number') form.append('lat', String(r.lat));
      if (typeof r.lng === 'number') form.append('lng', String(r.lng));
      Object.entries(hidden).forEach(([k, v]) => form.append(k, v)); // tokens hidden

      // POST
      const postRes = await client.post(ACTION_URL, form, {
        headers: form.getHeaders(),
        maxRedirects: 0,
        validateStatus: s => s >= 200 && s < 400
      });

      // Parsear número de reclamo
      const nroMunicipal = parseMunicipalNumber(postRes);
      if (!nroMunicipal) {
        return res.status(502).json({ ok: false, error: 'No se obtuvo número municipal' });
      }

      // Guardar en Firestore
      await admin.firestore().collection('reportes').doc(docId).update({
        municipalNumber: String(nroMunicipal),
        municipalSentAt: admin.firestore.FieldValue.serverTimestamp()
      });

      setCorsHeaders(req, res);
      return res.status(200).json({ ok: true, nroMunicipal });
    } catch (err) {
      console.error('[enviarAMuni] error:', err);
      setCorsHeaders(req, res);
      return res.status(500).json({ ok: false, error: err?.message || 'Error interno' });
    }
  });
