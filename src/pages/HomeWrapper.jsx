import { useOutletContext } from 'react-router-dom';
import Home from './Home';
import PageTransition from '../components/PageTransition';

export default function HomeWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><Home {...ctx} /></PageTransition>;
}