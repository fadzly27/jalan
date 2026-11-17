import {
  Plane, TrainFront, BedDouble, UtensilsCrossed, Landmark, Coffee, ShoppingBag, Ticket, Bus,
  BookUser, FileText, ShieldCheck, Stamp, File, Shirt, Cable, Droplets, FolderOpen, Package,
} from 'lucide-react';

export const PLAN_META = {
  flight: { label: 'Flight', icon: Plane, color: '#0066CC' },
  transport: { label: 'Transport', icon: TrainFront, color: '#5856D6' },
  stay: { label: 'Stay', icon: BedDouble, color: '#AF52DE' },
  food: { label: 'Food', icon: UtensilsCrossed, color: '#E0457B' },
  sight: { label: 'Sightseeing', icon: Landmark, color: '#0E9AA7' },
  free: { label: 'Free time', icon: Coffee, color: '#8E8E93' },
};

export const BUDGET_META = {
  Flights: { icon: Plane, color: '#0066CC' },
  Stay: { icon: BedDouble, color: '#AF52DE' },
  Transport: { icon: Bus, color: '#5856D6' },
  Food: { icon: UtensilsCrossed, color: '#E0457B' },
  Shopping: { icon: ShoppingBag, color: '#C77C02' },
  Activities: { icon: Ticket, color: '#0E9AA7' },
};

export const DOC_META = {
  passport: { icon: BookUser, color: '#3D5A80' },
  flight: { icon: Plane, color: '#0066CC' },
  hotel: { icon: BedDouble, color: '#AF52DE' },
  insurance: { icon: ShieldCheck, color: '#24A648' },
  visa: { icon: Stamp, color: '#B4553A' },
  other: { icon: File, color: '#8E8E93' },
};

export const PACK_META = {
  Clothes: Shirt,
  Electronics: Cable,
  Toiletries: Droplets,
  Documents: FolderOpen,
  Others: Package,
};

export const STATUS_TONE = { valid: 'ok', booked: 'ok', check: 'warn', missing: 'warn' };
export const DocIcon = FileText;
