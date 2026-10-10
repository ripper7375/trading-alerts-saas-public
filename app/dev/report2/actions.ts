'use server';

/**
 * Server actions of the Report 2 development preview (build step 5, part 7).
 *
 * They stand where the routes would: `devOffer` for `POST /api/engine4/offer`,
 * `devSize` for `/size`, `devConsent` for `/consent`, over the fixture world of
 * `world.ts`. Development only: in a production build every one of them refuses.
 */

import type {
  ConsentRequest,
  SetupRequest,
  SizeOutcome,
} from '@/components/report2/api-client';
import type { ConsentOutcome } from '@/components/report2/consent-bar';
import type { WireOfferAnswer } from '@/lib/engine4/templates/wire';

import {
  buildScene,
  consentOutcomeOf,
  offerAnswerOf,
  sizeOutcomeOf,
} from './world';

export async function devOffer(scenarioId: string): Promise<WireOfferAnswer> {
  return offerAnswerOf(buildScene(scenarioId));
}

export async function devSize(
  scenarioId: string,
  request: SetupRequest
): Promise<SizeOutcome> {
  return sizeOutcomeOf(buildScene(scenarioId), request);
}

export async function devConsent(
  scenarioId: string,
  request: ConsentRequest
): Promise<ConsentOutcome> {
  return consentOutcomeOf(buildScene(scenarioId), request);
}
