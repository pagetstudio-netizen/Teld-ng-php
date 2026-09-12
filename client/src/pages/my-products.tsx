import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, getCountryByCode } from "@/lib/countries";
import { Loader2 } from "lucide-react";
import type { Product } from "@shared/schema";

import emptyIllustration from "@assets/illustration-8_1784762965573.png";
import { getCompanyProductImage } from "@/lib/product-images";
import { formatCompanyProductName } from "@/lib/product-names";

interface ProductWithOwnership extends Product {
  isOwned: boolean;
  canClaimFree: boolean;
  ownedCount?: number;
}

export default function MyProductsPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"our" | "my">("our");
  const [confirmProduct, setConfirmProduct] = useState<ProductWithOwnership | null>(null);

  const { data: products, isLoading: loadingProducts } = useQuery<ProductWithOwnership[]>({
    queryKey: ["/api/products"],
    staleTime: 0,
  });

  const { data: userProducts, isLoading: loadingUserProducts } = useQuery<any[]>({
    queryKey: ["/api/user/products"],
    staleTime: 0,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (productId: number) => {
      const response = await apiRequest("POST", `/api/products/${productId}/purchase`, {});
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Error");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/products"] });
      refreshUser();
      setConfirmProduct(null);
      toast({ title: "Product purchased!", description: "You will start receiving earnings tomorrow." });
    },
    onError: (error: any) => {
      setConfirmProduct(null);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (!user) return null;

  const country = getCountryByCode(user.country);
  const paidProducts = products?.filter(p => !p.isFree) || [];
  const allUserProducts = userProducts || [];
  const activeUserProducts = allUserProducts.filter(up => up.status === "active");
  const activeProductCount = activeUserProducts.length;
  const totalUserEarnings = Math.round(Number(user.totalEarnings || 0));
  const formatStatAmount = (amount: number) => formatCurrency(amount, user.country);
  const formatProductName = (product: Product) => formatCompanyProductName(product.name, product.id);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // Format date as "20 Jul 2026, 15:00"
  const formatPurchaseDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
     return new Date(dateStr).toLocaleDateString("en-US") + `, ${new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <main className="products-reference min-h-full bg-white pb-[92px]">
      <style>{`
        .products-reference { color: #111; font-family: Arial, Helvetica, sans-serif; }
        .products-reference .products-screen { container-type: inline-size; width: 100%; max-width: 512px; margin: 0 auto; overflow: hidden; background: #fff; }
        .products-reference .products-header { display: grid; height: 81px; place-items: center; border-bottom: 1px solid #e4e4e4; background: #fff; }
        .products-reference .products-header h1 { margin: 0; color: #111; font-size: 19px; font-weight: 400; line-height: 1; }
        .products-reference .products-stats { display: grid; height: 86px; grid-template-columns: 1fr 1fr; background: #00ABB7; color: white; }
        .products-reference .products-stat { display: flex; align-items: flex-start; flex-direction: column; justify-content: center; border: 0; padding: 0 21px; background: transparent; color: white; text-align: left; transition: background-color 120ms ease, transform 120ms ease; }
        .products-reference .products-stat:active { background: rgba(0,0,0,.06); transform: scale(.98); }
        .products-reference .products-stat-value { display: block; max-width: 100%; overflow: hidden; font-size: 25px; font-weight: 400; line-height: 1; text-overflow: ellipsis; white-space: nowrap; }
        .products-reference .products-stat-label { display: block; margin-top: 7px; font-size: 13px; font-weight: 400; line-height: 1; }
        .products-reference .product-list { padding: 0 0 20px; background: #fff; }
         .products-reference .product-card { position: relative; display: grid; height: auto; min-height: 265px; grid-template-columns: minmax(0, 29.69%) minmax(0, 1fr); column-gap: 24px; margin: 10px 13px 11px; overflow: hidden; border: 1px solid #a8dfe3; border-radius: 9px; padding: 20px 14px 78px; background: #fff; box-shadow: 0 1px 3px rgba(0,123,136,.08); }
         .products-reference .product-picture { position: static; display: flex; width: 100%; height: auto; aspect-ratio: 1.15; align-items: center; justify-content: center; overflow: hidden; border-radius: 9px; background: #eef7f8; }
         .products-reference .product-picture img { display: block; width: 100%; height: 100%; object-fit: cover; }
         .products-reference .product-details { min-width: 0; align-self: start; }
        .products-reference .product-name { overflow: hidden; margin: 0; color: #111; font-size: 20px; font-weight: 700; line-height: 1.05; text-overflow: ellipsis; white-space: nowrap; }
         .products-reference .product-price { margin: 15px 0 0; color: #008895; font-size: 17px; font-weight: 400; line-height: 1; }
         .products-reference .product-line { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 8px; margin: 14px 0 0; color: #171717; font-size: 14px; font-weight: 400; line-height: 1.2; }
         .products-reference .product-line span { min-width: 0; overflow-wrap: anywhere; }
         .products-reference .product-line strong { min-width: 0; color: #171717; font-weight: 400; text-align: right; overflow-wrap: anywhere; }
        .products-reference .buy { position: absolute; right: 14px; bottom: 27px; left: 14px; display: grid; height: 40px; place-items: center; border: 0; border-radius: 20px; padding: 0; background: #00ABB7; box-shadow: 0 1px 2px rgba(0, 123, 136, .16); color: white; font-size: 18px; font-weight: 400; line-height: 1; transition: filter 120ms ease, transform 120ms ease; }
        .products-reference .buy:active { filter: brightness(.93); transform: scale(.99); }
         .products-reference .my-card { min-height: 265px; height: auto; padding-bottom: 22px; }
         .products-reference .my-card .product-details { margin: 0; }
         .products-reference .my-card .product-picture { top: auto; }
        .products-reference .my-card .product-line { margin-top: 14px; }
        .products-reference .empty { display: flex; min-height: 260px; flex-direction: column; align-items: center; justify-content: center; border-radius: 9px; background: white; color: #777; }
        .products-reference .empty img { width: 150px; height: 150px; object-fit: contain; }
        @media (max-width: 360px) {
          .products-reference .products-header { height: 66px; }
          .products-reference .products-stats { height: 75px; }
          .products-reference .products-stat { padding-right: 15px; padding-left: 15px; }
          .products-reference .products-stat-value { font-size: 21px; }
          .products-reference .products-stat-label { font-size: 11px; }
           .products-reference .product-card { min-height: 225px; grid-template-columns: minmax(0, 34%) minmax(0, 1fr); column-gap: 12px; margin-right: 9px; margin-left: 9px; padding: 17px 10px 64px; }
          .products-reference .product-name { font-size: 16px; }
          .products-reference .product-price { margin-top: 12px; font-size: 14px; }
           .products-reference .product-line { grid-template-columns: minmax(0, 1fr) auto; gap: 5px; margin-top: 11px; font-size: 11px; }
          .products-reference .buy { right: 10px; bottom: 20px; left: 10px; height: 35px; font-size: 15px; }
        }
      `}</style>

      <div className="products-screen">
        <header className="products-header">
           <h1>Product center</h1>
        </header>
        <section className="products-stats" aria-label="Product summary">
          <button className="products-stat" onClick={() => setActiveTab("our")} data-testid="tab-our-products">
            <span className="products-stat-value">{activeProductCount}</span>
             <span className="products-stat-label">My products &gt;</span>
          </button>
          <button className="products-stat" onClick={() => setActiveTab("my")} data-testid="tab-my-product">
            <span className="products-stat-value">{formatStatAmount(totalUserEarnings)}</span>
            <span className="products-stat-label">My earnings &gt;</span>
          </button>
        </section>

        <div className="product-list">

        {/* ── OUR PRODUCTS tab ── */}
        {activeTab === "our" && (
          <div>
            {loadingProducts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#00ABB7]" />
              </div>
            ) : paidProducts.length === 0 ? (
              <div className="empty">
                 <img src={emptyIllustration} alt="No products" />
                <p>No products available</p>
              </div>
            ) : (
              paidProducts.map((product) => {
                return (
                  <div
                    key={product.id}
                    className="product-card"
                    data-testid={`product-card-${product.id}`}
                  >
                    <div className="product-picture">
                      <img src={getCompanyProductImage(product.id - 1)} alt={formatProductName(product)} />
                    </div>
                    <div className="product-details">
                      <p className="product-name">{formatProductName(product)}</p>
                       <p className="product-price">{formatCurrency(Number(product.price), user.country)}</p>
                      <p className="product-line"><span>Duration:</span><strong>{product.cycleDays} days</strong></p>
                       <p className="product-line"><span>Daily revenue:</span><strong>{formatCurrency(Number(product.dailyEarnings), user.country)}</strong></p>
                       <p className="product-line"><span>Total revenue:</span><strong>{formatCurrency(Number(product.totalReturn), user.country)}</strong></p>
                    </div>
                    <button onClick={() => setConfirmProduct(product)} className="buy" data-testid={`button-purchase-${product.id}`}>
                      BUY
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── MY PRODUCT tab ── */}
        {activeTab === "my" && (
          <div>
            <div>
              {loadingUserProducts ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#00ABB7]" />
                </div>
              ) : allUserProducts.length === 0 ? (
                <div className="empty">
                  <img src={emptyIllustration} alt="No products" />
                  <p>No TELD (Tcharging) products</p>
                  <p className="text-sm text-gray-400">Purchase products to start earning</p>
                </div>
              ) : (
                allUserProducts.map((up: any) => {
                  const cycleDays = up.product?.cycleDays || 60;
                  const daysRemaining = up.daysRemaining || 0;
                  const daysCompleted = Math.max(0, cycleDays - daysRemaining);
                  const earnedSoFar = parseFloat(up.totalEarned || "0");

                  return (
                    <div
                      key={up.id}
                      className="product-card my-card"
                      data-testid={`my-product-card-${up.id}`}
                    >
                      <div className="product-picture">
                        <img
                          src={getCompanyProductImage((up.productId || 1) - 1)}
                          alt={formatCompanyProductName(up.product?.name, up.productId)}
                        />
                      </div>
                      <div className="product-details">
                        <p className="product-name">{formatCompanyProductName(up.product?.name, up.productId)}</p>
                       <p className="product-price">{formatCurrency(Number(up.product?.price || 0), user.country)}</p>
                        <p className="product-line"><span>Days completed:</span><strong>{daysCompleted} / {cycleDays}</strong></p>
                         <p className="product-line"><span>Generated revenue:</span><strong>{formatCurrency(earnedSoFar, user.country)}</strong></p>
                         <p className="product-line"><span>Total revenue:</span><strong>{formatCurrency(Number(up.product?.totalReturn || 0), user.country)}</strong></p>
                        <p className="product-line"><span>Date :</span><strong>{formatPurchaseDate(up.purchasedAt)}</strong></p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Purchase confirm modal */}
      {confirmProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-8 bg-black/50"
          onClick={() => setConfirmProduct(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl overflow-hidden shadow-2xl bg-white"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Conseil
              </p>
              <p className="text-gray-800 font-semibold text-base leading-snug">
                Are you sure you want to purchase this product?
              </p>
              <p className="text-gray-500 text-sm mt-2 font-medium">
                {formatProductName(confirmProduct)}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-100" />

            {/* Buttons */}
            <div className="flex">
              <button
                onClick={() => setConfirmProduct(null)}
                className="flex-1 py-4 font-semibold text-base text-gray-500 active:bg-gray-50 transition-colors"
                style={{ borderRight: "1px solid #f0f0f0" }}
                data-testid="button-cancel-purchase"
              >
                Non
              </button>
              <button
                onClick={() => purchaseMutation.mutate(confirmProduct.id)}
                disabled={purchaseMutation.isPending}
                className="flex-1 py-4 font-bold text-base text-white flex items-center justify-center gap-1.5 active:opacity-90 transition-opacity disabled:opacity-60"
                style={{ background: "#00ABB7" }}
                data-testid="button-confirm-purchase"
              >
                {purchaseMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : "Yes"
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
