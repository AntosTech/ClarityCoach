import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { API_URL } from "./config";

const cardStyle = {
  background: "white",
  padding: "30px",
  borderRadius: "16px",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  marginBottom: "30px"
};

const formatDate = (isoString) =>
  new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });

function ProgressView({ session, onBack }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/history`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load your history.");
        }

        setSubmissions(data.submissions || []);
      } catch (err) {
        // Log the real error for debugging, but never show raw library/auth
        // error text (e.g. Supabase's "JWT issued at future" clock-skew
        // message) directly to the user — it's confusing and not actionable
        // from here.
        console.error(err);
        setError("Unable to load your history. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    const fetchInsights = async () => {
      setInsightsLoading(true);
      setInsightsError("");
      try {
        const response = await fetch(`${API_URL}/insights`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load your insight.");
        }

        setInsights(data);
      } catch (err) {
        console.error(err);
        setInsightsError("Unable to load your insight. Please try again.");
      } finally {
        setInsightsLoading(false);
      }
    };

    fetchHistory();
    fetchInsights();
  }, [session]);

  const chartData = submissions.map((s) => ({
    date: formatDate(s.created_at),
    Clarity: s.clarity_score,
    Politeness: s.politeness_score,
    Professionalism: s.professionalism_score
  }));

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}
      >
        <h2 style={{ margin: 0 }}>My Progress</h2>
        <button
          onClick={onBack}
          style={{
            background: "#ffffff",
            color: "#7C3AED",
            border: "2px solid #7C3AED",
            padding: "10px 20px",
            borderRadius: "10px",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          Back to Tool
        </button>
      </div>

      {insightsLoading && (
        <div style={cardStyle}>Analyzing your patterns...</div>
      )}

      {!insightsLoading && insightsError && (
        <div
          style={{
            ...cardStyle,
            color: "#ef4444",
            fontWeight: "600"
          }}
        >
          {insightsError}
        </div>
      )}

      {!insightsLoading && !insightsError && insights && !insights.ready && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Coach's Insight</h3>
          <p style={{ margin: 0, color: "#64748b" }}>
            Improve {insights.minimumRequired - insights.count} more message
            {insights.minimumRequired - insights.count === 1 ? "" : "s"} to
            unlock a personalized pattern insight based on your history.
          </p>
        </div>
      )}

      {!insightsLoading && !insightsError && insights && insights.ready && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Coach's Insight</h3>

          {insights.insight && (
            <p
              style={{
                fontStyle: "italic",
                color: "#334155",
                background: "#f8fafc",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb"
              }}
            >
              {insights.insight}
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: "20px",
              flexWrap: "wrap",
              marginTop: "16px"
            }}
          >
            {Object.entries(insights.trend).map(([label, t]) => (
              <div key={label} style={{ minWidth: "160px" }}>
                <div
                  style={{
                    fontWeight: "600",
                    color:
                      label === insights.weakestDimension
                        ? "#ef4444"
                        : "#0f172a"
                  }}
                >
                  {label}
                  {label === insights.weakestDimension && " (focus area)"}
                </div>
                <div style={{ color: "#64748b", fontSize: "14px" }}>
                  Avg: {insights.overallAverages[label]}/10
                </div>
                {t.delta !== null && (
                  <div
                    style={{
                      fontSize: "14px",
                      color:
                        t.delta > 0
                          ? "#16a34a"
                          : t.delta < 0
                            ? "#ef4444"
                            : "#64748b"
                    }}
                  >
                    {t.delta > 0
                      ? `▲ +${t.delta} recently`
                      : t.delta < 0
                        ? `▼ ${t.delta} recently`
                        : "No recent change"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div style={cardStyle}>Loading your history...</div>}

      {error && (
        <div
          style={{
            ...cardStyle,
            color: "#ef4444",
            fontWeight: "600"
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && submissions.length === 0 && (
        <div style={cardStyle}>
          No messages saved yet. Sign in and improve a message to start
          tracking your progress.
        </div>
      )}

      {!loading && !error && submissions.length > 0 && (
        <>
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>Score Trends</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[1, 10]} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Clarity"
                  stroke="#2563eb"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Politeness"
                  stroke="#16a34a"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Professionalism"
                  stroke="#7c3aed"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>
              History ({submissions.length} message
              {submissions.length === 1 ? "" : "s"})
            </h3>
            {[...submissions]
              .reverse()
              .map((s) => (
                <div
                  key={s.id}
                  style={{
                    borderBottom: "1px solid #e5e7eb",
                    padding: "14px 0"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#64748b",
                      fontSize: "13px",
                      marginBottom: "6px"
                    }}
                  >
                    <span>{formatDate(s.created_at)}</span>
                    <span>
                      Clarity {s.clarity_score} · Politeness{" "}
                      {s.politeness_score} · Professionalism{" "}
                      {s.professionalism_score}
                    </span>
                  </div>
                  <div>{s.original_message}</div>
                  {s.tip && (
                    <div
                      style={{
                        marginTop: "6px",
                        fontSize: "14px",
                        color: "#334155",
                        fontStyle: "italic"
                      }}
                    >
                      Tip: {s.tip}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ProgressView;
