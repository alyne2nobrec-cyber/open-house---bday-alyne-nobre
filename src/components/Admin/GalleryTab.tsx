import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Film,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
  Play,
  X,
  Eye,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';
import { GalleryMediaItem } from '../../types';
import {
  subscribeGalleryMedia,
  addGalleryMediaItem,
  updateGalleryMediaItem,
  deleteGalleryMediaItem,
  reorderGalleryMediaItems,
} from '../../services/galleryService';
import { uploadGalleryMediaFile, GalleryUploadProgress } from '../../utils/galleryUpload';

interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

export const GalleryTab: React.FC = () => {
  const [items, setItems] = useState<GalleryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Captions editing
  const [editingCaptions, setEditingCaptions] = useState<Record<string, string>>({});
  const [savedCaptions, setSavedCaptions] = useState<Record<string, boolean>>({});
  const [savingCaptionId, setSavingCaptionId] = useState<string | null>(null);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<GalleryMediaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview modal state
  const [previewMedia, setPreviewMedia] = useState<GalleryMediaItem | null>(null);

  // Reorder loading state
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    const unsub = subscribeGalleryMedia(
      (newItems) => {
        setItems(newItems);
        setLoading(false);
        setError(null);

        // Pre-fill captions map
        const captionsMap: Record<string, string> = {};
        newItems.forEach((it) => {
          captionsMap[it.id] = it.caption || '';
        });
        setEditingCaptions(captionsMap);
      },
      (err) => {
        setLoading(false);
        setError(err.message || 'Erro ao carregar itens da galeria.');
      }
    );

    return () => unsub();
  }, []);

  // Handle files selected for upload
  const handleFiles = (filesList: FileList | File[]) => {
    const files = Array.from(filesList);
    if (!files.length) return;

    const newQueueItems: QueueItem[] = files.map((file) => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi)$/i.test(file.name);
      return {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        type: isVideo ? 'video' : 'image',
        progress: 0,
        status: 'pending',
      };
    });

    setQueue((prev) => [...prev, ...newQueueItems]);
  };

  // Process queue sequentially so each file gets clear progress and errors don't stop the rest
  useEffect(() => {
    if (isUploading) return;

    const pendingItem = queue.find((q) => q.status === 'pending');
    if (!pendingItem) return;

    const processItem = async () => {
      setIsUploading(true);

      setQueue((prev) =>
        prev.map((it) => (it.id === pendingItem.id ? { ...it, status: 'uploading', progress: 5 } : it))
      );

      try {
        const uploadResult = await uploadGalleryMediaFile(pendingItem.file, (progress: GalleryUploadProgress) => {
          setQueue((prev) =>
            prev.map((it) => (it.id === pendingItem.id ? { ...it, progress: progress.percent } : it))
          );
        });

        // Compute current order (at end of list)
        const currentItemsCount = items.length;
        const defaultCaption = pendingItem.type === 'video' ? 'Vídeo do nosso novo cantinho' : 'Nosso novo cantinho';

        await addGalleryMediaItem({
          type: uploadResult.type,
          url: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          caption: defaultCaption,
          order: currentItemsCount,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
        });

        setQueue((prev) =>
          prev.map((it) => (it.id === pendingItem.id ? { ...it, status: 'done', progress: 100 } : it))
        );
      } catch (err: any) {
        console.error('Error uploading gallery media file:', err);
        setQueue((prev) =>
          prev.map((it) =>
            it.id === pendingItem.id
              ? {
                  ...it,
                  status: 'error',
                  errorMessage: err.message || 'Falha no envio deste arquivo.',
                }
              : it
          )
        );
      } finally {
        setIsUploading(false);
      }
    };

    processItem();
  }, [queue, isUploading, items.length]);

  const handleClearCompleted = () => {
    setQueue((prev) => prev.filter((it) => it.status !== 'done'));
  };

  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((it) => it.id !== id);
    });
  };

  // Reordering handlers
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (isReordering) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);

    setIsReordering(true);
    setItems(newItems);

    try {
      await reorderGalleryMediaItems(newItems);
    } catch (err) {
      console.error('Failed to reorder items:', err);
    } finally {
      setIsReordering(false);
    }
  };

  // Caption save handler
  const handleSaveCaption = async (item: GalleryMediaItem) => {
    const text = editingCaptions[item.id] ?? item.caption ?? '';
    setSavingCaptionId(item.id);

    try {
      await updateGalleryMediaItem(item.id, { caption: text.trim() });
      setSavedCaptions((prev) => ({ ...prev, [item.id]: true }));
      setTimeout(() => {
        setSavedCaptions((prev) => ({ ...prev, [item.id]: false }));
      }, 2500);
    } catch (err) {
      console.error('Failed to save caption:', err);
    } finally {
      setSavingCaptionId(null);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);

    try {
      await deleteGalleryMediaItem(itemToDelete.id, {
        url: itemToDelete.url,
        thumbnailUrl: itemToDelete.thumbnailUrl,
      });
      setItemToDelete(null);
    } catch (err) {
      console.error('Failed to delete media item:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPhotos = items.filter((it) => it.type === 'image').length;
  const totalVideos = items.filter((it) => it.type === 'video').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#EADBCE] rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">📸</span>
              <h2 className="text-lg font-bold text-[#1B2F4E]">
                Galeria do Apê ("Um spoiler do nosso novo cantinho")
              </h2>
            </div>
            <p className="text-xs text-[#7D756C] max-w-2xl leading-relaxed">
              Carregue fotos e vídeos dos ambientes do novo apartamento. Cada foto ou vídeo aparece no site principal dentro do estilo Polaroid clássico com sua legenda personalizada!
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-[#F4EFEB] text-[#1B2F4E] font-medium text-xs">
              {items.length === 0 ? 'Exibindo fotos padrão' : `${items.length} itens (${totalPhotos} fotos • ${totalVideos} vídeos)`}
            </span>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Aviso da Galeria:</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 ${
          isDragOver
            ? 'border-[#CF3B25] bg-[#CF3B25]/5 scale-[0.99]'
            : 'border-[#EADBCE] bg-[#FBF4E8]/50 hover:bg-[#FBF4E8]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-white border border-[#EADBCE] flex items-center justify-center text-[#CF3B25] shadow-xs">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <p className="text-sm font-semibold text-[#1B2F4E]">
              Arraste fotos e vídeos aqui, ou clique para selecionar
            </p>
            <p className="text-xs text-[#7D756C] mt-1">
              Você pode selecionar vários arquivos de uma só vez
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] text-[#7D756C]">
            <span className="px-2.5 py-1 rounded-md bg-white border border-[#EADBCE] flex items-center gap-1 font-mono">
              <ImageIcon className="w-3.5 h-3.5 text-[#C86D51]" /> Fotos (JPG, PNG, WEBP — até 1600px)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-[#EADBCE] flex items-center gap-1 font-mono">
              <Film className="w-3.5 h-3.5 text-[#1B2F4E]" /> Vídeos (MP4, MOV, WEBM — até 30 MB)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-[#EADBCE] flex items-center gap-1 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-[#F2B84B]" /> GIFs (até 5 MB)
            </span>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 px-5 py-2.5 rounded-xl bg-[#C86D51] hover:bg-[#B3593D] text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
          >
            Escolher Arquivos do Computador / Celular
          </button>
        </div>
      </div>

      {/* Upload Queue Section */}
      {queue.length > 0 && (
        <div className="bg-white border border-[#EADBCE] rounded-2xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1B2F4E] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#CF3B25]" />
              Fila de Envio ({queue.filter((q) => q.status === 'done').length}/{queue.length})
            </h3>

            {queue.some((q) => q.status === 'done') && (
              <button
                type="button"
                onClick={handleClearCompleted}
                className="text-xs text-[#C86D51] hover:underline font-medium"
              >
                Limpar concluídos
              </button>
            )}
          </div>

          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-[#EADBCE] bg-[#FBF4E8]/30"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/10 shrink-0 relative">
                  {item.type === 'video' ? (
                    <div className="w-full h-full bg-[#1B2F4E] flex items-center justify-center text-white">
                      <Film className="w-5 h-5 text-[#F2B84B]" />
                    </div>
                  ) : (
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#1B2F4E] truncate">
                      {item.file.name}
                    </p>
                    <span className="text-[10px] text-[#7D756C] shrink-0 font-mono">
                      {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>

                  {item.status === 'uploading' && (
                    <div className="mt-1.5 space-y-1">
                      <div className="w-full bg-[#EADBCE] h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#C86D51] h-full transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#7D756C] flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin text-[#C86D51]" />
                        Enviando... {item.progress}%
                      </p>
                    </div>
                  )}

                  {item.status === 'pending' && (
                    <p className="text-[10px] text-[#7D756C] mt-1">Aguardando na fila...</p>
                  )}

                  {item.status === 'done' && (
                    <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-1">
                      <Check className="w-3 h-3" /> Enviado e salvo na galeria!
                    </p>
                  )}

                  {item.status === 'error' && (
                    <p className="text-[10px] text-red-600 font-medium flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {item.errorMessage}
                    </p>
                  )}
                </div>

                {item.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveQueueItem(item.id)}
                    className="p-1.5 text-[#7D756C] hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                    title="Remover da lista"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Items Section */}
      <div className="bg-white border border-[#EADBCE] rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EADBCE] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#1B2F4E]">
              Mídias Publicadas ({items.length})
            </h3>
            <p className="text-xs text-[#7D756C] mt-0.5">
              Reordene com as setas para mudar a posição em que aparecem no site.
            </p>
          </div>

          {items.length > 0 && (
            <span className="text-xs text-[#7D756C]">
              Ordem: da esquerda para a direita no site
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-center text-[#7D756C]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#C86D51] mb-2" />
            <p className="text-xs">Carregando mídias da galeria...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 px-4 text-center border-2 border-dashed border-[#EADBCE] rounded-xl bg-[#FBF4E8]/40 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#F2B84B]/20 text-[#1B2F4E] flex items-center justify-center mx-auto">
              <Info className="w-6 h-6 text-[#CF3B25]" />
            </div>
            <div className="max-w-md mx-auto">
              <h4 className="text-sm font-bold text-[#1B2F4E]">
                Nenhuma foto ou vídeo personalizado ainda
              </h4>
              <p className="text-xs text-[#7D756C] mt-1 leading-relaxed">
                O site está exibindo as 4 fotos padrão originais de demonstração.
                Assim que você carregar suas próprias fotos ou vídeos acima, eles entrarão no lugar das fotos padrão na seção "Um spoiler do nosso novo cantinho"!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="group relative bg-[#FBF4E8]/40 border border-[#EADBCE] rounded-2xl p-3 flex flex-col justify-between hover:shadow-md transition-all"
              >
                <div>
                  {/* Top Bar with Position Badge & Type */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#1B2F4E] text-white text-[10px] font-mono font-bold">
                      #{idx + 1}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {item.type === 'video' ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#1B2F4E]/10 text-[#1B2F4E] text-[10px] font-semibold flex items-center gap-1">
                          <Film className="w-3 h-3 text-[#CF3B25]" /> Vídeo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[#C86D51]/10 text-[#C86D51] text-[10px] font-semibold flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Foto
                        </span>
                      )}

                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => setPreviewMedia(item)}
                        className="p-1 rounded-md text-[#7D756C] hover:text-[#1B2F4E] hover:bg-white/80 transition-colors cursor-pointer"
                        title="Ver ampliado"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="p-1 rounded-md text-[#7D756C] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="Excluir mídia"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail / Media Container */}
                  <div
                    onClick={() => setPreviewMedia(item)}
                    className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black/10 cursor-pointer group-hover:opacity-95 transition-opacity"
                  >
                    {item.type === 'video' ? (
                      <div className="w-full h-full relative flex items-center justify-center bg-black">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.caption || 'Prévia do vídeo'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <video
                            src={item.url}
                            className="w-full h-full object-cover"
                            preload="metadata"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/90 text-[#CF3B25] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.caption || 'Foto da galeria'}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Caption Input */}
                  <div className="mt-3">
                    <label className="block text-[11px] font-semibold text-[#1B2F4E] mb-1">
                      Legenda (aparece na Polaroid):
                    </label>
                    <textarea
                      rows={2}
                      value={editingCaptions[item.id] ?? item.caption ?? ''}
                      onChange={(e) =>
                        setEditingCaptions((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      onBlur={() => handleSaveCaption(item)}
                      placeholder="Ex: A sala onde vamos comemorar..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#EADBCE] bg-white text-xs text-[#1B2F4E] placeholder-[#A59E95] focus:outline-none focus:ring-1 focus:ring-[#C86D51] resize-none leading-relaxed"
                    />

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-[#A59E95]">
                        Salva automaticamente ao sair do campo
                      </span>
                      {savedCaptions[item.id] && (
                        <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Salvo!
                        </span>
                      )}
                      {savingCaptionId === item.id && (
                        <span className="text-[10px] text-[#C86D51] flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Salvando...
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Reorder Bar */}
                <div className="mt-3 pt-2.5 border-t border-[#EADBCE] flex items-center justify-between">
                  <span className="text-[11px] text-[#7D756C] font-mono">
                    Posição {idx + 1} de {items.length}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || isReordering}
                      onClick={() => handleMove(idx, 'up')}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        idx === 0 || isReordering
                          ? 'opacity-30 cursor-not-allowed text-[#7D756C]'
                          : 'bg-white hover:bg-[#EADBCE] text-[#1B2F4E] border border-[#EADBCE]'
                      }`}
                      title="Mover para esquerda / subir ordem"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === items.length - 1 || isReordering}
                      onClick={() => handleMove(idx, 'down')}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        idx === items.length - 1 || isReordering
                          ? 'opacity-30 cursor-not-allowed text-[#7D756C]'
                          : 'bg-white hover:bg-[#EADBCE] text-[#1B2F4E] border border-[#EADBCE]'
                      }`}
                      title="Mover para direita / descer ordem"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div
          className="fixed inset-0 z-50 bg-[#1B2F4E]/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeleting && setItemToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#1B2F4E]">Excluir da Galeria?</h4>
                <p className="text-xs text-[#7D756C]">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <p className="text-xs text-[#4B5A72] leading-relaxed">
              Tem certeza que deseja remover este {itemToDelete.type === 'video' ? 'vídeo' : 'foto'} da galeria do apê?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl border border-[#EADBCE] text-xs font-semibold text-[#68625B] hover:bg-[#F4EFEB] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Excluindo...
                  </>
                ) : (
                  'Sim, excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Lightbox / Player Modal */}
      {previewMedia && (
        <div
          className="fixed inset-0 z-50 bg-[#1B2F4E]/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Fechar prévia"
              onClick={() => setPreviewMedia(null)}
              className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex-1 flex items-center justify-center overflow-hidden bg-black min-h-[300px]">
              {previewMedia.type === 'video' ? (
                <video
                  src={previewMedia.url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[70vh] max-w-full w-auto h-auto object-contain"
                />
              ) : (
                <img
                  src={previewMedia.url}
                  alt={previewMedia.caption || 'Foto'}
                  className="max-h-[70vh] max-w-full w-auto h-auto object-contain"
                />
              )}
            </div>

            {previewMedia.caption && (
              <div className="bg-[#1B2F4E] p-4 text-center">
                <p className="font-hand text-xl text-white">
                  {previewMedia.caption}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
