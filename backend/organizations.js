import express from "express";
import crypto from "crypto";
import { getAuthedUser } from "./auth.js";

const router = express.Router();

// Every route in this router requires auth; resolve it once instead of
// repeating the same 401 check in every handler.
async function requireAuth(req, res, next) {
  const { userId, supabaseForUser } = await getAuthedUser(req);
  if (!userId || !supabaseForUser) {
    return res.status(401).json({ error: "Sign in to continue." });
  }
  req.userId = userId;
  req.supabaseForUser = supabaseForUser;
  next();
}

router.use(requireAuth);

// Shared by invite creation and member reactivation, since both need to
// reject an action that would push the org over its seat limit. Pending
// invites count as reserved seats too, not just active members —
// otherwise an admin could invite well past capacity before anyone
// actually accepts. Returns { seatLimit, reservedSeats } on success, or
// { checkError } if something couldn't be verified.
async function checkSeatAvailability(supabaseForUser, orgId) {
  const { data: org, error: orgError } = await supabaseForUser
    .from("organizations")
    .select("seat_limit")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    return { checkError: orgError?.message || "Organization not found" };
  }

  const { count: activeMemberCount, error: memberCountError } =
    await supabaseForUser
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active");

  const { count: pendingInviteCount, error: inviteCountError } =
    await supabaseForUser
      .from("organization_invites")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending");

  if (memberCountError || inviteCountError) {
    return { checkError: (memberCountError || inviteCountError).message };
  }

  return {
    seatLimit: org.seat_limit,
    reservedSeats: (activeMemberCount ?? 0) + (pendingInviteCount ?? 0)
  };
}

// GET /organizations/me
// Returns the caller's org membership, if any. The frontend uses this to
// decide whether to show the "Team" admin view at all.
router.get("/me", async (req, res) => {
  try {
    const { data, error } = await req.supabaseForUser
      .from("organization_members")
      .select(
        "role, status, organization:organizations(id, name, seat_limit, plan_tier)"
      )
      .eq("user_id", req.userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      console.error("Failed to load organization membership:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    if (!data) {
      return res.json({ organization: null });
    }

    // Seat usage (active member count) is resolved separately via a
    // security-definer RPC rather than a plain count query, because RLS
    // deliberately limits a regular member to only seeing their own
    // organization_members row — a plain query would undercount for
    // anyone who isn't an admin. get_org_seat_usage only ever returns a
    // count, never other members' details, so it's safe for any active
    // member to call. Best-effort: if it fails, the org still loads —
    // the seat count just isn't shown.
    let activeMemberCount = null;
    try {
      const { data: seatUsage, error: seatError } = await req.supabaseForUser
        .rpc("get_org_seat_usage", { target_org_id: data.organization.id })
        .single();

      if (seatError) {
        console.error("Failed to load seat usage:", seatError.message);
      } else {
        activeMemberCount = seatUsage.active_member_count;
      }
    } catch (seatUsageError) {
      console.error("Failed to load seat usage:", seatUsageError.message);
    }

    res.json({
      organization: { ...data.organization, activeMemberCount },
      role: data.role
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// GET /organizations/:orgId/members
// RLS already scopes this: an admin sees every member of their org, a
// regular member only ever gets their own row back.
router.get("/:orgId/members", async (req, res) => {
  try {
    const { data, error } = await req.supabaseForUser
      .from("organization_members")
      .select("id, user_id, email, name, role, status, joined_at")
      .eq("organization_id", req.params.orgId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("Failed to load members:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    res.json({ members: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// GET /organizations/:orgId/invites
router.get("/:orgId/invites", async (req, res) => {
  try {
    const { data, error } = await req.supabaseForUser
      .from("organization_invites")
      .select("id, email, status, created_at, expires_at")
      .eq("organization_id", req.params.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load invites:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    res.json({ invites: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// POST /organizations/:orgId/invites  { email }
// Creates a pending invite. There's no transactional-email integration
// yet, so the response includes the invite link directly — an admin
// copies/sends it themselves. RLS restricts the insert to admins of
// this org, so a non-admin caller gets a clean 400 here rather than a
// raw database error.
router.post("/:orgId/invites", async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim() || !email.includes("@")) {
      return res.status(400).json({
        error: "Please provide a valid email address."
      });
    }

    // Seat-limit check. This is a best-effort pre-check, not the sole
    // enforcement mechanism; a genuine hard limit would need a DB
    // constraint, but for a minimal team feature set this catches the
    // normal case.
    const { seatLimit, reservedSeats, checkError } = await checkSeatAvailability(
      req.supabaseForUser,
      req.params.orgId
    );

    if (checkError) {
      console.error("Failed to check seat availability:", checkError);
      return res.status(400).json({
        error: "Couldn't verify seat availability. Please try again."
      });
    }

    if (reservedSeats >= seatLimit) {
      return res.status(400).json({
        error: `You've used all ${seatLimit} seats on your plan. Remove a member, or contact us to add more seats, before inviting anyone else.`
      });
    }

    const { data, error } = await req.supabaseForUser
      .from("organization_invites")
      .insert({
        organization_id: req.params.orgId,
        email: email.trim().toLowerCase(),
        invited_by: req.userId
      })
      .select("id, email, token, status, expires_at")
      .single();

    if (error) {
      // Most likely cause: the caller isn't an admin (RLS blocked the
      // insert) or this email already has a pending invite for this org
      // (unique constraint) — either way, don't leak the raw DB error.
      console.error("Failed to create invite:", error.message);
      return res.status(400).json({
        error:
          "Couldn't create that invite. You may not have permission, or this person may already be invited."
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    res.status(201).json({
      invite: {
        id: data.id,
        email: data.email,
        status: data.status,
        expiresAt: data.expires_at,
        acceptUrl: `${frontendUrl}/accept-invite?token=${data.token}`
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// POST /organizations/:orgId/invites/:inviteId/resend
// Regenerates the invite's token and resets its status/expiry, rather
// than inserting a new invite row — organization_invites has a unique
// constraint on (organization_id, email) regardless of status, so a
// second insert for the same email would fail that constraint. The
// existing "admin manages invites" RLS policy (cmd ALL) already
// restricts this update to admins of the org, and the .neq("status",
// "accepted") guard stops an admin from "resending" an invite whose
// email is already an active member.
router.post("/:orgId/invites/:inviteId/resend", async (req, res) => {
  try {
    const newToken = crypto.randomUUID();
    const newExpiresAt = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await req.supabaseForUser
      .from("organization_invites")
      .update({
        token: newToken,
        status: "pending",
        expires_at: newExpiresAt
      })
      .eq("organization_id", req.params.orgId)
      .eq("id", req.params.inviteId)
      .neq("status", "accepted")
      .select("id, email, status, expires_at")
      .single();

    if (error || !data) {
      console.error("Failed to resend invite:", error?.message);
      return res.status(400).json({
        error:
          "Couldn't resend that invite. It may already be accepted, or you may not have permission."
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    res.json({
      invite: {
        id: data.id,
        email: data.email,
        status: data.status,
        expiresAt: data.expires_at,
        acceptUrl: `${frontendUrl}/accept-invite?token=${newToken}`
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// DELETE /organizations/:orgId/members/:userId
// Deactivates a seat rather than deleting the row, so historical
// submissions and aggregate stats stay intact.
router.delete("/:orgId/members/:userId", async (req, res) => {
  try {
    const { error } = await req.supabaseForUser
      .from("organization_members")
      .update({ status: "deactivated" })
      .eq("organization_id", req.params.orgId)
      .eq("user_id", req.params.userId);

    if (error) {
      console.error("Failed to deactivate member:", error.message);
      return res.status(400).json({ error: "Couldn't remove that member." });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// POST /organizations/:orgId/members/:userId/reactivate
// Restores a previously deactivated seat back to active. Re-checks the
// seat limit first — otherwise an admin could reactivate someone past
// capacity the same way uncapped inviting would.
router.post("/:orgId/members/:userId/reactivate", async (req, res) => {
  try {
    const { seatLimit, reservedSeats, checkError } = await checkSeatAvailability(
      req.supabaseForUser,
      req.params.orgId
    );

    if (checkError) {
      console.error("Failed to check seat availability:", checkError);
      return res.status(400).json({
        error: "Couldn't verify seat availability. Please try again."
      });
    }

    if (reservedSeats >= seatLimit) {
      return res.status(400).json({
        error: `You've used all ${seatLimit} seats on your plan. Remove another member, or contact us to add more seats, before reactivating this one.`
      });
    }

    const { error } = await req.supabaseForUser
      .from("organization_members")
      .update({ status: "active" })
      .eq("organization_id", req.params.orgId)
      .eq("user_id", req.params.userId)
      .eq("status", "deactivated");

    if (error) {
      console.error("Failed to reactivate member:", error.message);
      return res.status(400).json({ error: "Couldn't reactivate that member." });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// GET /organizations/:orgId/insights
// Aggregate-only org stats via the get_org_aggregate_stats RPC function.
// That function itself checks the caller is an active admin of this org
// and only ever returns summary numbers — never an individual employee's
// messages or scores. This route doesn't add its own admin check on top
// because the database is the actual enforcement point; a 403 here just
// means the RPC rejected the call.
router.get("/:orgId/insights", async (req, res) => {
  try {
    const { data, error } = await req.supabaseForUser
      .rpc("get_org_aggregate_stats", { target_org_id: req.params.orgId })
      .single();

    if (error) {
      console.error("Failed to load org insights:", error.message);
      return res.status(403).json({
        error: "You don't have access to this organization's insights."
      });
    }

    res.json({ stats: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
