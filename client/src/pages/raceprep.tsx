import { useState, useMemo } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, MapPin, Calendar, Snowflake, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type RacePrep = {
  id: number;
  raceName: string;
  date: string;
  location: string;
  weatherNotes: string | null;
  grindType: string | null;
  grindStone: string | null;
  grindPattern: string | null;
  productId: number | null;
  productNotes: string | null;
  methodology: string | null;
  structure: string | null;
  notes: string | null;
  groupScope: string;
  teamId: number;
  createdAt: string;
  createdById: number;
  createdByName: string;
};

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

const RACEPREP_LAST_GROUP_KEY = "glidr-raceprep-last-group";

const schema = z.object({
  raceName: z.string().min(1, "Race name is required"),
  date: z.string().min(1, "Date is required"),
  location: z.string().min(1, "Location is required"),
  weatherNotes: z.string().optional(),
  grindType: z.string().optional(),
  grindStone: z.string().optional(),
  grindPattern: z.string().optional(),
  productId: z.coerce.number().nullable().optional(),
  productNotes: z.string().optional(),
  methodology: z.string().optional(),
  structure: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const NONE_VALUE = "__none__";

function RacePrepForm({
  initial,
  onSaved,
  userGroups,
  selectedGroup,
  onGroupChange,
  products,
}: {
  initial?: RacePrep;
  onSaved: () => void;
  userGroups: string[];
  selectedGroup: string;
  onGroupChange: (group: string) => void;
  products: Product[];
}) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      raceName: initial?.raceName ?? "",
      date: initial?.date ?? today,
      location: initial?.location ?? "",
      weatherNotes: initial?.weatherNotes ?? "",
      grindType: initial?.grindType ?? "",
      grindStone: initial?.grindStone ?? "",
      grindPattern: initial?.grindPattern ?? "",
      productId: initial?.productId ?? null,
      productNotes: initial?.productNotes ?? "",
      methodology: initial?.methodology ?? "",
      structure: initial?.structure ?? "",
      notes: initial?.notes ?? "",
    },
  });

  const preparePayload = (data: FormValues) => ({
    ...data,
    weatherNotes: data.weatherNotes || null,
    grindType: data.grindType || null,
    grindStone: data.grindStone || null,
    grindPattern: data.grindPattern || null,
    productId: data.productId || null,
    productNotes: data.productNotes || null,
    methodology: data.methodology || null,
    structure: data.structure || null,
    notes: data.notes || null,
    groupScope: selectedGroup,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("POST", "/api/raceprep", preparePayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/raceprep"] });
      toast({ title: "Race prep entry added" });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const res = await apiRequest("PUT", `/api/raceprep/${initial!.id}`, preparePayload(data));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/raceprep"] });
      toast({ title: "Race prep entry updated" });
      onSaved();
    },
    onError: (e) => {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          if (initial) {
            updateMutation.mutate(values);
          } else {
            createMutation.mutate(values);
          }
        })}
        className="space-y-5 max-h-[70vh] overflow-y-auto pr-1"
      >
        {userGroups.length > 1 && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Group</h3>
            <Select value={selectedGroup} onValueChange={(v) => onGroupChange(v)}>
              <SelectTrigger data-testid="select-raceprep-group">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {userGroups.map((g) => (
                  <SelectItem key={g} value={g} data-testid={`option-raceprep-group-${g}`}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Race Info</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="raceName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Race Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-raceprep-name" placeholder="e.g., World Cup Sprint" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input {...field} type="date" data-testid="input-raceprep-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-raceprep-location" placeholder="e.g., Davos" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Weather</h3>
          <FormField
            control={form.control}
            name="weatherNotes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weather Notes</FormLabel>
                <FormControl>
                  <Textarea {...field} data-testid="input-raceprep-weather" placeholder="Temperature, snow conditions, humidity…" rows={2} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grinding</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="grindType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grind Type</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-raceprep-grindtype" placeholder="e.g., Cold" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="grindStone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stone</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-raceprep-grindstone" placeholder="e.g., SG-12" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="grindPattern"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pattern</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-raceprep-grindpattern" placeholder="e.g., Linear" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : NONE_VALUE}
                    onValueChange={(v) => field.onChange(v === NONE_VALUE ? null : Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-raceprep-product">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)} data-testid={`option-raceprep-product-${p.id}`}>
                          {p.brand} {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="productNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Notes</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-raceprep-productnotes" placeholder="Application details…" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preparation Details</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="methodology"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Methodology</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-raceprep-methodology" placeholder="e.g., Iron, cork…" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="structure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Structure</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-raceprep-structure" placeholder="e.g., V1, crosshatch…" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes & Experiences</h3>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea {...field} data-testid="input-raceprep-notes" placeholder="Race experiences, observations, results…" rows={3} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end pt-2">
          <Button type="submit" data-testid="button-save-raceprep">
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function RacePrepPage() {
  const { toast } = useToast();
  const { user, can } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RacePrep | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<RacePrep | undefined>();

  const { data: entries = [] } = useQuery<RacePrep[]>({ queryKey: ["/api/raceprep"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: groups = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/groups"] });

  const userGroups = useMemo(() => {
    if (user?.isAdmin && groups.length > 0) {
      return groups.map((g) => g.name);
    }
    return (user?.groupScope ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }, [user, groups]);

  const [selectedGroup, setSelectedGroup] = useState<string>(() => {
    const stored = localStorage.getItem(RACEPREP_LAST_GROUP_KEY);
    return stored || "";
  });

  const effectiveGroup = useMemo(() => {
    if (selectedGroup && userGroups.includes(selectedGroup)) return selectedGroup;
    return userGroups[0] ?? "";
  }, [selectedGroup, userGroups]);

  const handleGroupChange = (group: string) => {
    setSelectedGroup(group);
    localStorage.setItem(RACEPREP_LAST_GROUP_KEY, group);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/raceprep/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/raceprep"] });
      toast({ title: "Race prep entry deleted" });
    },
    onError: (e) => {
      toast({
        title: "Could not delete",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const canEdit = can("raceskis", "edit");
  const productMap = useMemo(() => {
    const m = new Map<number, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const sorted = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-raceprep-title">
              Race Prep
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-raceprep-subtitle">
              Log race day preparation data
            </p>
          </div>
          {canEdit && (
            <Dialog
              open={open}
              onOpenChange={(v) => {
                setOpen(v);
                if (!v) setEditing(undefined);
              }}
            >
              <DialogTrigger asChild>
                <Button data-testid="button-add-raceprep" size="sm">
                  <Plus className="mr-1.5 h-4 w-4" /> Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editing ? "Edit Race Prep" : "New Race Prep"}</DialogTitle>
                </DialogHeader>
                <RacePrepForm
                  initial={editing}
                  onSaved={() => {
                    setOpen(false);
                    setEditing(undefined);
                  }}
                  userGroups={userGroups}
                  selectedGroup={effectiveGroup}
                  onGroupChange={handleGroupChange}
                  products={products}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {sorted.length === 0 && (
          <div className="text-center py-12 text-muted-foreground" data-testid="text-raceprep-empty">
            No race prep entries yet. Add one to get started.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((entry) => {
            const product = entry.productId ? productMap.get(entry.productId) : null;
            return (
              <Card key={entry.id} className="p-4 space-y-3" data-testid={`card-raceprep-${entry.id}`}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground" data-testid={`text-raceprep-name-${entry.id}`}>
                      {entry.raceName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span data-testid={`text-raceprep-date-${entry.id}`}>{entry.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span data-testid={`text-raceprep-location-${entry.id}`}>{entry.location}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-edit-raceprep-${entry.id}`}
                        onClick={() => {
                          setEditing(entry);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-delete-raceprep-${entry.id}`}
                        onClick={() => setConfirmDelete(entry)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {entry.grindType && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800" data-testid={`badge-grind-${entry.id}`}>
                      <Snowflake className="h-2.5 w-2.5" />
                      {entry.grindType}
                      {entry.grindStone ? ` / ${entry.grindStone}` : ""}
                    </span>
                  )}
                  {product && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800" data-testid={`badge-product-${entry.id}`}>
                      {product.brand} {product.name}
                    </span>
                  )}
                  {entry.structure && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800" data-testid={`badge-structure-${entry.id}`}>
                      {entry.structure}
                    </span>
                  )}
                  {entry.methodology && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800" data-testid={`badge-methodology-${entry.id}`}>
                      {entry.methodology}
                    </span>
                  )}
                </div>

                {(entry.weatherNotes || entry.notes) && (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {entry.weatherNotes && (
                      <p data-testid={`text-raceprep-weather-${entry.id}`}>
                        <span className="font-medium">Weather:</span> {entry.weatherNotes}
                      </p>
                    )}
                    {entry.notes && (
                      <p data-testid={`text-raceprep-notes-${entry.id}`}>
                        <span className="font-medium">Notes:</span> {entry.notes}
                      </p>
                    )}
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                  {entry.createdByName} · {entry.groupScope}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Race Prep Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{confirmDelete?.raceName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-raceprep">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-raceprep"
              onClick={() => {
                if (confirmDelete) {
                  deleteMutation.mutate(confirmDelete.id);
                  setConfirmDelete(undefined);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
