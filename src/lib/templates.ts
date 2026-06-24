import {
  BarChart3,
  FileSpreadsheet,
  Headphones,
  Mail,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AgentTemplate = {
  id: string;
  name: string;
  category: string;
  tagline: string;
  objective: string;
  icon: LucideIcon;
  estimatedHours: string;
};

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "vendas-semanais",
    name: "Analista de Vendas",
    category: "Comercial",
    tagline: "Resumos semanais, alertas de queda e oportunidades.",
    objective:
      "Acompanhar vendas semanais, identificar quedas relevantes, listar produtos em destaque e gerar um resumo executivo toda segunda-feira pela manhã com recomendações práticas para o time comercial.",
    icon: BarChart3,
    estimatedHours: "~6h/semana",
  },
  {
    id: "atendimento-faq",
    name: "Atendimento N1",
    category: "Suporte",
    tagline: "Responde dúvidas frequentes com base na sua documentação.",
    objective:
      "Responder dúvidas frequentes de clientes com base nos documentos internos, manuais e políticas da empresa. Sempre indicar a fonte e escalar para humano quando a confiança for baixa.",
    icon: Headphones,
    estimatedHours: "~10h/semana",
  },
  {
    id: "financeiro-conciliacao",
    name: "Assistente Financeiro",
    category: "Financeiro",
    tagline: "Concilia movimentações e aponta divergências.",
    objective:
      "Comparar relatórios financeiros e extratos para identificar divergências, lançamentos duplicados e categorias incorretas. Produzir uma lista priorizada de pendências para revisão humana.",
    icon: FileSpreadsheet,
    estimatedHours: "~8h/semana",
  },
  {
    id: "rh-onboarding",
    name: "Onboarding de RH",
    category: "Pessoas",
    tagline: "Guia novos colaboradores pelos processos internos.",
    objective:
      "Apoiar novos colaboradores respondendo dúvidas sobre políticas, benefícios e processos internos da empresa nos 30 primeiros dias. Sempre referenciar o documento de origem.",
    icon: Users,
    estimatedHours: "~5h por contratação",
  },
  {
    id: "marketing-conteudo",
    name: "Editor de Conteúdo",
    category: "Marketing",
    tagline: "Briefings, pautas e revisões alinhadas à marca.",
    objective:
      "Gerar briefings, sugerir pautas e revisar conteúdos garantindo aderência ao tom de voz, glossário e diretrizes da marca contidos nos documentos enviados.",
    icon: Megaphone,
    estimatedHours: "~7h/semana",
  },
  {
    id: "operacoes-relatorios",
    name: "Relatórios Operacionais",
    category: "Operações",
    tagline: "Transforma dados crus em relatórios executivos.",
    objective:
      "Consolidar planilhas e logs operacionais em um relatório semanal de uma página com KPIs, anomalias e ações recomendadas para a diretoria.",
    icon: ScrollText,
    estimatedHours: "~4h/semana",
  },
  {
    id: "compliance",
    name: "Compliance e Políticas",
    category: "Jurídico",
    tagline: "Valida contratos e processos contra políticas internas.",
    objective:
      "Avaliar contratos, propostas e processos comparando com as políticas internas. Apontar riscos, cláusulas incomuns e recomendar próximos passos.",
    icon: ShieldCheck,
    estimatedHours: "~6h/semana",
  },
  {
    id: "emails-comerciais",
    name: "Redator Comercial",
    category: "Comercial",
    tagline: "E-mails de prospecção e follow-up personalizados.",
    objective:
      "Escrever e-mails de prospecção e follow-up personalizados conforme contexto do cliente, sempre seguindo o tom e os argumentos dos materiais comerciais enviados.",
    icon: Mail,
    estimatedHours: "~5h/semana",
  },
];

export function getTemplate(id: string | null | undefined): AgentTemplate | undefined {
  if (!id) return undefined;
  return AGENT_TEMPLATES.find((t) => t.id === id);
}
