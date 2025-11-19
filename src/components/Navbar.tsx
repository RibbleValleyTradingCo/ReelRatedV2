import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Menu, Search as SearchIcon, X } from "lucide-react";
import { toast } from "sonner";
import { NotificationsBell } from "@/components/NotificationsBell";
import { isAdminUser } from "@/lib/admin";
import LogoMark from "@/components/LogoMark";
import { MobileMenu, MOBILE_MENU_ID } from "@/components/MobileMenu";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from "@/lib/storage";
import { getProfilePath } from "@/lib/profile";

export const Navbar = () => {
  const { user, isAuthReady, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const isOnSearchRoute = location.pathname.startsWith("/search");

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;

    if (!user) {
      setProfileUsername(null);
      setAvatarPath(null);
      setAvatarUrl(null);
      setIsAdmin(false);
      return () => {
        active = false;
      };
    }

    const fetchProfileAndAdmin = async () => {
      try {
        const [{ data, error }] = await Promise.all([
          supabase
            .from("profiles")
            .select("username, avatar_path, avatar_url")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        if (active) {
          if (error) {
            console.error("Failed to load profile details", error);
          }
          setProfileUsername(data?.username ?? user.user_metadata?.username ?? null);
          setAvatarPath(data?.avatar_path ?? null);
          setAvatarUrl(data?.avatar_url ?? null);
        }
      } catch (error) {
        console.error("Failed to fetch profile", error);
      }

      try {
        const adminStatus = await isAdminUser(user.id);
        if (active) {
          setIsAdmin(adminStatus);
        }
      } catch (error) {
        console.error("Failed to determine admin status", error);
        if (active) {
          setIsAdmin(false);
        }
      }
    };

    void fetchProfileAndAdmin();

    return () => {
      active = false;
    };
  }, [user]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Failed to sign out. Please try again.");
      return;
    }
    toast.success("Signed out successfully");
    navigate("/");
    setMenuOpen(false);
  };

  const handleSearchToggle = () => {
    if (isOnSearchRoute) {
      navigate(-1);
    } else {
      navigate("/search");
    }
  };

  const navLinks = useMemo(
    () => [
      { label: "Feed", href: "/feed" },
      { label: "Leaderboard", href: "/leaderboard" },
      { label: "Sessions", href: "/sessions" },
      { label: "Explore", href: "/search" },
    ],
    [],
  );

  const iconButtonBase =
    "group inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white md:h-11 md:w-11";
  const iconSvgBase =
    "h-5 w-5 text-slate-600 transition-colors group-hover:text-primary md:h-6 md:w-6";

  const avatarDisplayName =
    profileUsername ?? user?.user_metadata?.username ?? user?.email ?? user?.user_metadata?.full_name ?? "";

  const profileLink =
    user != null ? getProfilePath({ username: profileUsername ?? undefined, id: user.id }) : "/profile";

  const resolvedAvatarUrl = resolveAvatarUrl({ path: avatarPath, legacyUrl: avatarUrl });

  const renderAuthIcons = () => (
    <div className="flex items-center gap-3 md:gap-4">
      <button
        type="button"
        className={cn(iconButtonBase, "hidden sm:inline-flex")}
        aria-label={isOnSearchRoute ? "Close search" : "Open search"}
        onClick={handleSearchToggle}
      >
        {isOnSearchRoute ? (
          <X className={iconSvgBase} />
        ) : (
          <SearchIcon className={iconSvgBase} />
        )}
      </button>

      <NotificationsBell />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Account menu"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={resolvedAvatarUrl ?? undefined} alt={avatarDisplayName || "Profile"} />
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {avatarDisplayName
                  .split(" ")
                  .map((segment) => segment.charAt(0))
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "RR"}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[220px]">
          <DropdownMenuLabel>
            Signed in as
            <span className="block text-sm font-semibold text-foreground">{avatarDisplayName || "Angler"}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate(profileLink)}>
            View profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/settings/profile")}>
            Profile settings
          </DropdownMenuItem>
          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Admin</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => navigate("/admin/reports")}>Admin reports</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/admin/audit-log")}>Audit log</DropdownMenuItem>
            </>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              void handleSignOut();
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        className={cn(
          iconButtonBase,
          "border border-slate-200 hover:bg-slate-100 aria-expanded:shadow-inner",
        )}
        aria-controls={MOBILE_MENU_ID}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        aria-label="Toggle navigation menu"
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        {menuOpen ? <X className={iconSvgBase} /> : <Menu className={iconSvgBase} />}
      </button>
    </div>
  );

  const renderGuestActions = () => (
    <div className="flex items-center gap-3 md:gap-4">
      <Button
        asChild
        size="sm"
        variant="ocean"
        className="px-4 py-2 shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <Link to="/auth#signup">Sign Up</Link>
      </Button>
      <Link
        to="/auth"
        className="text-sm font-semibold text-slate-600 transition-colors hover:text-primary"
      >
        Log In
      </Link>
    </div>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4 md:h-[72px]">
          <Link to="/" className="group flex items-center gap-3">
            <LogoMark className="h-10 w-10 md:h-11 md:w-11 transition-transform duration-200 hover:scale-105" />
            <div className="leading-tight">
              <span className="block text-lg font-semibold text-slate-900 transition-colors group-hover:text-primary md:text-xl">
                ReelyRated
              </span>
              <span className="hidden text-[11px] uppercase tracking-[0.32em] text-slate-500 md:block">
                Freshwater Social
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "text-sm font-medium text-slate-600 transition-colors hover:text-primary",
                    isActive && "text-primary",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {!isAuthReady ? null : user ? renderAuthIcons() : renderGuestActions()}
        </div>
      </div>

      {user ? (
        <MobileMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          user={{
            id: user.id,
            username: profileUsername ?? user.user_metadata?.username ?? null,
          }}
          isAdmin={isAdmin}
          onSignOut={handleSignOut}
        />
      ) : null}
    </header>
  );
};

export default Navbar;
