import { useState } from "react";
import { supabase } from "./supabaseClient";

// emailRedirectTo is optional. When a caller (like AcceptInvite) is using
// this component mid-flow and needs the user to land back on a specific
// URL after confirming their email, it passes that URL here. Left
// undefined for normal sign-up, which just uses the project's default
// Site URL.
function Auth({ emailRedirectTo } = {}) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const cardStyle = {
    background: "white",
    padding: "30px",
    borderRadius: "16px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
    maxWidth: "400px",
    margin: "0 auto 30px auto"
  };

  const inputStyle = {
    width: "100%",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "16px",
    marginBottom: "12px",
    boxSizing: "border-box"
  };

  const buttonStyle = {
    width: "100%",
    background: "#7C3AED",
    color: "white",
    border: "none",
    padding: "12px",
    fontSize: "16px",
    fontWeight: "600",
    borderRadius: "10px",
    cursor: "pointer"
  };

  const linkStyle = {
    background: "none",
    border: "none",
    color: "#7C3AED",
    cursor: "pointer",
    fontSize: "14px",
    textDecoration: "underline",
    marginTop: "12px"
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const trimmedName = fullName.trim();
        const signUpOptions = {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          ...(trimmedName ? { data: { full_name: trimmedName } } : {})
        };
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          ...(Object.keys(signUpOptions).length ? { options: signUpOptions } : {})
        });
        if (signUpError) throw signUpError;
        setMessage(
          "Account created. Check your email to confirm, then sign in."
        );
        setMode("signin");
      } else {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password
          });
        if (signInError) throw signInError;
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={cardStyle}>
      <h3
        style={{
          textAlign: "center",
          fontSize: "20px",
          marginBottom: "20px"
        }}
      >
        {mode === "signup" ? "Create an account" : "Sign in"}
      </h3>

      <form onSubmit={handleSubmit}>
        {mode === "signup" && (
          <input
            type="text"
            placeholder="Full name (optional)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && (
          <div
            style={{
              color: "#ef4444",
              fontWeight: "600",
              marginBottom: "12px",
              textAlign: "center"
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              color: "#16a34a",
              fontWeight: "600",
              marginBottom: "12px",
              textAlign: "center"
            }}
          >
            {message}
          </div>
        )}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading
            ? "Please wait..."
            : mode === "signup"
              ? "Sign Up"
              : "Sign In"}
        </button>
      </form>

      <div style={{ textAlign: "center" }}>
        <button
          type="button"
          style={linkStyle}
          onClick={() => {
            setError("");
            setMessage("");
            setMode(mode === "signup" ? "signin" : "signup");
          }}
        >
          {mode === "signup"
            ? "Already have an account? Sign in"
            : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

export default Auth;
