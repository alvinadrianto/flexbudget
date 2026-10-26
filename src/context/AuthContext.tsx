import React, { createContext, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient'

export interface UserSession {
  id: string
  email: string
  fullName: string
}

interface AuthContextType {
  user: UserSession | null
  isLoading: boolean
  isSupabaseConnected: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEMO_USER: UserSession = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'pemilik@flexbudget.app',
  fullName: 'Pemilik FlexBudget',
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // Check active session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          })
        } else {
          setUser(null)
        }
        setIsLoading(false)
      })

      // Listen to auth changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          })
        } else {
          setUser(null)
        }
        setIsLoading(false)
      })

      return () => {
        subscription.unsubscribe()
      }
    } else {
      // Offline / Local Demo Mode: restore local session or use default demo user
      const stored = localStorage.getItem('flexbudget_auth_user')
      if (stored) {
        try {
          setUser(JSON.parse(stored))
        } catch {
          setUser(DEMO_USER)
        }
      } else {
        setUser(DEMO_USER)
      }
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        return { success: false, error: error.message }
      }
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          fullName: data.user.user_metadata?.full_name || 'User',
        })
      }
      return { success: true }
    } else {
      // Local login simulation
      const loggedUser: UserSession = {
        id: DEMO_USER.id,
        email,
        fullName: email.split('@')[0],
      }
      setUser(loggedUser)
      localStorage.setItem('flexbudget_auth_user', JSON.stringify(loggedUser))
      return { success: true }
    }
  }

  const register = async (email: string, password: string, fullName: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })
      if (error) {
        return { success: false, error: error.message }
      }
      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          fullName: fullName || 'User',
        })
      }
      return { success: true }
    } else {
      const newUser: UserSession = {
        id: crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`,
        email,
        fullName,
      }
      setUser(newUser)
      localStorage.setItem('flexbudget_auth_user', JSON.stringify(newUser))
      return { success: true }
    }
  }

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    } else {
      localStorage.removeItem('flexbudget_auth_user')
    }
    setUser(null)
  }

  const resetPassword = async (email: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) return { success: false, error: error.message }
      return { success: true }
    }
    return { success: true }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSupabaseConnected: isSupabaseConfigured,
        login,
        register,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
