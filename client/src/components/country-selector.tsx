import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FALLBACK_COUNTRIES, type ApiCountry } from "@/lib/countries";
import { Check, Search, X } from "lucide-react";
import { useLanguage } from "@/lib/language";

interface CountrySelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (countryCode: string) => void;
  selectedCountryCode?: string;
}

export function CountrySelector({ open, onClose, onSelect, selectedCountryCode }: CountrySelectorProps) {
  const [search, setSearch] = useState("");
  const { t } = useLanguage();
  const { data: apiCountries } = useQuery<ApiCountry[]>({
    queryKey: ["/api/countries"],
    enabled: open,
  });

  if (!open) return null;

  const countries = (apiCountries !== undefined
    ? apiCountries.filter(c => c.isActive).map(c => ({ code: c.code, name: c.name, phonePrefix: c.phonePrefix }))
    : FALLBACK_COUNTRIES.map(c => ({ code: c.code, name: c.name, phonePrefix: c.phonePrefix })))
    .filter(country => {
      const query = search.trim().toLowerCase();
      return !query || country.name.toLowerCase().includes(query) || country.phonePrefix.includes(query);
    });

  return (
    <div className="country-picker-overlay" onClick={onClose}>
      <section
        className="country-picker"
        role="dialog"
        aria-modal="true"
         aria-label={t("chooseCountry")}
        onClick={(event) => event.stopPropagation()}
      >
         <button className="country-picker-close" onClick={onClose} aria-label={t("close")}>
          <X aria-hidden="true" />
        </button>
        <div className="country-picker-search">
          <Search aria-hidden="true" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
             placeholder={t("search")}
             aria-label={t("searchCountries")}
          />
        </div>
        <div className="country-picker-list">
          {countries.map((country) => {
            const selected = country.code === selectedCountryCode;
            return (
              <button
                key={country.code}
                className={`country-picker-row${selected ? " is-selected" : ""}`}
                onClick={() => { onSelect(country.code); setSearch(""); onClose(); }}
                data-testid={`country-option-${country.code}`}
              >
                <span>{country.name} (+{country.phonePrefix})</span>
                {selected && <span className="country-picker-check"><Check aria-hidden="true" /></span>}
              </button>
            );
          })}
           {countries.length === 0 && <p className="country-picker-empty">{t("noCountriesFound")}</p>}
        </div>
      </section>
    </div>
  );
}