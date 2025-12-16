// ===============================
// НАСТРОЙКИ КАРТЫ
// ===============================

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

// ===============================
// ИНИЦИАЛИЗАЦИЯ КАРТЫ
// ===============================

const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    maxBounds: worldBounds,
    maxBoundsViscosity: 0.0
});

// Фон
L.imageOverlay('assets/map.jpg', imageBounds).addTo(map);
map.fitBounds(imageBounds);
// ===============================
// ПЕРЕХОД ПО ССЫЛКЕ С КООРДИНАТАМИ
// ===============================

const params = new URLSearchParams(window.location.search);

if (params.has('x') && params.has('y')) {
    const x = parseFloat(params.get('x'));
    const y = parseFloat(params.get('y'));
    const z = params.has('z') ? parseInt(params.get('z')) : 0;

    const pos = sampToMap(x, y);

    map.setView(pos, z, { animate: false });

    L.marker(pos)
        .addTo(map)
        .bindPopup(`
            <b>Отметка по ссылке</b><br>
            X: ${x}<br>
            Y: ${y}
        `)
        .openPopup();
}


// ===============================
// МОБИЛЬНЫЕ УЛУЧШЕНИЯ
// ===============================

if (L.Browser.mobile) {
    map.tap = true;
    map.touchZoom.enable();
    map.doubleClickZoom.disable();
}

// ===============================
// ТИПЫ ОБЪЕКТОВ
// ===============================

const BUSINESS_TYPES = {
    gas: { name: 'Бизнес', icon: 'assets/icons/gas.png' },
    cafe: { name: 'Бизнес', icon: 'assets/icons/cafe.png' },
    petshop: { name: 'Бизнес', icon: 'assets/icons/petshop.png' },
    ranch: { name: 'Бизнес', icon: 'assets/icons/ranch.png' },
    gold: { name: 'Бизнес', icon: 'assets/icons/gold.png' },
    icecream: { name: 'Бизнес', icon: 'assets/icons/icecream.png' },
    hotdog: { name: 'Бизнес', icon: 'assets/icons/hotdog.png' },
    canteen: { name: 'Бизнес', icon: 'assets/icons/canteen.png' }
};


function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            document.execCommand('copy');
        } catch (err) {
            console.warn('Не удалось скопировать ссылку');
        }

        document.body.removeChild(textarea);
    }
}

// ===============================
// ПЕРЕВОД КООРДИНАТ ИЗ SA:MP
// ===============================

function sampToMap(x, y) {
    const mapX = (x + 3000) / 6000 * MAP_SIZE;
    const mapY = (y + 3000) / 6000 * MAP_SIZE;
    return [mapY, mapX];
}
function mapToSamp(lat, lng) {
    const x = (lng / MAP_SIZE) * 6000 - 3000;
    const y = (lat / MAP_SIZE) * 6000 - 3000;
    return {
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4))
    };
}


// ===============================
// ЗАГРУЗКА ОБЪЕКТОВ
// ===============================

fetch('./data/businesses.json')
    .then(r => r.json())
    .then(businesses => {
        businesses.forEach(b => {
            const pos = sampToMap(b.x, b.y);
            const type = BUSINESS_TYPES[b.type];

            if (!type) return;

            const icon = L.icon({
                iconUrl: type.icon,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });

            const marker = L.marker(pos, { icon }).addTo(map);

            marker.bindTooltip(
                `<b>${b.name}</b><br>
                 Тип: ${type.name}<br>
                 Владелец: ${b.owner}`,
                {
                    direction: 'top',
                    offset: [0, -10],
                    opacity: 0.95,
                    sticky: true
                }
            );
        });
    });
// ===============================
// КНОПКА ЦЕНТРИРОВАНИЯ
// ===============================

const CenterControl = L.Control.extend({
    options: {
        position: 'topleft'
    },

    onAdd: function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar');

        btn.innerHTML = '📍';
        btn.title = 'Вернуться в центр карты';
        btn.style.width = '32px';
        btn.style.height = '30px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '16px';
        btn.style.background = '#fff';
        btn.style.color = '#fff';
        btn.style.border = 'none';

        L.DomEvent.disableClickPropagation(btn);
        L.DomEvent.on(btn, 'click', () => {
            map.flyTo(MAP_CENTER, map.getZoom(), {
                animate: true,
                duration: 0.6
            });
        });

        return btn;
    }
});

map.addControl(new CenterControl());
let sharedMarker = null;

map.on('click', (e) => {
    const { lat, lng } = e.latlng;

    // Удаляем старую метку
    if (sharedMarker) {
        map.removeLayer(sharedMarker);
    }

    sharedMarker = L.marker([lat, lng]).addTo(map);

    const samp = mapToSamp(lat, lng);
    const zoom = map.getZoom();

    const url = new URL(window.location.href);
    url.searchParams.set('x', samp.x);
    url.searchParams.set('y', samp.y);
    url.searchParams.set('z', zoom);

    const html = `
        <b>Координаты</b><br>
        X: ${samp.x}<br>
        Y: ${samp.y}<br><br>
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
});
