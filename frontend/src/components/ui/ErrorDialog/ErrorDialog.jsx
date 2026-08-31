import Modal from '../Modal/index.js';
import Banner from '../Banner/index.js';
import Button from '../Button/index.js';

/**
 * Popup generico para exibir uma mensagem de erro vinda da API (ex.: `result.body.message`).
 * Uso: <ErrorDialog open={hasError} onClose={() => setHasError(false)} message={errorMessage} />
 */
export default function ErrorDialog({
  open,
  onClose,
  title = 'Ocorreu um erro!',
  message,
  closeLabel = 'Fechar',
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <Button variant="danger" onClick={onClose}>
          {closeLabel}
        </Button>
      }
    >
      <Banner tone="danger" description={message} center />
    </Modal>
  );
}
