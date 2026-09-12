import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { FALLBACK_COUNTRIES, type ApiCountry } from "@/lib/countries";
import { CountrySelector } from "@/components/country-selector";
import { Eye, EyeOff, Loader2, LockKeyhole, Phone } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { useLanguage } from "@/lib/language";

function createLoginSchema(t: ReturnType<typeof useLanguage>["t"]) {
  return z.object({
    phone: z.string().min(8, t("invalidPhone")),
    country: z.string().min(2, t("selectCountry")),
    password: z.string().min(1, t("passwordRequired")),
  });
}

type LoginForm = z.infer<ReturnType<typeof createLoginSchema>>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const loginSchema = useMemo(() => createLoginSchema(t), [t]);
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: "",
      country: "PH",
      password: "",
    },
  });

  const { data: apiCountries } = useQuery<ApiCountry[]>({
    queryKey: ["/api/countries"],
  });

  const selectedCountry = form.watch("country");

  useEffect(() => {
    // Remove credentials persisted by versions that stored login data locally.
    localStorage.removeItem("doosan_credentials");
    localStorage.removeItem("doosan_login_preferences");
  }, []);

  useEffect(() => {
    if (apiCountries === undefined) return;
    const isValid = apiCountries.some(ac => ac.code === selectedCountry && ac.isActive);
    // Keep a remembered/selected country long enough for the server to apply
    // the administrator-only cross-country login rule.
    if (!isValid) {
      const first = apiCountries.find(ac => ac.isActive);
      if (first) form.setValue("country", first.code);
    }
  }, [apiCountries, selectedCountry, form]);

  const countryData = (() => {
    if (apiCountries !== undefined) {
      const c = apiCountries.find(ac => ac.code === selectedCountry && ac.isActive);
      if (c) return { phonePrefix: c.phonePrefix, name: c.name };
      return null;
    }
    const f = FALLBACK_COUNTRIES.find(fc => fc.code === selectedCountry);
    return f ? { phonePrefix: f.phonePrefix, name: f.name } : null;
  })();

  async function onSubmit(data: LoginForm) {
    setIsLoading(true);
    try {
      await login(data.phone, data.country, data.password);
      navigate("/");
    } catch (error: any) {
      toast({ title: "Sign-in error", description: error.message || "Check your information", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const displayedPrefix = countryData?.phonePrefix || "63";

  return (
    <AuthLayout mode="login" showLanguage>
      <form className="auth-form" onSubmit={form.handleSubmit(onSubmit)}>
        <input type="hidden" {...form.register("country")} />

        <div className="auth-fields">
          <div className="auth-field">
            <button type="button" className="auth-prefix" onClick={() => setCountryModalOpen(true)} data-testid="button-select-country" aria-label="Choose country">
              <Phone aria-hidden="true" />
              <span>+{displayedPrefix}</span>
            </button>
            <input {...form.register("phone")} type="tel" autoComplete="username" placeholder={t("phoneNumber")} data-testid="input-phone" />
          </div>
          {form.formState.errors.phone && <p className="auth-error">{form.formState.errors.phone.message}</p>}

          <div className="auth-field">
            <LockKeyhole className="auth-field-icon" aria-hidden="true" />
            <input {...form.register("password")} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={t("password")} data-testid="input-password" />
            <button type="button" className="auth-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t("hidePassword") : t("showPassword")}>
              {showPassword ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </button>
          </div>
          {form.formState.errors.password && <p className="auth-error">{form.formState.errors.password.message}</p>}
        </div>

        <button type="submit" disabled={isLoading} className="auth-submit" data-testid="button-login">
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : t("signIn")}
        </button>
      </form>

      <CountrySelector selectedCountryCode={selectedCountry} open={countryModalOpen} onClose={() => setCountryModalOpen(false)} onSelect={(code) => form.setValue("country", code, { shouldValidate: true })} />
    </AuthLayout>
  );
}
