import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Lightbulb, ThermometerSnowflake, Droplets } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Suggestion = {
  title: string;
  description: string;
  products: string[];
  confidence: string;
};

const SNOW_TYPE_OPTIONS = [
  "Artificial",
  "Natural - Falling new",
  "Natural - New",
  "Natural - Irreg. dir. new",
  "Natural - Irreg. dir. transf.",
  "Natural - Transformed",
];

const GRAIN_SIZE_OPTIONS = ["Extra fine", "Fine", "Medium", "Coarse", "Very coarse"];

const SNOW_HUMIDITY_TYPE_OPTIONS = ["Dry", "Moist", "Wet", "Very wet", "Slush"];

const TRACK_HARDNESS_OPTIONS = ["Very soft", "Soft", "Medium", "Hard", "Very hard", "Ice"];

function getConfidenceBadgeClass(confidence: string) {
  switch (confidence.toLowerCase()) {
    case "high":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800";
    case "medium":
      return "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800";
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

export default function Suggestions() {
  const { toast } = useToast();
  const { t } = useI18n();

  const [testType, setTestType] = useState("Glide");
  const [snowTemperatureC, setSnowTemperatureC] = useState("-3");
  const [airTemperatureC, setAirTemperatureC] = useState("-5");
  const [snowHumidityPct, setSnowHumidityPct] = useState("50");
  const [airHumidityPct, setAirHumidityPct] = useState("70");
  const [snowType, setSnowType] = useState("Artificial");
  const [grainSize, setGrainSize] = useState("Medium");
  const [snowHumidityType, setSnowHumidityType] = useState("Dry");
  const [trackHardness, setTrackHardness] = useState("Medium");

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let artificialSnow: string | null = null;
      let naturalSnow: string | null = null;

      if (snowType === "Artificial") {
        artificialSnow = snowType;
      } else {
        naturalSnow = snowType.replace("Natural - ", "");
      }

      const res = await apiRequest("POST", "/api/suggestions", {
        testType,
        snowTemperatureC: parseFloat(snowTemperatureC) || 0,
        airTemperatureC: parseFloat(airTemperatureC) || 0,
        snowHumidityPct: parseFloat(snowHumidityPct) || 0,
        airHumidityPct: parseFloat(airHumidityPct) || 0,
        artificialSnow,
        naturalSnow,
        grainSize,
        snowHumidityType,
        trackHardness,
      });
      return res.json();
    },
    onSuccess: (data: { suggestions: Suggestion[] }) => {
      setSuggestions(data.suggestions);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-suggestions-title">
            {t("suggestions.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-suggestions-subtitle">
            {t("suggestions.subtitle")}
          </p>
        </div>

        <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-weather-params">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 dark:bg-green-900/30">
              <ThermometerSnowflake className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-base font-semibold">Weather Parameters</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("suggestions.testType")}</label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger data-testid="select-test-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Glide">Glide</SelectItem>
                  <SelectItem value="Structure">Structure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("suggestions.snowTemp")}</label>
              <Input
                type="text"
                inputMode="numeric"
                value={snowTemperatureC}
                onChange={(e) => setSnowTemperatureC(e.target.value)}
                data-testid="input-snow-temp"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("suggestions.airTemp")}</label>
              <Input
                type="text"
                inputMode="numeric"
                value={airTemperatureC}
                onChange={(e) => setAirTemperatureC(e.target.value)}
                data-testid="input-air-temp"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("suggestions.snowHumidity")}</label>
              <Input
                type="text"
                inputMode="numeric"
                value={snowHumidityPct}
                onChange={(e) => setSnowHumidityPct(e.target.value)}
                data-testid="input-snow-humidity"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("suggestions.airHumidity")}</label>
              <Input
                type="text"
                inputMode="numeric"
                value={airHumidityPct}
                onChange={(e) => setAirHumidityPct(e.target.value)}
                data-testid="input-air-humidity"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("suggestions.snowType")}</label>
              <Select value={snowType} onValueChange={setSnowType}>
                <SelectTrigger data-testid="select-snow-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SNOW_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("suggestions.grainSize")}</label>
              <Select value={grainSize} onValueChange={setGrainSize}>
                <SelectTrigger data-testid="select-grain-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRAIN_SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("suggestions.snowHumidityType")}</label>
              <Select value={snowHumidityType} onValueChange={setSnowHumidityType}>
                <SelectTrigger data-testid="select-snow-humidity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SNOW_HUMIDITY_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">{t("suggestions.trackHardness")}</label>
              <Select value={trackHardness} onValueChange={setTrackHardness}>
                <SelectTrigger data-testid="select-track-hardness">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRACK_HARDNESS_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg"
              data-testid="button-get-recommendations"
            >
              {mutation.isPending ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  {t("suggestions.analyzing")}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("suggestions.getRecommendations")}
                </>
              )}
            </Button>
          </div>
        </Card>

        {mutation.isPending && (
          <Card className="fs-card rounded-2xl p-8 text-center" data-testid="card-loading">
            <Sparkles className="mx-auto h-12 w-12 text-violet-500 animate-pulse" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">{t("suggestions.analyzing")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("suggestions.analyzing")}</p>
          </Card>
        )}

        {!mutation.isPending && suggestions === null && (
          <Card className="fs-card rounded-2xl p-8 text-center" data-testid="card-empty-state">
            <Lightbulb className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">Enter weather parameters and click "Get Recommendations" to find the best products based on your test history.</p>
          </Card>
        )}

        {!mutation.isPending && suggestions && suggestions.length === 0 && (
          <Card className="fs-card rounded-2xl p-8 text-center" data-testid="card-no-results">
            <Droplets className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground">{t("suggestions.noResults")}</p>
          </Card>
        )}

        {!mutation.isPending && suggestions && suggestions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
                <Lightbulb className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <h2 className="text-base font-semibold" data-testid="text-results-heading">{t("suggestions.results")}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suggestions.map((suggestion, index) => (
                <Card key={index} className="fs-card rounded-2xl p-4 sm:p-5" data-testid={`card-suggestion-${index}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-foreground" data-testid={`text-suggestion-title-${index}`}>
                      {suggestion.title}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 whitespace-nowrap ${getConfidenceBadgeClass(suggestion.confidence)}`}
                      data-testid={`badge-confidence-${index}`}
                    >
                      {suggestion.confidence}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3" data-testid={`text-suggestion-desc-${index}`}>
                    {suggestion.description}
                  </p>

                  {suggestion.products.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{t("suggestions.recommendedProducts")}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestion.products.map((product, pIdx) => (
                          <span
                            key={pIdx}
                            className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-green-200 dark:ring-green-800"
                            data-testid={`badge-product-${index}-${pIdx}`}
                          >
                            {product}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
