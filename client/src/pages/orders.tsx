import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import emptyIllustration from "@assets/illustration-8_1784762965573.png";
import { companyProductImages } from "@/lib/product-images";
import { formatCompanyProductName } from "@/lib/product-names";
import { formatCurrency } from "@/lib/countries";

const productImages = companyProductImages;

export default function OrdersPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  const { data: userProducts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/user/products"],
  });

  if (!user) return null;

  const getProductImage = (index: number) => {
    return productImages[index % productImages.length];
  };

  const filteredProducts = userProducts?.filter((up: any) => 
    activeTab === "active" ? up.status === "active" : up.status !== "active"
  ) || [];

  return (
    <div className="flex flex-col min-h-full bg-white">
      <header className="px-4 py-3 border-b">
        <h1 className="text-lg font-semibold text-gray-800 text-center">My orders</h1>
      </header>

      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("active")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            activeTab === "active"
              ? "text-[#2196F3] border-b-2 border-[#2196F3]"
              : "text-gray-500"
          }`}
          data-testid="orders-tab-active"
        >
          <span className="w-2 h-2 rounded-full bg-[#2196F3]"></span>
          Active
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            activeTab === "completed"
              ? "text-gray-700 border-b-2 border-gray-500"
              : "text-gray-500"
          }`}
          data-testid="orders-tab-completed"
        >
          <span className="text-gray-400">&#10003;</span>
          Completed
        </button>
      </div>

      <div className="bg-orange-50 p-3 mx-4 mt-3 rounded-lg">
        <p className="text-xs text-orange-700 leading-relaxed">
          Product earnings are credited automatically every 24 hours.
        </p>
        <p className="text-xs text-orange-700 leading-relaxed mt-1">
          You can buy multiple products to increase your earnings.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto pb-20 px-4 pt-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="space-y-4">
            {filteredProducts.map((up: any, index: number) => {
              const daysCompleted = (up.product?.cycleDays || 0) - (up.daysRemaining || 0);
              const totalEarned = daysCompleted * (up.product?.dailyEarnings || 0);
              const purchaseDateTime = up.purchasedAt ? new Date(up.purchasedAt) : null;
              const purchaseDate = purchaseDateTime ? purchaseDateTime.toLocaleDateString('en-US') : '-';
              const purchaseTime = purchaseDateTime ? purchaseDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-';
              
              return (
                <div 
                  key={up.id} 
                  className="bg-white rounded-xl p-4 shadow-sm border"
                  data-testid={`order-card-${up.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 flex-shrink-0">
                      <img 
                        src={getProductImage(up.productId ? up.productId % productImages.length : index)} 
                        alt={formatCompanyProductName(up.product?.name, up.productId)}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-red-500 font-bold text-sm">
                          {formatCompanyProductName(up.product?.name, up.productId)}
                        </p>
                        <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                          up.status === 'active' 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {up.status === 'active' ? 'Active' : 'Completed'}
                        </span>
                      </div>
                      
                      <div className="space-y-0.5 text-[12px]">
                        <p className="text-gray-600">
                           Price: <span className="text-orange-500 font-medium">{formatCurrency(Number(up.product?.price || 0), user.country)}</span>
                        </p>
                        <p className="text-gray-600">
                           Earnings/day: <span className="text-green-500 font-medium">{formatCurrency(Number(up.product?.dailyEarnings || 0), user.country)}</span>
                        </p>
                        <p className="text-gray-600">
                          Duration: <span className="text-orange-500 font-medium">{up.product?.cycleDays || 0} days</span>
                        </p>
                        <p className="text-gray-600">
                          Days remaining: <span className="text-[#2196F3] font-medium">{up.daysRemaining || 0}</span>
                        </p>
                        <p className="text-gray-600">
                           Total earned: <span className="text-green-600 font-bold">{formatCurrency(totalEarned, user.country)}</span>
                        </p>
                        <p className="text-gray-600">
                           Date: <span className="text-gray-700 font-medium">{purchaseDate}</span> at <span className="text-gray-700 font-medium">{purchaseTime}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 flex flex-col items-center gap-2">
            <img src={emptyIllustration} alt="No orders" className="w-40 h-40 object-contain opacity-90" />
            <p className="text-gray-500 font-medium">No content at the moment!</p>
          </div>
        )}
      </div>
    </div>
  );
}
