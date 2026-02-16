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
          radial-gradient(ellipse 80% 60% at 50% -10%, hsl(212 80% 92% / 0.8), transparent 60%),
          radial-gradient(ellipse 60% 50% at 80% 100%, hsl(198 70% 90% / 0.5), transparent 50%),
          hsl(210 25% 97%)
        `,
      }}
    >
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Welcome to Glidr
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Sign in to your ski testing account
            </p>
          </div>
        </div>

        <Card className="bg-white shadow-xl shadow-gray-200/50 border-gray-200/80 rounded-2xl">
          <CardContent className="p-7">
            {showForgot ? (
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                    <Mail className="h-6 w-6 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Forgot password?</h2>
                  <p className="text-sm text-gray-500 leading-relaxed">
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
                        <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              placeholder="name@team.org"
                              autoComplete="email"
                              className="pl-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white"
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
                          <FormLabel className="text-sm font-medium text-gray-700">Password</FormLabel>
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                            onClick={() => setShowForgot(true)}
                            data-testid="button-forgot-password"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              {...field}
                              type="password"
                              placeholder="Enter your password"
                              autoComplete="current-password"
                              className="pl-10 h-11 bg-gray-50/50 border-gray-200 focus:bg-white"
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
                        <FormLabel className="text-sm text-gray-500 cursor-pointer">Remember me for 30 days</FormLabel>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
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

        <p className="text-center text-xs text-gray-400 mt-6">
          Glidr &middot; A glide and performance database
        </p>
      </div>
    </div>
  );
}
