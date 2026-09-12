import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, getCountryByCode } from "@/lib/countries";
import { ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

import nodataImg from "@assets/nodata-da225bbb_(1)_1783249133513.png";
import teldLogo from "@assets/Teld-azul-scaled_1787505809423.png";

interface Deposit {
  id: number;
  userId: number;
  amount: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  soleaspayReference?: string;
  soleaspayOrderId?: string;
  omnipayId?: string;
  omnipayReference?: string;
  sendavapayReference?: string;
}

interface Withdrawal {
  id: number;
  userId: number;
  amount: string;
  netAmount: string;
  status: string;
  createdAt: string;
  sendavapayReference?: string;
}

interface Transaction {
  id: number;
  userId: number;
  type: string;
  amount: string;
  description: string;
  createdAt: string | Date;
}

type ActiveTab = "balance" | "deposits" | "withdrawals";

const CARD_GREEN = "#00ABB7";
const CARD_BACKGROUND = "#f8f8ff";

const makeRef = (prefix: "D" | "W", id: number, date: string | Date) => {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const seq = String(id).padStart(4, "0");
  return `sdk${yy}${mm}${dd}${hh}${min}${prefix}${seq}`;
};

const getDepositRef = (deposit: Deposit) => {
  const reference =
    deposit.sendavapayReference ||
    deposit.omnipayReference ||
    deposit.omnipayId ||
    deposit.soleaspayReference ||
    deposit.soleaspayOrderId;
  if (reference) return reference.startsWith("sdk") ? reference : `sdk${reference}`;
  return makeRef("D", deposit.id, deposit.createdAt);
};

const getWithdrawalRef = (withdrawal: Withdrawal) => {
  const reference = withdrawal.sendavapayReference;
  if (reference) return reference.startsWith("sdk") ? reference : `sdk${reference}`;
  return makeRef("W", withdrawal.id, withdrawal.createdAt);
};

const maskRef = (reference: string) =>
  reference.length <= 6 ? reference : `${reference.slice(0, 2)}****${reference.slice(-4)}`;

const formatDateTime = (dateString: string | Date) => {
  const date = new Date(dateString);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
};

const getStatusInfo = (status: string) => {
  switch (status) {
    case "completed":
    case "approved":
      return { label: "Payment successful", color: CARD_GREEN };
    case "rejected":
      return { label: "Payment failed", color: "#e33d3d" };
    case "processing":
      return { label: "Processing", color: "#d98208" };
    default:
      return { label: "Pending...", color: "#d98208" };
  }
};

const getBalanceTypeLabel = (transaction: Transaction) => {
  switch (transaction.type) {
    case "bonus":
      return transaction.description === "Daily bonus"
        ? "Daily bonus"
        : transaction.description;
    case "signup_bonus":
      return "Sign-up bonus";
    case "task_reward":
      return "Reward";
    case "commission":
      return "Commission";
    case "deposit":
      return "Deposit";
    default:
      return transaction.description;
  }
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="history-row">
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const Status = ({ label, color }: { label: string; color: string }) => (
  <span className="history-status" style={{ backgroundColor: color }}>
    {label}
  </span>
);

export default function HistoryPage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("balance");
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const isAdmin = !!(user as any)?.isAdmin;
  const countryInfo = user ? getCountryByCode(user.country) : null;

  const { data: deposits = [], isLoading: depositsLoading } = useQuery<Deposit[]>({
    queryKey: ["/api/deposits/history"],
  });

  const { data: withdrawals = [], isLoading: withdrawalsLoading } = useQuery<Withdrawal[]>({
    queryKey: ["/api/withdrawals/history"],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const isPendingDeposit = (deposit: Deposit) =>
    (deposit.status === "pending" || deposit.status === "processing") &&
    Boolean(
      deposit.soleaspayReference ||
      deposit.soleaspayOrderId ||
      deposit.omnipayId ||
      deposit.omnipayReference ||
      deposit.sendavapayReference,
    );

  const handleVerify = async (depositId: number) => {
    setVerifyingId(depositId);
    try {
      const response = await fetch(`/api/deposits/${depositId}/verify`, { credentials: "include" });
      const data = await response.json();
      if (data.status === "approved") {
        toast({ title: "Payment confirmed", description: "Your account has been credited" });
        refreshUser();
        queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] });
      } else if (data.status === "rejected") {
        toast({ title: "Payment failed", description: "The payment was declined", variant: "destructive" });
        queryClient.invalidateQueries({ queryKey: ["/api/deposits/history"] });
      } else {
        toast({ title: "Processing", description: "The payment is still pending" });
      }
    } catch {
      toast({ title: "Error", description: "Unable to verify the payment", variant: "destructive" });
    } finally {
      setVerifyingId(null);
    }
  };

  if (!user) return null;

  const balanceEntries: Transaction[] = [
    ...transactions,
    {
      id: -1,
      userId: user.id,
      type: "registration",
      amount: "0",
      description: "Registration",
      createdAt: new Date(user.createdAt).toISOString(),
    },
  ].sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());

  const isLoading =
    activeTab === "balance"
      ? transactionsLoading
      : activeTab === "deposits"
        ? depositsLoading
        : withdrawalsLoading;

  const getCreditTitle = (transaction: Transaction) => {
     if (transaction.type === "registration" || transaction.type === "signup_bonus") return "Sign-up bonus";
    if (transaction.type === "task_reward" || transaction.description.toLowerCase().includes("point")) {
      return "Check-in bonus";
    }
    return transaction.description;
  };

  return (
    <main className="history-page">
      <style>{`
        .history-page {
          container-type: inline-size;
          width: 100%;
          min-height: 100dvh;
          overflow-x: hidden;
          background: #fff;
          color: #101010;
          font-family: Arial, sans-serif;
        }
        .history-page *,
        .history-page *::before,
        .history-page *::after {
          box-sizing: border-box;
        }
        .history-screen {
          container-type: inline-size;
          width: 100%;
          max-width: 512px;
          min-height: 100dvh;
          margin: 0 auto;
          background: #fff;
        }
        .history-header {
          display: grid;
          grid-template-columns: 40px minmax(88px, 125px) minmax(0, 1fr);
          gap: 10px;
          height: 96px;
          align-items: center;
          padding: 0 21px;
          border-bottom: 1px solid #e5e5e5;
        }
        .history-back {
          display: grid;
          width: 40px;
          height: 40px;
          place-items: center;
          border: 0;
          padding: 0;
          background: transparent;
          color: #171717;
        }
        .history-back svg {
          width: 30px;
          height: 30px;
          stroke-width: 1.8;
        }
        .history-title {
          margin: 0;
          color: #008895;
          font-size: 21px;
          font-weight: 400;
          line-height: 1.15;
          text-align: right;
        }
        .history-brand {
          display: block;
          width: 125px;
          height: 36px;
          object-fit: contain;
          object-position: left center;
        }
        .history-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          height: 48px;
          align-items: stretch;
          background: #fff;
        }
        .history-tab {
          position: relative;
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: center;
          border: 0;
          padding: 0;
          background: transparent;
          color: #444;
          font-size: 18px;
          font-weight: 400;
          line-height: 1;
          white-space: nowrap;
        }
        .history-tab.active {
          color: #008895;
          font-weight: 700;
        }
        .history-tab.active::after {
          position: absolute;
          right: 0;
          bottom: 0;
          left: 0;
          width: 27px;
          height: 3px;
          margin: auto;
          border-radius: 2px 2px 0 0;
          background: #00ABB7;
          content: "";
        }
        .history-tab-arrow { display: none; }
        .history-content {
          min-height: calc(100dvh - 144px);
          padding: 18px 21px 45px;
          background: linear-gradient(180deg, #b9edf0 0%, #e5f7f8 100%);
        }
        .history-list {
          display: grid;
          gap: 10px;
        }
        .history-card {
          width: 100%;
          min-height: 104px;
          overflow: hidden;
          border-radius: 11px;
          padding: 0;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.04);
        }
        .credit-card {
          display: flex;
          min-height: 104px;
          align-items: center;
          justify-content: space-between;
          padding: 0 26px;
          gap: 12px;
        }
        .credit-copy { min-width: 0; }
        .credit-title {
          margin: 0;
          color: #008895;
          font-size: 20px;
          font-weight: 400;
          line-height: 1.2;
        }
        .credit-date {
          margin: 12px 0 0;
          color: #6d6d6d;
          font-size: 18px;
          font-weight: 400;
          line-height: 1;
        }
        .credit-amount {
          flex: 0 0 auto;
          margin: 0;
          color: #008895;
          font-size: 20px;
          font-weight: 400;
          line-height: 1;
          white-space: nowrap;
        }
        .history-more {
          margin-top: 34px;
          color: #6e6e6e;
          font-size: 20px;
          line-height: 1;
          text-align: center;
        }
        .history-card-top {
          display: flex;
          min-height: 29px;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .history-amount {
          margin: 0;
          color: #111;
          font-size: 18px;
          font-weight: 700;
          line-height: 1.15;
        }
        .history-card-label {
          margin: 7px 0 0;
          color: #111;
          font-size: 16px;
          line-height: 1.15;
        }
        .history-status {
          display: inline-flex;
          min-height: 31px;
          align-items: center;
          flex: 0 0 auto;
          border-radius: 17px;
          padding: 0 10px;
          color: #fff;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          white-space: nowrap;
        }
        .history-divider {
          height: 1px;
          margin: 13px 0 5px;
          background: #8d8d8d;
        }
        .history-row {
          display: flex;
          min-height: 21px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: #111;
          font-size: 14px;
          line-height: 1.2;
        }
        .history-row > span:last-child {
          text-align: right;
          white-space: nowrap;
        }
        .history-empty {
          display: flex;
          min-height: 280px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #999;
          font-size: 14px;
        }
        .history-empty img {
          width: 112px;
          height: 112px;
          object-fit: contain;
        }
        .history-verify {
          width: 100%;
          margin-top: 10px;
          border: 0;
          border-radius: 18px;
          padding: 9px 12px;
          background: ${CARD_GREEN};
          color: #fff;
          font-size: 12px;
          font-weight: 700;
        }
        @media (max-width: 370px) {
          .history-header {
            grid-template-columns: 36px minmax(76px, 92px) minmax(0, 1fr);
            gap: 7px;
            padding-right: 16px;
            padding-left: 16px;
          }
          .history-back { width: 36px; }
          .history-brand { width: 92px; }
          .history-title { font-size: 18px; }
          .history-tab { font-size: 14px; }
          .history-content { padding-right: 16px; padding-left: 16px; }
          .credit-card { padding-right: 18px; padding-left: 18px; }
          .credit-title, .credit-amount { font-size: 17px; }
          .credit-date { font-size: 15px; }
        }
      `}</style>

      <div className="history-screen">
        <header className="history-header">
          <Link href="/account">
            <button className="history-back" data-testid="button-back" aria-label="Back">
              <ChevronLeft aria-hidden="true" />
            </button>
          </Link>
          <img className="history-brand" src={teldLogo} alt="TELD (Tcharging)" />
          <h1 className="history-title">Balance details</h1>
        </header>

        <nav className="history-tabs" aria-label="Type d'enregistrement">
          <button
            className={`history-tab ${activeTab === "balance" ? "active" : ""}`}
            onClick={() => setActiveTab("balance")}
            data-testid="tab-balance"
          >
            <span>Credit history</span>
          </button>
          <button
            className={`history-tab ${activeTab === "withdrawals" ? "active" : ""}`}
            onClick={() => setActiveTab("withdrawals")}
            data-testid="tab-withdrawals"
          >
            <span>Withdrawal history</span>
          </button>
        </nav>

        <section className="history-content" aria-live="polite">
          {isLoading ? (
            <div className="history-empty">
              <Loader2 className="animate-spin" />
            </div>
          ) : activeTab === "balance" ? (
            balanceEntries.length > 0 ? (
              <div className="history-list">
                {balanceEntries.map((transaction) => {
                  const amount = Number.parseFloat(transaction.amount || "0");
                  return (
                    <article className="history-card credit-card" key={`${transaction.type}-${transaction.id}`} data-testid={`balance-item-${transaction.id}`}>
                      <div className="credit-copy">
                        <p className="credit-title">{getCreditTitle(transaction)}</p>
                        <p className="credit-date">{formatDateTime(transaction.createdAt)}</p>
                      </div>
                      <p className="credit-amount">+{formatCurrency(amount, user.country)}</p>
                    </article>
                  );
                })}
                <p className="history-more">More data</p>
              </div>
            ) : (
              <div className="history-empty">
                <img src={nodataImg} alt="No data" />
                <span>More data</span>
              </div>
            )
          ) : activeTab === "deposits" ? (
            deposits.length > 0 ? (
              <div className="history-list">
                {deposits.map((deposit) => {
                  const { label, color } = getStatusInfo(deposit.status);
                  const amount = Number.parseFloat(deposit.amount);
                  const reference = isAdmin ? getDepositRef(deposit) : maskRef(getDepositRef(deposit));
                  return (
                    <article className="history-card" key={deposit.id} data-testid={`deposit-item-${deposit.id}`}>
                      <div className="history-card-top">
                        <div>
                          <p className="history-amount">{formatCurrency(amount, user.country)}</p>
                           <p className="history-card-label">Deposit amount</p>
                        </div>
                        <Status label={label} color={color} />
                      </div>
                      <div className="history-divider" />
                      <Row label="Number:" value={reference} />
                      <Row label="Deposit time:" value={formatDateTime(deposit.createdAt)} />
                      {isPendingDeposit(deposit) && !deposit.sendavapayReference ? (
                        <button
                          className="history-verify"
                          onClick={() => handleVerify(deposit.id)}
                          disabled={verifyingId === deposit.id}
                          data-testid={`button-verify-${deposit.id}`}
                        >
                          {verifyingId === deposit.id ? <Loader2 className="inline animate-spin" /> : <RefreshCw className="mr-1 inline h-3 w-3" />}
                           Verify transaction
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="history-empty">
                <img src={nodataImg} alt="No data" />
                <span>More data</span>
              </div>
            )
          ) : withdrawals.length > 0 ? (
            <div className="history-list">
              {withdrawals.map((withdrawal) => {
                const { label, color } = getStatusInfo(withdrawal.status);
                const gross = Number.parseFloat(withdrawal.amount);
                const net = Number.parseFloat(withdrawal.netAmount || withdrawal.amount);
                return (
                  <article className="history-card" key={withdrawal.id} data-testid={`withdrawal-item-${withdrawal.id}`}>
                    <div className="history-card-top">
                      <div>
                        <p className="history-amount">{formatCurrency(gross, user.country)}</p>
                        <p className="history-card-label">Withdrawal amount</p>
                      </div>
                      <Status label={label} color={color} />
                    </div>
                    <div className="history-divider" />
                    <Row label="Amount received:" value={formatCurrency(net, user.country)} />
                    <Row label="Withdrawal time:" value={formatDateTime(withdrawal.createdAt)} />
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="history-empty">
              <img src={nodataImg} alt="No data" />
              <span>More data</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}