import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

// App.jsx talks to Supabase on mount (auth.getSession / onAuthStateChange)
// to figure out whether someone's signed in. Mock the client so these
// tests never touch a real Supabase project.
vi.mock("./supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })),
      signOut: vi.fn()
    }
  }
}));

const VALID_RESPONSE = {
  rewrites: {
    professional: "Could you please respond?",
    friendly: "Could you get back to me? Thanks!",
    concise: "Please respond.",
    executive: "Please provide a response at your earliest convenience."
  },
  explanation: "The message was direct; the rewrites add courtesy.",
  scores: { clarity: 6, politeness: 3, professionalism: 4 },
  tip: "Add a polite opener."
};

function mockFetchOnce(body, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body)
  });
}

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the message form", async () => {
    render(<App />);

    expect(
      await screen.findByPlaceholderText("Enter your message")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /improve message/i })
    ).toBeInTheDocument();
  });

  it("shows a validation error and does not call the API when the message is empty", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /improve message/i }));

    expect(
      await screen.findByText("Please enter a message.")
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("displays results after a successful improve request", async () => {
    mockFetchOnce(VALID_RESPONSE);
    const user = userEvent.setup();
    render(<App />);

    await user.type(
      screen.getByPlaceholderText("Enter your message"),
      "send me the file"
    );
    await user.click(screen.getByRole("button", { name: /improve message/i }));

    expect(await screen.findByText("Your Results")).toBeInTheDocument();
    expect(
      screen.getByText(VALID_RESPONSE.rewrites.professional)
    ).toBeInTheDocument();
  });

  it("shows a generic error message when the API call fails", async () => {
    mockFetchOnce({ error: "boom" }, false);
    const user = userEvent.setup();
    render(<App />);

    await user.type(
      screen.getByPlaceholderText("Enter your message"),
      "send me the file"
    );
    await user.click(screen.getByRole("button", { name: /improve message/i }));

    expect(
      await screen.findByText(
        "Unable to improve your message. Please try again."
      )
    ).toBeInTheDocument();
  });

  it("reset clears the message and the results", async () => {
    mockFetchOnce(VALID_RESPONSE);
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByPlaceholderText("Enter your message");
    await user.type(textarea, "send me the file");
    await user.click(screen.getByRole("button", { name: /improve message/i }));
    expect(await screen.findByText("Your Results")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reset/i }));

    expect(textarea).toHaveValue("");
    expect(screen.queryByText("Your Results")).not.toBeInTheDocument();
  });
});
