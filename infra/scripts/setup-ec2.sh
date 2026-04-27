#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-ec2.sh — Configuração inicial de uma instância EC2 Ubuntu 24.04 LTS
#
# Execute UMA VEZ depois de criar a instância:
#   chmod +x infra/scripts/setup-ec2.sh
#   sudo ./infra/scripts/setup-ec2.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "==> Atualizando pacotes..."
apt-get update -y
apt-get upgrade -y

echo "==> Instalando dependências base..."
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  ufw \
  unzip \
  htop

# ── Docker ────────────────────────────────────────────────────────────────────
echo "==> Instalando Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable --now docker

# Permitir que o usuário ubuntu rode Docker sem sudo
usermod -aG docker ubuntu

# ── Firewall ──────────────────────────────────────────────────────────────────
echo "==> Configurando UFW..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh          # 22
ufw allow http         # 80
ufw allow https        # 443
ufw --force enable

echo "==> Status do firewall:"
ufw status verbose

# ── Diretório do projeto ───────────────────────────────────────────────────────
echo ""
echo "==> Setup concluído!"
echo ""
echo "Próximos passos:"
echo "  1. Faça logout e login novamente para aplicar permissões Docker"
echo "  2. Clone o repositório:"
echo "       git clone <seu-repo> /home/ubuntu/condosync"
echo "  3. Configure as variáveis de ambiente:"
echo "       cp /home/ubuntu/condosync/infra/.env.prod.example /home/ubuntu/condosync/infra/.env.prod"
echo "       nano /home/ubuntu/condosync/infra/.env.prod"
echo "  4. Atualize os domínios no nginx.conf:"
echo "       nano /home/ubuntu/condosync/infra/nginx/nginx.conf"
echo "  5. Suba os containers:"
echo "       cd /home/ubuntu/condosync/infra"
echo "       docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build"
echo "  6. Emita os certificados SSL:"
echo "       bash /home/ubuntu/condosync/infra/scripts/init-ssl.sh"
