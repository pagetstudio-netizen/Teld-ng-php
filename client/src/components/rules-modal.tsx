import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { formatCurrency, getBaseSettingForCountry } from "@/lib/countries";

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RulesModal({ open, onClose }: RulesModalProps) {
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Platform rules</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm text-muted-foreground">
            <section>
              <h4 className="font-medium text-foreground mb-2">1. Deposits</h4>
              <ul className="space-y-1">
                <li>- Minimum deposit: {formatCurrency(parseInt(minDeposit), country)}</li>
                <li>- Deposits are processed as quickly as possible</li>
                <li>- Make sure your payment information is correct</li>
              </ul>
            </section>

            <section>
              <h4 className="font-medium text-foreground mb-2">2. Withdrawals</h4>
              <ul className="space-y-1">
                <li>- Minimum withdrawal: {formatCurrency(parseInt(minWithdrawal), country)}</li>
                <li>- Withdrawal fee: {withdrawalFees}%</li>
                <li>- Hours: {withdrawalStartHour === "9" ? "9:00 AM" : `${withdrawalStartHour}:00`} - {withdrawalEndHour === "17" ? "5:00 PM" : `${withdrawalEndHour}:00`}</li>
                <li>- Maximum {maxWithdrawalsPerDay} withdrawal(s) per day</li>
                <li>- An active product is required to withdraw</li>
                <li>- A withdrawal wallet must be registered</li>
              </ul>
            </section>

            <section>
              <h4 className="font-medium text-foreground mb-2">3. Products</h4>
              <ul className="space-y-1">
                <li>- Standard cycle: 100 days</li>
                <li>- Automatic daily earnings</li>
                <li>- Earnings are credited 24 hours after purchase</li>
                <li>- Daily check-in bonus: claim {formatCurrency(10, user?.country || "PH")}/day</li>
              </ul>
            </section>

            <section>
              <h4 className="font-medium text-foreground mb-2">4. Referrals</h4>
              <ul className="space-y-1">
                <li>- Level 1: {lv1}% commission</li>
                <li>- Level 2: {lv2}% commission</li>
                <li>- Level 3: {lv3}% commission</li>
                <li>- Commissions on product purchases</li>
              </ul>
            </section>

            <section>
              <h4 className="font-medium text-foreground mb-2">5. Sign-up bonus</h4>
                <p>Each new member receives a {formatCurrency(parseInt(signupBonus), country)} sign-up bonus.</p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
