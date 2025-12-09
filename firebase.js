// Inicializar Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB6477kA_dp_17XWE2Al8gSAIXRKG_NKSY",
  authDomain: "reportvecinal.firebaseapp.com",
  projectId: "reportvecinal",
  storageBucket: "reportvecinal.firebasestorage.app",
  messagingSenderId: "42320775776",
  appId: "1:42320775776:web:70d9206815f650b98e5105"
};

firebase.initializeApp(firebaseConfig);

window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("🔥 Firebase cargado correctamente");
