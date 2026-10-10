# Carga inicial — Open House da Alyne

Arquivos:
- `presentes.json`  → 12 presentes (cotas zeradas, sem fotos; edite à vontade)
- `convidados.csv`  → modelo da lista de convidados (Excel/Sheets, separador `;`)
- `seed.mjs`        → script que grava os dois no Firestore (não sobrescreve nada)

## Antes de tudo
1. **Convidados:** abra `convidados.csv`, APAGUE as 3 linhas "EXEMPLO" e cadastre os reais.
   Colunas: Nome ; WhatsApp ; Limite_Acompanhantes (0 = individual) ; Status (deixe `pendente`) ; Observacao.
2. **Presentes:** em `presentes.json` confira nome, preço, `totalQuantity` e `pixKey`.
   Para itens de loja, cole o link em `purchaseUrl`. Fotos: depois, pelo painel (Editar presente → Upload).
3. Valide sem gravar nada:  `node seed.mjs --dry-run`

## Caminho A — pelo painel admin (sem instalar nada)
- **Convidados:** entre em Área da Anfitriã → aba Convidados → **Importar CSV** → escolha `convidados.csv`.
- **Presentes:** aba Gerenciar Presentes → **Novo Presente**, um por vez (o app não tem importação em massa).

## Caminho B — script (presentes + convidados de uma vez)
1. Firebase Console → ⚙️ Configurações do projeto → **Contas de serviço** → *Gerar nova chave privada*.
   Salve o JSON nesta pasta (ex.: `chave.json`). **Nunca suba esse arquivo no GitHub nem compartilhe.**
2. Na pasta: `npm install`
3. `node seed.mjs --service-account chave.json`
   (só presentes: `--only gifts` · só convidados: `--only guests`)
4. O script imprime quantos foram criados e quantos já existiam (pulados). Pode rodar de novo sem duplicar.
5. Confira no Firebase Console → Firestore → coleções `gifts` e `guests`. Depois apague `chave.json`.

## Importante
- O script usa a chave de serviço, então ignora as regras do Firestore (por isso funciona mesmo antes de corrigi-las).
- Convidados entram com `status: pending`, `attendees: 0`. Quem já confirmou/reservou antes NÃO é alterado.
- A carga não corrige os bugs de confirmação/reserva: as regras do Firestore e o fluxo de RSVP ainda precisam do ajuste que descrevi na análise.
