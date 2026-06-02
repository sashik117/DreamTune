import { useEffect, useRef, useState } from 'react';
import { auth, entities, storage, supabase } from '@/api/SupabaseClient';
import { toast } from 'sonner';
import { parsePlaylistCoverPosition } from './collabPlaylistView';

export function useCollabPlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPosition, setCoverPosition] = useState({ x: 50, y: 50 });
  const [coverScale, setCoverScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [openDetail, setOpenDetail] = useState(null);
  const savingRef = useRef(false);

  const loadData = async () => {
    try {
      const data = await entities.CollabPlaylist.list();
      const unique = Array.from(new Map((data || []).map(item => [item.id, item])).values());
      setPlaylists(unique);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    auth.me().then(user => setCurrentUser(user)).catch(() => {});
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dreamtune:collab-detail', { detail: { open: Boolean(openDetail) } }));
    return () => {
      window.dispatchEvent(new CustomEvent('dreamtune:collab-detail', { detail: { open: false } }));
    };
  }, [openDetail]);

  useEffect(() => {
    const channel = supabase
      .channel('collab_playlists_feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collab_playlists' }, (payload) => {
        if (payload.new?.owner_id !== currentUser?.id && !(payload.new?.collaborator_ids || []).includes(currentUser?.id) && payload.new?.access_level !== 'public') return;
        setPlaylists(prev => prev.some(item => item.id === payload.new.id) ? prev.map(item => item.id === payload.new.id ? payload.new : item) : [payload.new, ...prev]);
        toast(`Created collaborative playlist "${payload.new.name}"`);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'collab_playlists' }, (payload) => {
        const hasAccess = payload.new?.owner_id === currentUser?.id || (payload.new?.collaborator_ids || []).includes(currentUser?.id) || payload.new?.access_level === 'public';
        if (!hasAccess) {
          setPlaylists(prev => prev.filter(playlist => playlist.id !== payload.new?.id));
          return;
        }
        setPlaylists(prev => prev.some(playlist => playlist.id === payload.new.id) ? prev.map(playlist => playlist.id === payload.new.id ? payload.new : playlist) : [payload.new, ...prev]);
        if (payload.new.last_edited_by && payload.new.last_edited_by !== currentUser?.email) {
          toast(`${payload.new.last_edited_by} updated "${payload.new.name}"`);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'collab_playlists' }, (payload) => {
        setPlaylists(prev => prev.filter(playlist => playlist.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUser]);

  const resetForm = () => {
    setNewName('');
    setEditingPlaylist(null);
    setCoverPreview('');
    setCoverFile(null);
    setCoverPosition({ x: 50, y: 50 });
    setCoverScale(1);
  };

  const openCreateDialog = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEditDialog = (playlist) => {
    setEditingPlaylist(playlist);
    setNewName(playlist.name || '');
    setCoverPreview(playlist.cover_url || '');
    setCoverPosition(parsePlaylistCoverPosition(playlist.cover_position));
    setCoverScale(Number(playlist.cover_scale || 1));
    setCoverFile(null);
    setShowCreate(true);
  };

  const handleCoverSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    event.target.value = '';
  };

  const handleCreate = async () => {
    if (!newName.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const cleanName = newName.trim();
      let coverUrl = coverPreview || '';
      if (coverFile) coverUrl = await storage.uploadFile(coverFile, 'songs');
      const payload = {
        name: cleanName,
        cover_url: coverUrl,
        cover_position: `${coverPosition.x}% ${coverPosition.y}%`,
        cover_scale: coverScale,
      };
      if (editingPlaylist) {
        const updated = await entities.CollabPlaylist.update(editingPlaylist.id, {
          ...payload,
          last_edited_by: currentUser?.email || null,
          last_edited_at: Date.now(),
        });
        setPlaylists(prev => prev.map(item => item.id === updated.id ? { ...item, ...updated } : item));
        toast.success('Collaborative playlist updated');
      } else {
        const created = await entities.CollabPlaylist.create({
          ...payload,
          song_ids: [],
          collaborator_ids: [],
        });
        setPlaylists(prev => prev.some(item => item.id === created.id) ? prev : [created, ...prev]);
        toast.success('Collaborative playlist created');
      }
      resetForm();
      setShowCreate(false);
    } catch (err) {
      console.error(err);
      toast.error('Save failed');
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const handleDelete = async (playlist) => {
    try {
      await entities.CollabPlaylist.delete(playlist.id);
      toast.success('Playlist deleted');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDetailUpdated = (updated) => {
    setPlaylists(prev => prev.map(playlist => playlist.id === updated.id ? updated : playlist));
  };

  const handleDetailDeleted = (deletedId) => {
    setPlaylists(prev => prev.filter(playlist => playlist.id !== deletedId));
    setOpenDetail(null);
  };

  return {
    coverFile,
    coverPosition,
    coverPreview,
    coverScale,
    currentUser,
    editingPlaylist,
    handleCoverSelect,
    handleCreate,
    handleDelete,
    handleDetailDeleted,
    handleDetailUpdated,
    loading,
    newName,
    openCreateDialog,
    openDetail,
    openEditDialog,
    playlists,
    saving,
    setCoverPosition,
    setCoverScale,
    setNewName,
    setOpenDetail,
    setShowCreate,
    showCreate,
  };
}
