"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Mail, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const from = searchParams.get("from") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Welcome back!");
        window.location.href = from;
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass-card w-full max-w-md p-8 md:p-10"
      >
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f] mb-2">Montera</h1>
          <p className="text-[#86868b]">Sign in to manage your accounts</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#424245] flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="glass-input w-full px-4 py-3"
              placeholder="admin@montera.app"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#424245] flex items-center gap-2">
                <Lock className="w-4 h-4" /> Password
              </label>
              <a href="/reset-password" title="reset password" className="text-xs text-primary hover:underline">
                Forgot password?
              </a>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="glass-input w-full px-4 py-3"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="ios-blue-gradient w-full rounded-button py-3 font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-[#86868b]">
          &copy; {new Date().getFullYear()} Montera. All rights reserved.
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
