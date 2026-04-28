import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Mail, Lock, User as UserIcon, Key } from 'lucide-react';
import './AuthModal.css';

export default function AuthModal() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Start with 'user' signup by default
  const [role, setRole] = useState('user');
  
  // Determine if we are on the login or signup route
  const isLogin = location.pathname === '/login'; 
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    officerCode: '',
    agreed: false
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleClose = () => {
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isLogin && !formData.agreed) {
      alert("Please agree to the Terms and Privacy Policy.");
      return;
    }
    
    let endpoint = '';
    let payload = {};

    if (isLogin) {
      endpoint = '/api/auth/login';
      payload = { email: formData.email, passwordOrCode: formData.password };
    } else {
      endpoint = role === 'officer' ? '/api/auth/officer-signup' : '/api/auth/signup';
      payload = formData;
    }
    
    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Save token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        alert(isLogin ? 'Login successful!' : 'Signup successful! Welcome to RoadSaarthi.');
        handleClose();
        navigate('/dashboard'); 
      } else {
        alert(data.error || (isLogin ? 'Login failed' : 'Signup failed'));
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred. Please try again.');
    }
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal-container">
        
        {/* Left Side: Let's Get Started / Welcome Back */}
        <div className="auth-modal-left">
          <div className="auth-left-content">
            {isLogin ? (
              <h2>WELCOME<br/>BACK!</h2>
            ) : (
              <>
                <h2>Let's get<br/>Started!</h2>
                <p>Join RoadSaarthi and become part of a community dedicated to safer and better roads.</p>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="auth-modal-right">
          <button className="btn-close-modal" onClick={handleClose}>
            <X size={24} />
          </button>
          
          <div className="auth-right-content">
            <h3>{isLogin ? 'Log in to your account' : 'Create your account'}</h3>
            
            {/* Role Toggle (Only for Signup) */}
            {!isLogin && (
              <div className="role-toggle">
                <button 
                  type="button"
                  className={role === 'user' ? 'active' : ''} 
                  onClick={() => setRole('user')}
                >
                  Citizen
                </button>
                <button 
                  type="button"
                  className={role === 'officer' ? 'active' : ''} 
                  onClick={() => setRole('officer')}
                >
                  Officer
                </button>
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="input-group">
                  <div className="input-icon"><UserIcon size={18} /></div>
                  <input 
                    type="text" 
                    name="name" 
                    placeholder="Full Name" 
                    value={formData.name}
                    onChange={handleChange}
                    required 
                  />
                </div>
              )}

              <div className="input-group">
                <div className="input-icon"><Mail size={18} /></div>
                <input 
                  type="email" 
                  name="email" 
                  placeholder="Email Address" 
                  value={formData.email}
                  onChange={handleChange}
                  required 
                />
              </div>

              {(isLogin || role === 'user') && (
                <div className="input-group">
                  <div className="input-icon"><Lock size={18} /></div>
                  <input 
                    type="password" 
                    name="password" 
                    placeholder={isLogin ? "Password or code" : "Password"} 
                    value={formData.password}
                    onChange={handleChange}
                    required 
                    minLength={isLogin ? "4" : "6"}
                  />
                </div>
              )}

              {!isLogin && role === 'officer' && (
                <div className="input-group">
                  <div className="input-icon"><Key size={18} /></div>
                  <input 
                    type="password" 
                    name="officerCode" 
                    placeholder="Officer Secret Code" 
                    value={formData.officerCode}
                    onChange={handleChange}
                    required 
                  />
                </div>
              )}

              {!isLogin && (
                <div className="terms-checkbox">
                  <input 
                    type="checkbox" 
                    id="terms" 
                    name="agreed"
                    checked={formData.agreed}
                    onChange={handleChange}
                  />
                  <label htmlFor="terms">
                    I agree to all <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
                  </label>
                </div>
              )}

              <button type="submit" className="btn-auth-submit">
                {isLogin ? 'Log In' : 'Sign Up'}
              </button>
            </form>

            <div className="auth-footer">
              {isLogin ? (
                <p>Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/signup'); }}>Sign Up</a></p>
              ) : (
                <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Log In</a></p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
