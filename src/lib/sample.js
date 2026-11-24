import { uid } from './db.js';
import { addDays, todayISO } from './dates.js';

// Sample trip: Seoul – Busan, 25 Nov – 4 Dec (9 nights), next occurrence from today.
export function makeSampleTrip(home = 'MYR') {
  const today = todayISO();
  let year = Number(today.slice(0, 4));
  if (today > `${year}-12-04`) year += 1;
  const start = `${year}-11-25`;
  const end = `${year}-12-04`;
  const D = (n) => addDays(start, n);
  const rate = 360;

  const plansRaw = [
    [0, '09:05', 'Flight KUL → ICN', 'Kuala Lumpur International Airport', 'flight', 'Seat 32A. Bag drop closes 60 min before.'],
    [0, '16:50', 'Airport Railroad to Seoul Station', 'Incheon Airport Station', 'transport', ''],
    [0, '18:30', 'Check in · Myeongdong hotel', 'Myeongdong, Seoul', 'stay', ''],
    [0, '20:00', 'Myeongdong street food', 'Myeongdong 8-gil, Seoul', 'food', ''],
    [1, '09:30', 'Gyeongbokgung Palace', 'Gyeongbokgung Palace, Seoul', 'sight', 'Changing of the guard at 10:00.'],
    [1, '12:30', 'Lunch in Insadong', 'Insadong, Seoul', 'food', ''],
    [1, '14:30', 'Bukchon Hanok Village', 'Bukchon Hanok Village, Seoul', 'sight', ''],
    [1, '19:00', 'N Seoul Tower at night', 'N Seoul Tower', 'sight', ''],
    [2, '10:00', 'Changdeokgung Secret Garden', 'Changdeokgung, Seoul', 'sight', ''],
    [2, '13:00', 'Gwangjang Market', 'Gwangjang Market, Seoul', 'food', ''],
    [2, '16:00', 'Shopping in Hongdae', 'Hongdae, Seoul', 'free', ''],
    [3, '07:30', 'DMZ day tour', 'Imjingak, Paju', 'sight', 'Bring passport.'],
    [4, '11:00', 'Seongsu cafés', 'Seongsu-dong, Seoul', 'free', ''],
    [5, '08:00', 'KTX Seoul → Busan', 'Seoul Station', 'transport', 'Car 5, seat 12A'],
    [5, '11:30', 'Check in · Haeundae hotel', 'Haeundae, Busan', 'stay', ''],
    [5, '15:00', 'Haeundae Beach', 'Haeundae Beach, Busan', 'sight', ''],
    [6, '10:00', 'Gamcheon Culture Village', 'Gamcheon Culture Village, Busan', 'sight', ''],
    [6, '13:00', 'Jagalchi Fish Market', 'Jagalchi Market, Busan', 'food', ''],
    [7, '09:00', 'Haedong Yonggungsa Temple', 'Haedong Yonggungsa, Busan', 'sight', ''],
    [7, '18:00', 'Seafood dinner in Millak', 'Millak-dong, Busan', 'food', ''],
    [9, '11:00', 'Check out', 'Haeundae, Busan', 'stay', ''],
    [9, '15:40', 'Flight PUS → KUL', 'Gimhae International Airport', 'flight', ''],
  ];
  const plans = plansRaw.map(([d, time, title, place, category, notes], i) => ({
    id: uid(), date: D(d), time, title, place, category, notes, docId: null, order: i,
  }));

  const dayCountry = {};
  for (let i = 0; i <= 9; i++) dayCountry[D(i)] = 'KR';

  const pack = [
    ['Passport', 'Documents', true], ['Cash & cards', 'Documents', true], ['Printed bookings', 'Documents', false],
    ['Winter coat', 'Clothes', true], ['Thermal innerwear', 'Clothes', true], ['Gloves', 'Clothes', false], ['Beanie', 'Clothes', false],
    ['Underwear (8)', 'Clothes', true], ['Socks (8)', 'Clothes', true], ['Comfortable walking shoes', 'Clothes', false],
    ['Phone charger', 'Electronics', true], ['Power bank', 'Electronics', false], ['Travel adapter', 'Electronics', true],
    ['Toothbrush & toothpaste', 'Toiletries', false], ['Moisturiser', 'Toiletries', false], ['Lip balm', 'Toiletries', true],
    ['Hand warmers', 'Others', false], ['Day bag', 'Others', true],
  ];

  const passportId = uid();
  const flightDocId = uid();
  plans[0].docId = flightDocId;

  // Travellers and a group fund so the sharing and fund screens can be previewed.
  const adam = uid(), siti = uid(), farah = uid();
  const travellers = [
    { id: 'you', name: 'You', color: '#C81E63' },
    { id: adam, name: 'Adam', color: '#0E7490' },
    { id: siti, name: 'Siti', color: '#7C3AED' },
    { id: farah, name: 'Farah', color: '#B45309' },
  ];
  plans[0].who = 'you'; plans[0].whoNote = 'Booked by';
  plans[13].who = adam; plans[13].whoNote = 'Buys tickets';
  plans[11].who = siti; plans[11].whoNote = 'In charge';
  const all = travellers.map((t) => t.id);
  const krw = (n) => Math.round((n / rate) * 100);
  let seq = 0;
  const fe = (o) => ({ id: uid(), createdAt: Date.now() + seq++, note: '', ...o });
  const fund = {
    enabled: true, perPerson: 30000, members: [], settledAt: null,
    entries: [
      fe({ type: 'in', memberId: 'you', amount: 300, currency: home, rate: 1, sen: 30000, date: addDays(start, -20), method: 'transfer' }),
      fe({ type: 'in', memberId: adam, amount: 300, currency: home, rate: 1, sen: 30000, date: addDays(start, -18), method: 'transfer' }),
      fe({ type: 'in', memberId: siti, amount: 300, currency: home, rate: 1, sen: 30000, date: addDays(start, -15), method: 'cash' }),
      fe({ type: 'in', memberId: farah, amount: 150, currency: home, rate: 1, sen: 15000, date: addDays(start, -12), method: 'cash' }),
      fe({ type: 'out', title: 'T-money cards for everyone', category: 'Transport', amount: 80000, currency: 'KRW', rate, sen: krw(80000), date: start, splitBetween: all }),
      fe({ type: 'out', title: 'Korean BBQ dinner', category: 'Food', amount: 180000, currency: 'KRW', rate, sen: krw(180000), date: addDays(start, 1), splitBetween: all }),
      fe({ type: 'own', paidBy: adam, title: 'Taxi to Gamcheon', category: 'Transport', amount: 24000, currency: 'KRW', rate, sen: krw(24000), date: addDays(start, 6), splitBetween: all }),
    ],
  };

  const exp = (amount, currency, category, note, date) => ({
    id: uid(), amount, currency, rate: currency === home ? 1 : rate, home,
    homeAmount: currency === home ? amount : Math.round((amount / rate) * 100) / 100,
    category, note, date, receiptId: null, createdAt: Date.now(),
  });

  return {
    id: uid(),
    sample: true,
    sampleId: 'seoul',
    name: 'Seoul – Busan',
    destinations: [{ country: 'KR', city: 'Seoul' }, { country: 'KR', city: 'Busan' }],
    start, end,
    cover: null,
    color: '#A3195B',
    budget: 8000,
    categoryBudgets: { Flights: 1800, Stay: 2600, Transport: 600, Food: 1500, Shopping: 900, Activities: 600 },
    localCurrencies: ['KRW'],
    rates: { KRW: { mode: 'live', manual: null, locked: null, fallback: rate } },
    dayCountry,
    plans,
    packing: pack.map(([name, cat, packed]) => ({ id: uid(), name, cat, packed })),
    todos: [
      { id: uid(), text: 'Book accommodation', done: true },
      { id: uid(), text: 'Get eSIM or local SIM', done: true },
      { id: uid(), text: 'Buy travel insurance', done: false },
      { id: uid(), text: 'Exchange currency', done: false },
      { id: uid(), text: 'Download offline maps', done: false },
    ],
    docs: [
      { id: passportId, type: 'passport', title: 'Passport', status: 'valid', number: 'A12345678', expiry: `${year + 1}-04-18`, fileId: null, notes: '' },
      { id: flightDocId, type: 'flight', title: 'Flights KUL ⇄ Korea', status: 'booked', number: 'Booking XK7P2Q', expiry: '', fileId: null, notes: '' },
      { id: uid(), type: 'hotel', title: 'Hotels Seoul & Busan', status: 'booked', number: '', expiry: '', fileId: null, notes: '' },
      { id: uid(), type: 'visa', title: 'K-ETA', status: 'check', number: '', expiry: '', fileId: null, notes: 'Check whether K-ETA is still required.' },
    ],
    expenses: [
      exp(1850, home, 'Flights', 'Return flights', addDays(start, -70)),
      exp(669600, 'KRW', 'Stay', 'Hotel Seoul, 5 nights', addDays(start, -40)),
      exp(59800, 'KRW', 'Transport', 'KTX Seoul → Busan', addDays(start, -14)),
      exp(45000, 'KRW', 'Activities', 'DMZ day tour', addDays(start, -10)),
    ],
    emergency: {
      contacts: [{ id: uid(), name: 'Aisyah (sister)', phone: '+60 12-345 6789' }],
      bloodType: 'O+',
      medical: 'No known allergies',
      embassy: { name: 'Embassy of Malaysia, Seoul', phone: '', address: 'Hannam-dong, Yongsan-gu, Seoul' },
    },
    travellers,
    fund,
    domestic: false,
    journeyId: null,
    createdAt: Date.now(),
  };
}
