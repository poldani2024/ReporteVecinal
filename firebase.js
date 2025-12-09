
<!-- Firebase Core SDK -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js"></script>

<!-- Firebase Authentication -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"></script>

<!-- Firebase Firestore -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"></script>

<script>
// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AlzaSyB6477kA_dp_17XWE2Al8gSAIXRKG_NKSY",
  authDomain: "reportevecinal.firebaseapp.com",
  projectId: "reportevecinal",
  storageBucket: "reportevecinal.firebasestorage.app",
  messagingSenderId: "42320775776",
  appId: "1:42320775776:web:8e5305fba08d19bc8e5105"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Servicios que usaremos
const auth = firebase.auth();
const db = firebase.firestore();
</script>
