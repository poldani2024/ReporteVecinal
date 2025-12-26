
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Panel de Administración</title>

  <link rel="stylesheet" href="style.css" />

  <!-- Firebase (Compat) -->
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"></script>
</head>
<body>
  <header class="header">
    <h1 class="title">Panel de Administración</h1>
    <nav class="admin-nav">
      <a href="index.html">← Volver al mapa</a>
    </nav>
    <div id="admin-auth" class="login-area">
      <button id="btnLogin">Iniciar sesión con Google</button>
      <button id="btnLogout" class="hidden">Cerrar sesión</button>
      <span id="userInfo"></span>
    </div>
  </header>

  <main class="container">
    <section class="card">
      <h2>Listado de reclamos</h2>
      <p class="muted">Se muestra el total; los tuyos aparecen marcados como “Mío”.</p>

      <div class="table-responsive">
        <table class="table" id="tablaReclamos">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>Dirección</th>
              <th>N° municipal</th>
              <th>Mío</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="tbodyReclamos"><tr><td colspan="7">Cargando…</td></tr></tbody>
        </table>
      </div>
    </section>
  </main>

  <script src="firebase.js"></script>
  <script>
    // Admin listado simple (sin edición aquí; la edición se hace en el mapa)
    let currentUser = null;

    firebase.auth().onAuthStateChanged((user) => {
      currentUser = user || null;
      document.getElementById('btnLogin').classList.toggle('hidden', !!user);
      document.getElementById('btnLogout').classList.toggle('hidden', !user);
      document.getElementById('userInfo').textContent = user ? (user.displayName || user.email) : '';

      if (user) cargarTabla();
    });

    document.getElementById('btnLogin').addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
    });

    document.getElementById('btnLogout').addEventListener('click', async () => {
      await firebase.auth().signOut();
      document.getElementById('tbodyReclamos').innerHTML = '<tr><td colspan="7">Cargando…</td></tr>';
    });

    function cargarTabla() {
      const db = firebase.firestore();
      db.collection('reclamos').orderBy('createdAt', 'desc').onSnapshot((snap) => {
        const tbody = document.getElementById('tbodyReclamos');
        tbody.innerHTML = '';
        snap.forEach((doc) => {
          const d = doc.data();
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : '-'}</td>
            <td>${d.tipo || ''}</td>
            <td>${d.descripcion || ''}</td>
            <td>${d.direccion || ''}</td>
            <td>${d.municipalNumber || ''}</td>
            <td>${currentUser && d.userId === currentUser.uid ? 'Sí' : 'No'}</td>
            <td>
              <button data-id="${doc.id}" class="btn-link" onclick="irAEditar('${doc.id}')">Editar en mapa</button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      });
    }

    // Tip: llevamos el docId por queryString y el index se encarga de abrirlo
    function irAEditar(docId) {
      const url = new URL('index.html', window.location.href);
      url.searchParams.set('edit', docId);
      window.location.href = url.toString();
    }
  </script>
</body>
</html>
