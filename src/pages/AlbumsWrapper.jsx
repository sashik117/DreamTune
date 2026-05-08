import { useOutletContext } from 'react-router-dom';
import Albums from './Albums';
import PageTransition from '../components/PageTransition';

export default function AlbumsWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><Albums {...ctx} /></PageTransition>;
}