import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock the Supabase client before importing ProtectedRoute.
const mockGetSession = vi.fn();
const mockHasRole = vi.fn();
let authCallback: ((event: string, session: any) => void) | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: (event: string, session: any) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
    rpc: (..._args: any[]) => mockHasRole(),
  },
}));

import ProtectedRoute from "@/components/ProtectedRoute";

function renderAt(adminOnly = false, initial = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute adminOnly={adminOnly}>
              <div>Protected!</div>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/check-email" element={<div>Check Email Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Free-browsing model: any signed-in user with a confirmed email may view the
// portal; only admin routes do an extra role check.
const sessionFor = (userId = "user-1", confirmed = true) => ({
  data: {
    session: {
      user: {
        id: userId,
        email_confirmed_at: confirmed ? "2026-01-01T00:00:00Z" : null,
      },
    },
  },
});

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockHasRole.mockReset();
    authCallback = null;
  });

  it("redirects to /login when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    renderAt();
    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("redirects to /check-email when the email is not confirmed", async () => {
    mockGetSession.mockResolvedValue(sessionFor("user-1", false));
    renderAt();
    expect(await screen.findByText("Check Email Page")).toBeInTheDocument();
  });

  it("renders children for any confirmed user (no membership required)", async () => {
    mockGetSession.mockResolvedValue(sessionFor());
    renderAt();
    expect(await screen.findByText("Protected!")).toBeInTheDocument();
    // Non-admin routes must not spend a round trip on has_role.
    expect(mockHasRole).not.toHaveBeenCalled();
  });

  it("renders children on an admin route for an admin", async () => {
    mockGetSession.mockResolvedValue(sessionFor());
    mockHasRole.mockResolvedValue({ data: true });
    renderAt(true);
    expect(await screen.findByText("Protected!")).toBeInTheDocument();
  });

  it("redirects non-admins away from an admin route", async () => {
    mockGetSession.mockResolvedValue(sessionFor());
    mockHasRole.mockResolvedValue({ data: false });
    renderAt(true);
    expect(await screen.findByText("Home Page")).toBeInTheDocument();
  });

  it("keeps rendering children on TOKEN_REFRESHED (tab refocus)", async () => {
    mockGetSession.mockResolvedValue(sessionFor());
    renderAt();
    expect(await screen.findByText("Protected!")).toBeInTheDocument();

    await act(async () => {
      authCallback?.("TOKEN_REFRESHED", { user: { id: "user-1" } });
    });
    expect(screen.getByText("Protected!")).toBeInTheDocument();

    // A repeated SIGNED_IN for the same user is also a no-op.
    await act(async () => {
      authCallback?.("SIGNED_IN", { user: { id: "user-1" } });
    });
    expect(screen.getByText("Protected!")).toBeInTheDocument();
  });

  it("redirects to /login on SIGNED_OUT", async () => {
    mockGetSession.mockResolvedValue(sessionFor());
    renderAt();
    expect(await screen.findByText("Protected!")).toBeInTheDocument();

    await act(async () => {
      authCallback?.("SIGNED_OUT", null);
    });
    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });
});
