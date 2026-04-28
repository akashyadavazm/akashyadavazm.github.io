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
        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            loadedPosts[docSnap.id] = post;
            const card = document.createElement('div');
            card.className = 'blog-card';
            card.innerHTML = `
                <div class="vote-section">
                    <button class="vote-btn" data-id="${docSnap.id}" data-up="true"><i class="fas fa-arrow-up"></i></button>
                    <span class="vote-count">${post.score || 0}</span>
                    <button class="vote-btn" data-id="${docSnap.id}" data-up="false"><i class="fas fa-arrow-down"></i></button>
                </div>
                <div class="blog-content" onclick="openReadPost('${docSnap.id}')">
                    <h3>${post.title}</h3>
                    <p class="blog-text-preview">${stripHtml(post.content)}</p>
                </div>`;
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
    let t = document.createElement("DIV"); t.innerHTML = html;
    return t.textContent || t.innerText || "";
}

gsap.from("#header", { y: -100, duration: 1, ease: "bounce" });