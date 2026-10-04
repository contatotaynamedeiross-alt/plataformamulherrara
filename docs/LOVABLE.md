# Guia para o Lovable — Rara IA

Cole este guia no Lovable quando for construir as telas.
Ele define o que o front pode e não pode fazer com o banco.

---

## Conexão com o Supabase

Use apenas estas duas variáveis de ambiente no Lovable:

```
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

**Nunca** use a `service_role` key no front. Se o Lovable pedir uma chave "secreta" ou "admin", use a `anon key` acima.

---

## O que o front pode fazer diretamente

```typescript
import { supabase } from './lib/supabase'

// Ler próprio perfil
const { data } = await supabase.from('profiles').select('*')

// Ler própria assinatura
const { data } = await supabase.from('subscriptions').select('status, current_period_end')

// Ler próprias missões
const { data } = await supabase.from('missions').select('*')

// Atualizar status de uma missão
await supabase.from('missions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', missionId)

// Ler próprios pontos e medalhas
const { data } = await supabase.from('points').select('amount, reason, granted_at')
const { data } = await supabase.from('medals').select('medal_type, granted_at')
```

---

## O que o front NÃO pode fazer (use a Edge Function ou RPC)

| ❌ Proibido no front | ✅ Use isso em vez disso |
|---------------------|--------------------------|
| INSERT em `points` | Servidor concede automaticamente |
| INSERT/UPDATE em `subscriptions` | Webhook Greenn cuida disso |
| INSERT em `diagnostics` diretamente | Edge Function `save-diagnostic` |
| INSERT em `consents` diretamente | RPC `record_consent` |
| DELETE em qualquer tabela | RPC `delete_my_account` ou Edge Function `account-delete` |

---

## Fluxo: diagnóstico com crença/fé

```typescript
// 1. Mostrar aviso de dado sensível ao usuário
// "A pergunta sobre sua fé é um dado sensível. Você autoriza o uso?"

// 2. Registrar consentimento
const { data: consentId } = await supabase.rpc('record_consent', {
  p_purpose: 'diagnostic_sensitive_v1',
  p_version: '1.0',
  p_accepted: true,
})

// 3. Enviar diagnóstico para a Edge Function
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/save-diagnostic`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    answers: { q1: 'valor', q_fe: 'catolica', ... },
    result:  { tipo: 'A', recomendacoes: [...] },
    contains_sensitive: true,
  }),
})
```

---

## Fluxo: exportar dados (LGPD)

```typescript
const { data } = await supabase.rpc('export_my_data')
// data é um JSON com todos os dados da usuária
// Ofereça um botão "Baixar" que converte para arquivo .json
```

---

## Fluxo: excluir conta (LGPD)

```typescript
// Confirmar com a usuária antes ("Tem certeza? Esta ação é irreversível.")

const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/account-delete`, {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${session.access_token}` },
})
// Depois: redirecionar para página de saída e limpar sessão local
await supabase.auth.signOut()
```

---

## Autenticação (magic link)

```typescript
// Login (envia e-mail com link)
await supabase.auth.signInWithOtp({ email: 'usuario@email.com' })

// Verificar se está logada
const { data: { session } } = await supabase.auth.getSession()
if (!session) { /* redirecionar para /login */ }

// Sair
await supabase.auth.signOut()
```

---

## Erros comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `new row violates row-level security` | Front tentou INSERT proibido | Use a RPC ou Edge Function correta |
| `LGPD: consentimento explícito obrigatório` | Diagnóstico sensível sem `consent_id` | Chamar `record_consent` primeiro |
| `Unauthorized` nas funções | JWT expirado ou ausente | Renovar sessão (`supabase.auth.refreshSession()`) |
