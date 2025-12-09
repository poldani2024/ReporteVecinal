// --------------------------------------------
// VALIDAR QUE EL USUARIO SEA ADMIN
// --------------------------------------------
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    alert("Debés iniciar sesión.");
    window.location.href = "index.html";
    return;
  }

  const userRef = db.collection("users").doc(user.uid);
  const snap = await userRef.get();

  if (!snap.exists || snap.data().rol !== "admin") {
    alert("No tenés permisos para ver esta sección.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("adminUserInfo").textContent =
    `Conectado como administrador: ${user.displayName}`;

  cargarReportes();
});

// --------------------------------------------
// CARGAR REPORTES EN TABLA
// --------------------------------------------
function cargarReportes() {
  db.collection("reportes").orderBy("fecha", "desc").onSnapshot(snapshot => {
    const tbody = document.getElementById("tbody-reportes");
    tbody.innerHTML = ""; // limpiar

    snapshot.forEach(doc => {
      const r = doc.data();

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${r.tipo}</td>
        <td>${r.direccion}</td>
        <td>${r.descripcion}</td>
        <td>${r.usuarioNombre}</td>
        <td>${r.estado}</td>
        <td>
          <button onclick="cambiarEstado('${doc.id}', '${r.estado}')">Cambiar</button>
          <button onclick="eliminarReporte('${doc.id}')">Borrar</button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  });
}

// --------------------------------------------
// CAMBIAR ESTADO DEL REPORTE
// --------------------------------------------
function cambiarEstado(id, estadoActual) {
  let nuevo;

  switch (estadoActual) {
    case "Nuevo": nuevo = "En proceso"; break;
    case "En proceso": nuevo = "Resuelto"; break;
    default: nuevo = "Nuevo"; break;
  }

  db.collection("reportes").doc(id).update({
    estado: nuevo
  })
  .then(() => console.log("Estado actualizado"))
  .catch(err => alert("Error: " + err));
}

// --------------------------------------------
// ELIMINAR REPORTE
// --------------------------------------------
function eliminarReporte(id) {
  if (!confirm("¿Seguro que querés borrar este reporte?")) return;

  db.collection("reportes").doc(id)
    .delete()
    .then(() => console.log("Reporte eliminado"))
    .catch(err => alert("Error: " + err));
}
