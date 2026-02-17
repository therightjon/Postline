import React, { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import './MediaUpload.css';

export default function MediaUpload({ mediaUrl, onChange, onRemove }) {
  const inputRef = useRef(null);

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onChange(file);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) {
      onChange(file);
    }
  }

  if (mediaUrl) {
    return (
      <div className="media-preview">
        <img src={mediaUrl} alt="Upload preview" />
        <button className="media-remove btn btn-icon" onClick={onRemove} title="Remove image">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="media-dropzone"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => inputRef.current?.click()}
    >
      <ImagePlus size={28} />
      <p className="media-dropzone-text">Drop an image here or click to upload</p>
      <span className="media-dropzone-hint">PNG, JPG, GIF up to 10MB</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />
    </div>
  );
}
