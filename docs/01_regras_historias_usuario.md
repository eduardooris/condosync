**CondoSync**

Regras de Negócio & Histórias de Usuário

Documento 1 de 3  ·  v1.0

Eduardo Oris  ·  Atende+

# 1. Visão Geral do Produto

## 1.1 Problema

- Condomínios subsidiados (MCMV) não têm recursos para contratar administradoras

- Síndicos informais gerenciam tudo no papel ou em grupos de WhatsApp, sem rastreabilidade

- Moradores não têm transparência sobre o uso das taxas condominiais

- Cobranças e comunicados são feitos de forma manual e ineficiente

## 1.2 Solução

- PWA acessível de qualquer dispositivo, sem necessidade de app instalado

- Módulo financeiro com total transparência de arrecadação e despesas

- Comunicação automática via WhatsApp para cobranças e comunicados

- Governança digital: enquetes com votação por unidade, atas digitais e documentos

## 1.3 Perfis de Usuário

| Perfil | Descrição | Nível de Acesso |
| --- | --- | --- |
| Síndico | Administrador principal do condomínio | Controle total |
| Subsíndico | Auxiliar do síndico | Acesso parcial configurável |
| Responsável Financeiro | Morador designado da unidade | Financeiro + Enquetes |
| Morador | Residente da unidade | Leitura (mural, docs, extrato) |

## 1.4 Premissas de Negócio

- Um usuário pode ser síndico de múltiplos condomínios (relação N:N)

- Cada unidade tem exatamente 1 responsável financeiro ativo

- Enquetes: 1 voto por unidade, somente pelo responsável financeiro

- Cobranças geradas são enviadas via WhatsApp automaticamente

- Toda integração externa é desacoplada via adapter (storage, WhatsApp, auth)

# 2. Módulos do Sistema

| Módulo | Descrição |
| --- | --- |
| Auth & Usuários | Autenticação via Keycloak (JWT RS256). Perfis com role. Vínculo a múltiplos condomínios. |
| Condomínios | Cadastro com CNPJ, endereço, foto e configurações (taxa, vencimento). |
| Unidades | Bloco, número, tipo (apto/casa/comercial), status de ocupação. |
| Moradores | CPF, WhatsApp, e-mail, vínculo com unidade, flag responsável financeiro. |
| Documentos | Upload de arquivos via Storage Adapter, categorias, visibilidade. |
| Mural de Recados | Comunicados com prioridade (info/atenção/urgente) e data de expiração. |
| Ocorrências | Abertura por moradores, fluxo de status, anexo, opção anônima. |
| Enquetes | 1 voto por unidade via responsável. Resultado bloqueado até encerramento. |
| Arrecadação | Cobranças mensais automáticas, status de pagamento, isenções justificadas. |
| Despesas | Lançamento com comprovante, visível a todos os moradores. |
| Notificações WhatsApp | Envio de cobranças e avisos via WhatsApp Adapter desacoplado. |
| Dashboard Financeiro | Saldo atual, inadimplência, gráficos mensais, exportação PDF. |

# 3. Regras de Negócio

## RN-01 — Condomínio & Unidades

| RN-01.1 | Um usuário pode ser administrador de N condomínios. A relação é N:N através da tabela user_condominiums com campo role. |
| --- | --- |

| RN-01.2 | Cada unidade pertence a exatamente 1 condomínio e pode ter N moradores, mas apenas 1 responsável financeiro ativo por vez. |
| --- | --- |

| RN-01.3 | Não é possível excluir um condomínio com unidades ativas ou saldo financeiro pendente. A operação permitida é arquivar. |
| --- | --- |

## RN-02 — Moradores & Responsável Financeiro

| RN-02.1 | O responsável financeiro deve ter CPF e número de WhatsApp válido cadastrado. O sistema valida o formato antes de salvar. |
| --- | --- |

| RN-02.2 | Ao trocar o responsável financeiro, o anterior permanece como morador mas perde acesso financeiro. O histórico de responsáveis é preservado. |
| --- | --- |

| RN-02.3 | Um morador pode estar vinculado a mais de uma unidade, mas pode ser responsável financeiro de no máximo 1 unidade simultaneamente. |
| --- | --- |

## RN-03 — Financeiro

| RN-03.1 | Cobranças mensais são geradas automaticamente no dia configurado pelo síndico nas configurações do condomínio. |
| --- | --- |

| RN-03.2 | O status de uma cobrança segue o fluxo: pendente → paga \| atrasada \| isenta. Isenção requer justificativa obrigatória. |
| --- | --- |

| RN-03.3 | Despesas devem ter categoria obrigatória (manutenção, limpeza, portaria, jurídico, outros) e podem ter comprovante em anexo. São visíveis a todos os moradores. |
| --- | --- |

| RN-03.4 | Saldo do condomínio = soma de arrecadações pagas − soma de despesas aprovadas. Saldo negativo dispara alerta automático ao síndico. |
| --- | --- |

| RN-03.5 | Após 5 dias do vencimento sem pagamento, o status muda automaticamente para atrasada e uma notificação de lembrete é enviada via WhatsApp. |
| --- | --- |

## RN-04 — Enquetes

| RN-04.1 | Apenas o responsável financeiro da unidade pode votar. O voto é único e irrevogável. Por padrão é anônimo, configurável pelo síndico. |
| --- | --- |

| RN-04.2 | Quórum mínimo é configurável por enquete (exemplo: 50% das unidades). Enquete encerra por data limite ou manualmente pelo síndico. |
| --- | --- |

| RN-04.3 | Resultados ficam bloqueados e invisíveis até o encerramento oficial da enquete, para não influenciar votantes pendentes. |
| --- | --- |

## RN-05 — Ocorrências

| RN-05.1 | Fluxo de status das ocorrências: aberta → em análise → resolvida \| arquivada. Somente o síndico avança o status. |
| --- | --- |

| RN-05.2 | O autor da ocorrência recebe notificação automática (in-app + WhatsApp opcional) a cada mudança de status. |
| --- | --- |

| RN-05.3 | Ocorrências podem ser públicas ou anônimas para outros moradores. O síndico sempre tem acesso à identidade do autor. |
| --- | --- |

# 4. Histórias de Usuário

```
US-01  ·  SÍNDICO
Cadastrar Condomínio e Unidades
"Como síndico, quero cadastrar meu condomínio com todas as suas unidades, para que eu possa gerenciar moradores, finanças e comunicação de forma centralizada."
Critérios de Aceite:
Posso criar um condomínio informando nome, CNPJ, endereço, número de unidades e foto
Posso cadastrar unidades individualmente ou via importação em lote (CSV)
Cada unidade deve ter: bloco, número, tipo e status (ocupada/vaga)
Posso vincular minha conta a mais de um condomínio e alternar entre eles no menu
```

```
US-02  ·  SÍNDICO
Cadastrar Moradores e Responsável Financeiro
"Como síndico, quero cadastrar os moradores de cada unidade e definir quem é o responsável financeiro, para que as cobranças sejam direcionadas à pessoa correta via WhatsApp."
Critérios de Aceite:
Posso cadastrar N moradores em uma unidade, informando nome, CPF, telefone e e-mail
Devo selecionar exatamente 1 responsável financeiro por unidade
O responsável deve ter WhatsApp válido — validação de formato obrigatória
Ao trocar o responsável, sou alertado sobre o impacto em cobranças futuras
```

```
US-03  ·  SÍNDICO
Gerar e Enviar Cobranças Mensais
"Como síndico, quero que o sistema gere as cobranças mensais automaticamente e notifique os responsáveis pelo WhatsApp, para eliminar o trabalho manual de cobrança."
Critérios de Aceite:
Configuro o valor da taxa e o dia de vencimento nas configurações do condomínio
As cobranças são geradas automaticamente para todas as unidades ocupadas no mês
O responsável financeiro recebe mensagem WhatsApp com o link de pagamento
Posso marcar uma unidade como isenta com justificativa e ela não gera cobrança
Após 5 dias de atraso, um lembrete automático é enviado via WhatsApp
```

```
US-04  ·  SÍNDICO
Registrar Despesas do Condomínio
"Como síndico, quero registrar todas as despesas do condomínio com comprovantes, para que os moradores possam ver exatamente onde o dinheiro é gasto."
Critérios de Aceite:
Lanço despesas com: descrição, valor, data, categoria e fornecedor
Posso anexar comprovante (nota fiscal, recibo) em formato PDF ou imagem
Todos os moradores podem visualizar o extrato de despesas
O dashboard mostra o saldo atual = receitas pagas menos despesas aprovadas
```

```
US-05  ·  RESPONSÁVEL FINANCEIRO
Votar em Enquetes
"Como responsável pela unidade, quero votar nas enquetes criadas pelo síndico, para participar das decisões do condomínio de forma digital e transparente."
Critérios de Aceite:
Recebo notificação (in-app e WhatsApp) quando uma nova enquete é aberta
Consigo votar em no máximo 1 opção por enquete
Após votar, não posso alterar meu voto
O resultado só aparece após o encerramento da enquete
Moradores sem papel de responsável visualizam a enquete mas não votam
```

```
US-06  ·  MORADOR
Abrir Ocorrência
"Como morador, quero registrar ocorrências (problemas, reclamações) para que o síndico seja notificado e possa tomar providências de forma rastreável."
Critérios de Aceite:
Abro uma ocorrência com título, categoria, descrição e opção de anexar foto ou documento
Posso escolher se a ocorrência é pública ou anônima para outros moradores
Recebo notificação a cada mudança de status da minha ocorrência
Visualizo o histórico de todas as minhas ocorrências e seus status
```

```
US-07  ·  SÍNDICO
Gerenciar Documentos
"Como síndico, quero fazer upload de documentos importantes (atas, regulamento, contratos) para que todos os moradores tenham acesso digital a qualquer hora."
Critérios de Aceite:
Faço upload de arquivos com título, descrição, categoria e data do documento
Posso definir visibilidade: todos os moradores ou somente administradores
Arquivos são armazenados em bucket (S3-compatible) com URL segura temporária
Moradores recebem notificação quando um novo documento é publicado
```

```
US-08  ·  MORADOR
Visualizar Transparência Financeira
"Como morador, quero visualizar o extrato de receitas e despesas do condomínio, para entender onde minha taxa condominial é aplicada e ter confiança na gestão."
Critérios de Aceite:
Vejo o saldo atual do caixa do condomínio em destaque no dashboard
Acesso lista de despesas com data, valor, categoria e comprovante
Vejo meu histórico de cobranças: pagas, pendentes e atrasadas
Gráfico mensal de entrada × saída disponível para qualquer morador
```

```
US-09  ·  SÍNDICO
Publicar Recado no Mural
"Como síndico, quero publicar comunicados no mural com diferentes níveis de prioridade, para que os moradores sejam notificados de forma organizada."
Critérios de Aceite:
Crio comunicados com título, corpo do texto e prioridade (info / atenção / urgente)
Posso configurar uma data de expiração automática para o recado
Comunicados urgentes disparam notificação WhatsApp para todos os responsáveis
Moradores veem o mural ordenado por prioridade e data
```
