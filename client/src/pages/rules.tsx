import { ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { formatCurrency, getBaseSettingForCountry } from "@/lib/countries";

export default function RulesPage() {
  const { user } = useAuth();
  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  const country = user?.country || "PH";
  const signupBonus = getBaseSettingForCountry(settings || {}, "signupBonus", country, "40");
  const minDeposit = getBaseSettingForCountry(settings || {}, "minDeposit", country, "320");
  const minWithdrawal = getBaseSettingForCountry(settings || {}, "minWithdrawal", country, "100");
  const withdrawalFees = settings?.withdrawalFees || "10";
  const withdrawalStartHour = settings?.withdrawalStartHour || "9";
  const withdrawalEndHour = settings?.withdrawalEndHour || "17";
  const maxWithdrawalsPerDay = settings?.maxWithdrawalsPerDay || "1";
  const lv1 = settings?.level1Commission || "15";
  const lv2 = settings?.level2Commission || "2";
  const lv3 = settings?.level3Commission || "1";

  return (
    <div className="flex flex-col min-h-full" style={{ background: "#111" }}>
      <header className="flex items-center px-4 py-3" style={{ background: "#111", borderBottom: "1px solid #222" }}>
        <Link href="/account">
          <button className="p-1" data-testid="button-back">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold text-white pr-6">Platform rules</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ color: "#d4d4d4", fontSize: 13.5, lineHeight: "1.75" }}>
        <section className="space-y-2">
           <h2 className="text-[15px] font-bold text-[#7fc9ff] border-l-2 border-[#7fc9ff] pl-2">1. Investment</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Each user may own multiple investment products at the same time.</li>
            <li>Earnings are generated daily and credited to your account balance every 24 hours.</li>
            <li>The standard investment cycle is 100 days unless otherwise stated for special products.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-bold text-[#7fc9ff] border-l-2 border-[#7fc9ff] pl-2">2. Deposits and Withdrawals</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>The minimum deposit amount is {formatCurrency(parseInt(minDeposit), country)}.</li>
            <li>The minimum withdrawal amount is {formatCurrency(parseInt(minWithdrawal), country)}.</li>
            <li>Withdrawal fees are set at {withdrawalFees}% to cover transaction and maintenance costs.</li>
            <li>Withdrawals are processed between {withdrawalStartHour === "9" ? "9:00 AM" : `${withdrawalStartHour}:00`} and {withdrawalEndHour === "17" ? "5:00 PM" : `${withdrawalEndHour}:00`} on business days.</li>
            <li>Limit of {maxWithdrawalsPerDay} withdrawal(s) per user per day.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-bold text-[#7fc9ff] border-l-2 border-[#7fc9ff] pl-2">3. Referral System</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Level 1 commission: {lv1}% on the referral's FIRST investment.</li>
            <li>Level 2 commission: {lv2}% on the referral's FIRST investment.</li>
            <li>Level 3 commission: {lv3}% on the referral's FIRST investment.</li>
            <li>Fraudulent activity or creating multiple accounts to manipulate the system will result in account suspension.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-bold text-[#7fc9ff] border-l-2 border-[#7fc9ff] pl-2">4. Sign-up Bonus</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Each new member receives a {formatCurrency(parseInt(signupBonus), country)} sign-up bonus.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-bold text-[#7fc9ff] border-l-2 border-[#7fc9ff] pl-2">5. Security</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You are responsible for keeping your password secure.</li>
            <li>Never share your login credentials with third parties.</li>
            <li>Official customer service will never ask for your password.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
