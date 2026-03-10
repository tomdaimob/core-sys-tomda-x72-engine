import { useState, useCallback, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DoorOpen,
  Warehouse,
  Upload,
  FileText,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Lock,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  AlertTriangle,
  Info,
  Square
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { usePortasPortoesIA, PortasPortoesExtractionResult } from '@/hooks/usePortasPortoesIA';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Types
export type TipoMaterialPorta = 'MADEIRA' | 'ALUMINIO';
export type TipoMaterialPortao = 'FERRO' | 'ALUMINIO';
export type TipoMaterialJanela = 'ALUMINIO' | 'VIDRO_TEMPERADO';
export type ModoPortasPortoes = 'IMPORT' | 'MANUAL';
export type OrigemItem = 'PDF' | 'MANUAL' | 'DUPLICADO';
export type TipoPorta = 'INTERNA' | 'EXTERNA';

export interface DoorItem {
  id: string;
  label: string;
  tipo: TipoPorta;
  material: TipoMaterialPorta;
  width_m: number;
  height_m: number;
  area_m2: number;
  origem: OrigemItem;
  confianca?: number;
  inferred?: boolean;
  page_number?: number;
}

export interface GateItem {
  id: string;
  label: string;
  material: TipoMaterialPortao;
  width_m: number;
  height_m: number;
  area_m2: number;
  origem: OrigemItem;
  confianca?: number;
  inferred?: boolean;
  page_number?: number;
}

export interface WindowItem {
  id: string;
  label: string;
  material: TipoMaterialJanela;
  width_m: number;
  height_m: number;
  area_m2: number;
  origem: OrigemItem;
  confianca?: number;
  inferred?: boolean;
  page_number?: number;
}

export interface PortasPortoesInput {
  mode: ModoPortasPortoes;
  doorsItems: DoorItem[];
  gatesItems: GateItem[];
  windowsItems: WindowItem[];
  unitsCount: number;
  // Deprecated - keeping for backward compatibility
  areaPortasM2?: number;
  areaPortoesM2?: number;
  materialPorta?: TipoMaterialPorta;
  materialPortao?: TipoMaterialPortao;
  fromAI?: boolean;
  portasItems?: Array<{ label: string; width_m: number; height_m: number; area_m2: number }>;
  portoesItems?: Array<{ label: string; width_m: number; height_m: number; area_m2: number }>;
}

export interface ResultadoPortasPortoes {
  areaPortasM2: number;
  areaPortoesM2: number;
  areaJanelasM2: number;
  custoPortas: number;
  custoPortoes: number;
  custoJanelas: number;
  custoTotal: number;
  doorsItems: DoorItem[];
  gatesItems: GateItem[];
  windowsItems: WindowItem[];
}

export interface PrecosPortasPortoes {
  portaMadeiraM2: number;
  portaAluminioM2: number;
  portaoFerroM2: number;
  portaoAluminioM2: number;
  janelaAluminioM2: number;
  janelaVidroTemperadoM2: number;
}

// Default values
export const DEFAULT_PORTAS_PORTOES: PortasPortoesInput = {
  mode: 'IMPORT',
  doorsItems: [],
  gatesItems: [],
  windowsItems: [],
  unitsCount: 1,
  areaPortasM2: 0,
  areaPortoesM2: 0,
  materialPorta: 'MADEIRA',
  materialPortao: 'FERRO',
  fromAI: false,
};

// Generate unique ID
function generateId(): string {
  return 'item_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36).slice(-4);
}

// Calculate function
export function calcularPortasPortoesResultado(
  input: PortasPortoesInput,
  precos: PrecosPortasPortoes
): ResultadoPortasPortoes {
  let custoPortas = 0;
  let custoPortoes = 0;
  let custoJanelas = 0;
  let areaPortasM2 = 0;
  let areaPortoesM2 = 0;
  let areaJanelasM2 = 0;

  for (const door of input.doorsItems) {
    const preco = door.material === 'MADEIRA' ? precos.portaMadeiraM2 : precos.portaAluminioM2;
    custoPortas += door.area_m2 * preco;
    areaPortasM2 += door.area_m2;
  }

  for (const gate of input.gatesItems) {
    const preco = gate.material === 'FERRO' ? precos.portaoFerroM2 : precos.portaoAluminioM2;
    custoPortoes += gate.area_m2 * preco;
    areaPortoesM2 += gate.area_m2;
  }

  const windows = input.windowsItems || [];
  for (const win of windows) {
    const preco = win.material === 'ALUMINIO' ? precos.janelaAluminioM2 : precos.janelaVidroTemperadoM2;
    custoJanelas += win.area_m2 * preco;
    areaJanelasM2 += win.area_m2;
  }

  return {
    areaPortasM2,
    areaPortoesM2,
    areaJanelasM2,
    custoPortas,
    custoPortoes,
    custoJanelas,
    custoTotal: custoPortas + custoPortoes + custoJanelas,
    doorsItems: input.doorsItems,
    gatesItems: input.gatesItems,
    windowsItems: windows,
  };
}

interface PortasPortoesFormProps {
  portasPortoes: PortasPortoesInput;
  onPortasPortoesChange: (data: PortasPortoesInput) => void;
  precos: PrecosPortasPortoes;
  resultado: ResultadoPortasPortoes;
  orcamentoId?: string | null;
  tipoProposta: 'parede_cinza' | 'obra_completa';
}

export function PortasPortoesForm({
  portasPortoes,
  onPortasPortoesChange,
  precos,
  resultado,
  orcamentoId,
  tipoProposta,
}: PortasPortoesFormProps) {
  const { isAdmin } = useAuth();
  const { extractedData, extracting, extractFromPdf, hasExtracao, clearExtracao, extracao } = usePortasPortoesIA(orcamentoId);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Ensure windowsItems exists (backward compat)
  const windowsItems = portasPortoes.windowsItems || [];

  // Migrate old data format to new format
  useEffect(() => {
    if (extractedData && portasPortoes.doorsItems.length === 0 && portasPortoes.gatesItems.length === 0 && windowsItems.length === 0) {
      const newDoors: DoorItem[] = extractedData.doors.items.map(item => ({
        id: item.id || generateId(),
        label: item.label,
        tipo: (item as any).tipo || 'INTERNA',
        material: (item as any).material || 'MADEIRA',
        width_m: item.width_m,
        height_m: item.height_m,
        area_m2: item.area_m2,
        origem: 'PDF' as const,
        confianca: item.confianca,
        inferred: (item as any).inferred,
        page_number: (item as any).page_number,
      }));

      const newGates: GateItem[] = extractedData.gates.items.map(item => ({
        id: item.id || generateId(),
        label: item.label,
        material: (item as any).material || 'FERRO',
        width_m: item.width_m,
        height_m: item.height_m,
        area_m2: item.area_m2,
        origem: 'PDF' as const,
        confianca: item.confianca,
        inferred: (item as any).inferred,
        page_number: (item as any).page_number,
      }));

      const windowsData = (extractedData as any).windows;
      const newWindows: WindowItem[] = windowsData?.items?.map((item: any) => ({
        id: item.id || generateId(),
        label: item.label,
        material: item.material || 'ALUMINIO',
        width_m: item.width_m,
        height_m: item.height_m,
        area_m2: item.area_m2,
        origem: 'PDF' as const,
        confianca: item.confianca,
        inferred: item.inferred,
        page_number: item.page_number,
      })) || [];

      onPortasPortoesChange({
        ...portasPortoes,
        mode: 'IMPORT',
        doorsItems: newDoors,
        gatesItems: newGates,
        windowsItems: newWindows,
        unitsCount: extractedData.source?.detected_units || 1,
        fromAI: true,
      });
    }
  }, [extractedData]);

  const isDisabled = tipoProposta === 'parede_cinza';

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
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleExtractFromPdf = async () => {
    if (!file) return;
    const result = await extractFromPdf(file);
    if (result) {
      const newDoors: DoorItem[] = result.doors.items.map(item => ({
        id: item.id || generateId(),
        label: item.label,
        tipo: (item as any).tipo || 'INTERNA',
        material: (item as any).material || 'MADEIRA',
        width_m: item.width_m,
        height_m: item.height_m,
        area_m2: item.area_m2,
        origem: 'PDF' as const,
        confianca: item.confianca,
        inferred: (item as any).inferred,
        page_number: (item as any).page_number,
      }));

      const newGates: GateItem[] = result.gates.items.map(item => ({
        id: item.id || generateId(),
        label: item.label,
        material: (item as any).material || 'FERRO',
        width_m: item.width_m,
        height_m: item.height_m,
        area_m2: item.area_m2,
        origem: 'PDF' as const,
        confianca: item.confianca,
        inferred: (item as any).inferred,
        page_number: (item as any).page_number,
      }));

      const windowsData = (result as any).windows;
      const newWindows: WindowItem[] = windowsData?.items?.map((item: any) => ({
        id: item.id || generateId(),
        label: item.label,
        material: item.material || 'ALUMINIO',
        width_m: item.width_m,
        height_m: item.height_m,
        area_m2: item.area_m2,
        origem: 'PDF' as const,
        confianca: item.confianca,
        inferred: item.inferred,
        page_number: item.page_number,
      })) || [];

      onPortasPortoesChange({
        ...portasPortoes,
        mode: 'IMPORT',
        doorsItems: newDoors,
        gatesItems: newGates,
        windowsItems: newWindows,
        unitsCount: result.source?.detected_units || 1,
        fromAI: true,
      });
      setFile(null);
    }
  };

  const handleModeChange = (mode: ModoPortasPortoes) => {
    onPortasPortoesChange({ ...portasPortoes, mode });
  };

  const handleClearData = () => {
    clearExtracao();
    onPortasPortoesChange(DEFAULT_PORTAS_PORTOES);
  };

  // ---- DOOR HANDLERS ----
  const addDoor = () => {
    const newDoor: DoorItem = {
      id: generateId(),
      label: `P${portasPortoes.doorsItems.length + 1}`,
      tipo: 'INTERNA',
      material: 'MADEIRA',
      width_m: 0.80,
      height_m: 2.10,
      area_m2: 0.80 * 2.10,
      origem: 'MANUAL',
    };
    onPortasPortoesChange({ ...portasPortoes, doorsItems: [...portasPortoes.doorsItems, newDoor] });
  };

  const duplicateDoorItem = (door: DoorItem) => {
    const dup: DoorItem = {
      ...door,
      id: generateId(),
      label: door.label + ' (cópia)',
      origem: 'DUPLICADO',
    };
    onPortasPortoesChange({ ...portasPortoes, doorsItems: [...portasPortoes.doorsItems, dup] });
  };

  const updateDoor = (id: string, updates: Partial<DoorItem>) => {
    const newDoors = portasPortoes.doorsItems.map(door => {
      if (door.id === id) {
        const updated = { ...door, ...updates };
        if (updates.width_m !== undefined || updates.height_m !== undefined) {
          updated.area_m2 = updated.width_m * updated.height_m;
        }
        return updated;
      }
      return door;
    });
    onPortasPortoesChange({ ...portasPortoes, doorsItems: newDoors });
  };

  const removeDoor = (id: string) => {
    onPortasPortoesChange({ ...portasPortoes, doorsItems: portasPortoes.doorsItems.filter(d => d.id !== id) });
  };

  // ---- GATE HANDLERS ----
  const addGate = () => {
    const newGate: GateItem = {
      id: generateId(),
      label: `G${portasPortoes.gatesItems.length + 1}`,
      material: 'FERRO',
      width_m: 3.00,
      height_m: 2.20,
      area_m2: 3.00 * 2.20,
      origem: 'MANUAL',
    };
    onPortasPortoesChange({ ...portasPortoes, gatesItems: [...portasPortoes.gatesItems, newGate] });
  };

  const duplicateGateItem = (gate: GateItem) => {
    const dup: GateItem = {
      ...gate,
      id: generateId(),
      label: gate.label + ' (cópia)',
      origem: 'DUPLICADO',
    };
    onPortasPortoesChange({ ...portasPortoes, gatesItems: [...portasPortoes.gatesItems, dup] });
  };

  const updateGate = (id: string, updates: Partial<GateItem>) => {
    const newGates = portasPortoes.gatesItems.map(gate => {
      if (gate.id === id) {
        const updated = { ...gate, ...updates };
        if (updates.width_m !== undefined || updates.height_m !== undefined) {
          updated.area_m2 = updated.width_m * updated.height_m;
        }
        return updated;
      }
      return gate;
    });
    onPortasPortoesChange({ ...portasPortoes, gatesItems: newGates });
  };

  const removeGate = (id: string) => {
    onPortasPortoesChange({ ...portasPortoes, gatesItems: portasPortoes.gatesItems.filter(g => g.id !== id) });
  };

  // ---- WINDOW HANDLERS ----
  const addWindow = () => {
    const newWindow: WindowItem = {
      id: generateId(),
      label: `J${windowsItems.length + 1}`,
      material: 'ALUMINIO',
      width_m: 1.20,
      height_m: 1.20,
      area_m2: 1.20 * 1.20,
      origem: 'MANUAL',
    };
    onPortasPortoesChange({ ...portasPortoes, windowsItems: [...windowsItems, newWindow] });
  };

  const duplicateWindowItem = (win: WindowItem) => {
    const dup: WindowItem = {
      ...win,
      id: generateId(),
      label: win.label + ' (cópia)',
      origem: 'DUPLICADO',
    };
    onPortasPortoesChange({ ...portasPortoes, windowsItems: [...windowsItems, dup] });
  };

  const updateWindow = (id: string, updates: Partial<WindowItem>) => {
    const newWindows = windowsItems.map(win => {
      if (win.id === id) {
        const updated = { ...win, ...updates };
        if (updates.width_m !== undefined || updates.height_m !== undefined) {
          updated.area_m2 = updated.width_m * updated.height_m;
        }
        return updated;
      }
      return win;
    });
    onPortasPortoesChange({ ...portasPortoes, windowsItems: newWindows });
  };

  const removeWindow = (id: string) => {
    onPortasPortoesChange({ ...portasPortoes, windowsItems: windowsItems.filter(w => w.id !== id) });
  };

  // ---- BULK DUPLICATION (casas geminadas) ----
  const hasDuplicatedDoors = portasPortoes.doorsItems.some(d => d.origem === 'DUPLICADO');
  const hasDuplicatedGates = portasPortoes.gatesItems.some(g => g.origem === 'DUPLICADO');
  const hasDuplicatedWindows = windowsItems.some(w => w.origem === 'DUPLICADO');

  const duplicateDoors = () => {
    if (hasDuplicatedDoors) return;
    const baseDoors = portasPortoes.doorsItems.filter(d => d.origem !== 'DUPLICADO');
    const duplicates: DoorItem[] = baseDoors.map(door => ({
      ...door,
      id: generateId(),
      label: door.label.replace(/-A$/, '') + '-B',
      origem: 'DUPLICADO' as const,
    }));
    const updatedOriginals = baseDoors.map(door => ({
      ...door,
      label: door.label.endsWith('-A') ? door.label : door.label + '-A',
    }));
    onPortasPortoesChange({ ...portasPortoes, doorsItems: [...updatedOriginals, ...duplicates] });
  };

  const resetDoorsDuplication = () => {
    const baseDoors = portasPortoes.doorsItems
      .filter(d => d.origem !== 'DUPLICADO')
      .map(door => ({ ...door, label: door.label.replace(/-A$/, '') }));
    onPortasPortoesChange({ ...portasPortoes, doorsItems: baseDoors });
  };

  const duplicateGates = () => {
    if (hasDuplicatedGates) return;
    const baseGates = portasPortoes.gatesItems.filter(g => g.origem !== 'DUPLICADO');
    const duplicates: GateItem[] = baseGates.map(gate => ({
      ...gate,
      id: generateId(),
      label: gate.label.replace(/-A$/, '') + '-B',
      origem: 'DUPLICADO' as const,
    }));
    const updatedOriginals = baseGates.map(gate => ({
      ...gate,
      label: gate.label.endsWith('-A') ? gate.label : gate.label + '-A',
    }));
    onPortasPortoesChange({ ...portasPortoes, gatesItems: [...updatedOriginals, ...duplicates] });
  };

  const resetGatesDuplication = () => {
    const baseGates = portasPortoes.gatesItems
      .filter(g => g.origem !== 'DUPLICADO')
      .map(gate => ({ ...gate, label: gate.label.replace(/-A$/, '') }));
    onPortasPortoesChange({ ...portasPortoes, gatesItems: baseGates });
  };

  const duplicateWindows = () => {
    if (hasDuplicatedWindows) return;
    const baseWindows = windowsItems.filter(w => w.origem !== 'DUPLICADO');
    const duplicates: WindowItem[] = baseWindows.map(win => ({
      ...win,
      id: generateId(),
      label: win.label.replace(/-A$/, '') + '-B',
      origem: 'DUPLICADO' as const,
    }));
    const updatedOriginals = baseWindows.map(win => ({
      ...win,
      label: win.label.endsWith('-A') ? win.label : win.label + '-A',
    }));
    onPortasPortoesChange({ ...portasPortoes, windowsItems: [...updatedOriginals, ...duplicates] });
  };

  const resetWindowsDuplication = () => {
    const baseWindows = windowsItems
      .filter(w => w.origem !== 'DUPLICADO')
      .map(win => ({ ...win, label: win.label.replace(/-A$/, '') }));
    onPortasPortoesChange({ ...portasPortoes, windowsItems: baseWindows });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const hasItems = portasPortoes.doorsItems.length > 0 || portasPortoes.gatesItems.length > 0 || windowsItems.length > 0;
  const showDuplicationButtons = portasPortoes.unitsCount >= 2;

  const extractionWarnings = extractedData?.source?.warnings || [];
  const allConfItems = [...portasPortoes.doorsItems, ...portasPortoes.gatesItems, ...windowsItems];
  const avgConfidence = allConfItems
    .filter(item => item.confianca !== undefined)
    .reduce((sum, item, _, arr) => sum + (item.confianca || 0) / arr.length, 0);
  const hasLowConfidence = avgConfidence > 0 && avgConfidence < 0.75;

  // Render disabled state for parede cinza
  if (isDisabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Portas, Janelas e Portões</h2>
        </div>
        <div className="flex items-center gap-4 p-8 bg-muted/50 rounded-xl border border-dashed text-center justify-center">
          <Lock className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-muted-foreground">Disponível apenas na modalidade Obra Completa</p>
            <p className="text-sm text-muted-foreground mt-1">
              Altere o tipo de proposta para "Obra Completa" para habilitar esta etapa.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Helper to get window price
  const getWindowPrice = (material: TipoMaterialJanela) => 
    material === 'ALUMINIO' ? precos.janelaAluminioM2 : precos.janelaVidroTemperadoM2;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Portas, Janelas e Portões</h2>
        {hasItems && (
          <Badge variant="secondary" className="gap-1">
            {portasPortoes.doorsItems.length} porta(s), {windowsItems.length} janela(s), {portasPortoes.gatesItems.length} portão(ões)
          </Badge>
        )}
      </div>

      {/* Mode Selector */}
      <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
        <Label className="text-sm font-medium">Modo de entrada:</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={portasPortoes.mode === 'IMPORT' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('IMPORT')}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Importar do PDF
          </Button>
          <Button
            type="button"
            variant={portasPortoes.mode === 'MANUAL' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleModeChange('MANUAL')}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Manual
          </Button>
        </div>
      </div>

      {/* PDF Upload Section - Only for IMPORT mode when no items */}
      {portasPortoes.mode === 'IMPORT' && !hasItems && (
        <div className="space-y-4">
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
              disabled={extracting}
            />
            {!file ? (
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-foreground font-medium">Arraste a planta PDF aqui</p>
                  <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  A IA irá identificar automaticamente portas, janelas e portões de TODAS as páginas
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground truncate max-w-[200px]">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); setFile(null); }} disabled={extracting}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>

          {file && (
            <Button onClick={handleExtractFromPdf} disabled={extracting || !orcamentoId} className="w-full gap-2">
              {extracting ? (
                <><Loader2 className="w-5 h-5 animate-spin" />Identificando portas, janelas e portões...</>
              ) : (
                <><Sparkles className="w-5 h-5" />Importar do PDF</>
              )}
            </Button>
          )}

          {!orcamentoId && (
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>Salve o orçamento antes de importar medidas do PDF.</p>
            </div>
          )}
        </div>
      )}

      {/* Reimport button when items exist in IMPORT mode */}
      {portasPortoes.mode === 'IMPORT' && hasItems && (
        <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-700">Dados importados do PDF</p>
              <p className="text-sm text-green-600/80">
                {portasPortoes.doorsItems.length} porta(s), {windowsItems.length} janela(s) e {portasPortoes.gatesItems.length} portão(ões)
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleClearData} className="border-green-500/30 text-green-700 hover:bg-green-500/10">
            <RefreshCw className="w-4 h-4 mr-1" />
            Reimportar
          </Button>
        </div>
      )}

      {/* Warnings */}
      {(extractionWarnings.length > 0 || hasLowConfidence) && hasItems && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Atenção</p>
            {hasLowConfidence && (
              <p className="text-sm text-amber-700 mt-1">
                A importação pode não ter capturado todas as aberturas. Confira a lista e adicione manualmente se necessário.
              </p>
            )}
            {extractionWarnings.map((warning, idx) => (
              <p key={idx} className="text-sm text-amber-700 mt-1">• {warning}</p>
            ))}
          </div>
        </div>
      )}

      {/* Units count for duplication */}
      {hasItems && (
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
          <Label className="text-sm font-medium">Unidades da obra (casas geminadas):</Label>
          <Select
            value={portasPortoes.unitsCount.toString()}
            onValueChange={(val) => onPortasPortoesChange({ ...portasPortoes, unitsCount: parseInt(val) })}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
            </SelectContent>
          </Select>
          {showDuplicationButtons && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="w-4 h-4" />
              Use os botões de duplicação abaixo para copiar itens
            </div>
          )}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CARD A: PORTAS */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <DoorOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Portas</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Área: <span className="font-semibold text-foreground">{formatNumber(resultado.areaPortasM2, 2)} m²</span>
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addDoor} className="gap-1">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showDuplicationButtons && portasPortoes.doorsItems.length > 0 && (
              <div className="flex gap-2 pb-3 border-b">
                {!hasDuplicatedDoors ? (
                  <Button variant="outline" size="sm" onClick={duplicateDoors} className="gap-1 text-blue-700 border-blue-300 hover:bg-blue-100">
                    <Copy className="w-4 h-4" />Duplicar p/ Casa 2
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={resetDoorsDuplication} className="gap-1 text-red-700 border-red-300 hover:bg-red-100">
                    <RotateCcw className="w-4 h-4" />Resetar
                  </Button>
                )}
              </div>
            )}

            {portasPortoes.doorsItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma porta adicionada</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {portasPortoes.doorsItems.map((door) => (
                  <div key={door.id} className="bg-white/70 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Input value={door.label} onChange={(e) => updateDoor(door.id, { label: e.target.value })} className="w-20 h-7 text-sm font-medium" />
                        <Badge variant="outline" className={cn("text-xs",
                          door.origem === 'PDF' && "bg-green-50 text-green-700",
                          door.origem === 'MANUAL' && "bg-blue-50 text-blue-700",
                          door.origem === 'DUPLICADO' && "bg-purple-50 text-purple-700"
                        )}>{door.origem}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-100" onClick={() => duplicateDoorItem(door)} title="Duplicar este item">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-100" onClick={() => removeDoor(door.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2 items-end">
                      <div>
                        <Label className="text-xs text-muted-foreground">Tipo</Label>
                        <Select value={door.tipo} onValueChange={(val) => updateDoor(door.id, { tipo: val as TipoPorta })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INTERNA">Interna</SelectItem>
                            <SelectItem value="EXTERNA">Externa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Material</Label>
                        <Select value={door.material} onValueChange={(val) => updateDoor(door.id, { material: val as TipoMaterialPorta })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MADEIRA">Madeira</SelectItem>
                            <SelectItem value="ALUMINIO">Alumínio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Larg. (m)</Label>
                        <Input type="number" step="0.01" value={door.width_m} onChange={(e) => updateDoor(door.id, { width_m: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Alt. (m)</Label>
                        <Input type="number" step="0.01" value={door.height_m} onChange={(e) => updateDoor(door.id, { height_m: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Área (m²)</Label>
                        <Input type="number" value={door.area_m2.toFixed(2)} readOnly className="h-8 text-xs bg-muted/50" />
                      </div>
                    </div>
                    <div className="text-xs text-right text-muted-foreground">
                      {door.material === 'MADEIRA' ? formatCurrency(precos.portaMadeiraM2) : formatCurrency(precos.portaAluminioM2)}/m² 
                      = <span className="font-medium text-blue-700">
                        {formatCurrency(door.area_m2 * (door.material === 'MADEIRA' ? precos.portaMadeiraM2 : precos.portaAluminioM2))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Custo Total Portas:</span>
                <span className="text-lg font-bold text-blue-700">{formatCurrency(resultado.custoPortas)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD B: JANELAS */}
        <Card className="border-teal-200 bg-teal-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Square className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Janelas</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Área: <span className="font-semibold text-foreground">{formatNumber(resultado.areaJanelasM2, 2)} m²</span>
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addWindow} className="gap-1">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showDuplicationButtons && windowsItems.length > 0 && (
              <div className="flex gap-2 pb-3 border-b">
                {!hasDuplicatedWindows ? (
                  <Button variant="outline" size="sm" onClick={duplicateWindows} className="gap-1 text-teal-700 border-teal-300 hover:bg-teal-100">
                    <Copy className="w-4 h-4" />Duplicar p/ Casa 2
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={resetWindowsDuplication} className="gap-1 text-red-700 border-red-300 hover:bg-red-100">
                    <RotateCcw className="w-4 h-4" />Resetar
                  </Button>
                )}
              </div>
            )}

            {windowsItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma janela adicionada</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {windowsItems.map((win) => (
                  <div key={win.id} className="bg-white/70 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Input value={win.label} onChange={(e) => updateWindow(win.id, { label: e.target.value })} className="w-20 h-7 text-sm font-medium" />
                        <Badge variant="outline" className={cn("text-xs",
                          win.origem === 'PDF' && "bg-green-50 text-green-700",
                          win.origem === 'MANUAL' && "bg-blue-50 text-blue-700",
                          win.origem === 'DUPLICADO' && "bg-purple-50 text-purple-700"
                        )}>{win.origem}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-teal-500 hover:text-teal-700 hover:bg-teal-100" onClick={() => duplicateWindowItem(win)} title="Duplicar este item">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-100" onClick={() => removeWindow(win.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-xs text-muted-foreground">Material</Label>
                        <Select value={win.material} onValueChange={(val) => updateWindow(win.id, { material: val as TipoMaterialJanela })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALUMINIO">Alumínio</SelectItem>
                            <SelectItem value="VIDRO_TEMPERADO">Vidro Temp.</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Larg. (m)</Label>
                        <Input type="number" step="0.01" value={win.width_m} onChange={(e) => updateWindow(win.id, { width_m: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Alt. (m)</Label>
                        <Input type="number" step="0.01" value={win.height_m} onChange={(e) => updateWindow(win.id, { height_m: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Área (m²)</Label>
                        <Input type="number" value={win.area_m2.toFixed(2)} readOnly className="h-8 text-xs bg-muted/50" />
                      </div>
                    </div>
                    <div className="text-xs text-right text-muted-foreground">
                      {formatCurrency(getWindowPrice(win.material))}/m² 
                      = <span className="font-medium text-teal-700">
                        {formatCurrency(win.area_m2 * getWindowPrice(win.material))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Custo Total Janelas:</span>
                <span className="text-lg font-bold text-teal-700">{formatCurrency(resultado.custoJanelas)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD C: PORTÕES */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Warehouse className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Portões</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Área: <span className="font-semibold text-foreground">{formatNumber(resultado.areaPortoesM2, 2)} m²</span>
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={addGate} className="gap-1">
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showDuplicationButtons && portasPortoes.gatesItems.length > 0 && (
              <div className="flex gap-2 pb-3 border-b">
                {!hasDuplicatedGates ? (
                  <Button variant="outline" size="sm" onClick={duplicateGates} className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-100">
                    <Copy className="w-4 h-4" />Duplicar p/ Casa 2
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={resetGatesDuplication} className="gap-1 text-red-700 border-red-300 hover:bg-red-100">
                    <RotateCcw className="w-4 h-4" />Resetar
                  </Button>
                )}
              </div>
            )}

            {portasPortoes.gatesItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum portão adicionado</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {portasPortoes.gatesItems.map((gate) => (
                  <div key={gate.id} className="bg-white/70 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Input value={gate.label} onChange={(e) => updateGate(gate.id, { label: e.target.value })} className="w-20 h-7 text-sm font-medium" />
                        <Badge variant="outline" className={cn("text-xs",
                          gate.origem === 'PDF' && "bg-green-50 text-green-700",
                          gate.origem === 'MANUAL' && "bg-blue-50 text-blue-700",
                          gate.origem === 'DUPLICADO' && "bg-purple-50 text-purple-700"
                        )}>{gate.origem}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500 hover:text-amber-700 hover:bg-amber-100" onClick={() => duplicateGateItem(gate)} title="Duplicar este item">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-100" onClick={() => removeGate(gate.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-xs text-muted-foreground">Material</Label>
                        <Select value={gate.material} onValueChange={(val) => updateGate(gate.id, { material: val as TipoMaterialPortao })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FERRO">Ferro</SelectItem>
                            <SelectItem value="ALUMINIO">Alumínio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Larg. (m)</Label>
                        <Input type="number" step="0.01" value={gate.width_m} onChange={(e) => updateGate(gate.id, { width_m: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Alt. (m)</Label>
                        <Input type="number" step="0.01" value={gate.height_m} onChange={(e) => updateGate(gate.id, { height_m: parseFloat(e.target.value) || 0 })} className="h-8 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Área (m²)</Label>
                        <Input type="number" value={gate.area_m2.toFixed(2)} readOnly className="h-8 text-xs bg-muted/50" />
                      </div>
                    </div>
                    <div className="text-xs text-right text-muted-foreground">
                      {gate.material === 'FERRO' ? formatCurrency(precos.portaoFerroM2) : formatCurrency(precos.portaoAluminioM2)}/m² 
                      = <span className="font-medium text-amber-700">
                        {formatCurrency(gate.area_m2 * (gate.material === 'FERRO' ? precos.portaoFerroM2 : precos.portaoAluminioM2))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Custo Total Portões:</span>
                <span className="text-lg font-bold text-amber-700">{formatCurrency(resultado.custoPortoes)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Portas</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(resultado.custoPortas)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Janelas</p>
              <p className="text-xl font-bold text-teal-600">{formatCurrency(resultado.custoJanelas)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Portões</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(resultado.custoPortoes)}</p>
            </div>
            <div className="border-l pl-4">
              <p className="text-sm text-muted-foreground">Total Geral</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(resultado.custoTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
