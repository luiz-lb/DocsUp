// Documento pessoal: o navegador não guarda em cache nem "adivinha" o tipo do arquivo
export function setPrivateFileHeaders(res) {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
}

/**
 * Envia um arquivo do servidor como download, com o nome original (Content-Disposition).
 * O caminho já deve ter passado pela trava da pasta de uploads (resolveUploadPath).
 */
export function sendPrivateFile(res, absolutePath, fileName, where = 'download') {
    setPrivateFileHeaders(res);
    return res.download(absolutePath, fileName, (error) => {
        if (!error) return;
        console.error(`${where}: erro ao enviar o arquivo:`, error.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, body: { message: 'Erro ao enviar o arquivo.' } });
        }
    });
}
