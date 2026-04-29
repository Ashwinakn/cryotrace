import React, { createContext, useContext, useReducer, useEffect } from 'react'
import axios from 'axios'

interface User { id: string; name: string; email: string; role: string; company?: string }
interface AuthState { user: User | null; token: string | null; loading: boolean }
type Action =
  | { type: 'SET_USER'; user: User; token: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; loading: boolean }

const AuthContext = createContext<{
  user: User | null; token: string | null; loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
} | null>(null)

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'SET_USER': return { ...state, user: action.user, token: action.token, loading: false }
    case 'LOGOUT': return { user: null, token: null, loading: false }
    case 'SET_LOADING': return { ...state, loading: action.loading }
    default: return state
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { user: null, token: null, loading: true })

  useEffect(() => {
    const token = localStorage.getItem('ct_token')
    const user = localStorage.getItem('ct_user')
    if (token && user) {
      dispatch({ type: 'SET_USER', user: JSON.parse(user), token })
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      dispatch({ type: 'SET_LOADING', loading: false })
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await axios.post('/api/auth/login', { email, password })
    const { access_token, user } = res.data
    localStorage.setItem('ct_token', access_token)
    localStorage.setItem('ct_user', JSON.stringify(user))
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    dispatch({ type: 'SET_USER', user, token: access_token })
  }

  const logout = () => {
    localStorage.removeItem('ct_token')
    localStorage.removeItem('ct_user')
    delete axios.defaults.headers.common['Authorization']
    dispatch({ type: 'LOGOUT' })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
