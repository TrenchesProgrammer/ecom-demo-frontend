"use client";

import { useEffect, useState, useRef } from "react";

interface Product {
  productId: string;
  name: string;
  stock: number;
}

interface Transaction {
  id: string;
  user: string;
  productId: string;
  quantity?: number;
  productName?: string;
  createdAt: Date | string;
}

const BASE_URL = "https://ecom-demo-backend.vercel.app";

function getApiUrl(path: string) {
  if (!BASE_URL) {
    throw new Error("NEXT_BASE_URL is not configured");
  }
  return `${BASE_URL.replace(/\/+$/, "")}${path}`;
}

interface ProductCardProps {
  product: Product;
  buyLoading: boolean;
  onBuy: (productId: string, quantity: number) => void;
}

function ProductCard({ product, buyLoading, onBuy }: ProductCardProps) {
  const [quantity, setQuantity] = useState<number>(1);

  return (
    <div className="flex items-center justify-between p-3 border rounded bg-gray-50">
      <div>
        <h3 className="font-medium text-gray-900">{product.name}</h3>
        <p className="text-sm text-gray-600">
          Stock: <span className="font-semibold">{product.stock}</span>
        </p>
      </div>

      <div className="flex items-center">
        <button
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          className="px-3 py-1 border rounded-l bg-gray-200 hover:bg-gray-300"
        >
          -
        </button>
        <span className="px-3 py-1 border-t border-b bg-gray-100 min-w-[2.5rem] text-center">
          {quantity}
        </span>
        <button
          onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
          className="px-3 py-1 border rounded-r bg-gray-200 hover:bg-gray-300"
        >
          +
        </button>
      </div>

      <button
        id={`btn-buy-${product.productId}`}
        onClick={() => onBuy(product.productId, quantity)}
        disabled={buyLoading || product.stock <= 0}
        className={`px-4 py-2 rounded font-medium text-white transition ${
          product.stock <= 0
            ? "bg-gray-400 cursor-not-allowed"
            : buyLoading
            ? "bg-blue-400 cursor-wait"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {buyLoading
          ? "Buying..."
          : product.stock <= 0
          ? "Out of Stock"
          : "Buy"}
      </button>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyLoading, setBuyLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [guestId, setGuestId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("storedId");
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `guest-${Date.now()}`;
      localStorage.setItem("storedId", id);
    }
    setGuestId(id);
  }, []);

  const fetchProductById = async (id: string): Promise<Product | null> => {
    try {
      const res = await fetch(getApiUrl(`/api/products/${id}`));
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    } catch {
      return null;
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/products"));

      if (!res.ok) {
        throw new Error(`Failed to fetch products (Status: ${res.status})`);
      }

      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data ? [data] : [];
      
      const normalizedProducts: Product[] = rawList.map((item, index) => ({
        ...item,
        productId: item?.productId ?? item?.id ?? `prod-${index}`,
      }));
      
      setProducts(normalizedProducts);
    } catch (err: any) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (activeGuestId?: string) => {
    const idToUse = activeGuestId || guestId;
    if (!idToUse) return;

    setTxLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/transactions"), {
        method: "GET",
        headers: { "guest-id": idToUse },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch transactions (Status: ${res.status})`);
      }

      const json = await res.json();
      
      const targetData = json?.data?.transactions ? json.data.transactions : json;
      const rawList = Array.isArray(targetData) ? targetData : targetData ? [targetData] : [];

      const enrichedTransactions: Transaction[] = await Promise.all(
        rawList.map(async (item, index) => {
          const productId = item.productId || item.product_id || "";
          const txId = item.id || `tx-${index}`;
          const qty = item.quantity ?? item.qty ?? 1;
          let productName = "Unknown Product";

          if (productId) {
            const localProduct = products.find((p) => String(p.productId) === String(productId));
            
            if (localProduct) {
              productName = localProduct.name;
            } else {
              const fetchedProduct = await fetchProductById(productId);
              if (fetchedProduct?.name) {
                productName = fetchedProduct.name;
              }
            }
          }

          return {
            ...item,
            id: txId,
            productId,
            productName,
            quantity: qty,
          };
        })
      );

      setTransactions(enrichedTransactions);
    } catch (err: any) {
      setError(err.message || "Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (guestId) {
      fetchTransactions(guestId);
    }
  }, [guestId]);

  const idempotencyKeyRef = useRef<string | null>(null);

  const handleBuy = async (productId: string, quantity: number) => {
    setBuyLoading(true);
    setMessage(null);
    setError(null);

    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = typeof crypto !== "undefined" && crypto.randomUUID 
          ? crypto.randomUUID() 
          : `fallback-id-${Date.now()}`;
      }

      const res = await fetch(getApiUrl("/api/buy"), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKeyRef.current,
          "guest-id": guestId 
        },
        body: JSON.stringify({ productId, quantity }), 
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};

      idempotencyKeyRef.current = null;

      if (res.ok && data.success !== false) {
        setMessage(data.message || "Purchase successful!");
      } else {
        setError(data.message || "Purchase failed");
      }
      
      fetchProducts();
      fetchTransactions(guestId);
    } catch (err: any) {
      console.error(err);
      setError("Network error. Click Buy again to retry safely.");
    } finally {
      setBuyLoading(false);
    }
  };

  return (
    <main className="max-w-xl mx-auto p-6 font-sans space-y-6">
      <h1 className="text-2xl font-bold">Ecom Demo</h1>

      {/* Messages */}
      {message && (
        <div className="p-3 bg-green-100 border border-green-300 text-green-800 rounded">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded">
          {error}
        </div>
      )}

      {/* Products list */}
      <div className="border rounded-lg p-5 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Products</h2>

        {loading ? (
          <p className="text-gray-500">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="text-gray-500">No products available.</p>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <ProductCard
                key={product.productId}
                product={product}
                buyLoading={buyLoading}
                onBuy={handleBuy}
              />
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t flex justify-end">
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="text-sm text-blue-600 hover:underline"
          >
            Refresh Products
          </button>
        </div>
      </div>

      {/* Transactions list */}
      <div className="border rounded-lg p-5 bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Your Transactions</h2>

        {txLoading ? (
          <p className="text-gray-500">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="text-gray-500">No transactions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-3 border rounded bg-gray-50 text-sm flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">
                    {tx.productName}{" "}
                    <span className="text-gray-500 font-normal">
                      (Qty: {tx.quantity ?? 1})
                    </span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Product ID: {tx.productId} | Tx ID: {tx.id}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}