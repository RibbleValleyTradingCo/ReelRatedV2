import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPublicAssetUrl, uploadAvatarToStorage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Loader2, Upload, Fish } from "lucide-react";
import { toast } from "sonner";

interface ProfileAvatarSectionProps {
  userId: string;
  username: string;
  avatarPath: string | null;
  legacyAvatarUrl?: string | null;
  onAvatarChange: (storagePath: string | null) => void;
}

const initialsFromName = (name: string) => {
  if (!name) return "";
  const trimmed = name.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/[\s_]+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

const validateAvatarFile = (file: File): string | null => {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Please upload a JPG, PNG, or WEBP image.";
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return "Avatar must be smaller than 5MB.";
  }
  return null;
};

export const ProfileAvatarSection = ({
  userId,
  username,
  avatarPath,
  legacyAvatarUrl,
  onAvatarChange,
}: ProfileAvatarSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const publicPath = getPublicAssetUrl(avatarPath);
    if (publicPath) {
      setPreviewUrl(publicPath);
      return;
    }
    if (legacyAvatarUrl) {
      setPreviewUrl(legacyAvatarUrl);
      return;
    }
    setPreviewUrl(null);
  }, [avatarPath, legacyAvatarUrl]);

  const handleSelectFile = () => {
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationMessage = validateAvatarFile(file);
    if (validationMessage) {
      setError(validationMessage);
      toast.error(validationMessage);
      return;
    }

    setUploading(true);
    setError(null);

    const { path, error } = await uploadAvatarToStorage(userId, file);

    if (error) {
      setError(error);
      setUploading(false);
      return;
    }

    if (path) {
      const publicUrl = getPublicAssetUrl(path);
      if (publicUrl) {
        setPreviewUrl(`${publicUrl}?cacheBust=${Date.now()}`);
      } else {
        setPreviewUrl(null);
      }
      onAvatarChange(path);
    }

    setUploading(false);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <Avatar className="h-24 w-24 border border-slate-200">
        {previewUrl ? <AvatarImage src={previewUrl} alt={`${username}'s avatar`} /> : null}
        <AvatarFallback className="bg-muted text-muted-foreground">
          {initialsFromName(username) || <Fish className="h-6 w-6" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            className={cn("h-11 w-full sm:w-auto", uploading && "pointer-events-none opacity-80")}
            onClick={handleSelectFile}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload new photo
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">This photo will appear on your posts.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
};

export default ProfileAvatarSection;
