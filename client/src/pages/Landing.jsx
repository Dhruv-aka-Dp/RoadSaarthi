import { useEffect, useState } from "react";
import { Link, useNavigate, Outlet } from "react-router-dom";
import API from "../services/api";
import {
  MapPin,
  Search,
  User,
  FileEdit,
  Eye,
  ShieldCheck,
  Users,
  Smartphone,
  ClipboardList,
  HardHat,
  CheckCircle2,
  ArrowRight,
  Leaf,
  Camera,
  Map,
  Mail
} from "lucide-react";
import "./Landing.css";

function Landing() {
  const navigate = useNavigate();

  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleContactChange = (e) => {
    setContactForm({ ...contactForm, [e.target.name]: e.target.value });
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      await API.post("/contact", contactForm);
      setSubmitStatus({ type: "success", message: "Message sent! We will get back to you soon." });
      setContactForm({ name: "", email: "", message: "" });
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: error.response?.data?.error || "Something went wrong. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    navigate("/signup");
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    const hiddenElements = document.querySelectorAll(".animate-on-scroll");
    hiddenElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-brand">
          <div className="brand-logo-circle">
            <Leaf className="brand-icon" size={24} />
          </div>
          <div>
            <h1 className="brand-title">RoadSaarthi</h1>
            <p className="brand-subtitle">Safer Roads, Better Tomorrow</p>
          </div>
        </div>

        <ul className="nav-links">
          <li><a href="#" className="active">Home</a></li>
          <li><a href="#about">About Us</a></li>
          <li><a href="#features">Features</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>

        <div className="nav-actions">
          <Link to="/login" className="btn-login-text">
            Login
          </Link>
          <Link to="/signup" className="btn-signup">
            <User size={18} />
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Leaf size={14} className="badge-icon" />
            Together for Better Cities
          </div>

          <h1 className="hero-title">
            Report. Track.<br />
            Resolve. <span className="text-primary">Together.</span>
          </h1>

          <p className="hero-description">
            RoadSaarthi helps communities report road issues,
            track their status, and make our cities
            better places to live.
          </p>

          <div className="hero-actions">
            <Link to="/signup" className="btn-primary">
              <FileEdit size={18} />
              Report an Issue
            </Link>
            <Link to="/signup" className="btn-secondary">
              <MapPin size={18} />
              Explore Map
            </Link>
          </div>
        </div>

        <div className="hero-floating-card">
          <div className="floating-card-icon">
            <Users size={20} />
          </div>
          <div>
            <h4>Stronger Together</h4>
            <p>Join thousands of citizens making a difference.</p>
          </div>
        </div>
      </header>

      {/* Quick Report Bar */}
      <div className="quick-report-container animate-on-scroll">
        <form className="quick-report-bar" onSubmit={handleSearch}>
          <div className="input-group">
            <div className="input-icon bg-green"><Search size={20} color="white" /></div>
            <div className="input-fields">
              <label>What issue did you find?</label>
              <input type="text" placeholder="e.g., Pothole, Streetlight not working..." />
            </div>
          </div>

          <div className="divider"></div>

          <div className="input-group">
            <div className="input-icon bg-brown"><MapPin size={20} color="white" /></div>
            <div className="input-fields">
              <label>Location</label>
              <input type="text" placeholder="Select or search location..." />
            </div>
          </div>

          <button type="submit" className="btn-report-now">
            Report Now <ArrowRight size={18} />
          </button>
        </form>
      </div>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="about-container">
          <div className="about-image-wrapper animate-on-scroll">
            <div className="about-dots-pattern"></div>
            <img src="/assets/landing-bg.png" alt="Road in city" className="about-image" />
            <div className="about-floating-card animate-on-scroll delay-200">
              <div className="about-floating-icon">
                <Users size={20} />
              </div>
              <div>
                <h4>Stronger Together</h4>
                <p>Join thousands of citizens making a difference.</p>
              </div>
              <Leaf className="about-floating-leaf text-primary" size={24} />
            </div>
          </div>

          <div className="about-content">
            <div className="section-badge animate-on-scroll">
              <Leaf size={14} className="badge-icon" />
              About RoadSaarthi
            </div>
            <h2 className="section-heading animate-on-scroll delay-100">
              Building Better Roads Through <span className="text-highlight">Community Power</span>
            </h2>
            <p className="section-description animate-on-scroll delay-200">
              RoadSaarthi is a citizen-focused platform that empowers you to report road issues, track their status in real-time, and help authorities take quick actions.
            </p>

            <div className="about-features">
              <div className="about-feature-item animate-on-scroll delay-300">
                <div className="about-feature-icon"><FileEdit size={24} /></div>
                <div>
                  <h3>Easy Reporting</h3>
                  <p>Report issues in just a few taps.</p>
                </div>
              </div>
              <div className="about-feature-item animate-on-scroll delay-400">
                <div className="about-feature-icon"><Eye size={24} /></div>
                <div>
                  <h3>Real-time Tracking</h3>
                  <p>Track status and updates in real-time.</p>
                </div>
              </div>
              <div className="about-feature-item animate-on-scroll delay-500">
                <div className="about-feature-icon"><ShieldCheck size={24} /></div>
                <div>
                  <h3>Better Communities</h3>
                  <p>Together, we build safer and better cities.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Features Section */}
      <section id="features" className="smart-features-section">
        <div className="section-badge center mx-auto animate-on-scroll">
          <Leaf size={14} className="badge-icon" />
          Why RoadSaarthi?
        </div>
        <h2 className="section-heading center animate-on-scroll delay-100">
          Smart Features for <span className="text-primary">Stronger Communities</span>
        </h2>

        <div className="smart-cards-container">
          <Link to="/signup" className="smart-card animate-on-scroll delay-200">
            <div className="smart-card-image-wrapper">
              <img src="/assets/feature-pothole.png" alt="Report Issues" />
              <div className="smart-card-icon"><Camera size={24} /></div>
            </div>
            <div className="smart-card-content">
              <h3>Report Issues</h3>
              <p>Click a photo, add details, and report issues in your area.</p>
              <span className="smart-card-link text-primary">Report Now <ArrowRight size={16} /></span>
            </div>
          </Link>

          <Link to="/signup" className="smart-card animate-on-scroll delay-300">
            <div className="smart-card-image-wrapper">
              <img src="/assets/feature-map.png" alt="Track in Real-time" />
              <div className="smart-card-icon"><Map size={24} /></div>
            </div>
            <div className="smart-card-content">
              <h3>Track in Real-time</h3>
              <p>Stay updated with real-time status of your reported issues.</p>
              <span className="smart-card-link text-primary">Track Now <ArrowRight size={16} /></span>
            </div>
          </Link>

          <Link to="/signup" className="smart-card animate-on-scroll delay-400">
            <div className="smart-card-image-wrapper">
              <img src="/assets/feature-community.png" alt="Stronger Together" />
              <div className="smart-card-icon"><Users size={24} /></div>
            </div>
            <div className="smart-card-content">
              <h3>Stronger Together</h3>
              <p>Your voice matters. Together we can create better roads for everyone.</p>
              <span className="smart-card-link text-primary">Join Us <ArrowRight size={16} /></span>
            </div>
          </Link>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact-section">
        <div className="contact-container animate-on-scroll">
          <div className="contact-info animate-on-scroll delay-100">
            <h2 className="section-heading">Get in Touch</h2>
            <p className="section-description">Have questions or want to partner with us? We'd love to hear from you.</p>

            <div className="contact-methods">
              <div className="contact-method">
                <div className="contact-icon"><MapPin size={24} /></div>
                <div>
                  <h4>Office</h4>
                  <p>123 Smart City Avenue, Tech District</p>
                </div>
              </div>
              <div className="contact-method">
                <div className="contact-icon"><Mail size={24} /></div>
                <div>
                  <h4>Email</h4>
                  <p>support@roadsaarthi.com</p>
                </div>
              </div>
            </div>
          </div>

          <div className="contact-form-wrapper animate-on-scroll delay-200">
            <form className="contact-form" onSubmit={handleContactSubmit}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={contactForm.name}
                  onChange={handleContactChange}
                  placeholder="name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={contactForm.email}
                  onChange={handleContactChange}
                  placeholder="name@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea
                  name="message"
                  rows="4"
                  value={contactForm.message}
                  onChange={handleContactChange}
                  placeholder="How can we help you?"
                  required
                ></textarea>
              </div>
              <button type="submit" className="btn-submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
              {submitStatus && (
                <div className={`form-status ${submitStatus.type}`}>
                  {submitStatus.message}
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

    </div>
  );
}

export default Landing;
