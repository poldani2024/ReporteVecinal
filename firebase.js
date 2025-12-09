const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "reportvecinal.firebaseapp.com",
  projectId: "reportvecinal",
  storageBucket: "reportvecinal.appspot.com",
  messagingSenderId: "42320775776",
  appId: "1:42320775776:web:8e5305fba08d19bc8e5105"
};

firebase.initializeApp(firebaseConfig);

window.auth = firebase.auth();
window.db = firebase.firestore();

console.log("🔥 Firebase cargado correctamente");
