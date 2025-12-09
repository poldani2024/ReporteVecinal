// Cargar Firebase Core
var scriptApp = document.createElement("script");
scriptApp.src = "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
document.head.appendChild(scriptApp);

// Cargar Firebase Auth
var scriptAuth = document.createElement("script");
scriptAuth.src = "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
document.head.appendChild(scriptAuth);

// Cargar Firestore
var scriptFirestore = document.createElement("script");
scriptFirestore.src = "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
document.head.appendChild(scriptFirestore);

// Inicializar Firebase cuando todo cargue
scriptFirestore.onload = function () {
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

    console.log("🔥 Firebase cargado correctamente");
};
