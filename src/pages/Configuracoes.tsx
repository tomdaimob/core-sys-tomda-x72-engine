import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Save } from 'lucide-react';

export default function Configuracoes() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      toast({ title: 'Configurações salvas!' });
      setSaving(false);
    }, 500);
  };

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground">Personalize o sistema</p>
          </div>
        </div>

        <div className="card-elevated p-6 space-y-6">
          <div className="input-group">
            <Label className="input-label">Nome da Empresa</Label>
            <Input defaultValue="ICF TECNOLOGIA E CONSTRUÇÃO" />
          </div>
          <div className="input-group">
            <Label className="input-label">CNPJ</Label>
            <Input placeholder="00.000.000/0001-00" />
          </div>
          <div className="input-group">
            <Label className="input-label">E-mail de Contato</Label>
            <Input type="email" placeholder="contato@empresa.com" />
          </div>
          
          <Button onClick={handleSave} disabled={saving} className="btn-primary">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
