import React from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar role="ADMIN" />
      <div className="flex-1 ml-[240px] flex flex-col">
        <TopBar />
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto animate-spring-entrance">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
