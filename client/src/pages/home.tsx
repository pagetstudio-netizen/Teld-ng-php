import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/countries";
import AboutModal from "@/components/about-modal";

import dashboardBanner from "@assets/20260823_193216_1787513989515.png";
import chargingCanopy from "@assets/20260823_193248_1787513989579.png";
import chargingEquipment from "@assets/image_search/teld-equipment.png";
import announcementIcon from "@assets/téléchargement_(91)_1787514048111.png";
import withdrawActionIcon from "@assets/withdraw-icon-DFsum39V_(1)_1788443920274.png";
import depositActionIcon from "@assets/recharge-icon-BZHWSjQZ_(1)_1788443920298.png";
import checkinActionIcon from "@assets/téléchargement_(66)_1788443920319.png";
import serviceActionIcon from "@assets/mine-mod-cs-DtBQ0Sp0_1788443920347.png";

function formatAmount(value: number) {
  return value.toLocaleString("en-US");
}

export default function HomePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(true);

  useEffect(() => {
    const handleHomeTabClick = () => setIsWelcomeOpen(true);
    window.addEventListener("home-tab-clicked", handleHomeTabClick);
    return () => window.removeEventListener("home-tab-clicked", handleHomeTabClick);
  }, []);

  if (!user) return null;

  const balance = Number(user.balance || 0);
  const cumulative = Number(user.totalEarnings || 0);

  return (
    <>
      <main className="teld-dashboard-reference" aria-label="TELD home">
      <style>{`
        .teld-dashboard-reference {
          min-height: 100dvh;
          overflow-x: hidden;
          background: #fff;
          color: #111;
          font-family: Arial, Helvetica, sans-serif;
        }
        .teld-dashboard-reference *,
        .teld-dashboard-reference *::before,
        .teld-dashboard-reference *::after {
          box-sizing: border-box;
        }
        .teld-dashboard-reference__screen {
          width: 100%;
          max-width: 512px;
          min-height: 100dvh;
          margin: 0 auto;
          padding: clamp(18px, 4vw, 26px) 0 94px;
          background: #fff;
        }
        .teld-dashboard-reference__hero {
          width: calc(100% - clamp(30px, 8.6vw, 44px));
          aspect-ratio: 165 / 140;
          margin: 0 auto;
          overflow: hidden;
          border-radius: clamp(9px, 2.35vw, 12px);
          background: #eaf0ff;
        }
        .teld-dashboard-reference__hero img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .teld-dashboard-reference__announcement {
          display: flex;
          width: calc(100% - clamp(30px, 8.6vw, 44px));
          height: clamp(34px, 9.1vw, 47px);
          align-items: center;
          gap: clamp(7px, 1.95vw, 10px);
          margin: clamp(11px, 3.1vw, 16px) auto 0;
          overflow: hidden;
          border-radius: clamp(6px, 1.55vw, 8px);
          padding: 0 clamp(8px, 2.35vw, 12px);
          background: #f5f5f5;
          box-shadow: 0 1px 4px rgba(0, 0, 0, .035);
        }
        .teld-dashboard-reference__announcement-icon {
          width: clamp(20px, 5.45vw, 28px);
          height: auto;
          flex: 0 0 auto;
          object-fit: contain;
        }
        .teld-dashboard-reference__announcement-window {
          min-width: 0;
          flex: 1;
          overflow: hidden;
        }
        .teld-dashboard-reference__announcement-track {
          display: flex;
          width: max-content;
          align-items: center;
          color: #5a5a5a;
          font-size: clamp(12px, 3.5vw, 18px);
          font-weight: 400;
          line-height: 1;
          white-space: nowrap;
          animation: teld-dashboard-marquee 18s linear infinite;
        }
        .teld-dashboard-reference__announcement-track span {
          padding-right: 56px;
        }
        .teld-dashboard-reference__quick-actions {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: clamp(8px, 2.8vw, 15px);
          width: calc(100% - clamp(28px, 7.8vw, 40px));
          margin: clamp(18px, 4.8vw, 25px) auto 0;
        }
        .teld-dashboard-reference__quick-action {
          display: flex;
          min-width: 0;
          align-items: center;
          flex-direction: column;
          gap: 7px;
          border: 0;
          padding: 0;
          background: transparent;
          color: #f0a800;
          cursor: pointer;
          font: inherit;
          text-align: center;
          -webkit-tap-highlight-color: transparent;
        }
        .teld-dashboard-reference__quick-action:focus-visible {
          outline: 3px solid rgba(240, 168, 0, .35);
          outline-offset: 5px;
          border-radius: 10px;
        }
        .teld-dashboard-reference__quick-action-icon {
          display: grid;
          width: clamp(45px, 13vw, 66px);
          height: clamp(45px, 13vw, 66px);
          place-items: center;
          border-radius: 50%;
          background: #f0a800;
          box-shadow: 0 3px 7px rgba(198, 133, 0, .2);
          transition: background-color 130ms ease, transform 130ms ease, box-shadow 130ms ease;
        }
        .teld-dashboard-reference__quick-action:hover .teld-dashboard-reference__quick-action-icon {
          background: #dfa000;
          box-shadow: 0 5px 11px rgba(198, 133, 0, .28);
          transform: translateY(-1px);
        }
        .teld-dashboard-reference__quick-action:active .teld-dashboard-reference__quick-action-icon {
          transform: scale(.96);
        }
        .teld-dashboard-reference__quick-action-icon img {
          display: block;
          width: 67%;
          height: 67%;
          object-fit: contain;
        }
        .teld-dashboard-reference__quick-action-label {
          max-width: 100%;
          color: #d89500;
          font-size: clamp(10px, 2.8vw, 14px);
          font-weight: 700;
          line-height: 1.15;
          white-space: normal;
          overflow-wrap: anywhere;
        }
        @keyframes teld-dashboard-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .teld-dashboard-reference__metrics {
          display: grid;
          gap: clamp(15px, 4.3vw, 22px);
          width: calc(100% - clamp(28px, 7.8vw, 40px));
          margin: clamp(16px, 4.5vw, 23px) auto 0;
        }
        .teld-dashboard-reference__metric {
          display: grid;
          min-height: clamp(108px, 30vw, 154px);
          grid-template-columns: minmax(0, 63.5%) minmax(116px, 36.5%);
          align-items: center;
          overflow: hidden;
          border: 1px solid #f3f3f3;
          border-radius: clamp(5px, 1.2vw, 7px);
          background: #fff;
          box-shadow: 0 2px 9px rgba(0, 0, 0, .05);
          transition: transform 130ms ease, box-shadow 130ms ease;
        }
        .teld-dashboard-reference__metric:hover {
          box-shadow: 0 4px 13px rgba(0, 0, 0, .075);
        }
        .teld-dashboard-reference__metric:active {
          transform: scale(.992);
          box-shadow: 0 1px 4px rgba(0, 0, 0, .05);
        }
        .teld-dashboard-reference__station {
          display: flex;
          height: 100%;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: clamp(4px, 1vw, 6px);
        }
        .teld-dashboard-reference__station img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .teld-dashboard-reference__station--equipment {
          justify-content: flex-start;
          padding: clamp(5px, 1.4vw, 8px) clamp(17px, 6.3vw, 32px);
        }
        .teld-dashboard-reference__station--equipment img {
          width: min(64%, 125px);
          object-position: left center;
        }
        .teld-dashboard-reference__metric-copy {
          display: flex;
          min-width: 0;
          align-items: center;
          flex-direction: column;
          justify-content: center;
          gap: clamp(15px, 4.3vw, 22px);
          padding: 7px clamp(7px, 1.8vw, 10px) 8px 0;
          text-align: center;
        }
        .teld-dashboard-reference__metric-label {
          display: inline-grid;
          min-width: clamp(109px, 28vw, 145px);
          min-height: clamp(42px, 11.6vw, 60px);
          place-items: center;
          border: clamp(2px, .55vw, 3px) solid #151515;
          border-radius: 1px;
          padding: 2px 7px;
          background: #ffc000;
          box-shadow: inset 0 0 0 1px rgba(255, 241, 148, .35), 0 1px 2px rgba(0, 0, 0, .22);
          color: #171717;
          font-size: clamp(17px, 5vw, 26px);
          font-weight: 400;
          line-height: 1;
        }
        .teld-dashboard-reference__metric-value {
          display: block;
          max-width: 100%;
          color: #db2222;
          font-size: clamp(17px, 4.8vw, 25px);
          font-weight: 400;
          line-height: 1;
          white-space: nowrap;
        }
        .teld-dashboard-reference__metric-value small {
          font-size: .76em;
          font-weight: inherit;
        }
        @media (max-width: 340px) {
          .teld-dashboard-reference__metric {
            grid-template-columns: minmax(0, 59%) minmax(117px, 41%);
          }
          .teld-dashboard-reference__metric-copy {
            gap: 11px;
          }
          .teld-dashboard-reference__metric-label {
            min-width: 104px;
          }
          .teld-dashboard-reference__station--equipment {
            padding-right: 13px;
            padding-left: 13px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .teld-dashboard-reference__announcement-track {
            animation: none;
          }
        }
      `}</style>

      <div className="teld-dashboard-reference__screen">
        <section className="teld-dashboard-reference__hero" aria-label="TELD, a new world for your success">
          <img src={dashboardBanner} alt="TELD, a new world for your success" />
        </section>

        <section className="teld-dashboard-reference__announcement" aria-label="Top-up announcements">
          <img className="teld-dashboard-reference__announcement-icon" src={announcementIcon} alt="" aria-hidden="true" />
          <div className="teld-dashboard-reference__announcement-window">
            <div className="teld-dashboard-reference__announcement-track" aria-live="off">
              <span>J6 topped up 100,000 ******1047 topped up 90,000</span>
              <span aria-hidden="true">J6 topped up 100,000 ******1047 topped up 90,000</span>
            </div>
          </div>
        </section>

        <nav className="teld-dashboard-reference__quick-actions" aria-label="Quick actions">
          {[
            { label: "Deposit", path: "/deposit", icon: depositActionIcon },
            { label: "Withdraw", path: "/withdrawal", icon: withdrawActionIcon },
            { label: "Check-in", path: "/checkin", icon: checkinActionIcon },
            { label: "Customer service", path: "/service", icon: serviceActionIcon },
          ].map((action) => (
            <button
              key={action.path}
              type="button"
              className="teld-dashboard-reference__quick-action"
              onClick={() => navigate(action.path)}
              aria-label={action.label}
              data-testid={`button-quick-${action.path.slice(1)}`}
            >
              <span className="teld-dashboard-reference__quick-action-icon" aria-hidden="true">
                <img src={action.icon} alt="" />
              </span>
              <span className="teld-dashboard-reference__quick-action-label">{action.label}</span>
            </button>
          ))}
        </nav>

        <section className="teld-dashboard-reference__metrics" aria-label="Account summary">
          <article className="teld-dashboard-reference__metric">
            <div className="teld-dashboard-reference__station">
               <img src={chargingCanopy} alt="TELD charging station" />
            </div>
            <div className="teld-dashboard-reference__metric-copy">
              <span className="teld-dashboard-reference__metric-label">Balance</span>
              <strong className="teld-dashboard-reference__metric-value">{formatCurrency(balance, user.country)}</strong>
            </div>
          </article>

          <article className="teld-dashboard-reference__metric">
            <div className="teld-dashboard-reference__station teld-dashboard-reference__station--equipment">
               <img src={chargingEquipment} alt="TELD charging equipment" />
            </div>
            <div className="teld-dashboard-reference__metric-copy">
              <span className="teld-dashboard-reference__metric-label">Cumulative</span>
              <strong className="teld-dashboard-reference__metric-value">{formatCurrency(cumulative, user.country)}</strong>
            </div>
          </article>
        </section>
      </div>
      </main>
      <AboutModal open={isWelcomeOpen} onClose={() => setIsWelcomeOpen(false)} />
    </>
  );
}