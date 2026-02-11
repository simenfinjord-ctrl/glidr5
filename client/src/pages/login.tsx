import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

const seededEmails = [
  "admin@fastski.local",
  "u23@fastski.local",
  "wc@fastski.local",
  "biathlon@fastski.local",
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@fastski.local", password: "" },
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{
      background: `
        radial-gradient(1200px 500px at 30% 20%, hsl(212 92% 58% / 0.12), transparent 60%),
        radial-gradient(800px 400px at 70% 80%, hsl(160 84% 39% / 0.08), transparent 55%),
        radial-gradient(600px 300px at 50% 50%, hsl(280 80% 60% / 0.06), transparent 50%),
        hsl(222 28% 8%)
      `
    }}>
      <Card className="w-full max-w-md fs-card overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-violet-500" />
        <CardHeader className="space-y-1 pt-8 pb-2">
          <div className="flex flex-col items-center gap-4 pb-2">
            <div className="relative">
              <img src="/logo.png" alt="US Ski Team" className="h-20 w-20 object-contain" />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-card" />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">FastSki</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                US Ski Team Testing & Documentation
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-8">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (values) => {
                setIsSubmitting(true);
                try {
                  await login(values.email, values.password);
                  setLocation("/dashboard");
                } catch (e) {
                  toast({
                    title: "Sign in failed",
                    description: e instanceof Error ? e.message : "Invalid credentials.",
                    variant: "destructive",
                  });
                } finally {
                  setIsSubmitting(false);
                }
              })}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="name@team.org"
                        autoComplete="email"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Password"
                        autoComplete="current-password"
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90" data-testid="button-login" disabled={isSubmitting}>
                Sign in
              </Button>

              <div className="rounded-xl border border-border/40 bg-background/30 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Demo accounts</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {seededEmails.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                      onClick={() => form.setValue("email", e)}
                      data-testid={`button-email-${e.split("@")[0]}`}
                    >
                      {e.split("@")[0]}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[11px]">All accounts use password <code className="rounded bg-muted px-1 py-0.5 font-mono">password</code></div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
