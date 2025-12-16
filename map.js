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
                `<b>${b.name}</b><br>Владелец: ${b.owner}`,
                { direction: 'top', offset: [0, -10], sticky: true }
            );
        });
    });

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

let sharedMarker = null;

function createSharedMarker(lat, lng) {
    if (sharedMarker) map.removeLayer(sharedMarker);

    sharedMarker = L.marker([lat, lng], { draggable: true }).addTo(map);

    function update() {
        const p = sharedMarker.getLatLng();
        const s = mapToSamp(p.lat, p.lng);
        const url = new URL(location.href);
        url.searchParams.set('x', s.x);
        url.searchParams.set('y', s.y);
        url.searchParams.set('z', map.getZoom());

        sharedMarker.setPopupContent(`
            <b>Координаты</b><br>
            X: ${s.x}<br>
            Y: ${s.y}<br><br>
            <button id="copy-link">📋 Скопировать ссылку</button>
        `).openPopup();

        setTimeout(() => {
            const btn = document.getElementById('copy-link');
            if (btn) btn.onclick = () => {
                copyToClipboard(url.toString());
                btn.innerText = '✅ Скопировано';
            };
        }, 0);
    }

    update();
    sharedMarker.on('dragend', update);
    sharedMarker.on('popupclose', () => {
        map.removeLayer(sharedMarker);
        sharedMarker = null;
    });
}

map.on('click', e => {
    if (e.originalEvent.target.closest('.leaflet-marker-icon')) return;
    createSharedMarker(e.latlng.lat, e.latlng.lng);
});

const params = new URLSearchParams(location.search);
if (params.has('x') && params.has('y')) {
    const pos = sampToMap(+params.get('x'), +params.get('y'));
    map.setView(pos, +params.get('z') || 0, { animate: false });
    createSharedMarker(pos[0], pos[1]);
}
