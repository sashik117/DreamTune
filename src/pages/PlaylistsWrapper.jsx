import { useOutletContext } from 'react-router-dom';
import Playlists from './Playlists';
import PageTransition from '../components/PageTransition';

export default function PlaylistsWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><Playlists {...ctx} /></PageTransition>;
}