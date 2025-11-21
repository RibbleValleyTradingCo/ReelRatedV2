import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ProfileAvatarSection from "@/components/settings/ProfileAvatarSection";
import { isAdminUser } from "@/lib/admin";
import { Loader2, LogOut } from "lucide-react";
import { profileSchema, passwordChangeSchema, type ProfileFormData, type PasswordChangeFormData } from "@/schemas";

const PROFILE_STATUS_PLACEHOLDER = "Nothing here yet. Tell people what you fish for.";

const ProfileSettings = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Profile Form with Zod validation
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      bio: "",
    },
  });

  // Password Change Form with Zod validation
  const passwordForm = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const emailForm = useForm<{ newEmail: string; confirmEmail: string }>({
    defaultValues: {
      newEmail: "",
      confirmEmail: "",
    },
  });

  const [initialEmail, setInitialEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [initialAvatarPath, setInitialAvatarPath] = useState<string | null>(null);
  const [legacyAvatarUrl, setLegacyAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      setIsLoading(true);

      const [{ data: profileData, error: profileError }, { data: authData, error: authError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("username, full_name, avatar_path, avatar_url, bio")
            .eq("id", user.id)
            .maybeSingle(),
          supabase.auth.getUser(),
        ]);

      if (profileError || authError) {
        console.error("Failed to load profile settings", profileError ?? authError);
        toast.error("Unable to load profile settings.");
        setIsLoading(false);
        return;
      }

      const email = authData?.user?.email ?? "";
      setInitialEmail(email);

      const nextForm = {
        username: profileData?.username ?? user.user_metadata?.username ?? "",
        fullName: profileData?.full_name ?? user.user_metadata?.full_name ?? "",
        email,
        bio: profileData?.bio ?? user.user_metadata?.bio ?? "",
      };

      const storedPath = profileData?.avatar_path ?? null;
      const legacyUrl = profileData?.avatar_url ?? user.user_metadata?.avatar_url ?? null;

      profileForm.reset(nextForm);
      setAvatarPath(storedPath);
      setInitialAvatarPath(storedPath);
      setLegacyAvatarUrl(legacyUrl);
      setIsLoading(false);
    };

    if (user) {
      void loadProfile();
    }
  }, [profileForm, user]);

  const handleSaveProfile = async (data: ProfileFormData) => {
    if (!user) return;

    try {
      const updates = {
        username: data.username.trim(),
        full_name: data.fullName.trim() || null,
        avatar_path: avatarPath,
        bio: data.bio.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (updateProfileError) {
        throw updateProfileError;
      }

      setInitialAvatarPath(avatarPath ?? null);
      toast.success("Profile details saved successfully.");

      // Reset form to new values to clear dirty state
      profileForm.reset(data);
    } catch (error) {
      console.error("Failed to save profile", error);
      toast.error(error instanceof Error ? error.message : "Unable to save profile changes.");
    }
  };

  const handleUpdatePassword = async (data: PasswordChangeFormData) => {
    if (!user) return;

    try {
      const emailForAuth = initialEmail;
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: emailForAuth,
        password: data.currentPassword,
      });

      if (reauthError) {
        throw new Error("Current password is incorrect.");
      }

      const { error: passwordUpdateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (passwordUpdateError) {
        throw passwordUpdateError;
      }

      toast.success("Password updated successfully.");
      passwordForm.reset();
    } catch (error) {
      console.error("Failed to update password", error);
      toast.error(error instanceof Error ? error.message : "Unable to update password.");
    }
  };

  const handleEmailChange = async ({ newEmail, confirmEmail }: { newEmail: string; confirmEmail: string }) => {
    if (!user) return;

    const trimmedNewEmail = newEmail.trim();
    const trimmedConfirmEmail = confirmEmail.trim();

    if (!trimmedNewEmail) {
      toast.error("Please enter a new email address.");
      return;
    }

    if (trimmedNewEmail !== trimmedConfirmEmail) {
      toast.error("Email addresses do not match.");
      return;
    }

    const normalizedCurrentEmail = initialEmail.trim().toLowerCase();
    if (trimmedNewEmail.toLowerCase() === normalizedCurrentEmail) {
      toast.error("That’s already your current email.");
      return;
    }

    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/auth?fromEmailChange=true` : undefined;
      const { error } = await supabase.auth.updateUser(
        { email: trimmedNewEmail },
        redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      );

      if (error) {
        throw error;
      }

      toast.success("Check your inbox to confirm the new email address.");
      emailForm.reset({
        newEmail: "",
        confirmEmail: "",
      });
    } catch (error) {
      console.error("Failed to change email", error);
      toast.error(error instanceof Error ? error.message : "Unable to change email.");
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Failed to sign out. Please try again.");
      return;
    }
    toast.success("Signed out");
    navigate("/auth");
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="container mx-auto flex items-center justify-center px-4 py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading profile settings…
        </div>
      </div>
    );
  }

  const isAdmin = isAdminUser(user?.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
        <div className="space-y-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900">Profile settings</h1>
              {isAdmin && <Badge variant="secondary">Admin</Badge>}
            </div>
            <p className="text-sm text-slate-600">Manage your account, avatar and security.</p>
          </div>

          {user && (
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
                <CardTitle className="text-lg">Avatar</CardTitle>
                <p className="text-sm text-slate-600">Upload a photo so other anglers can recognise you.</p>
              </CardHeader>
              <CardContent className="px-5 pb-5 md:px-8 md:pb-8">
                <ProfileAvatarSection
                  userId={user.id}
                  username={profileForm.watch("username") || user.user_metadata?.username || user.email || "Angler"}
                  avatarPath={avatarPath}
                  legacyAvatarUrl={legacyAvatarUrl}
                  onAvatarChange={(path) => {
                    setAvatarPath(path);
                    if (path) {
                      setLegacyAvatarUrl(null);
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}

          <form className="space-y-8" onSubmit={profileForm.handleSubmit(handleSaveProfile)}>
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
                <CardTitle className="text-lg">Account</CardTitle>
                <p className="text-sm text-slate-600">Keep your public profile and contact details up to date.</p>
              </CardHeader>
              <CardContent className="space-y-6 px-5 pb-5 md:px-8 md:pb-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <p className="text-xs text-slate-500">Unique handle anglers will see on your posts.</p>
                    </div>
                    <Input
                      id="username"
                      {...profileForm.register("username")}
                      placeholder="angling_legend"
                      aria-invalid={!!profileForm.formState.errors.username}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                    {profileForm.formState.errors.username && (
                      <p className="text-sm text-red-600">
                        {profileForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="fullName">Full name</Label>
                      <p className="text-xs text-slate-500">Optional. Share your real name with the community.</p>
                    </div>
                    <Input
                      id="fullName"
                      {...profileForm.register("fullName")}
                      placeholder="Alex Rivers"
                      aria-invalid={!!profileForm.formState.errors.fullName}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                    {profileForm.formState.errors.fullName && (
                      <p className="text-sm text-red-600">
                        {profileForm.formState.errors.fullName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <p className="text-xs text-slate-500">We&apos;ll send a verification link if you change this.</p>
                    </div>
                    <Input
                      id="email"
                      type="email"
                      {...profileForm.register("email")}
                      placeholder="angler@example.com"
                      aria-invalid={!!profileForm.formState.errors.email}
                      readOnly
                      disabled
                      className="mt-1 w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 text-slate-500"
                    />
                    {profileForm.formState.errors.email && (
                      <p className="text-sm text-red-600">
                        {profileForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="bio">Bio / status</Label>
                    <p className="text-xs text-slate-500">Tell anglers what you fish for or share a quick update.</p>
                  </div>
                  <Textarea
                    id="bio"
                    {...profileForm.register("bio")}
                    placeholder={PROFILE_STATUS_PLACEHOLDER}
                    rows={4}
                    aria-invalid={!!profileForm.formState.errors.bio}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                  />
                  {profileForm.formState.errors.bio && (
                    <p className="text-sm text-red-600">
                      {profileForm.formState.errors.bio.message}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
              <div className="text-xs text-slate-500 md:order-1">
                Changes take effect immediately after saving.
              </div>
              <Button
                type="submit"
                disabled={profileForm.formState.isSubmitting || (!profileForm.formState.isDirty && avatarPath === initialAvatarPath)}
                className="order-2 h-11 w-full bg-sky-600 text-white hover:bg-sky-700 md:w-auto"
              >
                {profileForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>

          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
              <CardTitle className="text-lg">Change email</CardTitle>
              <p className="text-sm text-slate-600">
                Current email: <span className="font-medium">{initialEmail || "Not set"}</span>. Updates require a
                verification link.
              </p>
            </CardHeader>
            <CardContent className="space-y-6 px-5 pb-5 md:px-8 md:pb-8">
              <form className="space-y-4" onSubmit={emailForm.handleSubmit(handleEmailChange)}>
                <div className="space-y-2">
                  <Label htmlFor="newEmail">New email address</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    placeholder="angler+new@example.com"
                    {...emailForm.register("newEmail")}
                    aria-invalid={!!emailForm.formState.errors?.newEmail}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmEmail">Confirm new email</Label>
                  <Input
                    id="confirmEmail"
                    type="email"
                    placeholder="Repeat the new email"
                    {...emailForm.register("confirmEmail")}
                    aria-invalid={!!emailForm.formState.errors?.confirmEmail}
                  />
                </div>
                <Button type="submit" disabled={emailForm.formState.isSubmitting}>
                  {emailForm.formState.isSubmitting ? "Sending confirmation…" : "Send verification email"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <form onSubmit={passwordForm.handleSubmit(handleUpdatePassword)} className="space-y-6">
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
                <CardTitle className="text-lg">Security</CardTitle>
                <p className="text-sm text-slate-600">Update your password to keep your account secure.</p>
              </CardHeader>
              <CardContent className="space-y-6 px-5 pb-5 md:px-8 md:pb-8">
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
                  Use at least 8 characters with a mix of letters, numbers, or symbols for your new password.
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="currentPassword">Current password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      {...passwordForm.register("currentPassword")}
                      placeholder="••••••••"
                      aria-invalid={!!passwordForm.formState.errors.currentPassword}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-sm text-red-600">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      {...passwordForm.register("newPassword")}
                      placeholder="••••••••"
                      aria-invalid={!!passwordForm.formState.errors.newPassword}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-sm text-red-600">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      {...passwordForm.register("confirmPassword")}
                      placeholder="••••••••"
                      aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-600">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={passwordForm.formState.isSubmitting} className="h-11 w-full bg-sky-600 text-white hover:bg-sky-700 md:w-auto">
                    {passwordForm.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          <Card className="rounded-xl border border-red-200 bg-red-50/70 shadow-none">
            <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
              <CardTitle className="text-base font-semibold text-red-600">Danger zone</CardTitle>
              <p className="text-sm text-red-600/80">Sign out safely or prepare to delete your account (coming soon).</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-5 pb-5 md:flex-row md:items-center md:justify-between md:px-8 md:pb-8">
              <p className="text-sm text-red-600/80 md:max-w-md">
                Leaving the session? Sign out to keep your catches and messages secure.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="destructive" className="h-11 min-w-[140px]" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
                <Button variant="outline" disabled className="h-11 border-red-300 text-red-500">
                  Delete account (coming soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
