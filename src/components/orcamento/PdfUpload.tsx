import { useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ExtractedData {
  area_total_m2: number;
  pe_direito_m: number;
  perimetro_externo_m: number;
  paredes_internas_m: number;
  aberturas_m2: number;
  confianca: number;
  observacoes: string;
}

interface PdfUploadProps {
  onDataExtracted: (data: ExtractedData) => void;
  orcamentoId?: string;
}

export function PdfUpload({ onDataExtracted, orcamentoId }: PdfUploadProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files?.[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
      } else {
        toast({
          title: 'Formato inválido',
          description: 'Por favor, selecione um arquivo PDF.',
          variant: 'destructive',
        });
      }
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const extractWithAI = async () => {
    if (!file) return;

    setExtracting(true);
    
    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Call edge function
      const { data, error } = await supabase.functions.invoke('extract-pdf-data', {
        body: {
          pdfBase64: base64,
          fileName: file.name,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        toast({
          title: 'Dados extraídos com sucesso!',
          description: `Confiança: ${data.data.confianca}%`,
        });
        onDataExtracted(data.data);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error extracting PDF:', error);
      toast({
        title: 'Erro na extração',
        description: error.message || 'Não foi possível extrair os dados do PDF.',
        variant: 'destructive',
      });
    } finally {
      setExtracting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
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
          file && 'border-primary/30 bg-primary/5'
        )}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading || extracting}
        />
        
        {!file ? (
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="text-foreground font-medium">
                Arraste a planta PDF aqui
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                ou clique para selecionar
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Suporta arquivos PDF até 10MB
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                <FileText className="w-6 h-6 text-red-600" />
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
                removeFile();
              }}
              disabled={extracting}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      {/* Extract Button */}
      {file && (
        <Button
          onClick={extractWithAI}
          disabled={extracting}
          className="w-full btn-primary gap-2"
        >
          {extracting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analisando com IA...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Ler Planta com IA
            </>
          )}
        </Button>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          A IA irá analisar a planta e extrair automaticamente: área total, pé-direito, 
          perímetro externo, paredes internas e aberturas.
        </p>
      </div>
    </div>
  );
}
