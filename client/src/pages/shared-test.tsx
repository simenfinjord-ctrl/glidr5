import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { GlidrIcon, GlidrLogo } from "@/components/glidr-logo";
import { Spinner } from "@/components/ui/spinner";

type SharedTestData = {
  test: {
    id: number;
    date: string;
    location: string;
    test_name: string | null;
    test_type: string;
    notes: string | null;
    distance_label_0km: string | null;
    distance_label_xkm: string | null;
    distance_labels: string | null;
    created_by_name: string;
    created_at: string;
  };
  entries: {
    ski_number: number;
    rank_0km: number | null;
    rank_xkm: number | null;
    result_0km_cm_behind: number | null;
    result_xkm_cm_behind: number | null;
    feeling_rank: number | null;
    kick_rank: number | null;
    methodology: string | null;
    free_text_product: string | null;
    brand: string | null;
    product_name: string | null;
    category: string | null;
  }[];
};

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-gray-400">—</span>;
  const color =
    rank === 1
      ? "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300"
      : rank === 2
      ? "bg-slate-100 text-slate-600 ring-1 ring-slate-300"
      : rank === 3
      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
      : "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold min-w-[28px] ${color}`}>
      {rank}
    </span>
  );
}

export default function SharedTest() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const { data, isLoading, isError } = useQuery<SharedTestData>({
    queryKey: [`/api/public/test/${token}`],
    queryFn: async () => {
      const res = await fetch(`/api/public/test/${token}`);
      if (!res.ok) throw new Error("not_found");
      return res.json();
    },
    retry: false,
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner className="h-8 w-8 text-emerald-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 px-4 text-center">
        <GlidrIcon size={48} />
        <h1 className="text-2xl font-bold text-gray-800">This link is no longer valid</h1>
        <p className="text-gray-500 max-w-sm">
          The test you are looking for does not exist or the share link has been removed.
        </p>
      </div>
    );
  }

  const { test, entries } = data;

  let distanceLabels: string[] = [];
  if (test.distance_labels) {
    try {
      const parsed = JSON.parse(test.distance_labels);
      if (Array.isArray(parsed) && parsed.length > 0) distanceLabels = parsed;
    } catch {}
  }
  if (distanceLabels.length === 0) {
    distanceLabels = [test.distance_label_0km || "0 km"];
    if (test.distance_label_xkm) distanceLabels.push(test.distance_label_xkm);
  }

  const hasXkm = distanceLabels.length > 1;

  const testTypeBadgeColor =
    test.test_type === "Glide"
      ? "bg-blue-100 text-blue-700"
      : test.test_type === "Grind"
      ? "bg-indigo-100 text-indigo-700"
      : "bg-emerald-100 text-emerald-700";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto">
          <GlidrLogo variant="dark" size={26} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Test info */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {test.test_name || test.location}
            </h1>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${testTypeBadgeColor}`}>
              {test.test_type}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
            <span>{test.date}</span>
            {test.test_name && <span>{test.location}</span>}
            <span>By {test.created_by_name}</span>
          </div>
          {test.notes && (
            <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">{test.notes}</p>
          )}
        </div>

        {/* Entries table */}
        {entries.length === 0 ? (
          <p className="text-gray-400 text-sm">No entries recorded for this test.</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Ski #</th>
                  <th className="text-left px-4 py-3">Product</th>
                  <th className="text-center px-4 py-3">{distanceLabels[0]}</th>
                  {hasXkm && <th className="text-center px-4 py-3">{distanceLabels[1]}</th>}
                  {entries.some((e) => e.feeling_rank !== null) && (
                    <th className="text-center px-4 py-3">Feeling</th>
                  )}
                  {entries.some((e) => e.kick_rank !== null) && (
                    <th className="text-center px-4 py-3">Kick</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const productLabel = entry.free_text_product
                    ? entry.free_text_product
                    : entry.brand && entry.product_name
                    ? `${entry.brand} ${entry.product_name}`
                    : entry.product_name || entry.brand || "—";
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{entry.ski_number}</td>
                      <td className="px-4 py-2.5 text-gray-600">{productLabel}</td>
                      <td className="px-4 py-2.5 text-center">
                        <RankBadge rank={entry.rank_0km} />
                        {entry.result_0km_cm_behind !== null && (
                          <span className="ml-1 text-xs text-gray-400">
                            {entry.result_0km_cm_behind > 0 ? `+${entry.result_0km_cm_behind}` : entry.result_0km_cm_behind} cm
                          </span>
                        )}
                      </td>
                      {hasXkm && (
                        <td className="px-4 py-2.5 text-center">
                          <RankBadge rank={entry.rank_xkm} />
                          {entry.result_xkm_cm_behind !== null && (
                            <span className="ml-1 text-xs text-gray-400">
                              {entry.result_xkm_cm_behind > 0 ? `+${entry.result_xkm_cm_behind}` : entry.result_xkm_cm_behind} cm
                            </span>
                          )}
                        </td>
                      )}
                      {entries.some((e) => e.feeling_rank !== null) && (
                        <td className="px-4 py-2.5 text-center">
                          <RankBadge rank={entry.feeling_rank} />
                        </td>
                      )}
                      {entries.some((e) => e.kick_rank !== null) && (
                        <td className="px-4 py-2.5 text-center">
                          <RankBadge rank={entry.kick_rank} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-xs text-gray-400">
          <GlidrIcon size={14} />
          <span>Powered by Glidr</span>
        </div>
      </footer>
    </div>
  );
}
