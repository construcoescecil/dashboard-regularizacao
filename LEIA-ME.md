# Publicação do dashboard

Este pacote mantém o fluxo `Google Planilhas → GitHub → Netlify → Dashboard`.

## Antes de enviar

1. Altere o repositório GitHub para **Private**.
2. Envie todo o conteúdo desta pasta, preservando as pastas `.github`, `netlify`, `public` e `scripts`.
3. Não publique a aba `LOGIN` nem inclua senhas em arquivos do repositório.

## Configuração do Netlify

1. Vincule o repositório e a branch `main`.
2. O arquivo `netlify.toml` define automaticamente `public` como pasta publicada e configura as funções.
3. Em **Project configuration → Environment variables**, crie `AUTH_SECRET` com uma sequência aleatória de pelo menos 32 caracteres.
4. Faça um novo deploy depois de salvar a variável.

## Atualização dos dados

O workflow `.github/workflows/atualizar-dados.yml` solicita a atualização a cada cinco minutos e também permite execução manual em **Actions → Atualizar dados do dashboard → Run workflow**.

O script só altera `dados.json` quando a planilha realmente muda. Se o Google falhar ou devolver a base principal vazia, a última cópia válida é preservada.

O GitHub pode atrasar execuções agendadas em períodos de alta demanda; cinco minutos é a frequência solicitada, não uma garantia de execução no segundo exato.

## Segurança

`dados.json` fica fora da pasta publicada do Netlify. O navegador recebe a base em partes somente depois que a função de login valida as credenciais e cria uma sessão temporária de oito horas. A aba `LOGIN` nunca é gravada no GitHub.
