const API_BASE = 'https://sektor-map-back.onrender.com';
/* =========================
   USER FINGERPRINT
   ========================= test*/

async function getUserFingerprint() {
    const data = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.hardwareConcurrency || '',
        navigator.deviceMemory || ''
    ].join('::');

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/* =========================
   0) Константы и параметры
   ========================= */

const MAP_SIZE = 6144;
const PADDING = MAP_SIZE * 1.5;
const MAP_CENTER = [MAP_SIZE / 2, MAP_SIZE / 2];

const worldBounds = [
    [-PADDING, -PADDING],
    [MAP_SIZE + PADDING, MAP_SIZE + PADDING]
];

const imageBounds = [
    [0, 0],
    [MAP_SIZE, MAP_SIZE]
];


/* =========================
   1) Инициализация карты
   ========================= */

const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    maxBounds: worldBounds,
    maxBoundsViscosity: 0
});

map.attributionControl.setPrefix(false);
map.attributionControl.addAttribution(
    'SEKTOR-1 Map © D.Sato | js © Leaflet | 2026'
);


L.imageOverlay('assets/map1.png', imageBounds).addTo(map);
map.fitBounds(imageBounds);

if (L.Browser.mobile) {
    map.tap = true;
    map.touchZoom.enable();
    map.doubleClickZoom.disable();
}

let USER_HASH = null;

getUserFingerprint().then(hash => {
    USER_HASH = hash;
    console.log('USER_HASH:', USER_HASH);
});


async function vote(itemId, value) {
    if (!USER_HASH || !itemId) return;

    const payload = {
        item_id: itemId,
        vote: value,
        user_hash: USER_HASH,
        user_agent: navigator.userAgent
    };

    try {
        const res = await fetch('https://sektor-map-back.onrender.com/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.status === 429 && data.message === 'cooldown') {
            lockRating();

            ratingHint.innerHTML = `
                <img src="assets/img/calendar.gif" alt="">
                Вы уже голосовали. Можно снова через 
                ${Math.ceil(data.retry_after_ms / (1000 * 60 * 60 * 24))} дн.
            `;

            ratingHint.classList.remove('hidden');
            return;
        }


        if (!res.ok) {
            ratingHint.textContent = 'Ошибка голосования';
            ratingHint.classList.remove('hidden');
            return;
        }

        ratingValue.textContent = data.rating;
        lockRating();
        ratingHint.innerHTML = '<img src="assets/img/accept_vote.gif" alt=""> Голос учтён';
        ratingHint.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        ratingHint.textContent = 'Ошибка сети';
        ratingHint.classList.remove('hidden');
    }
}

async function loadRatingStatus(itemId) {
    if (!USER_HASH || !itemId) return;


    ratingValue.innerHTML = '<img src="assets/img/loading_star.gif" style="width: 36px; height: 36px;">';

    ratingHint.innerHTML = `
        <img src="assets/img/loading.gif" alt="Загрузка" style="width: 36px; height: 36px; vertical-align: middle;">
        <span>Будим наш сервер...</span>
    `;
    ratingHint.classList.remove('hidden'); 

    try {
        const res = await fetch(
            `${API_BASE}/rating-status/${itemId}` +
            `?user_hash=${encodeURIComponent(USER_HASH)}` +
            `&user_agent=${encodeURIComponent(navigator.userAgent)}`
        );

        const data = await res.json();

        // рейтинг
        ratingValue.textContent = data.rating;           
        ratingHint.classList.add('hidden');              

        if (data.user_voted) {
            lockRating();

            if (data.cooldown_remaining > 0) {
                const days = Math.ceil(
                    data.cooldown_remaining / (1000 * 60 * 60 * 24)
                );
                ratingHint.innerHTML = `
                    <img src="assets/img/calendar.gif" alt="">
                    Вы уже голосовали. Можно снова через ${days} дн.
                `;
                ratingHint.classList.remove('hidden');
            }
        } else {
            ratingLocked = false;
            ratingUp.classList.remove('disabled');
            ratingDown.classList.remove('disabled');
            ratingHint.classList.add('hidden');
        }

    } catch (e) {
        console.error('Ошибка загрузки статуса рейтинга', e);
    }
}

/* =========================
   2) Типы бизнесов + загрузка
   ========================= */

const BUSINESS_TYPES = {
    gas: { icon: 'assets/icons/gas.png', title: 'АЗС' },
    cafe: { icon: 'assets/icons/cafe.png', title: 'Кафе' },
    petshop: { icon: 'assets/icons/petshop.png', title: 'Зоомагазин' },
    ranch: { icon: 'assets/icons/ranch.png', title: 'Ранчо' },
    gold: { icon: 'assets/icons/gold.png', title: 'Золотая шахта' },
    icecream: { icon: 'assets/icons/icecream.png', title: 'Фабрика мороженого' },
    hotdog: { icon: 'assets/icons/hotdog.png', title: 'Фабрика сосисок' },
    canteen: { icon: 'assets/icons/canteen.png', title: 'Тюремная столовая' } 
};

const LANDMARK_TYPES = {
    monument: { icon: 'assets/icons/monument.png', title: 'Алтарь' },
    monument_dead: { icon: 'assets/icons/statuedead.png', title: 'Алтарь Мёртвой невесты' }
};

const NAVIGATOR_TYPES = {
    fish: { icon: 'assets/icons/fishing.png', title: 'Рыбное место' },
};
/*Названия на тултипе*/ 
const CATEGORIES = {
  business: 'Бизнес',
  landmark: 'Достопримечательность',
  navigator: 'Точка в навигаторе',
};

const CATEGORY_TYPES = {
  business: {
    gas: 'АЗС',
    cafe: 'Кафе',
    petshop: 'Зоомагазин',
    ranch: 'Ранчо',
    gold: 'Золотая шахта',
    icecream: 'Фабрика мороженого',
    hotdog: 'Фабрика сосисок',
    canteen: 'Тюремная столовая'
  },

  landmark: {
    monument: 'Активная точка',
    monument_dead: 'Активная точка'
  },

  navigator: {
    fish: 'Рыбное место'
  }
};



/* =========================
   3) Утилиты координат SA:MP
   ========================= */

function sampToMap(x, y) {
    return [
        (y + 3000) / 6000 * MAP_SIZE,
        (x + 3000) / 6000 * MAP_SIZE
    ];
}

function mapToSamp(lat, lng) {
    return {
        x: +((lng / MAP_SIZE) * 6000 - 3000).toFixed(4),
        y: +((lat / MAP_SIZE) * 6000 - 3000).toFixed(4)
    };
}

function getDistanceMeters(latlngA, latlngB) {
    const p1 = mapToSamp(latlngA.lat, latlngA.lng);
    const p2 = mapToSamp(latlngB.lat, latlngB.lng);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    return Math.sqrt(dx * dx + dy * dy);
}


/* =========================
   4) Clipboard helper
   ========================= */

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        const t = document.createElement('textarea');
        t.value = text;
        t.style.position = 'fixed';
        t.style.left = '-9999px';
        document.body.appendChild(t);
        t.select();
        document.execCommand('copy');
        document.body.removeChild(t);
    }
}


/* =========================
   INFO PANEL + GALLERY
   ========================= */

const infoPanel = document.getElementById('info-panel');
const infoTitle = document.getElementById('info-title');
const infoClose = document.getElementById('info-close');
const infoImage = document.getElementById('info-image');
const infoMeta = document.getElementById('info-meta');
const infoDesc = document.getElementById('info-desc');

const infoGallery = document.getElementById('info-gallery');
const infoPrev = document.getElementById('info-prev');
const infoNext = document.getElementById('info-next');
const infoCounter = document.getElementById('info-counter');

let galleryImages = [];
let galleryIndex = 0;

/* =========================
   RATING (frontend only)
   ========================= */

let currentItemId = null; 
const ratingBlock = document.getElementById('info-rating');
const ratingUp = document.getElementById('rating-up');
const ratingDown = document.getElementById('rating-down');
const ratingValue = document.getElementById('rating-value');
const ratingHint = document.getElementById('rating-hint');

let currentRating = 0;
let ratingLocked = false;

function resetRating() {
    currentRating = 0;
    ratingLocked = false;

    ratingValue.textContent = currentRating;
    ratingHint.classList.add('hidden');
    ratingUp.classList.remove('disabled');
    ratingDown.classList.remove('disabled');
}

function lockRating() {
    ratingLocked = true;
    ratingUp.classList.add('disabled');
    ratingDown.classList.add('disabled');
    ratingHint.classList.remove('hidden');
}

ratingUp.addEventListener('click', () => {
    if (ratingLocked) return;
    vote(currentItemId, +1);
});

ratingDown.addEventListener('click', () => {
    if (ratingLocked) return;
    vote(currentItemId, -1);
});




function renderGallery() {
    if (!galleryImages.length) {
        infoGallery.classList.add('hidden');
        infoImage.src = '';
        infoCounter?.classList.add('hidden');
        return;
    }

    infoGallery.classList.remove('hidden');
    infoGallery.classList.add('loading'); 

    
    infoImage.src = '';
    infoImage.src = galleryImages[galleryIndex] + '?v=' + Date.now();

    infoImage.onload = () => {
        infoGallery.classList.remove('loading');
    };

    infoImage.onerror = () => {
        infoGallery.classList.remove('loading');
        infoImage.src = 'assets/img/loading_star.gif';
        infoImage.alt = 'Изображение не загрузилось';
    };

    const multi = galleryImages.length > 1;

    if (infoCounter) {
        if (multi) {
            infoCounter.textContent = `${galleryIndex + 1} / ${galleryImages.length}`;
            infoCounter.classList.remove('hidden');
        } else {
            infoCounter.classList.add('hidden');
        }
    }

    infoPrev?.classList.toggle('hidden', !multi);
    infoNext?.classList.toggle('hidden', !multi);
}

function prevImage() {
    if (galleryImages.length <= 1) return;
    galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length;
    renderGallery();
}

function nextImage() {
    if (galleryImages.length <= 1) return;
    galleryIndex = (galleryIndex + 1) % galleryImages.length;
    renderGallery();
}

infoPrev?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); prevImage(); });
infoNext?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); nextImage(); });


function openInfoPanel(data) {
    currentItemId = data.id;

    infoTitle.textContent = data.name || 'Объект';

    galleryImages = Array.isArray(data.images) ? data.images.slice() : [];
    if (!galleryImages.length && data.image) galleryImages = [data.image];
    galleryIndex = 0;

    if (galleryImages.length > 0) {
        infoGallery.classList.remove('hidden');
        
        infoImage.src = '';
        infoImage.alt = 'Загружается...';
        
        infoGallery.classList.add('loading');
        
        infoImage.src = galleryImages[galleryIndex];
        
        infoImage.onload = () => {
            infoGallery.classList.remove('loading');
        };
        
        infoImage.onerror = () => {
            infoGallery.classList.remove('loading');
            infoImage.src = 'assets/img/loading_star.gif';
            infoImage.alt = 'Изображение не загрузилось';
        };
    } else {
        infoGallery.classList.add('hidden');
    }

    renderGallery();

    const samp = mapToSamp(data._latlng?.lat ?? 0, data._latlng?.lng ?? 0);
    
    const categoryTitle = CATEGORIES[data.category] || data.category || '—';
    const typeTitle     = CATEGORY_TYPES[data.category]?.[data.type] || data.type || '—';

    let metaHTML = `
        <div><b>Категория:</b> ${categoryTitle}</div>
        <div><b>Тип:</b> ${typeTitle}</div>
    `;

    if (data.owner && data.owner.trim() !== '') {
        metaHTML += `<div><b>Владелец:</b> ${data.owner}</div>`;
    }

    metaHTML += `
        <div><b>X:</b> ${samp.x} <b>Y:</b> ${samp.y}</div>
    `;

    infoMeta.innerHTML = metaHTML;

    if (data.description) {
        infoDesc.textContent = data.description;
        infoDesc.classList.remove('hidden');
    } else {
        infoDesc.textContent = '';
        infoDesc.classList.add('hidden');
    }

    // === рейтинг ===
    resetRating();
    ratingBlock.classList.remove('hidden');

    infoPanel.classList.remove('hidden');
    infoPanel.setAttribute('aria-hidden', 'false');

    loadRatingStatus(data.id);
}

// =============================================
// Поддержка deep linking по бизнесу
// =============================================

function getBusinessIdFromUrl() {
    const hash = window.location.hash;
    if (!hash) return null;
    
    const match = hash.match(/^#(?:b|business)=(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
}

async function openBusinessById(id) {
    if (!id) return;
    
    try {
        const response = await fetch('./data/businesses.json');
        const businesses = await response.json();
        
        const business = businesses.find(b => b.id === id);
        if (!business) return;
        
        const latlng = sampToMap(business.x, business.y);
        map.setView(latlng, 1.5); 
        
        openInfoPanel({
            ...business,
            _latlng: L.latLng(latlng)
        });
    } catch (err) {
        console.error('Не удалось открыть бизнес по ID из URL:', err);
    }
}

// Проверяем URL при загрузке страницы
window.addEventListener('load', () => {
    const id = getBusinessIdFromUrl();
    if (id) {
        openBusinessById(id);
    }
});

// =============================================
// Расширение deep linking: #b= поддерживает и зоны (отрицательные id)
// =============================================

window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (!hash) return;

    const match = hash.match(/^#b=(-?\d+)/i);
    if (!match) return;

    const id = parseInt(match[1], 10);
    if (isNaN(id)) return;

    // Положительные id → бизнесы (существующая логика)
    if (id > 0) {
        openBusinessById(id);
        return;
    }

    // Отрицательные id → зоны
    if (id < 0) {
        openZoneByNegativeId(id);
    }
});

// Функция для открытия зоны по отрицательному id
async function openZoneByNegativeId(id) {
    try {
        const response = await fetch('./data/zones.json');
        const zones = await response.json();

        const zone = zones.find(z => z.id === id);
        if (!zone) {
            console.warn(`Зона с id ${id} не найдена`);
            return;
        }

        const latLngPoints = zone.points.map(point => sampToMap(point[0], point[1]));
        const bounds = L.latLngBounds(latLngPoints);

        // Красиво вписываем зону в экран
        map.fitBounds(bounds, {
            padding: [60, 60],          // небольшой отступ
            maxZoom: 1.5,
            animate: true,
            duration: 1.2
        });

        // Открываем карточку
        openInfoPanel({
            ...zone,
            _latlng: bounds.getCenter()
        });
    } catch (err) {
        console.error('Ошибка при открытии зоны по id:', err);
    }
}

// Обработчик кнопки "Поделиться"
document.addEventListener('click', async (e) => {
    if (!e.target.closest('#share-business-btn')) return;
    
    if (!currentItemId) return;
    
    const shareUrl = `${window.location.origin}${window.location.pathname}#b=${currentItemId}`;
    
    try {
        await navigator.clipboard.writeText(shareUrl);
        
        const btn = document.getElementById('share-business-btn');
        const originalText = btn.innerHTML;
        
        btn.innerHTML = '<img src="assets/img/accept_vote.gif" class="copy-icon" alt=""> Скопировано!';
        btn.classList.add('copied');
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('copied');
        }, 2000);
        
    } catch (err) {
        console.error('Ошибка копирования ссылки:', err);
        alert('Не удалось скопировать ссылку :(');
    }
});


function closeInfoPanel() {
    infoPanel.classList.add('hidden');
    infoPanel.setAttribute('aria-hidden', 'true');
    ratingBlock.classList.add('hidden');

}

infoClose?.addEventListener('click', closeInfoPanel);


/* =========================
   FULLSCREEN IMAGE (TOP-LEVEL, не внутри ESC!)
   ========================= */

const imageOverlay = document.getElementById('image-overlay');
const imageOverlayImg = imageOverlay?.querySelector('img');

function openFullscreen(src) {
    if (!imageOverlay || !imageOverlayImg) return;
    if (!src) return;
    imageOverlayImg.src = src;
    imageOverlay.classList.add('active');
}

function closeFullscreen() {
    if (!imageOverlay || !imageOverlayImg) return false;
    if (!imageOverlay.classList.contains('active')) return false;

    imageOverlay.classList.remove('active');
    imageOverlayImg.src = '';
    return true;
}


document.addEventListener('click', (e) => {
    const img = e.target.closest('#info-image');
    if (!img) return;
    const src = img.getAttribute('src');
    if (!src) return;
    openFullscreen(src);
}, true);

// клик по фону fullscreen -> закрыть
imageOverlay?.addEventListener('click', () => {
    closeFullscreen();
});


/* =========================
   5) Контролы карты
   ========================= */

const CenterControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
        const b = L.DomUtil.create('button', 'leaflet-bar');
        b.innerHTML = '📍';
        b.style.width = '32px';
        b.style.height = '30px';
        b.style.cursor = 'pointer';
        b.style.fontSize = '16px';
        b.style.background = '#fff';
        b.style.color = '#000';
        b.style.border = 'none';
        L.DomEvent.disableClickPropagation(b);
        b.onclick = () => map.flyTo(MAP_CENTER, map.getZoom(), { duration: 0.6 });
        return b;
    }
});
map.addControl(new CenterControl());


/* =========================
   6) Обычная метка (координаты + копирование)
   ========================= */

let sharedMarker = null;

function buildPopup(marker, withButton = true) {
    const { lat, lng } = marker.getLatLng();
    const samp = mapToSamp(lat, lng);

    const url = new URL(location.href);
    url.searchParams.set('x', samp.x);
    url.searchParams.set('y', samp.y);
    url.searchParams.set('z', map.getZoom());

    return `
        <b>Координаты</b><br>
        X: ${samp.x}<br>
        Y: ${samp.y}
        ${withButton ? `
            <br><br>
            <button class="copy-link" data-url="${url}">
                <img src="assets/img/copy.gif" class="copy-icon" alt="">
                Скопировать координаты
            </button>
        ` : ``}
    `;
}

function handleSharedMarkerClick(e) {
    if (rulerActive || rulerClickLock) return;
    if (e.originalEvent?.target?.closest?.('.leaflet-marker-icon')) return;

    if (sharedMarker) {
        map.removeLayer(sharedMarker);
        sharedMarker = null;
    }

    sharedMarker = L.marker(e.latlng, {
        draggable: true,
        autoPan: true
    }).addTo(map);

    sharedMarker.bindPopup('', {
        closeOnClick: false,
        autoClose: false
    });

    function setPopup(withButton = true) {
        sharedMarker.setPopupContent(buildPopup(sharedMarker, withButton));
    }

    function openPopup() {
        sharedMarker.openPopup();
    }

    sharedMarker.on('popupopen', (ev) => {
        setTimeout(() => {
            const root = ev.popup.getElement();
            if (!root) return;

            const btn = root.querySelector('.copy-link');
            if (!btn) return;

            btn.onclick = () => {
                copyToClipboard(btn.dataset.url);

                btn.classList.add('copied');
                btn.setAttribute('data-copied', '1');

                btn.innerHTML = `
                    <img src="assets/img/complete.gif" class="copy-icon" alt="">
                    Скопировано
                `;
            };
        }, 0);
    });

    setPopup(true);
    openPopup();

    sharedMarker.on('dragstart', () => {
        sharedMarker.closePopup();
    });

    sharedMarker.on('dragend', () => {
        setPopup(true);
        openPopup();
    });
}

map.on('click', handleSharedMarkerClick);

const params = new URLSearchParams(location.search);
if (params.has('x') && params.has('y')) {
    const pos = sampToMap(+params.get('x'), +params.get('y'));
    map.setView(pos, +params.get('z') || 0, { animate: false });

    sharedMarker = L.marker(pos, { draggable: false }).addTo(map);
    sharedMarker.bindPopup(buildPopup(sharedMarker, false)).openPopup();
}


/* =========================
   7) Линейка (отрезок A-B + расстояние) + Drag точек
   ========================= */

let rulerActive = false;
let rulerFinished = false;
let rulerClickLock = false;

let rulerPointA = null;
let rulerPointB = null;

let rulerLine = null;
let rulerMarkerA = null;
let rulerMarkerB = null;
let rulerLabel = null;

let rulerDraggingPoint = null;


const RulerControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
        const btn = L.DomUtil.create('button', 'leaflet-bar ruler-btn');
        btn.innerHTML = '📏';
        btn.style.width = '32px';
        btn.style.height = '30px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '16px';
        btn.style.background = '#fff';
        btn.style.color = '#000';
        btn.style.border = 'none';

        L.DomEvent.disableClickPropagation(btn);
        btn.onclick = () => toggleRuler(btn);
        return btn;
    }
});

map.addControl(new RulerControl());

function setCursorMode() {
    const el = map.getContainer();
    el.style.cursor = rulerActive ? 'crosshair' : 'default';
}

map.on('dragstart', () => {
    if (rulerActive) return;
    map.getContainer().style.cursor = 'grabbing';
});
map.on('dragend', () => {
    if (rulerActive) return;
    map.getContainer().style.cursor = 'default';
});

function toggleRuler(btn) {
    if (rulerActive) {
        resetRuler();
        rulerActive = false;
        rulerFinished = false;
        rulerClickLock = false;
        btn.classList.remove('active');
        map.getContainer().classList.remove('ruler-mode');
        setCursorMode();
        return;
    }

    resetRuler();
    rulerActive = true;
    rulerFinished = false;
    rulerClickLock = false;
    rulerPointA = null;
    rulerPointB = null;

    btn.classList.add('active');
    map.getContainer().classList.add('ruler-mode');

    if (sharedMarker) {
        map.removeLayer(sharedMarker);
        sharedMarker = null;
    }

    setCursorMode();
}

function resetRuler() {
    if (rulerLine) map.removeLayer(rulerLine);
    if (rulerMarkerA) map.removeLayer(rulerMarkerA);
    if (rulerMarkerB) map.removeLayer(rulerMarkerB);
    if (rulerLabel) map.removeLayer(rulerLabel);

    rulerLine = null;
    rulerMarkerA = null;
    rulerMarkerB = null;
    rulerLabel = null;

    rulerPointA = null;
    rulerPointB = null;
    rulerDraggingPoint = null;
}

function updateRuler(pointB, fixed) {
    if (!rulerLine || !rulerPointA) return;

    rulerLine.setLatLngs([rulerPointA, pointB]);

    const dist = getDistanceMeters(rulerPointA, pointB).toFixed(2);
    const mid = L.latLng(
        (rulerPointA.lat + pointB.lat) / 2,
        (rulerPointA.lng + pointB.lng) / 2
    );

    if (rulerLabel) map.removeLayer(rulerLabel);

    rulerLabel = L.marker(mid, {
        interactive: false,
        icon: L.divIcon({
            className: 'ruler-distance',
            html: `${dist} м`
        })
    }).addTo(map);

    if (fixed) {
        rulerLine.setStyle({ dashArray: null });
    }
}

function bindPointDrag(layer, which) {
    layer.on('mousedown', (ev) => {
        if (!rulerActive || !rulerFinished) return;

        L.DomEvent.preventDefault(ev.originalEvent);
        L.DomEvent.stopPropagation(ev.originalEvent);

        rulerDraggingPoint = which;
        map.dragging.disable();
    });
}

function stopRulerDrag() {
    if (!rulerDraggingPoint) return;
    rulerDraggingPoint = null;
    map.dragging.enable();
}

map.on('mouseup', stopRulerDrag);

function handleRulerClick(e) {
    if (!rulerActive || rulerClickLock) return;
    if (rulerFinished) return;

    rulerClickLock = true;

    if (!rulerPointA) {
        rulerPointA = e.latlng;

        rulerMarkerA = L.circleMarker(rulerPointA, {
            radius: 6,
            className: 'ruler-point',
            interactive: true,
        }).addTo(map);

        rulerLine = L.polyline([rulerPointA, rulerPointA], {
            color: '#ffcc00',
            weight: 2,
            dashArray: '6,4',
            interactive: false
        }).addTo(map);

        setTimeout(() => { rulerClickLock = false; }, 0);
        return;
    }

    rulerPointB = e.latlng;

    rulerMarkerB = L.circleMarker(rulerPointB, {
        radius: 6,
        className: 'ruler-point',
        interactive: true,
    }).addTo(map);

    updateRuler(rulerPointB, true);
    rulerFinished = true;

    bindPointDrag(rulerMarkerA, 'A');
    bindPointDrag(rulerMarkerB, 'B');

    setTimeout(() => { rulerClickLock = false; }, 0);
}

map.on('click', handleRulerClick);

map.on('mousemove', (e) => {
    if (rulerDraggingPoint && rulerFinished) {
        if (rulerDraggingPoint === 'A') {
            rulerPointA = e.latlng;
            rulerMarkerA.setLatLng(rulerPointA);
            rulerLine.setLatLngs([rulerPointA, rulerPointB]);
            updateRuler(rulerPointB, true);
            return;
        }

        if (rulerDraggingPoint === 'B') {
            rulerPointB = e.latlng;
            rulerMarkerB.setLatLng(rulerPointB);
            rulerLine.setLatLngs([rulerPointA, rulerPointB]);
            updateRuler(rulerPointB, true);
            return;
        }
    }

    if (!rulerActive || !rulerPointA || !rulerLine || rulerFinished) return;
    updateRuler(e.latlng, false);
});


/* =========================
   8) ESC — единый обработчик (fullscreen приоритетнее)
   ========================= */

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    if (closeFullscreen()) return;
 
    closeInfoPanel();

    if (sharedMarker) {
        map.removeLayer(sharedMarker);
        sharedMarker = null;
    }

    if (rulerActive || rulerFinished) {
        resetRuler();
        rulerActive = false;
        rulerFinished = false;
        rulerClickLock = false;

        document.querySelector('.ruler-btn')?.classList.remove('active');
        map.getContainer().classList.remove('ruler-mode');
        setCursorMode();
    }
}, true); 

setCursorMode();


/* =========================
   Бизнесы: загрузка ПОСЛЕ определения openInfoPanel
   ========================= */

fetch('./data/businesses.json')
    .then(r => r.json())
    .then(list => {
        list.forEach(b => {
            let typeConfig;
            let iconUrl;
            let title = CATEGORIES[b.category] || b.category || '—';

            if (b.category === 'business') {
                typeConfig = BUSINESS_TYPES[b.type];
            } else if (b.category === 'landmark') {
                typeConfig = LANDMARK_TYPES[b.type];
            } else if (b.category === 'navigator') {
                typeConfig = NAVIGATOR_TYPES[b.type];
            }

            if (!typeConfig) return;  

            iconUrl = typeConfig.icon;
            title = `<b>${b.name}</b><br>${CATEGORIES[b.category] || b.category || '—'}`;

            const marker = L.marker(
                sampToMap(b.x, b.y),
                {
                    icon: L.icon({
                        iconUrl: iconUrl,
                        iconSize: [28, 28],
                        iconAnchor: [14, 14],
                        className: b.category === 'landmark' ? 'marker-landmark' : 'marker-business'
                    })
                }
            ).addTo(map);

            marker.bindTooltip(title, { direction: 'top', offset: [0, -10], sticky: true });

            marker.on('click', (ev) => {
                if (ev.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
                openInfoPanel({
                    ...b,
                    _latlng: marker.getLatLng()
                });
            });
        });
    });

// Новая секция: Загрузка зон (каптов)
fetch('./data/zones.json')
    .then(r => r.json())
    .then(list => {
        list.forEach(zone => {
            if (zone.category !== 'Территория') return;

            
            const latLngPoints = zone.points.map(point => sampToMap(point[0], point[1]));

          
            const polygon = L.polygon(latLngPoints, {
                color: '#ffffff', 
                weight: 2,         
                opacity: 0.8,      
                fillColor: zone.color,  
                fillOpacity: 0.5   
            }).addTo(map);

            
            polygon.bindTooltip(
                `<b>${zone.name}</b><br>${zone.type}`,
                { direction: 'top', offset: [0, -10], sticky: true }
            );

            
            polygon.on('click', (ev) => {
                if (ev.originalEvent) L.DomEvent.stopPropagation(ev.originalEvent);
                openInfoPanel({
                    ...zone,
                    _latlng: polygon.getBounds().getCenter() 
                });
            });
        });
    });