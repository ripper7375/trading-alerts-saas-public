/**
 * Fired-alert marker store (pure).
 *
 * Keeps a capped list of "alert fired here" points; the chart maps these to
 * Lightweight Charts series markers. No chart/React imports so it is unit
 * testable.
 *
 * @module components/charts/drawing/firedMarkers
 */

export interface FiredMarkerInput {
  time: number;
  price: number;
  levelId: string;
}

export interface FiredMarkerView extends FiredMarkerInput {
  createdAt: number;
}

export function capList<T>(list: T[], max: number): T[] {
  return list.length <= max ? list : list.slice(list.length - max);
}

export class FiredMarkerStore {
  private items: FiredMarkerView[] = [];
  private readonly max: number;

  constructor(max = 50) {
    this.max = max;
  }

  add(input: FiredMarkerInput, now: number): FiredMarkerView[] {
    this.items = capList(
      [...this.items, { ...input, createdAt: now }],
      this.max
    );
    return this.list();
  }

  clear(): FiredMarkerView[] {
    this.items = [];
    return this.list();
  }

  list(): FiredMarkerView[] {
    return [...this.items];
  }
}
