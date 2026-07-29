"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";

// Lightweight signed-in check for pages outside the AuthProvider (e.g. the
// marketing homepage). Returns null while the session is still resolving.
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSignedIn(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return signedIn;
}
