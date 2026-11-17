// ISO 4217 currencies, symbols, country mapping and display rules.
const ISO =
  'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL'.split(' ');

const SYMBOLS = {
  MYR: 'RM', IDR: 'Rp', KRW: '₩', THB: '฿', JPY: '¥', CNY: 'CN¥', PHP: '₱', SGD: 'S$', VND: '₫',
  USD: '$', EUR: '€', GBP: '£', AUD: 'A$', NZD: 'NZ$', CAD: 'C$', HKD: 'HK$', TWD: 'NT$', MOP: 'MOP$',
  INR: '₹', LKR: 'Rs', PKR: 'Rs', NPR: 'Rs', BDT: '৳', KHR: '៛', LAK: '₭', MMK: 'K', BND: 'B$',
  TRY: '₺', RUB: '₽', UAH: '₴', ILS: '₪', NGN: '₦', ZAR: 'R', BRL: 'R$', MXN: 'MX$', KZT: '₸',
  MNT: '₮', GEL: '₾', AZN: '₼', PLN: 'zł', CZK: 'Kč', HUF: 'Ft', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  ISK: 'kr', EGP: 'E£', MVR: 'Rf', QAR: 'QR', KWD: 'KD', BHD: 'BD', JOD: 'JD', AED: 'AED', SAR: 'SAR',
  CHF: 'CHF', OMR: 'OMR', ARS: 'AR$', CLP: 'CL$', COP: 'CO$', PEN: 'S/', CRC: '₡', PYG: '₲', GHS: 'GH₵',
  KES: 'KSh', TZS: 'TSh', UGX: 'USh', MAD: 'MAD', FJD: 'FJ$', XPF: 'F', XAF: 'FCFA', XOF: 'CFA',
};

// Currencies shown without decimals (ISO minor unit 0 plus those whose cash use has no cents).
const ZERO = new Set('BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX VND VUV XAF XOF XPF IDR LAK MMK KHR UZS IRR LBP TWD HUF'.split(' '));
const THREE = new Set('BHD IQD JOD KWD LYD OMR TND'.split(' '));

let names;
try { names = new Intl.DisplayNames(['en'], { type: 'currency' }); } catch { names = null; }

export const allCurrencies = ISO.map((code) => ({ code, name: currencyName(code), symbol: symbol(code) }));

export function currencyName(code) {
  try { return names ? names.of(code) : code; } catch { return code; }
}

export function symbol(code) {
  if (SYMBOLS[code]) return SYMBOLS[code];
  try {
    const p = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(1)
      .find((x) => x.type === 'currency');
    return p ? p.value : code;
  } catch { return code; }
}

export const decimals = (code) => (ZERO.has(code) ? 0 : THREE.has(code) ? 3 : 2);

export function round(amount, code) {
  const f = 10 ** decimals(code);
  return Math.round(amount * f) / f;
}

export function fmtNumber(n, code, dp = decimals(code)) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n || 0);
}

// Short form for big amounts: Rp 150rb, Rp 1.2jt, ₩ 1.5M
export function shortNumber(n, code) {
  const abs = Math.abs(n);
  const units = code === 'IDR' ? [[1e12, 'T'], [1e9, 'M'], [1e6, 'jt'], [1e3, 'rb']] : [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [v, s] of units) {
    if (abs >= v) {
      const x = n / v;
      const str = Math.abs(x) >= 100 ? Math.round(x).toString() : (Math.round(x * 10) / 10).toString();
      return str + s;
    }
  }
  return fmtNumber(n, code);
}

export const SHORT_THRESHOLD = 100000;

export function money(amount, code, { short = false, sign = false, whole = false } = {}) {
  const sym = symbol(code);
  const neg = amount < 0;
  const abs = Math.abs(amount || 0);
  const num = short && abs >= SHORT_THRESHOLD ? shortNumber(abs, code) : fmtNumber(whole ? Math.round(abs) : abs, code, whole ? 0 : undefined);
  return `${neg ? '−' : sign ? '+' : ''}${sym} ${num}`;
}

// Country -> currency
const CC =
  'AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR AZ:AZN BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:BGN BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB BQ:USD BR:BRL BS:BSD BT:BTN BW:BWP BY:BYN BZ:BZD CA:CAD CC:AUD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CW:ANG CX:AUD CY:EUR CZ:CZK DE:EUR DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GP:EUR GQ:XAF GR:EUR GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD JO:JOD JP:JPY KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR LR:LRD LS:LSL LT:EUR LU:EUR LV:EUR LY:LYD MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MP:USD MQ:EUR MR:MRU MS:XCD MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN NA:NAD NC:XPF NE:XOF NF:AUD NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NU:NZD NZ:NZD OM:OMR PA:PAB PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PR:USD PS:ILS PT:EUR PW:USD PY:PYG QA:QAR RE:EUR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SH:SHP SI:EUR SK:EUR SL:SLE SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:ANG SY:SYP SZ:SZL TC:USD TD:XAF TG:XOF TH:THB TJ:TJS TL:USD TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD TZ:TZS UA:UAH UG:UGX US:USD UY:UYU UZ:UZS VA:EUR VC:XCD VE:VES VG:USD VI:USD VN:VND VU:VUV WF:XPF WS:WST XK:EUR YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:ZWL';

export const countryCurrency = Object.fromEntries(CC.split(' ').map((x) => x.split(':')));

let regions;
try { regions = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { regions = null; }
export function countryName(code) {
  if (!code) return '';
  try { return regions ? regions.of(code) : code; } catch { return code; }
}

export const allCountries = Object.keys(countryCurrency)
  .map((code) => ({ code, name: countryName(code), currency: countryCurrency[code] }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Hemisphere/climate hints for packing suggestions
export const TROPICAL = new Set('MY SG ID TH PH VN KH LA MM BN TL LK MV IN BD AE QA BH OM SA KW NG GH KE TZ UG RW BR CO EC PA CR NI HN GT SV BZ CU DO JM HT PR BS FJ PG SB VU WS TO MU SC RE KM'.split(' '));
export const SOUTHERN = new Set('AU NZ AR CL UY PY ZA NA BW ZW ZM MZ LS SZ MG BO'.split(' '));
