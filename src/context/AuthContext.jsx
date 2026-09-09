import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient.js";
import { getAccess } from "../lib/access.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  const loadProfile = useCallback(async (userId) => {
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

    setProfileError("");
    setProfile(data);
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession);
        await loadProfile(nextSession?.user?.id);
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

  // Used by the forced-password-change screen (profile.must_change_password
  // — see finding M6). Sets the new password, then clears the flag via a
  // narrow SECURITY DEFINER function (never a direct profile update — see
  // migration 10's comment for why) so the rest of the app unlocks.
  const changePassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error };
    const { error: rpcError } = await supabase.rpc("clear_my_must_change_password");
    if (rpcError) return { error: rpcError };
    await loadProfile(session?.user?.id);
    return { error: null };
  }, [loadProfile, session]);

  const refreshProfile = useCallback(() => {
    return loadProfile(session?.user?.id);
  }, [loadProfile, session]);

  const value = {
    session,
    user: session?.user || null,
    profile,
    profileError,
    loading,
    isAdmin: profile?.role === "admin" && profile?.is_approved,
    isApprovedStaff: profile?.role === "staff" && profile?.is_approved,
    canViewFinancials:
      !!profile?.is_approved &&
      (profile?.role === "admin" || !!profile?.can_view_financials),
    access: getAccess(profile),
    signIn,
    signUp,
    signInWithGoogle,
    resetPassword,
    changePassword,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
