import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import AppShell from './pages/AppShell';
import HomeWrapper from './pages/HomeWrapper';
import LibraryWrapper from './pages/LibraryWrapper';
import FavoritesWrapper from './pages/FavoritesWrapper';
import SearchWrapper from './pages/SearchWrapper';
import ProfileWrapper from './pages/ProfileWrapper';
import PlaylistsWrapper from './pages/PlaylistsWrapper';
import PlaylistDetailWrapper from './pages/PlaylistDetailWrapper';
import AlbumsWrapper from './pages/AlbumsWrapper';
import AlbumDetailWrapper from './pages/AlbumDetailWrapper';
import CollabPlaylistsWrapper from './pages/CollabPlaylistsWrapper';
import MusicAwardsWrapper from './pages/MusicAwardsWrapper';
import AuthPage from './pages/AuthPage';
import FriendProfile from './pages/FriendProfile';
import AdminPage from './pages/AdminPage';
import ApiWakeLoader from './components/ApiWakeLoader';

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<HomeWrapper />} />
            <Route path="/library" element={<LibraryWrapper />} />
            <Route path="/favorites" element={<FavoritesWrapper />} />
            <Route path="/search" element={<SearchWrapper />} />
            <Route path="/profile" element={<ProfileWrapper />} />
            <Route path="/profile/user/:userId" element={<FriendProfile />} />
            <Route path="/profile/:section" element={<ProfileWrapper />} />
            <Route path="/playlists" element={<PlaylistsWrapper />} />
            <Route path="/playlists/:id" element={<PlaylistDetailWrapper />} />
            <Route path="/albums" element={<AlbumsWrapper />} />
            <Route path="/albums/:id" element={<AlbumDetailWrapper />} />
            <Route path="/collab" element={<CollabPlaylistsWrapper />} />
            <Route path="/awards" element={<MusicAwardsWrapper />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Router>
      <ApiWakeLoader />
      <Toaster position="top-center" richColors closeButton style={{ zIndex: 9999 }} />
    </QueryClientProvider>
  )
}

export default App
