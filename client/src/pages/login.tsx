import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LogIn, Mail, Lock, ArrowLeft } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean().default(false),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: `
          radial-gradient(1200px 500px at 30% 20%, hsl(212 92% 58% / 0.10), transparent 60%),
          radial-gradient(800px 400px at 70% 80%, hsl(160 84% 39% / 0.06), transparent 55%),
          hsl(222 28% 8%)
        `,
      }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo.png" alt="US Ski Team" className="h-16 w-16 object-contain" />
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-sky-300 bg-clip-text text-transparent">
              Glidr
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A US Ski Team database
            </p>
          </div>
        </div>

        <Card className="fs-card overflow-hidden border-border/40">
          <div className="h-0.5 bg-gradient-to-r from-blue-500 via-emerald-400 to-violet-500" />
          <CardContent className="p-6">
            {showForgot ? (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                    <Mail className="h-6 w-6 text-blue-400" />
                  </div>
                  <h2 className="text-lg font-semibold">Forgot password?</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Contact your team administrator to reset your password. Admins can reset passwords from the Admin panel.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowForgot(false)}
                  data-testid="button-back-login"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to sign in
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(async (values) => {
                    setIsSubmitting(true);
                    try {
                      await login(values.email, values.password, values.rememberMe);
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
                  className="space-y-5"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="name@team.org"
                              autoComplete="email"
                              className="pl-10"
                              data-testid="input-email"
                            />
                          </div>
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
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground">Password</FormLabel>
                          <button
                            type="button"
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            onClick={() => setShowForgot(true)}
                            data-testid="button-forgot-password"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter your password"
                              autoComplete="current-password"
                              className="pl-10"
                              data-testid="input-password"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-remember-me"
                          />
                        </FormControl>
                        <FormLabel className="text-sm text-muted-foreground cursor-pointer">Remember me for 30 days</FormLabel>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20"
                    data-testid="button-login"
                    disabled={isSubmitting}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
