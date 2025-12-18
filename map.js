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

function enableRuler() {
    rulerActive = true;
    rulerPointA = null;

    if (rulerLine) map.removeLayer(rulerLine);
    if (rulerLabel) map.removeLayer(rulerLabel);
}

map.on('click', (e) => {
    if (!rulerActive) return;

    // Первая точка
    if (!rulerPointA) {
        rulerPointA = e.latlng;

        rulerMarkerA = L.circleMarker(rulerPointA, {
            radius: 5,
            className: 'ruler-point'
        }).addTo(map);

        rulerLine = L.polyline([rulerPointA, rulerPointA], {
            color: '#7ab6ff',
            weight: 2,
            dashArray: '6,4'
        }).addTo(map);

        return;
    }

    // Вторая точка — фиксируем
    rulerMarkerB = L.circleMarker(e.latlng, {
        radius: 5,
        className: 'ruler-point'
    }).addTo(map);

    updateRuler(e.latlng, true);

    rulerActive = false;
    document.querySelector('.ruler-btn')?.classList.remove('active');
});


map.on('mousemove', (e) => {
    if (!rulerActive || !rulerPointA || !rulerLine) return;
    updateRuler(e.latlng, false);
});


function getDistanceMeters(a, b) {
    const p1 = mapToSamp(a.lat, a.lng);
    const p2 = mapToSamp(b.lat, b.lng);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    return Math.sqrt(dx * dx + dy * dy);
}

function updateRuler(pointB, fixed) {
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

    // если линия зафиксирована — убираем пунктир
    if (fixed) {
        rulerLine.setStyle({ dashArray: null });
    }
}



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

        btn.onclick = () => {
            toggleRuler(btn);
        };

        return btn;
    }
});

map.addControl(new RulerControl());

let rulerActive = false;
let rulerPointA = null;

let rulerLine = null;
let rulerMarkerA = null;
let rulerMarkerB = null;
let rulerLabel = null;


function toggleRuler(btn) {
    rulerActive = !rulerActive;

    if (!rulerActive) {
        resetRuler();
        btn.classList.remove('active');
        return;
    }

    btn.classList.add('active');
    rulerPointA = null;
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
}



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


function createSharedMarker(lat, lng) {
    if (sharedMarker) map.removeLayer(sharedMarker);

    sharedMarker = L.marker([lat, lng], { draggable: true }).addTo(map);

    function updatePopup() {
        const p = sharedMarker.getLatLng();
        const s = mapToSamp(p.lat, p.lng);
        const url = new URL(location.href);

        url.searchParams.set('x', s.x);
        url.searchParams.set('y', s.y);
        url.searchParams.set('z', map.getZoom());

        const html = `
            <b>Координаты</b><br>
            X: ${s.x}<br>
            Y: ${s.y}<br><br>
            <button id="copy-link">📋 Скопировать ссылку</button>
        `;

        sharedMarker.bindPopup(html).openPopup();

        setTimeout(() => {
            const btn = document.getElementById('copy-link');
            if (btn) {
                btn.onclick = () => {
                    copyToClipboard(url.toString());
                    btn.innerText = '✅ Скопировано';
                };
            }
        }, 0);
    }

    updatePopup();

    sharedMarker.on('dragstart', () => {
        sharedMarker.closePopup();
    });

    sharedMarker.on('dragend', () => {
        updatePopup();
    });

    sharedMarker.on('popupclose', () => {
        if (sharedMarker) {
            map.removeLayer(sharedMarker);
            sharedMarker = null;
        }
    });
}


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


map.on('click', (e) => {
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

    // ✅ ВЕШАЕМ ДО openPopup(), чтобы работало на любой новой метке сразу
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
});




const params = new URLSearchParams(location.search);
if (params.has('x') && params.has('y')) {
    const pos = sampToMap(+params.get('x'), +params.get('y'));
    map.setView(pos, +params.get('z') || 0, { animate: false });

    sharedMarker = L.marker(pos, { draggable: false }).addTo(map);
    sharedMarker.bindPopup(buildPopup(sharedMarker, false)).openPopup();
}


document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sharedMarker) {
        map.removeLayer(sharedMarker);
        sharedMarker = null;
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (rulerLine) map.removeLayer(rulerLine);
        if (rulerLabel) map.removeLayer(rulerLabel);

        rulerLine = null;
        rulerLabel = null;
        rulerPointA = null;
        rulerActive = false;
    }
});
