// Az adatbázis kanonikusan km-ben és literben tárol; ezek a függvények csak a megjelenítéshez és a bevitelhez váltanak.
export type Currency = 'HUF' | 'EUR';
export type DistanceUnit = 'km' | 'mi';
export type VolumeUnit = 'l' | 'gal';
export type ConsumptionUnit = 'l/100km' | 'km/l' | 'mpg';

export interface Preferences {
  currency: Currency;
  distanceUnit: DistanceUnit;
  volumeUnit: VolumeUnit;
  consumptionUnit: ConsumptionUnit;
}

export const DEFAULT_PREFERENCES: Preferences = {
  currency: 'HUF', distanceUnit: 'km', volumeUnit: 'l', consumptionUnit: 'l/100km'
};

export const KM_PER_MILE = 1.609344;
export const LITERS_PER_GALLON = 3.785411784;
// mpg = 235,2146 / (l/100km), US gallonnal.
export const MPG_FACTOR = 235.2146;

// Az API Int32 óraállást és decimal(9,3) mennyiséget fogad.
const MAX_ODOMETER_KM = 2147483647;
const MAX_LITERS = 999999.999;

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function toDistance(km: number, unit: DistanceUnit): number {
  return unit === 'mi' ? Math.round(km / KM_PER_MILE) : km;
}

export function fromDistance(value: number, unit: DistanceUnit): number {
  return Math.round(unit === 'mi' ? value * KM_PER_MILE : value);
}

export function toVolume(liters: number, unit: VolumeUnit): number {
  return unit === 'gal' ? round(liters / LITERS_PER_GALLON, 3) : liters;
}

export function fromVolume(value: number, unit: VolumeUnit): number {
  return round(unit === 'gal' ? value * LITERS_PER_GALLON : value, 3);
}

export function toConsumption(litersPer100Km: number, unit: ConsumptionUnit): number {
  if (!(litersPer100Km > 0)) return 0;
  switch (unit) {
    case 'km/l': return round(100 / litersPer100Km, 2);
    case 'mpg': return round(MPG_FACTOR / litersPer100Km, 2);
    default: return round(litersPer100Km, 2);
  }
}

export const distanceLabel = (unit: DistanceUnit) => unit === 'mi' ? 'mi' : 'km';
export const volumeLabel = (unit: VolumeUnit) => unit === 'gal' ? 'gal' : 'l';
export const consumptionLabel = (unit: ConsumptionUnit) => unit === 'km/l' ? 'km/l' : unit === 'mpg' ? 'mpg' : 'l/100 km';
export const currencyLabel = (currency: Currency) => currency === 'HUF' ? 'Ft' : currency;

// A felső korlátok a választott egységben úgy vannak kerekítve, hogy visszaváltva se lépjék túl a kanonikus határt.
export const maxOdometer = (unit: DistanceUnit) => Math.floor(MAX_ODOMETER_KM / (unit === 'mi' ? KM_PER_MILE : 1));
export const maxVolume = (unit: VolumeUnit) => unit === 'gal'
  ? Math.floor(MAX_LITERS / LITERS_PER_GALLON * 1000) / 1000 : MAX_LITERS;
