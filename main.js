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

// --- VARIABLES GLOBALES ---
let optimizedImageBlob = null; 
let currentEditId = null;
let currentEditImageUrl = null;

let teamOptimizedImageBlob = null;
let currentTeamEditId = null;
let currentTeamImageUrl = null;

// L'AVATAR PAR DÉFAUT (Base64 SVG - Garanti sans lien mort)
const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='512' height='512'%3E%3Crect width='24' height='24' fill='%23111'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%23444'/%3E%3C/svg%3E";

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
if (path.includes('admin')) { initAdmin(); } 
else if (path.includes('projet')) { initProjectPage(); } 
else { initHomePage(); }

// =========================================
// 4. LOGIQUE : PAGE D'ACCUEIL (FILMS + ÉQUIPE)
// =========================================
async function initHomePage(){
    try {
        const settingsRef = doc(db, "settings", "homepage");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists() && settingsSnap.data().backgroundVideo) {
            const heroVideo = document.querySelector('.hero-video');
            if (heroVideo) { heroVideo.src = settingsSnap.data().backgroundVideo; heroVideo.load(); }
        }
        // --- SÉCURITÉ ANTI-CACHE (BFCache) ---
        setTimeout(() => {
            document.querySelectorAll('.anti-stretch-img').forEach(img => {
                if (img.complete) img.classList.add('loaded');
            });
        }, 50);
    } catch (error) { console.log("Erreur vidéo", error); }
    
    // --- 1. CHARGEMENT DES PROJETS ---
    const bentoContainer = document.querySelector('.bento-container');
    if (bentoContainer) {
        try {
            const querySnapshot = await getDocs(collection(db, "projects"));
            let projects = [];
            
            // On filtre les projets pour ne garder que ceux qui sont visibles
            querySnapshot.forEach((doc) => { 
                const data = doc.data();
                if (data.visible !== false) {
                    projects.push({ id: doc.id, ...data }); 
                }
            });
            projects.sort((a, b) => b.ordreAffichage - a.ordreAffichage);
            
            const titleElement = bentoContainer.querySelector('.section-title');
            bentoContainer.innerHTML = '';
            if (titleElement) bentoContainer.appendChild(titleElement);

            let itemsHTML = '';
            
            // =========================================================
            // CAS SPÉCIAL : AUCUN PROJET EN LIGNE (0 projet)
            // =========================================================
            if (projects.length === 0) {
                // On crée un énorme bloc 2x2 (bento-big)
                itemsHTML = `
                    <div class="bento-item bento-big silencio-placeholder" style="display: flex; align-items: center; justify-content: center; background: #050505; border: 1px solid rgba(255,255,255,0.02); pointer-events: none;">
                        <span style="color: var(--color-accent); opacity: 0.4; font-size: 2rem; font-weight: 400; letter-spacing: 6px;">SILENCIO</span>
                    </div>
                `;
            } else {
                // Création des blocs projets habituels
                projects.forEach((project) => {
                    const extraClass = project.formatAffichage || '';
                    const focus = project.imageFocusBento || project.imageFocus || '50% 50%';
                    itemsHTML += `
                        <a href="projet.html?id=${project.id}" class="bento-item ${extraClass}">
                            <img src="${project.imageAffiche}" alt="${project.titre}" loading="lazy" class="anti-stretch-img" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover !important; object-position: ${focus} !important;" onload="this.classList.add('loaded')">
                            <div class="bento-overlay">
                                <h3>${project.titre.toUpperCase()}</h3>
                                <p>${project.statut}</p>
                            </div>
                        </a>
                    `;
                });
            }

            // =========================================================
            // L'INTELLIGENCE : LE COMPTAGE "AU BLOC" ET BOUCHE-TROU
            // =========================================================
            let totalCells = 0;
            let hasTallOrBig = false; // <-- NOUVEAU : Détection des grands formats
            
            projects.forEach(p => {
                if (p.formatAffichage === 'bento-big') { totalCells += 4; hasTallOrBig = true; }
                else if (p.formatAffichage === 'bento-tall') { totalCells += 2; hasTallOrBig = true; }
                else if (p.formatAffichage === 'bento-wide') { totalCells += 2; }
                else { totalCells += 1; }
            });

            // Détection du support (PC vs Mobile/Tablette)
            const isMobile = window.innerWidth <= 1024;
            
            // LA NOUVELLE RÈGLE D'OR :
            const useScrollMode = isMobile ? projects.length > 6 : totalCells > 12;

            if (projects.length > 1) {
                let missingCells = 0;
                
                if (useScrollMode) {
                    // Mode Scroll : 3 lignes fixes. Il faut un multiple de 3.
                    missingCells = totalCells % 3 === 0 ? 0 : 3 - (totalCells % 3);
                } else {
                    // Mode Statique (PC) : 4 colonnes fixes.
                    // 1. Il faut un multiple de 4 pour faire une ligne complète.
                    let requiredCells = Math.ceil(totalCells / 4) * 4;
                    
                    // 2. S'il y a un format Vertical ou Grand, il faut AU MOINS 2 lignes (8 cases) pour fermer le rectangle !
                    if (hasTallOrBig && requiredCells < 8) {
                        requiredCells = 8;
                    }
                    missingCells = requiredCells - totalCells;
                }
                
                for (let i = 0; i < missingCells; i++) {
                    itemsHTML += `
                        <div class="bento-item silencio-placeholder" style="display: flex; align-items: center; justify-content: center; background: #050505; border: 1px solid rgba(255,255,255,0.02); pointer-events: none;">
                            <span style="color: var(--color-accent); opacity: 0.4; font-size: 1.5rem; font-weight: 400; letter-spacing: 4px;">SILENCIO</span>
                        </div>
                    `;
                }
            }
            // =========================================================

            const wrapper = document.createElement('div');
            const grid = document.createElement('div');

            // --- MODE 1 : GRILLE STATIQUE ---
            // On utilise maintenant notre nouvelle variable intelligente "useScrollMode"
            if (!useScrollMode) {
                wrapper.className = 'bento-wrapper is-static';
                grid.className = 'bento-grid is-static';
                
                // Centrage absolu s'il n'y a qu'un seul projet (ou 0 = le grand bloc Silencio)
                if (projects.length <= 1) {
                    grid.classList.add('is-single-item');
                }

                grid.innerHTML = itemsHTML;
                wrapper.appendChild(grid);
                bentoContainer.appendChild(wrapper);
            } 
            // --- MODE 2 : CARROUSEL INFINI ---
            else {
                wrapper.className = 'bento-wrapper is-scrollable';
                // ... (La suite du code de création du carrousel reste exactement la même)
                
                const track = document.createElement('div');
                track.className = 'bento-track';

                const grid1 = document.createElement('div'); grid1.className = 'bento-grid is-scrollable'; grid1.innerHTML = itemsHTML;
                const grid2 = document.createElement('div'); grid2.className = 'bento-grid is-scrollable'; grid2.innerHTML = itemsHTML;
                const grid3 = document.createElement('div'); grid3.className = 'bento-grid is-scrollable'; grid3.innerHTML = itemsHTML;

                track.appendChild(grid1);
                track.appendChild(grid2);
                track.appendChild(grid3);

                wrapper.appendChild(track);
                bentoContainer.appendChild(wrapper);

                let jumpDistance = 0;
                setTimeout(() => { 
                    jumpDistance = grid2.offsetLeft - grid1.offsetLeft;
                    wrapper.scrollLeft = jumpDistance; 
                }, 100);

                let isLooping = false;
                wrapper.addEventListener('scroll', () => {
                    if (isLooping || jumpDistance === 0) return;
                    
                    if (wrapper.scrollLeft < jumpDistance / 2) {
                        isLooping = true; 
                        wrapper.scrollLeft += jumpDistance; 
                        requestAnimationFrame(() => isLooping = false);
                    } else if (wrapper.scrollLeft > jumpDistance * 1.5) {
                        isLooping = true; 
                        wrapper.scrollLeft -= jumpDistance; 
                        requestAnimationFrame(() => isLooping = false);
                    }
                });
                
                wrapper.addEventListener('wheel', (evt) => {
                    if (Math.abs(evt.deltaX) > Math.abs(evt.deltaY)) return; 
                    evt.preventDefault(); wrapper.scrollLeft += evt.deltaY;
                }, { passive: false });
            }
        } catch (error) { console.error("Erreur projets :", error); }
    }

    // --- 2. CHARGEMENT DE L'ÉQUIPE ---
    const teamGrid = document.querySelector('.team-grid');
    if (teamGrid) {
        try {
            const querySnapshot = await getDocs(collection(db, "team"));
            let members = [];
            querySnapshot.forEach((doc) => { members.push({ id: doc.id, ...doc.data() }); });
            members.sort((a, b) => b.ordreAffichage - a.ordreAffichage);
            
            let teamHTML = '';
            members.forEach((member) => {
                const avatar = member.photo || DEFAULT_AVATAR; 
                teamHTML += `
                    <div class="team-card">
                        <img src="${avatar}" alt="${member.nom}" loading="lazy" class="anti-stretch-img" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover !important;" onload="this.classList.add('loaded')">
                        <div class="team-overlay">
                            <h3>${member.nom}</h3>
                            <p>${member.role}</p>
                        </div>
                    </div>
                `;
            });
            teamGrid.innerHTML = teamHTML;
        } catch (error) { console.error("Erreur équipe :", error); }
    }

    // --- 3. ANIMATIONS D'APPARITION ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-visible'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.bento-item, .team-card').forEach(i => observer.observe(i));
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
    } catch (error) {}
}

function renderProject(data) {
    document.querySelector('.project-title').textContent = data.titre;
    document.querySelector('.project-hero p').innerHTML = `${data.genre || ''} &bull; ${data.statut}`;
    
    const heroImage = document.querySelector('.project-hero img');
    
    // 1. On applique la classe et les styles de force brute AVANT de charger l'image
    heroImage.className = 'anti-stretch-img';
    heroImage.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover !important;';
    
    // 2. L'image ne s'affiche que lorsqu'elle est prête
    heroImage.onload = () => { heroImage.classList.add('loaded'); };
    
    // 3. On insère la source et le cadrage
    heroImage.src = data.imageAffiche;
    heroImage.style.objectPosition = data.imageFocusHeader || data.imageFocus || '50% 50%';

    document.title = `${data.titre} - Produit par Silencio Pictures`;
    
    // Remplissage du texte
    document.getElementById('dyn-synopsis').innerHTML = (data.synopsis || '').replace(/\n/g, '<br>');
    
    // --- L'INTELLIGENCE DU BOUTON "LIRE LA SUITE" ---
    setTimeout(() => {
        const synopsisWrapper = document.getElementById('synopsis-wrapper');
        const dynSynopsis = document.getElementById('dyn-synopsis');
        const btnReadMore = document.getElementById('btn-read-more');
        const synopsisFade = document.getElementById('synopsis-fade');

        // Si le texte dépasse la hauteur définie dans le CSS (140px)
        if (dynSynopsis.scrollHeight > 140) {
            btnReadMore.classList.remove('hidden'); // On affiche le bouton
            
            btnReadMore.addEventListener('click', () => {
                const isExpanded = synopsisWrapper.classList.contains('is-expanded');
                if (!isExpanded) {
                    synopsisWrapper.classList.add('is-expanded');
                    btnReadMore.textContent = 'Réduire';
                } else {
                    synopsisWrapper.classList.remove('is-expanded');
                    btnReadMore.textContent = 'Lire la suite';
                }
            });
        } else {
            // Si le texte est court, on désactive le fondu noir qui ne sert à rien
            if (synopsisFade) synopsisFade.style.display = 'none';
        }
    }, 50); // Le petit délai est nécessaire pour que le navigateur ait le temps de calculer la vraie taille du texte
    
    // Remplissage des autres données
    document.getElementById('dyn-realisateur').textContent = data.realisateur || '-';
    const castingCible = document.getElementById('dyn-casting');
    if (data.casting) castingCible.innerHTML = data.casting.split(',').map(nom => nom.trim()).join('<br>');
    else castingCible.textContent = '-';
    
    document.getElementById('dyn-genre').textContent = data.genre || '-';
    document.getElementById('dyn-annee').textContent = data.annee || '-';

    const videoSection = document.getElementById('dyn-video-section');
    const videoIframe = document.getElementById('dyn-video-iframe');
    if (data.videoTrailer) { videoIframe.src = data.videoTrailer; videoSection.style.display = 'block'; } 
    else { videoSection.style.display = 'none'; }

    // --- SÉCURITÉ ANTI-CACHE (BFCache) PROJET ---
    setTimeout(() => {
        if (heroImage.complete) heroImage.classList.add('loaded');
    }, 50);
}
// =========================================
// 6. LOGIQUE : ADMINISTRATION (ROUTAGE INTELLIGENT)
// =========================================
function initAdmin() {
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    let currentTab = 'projets';

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginOverlay.classList.add('hidden');
            setupDropzone();
            setupProjectForm();
            loadAdminProjects();
            
            setupTeamDropzone();
            setupTeamForm();
            loadAdminTeam();
            
            setupHomeVideo();
        } else {
            loginOverlay.classList.remove('hidden');
            document.getElementById('login-box').classList.remove('hidden');
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
                .then(() => { UI.showToast("Connexion réussie"); btn.textContent = "Connexion"; btn.disabled = false; })
                .catch(() => { document.getElementById('login-error').classList.remove('hidden'); btn.textContent = "Connexion"; btn.disabled = false; });
        });
    }

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); signOut(auth).then(() => { window.location.href = 'index.html'; }); });

    const btnAddNew = document.getElementById('btn-add-new');
    if (btnAddNew) {
        btnAddNew.addEventListener('click', () => {
            if (currentTab === 'projets') {
                document.getElementById('view-list').classList.add('hidden');
                document.getElementById('view-form').classList.remove('hidden');
                resetProjectForm();
            } else if (currentTab === 'equipe') {
                document.getElementById('view-team-list').classList.add('hidden');
                document.getElementById('view-team-form').classList.remove('hidden');
                resetTeamForm();
            }
            btnAddNew.style.display = 'none';
        });
    }

    const navLinks = document.querySelectorAll('.admin-sidebar nav a');
    const allPanels = document.querySelectorAll('[data-tab]');
    const mainTitle = document.querySelector('.content-header h1');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = link.getAttribute('href').replace('#', ''); 
            if (!target || target.startsWith('http')) return;
            e.preventDefault();
            
            currentTab = target;
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            allPanels.forEach(panel => panel.classList.add('hidden'));
            
            if (target === 'projets') {
                mainTitle.textContent = "Projets en Production";
                document.getElementById('view-list').classList.remove('hidden');
                if (btnAddNew) btnAddNew.style.display = 'block';
            } else if (target === 'accueil') {
                document.getElementById('panel-accueil').classList.remove('hidden');
                mainTitle.textContent = "Vidéo d'Accueil";
                if (btnAddNew) btnAddNew.style.display = 'none';
            } else if (target === 'equipe') {
                mainTitle.textContent = "L'Équipe";
                document.getElementById('view-team-list').classList.remove('hidden');
                if (btnAddNew) btnAddNew.style.display = 'block';
            }
        });
    });

    // --- RECHERCHE PROJETS ---
    const searchInput = document.getElementById('search-project');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#project-list .sortable-item').forEach(item => {
                const titleElement = item.querySelector('.item-info strong');
                if (titleElement) item.style.display = titleElement.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
            });
        });
    }

    // --- RECHERCHE ÉQUIPE ---
    const searchTeam = document.getElementById('search-team');
    if (searchTeam) {
        searchTeam.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('#team-list .sortable-item').forEach(item => {
                const nameElement = item.querySelector('.item-info strong');
                if (nameElement) item.style.display = nameElement.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
            });
        });
    }
}

// =========================================
// 7. MOTEUR DE PROJETS (D&D, UPLOAD, CRUD)
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
        blocWrapper.className = '';
        if (formatSelect && formatSelect.value) blocWrapper.classList.add(formatSelect.value);
        if (focusBentoX && focusBentoY) previewBloc.style.objectPosition = `${focusBentoX.value}% ${focusBentoY.value}%`;
        if (focusHeaderX && focusHeaderY && previewCadrage) previewCadrage.style.objectPosition = `${focusHeaderX.value}% ${focusHeaderY.value}%`;
    }

    if (formatSelect) formatSelect.addEventListener('change', updateLiveView);
    if (focusBentoX) focusBentoX.addEventListener('input', updateLiveView);
    if (focusBentoY) focusBentoY.addEventListener('input', updateLiveView);
    if (focusHeaderX) focusHeaderX.addEventListener('input', updateLiveView);
    if (focusHeaderY) focusHeaderY.addEventListener('input', updateLiveView);

    const hasImage = previewBloc.src && previewBloc.src !== "" && !previewBloc.src.endsWith(window.location.pathname) && !previewBloc.src.endsWith('admin.html');

    if (hasImage) {
        daContainer.classList.remove('da-container-single'); daContainer.classList.add('da-container-split');
        if(dropText) dropText.style.display = 'none';
        previewsGroup.classList.remove('previews-hidden'); previewsGroup.classList.add('previews-visible');
        updateLiveView();
    } else {
        daContainer.classList.remove('da-container-split'); daContainer.classList.add('da-container-single');
        if(dropText) dropText.style.display = 'block';
        previewsGroup.classList.remove('previews-visible'); previewsGroup.classList.add('previews-hidden');
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
                    
                    // ANTI-STRETCH : On retire la classe loaded pour forcer le fade-in
                    if(previewBloc) { previewBloc.classList.remove('loaded'); previewBloc.src = compressedUrl; }
                    if(previewCadrage) { previewCadrage.classList.remove('loaded'); previewCadrage.src = compressedUrl; }
                    
                    syncBentoDA();
                }, 'image/webp', 0.8);
            };
        };
    }
    syncBentoDA();
}

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
    if(document.getElementById('proj-focus-bento-x')) document.getElementById('proj-focus-bento-x').value = 50;
    if(document.getElementById('proj-focus-bento-y')) document.getElementById('proj-focus-bento-y').value = 50;
    if(document.getElementById('proj-focus-header-x')) document.getElementById('proj-focus-header-x').value = 50;
    if(document.getElementById('proj-focus-header-y')) document.getElementById('proj-focus-header-y').value = 50;

    const previewBloc = document.getElementById('image-preview-bloc');
    const previewCadrage = document.getElementById('image-preview-cadrage');
    if (previewBloc) { previewBloc.removeAttribute('src'); previewBloc.classList.remove('loaded'); }
    if (previewCadrage) { previewCadrage.removeAttribute('src'); previewCadrage.classList.remove('loaded'); }
    syncBentoDA(); 

    document.getElementById('form-title').textContent = "Ajouter un projet";
    document.getElementById('btn-save').textContent = "Enregistrer le projet";
    optimizedImageBlob = null; currentEditId = null; currentEditImageUrl = null;
}

function setupProjectForm() {
    const form = document.getElementById('project-form');
    if (!form) return;

    const btnCancelTop = document.querySelector('.btn-cancel-top');
    const btnCancelBottom = form.querySelector('.btn-cancel-bottom');

    if (btnCancelTop) btnCancelTop.addEventListener('click', returnToListView);
    if (btnCancelBottom) btnCancelBottom.addEventListener('click', returnToListView);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('proj-title').value.trim();
        const btnSave = document.getElementById('btn-save');

        const projectData = {
            titre: title,
            statut: document.getElementById('proj-subtitle').value.trim(),
            videoTrailer: document.getElementById('proj-video').value.trim(),
            genre: document.getElementById('proj-genre') ? document.getElementById('proj-genre').value.trim() : '',
            annee: document.getElementById('proj-annee') ? document.getElementById('proj-annee').value.trim() : '',
            realisateur: document.getElementById('proj-realisateur') ? document.getElementById('proj-realisateur').value.trim() : '',
            casting: document.getElementById('proj-casting') ? document.getElementById('proj-casting').value.trim() : '',
            synopsis: document.getElementById('proj-synopsis') ? document.getElementById('proj-synopsis').value.trim() : '',
            formatAffichage: document.getElementById('proj-format') ? document.getElementById('proj-format').value : '',
            imageFocusBento: `${document.getElementById('proj-focus-bento-x').value}% ${document.getElementById('proj-focus-bento-y').value}%`,
            imageFocusHeader: `${document.getElementById('proj-focus-header-x').value}% ${document.getElementById('proj-focus-header-y').value}%`,
            visible: document.getElementById('proj-visible') ? document.getElementById('proj-visible').checked : true
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
                await addDoc(collection(db, "projects"), projectData);
                UI.showToast("Projet publié !");
            }
            loadAdminProjects(); returnToListView(); 
        } catch (error) { UI.showToast("Erreur.", "error"); } finally { btnSave.disabled = false; }
    });
}

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

            const focus = project.imageFocusBento || project.imageFocus || '50% 50%';
            
            // --- GESTION DU VISUEL DE L'ŒIL ET DU BADGE ---
            const isHidden = project.visible === false;
            const hiddenBadge = isHidden ? '<span style="background: #333; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; margin-left: 10px; border: 1px solid #555; vertical-align: middle;">MASQUÉ</span>' : '';
            
            // Icônes SVG stylisées (Œil ouvert ou Œil barré)
            const eyeSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
            const eyeOffSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
            
            const iconToUse = isHidden ? eyeOffSvg : eyeSvg;
            const titleStatus = isHidden ? 'Afficher sur le site' : 'Masquer du site';
            const iconOpacity = isHidden ? 'opacity: 0.5;' : ''; // L'œil barré sera un peu plus transparent

            li.innerHTML = `
                <div class="drag-handle">☰</div>
                <img src="${project.imageAffiche}" class="item-thumb anti-stretch-img" style="object-position: ${focus}; object-fit: cover !important;" onload="this.classList.add('loaded')">
                <div class="item-info"><strong>${project.titre} ${hiddenBadge}</strong><span>${project.statut}</span></div>
                <div class="item-actions">
                    <button class="btn-icon toggle-visibility" style="${iconOpacity}" title="${titleStatus}">${iconToUse}</button>
                    <button class="btn-icon edit" title="Modifier">✎</button>
                    <button class="btn-icon delete" title="Supprimer">✕</button>
                </div>`;

            // ACTION 1 : Le bouton Œil (Mise en ligne / Hors ligne express)
            li.querySelector('.toggle-visibility').addEventListener('click', async () => {
                const newVisibility = isHidden ? true : false;
                try {
                    // On met à jour unqiuement la visibilité dans la base de données
                    await updateDoc(doc(db, "projects", project.id), { visible: newVisibility });
                    UI.showToast(newVisibility ? "Le projet est en ligne !" : "Le projet est masqué !");
                    loadAdminProjects(); // On recharge la liste pour mettre à jour l'icône
                } catch (error) {
                    UI.showToast("Erreur de mise à jour.", "error");
                }
            });

            // ACTION 2 : Le bouton Supprimer
            li.querySelector('.delete').addEventListener('click', async () => {
                if(confirm(`Supprimer "${project.titre}" ?`)) { await deleteDoc(doc(db, "projects", project.id)); loadAdminProjects(); }
            });

            // ACTION 3 : Le bouton Éditer
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
                
                // On met à jour l'état de la case à cocher dans le formulaire selon l'état actuel
                if(document.getElementById('proj-visible')) {
                    document.getElementById('proj-visible').checked = project.visible !== false; 
                }

                const bentoPos = parsePosition(project.imageFocusBento || project.imageFocus);
                document.getElementById('proj-focus-bento-x').value = bentoPos.x;
                document.getElementById('proj-focus-bento-y').value = bentoPos.y;

                const headerPos = parsePosition(project.imageFocusHeader || project.imageFocus);
                document.getElementById('proj-focus-header-x').value = headerPos.x;
                document.getElementById('proj-focus-header-y').value = headerPos.y;

                if (project.imageAffiche) {
                    const pB = document.getElementById('image-preview-bloc');
                    const pC = document.getElementById('image-preview-cadrage');
                    pB.classList.remove('loaded'); pB.src = project.imageAffiche;
                    pC.classList.remove('loaded'); pC.src = project.imageAffiche;
                    syncBentoDA(); 
                }

                currentEditId = project.id; currentEditImageUrl = project.imageAffiche; optimizedImageBlob = null;
                document.getElementById('form-title').textContent = `Modifier : ${project.titre}`;
                document.getElementById('btn-save').textContent = "Mettre à jour";
                document.querySelector('#view-form').scrollIntoView({ behavior: 'smooth' });
            });
            projectList.appendChild(li);
        });
        setupDragAndDrop('project-list', 'projects');
        
        // Sécurité Cache pour les listes
        setTimeout(() => {
            document.querySelectorAll('#project-list .anti-stretch-img').forEach(img => {
                if (img.complete) img.classList.add('loaded');
            });
        }, 50);
        
    } catch (error) {}
}

// =========================================
// 8. MOTEUR D'ÉQUIPE (D&D, UPLOAD, CRUD)
// =========================================
function setupTeamDropzone() {
    const dropzone = document.getElementById('team-dropzone');
    if (!dropzone) return;
    const fileInput = document.getElementById('team-image');
    const preview = document.getElementById('team-preview');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { dropzone.addEventListener(eventName, preventDefaults, false); });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', function() { if (this.files.length) handleFile(this.files[0]); });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) { UI.showToast("Format invalide.", "error"); return; }
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'); const MAX_WIDTH = 800; let width = img.width, height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    teamOptimizedImageBlob = blob;
                    preview.classList.remove('loaded');
                    preview.src = URL.createObjectURL(blob);
                }, 'image/webp', 0.8);
            };
        };
    }
}

function returnToTeamList() {
    document.getElementById('view-team-list').classList.remove('hidden');
    document.getElementById('view-team-form').classList.add('hidden');
    const btnAddNew = document.getElementById('btn-add-new');
    if (btnAddNew) btnAddNew.style.display = 'block';
    resetTeamForm();
}

function resetTeamForm() {
    const form = document.getElementById('team-form');
    if(!form) return;
    form.reset();
    const tPrev = document.getElementById('team-preview');
    tPrev.classList.remove('loaded');
    tPrev.src = DEFAULT_AVATAR; 
    
    document.getElementById('team-form-title').textContent = "Ajouter un membre";
    document.getElementById('btn-save-team').textContent = "Enregistrer le membre";
    teamOptimizedImageBlob = null; currentTeamEditId = null; currentTeamImageUrl = null;
}

function setupTeamForm() {
    const form = document.getElementById('team-form');
    if (!form) return;

    const btnCancelTop = document.querySelector('.btn-cancel-team-top');
    const btnCancelBottom = form.querySelector('.btn-cancel-team-bottom');

    if (btnCancelTop) btnCancelTop.addEventListener('click', returnToTeamList);
    if (btnCancelBottom) btnCancelBottom.addEventListener('click', returnToTeamList);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nom = document.getElementById('team-name').value.trim();
        const btnSave = document.getElementById('btn-save-team');

        const teamData = {
            nom: nom,
            role: document.getElementById('team-role').value.trim(),
        };

        btnSave.textContent = "Enregistrement..."; btnSave.disabled = true;

        try {
            let imageUrl = currentTeamImageUrl || DEFAULT_AVATAR; 
            if (teamOptimizedImageBlob) {
                const safeName = nom.replace(/\s+/g, '-').toLowerCase();
                const imageRef = ref(storage, `equipe/${Date.now()}_${safeName}.webp`);
                await uploadBytes(imageRef, teamOptimizedImageBlob);
                imageUrl = await getDownloadURL(imageRef);
            }
            teamData.photo = imageUrl;

            if (currentTeamEditId) {
                await updateDoc(doc(db, "team", currentTeamEditId), teamData);
                UI.showToast("Membre mis à jour !");
            } else {
                teamData.ordreAffichage = Date.now();
                await addDoc(collection(db, "team"), teamData);
                UI.showToast("Membre ajouté !");
            }
            loadAdminTeam(); returnToTeamList(); 
        } catch (error) { UI.showToast("Erreur.", "error"); } finally { btnSave.disabled = false; }
    });
}
async function loadAdminTeam() {
    const teamList = document.getElementById('team-list');
    if (!teamList) return;

    try {
        const querySnapshot = await getDocs(collection(db, "team"));
        let members = [];
        querySnapshot.forEach((doc) => { members.push({ id: doc.id, ...doc.data() }); });
        members.sort((a, b) => b.ordreAffichage - a.ordreAffichage);
        teamList.innerHTML = '';

        members.forEach(member => {
            const li = document.createElement('li');
            li.className = 'sortable-item'; li.dataset.id = member.id; li.setAttribute('draggable', 'true');

            const avatar = member.photo || DEFAULT_AVATAR; 

            li.innerHTML = `
                <div class="drag-handle">☰</div>
                <img src="${avatar}" class="item-thumb anti-stretch-img" style="border-radius: 50%; object-fit: cover !important;" onload="this.classList.add('loaded')">
                <div class="item-info"><strong>${member.nom}</strong><span>${member.role}</span></div>
                <div class="item-actions">
                    <button class="btn-icon edit" title="Modifier">✎</button>
                    <button class="btn-icon delete" title="Supprimer">✕</button>
                </div>`;

            li.querySelector('.delete').addEventListener('click', async () => {
                if(confirm(`Supprimer "${member.nom}" de l'équipe ?`)) { await deleteDoc(doc(db, "team", member.id)); loadAdminTeam(); }
            });

            li.querySelector('.edit').addEventListener('click', () => {
                resetTeamForm();
                document.getElementById('view-team-list').classList.add('hidden');
                document.getElementById('view-team-form').classList.remove('hidden');
                const btnAddNew = document.getElementById('btn-add-new');
                if (btnAddNew) btnAddNew.style.display = 'none';

                document.getElementById('team-name').value = member.nom || '';
                document.getElementById('team-role').value = member.role || '';
                
                const tPrev = document.getElementById('team-preview');
                tPrev.classList.remove('loaded');
                tPrev.src = avatar;

                currentTeamEditId = member.id; currentTeamImageUrl = member.photo; teamOptimizedImageBlob = null;
                document.getElementById('team-form-title').textContent = `Modifier : ${member.nom}`;
                document.getElementById('btn-save-team').textContent = "Mettre à jour";
                document.querySelector('#view-team-form').scrollIntoView({ behavior: 'smooth' });
            });
            teamList.appendChild(li);
        });
        setupDragAndDrop('team-list', 'team');
        
        // Sécurité Cache pour les listes
        setTimeout(() => {
            document.querySelectorAll('#team-list .anti-stretch-img').forEach(img => {
                if (img.complete) img.classList.add('loaded');
            });
        }, 50);
        
    } catch (error) {}
}


// =========================================
// 9. DRAG & DROP GÉNÉRIQUE (PC + Tactile)
// =========================================
function setupDragAndDrop(listId, collectionName) {
    const list = document.getElementById(listId);
    if (!list) return;
    const items = list.querySelectorAll('.sortable-item');

    async function saveOrder() {
        const currentItems = list.querySelectorAll('.sortable-item');
        document.body.style.cursor = 'wait';
        try {
            const promises = [];
            currentItems.forEach((item, index) => {
                const id = item.dataset.id;
                const newOrder = Date.now() - (index * 1000); 
                const docRef = doc(db, collectionName, id);
                promises.push(updateDoc(docRef, { ordreAffichage: newOrder }));
            });
            await Promise.all(promises);
            UI.showToast("Ordre sauvegardé !");
        } catch (error) { UI.showToast("Erreur de sauvegarde.", "error"); } 
        finally { document.body.style.cursor = 'default'; }
    }

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
            item.classList.remove('dragging'); item.removeAttribute('draggable');
            await saveOrder();
        });

        handle.addEventListener('touchstart', (e) => { document.body.style.overflow = 'hidden'; item.classList.add('dragging'); }, { passive: false });

        handle.addEventListener('touchmove', (e) => {
            e.preventDefault(); 
            const draggingItem = list.querySelector('.dragging');
            if (!draggingItem) return;
            const touch = e.touches[0];
            draggingItem.style.display = 'none';
            const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
            draggingItem.style.display = ''; 

            if (elementUnderFinger) {
                const sibling = elementUnderFinger.closest('.sortable-item');
                if (sibling && sibling !== draggingItem && sibling.parentElement === list) {
                    const bounding = sibling.getBoundingClientRect();
                    if (touch.clientY > bounding.top + (bounding.height / 2)) sibling.after(draggingItem);
                    else sibling.before(draggingItem);
                }
            }
        }, { passive: false });

        handle.addEventListener('touchend', async () => { document.body.style.overflow = ''; item.classList.remove('dragging'); await saveOrder(); });
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        const draggingItem = list.querySelector('.dragging');
        if (!draggingItem) return;
        const siblings = [...list.querySelectorAll('.sortable-item:not(.dragging)')];
        let nextSibling = siblings.find(sibling => e.clientY <= sibling.getBoundingClientRect().top + sibling.offsetHeight / 2);
        list.insertBefore(draggingItem, nextSibling);
    });
}

// =========================================
// 10. GESTION DE LA VIDÉO D'ACCUEIL
// =========================================
function setupHomeVideo() {
    const form = document.getElementById('home-video-form');
    const btnSave = document.getElementById('btn-save-video');
    const fileInput = document.getElementById('home-video-file');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const file = fileInput.files[0];
        if (!file) { UI.showToast("Sélectionnez une vidéo.", "error"); return; }
        btnSave.textContent = "Upload en cours..."; btnSave.disabled = true;

        try {
            const videoRef = ref(storage, `site-assets/background.mp4`);
            await uploadBytes(videoRef, file);
            const videoUrl = await getDownloadURL(videoRef);
            await setDoc(doc(db, "settings", "homepage"), { backgroundVideo: videoUrl }, { merge: true });
            UI.showToast("Vidéo mise à jour !"); form.reset();
        } catch (error) { UI.showToast("Erreur vidéo.", "error"); } finally { btnSave.textContent = "Mettre à jour la vidéo"; btnSave.disabled = false; }
    });
}






















