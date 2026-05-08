import { useOutletContext } from 'react-router-dom';
import AlbumDetail from './AlbumDetail';
import PageTransition from '../components/PageTransition';

export default function AlbumDetailWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><AlbumDetail {...ctx} /></PageTransition>;
}