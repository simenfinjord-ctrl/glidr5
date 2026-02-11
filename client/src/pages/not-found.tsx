import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full fs-grid flex items-center justify-center px-4">
      <Card className="w-full max-w-md fs-card">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl leading-tight">Page not found</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                The page you’re trying to open doesn’t exist.
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <Link href="/dashboard">
              <Button data-testid="button-go-dashboard">Go to Dashboard</Button>
            </Link>
            <Link href="/tests/new">
              <Button
                variant="secondary"
                data-testid="button-go-new-test"
              >
                New test
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
