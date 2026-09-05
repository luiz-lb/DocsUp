import { Step, StepLabel, Stepper } from '@mui/material';
import styles from './WizardStepper.module.css';

// tone="light" (padrão): fundo claro, usa a cor primária (teal) do tema em
// etapas ativas/concluídas.
// tone="dark": fundo teal escuro (ex.: card do cadastro de fornecedor),
// inverte para tons de creme/branco para manter contraste.
const TONE_SX = {
  light: {},
  dark: {
    '& .MuiStepIcon-root': { color: 'rgba(255, 250, 228, 0.35)' },
    '& .MuiStepIcon-root.Mui-active': { color: '#000000' },
    '& .MuiStepIcon-root.Mui-completed': { color: 'var(--color-creamText, #fffae4)' },
    '& .MuiStepIcon-text': { fill: 'var(--color-creamText, #fffae4)', fontWeight: 700 },
    '& .MuiStepLabel-label': { color: 'rgba(255, 250, 228, 0.7)' },
    '& .MuiStepLabel-label.Mui-active': { color: 'var(--color-creamText, #fffae4)', fontWeight: 700 },
    '& .MuiStepLabel-label.Mui-completed': { color: 'var(--color-creamText, #fffae4)' },
    '& .MuiStepConnector-line': { borderColor: 'rgba(255, 250, 228, 0.3)' },
  },
};

/**
 * Cabecalho de wizard multi-etapas. Usado pela nova solicitacao de M.O.,
 * cadastro de fornecedor e submissao de cotacao - todos fluxos "passo a passo".
 */
export default function WizardStepper({ steps, activeStep, tone = 'light' }) {
  return (
    <Stepper activeStep={activeStep} alternativeLabel className={styles.stepper} sx={TONE_SX[tone]}>
      {steps.map((step) => (
        <Step key={step}>
          <StepLabel>{step}</StepLabel>
        </Step>
      ))}
    </Stepper>
  );
}
