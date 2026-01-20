import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { usePriceCatalog, PriceCatalogItem } from '@/hooks/usePriceCatalog';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/orcamento-calculos';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Save,
  RotateCcw,
  Download,
  Upload,
  Clock,
  Package,
  Hammer,
  Boxes,
  Droplets,
  PaintBucket,
  Users,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const categoryIcons: Record<string, React.ReactNode> = {
  'ICF/Formas': <Boxes className="w-5 h-5" />,
  'Concreto': <Droplets className="w-5 h-5" />,
  'Aço/Fibra': <Package className="w-5 h-5" />,
  'Materiais': <Hammer className="w-5 h-5" />,
  'Acabamentos': <PaintBucket className="w-5 h-5" />,
  'Mão de Obra': <Users className="w-5 h-5" />,
};

const categoryOrder = [
  'ICF/Formas',
  'Concreto',
  'Aço/Fibra',
  'Materiais',
  'Acabamentos',
  'Mão de Obra',
];

export default function Precos() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const {
    categories,
    isLoading,
    lastUpdate,
    bulkUpdatePrices,
    restoreDefaults,
  } = usePriceCatalog();

  const [searchTerm, setSearchTerm] = useState('');
  const [editedPrices, setEditedPrices] = useState<Record<string, { preco: number; unidade: string }>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Debug: verificar status do admin (apenas em dev)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[Precos] isAdmin:', isAdmin);
    }
  }, [isAdmin]);

  // Initialize edited prices from catalog - only once when data loads
  useEffect(() => {
    if (Object.keys(categories).length > 0 && !initialized) {
      const initial: Record<string, { preco: number; unidade: string }> = {};
      Object.values(categories).flat().forEach(item => {
        initial[item.id] = { preco: item.preco, unidade: item.unidade };
      });
      setEditedPrices(initial);
      setInitialized(true);
      setHasChanges(false);
    }
  }, [categories, initialized]);

  // Reset initialized when categories change externally (e.g., after save)
  useEffect(() => {
    if (!hasChanges && Object.keys(categories).length > 0 && initialized) {
      const updated: Record<string, { preco: number; unidade: string }> = {};
      Object.values(categories).flat().forEach(item => {
        updated[item.id] = { preco: item.preco, unidade: item.unidade };
      });
      setEditedPrices(updated);
    }
  }, [categories]);

  const handlePriceChange = (id: string, value: string) => {
    // Suportar vírgula e ponto como separador decimal
    const normalizedValue = value.replace(',', '.');
    const numValue = parseFloat(normalizedValue) || 0;
    
    if (import.meta.env.DEV) {
      console.log('[Precos] handlePriceChange:', { id, value, numValue });
    }
    
    setEditedPrices(prev => ({
      ...prev,
      [id]: { ...prev[id], preco: numValue },
    }));
    setHasChanges(true);
  };

  const handleUnitChange = (id: string, value: string) => {
    if (import.meta.env.DEV) {
      console.log('[Precos] handleUnitChange:', { id, value });
    }
    
    setEditedPrices(prev => ({
      ...prev,
      [id]: { ...prev[id], unidade: value },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const updates = Object.entries(editedPrices).map(([id, data]) => ({
      id,
      preco: data.preco,
      unidade: data.unidade,
    }));
    
    bulkUpdatePrices.mutate(updates, {
      onSuccess: () => {
        setHasChanges(false);
        setInitialized(false); // Force reload from server
      },
      onError: (error) => {
        // Mantém hasChanges=true para não perder as alterações
        console.error('[Precos] Erro ao salvar:', error);
      },
    });
  };

  const handleRestore = () => {
    restoreDefaults.mutate();
  };

  const handleExport = (format: 'csv' | 'json') => {
    const allItems = Object.values(categories).flat();
    
    if (format === 'json') {
      const data = JSON.stringify(allItems, null, 2);
      downloadFile(data, 'precos-icf.json', 'application/json');
    } else {
      const headers = 'Categoria,Nome,Unidade,Preço\n';
      const rows = allItems.map(item => 
        `"${item.categoria}","${item.nome}","${item.unidade}",${item.preco}`
      ).join('\n');
      downloadFile(headers + rows, 'precos-icf.csv', 'text/csv');
    }
    
    toast({
      title: 'Exportação concluída',
      description: `Arquivo ${format.toUpperCase()} baixado com sucesso.`,
    });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(content) as PriceCatalogItem[];
          const updates: Record<string, { preco: number; unidade: string }> = {};
          
          data.forEach(item => {
            // Find matching item by name
            const existing = Object.values(categories).flat().find(
              existing => existing.nome === item.nome
            );
            if (existing) {
              updates[existing.id] = { preco: item.preco, unidade: item.unidade };
            }
          });
          
          setEditedPrices(prev => ({ ...prev, ...updates }));
          setHasChanges(true);
          toast({
            title: 'Importação concluída',
            description: 'Preços carregados. Clique em Salvar para confirmar.',
          });
        } else if (file.name.endsWith('.csv')) {
          const lines = content.split('\n').slice(1); // Skip header
          const updates: Record<string, { preco: number; unidade: string }> = {};
          
          lines.forEach(line => {
            const match = line.match(/"([^"]+)","([^"]+)","([^"]+)",(\d+\.?\d*)/);
            if (match) {
              const [, , nome, unidade, preco] = match;
              const existing = Object.values(categories).flat().find(
                item => item.nome === nome
              );
              if (existing) {
                updates[existing.id] = { preco: parseFloat(preco), unidade };
              }
            }
          });
          
          setEditedPrices(prev => ({ ...prev, ...updates }));
          setHasChanges(true);
          toast({
            title: 'Importação concluída',
            description: 'Preços carregados. Clique em Salvar para confirmar.',
          });
        }
      } catch {
        toast({
          title: 'Erro na importação',
          description: 'Arquivo inválido ou formato incorreto.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter items by search
  const filteredCategories = Object.entries(categories).reduce((acc, [cat, items]) => {
    const filtered = items.filter(item =>
      item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) {
      acc[cat] = filtered;
    }
    return acc;
  }, {} as Record<string, PriceCatalogItem[]>);

  // Sort categories
  const sortedCategories = categoryOrder.filter(cat => filteredCategories[cat]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Carregando preços...</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Preços (Padrão da Empresa)</h1>
            <p className="text-muted-foreground">
              Tabela global de preços usada em todos os orçamentos
            </p>
          </div>

          {/* Last update info */}
          {lastUpdate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>
                Última atualização: {format(new Date(lastUpdate.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>

        {/* Admin notice */}
        {!isAdmin && (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Apenas administradores podem editar os preços. Você está visualizando em modo somente leitura.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Actions bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Action buttons */}
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || bulkUpdatePrices.isPending}
                    className="btn-primary"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {bulkUpdatePrices.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restaurar Padrão
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Restaurar preços padrão?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação irá restaurar todos os preços para os valores originais do sistema.
                          As alterações feitas serão perdidas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestore}>
                          Restaurar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleExport('csv')}>
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                    <Button variant="outline" onClick={() => handleExport('json')}>
                      <Download className="w-4 h-4 mr-2" />
                      JSON
                    </Button>
                  </div>

                  <label>
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Importar
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Price categories accordion */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Catálogo de Preços
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={sortedCategories} className="space-y-2">
              {sortedCategories.map((categoria) => (
                <AccordionItem
                  key={categoria}
                  value={categoria}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {categoryIcons[categoria] || <Package className="w-5 h-5" />}
                      </div>
                      <span className="font-semibold">{categoria}</span>
                      <Badge variant="secondary" className="ml-2">
                        {filteredCategories[categoria].length} itens
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      {/* Table header */}
                      <div className="grid grid-cols-12 gap-4 px-2 py-2 text-sm font-medium text-muted-foreground border-b">
                        <div className="col-span-5">Item</div>
                        <div className="col-span-3">Unidade</div>
                        <div className="col-span-4">Preço (R$)</div>
                      </div>
                      
                      {/* Items */}
                      {filteredCategories[categoria].map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-12 gap-4 px-2 py-2 items-center rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="col-span-5">
                            <span className="font-medium">{item.nome}</span>
                          </div>
                          <div className="col-span-3">
                            {isAdmin ? (
                              <Input
                                value={editedPrices[item.id]?.unidade || item.unidade}
                                onChange={(e) => handleUnitChange(item.id, e.target.value)}
                                className="h-9"
                              />
                            ) : (
                              <span className="text-muted-foreground">{item.unidade}</span>
                            )}
                          </div>
                          <div className="col-span-4">
                            {isAdmin ? (
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  R$
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editedPrices[item.id]?.preco ?? item.preco}
                                  onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                  className="h-9 pl-10"
                                />
                              </div>
                            ) : (
                              <span className="font-semibold text-primary">
                                {formatCurrency(item.preco)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {sortedCategories.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum item encontrado para "{searchTerm}"</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
