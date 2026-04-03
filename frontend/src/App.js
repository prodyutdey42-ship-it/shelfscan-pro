import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import axios from "axios";
import { 
  TrendingUp, 
  CheckCircle2, 
  FileText, 
  Plus, 
  ArrowLeft, 
  Upload, 
  Camera, 
  AlertCircle, 
  Download,
  History,
  LogOut,
  User,
  Scan,
  Calendar,
  BarChart3,
  Trash2
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configure axios
axios.defaults.withCredentials = true;

// ==================== AUTH CONTEXT ====================

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes('session_id=')) {
      setLoading(false);
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      window.location.href = '/';
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// ==================== AUTH CALLBACK ====================

const AuthCallback = () => {
  const navigate = useNavigate();
  const { setUser, checkAuth } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      // Use window.location.hash directly for reliability
      const hash = window.location.hash;
      const sessionIdMatch = hash.match(/session_id=([^&]+)/);
      
      if (sessionIdMatch) {
        const sessionId = sessionIdMatch[1];
        try {
          const response = await axios.post(`${API}/auth/session`, {
            session_id: sessionId
          });
          
          // Clear the hash from URL immediately
          window.history.replaceState(null, '', window.location.pathname);
          
          // Set user in context
          setUser(response.data);
          
          // Navigate to dashboard with user data
          navigate('/dashboard', { replace: true, state: { user: response.data } });
        } catch (error) {
          console.error("Auth callback error:", error);
          // Clear hash and redirect to home on error
          window.history.replaceState(null, '', '/');
          navigate('/', { replace: true });
        }
      } else {
        navigate('/', { replace: true });
      }
    };

    processAuth();
  }, [navigate, setUser, checkAuth]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-slate-400">Signing you in...</p>
      </div>
    </div>
  );
};

// ==================== PROTECTED ROUTE ====================

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user && !location.state?.user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// ==================== LANDING PAGE ====================

const LandingPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden" data-testid="landing-page">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1920&q=80')`
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Scan className="w-8 h-8 text-cyan-400" />
            <span className="text-xl font-bold text-white">ShelfScan AI</span>
          </div>
          <button
            onClick={login}
            data-testid="header-login-btn"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            Sign in with Google
          </button>
        </header>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            ShelfScan <span className="text-cyan-400">AI</span>
          </h1>
          <p className="text-xl text-slate-300 mb-4 max-w-2xl">
            AI-powered retail shelf auditing for FMCG and retail businesses.
          </p>
          <p className="text-lg text-slate-400 mb-10 max-w-xl">
            Detect stock issues, misplacements, and get actionable insights in seconds.
          </p>
          
          <button
            onClick={login}
            data-testid="start-audit-btn"
            className="px-8 py-4 bg-white text-slate-900 rounded-full font-semibold text-lg hover:bg-slate-100 transition-all flex items-center gap-3 shadow-xl shadow-white/10"
          >
            <Scan className="w-5 h-5" />
            Start Your First Audit
          </button>
        </main>

        {/* Features */}
        <section className="px-6 pb-20">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<CheckCircle2 className="w-8 h-8 text-cyan-400" />}
              title="Stock Detection"
              description="Identify out-of-stock items instantly"
            />
            <FeatureCard
              icon={<TrendingUp className="w-8 h-8 text-cyan-400" />}
              title="Compliance Score"
              description="Get instant shelf compliance ratings"
            />
            <FeatureCard
              icon={<FileText className="w-8 h-8 text-amber-400" />}
              title="PDF Reports"
              description="Download detailed audit reports"
            />
          </div>
        </section>
      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 text-center">
    <div className="flex justify-center mb-4">{icon}</div>
    <h3 className="text-sm font-semibold text-slate-300 tracking-wider uppercase mb-2">{title}</h3>
    <p className="text-slate-500 text-sm">{description}</p>
  </div>
);

// ==================== DASHBOARD ====================

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({ total_audits: 0, avg_score: 0, this_week: 0 });
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentUser = location.state?.user || user;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, auditsRes] = await Promise.all([
          axios.get(`${API}/dashboard/stats`),
          axios.get(`${API}/audits`)
        ]);
        setStats(statsRes.data);
        setAudits(auditsRes.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="dashboard">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Scan className="w-7 h-7 text-cyan-400" />
            <span className="text-lg font-bold">ShelfScan AI</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/history')}
              data-testid="history-nav-btn"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              History
            </button>
            <div className="flex items-center gap-3">
              {currentUser?.picture && (
                <img src={currentUser.picture} alt="" className="w-8 h-8 rounded-full" />
              )}
              <span className="text-sm text-slate-400">{currentUser?.name}</span>
              <button
                onClick={logout}
                data-testid="logout-btn"
                className="p-2 hover:bg-slate-800 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Title Section */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Audit Dashboard</h1>
            <p className="text-slate-400">View your audit history and start new audits</p>
          </div>
          <button
            onClick={() => navigate('/new-audit')}
            data-testid="new-audit-btn"
            className="px-6 py-3 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Audit
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-cyan-400" />}
            label="Total Audits"
            value={stats.total_audits}
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-emerald-400" />}
            label="Avg Score"
            value={stats.avg_score}
          />
          <StatCard
            icon={<Calendar className="w-6 h-6 text-amber-400" />}
            label="This Week"
            value={stats.this_week}
          />
        </div>

        {/* Recent Audits */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-6">Recent Audits</h2>
          {audits.length === 0 ? (
            <div className="text-center py-12">
              <Scan className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No audits yet. Start your first audit!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {audits.slice(0, 5).map((audit) => (
                <AuditListItem
                  key={audit.audit_id}
                  audit={audit}
                  onClick={() => navigate(`/audit/${audit.audit_id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
    <div className="flex items-center gap-3 mb-4">
      {icon}
      <span className="text-sm font-semibold text-slate-400 tracking-wider uppercase">{label}</span>
    </div>
    <p className="text-4xl font-bold">{value}</p>
  </div>
);

const AuditListItem = ({ audit, onClick }) => {
  const getScoreColor = (score) => {
    if (score >= 70) return 'text-emerald-400 bg-emerald-400/10';
    if (score >= 40) return 'text-amber-400 bg-amber-400/10';
    return 'text-red-400 bg-red-400/10';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      onClick={onClick}
      data-testid={`audit-item-${audit.audit_id}`}
      className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl p-4 cursor-pointer transition-all flex justify-between items-center"
    >
      <div>
        <h3 className="font-semibold mb-1">{audit.section_name}</h3>
        <p className="text-sm text-slate-500">{formatDate(audit.created_at)}</p>
      </div>
      <div className="flex items-center gap-6">
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getScoreColor(audit.compliance_score)}`}>
          {audit.compliance_score}% Compliant
        </span>
        <div className="text-right">
          <p className="text-red-400 text-sm">{audit.out_of_stock?.length || 0} <span className="text-slate-500">Out of Stock</span></p>
          <p className="text-amber-400 text-sm">{audit.misplaced_items?.length || 0} <span className="text-slate-500">Misplaced</span></p>
        </div>
      </div>
    </div>
  );
};

// ==================== NEW AUDIT ====================

const NewAudit = () => {
  const navigate = useNavigate();
  const [sectionName, setSectionName] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!sectionName.trim() || !selectedImage) {
      setError('Please provide section name and select an image');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('section_name', sectionName);
      formData.append('image', selectedImage);

      const response = await axios.post(`${API}/audits/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      navigate(`/audit/${response.data.audit_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="new-audit-page">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-2">New Shelf Audit</h1>
        <p className="text-slate-400 mb-8">Upload a shelf image and provide the section details</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Section Name */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6">
          <label className="text-sm font-semibold text-slate-400 tracking-wider uppercase mb-4 block">
            Section / Job Role
          </label>
          <input
            type="text"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder="e.g., Beverage Section, Snacks Aisle"
            data-testid="section-name-input"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
          />
        </div>

        {/* Image Upload */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 mb-6">
          <label className="text-sm font-semibold text-slate-400 tracking-wider uppercase mb-4 block">
            Shelf Image
          </label>
          
          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-64 object-cover rounded-xl"
              />
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                }}
                className="absolute top-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-900 rounded-lg transition-all"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-image-btn"
                className="bg-slate-800/50 hover:bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center gap-3 transition-all"
              >
                <Upload className="w-10 h-10 text-slate-500" />
                <span className="font-semibold">Upload Image</span>
                <span className="text-sm text-slate-500">Click to browse files</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                data-testid="take-photo-btn"
                className="bg-slate-800/50 hover:bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center gap-3 transition-all"
              >
                <Camera className="w-10 h-10 text-slate-500" />
                <span className="font-semibold">Take Photo</span>
                <span className="text-sm text-slate-500">Use device camera</span>
              </button>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !sectionName.trim() || !selectedImage}
          data-testid="analyze-btn"
          className={`w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${
            analyzing || !sectionName.trim() || !selectedImage
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-900'
          }`}
        >
          {analyzing ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full"></div>
              Analyzing...
            </>
          ) : (
            <>
              <Scan className="w-5 h-5" />
              Analyze Shelf
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// ==================== AUDIT RESULT ====================

const AuditResult = () => {
  const { audit_id } = useParams();
  const navigate = useNavigate();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const response = await axios.get(`${API}/audits/${audit_id}`);
        setAudit(response.data);
      } catch (error) {
        console.error("Error fetching audit:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, [audit_id]);

  const getScoreLevel = (score) => {
    if (score >= 70) return { label: 'Good', color: 'text-emerald-400' };
    if (score >= 40) return { label: 'Warning', color: 'text-amber-400' };
    return { label: 'Critical', color: 'text-red-400' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <p>Audit not found</p>
      </div>
    );
  }

  const scoreInfo = getScoreLevel(audit.compliance_score);

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="audit-result-page">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Audit Results</h1>
            <p className="text-slate-400">{audit.section_name}</p>
          </div>
          <button
            data-testid="download-pdf-btn"
            className="px-6 py-3 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100 transition-all flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Download PDF
          </button>
        </div>

        {/* Compliance Score */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
            <span className="text-sm font-semibold text-slate-400 tracking-wider uppercase">Compliance Score</span>
          </div>
          <p className={`text-7xl font-bold ${scoreInfo.color} mb-4`}>{audit.compliance_score}</p>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${scoreInfo.color} bg-current/10`}>
            {scoreInfo.label}
          </span>
        </div>

        {/* Issues Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Out of Stock */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h3 className="font-semibold">Out of Stock</h3>
            </div>
            <ul className="space-y-2">
              {audit.out_of_stock?.map((item, i) => (
                <li key={i} className="text-slate-400 text-sm flex items-start gap-2">
                  <span className="text-red-400 mt-1">•</span>
                  {item}
                </li>
              ))}
              {(!audit.out_of_stock || audit.out_of_stock.length === 0) && (
                <li className="text-slate-500 text-sm">No out of stock issues detected</li>
              )}
            </ul>
          </div>

          {/* Misplaced Items */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold">Misplaced Items</h3>
            </div>
            <ul className="space-y-2">
              {audit.misplaced_items?.map((item, i) => (
                <li key={i} className="text-slate-400 text-sm flex items-start gap-2">
                  <span className="text-amber-400 mt-1">•</span>
                  {item}
                </li>
              ))}
              {(!audit.misplaced_items || audit.misplaced_items.length === 0) && (
                <li className="text-slate-500 text-sm">No misplaced items detected</li>
              )}
            </ul>
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h3 className="font-semibold">AI Recommendations</h3>
          </div>
          <ol className="space-y-3">
            {audit.recommendations?.map((rec, i) => (
              <li key={i} className="text-slate-400 text-sm flex items-start gap-3">
                <span className="text-cyan-400 font-semibold">{i + 1}.</span>
                {rec}
              </li>
            ))}
            {(!audit.recommendations || audit.recommendations.length === 0) && (
              <li className="text-slate-500 text-sm">No recommendations available</li>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
};

// ==================== HISTORY PAGE ====================

const HistoryPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [historyData, setHistoryData] = useState({ audits: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get(`${API}/history`);
        setHistoryData(response.data);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const filteredAudits = historyData.audits.filter(audit => {
    if (filter === 'all') return true;
    if (filter === 'critical') return audit.compliance_score < 40;
    if (filter === 'warning') return audit.compliance_score >= 40 && audit.compliance_score < 70;
    if (filter === 'good') return audit.compliance_score >= 70;
    return true;
  });

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white" data-testid="history-page">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Scan className="w-7 h-7 text-cyan-400" />
            <span className="text-lg font-bold">ShelfScan AI</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              data-testid="dashboard-nav-btn"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-all flex items-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>
            <div className="flex items-center gap-3">
              {user?.picture && (
                <img src={user.picture} alt="" className="w-8 h-8 rounded-full" />
              )}
              <span className="text-sm text-slate-400">{user?.name}</span>
              <button
                onClick={logout}
                data-testid="logout-btn"
                className="p-2 hover:bg-slate-800 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <History className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold">Audit History</h1>
          </div>
          <p className="text-slate-400">Complete history of all your shelf audits and tasks</p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
            <p className="text-sm text-slate-500 mb-1">Total Audits</p>
            <p className="text-2xl font-bold">{historyData.summary.total_audits || 0}</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <p className="text-sm text-emerald-400 mb-1">Good (70+)</p>
            <p className="text-2xl font-bold text-emerald-400">{historyData.summary.good_count || 0}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <p className="text-sm text-amber-400 mb-1">Warning (40-69)</p>
            <p className="text-2xl font-bold text-amber-400">{historyData.summary.warning_count || 0}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-sm text-red-400 mb-1">Critical (&lt;40)</p>
            <p className="text-2xl font-bold text-red-400">{historyData.summary.critical_count || 0}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'critical', 'warning', 'good'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`filter-${f}-btn`}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                filter === f
                  ? 'bg-cyan-500 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        {/* History List */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
          {filteredAudits.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">No audits found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left p-4 text-sm font-semibold text-slate-400">Section</th>
                  <th className="text-left p-4 text-sm font-semibold text-slate-400">Date</th>
                  <th className="text-center p-4 text-sm font-semibold text-slate-400">Score</th>
                  <th className="text-center p-4 text-sm font-semibold text-slate-400">Out of Stock</th>
                  <th className="text-center p-4 text-sm font-semibold text-slate-400">Misplaced</th>
                  <th className="text-right p-4 text-sm font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudits.map((audit) => {
                  const scoreColor = audit.compliance_score >= 70 
                    ? 'text-emerald-400' 
                    : audit.compliance_score >= 40 
                      ? 'text-amber-400' 
                      : 'text-red-400';
                  
                  return (
                    <tr 
                      key={audit.audit_id} 
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-all"
                    >
                      <td className="p-4 font-medium">{audit.section_name}</td>
                      <td className="p-4 text-slate-400 text-sm">{formatDate(audit.created_at)}</td>
                      <td className="p-4 text-center">
                        <span className={`font-bold ${scoreColor}`}>{audit.compliance_score}%</span>
                      </td>
                      <td className="p-4 text-center text-red-400">{audit.out_of_stock?.length || 0}</td>
                      <td className="p-4 text-center text-amber-400">{audit.misplaced_items?.length || 0}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => navigate(`/audit/${audit.audit_id}`)}
                          data-testid={`view-audit-${audit.audit_id}`}
                          className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition-all"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

// Import useParams for AuditResult
import { useParams } from "react-router-dom";

// ==================== APP ROUTER ====================

function AppRouter() {
  // CRITICAL: Use window.location.hash directly, NOT useLocation().hash
  // React Router's useLocation() may not capture the hash immediately on redirect
  // This ensures session_id is detected SYNCHRONOUSLY during render
  if (window.location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/new-audit" element={
        <ProtectedRoute>
          <NewAudit />
        </ProtectedRoute>
      } />
      <Route path="/audit/:audit_id" element={
        <ProtectedRoute>
          <AuditResult />
        </ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute>
          <HistoryPage />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
