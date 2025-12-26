
// functions/index.js
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { webkit /* o chromium */ } from 'playwright';
import cors from 'cors';

if (!admin.apps.length) {
  admin.initializeApp();
}

const corsHandler = cors({
  origin: [
    'https://poldani2024.github.io',          // tu GitHub Pages
    'https://reportevecinal.web.app',         // si migrás Hosting
    'https://reportevecinal.firebaseapp.com'  // idem
  ],
  methods: ['POST', 'OPTIONS'],
});

// Helper: esperar y loguear errores visibles
async function safeClick(page, locatorDesc, locator) {
  try {
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    await locator.click();
    console.log(`[OK] Click: ${locatorDesc}`);
  } catch (e) {
    console.error(`[FAIL] Click: ${locatorDesc}`, e);
    throw new Error(`No se pudo hacer click en "${locatorDesc}".`);
  }
}

export const enviarPaso1Muni = functions
  .runWith({ memory: '1GiB', timeoutSeconds: 120 }) // Playwright necesita memoria
  .https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
      try {
        if (req.method === 'OPTIONS') return res.status(204).send('');
        if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Método no permitido' });

        // Datos que vas a mandar desde el admin:
        const { detalle } = req.body;
        if (!detalle || typeof detalle !== 'string') {
          return res.status(400).json({ ok: false, error: 'Falta "detalle" (string)' });
        }

        // Lanzar WebKit (Safari-like). Si falla, cambia a "chromium".
        const browser = await webkit.launch({ headless: true });
        const context = await browser.newContext({
          userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          viewport: { width: 414, height: 896 }, // iPhone 11/12 aprox
        });
        const page = await context.newPage();

        console.log('[NAV] Abriendo formulario municipal…');
        await page.goto('https://www.municipalidad.com/rold/reclamos', { waitUntil: 'networkidle' });

        // 1) Seleccionar categoría "Mantenimiento de Calles"
        // Si es un botón/expander con texto:
        const mantenimientoBtn = page.getByRole('button', { name: /Mantenimiento de Calles/i });
        await safeClick(page, 'Mantenimiento de Calles', mantenimientoBtn);

        // 2) Elegir "Mantenimiento de Calles de Tierra"
        const opcionTierra = page.getByText(/Mantenimiento de Calles de Tierra/i, { exact: true });
        await safeClick(page, 'Mantenimiento de Calles de Tierra', opcionTierra);

        // 3) Completar "Detalles" (placeholder "Ingrese más detalles ...")
        const areaDetalle = page.getByPlaceholder(/Ingrese más detalles/i);
        await areaDetalle.fill(detalle);
        console.log('[OK] Detalles completados');

        // 4) Click en "Siguiente"
        const btnSiguiente = page.getByRole('button', { name: /Siguiente/i });
        await safeClick(page, 'Siguiente', btnSiguiente);

        // Podés continuar con los pasos siguientes aquí si querés
        // (ubicación, datos personales, confirmación, número de reclamo, etc.)

        await browser.close();

        return res.json({ ok: true, paso: 'tipo/motivo/detalle/siguiente' });
      } catch (err) {
        console.error('[enviarPaso1Muni] error:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Error interno' });
      }
    });
  });
