import { useState } from "react";
import { HiSparkles } from "react-icons/hi2";
import { MdRefresh } from "react-icons/md";
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
function App() {
  //const pageWidth = {
  //maxWidth: "1100px",
  //margin: "0 auto"
  //};
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copiedTone, setCopiedTone] = useState("");
  const copyText = (text, tone) => {
    navigator.clipboard.writeText(text);
    setCopiedTone(tone);
    setTimeout(() => {
      setCopiedTone("");
    }, 2000);
  };
  const copyButtonStyle = {
    padding: "8px 16px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "12px",
    fontWeight: "600"
  };
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
    marginTop: "20px",
    border: "1px solid #e5e7eb",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
  };
  const improveMessage = async () => {
    if (!message.trim()) {
      setError("Please enter a message.");
      return;
    }

    setError("");
    try {
      setLoading(true);


      const response = await fetch(
        "http://localhost:3001/improve",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
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
      console.log(data);
      setResult(data);
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
    setError("");
  };

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
          background:
            "linear-gradient(135deg,#2563eb,#7c3aed)",
          padding: "40px",
          borderRadius: "16px",
          color: "white",
          textAlign: "center",
          marginBottom: "30px",
          boxShadow:
            "0 8px 24px rgba(0,0,0,0.15)"
        }}
      >

        <img
          src="/logos/lockup-reversed-2x.png"
          alt="Clarity Coach Logo"
          style={{
            maxWidth: "400px",
            width: "100%"
          }}
        />
        <p style={{
          fontSize: "15px", padding: "5px", fontStyle: "italic"
        }}>Communicate Clearly. Work Confidently.</p>
      </div>
      <div
        style={{
          background: "white",
          padding: "30px",
          borderRadius: "16px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginBottom: "30px"
        }}
      ><h3
        style={{
          textAlign: "center",
          fontSize: "24px",
          marginBottom: "20px"
        }}
      >
          Paste your message
        </h3>

        <div
          style={{
            display: "flex",
            justifyContent: "center"
          }}
        >

          <textarea
            rows="8"
            placeholder="Enter your message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #ccc",
              fontSize: "18px"
            }}
          /> </div>{error && (
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

        <br />
        <button
          onClick={improveMessage}
          disabled={loading}
          style={{
            //background: "linear-gradient(90deg,#2563eb,#3b82f6)",
            background: "#7C3AED",
            color: "white",
            border: "none",
            padding: "16px 40px",
            fontSize: "20px",
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
            padding: "16px 40px",
            //backgroundColor: "#ef4444",
            background: "#ffffff",
            color: "#7C3AED",
            border: "2px solid #7C3AED",
            borderColor: "#7C3AED",
            cursor: "pointer",
            fontSize: "20px",
            fontWeight: "600",
            borderRadius: "10px"
          }}
        ><MdRefresh /> Reset</button></div>
      <br />
      {result && (
        <div
          style={{
            background: "#ffffff",
            //maxWidth: "900px",
            margin: "20px auto",
            textAlign: "left",
            padding: "30px",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}
        >
          <h2
            style={{
              color: "#0f172a",
              fontSize: "32px",
              fontWeight: "700",
              marginBottom: "25px"
            }}
          >
            Your Results
          </h2>
          <div
            style={{
              background: "#f8fafc",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "20px"
            }}
          >
            <h2>Before</h2>
            <p>{message}</p>
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
              <h3
                style={{
                  color: "#2563eb",
                  marginBottom: "15px"
                }}
              >
                💼 Professional
              </h3>
              <p>{result.rewrites.professional}</p>
              <br />
              <p>
                <strong>Best For:</strong>
              </p>
              <p>✅ Email</p>
              <p>✅ Workplace Requests</p>
              <p>✅ General Business Communication</p>
              <br />
              <button
                onClick={() =>
                  copyText(
                    result.rewrites.professional,
                    "professional"
                  )
                }
                style={copyButtonStyle}
              >
                {copiedTone === "professional"
                  ? "Copied! ✅"
                  : "Copy"}
              </button>
            </div>
            <div style={toneCard}>
              <h3
                style={{
                  color: "#16a34a",
                  marginBottom: "15px"
                }}
              >
                😊 Friendly
              </h3>
              <p>{result.rewrites.friendly}</p>
              <br />
              <p>
                <strong>Best For:</strong>
              </p>
              <p>✅ Teams Chat</p>
              <p>✅ Colleagues</p>
              <p>✅ Informal Follow-Ups</p>
              <br />
              <button
                onClick={() =>
                  copyText(
                    result.rewrites.friendly,
                    "friendly"
                  )
                }
                style={copyButtonStyle}
              >
                {copiedTone === "friendly"
                  ? "Copied! ✅"
                  : "Copy"}
              </button>
            </div>

            <div style={toneCard}>
              <h3
                style={{
                  color: "#f59e0b",
                  marginBottom: "15px"
                }}
              >
                ⚡ Concise
              </h3>
              <p>{result.rewrites.concise}</p>
              <br />
              <p>
                <strong>Best For:</strong>
              </p>
              <p>✅ Quick Messages</p>
              <p>✅ Time-Sensitive Requests</p>
              <p>✅ Busy Recipients</p>
              <br />
              <button
                onClick={() =>
                  copyText(
                    result.rewrites.concise,
                    "concise"
                  )
                }
                style={copyButtonStyle}
              >
                {copiedTone === "concise"
                  ? "Copied! ✅"
                  : "Copy"}
              </button>
            </div>

            <div style={toneCard}>
              <h3
                style={{
                  color: "#7c3aed",
                  marginBottom: "15px"
                }}
              >
                👑 Executive
              </h3>
              <p>{result.rewrites.executive}</p>
              <br />
              <p>
                <strong>Best For:</strong>
              </p>
              <p>✅ Leadership Communication</p>
              <p>✅ Executive Audiences</p>
              <p>✅ Formal Business Requests</p>
              <br />
              <button
                onClick={() =>
                  copyText(
                    result.rewrites.executive,
                    "executive"
                  )
                }
                style={copyButtonStyle}
              >
                {copiedTone === "executive"
                  ? "Copied! ✅"
                  : "Copy"}
              </button>
            </div></div>
          <br />
          <div style={sectionCard}>
            <h2>💡 Why This Works</h2>
            <p>{result.explanation}</p>
          </div>
          <div style={sectionCard}>
            <h2>⭐ Communication Scores</h2>
            <p>Clarity: {result.scores.clarity}/10</p>
            <ScoreBar
              score={result.scores.clarity} /><p>
              Politeness:
              {result.scores.politeness}/10</p>
            <ScoreBar
              score={result.scores.politeness} />
            <p>
              Professionalism:
              {result.scores.professionalism}/10</p>
            <ScoreBar
              score={result.scores.professionalism} />
          </div>
          <div style={sectionCard}>
            <h2>🌎 Workplace Communication Tip</h2>
            <p>{result.tip}</p>
          </div>
        </div>
      )}
      <div
        style={{
          textAlign: "center",
          marginTop: "40px",
          color: "#64748b"
        }}
      >
        Clarity Coach helps ESL professionals communicate with confidence. v4.1
      </div>
    </div>

  );
}

export default App;