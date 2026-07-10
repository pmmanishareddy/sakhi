import { useState, useCallback, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { WardrobeProvider } from './lib/wardrobe-store'
import { Splash } from './features/onboarding/Splash'
import { Onboarding } from './features/onboarding/Onboarding'
import { LoginScreen } from './features/onboarding/LoginScreen'
import { HomeScreen } from './features/HomeScreen'
import { WardrobeScreen } from './features/wardrobe/WardrobeScreen'
import { ItemDetail } from './features/wardrobe/ItemDetail'
import { SakhiScreen } from './features/ask-sakhi/SakhiScreen'
import { AddItemScreen } from './features/add-item/AddItemScreen'
import { SuggestFlow } from './features/suggest/SuggestFlow'
import { LogOutfitFlow } from './features/outfit-log/LogOutfitFlow'
import { OutfitDetail } from './features/outfit-log/OutfitDetail'
import { ProfileScreen } from './features/profile/ProfileScreen'
import { MeetSakhi } from './features/onboarding/MeetSakhi'
import { PrivacyScreen } from './features/onboarding/PrivacyScreen'
import { useNavigate } from 'react-router-dom'
import { getProfile } from './lib/api'

// Replayable from Profile → "How Sakhi works"
function MeetSakhiReplay() {
  const navigate = useNavigate()
  return <MeetSakhi onDone={() => navigate(-1)} />
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem('sakhi_onboarded'))
  const [checkingProfile, setCheckingProfile] = useState(false)

  const markOnboarded = useCallback(() => {
    localStorage.setItem('sakhi_onboarded', 'true')
    setOnboarded(true)
  }, [])

  useEffect(() => {
    if (user && !onboarded) {
      setCheckingProfile(true)
      getProfile().then(profile => {
        if (profile?.style_preferences && Object.keys(profile.style_preferences).length > 0) {
          markOnboarded()
        }
      }).catch(() => {}).finally(() => setCheckingProfile(false))
    }
  }, [user, onboarded, markOnboarded])

  if (loading || checkingProfile) {
    return (
      <div className="flex items-center justify-center h-full bg-bg">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/splash" element={<Splash />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/privacy" element={<PrivacyScreen />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    )
  }

  if (!onboarded) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding onComplete={markOnboarded} />} />
        <Route path="/privacy" element={<PrivacyScreen />} />
        <Route path="*" element={<Navigate to="/onboarding" />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<HomeScreen />} />
      <Route path="/wardrobe" element={<WardrobeScreen />} />
      <Route path="/item/:id" element={<ItemDetail />} />
      <Route path="/sakhi" element={<SakhiScreen />} />
      <Route path="/add-item" element={<AddItemScreen />} />
      <Route path="/suggest" element={<SuggestFlow />} />
      <Route path="/log-outfit" element={<LogOutfitFlow />} />
      <Route path="/outfit/:id" element={<OutfitDetail />} />
      <Route path="/profile" element={<ProfileScreen />} />
      <Route path="/welcome" element={<MeetSakhiReplay />} />
      <Route path="/privacy" element={<PrivacyScreen />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WardrobeProvider>
          <div className="app-shell">
            <AppRoutes />
          </div>
        </WardrobeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
