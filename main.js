// =========================================
// SILENCIO PICTURES - MAIN JS (ES6 MODULES)
// =========================================

// 1. IMPORTATION FIREBASE (BaaS)
// Remplace la configuration par celle que Firebase te donnera à la création du projet
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "TON_API_KEY",
    authDomain: "silencio-pictures.firebaseapp.com",
    projectId: "silencio-pictures",
    storageBucket: "silencio-pictures.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:12345:web:67890"
};

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
    // C'est ici que l'on va coder le Drag & Drop et l'upload d'images
}