export type AccessPlan = "none" | "sprint" | "subscription";

export type AccessState = {
  plan: AccessPlan;
  unlockedAt: string | null;
  promoUsed: string | null;
  /** Sprint is one finished book/week; subscription is unlimited. */
  sprintBooksUsed: number;
};

export const SPRINT_PRICE = 499;
export const SUBSCRIPTION_PRICE = 99;

/** Prototype promo codes — real billing would move this server-side. */
const PROMO_CODES: Record<string, AccessPlan> = {
  SPRINT: "sprint",
  ROWAN: "sprint",
  DEMO: "sprint",
  UNLIMITED: "subscription",
  ADVISOR: "subscription",
};

export function emptyAccess(): AccessState {
  return {
    plan: "none",
    unlockedAt: null,
    promoUsed: null,
    sprintBooksUsed: 0,
  };
}

export function normalizePromo(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function resolvePromo(code: string): AccessPlan | null {
  return PROMO_CODES[normalizePromo(code)] ?? null;
}

export function canUseDesk(access: AccessState): boolean {
  if (access.plan === "subscription") return true;
  if (access.plan === "sprint") return access.sprintBooksUsed < 1;
  return false;
}

export function accessLabel(access: AccessState): string {
  if (access.plan === "subscription") return "Unlimited subscription";
  if (access.plan === "sprint") {
    return access.sprintBooksUsed < 1 ? "Sprint unlocked" : "Sprint used";
  }
  return "Locked";
}
