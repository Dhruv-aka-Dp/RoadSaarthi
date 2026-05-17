import { createContext, useEffect, useRef, useState } from "react";
import API from "../services/api";

export const AuthContext = createContext();

const TOKEN_KEY = "roadsaarthi-token";
const ROLE_KEY = "roadsaarthi-user-role";

const normalizeEmail = (email) => email.trim().toLowerCase();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const authMutationCountRef = useRef(0);

  const persistAuth = (token, nextUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, nextUser.role);
    API.defaults.headers.common.Authorization = `Bearer ${token}`;
    setUser(nextUser);
  };

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    delete API.defaults.headers.common.Authorization;
    setUser(null);
  };

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      const requestGeneration = authMutationCountRef.current;

      if (!token) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        API.defaults.headers.common.Authorization = `Bearer ${token}`;
        const res = await API.get("/auth/me");

        if (!isMounted || authMutationCountRef.current !== requestGeneration) {
          return;
        }

        setUser(res.data.data);
        localStorage.setItem(ROLE_KEY, res.data.data.role);
      } catch (error) {
        console.error("Failed to load user", error);

        const latestToken = localStorage.getItem(TOKEN_KEY);
        const requestStillCurrent =
          authMutationCountRef.current === requestGeneration && latestToken === token;

        if (requestStillCurrent) {
          clearAuth();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    authMutationCountRef.current += 1;
    const res = await API.post("/auth/login", {
      email: normalizeEmail(email),
      password,
    });

    persistAuth(res.data.token, res.data.data);
  };

  const register = async (name, email, password, role, officerId) => {
    authMutationCountRef.current += 1;
    const payload = {
      name: name.trim(),
      email: normalizeEmail(email),
      password,
      role,
      officerId: officerId?.trim() || "",
    };

    const res = await API.post("/auth/register", payload);
    persistAuth(res.data.token, res.data.data);
  };

  const logout = () => {
    authMutationCountRef.current += 1;
    clearAuth();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
