import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Upload,
  FileSpreadsheet,
  Sparkles,
  ArrowRight,
  Check,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/spinner";

type ColumnMapping = {
  csvColumn: string;
  appField: string | null;
  sampleValues: string[];
};

type ImportMapping = {
  mappings: ColumnMapping[];
  targetType: string;
  previewRows: Record<string, string>[];
};

type ImportResult = {
  imported: number;
  errors: string[];
};

const TARGET_TYPES = [
  { value: "tests", label: "Tests" },
  { value: "products", label: "Products" },
  { value: "weather", label: "Weather" },
  { value: "series", label: "Test Ski Series" },
];

const APP_FIELDS: Record<string, { value: string; label: string }[]> = {
  tests: [
    { value: "date", label: "Date" },
    { value: "location", label: "Location" },
    { value: "testType", label: "Test Type (Glide/Structure)" },
    { value: "seriesName", label: "Series Name" },
    { value: "notes", label: "Notes" },
    { value: "skiNumber", label: "Ski Number" },
    { value: "productBrand", label: "Product Brand" },
    { value: "productName", label: "Product Name" },
    { value: "methodology", label: "Methodology" },
    { value: "result", label: "Result (cm behind)" },
    { value: "feelingRank", label: "Feeling Rank" },
  ],
  products: [
    { value: "category", label: "Category (Glide/Topping/Structure)" },
    { value: "brand", label: "Brand" },
    { value: "name", label: "Name" },
  ],
  weather: [
    { value: "date", label: "Date" },
    { value: "time", label: "Time" },
    { value: "location", label: "Location" },
    { value: "snowTemperatureC", label: "Snow Temperature (C)" },
    { value: "airTemperatureC", label: "Air Temperature (C)" },
    { value: "snowHumidityPct", label: "Snow Humidity (%)" },
    { value: "airHumidityPct", label: "Air Humidity (%)" },
    { value: "clouds", label: "Clouds (0-8)" },
    { value: "visibility", label: "Visibility" },
    { value: "wind", label: "Wind" },
    { value: "precipitation", label: "Precipitation" },
    { value: "artificialSnow", label: "Artificial Snow" },
    { value: "naturalSnow", label: "Natural Snow" },
    { value: "grainSize", label: "Grain Size" },
    { value: "snowHumidityType", label: "Snow Humidity Type" },
    { value: "trackHardness", label: "Track Hardness" },
    { value: "testQuality", label: "Test Quality (1-10)" },
  ],
  series: [
    { value: "name", label: "Name" },
    { value: "type", label: "Type (Glide/Structure)" },
    { value: "brand", label: "Brand" },
    { value: "skiType", label: "Ski Type" },
    { value: "grind", label: "Grind" },
    { value: "numberOfSkis", label: "Number of Skis" },
  ],
};

type Group = { id: number; name: string };

export default function ImportPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<"upload" | "mapping" | "result">("upload");
  const [targetType, setTargetType] = useState("tests");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const userGroups = user?.groupScope
    ? user.groupScope.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];
  const isMultiGroup = userGroups.length > 1 || !!user?.isAdmin;

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    enabled: !!isMultiGroup,
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/import/analyze", {
        csvText,
        targetType,
      });
      return res.json() as Promise<ImportMapping>;
    },
    onSuccess: (data) => {
      setMapping(data);
      setStep("mapping");
    },
    onError: (err: Error) => {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!mapping) throw new Error("No mapping");
      const res = await apiRequest("POST", "/api/import/execute", {
        csvText,
        mappings: mapping.mappings,
        targetType: mapping.targetType,
        groupScope: selectedGroup || userGroups[0] || "Admin",
      });
      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weather"] });
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
    },
    onError: (err: Error) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string);
    };
    reader.readAsText(file);
  }, []);

  const updateMapping = (index: number, appField: string | null) => {
    if (!mapping) return;
    const updated = [...mapping.mappings];
    updated[index] = { ...updated[index], appField };
    setMapping({ ...mapping, mappings: updated });
  };

  const resetImport = () => {
    setStep("upload");
    setCsvText("");
    setFileName("");
    setMapping(null);
    setResult(null);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-import-title">
            Import Data
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload a CSV file and AI will map your columns automatically
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <StepIndicator num={1} label="Upload" active={step === "upload"} done={step !== "upload"} />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator num={2} label="Map Columns" active={step === "mapping"} done={step === "result"} />
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <StepIndicator num={3} label="Import" active={step === "result"} done={false} />
        </div>

        {step === "upload" && (
          <Card className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Import type</label>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger data-testid="select-import-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isMultiGroup && (groups as Group[]).length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Group</label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                  <SelectTrigger data-testid="select-import-group">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups as Group[]).map((g: Group) => (
                      <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border/60 rounded-xl p-10 text-center hover:border-blue-500/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById("csv-file-input")?.click()}
              data-testid="dropzone-csv"
            >
              <input
                id="csv-file-input"
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFile}
                className="hidden"
                data-testid="input-csv-file"
              />
              {fileName ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-emerald-400" />
                  <p className="font-medium">{fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {csvText.split(/\r?\n/).filter((l) => l.trim()).length - 1} data rows detected
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="font-medium">Drop your CSV file here or click to browse</p>
                  <p className="text-sm text-muted-foreground">Supports CSV, TSV, and text files</p>
                </div>
              )}
            </div>

            <Button
              onClick={() => analyzeMutation.mutate()}
              disabled={!csvText || analyzeMutation.isPending}
              className="w-full"
              data-testid="button-analyze"
            >
              {analyzeMutation.isPending ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                  AI is analyzing your columns...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze with AI
                </>
              )}
            </Button>
          </Card>
        )}

        {step === "mapping" && mapping && (
          <Card className="p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Column Mapping</h2>
              <p className="text-sm text-muted-foreground">
                AI suggested these mappings. Adjust if needed before importing.
              </p>
            </div>

            <div className="space-y-3">
              {mapping.mappings.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-card/50 p-3 ring-1 ring-border/40"
                  data-testid={`mapping-row-${i}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{m.csvColumn}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {m.sampleValues.slice(0, 3).join(", ")}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <Select
                      value={m.appField || "_skip"}
                      onValueChange={(val) => updateMapping(i, val === "_skip" ? null : val)}
                    >
                      <SelectTrigger className="h-9" data-testid={`select-mapping-${i}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_skip">
                          <span className="text-muted-foreground">Skip this column</span>
                        </SelectItem>
                        {(APP_FIELDS[mapping.targetType] || []).map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            {mapping.previewRows.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Preview (first {mapping.previewRows.length} rows)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40">
                        {mapping.mappings
                          .filter((m) => m.appField)
                          .map((m, i) => (
                            <th key={i} className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                              {m.appField}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mapping.previewRows.map((row, ri) => (
                        <tr key={ri} className="border-b border-border/20">
                          {mapping.mappings
                            .filter((m) => m.appField)
                            .map((m, ci) => (
                              <td key={ci} className="px-2 py-1.5 truncate max-w-[150px]">
                                {row[m.csvColumn] || ""}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back">
                Back
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || !mapping.mappings.some((m) => m.appField)}
                className="flex-1"
                data-testid="button-import"
              >
                {importMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Import Data
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {step === "result" && result && (
          <Card className="p-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold">Import Complete</h2>
              <p className="text-muted-foreground">
                Successfully imported <strong>{result.imported}</strong> {mapping?.targetType || "records"}
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-medium text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {result.errors.length} row(s) had issues
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-amber-300/80">{err}</p>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={resetImport} className="w-full" data-testid="button-import-another">
              Import Another File
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function StepIndicator({
  num,
  label,
  active,
  done,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
          done
            ? "bg-emerald-500/20 text-emerald-400"
            : active
              ? "bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/40"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : num}
      </div>
      <span className={active ? "font-medium" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
