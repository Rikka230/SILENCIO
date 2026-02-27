// =========================================
// SILENCIO PICTURES - MAIN JS (ES6 MODULES)
// =========================================

// 1. IMPORTATION FIREBASE (Via CDN pour Vanilla JS)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Ta configuration officielle
const firebaseConfig = {
    apiKey: "AIzaSyDQVsBz82xBBLTdV12yrDiGFwqATttZ71I",
    authDomain: "silencio-6f751.firebaseapp.com",
    projectId: "silencio-6f751",
    storageBucket: "silencio-6f751.firebasestorage.app",
    messagingSenderId: "573153999359",
    appId: "1:573153999359:web:4d650208a06b9fa8280fca",
    measurementId: "G-2BVN0T02GF"
};

// Initialisation des services (Sans Analytics pour éviter le crash)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Variable globale pour stocker l'image optimisée avant envoi à la base de données
let optimizedImageBlob = null; 

// 2. UTILITAIRES UX (Micro-interactions)
const UI = {
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.style.borderLeftColor = type === 'success' ? 'var(--color-accent)' : '#ff0000'; 
        toast.classList.remove('hidden');
        
        // Disparaît après 3 secondes
        setTimeout(() => toast.classList.add('hidden'), 3000); 
    }
};

// 3. ROUTEUR INTELLIGENT
document.addEventListener('DOMContentLoaded', () => {
    // On convertit l'URL en minuscules pour éviter les casses accidentelles
    const path = window.location.pathname.toLowerCase();

    // On cherche juste le mot-clé, avec ou sans ".html"
    if (path.includes('admin')) {
        initAdmin();
    } else if (path.includes('projet')) {
        initProjectPage();
    } else {
        initHomePage();
    }
});

// =========================================
// 4. LOGIQUE : PAGE D'ACCUEIL (index.html)
// =========================================
async function initHomePage() {
    console.log("Accueil chargée. Prêt à générer la grille bento dynamiquement.");
}

// =========================================
// 5. LOGIQUE : PAGE PROJET DYNAMIQUE
// =========================================
async function initProjectPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (!projectId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            renderProject(docSnap.data());
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("Erreur de chargement du projet :", error);
    }
}

function renderProject(data) {
    document.querySelector('.project-title').textContent = data.titre;
    document.querySelector('.project-hero p').textContent = `${data.format} • ${data.statut}`;
    
    const heroImage = document.querySelector('.project-hero img');
    heroImage.src = data.imageAffiche;
    heroImage.alt = `Affiche du film ${data.titre}`;

    document.title = `${data.titre} - Produit par Silencio Pictures`;
}

// =========================================
// 6. LOGIQUE : ADMINISTRATION (admin.html)
// =========================================
function initAdmin() {
    console.log("Espace Admin initialisé.");
    
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // 1. Écouteur de l'état de connexion (Le Videur)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Connecté : on lève le rideau
            loginOverlay.classList.add('hidden');
            setupDropzone();
            setupProjectForm();
        } else {
            // Déconnecté : on affiche le formulaire
            loginOverlay.classList.remove('hidden');
        }
    });

    // 2. Traitement du formulaire de connexion
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const btn = loginForm.querySelector('button');

            btn.textContent = "Vérification...";
            btn.disabled = true;

            signInWithEmailAndPassword(auth, email, password)
                .then(() => {
                    loginError.classList.add('hidden');
                    UI.showToast("Connexion réussie");
                    btn.textContent = "Connexion";
                    btn.disabled = false;
                })
                .catch((error) => {
                    loginError.classList.remove('hidden');
                    btn.textContent = "Connexion";
                    btn.disabled = false;
                    console.error("Erreur d'authentification :", error);
                });
        });
    }

    // 3. Bouton Déconnexion
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = 'index.html'; 
            });
        });
    }
}

// =========================================
// 7. MOTEUR D'OPTIMISATION DES IMAGES
// =========================================
function setupDropzone() {
    const dropzone = document.getElementById('image-dropzone');
    const fileInput = document.getElementById('proj-image');
    const imagePreview = document.getElementById('image-preview');
    const dropText = dropzone.querySelector('.drop-text');

    if (!dropzone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault(); e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
    });

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', function() {
        if (this.files.length) handleFile(this.files[0]);
    });

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
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1920;
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compression en WebP à 80%
                canvas.toBlob((blob) => {
                    optimizedImageBlob = blob; 
                    
                    const compressedUrl = URL.createObjectURL(blob);
                    imagePreview.src = compressedUrl;
                    imagePreview.classList.remove('hidden');
                    dropText.style.display = 'none'; 
                    
                    UI.showToast("Image compressée et optimisée !");
                }, 'image/webp', 0.8);
            };
        };
    }
}

// =========================================
// 8. ENREGISTREMENT DU PROJET (Storage + Firestore)
// =========================================
function setupProjectForm() {
    const form = document.getElementById('project-form');
    const btnSave = document.getElementById('btn-save');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Empêche le rechargement brutal de la page

        // 1. Récupération des valeurs du formulaire
        const title = document.getElementById('proj-title').value.trim();
        const subtitle = document.getElementById('proj-subtitle').value.trim();
        const videoUrl = document.getElementById('proj-video').value.trim();

        // 2. Anti-Erreur : Vérifier si l'image est bien là
        if (!optimizedImageBlob) {
            UI.showToast("Veuillez ajouter une affiche (image) pour ce projet.", "error");
            return;
        }

        // 3. Feedback UX : On désactive le bouton pour éviter les doubles clics
        const originalBtnText = btnSave.textContent;
        btnSave.textContent = "Enregistrement en cours...";
        btnSave.disabled = true;

        try {
            // ÉTAPE A : Upload de l'image compressée dans Firebase Storage
            // On crée un nom de fichier unique basé sur la date et le titre
            const safeTitle = title.replace(/\s+/g, '-').toLowerCase();
            const fileName = `affiches/${Date.now()}_${safeTitle}.webp`;
            
            // "storage" est déjà initialisé en haut de ton fichier
            const imageRef = ref(storage, fileName); 
            await uploadBytes(imageRef, optimizedImageBlob);
            
            // On récupère le lien public de l'image fraîchement uploadée
            const imageUrl = await getDownloadURL(imageRef);

            // ÉTAPE B : Sauvegarde des textes dans Firestore
            const projectData = {
                titre: title,
                statut: subtitle,
                imageAffiche: imageUrl,
                videoTrailer: videoUrl,
                ordreAffichage: Date.now(), // Utile pour le Drag & Drop plus tard
                dateCreation: new Date().toISOString()
            };

            // "db" est déjà initialisé en haut de ton fichier
            await addDoc(collection(db, "projects"), projectData);

            // 4. Succès ! On nettoie le formulaire pour le prochain projet
            form.reset();
            document.getElementById('image-preview').classList.add('hidden');
            document.querySelector('.drop-text').style.display = 'block';
            optimizedImageBlob = null; // On vide la mémoire de l'image

            UI.showToast("Projet publié avec succès !");

        } catch (error) {
            console.error("Erreur lors de l'enregistrement :", error);
            UI.showToast("Erreur lors de l'enregistrement.", "error");
        } finally {
            // Quoi qu'il arrive (succès ou échec), on remet le bouton à son état normal
            btnSave.textContent = originalBtnText;
            btnSave.disabled = false;
        }
    });
}

