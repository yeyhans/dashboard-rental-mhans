import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Note {
  id: number;
  author: string;
  date_created: string;
  content: string;
  customer_note: boolean;
}

interface OrderNotesProps {
  orderId: string;
}

export function OrderNotes({ orderId }: OrderNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isCustomerNote, setIsCustomerNote] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);

  const fetchNotes = async () => {
    try {
      setIsLoadingNotes(true);
      const response = await fetch(`/api/woo/order-notes/${orderId}`);
      const data = await response.json();
      
      if (data.success) {
        setNotes(data.data || []);
      } else {
        console.warn('No notes found for order:', orderId);
        setNotes([]);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
      toast.error('Error al cargar las notas');
    } finally {
      setIsLoadingNotes(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [orderId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/woo/order-notes/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note: newNote,
          customer_note: isCustomerNote,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Nota agregada exitosamente');
        setNewNote('');
        setIsCustomerNote(false);
        fetchNotes();
      } else {
        toast.error('Error al agregar la nota');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Error al agregar la nota');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    try {
      const response = await fetch(`/api/woo/order-notes/${orderId}?note_id=${noteId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Nota eliminada exitosamente');
        fetchNotes();
      } else {
        toast.error('Error al eliminar la nota');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Error al eliminar la nota');
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note">Nueva Nota</Label>
              <Textarea
                id="note"
                value={newNote}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewNote(e.target.value)}
                placeholder="Escribe una nota..."
                className="min-h-[100px]"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="customer-note"
                checked={isCustomerNote}
                onCheckedChange={(checked) => setIsCustomerNote(checked as boolean)}
              />
              <Label htmlFor="customer-note" className="text-sm font-normal">
                Enviar al cliente
              </Label>
            </div>
            <Button type="submit" disabled={isLoading || !newNote.trim()}>
              {isLoading ? 'Agregando...' : 'Agregar Nota'}
            </Button>
          </form>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>Historial de Notas ({notes.length})</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNotes}
              disabled={isLoadingNotes}
            >
              {isLoadingNotes ? 'Cargando...' : 'Actualizar'}
            </Button>
          </div>
          <ScrollArea className="h-[300px] rounded-md border p-4">
            <div className="space-y-4">
              {isLoadingNotes ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Cargando notas...</span>
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-2">
                    No hay notas disponibles para esta orden
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Las notas aparecerán aquí una vez que sean agregadas
                  </p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 rounded-lg border bg-card text-card-foreground hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{note.author || 'Administrador'}</p>
                          {note.customer_note && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Cliente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(note.date_created), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
                            handleDelete(note.id);
                          }
                        }}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <span className="sr-only">Eliminar nota</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 16 16"
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 3.75H1.26M5.92 6.5v5.75M10.08 6.5v5.75M12.16 3.75v9.5a1 1 0 0 1-1 1H4.84a1 1 0 0 1-1-1v-9.5M6.5 3.75v-2h3v2"
                          />
                        </svg>
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.content}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}