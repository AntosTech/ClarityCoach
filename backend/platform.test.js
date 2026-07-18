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

// Exercised through the full app, same as organizations.test.js, since
// this router requires auth on every route.
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

describe("GET /platform/me", () => {
  it("returns 401 without an auth token", async () => {
    const res = await request(app).get("/platform/me");
    expect(res.status).toBe(401);
  });

  it("returns isPlatformAdmin: false for a regular user", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: false, error: null };

    const res = await request(app)
      .get("/platform/me")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.isPlatformAdmin).toBe(false);
  });

  it("returns isPlatformAdmin: true for a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };

    const res = await request(app)
      .get("/platform/me")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.isPlatformAdmin).toBe(true);
  });
});

describe("GET /platform/organizations", () => {
  it("returns 401 without an auth token", async () => {
    const res = await request(app).get("/platform/organizations");
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller isn't a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: false, error: null };

    const res = await request(app)
      .get("/platform/organizations")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(403);
  });

  it("returns the cross-org summary for a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.get_platform_org_summary = {
      data: [
        {
          org_id: "org-1",
          org_name: "QA Test Org",
          seat_limit: 5,
          active_member_count: 2,
          pending_invite_count: 1,
          plan_tier: "team"
        },
        {
          org_id: "org-2",
          org_name: "Test Org 2",
          seat_limit: 100,
          active_member_count: 1,
          pending_invite_count: 0,
          plan_tier: "team"
        }
      ],
      error: null
    };

    const res = await request(app)
      .get("/platform/organizations")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.organizations).toHaveLength(2);
    expect(res.body.organizations[1]).toEqual({
      id: "org-2",
      name: "Test Org 2",
      seatLimit: 100,
      activeMemberCount: 1,
      pendingInviteCount: 0,
      planTier: "team"
    });
  });
});

describe("GET /platform/subscribers", () => {
  it("returns 403 when the caller isn't a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: false, error: null };

    const res = await request(app)
      .get("/platform/subscribers")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(403);
  });

  it("returns the subscriber list for a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.get_platform_subscribers = {
      data: [
        {
          subscriber_user_id: "user-456",
          email: "solo@customer.com",
          plan_tier: "pro",
          status: "active",
          current_period_end: "2026-08-12T00:00:00Z"
        }
      ],
      error: null
    };

    const res = await request(app)
      .get("/platform/subscribers")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.subscribers).toEqual([
      {
        userId: "user-456",
        email: "solo@customer.com",
        planTier: "pro",
        status: "active",
        currentPeriodEnd: "2026-08-12T00:00:00Z"
      }
    ]);
  });
});

describe("GET /platform/dashboard", () => {
  it("returns 403 when the caller isn't a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: false, error: null };

    const res = await request(app)
      .get("/platform/dashboard")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(403);
  });

  it("returns KPIs and the needs-attention list for a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.get_platform_dashboard = {
      data: {
        total_organizations: 2,
        total_seats_used: 3,
        total_seat_capacity: 105,
        total_subscribers: 0,
        orgs_without_admin: [{ id: "org-3", name: "Orphaned Org" }],
        expired_invite_count: 1
      },
      error: null
    };

    const res = await request(app)
      .get("/platform/dashboard")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      totalOrganizations: 2,
      totalSeatsUsed: 3,
      totalSeatCapacity: 105,
      totalSubscribers: 0,
      orgsWithoutAdmin: [{ id: "org-3", name: "Orphaned Org" }],
      expiredInviteCount: 1
    });
  });
});

describe("GET /platform/organizations/:orgId/members", () => {
  it("returns 403 when the caller isn't a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: false, error: null };

    const res = await request(app)
      .get("/platform/organizations/org-1/members")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(403);
  });

  it("returns the org's member roster for a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.get_platform_org_members = {
      data: [
        {
          id: "m1",
          user_id: "user-123",
          email: "admin@acme.com",
          role: "admin",
          status: "active",
          joined_at: "2026-01-01T00:00:00Z"
        }
      ],
      error: null
    };

    const res = await request(app)
      .get("/platform/organizations/org-1/members")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.members).toEqual([
      {
        id: "m1",
        userId: "user-123",
        email: "admin@acme.com",
        role: "admin",
        status: "active",
        joinedAt: "2026-01-01T00:00:00Z"
      }
    ]);
  });
});

describe("GET /platform/organizations/:orgId/invites", () => {
  it("returns 403 when the caller isn't a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: false, error: null };

    const res = await request(app)
      .get("/platform/organizations/org-1/invites")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(403);
  });

  it("returns the org's invites for a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.get_platform_org_invites = {
      data: [
        {
          id: "invite-1",
          email: "newhire@acme.com",
          status: "pending",
          created_at: "2026-07-01T00:00:00Z",
          expires_at: "2026-07-15T00:00:00Z"
        }
      ],
      error: null
    };

    const res = await request(app)
      .get("/platform/organizations/org-1/invites")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.invites).toEqual([
      {
        id: "invite-1",
        email: "newhire@acme.com",
        status: "pending",
        createdAt: "2026-07-01T00:00:00Z",
        expiresAt: "2026-07-15T00:00:00Z"
      }
    ]);
  });
});

describe("POST /platform/organizations/:orgId/members/:userId/promote", () => {
  it("returns 403 when the caller isn't a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: false, error: null };

    const res = await request(app)
      .post("/platform/organizations/org-1/members/user-456/promote")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(403);
  });

  it("promotes an active member to admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.promote_platform_org_member = { data: true, error: null };

    const res = await request(app)
      .post("/platform/organizations/org-1/members/user-456/promote")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 400 when there's no eligible member to promote", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.promote_platform_org_member = {
      data: null,
      error: { message: "No active member found to promote." }
    };

    const res = await request(app)
      .post("/platform/organizations/org-1/members/user-456/promote")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(400);
  });
});

describe("GET /platform/admins", () => {
  it("returns 403 when the caller isn't a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: false, error: null };

    const res = await request(app)
      .get("/platform/admins")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(403);
  });

  it("returns the platform admin list", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.get_platform_admins = {
      data: [
        {
          admin_user_id: "user-123",
          email: "akishaanthony@yahoo.com",
          created_at: "2026-07-13T16:46:57Z"
        }
      ],
      error: null
    };

    const res = await request(app)
      .get("/platform/admins")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.admins).toEqual([
      {
        userId: "user-123",
        email: "akishaanthony@yahoo.com",
        createdAt: "2026-07-13T16:46:57Z"
      }
    ]);
  });
});

describe("POST /platform/admins", () => {
  it("returns 400 for an invalid email", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };

    const res = await request(app)
      .post("/platform/admins")
      .set("Authorization", "Bearer test-token")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
  });

  it("adds a new platform admin by email", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.add_platform_admin = { data: "user-789", error: null };

    const res = await request(app)
      .post("/platform/admins")
      .set("Authorization", "Bearer test-token")
      .send({ email: "newadmin@example.com" });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe("user-789");
  });

  it("returns 400 when no account exists for that email", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.add_platform_admin = {
      data: null,
      error: { message: "No account found for that email address." }
    };

    const res = await request(app)
      .post("/platform/admins")
      .set("Authorization", "Bearer test-token")
      .send({ email: "nobody@example.com" });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /platform/admins/:userId", () => {
  it("removes a platform admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.remove_platform_admin = { data: true, error: null };

    const res = await request(app)
      .delete("/platform/admins/user-789")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 400 with a clear message when removing the last admin", async () => {
    authAsUser();
    mockRpcResults.is_platform_admin = { data: true, error: null };
    mockRpcResults.remove_platform_admin = {
      data: null,
      error: { message: "Cannot remove the last platform admin." }
    };

    const res = await request(app)
      .delete("/platform/admins/user-123")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last platform admin/i);
  });
});
