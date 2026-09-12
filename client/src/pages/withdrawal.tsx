import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatCurrency, formatLocalCurrency, getCountryByCode, getCurrencyCode, getCurrencySymbol } from "@/lib/countries";

import withdrawalReference from "@assets/IMG_20260823_162842_425_1787503826320.jpg";
import teldLogo from "@assets/Teld-azul-scaled_1787505809423.png";

interface WalletData {
  id: number;
  userId: number;
  accountName: string;
  accountNumber: string;
  paymentMethod: string;
  country: string;
  isDefault: boolean;
}

interface UserProduct {
  id: number;
  status: string;
}

export default function WithdrawalPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [amount, setAmount] = useState<number | "">("");
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);

  const countryInfo = user ? getCountryByCode(user.country) : null;

  const { data: withdrawalSettings } = useQuery<{
    withdrawalFees: number;
    withdrawalStartHour: number;
    withdrawalEndHour: number;
    maxWithdrawalsPerDay: number;
    minWithdrawal: number;
  }>({
    queryKey: ["/api/settings/withdrawal"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const minWithdrawal = withdrawalSettings?.minWithdrawal ?? 100;
  const withdrawalFee = withdrawalSettings?.withdrawalFees ?? 10;
  const withdrawalStartHour = withdrawalSettings?.withdrawalStartHour ?? 9;
  const withdrawalEndHour = withdrawalSettings?.withdrawalEndHour ?? 17;
  const amountAfterFees = amount ? Math.floor(Number(amount) * (1 - withdrawalFee / 100)) : 0;
  const countryTimeZone = user?.country === "NG" ? "Africa/Lagos" : "Asia/Manila";
  const currentHour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: countryTimeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date()).find((part) => part.type === "hour")?.value || "0");
  const isWithinWithdrawalHours = currentHour >= withdrawalStartHour && currentHour < withdrawalEndHour;
  const formatWithdrawalHour = (hour: number) =>
    new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const { data: wallets = [], isLoading: walletsLoading } = useQuery<WalletData[]>({
    queryKey: ["/api/wallets"],
    refetchOnWindowFocus: true,
  });

  const { data: userProducts = [] } = useQuery<UserProduct[]>({
    queryKey: ["/api/user/products"],
  });

  const hasActiveProduct = userProducts.some((product) => product.status === "active");

  useEffect(() => {
    const savedWalletId = localStorage.getItem("selectedWalletId");
    if (savedWalletId && wallets.length > 0) {
      const wallet = wallets.find((item) => item.id === parseInt(savedWalletId));
      if (wallet) setSelectedWallet(wallet);
      localStorage.removeItem("selectedWalletId");
    }
  }, [wallets]);

  useEffect(() => {
    if (!selectedWallet && wallets.length > 0) {
      const defaultWallet = wallets.find((wallet) => wallet.isDefault);
      if (defaultWallet) setSelectedWallet(defaultWallet);
    }
  }, [wallets, selectedWallet]);

  const withdrawMutation = useMutation({
    mutationFn: async (data: { amount: number; walletId: number }) => {
      const response = await apiRequest("POST", "/api/withdrawals", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Request sent", description: "Your withdrawal request has been sent." });
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawals"] });
      setAmount("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!isWithinWithdrawalHours) {
      toast({
        title: "Withdrawal hours",
        description: `Withdrawals are available from ${formatWithdrawalHour(withdrawalStartHour)} to ${formatWithdrawalHour(withdrawalEndHour)}`,
        variant: "destructive",
      });
      return;
    }
    if (!hasActiveProduct) {
      toast({
        title: "Product required",
        description: "You must have an active product to withdraw",
        variant: "destructive",
      });
      return;
    }
    if (!amount || amount < minWithdrawal) {
      toast({
        title: "Invalid amount",
        description: `The minimum amount is ${minWithdrawal} ${getCurrencyCode(user?.country || "PH")}`,
        variant: "destructive",
      });
      return;
    }
    if (!selectedWallet) {
      toast({ title: "Account required", description: "Please select a mobile account", variant: "destructive" });
      return;
    }
    withdrawMutation.mutate({ amount: Number(amount), walletId: selectedWallet.id });
  };

  if (walletsLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2bb087]" />
      </div>
    );
  }

  if (!user) return null;

  const balance = parseFloat(user.balance || "0");

  return (
    <main className="withdrawal-reference min-h-screen">
      <style>{`
        .withdrawal-reference {
          container-type: inline-size;
          overflow-x: hidden;
          background: #fff;
          color: #262626;
          font-family: Arial, Helvetica, sans-serif;
        }
        .withdrawal-reference .withdrawal-screen {
          container-type: inline-size;
          width: 100%;
          max-width: 512px;
          min-height: 100dvh;
          margin: 0 auto;
          background: #fff;
        }
        .withdrawal-reference .withdrawal-hero {
          position: relative;
          height: 112px;
          overflow: hidden;
          background-image: url("${withdrawalReference}");
          background-position: 0 -21.6797cqw;
          background-repeat: no-repeat;
          background-size: 100cqw auto;
        }
        .withdrawal-reference .hero-hotspot {
          position: absolute;
          z-index: 2;
          border: 0;
          background: transparent;
          -webkit-tap-highlight-color: transparent;
        }
        .withdrawal-reference .hero-hotspot:focus-visible {
          outline: 2px solid #fff;
          outline-offset: -2px;
        }
        .withdrawal-reference .hero-back {
          top: 18px;
          left: 17px;
          width: 51px;
          height: 53px;
        }
        .withdrawal-reference .hero-history {
          top: 17px;
          right: 12px;
          width: 48px;
          height: 51px;
        }
        .withdrawal-reference .withdrawal-panel {
          position: relative;
          z-index: 1;
          min-height: 779px;
          margin-top: -1px;
          padding-bottom: 40px;
          border-radius: 25px 25px 0 0;
          background: #fff;
        }
        .withdrawal-reference .balance-summary {
          position: relative;
          height: 194px;
        }
        .withdrawal-reference .balance-brand {
          position: absolute;
          top: 73px;
          left: 50px;
           width: 82px;
           height: 42px;
           object-fit: contain;
        }
        .withdrawal-reference .balance-label {
          position: absolute;
          top: 53px;
          left: 156px;
          margin: 0;
          color: #929292;
          font-size: 21px;
          font-weight: 400;
          line-height: 1.2;
        }
        .withdrawal-reference .balance-value {
          position: absolute;
          top: 87px;
          left: 156px;
          margin: 0;
          color: #171717;
          font-size: 51px;
          font-weight: 400;
          letter-spacing: -1.8px;
          line-height: .95;
          white-space: nowrap;
        }
        .withdrawal-reference .wallet-section,
        .withdrawal-reference .amount-section {
          margin: 0 21px;
        }
        .withdrawal-reference .field-label {
          margin: 0;
          color: #8c8c8c;
          font-size: 21px;
          font-weight: 400;
          line-height: 1.2;
        }
        .withdrawal-reference .wallet-field {
          display: flex;
          width: 100%;
          height: 61px;
          align-items: center;
          margin-top: 16px;
          border: 1px solid #9d9d9d;
          border-radius: 10px;
          background: #fff;
          color: #4b4b4b;
          text-align: left;
        }
        .withdrawal-reference .card-icon {
          position: relative;
          display: block;
          width: 27px;
          height: 20px;
          flex: 0 0 auto;
          margin-left: 16px;
          border: 2px solid #4ca889;
          border-radius: 4px;
        }
        .withdrawal-reference .card-icon::before,
        .withdrawal-reference .card-icon::after {
          position: absolute;
          left: 4px;
          width: 12px;
          height: 2px;
          background: #4ca889;
          content: "";
        }
        .withdrawal-reference .card-icon::before { top: 5px; }
        .withdrawal-reference .card-icon::after { top: 10px; }
        .withdrawal-reference .wallet-copy {
          overflow: hidden;
          flex: 1;
          margin-left: 14px;
          color: #4e4e4e;
          font-size: 19px;
          letter-spacing: 1px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .withdrawal-reference .wallet-field svg {
          width: 25px;
          height: 25px;
          margin-right: 15px;
          color: #969696;
          stroke-width: 1.5;
        }
        .withdrawal-reference .amount-section {
          margin-top: 27px;
        }
        .withdrawal-reference .amount-field {
          display: flex;
          height: 53px;
          align-items: center;
          margin-top: 15px;
          border: 1px solid #9d9d9d;
          background: #fff;
        }
        .withdrawal-reference .amount-currency {
          flex: 0 0 auto;
          padding-left: 19px;
          color: #409b81;
          font-size: 28px;
          line-height: 1;
        }
        .withdrawal-reference .amount-field input {
          width: 100%;
          min-width: 0;
          height: 100%;
          border: 0;
          outline: 0;
          padding: 0 8px;
          color: #4c4c4c;
          background: transparent;
          font-size: 20px;
        }
        .withdrawal-reference .amount-field input::placeholder {
          color: #969696;
          opacity: 1;
        }
        .withdrawal-reference .amount-details {
          display: flex;
          justify-content: space-between;
          margin: 13px 10px 0;
          color: #3f3f3f;
          font-size: 15px;
          line-height: 1.2;
        }
        .withdrawal-reference .confirm {
          display: block;
          width: 317px;
          max-width: calc(100% - 42px);
          height: 64px;
          margin: 26px auto 0;
          border: 0;
          border-radius: 34px;
          background: #2bb087;
          color: #fff;
          font-size: 24px;
          font-weight: 400;
          line-height: 1;
          transition: transform 120ms ease, filter 120ms ease;
        }
        .withdrawal-reference .confirm:active,
        .withdrawal-reference .wallet-field:active {
          transform: scale(.98);
          filter: brightness(.96);
        }
        .withdrawal-reference .instructions {
          margin: 14px 21px 0;
          color: #3d3d3d;
          font-size: 16px;
          line-height: 1.48;
        }
        .withdrawal-reference .instructions p {
          margin: 0;
        }
        @media (max-width: 360px) {
          .withdrawal-reference .balance-summary { height: 164px; }
          .withdrawal-reference .balance-brand { left: 35px; transform: scale(.82); transform-origin: top left; }
          .withdrawal-reference .balance-label,
          .withdrawal-reference .balance-value { left: 125px; }
          .withdrawal-reference .balance-value { font-size: 42px; }
          .withdrawal-reference .wallet-section,
          .withdrawal-reference .amount-section { margin-right: 16px; margin-left: 16px; }
          .withdrawal-reference .field-label { font-size: 18px; }
          .withdrawal-reference .wallet-copy,
          .withdrawal-reference .amount-field input { font-size: 17px; }
          .withdrawal-reference .amount-currency { padding-left: 14px; font-size: 24px; }
          .withdrawal-reference .instructions { margin-right: 16px; margin-left: 16px; font-size: 14px; }
        }
      `}</style>

      <div className="withdrawal-screen">
        <section className="withdrawal-hero" aria-label="Withdrawal">
          <button type="button" className="hero-hotspot hero-back" onClick={() => navigate("/account")} aria-label="Back" />
          <button type="button" className="hero-hotspot hero-history" onClick={() => navigate("/history")} aria-label="Withdrawal history" />
        </section>

        <section className="withdrawal-panel">
          <section className="balance-summary" aria-label="Current balance">
            <img className="balance-brand" src={teldLogo} alt="TELD (Tcharging)" />
            <p className="balance-label">Current balance</p>
            <p className="balance-value" data-testid="text-balance">{formatCurrency(balance, user.country)}</p>
          </section>

          <section className="wallet-section" aria-label="Mobile account">
            <p className="field-label">Select your mobile account</p>
            <button
              type="button"
              className="wallet-field"
              onClick={() => navigate(wallets.length > 0 ? "/wallet?from=withdrawal" : "/wallet")}
              data-testid="button-select-wallet"
            >
              <span className="card-icon" aria-hidden="true" />
              <span className="wallet-copy">
                {selectedWallet ? `${selectedWallet.accountName} · ${selectedWallet.accountNumber}` : "-------- -----------"}
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          </section>

          <section className="amount-section" aria-label="Withdrawal amount">
            <p className="field-label">Withdrawal amount</p>
            <label className="amount-field">
              <span className="amount-currency">{getCurrencySymbol(user.country)}</span>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value ? Number(event.target.value) : "")}
                placeholder="Enter the withdrawal amount"
                data-testid="input-withdrawal-amount"
                aria-label="Withdrawal amount"
              />
            </label>
            <div className="amount-details">
              <span>Amount received: {formatLocalCurrency(amountAfterFees, user.country)}</span>
              <span>Fee rate: {withdrawalFee}%</span>
            </div>
          </section>

          <button
            type="button"
            className="confirm"
            onClick={handleSubmit}
            disabled={withdrawMutation.isPending}
            data-testid="button-submit-withdrawal"
          >
            {withdrawMutation.isPending ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : "Confirm"}
          </button>

          <section className="instructions" aria-label="Withdrawal instructions">
            <p>1. Minimum withdrawal amount: {formatLocalCurrency(minWithdrawal, user.country)}.</p>
            <p>2. Withdrawal fees are {withdrawalFee}% of the withdrawn amount.</p>
            <p>3. You can withdraw at any time. Withdrawals are available within 4 to 24 hours.</p>
            <p>4. To protect the interests of the platform and its members, you must have at least one device to activate withdrawals.</p>
          </section>
        </section>
      </div>
    </main>
  );
}