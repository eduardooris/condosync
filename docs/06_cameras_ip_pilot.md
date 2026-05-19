# Câmeras IP — Piloto CondoSync

Documento operacional para o primeiro condomínio com CFTV integrado ao app.

## Objetivo do piloto

Validar ponta a ponta: cadastro admin → captura periódica de snapshots → visualização no PWA e app mobile, com opção de live HLS via go2rtc.

## Perfil recomendado do condomínio piloto

| Critério | Recomendação |
| --- | --- |
| Tamanho | 1 torre ou condomínio horizontal pequeno (até ~80 unidades) |
| Rede | Switch gerenciável ou roteador com VLAN; técnico/integrador disponível |
| Câmeras existentes | NVR Intelbras/Hikvision/Dahua **ou** 2–4 câmeras PoE novas |
| Conectividade WAN | Link estável; preferir VPN site-to-site ou Tailscale no gateway |

## Cenários homologados no piloto

### Cenário A — NVR com RTSP (preferido se já houver CFTV)

1. Habilitar stream secundário (substream) no NVR — tipicamente 640×480 ou 704×576.
2. Anotar URL RTSP por canal (ex.: `rtsp://admin:senha@192.168.1.50:554/Streaming/Channels/102`).
3. Instalar **go2rtc** no mesmo segmento de rede do NVR (mini-PC ou container na VPS com VPN).
4. No CondoSync: provider `GO2RTC` ou `RTSP`, `streamSlug` = ID da câmera, credenciais criptografadas no backend.

### Cenário B — Câmeras IP PoE sem NVR

1. Switch PoE + 2 câmeras ONVIF (Intelbras VIP, Hikvision EasyIP ou equivalente).
2. IPs fixos; snapshot HTTP ou RTSP documentado no manual.
3. go2rtc no Raspberry Pi 4 (4 GB) ou mini-PC na portaria.

### Cenário C — Wi-Fi cloud (Ezviz / IMOU)

**Fora do escopo do piloto técnico v1** — usar app do fabricante ou fase P3 (adapter B2B). Registrar no backlog se o piloto exigir apenas câmeras Wi-Fi.

## Áreas sugeridas (piloto)

| Área | Visibilidade morador | Live (P2) | Snapshot (P1) |
| --- | --- | --- | --- |
| Portaria / entrada | Todos (`ALL_RESIDENTS`) | Opcional | Sim |
| Garagem / vagas | Todos | Opcional | Sim |
| Hall / elevador | Todos | Não | Sim |
| Playground / piscina | Todos | Não | Sim |
| Fachada / ruído | Somente responsáveis | Não | Sim |
| Administração | Somente admin | Não | Não expor |

## Checklist de go-live (piloto)

- [ ] VLAN ou segmento `CFTV` isolado (ver [`06_cameras_ip_network_runbook.md`](./06_cameras_ip_network_runbook.md))
- [ ] Senhas padrão alteradas; RTSP não exposto na internet
- [ ] Placas de monitoramento nas áreas filmadas
- [ ] Síndico aceita política LGPD ([`06_cameras_ip_lgpd.md`](./06_cameras_ip_lgpd.md))
- [ ] `GO2RTC_BASE_URL` / túnel VPN testado a partir da VPS
- [ ] 2 câmeras cadastradas no PWA; morador vê imagem no app em até 30 s
- [ ] Teste de live HLS (se `liveStreamEnabled`)

## Variáveis de ambiente (piloto)

Ver `backend/.env.example` — seção **Câmeras IP**.

## Métricas de sucesso

- Taxa de snapshots com sucesso > 95% em 24 h
- Latência percebida snapshot: &lt; 30 s (`snapshotIntervalSec` padrão 15)
- Zero vazamento de URL RTSP ou credenciais em respostas da API
- Morador sem permissão recebe 403 ao tentar câmera restrita
