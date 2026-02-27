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
    appId: "1:573153999359:web:4d650208a06b9fa8280fca"
};

// Initialisation des services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Variable globale pour stocker l'image optimisée avant envoi à la base de données
let optimizedImageBlob = null; 
let currentEditId = null;
let currentEditImageUrl = null;

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

// 3. ROUTEUR INTELLIGENT (Exécution immédiate)
const path = window.location.pathname.toLowerCase();

if (path.includes('admin')) {
    initAdmin();
} else if (path.includes('projet')) {
    initProjectPage();
} else {
    initHomePage();
}


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
    const loginBox = document.getElementById('login-box'); // <-- La nouvelle variable
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // 1. Écouteur de l'état de connexion (Le Videur)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Connecté : on enlève le rideau noir en douceur
            loginOverlay.classList.add('hidden');
            setupDropzone();
            setupProjectForm();
            loadAdminProjects();
        } else {
            // Déconnecté : on s'assure que le rideau est là, ET on affiche la boîte de connexion
            loginOverlay.classList.remove('hidden');
            if(loginBox) loginBox.classList.remove('hidden');
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
// 8. ENREGISTREMENT DU PROJET (Création ou Modification)
// =========================================
function setupProjectForm() {
    const form = document.getElementById('project-form');
    const btnSave = document.getElementById('btn-save');
    
    // CORRECTION ICI : On cherche le bouton Annuler UNIQUEMENT à l'intérieur du formulaire
    const btnCancel = form ? form.querySelector('.btn-secondary') : null; 

    if (!form) return;

    // Fonction pour nettoyer le formulaire et revenir au mode "Ajout"
    function resetProjectForm() {
        form.reset();
        document.getElementById('image-preview').classList.add('hidden');
        document.querySelector('.drop-text').style.display = 'block';
        document.getElementById('form-title').textContent = "Ajouter un projet";
        btnSave.textContent = "Enregistrer le projet";
        optimizedImageBlob = null; 
        currentEditId = null;
        currentEditImageUrl = null;
    }

    // Action du bouton Annuler
    if (btnCancel) {
        btnCancel.addEventListener('click', resetProjectForm);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const title = document.getElementById('proj-title').value.trim();
        const subtitle = document.getElementById('proj-subtitle').value.trim();
        const videoUrl = document.getElementById('proj-video').value.trim();

        if (!currentEditId && !optimizedImageBlob) {
            UI.showToast("Veuillez ajouter une affiche (image) pour ce projet.", "error");
            return;
        }

        btnSave.textContent = "Enregistrement en cours...";
        btnSave.disabled = true;

        try {
            let imageUrl = currentEditImageUrl; 

            if (optimizedImageBlob) {
                const safeTitle = title.replace(/\s+/g, '-').toLowerCase();
                const fileName = `affiches/${Date.now()}_${safeTitle}.webp`;
                const imageRef = ref(storage, fileName); 
                await uploadBytes(imageRef, optimizedImageBlob);
                imageUrl = await getDownloadURL(imageRef);
            }

            if (currentEditId) {
                const projectRef = doc(db, "projects", currentEditId);
                await updateDoc(projectRef, {
                    titre: title,
                    statut: subtitle,
                    imageAffiche: imageUrl,
                    videoTrailer: videoUrl
                });
                UI.showToast("Projet mis à jour avec succès !");
            } else {
                const projectData = {
                    titre: title,
                    statut: subtitle,
                    imageAffiche: imageUrl,
                    videoTrailer: videoUrl,
                    ordreAffichage: Date.now(), 
                    dateCreation: new Date().toISOString()
                };
                await addDoc(collection(db, "projects"), projectData);
                UI.showToast("Projet publié avec succès !");
            }

            resetProjectForm();
            loadAdminProjects(); 

        } catch (error) {
            console.error("Erreur lors de l'enregistrement :", error);
            UI.showToast("Erreur lors de l'enregistrement.", "error");
        } finally {
            btnSave.disabled = false;
            if (!currentEditId) btnSave.textContent = "Enregistrer le projet";
        }
    });
}

// =========================================
// 9. CHARGEMENT DES PROJETS DANS L'ADMIN
// =========================================
async function loadAdminProjects() {
    const projectList = document.getElementById('project-list');
    if (!projectList) return;

    try {
        const querySnapshot = await getDocs(collection(db, "projects"));
        let projects = [];
        
        querySnapshot.forEach((doc) => {
            projects.push({ id: doc.id, ...doc.data() });
        });

        projects.sort((a, b) => b.ordreAffichage - a.ordreAffichage);
        projectList.innerHTML = '';

        projects.forEach(project => {
            const li = document.createElement('li');
            li.className = 'sortable-item';
            li.dataset.id = project.id;
            
            // CORRECTION ICI : On rend la ligne entière glissable nativement (fini les bugs)
            li.setAttribute('draggable', 'true');
            
            li.innerHTML = `
                <div class="drag-handle">☰</div>
                <img src="${project.imageAffiche}" class="item-thumb" alt="Miniature">
                <div class="item-info">
                    <strong>${project.titre}</strong>
                    <span>${project.statut}</span>
                </div>
                <div class="item-actions">
                    <button class="btn-icon edit" title="Modifier">✎</button>
                    <button class="btn-icon delete" title="Supprimer">✕</button>
                </div>
            `;

            // 1. Action de suppression
            const deleteBtn = li.querySelector('.delete');
            deleteBtn.addEventListener('click', async () => {
                if(confirm(`Es-tu sûr de vouloir supprimer définitivement "${project.titre}" ?`)) {
                    try {
                        await deleteDoc(doc(db, "projects", project.id));
                        UI.showToast("Projet supprimé !");
                        loadAdminProjects(); 
                    } catch (error) {
                        UI.showToast("Erreur lors de la suppression.", "error");
                    }
                }
            });

            // 2. Action de modification
            const editBtn = li.querySelector('.edit');
            editBtn.addEventListener('click', () => {
                document.getElementById('proj-title').value = project.titre;
                document.getElementById('proj-subtitle').value = project.statut || '';
                document.getElementById('proj-video').value = project.videoTrailer || '';

                const imagePreview = document.getElementById('image-preview');
                const dropText = document.querySelector('.drop-text');
                imagePreview.src = project.imageAffiche;
                imagePreview.classList.remove('hidden');
                dropText.style.display = 'none';

                currentEditId = project.id;
                currentEditImageUrl = project.imageAffiche;
                optimizedImageBlob = null; 
                
                document.getElementById('form-title').textContent = `Modifier : ${project.titre}`;
                document.getElementById('btn-save').textContent = "Mettre à jour";
                
                document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
            });

            projectList.appendChild(li);
        });

        // Activation du Drag & Drop une fois la liste générée
        setupDragAndDrop();

    } catch (error) {
        console.error("Erreur lors du chargement des projets :", error);
    }
}

// =========================================
// 10. DRAG & DROP (Réorganisation et sauvegarde)
// =========================================
function setupDragAndDrop() {
    const list = document.getElementById('project-list');
    const items = list.querySelectorAll('.sortable-item');

    items.forEach(item => {
        // Début du glissement
        item.addEventListener('dragstart', (e) => {
            // Sécurité : On empêche le drag si on clique sur un bouton d'action
            if(e.target.tagName === 'BUTTON') {
                e.preventDefault();
                return;
            }
            setTimeout(() => item.classList.add('dragging'), 0);
        });

        // Fin du glissement
        item.addEventListener('dragend', async () => {
            item.classList.remove('dragging');
            await saveNewOrder();
        });
    });

    // Gestion du survol pendant le glissement
    list.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        const draggingItem = document.querySelector('.dragging');
        if (!draggingItem) return;

        const siblings = [...list.querySelectorAll('.sortable-item:not(.dragging)')];

        let nextSibling = siblings.find(sibling => {
            return e.clientY <= sibling.getBoundingClientRect().top + sibling.offsetHeight / 2;
        });

        list.insertBefore(draggingItem, nextSibling);
    });
}

async function saveNewOrder() {
    const items = document.querySelectorAll('.sortable-item');
    document.body.style.cursor = 'wait';
    
    try {
        const promises = [];
        
        items.forEach((item, index) => {
            const id = item.dataset.id;
            const newOrder = Date.now() - (index * 1000); 
            const docRef = doc(db, "projects", id);
            promises.push(updateDoc(docRef, { ordreAffichage: newOrder }));
        });

        await Promise.all(promises);
        UI.showToast("Ordre d'affichage sauvegardé !");
        
    } catch (error) {
        console.error("Erreur de tri :", error);
        UI.showToast("Erreur lors de la sauvegarde de l'ordre.", "error");
    } finally {
        document.body.style.cursor = 'default';
    }
}



