
// firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyB6477kA_dp_17XWE2Al8gSAIXRKG_NKSY",
  authDomain: "reportevecinal.firebaseapp.com",
  projectId: "reportevecinal",
  storageBucket: "reportevecinal.firebasestorage.app",
  messagingSenderId: "42320775776",
  appId: "1:42320775776:web:70d9206815f650b98e5105"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Persistencia offline (si el navegador lo soporta)
firebase.firestore().enablePersistence({ synchronizeTabs: true })
  .then(() => console.debug('[firestore] offline persistence OK'))
  .catch(err => {
    console.warn('[firestore] persistence error:', err.code || err.message);
    // En Safari privado o sin IndexedDB: seguimos online sin caché.
  });

window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("🔥 Firebase cargado correctamente");
