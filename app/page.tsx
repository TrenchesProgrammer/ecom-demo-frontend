"use client";
// import dotenv from "dotenv";
// dotenv.config();


import { useEffect, useState, useRef } from "react";

interface Product {
  id: string | number;
  name: string;
  stock: number;
}

const BASE_URL = process.env.NEXT_BASE_URL;

function getApiUrl(path: string) {
  if (!BASE_URL) {
    throw new Error("NEXT_BASE_URL is not configured");
  }
  return `${BASE_URL.replace(/\/+$/, "")}${path}`;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyLoading, setBuyLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch products from GET /api/products
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl("/api/products"));

      if (!res.ok) {
        throw new Error(`Failed to fetch products (Status: ${res.status})`);
      }

      const data = await res.json();
      // Handle single product object or list of products
      if (Array.isArray(data)) {
        setProducts(data);
      } else if (data && typeof data === "object") {
        setProducts([data]);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);


  // inside the component
  const idempotencyKeyRef = useRef<string | null>(null);

  const handleBuy = async () => {
    setBuyLoading(true);
    setMessage(null);
    setError(null);

    // Reuse the existing key if the last attempt never got an answer
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    try {
      const res = await fetch(getApiUrl("/api/buy"), {
        method: "POST",
        headers: { "idempotency-key": idempotencyKeyRef.current },
      });

      const data = await res.json();

      // We got a definitive answer from the server, so this attempt is over
      idempotencyKeyRef.current = null;

      if (res.ok && data.success) {
        setMessage(data.message || "Purchase successful!");
      } else {
        setError(data.message || "Purchase failed");
      }
      fetchProducts();
    } catch (err: any) {
      // Network error: we don't know if the server processed it.
      // Keep the key so the next click is a safe retry.
      setError("Network error. Click Buy again to retry safely.");
    } finally {
      setBuyLoading(false);
    }
  };
  return (
    <main className="max-w-xl mx-auto p-6 font-sans">
      <h1 className="text-2xl font-bold mb-4">Ecom Demo</h1>

      {/* Messages */}
      {message && (
        <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded">
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
              <div
                key={product.id}
                className="flex items-center justify-between p-3 border rounded bg-gray-50"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{product.name}</h3>
                  <p className="text-sm text-gray-600">
                    Stock: <span className="font-semibold">{product.stock}</span>
                  </p>
                </div>

                <button
                  id={`btn-buy-${product.id}`}
                  onClick={handleBuy}
                  disabled={buyLoading || product.stock <= 0}
                  className={`px-4 py-2 rounded font-medium text-white transition ${product.stock <= 0
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
    </main>
  );
}
