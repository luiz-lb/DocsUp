import { Step, StepLabel, Stepper } from '@mui/material';
import styles from './WizardStepper.module.css';

/**
 * Cabecalho de wizard multi-etapas. Usado pela nova solicitacao de M.O.,
 * cadastro de fornecedor e submissao de cotacao - todos fluxos "passo a passo".
 */
export default function WizardStepper({ steps, activeStep }) {
  return (
    <Stepper activeStep={activeStep} alternativeLabel className={styles.stepper}>
      {steps.map((step) => (
        <Step key={step}>
          <StepLabel>{step}</StepLabel>
        </Step>
      ))}
    </Stepper>
  );
}
