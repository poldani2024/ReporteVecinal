
// functions/index.js (Node 18, ESM)
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { webkit /* o chromium */ } from 'playwright';

if (!admin.apps.length) {
  admin.initializeApp();
}

// Orígenes permitidos (agregá/mantené los que uses)
const ALLOWED_ORIGINS = new Set([
  'https://poldani2024.github.io',          // GitHub Pages
  'https://reportevecinal.web.app',         // Firebase Hosting (si migrás)
  'https://reportevecinal.firebaseapp.com'  // Firebase Hosting secundario
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin'); // buena práctica para caches
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export const enviarPaso1Muni = functions
  .runWith({ memory: '1GiB', timeoutSeconds: 120 })
  .https.onRequest(async (req, res) => {
    try {
      // CORS siempre
      setCorsHeaders(req, res);

      // Preflight (OPTIONS)
      if (req.method === 'OPTIONS') {
        return res.status(204).send(''); // sin body
      }

      if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Método no permitido' });
      }

      // Lee el JSON del cuerpo
      const { detalle } = typeof req.body === 'object' ? req.body : {};
      if (!detalle || typeof detalle !== 'string') {
        return res.status(400).json({ ok: false, error: 'Falta "detalle" (string)' });
      }

      // Lanzar Playwright (si webkit falla en Functions, usá chromium)
      const browser = await webkit.launch({ headless: true });
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 414, height: 896 },
      });
      const page = await context.newPage();

      // Navegar
      await page.goto('https://www.municipalidad.com/rold/reclamos', { waitUntil: 'networkidle' });

      // Seleccionar "Mantenimiento de Calles" y "Mantenimiento de Calles de Tierra"
      const mantenimientoBtn = page.getByRole('button', { name: /Mantenimiento de Calles/i });
      await mantenimientoBtn.click();

      const opcionTierra = page.getByText(/Mantenimiento de Calles de Tierra/i, { exact: true });
      await opcionTierra.click();

      // Completar "Detalles" (placeholder típico)
      const areaDetalle = page.getByPlaceholder(/Ingrese más detalles/i);
      await areaDetalle.fill(detalle);

      // Click en "Siguiente"
      const btnSiguiente = page.getByRole('button', { name: /Siguiente/i });
      await btnSiguiente.click();

      await browser.close();

      // Responder JSON con CORS ya aplicado
      return res.status(200).json({ ok: true, paso: 'tipo/motivo/detalle/siguiente' });
    } catch (err) {
      console.error('[enviarPaso1Muni] error:', err);
      setCorsHeaders(req, res); // asegurar cabeceras también en error
      return res.status(500).json({ ok: false, error: err?.message || 'Error interno' });
    }
  });
