import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createMockSupabaseClient } from "./test-utils.js";

// Mock state needs to be created with vi.hoisted so it's available both
// inside the vi.mock factories below (which Vitest hoists above imports)
// and inside the test bodies further down. mockFromResults/mockRpcResults
// are mutated per-test to control what each Supabase table/RPC call
// returns; see test-utils.js for how the generic query-builder mock
// consumes them.
const {
  mockCreateCompletion,
  mockGetUser,
  mockFromResults,
  mockRpcResults
} = vi.hoisted(() => {
  return {
    mockCreateCompletion: vi.fn(),
    mockGetUser: vi.fn(),
    mockFromResults: {},
    mockRpcResults: {}
  };
});

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      constructor() {
        this.chat = {
          completions: {
            create: mockCreateCompletion
          }
        };
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

// server.js reads these at module-load time, so they must exist before
// it's imported. Values don't need to be real — nothing here hits a
// real network.
process.env.AZURE_OPENAI_API_KEY = "test-key";
process.env.AZURE_OPENAI_ENDPOINT = "https://example.openai.azure.com";
process.env.AZURE_OPENAI_DEPLOYMENT_NAME = "test-deployment";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon-key";

const { default: app } = await import("./server.js");

const VALID_AI_RESPONSE = {
  rewrites: {
    professional: "Could you please respond?",
    friendly: "Could you get back to me? Thanks!",
    concise: "Please respond.",
    executive: "Please provide a response at your earliest convenience."
  },
  explanation: "The message was direct; the rewrites add courtesy.",
  scores: { clarity: 6, politeness: 3, professionalism: 4 },
  tip: "Add a polite opener."
};

function mockAiTextResponse(obj) {
  mockCreateCompletion.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(obj) } }]
  });
}

function resetFromResults() {
  for (const key of Object.keys(mockFromResults)) {
    delete mockFromResults[key];
  }
  for (const key of Object.keys(mockRpcResults)) {
    delete mockRpcResults[key];
  }
}

beforeEach(() => {
  mockCreateCompletion.mockReset();
  mockGetUser.mockReset();
  resetFromResults();
});

describe("GET /", () => {
  it("returns a running status", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "running" });
  });
});

describe("GET /subscription", () => {
  it("returns 401 without an auth token", async () => {
    const res = await request(app).get("/subscription");
    expect(res.status).toBe(401);
  });

  it("defaults to the free tier when no subscription row exists", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null
    });
    mockFromResults.user_subscriptions = { data: null, error: null };

    const res = await request(app)
      .get("/subscription")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.planTier).toBe("free");
  });

  it("returns the caller's actual plan when a subscription row exists", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null
    });
    mockFromResults.user_subscriptions = {
      data: {
        plan_tier: "pro",
        status: "active",
        current_period_end: "2026-08-12T00:00:00Z"
      },
      error: null
    };

    const res = await request(app)
      .get("/subscription")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.planTier).toBe("pro");
    expect(res.body.currentPeriodEnd).toBe("2026-08-12T00:00:00Z");
  });
});

describe("POST /improve", () => {
  it("returns rewrites for an unauthenticated request without attempting a save", async () => {
    mockAiTextResponse(VALID_AI_RESPONSE);

    const res = await request(app)
      .post("/improve")
      .send({ message: "I need a response." });

    expect(res.status).toBe(200);
    expect(res.body.rewrites.professional).toBe(
      VALID_AI_RESPONSE.rewrites.professional
    );
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("resolves the user, tags the submission with their org (if any), and saves it", async () => {
    mockAiTextResponse(VALID_AI_RESPONSE);
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null
    });
    // No org membership for this user; the submission should still save
    // successfully with organization_id: null.
    mockFromResults.organization_members = { data: null, error: null };
    mockFromResults.submissions = { error: null };

    const res = await request(app)
      .post("/improve")
      .set("Authorization", "Bearer test-token")
      .send({ message: "I need a response." });

    expect(res.status).toBe(200);
    expect(mockGetUser).toHaveBeenCalledWith("test-token");
  });

  it("returns 500 when the AI response isn't valid JSON", async () => {
    mockCreateCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: "not valid json" } }]
    });

    const res = await request(app)
      .post("/improve")
      .send({ message: "I need a response." });

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
    expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
  });

  it("returns 400 and never calls the AI when the message is missing", async () => {
    const res = await request(app).post("/improve").send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it("returns 400 and never calls the AI when the message is empty or whitespace", async () => {
    const res = await request(app)
      .post("/improve")
      .send({ message: "   " });

    expect(res.status).toBe(400);
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it("returns 400 and never calls the AI when the message exceeds the length limit", async () => {
    const res = await request(app)
      .post("/improve")
      .send({ message: "a".repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too long/i);
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });
});

describe("GET /history", () => {
  it("returns 401 without an auth token", async () => {
    const res = await request(app).get("/history");
    expect(res.status).toBe(401);
  });

  it("returns submissions for an authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null
    });
    mockFromResults.submissions = {
      data: [
        {
          id: "1",
          original_message: "hi",
          clarity_score: 5,
          politeness_score: 5,
          professionalism_score: 5,
          tip: "tip",
          created_at: "2026-01-01T00:00:00Z"
        }
      ],
      error: null
    };

    const res = await request(app)
      .get("/history")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(1);
  });
});

describe("GET /insights", () => {
  it("returns 401 without an auth token", async () => {
    const res = await request(app).get("/insights");
    expect(res.status).toBe(401);
  });

  it("reports not-ready when there are fewer than 3 submissions", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null
    });
    mockFromResults.submissions = {
      data: [
        {
          clarity_score: 5,
          politeness_score: 5,
          professionalism_score: 5,
          original_message: "a",
          created_at: "2026-01-01"
        },
        {
          clarity_score: 5,
          politeness_score: 5,
          professionalism_score: 5,
          original_message: "b",
          created_at: "2026-01-02"
        }
      ],
      error: null
    };

    const res = await request(app)
      .get("/insights")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(false);
    expect(res.body.count).toBe(2);
  });

  it("returns computed stats and an AI insight once there are enough submissions", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null
    });
    mockFromResults.submissions = {
      data: [
        {
          clarity_score: 4,
          politeness_score: 3,
          professionalism_score: 5,
          original_message: "a",
          created_at: "2026-01-01"
        },
        {
          clarity_score: 5,
          politeness_score: 3,
          professionalism_score: 5,
          original_message: "b",
          created_at: "2026-01-02"
        },
        {
          clarity_score: 6,
          politeness_score: 3,
          professionalism_score: 5,
          original_message: "c",
          created_at: "2026-01-03"
        }
      ],
      error: null
    };
    mockAiTextResponse({ insight: "You consistently under-explain requests." });

    const res = await request(app)
      .get("/insights")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.weakestDimension).toBe("Politeness");
    expect(res.body.insight).toBe("You consistently under-explain requests.");
  });

  it("still returns stats when the AI insight call fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null
    });
    mockFromResults.submissions = {
      data: [
        {
          clarity_score: 4,
          politeness_score: 3,
          professionalism_score: 5,
          original_message: "a",
          created_at: "2026-01-01"
        },
        {
          clarity_score: 5,
          politeness_score: 3,
          professionalism_score: 5,
          original_message: "b",
          created_at: "2026-01-02"
        },
        {
          clarity_score: 6,
          politeness_score: 3,
          professionalism_score: 5,
          original_message: "c",
          created_at: "2026-01-03"
        }
      ],
      error: null
    };
    mockCreateCompletion.mockRejectedValueOnce(new Error("AI unavailable"));

    const res = await request(app)
      .get("/insights")
      .set("Authorization", "Bearer test-token");

    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.insight).toBeNull();
  });
});

describe("POST /invites/accept", () => {
  it("returns 401 without an auth token", async () => {
    const res = await request(app)
      .post("/invites/accept")
      .send({ token: "some-token" });

    expect(res.status).toBe(401);
  });

  it("returns 400 when the token is missing", async () => {
    const res = await request(app).post("/invites/accept").send({});
    expect(res.status).toBe(400);
  });

  it("returns the organization id when the RPC succeeds", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null
    });
    mockRpcResults.accept_organization_invite = {
      data: "org-abc",
      error: null
    };

    const res = await request(app)
      .post("/invites/accept")
      .set("Authorization", "Bearer test-token")
      .send({ token: "some-token" });

    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBe("org-abc");
  });

  it("returns 400 when the invite is invalid or expired", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null
    });
    mockRpcResults.accept_organization_invite = {
      data: null,
      error: { message: "Invite not found, already used, or expired." }
    };

    const res = await request(app)
      .post("/invites/accept")
      .set("Authorization", "Bearer test-token")
      .send({ token: "bad-token" });

    expect(res.status).toBe(400);
  });
});
