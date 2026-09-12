import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import AdminDashboard from "@/components/admin/dashboard";
import AdminDeposits from "@/components/admin/deposits";
import AdminWithdrawals from "@/components/admin/withdrawals";
import AdminUsers from "@/components/admin/users";
import AdminProducts from "@/components/admin/products";
import AdminPaymentNumbers from "@/components/admin/payment-numbers";
import AdminSettings from "@/components/admin/settings";
import AdminGiftCodes from "@/components/admin/gift-codes";
import AdminCountries from "@/components/admin/countries";
import AdminBlockedIps from "@/components/admin/blocked-ips";

export default function AdminPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!user?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-secondary px-4 py-4 flex items-center gap-4 sticky top-0 z-50">
        <Button size="icon" variant="ghost" onClick={() => navigate("/account")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-secondary-foreground" data-testid="text-admin-title">Administration</h1>
      </header>

      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="w-max">
              <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="deposits" data-testid="tab-deposits">Deposits</TabsTrigger>
              <TabsTrigger value="withdrawals" data-testid="tab-withdrawals">Withdrawals</TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
              <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
              <TabsTrigger value="payment-numbers" data-testid="tab-payment-numbers">Numbers</TabsTrigger>
              <TabsTrigger value="countries" data-testid="tab-countries">Countries</TabsTrigger>
              <TabsTrigger value="giftcodes" data-testid="tab-giftcodes">Gift codes</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="mt-4">
            <AdminDashboard isSuperAdmin={user.isSuperAdmin} />
          </TabsContent>

          <TabsContent value="deposits" className="mt-4">
            <AdminDeposits />
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-4">
            <AdminWithdrawals />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <AdminUsers isSuperAdmin={user.isSuperAdmin} />
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <AdminProducts />
          </TabsContent>

          <TabsContent value="payment-numbers" className="mt-4">
            <AdminPaymentNumbers />
          </TabsContent>

          <TabsContent value="countries" className="mt-4">
            <AdminCountries />
          </TabsContent>

          <TabsContent value="giftcodes" className="mt-4">
            <AdminGiftCodes />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <AdminSettings isSuperAdmin={user.isSuperAdmin} />
          </TabsContent>
          <TabsContent value="security" className="mt-4">
            <AdminBlockedIps />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
