import { useOutletContext } from 'react-router-dom';
import PlaylistDetail from './PlaylistDetail';
import PageTransition from '../components/PageTransition';

export default function PlaylistDetailWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><PlaylistDetail {...ctx} /></PageTransition>;
}