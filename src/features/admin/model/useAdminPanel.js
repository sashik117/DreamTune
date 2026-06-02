import { useEffect, useMemo, useState } from 'react';
import { admin } from '@/api/SupabaseClient';
import { toast } from 'sonner';

export function useAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('users');

  const loadAdmin = async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    try {
      const [stats, userRows, playlistRows] = await Promise.all([
        admin.overview(),
        admin.listUsers(),
        admin.listCollabPlaylists(),
      ]);
      setOverview(stats);
      setUsers(userRows);
      setPlaylists(playlistRows);
      setForbidden(false);
    } catch (error) {
      if (String(error.message || '').toLowerCase().includes('forbidden')) setForbidden(true);
      else toast.error('Could not load admin panel');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const filteredUsers = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return users;
    return users.filter((user) => (
      String(user.nickname || '').toLowerCase().includes(value)
      || String(user.email || '').toLowerCase().includes(value)
      || String(user.role || '').toLowerCase().includes(value)
    ));
  }, [query, users]);

  const filteredPlaylists = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return playlists;
    return playlists.filter((playlist) => (
      String(playlist.name || '').toLowerCase().includes(value)
      || String(playlist.owner_nickname || playlist.owner_email || '').toLowerCase().includes(value)
    ));
  }, [query, playlists]);

  const blockedCount = users.filter((user) => user.blocked_at).length;
  const unverifiedCount = users.filter((user) => !user.email_verified && !user.is_verified).length;

  const updateUser = async (id, action) => {
    try {
      const next = await admin.updateUser(id, action);
      setUsers((prev) => prev.map((user) => (user.id === id ? next : user)));
      toast.success(action === 'block' ? 'User blocked' : action === 'unblock' ? 'User unblocked' : 'Role updated');
      loadAdmin({ quiet: true });
    } catch (error) {
      toast.error(error.message || 'Could not update user');
    }
  };

  const deleteUser = async (user) => {
    if (!window.confirm(`Delete account "${user.nickname || user.email}"? This will permanently remove all their data.`)) return;
    try {
      await admin.deleteUser(user.id);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      toast.success('Account deleted');
      loadAdmin({ quiet: true });
    } catch (error) {
      toast.error(error.message || 'Could not delete account');
    }
  };

  const deletePlaylist = async (playlist) => {
    if (!window.confirm(`Delete collaborative playlist "${playlist.name}"?`)) return;
    try {
      await admin.deleteCollabPlaylist(playlist.id);
      setPlaylists((prev) => prev.filter((item) => item.id !== playlist.id));
      toast.success('Playlist deleted');
      loadAdmin({ quiet: true });
    } catch (error) {
      toast.error(error.message || 'Could not delete playlist');
    }
  };

  return {
    blockedCount,
    deletePlaylist,
    deleteUser,
    filteredPlaylists,
    filteredUsers,
    forbidden,
    loadAdmin,
    loading,
    overview,
    query,
    refreshing,
    setQuery,
    setTab,
    tab,
    unverifiedCount,
    updateUser,
    users,
  };
}
