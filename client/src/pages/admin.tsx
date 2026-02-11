import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { getCurrentUser, seedUsers } from "@/lib/mock-auth";

export default function Admin() {
  const user = getCurrentUser();

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  if (!user.isAdmin) {
    return (
      <AppShell>
        <Card className="fs-card rounded-2xl p-6" data-testid="status-admin-forbidden">
          <div className="text-base font-semibold">Admin only</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Your account does not have access to Admin tools.
          </div>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl sm:text-3xl">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="text-admin-subtitle">
            Prototype user/group management (mock).
          </p>
        </div>

        <Card className="fs-card rounded-2xl p-6">
          <div className="text-sm font-semibold">Users</div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {seedUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2"
                data-testid={`row-user-${u.id}`}
              >
                <div>
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email} · Group {u.groupScope}</div>
                </div>
                <div className="rounded-full border bg-card/70 px-3 py-1 text-xs">
                  {u.isAdmin ? "Admin" : "Member"}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="fs-card rounded-2xl p-6" data-testid="card-admin-groups">
          <div className="text-sm font-semibold">Groups</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Admin, World Cup, U23, Biathlon (mock role scopes).
          </div>
        </Card>

        <Card className="fs-card rounded-2xl p-6" data-testid="card-admin-permissions">
          <div className="text-sm font-semibold">Permissions</div>
          <div className="mt-2 text-sm text-muted-foreground">
            Server-side permission checks are required for a real app. This prototype demonstrates the UI structure.
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
