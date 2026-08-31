import { useCallback, useRef, useState } from 'react';
import { LuCloudUpload, LuFile, LuX } from 'react-icons/lu';
import { cn } from '../../../utils/cn.js';
import { formatBytes } from '../../../utils/formatters.js';
import styles from './FileDropzone.module.css';

/**
 * Zona de upload por drag&drop + clique. Usada por qualquer fluxo que envie
 * documentos (cotacao, fase 2, central de documentos). Controlada: o pai
 * guarda `files` e recebe `onFilesChange(File[])`.
 */
export default function FileDropzone({
  files = [],
  onFilesChange,
  accept = '.pdf,.jpg,.jpeg,.png',
  multiple = true,
  label = 'Arraste os arquivos aqui ou clique para selecionar',
  hint = 'PDF, JPG ou PNG',
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = useCallback(
    (list) => {
      const incoming = Array.from(list);
      onFilesChange?.(multiple ? [...files, ...incoming] : incoming.slice(0, 1));
    },
    [files, multiple, onFilesChange],
  );

  const removeFile = (index) => {
    onFilesChange?.(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div
        className={cn(styles.dropzone, isDragging && styles.dragging)}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
      >
        <LuCloudUpload className={styles.icon} />
        <p className={styles.label}>{label}</p>
        <p className={styles.hint}>{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className={styles.hiddenInput}
          onChange={(event) => event.target.files && addFiles(event.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className={styles.fileList}>
          {files.map((file, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={`${file.name}-${index}`} className={styles.fileItem}>
              <LuFile className={styles.fileIcon} />
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{formatBytes(file.size)}</span>
              <button
                type="button"
                className={styles.removeButton}
                onClick={(event) => {
                  event.stopPropagation();
                  removeFile(index);
                }}
                aria-label={`Remover ${file.name}`}
              >
                <LuX />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
