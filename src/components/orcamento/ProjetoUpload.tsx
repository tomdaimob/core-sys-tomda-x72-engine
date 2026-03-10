import { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Image, X, Loader2, Sparkles, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useProjectPdfStorage, ArquivoTipo } from '@/hooks/useProjectPdfStorage';
import { useModoMedidas, ModoMedidas } from '@/hooks/useModoMedidas';
import { ModoMedidasSelector } from './ModoMedidasSelector';
import { MedidasManuaisForm } from './MedidasManuaisForm';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ExtractedData {
  area_total_m2: number;
  pe_direito_m: number;
  perimetro_externo_m: number;
  paredes_internas_m: number;
  aberturas_m2: number;
  confianca: number;
  observacoes: string;
}

interface ProjetoUploadProps {
  onDataExtracted: (data: ExtractedData) => void;
  orcamentoId?: string;
  isAdmin?: boolean;
  ensureOrcamentoExists?: () => Promise<string | null>;
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
};

export function ProjetoUpload({ onDataExtracted, orcamentoId, isAdmin = false, ensureOrcamentoExists }: ProjetoUploadProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [hasExistingArquivos, setHasExistingArquivos] = useState(false);
  
  const { 
    uploadProjectPdf, 
    uploadProjectImages, 
    uploading, 
    fetchArquivos, 
    arquivos,
    getActiveArquivoId,
  } = useProjectPdfStorage(orcamentoId);
  
  const {
    state: modoState,
    setModo,
    setManualLock,
    setMedidasManuais,
    isImportBlocked,
    isMedidasManuaisValido,
    reloadState,
  } = useModoMedidas(orcamentoId);

  // Load existing arquivos on mount
  useEffect(() => {
    if (orcamentoId) {
      fetchArquivos();
    }
  }, [orcamentoId, fetchArquivos]);

  // Check if there are existing arquivos
  useEffect(() => {
    setHasExistingArquivos(arquivos.length > 0);
  }, [arquivos]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFiles = useCallback((inputFiles: FileList | File[]): File[] => {
    const validFiles: File[] = [];
    const acceptedMimes = Object.keys(ACCEPTED_TYPES);
    
    Array.from(inputFiles).forEach(file => {
      if (acceptedMimes.includes(file.type)) {
        validFiles.push(file);
      }
    });

    if (validFiles.length === 0) {
      toast({
        title: 'Formato inválido',
        description: 'Aceito: PDF, PNG ou JPG.',
        variant: 'destructive',
      });
    }

    return validFiles;
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files?.length) {
      const validFiles = validateFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        setFiles(validFiles);
      }
    }
  }, [validateFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const validFiles = validateFiles(e.target.files);
      if (validFiles.length > 0) {
        setFiles(validFiles);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
  };

  const getFileIcon = (file: File) => {
    if (file.type === 'application/pdf') {
      return <FileText className="w-6 h-6 text-destructive" />;
    }
    return <Image className="w-6 h-6 text-primary" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Check if manual lock blocks import
  const handleUploadAndExtract = async () => {
    if (files.length === 0) return;

    // If manual mode is locked, show warning and don't proceed
    if (isImportBlocked) {
      toast({
        title: 'Modo manual travado',
        description: 'Desative a trava para importar e substituir medidas.',
        variant: 'destructive',
      });
      return;
    }

    // If manual mode without lock, ask for confirmation
    if (modoState.modo_medidas === 'MANUAL' && !modoState.manual_lock) {
      setShowOverwriteDialog(true);
      return;
    }

    await performUploadAndExtract();
  };

  const performUploadAndExtract = async () => {
    setExtracting(true);
    
    try {
      // Ensure orcamento exists before uploading
      let effectiveOrcamentoId = orcamentoId;
      if (!effectiveOrcamentoId && ensureOrcamentoExists) {
        effectiveOrcamentoId = await ensureOrcamentoExists() || undefined;
      }
      
      if (!effectiveOrcamentoId) {
        throw new Error('Não foi possível criar o orçamento. Preencha o nome do cliente e tente novamente.');
      }

      // Determine file types
      const hasPdf = files.some(f => f.type === 'application/pdf');

      let arquivoId: string | null = null;
      
      if (hasPdf) {
        // Upload PDF
        const pdfFile = files.find(f => f.type === 'application/pdf')!;
        
        try {
          arquivoId = await uploadProjectPdf(pdfFile);
        } catch (uploadErr: any) {
          console.error('[ProjetoUpload] uploadProjectPdf threw:', uploadErr);
          throw new Error(`Falha no upload do PDF: ${uploadErr.message || 'erro desconhecido'}`);
        }
        
        if (!arquivoId) {
          throw new Error('Falha no upload do PDF. Tente novamente.');
        }

        // Extract data from PDF
        const buffer = await pdfFile.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        const { data, error } = await supabase.functions.invoke('extract-pdf-data', {
          body: {
            pdfBase64: base64,
            fileName: pdfFile.name,
            orcamentoId: effectiveOrcamentoId,
            arquivoId,
          },
        });

        if (error) throw error;

        if (data?.success && data?.data) {
          toast({
            title: 'Dados extraídos com sucesso!',
            description: `Confiança: ${data.data.confianca}%`,
          });
          
          // Set mode to IMPORTACAO
          setModo('IMPORTACAO');
          onDataExtracted(data.data);
        } else if (data?.error) {
          throw new Error(data.error);
        }
      } else if (images.length > 0) {
        // Upload images
        const groupId = await uploadProjectImages(images);
        
        if (!groupId) {
          throw new Error('Falha no upload das imagens.');
        }

        // TODO: Create edge function for image extraction
        toast({
          title: 'Imagens enviadas',
          description: 'Extração de medidas a partir de imagens será implementada em breve.',
        });
      }

      // Refresh arquivos list
      await fetchArquivos();
      clearFiles();
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível processar os arquivos.';
      console.error('Error processing files:', error);
      toast({
        title: 'Erro no processamento',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setExtracting(false);
    }
  };

  const isLoading = uploading || extracting;
  const canUpload = files.length > 0 && !isLoading;

  return (
    <div className="space-y-6">
      {/* Modo de Medidas Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Modo de Medidas</CardTitle>
          <CardDescription>
            Escolha como deseja informar as medidas do projeto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModoMedidasSelector
            state={modoState}
            onModoChange={setModo}
            onManualLockChange={setManualLock}
            hasArquivos={hasExistingArquivos}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {/* Upload Area - Show always, but with warning if locked */}
      <Card className={cn(isImportBlocked && 'opacity-60')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {isImportBlocked ? (
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Upload Desabilitado
                  </span>
                ) : (
                  'Enviar Planta do Projeto'
                )}
              </CardTitle>
              <CardDescription>
                {isImportBlocked 
                  ? 'Desative a trava para enviar novos arquivos.'
                  : 'PDF ou imagens (PNG/JPG) com medidas do projeto.'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isImportBlocked ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
              <Lock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Modo manual travado</p>
                <p className="text-sm text-muted-foreground">
                  Para enviar novos arquivos e usar a extração automática, desative a trava no seletor acima.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  files.length > 0 && 'border-primary/30 bg-primary/5'
                )}
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  multiple
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isLoading}
                />
                
                {files.length === 0 ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-foreground font-medium">
                        Arraste a planta aqui
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        PDF, PNG ou JPG (até 25MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-background">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            {getFileIcon(file)}
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-foreground truncate max-w-[200px]">
                              {file.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            removeFile(index);
                          }}
                          disabled={isLoading}
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Extract Button */}
              {canUpload && (
                <Button
                  onClick={handleUploadAndExtract}
                  disabled={isLoading}
                  className="w-full gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {uploading ? 'Enviando...' : 'Analisando com IA...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Enviar e Extrair Medidas
                    </>
                  )}
                </Button>
              )}

              {/* Info */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>
                  A IA irá analisar a planta e extrair automaticamente as medidas do projeto.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Measurements Form - Show only in manual mode */}
      {modoState.modo_medidas === 'MANUAL' && (
        <MedidasManuaisForm
          medidas={modoState.medidas_manuais}
          onMedidasChange={setMedidasManuais}
          isAdmin={isAdmin}
          disabled={isLoading}
          onCalcular={() => {
            toast({
              title: 'Medidas calculadas',
              description: 'As áreas foram calculadas com base nas medidas informadas. Você pode avançar para a próxima etapa.',
            });
          }}
        />
      )}

      {/* Overwrite Confirmation Dialog */}
      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir medidas manuais?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está no modo manual. Importar dados do arquivo irá substituir 
              suas medidas manuais pelos valores extraídos automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={performUploadAndExtract}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
