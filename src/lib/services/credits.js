import { prisma } from "@/lib/prisma";
import { createCreditService } from "./credits-core.js";

/**
 * The credit ledger, bound to the web app's Prisma client.
 * The logic lives in credits-core.js so the worker can share it verbatim.
 */
export const CreditService = createCreditService(prisma);
export { InsufficientCreditsError } from "./credits-core.js";
