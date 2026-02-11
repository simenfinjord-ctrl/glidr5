import { useMemo } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { login as mockLogin, seedUsers } from "@/lib/mock-auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const hint = useMemo(() => {
    return seedUsers.map((u) => u.email).join(" · ");
  }, []);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@fastski.local", password: "" },
  });

  return (
    <div className="min-h-screen fs-grid flex items-center justify-center px-4">
      <Card className="w-full max-w-md fs-card">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">
            FastSki is a prototype. Use a seeded account to continue.
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => {
                const user = mockLogin(values.email, values.password);
                if (!user) {
                  toast({
                    title: "Sign in failed",
                    description: "No user found for that email.",
                    variant: "destructive",
                  });
                  return;
                }
                setLocation("/dashboard");
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

              <Button type="submit" className="w-full" data-testid="button-login">
                Sign in
              </Button>

              <div className="rounded-xl border bg-background/60 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Seeded accounts</div>
                <div className="mt-1">{hint}</div>
                <div className="mt-2">Any password works in this prototype.</div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
