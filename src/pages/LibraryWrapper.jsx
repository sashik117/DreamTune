import { useOutletContext } from 'react-router-dom';
import Library from './Library';
import PageTransition from '../components/PageTransition';

export default function LibraryWrapper() {
  const ctx = useOutletContext();
  return <PageTransition><Library {...ctx} /></PageTransition>;
}