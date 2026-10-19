import { useState } from 'react';
import { LuBuilding2, LuFileText, LuHardHat, LuIdCard, LuWrench } from 'react-icons/lu';
import { PageHeader } from '../../../components/ui/index.js';
import { DOCUMENT_CATEGORY, DOCUMENT_CATEGORY_ID } from '../../../constants/enums.js';
import { cn } from '../../../utils/cn.js';
import DocumentTypesTab from '../components/DocumentTypesTab/index.js';
import ActivitiesTab from '../components/ActivitiesTab/index.js';
import styles from './ParametersPage.module.css';

// Uma aba por categoria de documento, mais a de atividades
const TABS = [
  { key: 'empresa', label: DOCUMENT_CATEGORY[DOCUMENT_CATEGORY_ID.EMPRESA].label, icon: LuBuilding2, category: DOCUMENT_CATEGORY_ID.EMPRESA },
  { key: 'basicos', label: DOCUMENT_CATEGORY[DOCUMENT_CATEGORY_ID.BASICO].label, icon: LuIdCard, category: DOCUMENT_CATEGORY_ID.BASICO },
  { key: 'nrs', label: DOCUMENT_CATEGORY[DOCUMENT_CATEGORY_ID.NR].label, icon: LuHardHat, category: DOCUMENT_CATEGORY_ID.NR },
  { key: 'outros', label: DOCUMENT_CATEGORY[DOCUMENT_CATEGORY_ID.OUTRO].label, icon: LuFileText, category: DOCUMENT_CATEGORY_ID.OUTRO },
  { key: 'atividades', label: 'Atividades', icon: LuWrench, category: null },
];

export default function ParametersPage() {
  const [activeKey, setActiveKey] = useState(TABS[0].key);
  const activeTab = TABS.find((tab) => tab.key === activeKey) ?? TABS[0];

  return (
    <div>
      <PageHeader
        eyebrow="Administração"
        title="Parâmetros"
        description="Catálogo dos documentos exigidos (da empresa e dos colaboradores) e das atividades, com os documentos sugeridos para cada uma."
      />

      <div className={styles.tabs} role="tablist">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === activeKey}
            className={cn(styles.tab, key === activeKey && styles.tabActive)}
            onClick={() => setActiveKey(key)}
          >
            <Icon /> {label}
          </button>
        ))}
      </div>

      {/* key: cada aba começa com a busca e os filtros limpos */}
      <div role="tabpanel" className={styles.tabPanel}>
        {activeTab.category === null ? (
          <ActivitiesTab key={activeTab.key} />
        ) : (
          <DocumentTypesTab key={activeTab.key} category={activeTab.category} />
        )}
      </div>
    </div>
  );
}
