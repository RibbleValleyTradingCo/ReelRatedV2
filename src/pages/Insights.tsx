import { useCallback, useEffect, useMemo, useState, useId } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useAuthLoading } from "@/components/AuthProvider";
import type { Database } from "@/integrations/supabase/types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Trophy, Fish, Anchor, BarChart3, Layers, CalendarDays, Sparkles, Scale, CloudSun, MapPin } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { TrendLineChart } from "@/components/insights/TrendLineChart";
import { StatsCards } from "@/components/insights/StatsCards";
import { FiltersPanel } from "@/components/insights/FiltersPanel";
import { InfoCards } from "@/components/insights/InfoCards";
import { ChartCard } from "@/components/insights/ChartCard";
import {
  type CatchRow,
  type DatePreset,
  DAY_IN_MS,
  formatWeightDisplay,
  parseDate,
  startOfDay,
  endOfDay,
  getCatchDate,
} from "@/lib/insights-utils";
import { type AggregatedStats, aggregateStats } from "@/lib/insights-aggregation";
import { useInsightsChartData } from "@/lib/useInsightsChartData";
import { useInsightsFilters } from "@/lib/useInsightsFilters";
import { createNivoTheme } from "@/lib/nivoTheme";

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

const sanitizeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

const Insights = () => {
  const { user } = useAuthUser();
  const { loading: authLoading } = useAuthLoading();
  const navigate = useNavigate();
  const [catches, setCatches] = useState<CatchRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  const rawTrendGradientId = useId();

  const trendGradientId = useMemo(() => sanitizeId(`trend-${rawTrendGradientId}`), [rawTrendGradientId]);

  const primaryColor = "hsl(var(--primary))";
  const secondaryColor = "hsl(var(--secondary))";
  const borderColor = "rgba(148, 163, 184, 0.2)";
  const nivoTheme = useMemo(() => createNivoTheme(borderColor), [borderColor]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);

      const [catchesResponse, sessionsResponse] = await Promise.all([
        supabase
          .from("catches")
          .select(
            "id, created_at, caught_at, weight, weight_unit, location, bait_used, method, time_of_day, conditions, session_id, species"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("sessions")
          .select("id, title, venue, date, created_at")
          .eq("user_id", user.id)
          .order("date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
      ]);

      if (catchesResponse.error) {
        setError("We couldn't load your catches right now. Please try again shortly.");
        setCatches([]);
      } else {
        setCatches((catchesResponse.data as CatchRow[]) ?? []);
      }

      if (sessionsResponse.error) {
        console.warn("Failed to load sessions for insights", sessionsResponse.error);
        setSessions([]);
      } else {
        setSessions((sessionsResponse.data as SessionRow[]) ?? []);
      }

      setLoading(false);
    };

    void fetchData();
  }, [user]);

  const venueOptions = useMemo(() => {
    const venues = new Set<string>();
    catches.forEach((catchRow) => {
      if (catchRow.location) {
        venues.add(catchRow.location);
      }
    });
    return Array.from(venues).sort((a, b) => a.localeCompare(b));
  }, [catches]);

  const sessionOptions = useMemo(
    () =>
      sessions.map((session) => {
        const sessionDate = session.date ? parseDate(session.date) : parseDate(session.created_at);
        const fallbackLabel = sessionDate ? sessionDate.toLocaleDateString() : `Session ${session.id.slice(0, 6)}`;
        return {
          value: session.id,
          label: session.title ? session.title : fallbackLabel,
        };
      }),
    [sessions]
  );

  useEffect(() => {
    if (selectedVenue !== "all" && !venueOptions.includes(selectedVenue)) {
      setSelectedVenue("all");
    }
  }, [venueOptions, selectedVenue]);

  useEffect(() => {
    if (selectedSessionId !== "all" && !sessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId("all");
    }
  }, [sessions, selectedSessionId]);

  const latestSessionId = useMemo(() => {
    let candidate: { id: string; timestamp: number } | null = null;

    catches.forEach((catchRow) => {
      if (!catchRow.session_id) return;
      const catchDate = getCatchDate(catchRow);
      const timestamp = catchDate ? catchDate.getTime() : 0;
      if (!candidate || timestamp > candidate.timestamp) {
        candidate = { id: catchRow.session_id, timestamp };
      }
    });

    if (candidate) {
      return candidate.id;
    }

    let fallback: { id: string; timestamp: number } | null = null;
    sessions.forEach((session) => {
      const sessionDate = session.date ? parseDate(session.date) : parseDate(session.created_at);
      const timestamp = sessionDate ? sessionDate.getTime() : 0;
      if (!fallback || timestamp > fallback.timestamp) {
        fallback = { id: session.id, timestamp };
      }
    });

    return fallback?.id ?? null;
  }, [catches, sessions]);

  useEffect(() => {
    if (datePreset === "last-session" && latestSessionId) {
      setSelectedSessionId((previous) => (previous === latestSessionId ? previous : latestSessionId));
    }
  }, [datePreset, latestSessionId]);

  useEffect(() => {
    if (datePreset === "last-session" && !latestSessionId) {
      setDatePreset("all");
      setSelectedSessionId("all");
    }
  }, [datePreset, latestSessionId]);

  const effectiveSessionId = useMemo(() => {
    if (selectedSessionId !== "all") {
      return selectedSessionId;
    }
    if (datePreset === "last-session" && latestSessionId) {
      return latestSessionId;
    }
    return null;
  }, [selectedSessionId, datePreset, latestSessionId]);

  const { dateRange, filteredCatches } = useInsightsFilters({
    catches,
    sessions,
    datePreset,
    customRange,
    effectiveSessionId,
    selectedVenue,
  });

  const stats = useMemo(() => aggregateStats(filteredCatches), [filteredCatches]);

  const sessionsCount = useMemo(() => {
    if (effectiveSessionId) {
      return filteredCatches.some((catchRow) => catchRow.session_id === effectiveSessionId) ? 1 : 0;
    }
    const ids = new Set<string>();
    filteredCatches.forEach((catchRow) => {
      if (catchRow.session_id) {
        ids.add(catchRow.session_id);
      }
    });
    return ids.size;
  }, [filteredCatches, effectiveSessionId]);

  const mostCommonSpecies = stats.speciesCounts[0]?.name ?? null;
  const mostCommonSpeciesCount = stats.speciesCounts[0]?.count ?? 0;
  const averageWeightLabel = formatWeightDisplay(stats.averageWeightKg);
  const weightedCatchCount = stats.weightedCatchCount;
  const averagePerSession = sessionsCount > 0 ? stats.totalCatches / sessionsCount : 0;
  const averagePerSessionLabel = sessionsCount > 0 ? averagePerSession.toFixed(1) : "—";
  const topWeather = stats.weatherCounts[0]?.name ?? null;
  const topClarity = stats.clarityCounts[0]?.name ?? null;
  const topWind = stats.windCounts[0]?.name ?? null;
  const averageAirTempLabel = stats.averageAirTemp !== null ? `${stats.averageAirTemp.toFixed(1)}°C` : "—";

  const {
    venueLeaderboard,
    monthlyCounts,
    sessionSummaries,
    topSession,
    trendLineData,
    timeOfDayData,
    baitData,
    methodData,
    speciesBarData,
  } = useInsightsChartData({ filteredCatches, sessions, stats });
  const topVenue = venueLeaderboard[0] ?? null;

  const presetLabelMap: Record<DatePreset, string> = {
    all: "All time",
    "last-30": "Last 30 days",
    season: "This season",
    "last-session": "Last logged session",
    custom: "Custom range",
  };

  const customRangeDescription = customRange?.from
    ? customRange?.to
      ? `${customRange.from.toLocaleDateString()} – ${customRange.to.toLocaleDateString()}`
      : `${customRange.from.toLocaleDateString()} onward`
    : "Custom range";

  const rangeDescriptor =
    datePreset === "custom" ? customRangeDescription : presetLabelMap[datePreset] ?? "Selected range";

  const summaryParts: string[] =
    stats.totalCatches > 0
      ? [`${stats.totalCatches} catch${stats.totalCatches === 1 ? "" : "es"}`]
      : [];

  if (stats.pbCatch?.label) {
    summaryParts.push(`PB ${stats.pbCatch.label}`);
  }
  if (mostCommonSpecies) {
    summaryParts.push(`mostly ${mostCommonSpecies}`);
  }
  if (topVenue) {
    summaryParts.push(`best at ${topVenue.name}`);
  }

  const headlineSummary =
    stats.totalCatches > 0
      ? `${rangeDescriptor}: ${summaryParts.join(" · ")}`
      : `No catches recorded in ${rangeDescriptor.toLowerCase()} yet.`;

  const peakMonthEntry =
    monthlyCounts.length > 0
      ? monthlyCounts.reduce((best, entry) => (entry.count > (best?.count ?? 0) ? entry : best), monthlyCounts[0])
      : null;

  const catchTrendSummary = peakMonthEntry
    ? `Peak month: ${peakMonthEntry.label} (${peakMonthEntry.count} catch${peakMonthEntry.count === 1 ? "" : "es"})`
    : "No monthly data yet.";

  const totalTimeOfDayCatches = timeOfDayData.reduce((sum, item) => sum + item.catches, 0);
  const topTimeOfDayBucket =
    timeOfDayData.length > 0
      ? timeOfDayData.reduce(
          (best, entry) => (entry.catches > (best?.catches ?? 0) ? entry : best),
          timeOfDayData[0],
        )
      : null;
  const showTimeOfDayChart = totalTimeOfDayCatches >= 3 && timeOfDayData.length > 0;
  const timeOfDaySummary = topTimeOfDayBucket
    ? `Most fish landed during ${topTimeOfDayBucket.label.toLowerCase()} hours.`
    : null;

  const topMethod = methodData[0];
  const methodFooter = topMethod
    ? `Most fish landed on: ${topMethod.label} (${topMethod.catches} catch${topMethod.catches === 1 ? "" : "es"})`
    : undefined;

  const topVenueHighlight = topVenue
    ? `Top venue: ${topVenue.name} (${topVenue.count} catch${topVenue.count === 1 ? "" : "es"})`
    : null;

  const sessionsDisabled = sessionOptions.length === 0;
  const showLastSessionHint = datePreset === "last-session" && !latestSessionId;
  const noCatchesOverall = catches.length === 0;

  const customRangeLabel = useMemo(() => {
    if (customRange?.from && customRange?.to) {
      return `${customRange.from.toLocaleDateString()} – ${customRange.to.toLocaleDateString()}`;
    }
    if (customRange?.from) {
      return `${customRange.from.toLocaleDateString()} – …`;
    }
    return "Pick custom range";
  }, [customRange]);

  const customRangeActive = datePreset === "custom";

  const handleDatePresetChange = useCallback((value: DatePreset) => {
    if (value === "last-session" && !latestSessionId) {
      setDatePreset("all");
      return;
    }

    if (value === "custom") {
      setDatePreset("custom");
      setCustomRangeOpen(true);
      return;
    }

    setCustomRange(undefined);
    setCustomRangeOpen(false);
    setDatePreset(value);
  }, [latestSessionId]);

  const handleCustomRangeSelect = useCallback((range: DateRange | undefined) => {
    if (!range || (!range.from && !range.to)) {
      setCustomRange(undefined);
      setDatePreset("all");
      return;
    }
    setCustomRange(range);
    setDatePreset("custom");
    setSelectedSessionId("all");
    if (range.from && range.to) {
      setCustomRangeOpen(false);
    }
  }, []);

  const handleClearCustomRange = useCallback(() => {
    setCustomRange(undefined);
    if (datePreset === "custom") {
      setDatePreset("all");
    }
    setCustomRangeOpen(false);
  }, [datePreset]);

  const handleSessionChange = useCallback((value: string) => {
    if (datePreset === "last-session") {
      if (value === "all" || (latestSessionId && value !== latestSessionId)) {
        setDatePreset("all");
      }
    }
    setSelectedSessionId(value);
  }, [datePreset, latestSessionId]);

  const handleVenueChange = useCallback((value: string) => {
    setSelectedVenue(value);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Your angling insights</h1>
          <p className="text-muted-foreground">
            A quick look at how your catches stack up across venues, times of day, and favourite tactics.
          </p>
        </div>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Crunching the numbers…
          </div>
        ) : (
          <>
            <FiltersPanel
              datePreset={datePreset}
              onDatePresetChange={handleDatePresetChange}
              selectedSessionId={selectedSessionId}
              onSessionChange={handleSessionChange}
              selectedVenue={selectedVenue}
              onVenueChange={handleVenueChange}
              customRange={customRange}
              customRangeOpen={customRangeOpen}
              onCustomRangeOpenChange={setCustomRangeOpen}
              onCustomRangeSelect={handleCustomRangeSelect}
              onClearCustomRange={handleClearCustomRange}
              customRangeLabel={customRangeLabel}
              customRangeActive={customRangeActive}
              latestSessionId={latestSessionId}
              sessionOptions={sessionOptions}
              sessionsDisabled={sessionsDisabled}
              venueOptions={venueOptions}
              showLastSessionHint={showLastSessionHint}
            />

            <div className="mb-4 text-sm text-muted-foreground sm:text-base">{headlineSummary}</div>

            {error ? (
              <Card className="mb-6 border-destructive/30 bg-destructive/10 text-destructive">
                <CardContent className="py-6">
                  <p>{error}</p>
                </CardContent>
              </Card>
            ) : stats.totalCatches === 0 ? (
              <Card className="mb-6">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>
                    {noCatchesOverall
                      ? "You haven’t logged any catches yet. Record your next session to unlock insights."
                      : "No catches match these filters yet. Adjust your selections or log a new trip to see data here."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <section className="mt-6 space-y-6 lg:space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-foreground">Highlights</h2>
                    <p className="text-sm text-muted-foreground">
                      Key stats across your selected date range. Adjust the filters to explore other periods or venues.
                    </p>
                  </div>
                  <StatsCards
                    totalCatches={stats.totalCatches}
                    pbLabel={stats.pbCatch?.label ?? "—"}
                    averageWeightLabel={averageWeightLabel}
                    weightedCatchCount={weightedCatchCount}
                    sessionsCount={sessionsCount}
                    averagePerSessionLabel={averagePerSessionLabel}
                    mostCommonSpecies={mostCommonSpecies}
                    mostCommonSpeciesCount={mostCommonSpeciesCount}
                  />
                </section>

                <section className="mt-10 space-y-6 lg:space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-foreground">Catch trends</h2>
                    <p className="text-sm text-muted-foreground">
                      Track when your catches happen and spot momentum across your logs.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ChartCard
                      icon={CalendarDays}
                      title="Catch trend"
                      description="Monthly totals for the selected range."
                      isEmpty={monthlyCounts.length === 0}
                      emptyMessage="Add more catches to reveal the timeline."
                      footer={peakMonthEntry ? catchTrendSummary : undefined}
                    >
                      <TrendLineChart
                        data={trendLineData}
                        theme={nivoTheme}
                        color={primaryColor}
                        gradientId={trendGradientId}
                      />
                    </ChartCard>

                    <ChartCard
                      icon={BarChart3}
                      title="Time of day performance"
                      description="Track when your catches most often happen."
                      isEmpty={false}
                      footer={showTimeOfDayChart ? timeOfDaySummary : undefined}
                    >
                      {showTimeOfDayChart ? (
                        <p className="text-sm text-foreground">
                          Most fish landed during <span className="font-semibold">{topTimeOfDayBucket?.label?.toLowerCase()} hours</span>.
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Not enough data yet. Log a few more catches to unlock this view.
                        </p>
                      )}
                    </ChartCard>
                  </div>
                </section>

                <section className="mt-10 space-y-6 lg:space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-foreground">Species & baits</h2>
                    <p className="text-sm text-muted-foreground">
                      Focus on the species you’re most successful with and the baits that earn the most strikes. Top 5
                      entries shown on mobile.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <ChartCard
                      icon={Sparkles}
                      title="Species mix"
                      description="Top species landed during this period."
                      isEmpty={speciesBarData.length === 0}
                      emptyMessage="No species data available for this view."
                    >
                      {speciesBarData.length > 0 ? (
                        <ol className="space-y-2 text-sm">
                          {speciesBarData.slice(0, 5).map((item, index) => (
                            <li key={item.label} className="flex items-center justify-between gap-4">
                              <span className="font-medium text-foreground">
                                {index + 1}. {item.label}
                              </span>
                              <span className="text-muted-foreground">
                                {item.catches} catch{item.catches === 1 ? "" : "es"}
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </ChartCard>

                    <ChartCard
                      icon={Anchor}
                      title="Favourite baits"
                      description="The lures and baits that seal the deal most often."
                      isEmpty={baitData.length === 0}
                      emptyMessage="No bait data logged yet."
                    >
                      {baitData.length > 0 ? (
                        <ol className="space-y-2 text-sm">
                          {baitData.slice(0, 5).map((item, index) => (
                            <li key={item.label} className="flex items-center justify-between gap-4">
                              <span className="font-medium text-foreground">
                                {index + 1}. {item.label}
                              </span>
                              <span className="text-muted-foreground">
                                {item.catches} catch{item.catches === 1 ? "" : "es"}
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </ChartCard>
                  </div>
                </section>

                <section className="mt-10 space-y-6 lg:space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-foreground">Techniques & venues</h2>
                    <p className="text-sm text-muted-foreground">
                      Compare the methods you rely on most and review venue-level takeaways.
                    </p>
                  </div>

                  <ChartCard
                    icon={Anchor}
                    title="Productive methods"
                    description="Compare which techniques deliver the goods."
                    isEmpty={methodData.length === 0}
                    emptyMessage="No method data captured yet."
                    footer={methodFooter}
                  >
                    {methodData.length > 0 ? (
                      <ol className="space-y-2 text-sm">
                        {methodData.slice(0, 5).map((item, index) => (
                          <li key={item.label} className="flex items-center justify-between gap-4">
                            <span className="font-medium text-foreground">
                              {index + 1}. {item.label}
                            </span>
                            <span className="text-muted-foreground">
                              {item.catches} catch{item.catches === 1 ? "" : "es"}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </ChartCard>

                  <InfoCards
                    topTimeOfDay={stats.topTimeOfDay}
                    topWeather={topWeather}
                    topClarity={topClarity}
                    topWind={topWind}
                    averageAirTempLabel={averageAirTempLabel}
                    venueLeaderboard={venueLeaderboard}
                    sessionsCount={sessionsCount}
                    averagePerSessionLabel={averagePerSessionLabel}
                    sessionSummaries={sessionSummaries}
                    topSession={topSession}
                    topVenueHighlight={topVenueHighlight}
                  />
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Insights;
