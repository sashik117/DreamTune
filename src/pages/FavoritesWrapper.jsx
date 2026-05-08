import { useOutletContext } from 'react-router-dom';
import Favorites from './Favorites';
import PageTransition from '../components/PageTransition';

export default function FavoritesWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><Favorites {...ctx} /></PageTransition>;
}