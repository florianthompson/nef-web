"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";

type UserProfile = {
  firstName: string;
  lastName: string;
  role: "admin" | "member";
  teamId: string;
};

type AuthContextType = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (!user) return;

    supabase
      .from("users")
      .select("first_name, last_name, role, team_id")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setProfile({
            firstName: data.first_name,
            lastName: data.last_name,
            role: data.role as "admin" | "member",
            teamId: data.team_id,
          });
        }
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (loading) return;
    const publicPaths = ["/login", "/signup"];
    const isPublic = publicPaths.some((p) => pathname.startsWith(p));
    if (!user && !isPublic) {
      router.replace("/login");
    }
  }, [loading, user, pathname, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
