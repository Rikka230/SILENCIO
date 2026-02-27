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
    console.log("Accueil chargée. Récupération des projets depuis Firebase...");
    const bentoGrid = document.querySelector('.bento-grid');

    if (!bentoGrid) return;

    try {
        // 1. On aspire tous les projets depuis Firestore
        const querySnapshot = await getDocs(collection(db, "projects"));
        let projects = [];
        
        querySnapshot.forEach((doc) => {
            projects.push({ id: doc.id, ...doc.data() });
        });

        // 2. On trie en respectant fidèlement ton Drag & Drop de l'admin
        projects.sort((a, b) => b.ordreAffichage - a.ordreAffichage);

        // 3. On vide la grille statique de l'index.html
        bentoGrid.innerHTML = '';

        // 4. On génère le HTML dynamique pour chaque projet
        projects.forEach((project, index) => {
            // On reproduit ton design : le 1er est grand, le 2ème est haut
            let extraClass = '';
            if (index === 0) extraClass = 'bento-big';
            else if (index === 1) extraClass = 'bento-tall';

            const a = document.createElement('a');
            // Le lien dynamique qui servira pour la page détail
            a.href = `projet.html?id=${project.id}`; 
            a.className = `bento-item ${extraClass}`;
            
            // On injecte les vraies données (Image, Titre, Sous-titre)
            a.innerHTML = `
                <img src="${project.imageAffiche}" alt="Affiche de ${project.titre}" loading="lazy">
                <div class="bento-overlay">
                    <h3>${project.titre.toUpperCase()}</h3>
                    <p>${project.statut}</p>
                </div>
            `;

            bentoGrid.appendChild(a);
        });

        // 5. On relance ton effet d'apparition au scroll (Intersection Observer)
        // (Car les nouveaux éléments viennent d'être créés et doivent être détectés)
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) e.target.classList.add('is-visible');
            });
        }, { threshold: 0.1 });
        
        document.querySelectorAll('.bento-item').forEach(i => observer.observe(i));

    } catch (error) {
        console.error("Erreur lors du chargement de la grille :", error);
    }
}

// =========================================
// 5. LOGIQUE : PAGE PROJET DYNAMIQUE
// =========================================
async function initProjectPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    if (!projectId) { window.location.href = 'index.html'; return; }

    try {
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) renderProject(docSnap.data());
        else window.location.href = 'index.html';
    } catch (error) {
        console.error("Erreur de chargement du projet :", error);
    }
}

function renderProject(data) {
    document.querySelector('.project-title').textContent = data.titre;
    document.querySelector('.project-hero p').innerHTML = `${data.genre || ''} &bull; ${data.statut}`;
    
    const heroImage = document.querySelector('.project-hero img');
    heroImage.src = data.imageAffiche;
    heroImage.alt = `Affiche du film ${data.titre}`;

    document.title = `${data.titre} - Produit par Silencio Pictures`;

    // Injection des nouvelles données
    document.getElementById('dyn-synopsis').innerHTML = (data.synopsis || '').replace(/\n/g, '<br>'); // Garde les sauts de ligne
    document.getElementById('dyn-realisateur').textContent = data.realisateur || '-';
    const castingCible = document.getElementById('dyn-casting');
    if (data.casting) {
        castingCible.innerHTML = data.casting.split(',').map(nom => nom.trim()).join('<br>');
    } else {
        castingCible.textContent = '-';
    }
    document.getElementById('dyn-genre').textContent = data.genre || '-';
    document.getElementById('dyn-annee').textContent = data.annee || '-';

    // Gestion Intelligente de la Vidéo
    const videoSection = document.getElementById('dyn-video-section');
    const videoIframe = document.getElementById('dyn-video-iframe');
    if (data.videoTrailer) {
        videoIframe.src = data.videoTrailer;
        videoSection.style.display = 'block';
    } else {
        videoSection.style.display = 'none';
    }
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
// 8. ENREGISTREMENT DU PROJET
// =========================================
function setupProjectForm() {
    const form = document.getElementById('project-form');
    const btnSave = document.getElementById('btn-save');
    const btnCancel = form ? form.querySelector('.btn-secondary') : null; 

    if (!form) return;

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

    if (btnCancel) btnCancel.addEventListener('click', resetProjectForm);

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const title = document.getElementById('proj-title').value.trim();
        const subtitle = document.getElementById('proj-subtitle').value.trim();
        const videoUrl = document.getElementById('proj-video').value.trim();
        
        // Récupération des nouveaux champs
        const genre = document.getElementById('proj-genre') ? document.getElementById('proj-genre').value.trim() : '';
        const annee = document.getElementById('proj-annee') ? document.getElementById('proj-annee').value.trim() : '';
        const realisateur = document.getElementById('proj-realisateur') ? document.getElementById('proj-realisateur').value.trim() : '';
        const casting = document.getElementById('proj-casting') ? document.getElementById('proj-casting').value.trim() : '';
        const synopsis = document.getElementById('proj-synopsis') ? document.getElementById('proj-synopsis').value.trim() : '';

        if (!currentEditId && !optimizedImageBlob) {
            UI.showToast("Veuillez ajouter une affiche.", "error"); return;
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

            const projectData = {
                titre: title, statut: subtitle, imageAffiche: imageUrl, videoTrailer: videoUrl,
                genre: genre, annee: annee, realisateur: realisateur, casting: casting, synopsis: synopsis
            };

            if (currentEditId) {
                await updateDoc(doc(db, "projects", currentEditId), projectData);
                UI.showToast("Projet mis à jour avec succès !");
            } else {
                projectData.ordreAffichage = Date.now(); 
                projectData.dateCreation = new Date().toISOString();
                await addDoc(collection(db, "projects"), projectData);
                UI.showToast("Projet publié avec succès !");
            }

            resetProjectForm();
            loadAdminProjects(); 

        } catch (error) {
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
        querySnapshot.forEach((doc) => { projects.push({ id: doc.id, ...doc.data() }); });
        projects.sort((a, b) => b.ordreAffichage - a.ordreAffichage);
        projectList.innerHTML = '';

        projects.forEach(project => {
            const li = document.createElement('li');
            li.className = 'sortable-item';
            li.dataset.id = project.id;
            li.setAttribute('draggable', 'true');
            
            li.innerHTML = `
                <div class="drag-handle">☰</div>
                <img src="${project.imageAffiche}" class="item-thumb" alt="Miniature">
                <div class="item-info"><strong>${project.titre}</strong><span>${project.statut}</span></div>
                <div class="item-actions">
                    <button class="btn-icon edit" title="Modifier">✎</button>
                    <button class="btn-icon delete" title="Supprimer">✕</button>
                </div>
            `;

            li.querySelector('.delete').addEventListener('click', async () => {
                if(confirm(`Supprimer définitivement "${project.titre}" ?`)) {
                    await deleteDoc(doc(db, "projects", project.id));
                    UI.showToast("Projet supprimé !"); loadAdminProjects(); 
                }
            });

            li.querySelector('.edit').addEventListener('click', () => {
                // Remplissage de tous les champs
                document.getElementById('proj-title').value = project.titre || '';
                document.getElementById('proj-subtitle').value = project.statut || '';
                document.getElementById('proj-video').value = project.videoTrailer || '';
                
                if(document.getElementById('proj-genre')) document.getElementById('proj-genre').value = project.genre || '';
                if(document.getElementById('proj-annee')) document.getElementById('proj-annee').value = project.annee || '';
                if(document.getElementById('proj-realisateur')) document.getElementById('proj-realisateur').value = project.realisateur || '';
                if(document.getElementById('proj-casting')) document.getElementById('proj-casting').value = project.casting || '';
                if(document.getElementById('proj-synopsis')) document.getElementById('proj-synopsis').value = project.synopsis || '';

                const imagePreview = document.getElementById('image-preview');
                imagePreview.src = project.imageAffiche;
                imagePreview.classList.remove('hidden');
                document.querySelector('.drop-text').style.display = 'none';

                currentEditId = project.id;
                currentEditImageUrl = project.imageAffiche;
                optimizedImageBlob = null; 
                
                document.getElementById('form-title').textContent = `Modifier : ${project.titre}`;
                document.getElementById('btn-save').textContent = "Mettre à jour";
                document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
            });

            projectList.appendChild(li);
        });
        setupDragAndDrop();
    } catch (error) { console.error("Erreur", error); }
}

// =========================================
// 10. DRAG & DROP (PC + Tactile Mobile)
// =========================================
function setupDragAndDrop() {
    const list = document.getElementById('project-list');
    const items = list.querySelectorAll('.sortable-item');

    items.forEach(item => {
        const handle = item.querySelector('.drag-handle');

        // --- 1. GESTION SOURIS (ORDINATEUR) ---
        handle.addEventListener('mousedown', () => item.setAttribute('draggable', 'true'));
        handle.addEventListener('mouseup', () => item.removeAttribute('draggable'));
        handle.addEventListener('mouseleave', () => item.removeAttribute('draggable'));

        item.addEventListener('dragstart', (e) => {
            if(e.target.tagName === 'BUTTON') return;
            setTimeout(() => item.classList.add('dragging'), 0);
        });

        item.addEventListener('dragend', async () => {
            item.classList.remove('dragging');
            item.removeAttribute('draggable');
            await saveNewOrder();
        });

        // --- 2. GESTION TACTILE (SMARTPHONES) ---
        handle.addEventListener('touchstart', (e) => {
            // Empêche l'écran de scroller quand on attrape la poignée
            document.body.style.overflow = 'hidden'; 
            item.classList.add('dragging');
        }, { passive: false });

        handle.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Bloque le rebond de l'écran sur mobile
            const draggingItem = document.querySelector('.dragging');
            if (!draggingItem) return;

            const touch = e.touches[0];
            
            // Astuce "Ninja" Vanilla JS : on cache la ligne 1 milliseconde 
            // pour que le navigateur puisse "voir" quel élément se trouve sous le doigt
            draggingItem.style.display = 'none';
            const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
            draggingItem.style.display = ''; // On la réaffiche instantanément

            // Si on survole une autre ligne, on les inverse
            if (elementUnderFinger) {
                const sibling = elementUnderFinger.closest('.sortable-item');
                if (sibling && sibling !== draggingItem) {
                    const bounding = sibling.getBoundingClientRect();
                    // Moitié haute ou moitié basse de la ligne visée ?
                    if (touch.clientY > bounding.top + (bounding.height / 2)) {
                        sibling.after(draggingItem);
                    } else {
                        sibling.before(draggingItem);
                    }
                }
            }
        }, { passive: false });

        handle.addEventListener('touchend', async () => {
            // On rend le scroll de l'écran à nouveau possible
            document.body.style.overflow = ''; 
            item.classList.remove('dragging');
            await saveNewOrder();
        });
    });

    // --- GESTION DU SURVOL SOURIS (PC) ---
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

// Fonction de sauvegarde (Reste inchangée, mais je la remets pour que tu aies le bloc complet)
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






