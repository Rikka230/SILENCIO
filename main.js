// =========================================
// SILENCIO PICTURES - MAIN JS (ES6 MODULES)
// =========================================

// 1. IMPORTATION FIREBASE (BaaS)
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDQVsBz82xBBLTdV12yrDiGFwqATttZ71I",
  authDomain: "silencio-6f751.firebaseapp.com",
  projectId: "silencio-6f751",
  storageBucket: "silencio-6f751.firebasestorage.app",
  messagingSenderId: "573153999359",
  appId: "1:573153999359:web:4d650208a06b9fa8280fca",
  measurementId: "G-2BVN0T02GF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 2. UTILITAIRES UX (Micro-interactions)
const UI = {
    // Affiche une notification non-intrusive (Toast)
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        // Si c'est un succès, on utilise le Rouge Silencio, sinon rouge standard d'erreur
        toast.style.borderLeftColor = type === 'success' ? 'var(--color-accent)' : '#ff0000'; 
        
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000); // Disparaît après 3s
    }
};

// 3. ROUTEUR INTELLIGENT
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('admin.html')) {
        initAdmin();
    } else if (path.includes('projet.html')) {
        initProjectPage();
    } else {
        initHomePage();
    }
});

// =========================================
// 4. LOGIQUE : PAGE D'ACCUEIL (index.html)
// =========================================
async function initHomePage() {
    // Plus tard : Récupérer les projets depuis Firebase pour construire la Bento Grid
    // En attendant, tes liens HTML dans l'index devront ressembler à ça :
    // <a href="projet.html?id=tales-of-taipei" class="bento-item">...</a>
    console.log("Accueil chargée. Prêt à générer la grille bento dynamiquement.");
}

// =========================================
// 5. LOGIQUE : PAGE PROJET DYNAMIQUE
// =========================================
async function initProjectPage() {
    // Anti-erreur : On lit l'ID dans l'URL (?id=tales-of-taipei)
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    // Si le client atterrit ici sans ID, on le renvoie à l'accueil discrètement
    if (!projectId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // Requête à Firebase pour récupérer les données du film
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            renderProject(docSnap.data());
        } else {
            // Projet supprimé ou introuvable
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("Erreur de chargement du projet :", error);
    }
}

// Injecte les données dans ton template HTML "Premium"
function renderProject(data) {
    // Mise à jour des textes
    document.querySelector('.project-title').textContent = data.titre;
    document.querySelector('.project-hero p').textContent = `${data.format} • ${data.statut}`;
    
    // Mise à jour de l'image de fond
    const heroImage = document.querySelector('.project-hero img');
    heroImage.src = data.imageAffiche;
    heroImage.alt = `Affiche du film ${data.titre}`;

    // Mise à jour du SEO / Onglet
    document.title = `${data.titre} - Produit par Silencio Pictures`;

    // (La suite viendra pour la vidéo YouTube et le synopsis)
}

// =========================================
// 6. LOGIQUE : ADMINISTRATION (admin.html)
// =========================================
function initAdmin() {
    console.log("Espace Admin initialisé.");
    setupDropzone();
}

function setupDropzone() {
    const dropzone = document.getElementById('image-dropzone');
    const fileInput = document.getElementById('proj-image');
    const imagePreview = document.getElementById('image-preview');
    const dropText = dropzone.querySelector('.drop-text');

    if (!dropzone) return;

    // Empêcher le navigateur d'ouvrir l'image sur une nouvelle page
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault(); e.stopPropagation();
    }

    // Effets visuels au survol (Feedback UX)
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
    });

    // Gestion du clic et du glisser-déposer
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', function() {
        if (this.files.length) handleFile(this.files[0]);
    });

    // Moteur d'optimisation
    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            UI.showToast("Format invalide. Veuillez uploader une image.", "error");
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                // Création du Canvas pour redimensionner
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1920;
                let width = img.width;
                let height = img.height;

                // Calcul du ratio si l'image est trop grande
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Conversion en format WebP (Qualité 80%)
                canvas.toBlob((blob) => {
                    optimizedImageBlob = blob; // On stocke le blob pour l'envoyer à Firebase plus tard
                    
                    // Création d'une URL locale pour afficher la miniature instantanément
                    const compressedUrl = URL.createObjectURL(blob);
                    imagePreview.src = compressedUrl;
                    imagePreview.classList.remove('hidden');
                    dropText.style.display = 'none'; // On cache le texte de la dropzone
                    
                    UI.showToast("Image compressée et optimisée !");
                }, 'image/webp', 0.8);
            };
        };
    }
}
