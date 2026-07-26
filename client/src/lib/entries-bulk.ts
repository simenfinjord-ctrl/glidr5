// One request for every test's entries — replaces the old per-test fan-out.
// Server mirrors the single-endpoint access rules (team, group, grind,
// athlete access, child-team curation), so this is a drop-in replacement.
export async function fetchEntriesBulk(ids: number[]): Promise<any[]> {
  if (ids.length === 0) return [];
  const res = await fetch("/api/test-entries/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) return [];
  return res.json();
}
