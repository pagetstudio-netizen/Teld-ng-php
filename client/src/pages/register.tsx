import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { FALLBACK_COUNTRIES, type ApiCountry } from "@/lib/countries";
import { CountrySelector } from "@/components/country-selector";
import { Eye, EyeOff, Loader2, LockKeyhole, Phone, ThumbsUp } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { useLanguage } from "@/lib/language";

function createRegisterSchema(t: ReturnType<typeof useLanguage>["t"]) {
  return z.object({
    phone: z.string().min(8, t("invalidPhone")),
    country: z.string().min(2, t("selectCountry")),
    password: z.string().min(6, t("minimumPassword")),
    confirmPassword: z.string().min(1, t("confirmPassword")),
    invitationCode: z.string().optional(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("passwordsDoNotMatch"),
    path: ["confirmPassword"],
  });
}

type RegisterForm = z.infer<ReturnType<typeof createRegisterSchema>>;

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const { register } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const countryWasSelected = useRef(false);

  const params = new URLSearchParams(searchString);
  // The current invitation format is /invitation?invite?code=ABC123.
  // Because the format contains a second "?", parse that part explicitly.
  const currentInvitationMatch = searchString.match(/[?&]code=([^&?#]+)/i);
  const refCode = currentInvitationMatch?.[1]
    || params.get("money")
    || params.get("reg")
    || params.get("code")
    || "";

  const registerSchema = useMemo(() => createRegisterSchema(t), [t]);
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      phone: "",
      country: "PH",
      password: "",
      confirmPassword: "",
      invitationCode: refCode,
    },
  });

  const { data: apiCountries } = useQuery<ApiCountry[]>({
    queryKey: ["/api/countries"],
  });

  const { data: registrationDefault } = useQuery<{ country?: "PH" | "NG" }>({
    queryKey: ["/api/registration-default-country"],
  });

  const selectedCountry = form.watch("country");

  useEffect(() => {
    if (apiCountries === undefined) return;
    const isValid = apiCountries.some(ac => ac.code === selectedCountry && ac.isActive);
    if (!isValid) {
      const first = apiCountries.find(ac => ac.isActive);
      if (first) form.setValue("country", first.code);
    }
  }, [apiCountries, selectedCountry, form]);

  useEffect(() => {
    if (countryWasSelected.current || !registrationDefault?.country) return;
    const isAvailable = apiCountries === undefined ||
      apiCountries.some((country) => country.code === registrationDefault.country && country.isActive);
    if (isAvailable) {
      form.setValue("country", registrationDefault.country, { shouldValidate: true });
    }
  }, [apiCountries, form, registrationDefault]);

  const countryData = (() => {
    if (apiCountries !== undefined) {
      const c = apiCountries.find(ac => ac.code === selectedCountry && ac.isActive);
      if (c) return { phonePrefix: c.phonePrefix, name: c.name };
      return null;
    }
    const f = FALLBACK_COUNTRIES.find(fc => fc.code === selectedCountry);
    return f ? { phonePrefix: f.phonePrefix, name: f.name } : null;
  })();

  async function onSubmit(data: RegisterForm) {
    setIsLoading(true);
    try {
      await register({
        fullName: `User_${data.phone}`,
        phone: data.phone,
        country: data.country,
        password: data.password,
        invitationCode: data.invitationCode,
      });
      toast({ title: "Registration successful!", description: "Welcome to TELD (Tcharging)!" });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Registration error", description: error.message || "An error occurred", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const displayedPrefix = countryData?.phonePrefix || "63";

  return (
    <AuthLayout mode="register">
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
            <input {...form.register("password")} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={t("password")} data-testid="input-password" />
            <button type="button" className="auth-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t("hidePassword") : t("showPassword")}>
              {showPassword ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </button>
          </div>
          {form.formState.errors.password && <p className="auth-error">{form.formState.errors.password.message}</p>}

          <div className="auth-field">
            <LockKeyhole className="auth-field-icon" aria-hidden="true" />
            <input {...form.register("confirmPassword")} type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder={t("enterPasswordAgain")} data-testid="input-confirm-password" />
            <button type="button" className="auth-visibility" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? t("hidePassword") : t("showPassword")}>
              {showConfirmPassword ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
            </button>
          </div>
          {form.formState.errors.confirmPassword && <p className="auth-error">{form.formState.errors.confirmPassword.message}</p>}

          <div className="auth-field">
            <ThumbsUp className="auth-field-icon" aria-hidden="true" />
            <input {...form.register("invitationCode")} placeholder={t("invitationCode")} data-testid="input-invitation-code" />
          </div>
        </div>

        <button type="submit" disabled={isLoading} className="auth-submit" data-testid="button-register">
          {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : t("signUp")}
        </button>
      </form>

      <CountrySelector
        selectedCountryCode={selectedCountry}
        open={countryModalOpen}
        onClose={() => setCountryModalOpen(false)}
        onSelect={(code) => {
          countryWasSelected.current = true;
          form.setValue("country", code, { shouldValidate: true });
        }}
      />
    </AuthLayout>
  );
}
