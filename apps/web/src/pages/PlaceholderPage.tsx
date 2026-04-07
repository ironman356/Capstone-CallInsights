import PageFrame from '../components/PageFrame';

interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return <PageFrame title={title} />;
}

