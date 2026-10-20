import path from 'path';

/** Diretório raiz de uploads (absoluto). */
export function getUploadBaseDir() {
    const configured = process.env.UPLOAD_DIR ?? 'uploads';
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

/**
 * Caminho absoluto de um arquivo gravado (documents.file_path é relativo à raiz de uploads).
 * Retorna null se o caminho sair da pasta de uploads (ex.: '../../etc/passwd' ou um caminho
 * absoluto gravado no banco): nenhum download lê arquivo fora dela.
 */
export function resolveUploadPath(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.trim() === '') return null;

    const baseDir = path.resolve(getUploadBaseDir());
    const absolutePath = path.resolve(baseDir, relativePath);
    return absolutePath.startsWith(baseDir + path.sep) ? absolutePath : null;
}
