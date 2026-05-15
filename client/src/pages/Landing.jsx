import { Link, Outlet, useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './Landing.css';

const Landing = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  return (
    <div className="landing-page">
      <div className="landing-background">
        <div className="gradient-sphere sphere-1"></div>
        <div className="gradient-sphere sphere-2"></div>
        <div className="gradient-sphere sphere-3"></div>
        <div className="noise-overlay"></div>
      </div>

      <nav className="landing-nav">
        <div className="nav-brand">
          <div className="brand-logo">RS</div>
          <span className="brand-name">RoadSaarthi</span>
        </div>
        <div className="nav-actions">
          {user ? (
            <Link to="/dashboard" className="btn btn-primary">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">
                Log in
              </Link>
              <Link to="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      <main className="landing-hero">
        <div className="hero-content">
          <div className="badge animate-fade-in-up">
            <span className="badge-dot"></span>
            Smart Pothole & Road Issue Reporter
          </div>
          <h1 className="hero-title animate-fade-in-up delay-1">
            Empower your city with <span className="text-gradient">data-driven</span> road maintenance.
          </h1>
          <p className="hero-subtitle animate-fade-in-up delay-2">
            RoadSaarthi allows citizens to easily report road issues with automated GPS tagging. Reports are clustered into heatmaps, helping PWD departments prioritize and resolve tickets efficiently.
          </p>
          <div className="hero-cta animate-fade-in-up delay-3">
            <Link to={user ? "/report" : "/signup"} className="btn btn-primary btn-large">
              Report an Issue Now
              <svg xmlns="http://www.w3.org/2000/svg" className="icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <Link to="/dashboard" className="btn btn-outline btn-large">
              View Live Map
            </Link>
          </div>
        </div>

        <div className="hero-visual animate-fade-in delay-4">
          <div className="glass-card mockup-card">
            <div className="mockup-header">
              <div className="mockup-dots">
                <span></span><span></span><span></span>
              </div>
              <div className="mockup-url">dashboard.roadsaarthi.in</div>
            </div>
            <div className="mockup-body">
              <div className="mockup-map">
                <div className="pulse-marker m-1"></div>
                <div className="pulse-marker m-2"></div>
                <div className="pulse-marker m-3"></div>
                <div className="pulse-marker m-4 critical"></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Render AuthModal if route matches /login or /signup */}
      <Outlet />
    </div>
  );
};

export default Landing;
