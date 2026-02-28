// =========================================
// SILENCIO PICTURES - MAIN JS (ES6 MODULES)
// =========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDQVsBz82xBBLTdV12yrDiGFwqATttZ71I",
    authDomain: "silencio-6f751.firebaseapp.com",
    projectId: "silencio-6f751",
    storageBucket: "silencio-6f751.firebasestorage.app",
    messagingSenderId: "573153999359",
    appId: "1:573153999359:web:4d650208a06b9fa8280fca"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

let optimizedImageBlob = null; 
let currentEditId = null;
let currentEditImageUrl = null;

const UI = {
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.style.borderLeftColor = type === 'success' ? 'var(--color-accent)' : '#ff0000'; 
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000); 
    }
};

// --- HELPER : Traducteur de position (Compatibilité avec les anciens films) ---
function parsePosition(posString) {
    if (!posString) return { x: 50, y: 50 };
    if (posString === 'top') return { x: 50, y: 0 };
    if (posString === 'bottom') return { x: 50, y: 100 };
    if (posString === 'left') return { x: 0, y: 50 };
    if (posString === 'right') return { x: 100, y: 50 };
    if (posString === 'center') return { x: 50, y: 50 };
    
    const match = posString.match(/(\d+)%\s+(\d+)%/);
    if (match) return { x: parseInt(match[1]), y: parseInt(match[2]) };
    return { x: 50, y: 50 };
}

const path = window.location.pathname.toLowerCase();

if (path.includes('admin')) {
    initAdmin();
} else if (path.includes('projet')) {
    initProjectPage();
} else {
    initHomePage();
}

// =========================================
// 4. LOGIQUE : PAGE D'ACCUEIL (SCROLL HORIZONTAL MANUEL)
// =========================================
async function initHomePage(){
    try {
        const settingsRef = doc(db, "settings", "homepage");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists() && settingsSnap.data().backgroundVideo) {
            const heroVideo = document.querySelector('.hero-video');
            if (heroVideo) { heroVideo.src = settingsSnap.data().backgroundVideo; heroVideo.load(); }
        }
    } catch (error) { console.log("Erreur vidéo"); }
    
    const bentoContainer = document.querySelector('.bento-container');
    if (!bentoContainer) return;

    try {
        const querySnapshot = await getDocs(collection(db, "projects"));
        let projects = [];
        querySnapshot.forEach((doc) => { projects.push({ id: doc.id, ...doc.data() }); });
        projects.sort((a, b) => b.ordreAffichage - a.ordreAffichage);
        
        const titleElement = bentoContainer.querySelector('.section-title');
        bentoContainer.innerHTML = '';
        if (titleElement) bentoContainer.appendChild(titleElement);

        let itemsHTML = '';
        projects.forEach((project) => {
            const extraClass = project.formatAffichage || '';
            const focus = project.imageFocusBento || project.imageFocus || '50% 50%';

            itemsHTML += `
                <a href="projet.html?id=${project.id}" class="bento-item ${extraClass}">
                    <img src="${project.imageAffiche}" alt="${project.titre}" loading="lazy" style="object-position: ${focus} !important;">
                    <div class="bento-overlay">
                        <h3>${project.titre.toUpperCase()}</h3>
                        <p>${project.statut}</p>
                    </div>
                </a>
            `;
        });

        const wrapper = document.createElement('div');
        wrapper.className = 'bento-wrapper';

        const grid = document.createElement('div');
        grid.className = 'bento-grid';
        grid.innerHTML = itemsHTML; 

        wrapper.appendChild(grid);
        bentoContainer.appendChild(wrapper);

        // --- INTELLIGENCE DE SCROLL SOURIS (PC/MAC) SÉCURISÉE ---
        wrapper.addEventListener('wheel', (evt) => {
            // On ignore si c'est un scroll naturel sur Trackpad (MacBook)
            if (Math.abs(evt.deltaX) > Math.abs(evt.deltaY)) return;

            const maxScrollLeft = wrapper.scrollWidth - wrapper.clientWidth;
            
            // Si on scrolle vers le HAUT et qu'on est au DÉBUT de la grille -> On laisse la page monter
            if (evt.deltaY < 0 && wrapper.scrollLeft <= 0) return;
            
            // Si on scrolle vers le BAS et qu'on est à la FIN de la grille -> On laisse la page descendre
            // Le Math.ceil() protège contre les bugs de pixels décimaux des écrans 4K/Retina
            if (evt.deltaY > 0 && Math.ceil(wrapper.scrollLeft) >= maxScrollLeft - 1) return;

            // SINON : On intercepte la molette et on fait glisser la grille à l'horizontale
            evt.preventDefault();
            wrapper.scrollLeft += evt.deltaY; 
        }, { passive: false });

    } catch (error) { console.error("Erreur de grille :", error); }
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
        console.error("Erreur :", error);
    }
}

function renderProject(data) {
    document.querySelector('.project-title').textContent = data.titre;
    document.querySelector('.project-hero p').innerHTML = `${data.genre || ''} &bull; ${data.statut}`;
    
    const heroImage = document.querySelector('.project-hero img');
    heroImage.src = data.imageAffiche;
    heroImage.alt = `Affiche du film ${data.titre}`;
    heroImage.style.objectPosition = data.imageFocusHeader || data.imageFocus || '50% 50%';

    document.title = `${data.titre} - Produit par Silencio Pictures`;

    const shortSynopsis = data.synopsis ? data.synopsis.substring(0, 150) + '...' : `Découvrez ${data.titre}.`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', shortSynopsis);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', data.titre);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', shortSynopsis);
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', data.titre);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', shortSynopsis);

    document.getElementById('dyn-synopsis').innerHTML = (data.synopsis || '').replace(/\n/g, '<br>');
    document.getElementById('dyn-realisateur').textContent = data.realisateur || '-';
    const castingCible = document.getElementById('dyn-casting');
    if (data.casting) {
        castingCible.innerHTML = data.casting.split(',').map(nom => nom.trim()).join('<br>');
    } else {
        castingCible.textContent = '-';
    }
    document.getElementById('dyn-genre').textContent = data.genre || '-';
    document.getElementById('dyn-annee').textContent = data.annee || '-';

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
// 6. LOGIQUE : ADMINISTRATION
// =========================================
function initAdmin() {
    const loginOverlay = document.getElementById('login-overlay');
    const loginBox = document.getElementById('login-box');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginOverlay.classList.add('hidden');
            setupDropzone();
            setupProjectForm();
            loadAdminProjects();
            setupHomeVideo();
        } else {
            loginOverlay.classList.remove('hidden');
            if(loginBox) loginBox.classList.remove('hidden');
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const btn = loginForm.querySelector('button');

            btn.textContent = "Vérification..."; btn.disabled = true;

            signInWithEmailAndPassword(auth, email, password)
                .then(() => {
                    loginError.classList.add('hidden');
                    UI.showToast("Connexion réussie");
                    btn.textContent = "Connexion"; btn.disabled = false;
                })
                .catch((error) => {
                    loginError.classList.remove('hidden');
                    btn.textContent = "Connexion"; btn.disabled = false;
                });
        });
    }

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => { window.location.href = 'index.html'; });
        });
    }

    const btnAddNew = document.getElementById('btn-add-new');
    if (btnAddNew) {
        btnAddNew.addEventListener('click', () => {
            document.getElementById('view-list').classList.add('hidden');
            document.getElementById('view-form').classList.remove('hidden');
            btnAddNew.style.display = 'none';
            resetProjectForm();
        });
    }

    const navLinks = document.querySelectorAll('.admin-sidebar nav a');
    // --- GESTION DE LA RECHERCHE (FILTRE INSTANTANÉ) ---
    const searchInput = document.getElementById('search-project');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.sortable-item');
            
            items.forEach(item => {
                const titleElement = item.querySelector('.item-info strong');
                if (titleElement) {
                    const title = titleElement.textContent.toLowerCase();
                    // Si le titre contient la recherche, on affiche. Sinon, on cache.
                    if (title.includes(term)) {
                        item.style.display = 'flex';
                    } else {
                        item.style.display = 'none';
                    }
                }
            });
        });
    }
    const allPanels = document.querySelectorAll('[data-tab]');
    const mainTitle = document.querySelector('.content-header h1');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = link.getAttribute('href').replace('#', ''); 
            if (!target || target.startsWith('http')) return;
            e.preventDefault();

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            allPanels.forEach(panel => panel.classList.add('hidden'));
            
            if (target === 'projets') {
                mainTitle.textContent = "Projets en Production";
                document.getElementById('view-list').classList.remove('hidden');
                document.getElementById('view-form').classList.add('hidden');
                if (btnAddNew) btnAddNew.style.display = 'block';
            } else if (target === 'accueil') {
                document.getElementById('panel-accueil').classList.remove('hidden');
                mainTitle.textContent = "Vidéo d'Accueil";
                if (btnAddNew) btnAddNew.style.display = 'none';
            } else if (target === 'equipe') {
                mainTitle.textContent = "L'Équipe";
                if (btnAddNew) btnAddNew.style.display = 'block';
            }
        });
    });
}

// =========================================
// 7. MOTEUR DE VISUALISATION (AVEC SLIDERS EN TEMPS RÉEL)
// =========================================
function syncBentoDA() {
    const daContainer = document.getElementById('image-da-container');
    const previewsGroup = document.getElementById('previews-group');
    const dropText = document.querySelector('.drop-text');

    const previewBloc = document.getElementById('image-preview-bloc');
    const previewCadrage = document.getElementById('image-preview-cadrage');
    const blocWrapper = document.getElementById('da-bloc-wrapper');

    const formatSelect = document.getElementById('proj-format');
    const focusBentoX = document.getElementById('proj-focus-bento-x');
    const focusBentoY = document.getElementById('proj-focus-bento-y');
    const focusHeaderX = document.getElementById('proj-focus-header-x');
    const focusHeaderY = document.getElementById('proj-focus-header-y');

    if (!daContainer || !previewsGroup || !previewBloc) return;

    function updateLiveView() {
        if (!previewBloc.src || previewBloc.src === "" || previewBloc.src === window.location.href || previewBloc.src.endsWith('admin.html')) return;

        // Met à jour la forme du bloc
        blocWrapper.className = '';
        if (formatSelect && formatSelect.value) blocWrapper.classList.add(formatSelect.value);

        // Met à jour la position de l'image (X% Y%) en direct !
        if (focusBentoX && focusBentoY) {
            previewBloc.style.objectPosition = `${focusBentoX.value}% ${focusBentoY.value}%`;
        }
        if (focusHeaderX && focusHeaderY && previewCadrage) {
            previewCadrage.style.objectPosition = `${focusHeaderX.value}% ${focusHeaderY.value}%`;
        }
    }

    if (formatSelect) formatSelect.addEventListener('change', updateLiveView);
    // On utilise 'input' pour que l'image glisse EN TEMPS RÉEL pendant qu'on bouge le curseur !
    if (focusBentoX) focusBentoX.addEventListener('input', updateLiveView);
    if (focusBentoY) focusBentoY.addEventListener('input', updateLiveView);
    if (focusHeaderX) focusHeaderX.addEventListener('input', updateLiveView);
    if (focusHeaderY) focusHeaderY.addEventListener('input', updateLiveView);

    const hasImage = previewBloc.src && previewBloc.src !== "" && !previewBloc.src.endsWith(window.location.pathname) && !previewBloc.src.endsWith('admin.html');

    if (hasImage) {
        daContainer.classList.remove('da-container-single');
        daContainer.classList.add('da-container-split');
        if(dropText) dropText.style.display = 'none';
        previewsGroup.classList.remove('previews-hidden');
        previewsGroup.classList.add('previews-visible');
        updateLiveView();
    } else {
        daContainer.classList.remove('da-container-split');
        daContainer.classList.add('da-container-single');
        if(dropText) dropText.style.display = 'block';
        previewsGroup.classList.remove('previews-visible');
        previewsGroup.classList.add('previews-hidden');
    }
}

function setupDropzone() {
    const dropzone = document.getElementById('image-dropzone');
    if (!dropzone) return;

    const fileInput = document.getElementById('proj-image');
    const previewBloc = document.getElementById('image-preview-bloc');
    const previewCadrage = document.getElementById('image-preview-cadrage');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { dropzone.addEventListener(eventName, preventDefaults, false); });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    ['dragenter', 'dragover'].forEach(eventName => { dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false); });
    ['dragleave', 'drop'].forEach(eventName => { dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false); });

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', function() { if (this.files.length) handleFile(this.files[0]); });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) { UI.showToast("Format invalide.", "error"); return; }
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'); const MAX_WIDTH = 1920; let width = img.width, height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    optimizedImageBlob = blob;
                    const compressedUrl = URL.createObjectURL(blob);

                    if(previewBloc) previewBloc.src = compressedUrl;
                    if(previewCadrage) previewCadrage.src = compressedUrl;

                    syncBentoDA();
                    UI.showToast("Affiches prêtes pour la D.A. !");
                }, 'image/webp', 0.8);
            };
        };
    }

    syncBentoDA();
}

// =========================================
// 8. ENREGISTREMENT ET INTERFACE FORMAULAIRE
// =========================================
function returnToListView() {
    document.getElementById('view-list').classList.remove('hidden');
    document.getElementById('view-form').classList.add('hidden');
    const btnAddNew = document.getElementById('btn-add-new');
    if (btnAddNew) btnAddNew.style.display = 'block';
    resetProjectForm();
}

function resetProjectForm() {
    const form = document.getElementById('project-form');
    if(!form) return;
    form.reset();

    // On réinitialise les sliders à 50%
    if(document.getElementById('proj-focus-bento-x')) document.getElementById('proj-focus-bento-x').value = 50;
    if(document.getElementById('proj-focus-bento-y')) document.getElementById('proj-focus-bento-y').value = 50;
    if(document.getElementById('proj-focus-header-x')) document.getElementById('proj-focus-header-x').value = 50;
    if(document.getElementById('proj-focus-header-y')) document.getElementById('proj-focus-header-y').value = 50;

    const previewBloc = document.getElementById('image-preview-bloc');
    const previewCadrage = document.getElementById('image-preview-cadrage');

    if (previewBloc) previewBloc.removeAttribute('src');
    if (previewCadrage) previewCadrage.removeAttribute('src');

    syncBentoDA(); 

    document.getElementById('form-title').textContent = "Ajouter un projet";
    document.getElementById('btn-save').textContent = "Enregistrer le projet";
    optimizedImageBlob = null; currentEditId = null; currentEditImageUrl = null;
}

function setupProjectForm() {
    const form = document.getElementById('project-form');
    const btnSave = document.getElementById('btn-save');
    const btnCancelBottom = form ? form.querySelector('.btn-cancel-bottom') : null;
    const btnCancelTop = document.querySelector('.btn-cancel-top');

    if (!form) return;

    // Les deux boutons annuler ramènent à la liste
    if (btnCancelBottom) btnCancelBottom.addEventListener('click', returnToListView);
    if (btnCancelTop) btnCancelTop.addEventListener('click', returnToListView);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('proj-title').value.trim();
        const videoUrl = document.getElementById('proj-video').value.trim();

        const projectData = {
            titre: title,
            statut: document.getElementById('proj-subtitle').value.trim(),
            videoTrailer: videoUrl,
            genre: document.getElementById('proj-genre') ? document.getElementById('proj-genre').value.trim() : '',
            annee: document.getElementById('proj-annee') ? document.getElementById('proj-annee').value.trim() : '',
            realisateur: document.getElementById('proj-realisateur') ? document.getElementById('proj-realisateur').value.trim() : '',
            casting: document.getElementById('proj-casting') ? document.getElementById('proj-casting').value.trim() : '',
            synopsis: document.getElementById('proj-synopsis') ? document.getElementById('proj-synopsis').value.trim() : '',
            formatAffichage: document.getElementById('proj-format') ? document.getElementById('proj-format').value : '',
            
            // On sauvegarde la position sous forme de pourcentages ex: "50% 20%"
            imageFocusBento: `${document.getElementById('proj-focus-bento-x').value}% ${document.getElementById('proj-focus-bento-y').value}%`,
            imageFocusHeader: `${document.getElementById('proj-focus-header-x').value}% ${document.getElementById('proj-focus-header-y').value}%`
        };

        if (!currentEditId && !optimizedImageBlob) { UI.showToast("Ajoutez une affiche.", "error"); return; }
        btnSave.textContent = "Enregistrement..."; btnSave.disabled = true;

        try {
            let imageUrl = currentEditImageUrl;
            if (optimizedImageBlob) {
                const safeTitle = title.replace(/\s+/g, '-').toLowerCase();
                const imageRef = ref(storage, `affiches/${Date.now()}_${safeTitle}.webp`);
                await uploadBytes(imageRef, optimizedImageBlob);
                imageUrl = await getDownloadURL(imageRef);
            }
            projectData.imageAffiche = imageUrl;

            if (currentEditId) {
                await updateDoc(doc(db, "projects", currentEditId), projectData);
                UI.showToast("Projet mis à jour !");
            } else {
                projectData.ordreAffichage = Date.now();
                projectData.dateCreation = new Date().toISOString();
                await addDoc(collection(db, "projects"), projectData);
                UI.showToast("Projet publié !");
            }

            loadAdminProjects();
            returnToListView(); 

        } catch (error) { UI.showToast("Erreur.", "error"); console.error(error);} finally { btnSave.disabled = false; }
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
            li.className = 'sortable-item'; li.dataset.id = project.id; li.setAttribute('draggable', 'true');

            const imageSource = project.imageAffiche;
            const focus = project.imageFocusBento || project.imageFocus || '50% 50%';
            
            li.innerHTML = `
                <div class="drag-handle">☰</div>
                ${imageSource ? `<img src="${imageSource}" class="item-thumb" style="object-position: ${focus}; object-fit: cover;">` : `<div class="item-thumb placeholder-thumb" style="background:#222; display:flex; align-items:center; justify-content:center; color:#555; font-size:10px;">IMG</div>`}
                <div class="item-info"><strong>${project.titre}</strong><span>${project.statut}</span></div>
                <div class="item-actions">
                    <button class="btn-icon edit" title="Modifier">✎</button>
                    <button class="btn-icon delete" title="Supprimer">✕</button>
                </div>`;

            li.querySelector('.delete').addEventListener('click', async () => {
                if(confirm(`Supprimer "${project.titre}" ?`)) { await deleteDoc(doc(db, "projects", project.id)); loadAdminProjects(); }
            });

            li.querySelector('.edit').addEventListener('click', () => {
                resetProjectForm();

                document.getElementById('view-list').classList.add('hidden');
                document.getElementById('view-form').classList.remove('hidden');
                const btnAddNew = document.getElementById('btn-add-new');
                if (btnAddNew) btnAddNew.style.display = 'none';

                document.getElementById('proj-title').value = project.titre || '';
                document.getElementById('proj-subtitle').value = project.statut || '';
                document.getElementById('proj-video').value = project.videoTrailer || '';
                if(document.getElementById('proj-genre')) document.getElementById('proj-genre').value = project.genre || '';
                if(document.getElementById('proj-annee')) document.getElementById('proj-annee').value = project.annee || '';
                if(document.getElementById('proj-realisateur')) document.getElementById('proj-realisateur').value = project.realisateur || '';
                if(document.getElementById('proj-casting')) document.getElementById('proj-casting').value = project.casting || '';
                if(document.getElementById('proj-synopsis')) document.getElementById('proj-synopsis').value = project.synopsis || '';

                if(document.getElementById('proj-format')) document.getElementById('proj-format').value = project.formatAffichage || '';

                // On traduit l'ancienne position (ou la nouvelle) pour positionner le slider
                const bentoPos = parsePosition(project.imageFocusBento || project.imageFocus);
                document.getElementById('proj-focus-bento-x').value = bentoPos.x;
                document.getElementById('proj-focus-bento-y').value = bentoPos.y;

                const headerPos = parsePosition(project.imageFocusHeader || project.imageFocus);
                document.getElementById('proj-focus-header-x').value = headerPos.x;
                document.getElementById('proj-focus-header-y').value = headerPos.y;

                const previewBloc = document.getElementById('image-preview-bloc');
                const previewCadrage = document.getElementById('image-preview-cadrage');

                if (project.imageAffiche) {
                    if(previewBloc) previewBloc.src = project.imageAffiche;
                    if(previewCadrage) previewCadrage.src = project.imageAffiche;
                    syncBentoDA(); 
                }

                currentEditId = project.id; currentEditImageUrl = project.imageAffiche; optimizedImageBlob = null;
                document.getElementById('form-title').textContent = `Modifier : ${project.titre}`;
                document.getElementById('btn-save').textContent = "Mettre à jour";
                
                // On remonte tout en haut du formulaire de manière fluide
                document.querySelector('#view-form').scrollIntoView({ behavior: 'smooth' });
            });
            projectList.appendChild(li);
        });
        setupDragAndDrop();
    } catch (error) {}
}

// =========================================
// 10. DRAG & DROP (PC + Tactile)
// =========================================
function setupDragAndDrop() {
    const list = document.getElementById('project-list');
    const items = list.querySelectorAll('.sortable-item');

    items.forEach(item => {
        const handle = item.querySelector('.drag-handle');

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

        handle.addEventListener('touchstart', (e) => {
            document.body.style.overflow = 'hidden'; 
            item.classList.add('dragging');
        }, { passive: false });

        handle.addEventListener('touchmove', (e) => {
            e.preventDefault(); 
            const draggingItem = document.querySelector('.dragging');
            if (!draggingItem) return;

            const touch = e.touches[0];
            draggingItem.style.display = 'none';
            const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
            draggingItem.style.display = ''; 

            if (elementUnderFinger) {
                const sibling = elementUnderFinger.closest('.sortable-item');
                if (sibling && sibling !== draggingItem) {
                    const bounding = sibling.getBoundingClientRect();
                    if (touch.clientY > bounding.top + (bounding.height / 2)) {
                        sibling.after(draggingItem);
                    } else {
                        sibling.before(draggingItem);
                    }
                }
            }
        }, { passive: false });

        handle.addEventListener('touchend', async () => {
            document.body.style.overflow = ''; 
            item.classList.remove('dragging');
            await saveNewOrder();
        });
    });

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

// =========================================
// 11. GESTION DE LA VIDÉO D'ACCUEIL
// =========================================
function setupHomeVideo() {
    const form = document.getElementById('home-video-form');
    const btnSave = document.getElementById('btn-save-video');
    const fileInput = document.getElementById('home-video-file');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) {
            UI.showToast("Veuillez sélectionner une vidéo MP4.", "error");
            return;
        }

        btnSave.textContent = "Upload en cours... Patientez.";
        btnSave.disabled = true;

        try {
            const videoRef = ref(storage, `site-assets/background.mp4`);
            await uploadBytes(videoRef, file);
            const videoUrl = await getDownloadURL(videoRef);

            await setDoc(doc(db, "settings", "homepage"), { backgroundVideo: videoUrl }, { merge: true });

            UI.showToast("Vidéo d'accueil mise à jour !");
            form.reset();

        } catch (error) {
            console.error(error);
            UI.showToast("Erreur lors de l'envoi de la vidéo.", "error");
        } finally {
            btnSave.textContent = "Mettre à jour la vidéo";
            btnSave.disabled = false;
        }
    });
}




