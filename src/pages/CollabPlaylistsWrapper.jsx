import { useOutletContext } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import CollabPlaylists from './CollabPlaylists';

export default function CollabPlaylistsWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><CollabPlaylists {...ctx} /></PageTransition>;
}
