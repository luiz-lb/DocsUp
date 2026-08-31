import FormField from '../../../components/ui/FormField/index.js';
import { formatCnpj } from '../../../utils/formatters.js';

/** Input de CNPJ com mascara automatica, reusado em login e cadastro. */
export default function CnpjField({ value, onChange, ...rest }) {
  return (
    <FormField label="CNPJ" required {...rest}>
      <input
        value={value}
        onChange={(event) => onChange(formatCnpj(event.target.value))}
        placeholder="00.000.000/0000-00"
        inputMode="numeric"
      />
    </FormField>
  );
}
