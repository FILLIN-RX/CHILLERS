import { Metadata } from 'next';
import TestLangContent from './page-content';

export const metadata: Metadata = {
  title: 'Laboratoire Multi-Langues (VF / VO / VOSTFR) | CHILLERS',
  description: 'Testeur de flux multi-langues en direct pour films et séries sur CHILLERS.',
};

export default function TestLangPage() {
  return <TestLangContent />;
}
