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

const BUSINESS_TYPES = {
    gas: {
        name: 'АЗС',
        icon: 'assets/icons/gas.png'
    },
    cafe: {
        name: 'Кафе',
        icon: 'assets/icons/cafe.png'
    },
    petshop: {
        name: 'Зоомагазин',
        icon: 'assets/icons/petshop.png'
    },
    ranch: {
        name: 'Ранчо',
        icon: 'assets/icons/ranch.png'
    },
    gold: {
        name: 'Золотая шахта',
        icon: 'assets/icons/gold.png'
    }
};


// Фон
L.imageOverlay('assets/map.jpg', bounds).addTo(map);
map.fitBounds(bounds);

// ===============================
// ПЕРЕВОД КООРДИНАТ ИЗ SA:MP
// ===============================

// GTA SA координаты:
// X: -3000 ... +3000
// Y: -3000 ... +3000

function sampToMap(x, y) {
    const mapX = (x + 3000) / 6000 * MAP_SIZE;
    const mapY = (y + 3000) / 6000 * MAP_SIZE;
    return [mapY, mapX];
}

// ===============================
// ЗАГРУЗКА БИЗНЕСОВ
// ===============================

fetch('./data/businesses.json')
  .then(r => r.json())
  .then(businesses => {
      businesses.forEach(b => {

          const pos = sampToMap(b.x, b.y);
          const type = BUSINESS_TYPES[b.type];

          if (!type) {
              console.warn('Неизвестный тип бизнеса:', b.type);
              return;
          }

          const icon = L.icon({
              iconUrl: type.icon,
              iconSize: [28, 28],
              iconAnchor: [16, 32],
              popupAnchor: [0, -32]
          });

          const marker = L.marker(pos, { icon }).addTo(map);

          marker.bindTooltip(
              `
              <b>${b.name}</b><br>
              Тип: ${type.name}<br>
              Владелец: ${b.owner}
              `,
              {
                  direction: 'top',
                  offset: [0, -10],
                  opacity: 0.95
              }
          );
      });
  });
