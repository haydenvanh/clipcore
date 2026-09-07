import { FEATURES } from "./features";

/**
 * Navigation structure.
 *
 * Feature menu items are derived from the features list rather than duplicated,
 * so a feature cannot appear in the menu without a page behind it.
 */

export const FEATURE_MENU = FEATURES.filter((f) => f.category !== "build").map((f) => ({
  label: f.name,
  href: `/features/${f.slug}`,
  status: f.status,
  description: f.tagline,
}));

export const DEVELOPER_MENU = [
  { label: "Developer API", href: "/features/api", description: "Clipping as an endpoint" },
  { label: "MCP Server", href: "/features/mcp", description: "Tools for AI agents" },
  { label: "Professional Export", href: "/features/professional-export", description: "Premiere and DaVinci" },
  { label: "Documentation", href: "/docs", description: "Guides and reference" },
];

export const PRIMARY_NAV = [
  { label: "Features", href: "/features", menu: FEATURE_MENU },
  { label: "Developers", href: "/features/api", menu: DEVELOPER_MENU },
  { label: "Teams", href: "/#teams" },
  { label: "Pricing", href: "/pricing" },
];

export const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "For Teams", href: "/#teams" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API", href: "/features/api" },
      { label: "MCP Server", href: "/features/mcp" },
      { label: "Documentation", href: "/docs" },
      { label: "Status", href: "/api/health" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Compare", href: "/features" },
      { label: "Contact", href: "mailto:support@clipcore.app" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];
