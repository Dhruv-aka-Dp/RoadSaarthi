import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import ReportPage from "./pages/ReportPage";
import AuthModal from "./components/auth/AuthModal";
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />}>
            <Route path="signup" element={<AuthModal />} />
            <Route path="login" element={<AuthModal />} />
          </Route>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<ReportPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;