import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createMockSupabaseClient } from "./test-utils.js";

const { mockGetUser, mockFromResults, mockRpcResults } = vi.hoisted(() => {
  return {
    mockGetUser: vi.fn(),
    mockFromResults: {},
    mockRpcResults: {}
  };
});

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      constructor() {
        this.chat = { completions: { create: vi.fn() } };
      }
    }
  };
});

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() =>
      createMockSupabaseClient({
        getUser: mockGetUser,
        fromResults: mockFromResults,
        rpcResults: mockRpcResults
      })
    )
  };
});

process.env.AZURE_OPENAI_API_KEY = "test-key";
process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com";
process.env.AZURE_OPENAI_DEPLOYMENT_NAME = "test-deployment";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";

// The organizations router requires auth on every route, so exercising
// it through the full app (rather than mounting the router in isolation)
// keeps these tests close to how real requests actually flow.
const { default: app } = await import("./server.js");

function resetMockResults() {
  for (const key of Object.keys(mockFromResults)) {
    delete mockFromResults[key];
  }
  for (const key of Object.keys(mockRpcResults)) {
    delete mockRpcResults[key];
  }
}

function authAsUser(userId = "user-123") {
  mockGetUser.mockResolvedValueOnce({
    data: { user: { id: userId } },
    error: null
  });
}

beforeEach(() => {
  mockGetUser.mockReset();
  resetMockResults();
});

describe("GET /organizations/me", () => {
  it("returns 401 without an auth token", async () => {
    const res = await request(app).get("/organizations/me");
    expect(res.status).toBe(401);
  });

  it("returns organization: null when the caller has no active membership", async () => {
    authAsUser();
    mockFromResults.organization_members = { data: null, error: null };

    const res = await request(app)
      .get("/organizations/me")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.organization).toBeNull();
  });

  it("returns the org and role when the caller is an active member", async () => {
    authAsUser();
    mockFromResults.organization_members = {
      data: {
        role: "admin",
        status: "active",
        organization: {
          id: "org-1",
          name: "Acme Corp",
          seat_limit: 100,
          plan_tier: "team"
        }
      },
      error: null
    };
    mockRpcResults.get_org_seat_usage = {
      data: { seat_limit: 100, active_member_count: 7 },
      error: null
    };

    const res = await request(app)
      .get("/organizations/me")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
    expect(res.body.organization.name).toBe("Acme Corp");
    expect(res.body.organization.activeMemberCount).toBe(7);
  });

  it("still returns the org when the seat-usage RPC fails", async () => {
    authAsUser();
    mockFromResults.organization_members = {
      data: {
        role: "member",
        status: "active",
        organization: {
          id: "org-1",
          name: "Acme Corp",
          seat_limit: 100,
          plan_tier: "team"
        }
      },
      error: null
    };
    mockRpcResults.get_org_seat_usage = {
      data: null,
      error: { message: "Not a member of this organization" }
    };

    const res = await request(app)
      .get("/organizations/me")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.organization.activeMemberCount).toBeNull();
  });
});

describe("GET /organizations/:orgId/members", () => {
  it("returns 401 without an auth token", async () => {
    const res = await request(app).get("/organizations/org-1/members");
    expect(res.status).toBe(401);
  });

  it("returns the member list", async () => {
    authAsUser();
    mockFromResults.organization_members = {
      data: [
        {
          id: "m1",
          user_id: "user-123",
          email: "admin@acme.com",
          role: "admin",
          status: "active",
          joined_at: "2026-01-01T00:00:00Z"
        },
        {
          id: "m2",
          user_id: "user-456",
          email: "employee@acme.com",
          role: "member",
          status: "active",
          joined_at: "2026-01-02T00:00:00Z"
        }
      ],
      error: null
    };

    const res = await request(app)
      .get("/organizations/org-1/members")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.members).toHaveLength(2);
  });
});

describe("POST /organizations/:orgId/invites", () => {
  it("returns 400 for an invalid email", async () => {
    authAsUser();

    const res = await request(app)
      .post("/organizations/org-1/invites")
      .set("Authorization", "Bearer test-token")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("creates an invite and returns an accept link", async () => {
    authAsUser();
    mockFromResults.organizations = {
      data: { seat_limit: 5 },
      error: null
    };
    mockFromResults.organization_members = {
      data: null,
      count: 1,
      error: null
    };
    mockFromResults.organization_invites = [
      // First call: the pending-invite count used for the seat-limit check.
      { data: null, count: 0, error: null },
      // Second call: the actual insert.
      {
        data: {
          id: "invite-1",
          email: "newhire@acme.com",
          token: "abc-123-token",
          status: "pending",
          expires_at: "2026-07-26T00:00:00Z"
        },
        error: null
      }
    ];

    const res = await request(app)
      .post("/organizations/org-1/invites")
      .set("Authorization", "Bearer test-token")
      .send({ email: "newhire@acme.com" });

    expect(res.status).toBe(201);
    expect(res.body.invite.acceptUrl).toContain("token=abc-123-token");
  });

  it("returns 400 when the insert fails (e.g. caller isn't an admin)", async () => {
    authAsUser();
    mockFromResults.organizations = {
      data: { seat_limit: 5 },
      error: null
    };
    mockFromResults.organization_members = {
      data: null,
      count: 1,
      error: null
    };
    mockFromResults.organization_invites = [
      { data: null, count: 0, error: null },
      {
        data: null,
        error: { message: "new row violates row-level security policy" }
      }
    ];

    const res = await request(app)
      .post("/organizations/org-1/invites")
      .set("Authorization", "Bearer test-token")
      .send({ email: "newhire@acme.com" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the org has no seats left", async () => {
    authAsUser();
    mockFromResults.organizations = {
      data: { seat_limit: 2 },
      error: null
    };
    mockFromResults.organization_members = {
      data: null,
      count: 2,
      error: null
    };
    mockFromResults.organization_invites = {
      data: null,
      count: 0,
      error: null
    };

    const res = await request(app)
      .post("/organizations/org-1/invites")
      .set("Authorization", "Bearer test-token")
      .send({ email: "newhire@acme.com" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/seats/i);
  });
});

describe("DELETE /organizations/:orgId/members/:userId", () => {
  it("deactivates a member", async () => {
    authAsUser();
    mockFromResults.organization_members = { error: null };

    const res = await request(app)
      .delete("/organizations/org-1/members/user-456")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 400 when the update fails", async () => {
    authAsUser();
    mockFromResults.organization_members = {
      error: { message: "permission denied" }
    };

    const res = await request(app)
      .delete("/organizations/org-1/members/user-456")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(400);
  });
});

describe("POST /organizations/:orgId/members/:userId/reactivate", () => {
  it("reactivates a member when a seat is available", async () => {
    authAsUser();
    mockFromResults.organizations = {
      data: { seat_limit: 5 },
      error: null
    };
    mockFromResults.organization_members = [
      // First call: active-member count for the seat check.
      { data: null, count: 1, error: null },
      // Second call: the actual reactivation update.
      { data: null, error: null }
    ];
    mockFromResults.organization_invites = {
      data: null,
      count: 0,
      error: null
    };

    const res = await request(app)
      .post("/organizations/org-1/members/user-456/reactivate")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 400 when there's no seat available to reactivate into", async () => {
    authAsUser();
    mockFromResults.organizations = {
      data: { seat_limit: 2 },
      error: null
    };
    mockFromResults.organization_members = {
      data: null,
      count: 2,
      error: null
    };
    mockFromResults.organization_invites = {
      data: null,
      count: 0,
      error: null
    };

    const res = await request(app)
      .post("/organizations/org-1/members/user-456/reactivate")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/seats/i);
  });

  it("returns 400 when the update fails", async () => {
    authAsUser();
    mockFromResults.organizations = {
      data: { seat_limit: 5 },
      error: null
    };
    mockFromResults.organization_members = [
      { data: null, count: 1, error: null },
      { data: null, error: { message: "permission denied" } }
    ];
    mockFromResults.organization_invites = {
      data: null,
      count: 0,
      error: null
    };

    const res = await request(app)
      .post("/organizations/org-1/members/user-456/reactivate")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(400);
  });
});

describe("POST /organizations/:orgId/invites/:inviteId/resend", () => {
  it("resends an invite and returns a fresh accept link", async () => {
    authAsUser();
    mockFromResults.organization_invites = {
      data: {
        id: "invite-1",
        email: "newhire@acme.com",
        status: "pending",
        expires_at: "2026-08-09T00:00:00Z"
      },
      error: null
    };

    const res = await request(app)
      .post("/organizations/org-1/invites/invite-1/resend")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.invite.email).toBe("newhire@acme.com");
    expect(res.body.invite.status).toBe("pending");
    expect(res.body.invite.acceptUrl).toContain("token=");
  });

  it("returns 400 when the invite can't be resent (not found, already accepted, or not permitted)", async () => {
    authAsUser();
    mockFromResults.organization_invites = {
      data: null,
      error: { message: "JSON object requested, multiple (or no) rows returned" }
    };

    const res = await request(app)
      .post("/organizations/org-1/invites/invite-1/resend")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(400);
  });
});

describe("GET /organizations/:orgId/insights", () => {
  it("returns aggregate stats", async () => {
    authAsUser();
    mockRpcResults.get_org_aggregate_stats = {
      data: {
        member_count: 42,
        active_member_count: 30,
        total_submissions: 150,
        avg_clarity: 7.2,
        avg_politeness: 8.1,
        avg_professionalism: 7.8
      },
      error: null
    };

    const res = await request(app)
      .get("/organizations/org-1/insights")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.stats.member_count).toBe(42);
  });

  it("returns 403 when the caller isn't an admin of this org", async () => {
    authAsUser();
    mockRpcResults.get_org_aggregate_stats = {
      data: null,
      error: { message: "Not authorized to view this organization's stats." }
    };

    const res = await request(app)
      .get("/organizations/org-1/insights")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(403);
  });
});
