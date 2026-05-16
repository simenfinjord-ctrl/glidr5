import { useState } from "react";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LogIn, User, Lock, Mail, ArrowLeft, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const schema = z.object({
  username: z.string().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
  rememberMe: z.boolean().default(false),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", rememberMe: false },
  });

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: theme === "dark"
          ? `radial-gradient(ellipse 80% 60% at 50% -10%, hsl(215 40% 18% / 0.8), transparent 60%), hsl(224 20% 10%)`
          : `radial-gradient(ellipse 80% 60% at 50% -10%, hsl(212 80% 92% / 0.8), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, hsl(198 70% 90% / 0.5), transparent 50%), hsl(210 25% 97%)`,
      }}
    >
      <button
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        data-testid="button-login-theme-toggle"
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Welcome to Glidr
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to your ski testing account
            </p>
          </div>
        </div>

        <Card className="bg-card shadow-xl shadow-foreground/5 border-border rounded-2xl">
          <CardContent className="p-7">
            {showForgot ? (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                    <Mail className="h-6 w-6 text-green-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">Forgot password?</h2>
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
                      await login(values.username, values.password, values.rememberMe);
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
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground/80">Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="Enter your username"
                              autoComplete="username"
                              className="pl-10 h-11 bg-muted/30 border-border focus:bg-card"
                              data-testid="input-username"
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
                          <FormLabel className="text-sm font-medium text-foreground/80">Password</FormLabel>
                          <button
                            type="button"
                            className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors"
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
                              className="pl-10 h-11 bg-muted/30 border-border focus:bg-card"
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
                    className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm"
                    data-testid="button-login"
                    disabled={isSubmitting}
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>

                  <div className="text-center pt-2">
                    <span className="text-sm text-muted-foreground">Ny bruker? </span>
                    <Link href="/get-started" className="text-sm font-medium text-foreground underline underline-offset-4 hover:opacity-70">
                      Kom i gang
                    </Link>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground dark:text-muted-foreground mt-6 space-y-1">
          <p>Glidr &middot; A glide and performance database</p>
          <p>
            <a href="/what-is-glidr" className="underline hover:text-foreground transition-colors" data-testid="link-login-features">What is Glidr?</a>
            <span className="mx-2">|</span>
            <a href="/pricing" className="underline hover:text-foreground transition-colors" data-testid="link-login-pricing">Pricing</a>
            <span className="mx-2">|</span>
            <Link href="/demo" className="text-sm text-muted-foreground hover:text-foreground">
              Se demo
            </Link>
            <span className="mx-2">|</span>
            <a href="/legal" className="underline hover:text-foreground transition-colors" data-testid="link-login-legal">Legal</a>
            <span className="mx-2">|</span>
            <a href="/contact" className="underline hover:text-foreground transition-colors" data-testid="link-login-contact">Contact</a>
          </p>
        </div>
      </div>
    </div>
  );
}
