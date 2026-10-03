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

const PROFILE_COLUMNS = "first_name, last_name, role, team_id";
type ProfileRow = { first_name: string; last_name: string; role: string; team_id: string };

function toProfile(row: ProfileRow): UserProfile {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role as "admin" | "member",
    teamId: row.team_id,
  };
}

// The login page already reads the profile row to pick the landing page. Handing it over
// saves the provider the same query right after the redirect.
let primed: { userId: string; row: ProfileRow } | null = null;

export async function fetchProfileForLogin(userId: string): Promise<ProfileRow | null> {
  const { data } = await supabase
    .from("users")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();
  if (data) primed = { userId, row: data as ProfileRow };
  return (data as ProfileRow | null) ?? null;
}

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
    // Keep the same user object when the id is unchanged, so token refreshes and the
    // repeated session events do not re-trigger the profile and page loads.
    const sameUser = (next: User | null) => (prev: User | null) =>
      prev && next && prev.id === next.id ? prev : next;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(sameUser(session?.user ?? null));
      if (!session?.user) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(sameUser(session?.user ?? null));
      if (!session?.user) {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile when user changes
  useEffect(() => {
    if (!user) return;

    const hit = primed && primed.userId === user.id ? primed.row : null;
    primed = null;
    if (hit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(toProfile(hit));
      setLoading(false);
      return;
    }

    supabase
      .from("users")
      .select(PROFILE_COLUMNS)
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setProfile(toProfile(data as ProfileRow));
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
