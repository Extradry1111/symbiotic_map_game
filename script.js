// script.js
const firebaseConfig = {
  apiKey: "AIzaSyBQ0iocBB41jXN7DuB5iiQ2jf2MEUzq4yc",
  authDomain: "symb-d02a4.firebaseapp.com",
  projectId: "symb-d02a4",
  storageBucket: "symb-d02a4.firebasestorage.app",
  messagingSenderId: "869965895067",
  appId: "1:869965895067:web:71cfab2963da8ce6a7bd3e",
  measurementId: "G-Y2KM9N3GYV"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Храним Twitter текущего пользователя, чтобы он мог удалять только свой маркер
let currentTwitter = null;

// Ограничение карты
const bounds = [
  [-85, -180],
  [85, 180]
];

const map = L.map('map', {
  zoomControl: false,
  minZoom: 2,
  maxBounds: bounds,
  maxBoundsViscosity: 1.0
}).setView([20, 0], 2);

// Новый тёмный стиль карты
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

let selectedLatLng = null;
const formContainer = document.getElementById('form-container');
const markerForm = document.getElementById('marker-form');
const cancelBtn = document.getElementById('cancel');

// Показ формы
map.on('click', e => {
  selectedLatLng = e.latlng;
  formContainer.classList.remove('hidden');
  setTimeout(() => formContainer.classList.add('show'), 10);
  document.getElementById('twitter').focus();
});

// Скрытие формы
cancelBtn.addEventListener('click', () => {
  hideForm();
});

function hideForm() {
  formContainer.classList.remove('show');
  setTimeout(() => formContainer.classList.add('hidden'), 300);
  markerForm.reset();
  selectedLatLng = null;
}

// Отправка формы
markerForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (!selectedLatLng) return;

  const twitterHandleInput = document.getElementById('twitter').value.trim();
  const twitterHandle = twitterHandleInput.replace(/^@/, '');
  const discordRole = document.getElementById('discordRole').value.trim();
  const reason = document.getElementById('reason').value.trim();

  // Сохраняем текущий Twitter
  currentTwitter = twitterHandle;

  // Проверка уникальности Twitter
  const existing = await db.collection("markers").where("twitter", "==", twitterHandle).get();
  if (!existing.empty) {
    alert("Этот Twitter уже добавлен на карту!");
    return;
  }

  const avatarUrl = `https://unavatar.io/twitter/${twitterHandle}`;

  await db.collection("markers").add({
    lat: selectedLatLng.lat,
    lng: selectedLatLng.lng,
    twitter: twitterHandle,
    discordRole,
    reason,
    avatar: avatarUrl,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  hideForm();
});

// Слушаем изменения
db.collection("markers").onSnapshot(snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === "added") {
      const data = change.doc.data();
      addMarkerToMap(change.doc.id, data);
    }
  });
});

function loadImageWithFallback(url, fallbackUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(fallbackUrl);
    img.src = url;
  });
}

async function addMarkerToMap(docId, data) {
  const fallbackAvatar = 'https://via.placeholder.com/40/8B5CF6/FFFFFF?text=S';
  const avatarUrl = await loadImageWithFallback(data.avatar, fallbackAvatar);

  const avatarIcon = L.divIcon({
    html: `<div class="marker-animate"><img src="${avatarUrl}" style="width:40px;height:40px;border-radius:50%;border:2px solid #06B6D4;background:white;"></div>`,
    iconSize: [40, 40],
    className: ''
  });

  const marker = L.marker([data.lat, data.lng], { icon: avatarIcon }).addTo(map);

  let popupContent = `
    <strong>@${data.twitter}</strong><br/>
    Role: ${data.discordRole}<br/>
    Reason: ${data.reason}
  `;

  // Кнопка удаления, только если это твой маркер
  if (currentTwitter && currentTwitter === data.twitter) {
    popupContent += `<br/><button class="delete-marker" data-id="${docId}" style="margin-top:5px;background:#f44336;color:white;border:none;padding:4px 8px;border-radius:5px;cursor:pointer;">Удалить</button>`;
  }

  marker.bindPopup(popupContent);

  marker.on('popupopen', () => {
    const btn = document.querySelector('.delete-marker');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (confirm("Удалить свой маркер?")) {
          await db.collection("markers").doc(docId).delete();
          map.removeLayer(marker);
        }
      });
    }
  });
}
// Вместо обычного темного стиля оставим полупрозрачный OSM
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  opacity: 0.75 // полупрозрачность тайлов
}).addTo(map);
