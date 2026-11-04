// Store model - LPA's physical store/warehouse locations for the store-locator mashup.
// Same idea as the Product model: in-memory data the controllers talk to.
const stores = [
  {
    id: 1,
    name: 'LPA — Brisbane (HQ & Warehouse)',
    address: '123 Queen Street, Brisbane City QLD 4000',
    phone: '(07) 3000 1234',
    hours: 'Mon–Sat 9am–5:30pm',
    lat: -27.4705,
    lng: 153.0260,
  },
  {
    id: 2,
    name: 'LPA — Sydney',
    address: '45 George Street, Sydney NSW 2000',
    phone: '(02) 9000 5678',
    hours: 'Mon–Sun 9am–6pm',
    lat: -33.8688,
    lng: 151.2093,
  },
  {
    id: 3,
    name: 'LPA — Melbourne',
    address: '200 Bourke Street, Melbourne VIC 3000',
    phone: '(03) 8000 9012',
    hours: 'Mon–Sun 10am–6pm',
    lat: -37.8136,
    lng: 144.9631,
  },
];

class Store {
  static all() {
    return stores;
  }
}

module.exports = Store;
