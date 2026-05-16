import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen w-full fs-grid flex items-center justify-center px-4">
      <Card className="w-full max-w-md fs-card">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl leading-tight">{t("notFound.title")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("notFound.desc")}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <AppLink href="/dashboard">
              <Button data-testid="button-go-dashboard">{t("notFound.goToDashboard")}</Button>
            </AppLink>
            <AppLink href="/tests/new">
              <Button variant="secondary" data-testid="button-go-new-test">
                {t("notFound.newTest")}
              </Button>
            </AppLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
