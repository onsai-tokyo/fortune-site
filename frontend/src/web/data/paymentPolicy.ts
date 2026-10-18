/** Server credits are authoritative. A feature flag never authorizes local grants. */
export function paymentPolicy(remote: boolean, flag?: string) {
  return { purchasesOpen: !remote || flag === 'true', simulatePurchase: !remote }
}

export function canCreateWithCredits(credits: number) { return Number.isFinite(credits) && credits > 0 }
