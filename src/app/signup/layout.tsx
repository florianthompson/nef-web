"use client";

import { AuthProvider } from "@/lib/auth";
import { Suspense } from "react";

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <Suspense>{children}</Suspense>
    </AuthProvider>
  );
}
