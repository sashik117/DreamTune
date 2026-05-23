import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Music, Loader2, Sparkles } from 'lucide-react';
import { entities, storage, media } from '@/api/SupabaseClient';
import { toast } from "sonner";
import YouTubeDownload from './YouTubeDownload';
import SpotifyImport from './SpotifyImport';
import { repairMojibake } from '@/utils/text';

function parseFileName(fileName) {
  const clean = repairMojibake(fileName.replace(/\.[^/.]+$/, ''))
    .replace(/\b(official|video|audio|lyrics?|hd|4k)\b/gi, '')
    .replace(/[[\](){}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = clean.split(/\s+-\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  return { artist: '', title: clean };
}

export default function UploadModal({ open, existingSongs = [], onOpenChange, onSongAdded, onSongsAdded, onPlaylistAdded, onPlaylistUpdated }) {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [filePreviewUrl, setFilePreviewUrl] = useState('');
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('dreamtune-upload-tab') || 'search');
  const fileInputRef = useRef(null);

  useEffect(() => () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
  }, [filePreviewUrl]);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFile(selectedFile);
    setFilePreviewUrl(URL.createObjectURL(selectedFile));
    const parsed = parseFileName(selectedFile.name);
    setTitle(parsed.title);
    setArtist(parsed.artist);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      const cleanTitle = repairMojibake(title || file.name).trim();
      const cleanArtist = repairMojibake(artist || '').trim();
      const fileUrl = await storage.uploadFile(file, 'songs');
      const song = await entities.Song.create({
        title: cleanTitle,
        artist: cleanArtist,
        cover_url: '',
        file_url: fileUrl,
        is_favorite: false,
      });

      ;(async () => {
        try {
          const data = await media.getLyrics({ artist: cleanArtist, title: cleanTitle });
          if (data.lyrics) await entities.Song.update(song.id, { lyrics: data.lyrics });
        } catch {}
      })();

      toast.success('Song added!');
      onSongAdded(song);
      setFile(null);
      setFilePreviewUrl('');
      setTitle('');
      setArtist('');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add song</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            localStorage.setItem('dreamtune-upload-tab', value);
          }}
          className="pt-2"
        >
          <TabsList className="w-full bg-secondary">
            <TabsTrigger value="search" className="flex-1 text-xs sm:text-sm">Search</TabsTrigger>
            <TabsTrigger value="spotify" className="flex-1 text-xs sm:text-sm">Spotify</TabsTrigger>
            <TabsTrigger value="file" className="flex-1 text-xs sm:text-sm">File</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="pt-4">
            <YouTubeDownload
              onSongAdded={(s) => { onSongAdded(s); onOpenChange(false); }}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="spotify" forceMount className="pt-4 data-[state=inactive]:hidden">
            <SpotifyImport
              existingSongs={existingSongs}
              onSongsAdded={(songs) => onSongsAdded?.(songs)}
              onPlaylistAdded={onPlaylistAdded}
              onPlaylistUpdated={onPlaylistUpdated}
              onClose={() => onOpenChange(false)}
            />
          </TabsContent>

          <TabsContent value="file" className="space-y-4 pt-4">
            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-all"
              >
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">Choose audio file</p>
                <p className="text-xs text-muted-foreground mt-1">MP3, WAV, OGG, M4A</p>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl bg-secondary p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Music className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>
                {filePreviewUrl && (
                  <div className="rounded-2xl border border-border bg-background/70 p-3">
                    <p className="text-xs font-bold text-foreground mb-2">Preview before adding</p>
                    <audio
                      src={filePreviewUrl}
                      controls
                      className="w-full"
                      onPlay={(event) => {
                        window.dispatchEvent(new CustomEvent('dreamtune-preview-play'));
                        const audio = event.currentTarget;
                        const stop = () => audio.pause();
                        window.addEventListener('dreamtune-main-play', stop, { once: true });
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileSelect} className="hidden" />

            {file && (
              <>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Title</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Song title..." className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Artist</Label>
                  <Input value={artist} onChange={e => setArtist(e.target.value)} placeholder="Artist name..." className="bg-secondary border-border" />
                </div>
                <Button onClick={handleUpload} disabled={uploading || !title.trim()} className="w-full bg-primary hover:brightness-110">
                  {uploading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</>
                    : <><Sparkles className="w-4 h-4 mr-2" />Add</>
                  }
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
