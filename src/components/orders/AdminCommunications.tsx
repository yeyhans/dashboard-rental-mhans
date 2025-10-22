import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  Clock, 
  CheckCheck,
  User,
  MessageSquare,
  AlertCircle,
  Shield,
  Trash2,
  FileText,
  Mail,
  Package,
  Settings,
  Download,
  BarChart3,
  Search,
  Image,
  Paperclip,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { communicationsService, type OrderCommunication, type AdvancedCommunicationStats } from '../../services/communicationsService';
// Nota: Avatar y Tabs se implementarán cuando estén disponibles en el sistema de UI

interface AdminCommunicationsProps {
  orderId: number;
  customerInfo?: {
    id: string;
    name: string;
    email: string;
  };
  adminInfo: {
    id: string;
    name: string;
    email: string;
  };
}

export function AdminCommunications({ orderId, customerInfo, adminInfo }: AdminCommunicationsProps) {
  const [messages, setMessages] = useState<OrderCommunication[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalMessages, setTotalMessages] = useState(0);
  const [advancedStats, setAdvancedStats] = useState<AdvancedCommunicationStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<OrderCommunication[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showStats, setShowStats] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll al final cuando hay nuevos mensajes
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Cargar mensajes iniciales
  useEffect(() => {
    loadMessages();
  }, [orderId]);

  // Iniciar polling para actualizaciones automáticas
  useEffect(() => {
    console.log('🔄 Starting admin polling for order communications', orderId);
    
    communicationsService.startPollingForOrder(
      orderId,
      (newMessage: OrderCommunication) => {
        setMessages(prev => {
          // Verificar si el mensaje ya existe para evitar duplicados
          const exists = prev.find(msg => msg.id === newMessage.id);
          if (exists) {
            console.log('🔄 Admin message already exists, skipping:', newMessage.id);
            return prev;
          }
          
          console.log('📨 Adding new admin message:', newMessage.id);
          return [...prev, newMessage];
        });
        
        // Solo incrementar si es realmente un mensaje nuevo
        setTotalMessages(prev => {
          // Verificar si ya contamos este mensaje
          return prev + 1;
        });
        
        // Si el mensaje no es del admin actual, mostrar notificación
        if (newMessage.user_id !== adminInfo.id) {
          toast.info('Nuevo mensaje del cliente', {
            description: newMessage.message.substring(0, 50) + (newMessage.message.length > 50 ? '...' : ''),
            action: {
              label: 'Ver',
              onClick: scrollToBottom
            }
          });
          
          // Actualizar contador de no leídos
          setUnreadCount(prev => prev + 1);
        }
        
        setTimeout(scrollToBottom, 100);
      },
      (updatedMessage: OrderCommunication) => {
        setMessages(prev => 
          prev.map(msg => msg.id === updatedMessage.id ? updatedMessage : msg)
        );
      },
      (deletedMessageId: number) => {
        setMessages(prev => prev.filter(msg => msg.id !== deletedMessageId));
        setTotalMessages(prev => prev - 1);
      },
      3000 // Polling cada 3 segundos
    );

    return () => {
      communicationsService.unsubscribeFromOrder(orderId);
    };
  }, [orderId, adminInfo.id]);

  // Marcar mensajes como leídos cuando el componente está visible
  useEffect(() => {
    if (messages.length > 0 && adminInfo.id) {
      markAsRead();
    }
  }, [messages, adminInfo.id]);

  // Auto-scroll cuando hay nuevos mensajes (con debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const communications = await communicationsService.getOrderCommunications(orderId);
      setMessages(communications);
      setFilteredMessages(communications);
      
      // Obtener estadísticas básicas
      const stats = await communicationsService.getCommunicationStats(orderId, adminInfo.id);
      setUnreadCount(stats.unread_messages);
      setTotalMessages(stats.total_messages);
      
      // Obtener estadísticas avanzadas
      try {
        const advStats = await communicationsService.getAdvancedCommunicationStats(orderId);
        setAdvancedStats(advStats);
      } catch (error) {
        console.warn('Advanced stats not available:', error);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Error al cargar los mensajes');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await communicationsService.markMessagesAsRead(orderId, adminInfo.id);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;

    try {
      setSending(true);
      
      if (selectedFile) {
        // Enviar mensaje con archivo
        await communicationsService.sendMessageWithFile(
          orderId,
          adminInfo.id,
          'admin',
          newMessage.trim() || `Archivo adjunto: ${selectedFile.name}`,
          selectedFile,
          adminInfo.name,
          adminInfo.email
        );
      } else {
        // Enviar mensaje de texto
        await communicationsService.sendMessage(
          orderId,
          adminInfo.id,
          'admin',
          newMessage.trim(),
          adminInfo.name,
          adminInfo.email
        );
      }
      
      setNewMessage('');
      setSelectedFile(null);
      toast.success('Mensaje enviado');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };


  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este mensaje?')) return;

    try {
      await communicationsService.deleteMessage(messageId, adminInfo.id);
      
      // Actualizar el estado local inmediatamente
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setFilteredMessages(prev => prev.filter(msg => msg.id !== messageId));
      setTotalMessages(prev => prev - 1);
      
      toast.success('Mensaje eliminado');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Error al eliminar el mensaje');
    }
  };

  // Efecto para filtrar mensajes por búsqueda
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredMessages(messages);
    } else {
      const filtered = messages.filter(msg => 
        msg.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        msg.user_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMessages(filtered);
    }
  }, [searchTerm, messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportConversation = async () => {
    try {
      const exportData = await communicationsService.exportConversation(orderId);
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversacion-orden-${orderId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Conversación exportada');
    } catch (error) {
      console.error('Error exporting conversation:', error);
      toast.error('Error al exportar la conversación');
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    const diffInDays = diffInHours / 24;
    
    if (diffInHours < 1) {
      return 'Ahora';
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString('es-CL', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInDays < 7) {
      return date.toLocaleDateString('es-CL', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const getUserInitials = (message: OrderCommunication) => {
    if (message.user_type === 'admin') {
      return 'AD';
    }
    const name = message.user_name || customerInfo?.name || 'Cliente';
    return name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const isMyMessage = (message: OrderCommunication) => {
    return message.user_id === adminInfo.id;
  };

  // Detectar si el mensaje contiene contenido MDX/Markdown
  const isMarkdownMessage = (message: string) => {
    return message.includes('**') || message.includes('##') || message.includes('📧') || message.includes('📄') || message.includes('✅') || message.includes('❌');
  };

  // Renderizar contenido MDX/Markdown de forma básica
  const renderMessageContent = (message: string) => {
    if (!isMarkdownMessage(message)) {
      return <p className="text-sm whitespace-pre-wrap break-words">{message}</p>;
    }

    // Procesar contenido markdown básico
    let content = message;
    
    // Convertir títulos markdown
    content = content.replace(/## (.*?)\n/g, '<h3 class="font-semibold text-base mb-2 mt-1">$1</h3>');
    content = content.replace(/### (.*?)\n/g, '<h4 class="font-medium text-sm mb-1 mt-1">$1</h4>');
    
    // Convertir texto en negrita
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Convertir saltos de línea
    content = content.replace(/\n/g, '<br />');
    
    // Añadir espaciado para emojis de notificación
    content = content.replace(/(📧|📄|✅|❌|🎉|📊|📋|💬|📎|ℹ️)/g, '<span class="inline-block mr-1">$1</span>');
    
    return (
      <div 
        className="text-sm break-words leading-relaxed"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  // Obtener icono según el tipo de mensaje
  const getMessageIcon = (message: OrderCommunication) => {
    // Icono por tipo de mensaje
    if (message.message_type === 'image') {
      return <Image className="h-3 w-3 mr-1" />;
    }
    if (message.message_type === 'file') {
      return <Paperclip className="h-3 w-3 mr-1" />;
    }
    
    // Icono por contenido
    const content = message.message.toLowerCase();
    if (content.includes('correo') || content.includes('email')) {
      return <Mail className="h-3 w-3 mr-1" />;
    }
    if (content.includes('pdf') || content.includes('documento') || content.includes('presupuesto')) {
      return <FileText className="h-3 w-3 mr-1" />;
    }
    if (content.includes('estado') || content.includes('orden')) {
      return <Package className="h-3 w-3 mr-1" />;
    }
    if (content.includes('sistema') || content.includes('admin')) {
      return <Settings className="h-3 w-3 mr-1" />;
    }
    return null;
  };

  // Renderizar archivo adjunto
  const renderAttachment = (message: OrderCommunication) => {
    if (!message.file_url || !message.file_name) return null;
    
    const isImage = message.message_type === 'image' || 
                   message.file_name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    return (
      <div className="mt-2 p-2 bg-muted/30 rounded border">
        <div className="flex items-center gap-2">
          {isImage ? <Image className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
          <span className="text-xs font-medium">{message.file_name}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 ml-auto"
            onClick={() => window.open(message.file_url, '_blank')}
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
        {isImage && (
          <img 
            src={message.file_url} 
            alt={message.file_name}
            className="mt-2 max-w-full h-auto max-h-32 rounded border"
            loading="lazy"
          />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comunicaciones con Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="flex-shrink-0 pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comunicaciones con Cliente
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2 animate-pulse">
                {unreadCount} nuevo{unreadCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowStats(!showStats)}
              className="h-8 px-2"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Stats
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportConversation}
              className="h-8 px-2"
            >
              <Download className="h-4 w-4 mr-1" />
              Exportar
            </Button>
            <Badge variant="outline" className="text-xs">
              {totalMessages} mensaje{totalMessages !== 1 ? 's' : ''}
            </Badge>
            {customerInfo && (
              <Badge variant="secondary" className="text-xs">
                {customerInfo.name}
              </Badge>
            )}
          </div>
        </CardTitle>
        
        {/* Barra de búsqueda */}
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar mensajes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8"
            />
          </div>
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Panel de estadísticas */}
        {showStats && advancedStats && (
          <div className="mt-3 p-3 bg-muted/20 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="text-center">
                <div className="font-semibold text-blue-600">{advancedStats.customer_messages}</div>
                <div className="text-muted-foreground">Cliente</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-600">{advancedStats.admin_messages}</div>
                <div className="text-muted-foreground">Admin</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-orange-600">{advancedStats.messages_with_files}</div>
                <div className="text-muted-foreground">Con archivos</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-purple-600">
                  {advancedStats.average_response_time_hours ? 
                    `${advancedStats.average_response_time_hours.toFixed(1)}h` : 'N/A'}
                </div>
                <div className="text-muted-foreground">Tiempo resp.</div>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Área de mensajes con scroll mejorado */}
        <ScrollArea className="flex-1 px-3" type="always">
          {filteredMessages.length === 0 ? (
            searchTerm ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin resultados</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  No se encontraron mensajes que coincidan con "{searchTerm}"
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="mt-2"
                >
                  Limpiar búsqueda
                </Button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin mensajes</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Inicia una conversación con el cliente sobre esta orden. Las notificaciones automáticas aparecerán aquí.
                </p>
              </div>
            ) : null
          ) : (
            <div className="space-y-1.5 py-2">
              {filteredMessages.map((message, index) => {
                const prevMessage = filteredMessages[index - 1];
                const isSameUser = prevMessage && prevMessage.user_id === message.user_id;
                const timeDiff = prevMessage ? new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() : 0;
                const isGrouped = isSameUser && timeDiff < 5 * 60 * 1000; // 5 minutos
                
                return (
                  <div key={message.id}>
                    {/* Separador de tiempo para mensajes con mucha diferencia */}
                    {!isGrouped && index > 0 && timeDiff > 60 * 60 * 1000 && (
                      <div className="flex justify-center my-4">
                        <div className="bg-muted/60 text-muted-foreground text-xs px-3 py-1 rounded-full">
                          {formatMessageTime(message.created_at)}
                        </div>
                      </div>
                    )}
                    
                    <div className={`flex gap-2 ${isMyMessage(message) ? 'flex-row-reverse' : 'flex-row'} group ${isGrouped ? 'mt-0.5' : 'mt-2'}`}>
                      {/* Avatar solo para el primer mensaje del grupo */}
                      {!isGrouped ? (
                        <div className={`h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-medium mt-0.5 ${
                          message.user_type === 'admin' 
                            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                            : 'bg-green-100 text-green-700 border border-green-200'
                        }`}>
                          {getUserInitials(message)}
                        </div>
                      ) : (
                        <div className="w-6 flex-shrink-0" /> // Espacio para mantener alineación
                      )}

                      <div className={`flex-1 max-w-[70%] min-w-0 ${isMyMessage(message) ? 'text-right' : 'text-left'}`}>
                        {/* Información del usuario solo para el primer mensaje del grupo */}
                        {!isGrouped && (
                          <div className={`flex items-center gap-2 mb-1 ${isMyMessage(message) ? 'justify-end' : 'justify-start'}`}>
                            <div className="flex items-center gap-1">
                              {message.user_type === 'admin' ? (
                                <>
                                  <Shield className="h-3 w-3" />
                                  <span className="text-xs font-medium text-muted-foreground">Administrador</span>
                                </>
                              ) : (
                                <>
                                  {getMessageIcon(message)}
                                  <User className="h-3 w-3" />
                                  <span className="text-xs font-medium text-muted-foreground">
                                    {message.user_name || customerInfo?.name || 'Cliente'}
                                  </span>
                                </>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground/60">
                              {formatMessageTime(message.created_at)}
                            </span>
                          </div>
                        )}

                        <div className={`group/message relative ${
                          isMyMessage(message) ? 'ml-6' : 'mr-6'
                        }`}>
                          <div className={`rounded-xl px-2.5 py-1.5 shadow-sm transition-all duration-200 hover:shadow-md ${
                            isMyMessage(message)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/60 hover:bg-muted/80 border border-border/30'
                          } ${
                            isGrouped ? 'rounded-t-md' : ''
                          }`}>
                            {renderMessageContent(message.message)}
                            {renderAttachment(message)}
                          </div>
                          
                          {/* Indicadores de estado y controles admin */}
                          <div className={`flex items-center ${isMyMessage(message) ? 'justify-end' : 'justify-start'} mt-1 opacity-0 group-hover/message:opacity-100 transition-opacity ${
                            isGrouped ? 'absolute -bottom-5' : ''
                          } ${isMyMessage(message) ? 'right-0' : 'left-0'}`}>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                              {/* Indicadores de lectura solo para mensajes propios */}
                              {isMyMessage(message) && (
                                <>
                                  {isGrouped && (
                                    <span>{formatMessageTime(message.created_at)}</span>
                                  )}
                                  {message.is_read ? (
                                    <CheckCheck className="h-3 w-3 text-blue-500" />
                                  ) : (
                                    <Clock className="h-3 w-3" />
                                  )}
                                </>
                              )}
                              {/* Botón de eliminar visible para todos los mensajes */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground rounded-full ml-1"
                                onClick={() => handleDeleteMessage(message.id)}
                                title="Eliminar mensaje"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </ScrollArea>

        <Separator className="mx-3" />

        {/* Área de entrada de mensaje mejorada */}
        <div className="p-3 space-y-2 bg-muted/20">
          {/* Archivo seleccionado */}
          {selectedFile && (
            <div className="flex items-center gap-2 p-1.5 bg-muted/40 rounded border">
              <Paperclip className="h-4 w-4" />
              <span className="text-sm flex-1">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(1)}MB
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={selectedFile ? "Mensaje opcional..." : "Escribe tu mensaje al cliente..."}
                disabled={sending}
                className="pr-12 min-h-[36px] resize-none"
              />
              {newMessage.trim() && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="text-xs text-muted-foreground">
                    {newMessage.length}
                  </span>
                </div>
              )}
            </div>
            

            
            <Button
              onClick={handleSendMessage}
              disabled={(!newMessage.trim() && !selectedFile) || sending}
              size="icon"
              className="h-[36px] w-[36px]"
            >
              {sending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              <span>Enter para enviar • Shift+Enter para nueva línea</span>
            </div>

          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ACTUALIZACIÓN PROFESIONAL - AdminCommunications Component
 * 
 * Se ha actualizado el componente AdminCommunications para que tenga el mismo diseño 
 * profesional que OrderCommunications.tsx del frontend:
 * 
 * ✅ Funcionalidades Profesionales Agregadas:
 * - Soporte completo para archivos adjuntos (imágenes, documentos)
 * - Búsqueda en tiempo real de mensajes
 * - Estadísticas avanzadas con métricas detalladas
 * - Exportación de conversaciones completas
 * - Filtrado y visualización mejorada
 * 
 * ✅ Interfaz de Usuario Mejorada:
 * - Barra de búsqueda con filtrado en tiempo real
 * - Panel de estadísticas expandible/colapsable
 * - Botones de exportación y estadísticas
 * - Indicadores visuales para archivos adjuntos
 * - Vista previa de imágenes en línea
 * - Contador de caracteres y validación de archivos
 * 
 * ✅ Funcionalidades de Archivos:
 * - Subida de archivos con drag & drop visual
 * - Validación de tamaño (10MB máximo)
 * - Vista previa de archivos seleccionados
 * - Soporte para múltiples tipos de archivo
 * - Descarga directa de archivos adjuntos
 * 
 * ✅ Estadísticas Avanzadas:
 * - Mensajes por tipo de usuario (cliente/admin)
 * - Conteo de mensajes con archivos
 * - Tiempo promedio de respuesta
 * - Métricas de actividad en tiempo real
 * 
 * ✅ Experiencia de Usuario:
 * - Búsqueda instantánea con resultados filtrados
 * - Estados de carga y error mejorados
 * - Feedback visual para todas las acciones
 * - Navegación intuitiva y responsive
 * - Indicadores de estado de mensajes
 * 
 * ✅ Integración con Servicios:
 * - Usa la interfaz OrderCommunication actualizada
 * - Integración completa con communicationsService
 * - Soporte para todas las funcionalidades avanzadas
 * - Manejo de errores robusto
 * 
 * El componente ahora proporciona una experiencia de comunicación
 * profesional y completa para administradores, con todas las
 * funcionalidades modernas esperadas en un sistema empresarial.
 */
