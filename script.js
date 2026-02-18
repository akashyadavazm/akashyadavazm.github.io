// Import Firebase SDKs from Google's CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getFirestore, doc, setDoc, addDoc, updateDoc, collection, onSnapshot, serverTimestamp, runTransaction, increment } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDnSz2NJQZovT3WKjyak9IcVlfYbQBmlVM",
    authDomain: "chandan-saroj-portfolio.firebaseapp.com",
    projectId: "chandan-saroj-portfolio",
    storageBucket: "chandan-saroj-portfolio.firebasestorage.app",
    messagingSenderId: "673240575610",
    appId: "1:673240575610:web:c199ae38e28a41c33715c3",
    measurementId: "G-WVQXG2QM1T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// State Logic
const root = document.documentElement;
const saveBtn = document.getElementById('saveThemeBtn');
const resetBtn = document.getElementById('resetThemeBtn');
let currentUser = null;
let currentTheme = { primary: '#00ff88', secondary: '#00ccff', font: "'Inter', sans-serif", mode: 'dark' };

const themeModes = {
    'dark': { '--dark': '#0a0a0a', '--darker': '#050505', '--card-bg': 'rgba(20, 20, 20, 0.7)', '--text-light': '#f0f0f0', '--text-gray': '#a0a0a0', '--border': 'rgba(255, 255, 255, 0.08)' },
    'light': { '--dark': '#ffffff', '--darker': '#f3f4f6', '--card-bg': 'rgba(255, 255, 255, 0.8)', '--text-light': '#111827', '--text-gray': '#4b5563', '--border': 'rgba(0, 0, 0, 0.1)' },
    'minimalist': { '--dark': '#f5f5f5', '--darker': '#eaeaea', '--card-bg': 'rgba(255, 255, 255, 0.6)', '--text-light': '#222', '--text-gray': '#666', '--border': 'rgba(0, 0, 0, 0.05)' },
    'vibrant': { '--dark': '#1a0033', '--darker': '#0d001a', '--card-bg': 'rgba(40, 0, 60, 0.6)', '--text-light': '#fff', '--text-gray': '#d1d5db', '--border': 'rgba(255, 0, 255, 0.2)' },
    'thematic': { '--dark': '#001a1a', '--darker': '#000d0d', '--card-bg': 'rgba(0, 40, 40, 0.6)', '--text-light': '#e0f7fa', '--text-gray': '#80deea', '--border': 'rgba(0, 255, 255, 0.15)' }
};

signInAnonymously(auth).catch((error) => console.error("Auth Error", error));

let loadedPosts = {};

function stripHtml(html) {
   let tmp = document.createElement("DIV");
   tmp.innerHTML = html;
   return tmp.textContent || tmp.innerText || "";
}

// Weather Logic
const DELHI_COORDS = { lat: 28.6139, lon: 77.2090 };
async function fetchWeatherData(lat, lon) {
    try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
        const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`);
        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();
        updateWeatherUI(weatherData, aqiData);
    } catch (error) { console.error("Weather failed", error); }
}

function updateWeatherUI(weather, aqi) {
     const temp = Math.round(weather.current.temperature_2m);
     const code = weather.current.weather_code;
     let icon = 'fa-sun'; let text = 'Clear';
     if (code > 0 && code <= 3) { icon = 'fa-cloud-sun'; text = 'Cloudy'; }
     document.getElementById('weatherTemp').innerHTML = `<i class="fas fa-thermometer-half"></i> <span>${temp}°C</span>`;
     document.getElementById('weatherCondition').innerHTML = `<i class="fas ${icon}"></i> <span>${text}</span>`;
     document.getElementById('weatherAQI').innerHTML = `<i class="fas fa-wind"></i> <span>AQI: ${aqi.current.us_aqi}</span>`;
     document.getElementById('weather-widget').style.display = 'inline-flex';
}

navigator.geolocation.getCurrentPosition(pos => fetchWeatherData(pos.coords.latitude, pos.coords.longitude), () => fetchWeatherData(DELHI_COORDS.lat, DELHI_COORDS.lon));

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        onSnapshot(doc(db, "website_state", "global_theme"), (doc) => {
            if (doc.exists()) { applyTheme(doc.data()); updateUI(doc.data()); }
        });

        onSnapshot(collection(db, "messages"), (snapshot) => {
            const grid = document.getElementById('messagesGrid'); grid.innerHTML = '';
            snapshot.forEach((doc) => {
                const msg = doc.data();
                const card = document.createElement('div'); card.className = 'message-card';
                card.innerHTML = `<strong>${msg.name || 'Anonymous'}</strong><p>${msg.text}</p>`;
                grid.appendChild(card);
            });
        });
        
        onSnapshot(collection(db, "blogs"), (snapshot) => {
            const blogGrid = document.getElementById('blog-feed'); blogGrid.innerHTML = '';
            snapshot.forEach((docSnapshot) => {
                const post = docSnapshot.data(); loadedPosts[docSnapshot.id] = post;
                const card = document.createElement('div'); card.className = 'blog-card';
                card.innerHTML = `<div class="blog-content" onclick="window.openReadPost('${docSnapshot.id}')"><h3>${post.title}</h3><p>${stripHtml(post.content)}</p></div>`;
                blogGrid.appendChild(card);
            });
        });
    }
});

// Animations & Modals
gsap.registerPlugin(ScrollTrigger);
const waModal = document.getElementById('contactModal');
document.getElementById('whatsappBtn').onclick = () => waModal.style.display = "flex";
document.getElementById('closeModal').onclick = () => waModal.style.display = "none";

window.openReadPost = function(postId) {
    const post = loadedPosts[postId];
    document.getElementById('readModalBody').innerHTML = `<h1>${post.title}</h1><div>${post.content}</div>`;
    document.getElementById('readPostModal').style.display = "flex";
};

// ... Remaining event listeners for theme picker, form submission, and like buttons ...
// (Note: Keep all your existing event listeners and functions inside this file)

function applyTheme(theme) {
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-dim', theme.primary + '1A');
    root.style.setProperty('--secondary', theme.secondary);
    root.style.setProperty('--font-main', theme.font);
    if(theme.mode && themeModes[theme.mode]) {
        const modeVars = themeModes[theme.mode];
        for (const [key, value] of Object.entries(modeVars)) { root.style.setProperty(key, value); }
    }
}