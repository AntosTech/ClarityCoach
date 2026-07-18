import express from "express";
import { getAuthedUser } from "./auth.js";

const router = express.Router();

// Every route here requires auth first, same pattern as organizations.js.
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

// Applied per-route (not router-wide) because GET /me needs to answer
// "am I a platform admin?" for anyone signed in — it can't itself
// require being a platform admin, or a regular customer could never get
// a straight answer back.
async function requirePlatformAdmin(req, res, next) {
  try {
    const { data, error } = await req.supabaseForUser.rpc("is_platform_admin", {});

    if (error) {
      console.error("Failed to check platform admin status:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    if (!data) {
      return res.status(403).json({ error: "You don't have access to this." });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

// GET /platform/me
// The frontend uses this to decide whether to show the Platform nav
// item at all. Answers with isPlatformAdmin: false rather than a 403 for
// anyone who isn't one — this route is meant to be checkable by every
// signed-in user, not just admins.
router.get("/me", async (req, res) => {
  try {
    const { data, error } = await req.supabaseForUser.rpc("is_platform_admin", {});

    if (error) {
      console.error("Failed to check platform admin status:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    res.json({ isPlatformAdmin: Boolean(data) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// GET /platform/organizations
// Cross-org summary via get_platform_org_summary(), which itself
// enforces the platform-admin check again at the database layer — the
// requirePlatformAdmin middleware here is a fast, friendly 403, not the
// actual security boundary. Aggregate-only, same principle as the
// per-org insights route: no individual member emails, no messages.
router.get("/organizations", requirePlatformAdmin, async (req, res) => {
  try {
    const { data, error } = await req.supabaseForUser.rpc(
      "get_platform_org_summary",
      {}
    );

    if (error) {
      console.error("Failed to load platform org summary:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    res.json({
      organizations: data.map((row) => ({
        id: row.org_id,
        name: row.org_name,
        seatLimit: row.seat_limit,
        activeMemberCount: row.active_member_count,
        pendingInviteCount: row.pending_invite_count,
        planTier: row.plan_tier
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// GET /platform/subscribers
// Individual (non-team) subscriber list via get_platform_subscribers().
// Only ever includes users who have a user_subscriptions row — there's
// no self-serve billing yet, so this reflects whoever's been manually
// set up, per the Phase 0 design.
router.get("/subscribers", requirePlatformAdmin, async (req, res) => {
  try {
    const { data, error } = await req.supabaseForUser.rpc(
      "get_platform_subscribers",
      {}
    );

    if (error) {
      console.error("Failed to load platform subscribers:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    res.json({
      subscribers: data.map((row) => ({
        userId: row.subscriber_user_id,
        email: row.email,
        name: row.name,
        planTier: row.plan_tier,
        status: row.status,
        currentPeriodEnd: row.current_period_end
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// GET /platform/dashboard
// Top-line KPIs plus a "needs attention" list (orgs with zero active
// admins, expired-but-still-pending invites) so problems like the
// no-admin-left scenario surface on their own instead of via a phone
// call.
router.get("/dashboard", requirePlatformAdmin, async (req, res) => {
  try {
    const { data, error } = await req.supabaseForUser
      .rpc("get_platform_dashboard", {})
      .single();

    if (error) {
      console.error("Failed to load platform dashboard:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    res.json({
      totalOrganizations: data.total_organizations,
      totalSeatsUsed: data.total_seats_used,
      totalSeatCapacity: data.total_seat_capacity,
      totalSubscribers: data.total_subscribers,
      orgsWithoutAdmin: data.orgs_without_admin,
      expiredInviteCount: data.expired_invite_count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// GET /platform/organizations/:orgId/members
// Drill-down into a single org's roster — a deliberate exception to the
// "aggregate only" rule on the other platform routes, since recovering
// an org that lost its only admin requires seeing who's actually in it.
router.get(
  "/organizations/:orgId/members",
  requirePlatformAdmin,
  async (req, res) => {
    try {
      const { data, error } = await req.supabaseForUser.rpc(
        "get_platform_org_members",
        { target_org_id: req.params.orgId }
      );

      if (error) {
        console.error("Failed to load org members:", error.message);
        return res.status(500).json({
          error: "Something went wrong. Please try again."
        });
      }

      res.json({
        members: data.map((row) => ({
          id: row.id,
          userId: row.user_id,
          email: row.email,
          name: row.name,
          role: row.role,
          status: row.status,
          joinedAt: row.joined_at
        }))
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
);

// GET /platform/organizations/:orgId/invites
router.get(
  "/organizations/:orgId/invites",
  requirePlatformAdmin,
  async (req, res) => {
    try {
      const { data, error } = await req.supabaseForUser.rpc(
        "get_platform_org_invites",
        { target_org_id: req.params.orgId }
      );

      if (error) {
        console.error("Failed to load org invites:", error.message);
        return res.status(500).json({
          error: "Something went wrong. Please try again."
        });
      }

      res.json({
        invites: data.map((row) => ({
          id: row.id,
          email: row.email,
          status: row.status,
          createdAt: row.created_at,
          expiresAt: row.expires_at
        }))
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
);

// POST /platform/organizations/:orgId/members/:userId/promote
// The actual fix for "the sole admin left" — flips an existing active
// member to admin. Doesn't also reactivate a deactivated member; those
// are kept as separate operations, same as elsewhere in the app.
router.post(
  "/organizations/:orgId/members/:userId/promote",
  requirePlatformAdmin,
  async (req, res) => {
    try {
      const { error } = await req.supabaseForUser.rpc(
        "promote_platform_org_member",
        {
          target_org_id: req.params.orgId,
          target_user_id: req.params.userId
        }
      );

      if (error) {
        console.error("Failed to promote member:", error.message);
        return res.status(400).json({
          error:
            "Couldn't promote that member. They may be deactivated or not part of this organization."
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  }
);

// GET /platform/admins
// Who currently has platform-admin access.
router.get("/admins", requirePlatformAdmin, async (req, res) => {
  try {
    const { data, error } = await req.supabaseForUser.rpc(
      "get_platform_admins",
      {}
    );

    if (error) {
      console.error("Failed to load platform admins:", error.message);
      return res.status(500).json({
        error: "Something went wrong. Please try again."
      });
    }

    res.json({
      admins: data.map((row) => ({
        userId: row.admin_user_id,
        email: row.email,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// POST /platform/admins  { email }
// Grants platform-admin access to an existing account. There's no
// invite flow for this — it's a rare, high-trust action, so it just
// looks up an existing auth.users row by email.
router.post("/admins", requirePlatformAdmin, async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim() || !email.includes("@")) {
      return res.status(400).json({
        error: "Please provide a valid email address."
      });
    }

    const { data, error } = await req.supabaseForUser.rpc("add_platform_admin", {
      target_email: email.trim().toLowerCase()
    });

    if (error) {
      console.error("Failed to add platform admin:", error.message);
      return res.status(400).json({
        error:
          "Couldn't add that admin. Make sure the email matches an existing account."
      });
    }

    res.status(201).json({ userId: data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// DELETE /platform/admins/:userId
// Revokes platform-admin access. The database function itself blocks
// removing the last remaining platform admin, so nobody can lock
// themselves (or everyone else) out.
router.delete("/admins/:userId", requirePlatformAdmin, async (req, res) => {
  try {
    const { error } = await req.supabaseForUser.rpc("remove_platform_admin", {
      target_user_id: req.params.userId
    });

    if (error) {
      console.error("Failed to remove platform admin:", error.message);
      return res.status(400).json({
        error: error.message.includes("last platform admin")
          ? "You can't remove the last platform admin."
          : "Couldn't remove that admin. Please try again."
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
