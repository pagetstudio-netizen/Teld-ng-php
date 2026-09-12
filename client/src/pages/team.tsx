import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/countries";

import teamInviteImage from "@assets/images_(73)_1787505348499.jpeg";
import teamInviteImageAlt from "@assets/images_(74)_1787505348522.jpeg";
import teamMetricImage from "@assets/images_(75)_1787505348408.jpeg";
import teamMetricImageAlt from "@assets/images_(76)_1787505348483.jpeg";

interface TeamStats {
  level1Count: number;
  level2Count: number;
  level3Count: number;
  totalCommission: number;
  level1Commission: number;
  level2Commission: number;
  level3Commission: number;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: stats } = useQuery<TeamStats>({
    queryKey: ["/api/team/stats"],
  });

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  if (!user) return null;

  const referralLink = new URL(
    `/invitation?code=${encodeURIComponent(user.referralCode)}`,
    window.location.origin,
  ).toString();
  const totalPeople = (stats?.level1Count || 0) + (stats?.level2Count || 0) + (stats?.level3Count || 0);
  // Rates come from the administrator settings; do not freeze policy values
  // in this page. The placeholder also avoids showing a false rate while the
  // settings request is still loading.
  const lv1Rate = settings?.level1Commission || "—";
  const lv2Rate = settings?.level2Commission || "—";
  const lv3Rate = settings?.level3Commission || "—";

  const copy = (value: string, title: string) => {
    navigator.clipboard.writeText(value);
    toast({ title });
  };

  const levels = [
    { label: "LV1", rate: lv1Rate, users: stats?.level1Count || 0, rewards: stats?.level1Commission || 0 },
    { label: "LV2", rate: lv2Rate, users: stats?.level2Count || 0, rewards: stats?.level2Commission || 0 },
    { label: "LV3", rate: lv3Rate, users: stats?.level3Count || 0, rewards: stats?.level3Commission || 0 },
  ];

  return (
    <main className="team-reference-page">
      <style>{`
        .team-reference-page {
          min-height: 100dvh;
          overflow-x: hidden;
          padding-bottom: 88px;
           background: linear-gradient(180deg, #063841 0%, #00636c 100%);
          color: white;
          font-family: Arial, Helvetica, sans-serif;
        }
        .team-reference-page *,
        .team-reference-page *::before,
        .team-reference-page *::after { box-sizing: border-box; }
        .team-reference-page .team-screen {
          container-type: inline-size;
          width: 100%;
          max-width: 512px;
          min-height: 100dvh;
          margin: 0 auto;
        }
        .team-reference-page .team-header {
          display: flex;
          height: 81px;
          align-items: center;
          justify-content: space-between;
           gap: 10px;
          padding: 0 21px;
        }
        .team-reference-page .team-header h1 {
           min-width: 0;
          margin: 0;
           font-size: clamp(22px, 5.5cqw, 28px);
          font-weight: 400;
          letter-spacing: -.7px;
           line-height: 1.08;
        }
        .team-reference-page .team-header button {
           flex: 0 0 auto;
          border: 0;
          padding: 0;
          background: transparent;
          color: white;
           font-size: clamp(14px, 3.8cqw, 18px);
          font-weight: 400;
          line-height: 1;
        }
        .team-reference-page .invite-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          padding: 0 14px;
        }
        .team-reference-page .invite-column { min-width: 0; }
         .team-reference-page .invite-art {
           position: relative;
          height: 156px;
          overflow: hidden;
          border-radius: 22px;
           background: #00636c;
        }
         .team-reference-page .invite-art img,
         .team-reference-page .metric-art img {
           display: block;
           width: 100%;
           height: 100%;
           object-fit: cover;
        }
         .team-reference-page .invite-art::after {
           position: absolute;
           inset: 0;
           background: linear-gradient(180deg, rgba(0, 35, 43, .12) 15%, rgba(0, 35, 43, .78) 100%);
           content: "";
         }
         .team-reference-page .invite-copy {
           position: absolute;
           right: 12px;
           bottom: 12px;
           left: 12px;
           z-index: 1;
           color: white;
           text-align: center;
         }
         .team-reference-page .invite-value {
           display: block;
           max-height: 3.1em;
           overflow: hidden;
            font-size: clamp(12px, 3cqw, 15px);
           font-weight: 700;
           line-height: 1.05;
           overflow-wrap: anywhere;
         }
         .team-reference-page .invite-label {
           display: block;
           margin-top: 7px;
            font-size: clamp(11px, 2.7cqw, 13px);
           font-weight: 400;
           line-height: 1;
        }
        .team-reference-page .copy-button {
          display: grid;
           width: 100%;
          height: 34px;
          margin-top: 16px;
           padding: 0 8px;
          place-items: center;
          border: 0;
          border-radius: 8px;
           background: #00ABB7;
           color: #063841;
           font-size: clamp(13px, 3.2cqw, 16px);
          font-weight: 400;
          line-height: 1;
           white-space: nowrap;
          transition: filter 120ms ease, transform 120ms ease;
        }
        .team-reference-page .copy-button:active,
        .team-reference-page .team-header button:active,
        .team-reference-page .metric-card:active {
          filter: brightness(.9);
          transform: scale(.98);
        }
        .team-reference-page .team-intro {
          display: grid;
          grid-template-columns: 1fr 1fr;
          min-height: 168px;
          align-items: start;
          padding: 46px 10px 0 86px;
        }
        .team-reference-page .team-intro h2 {
          margin: 0;
           font-size: clamp(25px, 6.4cqw, 32px);
          font-weight: 400;
          letter-spacing: -.7px;
          line-height: 1.42;
        }
        .team-reference-page .team-intro p {
          margin: -4px 0 0 22px;
           font-size: clamp(13px, 3.2cqw, 16px);
          font-weight: 400;
          line-height: 1.52;
          text-align: center;
        }
        .team-reference-page .levels-card {
           min-height: 454px;
          margin: 0 16px;
          overflow: hidden;
          border-radius: 22px;
           padding: 22px 20px 24px;
          background: white;
          color: #111;
        }
        .team-reference-page .level-row {
          position: relative;
           min-height: 132px;
           padding-bottom: 18px;
        }
        .team-reference-page .level-badge {
          display: flex;
          width: 82px;
          height: 28px;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
           background: #00ABB7;
          color: white;
           font-size: clamp(16px, 4.2cqw, 21px);
          font-weight: 400;
          line-height: 1;
        }
        .team-reference-page .level-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
           gap: 6px;
           margin-top: 24px;
          text-align: center;
        }
         .team-reference-page .level-stats > div { min-width: 0; }
        .team-reference-page .level-value {
          margin: 0;
           font-size: clamp(20px, 5cqw, 25px);
          font-weight: 400;
          line-height: 1;
        }
        .team-reference-page .level-caption {
          margin: 10px 0 0;
           font-size: clamp(12px, 3.1cqw, 16px);
          font-weight: 400;
           line-height: 1.15;
           overflow-wrap: anywhere;
        }
        .team-reference-page .metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 21px;
          margin: 14px 19px 0;
        }
        .team-reference-page .metric-card {
           display: block;
           width: 100%;
           min-height: 196px;
          overflow: hidden;
           border: 0;
          border-radius: 22px;
           padding: 0;
          background: white;
          color: #111;
           text-align: left;
          transition: filter 120ms ease, transform 120ms ease;
        }
         .team-reference-page .metric-art {
          height: 137px;
           overflow: hidden;
           background: #00636c;
        }
        .team-reference-page .metric-footer {
           display: grid;
           min-height: 59px;
           grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
           gap: 5px;
          padding: 0 11px;
           font-size: clamp(13px, 3.3cqw, 16px);
           line-height: 1.1;
        }
        .team-reference-page .metric-footer span:last-child {
          text-align: right;
           overflow-wrap: anywhere;
        }
        .team-reference-page .reward-copy {
          padding: 28px 10px 26px;
           font-size: clamp(13px, 3.2cqw, 16px);
          line-height: 1.48;
        }
        .team-reference-page .reward-copy p { margin: 0; }
        .team-reference-page .reference-team-nav {
          position: fixed;
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 50;
          height: 80px;
          background: #00ABB7;
        }
        @media (max-width: 360px) {
          .team-reference-page .team-header { height: 70px; padding: 0 15px; }
          .team-reference-page .team-header h1 { font-size: 27px; }
          .team-reference-page .team-header button { font-size: 17px; }
            .team-reference-page .invite-grid { gap: 10px; padding-right: 12px; padding-left: 12px; }
            .team-reference-page .invite-art { height: 123px; border-radius: 18px; }
           .team-reference-page .invite-copy { right: 8px; bottom: 9px; left: 8px; }
           .team-reference-page .invite-value { font-size: 12px; }
           .team-reference-page .invite-label { margin-top: 5px; font-size: 11px; }
          .team-reference-page .copy-button { height: 28px; margin-top: 12px; font-size: 13px; }
          .team-reference-page .team-intro { min-height: 136px; padding-top: 34px; padding-left: 52px; }
          .team-reference-page .team-intro h2 { font-size: 27px; }
          .team-reference-page .team-intro p { margin-left: 12px; font-size: 13px; }
           .team-reference-page .levels-card { min-height: 0; margin: 0 11px; padding: 17px 14px 20px; }
           .team-reference-page .level-row { min-height: 106px; padding-bottom: 14px; }
          .team-reference-page .level-badge { width: 68px; height: 24px; font-size: 18px; }
           .team-reference-page .level-stats { gap: 3px; margin-top: 18px; }
           .team-reference-page .level-value { font-size: 20px; }
           .team-reference-page .level-caption { margin-top: 6px; font-size: 12px; }
          .team-reference-page .metrics { gap: 12px; margin-right: 13px; margin-left: 13px; }
           .team-reference-page .metric-card { min-height: 157px; border-radius: 18px; }
          .team-reference-page .metric-art { height: 110px; }
           .team-reference-page .metric-footer { min-height: 47px; padding: 0 8px; font-size: 12px; }
          .team-reference-page .reward-copy { padding: 21px 8px; font-size: 13px; }
        }
      `}</style>

      <div className="team-screen">
        <header className="team-header">
          <h1>Build a team</h1>
              <button type="button" onClick={() => navigate("/team-details")}>My team &gt;</button>
        </header>

        <section className="invite-grid" aria-label="Invitation">
          <div className="invite-column">
           <div className="invite-art">
             <img src={teamInviteImage} alt="TELD charging station" />
             <div className="invite-copy">
               <span className="invite-value">{user.referralCode}</span>
               <span className="invite-label">Code d'invitation</span>
             </div>
           </div>
            <button className="copy-button" type="button" onClick={() => copy(user.referralCode, "Code copied!")}>
              Copy code
            </button>
          </div>
          <div className="invite-column">
           <div className="invite-art">
             <img src={teamInviteImageAlt} alt="TELD charging station" />
             <div className="invite-copy">
               <span className="invite-value" title={referralLink}>{referralLink}</span>
               <span className="invite-label">Invitation link</span>
             </div>
           </div>
            <button className="copy-button" type="button" onClick={() => copy(referralLink, "Link copied!")}>
               Copy link
            </button>
          </div>
        </section>

        <section className="team-intro">
          <h2>TEAM<br />LEVEL</h2>
          <p>Grow your team<br />and<br />increase your earnings</p>
        </section>

        <section className="levels-card" aria-label="Team levels">
          {levels.map((level) => (
            <article className="level-row" key={level.label}>
              <span className="level-badge">{level.label}</span>
              <div className="level-stats">
                <div><p className="level-value">{level.rate}%</p><p className="level-caption">Commission</p></div>
                <div><p className="level-value">{level.users}</p><p className="level-caption">Users</p></div>
                 <div><p className="level-value">{level.rewards.toFixed(0)}</p><p className="level-caption">Rewards</p></div>
              </div>
            </article>
          ))}
        </section>

        <section className="metrics" aria-label="Team summary">
          <button
            type="button"
            className="metric-card"
            aria-label="View team details"
            onClick={() => navigate("/team-details")}
          >
            <div className="metric-art">
              <img src={teamMetricImage} alt="TELD charging station network" />
            </div>
            <div className="metric-footer"><span>{totalPeople}</span><span>Total utilisateurs &gt;</span></div>
          </button>
          <button
            type="button"
            className="metric-card"
            aria-label="View team details"
            onClick={() => navigate("/team-details")}
          >
             <div className="metric-art">
               <img src={teamMetricImageAlt} alt="TELD charging station" />
             </div>
            <div className="metric-footer"><span>{formatCurrency(Number(stats?.totalCommission || 0), user.country)}</span><span>Total rewards<br />&gt;</span></div>
          </button>
        </section>

        <section className="reward-copy">
          <p>
            When a friend you invite signs up and invests, you immediately receive a {lv1Rate}% reward on their investment.<br />
            When your level 2 team members invest, you receive a {lv2Rate}% reward.<br />
            When your level 3 team members invest, you also receive a {lv3Rate}% reward.<br />
            Once your team members invest, the reward is immediately credited to your account and can be withdrawn without delay.
          </p>
        </section>
      </div>
    </main>
  );
}