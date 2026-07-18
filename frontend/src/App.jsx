import { useState, useEffect } from "react";
import {
  HiSparkles,
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocumentText,
  HiOutlineLightBulb,
  HiOutlineStar,
  HiOutlineGlobeAlt,
  HiOutlineInformationCircle,
  HiCheckCircle,
  HiOutlineBriefcase,
  HiOutlineFaceSmile,
  HiOutlineBolt,
  HiOutlineClipboardDocument,
  HiOutlineHeart
} from "react-icons/hi2";
import { FaCrown } from "react-icons/fa6";
import { MdRefresh } from "react-icons/md";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";
import ProgressView from "./ProgressView";
import TeamView from "./TeamView";
import PlatformView from "./PlatformView";
import AcceptInvite from "./AcceptInvite";
import { API_URL } from "./config";

const VIOLET = "#7c3aed";

function ScoreBar({ score }) {
  return (
    <div
      style={{
        background: "#e5e7eb",
        borderRadius: "8px",
        height: "12px",
        width: "100%",
        maxWidth: "500px",
        marginBottom: "5px"
      }}
    >
      <div
        style={{
          width: `${score * 10}%`,
          height: "12px",
          borderRadius: "8px",
          background:
            score >= 7
              ? "green"
              : score >= 4
                ? "orange"
                : "red"
        }}
      />
    </div>
  );
}

function formatRelativeTime(date) {
  if (!date) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - date) / 1000));
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function BestForItem({ children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        color: "#475569",
        fontSize: "14px",
        marginBottom: "4px"
      }}
    >
      <HiCheckCircle color="#16a34a" size={16} />
      <span>{children}</span>
    </div>
  );
}

function App() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [resultTimestamp, setResultTimestamp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedTone, setCopiedTone] = useState("");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState("tool"); // "tool" | "progress" | "team" | "platform"
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

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

  // Checks whether the signed-in user is a platform admin (the SaaS
  // operator, not a customer's org admin), so the "Platform" nav item
  // only ever shows up for that account. Best-effort: a failure here
  // just means the nav item stays hidden, not a broken app.
  useEffect(() => {
    if (!session?.access_token) {
      setIsPlatformAdmin(false);
      return;
    }
    fetch(`${API_URL}/platform/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    })
      .then((res) => (res.ok ? res.json() : { isPlatformAdmin: false }))
      .then((data) => setIsPlatformAdmin(Boolean(data.isPlatformAdmin)))
      .catch((err) => {
        console.error(err);
        setIsPlatformAdmin(false);
      });
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };
  const copyText = (text, tone) => {
    navigator.clipboard.writeText(text);
    setCopiedTone(tone);
    setTimeout(() => {
      setCopiedTone("");
    }, 2000);
  };

  const copyButtonStyle = (color) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px",
    backgroundColor: color,
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "12px",
    fontWeight: "600"
  });

  const toneCard = {
    background: "#f8fafc",
    padding: "24px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    minHeight: "280px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
  };
  const sectionCard = {
    background: "#f8fafc",
    padding: "24px",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
  };
  const cardHeader = (color) => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
    color
  });

  const improveMessage = async () => {
    if (!message.trim()) {
      setError("Please enter a message.");
      return;
    }

    setError("");
    try {
      setLoading(true);

      const headers = {
        "Content-Type": "application/json"
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `${API_URL}/improve`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            message
          })
        }
      );
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Invalid response from server.");
      }
      if (!response.ok) {
        throw new Error(
          data.error || "Something went wrong."
        );
      }
      setResult(data);
      setResultTimestamp(Date.now());
    }
    catch (error) {
      console.error(error);

      setResult(null);

      setError(
        "Unable to improve your message. Please try again."
      );
    }
    finally {
      setLoading(false);
    }
  };
  const resetForm = () => {
    setMessage("");
    setResult(null);
    setResultTimestamp(null);
    setError("");
  };

  // /accept-invite?token=... is a standalone page, not part of the
  // normal tool/progress/team views — handled with a plain pathname
  // check since there's no router in this app for a single extra URL.
  // This has to come after all the hooks above (Rules of Hooks), not
  // before them, even though it's an early return.
  if (window.location.pathname === "/accept-invite") {
    return <AcceptInvite />;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f7fb",
        padding: "40px"
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg, ${VIOLET}, #a855f7)`,
          padding: "18px 30px",
          borderRadius: "16px",
          color: "white",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px"
          }}
        >
          <div
            style={{
              position: "relative",
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}
          >
            <HiOutlineChatBubbleLeftRight size={24} color="white" />
            <HiSparkles
              size={14}
              color="white"
              style={{ position: "absolute", top: "2px", right: "2px" }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: "700",
                lineHeight: "1.2"
              }}
            >
              Clarity Coach
            </div>
            <div
              style={{
                fontSize: "13px",
                color: "rgba(255,255,255,0.85)"
              }}
            >
              Improve your workplace communication
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(255,255,255,0.12)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.6)",
            padding: "8px 16px",
            borderRadius: "999px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px"
          }}
        >
          <HiOutlineInformationCircle size={18} />
          How it works
        </button>
      </div>

      {showHowItWorks && (
        <div
          style={{
            ...sectionCard,
            marginBottom: "20px",
            background: "#f5f3ff",
            border: "1px solid #ddd6fe",
            color: "#4c1d95"
          }}
        >
          Paste any workplace message and Clarity Coach analyzes it for
          clarity, politeness, and professionalism, then gives you four
          rewritten versions — Professional, Friendly, Concise, and
          Executive — plus one practical tip. Sign in to save your
          history and track your scores over time.
        </div>
      )}

      {!authLoading && (
        session ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "12px",
              marginBottom: "30px",
              color: "#334155"
            }}
          >
            <span>Signed in as {session.user.email}</span>
            {!isPlatformAdmin && (
              <button
                onClick={() =>
                  setView(view === "progress" ? "tool" : "progress")
                }
                style={{
                  background: view === "progress" ? VIOLET : "#ffffff",
                  color: view === "progress" ? "#ffffff" : VIOLET,
                  border: `1px solid ${VIOLET}`,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                My Progress
              </button>
            )}
            {!isPlatformAdmin && (
              <button
                onClick={() => setView(view === "team" ? "tool" : "team")}
                style={{
                  background: view === "team" ? VIOLET : "#ffffff",
                  color: view === "team" ? "#ffffff" : VIOLET,
                  border: `1px solid ${VIOLET}`,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                Dashboard
              </button>
            )}
            {isPlatformAdmin && (
              <button
                onClick={() => setView(view === "platform" ? "tool" : "platform")}
                style={{
                  background: view === "platform" ? VIOLET : "#ffffff",
                  color: view === "platform" ? "#ffffff" : VIOLET,
                  border: `1px solid ${VIOLET}`,
                  padding: "6px 14px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600"
                }}
              >
                Dashboard
              </button>
            )}
            <button
              onClick={handleSignOut}
              style={{
                background: "#ffffff",
                color: VIOLET,
                border: `1px solid ${VIOLET}`,
                padding: "6px 14px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600"
              }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <Auth />
        )
      )}

      {view === "progress" && session ? (
        <ProgressView session={session} onBack={() => setView("tool")} />
      ) : view === "team" && session ? (
        <TeamView session={session} onBack={() => setView("tool")} />
      ) : view === "platform" && session && isPlatformAdmin ? (
        <PlatformView session={session} onBack={() => setView("tool")} />
      ) : (
      <>
      <div
        style={{
          background: "white",
          padding: "30px",
          borderRadius: "16px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginBottom: "30px"
        }}
      >
        <div style={cardHeader("#0f172a")}>
          <HiOutlineChatBubbleLeftRight size={24} color={VIOLET} />
          <h3
            style={{
              margin: 0,
              fontSize: "22px"
            }}
          >
            Paste your message
          </h3>
        </div>
        <p
          style={{
            color: "#64748b",
            fontSize: "14px",
            marginTop: 0,
            marginBottom: "16px"
          }}
        >
          We'll help you communicate more clearly and professionally.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center"
          }}
        >

          <textarea
            rows="8"
            maxLength={1000}
            placeholder="Enter your message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #c4b5fd",
              fontSize: "18px"
            }}
          />
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: "12px",
            color: "#94a3b8",
            marginTop: "4px"
          }}
        >
          {message.length} / 1000
        </div>

        {error && (
          <div
            style={{
              color: "#ef4444",
              marginTop: "10px",
              fontWeight: "600",
              textAlign: "center"
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginTop: "16px" }}>
          <button
            onClick={improveMessage}
            disabled={loading}
            style={{
              background: VIOLET,
              color: "white",
              border: "none",
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: "600",
              borderRadius: "10px",
              cursor: "pointer"
            }}
          >
            {loading
              ? "✨ Improving..."
              : "✨ Improve Message"}
          </button>
          <button
            onClick={resetForm}
            style={{
              marginLeft: "10px",
              padding: "12px 24px",
              background: "#ffffff",
              color: VIOLET,
              border: `2px solid ${VIOLET}`,
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "600",
              borderRadius: "10px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px"
            }}
          ><MdRefresh /> Reset</button>
        </div>
      </div>
      <br />
      {result && (
        <div
          style={{
            background: "#ffffff",
            margin: "20px auto",
            textAlign: "left",
            padding: "30px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "25px",
              flexWrap: "wrap",
              gap: "8px"
            }}
          >
            <div style={cardHeader("#0f172a")}>
              <HiOutlineDocumentText size={28} color={VIOLET} />
              <h2
                style={{
                  margin: 0,
                  fontSize: "28px",
                  fontWeight: "700"
                }}
              >
                Your Results
              </h2>
            </div>
            <span style={{ color: "#94a3b8", fontSize: "13px" }}>
              {formatRelativeTime(resultTimestamp)}
            </span>
          </div>
          <div
            style={{
              background: "#f5f3ff",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px",
              border: "1px solid #ddd6fe"
            }}
          >
            <div
              style={{
                color: VIOLET,
                fontWeight: "700",
                fontSize: "12px",
                letterSpacing: "0.05em",
                marginBottom: "6px"
              }}
            >
              BEFORE
            </div>
            <p style={{ margin: 0 }}>{message}</p>
          </div>
          <h2>After</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "20px"
            }}
          >
            <div style={toneCard}>
              <div style={cardHeader("#2563eb")}>
                <HiOutlineBriefcase size={20} />
                <h3 style={{ margin: 0, fontSize: "17px" }}>
                  Professional
                </h3>
              </div>
              <p>{result.rewrites.professional}</p>
              <br />
              <p>
                <strong>Best For:</strong>
              </p>
              <BestForItem>Email</BestForItem>
              <BestForItem>Workplace Requests</BestForItem>
              <BestForItem>General Business Communication</BestForItem>
              <button
                onClick={() =>
                  copyText(
                    result.rewrites.professional,
                    "professional"
                  )
                }
                style={copyButtonStyle("#2563eb")}
              >
                <HiOutlineClipboardDocument size={16} />
                {copiedTone === "professional"
                  ? "Copied! ✅"
                  : "Copy"}
              </button>
            </div>
            <div style={toneCard}>
              <div style={cardHeader("#16a34a")}>
                <HiOutlineFaceSmile size={20} />
                <h3 style={{ margin: 0, fontSize: "17px" }}>
                  Friendly
                </h3>
              </div>
              <p>{result.rewrites.friendly}</p>
              <br />
              <p>
                <strong>Best For:</strong>
              </p>
              <BestForItem>Teams Chat</BestForItem>
              <BestForItem>Colleagues</BestForItem>
              <BestForItem>Informal Follow-Ups</BestForItem>
              <button
                onClick={() =>
                  copyText(
                    result.rewrites.friendly,
                    "friendly"
                  )
                }
                style={copyButtonStyle("#16a34a")}
              >
                <HiOutlineClipboardDocument size={16} />
                {copiedTone === "friendly"
                  ? "Copied! ✅"
                  : "Copy"}
              </button>
            </div>

            <div style={toneCard}>
              <div style={cardHeader("#f59e0b")}>
                <HiOutlineBolt size={20} />
                <h3 style={{ margin: 0, fontSize: "17px" }}>
                  Concise
                </h3>
              </div>
              <p>{result.rewrites.concise}</p>
              <br />
              <p>
                <strong>Best For:</strong>
              </p>
              <BestForItem>Quick Messages</BestForItem>
              <BestForItem>Time-Sensitive Requests</BestForItem>
              <BestForItem>Busy Recipients</BestForItem>
              <button
                onClick={() =>
                  copyText(
                    result.rewrites.concise,
                    "concise"
                  )
                }
                style={copyButtonStyle("#f59e0b")}
              >
                <HiOutlineClipboardDocument size={16} />
                {copiedTone === "concise"
                  ? "Copied! ✅"
                  : "Copy"}
              </button>
            </div>

            <div style={toneCard}>
              <div style={cardHeader(VIOLET)}>
                <FaCrown size={18} />
                <h3 style={{ margin: 0, fontSize: "17px" }}>
                  Executive
                </h3>
              </div>
              <p>{result.rewrites.executive}</p>
              <br />
              <p>
                <strong>Best For:</strong>
              </p>
              <BestForItem>Leadership Communication</BestForItem>
              <BestForItem>Executive Audiences</BestForItem>
              <BestForItem>Formal Business Requests</BestForItem>
              <button
                onClick={() =>
                  copyText(
                    result.rewrites.executive,
                    "executive"
                  )
                }
                style={copyButtonStyle(VIOLET)}
              >
                <HiOutlineClipboardDocument size={16} />
                {copiedTone === "executive"
                  ? "Copied! ✅"
                  : "Copy"}
              </button>
            </div>
          </div>
          <br />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px"
            }}
          >
            <div style={sectionCard}>
              <div style={cardHeader("#0f172a")}>
                <HiOutlineLightBulb size={22} color="#f59e0b" />
                <h2 style={{ margin: 0, fontSize: "19px" }}>
                  Why This Works
                </h2>
              </div>
              <p>{result.explanation}</p>
            </div>
            <div style={sectionCard}>
              <div style={cardHeader("#0f172a")}>
                <HiOutlineStar size={22} color={VIOLET} />
                <h2 style={{ margin: 0, fontSize: "19px" }}>
                  Communication Scores
                </h2>
              </div>
              <p>Clarity: {result.scores.clarity}/10</p>
              <ScoreBar score={result.scores.clarity} />
              <p>Politeness: {result.scores.politeness}/10</p>
              <ScoreBar score={result.scores.politeness} />
              <p>
                Professionalism: {result.scores.professionalism}/10
              </p>
              <ScoreBar score={result.scores.professionalism} />
            </div>
          </div>
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              borderRadius: "12px",
              padding: "24px",
              marginTop: "20px"
            }}
          >
            <div style={cardHeader("#065f46")}>
              <HiOutlineGlobeAlt size={22} />
              <h2 style={{ margin: 0, fontSize: "19px" }}>
                Workplace Communication Tip
              </h2>
            </div>
            <p style={{ margin: 0, color: "#065f46" }}>{result.tip}</p>
          </div>
        </div>
      )}
      </>
      )}
      <div
        style={{
          textAlign: "center",
          marginTop: "40px",
          color: "#64748b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px"
        }}
      >
        <HiOutlineHeart size={16} color={VIOLET} />
        Clarity Coach helps ESL professionals communicate with confidence.
      </div>
    </div>

  );
}

export default App;
