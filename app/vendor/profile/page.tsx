"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { 
  Loader2, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Building2, 
  CreditCard,
  Edit,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export default function VendorProfilePage() {
  const { data: session } = useSession();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const vendorId = (session?.user as any)?.vendorId;
    if (vendorId) {
      fetch(`/api/vendors/${vendorId}`)
        .then(res => res.json())
        .then(data => {
          setVendor(data);
          setLoading(false);
        })
        .catch(() => {
          toast.error("Failed to load profile");
          setLoading(false);
        });
    } else if (session) {
      setLoading(false);
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-[#86868b]">Securing your profile data...</p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
        <User className="w-16 h-16 text-[#86868b]/20" />
        <h2 className="text-xl font-bold text-[#1d1d1f]">Profile Not Found</h2>
        <p className="text-[#86868b] max-w-xs">Your vendor account details could not be retrieved at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">My Profile</h1>
          <p className="text-[#86868b] mt-1">Manage your account settings and banking information.</p>
        </div>
        <div className="ml-auto">
          <Button className="glass-button text-[#1d1d1f] border-black/5" onClick={() => toast("Profile editing is managed by Admin")}>
            <Edit className="w-4 h-4 mr-2" /> Request Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-8 space-y-8">
          <div className="flex items-center gap-5 border-b border-black/5 pb-8">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10 shadow-sm">
              <Building2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="font-bold text-[#1d1d1f] text-2xl">{vendor.name}</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-ios-green/10 text-ios-green text-[10px] uppercase font-bold border border-ios-green/10 mt-2">
                Active Account
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-[#86868b]" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">Email Address</p>
                <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">{vendor.email}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4 text-[#86868b]" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">Phone Number</p>
                <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5">{vendor.phone || "Not provided"}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-[#86868b]" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">Office Address</p>
                <p className="text-sm font-semibold text-[#1d1d1f] mt-0.5 leading-relaxed">{vendor.address || "Not provided"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="glass-card p-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#86868b] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Banking Settlement Detail
            </h3>
            
            <div className="p-5 rounded-2xl bg-black/5 border border-black/5 space-y-4">
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">Bank Name</p>
                <p className="text-md font-bold text-[#1d1d1f] mt-0.5">{vendor.bankName || "Unknown"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">Account Number</p>
                <p className="text-md font-mono font-bold text-[#1d1d1f] mt-0.5">{vendor.accountNumber || "XXXX-XXXX-XXXX"}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">IFSC Code</p>
                <p className="text-md font-mono font-bold text-primary mt-0.5">{vendor.ifsc || "XXXX0000000"}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-black/5">
               <div className="flex items-center gap-3">
                 <ShieldCheck className="w-5 h-5 text-ios-green" />
                 <div>
                   <p className="text-[10px] uppercase font-bold text-[#86868b] tracking-widest">Tax Identity (GSTIN)</p>
                   <p className="text-sm font-mono font-bold text-[#1d1d1f] mt-0.5">{vendor.gstin || "Not Registered"}</p>
                 </div>
               </div>
            </div>
          </div>

          <div className="glass-card p-6 border-primary/10">
             <h4 className="text-xs font-bold text-[#1d1d1f] mb-2">Account Security</h4>
             <p className="text-xs text-[#86868b] mb-4">To update your password or profile information, please contact your account administrator.</p>
             <Button variant="outline" className="w-full glass-button border-black/5 text-[#1d1d1f] text-xs h-10">
                Contact Admin
             </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
