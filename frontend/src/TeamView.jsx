import { useState, useEffect, useCallback } from "react";
import {
  HiOutlineSquares2X2,
  HiOutlineUsers,
  HiOutlineChartBar,
  HiOutlineQuestionMarkCircle,
  HiOutlineEnvelope,
  HiArrowLeft,
  HiExclamationTriangle
} from "react-icons/hi2";
import { API_URL } from "./config";

const VIOLET = "#7c3aed";

const cardStyle = {
  background: "white",
  padding: "30px",
  borderRadius: "16px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  marginBottom: "20px"
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
  textAlign: "left"
};

const theadRowStyle = {
  textAlign: "left",
  color: "#64748b",
  borderBottom: "1px solid #e5e7eb"
};

const backButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "none",
  border: "none",
  color: VIOLET,
  cursor: "pointer",
  fontWeight: "600",
  marginBottom: "16px",
  fontSize: "14px"
};

function navItemStyle(active) {
  return {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: active ? VIOLET : "transparent",
    color: active ? "white" : "#334155",
    border: "none",
    borderRadius: "8px",
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    textAlign: "left",
    width: "100%"
  };
}

function StatBox({ label, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        padding: "16px",
        borderRadius: "10px",
        textAlign: "center"
      }}
    >
      <div style={{ fontSize: "24px", fontWeight: "700", color: VIOLET }}>
        {value}
      </div>
      <div style={{ fontSize: "12px", color: "#64748b" }}>{label}</div>
    </div>
  );
}

// The stored invite status doesn't automatically flip to "expired" once
// the date passes (nothing runs on a schedule to update it), so this is
// computed for display rather than trusted from the raw status field.
function inviteStatusLabel(invite) {
  if (invite.status === "pending" && new Date(invite.expires_at) < new Date()) {
    return "Expired";
  }
  if (invite.status === "revoked") return "Revoked";
  return "Pending";
}

// ---------- Dashboard ----------

function DashboardSection({ org, stats, activeAdminCount, expiredInviteCount, pendingInviteCount, onGoToMembers }) {
  const needsAttention = activeAdminCount <= 1 || expiredInviteCount > 0;

  return (
    <div>
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Overview</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "16px"
          }}
        >
          <StatBox
            label="Seats used"
            value={`${org.activeMemberCount ?? "—"} / ${org.seat_limit}`}
          />
          <StatBox label="Pending invites" value={pendingInviteCount} />
          <StatBox label="Total messages" value={stats ? stats.total_submissions : "—"} />
        </div>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px"
          }}
        >
          <HiExclamationTriangle size={20} color={needsAttention ? "#d97706" : "#94a3b8"} />
          <h3 style={{ margin: 0 }}>Needs attention</h3>
        </div>
        {!needsAttention ? (
          <p style={{ color: "#64748b" }}>Nothing needs attention right now.</p>
        ) : (
          <div>
            {activeAdminCount <= 1 && (
              <p style={{ fontSize: "14px", color: "#92400e", margin: "0 0 10px 0" }}>
                You're the only admin on this team. If you lose access,
                nobody else can manage members until support adds another
                admin — worth naming a backup.
              </p>
            )}
            {expiredInviteCount > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: "8px"
                }}
              >
                <span style={{ fontSize: "14px" }}>
                  {expiredInviteCount} invite{expiredInviteCount === 1 ? "" : "s"} expired
                  and unaccepted.
                </span>
                <button
                  onClick={onGoToMembers}
                  style={{
                    background: "none",
                    border: `1px solid ${VIOLET}`,
                    color: VIOLET,
                    borderRadius: "6px",
                    padding: "4px 10px",
                    cursor: "pointer",
                    fontSize: "12px"
                  }}
                >
                  Resend
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Members (invite form + pending invites + roster) ----------

function MembersSection({ org, authHeaders, members, invites, session, reload }) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);
  const [removeError, setRemoveError] = useState("");
  const [reactivatingUserId, setReactivatingUserId] = useState(null);
  const [reactivateError, setReactivateError] = useState("");
  const [resendingInviteId, setResendingInviteId] = useState(null);
  const [resendError, setResendError] = useState("");
  const [resendResult, setResendResult] = useState(null);
  const [resendCopied, setResendCopied] = useState(false);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      setInviteError("Please enter an email address.");
      return;
    }
    setInviting(true);
    setInviteError("");
    setInviteResult(null);
    try {
      const res = await fetch(`${API_URL}/organizations/${org.id}/invites`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ email: inviteEmail.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setInviteResult(data.invite);
      setInviteEmail("");
      await reload();
    } catch (err) {
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (userId) => {
    if (!window.confirm("Remove this person from the team? They'll lose access immediately.")) {
      return;
    }
    setRemovingUserId(userId);
    setRemoveError("");
    try {
      const res = await fetch(`${API_URL}/organizations/${org.id}/members/${userId}`, {
        method: "DELETE",
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      await reload();
    } catch (err) {
      setRemoveError(err.message || "Couldn't remove that member. Please try again.");
    } finally {
      setRemovingUserId(null);
    }
  };

  const reactivateMember = async (userId) => {
    setReactivatingUserId(userId);
    setReactivateError("");
    try {
      const res = await fetch(
        `${API_URL}/organizations/${org.id}/members/${userId}/reactivate`,
        { method: "POST", headers: authHeaders }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      await reload();
    } catch (err) {
      setReactivateError(err.message || "Couldn't reactivate that member. Please try again.");
    } finally {
      setReactivatingUserId(null);
    }
  };

  const copyInviteLink = (url) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resendInvite = async (inviteId) => {
    setResendingInviteId(inviteId);
    setResendError("");
    setResendResult(null);
    try {
      const res = await fetch(
        `${API_URL}/organizations/${org.id}/invites/${inviteId}/resend`,
        { method: "POST", headers: authHeaders }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResendResult(data.invite);
      await reload();
    } catch (err) {
      setResendError(err.message || "Couldn't resend that invite. Please try again.");
    } finally {
      setResendingInviteId(null);
    }
  };

  const copyResendLink = (url) => {
    navigator.clipboard.writeText(url);
    setResendCopied(true);
    setTimeout(() => setResendCopied(false), 2000);
  };

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <HiOutlineEnvelope size={22} color={VIOLET} />
          <h3 style={{ margin: 0 }}>Invite a teammate</h3>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder="employee@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            style={{
              flex: "1",
              minWidth: "200px",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "14px",
              boxSizing: "border-box"
            }}
          />
          <button
            onClick={sendInvite}
            disabled={inviting}
            style={{
              background: VIOLET,
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            {inviting ? "Sending..." : "Create Invite"}
          </button>
        </div>
        {inviteError && (
          <div style={{ color: "#ef4444", marginTop: "8px", fontSize: "14px" }}>
            {inviteError}
          </div>
        )}
        {inviteResult && (
          <div
            style={{
              marginTop: "12px",
              background: "#f5f3ff",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #ddd6fe"
            }}
          >
            <p style={{ margin: "0 0 6px 0", fontSize: "14px" }}>
              Invite created for <strong>{inviteResult.email}</strong>. There's
              no automated email yet — copy this link and send it to them
              yourself:
            </p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ fontSize: "12px", wordBreak: "break-all", flex: 1 }}>
                {inviteResult.acceptUrl}
              </code>
              <button
                onClick={() => copyInviteLink(inviteResult.acceptUrl)}
                style={{
                  background: "white",
                  border: `1px solid ${VIOLET}`,
                  color: VIOLET,
                  borderRadius: "6px",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: "12px",
                  whiteSpace: "nowrap"
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Pending Invites</h3>
        {resendError && (
          <div style={{ color: "#ef4444", marginBottom: "12px", fontSize: "14px" }}>
            {resendError}
          </div>
        )}
        {resendResult && (
          <div
            style={{
              marginBottom: "12px",
              background: "#f5f3ff",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #ddd6fe"
            }}
          >
            <p style={{ margin: "0 0 6px 0", fontSize: "14px" }}>
              Fresh invite link for <strong>{resendResult.email}</strong>:
            </p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ fontSize: "12px", wordBreak: "break-all", flex: 1 }}>
                {resendResult.acceptUrl}
              </code>
              <button
                onClick={() => copyResendLink(resendResult.acceptUrl)}
                style={{
                  background: "white",
                  border: `1px solid ${VIOLET}`,
                  color: VIOLET,
                  borderRadius: "6px",
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: "12px",
                  whiteSpace: "nowrap"
                }}
              >
                {resendCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
        {invites.length === 0 ? (
          <p style={{ color: "#64748b" }}>No pending invites.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={{ padding: "8px 4px" }}>Email</th>
                <th style={{ padding: "8px 4px" }}>Status</th>
                <th style={{ padding: "8px 4px" }}>Sent</th>
                <th style={{ padding: "8px 4px" }}>Expires</th>
                <th style={{ padding: "8px 4px" }}></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "8px 4px" }}>{invite.email}</td>
                  <td style={{ padding: "8px 4px" }}>{inviteStatusLabel(invite)}</td>
                  <td style={{ padding: "8px 4px" }}>
                    {new Date(invite.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 4px" }}>
                    {new Date(invite.expires_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 4px", textAlign: "right" }}>
                    <button
                      onClick={() => resendInvite(invite.id)}
                      disabled={resendingInviteId === invite.id}
                      style={{
                        background: "none",
                        border: `1px solid ${VIOLET}`,
                        color: VIOLET,
                        borderRadius: "6px",
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      {resendingInviteId === invite.id ? "Resending..." : "Resend"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Members</h3>
        {removeError && (
          <div style={{ color: "#ef4444", marginBottom: "12px", fontSize: "14px" }}>
            {removeError}
          </div>
        )}
        {reactivateError && (
          <div style={{ color: "#ef4444", marginBottom: "12px", fontSize: "14px" }}>
            {reactivateError}
          </div>
        )}
        {members.length === 0 ? (
          <p style={{ color: "#64748b" }}>No members yet.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={{ padding: "8px 4px" }}>Name</th>
                <th style={{ padding: "8px 4px" }}>Email</th>
                <th style={{ padding: "8px 4px" }}>Role</th>
                <th style={{ padding: "8px 4px" }}>Status</th>
                <th style={{ padding: "8px 4px" }}>Joined</th>
                <th style={{ padding: "8px 4px" }}></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isSelf = m.user_id === session.user?.id;
                const canRemove = m.status === "active" && !isSelf;
                const canReactivate = m.status === "deactivated";
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px" }}>{m.name || "—"}</td>
                    <td style={{ padding: "8px 4px" }}>{m.email}</td>
                    <td style={{ padding: "8px 4px" }}>{m.role}</td>
                    <td style={{ padding: "8px 4px" }}>{m.status}</td>
                    <td style={{ padding: "8px 4px" }}>
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "8px 4px", textAlign: "right" }}>
                      {canRemove && (
                        <button
                          onClick={() => removeMember(m.user_id)}
                          disabled={removingUserId === m.user_id}
                          style={{
                            background: "none",
                            border: "1px solid #ef4444",
                            color: "#ef4444",
                            borderRadius: "6px",
                            padding: "4px 10px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          {removingUserId === m.user_id ? "Removing..." : "Remove"}
                        </button>
                      )}
                      {canReactivate && (
                        <button
                          onClick={() => reactivateMember(m.user_id)}
                          disabled={reactivatingUserId === m.user_id}
                          style={{
                            background: "none",
                            border: `1px solid ${VIOLET}`,
                            color: VIOLET,
                            borderRadius: "6px",
                            padding: "4px 10px",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          {reactivatingUserId === m.user_id ? "Reactivating..." : "Reactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- Analytics (Team Insights) ----------

function AnalyticsSection({ stats }) {
  if (!stats) {
    return (
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Analytics</h3>
        <p style={{ color: "#64748b", margin: 0 }}>No data yet.</p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
        <HiOutlineChartBar size={22} color={VIOLET} />
        <h3 style={{ margin: 0 }}>Team Insights</h3>
      </div>
      <p style={{ color: "#64748b", fontSize: "13px", marginTop: 0, marginBottom: "16px" }}>
        Aggregate numbers only — individual employees' messages and scores
        are never shown here.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "16px"
        }}
      >
        <StatBox
          label="Active this month"
          value={`${stats.active_member_count} / ${stats.member_count}`}
        />
        <StatBox label="Total messages" value={stats.total_submissions} />
        <StatBox
          label="Avg. clarity"
          value={stats.avg_clarity ? Number(stats.avg_clarity).toFixed(1) : "—"}
        />
        <StatBox
          label="Avg. politeness"
          value={stats.avg_politeness ? Number(stats.avg_politeness).toFixed(1) : "—"}
        />
        <StatBox
          label="Avg. professionalism"
          value={
            stats.avg_professionalism ? Number(stats.avg_professionalism).toFixed(1) : "—"
          }
        />
      </div>
    </div>
  );
}

// ---------- Help (static) ----------

function HelpSection() {
  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Help</h3>
      <p style={{ color: "#64748b" }}>
        This is your team's admin console — visible only to admins of
        this organization.
      </p>
      <ul style={{ color: "#64748b", fontSize: "14px", paddingLeft: "20px" }}>
        <li>
          <strong>Dashboard</strong> — seats used, pending invites, and
          anything that needs attention.
        </li>
        <li>
          <strong>Members</strong> — invite teammates, manage pending
          invites, and remove or reactivate people.
        </li>
        <li>
          <strong>Analytics</strong> — aggregate communication scores for
          your team. Individual messages are never shown.
        </li>
      </ul>
      <p style={{ color: "#64748b", fontSize: "13px", marginBottom: 0 }}>
        If you're the only admin and need a backup added, contact support.
      </p>
    </div>
  );
}

// ---------- Shell ----------

function TeamView({ session, onBack }) {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState(null);
  const [role, setRole] = useState(null);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [invites, setInvites] = useState([]);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`
  };

  const loadOrgData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const meRes = await fetch(`${API_URL}/organizations/me`, { headers: authHeaders });
      const meData = await meRes.json();
      if (!meRes.ok) throw new Error(meData.error || "Something went wrong.");

      if (!meData.organization) {
        setOrg(null);
        setRole(null);
        return;
      }

      setOrg(meData.organization);
      setRole(meData.role);

      if (meData.role === "admin") {
        const [membersRes, statsRes, invitesRes] = await Promise.all([
          fetch(`${API_URL}/organizations/${meData.organization.id}/members`, {
            headers: authHeaders
          }),
          fetch(`${API_URL}/organizations/${meData.organization.id}/insights`, {
            headers: authHeaders
          }),
          fetch(`${API_URL}/organizations/${meData.organization.id}/invites`, {
            headers: authHeaders
          })
        ]);
        const membersData = await membersRes.json();
        const statsData = await statsRes.json();
        const invitesData = await invitesRes.json();
        if (membersRes.ok) setMembers(membersData.members);
        if (statsRes.ok) setStats(statsData.stats);
        // Accepted invites are redundant with the Members table, so only
        // pending/expired/revoked ones show up here.
        if (invitesRes.ok) {
          setInvites(invitesData.invites.filter((i) => i.status !== "accepted"));
        }
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load your team. Please try again.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    loadOrgData();
  }, [loadOrgData]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
        Loading your team...
      </div>
    );
  }

  if (!org) {
    return (
      <div>
        <button onClick={onBack} style={backButtonStyle}>
          <HiArrowLeft /> Back to tool
        </button>
        <div style={cardStyle}>
          <p style={{ color: "#64748b", margin: 0 }}>
            You're not part of a team account yet. If your company has set
            one up, ask an admin to send you an invite link.
          </p>
        </div>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div>
        <button onClick={onBack} style={backButtonStyle}>
          <HiArrowLeft /> Back to tool
        </button>
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <HiOutlineUsers size={24} color={VIOLET} />
            <h2 style={{ margin: 0 }}>{org.name}</h2>
          </div>
          <p style={{ color: "#64748b", margin: 0 }}>
            You're a member of {org.name}. Team management is only visible
            to admins.
          </p>
        </div>
      </div>
    );
  }

  const activeAdminCount = members.filter(
    (m) => m.role === "admin" && m.status === "active"
  ).length;
  const expiredInviteCount = invites.filter(
    (i) => i.status === "pending" && new Date(i.expires_at) < new Date()
  ).length;

  return (
    <div>
      <button onClick={onBack} style={backButtonStyle}>
        <HiArrowLeft /> Back to tool
      </button>

      {error && <div style={{ color: "#ef4444", marginBottom: "16px" }}>{error}</div>}

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <div
          style={{
            width: "200px",
            flexShrink: 0,
            background: "white",
            borderRadius: "16px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontSize: "13px",
              fontWeight: "700",
              color: "#0f172a",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {org.name}
          </div>
          <button
            onClick={() => setActiveSection("dashboard")}
            style={navItemStyle(activeSection === "dashboard")}
          >
            <HiOutlineSquares2X2 size={18} />
            Dashboard
          </button>
          <button
            onClick={() => setActiveSection("members")}
            style={navItemStyle(activeSection === "members")}
          >
            <HiOutlineUsers size={18} />
            Members
          </button>
          <button
            onClick={() => setActiveSection("analytics")}
            style={navItemStyle(activeSection === "analytics")}
          >
            <HiOutlineChartBar size={18} />
            Analytics
          </button>
          <button
            onClick={() => setActiveSection("help")}
            style={navItemStyle(activeSection === "help")}
          >
            <HiOutlineQuestionMarkCircle size={18} />
            Help
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {activeSection === "dashboard" && (
            <DashboardSection
              org={org}
              stats={stats}
              activeAdminCount={activeAdminCount}
              expiredInviteCount={expiredInviteCount}
              pendingInviteCount={invites.length}
              onGoToMembers={() => setActiveSection("members")}
            />
          )}
          {activeSection === "members" && (
            <MembersSection
              org={org}
              authHeaders={authHeaders}
              members={members}
              invites={invites}
              session={session}
              reload={loadOrgData}
            />
          )}
          {activeSection === "analytics" && <AnalyticsSection stats={stats} />}
          {activeSection === "help" && <HelpSection />}
        </div>
      </div>
    </div>
  );
}

export default TeamView;
