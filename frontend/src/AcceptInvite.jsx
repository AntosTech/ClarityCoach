import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import { API_URL } from "./config";

const VIOLET = "#7c3aed";

// Standalone page for /accept-invite?token=... links. There's no router
// in this app (one page, a few local view states), so this is rendered
// directly by App.jsx based on window.location.pathname rather than
// through a route table — simplest option for a single extra URL.
function AcceptInvite() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [status, setStatus] = useState("idle"); // idle | accepting | success | error
  const [error, setError] = useState("");

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !token || status !== "idle") return;

    const acceptInvite = async () => {
      setStatus("accepting");
      try {
        const res = await fetch(`${API_URL}/invites/accept`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Something went wrong.");
        }
        setStatus("success");
      } catch (err) {
        console.error(err);
        setError(err.message || "Unable to join your team. Please try again.");
        setStatus("error");
      }
    };

    acceptInvite();
  }, [session, token, status]);

  const pageStyle = {
    minHeight: "100vh",
    backgroundColor: "#f5f7fb",
    padding: "40px"
  };

  const cardStyle = {
    background: "white",
    padding: "30px",
    borderRadius: "16px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    maxWidth: "440px",
    margin: "80px auto",
    textAlign: "center"
  };

  const linkStyle = {
    color: VIOLET,
    fontWeight: "600",
    textDecoration: "none"
  };

  if (!token) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h3>Invalid invite link</h3>
          <p style={{ color: "#64748b" }}>
            This invite link is missing its token. Please check the link
            and try again, or ask whoever invited you to send a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
          Join your team on Clarity Coach
        </h3>

        {!authLoading && !session && (
          <>
            <p style={{ color: "#64748b", marginBottom: "16px" }}>
              Sign in or create an account with the email this invite was
              sent to, then this page will finish joining you to your
              team.
            </p>
            <Auth emailRedirectTo={window.location.href} />
          </>
        )}

        {session && status === "accepting" && (
          <p style={{ color: "#64748b" }}>Joining your team...</p>
        )}

        {session && status === "success" && (
          <>
            <p style={{ color: "#16a34a", fontWeight: "600" }}>
              You're all set!
            </p>
            <p style={{ color: "#64748b" }}>
              You've joined your team's account.
            </p>
            <a href="/" style={linkStyle}>
              Go to Clarity Coach
            </a>
          </>
        )}

        {session && status === "error" && (
          <>
            <p style={{ color: "#ef4444", fontWeight: "600" }}>{error}</p>
            <a href="/" style={linkStyle}>
              Go to Clarity Coach
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default AcceptInvite;
