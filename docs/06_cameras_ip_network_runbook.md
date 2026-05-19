# Câmeras IP — Runbook de rede (instalação no condomínio)

Guia para integradores e síndicos. Complementa o piloto em [`06_cameras_ip_pilot.md`](./06_cameras_ip_pilot.md).

## 1. Topologia recomendada

```text
[Internet]
    |
[Firewall condomínio]
    |
+--- VLAN Moradores (Wi-Fi) — sem acesso às câmeras
|
+--- VLAN CFTV (192.168.100.0/24)
        |
        +-- Switch PoE
        |     +-- Câmera 1 (192.168.100.11)
        |     +-- Câmera 2 (192.168.100.12)
        |
        +-- NVR (192.168.100.50) [opcional]
        |
        +-- Gateway go2rtc (192.168.100.10)
              |
              +-- VPN / Tailscale → VPS CondoSync
```

## 2. Endereçamento

| Dispositivo | IP exemplo | Observação |
| --- | --- | --- |
| Gateway go2rtc | 192.168.100.10 | Hostname fixo `cftv-gw.local` |
| NVR | 192.168.100.50 | RTSP porta 554 |
| Câmeras | 192.168.100.11+ | DHCP reservation no switch |

**Nunca** port-forward RTSP (554) para a internet pública.

## 3. Acesso da VPS CondoSync às câmeras

A API na nuvem **não alcança** IPs privados do condomínio sem túnel.

| Método | Quando usar | Configuração |
| --- | --- | --- |
| **Tailscale / WireGuard** | Piloto e produção recomendados | Instalar cliente no gateway; `GO2RTC_BASE_URL=http://100.x.x.x:1984` na VPS |
| **VPN site-to-site** | Condomínios com firewall corporativo | IPsec entre roteadores |
| **Agente reverso** | Sem IP fixo no condomínio | Container no gateway com outbound SSH/WireGuard |

O backend usa `GO2RTC_BASE_URL` (rede interna/VPN) para snapshots e sync de streams.  
`GO2RTC_PUBLIC_URL` é a URL que o **app do morador** usa para HLS (deve ser HTTPS em produção, idealmente via reverse proxy autenticado).

## 4. go2rtc (dev e piloto)

### Docker local (monorepo)

```bash
docker compose -f infra/dev/docker-compose.cameras.yml up -d go2rtc
```

UI: http://localhost:1984  
HLS de teste: `http://localhost:1984/api/stream.m3u8?src=<streamSlug>`

### Exemplo `go2rtc.yaml` no condomínio

```yaml
streams:
  # streamSlug = UUID da câmera no CondoSync (preenchido via API ao cadastrar)
  a1b2c3d4-e5f6-7890-abcd-ef1234567890:
    - rtsp://usuario:senha@192.168.100.11:554/stream1
```

O backend pode sincronizar streams automaticamente quando `GO2RTC_BASE_URL` está configurado (ver `Go2rtcCameraGatewayAdapter`).

## 5. Firewall (VLAN CFTV)

| Origem | Destino | Porta | Ação |
| --- | --- | --- | --- |
| Gateway go2rtc | Câmeras / NVR | 554 TCP, 80/8000 HTTP | ALLOW |
| VPS (via VPN) | Gateway go2rtc | 1984 TCP | ALLOW |
| VLAN moradores | VLAN CFTV | qualquer | DENY |
| Internet | VLAN CFTV | qualquer | DENY |

## 6. Bandwidth

- Substream para app: ~512 kbps por câmera.
- Snapshot JPEG ~50–200 KB a cada 15 s ≈ &lt; 7 MB/h por câmera no upload para S3.
- Live HLS: reservar 1–2 Mbps por stream simultâneo.

## 7. Troubleshooting

| Sintoma | Verificação |
| --- | --- |
| Snapshot sempre `offline` | `curl -u user:pass http://IP/cgi-bin/snapshot.cgi` ou frame go2rtc |
| Live não carrega no app | `GO2RTC_PUBLIC_URL` acessível pelo celular (4G); certificado HTTPS |
| 403 no app | `visibilityMinRole` da câmera vs papel do morador |
| API não alcança go2rtc | Ping/telnet da VPS para IP Tailscale do gateway |

## 8. Homologação de marcas (RTSP/ONVIF)

| Marca | Snapshot HTTP | RTSP substream | Notas |
| --- | --- | --- | --- |
| Intelbras VIP | Variável | Sim | Manual do modelo |
| Hikvision | `/ISAPI/Streaming/channels/101/picture` | `Streaming/Channels/102` | Canal 102 = sub |
| Dahua | Similar Hikvision | Sim | ONVIF Profile S |
| Genérica ONVIF | ONVIF GetSnapshot | `rtsp://...` | Testar com ONVIF Device Manager |

Câmeras **somente cloud P2P** (sem RTSP local) não entram neste runbook — ver fase P3 do plano de produto.
