
// functions/index.js (ESM)
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { chromium } from 'playwright'; // usa chromium: más seguro en Cloud Functions

if (!admin.apps.length) {
  admin.initializeApp();
}

// Lista blanca de orígenes permitidos
const ALLOWED_ORIGINS = new Set([
  'https://poldani2024.github.io',
  'https://reportevecinal.web.app',
  'https://reportevecinal.firebaseapp.com'
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin'); // buena práctica
  } else {
    // Durante prueba, podés habilitar todo:
    // res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export const enviarPaso1Muni = functions
  .runWith({ memory: '1GiB', timeoutSeconds: 120 })
  .https.onRequest(async (req, res) => {
    // SIEMPRE setear cabeceras CORS
    setCorsHeaders(req, res);

    // PRE-FLIGHT
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Método no permitido' });
    }

    try {
      // Body JSON
      const { detalle } = typeof req.body === 'object' ? req.body : {};
      if (!detalle || typeof detalle !== 'string') {
        return res.status(400).json({ ok: false, error: 'Falta "detalle" (string)' });
      }

      // Navegador headless
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 414, height: 896 },
      });
      const page = await context.newPage();

      await page.goto('https://www.municipalidad.com/rold/reclamos', { waitUntil: 'networkidle' });

      // Click en “Mantenimiento de Calles”
      await page.getByRole('button', { name: /Mantenimiento de Calles/i }).click();
      // Click en “Mantenimiento de Calles de Tierra”
      await page.getByText(/Mantenimiento de Calles de Tierra/i, { exact: true }).click();
      // Completar “Detalles”
      await page.getByPlaceholder(/Ingrese más detalles/i).fill(detalle);
      // Siguiente
      await page.getByRole('button', { name: /Siguiente/i }).click();

      await browser.close();

      // RESPUESTA JSON con cabeceras CORS
      setCorsHeaders(req, res);
      return res.status(200).json({ ok: true, paso: 'tipo/motivo/detalle/siguiente' });
    } catch (err) {
      console.error('[enviarPaso1Muni] error:', err);
      setCorsHeaders(req, res);
      return res.status(500).json({ ok: false, error: err?.message || 'Error interno' });
    }
  });
