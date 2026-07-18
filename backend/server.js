import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pathToFileURL } from "url";
import OpenAI from "openai";
import rateLimit from "express-rate-limit";
import {
  computeTrend,
  computeOverallAverages,
  findWeakestDimension
} from "./insights.js";
import { getAuthedUser } from "./auth.js";
import organizationsRouter from "./organizations.js";
import platformRouter from "./platform.js";

dotenv.config();

const app = express();

// Restrict cross-origin requests to known frontend origin(s) instead of
// allowing any website to call this API from a browser. Configure via
// a comma-separated ALLOWED_ORIGINS env var in production; defaults to
// the local Vite dev server so local development keeps working.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173"];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Both /improve and /insights call Azure OpenAI, so both need a cap —
// otherwise there's no ceiling on API cost from a single caller.
const improveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please wait a few minutes and try again."
  }
});

const insightsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please wait a few minutes and try again."
  }
});

const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: {
    "api-version": "2024-02-15-preview"
  },
  defaultHeaders: {
    "api-key": process.env.AZURE_OPENAI_API_KEY
  }
});

app.get("/", (req, res) => {
  res.json({
    status: "running"
  });
});

app.use("/organizations", organizationsRouter);
app.use("/platform", platformRouter);

// GET /subscription
// Returns the caller's individual plan tier. There's no self-serve
// billing yet, so user_subscriptions rows are managed by hand via SQL —
// this route just reads whatever's there. Defaults to "free" when no
// row exists, so accounts created before this table existed (or anyone
// who's never been manually upgraded) still get a sensible answer
// instead of an error.
app.get("/subscription", async (req, res) => {
  try {
    const { userId, supabaseForUser } = await getAuthedUser(req);

    if (!userId || !supabaseForUser) {
      return res.status(401).json({ error: "Sign in to view your subscription." });
    }

    const { data, error } = await supabaseForUser
      .from("user_subscriptions")
      .select("plan_tier, status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load subscription:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    if (!data) {
      return res.json({ planTier: "free", status: "active", currentPeriodEnd: null });
    }

    res.json({
      planTier: data.plan_tier,
      status: data.status,
      currentPeriodEnd: data.current_period_end
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// POST /invites/accept  { token }
// Redeems a pending org invite for the signed-in user. The actual
// validation (invite exists, isn't expired, matches the caller's email)
// happens inside the accept_organization_invite database function —
// this route just needs the caller to be authenticated.
app.post("/invites/accept", async (req, res) => {
  try {
    const { token } = req.body;

    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ error: "Missing invite token." });
    }

    const { userId, supabaseForUser } = await getAuthedUser(req);

    if (!userId || !supabaseForUser) {
      return res.status(401).json({ error: "Sign in to accept this invite." });
    }

    const { data: organizationId, error } = await supabaseForUser.rpc(
      "accept_organization_invite",
      { invite_token: token }
    );

    if (error) {
      console.error("Failed to accept invite:", error.message);
      return res.status(400).json({
        error: "This invite link isn't valid. It may be expired, already used, or sent to a different email address."
      });
    }

    res.json({ organizationId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

const MAX_MESSAGE_LENGTH = 2000;

app.post("/improve", improveLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    // The frontend enforces a 1000-character limit client-side, but that's
    // trivially bypassed by calling the API directly. Validate here too —
    // otherwise a malicious caller can send arbitrarily large payloads and
    // run up the Azure OpenAI bill on every request, rate limit or not.
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please provide a message."
      });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`
      });
    }

    // Optional auth: if the caller sent a Supabase session token, resolve
    // the user so we can save this submission to their history. If not,
    // the tool still works — it just won't be saved.
    const { userId, supabaseForUser } = await getAuthedUser(req);

    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      messages: [

        {
          role: "system",
          content: `
You are Clarity Coach, an AI workplace communication coach for ESL professionals.

Analyze workplace communication quality.

Return ONLY valid JSON.

{
  "rewrites": {
    "professional": "",
    "friendly": "",
    "concise": "",
    "executive": ""
  },
  "explanation": "",
  "scores": {
    "clarity": 0,
    "politeness": 0,
    "professionalism": 0
  },
  "tip": ""
}

Scoring Guidelines:

Clarity:
1 = extremely unclear
10 = extremely clear

Politeness:
1 = rude or abrupt
10 = highly courteous and respectful

Professionalism:
1 = inappropriate for workplace use
10 = executive-level business communication

Requirements:
- Rewrite the message using the requested tone while preserving the original meaning.
- If the original message lacks context, improve only the wording and tone.
- Use only information provided by the user.
- Do not add recipients, signatures, dates, times, topics, deadlines, departments, projects, names, or any other new information.
- Provide a simple explanation suitable for ESL learners.
- Give realistic scores based on the ORIGINAL message.
- Provide one practical communication tip.
- Return valid JSON only.
- Do not invent information that the user did not provide.
- Do not add placeholders such as [date], [time], [name], or [department].
- Never insert placeholder text.
- Never invent dates, names, deadlines, times, departments, projects, or other information not explicitly supplied by the user.

Example:

Original:
"I need a response."

Good Rewrite:
"Could you please respond?"

Bad Rewrite:
"Hi [Name], could you please respond regarding [Topic] by [Date]?"

The bad rewrite is invalid because it invents information.
`

        },

        {
  role: "user",
  content: `
Analyze the ORIGINAL message below.

ORIGINAL MESSAGE:
"${message}"

Generate four versions:

1. Professional
2. Friendly
3. Concise
4. Executive

Tasks:
1. Generate four rewritten versions:
   - Professional
   - Friendly
   - Concise
   - Executive
2. Explain what was improved.
3. Score the ORIGINAL message.
4. Provide one workplace communication tip.

Return JSON only.
`
}

      ]
    });

    const aiText = response.choices[0].message.content;

    const parsedResponse = JSON.parse(aiText);

    // Best-effort save: history is a bonus, not a requirement for the
    // core feature to work, so a save failure should never break the response.
    if (userId && supabaseForUser) {
      // If this user belongs to an org, tag the submission so it counts
      // toward that org's aggregate stats. A lookup failure here just
      // means the submission saves without an org tag — not worth
      // failing the whole request over.
      let organizationId = null;
      try {
        const { data: membership } = await supabaseForUser
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle();
        organizationId = membership?.organization_id ?? null;
      } catch (membershipError) {
        console.error("Failed to resolve org membership:", membershipError.message);
      }

      const { error: insertError } = await supabaseForUser
        .from("submissions")
        .insert({
          user_id: userId,
          organization_id: organizationId,
          original_message: message,
          rewrite_professional: parsedResponse.rewrites?.professional,
          rewrite_friendly: parsedResponse.rewrites?.friendly,
          rewrite_concise: parsedResponse.rewrites?.concise,
          rewrite_executive: parsedResponse.rewrites?.executive,
          explanation: parsedResponse.explanation,
          clarity_score: parsedResponse.scores?.clarity,
          politeness_score: parsedResponse.scores?.politeness,
          professionalism_score: parsedResponse.scores?.professionalism,
          tip: parsedResponse.tip
        });

      if (insertError) {
        console.error("Failed to save submission:", insertError.message);
      }
    }

    res.json(parsedResponse);

  } catch (error) {

    // Log the real error server-side for debugging, but don't hand
    // internal error text (library messages, stack details) back to
    // whoever called the API.
    console.error(error);

    res.status(500).json({
      error: "Something went wrong while improving your message. Please try again."
    });

  }
});

app.get("/history", async (req, res) => {
  try {
    const { userId, supabaseForUser } = await getAuthedUser(req);

    if (!userId || !supabaseForUser) {
      return res.status(401).json({
        error: "Sign in to view your progress history."
      });
    }

    const { data, error } = await supabaseForUser
      .from("submissions")
      .select(
        "id, original_message, clarity_score, politeness_score, professionalism_score, tip, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch history:", error.message);
      return res.status(500).json({
        error: "Something went wrong while loading your history. Please try again."
      });
    }

    res.json({ submissions: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Something went wrong while loading your history. Please try again."
    });
  }
});

const MIN_SUBMISSIONS_FOR_INSIGHTS = 3;

async function generateCoachInsight(submissions) {
  const recent = submissions.slice(-10).map((s) => ({
    message: s.original_message,
    clarity: s.clarity_score,
    politeness: s.politeness_score,
    professionalism: s.professionalism_score
  }));

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    messages: [
      {
        role: "system",
        content: `
You are Clarity Coach's pattern analyst. You will be given a list of a
user's recent workplace messages, each with the clarity, politeness, and
professionalism scores (1-10) it received.

Your job is different from the per-message tips already given: look
ACROSS these messages for ONE recurring pattern or theme the user could
improve — something a single message's tip wouldn't catch. For example,
a pattern might involve tone in requests specifically, brevity that
reads as curt, or consistently under-explaining context.

Requirements:
- Identify exactly one recurring pattern, not a generic writing tip.
- Base it only on the actual messages and scores provided.
- Write 2-3 sentences, plain and encouraging, suitable for an ESL
  professional.
- Do not invent details not present in the messages.
- Return ONLY valid JSON: { "insight": "..." }
`
      },
      {
        role: "user",
        content: `Here are the user's recent messages and scores:\n${JSON.stringify(
          recent
        )}\n\nReturn the JSON described above.`
      }
    ]
  });

  const text = response.choices[0].message.content;
  const parsed = JSON.parse(text);
  return parsed.insight;
}

app.get("/insights", insightsLimiter, async (req, res) => {
  try {
    const { userId, supabaseForUser } = await getAuthedUser(req);

    if (!userId || !supabaseForUser) {
      return res.status(401).json({
        error: "Sign in to view your insights."
      });
    }

    const { data: submissions, error } = await supabaseForUser
      .from("submissions")
      .select(
        "id, original_message, clarity_score, politeness_score, professionalism_score, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch submissions for insights:", error.message);
      return res.status(500).json({
        error: "Something went wrong while loading your insights. Please try again."
      });
    }

    if (submissions.length < MIN_SUBMISSIONS_FOR_INSIGHTS) {
      return res.json({
        ready: false,
        count: submissions.length,
        minimumRequired: MIN_SUBMISSIONS_FOR_INSIGHTS
      });
    }

    const overallAverages = computeOverallAverages(submissions);
    const trend = computeTrend(submissions);
    const weakestDimension = findWeakestDimension(overallAverages);

    let insight = null;
    try {
      insight = await generateCoachInsight(submissions);
    } catch (insightError) {
      console.error("Failed to generate coach insight:", insightError.message);
      // Stats are still useful without the AI insight, so don't fail the whole request.
    }

    res.json({
      ready: true,
      count: submissions.length,
      overallAverages,
      trend,
      weakestDimension,
      insight
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Something went wrong while loading your insights. Please try again."
    });
  }
});

const PORT = process.env.PORT || 3001;

// Only start listening when this file is run directly (e.g. `node
// server.js`) — not when it's imported by tests, so test files can
// exercise the Express app without spinning up a real server.
//
// Using pathToFileURL() instead of a hand-built `file://${...}` string is
// what makes this reliable on Windows: process.argv[1] is a raw OS path
// (backslashes, no leading slash — e.g. C:\Users\...\server.js), while
// import.meta.url is always a properly encoded file URL (forward
// slashes, triple slash before the drive letter). Comparing the raw
// string never matches on Windows, which silently skipped app.listen()
// with no error — the process just had nothing keeping it alive and
// exited quietly.
const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
}

export default app;
