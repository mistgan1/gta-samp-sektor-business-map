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

L.imageOverlay('assets/map.jpg', imageBounds).addTo(map);
map.fitBounds(imageBounds);

if (L.Browser.mobile) {
    map.tap = true;
    map.touchZoom.enable();
    map.doubleClickZoom.disable();
}


/* =========================
   2) Типы бизнесов + загрузка
   ========================= */

const BUSINESS_TYPES = {
    gas: { icon: 'assets/icons/gas.png' },
    cafe: { icon: 'assets/icons/cafe.png' },
    petshop: { icon: 'assets/icons/petshop.png' },
    ranch: { icon: 'assets/icons/ranch.png' },
    gold: { icon: 'assets/icons/gold.png' },
    icecream: { icon: 'assets/icons/icecream.png' },
    hotdog: { icon: 'assets/icons/hotdog.png' },
    canteen: { icon: 'assets/icons/canteen.png' }
};

fetch('./data/businesses.json')
    .then(r => r.json())
    .then(list => {
        list.forEach(b => {
            const type = BUSINESS_TYPES[b.type];
            if (!type) return;

            const marker = L.marker(sampToMap(b.x, b.y), {
                icon: L.icon({
                    iconUrl: type.icon,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            }).addTo(map).bindTooltip(
                `<b>${b.name}</b><br>Тип: Бизнес<br>Владелец: ${b.owner}`,
                { direction: 'top', offset: [0, -10], sticky: true }
            );
            marker.on('click', () => {
                // прокидываем latlng маркера, чтобы показать X/Y
                const payload = { ...b, _latlng: marker.getLatLng() };
                openInfoPanel(payload);
            });
        });
    });


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
   INFO PANEL (открытие карточки по клику)
   ========================= */

const infoPanel = document.getElementById('info-panel');
const infoTitle = document.getElementById('info-title');
const infoClose = document.getElementById('info-close');
const infoImage = document.getElementById('info-image');
const infoMeta = document.getElementById('info-meta');
const infoDesc = document.getElementById('info-desc');

function openInfoPanel(data) {
    // Заголовок
    infoTitle.textContent = data.name || 'Объект';

    // Скриншот (пока поддержка: data.image или data.images[0])
    const img = (data.images && data.images.length ? data.images[0] : data.image) || '';
    if (img) {
        infoImage.src = img;
        infoImage.classList.remove('hidden');
    } else {
        infoImage.src = '';
        infoImage.classList.add('hidden');
    }

    // Метаданные
    const typeText = data.type ? data.type : '—';
    const ownerText = data.owner ? data.owner : '—';

    // Координаты в SA:MP
    const samp = mapToSamp(data._latlng?.lat ?? 0, data._latlng?.lng ?? 0);

    infoMeta.innerHTML = `
        <div><b>Тип:</b> ${typeText}</div>
        <div><b>Владелец:</b> ${ownerText}</div>
        <div><b>X:</b> ${samp.x} <b>Y:</b> ${samp.y}</div>
    `;

    // Описание (опционально)
    if (data.description) {
        infoDesc.textContent = data.description;
        infoDesc.classList.remove('hidden');
    } else {
        infoDesc.textContent = '';
        infoDesc.classList.add('hidden');
    }

    infoPanel.classList.remove('hidden');
    infoPanel.setAttribute('aria-hidden', 'false');
}

function closeInfoPanel() {
    infoPanel.classList.add('hidden');
    infoPanel.setAttribute('aria-hidden', 'true');
}

infoClose?.addEventListener('click', closeInfoPanel);

// Закрытие по Esc (в дополнение к твоим обработчикам)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeInfoPanel();
});


/* =========================
   5) Контролы карты
   ========================= */

// Центрирование
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

// Popup HTML
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

// Клик по карте (обычный режим)
function handleSharedMarkerClick(e) {
    // Не ставим обычную метку, если включена линейка или клик "занят" линейкой
    if (rulerActive || rulerClickLock) return;
    if (e.originalEvent.target.closest('.leaflet-marker-icon')) return;

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

// Позиция по ссылке (?x&y&z)
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

// Какая точка сейчас перетаскивается: 'A' | 'B' | null
let rulerDraggingPoint = null;

// Контрол линейки
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

    if (rulerActive) {
        el.style.cursor = 'crosshair';
        return;
    }

    // обычный режим
    el.style.cursor = 'default';
}

// карта перетаскивается — рука (только в обычном режиме)
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

    // Включаем
    resetRuler();
    rulerActive = true;
    rulerFinished = false;
    rulerClickLock = false;
    rulerPointA = null;
    rulerPointB = null;

    btn.classList.add('active');
    map.getContainer().classList.add('ruler-mode');

    // Принудительно убираем обычную метку при включении линейки
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

// Подпись расстояния + обновление линии
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

// Привязка drag к точке
function bindPointDrag(layer, which) {

    layer.on('mousedown', (ev) => {
        if (!rulerActive || !rulerFinished) return;

        L.DomEvent.preventDefault(ev.originalEvent);
        L.DomEvent.stopPropagation(ev.originalEvent);

        rulerDraggingPoint = which;
        map.dragging.disable();
    });
}

map.on('mouseup', stopRulerDrag);

// Клик по карте в режиме линейки
function handleRulerClick(e) {
    if (!rulerActive || rulerClickLock) return;

    // если отрезок уже построен — клики ничего не создают
    if (rulerFinished) return;

    rulerClickLock = true;

    // 1-я точка (A)
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

        // A можно будет двигать только после построения B (как ты и хотел — корректировка уже готового)
        setTimeout(() => { rulerClickLock = false; }, 0);
        return;
    }

    // 2-я точка (B) — фиксируем отрезок
    rulerPointB = e.latlng;

    rulerMarkerB = L.circleMarker(rulerPointB, {
        radius: 6,
        className: 'ruler-point',
        interactive: true,
    }).addTo(map);

    updateRuler(rulerPointB, true);
    rulerFinished = true;

    // Теперь можно корректировать позицию drag’ом по точкам
    bindPointDrag(rulerMarkerA, 'A');
    bindPointDrag(rulerMarkerB, 'B');

    setTimeout(() => { rulerClickLock = false; }, 0);
}

map.on('click', handleRulerClick);

// Динамика построения (пока выбираем B) + drag точек после построения
map.on('mousemove', (e) => {
    // Drag точек (после построения)
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

    // Динамика (пока B ещё не поставлена)
    if (!rulerActive || !rulerPointA || !rulerLine || rulerFinished) return;
    updateRuler(e.latlng, false);
});


map.on('mouseup', () => {
    if (!rulerDraggingPoint) return;
    rulerDraggingPoint = null;
    map.dragging.enable();
});

map.on('touchend', () => {
    if (!rulerDraggingPoint) return;
    rulerDraggingPoint = null;
    map.dragging.enable();
});


/* =========================
   8) ESC — удаление метки + сброс линейки
   ========================= */

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    // Удаляем обычную метку
    if (sharedMarker) {
        map.removeLayer(sharedMarker);
        sharedMarker = null;
    }

    // Сбрасываем линейку + выключаем режим
    if (rulerActive || rulerFinished) {
        resetRuler();
        rulerActive = false;
        rulerFinished = false;
        rulerClickLock = false;

        document.querySelector('.ruler-btn')?.classList.remove('active');
        map.getContainer().classList.remove('ruler-mode');
        setCursorMode();
    }
});

// Стартовое состояние курсора
setCursorMode();
