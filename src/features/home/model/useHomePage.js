import { useEffect, useMemo, useState } from 'react';
import { media } from '@/api/SupabaseClient';

export function useHomePage({ songs = [] }) {
  const [recDownload, setRecDownload] = useState(null);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showAllFavorites, setShowAllFavorites] = useState(false);
  const [showAllGlobal, setShowAllGlobal] = useState(false);
  const [showAllSpotify, setShowAllSpotify] = useState(false);
  const [globalChart, setGlobalChart] = useState([]);
  const [spotifyChart, setSpotifyChart] = useState([]);
  const [chartError, setChartError] = useState('');
  const [spotifyChartError, setSpotifyChartError] = useState('');
  const [favoriteOverlay, setFavoriteOverlay] = useState({});

  const allRecent = useMemo(
    () => [...songs].sort((a, b) => Number(new Date(b.created_at || b.created_date || 0)) - Number(new Date(a.created_at || a.created_date || 0))),
    [songs]
  );

  const favoriteSongs = useMemo(
    () => songs
      .map(song => favoriteOverlay[song.id] ? { ...song, ...favoriteOverlay[song.id] } : song)
      .filter(song => song.is_favorite)
      .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'uk')),
    [songs, favoriteOverlay]
  );

  useEffect(() => {
    let cancelled = false;
    media.getGlobalChart(20)
      .then(data => {
        if (!cancelled) setGlobalChart(data.tracks || []);
      })
      .catch(() => {
        if (!cancelled) setChartError('The chart is temporarily unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    media.getSpotifyChart(20)
      .then(data => {
        if (!cancelled) setSpotifyChart(data.tracks || []);
      })
      .catch(() => {
        if (!cancelled) setSpotifyChartError('Spotify Top 20 is temporarily unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleFavoriteChange = (event) => {
      const song = event.detail?.song;
      if (!song?.id) return;
      setFavoriteOverlay(prev => ({ ...prev, [song.id]: song }));
    };
    window.addEventListener('dreamtune-favorite-change', handleFavoriteChange);
    return () => window.removeEventListener('dreamtune-favorite-change', handleFavoriteChange);
  }, []);

  const openDownload = (track) => {
    setRecDownload({ title: track.title, youtube_query: track.youtube_query || `${track.title} ${track.artist}` });
  };

  return {
    allRecent,
    chartError,
    favoriteSongs,
    globalChart,
    openDownload,
    recDownload,
    setRecDownload,
    setShowAllFavorites,
    setShowAllGlobal,
    setShowAllRecent,
    setShowAllSpotify,
    showAllFavorites,
    showAllGlobal,
    showAllRecent,
    showAllSpotify,
    spotifyChart,
    spotifyChartError,
  };
}
