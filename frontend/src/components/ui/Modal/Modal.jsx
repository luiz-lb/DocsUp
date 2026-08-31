import { Dialog, DialogActions, DialogContent, DialogTitle, IconButton } from '@mui/material';
import { LuX } from 'react-icons/lu';
import styles from './Modal.module.css';

/**
 * Wrapper fino sobre MUI Dialog com slots consistentes (title/actions).
 * Base de ConfirmDialog e de dialogs de negocio como AcceptanceTermDialog.
 */
export default function Modal({ open, onClose, title, actions, maxWidth = 'sm', children }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <div className={styles.titleRow}>
        <IconButton className={styles.spacer} size="small" disabled aria-hidden="true">
          <LuX />
        </IconButton>
        <DialogTitle className={styles.title}>{title}</DialogTitle>
        <IconButton onClick={onClose} size="small" aria-label="Fechar">
          <LuX />
        </IconButton>
      </div>
      <DialogContent dividers>{children}</DialogContent>
      {actions && <DialogActions className={styles.actions}>{actions}</DialogActions>}
    </Dialog>
  );
}
