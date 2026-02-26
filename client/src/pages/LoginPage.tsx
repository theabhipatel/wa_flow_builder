import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { loginSuccess } from "../store/authSlice";
import api from "../lib/api";
import {
  MessageSquare,
  Eye,
  EyeOff,
  Loader2,
  User,
  Shield,
  Zap,
  GitBranch,
  Bot,
} from "lucide-react";

export default function LoginPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister
        ? { firstName, lastName, email, password }
        : { email, password };
      const res = await api.post(endpoint, payload);

      if (res.data.success) {
        dispatch(loginSuccess(res.data.data));
        navigate("/");
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: "rgba(30, 41, 59, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.2)",
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.border = "1px solid rgba(99, 102, 241, 0.5)";
    e.target.style.boxShadow =
      "inset 0 1px 3px rgba(0, 0, 0, 0.2), 0 0 0 3px rgba(99, 102, 241, 0.15)";
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.border = "1px solid rgba(255, 255, 255, 0.08)";
    e.target.style.boxShadow = "inset 0 1px 3px rgba(0, 0, 0, 0.2)";
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-surface-900">
      {/* ──────── LEFT PANEL — Branding ──────── */}
      <div className="hidden lg:flex lg:w-[55%] relative items-center justify-center bg-gradient-to-br from-surface-900 via-brand-950 to-surface-900 overflow-hidden">
        {/* Animated background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute -top-32 -right-32 w-80 h-80 rounded-full animate-pulse-soft"
            style={{
              background:
                "radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)",
              filter: "blur(50px)",
            }}
          />
          <div
            className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full animate-pulse-soft"
            style={{
              background:
                "radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)",
              filter: "blur(50px)",
              animationDelay: "1s",
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full animate-pulse-soft"
            style={{
              background:
                "radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, transparent 60%)",
              filter: "blur(80px)",
              animationDelay: "0.5s",
            }}
          />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        {/* Branding content */}
        <div className="relative z-10 px-12 max-w-lg">
          {/* Logo */}
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 mb-6 shadow-2xl shadow-brand-500/30">
            <MessageSquare className="w-7 h-7 text-white" />
            <div
              className="absolute inset-0 rounded-2xl animate-pulse-soft"
              style={{
                boxShadow:
                  "0 0 25px rgba(99, 102, 241, 0.4), 0 0 50px rgba(99, 102, 241, 0.12)",
              }}
            />
          </div>

          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight leading-tight">
            WA Flow Builder
          </h1>
          <p className="text-surface-400 text-base mb-10 leading-relaxed">
            Build powerful WhatsApp automation flows visually. Drag, drop, and
            deploy conversational experiences in minutes.
          </p>

          {/* Feature highlights */}
          <div className="space-y-4">
            {[
              {
                icon: GitBranch,
                label: "Visual Flow Editor",
                desc: "Drag & drop node-based builder",
              },
              {
                icon: Bot,
                label: "Smart Automation",
                desc: "AI-powered conversation routing",
              },
              {
                icon: Zap,
                label: "Instant Deploy",
                desc: "Go live with one click",
              },
            ].map((feature) => (
              <div
                key={feature.label}
                className="flex items-center gap-4 group"
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: "rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.15)",
                  }}
                >
                  <feature.icon className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {feature.label}
                  </p>
                  <p className="text-surface-500 text-xs">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom footer */}
          <div
            className="mt-6 pt-6 flex justify-between items-end"
            style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
          >
            <DevelopedBy />
            <p className="text-surface-600 text-xs mb-0.5">
              © {new Date().getFullYear()} WA Flow Builder · Secure & Encrypted
            </p>
          </div>
        </div>
      </div>

      {/* ──────── RIGHT PANEL — Login Form ──────── */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-surface-900 via-surface-900 to-brand-950 relative overflow-hidden">
        {/* Subtle orb on the right panel */}
        <div className="absolute inset-0 pointer-events-none lg:block hidden">
          <div
            className="absolute top-0 right-0 w-72 h-72 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />
        </div>

        <div className="relative w-full max-w-md px-6 sm:px-8 animate-fade-in">
          {/* Mobile-only logo (hidden on lg) */}
          <div className="lg:hidden text-center mb-6">
            <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 mb-3 shadow-xl shadow-brand-500/25">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              WA Flow Builder
            </h1>
          </div>

          {/* Form Card */}
          <div
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{
              background: "rgba(15, 23, 42, 0.7)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              boxShadow:
                "0 20px 40px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04) inset",
            }}
          >
            {/* Top accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[1px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), rgba(139, 92, 246, 0.5), transparent)",
              }}
            />

            <h2 className="text-lg font-semibold text-white mb-0.5">
              {isRegister ? "Create Account" : "Welcome Back"}
            </h2>
            <p className="text-surface-500 text-sm mb-5">
              {isRegister
                ? "Set up your account to get started"
                : "Sign in to continue to your dashboard"}
            </p>

            {error && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Abhi"
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-surface-600 transition-all duration-200 focus:outline-none"
                      style={inputStyle}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-surface-300 mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Patel"
                      className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-surface-600 transition-all duration-200 focus:outline-none"
                      style={inputStyle}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      required
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-surface-600 transition-all duration-200 focus:outline-none"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-surface-600 transition-all duration-200 focus:outline-none pr-10"
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300 transition-colors duration-200"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 text-white text-sm font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  boxShadow:
                    "0 4px 15px rgba(79, 70, 229, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 6px 25px rgba(79, 70, 229, 0.5), 0 1px 3px rgba(0, 0, 0, 0.2)";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 4px 15px rgba(79, 70, 229, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)";
                  (e.currentTarget as HTMLElement).style.transform =
                    "translateY(0)";
                }}
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading
                  ? "Please wait..."
                  : isRegister
                    ? "Create Account"
                    : "Sign In"}
              </button>
            </form>

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError("");
                }}
                className="text-sm text-surface-400 hover:text-brand-400 transition-colors duration-200"
              >
                {isRegister
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Register"}
              </button>
            </div>
          </div>

          {/* Footer below card */}
          <p className="text-center text-[11px] text-surface-600 mt-4">
            Secure login · Wa Flow Builder by TheAbhiPatel
          </p>
        </div>
      </div>
    </div>
  );
}

const DevelopedBy = () => {
  return (
    <div className="flex flex-col">
      <span className="text-gray-300/50 text-xs leading-none">
        Developed by
      </span>
      <Link to={"https://www.theabhipatel.com/"} target="_theabhipatel">
        <span className="bg-gradient-to-r from-orange-600 via-orange-500 to-yellow-500 bg-clip-text text-lg leading-none font-semibold tracking-wide text-transparent">
          TheAbhiPatel
        </span>
      </Link>
    </div>
  );
};
