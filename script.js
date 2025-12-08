<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reportes del Barrio</title>

  <!-- CSS propio -->
  <link rel="stylesheet" href="style.css" />

  <!-- Leaflet CSS -->
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    integrity="sha256-o9N1j7kCzorZF8MljgD5Wv5QJg5G8hSot+Y4ZkQEX0M="
    crossorigin=""
  />
</head>
<body>
  <h2>🗺️ Reportes del Barrio</h2>
  <p>Tocá en el mapa para agregar un reporte o revisar los existentes.</p>

  <!-- MAPA (con altura garantizada) -->
  <div id="map" style="height: 400px; width: 100%; margin-bottom: 20px;"></div>

  <!-- FORMULARIO -->
  <form id="report-form" class="hidden">
    <h3>Nuevo reporte</h3>

    <label>Tipo:</label>
    <select id="tipo">
      <option value="Falta de luz">Falta de luz</option>
      <option value="Basura">Basura</option>
      <option value="Bache">Bache</option>
      <option value="Seguridad">Seguridad</option>
      <option value="Ruido">Ruido</option>
      <option value="Otro">Otro</option>
    </select>

    <label>Descripción:</label>
    <textarea id="descripcion"></textarea>

    <button type="submit">Guardar reporte</button>
  </form>

  <!-- Leaflet JS -->
  <script
    src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
    integrity="sha256-o9N1j7kCzorZF8MljgD5Wv5QJg5G8hSot+Y4ZkQEX0M="
    crossorigin=""
  ></script>

  <!-- Script propio -->
  <script src="script.js"></script>
</body>
</html>
