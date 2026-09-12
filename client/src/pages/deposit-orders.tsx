import emptyIllustration from "@assets/illustration-8_1784762965573.png";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency, getCountryByCode } from "@/lib/countries";
import { Skeleton } from "@/components/ui/skeleton";

interface Deposit {
  id: number;
  amount: string;
  status: string;
  paymentMethod?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  approved: { label: "Approved",   bg: "bg-gray-900",   text: "text-white" },
  pending:  { label: "Pending",    bg: "bg-[#55c9e5]", text: "text-white" },
  rejected: { label: "Rejected",   bg: "bg-red-600",    text: "text-white" },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function DepositOrdersPage() {
  const { user } = useAuth();
  const countryInfo = user ? getCountryByCode(user.country) : null;

  const { data: deposits = [], isLoading } = useQuery<Deposit[]>({
    queryKey: ["/api/deposits/history"],
  });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="flex items-center px-4 py-3 bg-white border-b border-gray-200">
        <Link href="/account">
          <button className="p-1 mr-2" data-testid="button-back">
            <ChevronLeft className="w-5 h-5 text-[#3174d1]" />
          </button>
        </Link>
        <h1 className="flex-1 text-center text-base font-bold text-gray-900 pr-8">
          Deposit order
        </h1>
      </header>

      <div className="p-4 space-y-3">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))
        ) : deposits.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center gap-3">
            <img src={emptyIllustration} alt="No deposits" className="w-40 h-40 object-contain opacity-90" />
            <p className="text-gray-400 text-sm">No deposits yet</p>
          </div>
        ) : (
          deposits.map((d) => {
            const cfg = STATUS_CONFIG[d.status] || { label: d.status, bg: "bg-gray-500", text: "text-white" };
            return (
              <div key={d.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {/* Red top bar */}
                <div className="h-3 rounded-t-2xl" style={{ backgroundColor: "#3174d1" }} />

                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Amount</span>
                    <span className="text-[#3174d1] font-bold text-base">
                       {formatCurrency(parseFloat(d.amount), user?.country || "PH")}
                    </span>
                  </div>

                  {d.paymentMethod && (
                    <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Method</span>
                      <span className="text-gray-700 text-sm font-medium">{d.paymentMethod}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Status</span>
                    <span className={`${cfg.bg} ${cfg.text} text-xs font-semibold px-4 py-1.5 rounded-full`}>
                      {cfg.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">Date</span>
                    <span className="text-gray-400 text-sm">{formatDate(d.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
