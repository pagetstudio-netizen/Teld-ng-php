import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "fr";

const translations = {
  en: {
    language: "Language",
    switchToFrench: "Switch to French",
    switchToEnglish: "Switch to English",
    signIn: "Sign in",
    signUp: "Sign up",
    phoneNumber: "Phone number",
    password: "Password",
    invitationCode: "Invitation code",
    enterPasswordAgain: "Enter your password again",
    chooseCountry: "Choose a country",
    showPassword: "Show password",
    hidePassword: "Hide password",
    invalidPhone: "Invalid phone number",
    selectCountry: "Select a country",
    passwordRequired: "Password is required",
    minimumPassword: "At least 6 characters",
    confirmPassword: "Confirm your password",
    passwordsDoNotMatch: "Passwords do not match",
    search: "Search",
    searchCountries: "Search countries",
    close: "Close",
    noCountriesFound: "No countries found",
  },
  fr: {
    language: "Langue",
    switchToFrench: "Passer en français",
    switchToEnglish: "Passer en anglais",
    signIn: "Se connecter",
    signUp: "S'inscrire",
    phoneNumber: "Numéro de téléphone",
    password: "Mot de passe",
    invitationCode: "Code d'invitation",
    enterPasswordAgain: "Saisissez à nouveau votre mot de passe",
    chooseCountry: "Choisir un pays",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    invalidPhone: "Numéro de téléphone invalide",
    selectCountry: "Sélectionnez un pays",
    passwordRequired: "Le mot de passe est obligatoire",
    minimumPassword: "6 caractères minimum",
    confirmPassword: "Confirmez votre mot de passe",
    passwordsDoNotMatch: "Les mots de passe ne correspondent pas",
    search: "Rechercher",
    searchCountries: "Rechercher un pays",
    close: "Fermer",
    noCountriesFound: "Aucun pays trouvé",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const LANGUAGE_STORAGE_KEY = "teld-language";

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "fr" ? "fr" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const toggleLanguage = () => setLanguage(language === "en" ? "fr" : "en");

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    toggleLanguage,
    t: (key) => translations[language][key],
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}