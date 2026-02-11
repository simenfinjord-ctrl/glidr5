import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const hint = seededEmails.join(" · ");

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@fastski.local", password: "" },
  });

  return (
    <div className="min-h-screen fs-grid flex items-center justify-center px-4">
      <Card className="w-full max-w-md fs-card">
        <CardHeader className="space-y-1">
          <div className="flex flex-col items-center gap-3 pb-2">
            <img src="/logo.png" alt="US Ski Team" className="h-16 w-16 object-contain" />
            <div className="text-center">
              <CardTitle className="text-2xl">FastSki</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                US Ski Team Testing & Documentation
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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

              <Button type="submit" className="w-full" data-testid="button-login" disabled={isSubmitting}>
                Sign in
              </Button>

              <div className="rounded-xl border bg-background/60 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Seeded accounts</div>
                <div className="mt-1">{hint}</div>
                <div className="mt-2">All accounts use password "password".</div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
