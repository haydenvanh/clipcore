import { FiLayers, FiUsers, FiGitBranch, FiCheck } from "react-icons/fi";

/** A brand template swatch row — fonts, colours, caption preset. */
function BrandTemplatesVisual() {
  const brands = [
    { name: "Studio", colors: ["#F7F8F8", "#5E6AD2", "#1F2023"], font: "Inter" },
    { name: "Podcast", colors: ["#F0B429", "#0B0B0C", "#E8E8E6"], font: "Outfit" },
    { name: "Agency", colors: ["#4ADE80", "#111214", "#8A8F98"], font: "Inter" },
  ];

  return (
    <div className="space-y-2">
      {brands.map((brand) => (
        <div key={brand.name} className="well flex items-center gap-3 px-3 py-2.5">
          <div className="flex -space-x-1" aria-hidden>
            {brand.colors.map((color) => (
              <span
                key={color}
                className="w-4 h-4 rounded-full border border-bg-card"
                style={{ background: color }}
              />
            ))}
          </div>
          <span className="text-xs text-primary-text flex-1">{brand.name}</span>
          <span className="text-[10px] text-secondary-text">{brand.font}</span>
        </div>
      ))}
    </div>
  );
}

/** Shared workspace: members and an approval state. */
function WorkspaceVisual() {
  const members = [
    { initials: "AM", role: "Editor", state: "Approved" },
    { initials: "JR", role: "Creator", state: "In review" },
    { initials: "SD", role: "Marketer", state: "Draft" },
  ];

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div key={member.initials} className="well flex items-center gap-3 px-3 py-2.5">
          <span className="w-6 h-6 rounded-full bg-bg-card-hover border border-divider flex items-center justify-center text-[9px] font-semibold text-secondary-text">
            {member.initials}
          </span>
          <span className="text-xs text-primary-text flex-1">{member.role}</span>
          <span
            className={`text-[10px] ${
              member.state === "Approved" ? "text-[#4ade80]" : "text-secondary-text"
            }`}
          >
            {member.state}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Integration pipeline. */
function IntegrationsVisual() {
  const steps = ["Upload", "Clip", "Approve", "Publish"];

  return (
    <div className="well p-3">
      <div className="flex items-center justify-between">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span className="w-6 h-6 rounded-md border border-divider bg-bg-card flex items-center justify-center">
                <FiCheck className="text-[10px] text-primary" />
              </span>
              <span className="text-[9px] text-secondary-text whitespace-nowrap">{step}</span>
            </div>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-divider" aria-hidden />}
          </div>
        ))}
      </div>
      <p className="mt-3 pt-3 border-t border-divider text-[10px] text-secondary-text">
        REST API · webhooks · scheduled publishing
      </p>
    </div>
  );
}

const CARDS = [
  {
    icon: FiLayers,
    title: "Brand Templates",
    body: "Reusable templates carrying your fonts, colours, caption styles, logo placement, and intro and outro screens.",
    Visual: BrandTemplatesVisual,
  },
  {
    icon: FiUsers,
    title: "Team Workspace",
    body: "Invite editors, creators, marketers, and agencies into one shared workspace with approvals.",
    Visual: WorkspaceVisual,
  },
  {
    icon: FiGitBranch,
    title: "Workflow Integrations",
    body: "Connect your CMS, scheduling tools, and APIs to automate content production at scale.",
    Visual: IntegrationsVisual,
  },
];

/**
 * ClipCore for Teams.
 *
 * Everything here is on the roadmap rather than shipped, so the section is
 * labelled accordingly. Selling a workspace that does not exist yet is how a
 * launch turns into refunds.
 */
export default function Teams() {
  return (
    <section id="teams" className="py-24 sm:py-32 border-t border-divider scroll-mt-20">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-secondary-text">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />
            ClipCore for Teams
            <span className="rounded border border-divider px-1.5 py-0.5 text-[10px]">
              In development
            </span>
          </span>

          <h2 className="mt-4 text-[2rem] sm:text-[2.75rem] font-semibold leading-[1.1] text-primary-text">
            Scale your content operation
            <br />
            <span className="text-secondary-text">without scaling headcount</span>
          </h2>

          <p className="mt-4 text-base text-secondary-text leading-relaxed">
            Turn every long-form video into weeks of content while keeping brand consistency
            across your whole team.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {CARDS.map(({ icon: Icon, title, body, Visual }) => (
            <div key={title} className="panel p-5 flex flex-col gap-4">
              <Icon className="text-lg text-secondary-text" aria-hidden />
              <div>
                <h3 className="text-[15px] font-semibold text-primary-text">{title}</h3>
                <p className="mt-2 text-[13px] text-secondary-text leading-relaxed">{body}</p>
              </div>
              <div className="mt-auto pt-2">
                <Visual />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
