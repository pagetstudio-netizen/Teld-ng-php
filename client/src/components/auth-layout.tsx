import { Globe2 } from "lucide-react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import teldLogo from "@assets/Teld-azul-scaled_1787507180057.png";
import teldBackground from "@assets/Teld-Faria-Lima-768x512_1787504539073.jpg";
import { useLanguage } from "@/lib/language";

export type AuthMode = "login" | "register";

interface AuthLayoutProps {
  mode: AuthMode;
  children: ReactNode;
  showLanguage?: boolean;
}

export function AuthLayout({ mode, children, showLanguage = false }: AuthLayoutProps) {
  const [, navigate] = useLocation();
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <main className={`auth-reference auth-${mode}`}>
      <style>{`
        .auth-reference {
          --auth-blue: #438fdc;
          --auth-purple: #9b1bb7;
          --auth-purple-dark: #84169d;
          width: 100%;
          min-height: 100dvh;
          overflow-x: hidden;
          background: var(--auth-blue);
          color: #202020;
          font-family: Arial, Helvetica, sans-serif;
        }
        .auth-reference *,
        .auth-reference *::before,
        .auth-reference *::after {
          box-sizing: border-box;
        }
        .auth-reference .auth-screen {
          position: relative;
          width: 100%;
          max-width: 512px;
          min-height: 100dvh;
          margin: 0 auto;
          overflow: hidden;
          background: var(--auth-blue);
        }
        .auth-reference .auth-panel {
          position: relative;
          z-index: 1;
          display: flex;
          min-height: 100dvh;
          flex-direction: column;
          align-items: center;
          padding: 0 0 42px;
        }
        .auth-reference .auth-toolbar {
          position: absolute;
          top: 18px;
          right: 21px;
          z-index: 4;
        }
        .auth-reference .auth-language {
          display: flex;
          height: 38px;
          align-items: center;
          gap: 6px;
          border: 0;
          border-radius: 8px;
          padding: 0 10px;
          background: #fff;
          color: #4a4a4a;
          font-size: 16px;
          line-height: 1;
          box-shadow: 0 1px 4px rgba(0, 0, 0, .12);
        }
        .auth-reference .auth-language svg {
          width: 20px;
          height: 20px;
        }
        .auth-reference .auth-identity {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .auth-reference .auth-logo-card {
          display: grid;
          width: 132px;
          height: 132px;
          place-items: center;
          overflow: hidden;
          border-radius: 13px;
          background: rgba(239, 239, 239, .92);
          box-shadow: 0 1px 3px rgba(0, 0, 0, .08);
        }
        .auth-reference .auth-logo-card img {
          display: block;
          width: 116px;
          height: auto;
          object-fit: contain;
        }
        .auth-reference .auth-brand-name {
          margin: 16px 0 0;
          color: #234d72;
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
        }
        .auth-reference .auth-mode-switch {
          display: grid;
          width: min(400px, calc(100% - 112px));
          height: 82px;
          grid-template-columns: 1fr 1fr;
          overflow: hidden;
          border-radius: 42px;
          background: #fff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, .18);
        }
        .auth-reference .auth-mode-button {
          min-width: 0;
          border: 0;
          padding: 0 14px;
          background: #fff;
          color: #696969;
          font-size: clamp(15px, 3.5vw, 19px);
          font-weight: 400;
          line-height: 1.2;
          text-align: center;
          transition: transform .12s ease, background-color .12s ease, color .12s ease;
        }
        .auth-reference .auth-mode-button.active {
          border-radius: 42px;
          background: var(--auth-purple);
          color: #fff;
          font-weight: 700;
        }
        .auth-reference .auth-mode-button:active,
        .auth-reference .auth-submit:active {
          transform: scale(.98);
        }
        .auth-reference .auth-form {
          display: flex;
          width: min(400px, calc(100% - 112px));
          flex-direction: column;
          align-items: stretch;
        }
        .auth-reference .auth-fields {
          display: grid;
          gap: 31px;
        }
        .auth-reference .auth-field {
          display: flex;
          width: 100%;
          height: 64px;
          align-items: center;
          overflow: hidden;
          border: 1px solid #a91db9;
          border-radius: 33px;
          padding: 0 16px;
          background: #fff;
          box-shadow: 0 1px 4px rgba(80, 0, 100, .12);
        }
        .auth-reference .auth-field-icon {
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          margin-right: 15px;
          color: #282828;
          stroke-width: 2.1;
        }
        .auth-reference .auth-field input {
          width: 0;
          min-width: 0;
          flex: 1 1 auto;
          height: 100%;
          border: 0;
          outline: 0;
          padding: 0;
          background: transparent;
          color: #333;
          font-size: clamp(16px, 3.9vw, 20px);
          font-weight: 400;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .auth-reference .auth-field input::placeholder {
          color: #686868;
          opacity: 1;
        }
        .auth-reference .auth-prefix {
          display: flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 12px;
          margin-right: 15px;
          border: 0;
          padding: 0;
          background: transparent;
          color: #262626;
          font-size: 16px;
          line-height: 1;
          white-space: nowrap;
        }
        .auth-reference .auth-prefix svg:first-child {
          width: 26px;
          height: 26px;
          color: #292929;
          stroke-width: 2;
        }
        .auth-reference .auth-prefix .prefix-chevron {
          width: 19px;
          height: 19px;
          margin-left: -4px;
          color: #5b5b5b;
          stroke-width: 2;
        }
        .auth-reference .auth-visibility {
          display: grid;
          width: 30px;
          height: 36px;
          flex: 0 0 auto;
          place-items: center;
          border: 0;
          padding: 0;
          background: transparent;
          color: #171717;
        }
        .auth-reference .auth-visibility svg {
          width: 28px;
          height: 28px;
          stroke-width: 2.5;
        }
        .auth-reference .auth-error {
          margin: -24px 0 -7px 14px;
          color: #fff;
          font-size: 12px;
          line-height: 1.2;
        }
        .auth-reference .auth-submit {
          display: grid;
          width: 100%;
          height: 68px;
          place-items: center;
          border: 0;
          border-radius: 35px;
          background: var(--auth-purple);
          color: #fff;
          font-size: clamp(19px, 4.5vw, 23px);
          font-weight: 700;
          line-height: 1;
          box-shadow: 0 2px 5px rgba(85, 0, 120, .2);
          transition: transform .12s ease, background-color .12s ease;
        }
        .auth-reference .auth-submit:disabled {
          opacity: .7;
        }
        .auth-reference .auth-bottom-visual {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 0;
          height: 185px;
          background-image:
            linear-gradient(180deg, rgba(67, 143, 220, .2), rgba(67, 143, 220, .12)),
            url("${teldBackground}");
          background-position: center 58%;
          background-size: cover;
          opacity: .35;
          pointer-events: none;
        }
        .auth-login .auth-panel {
          padding-top: 82px;
        }
        .auth-login .auth-mode-switch {
          margin-top: clamp(58px, 16vw, 84px);
        }
        .auth-login .auth-form {
          margin-top: 32px;
        }
        .auth-login .auth-submit {
          margin-top: 48px;
        }
        .auth-register .auth-panel {
          padding-top: 25px;
        }
        .auth-register .auth-mode-switch {
          margin-top: 74px;
        }
        .auth-register .auth-form {
          margin-top: 32px;
        }
        .auth-register .auth-submit {
          margin-top: 39px;
        }
        @media (max-width: 400px) {
          .auth-reference .auth-mode-switch,
          .auth-reference .auth-form {
            width: calc(100% - 44px);
          }
          .auth-reference .auth-mode-button {
            padding-right: 8px;
            padding-left: 8px;
            font-size: 14px;
          }
          .auth-reference .auth-field {
            height: 62px;
            padding-right: 13px;
            padding-left: 13px;
          }
          .auth-reference .auth-fields {
            gap: 27px;
          }
          .auth-reference .auth-prefix {
            gap: 8px;
            margin-right: 9px;
          }
          .auth-reference .auth-field-icon {
            margin-right: 11px;
          }
          .auth-reference .auth-submit {
            height: 64px;
          }
          .auth-reference .auth-logo-card {
            width: 122px;
            height: 122px;
          }
          .auth-reference .auth-logo-card img {
            width: 108px;
          }
          .auth-login .auth-panel {
            padding-top: 70px;
          }
          .auth-register .auth-panel {
            padding-top: 20px;
          }
          .auth-login .auth-mode-switch {
            margin-top: 58px;
          }
          .auth-register .auth-mode-switch {
            margin-top: 54px;
          }
        }
      `}</style>

      <div className="auth-screen">
        <section className="auth-panel">
          {showLanguage && (
            <div className="auth-toolbar">
              <button
                type="button"
                className="auth-language"
                aria-label={language === "en" ? t("switchToFrench") : t("switchToEnglish")}
                onClick={toggleLanguage}
              >
                <Globe2 aria-hidden="true" />
                {language === "en" ? "Français" : "English"}
              </button>
            </div>
          )}

          <div className="auth-identity">
            <div className="auth-logo-card">
              <img src={teldLogo} alt="TELD (Tcharging)" />
            </div>
            <p className="auth-brand-name">TELD</p>
          </div>

           <nav className="auth-mode-switch" aria-label={t("language") === "Langue" ? "Authentication type" : "Type d'authentification"}>
            <button
              type="button"
              className={`auth-mode-button ${mode === "login" ? "active" : ""}`}
              onClick={() => navigate("/login")}
            >
               {t("signIn")}
            </button>
            <button
              type="button"
              className={`auth-mode-button ${mode === "register" ? "active" : ""}`}
              onClick={() => navigate("/register")}
            >
               {t("signUp")}
            </button>
          </nav>

          {children}
        </section>
        <div className="auth-bottom-visual" aria-hidden="true" />
      </div>
    </main>
  );
}