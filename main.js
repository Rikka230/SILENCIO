// =========================================
// SILENCIO PICTURES - MAIN JS (ES6 MODULES)
// =========================================

// =========================================
// 1. CONFIGURATION & INITIALISATION FIREBASE
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

// =========================================
// 2. VARIABLES GLOBALES & UTILITAIRES
// =========================================
let optimizedImageBlob = null; 
let currentEditId = null;
let currentEditImageUrl = null;
let currentProjectWasShared = false;

let teamOptimizedImageBlob = null;
let currentTeamEditId = null;
let currentTeamImageUrl = null;

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

// =========================================
// 3. MOTEUR DE DÉCOUPE JPG (INSTAGRAM)
// =========================================
async function generateSocialCropBlob(sourceUrlOrBlob, focusX, focusY) {
    return new Promise(async (resolve, reject) => {
        try {
            let safeUrl;
            if (sourceUrlOrBlob instanceof Blob) {
                safeUrl = URL.createObjectURL(sourceUrlOrBlob);
            } else {
                const response = await fetch(sourceUrlOrBlob);
                const blob = await response.blob();
                safeUrl = URL.createObjectURL(blob);
            }

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 1080;
                canvas.height = 1350; // Format Insta 4:5
                const ctx = canvas.getContext('2d');

                const targetRatio = 4 / 5;
                const sourceRatio = img.width / img.height;
                let sWidth, sHeight, sx, sy;

                if (sourceRatio > targetRatio) { 
                    sHeight = img.height;
                    sWidth = img.height * targetRatio;
                    sx = (img.width - sWidth) * (focusX / 100);
                    sy = 0;
                } else { 
                    sWidth = img.width;
                    sHeight = img.width / targetRatio;
                    sx = 0;
                    sy = (img.height - sHeight) * (focusY / 100);
                }
                
                ctx.fillStyle = '#050505';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(safeUrl);
                    resolve(blob);
                }, 'image/jpeg', 0.9);
            };
            img.onerror = () => reject("Erreur image source");
            img.src = safeUrl;
        } catch (error) { reject(error); }
    });
}

// =========================================
// 4. ROUTAGE PRINCIPAL
// =========================================
const path = window.location.pathname.toLowerCase();
if (path.includes('admin')) { initAdmin(); } 
else if (path.includes('projet')) { initProjectPage(); } 
else { initHomePage(); }

// =========================================
// 5. LOGIQUE : PAGE D'ACCUEIL
// =========================================
async function initHomePage(){
    const loader = document.getElementById('loader');
    if (loader) {
        if (!sessionStorage.getItem('silencioIntroSeen')) {
            document.body.style.overflow = 'hidden'; window.scrollTo(0, 0); 
            setTimeout(() => { document.body.style.overflow = ''; sessionStorage.setItem('silencioIntroSeen', 'true'); }, 4500); 
        } else {
            loader.style.display = 'none';
        }
    }
    try {
        const settingsRef = doc(db, "settings", "homepage");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists() && settingsSnap.data().backgroundVideo) {
            const heroVideo = document.querySelector('.hero-video');
            if (heroVideo) { heroVideo.src = settingsSnap.data().backgroundVideo; heroVideo.load(); }
        }
        setTimeout(() => {
            document.querySelectorAll('.anti-stretch-img').forEach(img => { if (img.complete) img.classList.add('loaded'); });
        }, 50);
    } catch (error) {}
    
    const bentoContainer = document.querySelector('.bento-container');
    if (bentoContainer) {
        try {
            const querySnapshot = await getDocs(collection(db, "projects"));
            let projects = [];
            querySnapshot.forEach((doc) => { 
                const data = doc.data(); if (data.visible !== false) projects.push({ id: doc.id, ...data }); 
            });
            projects.sort((a, b) => b.ordreAffichage - a.ordreAffichage);
            
            const titleElement = bentoContainer.querySelector('.section-title');
            bentoContainer.innerHTML = '';
            if (titleElement) bentoContainer.appendChild(titleElement);

            let totalCells = 0; let hasTallOrBig = false; let projectsHTML = '';

            if (projects.length === 0) {
                projectsHTML = `<div class="bento-item bento-big silencio-placeholder" style="display: flex; align-items: center; justify-content: center; background: #050505; border: 1px solid rgba(255,255,255,0.02); pointer-events: none;"><span style="color: var(--color-accent); opacity: 0.4; font-size: 2rem; font-weight: 400; letter-spacing: 6px;">SILENCIO</span></div>`;
            } else {
                projects.forEach((project) => {
                    const extraClass = project.formatAffichage || '';
                    const focus = project.imageFocusBento || project.imageFocus || '50% 50%';

                    if (extraClass === 'bento-big') { totalCells += 4; hasTallOrBig = true; }
                    else if (extraClass === 'bento-tall') { totalCells += 2; hasTallOrBig = true; }
                    else if (extraClass === 'bento-wide') { totalCells += 2; }
                    else { totalCells += 1; }

                    projectsHTML += `<a href="projet.html?id=${project.id}" class="bento-item ${extraClass}"><img src="${project.imageAffiche}" alt="${project.titre}" loading="lazy" class="anti-stretch-img" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover !important; object-position: ${focus} !important;" onload="this.classList.add('loaded')"><div class="bento-overlay"><h3>${project.titre.toUpperCase()}</h3><p>${project.statut}</p></div></a>`;
                });
            }

            const isMobile = window.innerWidth <= 1024;
            const useScrollMode = isMobile ? projects.length > 6 : totalCells > 12;
            let itemsHTML = ''; let requiredRows = 1; let requiredCols = 4;

            if (projects.length > 1) {
                let missingCells = 0; let beforeCount = 0; let afterCount = 0;
                if (useScrollMode) {
                    let gridMap = [[], [], []]; let maxCol = 0;
                    projects.forEach(p => {
                        let w = 1, h = 1; const format = p.formatAffichage || '';
                        if (format === 'bento-big') { w = 2; h = 2; } else if (format === 'bento-tall') { w = 1; h = 2; } else if (format === 'bento-wide') { w = 2; h = 1; }
                        let placed = false; let x = 0;
                        while (!placed) {
                            for (let y = 0; y <= 3 - h; y++) {
                                let canFit = true;
                                for (let dx = 0; dx < w; dx++) {
                                    for (let dy = 0; dy < h; dy++) { if (gridMap[y + dy][x + dx]) { canFit = false; break; } }
                                    if (!canFit) break;
                                }
                                if (canFit) {
                                    for (let dx = 0; dx < w; dx++) { for (let dy = 0; dy < h; dy++) { gridMap[y + dy][x + dx] = true; } }
                                    if (x + w > maxCol) maxCol = x + w; placed = true; break;
                                }
                            }
                            if (!placed) x++;
                        }
                    });
                    for (let x = 0; x < maxCol; x++) { for (let y = 0; y < 3; y++) { if (!gridMap[y][x]) missingCells++; } }
                    afterCount = missingCells;
                } else {
                    if (hasTallOrBig) {
                        if (totalCells <= 4) { requiredRows = 2; requiredCols = 2; } else if (totalCells <= 6) { requiredRows = 2; requiredCols = 3; } else if (totalCells <= 8) { requiredRows = 2; requiredCols = 4; } else { requiredRows = 3; requiredCols = 4; }                     
                    } else {
                        if (totalCells <= 2) { requiredRows = 1; requiredCols = 2; } else if (totalCells === 3) { requiredRows = 1; requiredCols = 3; } else if (totalCells === 4) { requiredRows = 1; requiredCols = 4; } else if (totalCells <= 8) { requiredRows = 2; requiredCols = 4; } else { requiredRows = 3; requiredCols = 4; }
                    }
                    const requiredTotal = requiredRows * requiredCols;
                    missingCells = requiredTotal > totalCells ? requiredTotal - totalCells : 0;
                    beforeCount = Math.floor(missingCells / 2); afterCount = Math.ceil(missingCells / 2);
                }

                const createSilencio = () => `<div class="bento-item silencio-placeholder" style="display: flex; align-items: center; justify-content: center; background: #050505; border: 1px solid rgba(255,255,255,0.02); pointer-events: none;"><span style="color: var(--color-accent); opacity: 0.4; font-size: 1.5rem; font-weight: 400; letter-spacing: 4px;">SILENCIO</span></div>`;
                let beforeHTML = ''; for (let i = 0; i < beforeCount; i++) beforeHTML += createSilencio();
                let afterHTML = ''; for (let i = 0; i < afterCount; i++) afterHTML += createSilencio();
                itemsHTML = beforeHTML + projectsHTML + afterHTML;
            } else { itemsHTML = projectsHTML; }

            const wrapper = document.createElement('div'); const grid = document.createElement('div');
            if (!useScrollMode) {
                wrapper.className = 'bento-wrapper is-static'; grid.className = 'bento-grid is-static';
                if (projects.length <= 1) { grid.classList.add('is-single-item'); } 
                else if (!isMobile) { grid.style.setProperty('grid-template-columns', `repeat(${requiredCols}, var(--cell-size))`, 'important'); grid.style.setProperty('grid-template-rows', `repeat(${requiredRows}, var(--cell-size))`, 'important'); }
                grid.innerHTML = itemsHTML; wrapper.appendChild(grid); bentoContainer.appendChild(wrapper);
            } else {
                wrapper.className = 'bento-wrapper is-scrollable'; const track = document.createElement('div'); track.className = 'bento-track';
                const grid1 = document.createElement('div'); grid1.className = 'bento-grid is-scrollable'; grid1.innerHTML = itemsHTML;
                const grid2 = document.createElement('div'); grid2.className = 'bento-grid is-scrollable'; grid2.innerHTML = itemsHTML;
                const grid3 = document.createElement('div'); grid3.className = 'bento-grid is-scrollable'; grid3.innerHTML = itemsHTML;
                track.appendChild(grid1); track.appendChild(grid2); track.appendChild(grid3); wrapper.appendChild(track); bentoContainer.appendChild(wrapper);

                let jumpDistance = 0;
                setTimeout(() => { jumpDistance = grid2.offsetLeft - grid1.offsetLeft; wrapper.scrollLeft = jumpDistance; }, 100);

                let isLooping = false;
                wrapper.addEventListener('scroll', () => {
                    if (isLooping || jumpDistance === 0) return;
                    if (wrapper.scrollLeft < jumpDistance / 2) { isLooping = true; wrapper.scrollLeft += jumpDistance; requestAnimationFrame(() => isLooping = false); } 
                    else if (wrapper.scrollLeft > jumpDistance * 1.5) { isLooping = true; wrapper.scrollLeft -= jumpDistance; requestAnimationFrame(() => isLooping = false); }
                });
                wrapper.addEventListener('wheel', (evt) => { if (Math.abs(evt.deltaX) > Math.abs(evt.deltaY)) return; evt.preventDefault(); wrapper.scrollLeft += evt.deltaY; }, { passive: false });
            }
        } catch (error) {}
    }

    const teamGrid = document.querySelector('.team-grid');
    if (teamGrid) {
        try {
            const querySnapshot = await getDocs(collection(db, "team"));
            let members = []; querySnapshot.forEach((doc) => { members.push({ id: doc.id, ...doc.data() }); });
            members.sort((a, b) => b.ordreAffichage - a.ordreAffichage);
            
            let teamHTML = '';
            members.forEach((member) => {
                const avatar = member.photo || DEFAULT_AVATAR; 
                let formattedName = member.nom; const nameParts = formattedName.trim().split(' ');
                if (nameParts.length > 1) { const nomFamille = nameParts.pop(); const prenom = nameParts.join(' '); formattedName = `${prenom}<br><strong style="font-weight: 600;">${nomFamille}</strong>`; }
                teamHTML += `<div class="team-card"><div class="team-photo-wrapper"><img src="${avatar}" alt="${member.nom}" loading="lazy" class="anti-stretch-img" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover !important;" onload="this.classList.add('loaded')"></div><div class="team-info"><h3>${formattedName}</h3><p>${member.role}</p></div></div>`;
            });
            teamGrid.innerHTML = teamHTML;
        } catch (error) {}
    }

    const observer = new IntersectionObserver((entries) => { entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-visible'); }); }, { threshold: 0.1 });
    document.querySelectorAll('.bento-item, .team-card').forEach(i => observer.observe(i));
}

// =========================================
// 6. LOGIQUE : PAGE PROJET DYNAMIQUE
// =========================================
async function initProjectPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');
    if (!projectId) { window.location.href = 'index.html'; return; }
    try {
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) renderProject(docSnap.data()); else window.location.href = 'index.html';
    } catch (error) {}
}

function renderProject(data) {
    document.querySelector('.project-title').textContent = data.titre;
    document.querySelector('.project-hero p').innerHTML = `${data.genre || ''} &bull; ${data.statut}`;
    const heroImage = document.querySelector('.project-hero img');
    heroImage.className = 'anti-stretch-img';
    heroImage.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover !important;';
    heroImage.onload = () => { heroImage.classList.add('loaded'); };
    heroImage.src = data.imageAffiche;
    heroImage.style.objectPosition = data.imageFocusHeader || data.imageFocus || '50% 50%';

    document.title = `${data.titre} - Produit par Silencio Pictures`;
    document.getElementById('dyn-synopsis').innerHTML = (data.synopsis || '').replace(/\n/g, '<br>');
    
    setTimeout(() => {
        const synopsisWrapper = document.getElementById('synopsis-wrapper');
        const dynSynopsis = document.getElementById('dyn-synopsis');
        const btnReadMore = document.getElementById('btn-read-more');
        const synopsisFade = document.getElementById('synopsis-fade');
        if (dynSynopsis.scrollHeight > 140) {
            btnReadMore.classList.remove('hidden');
            btnReadMore.addEventListener('click', () => {
                const isExpanded = synopsisWrapper.classList.contains('is-expanded');
                if (!isExpanded) { synopsisWrapper.classList.add('is-expanded'); btnReadMore.textContent = 'Réduire'; } 
                else { synopsisWrapper.classList.remove('is-expanded'); btnReadMore.textContent = 'Lire la suite'; }
            });
        } else { if (synopsisFade) synopsisFade.style.display = 'none'; }
    }, 50);
    
    document.getElementById('dyn-realisateur').textContent = data.realisateur || '-';
    const castingCible = document.getElementById('dyn-casting');
    if (data.casting) castingCible.innerHTML = data.casting.split(',').map(nom => nom.trim()).join('<br>'); else castingCible.textContent = '-';
    
    document.getElementById('dyn-genre').textContent = data.genre || '-';
    document.getElementById('dyn-annee').textContent = data.annee || '-';
    const videoSection = document.getElementById('dyn-video-section');
    const videoIframe = document.getElementById('dyn-video-iframe');
    if (data.videoTrailer) { videoIframe.src = data.videoTrailer; videoSection.style.display = 'block'; } else { videoSection.style.display = 'none'; }
    setTimeout(() => { if (heroImage.complete) heroImage.classList.add('loaded'); }, 50);
}

// =========================================
// 7. LOGIQUE : INITIALISATION ADMINISTRATION
// =========================================
function initAdmin() {
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    let currentTab = 'projets';

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loginOverlay.classList.add('hidden');
            setupDropzone(); setupProjectForm(); loadAdminProjects();
            setupTeamDropzone(); setupTeamForm(); loadAdminTeam();
            setupHomeVideo();
        } else {
            loginOverlay.classList.remove('hidden'); document.getElementById('login-box').classList.remove('hidden');
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value; const password = document.getElementById('admin-password').value; const btn = loginForm.querySelector('button');
            btn.textContent = "Vérification..."; btn.disabled = true;
            signInWithEmailAndPassword(auth, email, password).then(() => { UI.showToast("Connexion réussie"); btn.textContent = "Connexion"; btn.disabled = false; }).catch(() => { document.getElementById('login-error').classList.remove('hidden'); btn.textContent = "Connexion"; btn.disabled = false; });
        });
    }

    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); signOut(auth).then(() => { window.location.href = 'index.html'; }); });

    // --- GESTION DU SLIDER RÉSEAUX SOCIAUX ---
    const shareToggle = document.getElementById('proj-autoshare');
    const socialZone = document.getElementById('social-crop-zone');
    if (shareToggle && socialZone) {
        shareToggle.addEventListener('change', (e) => {
            const isVisible = e.target.checked;
            socialZone.style.display = isVisible ? 'block' : 'none';
            
            // Si on vient d'ouvrir la zone, on force le rafraîchissement des images
            if (isVisible) {
                setTimeout(() => {
                    syncBentoDA(); 
                }, 50); // Un léger délai pour laisser le temps au CSS de s'afficher
            }
        });
    }

    const btnAddNew = document.getElementById('btn-add-new');
    if (btnAddNew) {
        btnAddNew.addEventListener('click', () => {
            if (currentTab === 'projets') { document.getElementById('view-list').classList.add('hidden'); document.getElementById('view-form').classList.remove('hidden'); resetProjectForm(); } 
            else if (currentTab === 'equipe') { document.getElementById('view-team-list').classList.add('hidden'); document.getElementById('view-team-form').classList.remove('hidden'); resetTeamForm(); }
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
            e.preventDefault(); currentTab = target; navLinks.forEach(l => l.classList.remove('active')); link.classList.add('active');
            allPanels.forEach(panel => panel.classList.add('hidden'));
            if (target === 'projets') { mainTitle.textContent = "Projets en Production"; document.getElementById('view-list').classList.remove('hidden'); if (btnAddNew) btnAddNew.style.display = 'block'; } 
            else if (target === 'accueil') { document.getElementById('panel-accueil').classList.remove('hidden'); mainTitle.textContent = "Vidéo d'Accueil"; if (btnAddNew) btnAddNew.style.display = 'none'; } 
            else if (target === 'equipe') { mainTitle.textContent = "L'Équipe"; document.getElementById('view-team-list').classList.remove('hidden'); if (btnAddNew) btnAddNew.style.display = 'block'; }
        });
    });

    const searchInput = document.getElementById('search-project');
    if (searchInput) searchInput.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('#project-list .sortable-item').forEach(item => { const titleElement = item.querySelector('.item-info strong'); if (titleElement) item.style.display = titleElement.textContent.toLowerCase().includes(term) ? 'flex' : 'none'; }); });

    const searchTeam = document.getElementById('search-team');
    if (searchTeam) searchTeam.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('#team-list .sortable-item').forEach(item => { const nameElement = item.querySelector('.item-info strong'); if (nameElement) item.style.display = nameElement.textContent.toLowerCase().includes(term) ? 'flex' : 'none'; }); });
}

// =========================================
// 8. MOTEUR D'ADMINISTRATION : PROJETS
// =========================================
function syncBentoDA() {
    const previewBloc = document.getElementById('image-preview-bloc');
    const previewCadrage = document.getElementById('image-preview-cadrage');
    const previewSocial = document.getElementById('image-preview-social');
    const blocWrapper = document.getElementById('da-bloc-wrapper');
    const formatSelect = document.getElementById('proj-format');

    const focusInputs = [
        'proj-focus-bento-x', 'proj-focus-bento-y',
        'proj-focus-header-x', 'proj-focus-header-y',
        'proj-focus-social-x', 'proj-focus-social-y'
    ];

    function updateLiveView() {
        if (!previewBloc || !previewBloc.src || previewBloc.src.endsWith('admin.html')) return;

        if (blocWrapper && formatSelect) {
            blocWrapper.className = '';
            if (formatSelect.value) blocWrapper.classList.add(formatSelect.value);
        }

        // Mise à jour des positions selon les sliders
        previewBloc.style.objectPosition = `${document.getElementById('proj-focus-bento-x').value}% ${document.getElementById('proj-focus-bento-y').value}%`;
        if (previewCadrage) previewCadrage.style.objectPosition = `${document.getElementById('proj-focus-header-x').value}% ${document.getElementById('proj-focus-header-y').value}%`;
        if (previewSocial) previewSocial.style.objectPosition = `${document.getElementById('proj-focus-social-x').value}% ${document.getElementById('proj-focus-social-y').value}%`;
    }

    // On attache les écouteurs sur les sliders
    focusInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.oninput = updateLiveView;
    });
    if (formatSelect) formatSelect.onchange = updateLiveView;

    // Affichage des panneaux si une image est présente
    const daContainer = document.getElementById('image-da-container');
    const previewsGroup = document.getElementById('previews-group');
    const hasImage = previewBloc && previewBloc.src && !previewBloc.src.endsWith('admin.html') && previewBloc.src !== "";

    if (hasImage && daContainer && previewsGroup) {
        daContainer.classList.remove('da-container-single');
        daContainer.classList.add('da-container-split');
        previewsGroup.classList.remove('previews-hidden');
        previewsGroup.classList.add('previews-visible');
        updateLiveView();
    }
}

function setupDropzone() {
    const dropzone = document.getElementById('image-dropzone');
    if (!dropzone) return;
    const fileInput = document.getElementById('proj-image');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => { e.preventDefault(); e.stopPropagation(); });
    });

    dropzone.onclick = () => fileInput.click();
    dropzone.ondrop = (e) => handleFile(e.dataTransfer.files[0]);
    fileInput.onchange = (e) => { if (e.target.files.length) handleFile(e.target.files[0]); };

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1920;
                let width = img.width, height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    optimizedImageBlob = blob;
                    const compressedUrl = URL.createObjectURL(blob);
                    
                    const pB = document.getElementById('image-preview-bloc');
                    const pC = document.getElementById('image-preview-cadrage');
                    const pS = document.getElementById('image-preview-social');
                    
                    // On attache un écouteur : dès que l'image est chargée dans le DOM, on lance la synchro
                    pB.onload = () => { syncBentoDA(); pB.classList.add('loaded'); };
                    
                    pB.src = compressedUrl;
                    if(pC) pC.src = compressedUrl;
                    if(pS) pS.src = compressedUrl;
                    
                }, 'image/webp', 0.8);
            };
        };
    }
}

function returnToListView() {
    document.getElementById('view-list').classList.remove('hidden'); document.getElementById('view-form').classList.add('hidden');
    const btnAddNew = document.getElementById('btn-add-new'); if (btnAddNew) btnAddNew.style.display = 'block';
    resetProjectForm();
}

function resetProjectForm() {
    const form = document.getElementById('project-form'); if(!form) return; form.reset();
    if(document.getElementById('proj-focus-bento-x')) document.getElementById('proj-focus-bento-x').value = 50;
    if(document.getElementById('proj-focus-bento-y')) document.getElementById('proj-focus-bento-y').value = 50;
    if(document.getElementById('proj-focus-header-x')) document.getElementById('proj-focus-header-x').value = 50;
    if(document.getElementById('proj-focus-header-y')) document.getElementById('proj-focus-header-y').value = 50;
    if(document.getElementById('proj-focus-social-x')) document.getElementById('proj-focus-social-x').value = 50;
    if(document.getElementById('proj-focus-social-y')) document.getElementById('proj-focus-social-y').value = 50;
    if(document.getElementById('proj-autoshare')) document.getElementById('proj-autoshare').checked = false;
    if(document.getElementById('social-crop-zone')) document.getElementById('social-crop-zone').style.display = 'none';

    const pB = document.getElementById('image-preview-bloc'); const pC = document.getElementById('image-preview-cadrage'); const pS = document.getElementById('image-preview-social');
    if (pB) { pB.removeAttribute('src'); pB.classList.remove('loaded'); }
    if (pC) { pC.removeAttribute('src'); pC.classList.remove('loaded'); }
    if (pS) { pS.removeAttribute('src'); pS.classList.remove('loaded'); }
    syncBentoDA(); 

    document.getElementById('form-title').textContent = "Ajouter un projet"; document.getElementById('btn-save').textContent = "Enregistrer le projet";
    optimizedImageBlob = null; currentEditId = null; currentEditImageUrl = null; currentProjectWasShared = false;
}

function setupProjectForm() {
    const form = document.getElementById('project-form'); if (!form) return;
    const btnCancelTop = document.querySelector('.btn-cancel-top'); const btnCancelBottom = form.querySelector('.btn-cancel-bottom');
    if (btnCancelTop) btnCancelTop.addEventListener('click', returnToListView); if (btnCancelBottom) btnCancelBottom.addEventListener('click', returnToListView);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const autoShareCheckbox = document.getElementById('proj-autoshare');
        let triggerWebhook = false; 
        
        if (autoShareCheckbox && autoShareCheckbox.checked) {
            if (currentEditId && currentProjectWasShared) {
                if (confirm("⚠️ Ce projet a DÉJÀ été publié sur vos réseaux sociaux.\nVoulez-vous forcer un doublon ?")) { triggerWebhook = true; } else { triggerWebhook = false; autoShareCheckbox.checked = false; }
            } else {
                if (confirm("⚠️ Vous allez publier ce projet sur les réseaux sociaux.\nÊtes-vous sûr(e) ?")) { triggerWebhook = true; } else { return; }
            }
        }

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
            imageFocusSocial: `${document.getElementById('proj-focus-social-x').value}% ${document.getElementById('proj-focus-social-y').value}%`,
            visible: document.getElementById('proj-visible') ? document.getElementById('proj-visible').checked : true,
            partageReseaux: currentProjectWasShared || triggerWebhook
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

            let finalProjectId = currentEditId;
            if (currentEditId) { await updateDoc(doc(db, "projects", currentEditId), projectData); UI.showToast("Projet mis à jour !"); } 
            else { projectData.ordreAffichage = Date.now(); const newDocRef = await addDoc(collection(db, "projects"), projectData); finalProjectId = newDocRef.id; UI.showToast("Projet publié !"); }

            if (triggerWebhook) {
                let finalSocialImageUrl = projectData.imageAffiche; 
                const sourceForCrop = optimizedImageBlob || currentEditImageUrl;
                
                // 1. TENTATIVE DE DÉCOUPE INSTAGRAM
                if (sourceForCrop) {
                    try {
                        btnSave.textContent = "Génération Instagram...";
                        const cropX = document.getElementById('proj-focus-social-x') ? document.getElementById('proj-focus-social-x').value : 50;
                        const cropY = document.getElementById('proj-focus-social-y') ? document.getElementById('proj-focus-social-y').value : 50;
                        
                        const socialBlob = await generateSocialCropBlob(sourceForCrop, cropX, cropY);
                        const safeTitle = title.replace(/\s+/g, '-').toLowerCase();
                        const socialRef = ref(storage, `affiches_social/${Date.now()}_${safeTitle}_ig.jpg`);
                        await uploadBytes(socialRef, socialBlob);
                        finalSocialImageUrl = await getDownloadURL(socialRef);
                    } catch (e) {
                        console.warn("Échec de la découpe (Sécurité Firebase), envoi de l'image classique au robot.", e);
                        // On garde l'image de base sans faire planter le script
                    }
                }

                // 2. ENVOI AU WEBHOOK MAKE (GARANTI)
                try {
                    btnSave.textContent = "Envoi à Make...";
                    const webhookUrl = "https://hook.eu1.make.com/03eq4k1s3oececcv4xvxqqh24g2pf513"; 
                    await fetch(webhookUrl, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            id: finalProjectId, 
                            titre: projectData.titre, 
                            statut: projectData.statut, 
                            synopsis: projectData.synopsis,
                            imageAffiche: projectData.imageAffiche,
                            imageSocial: finalSocialImageUrl 
                        })
                    });
                    console.log("Le signal a bien été envoyé au robot !");
                } catch(e) { 
                    console.error("Erreur de connexion avec Make", e); 
                }
            }

            loadAdminProjects(); returnToListView(); 
        } catch (error) { UI.showToast("Erreur.", "error"); } finally { btnSave.disabled = false; btnSave.textContent = currentEditId ? "Mettre à jour" : "Enregistrer le projet"; }
    });
}

async function loadAdminProjects() {
    const projectList = document.getElementById('project-list'); if (!projectList) return;
    try {
        const querySnapshot = await getDocs(collection(db, "projects"));
        let projects = []; querySnapshot.forEach((doc) => { projects.push({ id: doc.id, ...doc.data() }); });
        projects.sort((a, b) => b.ordreAffichage - a.ordreAffichage); projectList.innerHTML = '';

        projects.forEach(project => {
            const li = document.createElement('li'); li.className = 'sortable-item'; li.dataset.id = project.id; li.setAttribute('draggable', 'true');
            const focus = project.imageFocusBento || project.imageFocus || '50% 50%';
            const isHidden = project.visible === false;
            const hiddenBadge = isHidden ? '<span style="background: #333; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; margin-left: 10px; border: 1px solid #555; vertical-align: middle;">MASQUÉ</span>' : '';
            const isChecked = isHidden ? '' : 'checked';
            const titleStatus = isHidden ? 'Afficher' : 'Masquer';

            li.innerHTML = `
                <div class="drag-handle">☰</div>
                <img src="${project.imageAffiche}" class="item-thumb anti-stretch-img" style="object-position: ${focus}; object-fit: cover !important;" onload="this.classList.add('loaded')">
                <div class="item-info"><strong>${project.titre} ${hiddenBadge}</strong><span>${project.statut}</span></div>
                <div class="item-actions" style="display: flex; align-items: center; gap: 12px;">
                    <label class="toggle-switch" title="${titleStatus}">
                        <input type="checkbox" class="toggle-visibility-slider" ${isChecked}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn-icon edit" title="Modifier">✎</button>
                    <button class="btn-icon delete" title="Supprimer">✕</button>
                </div>`;

            li.querySelector('.toggle-visibility-slider').addEventListener('change', async (e) => {
                const newVis = e.target.checked;
                try { await updateDoc(doc(db, "projects", project.id), { visible: newVis }); UI.showToast(newVis ? "En ligne !" : "Masqué !"); loadAdminProjects(); } 
                catch (err) { UI.showToast("Erreur.", "error"); e.target.checked = !newVis; }
            });

            li.querySelector('.delete').addEventListener('click', async () => { if(confirm(`Supprimer "${project.titre}" ?`)) { await deleteDoc(doc(db, "projects", project.id)); loadAdminProjects(); } });

            li.querySelector('.edit').addEventListener('click', () => {
                resetProjectForm(); document.getElementById('view-list').classList.add('hidden'); document.getElementById('view-form').classList.remove('hidden');
                const btnAddNew = document.getElementById('btn-add-new'); if (btnAddNew) btnAddNew.style.display = 'none';

                document.getElementById('proj-title').value = project.titre || ''; document.getElementById('proj-subtitle').value = project.statut || ''; document.getElementById('proj-video').value = project.videoTrailer || '';
                if(document.getElementById('proj-genre')) document.getElementById('proj-genre').value = project.genre || '';
                if(document.getElementById('proj-annee')) document.getElementById('proj-annee').value = project.annee || '';
                if(document.getElementById('proj-realisateur')) document.getElementById('proj-realisateur').value = project.realisateur || '';
                if(document.getElementById('proj-casting')) document.getElementById('proj-casting').value = project.casting || '';
                if(document.getElementById('proj-synopsis')) document.getElementById('proj-synopsis').value = project.synopsis || '';
                if(document.getElementById('proj-format')) document.getElementById('proj-format').value = project.formatAffichage || '';
                if(document.getElementById('proj-visible')) document.getElementById('proj-visible').checked = project.visible !== false; 
                if(document.getElementById('proj-autoshare')) document.getElementById('proj-autoshare').checked = project.partageReseaux === true;
                if(document.getElementById('social-crop-zone')) document.getElementById('social-crop-zone').style.display = (project.partageReseaux === true) ? 'block' : 'none';

                currentProjectWasShared = (project.partageReseaux === true);

                const bentoPos = parsePosition(project.imageFocusBento || project.imageFocus);
                document.getElementById('proj-focus-bento-x').value = bentoPos.x; document.getElementById('proj-focus-bento-y').value = bentoPos.y;
                const headerPos = parsePosition(project.imageFocusHeader || project.imageFocus);
                document.getElementById('proj-focus-header-x').value = headerPos.x; document.getElementById('proj-focus-header-y').value = headerPos.y;
                const socialPos = parsePosition(project.imageFocusSocial || '50% 50%');
                document.getElementById('proj-focus-social-x').value = socialPos.x; document.getElementById('proj-focus-social-y').value = socialPos.y;

                if (project.imageAffiche) {
                    const pB = document.getElementById('image-preview-bloc'); 
                    const pC = document.getElementById('image-preview-cadrage'); 
                    const pS = document.getElementById('image-preview-social'); 
                    
                    if (pB) { pB.classList.remove('loaded'); pB.src = project.imageAffiche; }
                    if (pC) { pC.classList.remove('loaded'); pC.src = project.imageAffiche; }
                    if (pS) { 
                        pS.classList.remove('loaded'); 
                        pS.src = project.imageAffiche; 
                        setTimeout(() => { if (pS.complete) pS.classList.add('loaded'); }, 50);
                    }
                    syncBentoDA(); 
                }

                currentEditId = project.id; currentEditImageUrl = project.imageAffiche; optimizedImageBlob = null;
                document.getElementById('form-title').textContent = `Modifier : ${project.titre}`; document.getElementById('btn-save').textContent = "Mettre à jour";
                document.querySelector('#view-form').scrollIntoView({ behavior: 'smooth' });
            });
            projectList.appendChild(li);
        });
        setupDragAndDrop('project-list', 'projects');
        setTimeout(() => { document.querySelectorAll('#project-list .anti-stretch-img').forEach(img => { if (img.complete) img.classList.add('loaded'); }); }, 50);
    } catch (error) {}
}

// =========================================
// 9. MOTEUR D'ADMINISTRATION : ÉQUIPE
// =========================================
function setupTeamDropzone() {
    const dropzone = document.getElementById('team-dropzone'); if (!dropzone) return;
    const fileInput = document.getElementById('team-image'); const preview = document.getElementById('team-preview');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => { dropzone.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false); });
    dropzone.addEventListener('click', () => fileInput.click()); dropzone.addEventListener('drop', (e) => handleTeamFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', function() { if (this.files.length) handleTeamFile(this.files[0]); });

    function handleTeamFile(file) {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'); let width = img.width, height = img.height; if (width > 800) { height *= 800 / width; width = 800; }
                canvas.width = width; canvas.height = height; canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => { teamOptimizedImageBlob = blob; preview.classList.remove('loaded'); preview.src = URL.createObjectURL(blob); }, 'image/webp', 0.8);
            };
        };
    }
}

function returnToTeamList() { document.getElementById('view-team-list').classList.remove('hidden'); document.getElementById('view-team-form').classList.add('hidden'); const btnAddNew = document.getElementById('btn-add-new'); if (btnAddNew) btnAddNew.style.display = 'block'; resetTeamForm(); }
function resetTeamForm() { const form = document.getElementById('team-form'); if(!form) return; form.reset(); const tPrev = document.getElementById('team-preview'); tPrev.classList.remove('loaded'); tPrev.src = DEFAULT_AVATAR; document.getElementById('team-form-title').textContent = "Ajouter un membre"; document.getElementById('btn-save-team').textContent = "Enregistrer"; teamOptimizedImageBlob = null; currentTeamEditId = null; currentTeamImageUrl = null; }

function setupTeamForm() {
    const form = document.getElementById('team-form'); if (!form) return;
    const btnCancelTop = document.querySelector('.btn-cancel-team-top'); const btnCancelBottom = form.querySelector('.btn-cancel-team-bottom');
    if (btnCancelTop) btnCancelTop.addEventListener('click', returnToTeamList); if (btnCancelBottom) btnCancelBottom.addEventListener('click', returnToTeamList);

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); const nom = document.getElementById('team-name').value.trim(); const btnSave = document.getElementById('btn-save-team');
        const teamData = { nom: nom, role: document.getElementById('team-role').value.trim() };
        btnSave.textContent = "Enregistrement..."; btnSave.disabled = true;

        try {
            let imageUrl = currentTeamImageUrl || DEFAULT_AVATAR; 
            if (teamOptimizedImageBlob) { const safeName = nom.replace(/\s+/g, '-').toLowerCase(); const imageRef = ref(storage, `equipe/${Date.now()}_${safeName}.webp`); await uploadBytes(imageRef, teamOptimizedImageBlob); imageUrl = await getDownloadURL(imageRef); }
            teamData.photo = imageUrl;
            if (currentTeamEditId) { await updateDoc(doc(db, "team", currentTeamEditId), teamData); UI.showToast("Membre mis à jour !"); } 
            else { teamData.ordreAffichage = Date.now(); await addDoc(collection(db, "team"), teamData); UI.showToast("Membre ajouté !"); }
            loadAdminTeam(); returnToTeamList(); 
        } catch (error) { UI.showToast("Erreur.", "error"); } finally { btnSave.disabled = false; }
    });
}

async function loadAdminTeam() {
    const teamList = document.getElementById('team-list'); if (!teamList) return;
    try {
        const querySnapshot = await getDocs(collection(db, "team")); let members = []; querySnapshot.forEach((doc) => { members.push({ id: doc.id, ...doc.data() }); });
        members.sort((a, b) => b.ordreAffichage - a.ordreAffichage); teamList.innerHTML = '';
        members.forEach(member => {
            const li = document.createElement('li'); li.className = 'sortable-item'; li.dataset.id = member.id; li.setAttribute('draggable', 'true');
            const avatar = member.photo || DEFAULT_AVATAR; 
            li.innerHTML = `<div class="drag-handle">☰</div><img src="${avatar}" class="item-thumb anti-stretch-img" style="border-radius: 50%; object-fit: cover !important;" onload="this.classList.add('loaded')"><div class="item-info"><strong>${member.nom}</strong><span>${member.role}</span></div><div class="item-actions"><button class="btn-icon edit" title="Modifier">✎</button><button class="btn-icon delete" title="Supprimer">✕</button></div>`;
            li.querySelector('.delete').addEventListener('click', async () => { if(confirm(`Supprimer "${member.nom}" ?`)) { await deleteDoc(doc(db, "team", member.id)); loadAdminTeam(); } });
            li.querySelector('.edit').addEventListener('click', () => {
                resetTeamForm(); document.getElementById('view-team-list').classList.add('hidden'); document.getElementById('view-team-form').classList.remove('hidden');
                const btnAddNew = document.getElementById('btn-add-new'); if (btnAddNew) btnAddNew.style.display = 'none';
                document.getElementById('team-name').value = member.nom || ''; document.getElementById('team-role').value = member.role || '';
                const tPrev = document.getElementById('team-preview'); tPrev.classList.remove('loaded'); tPrev.src = avatar;
                currentTeamEditId = member.id; currentTeamImageUrl = member.photo; teamOptimizedImageBlob = null;
                document.getElementById('team-form-title').textContent = `Modifier : ${member.nom}`; document.getElementById('btn-save-team').textContent = "Mettre à jour"; document.querySelector('#view-team-form').scrollIntoView({ behavior: 'smooth' });
            });
            teamList.appendChild(li);
        });
        setupDragAndDrop('team-list', 'team');
        setTimeout(() => { document.querySelectorAll('#team-list .anti-stretch-img').forEach(img => { if (img.complete) img.classList.add('loaded'); }); }, 50);
    } catch (error) {}
}

// =========================================
// 10. DRAG & DROP GÉNÉRIQUE (PC & TACTILE)
// =========================================
function setupDragAndDrop(listId, collectionName) {
    const list = document.getElementById(listId); if (!list) return; const items = list.querySelectorAll('.sortable-item');
    async function saveOrder() {
        const currentItems = list.querySelectorAll('.sortable-item'); document.body.style.cursor = 'wait';
        try { const promises = []; currentItems.forEach((item, index) => { const newOrder = Date.now() - (index * 1000); promises.push(updateDoc(doc(db, collectionName, item.dataset.id), { ordreAffichage: newOrder })); }); await Promise.all(promises); UI.showToast("Ordre sauvegardé !"); } catch (error) {} finally { document.body.style.cursor = 'default'; }
    }
    items.forEach(item => {
        const handle = item.querySelector('.drag-handle');
        handle.addEventListener('mousedown', () => item.setAttribute('draggable', 'true')); handle.addEventListener('mouseup', () => item.removeAttribute('draggable')); handle.addEventListener('mouseleave', () => item.removeAttribute('draggable'));
        item.addEventListener('dragstart', (e) => { if(e.target.tagName === 'BUTTON') return; setTimeout(() => item.classList.add('dragging'), 0); });
        item.addEventListener('dragend', async () => { item.classList.remove('dragging'); item.removeAttribute('draggable'); await saveOrder(); });
        handle.addEventListener('touchstart', (e) => { document.body.style.overflow = 'hidden'; item.classList.add('dragging'); }, { passive: false });
        handle.addEventListener('touchmove', (e) => {
            e.preventDefault(); const draggingItem = list.querySelector('.dragging'); if (!draggingItem) return; const touch = e.touches[0]; draggingItem.style.display = 'none';
            const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY); draggingItem.style.display = ''; 
            if (elementUnderFinger) { const sibling = elementUnderFinger.closest('.sortable-item'); if (sibling && sibling !== draggingItem && sibling.parentElement === list) { const bounding = sibling.getBoundingClientRect(); if (touch.clientY > bounding.top + (bounding.height / 2)) sibling.after(draggingItem); else sibling.before(draggingItem); } }
        }, { passive: false });
        handle.addEventListener('touchend', async () => { document.body.style.overflow = ''; item.classList.remove('dragging'); await saveOrder(); });
    });
    list.addEventListener('dragover', (e) => { e.preventDefault(); const draggingItem = list.querySelector('.dragging'); if (!draggingItem) return; const siblings = [...list.querySelectorAll('.sortable-item:not(.dragging)')]; let nextSibling = siblings.find(sibling => e.clientY <= sibling.getBoundingClientRect().top + sibling.offsetHeight / 2); list.insertBefore(draggingItem, nextSibling); });
}

// =========================================
// 11. PARAMÈTRES : VIDÉO D'ACCUEIL
// =========================================
function setupHomeVideo() {
    const form = document.getElementById('home-video-form'); const btnSave = document.getElementById('btn-save-video'); const fileInput = document.getElementById('home-video-file'); if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); const file = fileInput.files[0]; if (!file) { UI.showToast("Sélectionnez une vidéo.", "error"); return; }
        btnSave.textContent = "Upload en cours..."; btnSave.disabled = true;
        try { const videoRef = ref(storage, `site-assets/background.mp4`); await uploadBytes(videoRef, file); const videoUrl = await getDownloadURL(videoRef); await setDoc(doc(db, "settings", "homepage"), { backgroundVideo: videoUrl }, { merge: true }); UI.showToast("Vidéo mise à jour !"); form.reset(); } 
        catch (error) {} finally { btnSave.textContent = "Mettre à jour la vidéo"; btnSave.disabled = false; }
    });
}

// =========================================
// 12. SÉCURITÉ : TRANSITIONS DE PAGE
// =========================================
document.addEventListener('click', (e) => {
    const link = e.target.closest('a'); if (!link || !link.href) return; const href = link.getAttribute('href');
    if (href.startsWith('#') || href.startsWith('mailto:') || link.target === '_blank') return;
    const transition = document.querySelector('.page-transition');
    if (transition) { e.preventDefault(); transition.classList.add('active'); setTimeout(() => { window.location.href = link.href; }, 500); }
});





