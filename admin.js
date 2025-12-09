auth.onAuthStateChanged(user => {
  if (!user) {
    alert("Tenés que iniciar sesión para acceder al panel.");
    window.location.href = "index.html";
    return;
  }

  // Luego agregaremos validación de rol admin
  cargarReportes();
});

function cargarReportes() {
  const tbody = document.querySelector("#tabla-reportes tbody");

  db.collection("reportes")
    .orderBy("fecha", "desc")
    .onSnapshot(snapshot => {
      tbody.innerHTML = ""; // limpiar

      snapshot.forEach(doc => {
        const r = doc.data();
        const id = doc.id;

        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td>${r.tipo}</td>
          <td>${r.direccion}</td>
          <td>${r.descripcion}</td>
          <td>${r.estado}</td>
          <td>${r.fecha?.toDate().toLocaleString() || "-"}</td>
          <td>${r.usuarioNombre || "-"}</td>
          <td>
            <button onclick="actualizarEstado('${id}', 'En proceso')">En proceso</button>
            <button onclick="actualizarEstado('${id}', 'Resuelto')">Resuelto</button>
          </td>
        `;

        tbody.appendChild(tr);
      });
    });
}

function actualizarEstado(id, nuevoEstado) {
  db.collection("reportes").doc(id).update({
    estado: nuevoEstado
  });
}
