import { useOutletContext } from 'react-router-dom';
import PageTransition from '../components/PageTransition';
import Profile from './Profile';

export default function ProfileWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><Profile {...ctx} /></PageTransition>;
}
