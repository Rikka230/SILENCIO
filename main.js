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
// 3. MOTEUR DE DÉCOUPE JPG (INSTAGRAM & LINKEDIN)
// =========================================
async function generateSocialCropBlob(sourceUrlOrBlob, focusX, focusY) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 1350; // Format 4:5
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
                if (blob) resolve(blob);
                else reject("Erreur lors de la conversion en JPG");
            }, 'image/jpeg', 0.9);
        };
        
        img.onerror = () => reject("Impossible de charger l'image pour la découpe");

        // Si c'est une nouvelle image, on la lit directement. Si c'est une ancienne de Firebase, on utilise un Proxy
        if (sourceUrlOrBlob instanceof Blob) {
            img.src = URL.createObjectURL(sourceUrlOrBlob);
        } else {
            img.src = "https://api.allorigins.win/raw?url=" + encodeURIComponent(sourceUrlOrBlob);
        }
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
    
    // --- CHARGEMENT DES PARAMÈTRES ---
    try {
        const settingsRef = doc(db, "settings", "homepage");
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists() && settingsSnap.data().backgroundVideo) {
            const heroVideo = document.querySelector('.hero-video');
            if (heroVideo) { heroVideo.src = settingsSnap.data().backgroundVideo; heroVideo.load(); }
        }
        
        const aproposSnap = await getDoc(doc(db, "settings", "apropos"));
        if (aproposSnap.exists() && aproposSnap.data().texte) {
            const textEl = document.getElementById('dyn-apropos');
            if (textEl) textEl.innerHTML = aproposSnap.data().texte.replace(/\n/g, '<br>');
        }

        const contactSnap = await getDoc(doc(db, "settings", "contact"));
        if (contactSnap.exists()) {
            const c = contactSnap.data();
            if (c.email) {
                const emailEl = document.getElementById('dyn-contact-email');
                if (emailEl) { emailEl.textContent = c.email; emailEl.href = "mailto:" + c.email; }
            }
            const phoneWrapper = document.getElementById('dyn-contact-phone-wrapper');
            const phoneEl = document.getElementById('dyn-contact-phone');
            const emailWrapper = document.getElementById('dyn-contact-email-wrapper');
            if (c.phone && c.phoneVisible !== false) {
                if (phoneWrapper && phoneEl) {
                    phoneEl.textContent = c.phone; phoneEl.href = "tel:" + c.phone.replace(/\s+/g, '');
                    phoneWrapper.style.display = 'block'; if (emailWrapper) emailWrapper.style.marginBottom = '0.5rem';
                }
            } else {
                if (phoneWrapper) phoneWrapper.style.display = 'none'; if (emailWrapper) emailWrapper.style.marginBottom = '2rem';
            }
            const setupSocial = (id, url) => { const el = document.getElementById(id); if (el) { if (url && url.trim() !== '') { el.href = url; el.style.display = 'inline-block'; } else { el.style.display = 'none'; } } };
            setupSocial('dyn-link-ig', c.instagram); setupSocial('dyn-link-fb', c.facebook); setupSocial('dyn-link-li', c.linkedin); setupSocial('dyn-link-yt', c.youtube);
        }
        setTimeout(() => { document.querySelectorAll('.anti-stretch-img').forEach(img => { if (img.complete) img.classList.add('loaded'); }); }, 50);
    } catch (error) {}
    
    // --- CHARGEMENT DES PROJETS ET GRILLE BENTO INTELLIGENTE ---
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

            let totalCells = 0; 
            let hasTallOrBig = false; 

            projects.forEach((project) => {
                const extraClass = project.formatAffichage || '';
                if (extraClass === 'bento-big') { totalCells += 4; hasTallOrBig = true; }
                else if (extraClass === 'bento-tall' || extraClass === 'bento-wide') { totalCells += 2; hasTallOrBig = true; }
                else { totalCells += 1; }
            });

            const isMobile = window.innerWidth <= 1024;
            const useScrollMode = isMobile ? projects.length > 6 : totalCells > 12;
            
            let itemsHTML = '';
            let gridRows = 1; 
            let gridCols = 4;

            if (projects.length === 0) {
                itemsHTML = `<div class="bento-item bento-big silencio-placeholder" style="display: flex; align-items: center; justify-content: center; background: #050505; border: 1px solid rgba(255,255,255,0.02); pointer-events: none;"><span style="color: var(--color-accent); opacity: 0.4; font-size: 2rem; font-weight: 400; letter-spacing: 6px;">SILENCIO</span></div>`;
            } else if (projects.length > 0) {
                
                // ALGORITHME DE PACKING ABSOLU (Positionnement exact, Centrage de la dernière ligne)
                let gridMap = [];
                let mode = useScrollMode ? 'scroll' : 'static';
                let fixedCount;
                
                if (mode === 'scroll') {
                    fixedCount = isMobile ? 2 : 3;
                } else {
                    if (isMobile) {
                        fixedCount = 2;
                    } else {
                        if (totalCells <= 2 && !hasTallOrBig) fixedCount = Math.max(1, totalCells);
                        else if (totalCells <= 4) fixedCount = 2;
                        else if (totalCells <= 6) fixedCount = 3;
                        else fixedCount = 4;
                    }
                }

                function isFree(x, y, w, h) {
                    for (let dy = 0; dy < h; dy++) {
                        for (let dx = 0; dx < w; dx++) {
                            if (gridMap[y + dy] && gridMap[y + dy][x + dx]) return false;
                        }
                    }
                    return true;
                }

                function mark(x, y, w, h) {
                    for (let dy = 0; dy < h; dy++) {
                        if (!gridMap[y + dy]) gridMap[y + dy] = [];
                        for (let dx = 0; dx < w; dx++) {
                            gridMap[y + dy][x + dx] = true;
                        }
                    }
                }

                let maxCol = 0, maxRow = 0;
                let placedProjects = [];

                projects.forEach(p => {
                    let w = 1, h = 1;
                    const format = p.formatAffichage || '';
                    if (format === 'bento-big') { w = 2; h = 2; }
                    else if (format === 'bento-tall') { w = 1; h = 2; }
                    else if (format === 'bento-wide') { w = 2; h = 1; }
                    
                    let placed = false; let y = 0, x = 0;
                    
                    if (mode === 'static') {
                        while (!placed) {
                            if (x + w <= fixedCount && isFree(x, y, w, h)) { 
                                mark(x, y, w, h); 
                                maxRow = Math.max(maxRow, y + h); 
                                placedProjects.push({...p, gridX: x, gridY: y, w, h});
                                placed = true; 
                            } else { 
                                x++; if (x + w > fixedCount) { x = 0; y++; } 
                            }
                        }
                    } else {
                        while (!placed) {
                            if (y + h <= fixedCount && isFree(x, y, w, h)) { 
                                mark(x, y, w, h); 
                                maxCol = Math.max(maxCol, x + w); 
                                placedProjects.push({...p, gridX: x, gridY: y, w, h});
                                placed = true; 
                            } else { 
                                y++; if (y + h > fixedCount) { y = 0; x++; } 
                            }
                        }
                    }
                });

                // CENTRAGE MAGIQUE DE LA DERNIÈRE LIGNE (Mode Statique uniquement)
                if (mode === 'static' && maxRow > 0) {
                    let clearLastRow = true;
                    let lastRowItems = [];
                    let usedCellsLastRow = 0;

                    // On regarde quels projets sont posés sur la toute dernière ligne
                    placedProjects.forEach(p => {
                        if (p.gridY + p.h - 1 === maxRow - 1) {
                            lastRowItems.push(p);
                            usedCellsLastRow += p.w;
                            // Si un élément "tall" ou "big" déborde depuis le haut, on annule le centrage par sécurité
                            if (p.gridY < maxRow - 1) clearLastRow = false;
                        }
                    });

                    // Si la ligne n'est pas pleine, on calcule l'écart et on pousse les blocs au centre !
                    if (clearLastRow && usedCellsLastRow < fixedCount) {
                        let shift = Math.floor((fixedCount - usedCellsLastRow) / 2);
                        if (shift > 0) {
                            lastRowItems.forEach(p => { for(let i=0; i<p.w; i++) gridMap[p.gridY][p.gridX + i] = false; });
                            lastRowItems.forEach(p => {
                                p.gridX += shift;
                                for(let i=0; i<p.w; i++) gridMap[p.gridY][p.gridX + i] = true;
                            });
                        }
                    }
                }

                // GÉNÉRATION HTML DES PROJETS (Avec leurs coordonnées exactes)
                let finalHTML = '';
                placedProjects.forEach(p => {
                    const extraClass = p.formatAffichage || '';
                    const focus = p.imageFocusBento || p.imageFocus || '50% 50%';
                    finalHTML += `<a href="projet.html?id=${p.id}" class="bento-item ${extraClass}" style="grid-column: ${p.gridX + 1} / span ${p.w}; grid-row: ${p.gridY + 1} / span ${p.h};"><img src="${p.imageAffiche}" alt="${p.titre}" loading="lazy" class="anti-stretch-img" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover !important; object-position: ${focus} !important;" onload="this.classList.add('loaded')"><div class="bento-overlay"><h3>${p.titre.toUpperCase()}</h3><p>${p.statut || p.genre || ''}</p></div></a>`;
                });

                // GÉNÉRATION DES BLOCS SILENCIO (Uniquement pour les trous "coincés" à l'intérieur de la grille)
                if (mode === 'static') {
                    for (let y = 0; y < maxRow; y++) {
                        let firstOccupiedX = 0;
                        let lastOccupiedX = fixedCount - 1;
                        
                        // Sur la dernière ligne, on ignore les trous à gauche et à droite !
                        if (y === maxRow - 1) {
                            while (lastOccupiedX >= 0 && (!gridMap[y] || !gridMap[y][lastOccupiedX])) lastOccupiedX--;
                            while (firstOccupiedX <= lastOccupiedX && (!gridMap[y] || !gridMap[y][firstOccupiedX])) firstOccupiedX++;
                        }
                        
                        for (let x = firstOccupiedX; x <= lastOccupiedX; x++) {
                            if (!gridMap[y] || !gridMap[y][x]) {
                                finalHTML += `<div class="bento-item silencio-placeholder" style="grid-column: ${x + 1} / span 1; grid-row: ${y + 1} / span 1; display: flex; align-items: center; justify-content: center; background: #050505; border: 1px solid rgba(255,255,255,0.02); pointer-events: none;"><span style="color: var(--color-accent); opacity: 0.4; font-size: 1.5rem; font-weight: 400; letter-spacing: 4px;">SILENCIO</span></div>`;
                            }
                        }
                    }
                    gridRows = maxRow; gridCols = fixedCount;
                } else {
                    for (let x = 0; x < maxCol; x++) {
                        let lastOccupiedY = fixedCount - 1;
                        if (x === maxCol - 1) {
                            while(lastOccupiedY >= 0 && (!gridMap[lastOccupiedY] || !gridMap[lastOccupiedY][x])) lastOccupiedY--;
                        }
                        for (let y = 0; y <= lastOccupiedY; y++) {
                            if (!gridMap[y] || !gridMap[y][x]) {
                                finalHTML += `<div class="bento-item silencio-placeholder" style="grid-column: ${x + 1} / span 1; grid-row: ${y + 1} / span 1; display: flex; align-items: center; justify-content: center; background: #050505; border: 1px solid rgba(255,255,255,0.02); pointer-events: none;"><span style="color: var(--color-accent); opacity: 0.4; font-size: 1.5rem; font-weight: 400; letter-spacing: 4px;">SILENCIO</span></div>`;
                            }
                        }
                    }
                    gridRows = fixedCount; gridCols = maxCol;
                }
                itemsHTML = finalHTML;
            }

            // --- RENDU DANS LE DOM ---
            const wrapper = document.createElement('div'); 
            const grid = document.createElement('div');
            
            if (!useScrollMode) {
                wrapper.className = 'bento-wrapper is-static'; 
                grid.className = 'bento-grid is-static';
                
                if (projects.length <= 1 && !hasTallOrBig) { 
                    grid.classList.add('is-single-item'); 
                } else { 
                    grid.style.setProperty('grid-template-columns', `repeat(${gridCols}, var(--cell-size))`, 'important'); 
                    grid.style.setProperty('grid-template-rows', `repeat(${gridRows}, var(--cell-size))`, 'important'); 
                }
                grid.innerHTML = itemsHTML; 
                wrapper.appendChild(grid); 
                bentoContainer.appendChild(wrapper);
            } else {
                wrapper.className = 'bento-wrapper is-scrollable'; 
                const track = document.createElement('div'); track.className = 'bento-track';
                
                const grid1 = document.createElement('div'); grid1.className = 'bento-grid is-scrollable'; grid1.innerHTML = itemsHTML;
                grid1.style.setProperty('grid-template-rows', `repeat(${gridRows}, var(--cell-size))`, 'important');
                
                const grid2 = document.createElement('div'); grid2.className = 'bento-grid is-scrollable'; grid2.innerHTML = itemsHTML;
                grid2.style.setProperty('grid-template-rows', `repeat(${gridRows}, var(--cell-size))`, 'important');
                
                const grid3 = document.createElement('div'); grid3.className = 'bento-grid is-scrollable'; grid3.innerHTML = itemsHTML;
                grid3.style.setProperty('grid-template-rows', `repeat(${gridRows}, var(--cell-size))`, 'important');
                
                track.appendChild(grid1); track.appendChild(grid2); track.appendChild(grid3); 
                wrapper.appendChild(track); bentoContainer.appendChild(wrapper);

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

    // L'EQUIPE
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
    
    // --- GESTION DES LIENS EXTERNES DU PROJET ---
    const linkContainer = document.getElementById('dyn-project-links');
    if (linkContainer) {
        linkContainer.innerHTML = ''; // On vide
        
        const addLink = (url, iconSvg, label) => {
            if (!url || url.trim() === '') return;
            const a = document.createElement('a');
            a.href = url;
            a.target = "_blank";
            a.className = "project-link-icon";
            a.title = label;
            a.innerHTML = iconSvg;
            linkContainer.appendChild(a);
        };

        // Icône Globe pour le Site Officiel
        addLink(data.linkSite, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`, "Site Officiel");
        
        // Icône Instagram
        addLink(data.linkInstagram, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>`, "Instagram");

        // Icône Facebook
        addLink(data.linkFacebook, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>`, "Facebook");
    }

    setTimeout(() => {
        const synopsisWrapper = document.getElementById('synopsis-wrapper');
        const dynSynopsis = document.getElementById('dyn-synopsis');
        const btnReadMore = document.getElementById('btn-read-more');
        const synopsisFade = document.getElementById('synopsis-fade');
        if (dynSynopsis && dynSynopsis.scrollHeight > 140) {
            if(btnReadMore) btnReadMore.classList.remove('hidden');
            btnReadMore.addEventListener('click', () => {
                const isExpanded = synopsisWrapper.classList.contains('is-expanded');
                if (!isExpanded) { synopsisWrapper.classList.add('is-expanded'); btnReadMore.textContent = 'Réduire'; } 
                else { synopsisWrapper.classList.remove('is-expanded'); btnReadMore.textContent = 'Lire la suite'; }
            });
        } else { if (synopsisFade) synopsisFade.style.display = 'none'; }
    }, 100);
    
    document.getElementById('dyn-realisateur').textContent = data.realisateur || '-';
    const castingCible = document.getElementById('dyn-casting');
    if (data.casting) castingCible.innerHTML = data.casting.split(',').map(nom => nom.trim()).join('<br>'); else castingCible.textContent = '-';
    
    document.getElementById('dyn-genre').textContent = data.genre || '-';
    document.getElementById('dyn-annee').textContent = data.annee || '-';
    const videoSection = document.getElementById('dyn-video-section');
    const videoIframe = document.getElementById('dyn-video-iframe');
    if (data.videoTrailer) { 
        videoIframe.src = data.videoTrailer.replace("watch?v=", "embed/"); 
        videoSection.style.display = 'block'; 
    } else { videoSection.style.display = 'none'; }
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
            setupApropos(); loadApropos();
            setupContact(); loadContact();
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

    const shareToggle = document.getElementById('proj-autoshare');
    const socialZone = document.getElementById('social-crop-zone');
    if (shareToggle && socialZone) {
        shareToggle.addEventListener('change', (e) => {
            const isVisible = e.target.checked;
            socialZone.style.display = isVisible ? 'block' : 'none';
            if (isVisible) { setTimeout(() => { syncBentoDA(); const pS = document.getElementById('image-preview-social'); if (pS) pS.classList.add('loaded'); }, 100); }
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
            
            if (target === 'projets') { 
                mainTitle.textContent = "Projets en Production"; 
                document.getElementById('view-list').classList.remove('hidden'); 
                if (btnAddNew) { btnAddNew.style.display = 'block'; btnAddNew.textContent = "+ Nouveau Projet"; } 
            } 
            else if (target === 'accueil') { 
                document.getElementById('panel-accueil').classList.remove('hidden'); 
                mainTitle.textContent = "Vidéo d'Accueil"; 
                if (btnAddNew) btnAddNew.style.display = 'none'; 
            } 
            else if (target === 'apropos') { 
                document.getElementById('panel-apropos').classList.remove('hidden'); 
                mainTitle.textContent = "À Propos (Texte de présentation)"; 
                if (btnAddNew) btnAddNew.style.display = 'none'; 
            } 
            else if (target === 'contact') { 
                document.getElementById('panel-contact').classList.remove('hidden'); 
                mainTitle.textContent = "Contact & Réseaux Sociaux"; 
                if (btnAddNew) btnAddNew.style.display = 'none'; 
            } 
            else if (target === 'equipe') { 
                mainTitle.textContent = "L'Équipe"; 
                document.getElementById('view-team-list').classList.remove('hidden'); 
                if (btnAddNew) { btnAddNew.style.display = 'block'; btnAddNew.textContent = "+ Nouveau Membre"; } 
            }
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

// --- 8.1 VISUALISATION DA ET BASCULE D'ÉCRAN ---
function syncBentoDA() {
    const previewBloc = document.getElementById('image-preview-bloc');
    const previewCadrage = document.getElementById('image-preview-cadrage');
    const previewSocial = document.getElementById('image-preview-social');
    const blocWrapper = document.getElementById('da-bloc-wrapper');
    const formatSelect = document.getElementById('proj-format');
    const dropText = document.querySelector('.drop-text'); 

    function updateLiveView() {
        if (!previewBloc || !previewBloc.getAttribute('src')) return;

        if (previewSocial && (!previewSocial.getAttribute('src'))) {
            previewSocial.src = previewBloc.src;
        }

        if (blocWrapper && formatSelect) {
            blocWrapper.className = '';
            if (formatSelect.value) blocWrapper.classList.add(formatSelect.value);
        }

        if (document.getElementById('proj-focus-bento-x')) {
            previewBloc.style.objectPosition = `${document.getElementById('proj-focus-bento-x').value}% ${document.getElementById('proj-focus-bento-y').value}%`;
        }
        if (previewCadrage && document.getElementById('proj-focus-header-x')) {
            previewCadrage.style.objectPosition = `${document.getElementById('proj-focus-header-x').value}% ${document.getElementById('proj-focus-header-y').value}%`;
        }
        if (previewSocial && document.getElementById('proj-focus-social-x')) {
            previewSocial.style.objectPosition = `${document.getElementById('proj-focus-social-x').value}% ${document.getElementById('proj-focus-social-y').value}%`;
        }
    }

    const inputs = ['proj-focus-bento-x', 'proj-focus-bento-y', 'proj-focus-header-x', 'proj-focus-header-y', 'proj-focus-social-x', 'proj-focus-social-y'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateLiveView);
    });
    if (formatSelect) formatSelect.addEventListener('change', updateLiveView);

    const daContainer = document.getElementById('image-da-container');
    const previewsGroup = document.getElementById('previews-group');
    
    // CORRECTION AFFICHAGE : Vérification en béton
    const src = previewBloc ? previewBloc.getAttribute('src') : null;
    const hasImage = src && src.trim() !== '' && !src.endsWith('admin.html') && src !== window.location.href;

    if (hasImage && daContainer && previewsGroup) {
        daContainer.classList.remove('da-container-single');
        daContainer.classList.add('da-container-split');
        if(dropText) dropText.style.display = 'none';
        previewsGroup.classList.remove('previews-hidden');
        previewsGroup.classList.add('previews-visible');
        updateLiveView();
    } else if (daContainer && previewsGroup) {
        daContainer.classList.remove('da-container-split');
        daContainer.classList.add('da-container-single');
        if(dropText) dropText.style.display = 'block';
        previewsGroup.classList.remove('previews-visible');
        previewsGroup.classList.add('previews-hidden');
    }
}

// --- 8.2 IMPORT D'IMAGE (DRAG & DROP) ---
function setupDropzone() {
    const dropzone = document.getElementById('image-dropzone');
    if (!dropzone) return;
    const fileInput = document.getElementById('proj-image');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
    });

    ['dragenter', 'dragover'].forEach(name => { dropzone.addEventListener(name, () => dropzone.classList.add('dragover')); });
    ['dragleave', 'drop'].forEach(name => { dropzone.addEventListener(name, () => dropzone.classList.remove('dragover')); });

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) { UI.showToast("Format invalide.", "error"); return; }
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
                    
                    if(pB) { pB.src = compressedUrl; pB.classList.remove('loaded'); }
                    if(pC) { pC.src = compressedUrl; pC.classList.remove('loaded'); }
                    if(pS) { pS.src = compressedUrl; pS.classList.remove('loaded'); }
                    
                    setTimeout(() => {
                        syncBentoDA(); 
                        if(pB) pB.classList.add('loaded');
                    }, 50);
                }, 'image/webp', 0.8);
            };
        };
    }
}

// --- 8.3 NAVIGATION ET RESET DU FORMULAIRE ---
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
    
    const inputs = ['proj-focus-bento-x', 'proj-focus-bento-y', 'proj-focus-header-x', 'proj-focus-header-y', 'proj-focus-social-x', 'proj-focus-social-y'];
    inputs.forEach(id => { if(document.getElementById(id)) document.getElementById(id).value = 50; });

    if(document.getElementById('proj-autoshare')) document.getElementById('proj-autoshare').checked = false;
    if(document.getElementById('social-crop-zone')) document.getElementById('social-crop-zone').style.display = 'none';

    const pB = document.getElementById('image-preview-bloc');
    const pC = document.getElementById('image-preview-cadrage');
    const pS = document.getElementById('image-preview-social');
    if (pB) { pB.removeAttribute('src'); pB.classList.remove('loaded'); }
    if (pC) { pC.removeAttribute('src'); pC.classList.remove('loaded'); }
    if (pS) { pS.removeAttribute('src'); pS.classList.remove('loaded'); }

    syncBentoDA(); 
    
    document.getElementById('form-title').textContent = "Ajouter un projet"; 
    document.getElementById('btn-save').textContent = "Enregistrer le projet";
    optimizedImageBlob = null; currentEditId = null; currentEditImageUrl = null; currentProjectWasShared = false;
}

// --- 8.4 SAUVEGARDE & WEBHOOK MAKE ---
function setupProjectForm() {
    const form = document.getElementById('project-form'); if (!form) return;
    const btnCancelTop = document.querySelector('.btn-cancel-top'); 
    const btnCancelBottom = form.querySelector('.btn-cancel-bottom');
    if (btnCancelTop) btnCancelTop.addEventListener('click', returnToListView); 
    if (btnCancelBottom) btnCancelBottom.addEventListener('click', returnToListView);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const autoShareCheckbox = document.getElementById('proj-autoshare');
        let triggerWebhook = false; 
        
        if (autoShareCheckbox && autoShareCheckbox.checked) {
            if (currentEditId && currentProjectWasShared) {
                if (confirm("⚠️ Déjà publié sur les réseaux. Forcer un doublon ?")) { triggerWebhook = true; } 
                else { triggerWebhook = false; autoShareCheckbox.checked = false; }
            } else {
                if (confirm("⚠️ Publier ce projet sur les réseaux sociaux ?")) { triggerWebhook = true; } else { return; }
            }
        }

        const title = document.getElementById('proj-title').value.trim();
        const btnSave = document.getElementById('btn-save');
        btnSave.textContent = "Upload de l'affiche principale..."; btnSave.disabled = true;

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

        if (!currentEditId && !optimizedImageBlob) { UI.showToast("Ajoutez une affiche.", "error"); btnSave.disabled = false; btnSave.textContent = "Enregistrer le projet"; return; }

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
            if (currentEditId) { 
                await updateDoc(doc(db, "projects", currentEditId), projectData); 
            } else { 
                projectData.ordreAffichage = Date.now(); 
                const newDocRef = await addDoc(collection(db, "projects"), projectData); 
                finalProjectId = newDocRef.id; 
            }

            // === LE BLOC CRITIQUE POUR LE JPG ET LINKEDIN ===
            if (triggerWebhook) {
                let finalSocialImageUrl = projectData.imageAffiche; 
                const sourceForCrop = optimizedImageBlob || currentEditImageUrl;
                
                if (sourceForCrop) {
                    try {
                        btnSave.textContent = "Création du fichier JPG...";
                        const cropX = document.getElementById('proj-focus-social-x').value;
                        const cropY = document.getElementById('proj-focus-social-y').value;
                        const socialBlob = await generateSocialCropBlob(sourceForCrop, cropX, cropY);
                        
                        btnSave.textContent = "Sauvegarde du JPG dans Firebase...";
                        const safeTitle = title.replace(/\s+/g, '-').toLowerCase();
                        const socialRef = ref(storage, `affiches_social/${Date.now()}_${safeTitle}.jpg`);
                        await uploadBytes(socialRef, socialBlob);
                        finalSocialImageUrl = await getDownloadURL(socialRef);
                        
                        btnSave.textContent = "Mise à jour de la base de données...";
                        // OBLIGATION D'ÉCRIRE LE CHAMP DANS LA BASE DE DONNÉES
                        await updateDoc(doc(db, "projects", finalProjectId), { 
                            imageSocial: finalSocialImageUrl 
                        });

                    } catch (e) { 
                        console.error("ERREUR CRITIQUE JPG :", e);
                        UI.showToast("Erreur : Impossible de créer le JPG", "error");
                        btnSave.disabled = false;
                        btnSave.textContent = "Réessayer l'enregistrement";
                        return; // ON STOPPE TOUT SI LE JPG N'EST PAS CRÉÉ
                    }
                }

                try {
                    btnSave.textContent = "Envoi à Make...";
                    const webhookUrl = "https://hook.eu1.make.com/03eq4k1s3oececcv4xvxqqh24g2pf513"; 
                    await fetch(webhookUrl, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...projectData, id: finalProjectId, imageSocial: finalSocialImageUrl })
                    });
                } catch(e) { console.error("Erreur Webhook", e); }
            }

            UI.showToast("Opération terminée avec succès !");
            loadAdminProjects(); returnToListView(); 
        } catch (error) { 
            UI.showToast("Erreur lors de l'enregistrement", "error"); 
        } finally { 
            btnSave.disabled = false; 
            btnSave.textContent = currentEditId ? "Mettre à jour" : "Enregistrer le projet"; 
        }
    });
}

// --- 8.5 LISTE DES PROJETS ET BOUTON EDIT ---
async function loadAdminProjects() {
    const projectList = document.getElementById('project-list'); if (!projectList) return;
    try {
        const querySnapshot = await getDocs(collection(db, "projects"));
        let projects = []; 
        querySnapshot.forEach((doc) => { projects.push({ id: doc.id, ...doc.data() }); });
        projects.sort((a, b) => b.ordreAffichage - a.ordreAffichage); 
        projectList.innerHTML = '';

        projects.forEach(project => {
            const li = document.createElement('li'); 
            li.className = 'sortable-item'; li.dataset.id = project.id; li.setAttribute('draggable', 'true');
            const focus = project.imageFocusBento || '50% 50%';
            const isHidden = project.visible === false;
            const hiddenBadge = isHidden ? '<span style="background: #333; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; margin-left: 10px; border: 1px solid #555; vertical-align: middle;">MASQUÉ</span>' : '';
            
            li.innerHTML = `
                <div class="drag-handle">☰</div>
                <img src="${project.imageAffiche}" class="item-thumb anti-stretch-img" style="object-position: ${focus}; object-fit: cover !important;" onload="this.classList.add('loaded')">
                <div class="item-info"><strong>${project.titre} ${hiddenBadge}</strong><span>${project.statut}</span></div>
                <div class="item-actions">
                    <label class="toggle-switch">
                        <input type="checkbox" class="toggle-visibility-slider" ${isHidden ? '' : 'checked'}>
                        <span class="slider"></span>
                    </label>
                    <button class="btn-icon edit" title="Modifier">✎</button>
                    <button class="btn-icon delete" title="Supprimer">✕</button>
                </div>`;

            li.querySelector('.toggle-visibility-slider').addEventListener('change', async (e) => {
                await updateDoc(doc(db, "projects", project.id), { visible: e.target.checked });
                loadAdminProjects();
            });

            li.querySelector('.delete').addEventListener('click', async () => {
                if(confirm(`Supprimer "${project.titre}" ?`)) { await deleteDoc(doc(db, "projects", project.id)); loadAdminProjects(); }
            });

            // CHARGEMENT DE L'ÉDITION
            li.querySelector('.edit').addEventListener('click', () => {
                resetProjectForm(); // On s'assure que tout est propre d'abord
                
                document.getElementById('view-list').classList.add('hidden');
                document.getElementById('view-form').classList.remove('hidden');
                if (document.getElementById('btn-add-new')) document.getElementById('btn-add-new').style.display = 'none';

                currentEditId = project.id;
                currentEditImageUrl = project.imageAffiche;
                
                document.getElementById('proj-title').value = project.titre || '';
                document.getElementById('proj-subtitle').value = project.statut || '';
                document.getElementById('proj-video').value = project.videoTrailer || '';
                if(document.getElementById('proj-genre')) document.getElementById('proj-genre').value = project.genre || '';
                if(document.getElementById('proj-annee')) document.getElementById('proj-annee').value = project.annee || '';
                if(document.getElementById('proj-realisateur')) document.getElementById('proj-realisateur').value = project.realisateur || '';
                if(document.getElementById('proj-casting')) document.getElementById('proj-casting').value = project.casting || '';
                if(document.getElementById('proj-synopsis')) document.getElementById('proj-synopsis').value = project.synopsis || '';
                if(document.getElementById('proj-format')) document.getElementById('proj-format').value = project.formatAffichage || '';
                
                const bPos = parsePosition(project.imageFocusBento || project.imageFocus || '50% 50%');
                document.getElementById('proj-focus-bento-x').value = bPos.x;
                document.getElementById('proj-focus-bento-y').value = bPos.y;

                const hPos = parsePosition(project.imageFocusHeader || project.imageFocus || '50% 50%');
                document.getElementById('proj-focus-header-x').value = hPos.x;
                document.getElementById('proj-focus-header-y').value = hPos.y;

                const sPos = parsePosition(project.imageFocusSocial || '50% 50%');
                document.getElementById('proj-focus-social-x').value = sPos.x;
                document.getElementById('proj-focus-social-y').value = sPos.y;

                if(document.getElementById('proj-visible')) document.getElementById('proj-visible').checked = project.visible !== false;

                const isShared = project.partageReseaux === true;
                if(document.getElementById('proj-autoshare')) document.getElementById('proj-autoshare').checked = isShared;
                if(document.getElementById('social-crop-zone')) document.getElementById('social-crop-zone').style.display = isShared ? 'block' : 'none';
                currentProjectWasShared = isShared;

                // Injection des images
                const pB = document.getElementById('image-preview-bloc');
                const pC = document.getElementById('image-preview-cadrage');
                const pS = document.getElementById('image-preview-social');
                
                if(pB) { pB.src = project.imageAffiche; pB.classList.add('loaded'); }
                if(pC) { pC.src = project.imageAffiche; pC.classList.add('loaded'); }
                if(pS) { pS.src = project.imageAffiche; if(isShared) pS.classList.add('loaded'); }

                document.getElementById('form-title').textContent = `Modifier : ${project.titre}`;
                document.getElementById('btn-save').textContent = "Mettre à jour";
                
                setTimeout(syncBentoDA, 100);
            });

            projectList.appendChild(li);
        });
        setupDragAndDrop('project-list', 'projects');
    } catch (error) { console.error("Erreur projets:", error); }
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

// =========================================
// 13. PARAMÈTRES : À PROPOS & CONTACT
// =========================================
async function loadApropos() {
    try {
        const snap = await getDoc(doc(db, "settings", "apropos"));
        if(snap.exists()) document.getElementById('apropos-text').value = snap.data().texte || '';
    } catch(e) {}
}

function setupApropos() {
    const form = document.getElementById('apropos-form');
    if(!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-apropos');
        btn.disabled = true; btn.textContent = "Enregistrement...";
        try {
            await setDoc(doc(db, "settings", "apropos"), { texte: document.getElementById('apropos-text').value }, { merge: true });
            UI.showToast("Texte mis à jour !");
        } catch(e) { UI.showToast("Erreur", "error"); }
        finally { btn.disabled = false; btn.textContent = "Mettre à jour le texte"; }
    });
}

async function loadContact() {
    try {
        const snap = await getDoc(doc(db, "settings", "contact"));
        if(snap.exists()) {
            const d = snap.data();
            document.getElementById('contact-email').value = d.email || '';
            document.getElementById('contact-phone').value = d.phone || '';
            document.getElementById('contact-phone-visible').checked = d.phoneVisible !== false;
            document.getElementById('contact-ig').value = d.instagram || '';
            document.getElementById('contact-li').value = d.linkedin || '';
            document.getElementById('contact-fb').value = d.facebook || '';
            document.getElementById('contact-yt').value = d.youtube || '';
        }
    } catch(e) {}
}

function setupContact() {
    const form = document.getElementById('contact-form');
    if(!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-contact');
        btn.disabled = true; btn.textContent = "Enregistrement...";
        try {
            await setDoc(doc(db, "settings", "contact"), {
                email: document.getElementById('contact-email').value,
                phone: document.getElementById('contact-phone').value,
                phoneVisible: document.getElementById('contact-phone-visible').checked,
                instagram: document.getElementById('contact-ig').value,
                linkedin: document.getElementById('contact-li').value,
                facebook: document.getElementById('contact-fb').value,
                youtube: document.getElementById('contact-yt').value
            }, { merge: true });
            UI.showToast("Contacts mis à jour !");
        } catch(e) { UI.showToast("Erreur", "error"); }
        finally { btn.disabled = false; btn.textContent = "Mettre à jour les contacts"; }
    });
}






















