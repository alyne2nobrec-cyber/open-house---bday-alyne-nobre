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
  Cloud,
  CloudUpload,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react';
import { EventSettings, GalleryMediaItem } from '../../types';
import {
  subscribeGalleryMedia,
  addGalleryMediaItem,
  updateGalleryMediaItem,
  deleteGalleryMediaItem,
  reorderGalleryMediaItems,
} from '../../services/galleryService';
import { uploadGalleryMediaFile, GalleryUploadProgress } from '../../utils/galleryUpload';
import {
  getCloudinaryConfig,
  saveCloudinaryConfigLocally,
  isCloudinaryConfigured,
  testCloudinaryConnection,
} from '../../utils/cloudinary';
import { updateEventSettings } from '../../services/settingsService';

interface QueueItem {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

interface GalleryTabProps {
  settings?: EventSettings;
}

export const GalleryTab: React.FC<GalleryTabProps> = ({ settings }) => {
  const [items, setItems] = useState<GalleryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cloudinary settings state
  const [showCloudinaryModal, setShowCloudinaryModal] = useState(false);
  const [showCloudinaryGuide, setShowCloudinaryGuide] = useState(false);
  const initialConfig = getCloudinaryConfig(settings);
  const [cloudNameInput, setCloudNameInput] = useState(initialConfig.cloudName);
  const [uploadPresetInput, setUploadPresetInput] = useState(initialConfig.uploadPreset);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedSuccess, setConfigSavedSuccess] = useState(false);

  // Keep inputs updated if settings change
  useEffect(() => {
    const cfg = getCloudinaryConfig(settings);
    if (cfg.cloudName && !cloudNameInput) setCloudNameInput(cfg.cloudName);
    if (cfg.uploadPreset && !uploadPresetInput) setUploadPresetInput(cfg.uploadPreset);
  }, [settings?.cloudinaryCloudName, settings?.cloudinaryUploadPreset]);

  const activeCloudinaryConfig = getCloudinaryConfig({
    cloudinaryCloudName: cloudNameInput || settings?.cloudinaryCloudName,
    cloudinaryUploadPreset: uploadPresetInput || settings?.cloudinaryUploadPreset,
  });

  const isConfigured = Boolean(
    activeCloudinaryConfig.cloudName && activeCloudinaryConfig.uploadPreset
  );

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

    if (!isConfigured) {
      setShowCloudinaryModal(true);
      return;
    }

    const newQueueItems: QueueItem[] = files.map((file) => {
      const isVideo =
        file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name);
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
        const uploadResult = await uploadGalleryMediaFile(
          pendingItem.file,
          (progress: GalleryUploadProgress) => {
            setQueue((prev) =>
              prev.map((it) => (it.id === pendingItem.id ? { ...it, progress: progress.percent } : it))
            );
          },
          {
            cloudinaryCloudName: cloudNameInput || settings?.cloudinaryCloudName,
            cloudinaryUploadPreset: uploadPresetInput || settings?.cloudinaryUploadPreset,
          }
        );

        // Compute current order (at end of list)
        const currentItemsCount = items.length;
        const defaultCaption =
          pendingItem.type === 'video' ? 'Vídeo do nosso novo cantinho' : 'Nosso novo cantinho';

        await addGalleryMediaItem({
          type: uploadResult.type,
          url: uploadResult.url,
          thumbnailUrl: uploadResult.thumbnailUrl,
          caption: defaultCaption,
          order: currentItemsCount,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          publicId: uploadResult.publicId,
        });

        setQueue((prev) =>
          prev.map((it) => (it.id === pendingItem.id ? { ...it, status: 'done', progress: 100 } : it))
        );
      } catch (err: any) {
        console.error('Error uploading gallery media file to Cloudinary:', err);
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
  }, [queue, isUploading, items.length, cloudNameInput, uploadPresetInput, settings]);

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

  // Test Cloudinary connection
  const handleTestCloudinary = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testCloudinaryConnection(cloudNameInput, uploadPresetInput);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Erro inesperado ao testar conexão.',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Save Cloudinary configuration
  const handleSaveCloudinary = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);

    const cleanCloud = cloudNameInput.trim();
    const cleanPreset = uploadPresetInput.trim();

    saveCloudinaryConfigLocally({
      cloudName: cleanCloud,
      uploadPreset: cleanPreset,
    });

    try {
      await updateEventSettings({
        cloudinaryCloudName: cleanCloud,
        cloudinaryUploadPreset: cleanPreset,
      });
      setConfigSavedSuccess(true);
      setTimeout(() => {
        setConfigSavedSuccess(false);
        setShowCloudinaryModal(false);
      }, 1500);
    } catch (err) {
      console.warn('Could not sync Cloudinary settings to Firestore:', err);
      setConfigSavedSuccess(true);
      setTimeout(() => {
        setConfigSavedSuccess(false);
        setShowCloudinaryModal(false);
      }, 1500);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-2xl font-medium text-[#2D2A26]">
              Galeria do Novo Apê 📸
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF4ED] text-[#CF3B25] border border-[#EADBCE]">
              Cloudinary Ativo
            </span>
          </div>
          <p className="text-xs text-[#68625B] mt-1 max-w-2xl leading-relaxed">
            Carregue fotos e vídeos dos cômodos e detalhes do novo apartamento. Eles serão exibidos com moldura polaroid na seção <strong>"Um spoiler do nosso novo cantinho"</strong> do site!
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCloudinaryModal(true)}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer shrink-0 ${
            isConfigured
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse'
          }`}
        >
          <Cloud className={`w-4 h-4 ${isConfigured ? 'text-emerald-600' : 'text-amber-600'}`} />
          <span>{isConfigured ? 'Cloudinary Conectado' : 'Configurar Cloudinary'}</span>
        </button>
      </div>

      {/* Cloudinary Status Callout if not configured */}
      {!isConfigured && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-900">
                Cloudinary ainda não foi configurado neste navegador
              </p>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Para enviar fotos e vídeos sem limites de tamanho e sem restrições de regras do Firebase, informe seu <strong>Cloud Name</strong> e <strong>Upload Preset</strong> (leva 1 minuto e é 100% gratuito!).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCloudinaryModal(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 cursor-pointer shadow-xs transition-colors"
          >
            Configurar Agora
          </button>
        </div>
      )}

      {/* Error alert if any */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-red-900">Aviso da Galeria:</p>
              <p className="text-xs mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-600 hover:bg-red-100 p-1.5 rounded-lg cursor-pointer transition-colors"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
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
              Você pode selecionar vários arquivos de uma só vez (hospedagem rápida no Cloudinary)
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[11px] text-[#7D756C]">
            <span className="px-2.5 py-1 rounded-md bg-white border border-[#EADBCE] flex items-center gap-1 font-mono">
              <ImageIcon className="w-3.5 h-3.5 text-[#C86D51]" /> Fotos (JPG, PNG, WEBP — otimização automática)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-[#EADBCE] flex items-center gap-1 font-mono">
              <Film className="w-3.5 h-3.5 text-[#1B2F4E]" /> Vídeos (MP4, MOV, WEBM — até 100 MB com capa automática)
            </span>
            <span className="px-2.5 py-1 rounded-md bg-white border border-[#EADBCE] flex items-center gap-1 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-[#F2B84B]" /> GIFs (até 10 MB)
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!isConfigured) {
                setShowCloudinaryModal(true);
              } else {
                fileInputRef.current?.click();
              }
            }}
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
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#CF3B25] animate-ping" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2D2A26]">
                Fila de Envio para Cloudinary ({queue.filter((q) => q.status === 'done').length}/{queue.length})
              </h3>
            </div>

            {queue.some((q) => q.status === 'done') && (
              <button
                type="button"
                onClick={handleClearCompleted}
                className="text-xs text-[#A95339] hover:underline cursor-pointer"
              >
                Limpar concluídos
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-[#EADBCE] bg-[#FAF8F5]"
              >
                {/* Thumbnail Preview */}
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-black/10 shrink-0 relative flex items-center justify-center">
                  {item.type === 'video' ? (
                    <div className="w-full h-full bg-[#1B2F4E] flex items-center justify-center text-white">
                      <Film className="w-5 h-5 text-[#F2B84B]" />
                    </div>
                  ) : (
                    <img
                      src={item.previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                {/* Info & Progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-[#2D2A26] truncate max-w-[200px] sm:max-w-xs">
                      {item.file.name}
                    </span>
                    <span className="text-[11px] font-mono text-[#7D756C]">
                      {(item.file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 rounded-full bg-[#EADBCE] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        item.status === 'done'
                          ? 'bg-emerald-500'
                          : item.status === 'error'
                          ? 'bg-red-500'
                          : 'bg-[#CF3B25]'
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>

                  {/* Status text */}
                  <div className="flex items-center justify-between text-[10px] mt-1">
                    {item.status === 'pending' && <span className="text-[#7D756C]">Aguardando na fila...</span>}
                    {item.status === 'uploading' && (
                      <span className="text-[#CF3B25] flex items-center gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Enviando para o Cloudinary ({item.progress}%)...
                      </span>
                    )}
                    {item.status === 'done' && (
                      <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                        <Check className="w-3 h-3" />
                        Enviado com sucesso!
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="text-red-600 flex items-center gap-1 font-medium truncate">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {item.errorMessage || 'Erro no envio'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cancel / Dismiss button */}
                {item.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveQueueItem(item.id)}
                    className="p-1 text-[#A59E95] hover:text-red-600 rounded-md transition-colors cursor-pointer"
                    title="Remover da fila"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media Management List */}
      <div className="bg-white border border-[#EADBCE] rounded-3xl p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EADBCE] pb-4">
          <div>
            <h3 className="font-serif text-lg font-medium text-[#2D2A26]">
              Mídias no Site ({items.length})
            </h3>
            <p className="text-xs text-[#7D756C] mt-0.5">
              Reordene com as setas, personalize a legenda de cada foto/vídeo ou remova quando quiser.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-[#7D756C]">
            <span className="px-2 py-1 rounded-md bg-[#FAF8F5] border border-[#EADBCE] flex items-center gap-1">
              <ImageIcon className="w-3 h-3 text-[#C86D51]" />
              {items.filter((i) => i.type === 'image').length} Fotos
            </span>
            <span className="px-2 py-1 rounded-md bg-[#FAF8F5] border border-[#EADBCE] flex items-center gap-1">
              <Film className="w-3 h-3 text-[#1B2F4E]" />
              {items.filter((i) => i.type === 'video').length} Vídeos
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#7D756C] flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#CF3B25]" />
            Carregando itens da galeria...
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FAF4ED] text-[#C86D51] mx-auto flex items-center justify-center border border-[#EADBCE]">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1B2F4E]">Nenhuma mídia enviada ainda</p>
              <p className="text-xs text-[#7D756C] mt-1 leading-relaxed">
                Enquanto você não enviar nenhuma foto ou vídeo, a seção pública continua exibindo as 4 fotos padrão do projeto. Assim que você subir o primeiro arquivo, o site passa a exibir seus itens reais!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, index) => {
              const isVideo = item.type === 'video';
              const isFirst = index === 0;
              const isLast = index === items.length - 1;
              const isSaved = savedCaptions[item.id];
              const isSavingThis = savingCaptionId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl border border-[#EADBCE] bg-[#FAF8F5] hover:border-[#CF3B25]/40 transition-all flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div className="flex gap-3">
                    {/* Media Thumbnail */}
                    <div className="relative w-28 h-28 rounded-xl overflow-hidden bg-black/10 shrink-0 group border border-[#EADBCE]">
                      {isVideo ? (
                        item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.caption || 'Vídeo'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <video
                            src={item.url}
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        )
                      ) : (
                        <img
                          src={item.url}
                          alt={item.caption || 'Foto'}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Video badge */}
                      {isVideo && (
                        <div className="absolute top-1.5 left-1.5 bg-[#1B2F4E]/85 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-mono text-white flex items-center gap-1">
                          <Film className="w-2.5 h-2.5 text-[#F2B84B]" />
                          <span>VÍDEO</span>
                        </div>
                      )}

                      {/* Hover action to preview */}
                      <button
                        type="button"
                        onClick={() => setPreviewMedia(item)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                        title="Ampliar mídia"
                      >
                        {isVideo ? (
                          <div className="w-8 h-8 rounded-full bg-white/90 text-[#CF3B25] flex items-center justify-center shadow-md">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        ) : (
                          <Eye className="w-5 h-5 drop-shadow-md" />
                        )}
                      </button>
                    </div>

                    {/* Metadata & Caption Edit */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-mono text-[#7D756C] font-semibold">
                            Posição #{index + 1}
                          </span>
                          <span className="text-[10px] text-[#A59E95] font-mono truncate max-w-[120px]">
                            {item.fileName || (isVideo ? 'video.mp4' : 'foto.jpg')}
                          </span>
                        </div>

                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#7D756C] mb-1">
                          Legenda do Polaroid
                        </label>
                        <input
                          type="text"
                          value={editingCaptions[item.id] ?? item.caption ?? ''}
                          onChange={(e) =>
                            setEditingCaptions({
                              ...editingCaptions,
                              [item.id]: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveCaption(item);
                            }
                          }}
                          placeholder={isVideo ? 'Ex: Sala integrada com a cozinha' : 'Ex: Nosso cantinho do café'}
                          className="w-full h-8 px-2.5 rounded-lg border border-[#EADBCE] bg-white text-xs text-[#2D2A26] outline-none focus:border-[#CF3B25]"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveCaption(item)}
                          disabled={isSavingThis}
                          className={`h-7 px-2.5 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                            isSaved
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-white border border-[#EADBCE] hover:bg-[#F2B84B]/20 text-[#2D2A26]'
                          }`}
                        >
                          {isSavingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin text-[#CF3B25]" />
                          ) : isSaved ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              Salvo
                            </>
                          ) : (
                            'Salvar Legenda'
                          )}
                        </button>

                        {/* Reorder & Delete actions */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isFirst || isReordering}
                            onClick={() => handleMove(index, 'up')}
                            className="p-1 rounded-md bg-white border border-[#EADBCE] text-[#7D756C] hover:text-[#2D2A26] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Mover para cima / antes"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast || isReordering}
                            onClick={() => handleMove(index, 'down')}
                            className="p-1 rounded-md bg-white border border-[#EADBCE] text-[#7D756C] hover:text-[#2D2A26] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="Mover para baixo / depois"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="p-1 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer ml-1"
                            title="Excluir mídia"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cloudinary Configuration Modal */}
      {showCloudinaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-[#EADBCE] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EADBCE] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#CF3B25] to-[#F2B84B] flex items-center justify-center text-white shadow-xs">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-medium text-[#2D2A26]">
                    Configurar Cloudinary
                  </h3>
                  <p className="text-[11px] text-[#7D756C]">
                    Hospedagem profissional e gratuita de fotos e vídeos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudinaryModal(false)}
                className="p-2 text-[#7D756C] hover:text-[#2D2A26] rounded-xl hover:bg-black/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCloudinary} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Cloud Name (Nome da sua Nuvem) *
                </label>
                <input
                  type="text"
                  required
                  value={cloudNameInput}
                  onChange={(e) => setCloudNameInput(e.target.value)}
                  placeholder="Ex: da1234abc ou ape-alyne"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none focus:border-[#CF3B25]"
                />
                <p className="text-[10px] text-[#7D756C] mt-1">
                  Encontrado na página inicial do seu Dashboard no Cloudinary.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#68625B] mb-1.5">
                  Upload Preset (Modo Unsigned) *
                </label>
                <input
                  type="text"
                  required
                  value={uploadPresetInput}
                  onChange={(e) => setUploadPresetInput(e.target.value)}
                  placeholder="Ex: galeria_ape ou ml_default"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#EADBCE] text-xs text-[#2D2A26] outline-none focus:border-[#CF3B25]"
                />
                <p className="text-[10px] text-[#7D756C] mt-1">
                  Criado em <strong>Settings &gt; Upload &gt; Add upload preset</strong> (marcado como <em>Unsigned</em>).
                </p>
              </div>

              {/* Test Button & Result */}
              <div className="pt-1">
                <button
                  type="button"
                  disabled={testingConnection || !cloudNameInput || !uploadPresetInput}
                  onClick={handleTestCloudinary}
                  className="w-full h-10 rounded-xl border border-[#CF3B25] text-[#CF3B25] hover:bg-[#CF3B25]/5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  {testingConnection ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testando credenciais...
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      Testar Conexão com o Cloudinary
                    </>
                  )}
                </button>

                {testResult && (
                  <div
                    className={`mt-2.5 p-3 rounded-xl text-xs flex items-start gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}
                  >
                    {testResult.success ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="text-[11px] leading-relaxed">
                      {testResult.message}
                    </div>
                  </div>
                )}
              </div>

              {/* Expandable Step-by-Step Guide */}
              <div className="border border-[#EADBCE] rounded-2xl overflow-hidden bg-[#FAF8F5]">
                <button
                  type="button"
                  onClick={() => setShowCloudinaryGuide(!showCloudinaryGuide)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-semibold text-[#1B2F4E] hover:bg-[#F2B84B]/10 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-[#CF3B25]" />
                    Como criar sua conta gratuita no Cloudinary em 2 minutos
                  </span>
                  {showCloudinaryGuide ? (
                    <ChevronUp className="w-4 h-4 text-[#7D756C]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#7D756C]" />
                  )}
                </button>

                {showCloudinaryGuide && (
                  <div className="p-4 pt-1 text-[11px] text-[#4B5A72] space-y-2 border-t border-[#EADBCE] bg-white">
                    <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                      <li>
                        Acesse{' '}
                        <a
                          href="https://cloudinary.com/users/register_free"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#CF3B25] underline font-semibold inline-flex items-center gap-0.5"
                        >
                          cloudinary.com/users/register_free
                          <ExternalLink className="w-3 h-3" />
                        </a>{' '}
                        e crie uma conta gratuita (25 GB de mídia por mês inclusos).
                      </li>
                      <li>
                        Na página principal, copie o <strong>Cloud name</strong> que aparece no topo e cole no campo acima.
                      </li>
                      <li>
                        Clique na <strong>Engrenagem (Settings)</strong> no canto inferior esquerdo e clique na aba <strong>Upload</strong>.
                      </li>
                      <li>
                        Role a página até a seção <strong>Upload presets</strong> e clique em <strong>Add upload preset</strong>.
                      </li>
                      <li>
                        Mude a opção <strong>Signing Mode</strong> de <em>Signed</em> para <strong>Unsigned</strong>.
                      </li>
                      <li>
                        Copie o nome do preset gerado (ou digite um nome como <code className="bg-amber-100 px-1 rounded">galeria_ape</code>) e clique em <strong>Save</strong>.
                      </li>
                      <li>
                        Cole o nome do preset no campo <strong>Upload Preset</strong> acima, clique em <strong>Testar Conexão</strong> e depois em <strong>Salvar Configurações</strong>!
                      </li>
                    </ol>
                  </div>
                )}
              </div>

              {configSavedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Configurações salvas com sucesso!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloudinaryModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#EADBCE] text-xs font-semibold text-[#7D756C] hover:bg-black/5 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingConfig || !cloudNameInput || !uploadPresetInput}
                  className="px-5 py-2.5 rounded-xl bg-[#C86D51] hover:bg-[#A95339] text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                >
                  {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-[#EADBCE] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-serif text-lg font-medium text-[#2D2A26]">
                Excluir {itemToDelete.type === 'video' ? 'Vídeo' : 'Foto'}?
              </h3>
              <p className="text-xs text-[#7D756C] leading-relaxed">
                Esta mídia será removida do site e da galeria pública do novo apartamento.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 h-10 rounded-xl border border-[#EADBCE] text-xs font-semibold text-[#7D756C] hover:bg-black/5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Lightbox Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <button
            type="button"
            onClick={() => setPreviewMedia(null)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar pré-visualização"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="max-w-3xl max-h-[85vh] w-full flex flex-col items-center">
            <div className="bg-white p-3 pb-8 rounded-sm shadow-2xl max-w-full text-center">
              <div className="max-h-[65vh] overflow-hidden flex items-center justify-center bg-black">
                {previewMedia.type === 'video' ? (
                  <video
                    src={previewMedia.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[65vh] max-w-full object-contain"
                  />
                ) : (
                  <img
                    src={previewMedia.url}
                    alt={previewMedia.caption || 'Foto'}
                    className="max-h-[65vh] max-w-full object-contain"
                  />
                )}
              </div>
              <p className="mt-3 font-serif italic text-base sm:text-lg text-[#2D2A26]">
                {previewMedia.caption || (previewMedia.type === 'video' ? 'Vídeo do nosso cantinho' : 'Nosso novo cantinho')}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
