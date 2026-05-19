# Câmeras IP — LGPD e permissões no produto

## Base legal e transparência

- Filmagem em **áreas comuns** do condomínio: base legal usual é **legítimo interesse** (segurança patrimonial) + informação clara aos moradores.
- **Obrigatório:** placas visíveis (“Área monitorada por câmeras”) e aviso na assembleia / regimento.
- **Proibido:** câmeras apontadas para dentro de unidades, banheiros ou áreas íntimas.

## Retenção de dados

| Tipo | Padrão CondoSync | Configurável |
| --- | --- | --- |
| Snapshot no S3 | Substituído a cada captura (1 objeto `latest.jpg` por câmera) | `snapshotIntervalSec` |
| Metadados (nome, área, logs de acesso) | Enquanto câmera ativa | Admin desativa/remove |
| Gravação NVR local | Responsabilidade do condomínio | Fora do CondoSync v1 |

Recomendação ao síndico: retenção NVR 7–30 dias; snapshots no app são **visualização momentânea**, não arquivo histórico.

## Matriz de permissões (`visibilityMinRole`)

Implementada no backend (`Camera.visibilityMinRole`) e refletida na UI.

| Valor | Quem vê no app/PWA |
| --- | --- |
| `ALL_RESIDENTS` | Morador, responsável, subsíndico, síndico |
| `RESPONSIBLE_UP` | Responsável financeiro, subsíndico, síndico |
| `ADMIN_ONLY` | Subsíndico e síndico (gestão; morador não lista) |

Cadastro, edição e remoção de câmeras: apenas `ADMIN` e `SUB_ADMIN`.

## Logs e auditoria

- Acesso a `GET .../cameras/:id/snapshot-url` e `stream-url` deve ser rastreável via `requestId` nos logs (Pino).
- Evitar logar URLs com credenciais ou tokens de stream.

## Textos na UI (produto)

Exibidos no PWA (`CamerasPage`) e app mobile (`CamerasList`):

- **Aviso:** “As imagens são de áreas comuns do condomínio. O uso indevido ou compartilhamento das gravações pode violar a LGPD e o regimento interno.”
- **Admin:** checkbox de confirmação ao cadastrar câmera: “Confirmo que há placa de monitoramento e autorização da assembleia/síndico.”

## Direitos do titular

Morador pode solicitar ao síndico:

- Esclarecimento sobre quais áreas são filmadas.
- Não há biometria nem reconhecimento facial no CondoSync v1.

## DPA e subprocessadores

- **S3/MinIO:** armazenamento de snapshots — incluir no inventário de subprocessadores do condomínio.
- **go2rtc (self-hosted):** processamento de vídeo no gateway do condomínio — dados não precisam transitar por terceiro se o gateway for do próprio condomínio.
