import { uid } from './db.js';
import { addDays, todayISO } from './dates.js';

// Domestic sample trip: Penang, 3 days by car from Kuala Lumpur, with a group fund of 5 people.
export function makeSamplePenang(home = 'MYR') {
  const today = todayISO();
  let year = Number(today.slice(0, 4));
  if (today > `${year}-12-20`) year += 1;
  const start = `${year}-12-18`;
  const end = `${year}-12-20`;
  const D = (n) => addDays(start, n);

  const adam = uid(), siti = uid(), hafiz = uid(), nurul = uid();
  const travellers = [
    { id: 'you', name: 'You', color: '#C81E63' },
    { id: adam, name: 'Adam', color: '#0E7490' },
    { id: siti, name: 'Siti', color: '#7C3AED' },
    { id: hafiz, name: 'Hafiz', color: '#B45309' },
    { id: nurul, name: 'Nurul', color: '#15803D' },
  ];
  const all = travellers.map((t) => t.id);

  // [day, time, title, place, category, who, role, extra]
  const raw = [
    [0, '07:30', 'Drive to Penang', 'Penang Bridge', 'drive', adam, 'Drives', { from: 'Kuala Lumpur', to: 'George Town', durationMin: 270 }],
    [0, '12:30', 'Lunch: nasi kandar', 'Lebuh Chulia, George Town', 'food', null, '', {}],
    [0, '14:30', 'Check in · George Town hotel', 'Lebuh Chulia, George Town', 'stay', 'you', 'Booked by', {}],
    [0, '16:30', 'Street art walk', 'Armenian Street, George Town', 'sight', siti, 'In charge', {}],
    [0, '19:30', 'Dinner at Gurney Drive hawker centre', 'Gurney Drive, George Town', 'food', null, '', {}],
    [1, '08:00', 'Breakfast: roti canai', 'Transfer Road, George Town', 'food', null, '', {}],
    [1, '09:30', 'Penang Hill funicular', 'Penang Hill Lower Station, Air Itam', 'sight', hafiz, 'Buys tickets', {}],
    [1, '13:00', 'Kek Lok Si Temple', 'Kek Lok Si, Air Itam', 'sight', null, '', {}],
    [1, '16:00', 'Beach time', 'Batu Ferringhi Beach', 'free', null, '', {}],
    [1, '20:00', 'Batu Ferringhi night market', 'Batu Ferringhi', 'sight', null, '', {}],
    [2, '09:00', 'Breakfast at a kopitiam', 'Lebuh Campbell, George Town', 'food', null, '', {}],
    [2, '11:00', 'Check out', 'Lebuh Chulia, George Town', 'stay', null, '', {}],
    [2, '12:00', 'Drive back to KL', 'Penang Bridge', 'drive', siti, 'Drives', { from: 'George Town', to: 'Kuala Lumpur', durationMin: 270 }],
  ];
  const perDay = {};
  const plans = raw.map(([d, time, title, place, category, who, whoNote, extra]) => {
    const date = D(d);
    perDay[date] = perDay[date] ?? 0;
    return { id: uid(), date, time, title, place, category, notes: '', docId: null, order: perDay[date]++, who, whoNote, from: '', to: '', durationMin: null, ...extra };
  });

  const hotelDoc = uid();
  plans[2].docId = hotelDoc;

  const pack = [
    ['IC / ID card', 'Documents', true], ['Driving licence', 'Documents', true], ['Touch ’n Go card', 'Documents', false],
    ['Swimwear', 'Clothes', false], ['Flip-flops', 'Clothes', true], ['Comfortable walking shoes', 'Clothes', true], ['Tops (3)', 'Clothes', false],
    ['Car charger', 'Electronics', true], ['Power bank', 'Electronics', false], ['Phone charger', 'Electronics', true],
    ['Sunscreen', 'Toiletries', false], ['Toothbrush & toothpaste', 'Toiletries', false],
    ['Compact umbrella', 'Others', false], ['Snacks for the drive', 'Others', false],
  ];

  let seq = 0;
  const fe = (o) => ({ id: uid(), createdAt: Date.now() + seq++, note: '', currency: home, rate: 1, sen: Math.round(o.amount * 100), ...o });
  const fund = {
    enabled: true, perPerson: 20000, members: [], settledAt: null,
    entries: [
      fe({ type: 'in', memberId: 'you', amount: 200, date: addDays(start, -14), method: 'transfer' }),
      fe({ type: 'in', memberId: adam, amount: 200, date: addDays(start, -13), method: 'transfer' }),
      fe({ type: 'in', memberId: siti, amount: 200, date: addDays(start, -12), method: 'transfer' }),
      fe({ type: 'in', memberId: hafiz, amount: 200, date: addDays(start, -10), method: 'cash' }),
      fe({ type: 'in', memberId: nurul, amount: 100, date: addDays(start, -9), method: 'cash' }),
      fe({ type: 'out', title: 'Hotel, 2 rooms x 2 nights', category: 'Stay', amount: 520, date: addDays(start, -8), splitBetween: all }),
      fe({ type: 'out', title: 'Petrol, full tank', category: 'Petrol', amount: 180, date: start, splitBetween: all }),
      fe({ type: 'out', title: 'Toll KL to Penang', category: 'Toll', amount: 62.4, date: start, splitBetween: all }),
      fe({ type: 'out', title: 'Dinner at Gurney Drive', category: 'Food', amount: 95, date: start, splitBetween: all }),
      fe({ type: 'own', paidBy: hafiz, title: 'Parking at Penang Hill', category: 'Parking', amount: 20, date: D(1), splitBetween: all }),
    ],
  };

  const exp = (amount, category, note, date) => ({
    id: uid(), amount, currency: home, rate: 1, home, homeAmount: amount,
    category, note, date, receiptId: null, createdAt: Date.now(),
  });

  return {
    id: uid(),
    sample: true,
    sampleId: 'penang',
    name: 'Penang Getaway',
    destinations: [{ country: 'MY', city: 'George Town' }, { country: 'MY', city: 'Batu Ferringhi' }],
    start, end,
    cover: null,
    color: '#A3195B',
    domestic: true,
    budget: 400,
    categoryBudgets: { Flights: 0, Stay: 0, Transport: 0, Food: 150, Shopping: 100, Activities: 80, Petrol: 0, Toll: 0, Parking: 20 },
    localCurrencies: [],
    rates: {},
    dayCountry: { [D(0)]: 'MY', [D(1)]: 'MY', [D(2)]: 'MY' },
    plans,
    packing: pack.map(([name, cat, packed]) => ({ id: uid(), name, cat, packed })),
    todos: [
      { id: uid(), text: 'Service the car', done: true },
      { id: uid(), text: 'Book homestay/hotel', done: true },
      { id: uid(), text: 'Top up Touch ’n Go', done: false },
      { id: uid(), text: 'Check road and weather', done: false },
      { id: uid(), text: 'Download offline maps', done: false },
    ],
    docs: [
      { id: hotelDoc, type: 'hotel', title: 'Hotel George Town', status: 'booked', number: 'Booking PG4821', expiry: '', fileId: null, notes: '' },
      { id: uid(), type: 'id', title: 'IC (MyKad)', status: 'valid', number: '', expiry: '', fileId: null, notes: '' },
      { id: uid(), type: 'other', title: 'Penang Hill tickets', status: 'check', number: '', expiry: '', fileId: null, notes: 'Hafiz is buying them online.' },
    ],
    expenses: [
      exp(80, 'Activities', 'Penang Hill fast lane', addDays(start, -5)),
      exp(35, 'Shopping', 'Tambun biscuits to bring home', D(2)),
    ],
    travellers,
    fund,
    emergency: {
      contacts: [{ id: uid(), name: 'Aisyah (sister)', phone: '+60 12-345 6789' }],
      bloodType: 'O+',
      medical: 'No known allergies',
      embassy: { name: '', phone: '', address: '' },
    },
    journeyId: null,
    createdAt: Date.now(),
  };
}
