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

// ===============================
// ПЕРЕВОД КООРДИНАТ ИЗ SA:MP
// ===============================

function sampToMap(x, y) {
    const mapX = (x + 3000) / 6000 * MAP_SIZE;
    const mapY = (y + 3000) / 6000 * MAP_SIZE;
    return [mapY, mapX];
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
