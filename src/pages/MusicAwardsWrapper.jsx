import { useOutletContext } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import MusicAwards from './MusicAwards';

export default function MusicAwardsWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><MusicAwards songs={ctx.songs} /></PageTransition>;
}