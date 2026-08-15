"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({
  presentation = "default",
}: {
  presentation?: "default" | "menu";
}) {
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
        variant={presentation === "menu" ? "ghost" : "outline"}
        size="sm"
        className={cn(presentation === "menu" && "w-full justify-start")}
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
