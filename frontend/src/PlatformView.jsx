import { useState, useEffect, useCallback } from "react";
import {
  HiOutlineSquares2X2,
  HiOutlineBuildingOffice2,
  HiOutlineUsers,
  HiOutlineChartBar,
  HiOutlineCog6Tooth,
  HiOutlineQuestionMarkCircle,
  HiArrowLeft,
  HiExclamationTriangle,
  HiChevronRight,
  HiChevronDown
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

function statusPill(status) {
  const styles = {
    active: { background: "#dcfce7", color: "#15803d" },
    pending: { background: "#fef3c7", color: "#92400e" },
    deactivated: { background: "#f1f5f9", color: "#64748b" }
  };
  const s = styles[status] || styles.deactivated;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "600",
        textTransform: "capitalize",
        background: s.background,
        color: s.color
      }}
    >
      {status}
    </span>
  );
}

function KpiBox({ label, value }) {
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

// ---------- Dashboard ----------

function DashboardSection({ authHeaders, onJumpToOrg }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}/platform/dashboard`, {
          headers: authHeaders
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Something went wrong.");
        if (!cancelled) setData(body);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Unable to load the dashboard. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p style={{ color: "#64748b" }}>Loading dashboard...</p>;
  }

  if (error) {
    return <div style={{ color: "#ef4444" }}>{error}</div>;
  }

  const needsAttention =
    (data.orgsWithoutAdmin?.length ?? 0) > 0 || data.expiredInviteCount > 0;

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
          <KpiBox label="Organizations" value={data.totalOrganizations} />
          <KpiBox
            label="Seats used"
            value={`${data.totalSeatsUsed} / ${data.totalSeatCapacity}`}
          />
          <KpiBox label="Individual subscribers" value={data.totalSubscribers} />
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
            {data.orgsWithoutAdmin?.length > 0 && (
              <div style={{ marginBottom: "12px" }}>
                <p style={{ margin: "0 0 6px 0", fontWeight: "600", fontSize: "14px" }}>
                  Organizations with no active admin ({data.orgsWithoutAdmin.length})
                </p>
                {data.orgsWithoutAdmin.map((org) => (
                  <div
                    key={org.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                      borderRadius: "8px",
                      marginBottom: "6px"
                    }}
                  >
                    <span style={{ fontSize: "14px" }}>{org.name}</span>
                    <button
                      onClick={() => onJumpToOrg(org.id)}
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
                      Fix now
                    </button>
                  </div>
                ))}
              </div>
            )}
            {data.expiredInviteCount > 0 && (
              <p style={{ fontSize: "14px", color: "#92400e", margin: 0 }}>
                {data.expiredInviteCount} pending invite
                {data.expiredInviteCount === 1 ? "" : "s"} expired and unaccepted.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Organization detail (shown when an org is selected from the sidebar tree) ----------

function OrgDetailPanel({ org, authHeaders }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [promotingUserId, setPromotingUserId] = useState(null);
  const [promoteError, setPromoteError] = useState("");
  const [promoteMessage, setPromoteMessage] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`${API_URL}/platform/organizations/${org.id}/members`, {
          headers: authHeaders
        }),
        fetch(`${API_URL}/platform/organizations/${org.id}/invites`, {
          headers: authHeaders
        })
      ]);
      const membersData = await membersRes.json();
      const invitesData = await invitesRes.json();
      if (!membersRes.ok) throw new Error(membersData.error || "Something went wrong.");
      if (!invitesRes.ok) throw new Error(invitesData.error || "Something went wrong.");
      setMembers(membersData.members);
      setInvites(invitesData.invites);
    } catch (err) {
      console.error(err);
      setError("Unable to load this organization. Please try again.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  // Re-load and reset local UI state whenever a different org is selected.
  useEffect(() => {
    setSearch("");
    setStatusFilter("all");
    setPromoteError("");
    setPromoteMessage("");
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.id]);

  const promote = async (userId) => {
    setPromotingUserId(userId);
    setPromoteError("");
    setPromoteMessage("");
    try {
      const res = await fetch(
        `${API_URL}/platform/organizations/${org.id}/members/${userId}/promote`,
        { method: "POST", headers: authHeaders }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setPromoteMessage("Member promoted to admin.");
      await loadDetail();
    } catch (err) {
      setPromoteError(err.message || "Couldn't promote that member. Please try again.");
    } finally {
      setPromotingUserId(null);
    }
  };

  const exportMembersCsv = () => {
    const header = "Name,Email,Role,Status,Joined\n";
    const rows = members
      .map(
        (m) =>
          `${m.name || ""},${m.email},${m.role},${m.status},${new Date(m.joinedAt).toLocaleDateString()}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${org.name.replace(/\s+/g, "-").toLowerCase()}-members.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredMembers = members.filter((m) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      m.email.toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: "4px" }}>
        <h3 style={{ margin: 0 }}>{org.name}</h3>
        <p style={{ color: "#64748b", fontSize: "13px", margin: "4px 0 0" }}>
          {org.planTier} &middot; {org.activeMemberCount} of {org.seatLimit} seats
          {org.pendingInviteCount > 0 &&
            ` · ${org.pendingInviteCount} pending invite${
              org.pendingInviteCount === 1 ? "" : "s"
            }`}
        </p>
      </div>

      {loading ? (
        <p style={{ color: "#64748b", fontSize: "14px", marginTop: "20px" }}>Loading...</p>
      ) : error ? (
        <div style={{ color: "#ef4444", fontSize: "14px", marginTop: "20px" }}>{error}</div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              margin: "24px 0 12px"
            }}
          >
            <h4 style={{ margin: 0 }}>Members</h4>
            <button
              onClick={exportMembersCsv}
              style={{
                background: "white",
                border: "1px solid #e2e8f0",
                color: "#334155",
                borderRadius: "8px",
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600"
              }}
            >
              Export
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px" }}>
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: "200px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "14px",
                boxSizing: "border-box"
              }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "14px"
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>

          {promoteError && (
            <div style={{ color: "#ef4444", marginBottom: "8px", fontSize: "13px" }}>
              {promoteError}
            </div>
          )}
          {promoteMessage && (
            <div style={{ color: "#16a34a", marginBottom: "8px", fontSize: "13px" }}>
              {promoteMessage}
            </div>
          )}

          {filteredMembers.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "13px" }}>No members match.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={theadRowStyle}>
                  <th style={{ padding: "8px 4px" }}>Name</th>
                  <th style={{ padding: "8px 4px" }}>Email</th>
                  <th style={{ padding: "8px 4px" }}>Role</th>
                  <th style={{ padding: "8px 4px" }}>Status</th>
                  <th style={{ padding: "8px 4px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 4px" }}>{m.name || "—"}</td>
                    <td style={{ padding: "10px 4px" }}>{m.email}</td>
                    <td style={{ padding: "10px 4px", textTransform: "capitalize" }}>
                      {m.role}
                    </td>
                    <td style={{ padding: "10px 4px" }}>{statusPill(m.status)}</td>
                    <td style={{ padding: "10px 4px", textAlign: "right" }}>
                      {m.role === "member" && m.status === "active" ? (
                        <button
                          onClick={() => promote(m.userId)}
                          disabled={promotingUserId === m.userId}
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
                          {promotingUserId === m.userId ? "Promoting..." : "Promote to admin"}
                        </button>
                      ) : (
                        <span style={{ color: "#cbd5e1" }}>&mdash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4 style={{ margin: "24px 0 8px" }}>Invites</h4>
          {invites.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "13px" }}>No invites.</p>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={theadRowStyle}>
                  <th style={{ padding: "8px 4px" }}>Email</th>
                  <th style={{ padding: "8px 4px" }}>Status</th>
                  <th style={{ padding: "8px 4px" }}>Expires</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 4px" }}>{invite.email}</td>
                    <td style={{ padding: "10px 4px" }}>{statusPill(invite.status)}</td>
                    <td style={{ padding: "10px 4px" }}>
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Customers (individual subscribers) ----------

function CustomersSection({ authHeaders }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subscribers, setSubscribers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}/platform/subscribers`, {
          headers: authHeaders
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Something went wrong.");
        if (!cancelled) setSubscribers(data.subscribers);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Unable to load customers. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p style={{ color: "#64748b" }}>Loading customers...</p>;
  }

  if (error) {
    return <div style={{ color: "#ef4444" }}>{error}</div>;
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Individual Subscribers</h3>
      {subscribers.length === 0 ? (
        <p style={{ color: "#64748b" }}>
          No individual subscribers set up yet. Plan tiers are managed by hand
          via SQL until self-serve billing exists.
        </p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={{ padding: "8px 4px" }}>Name</th>
              <th style={{ padding: "8px 4px" }}>Email</th>
              <th style={{ padding: "8px 4px" }}>Plan</th>
              <th style={{ padding: "8px 4px" }}>Status</th>
              <th style={{ padding: "8px 4px" }}>Renews</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((sub) => (
              <tr key={sub.userId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 4px" }}>{sub.name || "—"}</td>
                <td style={{ padding: "8px 4px" }}>{sub.email}</td>
                <td style={{ padding: "8px 4px" }}>{sub.planTier}</td>
                <td style={{ padding: "8px 4px" }}>{statusPill(sub.status)}</td>
                <td style={{ padding: "8px 4px" }}>
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Analytics (placeholder) ----------

function AnalyticsSection() {
  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Analytics</h3>
      <p style={{ color: "#64748b", margin: 0 }}>
        Coming soon. Real usage trends (messages over time, org and
        subscriber growth) need historical tracking that isn't captured
        yet — this is a placeholder until that data collection exists.
      </p>
    </div>
  );
}

// ---------- Settings (manage platform admins) ----------

function SettingsSection({ authHeaders }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [admins, setAdmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [removingUserId, setRemovingUserId] = useState(null);
  const [removeError, setRemoveError] = useState("");

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/platform/admins`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setAdmins(data.admins);
    } catch (err) {
      console.error(err);
      setError("Unable to load platform admins. Please try again.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) {
      setAddError("Please enter an email address.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch(`${API_URL}/platform/admins`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ email: newAdminEmail.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setNewAdminEmail("");
      await loadAdmins();
    } catch (err) {
      setAddError(err.message || "Couldn't add that admin. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const removeAdmin = async (userId) => {
    if (!window.confirm("Remove platform-admin access for this account?")) return;
    setRemovingUserId(userId);
    setRemoveError("");
    try {
      const res = await fetch(`${API_URL}/platform/admins/${userId}`, {
        method: "DELETE",
        headers: authHeaders
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      await loadAdmins();
    } catch (err) {
      setRemoveError(err.message || "Couldn't remove that admin. Please try again.");
    } finally {
      setRemovingUserId(null);
    }
  };

  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0, marginBottom: "12px" }}>Platform Admins</h3>
      <p style={{ color: "#64748b", fontSize: "13px", marginTop: 0 }}>
        Anyone listed here can see and manage every organization and
        customer on the platform. Grant this sparingly.
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
        <input
          type="email"
          placeholder="person@example.com"
          value={newAdminEmail}
          onChange={(e) => setNewAdminEmail(e.target.value)}
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
          onClick={addAdmin}
          disabled={adding}
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
          {adding ? "Adding..." : "Add Admin"}
        </button>
      </div>
      {addError && (
        <div style={{ color: "#ef4444", marginBottom: "12px", fontSize: "14px" }}>
          {addError}
        </div>
      )}
      {removeError && (
        <div style={{ color: "#ef4444", marginBottom: "12px", fontSize: "14px" }}>
          {removeError}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading...</p>
      ) : error ? (
        <div style={{ color: "#ef4444" }}>{error}</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={{ padding: "8px 4px" }}>Email</th>
              <th style={{ padding: "8px 4px" }}>Since</th>
              <th style={{ padding: "8px 4px" }}></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.userId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 4px" }}>{admin.email}</td>
                <td style={{ padding: "8px 4px" }}>
                  {new Date(admin.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: "8px 4px", textAlign: "right" }}>
                  <button
                    onClick={() => removeAdmin(admin.userId)}
                    disabled={removingUserId === admin.userId}
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
                    {removingUserId === admin.userId ? "Removing..." : "Remove"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Help (static) ----------

function HelpSection() {
  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>Help</h3>
      <p style={{ color: "#64748b" }}>
        This is the platform-admin console — visible only to accounts
        listed under Settings &rarr; Platform Admins. It's separate from
        the Team dashboard that org admins see for their own organization.
      </p>
      <ul style={{ color: "#64748b", fontSize: "14px", paddingLeft: "20px" }}>
        <li>
          <strong>Dashboard</strong> — top-line numbers across every org
          and subscriber, plus anything that needs attention.
        </li>
        <li>
          <strong>Organizations</strong> — expand it in the left nav to see
          every team account; click one to see its members, invites, and
          promote a member to admin if the org has lost its only one.
        </li>
        <li>
          <strong>Customers</strong> — individual (non-team) subscribers
          and their plan tier.
        </li>
        <li>
          <strong>Settings</strong> — who else has this level of access.
        </li>
      </ul>
    </div>
  );
}

// ---------- Shell ----------

function navItemStyle(active) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
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

function PlatformView({ session, onBack }) {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [organizations, setOrganizations] = useState([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState("");
  const [orgNavExpanded, setOrgNavExpanded] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`
  };

  // Organizations are fetched once here, at the shell level, so the
  // left-nav tree (Organizations > each org) and the detail panel both
  // work off the same list without duplicating the fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOrgsLoading(true);
      setOrgsError("");
      try {
        const res = await fetch(`${API_URL}/platform/organizations`, {
          headers: authHeaders
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Something went wrong.");
        if (!cancelled) setOrganizations(data.organizations);
      } catch (err) {
        console.error(err);
        if (!cancelled) setOrgsError("Unable to load organizations.");
      } finally {
        if (!cancelled) setOrgsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToOrg = (orgId) => {
    setSelectedOrgId(orgId);
    setActiveSection("organizations");
    setOrgNavExpanded(true);
  };

  const selectedOrg = organizations.find((org) => org.id === selectedOrgId) || null;

  return (
    <div>
      <button
        onClick={onBack}
        style={{
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
        }}
      >
        <HiArrowLeft /> Back to tool
      </button>

      <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
        <div
          style={{
            width: "220px",
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
          <button
            onClick={() => setActiveSection("dashboard")}
            style={navItemStyle(activeSection === "dashboard")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <HiOutlineSquares2X2 size={18} />
              Dashboard
            </span>
          </button>

          <button
            onClick={() => {
              setActiveSection("organizations");
              setOrgNavExpanded((prev) => !prev);
            }}
            style={navItemStyle(activeSection === "organizations" && !selectedOrg)}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <HiOutlineBuildingOffice2 size={18} />
              Organizations
            </span>
            {orgNavExpanded ? <HiChevronDown size={14} /> : <HiChevronRight size={14} />}
          </button>

          {orgNavExpanded && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                marginLeft: "16px",
                marginBottom: "4px",
                borderLeft: "2px solid #ede9fe",
                paddingLeft: "10px"
              }}
            >
              {orgsLoading ? (
                <span style={{ fontSize: "13px", color: "#94a3b8", padding: "6px 4px" }}>
                  Loading...
                </span>
              ) : orgsError ? (
                <span style={{ fontSize: "13px", color: "#ef4444", padding: "6px 4px" }}>
                  {orgsError}
                </span>
              ) : organizations.length === 0 ? (
                <span style={{ fontSize: "13px", color: "#94a3b8", padding: "6px 4px" }}>
                  No organizations
                </span>
              ) : (
                organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setSelectedOrgId(org.id);
                      setActiveSection("organizations");
                    }}
                    style={{
                      display: "block",
                      background: selectedOrgId === org.id ? "#ede9fe" : "transparent",
                      color: selectedOrgId === org.id ? VIOLET : "#475569",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: selectedOrgId === org.id ? "600" : "500",
                      textAlign: "left",
                      width: "100%",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {org.name}
                  </button>
                ))
              )}
            </div>
          )}

          <button
            onClick={() => setActiveSection("customers")}
            style={navItemStyle(activeSection === "customers")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <HiOutlineUsers size={18} />
              Customers
            </span>
          </button>
          <button
            onClick={() => setActiveSection("analytics")}
            style={navItemStyle(activeSection === "analytics")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <HiOutlineChartBar size={18} />
              Analytics
            </span>
          </button>
          <button
            onClick={() => setActiveSection("settings")}
            style={navItemStyle(activeSection === "settings")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <HiOutlineCog6Tooth size={18} />
              Settings
            </span>
          </button>
          <button
            onClick={() => setActiveSection("help")}
            style={navItemStyle(activeSection === "help")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <HiOutlineQuestionMarkCircle size={18} />
              Help
            </span>
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {activeSection === "dashboard" && (
            <DashboardSection authHeaders={authHeaders} onJumpToOrg={goToOrg} />
          )}
          {activeSection === "organizations" &&
            (selectedOrg ? (
              <OrgDetailPanel org={selectedOrg} authHeaders={authHeaders} />
            ) : (
              <div style={cardStyle}>
                <h3 style={{ marginTop: 0 }}>Organizations</h3>
                <p style={{ color: "#64748b", margin: 0 }}>
                  {orgsLoading
                    ? "Loading organizations..."
                    : organizations.length === 0
                      ? "No organizations yet."
                      : "Select an organization from the left to view its members and invites."}
                </p>
              </div>
            ))}
          {activeSection === "customers" && <CustomersSection authHeaders={authHeaders} />}
          {activeSection === "analytics" && <AnalyticsSection />}
          {activeSection === "settings" && <SettingsSection authHeaders={authHeaders} />}
          {activeSection === "help" && <HelpSection />}
        </div>
      </div>
    </div>
  );
}

export default PlatformView;
