import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, getCountryByCode } from "@/lib/countries";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import checkinHero from "@assets/images_(74)_1787504539004.jpeg";
import teldLogo from "@assets/Teld-azul-scaled_1787504539099.png";

interface BonusStatus {
  canClaim: boolean;
  hoursRemaining: number;
  totalBonusClaimed: number;
  daysPointed: number;
}

export default function CheckinPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: bonusStatus } = useQuery<BonusStatus>({
    queryKey: ["/api/daily-bonus-status"],
    refetchInterval: 60000,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/claim-daily-bonus", {});
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Error");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-bonus-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
        toast({ title: "Bonus received!", description: "Your daily bonus was added to your balance" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  const country = getCountryByCode(user.country);
  const totalBonusClaimed = bonusStatus?.totalBonusClaimed || 0;
  const canClaim = Boolean(bonusStatus?.canClaim);
  const formatAmount = (amount: number) => formatCurrency(amount, user.country);

  return (
    <main className="checkin-reference min-h-full bg-[#f4f4f4] pb-20">
      <style>{`
        .checkin-reference {
          color: #171717;
          font-family: Inter, Arial, sans-serif;
        }
        .checkin-reference .checkin-screen {
          width: 100%;
          max-width: 500px;
          min-height: 100%;
          margin: 0 auto;
          overflow: hidden;
          background: #f4f4f4;
        }
        .checkin-reference .hero {
          position: relative;
          height: min(61.4vw, 307px);
          min-height: 245px;
          overflow: hidden;
          background: #77cdeb;
        }
        .checkin-reference .hero-art {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: min(49.9vw, 250px);
          overflow: hidden;
        }
        .checkin-reference .hero-art::after {
          position: absolute;
          z-index: 1;
          inset: 0;
          background: linear-gradient(180deg, rgba(34, 151, 219, .12), rgba(35, 112, 198, .2));
          content: "";
          pointer-events: none;
        }
        .checkin-reference .hero-art img {
          position: relative;
          z-index: 0;
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
          pointer-events: none;
        }
        .checkin-reference .back {
          position: absolute;
          z-index: 3;
          top: 12px;
          left: 34px;
          display: grid;
          width: 68px;
          height: 39px;
          place-items: center;
          border-radius: 22px;
          background: #3776cf;
          color: white;
          box-shadow: 0 1px 2px rgba(0,0,0,.08);
        }
        .checkin-reference .back svg {
          width: 23px;
          height: 23px;
          stroke-width: 4;
        }
        .checkin-reference .hero-title {
          position: absolute;
          z-index: 2;
          top: 30px;
          left: 0;
          width: 100%;
          color: white;
          font-size: 25px;
          font-weight: 400;
          line-height: 1;
          text-align: center;
          text-shadow: 0 1px 2px rgba(0,0,0,.1);
        }
        .checkin-reference .avatar {
          position: absolute;
          z-index: 3;
          top: 73px;
          left: 50%;
          width: 126px;
          height: 126px;
          overflow: hidden;
          border: 4px solid white;
          border-radius: 50%;
          background-image: url("${teldLogo}");
          background-position: left center;
          background-repeat: no-repeat;
          background-size: cover;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,.12);
          transform: translateX(-50%);
        }
        .checkin-reference .earnings-card {
          position: relative;
          z-index: 4;
          height: 298px;
          margin: -28px 16px 0;
          overflow: hidden;
          border-radius: 20px;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,.01);
        }
        .checkin-reference .earned-total {
          padding-top: 9px;
          color: #070707;
          font-size: 29px;
          font-weight: 800;
          line-height: 1.1;
          text-align: center;
        }
        .checkin-reference .earned-heading {
          margin-top: 10px;
          color: #424242;
          font-size: 20px;
          font-weight: 400;
          line-height: 1;
          text-align: center;
        }
        .checkin-reference .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin-top: 78px;
        }
        .checkin-reference .stat {
          text-align: center;
        }
        .checkin-reference .stat-value {
          color: #00ABB7;
          font-size: 35px;
          font-weight: 800;
          letter-spacing: -.8px;
          line-height: 1;
        }
        .checkin-reference .stat-value span {
          padding-left: 4px;
          font-size: 23px;
        }
        .checkin-reference .stat-value.secondary {
          font-size: 35px;
          font-weight: 400;
        }
        .checkin-reference .stat-label {
          margin-top: 15px;
          color: #008895;
          font-size: 13px;
          font-weight: 500;
          line-height: 1;
        }
        .checkin-reference .claim {
          display: flex;
          width: calc(100% - 96px);
          height: 62px;
          align-items: center;
          justify-content: center;
          margin: 14px 48px 0;
          border-radius: 34px;
          background: #00ABB7;
          color: white;
          font-size: 26px;
          font-weight: 400;
          line-height: 1;
          box-shadow: 0 2px 3px rgba(31,90,174,.16);
        }
        .checkin-reference .claim:disabled {
          background: #a4a4a4;
          color: rgba(255,255,255,.9);
          box-shadow: none;
        }
        .checkin-reference .claim svg {
          width: 24px;
          height: 24px;
        }
        .checkin-reference .next-claim {
          margin-top: 10px;
          color: #777;
          font-size: 12px;
          text-align: center;
        }
        @media (max-width: 360px) {
          .checkin-reference .back { left: 20px; }
          .checkin-reference .hero-title { font-size: 22px; }
          .checkin-reference .avatar { width: 112px; height: 112px; }
          .checkin-reference .earnings-card { margin-right: 10px; margin-left: 10px; }
          .checkin-reference .claim { width: calc(100% - 64px); margin-right: 32px; margin-left: 32px; }
          .checkin-reference .stat-label { font-size: 11px; }
        }
      `}</style>

      <div className="checkin-screen">
        <section className="hero" aria-label="Check-in quotidien">
          <div className="hero-art">
            <img src={checkinHero} alt="" />
          </div>
          <button className="back" onClick={() => navigate("/")}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <h1 className="hero-title">Check-in</h1>
          <div className="avatar" aria-hidden="true" />
        </section>

        <section className="earnings-card" aria-label="Check-in earnings">
          <p className="earned-total">{formatAmount(totalBonusClaimed)}</p>
          <p className="earned-heading">Cumulative earnings</p>

          <div className="stats">
            <div className="stat">
               <p className="stat-value">{formatCurrency(10, user.country)}</p>
              <p className="stat-label">Daily check-in earnings</p>
            </div>
            <div className="stat">
               <p className="stat-value secondary">{formatCurrency(totalBonusClaimed, user.country)}</p>
              <p className="stat-label">Cumulative earnings</p>
            </div>
          </div>
        </section>

        <button
          className="claim"
          onClick={() => claimMutation.mutate()}
          disabled={!canClaim || claimMutation.isPending}
          data-testid="button-pointer"
        >
          {claimMutation.isPending ? (
            <Loader2 className="animate-spin" />
          ) : canClaim ? (
            "Check-in"
          ) : (
            `${bonusStatus?.hoursRemaining || 0}h`
          )}
        </button>
        {!canClaim && bonusStatus?.hoursRemaining ? (
          <p className="next-claim">Next check-in in {bonusStatus.hoursRemaining}h</p>
        ) : null}
      </div>
    </main>
  );
}