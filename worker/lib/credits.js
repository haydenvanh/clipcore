import { prisma } from "./db.js";
import { createCreditService } from "../../src/lib/services/credits-core.js";

/**
 * The credit ledger, bound to the worker's Prisma client.
 * Same implementation the web app uses — see src/lib/services/credits-core.js.
 */
export const CreditService = createCreditService(prisma);
export { InsufficientCreditsError } from "../../src/lib/services/credits-core.js";
