export type AccessPlan = "none" | "sprint" | "subscription";

export type AccessState = {
  plan: AccessPlan;
  unlockedAt: string | null;
  promoUsed: string | null;
  /** Sprint allows one book import. */
  sprintBooksUsed: number;
  /** Sprint allows three polished week builds. */
  sprintWeeksUsed: number;
};

export const SPRINT_PRICE = 499;
export const SUBSCRIPTION_PRICE = 99;

export const SPRINT_MAX_BOOKS = 1;
export const SPRINT_MAX_WEEKS = 3;
export const SPRINT_MAX_WEEK_SIZE = 25;
export const UNLIMITED_MAX_WEEK_SIZE = 40;

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
    sprintWeeksUsed: 0,
  };
}

export function normalizePromo(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function resolvePromo(code: string): AccessPlan | null {
  return PROMO_CODES[normalizePromo(code)] ?? null;
}

export function canImportBook(access: AccessState): boolean {
  if (access.plan === "subscription") return true;
  if (access.plan === "sprint") return access.sprintBooksUsed < SPRINT_MAX_BOOKS;
  return false;
}

export function canBuildWeek(access: AccessState): boolean {
  if (access.plan === "subscription") return true;
  if (access.plan === "sprint") return access.sprintWeeksUsed < SPRINT_MAX_WEEKS;
  return false;
}

/** Desk is unlocked for any paid plan (even if sprint quotas are exhausted). */
export function canUseDesk(access: AccessState): boolean {
  return access.plan === "subscription" || access.plan === "sprint";
}

export function maxWeekSizeForPlan(access: AccessState): number {
  if (access.plan === "sprint") return SPRINT_MAX_WEEK_SIZE;
  return UNLIMITED_MAX_WEEK_SIZE;
}

export function sprintWeeksRemaining(access: AccessState): number {
  if (access.plan !== "sprint") return 0;
  return Math.max(0, SPRINT_MAX_WEEKS - access.sprintWeeksUsed);
}

export function accessLabel(access: AccessState): string {
  if (access.plan === "subscription") return "Unlimited subscription";
  if (access.plan === "sprint") {
    const weeksLeft = sprintWeeksRemaining(access);
    if (access.sprintBooksUsed < SPRINT_MAX_BOOKS) {
      return `Sprint · ${weeksLeft} week${weeksLeft === 1 ? "" : "s"} left`;
    }
    if (weeksLeft > 0) {
      return `Sprint · ${weeksLeft} week${weeksLeft === 1 ? "" : "s"} left`;
    }
    return "Sprint used";
  }
  return "Locked";
}
