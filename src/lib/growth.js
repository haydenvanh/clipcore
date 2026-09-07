/**
 * Growth intelligence, re-exported for the Next.js app.
 * Implementation lives in worker/lib/growth.js so both runtimes share one copy.
 */
export {
  buildGrowthReport, explainScore, estimateRetention,
  recommendPlatforms, growthSuggestions, PLATFORMS,
} from "../../worker/lib/growth.js";
