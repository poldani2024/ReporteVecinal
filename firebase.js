// SDK Firebase versión compat (funciona en cualquier navegador)
document.write(`
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></scr` + `ipt>
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"></scr` + `ipt>
  <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"></scr` + `ipt>
`);

window.addEventListener("load", () => {
  // Tu configuración de Firebase
  const firebaseConfig = {
    apiKey: "AlzaSyB6477kA_dp_17XWE2Al8gSAIXRKG_NKSY",
    authDomain: "reportevecinal.firebaseapp.com",
    projectId: "reportevecinal",
    storageBucket: "reportevecinal.firebasestorage.app",
    messagingSenderId: "42320775776",
    appId: "1:42320775776:web:8e5305fba08d19bc8e5105"
  };

  firebase.initializeApp(firebaseConfig);

  window.auth = firebase.auth();
  window.db = firebase.firestore();

  console.log("🔥 Firebase compat cargado y listo");
});
