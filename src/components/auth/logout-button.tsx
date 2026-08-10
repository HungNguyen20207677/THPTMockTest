"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      await signOut({ redirectTo: "/login" });
    } catch {
      setSignOutError("Không thể đăng xuất. Vui lòng thử lại.");
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isSigningOut}
        onClick={() => void handleSignOut()}
      >
        {isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}
      </Button>
      {signOutError && (
        <p role="alert" className="text-destructive text-xs">
          {signOutError}
        </p>
      )}
    </div>
  );
}
