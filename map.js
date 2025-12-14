// Размер карты (подгоняется под твоё изображение)
const MAP_SIZE = 6000;

// Границы карты
const bounds = [[0, 0], [MAP_SIZE, MAP_SIZE]];

// Leaflet карта
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2
});

// Фон
L.imageOverlay('assets/map.jpg', bounds).addTo(map);
map.fitBounds(bounds);

// ТЕСТ: центр карты
const testPos = sampToMap(0, 0);
L.marker(testPos).addTo(map).bindTooltip('ЦЕНТР SA');

// ===============================
// ПЕРЕВОД КООРДИНАТ ИЗ SA:MP
// ===============================

// GTA SA координаты:
// X: -3000 ... +3000
// Y: -3000 ... +3000

function sampToMap(x, y) {
    const mapX = (x + 3000) / 6000 * MAP_SIZE;
    const mapY = (3000 - y) / 6000 * MAP_SIZE; // инверсия Y
    return [mapY, mapX];
}

// ===============================
// ЗАГРУЗКА БИЗНЕСОВ
// ===============================

fetch('data/businesses.json')
    .then(r => r.json())
    .then(businesses => {
        businesses.forEach(b => {
            const pos = sampToMap(b.x, b.y);

            const marker = L.marker(pos, {
                icon: L.divIcon({
                    className: '',
                    html: `<div class="business-marker"></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7]
                })
            }).addTo(map);

            marker.bindTooltip(
                `<b>${b.name}</b><br>ID: ${b.id}`,
                { direction: 'top', offset: [0, -10] }
            );
        });
    });
