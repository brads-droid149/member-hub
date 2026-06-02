import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock the Supabase client before importing ProtectedRoute.
const mockGetSession = vi.fn();
const mockHasRole = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    rpc: (..._args: any[]) => mockHasRole(),
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => mockMaybeSingle(),
        }),
      }),
    }),
  },
}));

import ProtectedRoute from "@/components/ProtectedRoute";

function renderAt(initial = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>Protected!</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/subscribe" element={<div>Subscribe Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const sessionFor = (userId = "user-1") => ({
  data: { session: { user: { id: userId } } },
});

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockHasRole.mockReset();
    mockMaybeSingle.mockReset();
  });

  it("redirects to /login when there is no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    renderAt();
    expect(await screen.findByText("Login Page")).toBeInTheDocument();
  });

  it("redirects to /subscribe when session exists but no membership", async () => {
    mockGetSession.mockResolvedValue(sessionFor());
    mockHasRole.mockResolvedValue({ data: false });
    mockMaybeSingle.mockResolvedValue({ data: null });
    renderAt();
    expect(await screen.findByText("Subscribe Page")).toBeInTheDocument();
  });

  it("renders children for active member", async () => {
    mockGetSession.mockResolvedValue(sessionFor());
    mockHasRole.mockResolvedValue({ data: false });
    mockMaybeSingle.mockResolvedValue({ data: { id: "m1", status: "active" } });
    renderAt();
    expect(await screen.findByText("Protected!")).toBeInTheDocument();
  });

  it("renders children for past_due member (dunning grace period)", async () => {
    mockGetSession.mockResolvedValue(sessionFor());
    mockHasRole.mockResolvedValue({ data: false });
    mockMaybeSingle.mockResolvedValue({ data: { id: "m1", status: "past_due" } });
    renderAt();
    expect(await screen.findByText("Protected!")).toBeInTheDocument();
  });

  it("renders children for admin even without membership", async () => {
    mockGetSession.mockResolvedValue(sessionFor());
    mockHasRole.mockResolvedValue({ data: true });
    mockMaybeSingle.mockResolvedValue({ data: null });
    renderAt();
    expect(await screen.findByText("Protected!")).toBeInTheDocument();
  });
});
