import { useOutletContext } from 'react-router-dom';
import SearchPage from './SearchPage';
import PageTransition from '../components/PageTransition';

export default function SearchWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><SearchPage {...ctx} /></PageTransition>;
}