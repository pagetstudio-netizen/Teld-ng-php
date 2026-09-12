import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  CreditCard,
  Gift,
  Info,
  Loader2,
  LockKeyhole,
  LogOut,
  Shield,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_PATH } from "@/lib/admin-path";
import { formatCurrency } from "@/lib/countries";
import teldLogo from "@assets/Teld-azul-scaled_1787507180057.png";
import serviceRepresentative from "@assets/20260822_083355_1787387728003.png";
import rechargeButtonImage from "@assets/20260124_173540_1787507650481.png";
import withdrawButtonImage from "@assets/20260124_173432_1787507650509.png";

const accent = "#00ABB7";
const accentDark = "#007E95";

type AccountMenuItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  value?: string;
  testId: string;
};

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showPinModal, setShowPinModal] = useState(false);
  const [adminPin, setAdminPin] = useState("");

  const verifyPinMutation = useMutation({
    mutationFn: async (pin: string) => {
      const res = await apiRequest("POST", "/api/admin/verify-pin", { pin });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Code PIN incorrect");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowPinModal(false);
      setAdminPin("");
      navigate(ADMIN_PATH);
    },
    onError: (error: Error) => toast({ title: error.message, variant: "destructive" }),
  });

  if (!user) return null;

  const balance = Number.parseFloat(user.balance || "0");
  const phoneDigits = user.phone.replace(/\D/g, "");
  const displayName = `User${phoneDigits.slice(-6) || user.id}`;
  const displayBalance = formatCurrency(balance, user.country);

  const menuItems: AccountMenuItem[] = [
    { label: "Password settings", icon: LockKeyhole, href: "/change-password", testId: "button-change-password" },
    { label: "Invite others", icon: UserRoundPlus, href: "/team", testId: "button-invite-team" },
    { label: "Mobile account information", icon: CreditCard, href: "/wallet", testId: "button-wallet" },
    { label: "Gift code", icon: Gift, href: "/gift-code", testId: "button-gift-code" },
    { label: "About us", icon: Info, href: "/about", testId: "button-about" },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleAdminClick = () => {
    if (user.isAdminPasswordRequired === false) {
      navigate(ADMIN_PATH);
      return;
    }
    setShowPinModal(true);
  };

  return (
    <main className="account-reference">
      <style>{`
        .account-reference {
          min-height: calc(100dvh - 59px);
          padding-bottom: 78px;
          background: #fffdf8;
          color: #202020;
          font-family: Arial, Helvetica, sans-serif;
        }
        .account-reference *,
        .account-reference *::before,
        .account-reference *::after {
          box-sizing: border-box;
        }
        .account-reference .account-screen {
          position: relative;
          width: 100%;
          max-width: 500px;
          min-height: calc(100dvh - 59px);
          margin: 0 auto;
          overflow: hidden;
          background: #fffdf8;
        }
        .account-reference .account-top {
          padding: 22px 19px 0;
        }
        .account-reference .profile-header {
          display: flex;
          height: 70px;
          align-items: center;
        }
        .account-reference .profile-logo {
          width: 50px;
          height: 50px;
          flex: 0 0 auto;
          border-radius: 6px;
          object-fit: cover;
          object-position: left center;
        }
        .account-reference .profile-details {
          min-width: 0;
          margin-left: 34px;
        }
        .account-reference .profile-name {
          overflow: hidden;
          margin: 0;
          color: #171717;
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -.5px;
          line-height: 1.05;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .account-reference .profile-id {
          display: inline-flex;
          min-height: 23px;
          align-items: center;
          margin-top: 6px;
          border-radius: 5px;
          padding: 2px 7px;
           background: linear-gradient(105deg, ${accent}, ${accentDark});
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          line-height: 1;
        }
        .account-reference .profile-settings {
          display: grid;
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          place-items: center;
          margin-left: auto;
          border: 0;
          padding: 0;
          background: transparent;
          color: ${accent};
          transition: transform .12s ease, color .12s ease;
        }
        .account-reference .profile-settings svg {
          width: 27px;
          height: 27px;
          stroke-width: 2.4;
        }
        .account-reference .profile-settings:active {
          transform: scale(.92) rotate(15deg);
        }
        .account-reference .balance-card {
          display: flex;
          height: 110px;
          align-items: center;
          justify-content: space-between;
          margin-top: 18px;
          overflow: hidden;
          border-radius: 6px;
          padding: 18px 21px;
           background:
             radial-gradient(circle at 48% 32%, rgba(115, 239, 242, .35), transparent 42%),
             linear-gradient(109deg, ${accent} 0%, #18c1c7 42%, ${accentDark} 100%);
           box-shadow: 0 2px 7px rgba(0, 126, 149, .22);
        }
        .account-reference .balance-label {
          margin: 0 0 12px;
          color: #fff;
          font-size: 20px;
          font-weight: 400;
          line-height: 1;
        }
        .account-reference .balance-amount {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin: 0;
          color: #fff;
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
        }
        .account-reference .balance-amount small {
          font-size: 15px;
          font-weight: 700;
        }
        .account-reference .balance-details {
          display: grid;
          min-width: 80px;
          height: 41px;
          place-items: center;
          border: 0;
          border-radius: 4px;
          padding: 0 10px;
           background: #006879;
          color: #fff;
          font-size: 14px;
          font-weight: 500;
          line-height: 1;
          box-shadow: 0 1px 2px rgba(34, 0, 43, .18);
          transition: transform .12s ease, background-color .12s ease;
        }
        .account-reference .balance-details:active {
          transform: scale(.96);
           background: #005463;
        }
        .account-reference .balance-quick-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 14px;
        }
        .account-reference .balance-quick-action {
           display: block;
          min-width: 0;
          overflow: hidden;
           border: 0;
          border-radius: 14px;
           padding: 0;
           background: transparent;
          line-height: 0;
          transition: transform .12s ease, filter .12s ease;
        }
        .account-reference .balance-quick-action:hover {
          filter: brightness(1.03);
        }
        .account-reference .balance-quick-action:active {
          transform: scale(.98);
        }
        .account-reference .balance-quick-action:focus-visible,
        .account-reference .profile-settings:focus-visible,
        .account-reference .balance-details:focus-visible,
        .account-reference .account-row:focus-visible,
        .account-reference .contact-float:focus-visible {
           outline: 3px solid ${accentDark};
          outline-offset: 2px;
        }
        .account-reference .balance-quick-action img {
           display: block;
           width: 100%;
           height: auto;
           aspect-ratio: 4 / 1;
           object-fit: contain;
        }
        .account-reference .account-menu {
          margin-top: 30px;
          border-top: 1px solid #ebe7e0;
          background: #fffdf8;
        }
        .account-reference .account-row {
          display: flex;
          width: 100%;
          height: 64px;
          align-items: center;
          border: 0;
          border-bottom: 1px solid #ebe7e0;
          padding: 0 20px;
          background: transparent;
          color: #292929;
          text-align: left;
          transition: background-color .12s ease;
        }
        .account-reference .account-row:hover {
           background: #effcfd;
        }
        .account-reference .account-row:active {
           background: #dff6f8;
        }
        .account-reference .account-row-icon {
          width: 22px;
          height: 22px;
          flex: 0 0 auto;
          color: ${accent};
          stroke-width: 2.35;
        }
        .account-reference .account-row-label {
          min-width: 0;
          flex: 1;
          margin-left: 16px;
          overflow: hidden;
          color: #282828;
          font-size: 16px;
          font-weight: 400;
          line-height: 1;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .account-reference .account-row-value {
          margin-right: 7px;
          color: #414141;
          font-size: 14px;
          font-weight: 400;
          line-height: 1;
        }
        .account-reference .account-row-chevron {
          width: 21px;
          height: 21px;
          flex: 0 0 auto;
          color: #8f8f8f;
          stroke-width: 2.1;
        }
        .account-reference .account-maintenance {
           padding: 16px 20px 24px;
        }
        .account-reference .account-admin {
          width: 100%;
          min-height: 48px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 700;
        }
        .account-reference .account-admin {
          border: 0;
           background: ${accent};
          color: #fff;
        }
        .account-reference .contact-float {
          position: fixed;
          right: max(-14px, calc((100vw - 500px) / 2 - 14px));
          bottom: 86px;
          z-index: 40;
          display: flex;
          width: 146px;
          height: 56px;
          align-items: center;
          border: 0;
          border-radius: 28px 0 0 28px;
          padding: 0 12px 0 4px;
           background: linear-gradient(105deg, ${accent} 0%, #18c1c7 49%, ${accentDark} 100%);
          color: #fff;
           box-shadow: 0 3px 10px rgba(0, 126, 149, .28);
          transition: transform .12s ease, filter .12s ease;
        }
        .account-reference .contact-float:hover {
          filter: brightness(1.04);
        }
        .account-reference .contact-float:active {
          transform: translateX(-3px) scale(.98);
        }
        .account-reference .contact-float img {
          width: 48px;
          height: 48px;
          flex: 0 0 auto;
          object-fit: contain;
          object-position: center;
        }
        .account-reference .contact-float span {
          flex: 1;
          margin-left: 3px;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          line-height: 17px;
          text-align: center;
        }
        @media (max-width: 380px) {
          .account-reference .account-top { padding-top: 42px; padding-right: 14px; padding-left: 14px; }
          .account-reference .profile-details { margin-left: 24px; }
          .account-reference .profile-name { font-size: 23px; }
          .account-reference .balance-card { padding-right: 17px; padding-left: 17px; }
          .account-reference .balance-label { font-size: 18px; }
          .account-reference .balance-amount { font-size: 25px; }
          .account-reference .balance-details { min-width: 74px; font-size: 13px; }
          .account-reference .account-row { padding-right: 16px; padding-left: 16px; }
        }
      `}</style>

      <div className="account-screen">
        <section className="account-top" aria-label="Account information">
          <header className="profile-header">
            <img className="profile-logo" src={teldLogo} alt="TELD" />
            <div className="profile-details">
              <p className="profile-name">{displayName}</p>
              <span className="profile-id">ID:{user.id}</span>
            </div>
            <button type="button" className="profile-settings" onClick={handleLogout} aria-label="Sign out" data-testid="button-account-logout">
              <LogOut aria-hidden="true" />
            </button>
          </header>

          <section className="balance-card" aria-label="My Balance">
            <div>
              <p className="balance-label">My Balance</p>
                <p className="balance-amount"><span>{displayBalance}</span></p>
            </div>
            <button type="button" className="balance-details" onClick={() => navigate("/history")} data-testid="button-balance-details">
              Details &gt;
            </button>
          </section>

          <section className="balance-quick-actions" aria-label="Quick actions">
             <button type="button" className="balance-quick-action" onClick={() => navigate("/deposit")} aria-label="Deposit" data-testid="button-quick-recharge">
               <img src={rechargeButtonImage} alt="Deposit" />
            </button>
             <button type="button" className="balance-quick-action" onClick={() => navigate("/withdrawal")} aria-label="Withdraw" data-testid="button-quick-withdraw">
               <img src={withdrawButtonImage} alt="Withdraw" />
            </button>
          </section>
        </section>

        <nav className="account-menu" aria-label="Account options">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.testId}
                type="button"
                className="account-row"
               onClick={() => item.href && navigate(item.href)}
                data-testid={item.testId}
              >
                <Icon className="account-row-icon" aria-hidden="true" />
                <span className="account-row-label">{item.label}</span>
                {item.value && <span className="account-row-value">{item.value}</span>}
                <ChevronRight className="account-row-chevron" aria-hidden="true" />
              </button>
            );
          })}
        </nav>

        {user.isAdmin && (
          <div className="account-maintenance">
            <button type="button" className="account-admin" onClick={handleAdminClick} data-testid="button-admin">
              <Shield className="mr-2 inline h-4 w-4" />
              Admin panel
            </button>
          </div>
        )}
      </div>

      <button type="button" className="contact-float" onClick={() => navigate("/service")} data-testid="button-floating-contact">
        <img src={serviceRepresentative} alt="" aria-hidden="true" />
        <span>Contact<br />us</span>
      </button>

      <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Administrator access code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">Enter your PIN to access the administrator panel</p>
            <Input
              type="password"
              value={adminPin}
              onChange={(event) => setAdminPin(event.target.value)}
              placeholder="Code PIN"
              className="text-center text-2xl tracking-widest"
              maxLength={8}
              data-testid="input-admin-pin"
            />
            <Button
              onClick={() => {
                if (adminPin.length < 4) {
                  toast({ title: "The PIN must contain at least 4 characters", variant: "destructive" });
                  return;
                }
                verifyPinMutation.mutate(adminPin);
              }}
              disabled={verifyPinMutation.isPending || adminPin.length < 4}
               className="w-full bg-[#00ABB7] hover:bg-[#007E95]"
              data-testid="button-verify-pin"
            >
              {verifyPinMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}