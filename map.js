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

            L.marker(sampToMap(b.x, b.y), {
                icon: L.icon({
                    iconUrl: type.icon,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            }).addTo(map).bindTooltip(
                `<b>${b.name}</b><br>Тип: Бизнес<br>Владелец: ${b.owner}`,
                { direction: 'top', offset: [0, -10], sticky: true }
            );
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

function getDistanceMeters(a, b) {
    const p1 = mapToSamp(a.lat, a.lng);
    const p2 = mapToSamp(b.lat, b.lng);

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
   6) Обычная метка
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
                <img src="assets/img/copy.gif" class="copy-icon">
                Скопировать координаты
            </button>
        ` : ``}
    `;
}

map.on('click', (e) => {
    if (rulerActive || rulerClickLock) return;
    if (e.originalEvent.target.closest('.leaflet-marker-icon')) return;

    if (sharedMarker) map.removeLayer(sharedMarker);

    sharedMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
    sharedMarker.bindPopup(buildPopup(sharedMarker)).openPopup();

    sharedMarker.on('popupopen', (ev) => {
        setTimeout(() => {
            const btn = ev.popup.getElement()?.querySelector('.copy-link');
            if (!btn) return;

            btn.onclick = () => {
                copyToClipboard(btn.dataset.url);
                btn.classList.add('copied');
                btn.setAttribute('data-copied', '1');
                btn.innerHTML = `<img src="assets/img/complete.gif" class="copy-icon">Скопировано`;
            };
        }, 0);
    });
});


/* =========================
   7) Линейка (desktop drag only)
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

let rulerDragging = false;
let rulerDragStart = null;

const RulerControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
        const btn = L.DomUtil.create('button', 'leaflet-bar ruler-btn');
        btn.innerHTML = '📏';
        btn.style.width = '32px';
        btn.style.height = '30px';
        btn.style.background = '#fff';
        btn.style.border = 'none';
        L.DomEvent.disableClickPropagation(btn);
        btn.onclick = () => toggleRuler(btn);
        return btn;
    }
});
map.addControl(new RulerControl());

function toggleRuler(btn) {
    if (rulerActive) {
        resetRuler();
        rulerActive = false;
        rulerFinished = false;
        btn.classList.remove('active');
        map.getContainer().classList.remove('ruler-mode');
        return;
    }

    resetRuler();
    rulerActive = true;
    rulerFinished = false;
    btn.classList.add('active');
    map.getContainer().classList.add('ruler-mode');

    if (sharedMarker) {
        map.removeLayer(sharedMarker);
        sharedMarker = null;
    }
}

function resetRuler() {
    if (rulerLine) map.removeLayer(rulerLine);
    if (rulerMarkerA) map.removeLayer(rulerMarkerA);
    if (rulerMarkerB) map.removeLayer(rulerMarkerB);
    if (rulerLabel) map.removeLayer(rulerLabel);

    rulerLine = rulerMarkerA = rulerMarkerB = rulerLabel = null;
    rulerPointA = rulerPointB = null;
}

map.on('click', (e) => {
    if (!rulerActive || rulerClickLock || rulerFinished) return;

    rulerClickLock = true;

    if (!rulerPointA) {
        rulerPointA = e.latlng;

        rulerMarkerA = L.circleMarker(rulerPointA, {
            radius: 6,
            className: 'ruler-point'
        }).addTo(map);

        rulerLine = L.polyline([rulerPointA, rulerPointA], {
            color: '#ffcc00',
            weight: 2,
            dashArray: '6,4'
        }).addTo(map);

        setTimeout(() => rulerClickLock = false, 0);
        return;
    }

    rulerPointB = e.latlng;

    rulerMarkerB = L.circleMarker(rulerPointB, {
        radius: 6,
        className: 'ruler-point'
    }).addTo(map);

    updateRuler(rulerPointB, true);
    rulerFinished = true;

    bindDesktopDrag();
    setTimeout(() => rulerClickLock = false, 0);
});

function bindDesktopDrag() {
    if (L.Browser.mobile) return;

    [rulerMarkerA, rulerMarkerB].forEach(m => {
        m.on('mousedown', (e) => {
            rulerDragging = true;
            rulerDragStart = e.latlng;
            map.dragging.disable();
            L.DomEvent.stopPropagation(e.originalEvent);
        });
    });
}

map.on('mousemove', (e) => {
    if (!rulerDragging) {
        if (rulerActive && rulerPointA && !rulerFinished)
            updateRuler(e.latlng, false);
        return;
    }

    const dx = e.latlng.lat - rulerDragStart.lat;
    const dy = e.latlng.lng - rulerDragStart.lng;

    rulerPointA = L.latLng(rulerPointA.lat + dx, rulerPointA.lng + dy);
    rulerPointB = L.latLng(rulerPointB.lat + dx, rulerPointB.lng + dy);

    rulerMarkerA.setLatLng(rulerPointA);
    rulerMarkerB.setLatLng(rulerPointB);
    rulerLine.setLatLngs([rulerPointA, rulerPointB]);
    updateRuler(rulerPointB, true);

    rulerDragStart = e.latlng;
});

map.on('mouseup', () => {
    if (!rulerDragging) return;
    rulerDragging = false;
    map.dragging.enable();
});


/* =========================
   8) ESC
   ========================= */

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;

    if (sharedMarker) map.removeLayer(sharedMarker);

    if (rulerActive || rulerFinished) {
        resetRuler();
        rulerActive = false;
        rulerFinished = false;
        document.querySelector('.ruler-btn')?.classList.remove('active');
        map.getContainer().classList.remove('ruler-mode');
    }
});
