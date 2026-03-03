import { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MrObrasAssistente } from '@/components/mr-obras/MrObrasAssistente';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { id: orcamentoId } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
      <MrObrasAssistente orcamentoId={orcamentoId} />
    </div>
  );
}
