import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient.js";
import { getAccess } from "../lib/access.js";
import { AuthContext } from "./authContext.js";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  const loadProfile = useCallback(async (userId, sessionUser = null) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setProfileError(error.message);
      setProfile(null);
      return;
    }

    if (data) {
      const metaName =
        sessionUser?.user_metadata?.full_name ||
        sessionUser?.user_metadata?.name;
      if (!data.full_name && metaName) {
        try {
          await supabase
            .from("profiles")
            .update({ full_name: metaName })
            .eq("id", userId);
          data.full_name = metaName;
        } catch {
          // Non-blocking
        }
      }
    }

    setProfileError("");
    setProfile(data);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id, data.session?.user);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession);
        await loadProfile(nextSession?.user?.id, nextSession?.user);
        setLoading(false);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email, password, fullName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    return { error };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    return { error };
  }, []);

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(() => {
    return loadProfile(session?.user?.id, session?.user);
  }, [loadProfile, session]);

  const value = {
    session,
    user: session?.user || null,
    profile,
    profileError,
    loading,
    isAdmin:
      (profile?.role === "admin" || profile?.role === "super_admin") &&
      !!profile?.is_approved,
    isApprovedStaff: profile?.role === "staff" && !!profile?.is_approved,
    canViewFinancials:
      !!profile?.is_approved &&
      (profile?.role === "admin" ||
        profile?.role === "super_admin" ||
        !!profile?.can_view_financials),
    access: getAccess(profile),
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}
