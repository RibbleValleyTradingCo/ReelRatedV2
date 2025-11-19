import { useAuth } from "@/components/AuthProvider";
import { HeroLeaderboardSpotlight } from "@/components/HeroLeaderboardSpotlight";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { shouldShowExactLocation } from "@/lib/visibility";
import { Activity, Camera, Compass, Fish, MapPin, MoveRight, NotebookPen, Star, Users, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useCountUp } from "@/hooks/useCountUp";

type FeatureHighlight = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  supporting?: string;
};

const featureHighlights: FeatureHighlight[] = [
  {
    title: "Precision Catch Logs",
    description:
      "Record species, tackle, conditions, and tactics in seconds.",
    icon: NotebookPen,
    href: "/add-catch",
  },
  {
    title: "Community Scorecards",
    description:
      "Share with anglers who rate, react, and champion your wins.",
    icon: Users,
    href: "/feed",
  },
  {
    title: "Technique Analytics",
    description: "Spot patterns across tides, moon phases, and gear history.",
    icon: Activity,
    href: "/insights",
  },
  {
    title: "Mapped Venues",
    description: "Surface swims and waterways the community is exploring.",
    icon: MapPin,
    supporting: "Venues mapped with shared catch history.",
    href: "/search",
  },
];

const featureAccents = [
  {
    tile: "bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500",
    hoverBorder: "hover:border-cyan-400/60",
    hoverShadow: "hover:shadow-[0_32px_64px_-28px_rgba(14,165,233,0.55)]",
    headingHover: "group-hover:text-cyan-600",
    linkColor: "text-cyan-600 hover:text-cyan-500",
    glow: "bg-gradient-to-br from-blue-500/14 via-cyan-500/10 to-emerald-500/8",
  },
  {
    tile: "bg-gradient-to-br from-indigo-500 via-blue-500 to-purple-500",
    hoverBorder: "hover:border-indigo-400/60",
    hoverShadow: "hover:shadow-[0_32px_64px_-28px_rgba(99,102,241,0.55)]",
    headingHover: "group-hover:text-indigo-600",
    linkColor: "text-indigo-600 hover:text-indigo-500",
    glow: "bg-gradient-to-br from-indigo-500/14 via-blue-500/10 to-purple-500/8",
  },
  {
    tile: "bg-gradient-to-br from-teal-500 via-emerald-500 to-lime-500",
    hoverBorder: "hover:border-emerald-400/60",
    hoverShadow: "hover:shadow-[0_32px_64px_-28px_rgba(16,185,129,0.5)]",
    headingHover: "group-hover:text-emerald-600",
    linkColor: "text-emerald-600 hover:text-emerald-500",
    glow: "bg-gradient-to-br from-teal-500/14 via-emerald-500/10 to-lime-500/8",
  },
  {
    tile: "bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-500",
    hoverBorder: "hover:border-sky-400/60",
    hoverShadow: "hover:shadow-[0_32px_64px_-28px_rgba(59,130,246,0.5)]",
    headingHover: "group-hover:text-sky-600",
    linkColor: "text-sky-600 hover:text-sky-500",
    glow: "bg-gradient-to-br from-sky-500/14 via-cyan-500/10 to-blue-500/8",
  },
] as const;
const workflowSteps = [
  {
    title: "Snap & Log",
    description: "Snap the fish, note weight, tag gear.",
    icon: Camera,
  },
  {
    title: "Pin the Spot",
    description: "Drop the pin, choose who gets access.",
    icon: MapPin,
  },
  {
    title: "Earn the Score",
    description: "Collect ratings, spot trends, climb fast.",
    icon: Star,
  },
];

const stepAccents = [
  {
    badge: "text-blue-600",
    iconBg: "bg-gradient-to-br from-blue-500 to-blue-400 text-white",
    barGradient: "from-blue-500 via-cyan-500 to-emerald-500",
    glow: "bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-emerald-500/10",
  },
  {
    badge: "text-cyan-600",
    iconBg: "bg-gradient-to-br from-cyan-500 to-teal-400 text-white",
    barGradient: "from-cyan-500 via-emerald-500 to-teal-400",
    glow: "bg-gradient-to-r from-cyan-500/10 via-emerald-500/10 to-teal-400/10",
  },
  {
    badge: "text-emerald-600",
    iconBg: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white",
    barGradient: "from-emerald-500 via-lime-400 to-teal-500",
    glow: "bg-gradient-to-r from-emerald-500/10 via-lime-400/10 to-teal-500/10",
  },
] as const;

const FeatureHighlights = ({ compact = false }: { compact?: boolean }) => (
  <div className={cn("space-y-10", compact ? "pt-2" : "pt-6")}>
    <div
      className={cn(
        "space-y-4",
        compact ? "text-left" : "mx-auto max-w-3xl text-center",
      )}
    >
      <h2
        className={cn(
          "text-4xl font-black text-gray-900 md:text-5xl",
          compact && "text-3xl md:text-4xl",
        )}
      >
        Built to keep every detail of your time on the water
      </h2>
      <p
        className={cn(
          "text-lg leading-relaxed text-gray-600",
          compact ? "max-w-xl" : "mx-auto max-w-2xl",
        )}
      >
        From the tides and tackle to the cheers from your crew—ReelyRated stitches together the full
        story so you can refine your craft faster.
      </p>
    </div>

    <div
      className={cn(
        "grid gap-6 md:gap-8",
        compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2",
      )}
    >
      {featureHighlights.map(({ title, description, supporting, href, icon: Icon }, index) => {
        const accent = featureAccents[index % featureAccents.length];

        if (compact) {
          return (
            <article
              key={title}
              className={cn(
                "group flex items-start gap-4 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200/60 hover:shadow-lg lg:p-6",
                accent.hoverBorder,
              )}
            >
              <div
                className={cn(
                  "flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white shadow-md transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110",
                  accent.tile,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600">{description}</p>
                {supporting ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-primary/80">
                    {supporting}
                  </p>
                ) : null}
              </div>
            </article>
          );
        }

        return (
          <div
            key={title}
            className="motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-4 motion-safe:duration-500"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <article
              className={cn(
                "group relative cursor-pointer overflow-hidden rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg transition-all duration-300 ease-out hover:-translate-y-2 sm:p-8",
                accent.hoverBorder,
                accent.hoverShadow,
              )}
            >
              <div className={cn("pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100", accent.glow)} aria-hidden="true" />
              <div className="relative space-y-6">
                <div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-[1.08]",
                    accent.tile,
                  )}
                >
                  <Icon className="h-8 w-8" />
                </div>
                <div className="space-y-4">
                  <h3
                    className={cn(
                      "text-2xl font-semibold text-gray-900 transition-colors duration-300 md:text-3xl",
                      accent.headingHover,
                    )}
                  >
                    {title}
                  </h3>
                  <p className="text-base leading-relaxed text-gray-600">{description}</p>
                  {supporting ? (
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {supporting}
                    </p>
                  ) : null}
                  <a
                    href={href}
                    className={cn(
                      "group/link inline-flex items-center gap-2 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      accent.linkColor,
                    )}
                  >
                    Learn more
                    <MoveRight className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-1" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  </div>
);

interface StatsShowcaseProps {
  stats: {
    totalCatches: number;
    activeAnglers: number;
    waterways: number;
  };
  isLoading: boolean;
  dataError: string | null;
}

type StatsCardProps = {
  label: string;
  value: number;
  helper: string;
  isLoading: boolean;
  accentGradient: string;
  tileGradient: string;
  icon: LucideIcon;
};

const StatsCard = ({ label, value, helper, isLoading, accentGradient, tileGradient, icon: Icon }: StatsCardProps) => {
  const { count, ref } = useCountUp(isLoading ? 0 : value);
  const display = isLoading ? "—" : count.toLocaleString("en-GB");
  const helperText = isLoading ? "Fetching live stats…" : helper;

  return (
    <article
      ref={ref}
      className="group relative overflow-hidden rounded-3xl border border-transparent bg-white/95 p-8 text-center shadow-[0_20px_45px_-28px_rgba(30,64,175,0.45)] transition-all duration-300 ease-out hover:-translate-y-2 hover:border-blue-200/70 hover:shadow-[0_32px_60px_-32px_rgba(14,116,204,0.6)] md:p-10"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(120% 120% at 50% 0%, rgba(59,130,246,0.12) 0%, rgba(14,165,233,0.06) 55%, transparent 100%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-5">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-300 ease-out group-hover:rotate-3 group-hover:scale-110",
            tileGradient,
          )}
        >
          <Icon className="h-7 w-7" />
        </div>
        <div className="space-y-3">
          <div className="min-h-[64px]">
            {isLoading ? (
              <span className="mx-auto block h-12 w-32 rounded-full bg-slate-200/80 animate-pulse" />
            ) : (
              <span
                className={cn(
                  "block bg-gradient-to-r bg-clip-text text-5xl font-black leading-none text-transparent md:text-6xl",
                  accentGradient,
                )}
              >
                {display}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-slate-400">{label}</p>
          <p className="text-sm text-slate-500">{helperText}</p>
        </div>
      </div>
    </article>
  );
};

const StatsShowcase = ({ stats, isLoading, dataError }: StatsShowcaseProps) => {
  const cards: Array<{
    label: string;
    value: number;
    helper: string;
    accentGradient: string;
    tileGradient: string;
    icon: LucideIcon;
  }> = [
    {
      label: "Recorded catches",
      value: stats.totalCatches,
      helper:
        stats.totalCatches > 0
          ? "Shared publicly across the UK community."
          : "Log your first catch to kick-start the leaderboard.",
      accentGradient: "from-blue-600 via-cyan-500 to-emerald-400",
      tileGradient: "bg-gradient-to-br from-blue-500 via-cyan-500 to-emerald-500",
      icon: Fish,
    },
    {
      label: "Active anglers",
      value: stats.activeAnglers,
      helper:
        stats.activeAnglers > 0
          ? "Anglers trading tips, scores, and sessions."
          : "Invite your crew and start scoring each other.",
      accentGradient: "from-emerald-500 via-teal-400 to-cyan-400",
      tileGradient: "bg-gradient-to-br from-emerald-500 via-teal-400 to-cyan-400",
      icon: Compass,
    },
    {
      label: "UK waterways",
      value: stats.waterways,
      helper:
        stats.waterways > 0
          ? "Waterways logged across the community."
          : "Add venues to build the national map.",
      accentGradient: "from-sky-500 via-blue-500 to-indigo-500",
      tileGradient: "bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500",
      icon: Waves,
    },
  ];

  return (
    <div className="space-y-12 md:space-y-16">
      <div className="space-y-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 px-5 py-2 text-xs font-extrabold uppercase tracking-[0.36em] text-white shadow-[0_12px_30px_-18px_rgba(14,165,233,0.7)]">
          <span className="relative h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-white/70 motion-safe:animate-ping" />
            <span className="absolute inset-[4px] rounded-full bg-white" />
          </span>
          Live Community Pulse
        </span>
        <h2 className="text-4xl font-black text-gray-900 md:text-5xl">
          Fueled by anglers across the UK
        </h2>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
          These numbers refresh as the community logs more catches, recruits new crews, and charts new waters.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => (
          <div
            key={card.label}
            className="motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-500"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <StatsCard {...card} isLoading={isLoading} />
          </div>
        ))}
      </div>

      {dataError && !isLoading ? (
        <p className="text-center text-sm text-red-600" role="status">
          {dataError}
        </p>
      ) : null}
    </div>
  );
};

const HomeLayout = ({ children }: { children: ReactNode }) => (
  <div className="section-container lg:max-w-7xl">
    {children}
  </div>
);

interface HeroLeftProps {
  heading: ReactNode;
  subheading: ReactNode;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryLabel: string;
  secondaryLabel: string;
}

const HeroLeft = ({
  heading,
  subheading,
  onPrimary,
  onSecondary,
  primaryLabel,
  secondaryLabel,
}: HeroLeftProps) => (
  <div className="flex w-full flex-col gap-10 text-left motion-safe:animate-in motion-safe:fade-in-50 motion-safe:duration-500">
    <div className="space-y-6">
      <h1 className="text-balance text-4xl font-black leading-[1.12] tracking-[-0.045em] text-gray-950 md:text-6xl md:leading-[1.12] lg:text-7xl lg:leading-[1.08]">
        {heading}
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-gray-600 md:text-xl motion-safe:animate-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-500 motion-safe:delay-100">
        {subheading}
      </p>
    </div>
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap motion-safe:animate-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-500 motion-safe:delay-150">
      <Button
        variant="ocean"
        size="lg"
        className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 px-8 py-[1.15rem] text-base font-bold uppercase tracking-wider text-white shadow-[0_18px_38px_-18px_rgba(14,116,204,0.65)] transition-all duration-300 ease-out before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-white/0 before:via-white/40 before:to-white/0 before:opacity-0 before:transition before:duration-500 hover:scale-[1.02] hover:shadow-[0_26px_54px_-22px_rgba(14,116,204,0.7)] hover:before:translate-x-full hover:before:opacity-100 focus-visible:ring-offset-0 sm:w-auto md:text-lg"
        onClick={onPrimary}
      >
        {primaryLabel}
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="w-full rounded-2xl border-gray-200 bg-white/90 text-base font-semibold text-gray-700 shadow-sm transition-all duration-300 hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-700 hover:shadow-lg focus-visible:ring-blue-500 sm:w-auto"
        onClick={onSecondary}
      >
        {secondaryLabel}
      </Button>
    </div>
  </div>
);

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalCatches: 0,
    activeAnglers: 0,
    waterways: 0,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadHomepageData = async () => {
      setIsLoadingData(true);
      setDataError(null);

      try {
        const catchCountPromise = supabase
          .from("catches")
          .select("id", { count: "exact", head: true })
          .eq("visibility", "public");
        const catchDetailsPromise = supabase
          .from("catches")
          .select("location, hide_exact_spot, visibility, user_id")
          .eq("visibility", "public");
        const [catchCountRes, catchDetailsRes] = await Promise.all([
          catchCountPromise,
          catchDetailsPromise,
        ]);

        if (catchCountRes.error) throw catchCountRes.error;
        if (catchDetailsRes.error) throw catchDetailsRes.error;

        if (!isMounted) return;

        const locationSet = new Set<string>();
        const anglerSet = new Set<string>();
        (catchDetailsRes.data ?? []).forEach((row) => {
          if (row.user_id) {
            anglerSet.add(row.user_id);
          }
          const trimmed = row.location?.trim();
          if (!trimmed) return;
          if (
            shouldShowExactLocation(row.hide_exact_spot, row.user_id, user?.id)
          ) {
            locationSet.add(trimmed);
          }
        });

        setStats({
          totalCatches: catchCountRes.count ?? 0,
          activeAnglers: anglerSet.size,
          waterways: locationSet.size,
        });
      } catch (error) {
        console.error("Failed to load homepage data", error);
        if (isMounted) {
          setDataError(
            "We couldn't load the latest stats. Please try again shortly."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingData(false);
        }
      }
    };

    void loadHomepageData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const isSignedIn = Boolean(user);
  const primaryCtaLabel = isSignedIn ? "Open Live Feed" : "Create Your Logbook";
  const secondaryCtaLabel = isSignedIn
    ? "Share a Fresh Catch"
    : "Browse Public Highlights";

  const handlePrimaryCta = () => {
    if (isSignedIn) {
      navigate("/feed");
    } else {
      navigate("/auth");
    }
  };

  const handleSecondaryCta = () => {
    if (isSignedIn) {
      navigate("/add-catch");
    } else {
      navigate("/feed");
    }
  };

  const heroHeading = (
  <>
    Turn every catch into a{" "}
    <span className="relative inline-block bg-gradient-to-br from-blue-500 via-cyan-400 to-emerald-500 bg-clip-text pb-1 font-black text-transparent drop-shadow-[0_8px_20px_rgba(34,197,233,0.35)]">
      story worth scoring
    </span>
  </>
);

  const heroSubheading = (
    <>
      ReelyRated is your digital fishing partner. Log catches with precision,
      unlock community insights, and build a shareable career on and off the
      water.
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="relative isolate pt-20 md:pt-24 lg:pt-28">
        <div className="absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl">
          <div className="h-64 w-2/3 rounded-full bg-gradient-to-r from-primary/40 via-secondary/40 to-primary/30 opacity-60" />
        </div>

        <section className="pb-6 md:pb-8">
          <HomeLayout>
            <div className="grid items-center gap-8 md:gap-12 lg:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]">
              <div className="lg:sticky lg:top-28 lg:self-start">
                <HeroLeft
                  heading={heroHeading}
                  subheading={heroSubheading}
                  onPrimary={handlePrimaryCta}
                  onSecondary={handleSecondaryCta}
                  primaryLabel={primaryCtaLabel}
                  secondaryLabel={secondaryCtaLabel}
                />
              </div>
              <div className="flex w-full flex-col gap-4 md:pl-6">
                <HeroLeaderboardSpotlight />
              </div>
            </div>
          </HomeLayout>
        </section>

        <div className="mt-10 flex flex-col gap-10 md:mt-12">
          <div className="section bg-gradient-to-br from-blue-50 via-sky-50/60 to-white border-y border-blue-200/50 py-12 md:py-16">
            <HomeLayout>
              <StatsShowcase stats={stats} isLoading={isLoadingData} dataError={dataError} />
            </HomeLayout>
          </div>

          <div className="section bg-white py-12 md:py-16">
            <LeaderboardSection limit={6} />
          </div>

          <div className="section bg-gray-50/40 py-12 md:py-16">
            <HomeLayout>
              <FeatureHighlights />
            </HomeLayout>
          </div>

          <div className="section bg-gradient-to-br from-emerald-50 via-teal-50/40 to-cyan-50/30 py-10 md:py-14">
            <HomeLayout>
              <div className="mx-auto max-w-4xl space-y-4 text-center">
                <h2 className="text-4xl font-black text-gray-900 md:text-5xl">
                  From first bite to bragging rights in three clean steps
                </h2>
                <p className="mx-auto max-w-2xl text-base leading-relaxed text-gray-600 md:text-lg">
                  Codify your catch without breaking your stride. ReelyRated guides you through the essentials so your logbooks stay consistent, searchable, and ready to show off.
                </p>
              </div>
              <div className="mt-8">
                <div className="relative mx-auto max-w-3xl">
                  <span
                    className="pointer-events-none absolute left-9 top-8 bottom-8 w-[3px] rounded-full bg-[repeating-linear-gradient(to_bottom,rgba(59,130,246,0.55)_0,rgba(34,197,233,0.55)_8px,transparent_8px,transparent_18px)] motion-safe:animate-pulse"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-3 md:gap-4">
                    {workflowSteps.map((step, index) => {
                      const accent = stepAccents[index] ?? stepAccents[0];

                      return (
                        <div
                          key={step.title}
                          className="group relative z-10 overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-5 shadow-[0_20px_40px_-32px_rgba(15,118,110,0.35)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_60px_-34px_rgba(6,148,162,0.45)] motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-4 motion-safe:duration-500 md:p-6"
                          style={{ animationDelay: `${index * 80}ms` }}
                        >
                          <div className={cn("pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100", accent.glow)} aria-hidden="true" />
                          <span
                            className={cn(
                              "absolute left-0 top-4 bottom-4 w-1.5 rounded-full bg-gradient-to-b",
                              accent.barGradient,
                            )}
                            aria-hidden="true"
                          />
                          <div className="relative flex items-center gap-4 md:gap-5">
                            <div
                              className={cn(
                                "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110 md:h-14 md:w-14",
                                accent.iconBg,
                              )}
                            >
                              <step.icon className="h-6 w-6 md:h-7 md:w-7" />
                            </div>
                            <div className="flex flex-col gap-1.5 text-left">
                              <span
                                className={cn(
                                  "text-xs font-bold uppercase tracking-[0.28em]",
                                  accent.badge,
                                )}
                              >
                                Step {index + 1}
                              </span>
                              <h3 className="text-xl font-semibold text-gray-900 md:text-2xl">
                                {step.title}
                              </h3>
                              <p className="text-sm text-gray-600">{step.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </HomeLayout>
          </div>

          {!user && (
            <div className="section">
              <HomeLayout>
                <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary to-secondary px-6 py-12 text-primary-foreground shadow-xl md:px-8 md:py-16">
                  <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative mx-auto max-w-3xl space-y-6 text-center">
                    <h2 className="text-3xl font-bold md:text-4xl">
                      Join the UK's most dedicated fishing leaderboard
                    </h2>
                    <p className="text-lg leading-relaxed">
                      Secure your handle, build your story, and rally your crew. Your next personal
                      best deserves more than a camera roll.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                      <Button
                        variant="outline"
                        size="lg"
                        className="border-white bg-white text-primary hover:bg-white/90"
                        onClick={() => navigate("/auth")}
                      >
                        Claim Your Profile
                      </Button>
                      <Button
                        variant="ghost"
                        size="lg"
                        className="text-primary-foreground/80"
                        onClick={() => navigate("/feed")}
                      >
                        View Public Leaderboard
                      </Button>
                    </div>
                  </div>
                </div>
              </HomeLayout>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white/80 py-8 text-center text-gray-500">
        <HomeLayout>
          <p className="text-sm">ReelyRated • Built for UK Anglers</p>
        </HomeLayout>
      </footer>
    </div>
  );
};

export default Index;
