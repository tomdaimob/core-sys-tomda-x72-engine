import { useEffect, useState } from 'react';
import { Download, Eye, FileText, Loader2, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectPdfStorage, ArquivoProjeto } from '@/hooks/useProjectPdfStorage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AdminPdfAttachmentsProps {
  orcamentoId: string;
}

export function AdminPdfAttachments({ orcamentoId }: AdminPdfAttachmentsProps) {
  const { arquivos, loading, fetchArquivos, downloadArquivo, getDownloadUrl } = useProjectPdfStorage(orcamentoId);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchArquivos();
  }, [fetchArquivos]);

  const handleView = async (arquivo: ArquivoProjeto) => {
    setLoadingView(true);
    const url = await getDownloadUrl(arquivo.storage_path);
    if (url) {
      setPdfUrl(url);
      setViewingPdf(arquivo.id);
    }
    setLoadingView(false);
  };

  const closeViewer = () => {
    setViewingPdf(null);
    setPdfUrl(null);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (arquivos.length === 0) {
    return (
      <div className="text-center py-8 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/30">
        <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-muted-foreground">Nenhum PDF de projeto anexado</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          O vendedor ainda não fez upload de uma planta para este orçamento.
        </p>
      </div>
    );
  }

  const activeArquivo = arquivos.find(a => a.ativo);
  const historico = arquivos.filter(a => !a.ativo);

  return (
    <div className="space-y-6">
      {/* Active PDF */}
      {activeArquivo && (
      <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{activeArquivo.nome}</span>
                  <Badge variant="default" className="text-xs">Atual</Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(activeArquivo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {activeArquivo.uploader_name}
                  </span>
                  <span>{formatFileSize(activeArquivo.tamanho_bytes)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleView(activeArquivo)}
                disabled={loadingView}
              >
                {loadingView ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-1" />
                    Visualizar
                  </>
                )}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => downloadArquivo(activeArquivo)}
              >
                <Download className="w-4 h-4 mr-1" />
                Baixar Planta
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {historico.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            Histórico de Versões ({historico.length})
          </h4>
          <div className="space-y-2">
            {historico.map(arquivo => (
              <div
                key={arquivo.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm text-foreground">{arquivo.nome}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(arquivo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <span>por {arquivo.uploader_name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(arquivo)}
                    disabled={loadingView}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadArquivo(arquivo)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      <Dialog open={!!viewingPdf} onOpenChange={() => closeViewer()}>
        <DialogContent className="max-w-5xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Visualizar Planta
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 h-full min-h-0">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full h-[calc(90vh-100px)] rounded-lg border"
                title="PDF Viewer"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
