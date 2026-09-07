"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import useSWRish from "@/components/dashboard/useSWRish";
import { FiLoader, FiTrash2, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";
import { FaYoutube, FaTiktok, FaInstagram, FaFacebook } from "react-icons/fa";

const ICONS = {
  YOUTUBE: FaYoutube,
  TIKTOK: FaTiktok,
  INSTAGRAM: FaInstagram,
  FACEBOOK: FaFacebook,
};

const BRAND_COLORS = {
  YOUTUBE: "text-red-500",
  TIKTOK: "text-primary-text",
  INSTAGRAM: "text-pink-500",
  FACEBOOK: "text-blue-500",
};

function ConnectionsContent() {
  const searchParams = useSearchParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(null);

  const { data: providerData } = useSWRish("/api/social/providers");
  const { data: accountData, loading } = useSWRish("/api/social/accounts", { refreshKey });

  const providers = providerData?.providers ?? [];
  const accounts = accountData?.accounts ?? [];

  // The OAuth callback redirects back here with the outcome in the query.
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  const disconnect = async (account) => {
    setBusy(account.id);
    try {
      const res = await fetch(`/api/social/accounts/${account.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not disconnect.");
      toast.success(`Disconnected ${account.displayName ?? account.provider}.`);
      setRefreshKey((n) => n + 1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Connections</h1>
        <p className="text-sm text-secondary-text mt-1">
          Connect a destination to publish clips straight from ClipCore.
        </p>
      </div>

      {connected && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-sm">
          <FiCheckCircle className="text-emerald-500 shrink-0" />
          <span>Connected <strong>{connected}</strong>.</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
          <FiAlertTriangle className="text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {accounts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-widest text-secondary-text">
            Connected
          </h2>
          {accounts.map((account) => {
            const Icon = ICONS[account.provider] ?? FaYoutube;
            return (
              <div
                key={account.id}
                className="bg-bg-card border border-divider/60 rounded-xl p-4 flex items-center gap-4"
              >
                <Icon className={`text-xl shrink-0 ${BRAND_COLORS[account.provider] ?? ""}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
                    {account.displayName ?? account.provider}
                  </div>
                  {account.status === "NEEDS_RECONNECT" ? (
                    <div className="text-xs text-amber-500 font-semibold mt-0.5">
                      Access expired — reconnect to keep publishing.
                    </div>
                  ) : (
                    <div className="text-xs text-secondary-text mt-0.5">
                      Connected {new Date(account.connectedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => disconnect(account)}
                  disabled={busy === account.id}
                  aria-label={`Disconnect ${account.displayName ?? account.provider}`}
                  className="shrink-0 p-2 rounded-lg text-secondary-text hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {busy === account.id ? <FiLoader className="animate-spin" /> : <FiTrash2 />}
                </button>
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-secondary-text">
          Available
        </h2>

        {loading ? (
          <div className="flex justify-center py-8 text-secondary-text">
            <FiLoader className="animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {providers.map((provider) => {
              const Icon = ICONS[provider.id] ?? FaYoutube;
              const usable = provider.implemented && provider.configured;

              return (
                <div
                  key={provider.id}
                  className="bg-bg-card border border-divider/60 rounded-xl p-5 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`text-xl ${BRAND_COLORS[provider.id] ?? ""}`} />
                    <span className="text-sm font-bold">{provider.displayName}</span>
                  </div>

                  <p className="text-xs text-secondary-text flex-1">
                    Up to {Math.round(provider.maxDurationSec / 60)} min ·{" "}
                    {provider.supportedAspectRatios
                      .map((r) => r.replace("RATIO_", "").replace("_", ":"))
                      .join(", ")}
                  </p>

                  {usable ? (
                    <a
                      href={`/api/social/connect/${provider.id.toLowerCase()}`}
                      className="text-center bg-primary hover:bg-primary-hover text-white rounded-full py-2.5 text-xs font-bold transition-colors"
                    >
                      Connect
                    </a>
                  ) : (
                    <div
                      className="text-center border border-divider rounded-full py-2.5 text-xs font-bold text-secondary-text cursor-not-allowed"
                      title={
                        provider.implemented
                          ? "Not configured on this deployment"
                          : "Not built yet"
                      }
                    >
                      {provider.implemented ? "Unavailable" : "Coming soon"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default function ConnectionsPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-secondary-text">
          <FiLoader className="animate-spin" />
        </div>
      }
    >
      <ConnectionsContent />
    </Suspense>
  );
}
