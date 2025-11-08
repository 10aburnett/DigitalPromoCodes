import { casinoBonuses } from '@/data/casinoBonuses';
import { CasinoBonus } from '@/types/casino';

export function getCasinoById(id: string): CasinoBonus | undefined {
  return casinoBonuses.find((casino) => casino.id === id);
} 