import { useState } from 'react';
import { Slider } from '@mui/material';
import { LuSend } from 'react-icons/lu';
import Button from '../../../../components/ui/Button/index.js';
import FormField from '../../../../components/ui/FormField/index.js';
import styles from './EvaluationForm.module.css';

/** Formulario de avaliacao 0-10 usado por RH, Suprimentos e Chefe de Obra. */
export default function EvaluationForm({ roleLabel, onSubmit, isSubmitting }) {
  const [score, setScore] = useState(8);
  const [comments, setComments] = useState('');

  return (
    <div className={styles.wrapper}>
      <p className={styles.roleLabel}>Avaliando como {roleLabel}</p>

      <div className={styles.sliderRow}>
        <Slider value={score} onChange={(_, value) => setScore(value)} min={0} max={10} step={0.5} valueLabelDisplay="on" />
      </div>

      <FormField label="Comentarios">
        <textarea rows={3} value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Observacoes sobre o desempenho do fornecedor" />
      </FormField>

      <Button icon={LuSend} isLoading={isSubmitting} onClick={() => onSubmit(score, comments)}>
        Enviar avaliacao
      </Button>
    </div>
  );
}
