import { computeMrr } from './admin-mrr';

describe('computeMrr (interval-weighted MRR)', () => {
  const prices = { monthlyPriceUsd: 29, annualPriceUsd: 290 };

  it('counts monthly subscribers at the monthly price', () => {
    expect(
      computeMrr({ monthlyProUsers: 10, annualProUsers: 0, ...prices })
    ).toMatchObject({ mrr: 290, arr: 3480 });
  });

  it('counts annual subscribers at the annual price / 12', () => {
    expect(
      computeMrr({ monthlyProUsers: 0, annualProUsers: 12, ...prices })
    ).toMatchObject({ mrr: 290, arr: 3480 });
  });

  it('adds both groups', () => {
    expect(
      computeMrr({ monthlyProUsers: 7, annualProUsers: 3, ...prices })
    ).toMatchObject({ mrr: 275.5, arr: 3306 });
  });
});
