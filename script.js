import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getFirestore, doc, setDoc, addDoc, updateDoc, collection, onSnapshot, serverTimestamp, runTransaction, increment } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDnSz2NJQZovT3WKjyak9IcVlfYbQBmlVM",
    authDomain: "chandan-saroj-portfolio.firebaseapp.com",
    projectId: "chandan-saroj-portfolio",
    storageBucket: "chandan-saroj-portfolio.firebasestorage.app",
    messagingSenderId: "673240575610",
    appId: "1:673240575610:web:c199ae38e28a41c33715c3",
    measurementId: "G-WVQXG2QM1T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const root = document.documentElement;

let currentUser = null;
let loadedPosts = {};
let currentTheme = { primary: '#00ff88', secondary: '#00ccff', font: "'Inter', sans-serif", mode: 'dark' };

const themeModes = {
    'dark': { '--dark': '#0a0a0a', '--darker': '#050505', '--card-bg': 'rgba(20, 20, 20, 0.7)', '--text-light': '#f0f0f0', '--text-gray': '#a0a0a0', '--border': 'rgba(255, 255, 255, 0.08)' },
    'light': { '--dark': '#ffffff', '--darker': '#f3f4f6', '--card-bg': 'rgba(255, 255, 255, 0.8)', '--text-light': '#111827', '--text-gray': '#4b5563', '--border': 'rgba(0, 0, 0, 0.1)' },
    'minimalist': { '--dark': '#f5f5f5', '--darker': '#eaeaea', '--card-bg': 'rgba(255, 255, 255, 0.6)', '--text-light': '#222', '--text-gray': '#666', '--border': 'rgba(0, 0, 0, 0.05)' },
    'vibrant': { '--dark': '#1a0033', '--darker': '#0d001a', '--card-bg': 'rgba(40, 0, 60, 0.6)', '--text-light': '#fff', '--text-gray': '#d1d5db', '--border': 'rgba(255, 0, 255, 0.2)' },
    'thematic': { '--dark': '#001a1a', '--darker': '#000d0d', '--card-bg': 'rgba(0, 40, 40, 0.6)', '--text-light': '#e0f7fa', '--text-gray': '#80deea', '--border': 'rgba(0, 255, 255, 0.15)' }
};

// --- AUTH ---
signInAnonymously(auth);
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        initListeners();
        incrementViewCount();
    }
});

function initListeners() {
    // Cloud Theme Listener
    onSnapshot(doc(db, "website_state", "global_theme"), (doc) => {
        if (doc.exists()) { 
            const data = doc.data();
            applyTheme(data); 
            currentTheme = data; 
            updateThemeUI(data); 
        }
    });

    // Hero Bubbles & Messages
    onSnapshot(collection(db, "messages"), (snapshot) => {
        const grid = document.getElementById('messagesGrid');
        const heroContainer = document.getElementById('heroMessages');
        if (grid) grid.innerHTML = '';
        if (heroContainer) heroContainer.innerHTML = '';

        let messages = [];
        snapshot.forEach(d => messages.push(d.data()));
        messages.sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        messages.slice(0, 20).forEach(msg => {
            const card = document.createElement('div');
            card.className = 'message-card';
            card.innerHTML = `<strong>${msg.name || 'Anonymous'}</strong><p>${msg.text}</p>`;
            if (grid) grid.appendChild(card);
        });

        messages.slice(0, 8).forEach(msg => {
            if(!heroContainer) return;
            const bubble = document.createElement('div');
            bubble.className = 'hero-msg-bubble';
            bubble.style.top = `${Math.random() * 70}%`;
            bubble.style.left = `${Math.random() * 70}%`;
            bubble.innerHTML = `<strong>${msg.name}</strong><p>${msg.text}</p>`;
            heroContainer.appendChild(bubble);
            if(window.Draggable) Draggable.create(bubble, { bounds: "body", inertia: true });
        });
    });

    // Blog Feed with Logic
    onSnapshot(collection(db, "blogs"), (snapshot) => {
        const blogGrid = document.getElementById('blog-feed');
        if (blogGrid) blogGrid.innerHTML = '';
        
        let posts = [];
        snapshot.forEach((docSnap) => {
            posts.push({ id: docSnap.id, ...docSnap.data() });
            loadedPosts[docSnap.id] = docSnap.data();
        });

        // Sort by newest first
        posts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        // Limit to latest 10 posts like Chandan
        posts = posts.slice(0, 10);

        if(posts.length === 0) {
            blogGrid.innerHTML = '<div style="text-align:center; width:100%; color:var(--text-gray);">No insights pushed yet.</div>';
            return;
        }

        posts.forEach((post) => {
            const card = document.createElement('div');
            card.className = 'blog-card';
            
            const score = post.score || 0;
            const date = post.timestamp ? new Date(post.timestamp.toDate()).toLocaleDateString() : 'Just now';
            const subTitle = post.subtitle ? `<div class="blog-subtitle">${post.subtitle}</div>` : '';
            const imageSection = (post.image && post.image.trim() !== '') 
            ? `<img src="${post.image.trim()}" class="blog-image" alt="Insight Visual" onerror="this.style.display='none'">` 
            : '';
            const previewText = stripHtml(post.content);

            card.innerHTML = `
                <div class="vote-section">
                    <button class="vote-btn" data-id="${post.id}" data-up="true"><i class="fas fa-arrow-up"></i></button>
                    <span class="vote-count">${score}</span>
                    <button class="vote-btn" data-id="${post.id}" data-up="false"><i class="fas fa-arrow-down"></i></button>
                </div>
                <div class="blog-content" onclick="openReadPost('${post.id}')">
                    <div class="blog-meta">
                        <span><i class="far fa-clock"></i> ${date}</span>
                    </div>
                    <h3 class="blog-title">${post.title}</h3>
                    ${subTitle}
                    ${imageSection}
                    <div class="blog-text-preview">${previewText}</div>
                </div>
            `;
            if (blogGrid) blogGrid.appendChild(card);
        });
        
        document.querySelectorAll('.vote-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                handleVote(btn.dataset.id, btn.dataset.up === 'true');
            }
        });
    });

    onSnapshot(doc(db, "stats", "likes"), (d) => {
        const el = document.getElementById('likeCount');
        if (el) el.innerText = d.data()?.count || 0;
    });
    onSnapshot(doc(db, "stats", "global_views"), (d) => {
        const el = document.getElementById('globalViewCount');
        if (el) el.innerText = d.data()?.count || 0;
    });
    // 5. Daily View Counter Listener
    const todayStr = new Date().toISOString().split('T')[0];
    const todayDocRef = doc(db, "page_views", todayStr);
    onSnapshot(todayDocRef, (docSnapshot) => {
        const val = docSnapshot.exists() ? docSnapshot.data().views : 0;
        const el = document.getElementById('todayViewCount');
        if(el) el.innerText = val;
    });
}

// --- CORE FUNCTIONS ---
function applyTheme(theme) {
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-dim', theme.primary + '1A');
    root.style.setProperty('--secondary', theme.secondary);
    root.style.setProperty('--font-main', theme.font);
    if(theme.mode && themeModes[theme.mode]) {
        const vars = themeModes[theme.mode];
        Object.keys(vars).forEach(k => root.style.setProperty(k, vars[k]));
    }
}

function updateThemeUI(theme) {
    // Primary Circles
    document.querySelectorAll('#primaryColors .color-circle').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === theme.primary);
    });
    // Secondary Circles
    document.querySelectorAll('#secondaryColors .color-circle').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === theme.secondary);
    });
    // Font Buttons
    document.querySelectorAll('.font-options .font-btn').forEach(btn => {
        if (btn.dataset.font) btn.classList.toggle('active', btn.dataset.font === theme.font);
    });
    // Mode Buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === theme.mode);
    });
}

async function handleVote(id, isUp) {
    try {
        await updateDoc(doc(db, "blogs", id), { score: increment(isUp ? 1 : -1) });
    } catch (e) { console.error("Vote failed", e); }
}

window.openReadPost = (id) => {
    const post = loadedPosts[id];
    const body = document.getElementById('readModalBody');
    if (body) body.innerHTML = `<h1>${post.title}</h1><div>${post.content}</div>`;
    document.getElementById('readPostModal').style.display = "flex";
};

// --- Close Read Post Modal Logic ---
const closeReadModalBtn = document.getElementById('closeReadModal');
const readPostModal = document.getElementById('readPostModal');

if (closeReadModalBtn) {
    closeReadModalBtn.onclick = () => {
        readPostModal.style.display = "none";
    };
}

// Update the global click listener to close BOTH modals if you click outside of them
window.addEventListener('click', (e) => { 
    const contactModal = document.getElementById('contactModal');
    if (e.target == contactModal) contactModal.style.display = "none"; 
    if (e.target == readPostModal) readPostModal.style.display = "none"; 
});

document.getElementById('saveThemeBtn').onclick = async () => {
    const btn = document.getElementById('saveThemeBtn');
    btn.innerText = "Saving Sync...";
    await setDoc(doc(db, "website_state", "global_theme"), currentTheme);
    btn.innerText = "Sync Complete!";
    setTimeout(() => btn.innerText = "Save to Cloud", 2000);
};

document.getElementById('createPostBtn').onclick = () => {
    document.getElementById('blogModal').style.display = "flex";
};

document.getElementById('closeBlogModal').onclick = () => {
    document.getElementById('blogModal').style.display = "none";
};

document.getElementById('postMsgBtn').onclick = async () => {
    const name = document.getElementById('msgName').value || "Anonymous";
    const text = document.getElementById('msgText').value;
    if(!text) return;
    await addDoc(collection(db, "messages"), { name, text, timestamp: serverTimestamp() });
    document.getElementById('msgText').value = '';
};

var quill = new Quill('#editor-container', { theme: 'snow' });
document.getElementById('submitPostBtn').onclick = async () => {
    if(document.getElementById('blogPassword').value !== "220919") return alert("Denied.");
    await addDoc(collection(db, "blogs"), {
        title: document.getElementById('blogTitle').value,
        content: quill.root.innerHTML,
        score: 0,
        timestamp: serverTimestamp()
    });
    document.getElementById('blogTitle').value = '';
    quill.setContents([]);
    document.getElementById('blogModal').style.display = "none";
};

document.querySelectorAll('.color-circle').forEach(c => {
    c.onclick = () => {
        const type = c.parentElement.id === 'primaryColors' ? 'primary' : 'secondary';
        currentTheme[type] = c.dataset.color;
        applyTheme(currentTheme);
        updateThemeUI(currentTheme);
    }
});

document.querySelectorAll('.mode-btn').forEach(b => {
    b.onclick = () => {
        currentTheme.mode = b.dataset.mode;
        applyTheme(currentTheme);
        updateThemeUI(currentTheme);
    }
});

document.querySelectorAll('.font-btn').forEach(f => {
    f.onclick = () => {
        currentTheme.font = f.dataset.font;
        applyTheme(currentTheme);
        updateThemeUI(currentTheme);
    }
});

async function incrementViewCount() {
    const today = new Date().toISOString().split('T')[0];
    const dailyRef = doc(db, "page_views", today);
    const globalRef = doc(db, "stats", "global_views");
    try {
        await runTransaction(db, async (transaction) => {
            const dDoc = await transaction.get(dailyRef);
            const gDoc = await transaction.get(globalRef);
            transaction.set(dailyRef, { views: (dDoc.exists() ? dDoc.data().views : 0) + 1 }, { merge: true });
            transaction.set(globalRef, { count: (gDoc.exists() ? gDoc.data().count : 0) + 1 }, { merge: true });
        });
    } catch (e) { console.warn("View counter skipped - Database initializing."); }
}

function stripHtml(html) {
    let t = document.createElement("DIV"); 
    // Adds a space before closing tags so words don't merge
    t.innerHTML = html.replace(/<\/(p|div|h\d|li)>/gi, ' </$1>'); 
    return t.textContent.trim() || t.innerText.trim() || "";
}

gsap.from("#header", { y: -100, duration: 1, ease: "bounce" });

// --- WhatsApp Modal Logic ---
const contactModal = document.getElementById('contactModal');
const whatsappBtn = document.getElementById('whatsappBtn');
const closeContactModal = document.getElementById('closeModal');

if (whatsappBtn) whatsappBtn.onclick = () => contactModal.style.display = "flex";
if (closeContactModal) closeContactModal.onclick = () => contactModal.style.display = "none";

// --- Main Contact Form Logic (Hooked to your WhatsApp) ---
const contactForm = document.getElementById("contactForm");
if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
        e.preventDefault(); // Stop page reload
        
        const btn = this.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = "Processing...";
        btn.disabled = true; // Prevent double clicks
        
        setTimeout(() => {
            // Grab values from your specific form fields
            const name = this.querySelector('[name="name"]').value;
            const subject = this.querySelector('[name="subject"]').value;
            const message = this.querySelector('[name="message"]').value;
            
            // Format the message for WhatsApp
            const waText = encodeURIComponent(`Hi Akash, I am ${name}. Subject: ${subject}.\n\nRequirements:\n${message}`);
            
            // Open WhatsApp with your specific number
            window.open(`https://wa.me/918112712037?text=${waText}`, '_blank');
            
            // UI Success State
            btn.innerText = "Connection Initiated!";
            btn.style.background = "#25D366";
            btn.style.color = "white";
            
            // Reset form and button after 3 seconds
            setTimeout(() => {
                this.reset();
                btn.innerText = originalText;
                btn.style.background = "";
                btn.style.color = "";
                btn.disabled = false;
            }, 3000);
        }, 800);
    });
}

// --- Theme Panel Toggle Logic ---
const themeBtn = document.getElementById('themeToggleBtn');
const themePanel = document.getElementById('themePanel');
const closeThemeBtn = document.getElementById('closeThemePanel');
const mobileThemeBtn = document.getElementById('mobileThemeBtn');

const togglePanel = () => themePanel.classList.toggle('active');

if (themeBtn) themeBtn.onclick = togglePanel;
if (mobileThemeBtn) mobileThemeBtn.onclick = togglePanel; 
if (closeThemeBtn) closeThemeBtn.onclick = () => themePanel.classList.remove('active');

// Close modal if clicking outside the modal content
window.addEventListener('click', (e) => { 
    if (e.target == contactModal) contactModal.style.display = "none"; 
});

// --- Like Button Logic ---
const likeBtn = document.getElementById('likeBtn');
if (likeBtn) {
    likeBtn.addEventListener('click', () => {
        if(!currentUser) return; // Prevent liking if Firebase hasn't connected yet
        
        // Trigger CSS Animation
        likeBtn.classList.add('liked');
        setTimeout(() => likeBtn.classList.remove('liked'), 400);
        
        // Update Database
        const likeDocRef = doc(db, "stats", "likes");
        
        runTransaction(db, async (transaction) => {
            const sfDoc = await transaction.get(likeDocRef);
            if (!sfDoc.exists()) {
                transaction.set(likeDocRef, { count: 1 });
            } else {
                const newCount = (sfDoc.data().count || 0) + 1;
                transaction.update(likeDocRef, { count: newCount });
            }
        }).catch(e => console.error("Like failed", e));
    });
}